"""The core agent: built on the Strands Agents SDK.

This is the piece that makes this project an "agent" rather than a
chatbot: it writes real code, runs it through a tool call, notices when
the result looks wrong from the tool's response, and fixes its own
mistakes without a human in the loop - all driven by Strands' own
tool-calling loop rather than a hand-rolled retry for-loop.

The dataframe can't be handed to the model directly (it's a Python
object, not something an LLM can generate), so `run_analysis_code` is
defined as a closure inside `answer_question()`, capturing `df` and a
few mutable trackers via closure instead of function arguments.
"""

import os
import re

import pandas as pd

from strands import Agent, tool
from strands.models.gemini import GeminiModel

from schema_utils import summarize_dataset
from sandbox import run_sandboxed
from chart_selector import select_chart

MAX_RETRIES = 3
NUMBER_RE = re.compile(r"-?\d[\d,]*\.?\d*")


def _numbers_in(text: str) -> set[float]:
    out = set()
    for raw in NUMBER_RE.findall(text):
        try:
            out.add(round(float(raw.replace(",", "")), 2))
        except ValueError:
            continue
    return out


def _numbers_in_result(value) -> set[float]:
    if isinstance(value, (pd.Series, pd.DataFrame)):
        nums = pd.to_numeric(
            value.values.ravel() if isinstance(value, pd.DataFrame) else value.values,
            errors="coerce",
        )
        return {round(float(n), 2) for n in nums if pd.notna(n)}
    if isinstance(value, (int, float)):
        return {round(float(value), 2)}
    return _numbers_in(str(value))


def _explanation_is_grounded(explanation: str, result) -> bool:
    """Guards against the LLM describing numbers it imagined earlier (in a
    code comment or an abandoned attempt) instead of the real, verified
    `result` the sandbox actually computed - the one thing this product
    promises never to fabricate."""
    claimed = _numbers_in(explanation)
    if not claimed:
        return True  # no numeric claims made - nothing to contradict
    actual = _numbers_in_result(result)
    if not actual:
        return True  # can't verify against a non-numeric result; don't block it
    return any(
        abs(abs(c) - abs(a)) <= max(1.0, abs(a) * 0.01)
        for c in claimed
        for a in actual
    )


def _strip_result_restatement(explanation: str) -> str:
    """The model is instructed to open with a "Result: ..." restatement as
    a self-grounding step before writing its prose explanation - but a
    small model doesn't reliably use that exact word, so this can't just
    regex for the literal prefix. Instead: split on the first blank line,
    and treat the part before it as a data dump to discard only if it
    doesn't read like a finished sentence (pandas reprs like "...dtype:
    int64" never end in punctuation) and a real explanation follows."""
    text = explanation.strip()
    if "\n\n" not in text:
        return text
    head, _, tail = text.partition("\n\n")
    tail = tail.strip()
    if tail and not re.search(r"[.!?]\s*$", head.strip()):
        return tail
    return text


def _fallback_explanation(result) -> str:
    """A guaranteed-correct, if plainer, description built directly from the
    verified result - used only when the model's own explanation contains
    numbers that don't match what was actually computed."""
    if isinstance(result, pd.Series):
        pairs = ", ".join(f"{idx}: {val}" for idx, val in result.items())
        return f"Here is the verified result: {pairs}."
    if isinstance(result, pd.DataFrame):
        return "Here is the verified result:\n" + result.to_string(index=False)
    return f"Here is the verified result: {result}."

SYSTEM_PROMPT = """You are a data analyst agent working with a pandas \
DataFrame called `df`. To answer a question, call the `run_analysis_code` \
tool with Python code that computes the answer and assigns it to a \
variable named `result`.

Rules for the code you send to the tool:
- Only use `df`, `pd` (pandas) and `np` (numpy). No other imports.
- `result` must be a single pandas Series, a single pandas DataFrame, or a \
plain Python scalar (a number or string) - never a dict, list, or anything \
nesting multiple pandas objects together. If you need to report more than \
one figure, put them all in one Series with clear labels as the index, or \
one DataFrame with clear columns - never a dict combining separate pieces.
- When your result is grouped by a category, date, or ID (e.g. via \
`.groupby(...)`), leave that column as the index rather than also keeping \
it as a plain data column - it is a row label, not a value to plot. Never \
include an ID/grouping column a second time as a data column.
- NEVER fabricate or hardcode a placeholder result (e.g. `result = \
pd.Series([100], index=['SomeCategory'])`) just to make the tool return \
success. Every value in `result` must come from actually computing on \
`df`. If the question doesn't have one single clean answer (e.g. nothing \
is actually declining, or the premise is slightly wrong), compute the \
closest real, honest metric from the data instead (e.g. growth per \
category, or the smallest real change) and explain the nuance in your \
final answer - do not invent numbers to avoid saying "no category fits \
that description."
- Do not print anything. Do not use input().

If the tool reports an error or an empty result, fix your code and call \
the tool again.

Once the tool reports success, your final answer must have exactly two \
parts, in this order:

1. A line starting with "Result:" that copies the numbers from the \
tool's "Success. result = ..." message character-for-character - the \
same digits, the same order, nothing rounded, nothing recalculated. \
Ignore any number you computed earlier in a code comment, in your own \
reasoning, or in a previous failed attempt; those were guesses and may \
be wrong. Only the most recent "Success. result = ..." message is real.
2. Then a short (2-4 sentence) plain-English explanation of what that \
restated result shows. Every number in this explanation must be one you \
just wrote in the "Result:" line - do not introduce a new number here, \
even one that "sounds more precise." If you are about to type a number \
that isn't in the "Result:" line above, stop: you are fabricating it.

Do not include code or mention the tool anywhere in your final answer.
"""


def _result_looks_empty(value) -> bool:
    if value is None:
        return True
    try:
        return value.empty  # pandas Series/DataFrame
    except AttributeError:
        return False


def answer_question(df, question: str, history: list[str] | None = None) -> dict:
    """Runs the agent on one question and returns the outcome.

    Returns a dict: {"success": bool, "result": ..., "explanation": str,
    "chart": {...}, "code": str, "attempts": int}
    """
    schema = summarize_dataset(df)
    history = history or []

    state = {
        "attempts": 0,
        "last_code": None,
        "last_result": None,
        "last_error": None,
        "result_code": None,  # the code that actually produced last_result -
                               # kept separate from last_code, which tracks
                               # whatever was tried most recently (the agent
                               # sometimes calls the tool again after a
                               # success, e.g. to double-check something,
                               # which must not overwrite what's shown as
                               # "the code that ran" for the real result)
    }

    @tool
    def run_analysis_code(code: str) -> str:
        """Runs pandas code against the user's dataset and reports the result.

        Args:
            code: Python code using df, pd, and np that assigns the answer
                to a variable named `result`.
        """
        state["attempts"] += 1
        state["last_code"] = code

        if state["attempts"] > MAX_RETRIES:
            state["attempts"] -= 1  # this call didn't run any code - don't count it
            return (
                "STOP. Do not call run_analysis_code again under any "
                "circumstances - the tool is now disabled for this question. "
                "Immediately write your final plain-English answer telling the "
                "user you couldn't reliably compute this, with no further tool "
                "calls."
            )

        status, value = run_sandboxed(code, df)

        if status == "ok" and not _result_looks_empty(value):
            state["last_result"] = value
            state["result_code"] = code
            state["last_error"] = None
            return f"Success. result = {value}"

        if status == "ok":
            state["last_error"] = "The code ran but `result` was empty/None."
            return "The code ran but `result` was empty or None. Try a different approach."

        state["last_error"] = str(value)
        return f"Error: {value}"

    model = GeminiModel(
        client_args={"api_key": os.environ.get("GEMINI_API_KEY")},
        model_id="gemini-3.5-flash-lite",
    )
    agent = Agent(model=model, tools=[run_analysis_code], system_prompt=SYSTEM_PROMPT)

    prompt_parts = [f"Dataset schema:\n{schema}\n"]
    if history:
        prompt_parts.append("Recent conversation:\n" + "\n".join(history) + "\n")
    prompt_parts.append(f"Question: {question}")

    response = agent("\n".join(prompt_parts))
    explanation = _strip_result_restatement(str(response))

    if state["last_result"] is not None:
        if not _explanation_is_grounded(explanation, state["last_result"]):
            explanation = _fallback_explanation(state["last_result"])
        return {
            "success": True,
            "result": state["last_result"],
            "explanation": explanation,
            "chart": select_chart(state["last_result"]),
            "code": state["result_code"],
            "attempts": state["attempts"],
        }

    return {
        "success": False,
        "result": None,
        "explanation": explanation
        or (
            f"I couldn't reliably answer this after {state['attempts']} attempts. "
            f"Last error: {state['last_error']}"
        ),
        "chart": {"type": "none", "labels": [], "datasets": []},
        "code": state["last_code"],
        "attempts": state["attempts"],
    }

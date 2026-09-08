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

from strands import Agent, tool
from strands.models.gemini import GeminiModel

from schema_utils import summarize_dataset
from sandbox import run_sandboxed
from chart_selector import select_chart

MAX_RETRIES = 3

SYSTEM_PROMPT = """You are a data analyst agent working with a pandas \
DataFrame called `df`. To answer a question, call the `run_analysis_code` \
tool with Python code that computes the answer and assigns it to a \
variable named `result`.

Rules for the code you send to the tool:
- Only use `df`, `pd` (pandas) and `np` (numpy). No other imports.
- `result` should be a pandas Series, DataFrame, or a plain Python scalar.
- Do not print anything. Do not use input().

If the tool reports an error or an empty result, fix your code and call \
the tool again. Once the tool reports success, respond with a short \
(2-4 sentence) plain-English explanation of what the result shows, being \
specific with numbers. Do not include code or mention the tool in your \
final answer - just the explanation.
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

    state = {"attempts": 0, "last_code": None, "last_result": None, "last_error": None}

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
            return (
                "You've already tried this "
                f"{MAX_RETRIES} times. Stop retrying - tell the user you "
                "couldn't reliably answer this question."
            )

        status, value = run_sandboxed(code, df)

        if status == "ok" and not _result_looks_empty(value):
            state["last_result"] = value
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
    explanation = str(response)

    if state["last_result"] is not None:
        return {
            "success": True,
            "result": state["last_result"],
            "explanation": explanation,
            "chart": select_chart(state["last_result"]),
            "code": state["last_code"],
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

"""The core agent loop: plan -> act -> observe -> retry -> explain.

This is the piece that makes this project an "agent" rather than a chatbot:
it writes real code, runs it, notices when the result looks wrong, and
fixes its own mistakes without a human in the loop.
"""

import pandas as pd

from schema_utils import summarize_dataset
from sandbox import run_sandboxed
from llm_client import ask_claude
from chart_selector import select_chart

MAX_RETRIES = 3

CODE_SYSTEM_PROMPT = """You are a data analyst agent. You are given a pandas \
DataFrame called `df` and a question about it. Write Python code that \
computes the answer and assigns it to a variable named `result`.

Rules:
- Only use `df`, `pd` (pandas) and `np` (numpy). No other imports.
- `result` should be a pandas Series, DataFrame, or a plain Python scalar.
- Do not print anything. Do not use input().
- Return ONLY the Python code, no explanation, no markdown fences.
"""

EXPLAIN_SYSTEM_PROMPT = """You are a data analyst explaining a result to a \
non-technical person. Given the original question and the computed result, \
write a short (2-4 sentence) plain-English explanation of what the result \
shows. Be specific with numbers. Do not restate the raw code.
"""


def _build_code_prompt(question: str, schema: str, history: list[str], previous_error: str | None, previous_code: str | None) -> str:
    parts = [f"Dataset schema:\n{schema}\n"]
    if history:
        parts.append("Recent conversation:\n" + "\n".join(history) + "\n")
    parts.append(f"Question: {question}")
    if previous_error and previous_code:
        parts.append(
            f"\nYour previous attempt failed.\nPrevious code:\n{previous_code}\n"
            f"Error:\n{previous_error}\nFix it and try again."
        )
    return "\n".join(parts)


def _result_looks_empty(value) -> bool:
    if value is None:
        return True
    if isinstance(value, (pd.Series, pd.DataFrame)):
        return value.empty
    return False


def answer_question(df: pd.DataFrame, question: str, history: list[str] | None = None) -> dict:
    """Runs the full plan->act->observe->retry->explain loop.

    Returns a dict: {"success": bool, "result": ..., "explanation": str,
    "code": str, "attempts": int}
    """
    schema = summarize_dataset(df)
    history = history or []

    previous_error = None
    previous_code = None

    for attempt in range(1, MAX_RETRIES + 1):
        prompt = _build_code_prompt(question, schema, history, previous_error, previous_code)
        code = ask_claude(CODE_SYSTEM_PROMPT, prompt, max_tokens=4096).strip()
        code = _strip_markdown_fences(code)

        status, value = run_sandboxed(code, df)

        if status == "ok" and not _result_looks_empty(value):
            explanation = _explain(question, value)
            chart = select_chart(value)
            return {
                "success": True,
                "result": value,
                "explanation": explanation,
                "chart": chart,
                "code": code,
                "attempts": attempt,
            }

        # Failed or empty - feed it back for a retry.
        previous_code = code
        if status == "ok":
            previous_error = "The code ran but `result` was empty/None - likely wrong logic."
        else:
            previous_error = str(value)

    return {
        "success": False,
        "result": None,
        "explanation": (
            f"I couldn't reliably answer this after {MAX_RETRIES} attempts. "
            f"Last error: {previous_error}"
        ),
        "chart": {"type": "none", "labels": [], "datasets": []},
        "code": previous_code,
        "attempts": MAX_RETRIES,
    }


def _explain(question: str, value) -> str:
    result_str = str(value)
    if len(result_str) > 2000:
        result_str = result_str[:2000] + "... (truncated)"
    prompt = f"Question: {question}\n\nResult:\n{result_str}"
    return ask_claude(EXPLAIN_SYSTEM_PROMPT, prompt)


def _strip_markdown_fences(code: str) -> str:
    if code.startswith("```"):
        lines = code.splitlines()
        lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        return "\n".join(lines)
    return code

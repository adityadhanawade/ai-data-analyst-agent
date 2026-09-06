"""Runs LLM-generated pandas code with guardrails.

This is a hackathon-grade sandbox, not a production-grade one. It combines
three layers, each cheap to build, that together block the obvious attacks
and runaway code:

  1. Static AST check   - reject imports, dunder attribute access, and
                           dangerous builtins (open/exec/eval/__import__/...)
                           before a single line of the code ever runs.
  2. Restricted builtins - even if a check above is fooled, the code only
                           ever sees a small safe allowlist of builtins.
  3. Process isolation + hard timeout - the code runs in a separate OS
                           process with no inherited file handles beyond
                           what we pass in, and gets killed if it runs too
                           long (catches infinite loops).

None of this claims to be airtight against a determined attacker. It is
sized for "block accidental bad code and obvious prompt-injection attempts
in a hackathon demo," which is the actual threat model here.
"""

import ast
import multiprocessing as mp
import pandas as pd
import numpy as np


BLOCKED_NAMES = {
    "__import__", "open", "exec", "eval", "compile",
    "globals", "locals", "vars", "getattr", "setattr", "delattr",
    "input", "help", "breakpoint", "memoryview",
}

SAFE_BUILTINS = {
    "len": len, "range": range, "str": str, "int": int, "float": float,
    "bool": bool, "sum": sum, "min": min, "max": max, "sorted": sorted,
    "list": list, "dict": dict, "set": set, "tuple": tuple,
    "enumerate": enumerate, "zip": zip, "abs": abs, "round": round,
    "print": print,
}


class UnsafeCodeError(Exception):
    pass


def static_check(code: str) -> None:
    tree = ast.parse(code, mode="exec")
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            raise UnsafeCodeError(f"Imports are not allowed: line {node.lineno}")
        if isinstance(node, ast.Name) and node.id in BLOCKED_NAMES:
            raise UnsafeCodeError(f"Use of '{node.id}' is not allowed: line {node.lineno}")
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            raise UnsafeCodeError(f"Dunder attribute access is not allowed: line {node.lineno}")


def _worker(code: str, df: pd.DataFrame, queue: mp.Queue) -> None:
    try:
        static_check(code)
        exec_globals = {
            "__builtins__": SAFE_BUILTINS,
            "pd": pd,
            "np": np,
            "df": df,
        }
        exec_locals: dict = {}
        exec(code, exec_globals, exec_locals)
        result = exec_locals.get("result", None)
        queue.put(("ok", result))
    except Exception as e:  # noqa: BLE001 - we want to report any failure back
        queue.put(("error", f"{type(e).__name__}: {e}"))


def run_sandboxed(code: str, df: pd.DataFrame, timeout_seconds: int = 5):
    """Runs `code` against `df` in an isolated process.

    The code is expected to assign its answer to a variable named `result`.
    Returns (status, value) where status is "ok" | "error" | "timeout".
    """
    ctx = mp.get_context("spawn")
    queue = ctx.Queue()
    proc = ctx.Process(target=_worker, args=(code, df, queue))
    proc.start()
    proc.join(timeout_seconds)

    if proc.is_alive():
        proc.terminate()
        proc.join()
        return "timeout", f"Code did not finish within {timeout_seconds}s"

    if not queue.empty():
        status, value = queue.get()
        return status, value

    return "error", "Process exited without returning a result (it may have crashed)"

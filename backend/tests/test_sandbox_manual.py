"""Quick manual smoke test for the sandbox - no API key needed.
Run: python tests/test_sandbox_manual.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from sandbox import run_sandboxed


def main() -> None:
    df = pd.DataFrame({
        "product": ["Laptop", "Phone", "Laptop", "Phone"],
        "revenue": [1000, 500, 800, 600],
    })

    print("Test 1: normal valid code")
    status, value = run_sandboxed("result = df.groupby('product')['revenue'].sum()", df)
    print(status, "\n", value, "\n")
    assert status == "ok"

    print("Test 2: code with a bug (typo column name)")
    status, value = run_sandboxed("result = df.groupby('product')['revenu'].sum()", df)
    print(status, "\n", value, "\n")
    assert status == "error"

    print("Test 3: attempted import (should be blocked)")
    status, value = run_sandboxed("import os\nresult = os.getcwd()", df)
    print(status, "\n", value, "\n")
    assert status == "error"

    print("Test 4: attempted dunder sandbox escape (should be blocked)")
    status, value = run_sandboxed("result = ().__class__.__bases__", df)
    print(status, "\n", value, "\n")
    assert status == "error"

    print("Test 5: infinite loop (should time out)")
    status, value = run_sandboxed("while True:\n    pass", df, timeout_seconds=3)
    print(status, "\n", value, "\n")
    assert status == "timeout"

    print("ALL SANDBOX TESTS PASSED")


if __name__ == "__main__":
    main()

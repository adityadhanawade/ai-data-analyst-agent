"""Interactive command-line tester for the agent loop.

Usage:
    python cli.py ../data/sample_datasets/sales_sample.csv
"""

import sys
from dotenv import load_dotenv
import pandas as pd

from agent import answer_question

load_dotenv()


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python cli.py <path_to_csv>")
        sys.exit(1)

    csv_path = sys.argv[1]
    df = pd.read_csv(csv_path)
    print(f"Loaded {csv_path}: {len(df)} rows, columns: {list(df.columns)}\n")

    history: list[str] = []

    while True:
        question = input("Ask a question (or 'quit'): ").strip()
        if question.lower() in {"quit", "exit"}:
            break
        if not question:
            continue

        outcome = answer_question(df, question, history)

        print(f"\n--- attempts: {outcome['attempts']} ---")
        print(f"code:\n{outcome['code']}\n")
        print(f"result:\n{outcome['result']}\n")
        print(f"explanation:\n{outcome['explanation']}\n")

        history.append(f"Q: {question}")
        history.append(f"A: {outcome['explanation']}")
        history = history[-6:]  # keep memory short, as planned


if __name__ == "__main__":
    main()

"""Extracts a compact schema summary from a dataframe so we don't have to
send the whole dataset to the LLM on every question."""

import pandas as pd


def summarize_dataset(df: pd.DataFrame, max_sample_rows: int = 3) -> str:
    lines = [f"Rows: {len(df)}", "Columns:"]
    for col in df.columns:
        dtype = str(df[col].dtype)
        n_unique = df[col].nunique(dropna=True)
        sample_vals = df[col].dropna().unique()[:3].tolist()
        lines.append(f"  - {col} ({dtype}), {n_unique} unique values, e.g. {sample_vals}")

    lines.append("\nSample rows:")
    lines.append(df.head(max_sample_rows).to_string(index=False))
    return "\n".join(lines)

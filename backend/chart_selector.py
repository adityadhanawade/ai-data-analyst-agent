"""Rule-based chart type selection.

We deliberately do NOT ask the LLM to pick the chart type - letting an LLM
freely choose between bar/line/pie for an open-ended question is unreliable
(it guesses wrong often enough to hurt a live demo). Instead we look at the
*shape* of the already-computed result and apply a small set of fixed rules.
This is both more reliable and cheaper (no extra API call).

Returns a dict shaped for a frontend charting library (e.g. Chart.js):
    {"type": "line" | "bar" | "pie" | "none",
     "labels": [...],
     "datasets": [{"label": str, "data": [...]}]}
"""

import warnings
import pandas as pd


def _looks_like_time_index(index) -> bool:
    if isinstance(index, pd.DatetimeIndex):
        return True
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            pd.to_datetime(index)
        return True
    except (ValueError, TypeError):
        return False


def select_chart(value) -> dict:
    # Plain number or string - nothing to chart, just show the value as-is.
    if isinstance(value, (int, float, str)) or value is None:
        return {"type": "none", "labels": [], "datasets": []}

    if isinstance(value, pd.Series):
        labels = [str(i) for i in value.index]
        chart_type = "line" if _looks_like_time_index(value.index) else "bar"
        if chart_type == "bar" and len(value) <= 6:
            # Small number of categories - pie works well for part-of-whole.
            chart_type = "pie"
        return {
            "type": chart_type,
            "labels": labels,
            "datasets": [{"label": value.name or "value", "data": value.tolist()}],
        }

    if isinstance(value, pd.DataFrame):
        labels = [str(i) for i in value.index]
        chart_type = "line" if _looks_like_time_index(value.index) else "bar"
        datasets = [
            {"label": str(col), "data": value[col].tolist()}
            for col in value.columns
            if pd.api.types.is_numeric_dtype(value[col])
        ]
        return {"type": chart_type, "labels": labels, "datasets": datasets}

    # Anything else (list, dict, etc.) - not chartable with our simple rules.
    return {"type": "none", "labels": [], "datasets": []}

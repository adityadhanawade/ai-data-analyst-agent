"""HTTP bridge between the website (Next.js) and the agent logic.

This is the piece that turns the working CLI prototype into something a
website can talk to. It doesn't add any new agent behavior - it just
wraps agent.answer_question() behind two HTTP endpoints and keeps a
per-session dataframe + conversation history in memory.

In-memory storage is fine for a hackathon demo (one server process, a
handful of concurrent users). It is deliberately not a database - if this
were a real product, sessions would need to survive a server restart.
"""

import io
import json
import uuid

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from agent import answer_question
from schema_utils import summarize_dataset

load_dotenv()

app = FastAPI(title="DataAgent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def catch_all_exception_handler(request: Request, exc: Exception):
    """Last-resort safety net.

    Without this, ANY uncaught error - including ones outside our own
    code, like FastAPI failing to JSON-encode an unexpected value type -
    kills the response entirely and the frontend just sees "Failed to
    fetch" with zero information. This guarantees every request gets a
    real JSON error back instead.
    """
    return JSONResponse(
        status_code=500,
        content={"detail": f"Unexpected server error: {type(exc).__name__}: {str(exc)[:300]}"},
        headers={"Access-Control-Allow-Origin": "http://localhost:3000"},
    )

# session_id -> {"df": pd.DataFrame, "history": list[str], "filename": str}
SESSIONS: dict[str, dict] = {}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Please upload a .csv file.")

    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(400, "File is over 10MB.")

    # Real-world CSVs (especially Excel exports on Windows) are frequently
    # not UTF-8. Try UTF-8 first, then fall back to common alternatives
    # rather than rejecting a perfectly valid file over its encoding.
    df = None
    last_error = None
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            df = pd.read_csv(io.BytesIO(raw), encoding=encoding)
            break
        except (UnicodeDecodeError, pd.errors.ParserError) as e:
            last_error = e
            continue

    if df is None:
        raise HTTPException(400, f"Couldn't read this as a CSV: {last_error}")

    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {"df": df, "history": [], "filename": file.filename}

    return {
        "session_id": session_id,
        "filename": file.filename,
        "rows": len(df),
        "columns": list(df.columns),
    }


def serialize_result_table(value) -> dict | None:
    """Turns the raw pandas result into plain JSON the frontend can render
    as a table. Round-trips through pandas' own JSON encoder so numpy
    types (int64, etc.) come out as normal Python numbers, not something
    FastAPI chokes on."""
    if isinstance(value, pd.DataFrame):
        # Column labels don't go through to_json(), so numpy-typed column
        # names (e.g. int64 years from an unstack()) must be stringified
        # by hand - otherwise FastAPI's encoder crashes the whole response
        # instead of just this field. date_format="iso" is needed too -
        # pandas' default for dates is raw epoch milliseconds (e.g.
        # 1041811200000), which is unreadable; ISO strings show a real date.
        records = json.loads(
            value.reset_index(drop=True).to_json(orient="records", date_format="iso")
        )
        return {"columns": [str(c) for c in value.columns], "rows": records[:25]}

    if isinstance(value, pd.Series):
        as_dict = json.loads(value.to_json(date_format="iso"))
        index_name = value.index.name or "key"
        value_name = value.name or "value"
        rows = [{index_name: k, value_name: v} for k, v in as_dict.items()]
        return {"columns": [index_name, value_name], "rows": rows[:25]}

    return None


class AskRequest(BaseModel):
    session_id: str
    question: str


@app.post("/ask")
def ask(req: AskRequest):
    session = SESSIONS.get(req.session_id)
    if session is None:
        raise HTTPException(404, "Session not found - please upload a dataset again.")

    try:
        outcome = answer_question(session["df"], req.question, session["history"])
    except Exception as e:  # noqa: BLE001 - any model/API failure should reach the user cleanly
        message = str(e)
        if "429" in message or "RESOURCE_EXHAUSTED" in message:
            raise HTTPException(
                429,
                "The AI model's free daily quota has been used up. Please try again "
                "later, or switch to a different model in agent.py.",
            )
        raise HTTPException(502, f"The AI model failed to respond: {message[:300]}")

    session["history"].append(f"Q: {req.question}")
    session["history"].append(f"A: {outcome['explanation']}")
    session["history"] = session["history"][-6:]

    return {
        "success": outcome["success"],
        "explanation": outcome["explanation"],
        "result_preview": str(outcome["result"])[:2000] if outcome["result"] is not None else None,
        "result_table": serialize_result_table(outcome["result"]),
        "chart": outcome["chart"],
        "code": outcome["code"],
        "attempts": outcome["attempts"],
    }

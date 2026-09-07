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
import uuid

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
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

    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as e:  # noqa: BLE001 - surface any parse failure to the user
        raise HTTPException(400, f"Couldn't read this as a CSV: {e}")

    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {"df": df, "history": [], "filename": file.filename}

    return {
        "session_id": session_id,
        "filename": file.filename,
        "rows": len(df),
        "columns": list(df.columns),
    }


class AskRequest(BaseModel):
    session_id: str
    question: str


@app.post("/ask")
def ask(req: AskRequest):
    session = SESSIONS.get(req.session_id)
    if session is None:
        raise HTTPException(404, "Session not found - please upload a dataset again.")

    outcome = answer_question(session["df"], req.question, session["history"])

    session["history"].append(f"Q: {req.question}")
    session["history"].append(f"A: {outcome['explanation']}")
    session["history"] = session["history"][-6:]

    return {
        "success": outcome["success"],
        "explanation": outcome["explanation"],
        "result_preview": str(outcome["result"])[:2000] if outcome["result"] is not None else None,
        "chart": outcome["chart"],
        "code": outcome["code"],
        "attempts": outcome["attempts"],
    }

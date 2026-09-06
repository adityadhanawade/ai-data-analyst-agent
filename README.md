# AI Data Analyst Agent

Upload a dataset, ask questions about it in plain English, and watch an agent
write, run, and self-correct its own analysis code to answer you.

Built for the AWS "Agents for Humans" hackathon.

## What makes this an "agent" and not a chatbot

Most "chat with your data" tools are one-shot: they generate a query, run it
once, and show you whatever comes back - even if it's wrong or empty. This
project's core loop is:

1. **Plan** - Claude reads the question + dataset schema and decides what
   analysis is needed.
2. **Act** - it writes real pandas code and we execute it in a sandboxed
   subprocess.
3. **Observe** - we check: did it error? did it return an empty/None result?
4. **Retry** - if something went wrong, the error is fed back to Claude,
   which rewrites the code (capped at 3 attempts).
5. **Explain** - once we have a real result, Claude turns it into a plain
   English explanation.

See `backend/agent.py` for the implementation of this loop.

## Status

Local prototype only right now - no AWS, no frontend yet. The goal of this
stage is to prove the agent loop actually works reliably before we build
anything around it.

## Running it locally

1. `cd backend`
2. `pip install -r requirements.txt`
3. Copy `.env.example` to `.env` and add your Anthropic API key
   (get one free at https://console.anthropic.com)
4. `python cli.py ../data/sample_datasets/sales_sample.csv`
5. Ask it things like:
   - "which product is declining?"
   - "break that down by region"
   - "what was total revenue in the North region?"

## Project layout

```
backend/
  agent.py          - the plan/act/observe/retry/explain loop
  sandbox.py         - guardrails for running LLM-generated code safely
  llm_client.py       - Claude API wrapper (swap this for Bedrock later)
  schema_utils.py      - summarizes a dataframe for the LLM prompt
  cli.py             - interactive terminal tester
data/sample_datasets/  - test CSVs
```

## Next steps (not built yet)

- Wire this into a simple web frontend
- Add chart-type selection (rule-based, not LLM-guessed)
- Port `llm_client.py` to call AWS Bedrock instead of Anthropic directly
- Decide on file storage approach (S3 vs. client-side) once AWS account
  situation is confirmed with hackathon organizers

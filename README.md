# AI Data Analyst Agent

Upload a dataset, ask questions about it in plain English, and watch an agent
write, run, and self-correct its own analysis code to answer you.

Built for the AWS "Agents for Humans" hackathon.

## What makes this an "agent" and not a chatbot

Most "chat with your data" tools are one-shot: they generate a query, run it
once, and show you whatever comes back - even if it's wrong or empty. This
project's core loop is:

1. **Plan** - the LLM reads the question + dataset schema and decides what
   analysis is needed.
2. **Act** - it writes real pandas code and we execute it in a sandboxed
   subprocess.
3. **Observe** - we check: did it error? did it return an empty/None result?
4. **Retry** - if something went wrong, the error is fed back to the LLM,
   which rewrites the code (capped at 3 attempts).
5. **Explain** - once we have a real result, the LLM turns it into a plain
   English explanation, and `chart_selector.py` picks a chart type
   (line/bar/pie) based on the shape of the result - not guessed by the LLM.

See `backend/agent.py` for the implementation of this loop.

## Status

Backend logic is working and tested locally (agent loop, sandbox, multi-turn
memory, chart selection) - see `backend/`. Design is done - full wireframes
and polished mockups for every screen and edge-case state (loading/retry,
failure, upload error, empty state, expanded code view) live in Figma:
https://www.figma.com/design/kfAReWFHsMN1EtSl1Bxqko

Not built yet: the actual website (React/Next.js) and the AWS pieces
(Bedrock, Lambda, storage).

## Running the backend locally

1. `cd backend`
2. `pip install -r requirements.txt`
3. Copy `.env.example` to `.env` and add a free Gemini API key
   (get one at https://aistudio.google.com -> "Get API key", no card needed)
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
  llm_client.py       - LLM API wrapper, currently calls Gemini (swap this
                        for Bedrock later - only this file needs to change)
  chart_selector.py    - rule-based chart type selection (line/bar/pie)
  schema_utils.py      - summarizes a dataframe for the LLM prompt
  cli.py             - interactive terminal tester
data/sample_datasets/  - test CSVs
docs/wireframes.html  - early low-fidelity wireframes (superseded by Figma)
```

## Next steps

- Build the real website (React/Next.js) from the Figma designs, with a
  focus on smooth motion and premium-feeling UX, not just static screens
- Port `llm_client.py` to call AWS Bedrock instead of Gemini directly
  (should be a small, contained change)
- Decide on file storage approach (S3 vs. client-side) once AWS account
  situation is confirmed with hackathon organizers

# AI Data Analyst Agent

Upload a dataset, ask questions about it in plain English, and watch an agent
write, run, and self-correct its own analysis code to answer you.

Built for the "Agents for Humans" hackathon.

## What makes this an "agent" and not a chatbot

Most "chat with your data" tools are one-shot: they generate a query, run it
once, and show you whatever comes back - even if it's wrong or empty. This
project is built on the [Strands Agents SDK](https://strandsagents.com/),
using Gemini as the model provider. The agent has one tool -
`run_analysis_code` - which runs pandas code against the dataset inside a
sandbox and reports back success, an error, or an empty result. Strands'
own tool-calling loop handles the rest: the agent writes code, calls the
tool, reads what happened, and rewrites the code itself if something went
wrong, until it gets a real answer or gives up honestly.

See `backend/agent.py` for the implementation.

## Status

Working end-to-end, verified live against both the sample dataset and a
larger real-world dataset (2823 rows, non-UTF-8 encoded):

- **Backend**: Strands-based agent, sandboxed code execution, multi-turn
  memory, rule-based chart selection - all tested.
- **API bridge**: FastAPI (`backend/api.py`) connecting the website to the
  agent - `/upload` and `/ask`.
- **Frontend**: Next.js + Tailwind. Upload screen and workspace screen both
  built and polished to match the Figma design - real drag-and-drop upload,
  real charts (Recharts), real result tables, sidebar conversation history.
- **Design**: full wireframes and polished mockups for every screen and
  edge-case state live in Figma:
  https://www.figma.com/design/kfAReWFHsMN1EtSl1Bxqko

Not done yet: deployment (only runs locally right now), the ambient
background/motion polish on the landing page (deferred on purpose), and a
few edge-case states (live retry-attempt counter, styled failure state)
that exist in Figma but not yet in the real UI.

## Running it locally

You need two terminals running at once.

**Backend:**
1. `cd backend`
2. `pip install -r requirements.txt`
3. Copy `.env.example` to `.env` and add a free Gemini API key
   (get one at https://aistudio.google.com -> "Get API key", no card needed)
4. `.venv\Scripts\activate` then `uvicorn api:app --port 8000`

**Frontend:**
1. `cd frontend`
2. `npm install`
3. `npm run dev`
4. Open http://localhost:3000

Or test the backend alone via the terminal:
`python cli.py ../data/sample_datasets/sales_sample.csv`

## Project layout

```
backend/
  agent.py          - the Strands-based agent (tool-calling loop)
  sandbox.py         - guardrails for running LLM-generated code safely
  chart_selector.py    - rule-based chart type selection (line/bar/pie)
  schema_utils.py      - summarizes a dataframe for the LLM prompt
  api.py             - FastAPI bridge (/upload, /ask) for the website
  cli.py             - interactive terminal tester
frontend/            - Next.js website (upload page + workspace)
data/sample_datasets/  - test CSVs
docs/wireframes.html  - early low-fidelity wireframes (superseded by Figma)
```

## Next steps

- Deploy so the app is reachable without running it locally
- Wire the remaining Figma states (live retry counter, styled failure
  state) into the real UI
- Apply the deferred background/motion polish to the landing page
- Prepare the demo script and submission write-up

## Notes on hackathon requirements

- The Strands Agents SDK is a mandatory requirement for this hackathon -
  confirmed in the official rules, along with the fact that Amazon Bedrock
  is explicitly *not* required (it only strengthens scoring if used). This
  project uses Strands with Gemini as the model provider, at zero cost.

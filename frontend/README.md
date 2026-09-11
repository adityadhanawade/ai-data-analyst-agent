# DataAgent frontend

Next.js + Tailwind website for DataAgent - the upload screen and the
chat-style workspace where you ask questions about your data.

See the [project README](../README.md) for what this project is, the live
demo links, and how to run the whole thing (frontend + backend) locally.

## Running just this frontend

```bash
npm install
npm run dev
```

Open http://localhost:3000. It expects the backend running at
`http://localhost:8000` by default (override with `NEXT_PUBLIC_API_URL`).

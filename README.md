# S&P 500 Analytics Chat Assistant

A conversational analytics assistant for historical S&P 500 stock data. Ask natural-language questions and get back a mix of narrative text, KPI cards, charts, and interactive follow-up suggestions — all streamed live in the chat.

---

## How it works

- The backend runs an **agent loop**: an LLM that decides on each turn whether to query the database, render a chart, or just respond in text.
- All chat history and stock data live in a **single SQLite file** (`data/app.db`).
- The LLM provider is swappable — set one environment variable to switch between Anthropic and OpenAI.
- Everything runs in **Docker** — no host-installed Python or database required.

---

## Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| Docker Desktop | 4.x | Includes Docker Compose |
| An LLM API key | — | Anthropic (default) or OpenAI |
| `data/all_stocks_5yr.csv` | — | S&P 500 historical data (see below) |

> The dataset (`data/all_stocks_5yr.csv`) is included in the repository. On first startup the backend seeds the SQLite database automatically (~619 k rows). Subsequent starts skip the seed step.

---

## Quick start (Docker — recommended)

### 1. Clone the repo

```bash
git clone <repo-url>
cd sp500-analytics
```

### 2. Run the setup script

The setup script checks for Docker, creates your `.env`, and starts the backend.

**Mac / Linux**
```bash
bash setup.sh
```

**Windows (PowerShell)**
```powershell
# If prompted about execution policy:
powershell -ExecutionPolicy Bypass -File setup.ps1

# Or run directly if policy already allows it:
.\setup.ps1
```

The script will:
- Verify Docker is installed and running (and offer to install it on supported systems)
- Copy `.env.example` → `.env` and prompt for your API key
- Run `docker compose up --build -d` to build the image and start the backend

### 3. Verify the backend is up

```bash
curl http://localhost:5000/health
# → {"status": "ok"}
```

The first start takes ~30 s extra while the database is seeded from the CSV.

---

## Manual setup (without the script)

If you prefer to set things up yourself:

```bash
# 1. Copy and fill in env vars
cp .env.example .env
# edit .env — set ANTHROPIC_API_KEY (or OPENAI_API_KEY + LLM_PROVIDER=openai)

# 2. Start the backend
docker compose up --build -d

# 3. Check logs
docker compose logs -f backend
```

---

## Starting the frontend

The frontend is a separate service. Once the frontend code exists in `./frontend/`:

```bash
# Start backend + frontend together
docker compose --profile frontend up -d
```

Or run the frontend locally in development mode (requires Node.js 18+):

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

The frontend expects the backend at `http://localhost:5000` (set via `VITE_API_URL`).

---

## Local backend development (without Docker)

If you want to iterate on the backend without rebuilding the Docker image:

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv

# Mac / Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python app.py
```

The server auto-seeds the database on first run. Set environment variables directly in your shell or create a `.env` in the repo root — `python-dotenv` will pick it up.

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `anthropic` | `anthropic` or `openai` |
| `ANTHROPIC_API_KEY` | — | Required when using Anthropic |
| `OPENAI_API_KEY` | — | Required when using OpenAI |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` | Anthropic model ID |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model ID |
| `SQLITE_PATH` | `/app/data/app.db` | Path to the SQLite database |
| `SEED_CSV_PATH` | auto-detected | Path to `all_stocks_5yr.csv` |

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/conversations` | Create a new conversation |
| `GET` | `/api/conversations` | List all conversations |
| `GET` | `/api/conversations/{id}` | Get conversation metadata |
| `GET` | `/api/conversations/{id}/messages` | Get full message history |
| `POST` | `/api/chat` | Send a message (SSE stream) |

### Chat request / response

**Request**
```json
POST /api/chat
{
  "conversation_id": "uuid",
  "message": "How did AAPL perform in 2017?"
}
```

**SSE event stream**

Each line is `data: <json>\n\n`. Event shapes:

| `type` | Payload | Meaning |
|--------|---------|---------|
| `text_delta` | `{"content": "..."}` | Streamed text chunk |
| `tool_start` | `{"call_id": "...", "tool_name": "..."}` | Agent is calling a tool |
| `tool_input` | `{"call_id": "...", "partial_json": "..."}` | Tool argument chunk |
| `tool_result` | `{"call_id": "...", "tool_name": "...", "result": {...}}` | Tool executed |
| `error` | `{"message": "..."}` | Something went wrong |
| `done` | `{"message_id": "..."}` | Turn complete, message persisted |

`tool_result` payloads from render tools (`render_chart`, `render_kpi`, `render_table`, `render_suggestions`) include a `type` field the frontend uses to decide how to render them.

---

## Useful commands

```bash
# View live backend logs
docker compose logs -f backend

# Stop all containers
docker compose down

# Stop and delete the database (full reset)
make clean

# Rebuild images after code changes
docker compose up --build -d

# Open a shell inside the backend container
make shell
```

---

## Adding a new tool

1. Create `backend/tools/my_tool.py` with a handler function.
2. Add an entry to the `TOOLS` dict in `backend/tools/registry.py` (name, description, JSON schema, handler).
3. Add a renderer in the frontend for the new `type`.

That's it — the agent loop, provider adapters, and SSE layer pick it up automatically.

---

## Project structure

```
sp500-analytics/
├── setup.sh              # One-shot setup for Mac/Linux
├── setup.ps1             # One-shot setup for Windows
├── docker-compose.yml
├── Makefile
├── .env.example
├── data/
│   └── all_stocks_5yr.csv   ← S&P 500 historical data (included)
└── backend/
    ├── app.py               # Flask app factory
    ├── config.py            # Provider selection
    ├── requirements.txt
    ├── Dockerfile
    ├── agent/
    │   ├── loop.py          # Agent loop
    │   ├── system_prompt.py
    │   └── history.py       # Message history conversion
    ├── providers/
    │   ├── base.py
    │   ├── anthropic_provider.py
    │   └── openai_provider.py
    ├── tools/
    │   ├── registry.py      # Tool registry + dispatch
    │   ├── run_sql.py
    │   ├── render_kpi.py
    │   ├── render_chart.py
    │   ├── render_table.py
    │   └── render_suggestions.py
    ├── db/
    │   ├── connection.py
    │   ├── schema.py
    │   ├── seed.py
    │   └── chat.py
    └── routes/
        ├── chat.py
        └── conversations.py
```

# S&P 500 Analytics Chat Assistant — Architecture

A conversational analytics assistant that lets users ask natural-language questions about historical S&P 500 stock data and answers with a mix of narrative text, rich KPI cards, charts, and interactive follow-up suggestions — all rendered inline in the chat.

This document explains **how the system is built, why each piece exists, and how every type of user interaction flows through it.** Read it end-to-end before writing code; the architecture is small but the reasoning matters.

---

## 1. The Product, in One Paragraph

A user opens the app and sees a chat window. They type *"how did AAPL perform compared to MSFT last year?"* The assistant streams back a short narrative and a line chart comparing both tickers, plus a row of suggested follow-ups like *"Show me their volatility"* or *"What about the rest of FAANG?"* The user clicks one. The assistant answers using the prior context — it already knows we're talking about Apple and Microsoft. The whole conversation is saved; the user can refresh the page, come back tomorrow, and pick up where they left off.

The system feels like a chat app, but every assistant turn is the result of an LLM **deciding** what to do — query the database, render a chart, ask a clarifying question, or just talk — and executing those decisions through a small set of tools.

---

## 2. Dataset

**S&P 500 Historical Stock Prices** — daily OHLCV data for all ~500 companies in the index over ~5 years.

### Schema (a single table is enough)

```sql
CREATE TABLE stock_prices (
    date    TEXT NOT NULL,        -- 'YYYY-MM-DD' (parsed from MM/DD/YYYY on load)
    open    REAL,
    high    REAL,
    low     REAL,
    close   REAL,
    volume  INTEGER,
    name    TEXT NOT NULL,        -- ticker symbol, e.g. 'AAPL'
    PRIMARY KEY (date, name)
);

CREATE INDEX idx_name ON stock_prices(name);
CREATE INDEX idx_date ON stock_prices(date);
```

### Why this dataset

- **Time-series by nature** — every interesting question involves trends, comparisons, or aggregations over time, which is where chart rendering shines.
- **Multi-entity** — ~500 tickers means questions can be about one stock, a comparison, or sector-wide rollups. This stretches the agent in good ways.
- **Universally familiar** — reviewers immediately know what AAPL, TSLA, JPM, etc. are, so demos land without explanation.
- **Real questions are interesting** — *"which stock was most volatile in 2017?"*, *"how did the financial sector trend?"*, *"compare AAPL's worst week to MSFT's worst week"* — all answerable from one table, all surface different chart types.

### Why SQLite

- Embedded — no separate database container, no connection strings, no auth.
- Sufficient for ~600k rows — queries return in milliseconds.
- File-based — easy to mount as a Docker volume, easy to seed once and forget.
- Familiar dialect — the LLM generates correct SQLite SQL with no special prompting needed.

The same file (`app.db`) holds **both** the stock data and the chat history. One database, one connection, no plumbing.

---

## 3. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│           (not covered in this doc — backend only)            │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTP + SSE
┌──────────────────────────────┴───────────────────────────────┐
│                      Flask Application                        │
│                                                               │
│  ┌────────────────┐    ┌─────────────────┐                   │
│  │   /api/chat    │    │ /api/conver-    │                   │
│  │   (SSE stream) │    │ sations         │                   │
│  └────────┬───────┘    └─────────────────┘                   │
│           │                                                   │
│           ▼                                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Agent Loop                        │    │
│  │  (decides what to do each turn; calls LLM in loop)  │    │
│  └────────┬──────────────────────────────┬─────────────┘    │
│           │                              │                   │
│           ▼                              ▼                   │
│  ┌──────────────────┐         ┌─────────────────────┐       │
│  │   LLM Provider   │         │   Tool Registry     │       │
│  │   (abstracted)   │         │                     │       │
│  │                  │         │  • run_sql          │       │
│  │  • Anthropic     │         │  • render_kpi       │       │
│  │  • OpenAI        │         │  • render_chart     │       │
│  └──────────────────┘         │  • render_table     │       │
│                               │  • render_suggest…  │       │
│                               └──────────┬──────────┘       │
│                                          │                   │
│           ┌──────────────────────────────┘                   │
│           ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              SQLite (single file: app.db)             │   │
│  │                                                        │   │
│  │  • stock_prices   (analytics dataset)                 │   │
│  │  • conversations  (chat metadata)                     │   │
│  │  • messages       (chat history, JSON content)        │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

Everything in this diagram runs inside Docker containers. No host-installed Python, Node, or database.

---

## 4. The Agent — Conceptual Model

This is the most important section. Get the mental model right and the rest writes itself.

### 4.1 The Assistant is Not a Query Engine

It is tempting to design this as: *"user asks question → generate SQL → run SQL → render chart → return."* **Don't.** That's a query engine, not a chatbot. It can't handle:

- Follow-up questions that depend on what was shown earlier (*"now break that down by quarter"*)
- Ambiguous questions that need clarification (*"show me the important stuff"*)
- Questions where SQL isn't needed at all (*"what can you help me with?"*, *"explain that chart"*)
- Multi-step reasoning (*"which stock had the worst week of 2018, and how did it recover?"* — two queries, one answer)
- Self-correction when a generated query fails

Instead, model the system as an **agent**: an LLM that has access to a small set of tools, runs in a loop, and decides on each turn what to do based on the full conversation so far. SQL generation is just one of those tools. The LLM is the brain.

### 4.2 The Single Agent Loop

Every user message goes through one loop. There is no branching code for "this is a chart question" vs "this is a text question" — the LLM makes that decision.

```
function handle_user_message(conversation_id, user_text):

    1. Save user message to DB.

    2. Build message history:
       - Load all prior messages for this conversation from DB
       - Append the new user message
       - Convert into the LLM provider's message format

    3. Build LLM request:
       - system_prompt  (identity, schema, behavior rules)
       - messages       (the history)
       - tools          (the tool schemas)
       - stream=true

    4. Stream the LLM response:
       For each event from the model:
         - If text_delta:        emit SSE event to client; accumulate text
         - If tool_call_start:   emit SSE event to client; start buffering args
         - If tool_call_input:   emit SSE event (partial JSON for live UI)
         - If tool_call_end:     emit SSE event; execute the tool; emit
                                 tool_result SSE event; append to history

       After stream ends:
         - If the model produced tool calls: GOTO step 3 with updated history
           (the model now sees the tool results and may respond with text
            and/or more tool calls)
         - If the model produced only text:  this turn is complete

    5. Save the final assistant message (text + all tool calls + results)
       to DB as one row with JSON content.

    6. Close the SSE stream.
```

The crucial property: **the loop can iterate multiple times within a single user turn.** A user message can trigger:

- 0 LLM calls (impossible — at least 1)
- 1 LLM call (pure text response, no tools)
- 2 LLM calls (model calls a tool, then on the next call writes the narrative)
- 3+ LLM calls (multi-step reasoning: query → query → chart → narrative)

This is what makes it an agent and not a chain.

### 4.3 Why the Loop Re-enters After Tool Calls

After the LLM calls `run_sql`, it has no idea what the result looks like. It needs to *see* the rows before it can decide whether to render a chart, render a KPI, ask for more data, or just describe the result in words.

So when a tool call finishes:
1. Append the tool call + result to the message history.
2. Send the updated history back to the LLM.
3. The LLM now has the data and continues — possibly with another tool call (render the chart), possibly with final text.

This is sometimes called the "ReAct" pattern: Reason → Act → Observe → repeat.

---

## 5. The System Prompt

The system prompt has one job: tell the LLM **who it is, what data it has, and how to behave.** It is built dynamically on every request (so it always contains a fresh schema snapshot) and prepended to the message history.

### Structure

```
You are an S&P 500 analytics assistant. You help users explore historical
stock price data through conversation.

## Data you have access to

You have one SQLite table named `stock_prices`. Schema:

  date    TEXT     ISO format 'YYYY-MM-DD'. Trading days only (no weekends/holidays).
  open    REAL     Opening price in USD.
  high    REAL     Daily high in USD.
  low     REAL     Daily low in USD.
  close   REAL     Closing price in USD.
  volume  INTEGER  Shares traded that day.
  name    TEXT     Ticker symbol (e.g. 'AAPL', 'MSFT', 'GOOGL').

Data spans roughly 2013-02 to 2018-02 for all ~500 S&P 500 constituents.

## How you work

You have tools available. Use them as follows:

- `run_sql`: Use to fetch data from the stock_prices table. Always
  qualify queries with date ranges and ticker filters; never SELECT *
  without a LIMIT. Use SQLite dialect.

- `render_kpi`: Use when the answer is a single key number
  (e.g. "what was AAPL's highest close ever?").

- `render_chart`: Use when the data shows a trend over time, a
  comparison between groups, or a distribution. Pick chart_type:
    - 'line' for time series
    - 'bar'  for comparisons between discrete groups
    - 'area' for cumulative/stacked time series

- `render_table`: Use when raw rows are more useful than a chart
  (e.g. "top 10 most volatile stocks").

- `render_suggestions`: At the end of every substantive answer, offer
  2–4 follow-up questions the user is likely to want next. Keep them
  short and specific to what was just shown.

## Behavior rules

1. If a question is ambiguous (e.g. "show me the important stuff"),
   ask a clarifying question instead of guessing.

2. If a question is outside the scope of the data (e.g. "what's
   AAPL's P/E ratio?", "what will the price be next month?"), say so
   clearly. Don't fabricate.

3. When you call run_sql and get an error back, read the error and
   try again with a corrected query. Don't give up after one try.

4. Don't dump raw rows in your text response. The user sees the
   rendered charts/KPIs — your text should narrate, not duplicate.

5. Keep narrative text concise: 1–3 sentences around any rendered
   component is plenty.

6. When the user refers to "that", "those", "the previous one",
   etc., use the conversation history to resolve the reference.

## Example exchanges

User: How did Apple do last year of the data?
Assistant: [calls run_sql for AAPL 2017 daily closes]
           [calls render_chart with chart_type='line', the rows]
           [emits text: "Apple closed 2017 up about 46%, rising from
            $116 in January to $169 by year-end."]
           [calls render_suggestions: "Compare to MSFT", "Show 2017
            volume", "Best/worst weeks"]
```

### Why include schema in the system prompt (not in a tool description)

The LLM needs to know columns and types **to write SQL**, but it also needs to know them **to interpret user questions** ("when the user says 'price', they mean `close`"). Schema in the system prompt covers both. Tools just describe what they do, not what the data looks like.

### Why include few-shot examples

A 6-line example exchange teaches the model the *vibe* you want — short narration, chart + suggestions, no row-dumping — more reliably than three paragraphs of rules. One or two examples is enough; don't over-do it (they consume tokens on every call).

---

## 6. The Tools

Tools are the verbs the agent can perform. Each tool has:

- A **name** the LLM calls
- A **JSON schema** describing its inputs
- A **handler** function on the backend that runs when called
- A **description** that teaches the LLM when to use it

### 6.1 `run_sql`

The only tool that touches the analytics dataset. Everything else operates on data the LLM has already received.

**Input schema:**
```json
{
  "query": "string — a single SQLite SELECT statement"
}
```

**Handler:**
```python
def run_sql(query: str) -> dict:
    # 1. Reject anything that isn't a SELECT (cheap regex / sqlparse)
    # 2. Wrap in a LIMIT if missing (safety cap, e.g. 1000 rows)
    # 3. Execute against SQLite with a timeout (e.g. 5s)
    # 4. Return either:
    #    {"columns": [...], "rows": [...], "row_count": N}
    #    {"error": "human-readable error message"}
```

**Returned to the LLM:**
- On success: a compact JSON with column names and rows. The LLM uses this both to write narrative *and* as the `data` argument when it later calls `render_chart`.
- On failure: an error string. The LLM is expected to read it and retry.

**Why a single `run_sql` tool instead of pre-defined query tools** (like `get_price_trend(ticker, start, end)`):
- Infinite flexibility. The user can ask anything answerable from the schema.
- The LLM writes the SQL — you don't have to anticipate every question.
- Adding new question types requires **zero code changes**.

**Why not let the LLM run arbitrary SQL freely:**
- Read-only enforcement: parse the query and reject non-SELECT.
- Row cap: silently inject `LIMIT 1000` if the model forgot.
- Query timeout: kill long-running queries (e.g., a missing JOIN condition causing a cross product).
- Connection mode: open SQLite in read-only mode for this tool (`file:app.db?mode=ro`).

### 6.2 `render_kpi`

**Input schema:**
```json
{
  "label": "string — what the number represents",
  "value": "string — formatted value (the LLM does the formatting, e.g. '$169.23')",
  "delta": "string | null — optional change indicator, e.g. '+12.4%'",
  "delta_direction": "'up' | 'down' | null"
}
```

**Handler:** returns the same payload, wrapped in `{"type": "kpi", ...}`. It doesn't *do* anything — it just validates and structures the payload. The frontend uses this payload to render a KPI card.

### 6.3 `render_chart`

**Input schema:**
```json
{
  "chart_type": "'line' | 'bar' | 'area'",
  "title": "string",
  "data": "array of objects (rows from a previous run_sql call)",
  "x_key": "string — the column name to use on the x-axis",
  "y_keys": "array of strings — one or more columns for the y-axis (multiple = multi-series)",
  "x_label": "string | null",
  "y_label": "string | null"
}
```

**Handler:** validates that `x_key` and all `y_keys` exist in the row objects, then returns the payload. The frontend renders the chart with Recharts (or similar).

**A note on `data`:** the LLM is responsible for passing the right rows in. Usually those rows came from the immediately preceding `run_sql` call. The model literally re-types them into the tool argument. This sounds wasteful but it's deliberate — the model can also *transform* the data on the way (filter, derive, rename) so the chart gets exactly what it needs.

For very large result sets, you can choose a different design (have `render_chart` reference a result by ID instead of inlining data) — but for ~5y of daily data per ticker, inline is simplest and works.

### 6.4 `render_table`

**Input schema:**
```json
{
  "title": "string",
  "columns": "array of strings",
  "rows": "array of objects"
}
```

Useful for "top N" style answers where a chart would be misleading.

### 6.5 `render_suggestions`

**Input schema:**
```json
{
  "chips": "array of { label: string, query: string }"
}
```

`label` is what the button shows; `query` is what gets sent as the next user message when clicked. Encourage the LLM to call this at the end of every substantive answer — it keeps the conversation moving.

### 6.6 The Tool Registry

All tools live in `backend/tools/registry.py` as a single dict:

```python
TOOLS = {
    "run_sql":            {"schema": {...}, "handler": run_sql_handler,        "description": "..."},
    "render_kpi":         {"schema": {...}, "handler": render_kpi_handler,     "description": "..."},
    "render_chart":       {"schema": {...}, "handler": render_chart_handler,   "description": "..."},
    "render_table":       {"schema": {...}, "handler": render_table_handler,   "description": "..."},
    "render_suggestions": {"schema": {...}, "handler": render_suggest_handler, "description": "..."},
}
```

Two helper functions convert this into each provider's required tool format:

```python
def to_anthropic_tools() -> list: ...
def to_openai_tools()    -> list: ...
```

**Adding a new tool is a 3-line change:** add an entry to the dict, write the handler, done. The agent loop, the providers, and the frontend rendering layer pick it up automatically as long as the frontend has a renderer for it. This is the "could a teammate add a tool in 20 minutes?" property the brief asks about.

---

## 7. Provider Abstraction

Two LLM providers, swappable via one env var: `LLM_PROVIDER=anthropic` or `LLM_PROVIDER=openai`. No code changes when switching.

### The Abstract Interface

```python
class BaseLLMProvider(ABC):
    @abstractmethod
    def stream_chat(
        self,
        system_prompt: str,
        messages: list[dict],     # provider-agnostic message format
        tools: list[dict],        # provider-agnostic tool schemas
    ) -> Iterator[dict]:          # yields normalized events
        ...
```

### Normalized Event Stream

Both providers' SDKs emit different event types. The abstraction normalizes them into one schema before they leave the provider class:

| Event type           | Payload                                    | Meaning                                |
|----------------------|--------------------------------------------|----------------------------------------|
| `text_delta`         | `{"content": "..."}`                       | A chunk of streamed text               |
| `tool_call_start`    | `{"call_id": "...", "tool_name": "..."}`   | The model is about to call a tool      |
| `tool_call_input`    | `{"call_id": "...", "partial_json": "..."}`| A chunk of streamed JSON arguments     |
| `tool_call_end`      | `{"call_id": "...", "input": {...}}`       | Tool call args are fully assembled     |
| `turn_end`           | `{"stop_reason": "..."}`                   | The model finished this turn           |

The agent loop only ever sees these events. It has no idea which provider it's talking to.

### The Provider-Agnostic Message Format

Internally, we represent messages as:

```python
{
  "role": "user" | "assistant" | "tool",
  "content": [
    {"type": "text", "text": "..."},
    {"type": "tool_use", "id": "...", "name": "...", "input": {...}},
    {"type": "tool_result", "tool_use_id": "...", "content": "..."}
  ]
}
```

This shape is close to Anthropic's native format; the OpenAI provider translates it on the way in and out. (We pick this side rather than the other because Anthropic's "content blocks" composition is more expressive — easier to lower than to raise.)

### Two Files, Symmetric Implementations

```
backend/providers/
├── base.py                  # BaseLLMProvider, normalized event types
├── anthropic_provider.py    # uses anthropic SDK
└── openai_provider.py       # uses openai SDK
```

Each is ~150 lines: construct the streaming request, iterate the SDK's events, yield normalized events.

### Selection

```python
# config.py
def get_provider() -> BaseLLMProvider:
    name = os.getenv("LLM_PROVIDER", "anthropic").lower()
    if name == "anthropic":
        return AnthropicProvider(api_key=os.getenv("ANTHROPIC_API_KEY"))
    if name == "openai":
        return OpenAIProvider(api_key=os.getenv("OPENAI_API_KEY"))
    raise ValueError(f"Unknown provider: {name}")
```

Called once on app startup. The instance is reused across requests.

---

## 8. Conversation History — Storage and Replay

### Storage Shape

```sql
CREATE TABLE conversations (
    id          TEXT PRIMARY KEY,           -- UUID
    title       TEXT,                       -- auto-generated from first user message
    created_at  TEXT NOT NULL,              -- ISO timestamp
    updated_at  TEXT NOT NULL
);

CREATE TABLE messages (
    id              TEXT PRIMARY KEY,       -- UUID
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    role            TEXT NOT NULL,          -- 'user' | 'assistant'
    content         TEXT NOT NULL,          -- JSON (the parts array)
    created_at      TEXT NOT NULL
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);
```

### Why JSON Content

An assistant message is not just text — it's an ordered list of parts that can include text segments, tool calls, and tool results. Storing this as JSON in a single `content` column means:

- One row per message, regardless of complexity.
- The same JSON the frontend receives during streaming is what gets persisted.
- On page reload, the frontend gets the same shape and rehydrates the message identically — charts, KPIs, suggestions and all.
- No JOIN required to reconstruct a message.

### A Stored Assistant Message Looks Like

```json
[
  {"type": "text", "text": "Here's how Apple performed in 2017:"},
  {
    "type": "tool_call",
    "tool_name": "run_sql",
    "input": {"query": "SELECT date, close FROM stock_prices WHERE name='AAPL' AND date LIKE '2017%' ORDER BY date"},
    "result": {"columns": ["date","close"], "rows": [...], "row_count": 251}
  },
  {
    "type": "tool_call",
    "tool_name": "render_chart",
    "input": {"chart_type": "line", "title": "AAPL 2017", "data": [...], "x_key": "date", "y_keys": ["close"]},
    "result": {"ok": true}
  },
  {"type": "text", "text": "AAPL closed 2017 up about 46%."},
  {
    "type": "tool_call",
    "tool_name": "render_suggestions",
    "input": {"chips": [{"label": "Compare to MSFT", "query": "How did MSFT do in 2017?"}, ...]},
    "result": {"ok": true}
  }
]
```

### History Replay for the Next Turn

When building the next LLM request, the agent walks the stored messages and converts each part back into the provider's expected format. `tool_call` parts become `tool_use` + `tool_result` blocks. This is what allows the model to reference previous results on follow-up turns.

### Context Window Pressure

`run_sql` results can be big. A 5-year daily series for one ticker is ~1250 rows. Carrying every result forever will eventually blow the context window. Mitigations, in order of priority:

1. **Truncate tool results when replaying old history.** When rebuilding the message list for the LLM, if a tool result has more than ~50 rows, replace the bulk with a placeholder: `{"columns": [...], "rows": [first 20 rows], "truncated": true, "original_row_count": 1250}`. The model retains the *shape* of what happened without the bulk. The full result remains in the DB for the frontend's rehydration.

2. **Drop very old turns.** If a conversation has more than, say, 20 turns, the oldest can be summarized into a single system note. Skip for v1; add only if it becomes a problem.

3. **Cap output tokens** on the LLM call to a reasonable number (1024 is plenty per turn).

---

## 9. Streaming — End to End

### Why Streaming

The brief calls for it, and it transforms the feel of the product. The user sees text appearing, a "running query…" indicator, then the chart rendering, then more text — instead of a 6-second blank wait followed by a wall of output.

### SSE (Server-Sent Events)

Flask streams events to the frontend as `text/event-stream`. Each event is a JSON object. The shapes mirror the normalized provider events, plus the agent-level events for tool execution:

| Event           | Payload (example)                                                              |
|-----------------|--------------------------------------------------------------------------------|
| `text_delta`    | `{"content": "Apple closed"}`                                                  |
| `tool_start`    | `{"call_id": "abc", "tool_name": "run_sql"}`                                   |
| `tool_input`    | `{"call_id": "abc", "partial_json": "{\"query\": \"SE"}`                       |
| `tool_result`   | `{"call_id": "abc", "tool_name": "run_sql", "result": {...}}`                  |
| `error`         | `{"message": "..."}`                                                           |
| `done`          | `{"message_id": "..."}`                                                        |

### The Flask Route

```python
@app.route("/api/chat", methods=["POST"])
def chat():
    body = request.get_json()
    conv_id = body["conversation_id"]
    user_text = body["message"]

    def event_stream():
        for event in agent.run(conv_id, user_text):
            yield f"data: {json.dumps(event)}\n\n"

    return Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

`agent.run()` is a Python generator that runs the agent loop and yields SSE-ready events along the way. This is the entire glue between the agent and HTTP.

---

## 10. Walking Through the Flows

Every flow uses the same loop. Here's how each kind of question moves through it.

### Flow A — Pure conversational text

**User:** *"Hi, what can you help me with?"*

```
Loop iteration 1:
  LLM input:  system_prompt + [user: "Hi, what can you help me with?"]
  LLM output: stream of text_delta events forming
              "I'm an analytics assistant for S&P 500 stock data. You
               can ask me about price trends, compare tickers, ..."
  No tool calls.
  turn_end → loop exits.

Persisted assistant message:
  [ { "type": "text", "text": "I'm an analytics assistant..." } ]
```

One LLM call. No SQL. Done.

### Flow B — Single-metric question

**User:** *"What was AAPL's highest closing price ever?"*

```
Loop iteration 1:
  LLM input:  system + [user]
  LLM output: tool_call_end → run_sql
              { "query": "SELECT MAX(close) AS max_close FROM stock_prices WHERE name='AAPL'" }
  Backend executes: {"columns":["max_close"],"rows":[{"max_close":175.61}]}
  Append tool result to history.

Loop iteration 2:
  LLM input:  system + [user, assistant(tool_call+result)]
  LLM output: tool_call_end → render_kpi
              { "label": "AAPL all-time high close", "value": "$175.61" }
  Backend validates and structures the payload.
  Append.

Loop iteration 3:
  LLM input:  ...
  LLM output: text "Apple's highest closing price in the dataset was
              $175.61." + render_suggestions
  turn_end.

Persisted message: text + run_sql + render_kpi + text + render_suggestions
```

Three iterations, all triggered by one user message.

### Flow C — Time series chart

**User:** *"How did AAPL trend in 2017?"*

```
Iter 1: tool_call_end → run_sql
        SELECT date, close FROM stock_prices
        WHERE name='AAPL' AND date >= '2017-01-01' AND date < '2018-01-01'
        ORDER BY date
        → 251 rows returned

Iter 2: tool_call_end → render_chart
        { chart_type: 'line', title: 'AAPL 2017',
          data: <the 251 rows>, x_key: 'date', y_keys: ['close'] }

Iter 3: text "AAPL rose from ~$116 to ~$169 over 2017, a ~46% gain..."
        + render_suggestions
        turn_end.
```

### Flow D — Comparison

**User:** *"Compare AAPL and MSFT in 2017."*

The LLM has a choice: one query with a GROUP BY, or two queries. It almost always does one:

```
Iter 1: run_sql:
        SELECT date, name, close FROM stock_prices
        WHERE name IN ('AAPL','MSFT') AND date LIKE '2017%'
        ORDER BY date, name

Iter 2: The model transforms the rows into a pivot suitable for the
        chart: [{date: '2017-01-03', AAPL: 116.15, MSFT: 62.58}, ...]
        Then calls render_chart with y_keys: ['AAPL', 'MSFT'].

Iter 3: narrative text + suggestions.
```

This is interesting because the LLM is doing the pivot **inside the tool argument**. It's allowed to — and we want it to, because the chart wants wide-format data and SQL returns long-format.

For large result sets where this would be wasteful, a future improvement is to add a `pivot` parameter on `render_chart` that does the transform server-side. Not necessary for v1.

### Flow E — Follow-up that depends on history

**User (after Flow D):** *"Now show me their volumes too."*

```
Iter 1: The LLM sees the prior conversation. It knows "their" = AAPL & MSFT
        and the context is 2017. It writes:

        SELECT date, name, volume FROM stock_prices
        WHERE name IN ('AAPL','MSFT') AND date LIKE '2017%'
        ORDER BY date, name

Iter 2: render_chart, chart_type='bar' or 'line', similar shape.

Iter 3: narrative + suggestions.
```

No special code makes this work — the conversation history flowing into the LLM is what makes it work. The previous run_sql and its result are still in history, so the model knows what the prior query looked like and can mimic it with one column changed.

### Flow F — Ambiguous question

**User:** *"Show me the important stuff."*

```
Iter 1: LLM, following the "ask if ambiguous" rule, returns text:
        "Happy to. Could you narrow it down? For example: a specific
         ticker, a time window, or a comparison you're curious about?"
        No tool calls.
        turn_end.
```

The system prompt's rule earns its keep here.

### Flow G — Out-of-scope question

**User:** *"What's AAPL's price right now?"*

```
Iter 1: LLM, recognizing the data is historical, returns:
        "I only have historical daily data through Feb 2018. The most
         recent close in the dataset for AAPL was $X on 2018-02-07.
         I can't fetch live prices."
        + maybe render_suggestions.
        turn_end.
```

### Flow H — SQL error and self-correction

**User:** *"What was AAPL's average price last year?"* (and the LLM, on first try, writes `SELECT AVG(price) FROM stock_prices WHERE ticker='AAPL'` — wrong column name and wrong table column)

```
Iter 1: run_sql → backend returns {"error": "no such column: price"}

Iter 2: LLM reads the error, sees the schema in its system prompt
        again, and writes:
        SELECT AVG(close) FROM stock_prices WHERE name='AAPL' AND date LIKE '2017%'
        → returns {"avg_close": 150.34}

Iter 3: render_kpi → "AAPL average close 2017: $150.34"

Iter 4: narrative + suggestions.
```

This works because we **return errors to the model** rather than failing the request. The model is good at fixing its own mistakes when given the chance.

### Flow I — User clicks a suggestion chip

This is just Flow B/C/D/E with a different entry point — the frontend sends the `chip.query` string as the next user message. The backend has no idea it was a chip click vs. a typed message, and it doesn't need to.

### Flow J — Multi-step reasoning

**User:** *"Which S&P 500 stock had the worst single day in the data, and how did it recover over the following month?"*

```
Iter 1: run_sql:
        SELECT name, date, (close - open) / open AS pct_change
        FROM stock_prices
        ORDER BY pct_change ASC
        LIMIT 1
        → {"name": "XYZ", "date": "2016-06-24", "pct_change": -0.39}

Iter 2: run_sql:
        SELECT date, close FROM stock_prices
        WHERE name='XYZ' AND date >= '2016-06-24' AND date <= '2016-07-24'
        ORDER BY date
        → 22 rows

Iter 3: render_kpi (worst day: -39%) + render_chart (recovery curve)

Iter 4: narrative + suggestions.
```

Two SQL queries in one user turn, naturally chained by the agent loop.

---

## 11. Error Handling — Where and How

| Failure                          | Where caught                | What happens                                                              |
|----------------------------------|-----------------------------|---------------------------------------------------------------------------|
| Provider rate limit / 429        | Provider class              | Yield `{"type":"error","message":...}` event; close stream gracefully     |
| Provider timeout / connection    | Provider class              | Same                                                                       |
| LLM emits malformed tool args    | Tool registry dispatcher    | Return `{"error":"Invalid input: ..."}` to LLM; let it retry              |
| SQL syntax error / bad column    | `run_sql` handler           | Return `{"error":"..."}`; LLM self-corrects (Flow H)                      |
| SQL query timeout                | `run_sql` handler           | Same                                                                       |
| Tool that doesn't exist          | Tool registry dispatcher    | Return `{"error":"No such tool"}`; LLM picks again                        |
| Agent loop exceeds max iter (e.g. 8) | Agent loop                | Emit error event, save what we have, close stream                          |
| SSE client disconnects mid-stream| Flask                       | Detected by generator; abort cleanly; partial message still saved          |
| Database write fails             | DB layer                    | 500 to client; conversation state remains consistent (transactions)       |

The guiding principle: **return failures to the LLM as tool results** whenever possible. The LLM is a remarkably capable error-recovery layer if you let it see what went wrong.

The exception: the *agent loop iteration cap*. Without one, a misbehaving model could loop forever (e.g. call `run_sql` → call it again → call it again). Cap at 8 iterations per user turn; emit an error and stop if exceeded.

---

## 12. Backend Module Layout

```
backend/
├── app.py                       # Flask app factory, route registration
├── config.py                    # Env vars, provider selection
├── requirements.txt
├── Dockerfile
│
├── agent/
│   ├── __init__.py
│   ├── loop.py                  # The agent loop (run() generator)
│   ├── system_prompt.py         # Builds the system prompt from schema
│   └── history.py               # DB messages ↔ provider-format messages
│
├── providers/
│   ├── __init__.py
│   ├── base.py                  # BaseLLMProvider, event types
│   ├── anthropic_provider.py
│   └── openai_provider.py
│
├── tools/
│   ├── __init__.py
│   ├── registry.py              # TOOLS dict + dispatch + format converters
│   ├── run_sql.py
│   ├── render_kpi.py
│   ├── render_chart.py
│   ├── render_table.py
│   └── render_suggestions.py
│
├── db/
│   ├── __init__.py
│   ├── connection.py            # Single SQLite connection helper
│   ├── schema.py                # CREATE TABLE statements; run on startup
│   ├── seed.py                  # Load CSV → stock_prices
│   ├── analytics.py             # Optional helpers (not strictly required —
│   │                            #   run_sql goes direct to SQLite)
│   └── chat.py                  # Conversations + messages CRUD
│
└── routes/
    ├── __init__.py
    ├── chat.py                  # POST /api/chat (SSE)
    └── conversations.py         # GET/POST conversations, GET messages
```

### Lines of Code, Roughly

| Module                  | Approx LOC |
|-------------------------|-----------:|
| `agent/loop.py`         | 80         |
| `agent/system_prompt.py`| 60         |
| `agent/history.py`      | 60         |
| `providers/base.py`     | 30         |
| `providers/anthropic_provider.py` | 150 |
| `providers/openai_provider.py`    | 150 |
| `tools/registry.py`     | 100        |
| `tools/run_sql.py`      | 50         |
| Other tool handlers     | 20 each    |
| `db/*`                  | 100 total  |
| `routes/*`              | 80 total   |
| **Total**               | **~1000**  |

Small. The architecture is the value, not the line count.

---

## 13. The Database Layer in Detail

### Single Connection vs Per-Request

SQLite handles concurrent reads fine but serializes writes. For this app:

- The analytics queries (`run_sql`) are read-only. Open with `mode=ro`.
- The chat persistence writes are infrequent (a few per user turn). Use a single shared connection with `check_same_thread=False`, guarded by a lock for writes.

For v1 simplicity: one connection per request, opened fresh. SQLite is fast enough that this isn't a bottleneck at single-user scale.

### Initialization Order on Startup

```
1. Open SQLite (creates file if missing).
2. Run schema migrations (CREATE TABLE IF NOT EXISTS for all three tables).
3. Check if stock_prices is empty. If so, run seed (load CSV).
4. Construct the LLM provider from env.
5. Register Flask routes.
6. Start serving.
```

Seeding is idempotent — re-running `docker compose up` doesn't duplicate data.

### Seeding from the CSV

```python
def seed(conn):
    cur = conn.execute("SELECT COUNT(*) FROM stock_prices")
    if cur.fetchone()[0] > 0:
        return  # already seeded
    df = pd.read_csv("/app/data/sp500.csv")
    # Normalize the date column from MM/DD/YYYY → YYYY-MM-DD
    df["date"] = pd.to_datetime(df["date"], format="%m/%d/%Y").dt.strftime("%Y-%m-%d")
    df = df.rename(columns={"Name": "name"})
    df.to_sql("stock_prices", conn, if_exists="append", index=False)
```

CSV lives in `./data/sp500.csv`, mounted into the container at `/app/data`.

---

## 14. Docker — Everything Runs in Containers

### Top-Level

```
docker-compose.yml
.env.example
Makefile
```

### `docker-compose.yml`

```yaml
services:
  backend:
    build: ./backend
    container_name: sp500-backend
    ports:
      - "5000:5000"
    volumes:
      - ./data:/app/data      # CSV input + app.db output (persists)
    env_file: .env

  frontend:
    build: ./frontend
    container_name: sp500-frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:5000
    depends_on:
      - backend
```

No database container. SQLite is a file inside the `./data` volume.

### `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "app.py"]
```

No virtual environments inside Docker — the container's Python *is* the environment.

### `.env.example`

```bash
# Which LLM provider to use. Either 'anthropic' or 'openai'.
LLM_PROVIDER=anthropic

# Only the active provider's key needs to be filled in.
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Optional model overrides
ANTHROPIC_MODEL=claude-sonnet-4-5
OPENAI_MODEL=gpt-4o

# Paths inside the container
SQLITE_PATH=/app/data/app.db
SEED_CSV_PATH=/app/data/sp500.csv
```

### `Makefile`

```makefile
up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f backend

shell:
	docker compose exec backend /bin/bash

clean:
	docker compose down -v
	rm -f data/app.db
```

### Fresh-Clone Run

```bash
git clone <repo>
cd sp500-analytics
cp .env.example .env
# fill in ANTHROPIC_API_KEY (or set LLM_PROVIDER=openai + OPENAI_API_KEY)
# drop sp500.csv into ./data
make up
```

Backend on `:5000`, frontend on `:3000`. Schema and seed run automatically on first start.

---

## 15. Security and Safety

This is a single-user local app, so threat-model is light, but a few protections are still worth having:

- **Read-only analytics queries.** `run_sql` opens SQLite in read-only mode. Even if the LLM tries `DROP TABLE`, it can't.
- **SELECT-only enforcement.** Parse the query and reject anything that isn't a SELECT/WITH.
- **Row caps.** Inject `LIMIT 1000` if missing — prevents `SELECT * FROM stock_prices` from blowing the context.
- **Query timeout.** Use `conn.set_progress_handler` to abort queries that run too long.
- **No PII / no secrets in the dataset.** Stock data is public.
- **API keys never reach the frontend.** They're env vars on the backend container only.

---

## 16. What "Done" Looks Like

The backend is complete when:

1. `make up` on a fresh clone starts everything; the backend is reachable on `:5000`.
2. The schema is auto-created and the CSV is auto-seeded on first run.
3. `POST /api/chat` with a question returns an SSE stream of events that includes text deltas, tool calls, tool results, and a `done` event.
4. The same endpoint works whether `LLM_PROVIDER=anthropic` or `LLM_PROVIDER=openai` is set.
5. Conversations and messages persist across container restarts (verified by listing them via `GET /api/conversations`).
6. The LLM successfully handles each of Flows A–J end-to-end in a manual test.
7. The agent self-corrects after a deliberately mis-spelled column name (Flow H).
8. Adding a new tool (e.g. `render_heatmap`) requires changes only to `tools/registry.py` and one new handler file.

---

## 17. What to Build First (Order of Work)

The system has interdependent pieces; build them in this order so each step is testable in isolation:

1. **SQLite + schema + seed.** Write a tiny script that opens `app.db`, creates the tables, and loads the CSV. Confirm with `SELECT name, COUNT(*) FROM stock_prices GROUP BY name LIMIT 5`.
2. **`run_sql` tool standalone.** Just a Python function. Test against the seeded DB.
3. **One provider (whichever you know best), non-streaming.** Get a round-trip working: send a message + tool schemas, receive a response, dispatch the tool call manually. No Flask yet.
4. **Agent loop, non-streaming.** Wrap the provider in the loop. Test in a Python REPL: `agent.run("How many rows are there?")` → returns final assistant message.
5. **System prompt + tool descriptions polished.** Manually test Flows A, B, C, F in the REPL. Iterate on the prompt until they all work.
6. **Add streaming to the provider.** Switch from a single response to yielding normalized events.
7. **Flask + SSE.** Wire the route to the agent loop generator. Curl it; confirm events arrive in real time.
8. **Conversation persistence.** Add the DB tables, save messages on each turn, list/retrieve endpoints.
9. **Second provider.** Implement the OpenAI variant by copying the Anthropic one and swapping SDK calls + format translation.
10. **All remaining tools.** `render_kpi`, `render_chart`, `render_table`, `render_suggestions`. Test each by asking the LLM to use it.
11. **Error paths.** Deliberately break things (bad SQL, killed connections) and verify graceful recovery.

Skip the frontend until step 7 is done — the backend should be fully testable via curl before any UI exists.

---

## 18. What Another Six Hours Would Add

Reasonable next steps, roughly in order of value:

- **Server-side data referencing.** Replace the inline-data approach in `render_chart` with a "result ID" the LLM can pass — saves tokens for large series.
- **`pivot` parameter on chart tools.** Server-side long→wide transformation, eliminating the LLM's hand-pivoting.
- **More tools:** `render_heatmap` (correlation matrix between tickers), `render_candlestick` (OHLC chart), `render_diff` (compare two queries side by side).
- **Conversation title auto-generation.** After the first assistant message, ask the model to summarize the topic into 4–6 words.
- **Caching.** Memoize identical SQL queries within a conversation — common when the user asks variations of the same thing.
- **Token-aware truncation.** Currently we truncate by row count; smarter would be to count tokens and trim accordingly.
- **Conversation summarization** for very long chats — replace the oldest N turns with a summary system message.
- **Better SQL guardrails.** Parse the AST with `sqlglot` rather than regex; richer rejection rules.
- **Read-only API mode for charts.** Frontend can re-request a chart payload by message ID + tool call ID instead of relying on the persisted JSON.

---

## 19. Closing Notes

The architecture is small on purpose. The point isn't a lot of code — it's:

- A **clear agent loop** that handles every flow uniformly.
- A **clean tool layer** that's trivial to extend.
- A **clean provider abstraction** that swaps with one env var.
- A **single database** that fits both the analytics and the conversation history naturally.
- **Streaming end-to-end** so the product feels alive.

If you keep the LLM as the decision-maker and your code as the faithful executor of its decisions, every flow falls out of one loop — and adding new capabilities is almost always just "add a new tool."

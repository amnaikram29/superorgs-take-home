from .run_sql import run_sql_handler
from .render_kpi import render_kpi_handler
from .render_chart import render_chart_handler
from .render_table import render_table_handler
from .render_suggestions import render_suggestions_handler

TOOLS = {
    "run_sql": {
        "description": (
            "Execute a read-only SQLite SELECT query against the stock_prices table. "
            "Use this to fetch any data needed to answer the user's question. "
            "Always filter by name and/or date range. Never SELECT * without a LIMIT."
        ),
        "handler": run_sql_handler,
        "schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "A single SQLite SELECT (or WITH ... SELECT) statement.",
                }
            },
            "required": ["query"],
        },
    },
    "render_kpi": {
        "description": (
            "Render a single key metric card in the UI. "
            "Use when the answer is one important number (e.g. highest price, average volume)."
        ),
        "handler": render_kpi_handler,
        "schema": {
            "type": "object",
            "properties": {
                "label": {"type": "string", "description": "What the number represents."},
                "value": {"type": "string", "description": "Formatted value, e.g. '$175.61' or '46.2%'."},
                "delta": {"type": "string", "description": "Optional change indicator, e.g. '+12.4%'."},
                "delta_direction": {
                    "type": "string",
                    "enum": ["up", "down"],
                    "description": "Direction of the delta.",
                },
            },
            "required": ["label", "value"],
        },
    },
    "render_chart": {
        "description": (
            "Render a chart in the UI. Use for trends over time (line), comparisons between "
            "discrete groups (bar), or cumulative series (area). Pass the data rows directly. "
            "You MUST specify x_key (column name for x-axis) and y_keys (array of column names for y-axis) "
            "that exist in the data objects."
        ),
        "handler": render_chart_handler,
        "schema": {
            "type": "object",
            "properties": {
                "chart_type": {
                    "type": "string",
                    "enum": ["line", "bar", "area"],
                    "description": "Type of chart.",
                },
                "title": {"type": "string"},
                "data": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "Array of row objects from run_sql (or hand-pivoted).",
                },
                "x_key": {"type": "string", "description": "Column name for the x-axis."},
                "y_keys": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "One or more column names for the y-axis (multiple = multi-series).",
                },
                "x_label": {"type": "string"},
                "y_label": {"type": "string"},
            },
            "required": ["chart_type", "title", "data", "x_key", "y_keys"],
        },
    },
    "render_table": {
        "description": (
            "Render a data table in the UI. Use for ranked lists, top-N results, "
            "or when raw rows are more informative than a chart."
        ),
        "handler": render_table_handler,
        "schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "columns": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Column header names in display order.",
                },
                "rows": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "Row objects matching the columns.",
                },
            },
            "required": ["title", "columns", "rows"],
        },
    },
    "render_suggestions": {
        "description": (
            "Render clickable follow-up suggestion chips. Call this at the end of every "
            "substantive answer with 2-4 short, specific follow-up questions."
        ),
        "handler": render_suggestions_handler,
        "schema": {
            "type": "object",
            "properties": {
                "chips": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": {"type": "string", "description": "Button display text."},
                            "query": {"type": "string", "description": "Message sent when clicked."},
                        },
                        "required": ["label", "query"],
                    },
                    "description": "2-4 follow-up suggestion chips.",
                }
            },
            "required": ["chips"],
        },
    },
}


def dispatch(tool_name: str, tool_input: dict) -> dict:
    if tool_name not in TOOLS:
        return {"error": f"Unknown tool '{tool_name}'."}
    try:
        return TOOLS[tool_name]["handler"](**tool_input)
    except TypeError as e:
        return {"error": f"Invalid input for tool '{tool_name}': {e}"}


def to_anthropic_tools() -> list:
    result = []
    for name, tool in TOOLS.items():
        result.append({
            "name": name,
            "description": tool["description"],
            "input_schema": tool["schema"],
        })
    return result


def to_openai_tools() -> list:
    result = []
    for name, tool in TOOLS.items():
        result.append({
            "type": "function",
            "function": {
                "name": name,
                "description": tool["description"],
                "parameters": tool["schema"],
            },
        })
    return result

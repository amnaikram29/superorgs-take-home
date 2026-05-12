def render_table_handler(title: str, columns: list, rows: list) -> dict:
    return {
        "type": "table",
        "title": title,
        "columns": columns,
        "rows": rows,
    }

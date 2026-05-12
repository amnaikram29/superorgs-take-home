def render_chart_handler(
    chart_type: str,
    title: str,
    data: list,
    x_key: str,
    y_keys: list,
    x_label: str | None = None,
    y_label: str | None = None,
) -> dict:
    if chart_type not in ("line", "bar", "area"):
        return {"error": f"Invalid chart_type '{chart_type}'. Must be 'line', 'bar', or 'area'."}

    if data:
        sample = data[0]
        if x_key not in sample:
            return {"error": f"x_key '{x_key}' not found in data rows."}
        missing = [k for k in y_keys if k not in sample]
        if missing:
            return {"error": f"y_keys not found in data rows: {missing}"}

    return {
        "type": "chart",
        "chart_type": chart_type,
        "title": title,
        "data": data,
        "x_key": x_key,
        "y_keys": y_keys,
        "x_label": x_label,
        "y_label": y_label,
    }

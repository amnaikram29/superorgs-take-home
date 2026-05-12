def render_kpi_handler(label: str, value: str, delta: str | None = None, delta_direction: str | None = None) -> dict:
    return {
        "type": "kpi",
        "label": label,
        "value": value,
        "delta": delta,
        "delta_direction": delta_direction,
    }

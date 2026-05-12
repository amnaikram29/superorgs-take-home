def render_suggestions_handler(chips: list) -> dict:
    return {
        "type": "suggestions",
        "chips": chips,
    }

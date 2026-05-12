import json
from typing import Optional

# Max rows to replay inline for old tool results (avoids context bloat)
REPLAY_ROW_LIMIT = 50


def db_messages_to_provider_messages(db_messages: list[dict]) -> list[dict]:
    """
    Convert stored DB message rows into the provider-agnostic message format.
    Each DB row has: role ('user'|'assistant'), content (list of parts).
    """
    provider_messages = []

    for db_msg in db_messages:
        role = db_msg["role"]
        parts = db_msg["content"]  # already decoded list

        if role == "user":
            # Simple text message from user
            text_parts = [p for p in parts if p["type"] == "text"]
            text = " ".join(p["text"] for p in text_parts)
            provider_messages.append({
                "role": "user",
                "content": [{"type": "text", "text": text}],
            })

        elif role == "assistant":
            # Reconstruct the saved parts into provider messages.
            # Saved DB messages combine parts from multiple iterations in one flat list.
            # Anthropic's API requires that text blocks never appear BETWEEN tool_use
            # blocks in the same content array when tool_results follow. We resolve this
            # by emitting text in its own preceding assistant message:
            #
            #   assistant([text...])          ← only if there is text
            #   assistant([tool_use...])      ← only tool_use blocks
            #   user([tool_result...])        ← all tool results
            tool_use_blocks = []
            text_blocks = []
            tool_result_blocks = []

            for part in parts:
                if part["type"] == "text":
                    if part["text"].strip():
                        text_blocks.append({"type": "text", "text": part["text"]})

                elif part["type"] == "tool_call":
                    call_id = part.get("call_id", part.get("id", ""))
                    tool_use_blocks.append({
                        "type": "tool_use",
                        "id": call_id,
                        "name": part["tool_name"],
                        "input": part["input"],
                    })
                    result = _truncate_result(part.get("result", {}))
                    tool_result_blocks.append({
                        "type": "tool_result",
                        "tool_use_id": call_id,
                        "content": json.dumps(result),
                    })

            if tool_use_blocks:
                # Emit text in its own message so no text interleaves with tool_use
                if text_blocks:
                    provider_messages.append({
                        "role": "assistant",
                        "content": text_blocks,
                    })
                provider_messages.append({
                    "role": "assistant",
                    "content": tool_use_blocks,
                })
                provider_messages.append({
                    "role": "user",
                    "content": tool_result_blocks,
                })
            elif text_blocks:
                provider_messages.append({
                    "role": "assistant",
                    "content": text_blocks,
                })

    return provider_messages


def parts_to_provider_turns(iterations: list[list[dict]]) -> list[dict]:
    """
    Convert a list of per-iteration parts into provider messages.

    Each iteration becomes its own assistant + user(tool_results) pair,
    so the Anthropic API never sees tool_use blocks mixed across turns.
    """
    provider_msgs = []
    for iteration_parts in iterations:
        turns = _parts_to_turns(iteration_parts)
        provider_msgs.extend(turns)
    return provider_msgs


def _parts_to_turns(parts: list[dict]) -> list[dict]:
    """Convert one iteration's parts into [assistant_msg, user_tool_results_msg]."""
    tool_use_blocks = []
    text_blocks = []
    tool_result_blocks = []

    for part in parts:
        if part["type"] == "text" and part["text"].strip():
            text_blocks.append({"type": "text", "text": part["text"]})
        elif part["type"] == "tool_call":
            call_id = part.get("call_id", part.get("id", ""))
            tool_use_blocks.append({
                "type": "tool_use",
                "id": call_id,
                "name": part["tool_name"],
                "input": part["input"],
            })
            result = _truncate_result(part.get("result", {}))
            tool_result_blocks.append({
                "type": "tool_result",
                "tool_use_id": call_id,
                "content": json.dumps(result),
            })

    turns = []

    if tool_use_blocks:
        # Emit any text in its OWN preceding assistant message so that
        # the tool_use assistant message contains no interspersed text.
        # Anthropic's API rejects replayed history where text and tool_use
        # appear in the same content array.
        if text_blocks:
            turns.append({"role": "assistant", "content": text_blocks})
        turns.append({"role": "assistant", "content": tool_use_blocks})
        turns.append({"role": "user", "content": tool_result_blocks})
    elif text_blocks:
        turns.append({"role": "assistant", "content": text_blocks})

    return turns


def _truncate_result(result: dict) -> dict:
    """Truncate large run_sql results when replaying history to save context tokens."""
    if not isinstance(result, dict):
        return result
    rows = result.get("rows")
    if rows and len(rows) > REPLAY_ROW_LIMIT:
        return {
            **result,
            "rows": rows[:REPLAY_ROW_LIMIT],
            "truncated": True,
            "original_row_count": len(rows),
        }
    return result

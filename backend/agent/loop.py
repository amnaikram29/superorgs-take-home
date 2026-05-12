import json
import logging
from typing import Iterator

logger = logging.getLogger(__name__)

from agent.system_prompt import build_system_prompt
from agent.history import db_messages_to_provider_messages, parts_to_provider_turns
from tools.registry import dispatch, to_anthropic_tools, to_openai_tools
from db import chat as chat_db

MAX_ITERATIONS = 8


def run(
    provider,
    conv_id: str,
    user_text: str,
) -> Iterator[dict]:
    """
    Main agent loop. Yields SSE-ready event dicts.
    Persists user message and final assistant message to DB.
    """
    # Save user message
    logger.info(f"Starting agent loop for conv_id: {conv_id}. User message: {user_text[:50]}...")
    chat_db.save_message(conv_id, "user", [{"type": "text", "text": user_text}])

    system_prompt = build_system_prompt()

    from providers.anthropic_provider import AnthropicProvider
    tools = to_anthropic_tools() if isinstance(provider, AnthropicProvider) else to_openai_tools()

    # Each element is the list of parts for one completed iteration's assistant turn.
    # This lets us reconstruct the proper multi-turn history (separate assistant
    # messages per iteration rather than one combined message).
    completed_iterations: list[list[dict]] = []

    # Parts for the CURRENT iteration only
    current_parts: list[dict] = []
    current_text_buf = ""

    # All parts across all iterations — for final persistence as one DB message
    all_parts: list[dict] = []

    for iteration in range(1, MAX_ITERATIONS + 1):
        logger.info(f"Iteration {iteration}/{MAX_ITERATIONS} for conv_id: {conv_id}")
        has_tool_calls = False
        stop_reason = None

        # Rebuild provider messages:
        # 1. Load DB history (user message + any previously saved turns)
        db_msgs = chat_db.get_messages(conv_id)

        # 2. Append virtual turns for each completed iteration of the current user turn
        virtual_turns = parts_to_provider_turns(completed_iterations)

        provider_messages = db_messages_to_provider_messages(db_msgs) + virtual_turns

        try:
            for event in provider.stream_chat(system_prompt, provider_messages, tools):
                etype = event["type"]

                if etype == "text_delta":
                    current_text_buf += event["content"]
                    yield {"type": "text_delta", "content": event["content"]}

                elif etype == "tool_call_start":
                    has_tool_calls = True
                    logger.info(f"Tool call start: {event['tool_name']} (id: {event['call_id']})")
                    yield {
                        "type": "tool_start",
                        "call_id": event["call_id"],
                        "tool_name": event["tool_name"],
                    }

                elif etype == "tool_call_input":
                    yield {
                        "type": "tool_input",
                        "call_id": event["call_id"],
                        "partial_json": event["partial_json"],
                    }

                elif etype == "tool_call_end":
                    call_id = event["call_id"]
                    tool_name = event["tool_name"]
                    tool_input = event["input"]

                    if current_text_buf.strip():
                        part = {"type": "text", "text": current_text_buf}
                        current_parts.append(part)
                        all_parts.append(part)
                        current_text_buf = ""

                    result = dispatch(tool_name, tool_input)
                    part = {
                        "type": "tool_call",
                        "call_id": call_id,
                        "tool_name": tool_name,
                        "input": tool_input,
                        "result": result,
                    }
                    current_parts.append(part)
                    all_parts.append(part)

                    logger.info(f"Tool result: {tool_name} (id: {call_id})")
                    yield {
                        "type": "tool_result",
                        "call_id": call_id,
                        "tool_name": tool_name,
                        "result": result,
                    }

                elif etype == "turn_end":
                    stop_reason = event.get("stop_reason")
                    if current_text_buf.strip():
                        part = {"type": "text", "text": current_text_buf}
                        current_parts.append(part)
                        all_parts.append(part)
                        current_text_buf = ""
                    break

        except Exception as e:
            yield {"type": "error", "message": str(e)}
            break

        # Snapshot this iteration's parts and reset for the next
        if current_parts:
            completed_iterations.append(list(current_parts))
            current_parts = []

        # Only re-enter when the model explicitly wants tool results.
        # However, if the model stops without producing any user-visible content
        # (text or visual tools) after fetching data, we force it to continue
        # one more time with a reminder.
        if stop_reason != "tool_use":
            has_visible = any(
                p["type"] == "text" or (p["type"] == "tool_call" and p["tool_name"] != "run_sql")
                for p in all_parts
            )
            if not has_visible and iteration < MAX_ITERATIONS:
                # Find if we have any successful SQL results to talk about
                has_data = any(p["type"] == "tool_call" and p["tool_name"] == "run_sql" and "result" in p for p in all_parts)
                if has_data:
                    logger.info(f"No visible content produced after SQL. Nudging model (conv_id: {conv_id})")
                    # Inject a "virtual" turn to nudge the model
                    reminder_parts = [{"type": "text", "text": "(System reminder: You fetched data but haven't shown it to the user. Use render_table/render_chart/render_kpi or provide a summary.)"}]
                    completed_iterations.append(reminder_parts)
                    continue
            logger.info(f"Exiting loop for conv_id: {conv_id}. Stop reason: {stop_reason}")
            break

    else:
        yield {"type": "error", "message": "Agent reached maximum iteration limit."}

    # Persist the full assistant turn (all parts across all iterations) as one DB message
    if all_parts:
        msg = chat_db.save_message(conv_id, "assistant", all_parts)

        conv = chat_db.get_conversation(conv_id)
        if conv and not conv.get("title"):
            title = user_text[:60] + ("..." if len(user_text) > 60 else "")
            chat_db.update_conversation_title(conv_id, title)

        yield {"type": "done", "message_id": msg["id"]}
    else:
        yield {"type": "done", "message_id": None}

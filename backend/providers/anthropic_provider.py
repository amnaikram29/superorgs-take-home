import json
import os
from typing import Iterator

import anthropic

from .base import BaseLLMProvider


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")

    def stream_chat(
        self,
        system_prompt: str,
        messages: list[dict],
        tools: list[dict],
    ) -> Iterator[dict]:
        anthropic_messages = [_to_anthropic_message(m) for m in messages]

        kwargs = dict(
            model=self.model,
            max_tokens=8192,
            system=system_prompt,
            messages=anthropic_messages,
        )
        if tools:
            kwargs["tools"] = tools

        with self.client.messages.stream(**kwargs) as stream:
            current_tool_calls: dict[int, dict] = {}

            for event in stream:
                event_type = event.type

                if event_type == "content_block_start":
                    block = event.content_block
                    if block.type == "text":
                        pass  # text deltas handled by content_block_delta
                    elif block.type == "tool_use":
                        current_tool_calls[event.index] = {
                            "call_id": block.id,
                            "tool_name": block.name,
                            "json_buf": "",
                        }
                        yield {
                            "type": "tool_call_start",
                            "call_id": block.id,
                            "tool_name": block.name,
                        }

                elif event_type == "content_block_delta":
                    delta = event.delta
                    if delta.type == "text_delta":
                        yield {"type": "text_delta", "content": delta.text}
                    elif delta.type == "input_json_delta":
                        tc = current_tool_calls.get(event.index)
                        if tc:
                            tc["json_buf"] += delta.partial_json
                            yield {
                                "type": "tool_call_input",
                                "call_id": tc["call_id"],
                                "partial_json": delta.partial_json,
                            }

                elif event_type == "content_block_stop":
                    tc = current_tool_calls.pop(event.index, None)
                    if tc:
                        try:
                            parsed = json.loads(tc["json_buf"]) if tc["json_buf"] else {}
                        except json.JSONDecodeError:
                            parsed = {}
                        yield {
                            "type": "tool_call_end",
                            "call_id": tc["call_id"],
                            "tool_name": tc["tool_name"],
                            "input": parsed,
                        }

                elif event_type == "message_delta":
                    if hasattr(event, "delta") and hasattr(event.delta, "stop_reason"):
                        yield {"type": "turn_end", "stop_reason": event.delta.stop_reason}

                elif event_type == "message_stop":
                    # Ensure turn_end is always emitted
                    pass


def _to_anthropic_message(msg: dict) -> dict:
    role = msg["role"]
    content = msg["content"]

    if role == "user":
        # content is a list of blocks
        blocks = []
        for part in content:
            if part["type"] == "text":
                blocks.append({"type": "text", "text": part["text"]})
            elif part["type"] == "tool_result":
                blocks.append({
                    "type": "tool_result",
                    "tool_use_id": part["tool_use_id"],
                    "content": json.dumps(part["content"]) if not isinstance(part["content"], str) else part["content"],
                })
        return {"role": "user", "content": blocks}

    elif role == "assistant":
        blocks = []
        for part in content:
            if part["type"] == "text":
                blocks.append({"type": "text", "text": part["text"]})
            elif part["type"] == "tool_use":
                blocks.append({
                    "type": "tool_use",
                    "id": part["id"],
                    "name": part["name"],
                    "input": part["input"],
                })
        return {"role": "assistant", "content": blocks}

    return {"role": role, "content": content}

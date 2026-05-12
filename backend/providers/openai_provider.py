import json
import os
from typing import Iterator

from openai import OpenAI

from .base import BaseLLMProvider


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o")

    def stream_chat(
        self,
        system_prompt: str,
        messages: list[dict],
        tools: list[dict],
    ) -> Iterator[dict]:
        openai_messages = [{"role": "system", "content": system_prompt}]
        for m in messages:
            openai_messages.extend(_to_openai_messages(m))

        kwargs = dict(
            model=self.model,
            messages=openai_messages,
            stream=True,
            max_tokens=4096,
        )
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        tool_call_bufs: dict[int, dict] = {}

        with self.client.chat.completions.create(**kwargs) as stream:
            for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                finish_reason = chunk.choices[0].finish_reason if chunk.choices else None

                if delta is None:
                    continue

                if delta.content:
                    yield {"type": "text_delta", "content": delta.content}

                if delta.tool_calls:
                    for tc_delta in delta.tool_calls:
                        idx = tc_delta.index
                        if idx not in tool_call_bufs:
                            tool_call_bufs[idx] = {
                                "call_id": tc_delta.id or "",
                                "tool_name": tc_delta.function.name if tc_delta.function else "",
                                "json_buf": "",
                            }
                            yield {
                                "type": "tool_call_start",
                                "call_id": tool_call_bufs[idx]["call_id"],
                                "tool_name": tool_call_bufs[idx]["tool_name"],
                            }

                        buf = tool_call_bufs[idx]
                        if tc_delta.id and not buf["call_id"]:
                            buf["call_id"] = tc_delta.id
                        if tc_delta.function and tc_delta.function.name and not buf["tool_name"]:
                            buf["tool_name"] = tc_delta.function.name
                        if tc_delta.function and tc_delta.function.arguments:
                            partial = tc_delta.function.arguments
                            buf["json_buf"] += partial
                            yield {
                                "type": "tool_call_input",
                                "call_id": buf["call_id"],
                                "partial_json": partial,
                            }

                if finish_reason:
                    # Flush any buffered tool calls
                    for idx, buf in tool_call_bufs.items():
                        try:
                            parsed = json.loads(buf["json_buf"]) if buf["json_buf"] else {}
                        except json.JSONDecodeError:
                            parsed = {}
                        yield {
                            "type": "tool_call_end",
                            "call_id": buf["call_id"],
                            "tool_name": buf["tool_name"],
                            "input": parsed,
                        }
                    tool_call_bufs.clear()
                    yield {"type": "turn_end", "stop_reason": finish_reason}


def _to_openai_messages(msg: dict) -> list[dict]:
    role = msg["role"]
    content = msg["content"]
    result = []

    if role == "user":
        text_parts = []
        tool_results = []
        for part in content:
            if part["type"] == "text":
                text_parts.append(part["text"])
            elif part["type"] == "tool_result":
                tool_results.append({
                    "role": "tool",
                    "tool_call_id": part["tool_use_id"],
                    "content": json.dumps(part["content"]) if not isinstance(part["content"], str) else part["content"],
                })
        if text_parts:
            result.append({"role": "user", "content": " ".join(text_parts)})
        result.extend(tool_results)

    elif role == "assistant":
        text_parts = []
        tool_calls = []
        for part in content:
            if part["type"] == "text":
                text_parts.append(part["text"])
            elif part["type"] == "tool_use":
                tool_calls.append({
                    "id": part["id"],
                    "type": "function",
                    "function": {
                        "name": part["name"],
                        "arguments": json.dumps(part["input"]),
                    },
                })
        msg_out: dict = {"role": "assistant"}
        if text_parts:
            msg_out["content"] = " ".join(text_parts)
        if tool_calls:
            msg_out["tool_calls"] = tool_calls
        result.append(msg_out)

    return result

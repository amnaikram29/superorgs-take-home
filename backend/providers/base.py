from abc import ABC, abstractmethod
from typing import Iterator


class BaseLLMProvider(ABC):
    @abstractmethod
    def stream_chat(
        self,
        system_prompt: str,
        messages: list[dict],
        tools: list[dict],
    ) -> Iterator[dict]:
        """
        Yields normalized events:
          {"type": "text_delta",      "content": "..."}
          {"type": "tool_call_start", "call_id": "...", "tool_name": "..."}
          {"type": "tool_call_input", "call_id": "...", "partial_json": "..."}
          {"type": "tool_call_end",   "call_id": "...", "tool_name": "...", "input": {...}}
          {"type": "turn_end",        "stop_reason": "..."}
        """
        ...

from __future__ import annotations

from typing import Any


class Memory:
    """Short-term conversation memory shared across agent steps."""

    def __init__(self, system_prompt: str) -> None:
        self.messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt}
        ]

    def add(self, role: str, content: str, **extra: Any) -> None:
        message: dict[str, Any] = {"role": role, "content": content}
        message.update(extra)
        self.messages.append(message)

    def add_tool_result(self, tool_call_id: str, name: str, content: str) -> None:
        self.messages.append(
            {
                "role": "tool",
                "tool_call_id": tool_call_id,
                "name": name,
                "content": content,
            }
        )

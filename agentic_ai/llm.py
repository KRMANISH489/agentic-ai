from __future__ import annotations

from types import SimpleNamespace
from typing import Any, Callable

from openai import OpenAI

from agentic_ai.config import Settings, load_settings


class LLM:
    """Thin OpenAI-compatible wrapper. Works with Groq, OpenAI, OpenRouter, Ollama."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or load_settings()
        self.client = OpenAI(
            api_key=self.settings.api_key,
            base_url=self.settings.base_url,
        )

    def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.2,
        model: str | None = None,
        on_delta: Callable[[str], None] | None = None,
    ) -> Any:
        used = model or self.settings.model
        kwargs: dict[str, Any] = {
            "model": used,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
        extra: dict[str, Any] = {}
        # Qwen 3.6/3.8 default to thinking and can return empty visible answers.
        if used.startswith("qwen/"):
            extra["reasoning_effort"] = "none"
        elif "gpt-oss" in used:
            extra["reasoning_effort"] = "low"
        if extra:
            kwargs["extra_body"] = extra
        if on_delta and not tools:
            kwargs["stream"] = True
            chunks: list[str] = []
            for part in self.client.chat.completions.create(**kwargs):
                if not part.choices:
                    continue
                piece = str(getattr(part.choices[0].delta, "content", None) or "")
                if piece:
                    chunks.append(piece)
                    on_delta(piece)
            text = "".join(chunks)
            message = SimpleNamespace(content=text, tool_calls=None)
            return SimpleNamespace(choices=[SimpleNamespace(message=message)])
        return self.client.chat.completions.create(**kwargs)

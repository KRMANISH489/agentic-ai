from __future__ import annotations

from typing import Any

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
    ) -> Any:
        kwargs: dict[str, Any] = {
            "model": self.settings.model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
        return self.client.chat.completions.create(**kwargs)

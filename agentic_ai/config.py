from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"

load_dotenv(ENV_PATH)


@dataclass(frozen=True)
class Settings:
    provider: str
    model: str
    vision_model: str
    api_key: str
    base_url: str | None
    max_steps: int


_PROVIDERS = {
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "key_env": "GROQ_API_KEY",
        "default_model": "openai/gpt-oss-120b",
    },
    "openai": {
        "base_url": None,
        "key_env": "OPENAI_API_KEY",
        "default_model": "gpt-4o-mini",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "key_env": "OPENROUTER_API_KEY",
        "default_model": "openai/gpt-4o-mini",
    },
    "ollama": {
        "base_url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
        "key_env": None,
        "default_model": os.getenv("OLLAMA_MODEL", "llama3.2"),
    },
}


def load_settings() -> Settings:
    load_dotenv(ENV_PATH, override=True)
    provider = os.getenv("LLM_PROVIDER", "groq").strip().lower()
    if provider not in _PROVIDERS:
        raise ValueError(
            f"Unknown LLM_PROVIDER={provider!r}. Use: {', '.join(_PROVIDERS)}"
        )

    spec = _PROVIDERS[provider]
    model = os.getenv("LLM_MODEL") or spec["default_model"]
    vision_model = os.getenv("VISION_MODEL", "").strip()
    if not vision_model:
        if provider == "groq":
            vision_model = "meta-llama/llama-4-scout-17b-16e-instruct"
        elif provider in {"openai", "openrouter"}:
            vision_model = "gpt-4o-mini"
        else:
            vision_model = model
    api_key = "ollama"
    if spec["key_env"]:
        api_key = os.getenv(spec["key_env"], "").strip()
        if not api_key:
            raise RuntimeError(
                f"{spec['key_env']} is missing. Copy .env.example to .env and add your key."
            )

    return Settings(
        provider=provider,
        model=model,
        vision_model=vision_model,
        api_key=api_key,
        base_url=spec["base_url"],
        max_steps=int(os.getenv("MAX_STEPS", "8")),
    )


def set_env_value(key: str, value: str) -> None:
    import json

    value = value.strip().strip('"').strip("'")
    encoded = json.dumps(value)
    text = ENV_PATH.read_text(encoding="utf-8") if ENV_PATH.exists() else ""
    pattern = rf"^{re.escape(key)}=.*$"
    if re.search(pattern, text, flags=re.M):
        text = re.sub(pattern, f"{key}={encoded}", text, flags=re.M)
    else:
        text = (text.rstrip() + f"\n{key}={encoded}\n") if text.strip() else f"{key}={encoded}\n"
    ENV_PATH.write_text(text, encoding="utf-8")
    os.environ[key] = value
    load_dotenv(ENV_PATH, override=True)
    os.environ[key] = value


def save_groq_key(api_key: str) -> None:
    key = api_key.strip().strip('"').strip("'")
    if not key:
        raise ValueError("API key is empty.")
    set_env_value("GROQ_API_KEY", key)
    if not os.getenv("LLM_PROVIDER"):
        set_env_value("LLM_PROVIDER", "groq")

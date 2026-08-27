from __future__ import annotations

import json
from pathlib import Path

from agentic_ai.config import ROOT_DIR

PREFS_PATH = ROOT_DIR / "settings.json"
APP_VERSION = "1.6.0"

CORE_TOOLS = [
    "calculator",
    "current_time",
    "weather",
    "web_search",
    "wikipedia_summary",
    "notes_write",
    "code_run",
]

DEFAULT_PREFS = {
    "installed_tools": list(CORE_TOOLS),
    "max_steps": 8,
    "temperature": 0.2,
    "show_thinking": True,
    "default_mode": "agent",
    "enter_to_send": True,
    "voice_read_aloud": False,
    "voice_auto_send": True,
    "teach_instructions": "",
    "teach_memory": "",
    "teach_notes": [],
}


def load_prefs() -> dict:
    data = dict(DEFAULT_PREFS)
    data["installed_tools"] = list(CORE_TOOLS)
    if PREFS_PATH.exists():
        try:
            saved = json.loads(PREFS_PATH.read_text(encoding="utf-8"))
            if isinstance(saved, dict):
                data.update(saved)
        except json.JSONDecodeError:
            pass
    tools = data.get("installed_tools") or list(CORE_TOOLS)
    installed = [name for name in tools if isinstance(name, str)]
    for name in CORE_TOOLS:
        if name not in installed:
            installed.append(name)
    data["installed_tools"] = installed
    data["max_steps"] = max(2, min(16, int(data.get("max_steps") or 8)))
    data["temperature"] = max(0.0, min(1.2, float(data.get("temperature") or 0.2)))
    data["show_thinking"] = bool(data.get("show_thinking", True))
    data["enter_to_send"] = bool(data.get("enter_to_send", True))
    data["voice_read_aloud"] = bool(data.get("voice_read_aloud", False))
    data["voice_auto_send"] = bool(data.get("voice_auto_send", True))
    data["teach_instructions"] = str(data.get("teach_instructions") or "")[:4000]
    data["teach_memory"] = str(data.get("teach_memory") or "")[:8000]
    notes = data.get("teach_notes") or []
    cleaned = []
    if isinstance(notes, list):
        for item in notes[:5]:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "Note").strip()[:80]
            text = str(item.get("text") or "").strip()[:12000]
            note_id = str(item.get("id") or title)
            if text:
                cleaned.append({"id": note_id, "title": title or "Note", "text": text})
    data["teach_notes"] = cleaned
    if data.get("default_mode") not in {"agent", "crew"}:
        data["default_mode"] = "agent"
    return data


def save_prefs(updates: dict) -> dict:
    data = load_prefs()
    data.update(updates)
    PREFS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return load_prefs()

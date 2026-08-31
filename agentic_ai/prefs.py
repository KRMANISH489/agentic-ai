from __future__ import annotations

import json
from pathlib import Path

from agentic_ai.config import ROOT_DIR

PREFS_PATH = ROOT_DIR / "settings.json"
PLAYBOOK_PATH = ROOT_DIR / "IT_Teach_Playbook.txt"
PLAYBOOK_ID = "it-teach-playbook"
PLAYBOOK_BRIEF = (
    "IT tutor style (always follow): start with a short daily-life analogy, then the plain meaning, "
    "then working code in markdown. Vs questions get a real markdown table with a | --- | separator "
    "plus code that uses both. If they wrote Hindi or Hinglish, explain in simple Hindi; keep code in English. "
    "Use one language of code unless they asked for more. Do not call tools for textbook IT."
)
APP_VERSION = "1.7.0"

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


def builtin_playbook() -> dict | None:
    if not PLAYBOOK_PATH.exists():
        return None
    try:
        text = PLAYBOOK_PATH.read_text(encoding="utf-8").strip()[:12000]
    except OSError:
        return None
    if not text:
        return None
    return {
        "id": PLAYBOOK_ID,
        "title": "IT Teach Playbook",
        "text": text,
        "builtin": True,
    }


def _is_playbook_note(item: dict) -> bool:
    if str(item.get("id") or "") == PLAYBOOK_ID:
        return True
    title = str(item.get("title") or "").lower().replace(" ", "")
    return "itteachplaybook" in title or title.startswith("it_teach_playbook")


def merge_teach_notes(notes: list) -> list:
    book = builtin_playbook()
    rest = [item for item in notes if isinstance(item, dict) and not _is_playbook_note(item)]
    if not book:
        return rest[:5]
    return [book] + rest[:4]


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
    data["teach_notes"] = merge_teach_notes(cleaned)
    if data.get("default_mode") not in {"agent", "crew"}:
        data["default_mode"] = "agent"
    return data


def save_prefs(updates: dict) -> dict:
    data = load_prefs()
    data.update(updates)
    notes = data.get("teach_notes") or []
    if isinstance(notes, list):
        data["teach_notes"] = [item for item in notes if isinstance(item, dict) and not _is_playbook_note(item)][:5]
    PREFS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return load_prefs()

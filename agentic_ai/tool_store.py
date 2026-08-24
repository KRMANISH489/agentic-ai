from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from agentic_ai.config import ROOT_DIR
from agentic_ai.tools import Tool, builtin_tools

STORE_PATH = ROOT_DIR / "installed_tools.json"

BUILTIN_CATALOG = [
    {
        "name": "calculator",
        "title": "Calculator",
        "description": "Solve math expressions.",
    },
    {
        "name": "current_time",
        "title": "Current time",
        "description": "Get date and time by timezone.",
    },
    {
        "name": "weather",
        "title": "Weather",
        "description": "Live weather for a city.",
    },
    {
        "name": "web_search",
        "title": "Web search",
        "description": "Search the public web.",
    },
    {
        "name": "wikipedia_summary",
        "title": "Wikipedia",
        "description": "Short Wikipedia summaries.",
    },
    {
        "name": "notes_write",
        "title": "Notes",
        "description": "Save markdown notes locally.",
    },
]

_DEFAULT_ENABLED = {item["name"] for item in BUILTIN_CATALOG}


def _empty_store() -> dict[str, Any]:
    return {"enabled": sorted(_DEFAULT_ENABLED), "custom": []}


def load_store() -> dict[str, Any]:
    if not STORE_PATH.exists():
        return _empty_store()
    try:
        data = json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return _empty_store()
    enabled = data.get("enabled")
    custom = data.get("custom")
    if not isinstance(enabled, list):
        enabled = sorted(_DEFAULT_ENABLED)
    if not isinstance(custom, list):
        custom = []
    return {"enabled": [str(x) for x in enabled], "custom": custom}


def save_store(store: dict[str, Any]) -> None:
    STORE_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")


def sanitize_name(name: str) -> str:
    cleaned = re.sub(r"[^a-z0-9_]", "_", name.strip().lower())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    if not cleaned or cleaned[0].isdigit():
        raise ValueError("Tool name must start with a letter.")
    return cleaned[:40]


def _validate_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("URL must start with http:// or https://")
    return url.strip()


def list_tools() -> dict[str, Any]:
    store = load_store()
    enabled = set(store["enabled"])
    builtin = [
        {**item, "kind": "builtin", "installed": item["name"] in enabled}
        for item in BUILTIN_CATALOG
    ]
    custom = [
        {
            "name": item.get("name"),
            "title": item.get("name"),
            "description": item.get("description") or "",
            "url": item.get("url") or "",
            "kind": "custom",
            "installed": True,
        }
        for item in store["custom"]
        if item.get("name")
    ]
    return {"builtin": builtin, "custom": custom}


def set_builtin_installed(name: str, installed: bool) -> dict[str, Any]:
    names = {item["name"] for item in BUILTIN_CATALOG}
    if name not in names:
        raise ValueError(f"Unknown built-in tool: {name}")
    store = load_store()
    enabled = set(store["enabled"])
    if installed:
        enabled.add(name)
    else:
        enabled.discard(name)
    store["enabled"] = sorted(enabled)
    save_store(store)
    return list_tools()


def install_custom_tool(name: str, description: str, url: str) -> dict[str, Any]:
    tool_name = sanitize_name(name)
    if tool_name in {item["name"] for item in BUILTIN_CATALOG}:
        raise ValueError("That name is already used by a built-in tool.")
    safe_url = _validate_url(url)
    desc = description.strip() or f"Call {safe_url}"
    store = load_store()
    custom = [item for item in store["custom"] if item.get("name") != tool_name]
    custom.append({"name": tool_name, "description": desc, "url": safe_url})
    store["custom"] = custom
    save_store(store)
    return list_tools()


def uninstall_custom_tool(name: str) -> dict[str, Any]:
    store = load_store()
    store["custom"] = [item for item in store["custom"] if item.get("name") != name]
    save_store(store)
    return list_tools()


def _http_tool(spec: dict[str, Any]) -> Tool:
    name = spec["name"]
    url_template = spec["url"]
    description = spec.get("description") or f"GET {url_template}"
    needs_query = "{query}" in url_template

    def handler(query: str = "") -> str:
        target = url_template.replace("{query}", quote(query))
        _validate_url(target)
        request = Request(target, headers={"User-Agent": "AgenticAI/1.0"})
        with urlopen(request, timeout=20) as response:  # noqa: S310 - user-installed HTTP tool
            body = response.read(8000).decode("utf-8", errors="replace")
        return body[:4000]

    parameters: dict[str, Any] = {"type": "object", "properties": {}}
    if needs_query:
        parameters["properties"]["query"] = {
            "type": "string",
            "description": "Value inserted into the tool URL",
        }
        parameters["required"] = ["query"]
    return Tool(name=name, description=description, parameters=parameters, handler=handler)


def resolve_tools(selected: list[str] | None = None) -> list[Tool]:
    store = load_store()
    enabled = set(selected if selected is not None else store["enabled"])
    builtins = [tool for tool in builtin_tools() if tool.name in enabled]
    custom = [
        _http_tool(item)
        for item in store["custom"]
        if item.get("name") and (selected is None or item["name"] in enabled or selected is not None and item["name"] in enabled)
    ]
    # Always include installed custom tools unless explicitly filtered out
    if selected is None:
        custom = [_http_tool(item) for item in store["custom"] if item.get("name")]
    else:
        wanted = set(selected)
        custom = [
            _http_tool(item)
            for item in store["custom"]
            if item.get("name") in wanted
        ]
        builtins = [tool for tool in builtin_tools() if tool.name in wanted]
    return builtins + custom

from __future__ import annotations

import ast
import json
import math
import operator
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Callable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

try:
    import tzdata  # noqa: F401 - IANA timezone database (needed on Windows)
except ImportError:
    tzdata = None

from ddgs import DDGS

from agentic_ai.config import ROOT_DIR
from agentic_ai.sandbox import code_run

NOTES_DIR = ROOT_DIR / "workspace_notes"


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]
    handler: Callable[..., str]

    def schema(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class ToolRegistry:
    def __init__(self, tools: list[Tool]) -> None:
        self._tools = {tool.name: tool for tool in tools}

    def schemas(self) -> list[dict[str, Any]]:
        return [tool.schema() for tool in self._tools.values()]

    def run(self, name: str, arguments_json: str) -> str:
        tool = self._tools.get(name)
        if tool is None:
            return f"Unknown tool: {name}"
        try:
            args = json.loads(arguments_json or "{}")
            if not isinstance(args, dict):
                return "Tool arguments must be a JSON object."
            return str(tool.handler(**args))
        except Exception as exc:  # noqa: BLE001 - surface tool errors to the agent
            return f"Tool error ({name}): {exc}"


_SAFE_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def _eval_math(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _eval_math(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return float(node.value)
    if isinstance(node, ast.BinOp) and type(node.op) in _SAFE_OPS:
        return _SAFE_OPS[type(node.op)](_eval_math(node.left), _eval_math(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _SAFE_OPS:
        return _SAFE_OPS[type(node.op)](_eval_math(node.operand))
    raise ValueError("Only +, -, *, /, //, %, ** and numbers are allowed.")


def calculator(expression: str) -> str:
    tree = ast.parse(expression, mode="eval")
    value = _eval_math(tree)
    if math.isfinite(value) and float(value).is_integer():
        return str(int(value))
    return str(value)


_TZ_ALIASES = {
    "ist": "Asia/Kolkata",
    "india": "Asia/Kolkata",
    "est": "America/New_York",
    "edt": "America/New_York",
    "et": "America/New_York",
    "new york": "America/New_York",
    "nyc": "America/New_York",
    "pst": "America/Los_Angeles",
    "pdt": "America/Los_Angeles",
    "utc": "UTC",
    "gmt": "UTC",
}


def current_time(timezone: str = "Asia/Kolkata") -> str:
    raw = (timezone or "Asia/Kolkata").strip()
    tz_name = _TZ_ALIASES.get(raw.lower().replace("_", " "), raw)
    tz_name = _TZ_ALIASES.get(tz_name.lower(), tz_name)
    try:
        now = datetime.now(ZoneInfo(tz_name))
        return now.strftime("%Y-%m-%d %H:%M:%S %Z")
    except ZoneInfoNotFoundError:
        now = datetime.now().astimezone()
        return (
            f"{now.strftime('%Y-%m-%d %H:%M:%S %Z')} "
            f"(local fallback; timezone {raw!r} is not installed)"
        )


def weather(location: str) -> str:
    from urllib.parse import quote
    from urllib.request import Request, urlopen

    loc = quote(location.strip())
    url = f"https://wttr.in/{loc}?format=j1"
    request = Request(url, headers={"User-Agent": "AgenticAI/1.0"})
    with urlopen(request, timeout=20) as response:  # noqa: S310 - public weather API
        data = json.loads(response.read().decode("utf-8"))
    current = (data.get("current_condition") or [{}])[0]
    area = (data.get("nearest_area") or [{}])[0]
    place = (area.get("areaName") or [{}])[0].get("value") or location
    country = (area.get("country") or [{}])[0].get("value") or ""
    desc = (current.get("weatherDesc") or [{}])[0].get("value") or "Unknown"
    place_label = f"{place}, {country}".strip(", ")
    return (
        f"Weather in {place_label}: {desc.strip()}. "
        f"{current.get('temp_C')}°C ({current.get('temp_F')}°F), "
        f"feels like {current.get('FeelsLikeC')}°C, "
        f"humidity {current.get('humidity')}%, "
        f"wind {current.get('windspeedKmph')} km/h. "
        f"Observed at {current.get('observation_time')}."
    )


def web_search(query: str, max_results: int = 5) -> str:
    results = []
    with DDGS() as ddgs:
        for item in ddgs.text(query, max_results=max_results):
            results.append(
                {
                    "title": item.get("title"),
                    "url": item.get("href"),
                    "snippet": item.get("body"),
                }
            )
    if not results:
        return "No search results found."
    lines = []
    for index, item in enumerate(results, start=1):
        lines.append(
            f"{index}. {item.get('title') or 'Result'}\n"
            f"   {item.get('snippet') or ''}\n"
            f"   Source: {item.get('url') or ''}"
        )
    return "\n\n".join(lines)


def wikipedia_summary(topic: str) -> str:
    from urllib.parse import quote
    from urllib.request import Request, urlopen

    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(topic)}"
    request = Request(url, headers={"User-Agent": "AgenticAI/1.0 (learning project)"})
    with urlopen(request, timeout=15) as response:  # noqa: S310 - public Wikipedia API
        data = json.loads(response.read().decode("utf-8"))
    extract = data.get("extract") or "No summary available."
    page_url = data.get("content_urls", {}).get("desktop", {}).get("page", "")
    return f"{extract}\n\nSource: {page_url}".strip()


def notes_write(filename: str, content: str) -> str:
    safe_name = filename.replace("\\", "/").split("/")[-1].strip() or "note.md"
    if not safe_name.endswith(".md"):
        safe_name += ".md"
    NOTES_DIR.mkdir(parents=True, exist_ok=True)
    path = NOTES_DIR / safe_name
    path.write_text(content, encoding="utf-8")
    return f"Saved notes to {safe_name}. The user can open it in Notes."


def notes_dir() -> Path:
    NOTES_DIR.mkdir(parents=True, exist_ok=True)
    return NOTES_DIR


def list_notes() -> list[dict[str, Any]]:
    folder = notes_dir()
    items = []
    for path in sorted(folder.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True):
        stat = path.stat()
        items.append(
            {
                "name": path.name,
                "chars": stat.st_size,
                "updated": int(stat.st_mtime * 1000),
            }
        )
    return items


def read_note(name: str) -> str:
    safe = Path(name).name
    path = notes_dir() / safe
    if not path.exists() or path.suffix.lower() != ".md":
        raise FileNotFoundError(safe)
    return path.read_text(encoding="utf-8")


def delete_note(name: str) -> None:
    safe = Path(name).name
    path = notes_dir() / safe
    if not path.exists() or path.suffix.lower() != ".md":
        raise FileNotFoundError(safe)
    path.unlink()


def dice_roll(sides: int = 6, count: int = 1) -> str:
    import random

    sides = max(2, min(100, int(sides)))
    count = max(1, min(20, int(count)))
    rolls = [random.randint(1, sides) for _ in range(count)]
    return f"Rolled {count}d{sides}: {rolls} (total {sum(rolls)})"


def unit_convert(value: float, from_unit: str, to_unit: str) -> str:
    table = {
        ("km", "mi"): 0.621371,
        ("mi", "km"): 1.60934,
        ("kg", "lb"): 2.20462,
        ("lb", "kg"): 0.453592,
        ("c", "f"): None,
        ("f", "c"): None,
        ("m", "ft"): 3.28084,
        ("ft", "m"): 0.3048,
    }
    src = from_unit.strip().lower().replace("°", "")
    dst = to_unit.strip().lower().replace("°", "")
    if src == "c" and dst == "f":
        return f"{value}°C = {value * 9 / 5 + 32:.2f}°F"
    if src == "f" and dst == "c":
        return f"{value}°F = {(value - 32) * 5 / 9:.2f}°C"
    factor = table.get((src, dst))
    if factor is None:
        return "Supported units: km/mi, kg/lb, m/ft, C/F."
    return f"{value} {src} = {value * factor:.4f} {dst}"


def text_stats(text: str) -> str:
    words = text.split()
    return (
        f"Characters: {len(text)}\n"
        f"Words: {len(words)}\n"
        f"Lines: {text.count(chr(10)) + 1}"
    )


def uuid_generate(count: int = 1) -> str:
    import uuid as uuid_lib

    count = max(1, min(10, int(count)))
    return "\n".join(str(uuid_lib.uuid4()) for _ in range(count))


def random_pick(options: str) -> str:
    import random

    parts = [part.strip() for part in options.replace(";", ",").split(",") if part.strip()]
    if not parts:
        return "Provide comma-separated options."
    return f"Picked: {random.choice(parts)}"


def github_lookup(query: str) -> str:
    from urllib.parse import quote
    from urllib.request import Request, urlopen

    raw = query.strip().lstrip("@")
    if not raw:
        return "Provide a GitHub username or owner/repo, e.g. torvalds or vercel/next.js"
    if raw.count("/") == 1:
        owner, repo = raw.split("/", 1)
        url = f"https://api.github.com/repos/{quote(owner)}/{quote(repo)}"
        kind = "repo"
    else:
        url = f"https://api.github.com/users/{quote(raw)}"
        kind = "user"
    request = Request(url, headers={"User-Agent": "AgenticAI/1.3", "Accept": "application/vnd.github+json"})
    try:
        with urlopen(request, timeout=20) as response:  # noqa: S310 - public GitHub API
            data = json.loads(response.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        return f"GitHub lookup failed: {exc}"
    if kind == "user":
        return (
            f"GitHub user: {data.get('name') or data.get('login')}\n"
            f"Username: @{data.get('login')}\n"
            f"Bio: {data.get('bio') or '—'}\n"
            f"Company: {data.get('company') or '—'}\n"
            f"Location: {data.get('location') or '—'}\n"
            f"Public repos: {data.get('public_repos')}\n"
            f"Followers: {data.get('followers')} · Following: {data.get('following')}\n"
            f"Profile: {data.get('html_url')}"
        )
    return (
        f"Repository: {data.get('full_name')}\n"
        f"Description: {data.get('description') or '—'}\n"
        f"Language: {data.get('language') or '—'}\n"
        f"Stars: {data.get('stargazers_count')} · Forks: {data.get('forks_count')}\n"
        f"Open issues: {data.get('open_issues_count')}\n"
        f"License: {(data.get('license') or {}).get('spdx_id') or '—'}\n"
        f"Updated: {data.get('updated_at')}\n"
        f"URL: {data.get('html_url')}"
    )


TOOL_CATALOG = [
    {"id": "web_search", "title": "Web Search", "blurb": "Search the live web for news, prices, and facts.", "category": "Research", "core": True, "icon": "search"},
    {"id": "wikipedia_summary", "title": "Wikipedia", "blurb": "Fetch a short encyclopedia summary.", "category": "Research", "core": True, "icon": "wiki"},
    {"id": "weather", "title": "Weather", "blurb": "Current weather for any city.", "category": "Research", "core": True, "icon": "weather"},
    {"id": "github", "title": "GitHub", "blurb": "Look up a GitHub user or repository.", "category": "Research", "core": False, "icon": "github"},
    {"id": "calculator", "title": "Calculator", "blurb": "Safe arithmetic for exact numbers.", "category": "Utilities", "core": True, "icon": "calc"},
    {"id": "current_time", "title": "Clock", "blurb": "Date and time in any timezone.", "category": "Utilities", "core": True, "icon": "clock"},
    {"id": "notes_write", "title": "Notes", "blurb": "Save markdown notes you can open in Notes.", "category": "Utilities", "core": True, "icon": "notes"},
    {"id": "code_run", "title": "Code sandbox", "blurb": "Run short Python in a locked-down sandbox.", "category": "Utilities", "core": True, "icon": "code"},
    {"id": "dice_roll", "title": "Dice", "blurb": "Roll dice, like 2d6 or 1d20.", "category": "Extras", "core": False, "icon": "dice"},
    {"id": "unit_convert", "title": "Unit Convert", "blurb": "Convert km/mi, kg/lb, m/ft, C/F.", "category": "Extras", "core": False, "icon": "convert"},
    {"id": "text_stats", "title": "Text Stats", "blurb": "Count characters, words, and lines.", "category": "Extras", "core": False, "icon": "text"},
    {"id": "uuid_generate", "title": "UUID", "blurb": "Generate random unique IDs.", "category": "Extras", "core": False, "icon": "key"},
    {"id": "random_pick", "title": "Random Pick", "blurb": "Choose one item from a list.", "category": "Extras", "core": False, "icon": "shuffle"},
]


def builtin_tools() -> list[Tool]:
    return [
        Tool(
            name="calculator",
            description="Evaluate a safe arithmetic expression. Use for any numeric calculation.",
            parameters={
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "Math expression, e.g. '(25 * 4) + 10'",
                    }
                },
                "required": ["expression"],
            },
            handler=calculator,
        ),
        Tool(
            name="current_time",
            description="Get the current date and time in a timezone (IANA name like America/New_York or Asia/Kolkata).",
            parameters={
                "type": "object",
                "properties": {
                    "timezone": {
                        "type": "string",
                        "description": "IANA timezone, default Asia/Kolkata",
                    }
                },
            },
            handler=current_time,
        ),
        Tool(
            name="weather",
            description="Get current weather for a city or location. Use this instead of web_search for weather questions.",
            parameters={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City name, e.g. New York or Mumbai",
                    }
                },
                "required": ["location"],
            },
            handler=weather,
        ),
        Tool(
            name="web_search",
            description="Search the public web. You MUST pass query as a string, e.g. {\"query\": \"today gold price\"}.",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Required search text, e.g. today gold price India",
                    }
                },
                "required": ["query"],
                "additionalProperties": False,
            },
            handler=web_search,
        ),
        Tool(
            name="wikipedia_summary",
            description="Fetch a short Wikipedia summary for a topic.",
            parameters={
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "description": "Article title or topic"}
                },
                "required": ["topic"],
            },
            handler=wikipedia_summary,
        ),
        Tool(
            name="notes_write",
            description="Save a markdown note locally in workspace_notes/.",
            parameters={
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "File name, e.g. research.md"},
                    "content": {"type": "string", "description": "Markdown content to save"},
                },
                "required": ["filename", "content"],
            },
            handler=notes_write,
        ),
        Tool(
            name="code_run",
            description="Run short Python in a sandbox (math/json/re/datetime only, no files or network). Print the result.",
            parameters={
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Python source to execute. Use print() to show output.",
                    }
                },
                "required": ["code"],
            },
            handler=code_run,
        ),
        Tool(
            name="dice_roll",
            description="Roll dice. Use sides=6 count=2 for 2d6.",
            parameters={
                "type": "object",
                "properties": {
                    "sides": {"type": "integer", "description": "Faces per die, default 6"},
                    "count": {"type": "integer", "description": "How many dice, default 1"},
                },
            },
            handler=dice_roll,
        ),
        Tool(
            name="unit_convert",
            description="Convert a number between units: km/mi, kg/lb, m/ft, C/F.",
            parameters={
                "type": "object",
                "properties": {
                    "value": {"type": "number", "description": "Number to convert"},
                    "from_unit": {"type": "string", "description": "Source unit, e.g. km or C"},
                    "to_unit": {"type": "string", "description": "Target unit, e.g. mi or F"},
                },
                "required": ["value", "from_unit", "to_unit"],
            },
            handler=unit_convert,
        ),
        Tool(
            name="text_stats",
            description="Count characters, words, and lines in text.",
            parameters={
                "type": "object",
                "properties": {"text": {"type": "string", "description": "Text to analyze"}},
                "required": ["text"],
            },
            handler=text_stats,
        ),
        Tool(
            name="uuid_generate",
            description="Generate one or more random UUIDs.",
            parameters={
                "type": "object",
                "properties": {"count": {"type": "integer", "description": "How many IDs, 1-10"}},
            },
            handler=uuid_generate,
        ),
        Tool(
            name="random_pick",
            description="Pick one option from a comma-separated list.",
            parameters={
                "type": "object",
                "properties": {
                    "options": {"type": "string", "description": "Comma-separated choices"}
                },
                "required": ["options"],
            },
            handler=random_pick,
        ),
        Tool(
            name="github",
            description="Look up a public GitHub user or repository. Pass query as a username (torvalds) or owner/repo (vercel/next.js).",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "GitHub username or owner/repo",
                    }
                },
                "required": ["query"],
            },
            handler=github_lookup,
        ),
    ]


def tools_by_names(names: list[str]) -> list[Tool]:
    available = {tool.name: tool for tool in builtin_tools()}
    selected = [available[name] for name in names if name in available]
    return selected or [available[name] for name in ("calculator", "current_time") if name in available]

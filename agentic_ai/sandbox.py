from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

MAX_CODE = 12_000
TIMEOUT_SEC = 6
MAX_OUTPUT = 8_000

_RUNNER = r"""
import json, sys, math, re, datetime, statistics, random, itertools, collections, decimal, fractions, textwrap

ALLOWED = {
    "math": math,
    "json": json,
    "re": re,
    "datetime": datetime,
    "statistics": statistics,
    "random": random,
    "itertools": itertools,
    "collections": collections,
    "decimal": decimal,
    "fractions": fractions,
    "textwrap": textwrap,
}

def _safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    root = name.split(".")[0]
    if root not in ALLOWED:
        raise ImportError(f"Sandbox blocked import: {name}")
    return ALLOWED[root]

SAFE = {
    "abs": abs, "all": all, "any": any, "bin": bin, "bool": bool, "bytearray": bytearray,
    "bytes": bytes, "chr": chr, "complex": complex, "dict": dict, "divmod": divmod,
    "enumerate": enumerate, "filter": filter, "float": float, "format": format,
    "frozenset": frozenset, "hash": hash, "hex": hex, "int": int, "isinstance": isinstance,
    "issubclass": issubclass, "iter": iter, "len": len, "list": list, "map": map,
    "max": max, "min": min, "next": next, "oct": oct, "ord": ord, "pow": pow,
    "print": print, "range": range, "repr": repr, "reversed": reversed, "round": round,
    "set": set, "slice": slice, "sorted": sorted, "str": str, "sum": sum, "tuple": tuple,
    "type": type, "zip": zip, "True": True, "False": False, "None": None,
    "Exception": Exception, "ValueError": ValueError, "TypeError": TypeError,
    "__import__": _safe_import,
}
SAFE.update(ALLOWED)
code = json.loads(sys.stdin.read())
exec(compile(code, "<sandbox>", "exec"), {"__builtins__": SAFE}, SAFE)
"""


def code_run(code: str) -> str:
    source = (code or "").strip()
    if not source:
        return "No code to run."
    if len(source) > MAX_CODE:
        return "Code is too long for the sandbox (12k character limit)."
    lowered = source.lower()
    for bad in ("__subclasses__", "os.system", "subprocess", "socket", "ctypes", "pathlib", "open(", "eval(", "exec("):
        if bad in lowered and bad not in ("eval(", "exec("):
            return f"Sandbox blocked that pattern: {bad}"
        if bad in {"eval(", "exec("} and bad in lowered:
            return "Sandbox blocked eval/exec."
    env = {"PATH": os.environ.get("PATH", ""), "PYTHONIOENCODING": "utf-8"}
    kwargs: dict = {
        "input": json.dumps(source),
        "capture_output": True,
        "text": True,
        "timeout": TIMEOUT_SEC,
        "cwd": str(Path(os.environ.get("TEMP") or os.environ.get("TMP") or ".")),
        "env": env,
    }
    if os.name == "nt":
        kwargs["creationflags"] = 0x08000000
    try:
        proc = subprocess.run([sys.executable, "-I", "-c", _RUNNER], **kwargs)
    except subprocess.TimeoutExpired:
        return "Sandbox timed out after 6 seconds."
    except Exception as exc:
        return f"Sandbox failed: {exc}"
    out = ((proc.stdout or "") + (("\n" + proc.stderr) if proc.stderr else "")).strip()
    if len(out) > MAX_OUTPUT:
        out = out[:MAX_OUTPUT] + "\n[truncated]"
    if proc.returncode != 0:
        return out or f"Sandbox exited with code {proc.returncode}."
    return out or "(ran with no output — print() the result)"

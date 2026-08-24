from __future__ import annotations

import json
import os
import queue
import threading
import webbrowser
from pathlib import Path
from urllib.parse import quote

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agentic_ai.auth import (
    clear_user_cookie,
    finish_github,
    finish_google,
    github_authorize_url,
    google_authorize_url,
    oauth_status,
    read_user,
    require_user,
    save_oauth_keys,
    set_user_cookie,
    _set_state,
)
from agentic_ai.agent import Agent
from agentic_ai.config import load_settings, save_groq_key
from agentic_ai.crew import Crew
from agentic_ai.prefs import APP_VERSION, load_prefs, save_prefs
from agentic_ai.tools import TOOL_CATALOG

STATIC_DIR = Path(__file__).parent / "static"
def _cors_origins() -> list[str]:
    origins = {
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    }
    front = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if front:
        origins.add(front)
    for item in os.getenv("CORS_ORIGINS", "").split(","):
        cleaned = item.strip().rstrip("/")
        if cleaned:
            origins.add(cleaned)
    return list(origins)


app = FastAPI(title="Agentic AI")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

_lock = threading.Lock()
_agent: Agent | None = None
_crew: Crew | None = None


class HistoryTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    mode: str = "agent"
    history: list[HistoryTurn] = []


class SetupRequest(BaseModel):
    api_key: str


class PrefsUpdate(BaseModel):
    installed_tools: list[str] | None = None
    max_steps: int | None = None
    temperature: float | None = None
    show_thinking: bool | None = None
    default_mode: str | None = None
    enter_to_send: bool | None = None
    voice_read_aloud: bool | None = None
    voice_auto_send: bool | None = None


class ToolAction(BaseModel):
    name: str


class LocalLogin(BaseModel):
    name: str
    email: str


class OAuthKeys(BaseModel):
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""


def frontend_origin() -> str:
    return os.getenv("FRONTEND_URL", "http://127.0.0.1:3000").rstrip("/")


def _oauth_fail(message: str) -> RedirectResponse:
    return RedirectResponse(
        frontend_origin() + "/?oauth_error=" + quote(message),
        status_code=302,
    )


def _status_payload() -> dict:
    prefs = load_prefs()
    payload = {
        "ok": True,
        "provider": None,
        "model": None,
        "error": None,
        "version": APP_VERSION,
        "prefs": prefs,
        "tools": [
            {**item, "installed": item["id"] in prefs["installed_tools"]}
            for item in TOOL_CATALOG
        ],
    }
    try:
        settings = load_settings()
        payload["provider"] = settings.provider
        payload["model"] = settings.model
    except Exception as exc:
        payload["ok"] = False
        payload["error"] = str(exc)
    return payload


def _rebuild_agents() -> None:
    global _agent, _crew
    _agent = None
    _crew = None


def _get_runner(mode: str, on_trace, user: dict | None = None):
    global _agent, _crew
    if mode == "crew":
        if _crew is None:
            _crew = Crew(on_trace=on_trace)
        else:
            _crew.researcher.on_trace = on_trace
            _crew.writer.on_trace = on_trace
        _crew.apply_user(user)
        return _crew.run
    if _agent is None:
        _agent = Agent(on_trace=on_trace)
    else:
        _agent.on_trace = on_trace
    _agent.apply_user(user)
    return _agent.ask


@app.get("/")
def index() -> RedirectResponse:
    return RedirectResponse(frontend_origin() + "/", status_code=302)


@app.get("/favicon.ico")
def favicon() -> FileResponse:
    return FileResponse(
        STATIC_DIR / "favicon.svg",
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/me")
def me(request: Request) -> dict:
    return {"user": read_user(request), "oauth": oauth_status()}


@app.post("/api/auth/local")
def auth_local(req: LocalLogin):
    name = req.name.strip()
    email = req.email.strip()
    if len(name) < 2 or "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Enter your name and a valid email.")
    user = {"provider": "local", "name": name, "email": email, "picture": ""}
    response = JSONResponse({"ok": True, "user": user})
    set_user_cookie(response, user)
    return response


@app.post("/api/auth/keys")
def auth_keys(req: OAuthKeys) -> dict:
    status = save_oauth_keys(req.model_dump())
    return {"ok": True, "oauth": status}


@app.get("/auth/google")
def auth_google(request: Request):
    if not oauth_status()["google"]:
        return RedirectResponse(frontend_origin() + "/", status_code=302)
    url, state = google_authorize_url(request)
    response = RedirectResponse(url, status_code=302)
    _set_state(response, state)
    return response


@app.get("/auth/github")
def auth_github(request: Request):
    if not oauth_status()["github"]:
        return RedirectResponse(frontend_origin() + "/", status_code=302)
    url, state = github_authorize_url(request)
    response = RedirectResponse(url, status_code=302)
    _set_state(response, state)
    return response


@app.get("/auth/google/callback")
def auth_google_callback(request: Request, code: str = "", state: str = ""):
    try:
        user = finish_google(request, code, state)
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else "Google login failed."
        return _oauth_fail(detail)
    except Exception:
        return _oauth_fail("Google login failed. Check the Client Secret and redirect URI.")
    response = RedirectResponse(frontend_origin() + "/", status_code=302)
    set_user_cookie(response, user)
    response.delete_cookie("oauth_state", path="/")
    return response


@app.get("/auth/github/callback")
def auth_github_callback(request: Request, code: str = "", state: str = ""):
    try:
        user = finish_github(request, code, state)
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else "GitHub login failed."
        return _oauth_fail(detail)
    except Exception:
        return _oauth_fail("GitHub login failed. Check the Client ID, secret, and callback URL.")
    response = RedirectResponse(frontend_origin() + "/", status_code=302)
    set_user_cookie(response, user)
    response.delete_cookie("oauth_state", path="/")
    return response


@app.get("/auth/logout")
def auth_logout():
    response = RedirectResponse(frontend_origin() + "/", status_code=302)
    clear_user_cookie(response)
    return response


@app.get("/api/status")
def status(user: dict = Depends(require_user)) -> dict:
    payload = _status_payload()
    payload["user"] = user
    return payload


@app.post("/api/reset")
def reset(_user: dict = Depends(require_user)) -> dict:
    global _agent, _crew
    with _lock:
        if _agent is not None:
            _agent.reset()
        if _crew is not None:
            _crew.reset()
    return {"ok": True}


@app.post("/api/setup")
def setup(req: SetupRequest, _user: dict = Depends(require_user)) -> dict:
    global _agent, _crew
    try:
        save_groq_key(req.api_key)
    except Exception as exc:
        return {"ok": False, "provider": None, "model": None, "error": str(exc)}
    with _lock:
        _rebuild_agents()
    return _status_payload()


@app.get("/api/settings")
def get_settings(_user: dict = Depends(require_user)) -> dict:
    return _status_payload()


@app.post("/api/settings")
def update_settings(req: PrefsUpdate, _user: dict = Depends(require_user)) -> dict:
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    save_prefs(updates)
    with _lock:
        _rebuild_agents()
    return _status_payload()


@app.post("/api/tools/install")
def install_tool(req: ToolAction, _user: dict = Depends(require_user)) -> dict:
    prefs = load_prefs()
    tools = list(prefs["installed_tools"])
    if req.name not in tools:
        tools.append(req.name)
    save_prefs({"installed_tools": tools})
    with _lock:
        _rebuild_agents()
    return _status_payload()


@app.post("/api/tools/uninstall")
def uninstall_tool(req: ToolAction, _user: dict = Depends(require_user)) -> dict:
    prefs = load_prefs()
    tools = [name for name in prefs["installed_tools"] if name != req.name]
    if not tools:
        tools = ["calculator"]
    save_prefs({"installed_tools": tools})
    with _lock:
        _rebuild_agents()
    return _status_payload()


@app.post("/api/chat")
def chat(req: ChatRequest, user: dict = Depends(require_user)) -> StreamingResponse:
    events: queue.Queue[dict | None] = queue.Queue()

    def on_trace(line: str) -> None:
        events.put({"type": "trace", "content": line})

    def worker() -> None:
        try:
            with _lock:
                runner = _get_runner(req.mode, on_trace, user)
                transcript = [{"role": t.role, "content": t.content} for t in req.history]
                if req.mode == "crew" and _crew is not None:
                    _crew.researcher.load_transcript(transcript)
                    _crew.writer.reset()
                elif _agent is not None:
                    _agent.load_transcript(transcript)
                answer = runner(req.message.strip())
            events.put({"type": "answer", "content": answer})
        except Exception as exc:
            events.put({"type": "error", "content": str(exc)})
        finally:
            events.put(None)

    threading.Thread(target=worker, daemon=True).start()

    def stream():
        while True:
            item = events.get()
            if item is None:
                yield "data: {\"type\": \"done\"}\n\n"
                break
            yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


def main() -> None:
    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("API_PORT", os.getenv("PORT", "7860")))
    open_browser = os.getenv("OPEN_BROWSER", "1").lower() not in {"0", "false", "no"}
    if open_browser and host in {"127.0.0.1", "localhost"}:
        url = os.getenv("FRONTEND_URL", "http://127.0.0.1:3000")
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()

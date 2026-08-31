from __future__ import annotations

import json
import os
import queue
import threading
import uuid
import webbrowser
from pathlib import Path
from urllib.parse import quote, urlparse

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
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
from agentic_ai.canva import (
    app_configured as canva_app_configured,
    authorize_url as canva_authorize_url,
    bind_user as bind_canva_user,
    disconnect as canva_disconnect,
    finish_connect as canva_finish,
    list_designs as canva_list_designs,
    save_app_keys as save_canva_keys,
    set_pkce_cookie,
    status_for as canva_status_for,
)
from agentic_ai.config import load_settings, save_groq_key
from agentic_ai.crew import Crew
from agentic_ai.files import FileExtractError, extract_bytes
from agentic_ai.prefs import APP_VERSION, load_prefs, save_prefs
from agentic_ai.tools import TOOL_CATALOG, delete_note, list_notes, read_note

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


class ProjectFileIn(BaseModel):
    title: str = ""
    text: str = ""


class ChatRequest(BaseModel):
    message: str
    mode: str = "agent"
    history: list[HistoryTurn] = []
    images: list[str] = []
    lang: str = "en"
    focus: str = "chat"
    project_name: str = ""
    project_instructions: str = ""
    project_files: list[ProjectFileIn] = []


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
    teach_instructions: str | None = None
    teach_memory: str | None = None


class TeachForget(BaseModel):
    id: str


class ToolAction(BaseModel):
    name: str


class LocalLogin(BaseModel):
    name: str
    email: str


class CanvaKeys(BaseModel):
    client_id: str = ""
    client_secret: str = ""


def _is_loopback_host(host: str | None) -> bool:
    return (host or "").lower() in {"127.0.0.1", "localhost", "::1"}


def frontend_origin() -> str:
    raw = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
    if not raw or raw == "/":
        raw = (os.getenv("AUTH_BASE_URL") or "").strip().rstrip("/")
    if not raw or raw == "/":
        if os.getenv("VERCEL"):
            return ""
        raw = "http://127.0.0.1:3000"
    return raw


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
    bind_canva_user(str((user or {}).get("email") or ""))
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
def index(request: Request):
    dest = frontend_origin() + "/"
    parsed = urlparse(dest)
    here = (request.url.hostname or "").lower()
    dest_host = (parsed.hostname or "").lower()
    # Empty FRONTEND_URL used to redirect to "/" and loop (ERR_TOO_MANY_REDIRECTS on Vercel).
    same_host = dest in {"/", ""} or (
        parsed.path in {"", "/"} and (not dest_host or dest_host == here)
    )
    # Live hosts must not send the browser to a local Next.js server.
    public_to_local = _is_loopback_host(dest_host) and not _is_loopback_host(here)
    if same_host or public_to_local:
        return JSONResponse(
            {
                "ok": True,
                "app": "Agentic AI",
                "version": APP_VERSION,
                "hint": "API is running. This app needs the Next.js UI plus FastAPI. Vercel cannot run both. Use Render Docker (free) or set FRONTEND_URL to a different UI host.",
            }
        )
    return RedirectResponse(dest, status_code=302)


@app.get("/favicon.ico")
def favicon() -> FileResponse:
    return FileResponse(
        STATIC_DIR / "favicon.png",
        media_type="image/png",
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
    payload["canva"] = canva_status_for(user)
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


@app.post("/api/extract")
async def extract_upload(file: UploadFile = File(...), _user: dict = Depends(require_user)) -> dict:
    data = await file.read()
    name = file.filename or "file"
    try:
        text = extract_bytes(name, data)
    except FileExtractError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read that file: {exc}") from exc
    return {"name": name, "text": text, "chars": len(text)}


@app.post("/api/teach/file")
async def teach_upload(file: UploadFile = File(...), _user: dict = Depends(require_user)) -> dict:
    data = await file.read()
    name = file.filename or "file"
    try:
        text = extract_bytes(name, data)
    except FileExtractError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read that file: {exc}") from exc
    prefs = load_prefs()
    notes = list(prefs.get("teach_notes") or [])
    notes.append({"id": str(uuid.uuid4()), "title": Path(name).name[:80], "text": text[:12000]})
    notes = [item for item in notes if str(item.get("id")) != "it-teach-playbook"]
    save_prefs({"teach_notes": notes[-5:]})
    with _lock:
        _rebuild_agents()
    return _status_payload()


@app.post("/api/teach/forget")
def teach_forget(req: TeachForget, _user: dict = Depends(require_user)) -> dict:
    if req.id == "it-teach-playbook":
        return _status_payload()
    prefs = load_prefs()
    notes = [item for item in (prefs.get("teach_notes") or []) if str(item.get("id")) != req.id]
    save_prefs({"teach_notes": notes})
    with _lock:
        _rebuild_agents()
    return _status_payload()


@app.get("/api/notes")
def notes_index(_user: dict = Depends(require_user)) -> dict:
    return {"notes": list_notes()}


@app.get("/api/notes/{name}")
def notes_get(name: str, _user: dict = Depends(require_user)) -> dict:
    try:
        return {"name": Path(name).name, "content": read_note(name)}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Note not found.") from None


@app.delete("/api/notes/{name}")
def notes_delete(name: str, _user: dict = Depends(require_user)) -> dict:
    try:
        delete_note(name)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Note not found.") from None
    return {"ok": True, "notes": list_notes()}


def _project_note(req: ChatRequest) -> str:
    parts: list[str] = []
    name = (req.project_name or "").strip()
    instructions = (req.project_instructions or "").strip()
    files = req.project_files or []
    if name:
        parts.append(f"Active project: {name[:80]}")
    if instructions:
        parts.append("Project instructions:\n" + instructions[:4000])
    for item in files[:8]:
        title = (item.title or "file").strip()[:80]
        text = (item.text or "").strip()
        if text:
            parts.append(f"Project file ({title}):\n{text[:8000]}")
    if not parts:
        return ""
    return "\n\nUse this project context:\n" + "\n\n".join(parts) + "\n"


def _reply_lang_note(lang: str) -> str:
    if lang == "bho":
        return "\n\nReply in Bhojpuri."
    if lang == "hi":
        return "\n\nReply in Hindi."
    return ""


def _work_focus_note(focus: str) -> str:
    if (focus or "").strip().lower() != "code":
        return ""
    return (
        "\n\nCODE MODE is on. This is a coding session, not a lecture.\n"
        "Solve the actual problem with complete, runnable code — no stubs, no '...' holes.\n"
        "Lead with the working solution in markdown fences (correct language tag). "
        "Then a short why, how to run it, and one likely pitfall.\n"
        "If they pasted an error: name the cause in one line, then the fixed code.\n"
        "If they asked to build a webpage, UI, or full file, also put the complete file in an <artifact>.\n"
        "If they did not name a language, pick one sensible stack and ship it "
        "(Python/FastAPI for APIs, HTML+JS for simple web, their language if they named it).\n"
        "Use code_run when a short Python check would verify the answer.\n"
        "Skip long teaching analogies unless they asked to explain/samjhao. "
        "If the request is vague, state one assumption in one line and still deliver working code.\n"
    )


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
                prompt = req.message.strip() + _reply_lang_note(req.lang) + _work_focus_note(req.focus) + _project_note(req)
                photos = [
                    url
                    for url in req.images[:4]
                    if isinstance(url, str) and url.startswith("data:image/") and len(url) < 4_000_000
                ]
                if req.mode == "crew" and _crew is not None:
                    _crew.researcher.load_transcript(transcript)
                    _crew.writer.reset()
                    answer = _crew.run(prompt, images=photos or None)
                elif _agent is not None:
                    _agent.load_transcript(transcript)
                    answer = _agent.ask(prompt, images=photos or None)
                else:
                    answer = runner(prompt)
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

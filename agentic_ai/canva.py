from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import time
from contextvars import ContextVar
from typing import Any

import httpx
from fastapi import HTTPException, Request, Response

from agentic_ai.auth import _cookie_secure, _signer, base_url
from agentic_ai.config import ROOT_DIR, set_env_value

TOKENS_PATH = ROOT_DIR / "canva_tokens.json"
PKCE_COOKIE = "canva_pkce"
AUTH_URL = "https://www.canva.com/api/oauth/authorize"
TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token"
API = "https://api.canva.com/rest/v1"
SCOPES = "design:meta:read profile:read"
_current_email: ContextVar[str] = ContextVar("canva_email", default="")


def bind_user(email: str) -> None:
    _current_email.set((email or "").strip().lower())


def app_configured() -> bool:
    return bool(os.getenv("CANVA_CLIENT_ID", "").strip() and os.getenv("CANVA_CLIENT_SECRET", "").strip())


def save_app_keys(client_id: str, client_secret: str) -> dict:
    cid = (client_id or "").strip().strip('"').strip("'")
    secret = (client_secret or "").strip().strip('"').strip("'")
    if not cid:
        raise HTTPException(status_code=400, detail="Paste the Canva Client ID.")
    if secret and not secret.startswith("cnvca"):
        raise HTTPException(
            status_code=400,
            detail="That Client Secret looks wrong. In Canva Developers click Generate secret — it starts with cnvca.",
        )
    set_env_value("CANVA_CLIENT_ID", cid)
    if secret:
        set_env_value("CANVA_CLIENT_SECRET", secret)
    if not os.getenv("CANVA_CLIENT_SECRET", "").strip():
        raise HTTPException(status_code=400, detail="Paste the Canva Client Secret (starts with cnvca).")
    return {"ok": True, "app": True}


def redirect_uri(request: Request) -> str:
    return f"{base_url(request)}/auth/canva/callback"


def _load_tokens() -> dict[str, Any]:
    if not TOKENS_PATH.exists():
        return {}
    try:
        data = json.loads(TOKENS_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def _save_tokens(data: dict[str, Any]) -> None:
    TOKENS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def connection(email: str) -> dict[str, Any] | None:
    key = (email or "").strip().lower()
    if not key:
        return None
    item = _load_tokens().get(key)
    return item if isinstance(item, dict) and item.get("refresh_token") else None


def status_for(user: dict | None) -> dict:
    email = str((user or {}).get("email") or "")
    item = connection(email)
    return {
        "app": app_configured(),
        "connected": bool(item),
        "name": (item or {}).get("display_name") or "",
        "redirect": "http://127.0.0.1:3000/auth/canva/callback",
    }


def authorize_url(request: Request, email: str) -> tuple[str, str, str]:
    if not app_configured():
        raise HTTPException(status_code=400, detail="Add your Canva Client ID and Secret in Settings first.")
    if not email:
        raise HTTPException(status_code=401, detail="Login required")
    state = secrets.token_urlsafe(24)
    verifier = secrets.token_urlsafe(64)
    params = {
        "code_challenge": _challenge(verifier),
        "code_challenge_method": "s256",
        "scope": SCOPES,
        "response_type": "code",
        "client_id": os.getenv("CANVA_CLIENT_ID", ""),
        "state": state,
        "redirect_uri": redirect_uri(request),
    }
    from urllib.parse import urlencode

    return AUTH_URL + "?" + urlencode(params), state, verifier


def set_pkce_cookie(response: Response, state: str, verifier: str, email: str) -> None:
    token = _signer().dumps({"state": state, "verifier": verifier, "email": email})
    response.set_cookie(
        PKCE_COOKIE,
        token,
        max_age=600,
        httponly=True,
        samesite="lax",
        path="/",
        secure=_cookie_secure(),
    )


def _pop_pkce(request: Request) -> dict:
    raw = request.cookies.get(PKCE_COOKIE)
    if not raw:
        raise HTTPException(status_code=400, detail="Canva login expired. Try Connect Canva again.")
    try:
        data = _signer().loads(raw, max_age=600)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Canva login expired. Try Connect Canva again.") from exc
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid Canva state.")
    return data


def _token_headers() -> dict[str, str]:
    cid = os.getenv("CANVA_CLIENT_ID", "")
    secret = os.getenv("CANVA_CLIENT_SECRET", "")
    basic = base64.b64encode(f"{cid}:{secret}".encode()).decode()
    return {
        "Authorization": f"Basic {basic}",
        "Content-Type": "application/x-www-form-urlencoded",
    }


def finish_connect(request: Request, code: str, state: str) -> dict:
    pkce = _pop_pkce(request)
    if pkce.get("state") != state:
        raise HTTPException(status_code=400, detail="Invalid Canva state.")
    if not code:
        raise HTTPException(status_code=400, detail="Canva did not send an authorization code.")
    res = httpx.post(
        TOKEN_URL,
        headers=_token_headers(),
        data={
            "grant_type": "authorization_code",
            "code": code,
            "code_verifier": pkce["verifier"],
            "redirect_uri": redirect_uri(request),
        },
        timeout=25,
    )
    if res.status_code >= 400:
        raise HTTPException(
            status_code=400,
            detail="Canva rejected the login. Check the Client Secret, and that the redirect URL is exactly http://127.0.0.1:3000/auth/canva/callback (127.0.0.1, not localhost).",
        )
    payload = res.json()
    email = str(pkce.get("email") or "").strip().lower()
    stored = {
        "access_token": payload.get("access_token") or "",
        "refresh_token": payload.get("refresh_token") or "",
        "expires_at": int(time.time()) + int(payload.get("expires_in") or 14400) - 60,
        "display_name": "",
    }
    all_tokens = _load_tokens()
    all_tokens[email] = stored
    _save_tokens(all_tokens)
    profile = _profile(stored["access_token"])
    if profile:
        stored["display_name"] = profile
        all_tokens[email] = stored
        _save_tokens(all_tokens)
    return stored


def disconnect(email: str) -> None:
    key = (email or "").strip().lower()
    data = _load_tokens()
    data.pop(key, None)
    _save_tokens(data)


def _refresh(email: str, item: dict[str, Any]) -> dict[str, Any]:
    res = httpx.post(
        TOKEN_URL,
        headers=_token_headers(),
        data={"grant_type": "refresh_token", "refresh_token": item.get("refresh_token") or ""},
        timeout=25,
    )
    if res.status_code >= 400:
        disconnect(email)
        raise HTTPException(status_code=401, detail="Canva session expired. Connect Canva again in Settings.")
    payload = res.json()
    item["access_token"] = payload.get("access_token") or item.get("access_token")
    if payload.get("refresh_token"):
        item["refresh_token"] = payload["refresh_token"]
    item["expires_at"] = int(time.time()) + int(payload.get("expires_in") or 14400) - 60
    data = _load_tokens()
    data[(email or "").strip().lower()] = item
    _save_tokens(data)
    return item


def _access(email: str) -> str:
    item = connection(email)
    if not item:
        raise HTTPException(status_code=400, detail="Connect Canva in Settings first.")
    if int(item.get("expires_at") or 0) <= int(time.time()):
        item = _refresh(email, item)
    return str(item.get("access_token") or "")


def _profile(access: str) -> str:
    try:
        res = httpx.get(f"{API}/users/me", headers={"Authorization": f"Bearer {access}"}, timeout=20)
        if res.status_code >= 400:
            return ""
        team_user = (res.json() or {}).get("team_user") or {}
        user = team_user.get("user") or {}
        return str(user.get("display_name") or user.get("id") or "")
    except Exception:
        return ""


def list_designs(email: str, query: str = "") -> list[dict[str, Any]]:
    access = _access(email)
    params: dict[str, str] = {}
    if (query or "").strip():
        params["query"] = query.strip()[:80]
    res = httpx.get(
        f"{API}/designs",
        headers={"Authorization": f"Bearer {access}"},
        params=params,
        timeout=25,
    )
    if res.status_code >= 400:
        return []
    items = []
    for row in (res.json() or {}).get("items") or []:
        urls = row.get("urls") or {}
        thumb = ((row.get("thumbnail") or {}).get("url")) if isinstance(row.get("thumbnail"), dict) else ""
        items.append(
            {
                "id": row.get("id") or "",
                "title": row.get("title") or "Untitled",
                "edit_url": urls.get("edit_url") or "",
                "view_url": urls.get("view_url") or "",
                "thumbnail": thumb or "",
            }
        )
        if len(items) >= 12:
            break
    return items


def tool_list_designs(query: str = "") -> str:
    email = _current_email.get()
    if not email:
        return "Connect Canva in Settings first, then ask again."
    if not connection(email):
        return "Canva is not connected for this login. Open Settings → Features → Connect Canva."
    try:
        items = list_designs(email, query)
    except HTTPException as exc:
        return str(exc.detail)
    except Exception as exc:
        return f"Canva lookup failed: {exc}"
    if not items:
        return "No Canva designs found. Create one in Canva, or try a different search."
    lines = ["Your Canva designs:"]
    for item in items:
        lines.append(f"- {item['title']}")
        if item.get("edit_url"):
            lines.append(f"  Open: {item['edit_url']}")
    return "\n".join(lines)

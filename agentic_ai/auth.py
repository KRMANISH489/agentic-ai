from __future__ import annotations

import os
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, Request, Response
from itsdangerous import BadSignature, URLSafeTimedSerializer

from agentic_ai.config import set_env_value

COOKIE = "agentic_session"
STATE_COOKIE = "oauth_state"
MAX_AGE = 60 * 60 * 24 * 14


def _secret() -> str:
    secret = os.getenv("SESSION_SECRET", "").strip()
    if not secret:
        secret = secrets.token_urlsafe(32)
        set_env_value("SESSION_SECRET", secret)
    return secret


def _signer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(_secret(), salt="agentic-auth")


def base_url(request: Request) -> str:
    return os.getenv("AUTH_BASE_URL", str(request.base_url).rstrip("/"))


def _google_client_id() -> str:
    return os.getenv("GOOGLE_CLIENT_ID", "").strip()


def _github_client_id() -> str:
    return os.getenv("GITHUB_CLIENT_ID", "").strip()


def is_google_client_id(value: str) -> bool:
    return value.endswith(".apps.googleusercontent.com") and len(value) > 30


def is_github_client_id(value: str) -> bool:
    compact = value.replace("-", "")
    return len(value) >= 10 and compact.isalnum()


def is_google_secret(value: str) -> bool:
    return value.startswith("GOCSPX-") and len(value) >= 24


def oauth_status() -> dict:
    google_id = _google_client_id()
    github_id = _github_client_id()
    return {
        "google": bool(
            is_google_client_id(google_id)
            and is_google_secret(os.getenv("GOOGLE_CLIENT_SECRET", "").strip())
        ),
        "github": bool(
            is_github_client_id(github_id) and os.getenv("GITHUB_CLIENT_SECRET", "").strip()
        ),
    }


def read_user(request: Request) -> dict | None:
    raw = request.cookies.get(COOKIE)
    if not raw:
        return None
    try:
        data = _signer().loads(raw, max_age=MAX_AGE)
    except BadSignature:
        return None
    if not isinstance(data, dict) or not data.get("email"):
        return None
    return data


def require_user(request: Request) -> dict:
    user = read_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Login required")
    return user


def _cookie_secure() -> bool:
    return os.getenv("AUTH_BASE_URL", "").startswith("https://") or os.getenv("COOKIE_SECURE", "").lower() in {
        "1",
        "true",
        "yes",
    }


def set_user_cookie(response: Response, user: dict) -> None:
    token = _signer().dumps(user)
    response.set_cookie(
        COOKIE,
        token,
        max_age=MAX_AGE,
        httponly=True,
        samesite="lax",
        path="/",
        secure=_cookie_secure(),
    )


def clear_user_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")
    response.delete_cookie(STATE_COOKIE, path="/")


def _set_state(response: Response, state: str) -> None:
    response.set_cookie(
        STATE_COOKIE,
        _signer().dumps({"state": state}),
        max_age=600,
        httponly=True,
        samesite="lax",
        path="/",
        secure=_cookie_secure(),
    )


def _make_state() -> str:
    return _signer().dumps({"n": secrets.token_urlsafe(12)})


def _check_state(request: Request, state: str) -> None:
    try:
        _signer().loads(state, max_age=600)
    except BadSignature:
        raise HTTPException(400, "Invalid OAuth state")
    cookie_state = _pop_state(request)
    if cookie_state and cookie_state != state:
        raise HTTPException(400, "Invalid OAuth state")


def _pop_state(request: Request) -> str | None:
    raw = request.cookies.get(STATE_COOKIE)
    if not raw:
        return None
    try:
        data = _signer().loads(raw, max_age=600)
        return str(data.get("state") or "")
    except BadSignature:
        return None


def google_authorize_url(request: Request) -> tuple[str, str]:
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(400, "Google login is not configured")
    state = _make_state()
    params = {
        "client_id": client_id,
        "redirect_uri": f"{base_url(request)}/auth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params), state


def github_authorize_url(request: Request) -> tuple[str, str]:
    client_id = os.getenv("GITHUB_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(400, "GitHub login is not configured")
    state = _make_state()
    params = {
        "client_id": client_id,
        "redirect_uri": f"{base_url(request)}/auth/github/callback",
        "scope": "read:user user:email",
        "state": state,
    }
    return "https://github.com/login/oauth/authorize?" + urlencode(params), state


def finish_google(request: Request, code: str, state: str) -> dict:
    _check_state(request, state)
    token_res = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
            "redirect_uri": f"{base_url(request)}/auth/google/callback",
            "grant_type": "authorization_code",
        },
        timeout=20,
    )
    if token_res.status_code >= 400:
        raise HTTPException(
            status_code=400,
            detail="Google rejected the Client Secret or redirect URI. Copy the full Client Secret from Google Cloud Console (it starts with GOCSPX-). The redirect URI must match AUTH_BASE_URL/auth/google/callback exactly.",
        )
    access = token_res.json().get("access_token")
    info = httpx.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access}"},
        timeout=20,
    )
    info.raise_for_status()
    data = info.json()
    return {
        "provider": "google",
        "name": data.get("name") or data.get("given_name") or "Google user",
        "email": data.get("email") or "",
        "picture": data.get("picture") or "",
    }


def finish_github(request: Request, code: str, state: str) -> dict:
    _check_state(request, state)
    token_res = httpx.post(
        "https://github.com/login/oauth/access_token",
        json={
            "client_id": os.getenv("GITHUB_CLIENT_ID", ""),
            "client_secret": os.getenv("GITHUB_CLIENT_SECRET", ""),
            "code": code,
            "redirect_uri": f"{base_url(request)}/auth/github/callback",
        },
        headers={"Accept": "application/json"},
        timeout=20,
    )
    token_res.raise_for_status()
    access = token_res.json().get("access_token")
    headers = {
        "Authorization": f"Bearer {access}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "AgenticAI",
    }
    info = httpx.get("https://api.github.com/user", headers=headers, timeout=20)
    info.raise_for_status()
    data = info.json()
    email = data.get("email") or ""
    if not email:
        mails = httpx.get("https://api.github.com/user/emails", headers=headers, timeout=20)
        if mails.status_code == 200:
            for item in mails.json():
                if item.get("primary") and item.get("email"):
                    email = item["email"]
                    break
            if not email:
                for item in mails.json():
                    if item.get("email"):
                        email = item["email"]
                        break
    return {
        "provider": "github",
        "name": data.get("name") or data.get("login") or "GitHub user",
        "email": email or f"{data.get('login')}@users.noreply.github.com",
        "picture": data.get("avatar_url") or "",
    }


def save_oauth_keys(payload: dict) -> dict:
    google_id = str(payload.get("google_client_id") or "").strip()
    github_id = str(payload.get("github_client_id") or "").strip()
    if google_id and not is_google_client_id(google_id):
        raise HTTPException(
            status_code=400,
            detail="That is not a Google Client ID. Create an OAuth client in Google Cloud Console — it ends with .apps.googleusercontent.com.",
        )
    google_secret = str(payload.get("google_client_secret") or "").strip()
    if google_secret and (not google_secret.startswith("GOCSPX-") or len(google_secret) < 24):
        raise HTTPException(
            status_code=400,
            detail="That Client Secret looks incomplete. Copy the full secret from Google Cloud Console — it starts with GOCSPX- and is a long value.",
        )
    mapping = {
        "google_client_id": "GOOGLE_CLIENT_ID",
        "google_client_secret": "GOOGLE_CLIENT_SECRET",
        "github_client_id": "GITHUB_CLIENT_ID",
        "github_client_secret": "GITHUB_CLIENT_SECRET",
    }
    for field, env_key in mapping.items():
        value = str(payload.get(field) or "").strip()
        if value:
            set_env_value(env_key, value)
    return oauth_status()

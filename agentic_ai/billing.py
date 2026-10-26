"""Razorpay one-time credit packs (Student + Business) and per-email usage ledger."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import threading
from datetime import date
from pathlib import Path
from typing import Any

import httpx

from agentic_ai.config import ROOT_DIR

LEDGER_PATH = ROOT_DIR / "billing_usage.json"
_LOCK = threading.Lock()

FREE_CHATS_PER_DAY = int(os.getenv("FREE_CHATS_PER_DAY", "20"))
FREE_PHOTOS_PER_DAY = int(os.getenv("FREE_PHOTOS_PER_DAY", "5"))

PACKS: dict[str, dict[str, Any]] = {
    "student": {
        "id": "student",
        "title": "Student",
        "blurb": "Smaller pack for learning and personal use.",
        "price_inr": int(os.getenv("PACK_STUDENT_INR", "49")),
        "chat_credits": int(os.getenv("PACK_STUDENT_CHATS", "50")),
        "photo_credits": int(os.getenv("PACK_STUDENT_PHOTOS", "20")),
    },
    "business": {
        "id": "business",
        "title": "Business",
        "blurb": "Larger pack for shops, teams, and heavy use.",
        "price_inr": int(os.getenv("PACK_BUSINESS_INR", "199")),
        "chat_credits": int(os.getenv("PACK_BUSINESS_CHATS", "200")),
        "photo_credits": int(os.getenv("PACK_BUSINESS_PHOTOS", "80")),
    },
}


def razorpay_configured() -> bool:
    return bool(_key_id() and _key_secret())


def _key_id() -> str:
    return os.getenv("RAZORPAY_KEY_ID", "").strip()


def _key_secret() -> str:
    return os.getenv("RAZORPAY_KEY_SECRET", "").strip()


def pack_list() -> list[dict[str, Any]]:
    return [
        {
            "id": p["id"],
            "title": p["title"],
            "blurb": p["blurb"],
            "price_inr": p["price_inr"],
            "chat_credits": p["chat_credits"],
            "photo_credits": p["photo_credits"],
        }
        for p in PACKS.values()
    ]


def get_pack(pack_id: str) -> dict[str, Any] | None:
    return PACKS.get((pack_id or "").strip().lower())


def _empty_account() -> dict[str, Any]:
    return {
        "free_day": "",
        "free_chats_used": 0,
        "free_photos_used": 0,
        "paid_chat_credits": 0,
        "paid_photo_credits": 0,
        "payments": [],
    }


def _load_ledger() -> dict[str, Any]:
    if not LEDGER_PATH.exists():
        return {"accounts": {}}
    try:
        data = json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"accounts": {}}
    if not isinstance(data, dict):
        return {"accounts": {}}
    accounts = data.get("accounts")
    if not isinstance(accounts, dict):
        data["accounts"] = {}
    return data


def _save_ledger(data: dict[str, Any]) -> None:
    LEDGER_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _email_key(email: str) -> str:
    return (email or "").strip().lower()


def _roll_free_day(account: dict[str, Any]) -> None:
    today = date.today().isoformat()
    if account.get("free_day") != today:
        account["free_day"] = today
        account["free_chats_used"] = 0
        account["free_photos_used"] = 0


def _account(email: str) -> tuple[dict[str, Any], dict[str, Any]]:
    data = _load_ledger()
    key = _email_key(email)
    accounts = data.setdefault("accounts", {})
    raw = accounts.get(key)
    if not isinstance(raw, dict):
        raw = _empty_account()
        accounts[key] = raw
    _roll_free_day(raw)
    return data, raw


def status_for(email: str) -> dict[str, Any]:
    with _LOCK:
        _, account = _account(email)
        free_chats_left = max(0, FREE_CHATS_PER_DAY - int(account.get("free_chats_used") or 0))
        free_photos_left = max(0, FREE_PHOTOS_PER_DAY - int(account.get("free_photos_used") or 0))
        paid_chats = max(0, int(account.get("paid_chat_credits") or 0))
        paid_photos = max(0, int(account.get("paid_photo_credits") or 0))
        return {
            "configured": razorpay_configured(),
            "free_chats_per_day": FREE_CHATS_PER_DAY,
            "free_photos_per_day": FREE_PHOTOS_PER_DAY,
            "free_chats_left": free_chats_left,
            "free_photos_left": free_photos_left,
            "paid_chat_credits": paid_chats,
            "paid_photo_credits": paid_photos,
            "chats_left": free_chats_left + paid_chats,
            "photos_left": free_photos_left + paid_photos,
            "packs": pack_list(),
        }


def can_consume(email: str, *, with_photo: bool) -> tuple[bool, dict[str, Any]]:
    info = status_for(email)
    if info["chats_left"] <= 0:
        return False, info
    if with_photo and info["photos_left"] <= 0:
        return False, info
    return True, info


def consume(email: str, *, with_photo: bool) -> dict[str, Any]:
    """Debit free quota first, then paid credits. Raises ValueError if none left."""
    with _LOCK:
        data, account = _account(email)
        free_chats_left = FREE_CHATS_PER_DAY - int(account.get("free_chats_used") or 0)
        free_photos_left = FREE_PHOTOS_PER_DAY - int(account.get("free_photos_used") or 0)
        paid_chats = int(account.get("paid_chat_credits") or 0)
        paid_photos = int(account.get("paid_photo_credits") or 0)

        if free_chats_left <= 0 and paid_chats <= 0:
            raise ValueError("quota_exceeded")
        if with_photo and free_photos_left <= 0 and paid_photos <= 0:
            raise ValueError("quota_exceeded")

        if free_chats_left > 0:
            account["free_chats_used"] = int(account.get("free_chats_used") or 0) + 1
        else:
            account["paid_chat_credits"] = paid_chats - 1

        if with_photo:
            if free_photos_left > 0:
                account["free_photos_used"] = int(account.get("free_photos_used") or 0) + 1
            else:
                account["paid_photo_credits"] = paid_photos - 1

        _save_ledger(data)
    return status_for(email)


def create_order(email: str, pack_id: str) -> dict[str, Any]:
    if not razorpay_configured():
        raise RuntimeError("Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.")
    pack = get_pack(pack_id)
    if not pack:
        raise ValueError("Unknown pack. Choose student or business.")

    amount_paise = int(pack["price_inr"]) * 100
    receipt = f"ag_{pack['id']}_{hashlib.sha1(_email_key(email).encode()).hexdigest()[:10]}"
    payload = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt[:40],
        "notes": {
            "email": _email_key(email),
            "pack": pack["id"],
        },
    }
    with httpx.Client(timeout=30.0) as client:
        res = client.post(
            "https://api.razorpay.com/v1/orders",
            json=payload,
            auth=(_key_id(), _key_secret()),
        )
    if res.status_code >= 400:
        detail = res.text[:400]
        raise RuntimeError(f"Razorpay order failed: {detail}")
    order = res.json()
    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order.get("currency") or "INR",
        "key_id": _key_id(),
        "pack": {
            "id": pack["id"],
            "title": pack["title"],
            "price_inr": pack["price_inr"],
            "chat_credits": pack["chat_credits"],
            "photo_credits": pack["photo_credits"],
        },
        "prefill": {"email": _email_key(email)},
    }


def _verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    body = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(_key_secret().encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, (signature or "").strip())


def verify_and_credit(
    email: str,
    *,
    pack_id: str,
    order_id: str,
    payment_id: str,
    signature: str,
) -> dict[str, Any]:
    if not razorpay_configured():
        raise RuntimeError("Razorpay is not configured.")
    pack = get_pack(pack_id)
    if not pack:
        raise ValueError("Unknown pack.")
    if not order_id or not payment_id or not signature:
        raise ValueError("Missing payment details.")
    if not _verify_signature(order_id, payment_id, signature):
        raise ValueError("Invalid payment signature.")

    with _LOCK:
        data, account = _account(email)
        payments = account.setdefault("payments", [])
        if any(isinstance(p, dict) and p.get("payment_id") == payment_id for p in payments):
            # Idempotent: already credited
            pass
        else:
            account["paid_chat_credits"] = int(account.get("paid_chat_credits") or 0) + int(pack["chat_credits"])
            account["paid_photo_credits"] = int(account.get("paid_photo_credits") or 0) + int(pack["photo_credits"])
            payments.append(
                {
                    "payment_id": payment_id,
                    "order_id": order_id,
                    "pack": pack["id"],
                    "chat_credits": pack["chat_credits"],
                    "photo_credits": pack["photo_credits"],
                    "amount_inr": pack["price_inr"],
                }
            )
            # Keep ledger bounded
            if len(payments) > 100:
                account["payments"] = payments[-100:]
            _save_ledger(data)

    return status_for(email)


def quota_error_payload(email: str) -> dict[str, Any]:
    info = status_for(email)
    return {
        "code": "quota_exceeded",
        "detail": "Daily free limit reached. Buy a Student or Business top-up for more chats and photos.",
        "billing": info,
        "packs": info.get("packs") or pack_list(),
    }

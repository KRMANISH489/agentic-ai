from __future__ import annotations

import io
import re
import zipfile
from html import unescape
from pathlib import Path

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_TEXT_CHARS = 80_000
MAX_PDF_PAGES = 40

_TEXT_EXT = {".txt", ".md", ".csv", ".json", ".py", ".ts", ".tsx", ".js", ".css", ".html", ".xml", ".log"}


class FileExtractError(ValueError):
    pass


def _clean(text: str) -> str:
    body = unescape(text or "").replace("\x00", "")
    body = re.sub(r"\r\n?", "\n", body)
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    if len(body) > MAX_TEXT_CHARS:
        body = body[:MAX_TEXT_CHARS] + "\n\n[Truncated]"
    return body


def _pdf_text(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    chunks: list[str] = []
    for page in reader.pages[:MAX_PDF_PAGES]:
        chunks.append(page.extract_text() or "")
    text = _clean("\n\n".join(chunks))
    if not text:
        raise FileExtractError("That PDF has no readable text.")
    return text


def _docx_text(data: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zipped:
            xml = zipped.read("word/document.xml").decode("utf-8", "replace")
    except KeyError as exc:
        raise FileExtractError("That Word file could not be read.") from exc
    xml = re.sub(r"</w:p>", "\n", xml)
    xml = re.sub(r"<[^>]+>", "", xml)
    text = _clean(xml)
    if not text:
        raise FileExtractError("That Word file has no readable text.")
    return text


def extract_bytes(name: str, data: bytes) -> str:
    if len(data) > MAX_UPLOAD_BYTES:
        raise FileExtractError("File is too large. Use a file under 8 MB.")
    suffix = Path(name or "file").suffix.lower()
    if suffix == ".pdf":
        return _pdf_text(data)
    if suffix == ".docx":
        return _docx_text(data)
    if suffix in _TEXT_EXT or not suffix:
        try:
            raw = data.decode("utf-8")
        except UnicodeDecodeError:
            raw = data.decode("latin-1", "replace")
        text = _clean(raw)
        if not text:
            raise FileExtractError("That file is empty.")
        return text
    raise FileExtractError("Use PDF, Word (.docx), or a text file (.txt, .md, .csv, .json).")

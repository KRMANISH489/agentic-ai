from __future__ import annotations

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

PAPER = RGBColor(0xF7, 0xF4, 0xEF)
PAPER2 = RGBColor(0xEF, 0xEA, 0xE2)
WHITE = RGBColor(0xFF, 0xFC, 0xF8)
INK = RGBColor(0x14, 0x12, 0x0B)
MUTED = RGBColor(0x6F, 0x6B, 0x63)
ORANGE = RGBColor(0xD9, 0x77, 0x57)
ORANGE_DARK = RGBColor(0x8A, 0x33, 0x1C)
LINE = RGBColor(0xE6, 0xE0, 0xD6)

W = Inches(13.333)
H = Inches(7.5)
OUT = "Agentic_AI_Presentation.pptx"


def set_run(run, size=18, bold=False, color=INK, font="Calibri"):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = font


def add_bg(slide, color=PAPER):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, W, H)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape


def bar(slide, y=0):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, y, W, Inches(0.12))
    shape.fill.solid()
    shape.fill.fore_color.rgb = ORANGE
    shape.line.fill.background()


def star(slide, left, top, size):
    s = slide.shapes.add_shape(MSO_SHAPE.STAR_4_POINT, left, top, size, size)
    s.fill.solid()
    s.fill.fore_color.rgb = ORANGE
    s.line.fill.background()
    return s


def textbox(slide, l, t, w, h, text, size=18, bold=False, color=INK, align=PP_ALIGN.LEFT, font="Calibri"):
    box = slide.shapes.add_textbox(l, t, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    set_run(run, size=size, bold=bold, color=color, font=font)
    return box


def bullets(slide, l, t, w, h, items, size=20):
    box = slide.shapes.add_textbox(l, t, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.level = 0
        p.space_after = Pt(6)
        run = p.add_run()
        run.text = "•  " + item
        set_run(run, size=size, color=INK)
    return box


def card(slide, l, t, w, h, fill=WHITE):
    s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, l, t, w, h)
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    s.line.color.rgb = LINE
    s.adjustments[0] = 0.08
    return s


def footer(slide, page, total=14):
    textbox(slide, Inches(0.6), Inches(7.12), Inches(8), Inches(0.3), "Agentic AI  ·  v1.4.0", 12, False, MUTED)
    textbox(slide, Inches(11.2), Inches(7.12), Inches(1.6), Inches(0.3), f"{page} / {total}", 12, False, MUTED, PP_ALIGN.RIGHT)


def title_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(s)
    stripe = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.28), H)
    stripe.fill.solid()
    stripe.fill.fore_color.rgb = ORANGE
    stripe.line.fill.background()
    star(s, Inches(0.85), Inches(1.7), Inches(0.7))
    textbox(s, Inches(0.85), Inches(2.55), Inches(11), Inches(1.1), "Agentic AI", 54, True, INK, font="Georgia")
    textbox(
        s,
        Inches(0.85),
        Inches(3.65),
        Inches(11),
        Inches(0.9),
        "A local ReAct agent that thinks, uses tools, speaks, and answers like a teammate.",
        24,
        False,
        MUTED,
    )
    textbox(s, Inches(0.85), Inches(5.5), Inches(11), Inches(0.4), "Python  ·  FastAPI  ·  Next.js  ·  Groq", 16, True, ORANGE_DARK)
    textbox(s, Inches(0.85), Inches(6.0), Inches(11), Inches(0.35), "Version 1.4.0  ·  Local app on http://127.0.0.1:3000", 14, False, MUTED)


def content_slide(prs, title, items, page):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(s)
    bar(s)
    textbox(s, Inches(0.7), Inches(0.4), Inches(12), Inches(0.7), title, 32, True, INK, font="Georgia")
    bullets(s, Inches(0.8), Inches(1.4), Inches(11.5), Inches(5.3), items, 22)
    footer(s, page)
    return s


def cards_slide(prs, title, cards, page):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(s)
    bar(s)
    textbox(s, Inches(0.7), Inches(0.4), Inches(12), Inches(0.7), title, 32, True, INK, font="Georgia")
    n = len(cards)
    gap = Inches(0.28)
    left = Inches(0.7)
    usable = Inches(11.9)
    cw = int((usable - gap * (n - 1)) / n)
    for i, (h, body) in enumerate(cards):
        x = left + i * (cw + gap)
        card(s, x, Inches(1.45), cw, Inches(4.9), WHITE)
        textbox(s, x + Inches(0.28), Inches(1.7), cw - Inches(0.5), Inches(1.0), h, 20, True, ORANGE_DARK)
        textbox(s, x + Inches(0.28), Inches(2.7), cw - Inches(0.5), Inches(3.3), body, 16, False, INK)
    footer(s, page)


def compare_slide(prs, title, left_title, left_items, right_title, right_items, page):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(s)
    bar(s)
    textbox(s, Inches(0.7), Inches(0.32), Inches(12), Inches(0.55), title, 28, True, INK, font="Georgia")
    card(s, Inches(0.55), Inches(1.05), Inches(5.9), Inches(5.8), WHITE)
    card(s, Inches(6.85), Inches(1.05), Inches(5.9), Inches(5.8), WHITE)
    stripe = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(6.85), Inches(1.05), Inches(5.9), Inches(0.1))
    stripe.fill.solid()
    stripe.fill.fore_color.rgb = ORANGE
    stripe.line.fill.background()
    textbox(s, Inches(0.85), Inches(1.25), Inches(5.4), Inches(0.5), left_title, 20, True, MUTED)
    textbox(s, Inches(7.15), Inches(1.25), Inches(5.4), Inches(0.5), right_title, 20, True, ORANGE_DARK)
    bullets(s, Inches(0.85), Inches(1.85), Inches(5.35), Inches(4.7), left_items, 16)
    bullets(s, Inches(7.15), Inches(1.85), Inches(5.35), Inches(4.7), right_items, 16)
    footer(s, page)
    return s


def main():
    prs = Presentation()
    prs.slide_width = W
    prs.slide_height = H

    title_slide(prs)

    content_slide(
        prs,
        "Agenda",
        [
            "What Agentic AI is, and why it is different from a chatbot",
            "Architecture: Next.js frontend + FastAPI backend + Groq LLM",
            "What v1.3.0 already had, and what v1.4.0 added",
            "Login, chat, edit, voice, tools, and Researcher + Writer crew",
            "How the ReAct loop thinks, calls tools, and answers",
            "How to run it locally and what to demo in v1.4.0",
        ],
        2,
    )

    content_slide(
        prs,
        "The idea",
        [
            "A normal chatbot only talks. An agent can act.",
            "Agentic AI plans a step, calls a tool, reads the result, then answers.",
            "It can search the web, check weather, do math, look up GitHub, and more.",
            "The user stays in a Claude-like chat. The tools stay behind the scenes.",
            "Everything runs on your machine — no cloud app hosting required.",
        ],
        3,
    )

    cards_slide(
        prs,
        "Architecture",
        [
            (
                "Frontend",
                "Next.js 15 (App Router, React, TypeScript)\n\nCream chat UI, login, recents, edit, voice, settings.\n\nRuns at\n127.0.0.1:3000",
            ),
            (
                "Backend",
                "FastAPI + Uvicorn\n\nAuth, sessions, chat stream (SSE), tool install, and Groq API key setup.\n\nRuns at\n127.0.0.1:7860",
            ),
            (
                "Agent core",
                "Custom ReAct loop\n(not LangGraph)\n\nLLM + tools + memory.\nOptional 2-agent crew: Researcher then Writer.",
            ),
        ],
        4,
    )

    content_slide(
        prs,
        "User experience",
        [
            "Login with name + email, or Google / GitHub OAuth.",
            "Sidebar stays fixed. Chat on the right is what grows and scrolls.",
            "Greeting uses the signed-in name: “How can I help you today, Abhishek?”",
            "A simple “hello” gets a personal reply, like Claude — no tools needed.",
            "Recents, New chat, Settings (Ctrl+,), and a user menu live in the sidebar.",
        ],
        5,
    )

    compare_slide(
        prs,
        "Old version vs new version",
        "v1.3.0 — already there",
        [
            "Claude-like cream chat UI (Next.js + FastAPI)",
            "Login: name + email, Google, GitHub",
            "ReAct agent with tools: search, weather, math, Wikipedia, GitHub",
            "Single agent, or Researcher + Writer crew",
            "Recents, Settings, named greeting (“hello, Abhishek”)",
            "Type a question and send — that was the only input",
            "No way to edit a sent message",
            "No microphone, no read-aloud",
        ],
        "v1.4.0 — what we added",
        [
            "Everything from v1.3.0 is still there",
            "Edit a sent message (pencil under the bubble)",
            "Save & retry: old answer is dropped, new search runs",
            "Microphone in the chat box — speak the question",
            "Speaker on answers — hear the reply",
            "English / Hindi follows the language menu",
            "Settings: send after speaking, read answers aloud",
            "App version badge now shows v1.4.0",
        ],
        6,
    )

    cards_slide(
        prs,
        "What’s new in v1.4.0",
        [
            (
                "Edit a sent message",
                "Pencil under your bubble. Change the question, then Enter or Save & retry.\n\nThe old reply is dropped. The agent searches again with the new text.",
            ),
            (
                "Voice in",
                "Microphone in the chat box. Speak your question (Chrome or Edge).\n\nLanguage follows English / Hindi in the sidebar. Optional auto-send when you stop.",
            ),
            (
                "Voice out",
                "Speaker on each answer to hear it.\n\nSettings → Read answers aloud if you want every reply spoken automatically.",
            ),
        ],
        7,
    )

    content_slide(
        prs,
        "Two ways to work",
        [
            "Single agent — one assistant for quick questions, weather, prices, and math.",
            "Researcher + Writer — first agent gathers facts, second agent writes the answer.",
            "Switch modes from the sidebar dropdown before you send a message.",
            "Show thinking: live status such as “Searching the web…” while tools run.",
            "Enter to send, voice, temperature, and max tool steps are all in Settings.",
        ],
        8,
    )

    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(s)
    bar(s)
    textbox(s, Inches(0.7), Inches(0.4), Inches(12), Inches(0.7), "Tools", 32, True, INK, font="Georgia")
    groups = [
        ("Core (ready by default)", "Web Search  ·  Wikipedia  ·  Weather\nCalculator  ·  Clock  ·  Notes"),
        ("Install when you need them", "GitHub lookup  ·  Dice  ·  Unit Convert\nText Stats  ·  UUID  ·  Random Pick"),
        ("How they feel", "Install / Uninstall in Settings → Tools.\nThe agent only uses what is installed."),
    ]
    for i, (h, body) in enumerate(groups):
        y = Inches(1.4) + i * Inches(1.7)
        card(s, Inches(0.7), y, Inches(11.9), Inches(1.5))
        textbox(s, Inches(1.0), y + Inches(0.22), Inches(11.3), Inches(0.45), h, 20, True, ORANGE_DARK)
        textbox(s, Inches(1.0), y + Inches(0.7), Inches(11.3), Inches(0.6), body, 18, False, INK)
    footer(s, 9)

    content_slide(
        prs,
        "How the agent thinks",
        [
            "Think — the LLM decides whether it needs a tool.",
            "Act — it calls a tool with a clean JSON argument, e.g. {\"query\": \"...\"}.",
            "Observe — the tool result is added to memory.",
            "Repeat — up to max steps (default 8), then write a human answer.",
            "Guardrails: no JSON dumps as final answers, repair bad Groq tool calls, cite sources.",
        ],
        10,
    )

    content_slide(
        prs,
        "Login and security",
        [
            "Local login: name + email, stored in a signed httpOnly cookie.",
            "Google and GitHub OAuth, with callback http://127.0.0.1:3000/auth/.../callback",
            "Chat, tools, and settings APIs require a logged-in session.",
            "Groq API key stays in .env on the machine — it is never shown back in the UI.",
            "OAuth Client ID / Secret come from Google Cloud or GitHub Developer settings.",
        ],
        11,
    )

    content_slide(
        prs,
        "Tech stack",
        [
            "LLM: Groq, default model openai/gpt-oss-120b (OpenAI-compatible API).",
            "Python 3.12  ·  FastAPI  ·  Uvicorn  ·  httpx  ·  itsdangerous",
            "Next.js 15  ·  React 19  ·  TypeScript  ·  marked for chat markdown",
            "Web search via DuckDuckGo (ddgs). Weather via wttr.in.",
            "Frontend proxies /api to the Python backend so cookies and chat streaming work.",
        ],
        12,
    )

    content_slide(
        prs,
        "How to run",
        [
            "Terminal 1:  .\\.venv\\Scripts\\python.exe app.py     → API on port 7860",
            "Terminal 2:  cd frontend   then   npm run dev      → UI on port 3000",
            "Open http://127.0.0.1:3000  (use 127.0.0.1, not localhost, for Google login)",
            "Sign in, paste a Groq key if asked, then chat.",
            "Demo: “hello”, Delhi weather, gold price, then edit the city and Save & retry.",
            "Also demo: tap the mic to speak, tap the speaker to hear the answer.",
        ],
        13,
    )

    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(s)
    stripe = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.28), H)
    stripe.fill.solid()
    stripe.fill.fore_color.rgb = ORANGE
    stripe.line.fill.background()
    star(s, Inches(0.85), Inches(2.15), Inches(0.62))
    textbox(s, Inches(0.85), Inches(2.95), Inches(12), Inches(0.9), "Thank you", 48, True, INK, font="Georgia")
    textbox(
        s,
        Inches(0.85),
        Inches(3.95),
        Inches(11.5),
        Inches(0.8),
        "Questions, ideas, or a live demo — let’s try it in the browser.",
        22,
        False,
        MUTED,
    )
    textbox(s, Inches(0.85), Inches(5.4), Inches(11), Inches(0.4), "http://127.0.0.1:3000", 18, True, ORANGE_DARK)

    saved = []
    for path in (OUT, "Agentic_AI_Presentation_v1.4.pptx"):
        try:
            prs.save(path)
            saved.append(path)
        except PermissionError:
            print("locked (close PowerPoint):", path)
    print("saved:", ", ".join(saved) if saved else "none")


if __name__ == "__main__":
    main()

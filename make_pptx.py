from __future__ import annotations

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

PAPER = RGBColor(0xF1, 0xF1, 0xF1)
CREAM = RGBColor(0xDA, 0xCE, 0xBE)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
INK = RGBColor(0x1A, 0x16, 0x12)
MUTED = RGBColor(0x5E, 0x57, 0x4E)
ORANGE = RGBColor(0xDB, 0x8F, 0x2A)
ORANGE_DARK = RGBColor(0xB8, 0x74, 0x1C)
LINE = RGBColor(0xD4, 0xC8, 0xB8)

W = Inches(13.333)
H = Inches(7.5)
OUT = "Agentic_AI_Presentation.pptx"
OUT_FULL = "Agentic_AI_Full_Stack_Briefing.pptx"
TOTAL = 30
VERSION = "v1.7.0"


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
        p.space_after = Pt(8)
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


def footer(slide, page):
    textbox(slide, Inches(0.6), Inches(7.12), Inches(9), Inches(0.3), f"Agentic AI  ·  {VERSION}  ·  Abhishek Mishra", 12, False, MUTED)
    textbox(slide, Inches(11.2), Inches(7.12), Inches(1.6), Inches(0.3), f"{page} / {TOTAL}", 12, False, MUTED, PP_ALIGN.RIGHT)


def title_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(s, CREAM)
    stripe = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.28), H)
    stripe.fill.solid()
    stripe.fill.fore_color.rgb = ORANGE
    stripe.line.fill.background()
    star(s, Inches(0.85), Inches(1.2), Inches(0.62))
    textbox(s, Inches(0.85), Inches(1.95), Inches(12), Inches(0.35), "FULL-STACK PROJECT BRIEFING", 14, True, ORANGE_DARK)
    textbox(s, Inches(0.85), Inches(2.35), Inches(12), Inches(1.0), "Agentic AI", 54, True, INK, font="Georgia")
    textbox(
        s,
        Inches(0.85),
        Inches(3.4),
        Inches(11.2),
        Inches(0.9),
        "Complete website walkthrough — Frontend (Next.js) → Backend (FastAPI) → Agent core → Deploy.",
        22,
        False,
        MUTED,
    )
    textbox(s, Inches(0.85), Inches(4.55), Inches(11), Inches(0.35), "UI  ·  APIs  ·  ReAct agent  ·  Tools  ·  Auth  ·  Docker", 16, True, ORANGE_DARK)
    textbox(s, Inches(0.85), Inches(5.15), Inches(11), Inches(0.35), "Python  ·  FastAPI  ·  Next.js 15  ·  React 19  ·  Groq", 16, False, INK)
    textbox(s, Inches(0.85), Inches(5.65), Inches(11), Inches(0.35), f"{VERSION}  ·  Local :3000 / :7860  ·  Live on Render", 14, False, MUTED)
    textbox(s, Inches(0.85), Inches(6.15), Inches(11), Inches(0.35), "Built by Abhishek Mishra", 16, True, INK)


def content_slide(prs, title, items, page, size=20):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(s)
    bar(s)
    textbox(s, Inches(0.7), Inches(0.4), Inches(12), Inches(0.7), title, 32, True, INK, font="Georgia")
    bullets(s, Inches(0.8), Inches(1.35), Inches(11.6), Inches(5.5), items, size)
    footer(s, page)
    return s


def cards_slide(prs, title, cards, page, body_size=15):
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
        card(s, x, Inches(1.4), cw, Inches(5.0), WHITE)
        textbox(s, x + Inches(0.28), Inches(1.65), cw - Inches(0.5), Inches(0.9), h, 18, True, ORANGE_DARK)
        textbox(s, x + Inches(0.28), Inches(2.55), cw - Inches(0.5), Inches(3.5), body, body_size, False, INK)
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


def rows_slide(prs, title, rows, page):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(s)
    bar(s)
    textbox(s, Inches(0.7), Inches(0.35), Inches(12), Inches(0.6), title, 30, True, INK, font="Georgia")
    for i, (h, body) in enumerate(rows):
        y = Inches(1.15) + i * Inches(1.12)
        card(s, Inches(0.7), y, Inches(11.9), Inches(1.0))
        textbox(s, Inches(0.95), y + Inches(0.12), Inches(11.4), Inches(0.32), h, 16, True, ORANGE_DARK)
        textbox(s, Inches(0.95), y + Inches(0.46), Inches(11.4), Inches(0.42), body, 15, False, INK)
    footer(s, page)


def section_slide(prs, eyebrow, title, subtitle, page):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(s, CREAM)
    stripe = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.28), H)
    stripe.fill.solid()
    stripe.fill.fore_color.rgb = ORANGE
    stripe.line.fill.background()
    textbox(s, Inches(0.85), Inches(2.4), Inches(11), Inches(0.4), eyebrow, 14, True, ORANGE_DARK)
    textbox(s, Inches(0.85), Inches(2.9), Inches(11.5), Inches(1.0), title, 44, True, INK, font="Georgia")
    textbox(s, Inches(0.85), Inches(4.1), Inches(11), Inches(0.8), subtitle, 20, False, MUTED)
    footer(s, page)


def main():
    prs = Presentation()
    prs.slide_width = W
    prs.slide_height = H

    # 1
    title_slide(prs)

    # 2
    content_slide(
        prs,
        "Agenda — Frontend to Backend",
        [
            "What the product is and why it is an agent, not a plain chatbot",
            "End-to-end architecture: Browser → Next.js → FastAPI → Agent → LLM/Tools",
            "Frontend deep dive: pages, AppClient, Artifacts, SEO, proxy",
            "Backend deep dive: every /api route, auth, streaming chat, file extract",
            "Agent core: ReAct loop, tools, Teach memory, sandbox, page builds",
            "Deploy path: local dual-process vs one Docker image on Render",
        ],
        2,
    )

    # 3
    compare_slide(
        prs,
        "Chatbot vs Agentic AI",
        "Normal chatbot",
        [
            "User types → model replies with text",
            "Cannot search live prices or weather",
            "Cannot do exact math or run code",
            "Forgets your shop, files, and style next chat",
            "You copy-paste everything yourself",
            "Looks smart, but it cannot act",
        ],
        "This website — an agent",
        [
            "Thinks: answer now, or call a tool?",
            "Acts: search, weather, math, notes, Python",
            "Observes the tool result, then continues",
            "Reads PDFs, photos, and project files",
            "Remembers Teach notes and project instructions",
            "Delivers chat + Artifacts preview + Notes",
        ],
        3,
    )

    # 4
    section_slide(
        prs,
        "PART 1",
        "System architecture",
        "How the full website is wired from the browser to Groq.",
        4,
    )

    # 5
    cards_slide(
        prs,
        "Three layers of the product",
        [
            (
                "1 · Frontend",
                "Next.js 15 · React 19 · TypeScript\n\nChat UI, sidebar, Artifacts, Settings, Projects, Notes, About, SEO.\n\nPort 3000\nRewrites /api/* → FastAPI",
            ),
            (
                "2 · Backend API",
                "FastAPI + Uvicorn\n\nAuth, SSE chat stream, extract, Teach, notes, tools, settings.\n\nPort 7860\nCookie sessions",
            ),
            (
                "3 · Agent core",
                "Custom ReAct (not LangGraph)\n\nLLM client + tool catalog + memory.\nOptional Researcher + Writer crew.\nSandbox for short Python.",
            ),
        ],
        5,
        body_size=14,
    )

    # 6
    content_slide(
        prs,
        "Request journey (one chat message)",
        [
            "Browser (AppClient) POSTs /api/chat with message, mode, history, images, lang, focus.",
            "Next.js rewrite proxies /api/* to http://127.0.0.1:7860 (same origin cookies + SSE).",
            "FastAPI checks session cookie → builds prompt extras (Teach, project files, Code/page mode).",
            "Agent or Crew runs ReAct: Think → tool calls → Observe → streamed tokens.",
            "UI shows live status (“Searching the web…”), then markdown reply; artifacts open in the side pane.",
            "Optional: ZIP download of HTML/code; Pollinations images auto-injected into landing pages.",
        ],
        6,
        size=17,
    )

    # 7
    content_slide(
        prs,
        "Tech stack map",
        [
            "LLM: Groq openai/gpt-oss-120b (OpenAI-compatible). Also OpenAI, OpenRouter, or Ollama.",
            "Vision: Groq qwen/qwen3.6-27b — gallery / camera photos (up to 4).",
            "Backend: Python 3.10+ · FastAPI · Uvicorn · httpx · itsdangerous · pypdf · python-multipart",
            "Frontend: Next.js 15 · React 19 · TypeScript · marked (chat markdown)",
            "Tools: DuckDuckGo search · wttr.in weather · notes as .md on disk · locked code_run",
            "UI brand: cream sidebar #dacebe, paper #f1f1f1, gold #db8f2a, Fraunces + Figtree",
            "Deploy: one Docker image (Node build + Python runtime) on Render / HF Spaces",
        ],
        7,
        size=17,
    )

    # 8
    section_slide(
        prs,
        "PART 2",
        "Frontend — the website UI",
        "Next.js App Router, chat shell, artifacts, and how /api is proxied.",
        8,
    )

    # 9
    content_slide(
        prs,
        "Frontend folder map",
        [
            "frontend/src/app/page.tsx — home; mounts AppClient (the whole chat product)",
            "frontend/src/app/layout.tsx — metadata, fonts, Google verification, JSON-LD hooks",
            "frontend/src/app/about/page.tsx + AboutFaq — public About / FAQ for SEO",
            "frontend/src/app/sitemap.ts · robots.ts · manifest.ts · opengraph-image.tsx",
            "frontend/src/app/auth/[...path]/route.ts — auth path bridge when needed",
            "frontend/src/components/AppClient.tsx — login, chat, tools, projects, voice, landing picker",
            "frontend/src/components/ArtifactPane.tsx — Preview / Code / File / ZIP for artifacts",
            "frontend/src/lib/* — artifacts, pageImages, zip, types, seo helpers",
        ],
        9,
        size=16,
    )

    # 10
    rows_slide(
        prs,
        "UI surfaces the user sees",
        [
            ("Login & greeting", "Name + email, or Google / GitHub. Empty state: “Ready to leap, {name}?”"),
            ("Sidebar", "New leap, project picker, Single agent vs Researcher + Writer, Recents, profile"),
            ("Composer", "+ menu: Take photo · Gallery · Upload file · Landing page · mic · send"),
            ("Chat / Code focus", "Code mode asks for full working fixes; Chat mode can teach in plain language"),
            ("After a reply", "Copy, speak aloud, Retry, edit your bubble and Save & retry"),
        ],
        10,
    )

    # 11
    cards_slide(
        prs,
        "Frontend feature modules",
        [
            (
                "Artifacts pane",
                "Parses <artifact> tags and previewable fences.\n\nHTML preview + Pollinations image fill.\n\nDownload File or ZIP (multi-file).",
            ),
            (
                "Landing page picker",
                "Shop, SaaS, restaurant, portfolio…\n\nBuilds a typed premium-page prompt.\n\nOpens as HTML artifact automatically.",
            ),
            (
                "Settings tabs",
                "Tools Install/Uninstall\nFeatures toggles\nTeach (instructions + facts + files)\nAbout / model chip",
            ),
        ],
        11,
        body_size=14,
    )

    # 12
    content_slide(
        prs,
        "Next.js ↔ API proxy",
        [
            "next.config.ts rewrites /api/:path* → API_ORIGIN (default http://127.0.0.1:7860).",
            "Browser always talks to same origin (:3000), so cookies and EventSource/SSE stay simple.",
            "Local: two processes (Next + FastAPI). Docker: start.sh runs both; public port 3000.",
            "Vercel alone cannot host the Python agent — rewrite would point at a missing API.",
            "Auth OAuth callbacks must use http://127.0.0.1:3000 (Google rejects bare localhost).",
            "SEO routes (sitemap, robots, About) are pure Next — no FastAPI needed.",
        ],
        12,
        size=17,
    )

    # 13
    section_slide(
        prs,
        "PART 3",
        "Backend — FastAPI website API",
        "Every route that powers login, chat streaming, files, Teach, and notes.",
        13,
    )

    # 14
    content_slide(
        prs,
        "API route map (app.py)",
        [
            "Identity: GET /api/me · POST /api/auth/local · POST /api/auth/keys · /auth/logout",
            "OAuth: /auth/google · /auth/github · callbacks → set httpOnly session cookie",
            "Health: GET /api/status · POST /api/reset · POST /api/setup (Groq key)",
            "Prefs: GET/POST /api/settings · POST /api/tools/install · /api/tools/uninstall",
            "Files: POST /api/extract · POST /api/teach/file · POST /api/teach/forget",
            "Notes: GET /api/notes · GET/DELETE /api/notes/{name}",
            "Chat: POST /api/chat — Server-Sent Events (token stream + tool status events)",
        ],
        14,
        size=17,
    )

    # 15
    cards_slide(
        prs,
        "Backend packages (agentic_ai/)",
        [
            (
                "agent.py · crew.py",
                "ReAct single agent.\nCrew = Researcher then Writer.\nVision + artifact + page-design instructions.",
            ),
            (
                "tools.py · sandbox.py",
                "Tool catalog + handlers.\ncode_run in locked child process (6s, no net/files).",
            ),
            (
                "auth · files · prefs",
                "Cookie sessions + OAuth.\nPDF/docx/text extract.\nsettings.json + CORE_TOOLS + Teach.",
            ),
        ],
        15,
        body_size=14,
    )

    # 16
    content_slide(
        prs,
        "Chat endpoint internals",
        [
            "Requires logged-in session. Body: message, mode, history, images[], lang, focus, project context.",
            "Prompt assembly: system rules + Teach block + IT playbook + project files + attached file text.",
            "Code focus note: ship complete runnable code; page-build note: PREMIUM_PAGE_DESIGN brief.",
            "mode=agent → Agent.ask(…, on_token=…) · mode=crew → Crew.run(…).",
            "SSE events: status lines for tools, then token deltas, then done / error.",
            "Photos: data:image URLs → vision model; tools skipped while answering from a picture.",
        ],
        16,
        size=17,
    )

    # 17
    section_slide(
        prs,
        "PART 4",
        "Agent intelligence layer",
        "ReAct loop, tools, memory, sandbox, and premium page generation.",
        17,
    )

    # 18
    content_slide(
        prs,
        "How the agent thinks (ReAct)",
        [
            "Think — LLM decides: greet, answer, or call a tool.",
            "Act — tool call with clean JSON, e.g. {\"query\": \"today gold price India\"}.",
            "Observe — tool result is appended to memory for the next step.",
            "Repeat — up to max_steps (default 8), then a human answer (not raw JSON).",
            "Guardrails: repair bad Groq tool calls, cite sources, do not invent URLs or numbers.",
            "Extras: language (EN/HI/Bhojpuri), Teach, project files, photos, Code / page-build notes.",
        ],
        18,
        size=17,
    )

    # 19
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(s)
    bar(s)
    textbox(s, Inches(0.7), Inches(0.35), Inches(12), Inches(0.6), "Tools catalog", 32, True, INK, font="Georgia")
    groups = [
        ("Core (ready by default)", "Web Search · Wikipedia · Weather · Calculator · Clock · Notes · Code sandbox"),
        ("Install when needed", "GitHub lookup · Dice · Unit Convert · Text Stats · UUID · Random Pick"),
        ("How it feels in the UI", "Settings → Tools: Install / Uninstall. Agent only sees installed tools. Status: “Searching the web…”"),
    ]
    for i, (h, body) in enumerate(groups):
        y = Inches(1.25) + i * Inches(1.7)
        card(s, Inches(0.7), y, Inches(11.9), Inches(1.5))
        textbox(s, Inches(1.0), y + Inches(0.22), Inches(11.3), Inches(0.45), h, 20, True, ORANGE_DARK)
        textbox(s, Inches(1.0), y + Inches(0.7), Inches(11.3), Inches(0.6), body, 18, False, INK)
    footer(s, 19)

    # 20
    cards_slide(
        prs,
        "Memory, files, and page builds",
        [
            (
                "Teach + Projects",
                "Instructions, facts, up to 5 Teach files.\nProject: name, standing rules, up to 8 files.\nInjected every chat — memory, not GPU training.",
            ),
            (
                "Vision + extract",
                "Photos: gallery or camera, max 4.\nFiles: PDF, Word, txt, md, csv, json.\nWrapped as ---file:name--- for quoting.",
            ),
            (
                "Premium HTML pages",
                "page_design.py brief + Pollinations URLs.\nfrontend pageImages.ts fills missing imgs.\nPreview + ZIP download in ArtifactPane.",
            ),
        ],
        20,
        body_size=14,
    )

    # 21
    content_slide(
        prs,
        "Code sandbox (code_run)",
        [
            "Short Python in a child process — isolated interpreter, 6 second timeout.",
            "Allowed: math, json, re, datetime, statistics, random, and similar stdlib. print() for output.",
            "Blocked: os, subprocess, open(), eval/exec, network, installs, arbitrary files.",
            "Use for exact numbers and tiny scripts — not a full IDE or computer-use agent.",
            "Always a CORE tool; users do not uninstall it from the default set.",
        ],
        21,
    )

    # 22
    content_slide(
        prs,
        "Two working modes",
        [
            "Single agent — one assistant for quick Q&A, weather, prices, files, and code.",
            "Researcher + Writer — first agent gathers facts (search, wiki, weather, GitHub).",
            "Writer turns the brief into a clear answer; may use calculator, clock, notes, sandbox.",
            "Switch from the sidebar before you send. Crew fits longer research.",
            "Show thinking: live tool status. Temperature default 0.2. Max steps default 8.",
        ],
        22,
    )

    # 23
    section_slide(
        prs,
        "PART 5",
        "Security, run, deploy",
        "Sessions, secrets, local dual-process, and one-container production.",
        23,
    )

    # 24
    content_slide(
        prs,
        "Login and security",
        [
            "Local login: name + email → signed httpOnly cookie (itsdangerous).",
            "Google / GitHub OAuth; callbacks through the Next origin on port 3000.",
            "Protected: chat, tools, notes, extract, settings. Public: About, sitemap, robots.",
            "GROQ_API_KEY stays in .env / host env — never echoed back in the UI.",
            "Sandbox: no network, short timeout. Teach = prompt memory, not weight updates.",
            "Do not commit .env. workspace_notes/ is gitignored.",
        ],
        24,
        size=17,
    )

    # 25
    compare_slide(
        prs,
        "Local run vs Docker deploy",
        "Local (dev)",
        [
            "Terminal 1: python app.py → :7860",
            "Terminal 2: cd frontend && npm run dev → :3000",
            "Open http://127.0.0.1:3000",
            "Hot reload on both sides",
            "CLI: python main.py [--crew] -q \"…\"",
            "Paste Groq key if /api/setup asks",
        ],
        "Production (Docker)",
        [
            "Dockerfile: build Next, then Python image",
            "start.sh runs API + next start",
            "Public PORT=3000 (Render / HF Spaces)",
            "Set GROQ_API_KEY in host env",
            "One service — Vercel alone is not enough",
            "Live: agentic-ai-d0cx.onrender.com",
        ],
        25,
    )

    # 26
    content_slide(
        prs,
        "Project structure (repo map)",
        [
            "app.py — FastAPI entry: routes, SSE chat, page-build / code-focus prompt notes",
            "agentic_ai/agent.py · crew.py · llm.py · tools.py · sandbox.py · page_design.py",
            "agentic_ai/auth.py · files.py · prefs.py · memory.py · config.py · canva.py",
            "frontend/ — Next.js App Router UI + ArtifactPane + pageImages + zip",
            "static/ — legacy/static assets served by API when needed",
            "main.py — CLI agent · Dockerfile · start.sh · render.yaml · railway.json",
            "make_pptx.py — this deck generator · IT_Teach_Playbook.txt — default Teach style",
        ],
        26,
        size=16,
    )

    # 27
    content_slide(
        prs,
        "Demo script (full stack)",
        [
            "1. Login → “Hello” (greeting, no tools).",
            "2. “Delhi weather” then “today gold price in India” (tools + citations).",
            "3. Attach a PDF: “summarize this file” (extract → agent).",
            "4. Teach your name/shop → new chat → “what do you know about me?”",
            "5. Create a Project, add a file, ask a question that needs it.",
            "6. + → Landing page → Shop — Artifacts preview + ZIP (images included).",
            "7. “Run Python: print(sum(range(1, 11)))” then “save this as a note”.",
            "8. Mic / speaker, Retry, Export chat — then open Notes from profile.",
        ],
        27,
        size=16,
    )

    # 28
    compare_slide(
        prs,
        "Honest scope — what this website is not",
        "This stack does",
        [
            "Full FE+BE product with real tools",
            "Streaming chat, files, voice, projects",
            "Teach + project memory in prompts",
            "Sandboxed Python + HTML artifacts",
            "One-container Docker deploy",
        ],
        "It does not (on purpose)",
        [
            "Clone Claude Code or Computer Use",
            "Fine-tune a neural model on GPU",
            "Give the model your whole OS/browser",
            "Ship Gmail/Drive/Calendar OAuth yet",
            "Replace LangGraph for huge graphs",
        ],
        28,
    )

    # 29
    content_slide(
        prs,
        "Benefits of this architecture",
        [
            "Clear ownership: UI owns UX; FastAPI owns sessions and tools; agent owns reasoning.",
            "Same-origin proxy keeps cookies and SSE simple for a real website feel.",
            "You can read every tool and the ReAct loop — learning project, not a black box.",
            "Landing pages ship with preview, ZIP, and auto images — useful demo output.",
            "Hindi / Bhojpuri + voice make it usable beyond English-only demos.",
            "Docker path means one deploy story for interviews, teachers, and clients.",
        ],
        29,
        size=17,
    )

    # 30
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(s, CREAM)
    stripe = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.28), H)
    stripe.fill.solid()
    stripe.fill.fore_color.rgb = ORANGE
    stripe.line.fill.background()
    star(s, Inches(0.85), Inches(1.5), Inches(0.62))
    textbox(s, Inches(0.85), Inches(2.3), Inches(12), Inches(0.9), "Thank you", 48, True, INK, font="Georgia")
    textbox(s, Inches(0.85), Inches(3.25), Inches(11.5), Inches(0.5), "Full stack: Next.js frontend · FastAPI backend · ReAct agent", 20, True, ORANGE_DARK)
    textbox(s, Inches(0.85), Inches(3.9), Inches(11.5), Inches(0.5), "Built and developed by Abhishek Mishra", 22, True, INK)
    textbox(s, Inches(0.85), Inches(4.6), Inches(11.5), Inches(0.5), "Questions or live demo — open the app and run the script.", 18, False, MUTED)
    textbox(s, Inches(0.85), Inches(5.5), Inches(11), Inches(0.35), "Local: http://127.0.0.1:3000", 18, True, INK)
    textbox(s, Inches(0.85), Inches(5.95), Inches(11), Inches(0.35), "Live: https://agentic-ai-d0cx.onrender.com", 16, False, MUTED)

    saved = []
    for path in (OUT, OUT_FULL, "Agentic_AI_Full_Briefing_v1.7.pptx"):
        try:
            prs.save(path)
            saved.append(path)
        except PermissionError:
            print("locked (close PowerPoint):", path)
    print("saved:", ", ".join(saved) if saved else "none")
    print("slides:", TOTAL)


if __name__ == "__main__":
    main()

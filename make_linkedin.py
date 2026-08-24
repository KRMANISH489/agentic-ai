from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1350
OUT = Path("Agentic_AI_LinkedIn.png")

PAPER = (247, 244, 239)
PAPER2 = (239, 234, 226)
WHITE = (255, 252, 248)
INK = (20, 18, 11)
MUTED = (111, 107, 99)
ORANGE = (217, 119, 87)
ORANGE_DARK = (138, 51, 28)
LINE = (230, 224, 214)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    names = []
    if bold:
        names += [
            r"C:\Windows\Fonts\georgiab.ttf",
            r"C:\Windows\Fonts\segoeuib.ttf",
            r"C:\Windows\Fonts\calibrib.ttf",
            r"C:\Windows\Fonts\arialbd.ttf",
        ]
    else:
        names += [
            r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\calibri.ttf",
            r"C:\Windows\Fonts\arial.ttf",
            r"C:\Windows\Fonts\georgia.ttf",
        ]
    for path in names:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def center(draw: ImageDraw.ImageDraw, text: str, y: int, fnt, fill=INK, width=W) -> None:
    box = draw.textbbox((0, 0), text, font=fnt)
    x = (width - (box[2] - box[0])) // 2
    draw.text((x, y), text, font=fnt, fill=fill)


def round_rect(draw: ImageDraw.ImageDraw, xy, r: int, fill, outline=None, width=1) -> None:
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def star(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, fill=ORANGE) -> None:
    pts = []
    import math

    for i in range(8):
        ang = math.radians(-90 + i * 45)
        rad = r if i % 2 == 0 else r * 0.42
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    draw.polygon(pts, fill=fill)


def arrow(draw: ImageDraw.ImageDraw, x1: int, y1: int, x2: int, y2: int) -> None:
    draw.line((x1, y1, x2, y2), fill=ORANGE, width=4)
    if x2 > x1:
        draw.polygon([(x2, y2), (x2 - 12, y2 - 8), (x2 - 12, y2 + 8)], fill=ORANGE)
    else:
        draw.polygon([(x2, y2), (x2 + 12, y2 - 8), (x2 + 12, y2 + 8)], fill=ORANGE)


def node(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, title: str, sub: str, fill=WHITE) -> None:
    round_rect(draw, (x, y, x + w, y + h), 22, fill, LINE, 2)
    tf = font(22, True)
    sf = font(16)
    tw = draw.textbbox((0, 0), title, font=tf)
    draw.text((x + (w - (tw[2] - tw[0])) // 2, y + 22), title, font=tf, fill=ORANGE_DARK)
    sw = draw.textbbox((0, 0), sub, font=sf)
    draw.text((x + (w - (sw[2] - sw[0])) // 2, y + 54), sub, font=sf, fill=MUTED)


def main() -> None:
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    d.rectangle((0, 0, W, 14), fill=ORANGE)
    d.rectangle((0, H - 14, W, H), fill=ORANGE)

    star(d, 540, 78, 28)
    title = ImageFont.truetype(r"C:\Windows\Fonts\georgia.ttf", 52)
    center(d, "AGENTIC AI", 108, title, INK)
    center(d, "A local agent that thinks, uses tools, and talks back", 172, font(22), MUTED)
    round_rect(d, (430, 214, 650, 258), 20, (244, 228, 220))
    center(d, "v1.4.0  ·  now with voice + edit", 222, font(16, True), ORANGE_DARK)

    # Flow
    y = 300
    round_rect(d, (56, y, 1024, y + 168), 28, WHITE, LINE, 2)
    node(d, 86, y + 28, 190, 112, "YOU", "type or speak")
    arrow(d, 290, y + 84, 328, y + 84)
    node(d, 340, y + 28, 190, 112, "AGENT", "thinks first")
    arrow(d, 544, y + 84, 582, y + 84)
    node(d, 594, y + 28, 190, 112, "TOOLS", "search · weather")
    arrow(d, 798, y + 84, 836, y + 84)
    node(d, 848, y + 28, 190, 112, "ANSWER", "clear + cited")

    # ReAct loop
    y = 500
    center(d, "How it works  ·  ReAct loop", y, font(24, True), INK)
    steps = [
        ("1  THINK", "Decide if a tool is needed"),
        ("2  ACT", "Call search, weather, math…"),
        ("3  OBSERVE", "Read the live result"),
        ("4  ANSWER", "Write like a teammate"),
    ]
    y = 552
    gap = 18
    bw = 226
    left = 56
    for i, (title, sub) in enumerate(steps):
        x = left + i * (bw + gap)
        round_rect(d, (x, y, x + bw, y + 118), 20, PAPER2 if i % 2 else WHITE, LINE, 2)
        d.ellipse((x + 16, y + 18, x + 40, y + 42), fill=ORANGE)
        tf, sf = font(18, True), font(15)
        draw = d
        draw.text((x + 52, y + 18), title, font=tf, fill=INK)
        draw.text((x + 20, y + 62), sub, font=sf, fill=MUTED)
        if i < 3:
            arrow(d, x + bw + 2, y + 59, x + bw + gap - 4, y + 59)

    # What's new
    y = 710
    center(d, "What’s new in v1.4.0", y, font(24, True), INK)
    cards = [
        ("Edit & retry", "Change a sent question.\nThe old reply drops.\nA new search starts."),
        ("Voice in", "Tap the mic.\nSpeak in English or Hindi.\nIt types, then sends."),
        ("Voice out", "Tap the speaker.\nHear the answer aloud.\nOr auto-read in Settings."),
    ]
    y = 758
    for i, (title, body) in enumerate(cards):
        x = 56 + i * (322 + 18)
        round_rect(d, (x, y, x + 322, y + 250), 24, WHITE, LINE, 2)
        d.rectangle((x, y, x + 322, y + 8), fill=ORANGE)
        d.text((x + 24, y + 28), title, font=font(24, True), fill=ORANGE_DARK)
        yy = y + 78
        for line in body.split("\n"):
            d.text((x + 24, yy), line, font=font(18), fill=INK)
            yy += 36

    # Stack
    y = 1040
    round_rect(d, (56, y, 1024, y + 88), 22, PAPER2)
    center(d, "Next.js   ·   FastAPI   ·   Groq   ·   runs on your machine", y + 28, font(20, True), INK)

    center(d, "From chatbot  to  teammate that can act", 1150, font(22, True), ORANGE_DARK)
    center(d, "Built locally  ·  Python  ·  no cloud app hosting", 1194, font(18), MUTED)

    img.save(OUT, "PNG", optimize=True)
    print(OUT.resolve())


if __name__ == "__main__":
    main()

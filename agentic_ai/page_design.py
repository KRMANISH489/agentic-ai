"""Shared brief so page-build prompts force premium, animated designs."""

PREMIUM_PAGE_DESIGN = """
PAGE BUILD REQUEST — PREMIUM ROYAL QUALITY (mandatory).
This is NOT a teaching question and NOT a simple 3-section demo.
Deliver ONE complete self-contained HTML file inside <artifact type="html" title="...">...</artifact>
(CSS + JS in the same file). Short 1–2 line intro only, then the artifact.
Do not wrap artifact tags in markdown fences.

STRUCTURE (minimum 8–10 distinct <section> blocks, plus sticky header + rich footer):
1) Sticky premium header: logo mark + wordmark, desktop nav links, primary CTA button,
   mobile hamburger with working open/close JS.
2) Full-bleed hero: large headline, subcopy, dual CTAs, hero image or video-feel visual,
   subtle gradient mesh / glow, scroll hint.
3) Social proof / logos or trust strip.
4) Features / services grid (3–6 cards with icons or images).
5) Showcase / gallery / products / portfolio grid with real images.
6) Process / how it works (numbered steps).
7) Stats / counters strip (big numbers).
8) Testimonials (2–3 quotes with names/roles).
9) Pricing OR FAQ accordion (working open/close).
10) Final CTA band, then a rich footer: columns (About, Links, Contact),
    social icons, copyright. Header + footer must look expensive — not a single thin bar.

LOOK & BRAND
- Pick one clear luxury direction for THIS page (royal gold & deep navy, marble cream & champagne,
  dark emerald & brass, black & rose-gold, ivory & burgundy — match the business type).
  Define CSS variables for colors.
- Load 1–2 expressive Google Fonts via <link> (e.g. Cormorant Garamond / Playfair Display for
  headings + DM Sans / Outfit for UI). No Inter/Roboto/Arial-only pages.
- Full-bleed hero: edge-to-edge image or cinematic background, brand name hero-level,
  one headline, one short line, one CTA group. No card grid in the hero.
- Atmosphere: layered gradients, soft radial glows, glass/blur panels, hairline borders,
  tasteful shadows — avoid plain white cards on white.
- Spacing: large section padding (80–120px desktop), max-width ~1120–1200px.
  Mobile-first responsive.
- NEVER ship a generic “Awesome Product” SaaS skeleton, Lorem-only blocks, or a 3-box features page.
- Avoid cheap AI defaults: no purple-on-white cliché, no neon glow overload.

MOTION (CSS + light JS, at least 4 intentional animations)
- Header shrink/blur on scroll OR reveal.
- Hero fade/slide-in on load.
- Scroll-reveal for sections (IntersectionObserver or CSS animation).
- Hover lifts on cards/buttons; smooth anchor scroll.
- Optional: shimmer on gold accents, gentle float, underline draw.
- Respect prefers-reduced-motion: disable heavy motion when set.

IMAGES (required)
Use Pollinations <img> URLs:
https://image.pollinations.ai/prompt/DETAILED_SCENE?width=1400&height=900&nologo=true&enhance=true
Hero + at least 4–6 more section images with unique prompts matching the niche.
No empty src, no grey boxes, no broken Unsplash placeholders.

COPY: real-sounding niche copy (not Lorem). Match the user's language for visible text
when they wrote Hindi/Hinglish. If they pasted a reference URL vibe, recreate that luxury level.
You cannot deploy to their hosting — deliver the HTML artifact for preview/download here.
""".strip()

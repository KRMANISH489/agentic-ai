/** Auto image URLs for generated landing pages (Pollinations, no API key). */

function slugSeed(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return String(hash || 42);
}

export function generatedImageUrl(prompt: string, width = 1400, height = 900, seed?: string) {
  const clean = prompt.replace(/\s+/g, " ").trim().slice(0, 220) || "modern website hero photography";
  const path = encodeURIComponent(clean);
  const s = seed || slugSeed(clean);
  return `https://image.pollinations.ai/prompt/${path}?width=${width}&height=${height}&nologo=true&enhance=true&seed=${s}`;
}

const EMPTY_SRC =
  /(?:src\s*=\s*["']\s*["'])|(?:src\s*=\s*["'](?:about:blank|#|placeholder|TODO|xxx)["'])/i;

function themeFromHtml(html: string, title: string) {
  const text = `${title} ${html}`.toLowerCase();
  if (/restaurant|cafe|food|menu|kitchen/.test(text)) return "restaurant food photography warm lighting";
  if (/shop|store|e-?commerce|fashion|product/.test(text)) return "premium product photography ecommerce";
  if (/portfolio|developer|designer|codabhi|agency/.test(text))
    return "modern dark developer portfolio workspace neon accents";
  if (/saas|software|app|dashboard/.test(text)) return "modern saas product dashboard UI mockup";
  if (/real\s*estate|property|home listing/.test(text)) return "luxury real estate exterior photography";
  if (/health|medical|clinic|doctor/.test(text)) return "modern healthcare clinic bright clean";
  if (/gym|fitness|workout/.test(text)) return "fitness gym training energy photography";
  if (/wedding|event|party/.test(text)) return "elegant event celebration photography";
  if (/course|education|learn|school/.test(text)) return "online learning education modern classroom";
  if (/ngo|nonprofit|charity/.test(text)) return "community impact people helping photography";
  if (/luxury|royal|premium|gold|hotel/.test(text)) return "luxury royal hotel interior gold accents";
  return "premium luxury website hero photography cinematic";
}

function imgTag(prompt: string, alt: string, width: number, height: number, seed: string) {
  const src = generatedImageUrl(prompt, width, height, seed);
  return `<img src="${src}" alt="${alt.replace(/"/g, "")}" width="${width}" height="${height}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:14px;" />`;
}

function countRealImages(html: string) {
  const matches = html.match(/<img\b[^>]*\bsrc\s*=\s*["']https?:\/\//gi);
  return matches?.length || 0;
}

function galleryStrip(theme: string, seed: string, start: number, need: number) {
  const cells: string[] = [];
  for (let i = 0; i < need; i++) {
    const n = start + i;
    cells.push(`<div style="aspect-ratio:4/3;overflow:hidden;border-radius:14px;">${imgTag(
      `${theme}, editorial photo ${n}, luxurious composition`,
      `Gallery ${n}`,
      1000,
      750,
      `${seed}-g${n}`
    )}</div>`);
  }
  return `
<section class="ai-gallery" aria-label="Gallery" style="padding:64px 24px;max-width:1120px;margin:0 auto;">
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
    ${cells.join("\n")}
  </div>
</section>`;
}

/** Ensure HTML pages have real AI-generated images (hero + extras). */
export function ensurePageImages(html: string, title = "Page"): string {
  if (!html || html.length < 80) return html;
  if (!/<(?:html|body|section|div|main|header|img)\b/i.test(html)) return html;

  const theme = themeFromHtml(html, title);
  const seed = slugSeed(title + theme);
  let out = html;
  let imgIndex = 0;

  out = out.replace(/<img\b([^>]*)>/gi, (full, raw: string) => {
    const attrs = String(raw);
    const srcMatch = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(attrs);
    const src = srcMatch?.[2]?.trim() || "";
    const broken =
      !src ||
      EMPTY_SRC.test(`src="${src}"`) ||
      /via\.placeholder|placehold\.it|example\.com|unsplash\.com\/photo-xxxx/i.test(src);
    if (!broken && /^https?:\/\//i.test(src)) return full;
    imgIndex += 1;
    const role =
      imgIndex === 1
        ? `${theme}, wide cinematic luxury hero`
        : `${theme}, premium supporting photo ${imgIndex}`;
    const w = imgIndex === 1 ? 1400 : 1000;
    const h = imgIndex === 1 ? 900 : 700;
    const url = generatedImageUrl(role, w, h, `${seed}-${imgIndex}`);
    if (srcMatch) return full.replace(srcMatch[0], `src="${url}"`);
    return `<img src="${url}"${attrs}>`;
  });

  let count = countRealImages(out);
  if (count === 0) {
    const hero = `
<figure class="ai-hero" style="margin:0;overflow:hidden;">
${imgTag(`${theme}, cinematic luxury website hero banner`, title || "Hero", 1600, 1000, `${seed}-hero`)}
</figure>`;
    if (/<body\b[^>]*>/i.test(out)) {
      out = out.replace(/<body\b[^>]*>/i, (m) => `${m}\n${hero}\n`);
    } else {
      out = `${hero}\n${out}`;
    }
    count = 1;
  }

  const minImages = 5;
  if (count < minImages) {
    const strip = galleryStrip(theme, seed, count + 1, minImages - count);
    if (/<\/footer\b/i.test(out)) {
      out = out.replace(/<footer\b/i, `${strip}\n<footer`);
    } else if (/<\/body\b/i.test(out)) {
      out = out.replace(/<\/body\b/i, `${strip}\n</body`);
    } else {
      out = `${out}\n${strip}`;
    }
  }

  return out;
}

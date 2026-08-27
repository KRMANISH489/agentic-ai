export type ArtifactKind = "html" | "svg" | "markdown" | "code";

export type Artifact = {
  id: string;
  title: string;
  type: ArtifactKind;
  language?: string;
  content: string;
};

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "artifact";
}

function attr(raw: string, name: string) {
  return new RegExp(`${name}=["']([^"']+)["']`, "i").exec(raw)?.[1]?.trim() || "";
}

function kindOf(type: string, language: string, content: string): ArtifactKind {
  const t = `${type} ${language}`.toLowerCase();
  const body = content.trim();
  if (t.includes("svg") || body.startsWith("<svg")) return "svg";
  if (t.includes("html") || t.includes("htm") || /<!doctype html|<html[\s>]/i.test(body)) return "html";
  if (t.includes("markdown") || t === "md" || language === "md") return "markdown";
  if (/^\s*</.test(body) && /<\/[a-z][\w:-]*>/i.test(body) && body.length > 180) return "html";
  return "code";
}

function titleFromContent(content: string, fallback: string) {
  const title = /<title[^>]*>([^<]+)<\/title>/i.exec(content)?.[1];
  const heading = /<h1[^>]*>([^<]+)<\/h1>/i.exec(content)?.[1];
  const clean = (title || heading || fallback).replace(/\s+/g, " ").trim();
  return clean.slice(0, 72) || fallback;
}

function isPreviewableFence(lang: string, content: string) {
  const lines = content.split(/\n/).length;
  if (lang === "svg" || content.trim().startsWith("<svg")) return content.length > 40;
  if (lang === "html" || lang === "htm") {
    return content.length >= 220 || lines >= 8 || /<!doctype html|<html[\s>]|<style[\s>]/i.test(content);
  }
  return false;
}

export function extractArtifacts(text: string): { artifacts: Artifact[]; displayText: string } {
  const artifacts: Artifact[] = [];
  let rest = text;

  rest = rest.replace(/<artifact\b([^>]*)>([\s\S]*?)<\/artifact>/gi, (_all, raw: string, inner: string) => {
    const type = attr(raw, "type");
    const language = attr(raw, "language");
    const content = inner.replace(/^\n+|\n+$/g, "");
    const kind = kindOf(type, language, content);
    const title = attr(raw, "title") || titleFromContent(content, kind === "html" ? "Page" : "Artifact");
    artifacts.push({
      id: `${slug(title)}-${artifacts.length}`,
      title,
      type: kind,
      language: language || (kind === "code" ? type || "text" : kind),
      content,
    });
    return "";
  });

  rest = rest.replace(/```([^\n]*)\n([\s\S]*?)```/g, (all, meta: string, inner: string) => {
    const content = String(inner).replace(/\s+$/, "");
    const parts = String(meta || "").trim().split(/\s+/);
    const head = (parts[0] || "").toLowerCase();
    if (head === "artifact") {
      const language = (parts[1] || "html").toLowerCase();
      const title = parts.slice(2).join(" ") || titleFromContent(content, "Artifact");
      const kind = kindOf(language, language, content);
      artifacts.push({
        id: `${slug(title)}-${artifacts.length}`,
        title,
        type: kind,
        language,
        content,
      });
      return "";
    }
    if (isPreviewableFence(head, content)) {
      const kind = kindOf(head, head, content);
      const title = titleFromContent(content, kind === "svg" ? "Graphic" : "Page");
      artifacts.push({
        id: `${slug(title)}-${artifacts.length}`,
        title,
        type: kind,
        language: head,
        content,
      });
      return "";
    }
    return all;
  });

  const displayText = rest.replace(/\n{3,}/g, "\n\n").trim();
  return { artifacts, displayText };
}

export function htmlDocument(content: string) {
  const body = content.trim();
  if (/<html[\s>]/i.test(body)) return body;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body { margin: 0; background: #fff; color: #1a1612; font-family: system-ui, sans-serif; }
</style>
</head>
<body>${body}</body>
</html>`;
}

export function svgDocument(content: string) {
  const body = content.trim();
  const svg = body.startsWith("<svg") ? body : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">${body}</svg>`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><style>html,body{margin:0;height:100%;display:grid;place-items:center;background:#fff}svg{max-width:100%;max-height:100%}</style></head>
<body>${svg}</body>
</html>`;
}

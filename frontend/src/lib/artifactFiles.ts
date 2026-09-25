import { htmlDocument, svgDocument, type Artifact } from "@/lib/artifacts";

function slug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "artifact";
}

function extFor(artifact: Artifact) {
  if (artifact.type === "html") return "html";
  if (artifact.type === "svg") return "svg";
  if (artifact.type === "markdown") return "md";
  const lang = (artifact.language || "txt").toLowerCase().replace(/[^a-z0-9]/g, "") || "txt";
  if (lang === "javascript" || lang === "js") return "js";
  if (lang === "typescript" || lang === "ts") return "ts";
  if (lang === "python" || lang === "py") return "py";
  if (lang === "css") return "css";
  if (lang === "json") return "json";
  if (lang === "html" || lang === "htm") return "html";
  return lang.slice(0, 8) || "txt";
}

export function artifactFileName(artifact: Artifact, used = new Set<string>()) {
  const base = slug(artifact.title);
  const ext = extFor(artifact);
  let name = `${base}.${ext}`;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base}-${n}.${ext}`;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

export function artifactFileBody(artifact: Artifact) {
  if (artifact.type === "html") return htmlDocument(artifact.content);
  if (artifact.type === "svg") {
    return artifact.content.trim().startsWith("<svg") ? artifact.content : svgDocument(artifact.content);
  }
  return artifact.content;
}

export function artifactMime(artifact: Artifact) {
  if (artifact.type === "html") return "text/html;charset=utf-8";
  if (artifact.type === "svg") return "image/svg+xml;charset=utf-8";
  if (artifact.type === "markdown") return "text/markdown;charset=utf-8";
  return "text/plain;charset=utf-8";
}

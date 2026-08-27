"use client";

import { marked } from "marked";
import { useMemo, useState } from "react";
import { htmlDocument, svgDocument, type Artifact } from "@/lib/artifacts";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function ArtifactPane({
  artifacts,
  activeId,
  onSelect,
  onClose,
}: {
  artifacts: Artifact[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const active = artifacts.find((a) => a.id === activeId) || artifacts[artifacts.length - 1];
  const canPreview = active.type === "html" || active.type === "svg" || active.type === "markdown";
  const [mode, setMode] = useState<"preview" | "code">("preview");
  const view = canPreview ? mode : "code";

  const previewDoc = useMemo(() => {
    if (!active) return "";
    if (active.type === "html") return htmlDocument(active.content);
    if (active.type === "svg") return svgDocument(active.content);
    if (active.type === "markdown") {
      const markup = marked.parse(active.content, { async: false, gfm: true, breaks: true }) as string;
      return htmlDocument(`<article class="md-preview" style="max-width:720px;margin:32px auto;padding:0 24px;line-height:1.65">${markup}</article>`);
    }
    return "";
  }, [active]);

  if (!active) return null;

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(active.content);
    } catch {
      /* ignore */
    }
  }

  function openTab() {
    const doc = canPreview ? previewDoc : htmlDocument(`<pre style="padding:24px;white-space:pre-wrap">${escapeHtml(active.content)}</pre>`);
    const blob = new Blob([doc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function downloadFile() {
    const slug = active.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "artifact";
    let name = `${slug}.txt`;
    let body = active.content;
    let mime = "text/plain;charset=utf-8";
    if (active.type === "html") {
      name = `${slug}.html`;
      body = htmlDocument(active.content);
      mime = "text/html;charset=utf-8";
    } else if (active.type === "svg") {
      name = `${slug}.svg`;
      body = active.content.trim().startsWith("<svg") ? active.content : svgDocument(active.content);
      mime = "image/svg+xml;charset=utf-8";
    } else if (active.type === "markdown") {
      name = `${slug}.md`;
      mime = "text/markdown;charset=utf-8";
    } else {
      const lang = (active.language || "txt").replace(/[^a-z0-9]/gi, "") || "txt";
      name = `${slug}.${lang === "javascript" ? "js" : lang === "typescript" ? "ts" : lang === "python" ? "py" : lang}`;
    }
    const blob = new Blob([body], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <aside className="artifact-pane" aria-label="Artifacts">
      <header className="artifact-head">
        <div className="artifact-titles">
          <span className="artifact-kicker">Artifact</span>
          <strong>{active.title}</strong>
        </div>
        <div className="artifact-tools">
          {canPreview ? (
            <div className="artifact-toggle">
              <button type="button" className={view === "preview" ? "on" : ""} onClick={() => setMode("preview")}>
                Preview
              </button>
              <button type="button" className={view === "code" ? "on" : ""} onClick={() => setMode("code")}>
                Code
              </button>
            </div>
          ) : null}
          <button type="button" className="artifact-icon" onClick={() => void copyContent()} title="Copy">
            Copy
          </button>
          <button type="button" className="artifact-icon download" onClick={downloadFile} title="Download file">
            Download
          </button>
          <button type="button" className="artifact-icon" onClick={openTab} title="Open in new tab">
            Open
          </button>
          <button type="button" className="artifact-icon close" onClick={onClose} aria-label="Close artifacts">
            ×
          </button>
        </div>
      </header>
      {artifacts.length > 1 ? (
        <div className="artifact-tabs">
          {artifacts.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === active.id ? "on" : ""}
              onClick={() => {
                onSelect(item.id);
                setMode("preview");
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
      ) : null}
      <div className="artifact-body">
        {view === "preview" && canPreview ? (
          <iframe
            className="artifact-frame"
            title={active.title}
            sandbox="allow-scripts allow-forms allow-modals"
            srcDoc={previewDoc}
          />
        ) : (
          <pre className="artifact-code">
            <code>{active.content}</code>
          </pre>
        )}
      </div>
    </aside>
  );
}

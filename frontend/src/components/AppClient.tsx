"use client";

import { FormEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
import { marked, type Tokens } from "marked";
import { ArtifactPane } from "@/components/ArtifactPane";
import { Logo } from "@/components/Logo";
import { extractArtifacts, type Artifact } from "@/lib/artifacts";
import { applyPhotoBackground, BG_SWATCHES } from "@/lib/photoBg";
import type { AppState, ChatItem, ChatMessage, Project, ProjectFile, ToolItem, User } from "@/lib/types";

const STORE_KEY = "agentic.chats.v1";
const PROJECTS_KEY = "agentic.projects.v1";
const FOCUS_KEY = "agentic.focus.v1";
const MODE_LABELS: Record<string, string> = {
  agent: "Single agent",
  crew: "Researcher + Writer",
};

const LANDING_TYPES = [
  { id: "saas", title: "SaaS / product", sections: "nav, hero, logos, feature grid, how it works, pricing, testimonials, FAQ, strong CTA footer" },
  { id: "shop", title: "Shop / store", sections: "nav, offer banner, featured products, categories, reviews, WhatsApp/order CTA, footer with hours" },
  { id: "restaurant", title: "Restaurant / cafe", sections: "hero, menu highlights, about the kitchen, reservation or WhatsApp, location/hours, Instagram strip, footer" },
  { id: "portfolio", title: "Portfolio", sections: "name/intro, selected work grid, case-study teasers, skills, contact form, footer" },
  { id: "agency", title: "Agency / studio", sections: "bold hero, services, process, case studies, team, contact CTA, footer" },
  { id: "event", title: "Event / wedding", sections: "date countdown feel, story, schedule, venue, RSVP/form, gallery, footer" },
  { id: "app", title: "Mobile app", sections: "phone mock hero, features, screenshots, download badges, reviews, FAQ, footer" },
  { id: "course", title: "Course / coaching", sections: "promise hero, curriculum, instructor, testimonials, pricing, enroll CTA, FAQ" },
  { id: "realestate", title: "Real estate", sections: "search-style hero, featured listings, neighborhoods, agent bio, inquiry form, footer" },
  { id: "fashion", title: "Fashion / brand", sections: "full-bleed lookbook hero, collections, editorial story, shop CTA, newsletter, footer" },
  { id: "fitness", title: "Gym / fitness", sections: "energy hero, class timetable, trainers, memberships, trial CTA, footer" },
  { id: "ngo", title: "Nonprofit / NGO", sections: "mission hero, impact numbers, programs, stories, donate CTA, footer" },
];

function landingPrompt(kind: (typeof LANDING_TYPES)[number], lang: string) {
  const speak =
    lang === "hi" ? "Write visible page copy in Hindi." : lang === "bho" ? "Write visible page copy in Bhojpuri." : "Write visible page copy in English.";
  return [
    `Create a complete landing page of this exact type: ${kind.title}.`,
    `Sections to include: ${kind.sections}.`,
    "One self-contained HTML file with CSS inside a <style> tag. No external CSS/JS frameworks or stock Unsplash URLs that 404 — use CSS gradients, shapes, and placeholder blocks instead of broken images.",
    "Mobile-first and desktop layouts. Distinct look for this type — do not reuse a generic “Awesome Product” SaaS template.",
    speak,
    'Put the full file in an artifact: <artifact type="html" title="' + kind.title + ' landing"> ... </artifact>',
  ].join(" ");
}

function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean || "New chat";
}

function friendlyStatus(text: string) {
  if (text.startsWith("tool:web_search")) return "Searching the web…";
  if (text.startsWith("tool:weather")) return "Checking the weather…";
  if (text.startsWith("tool:calculator")) return "Calculating…";
  if (text.startsWith("tool:wikipedia")) return "Reading Wikipedia…";
  if (text.startsWith("tool:current_time")) return "Checking the time…";
  if (text.startsWith("tool:github")) return "Looking up GitHub…";
  if (text.startsWith("tool:dice_roll")) return "Rolling dice…";
  if (text.startsWith("tool:unit_convert")) return "Converting units…";
  if (text.startsWith("tool:text_stats")) return "Counting text…";
  if (text.startsWith("tool:uuid_generate")) return "Generating IDs…";
  if (text.startsWith("tool:notes_write")) return "Saving a note…";
  if (text.startsWith("tool:code_run")) return "Running code…";
  if (text.startsWith("tool:random_pick")) return "Picking an option…";
  if (text.startsWith("tool:")) return "Using a tool…";
  return "Thinking…";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapCodeBlocks(markup: string) {
  if (markup.includes("class=\"code-block\"") || markup.includes("class='code-block'")) return markup;
  return markup.replace(/<pre>([\s\S]*?)<\/pre>/gi, (_all, inner: string) => {
    return `<div class="code-block"><div class="code-bar"><span>code</span><button type="button" class="copy-code">Copy</button></div><pre>${inner}</pre></div>`;
  });
}

function html(text: string) {
  const renderer = new marked.Renderer();
  renderer.code = ({ text: code, lang }: Tokens.Code) => {
    const language = (lang || "").trim().split(/\s+/)[0] || "code";
    return `<div class="code-block"><div class="code-bar"><span>${escapeHtml(language)}</span><button type="button" class="copy-code">Copy</button></div><pre><code>${escapeHtml(code)}</code></pre></div>`;
  };
  const markup = marked.parse(text, {
    async: false,
    gfm: true,
    breaks: true,
    renderer,
  }) as string;
  return wrapCodeBlocks(markup);
}

function codeFromReply(text: string) {
  const blocks = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1].replace(/\s+$/, ""));
  if (blocks.length) return blocks.join("\n\n");
  return text.trim();
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
}

type PendingPhoto = { id: string; name: string; dataUrl: string; originalDataUrl: string };
type PendingFile = { id: string; name: string; text: string };

function wrapFileBlock(name: string, text: string) {
  return `---file:${name}---\n${text}\n---end-file---`;
}

function parseUserFiles(text: string) {
  const files: string[] = [];
  const caption = text
    .replace(/\n*---file:(.*?)---\n[\s\S]*?\n---end-file---/g, (_all, name: string) => {
      files.push(String(name).trim());
      return "";
    })
    .replace(/\n\[Photo attached\]\s*$/, "")
    .trim();
  return { caption: caption || (files.length ? files.join(", ") : text), files };
}

async function fileToJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that photo."));
      el.src = url;
    });
    const max = 1280;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process that photo.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function speakable(text: string) {
  return text
    .replace(/<artifact\b[\s\S]*?<\/artifact>/gi, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_>~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Bubble = {
  id: string;
  role: "user" | "agent";
  html: string;
  text?: string;
  images?: string[];
  files?: string[];
  artifacts?: Artifact[];
  trace?: string;
  error?: boolean;
  thinking?: boolean;
};

function agentFromText(id: string, text: string, extra: Partial<Bubble> = {}): Bubble {
  const parsed = extractArtifacts(text);
  const artifacts: Artifact[] = parsed.artifacts.map((item, index) => ({
    ...item,
    id: `${id}-${index}`,
  }));
  return {
    id,
    role: "agent",
    html: html(parsed.displayText || (artifacts.length ? "Opened in Artifacts." : text)),
    text,
    artifacts: artifacts.length ? artifacts : undefined,
    ...extra,
    ...(artifacts.length ? { artifacts } : {}),
  };
}

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  const w = window as Window & { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function ToolIcon({ name }: { name: string }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 };
  switch (name) {
    case "wiki":
      return (
        <svg {...common}>
          <path d="M4 19V5h16v14H4z" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      );
    case "weather":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.68 7.68 0 0 1 8 3.64c.64 0 1.28.09 1.88.26 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
      );
    case "calc":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "notes":
      return (
        <svg {...common}>
          <path d="M7 3h8l5 5v13H7z" />
          <path d="M15 3v5h5M9 13h6M9 17h4" />
        </svg>
      );
    case "code":
      return (
        <svg {...common}>
          <path d="M8 8l-4 4 4 4M16 8l4 4-4 4" />
        </svg>
      );
    case "dice":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <circle cx="9" cy="9" r="1" fill="currentColor" />
          <circle cx="15" cy="15" r="1" fill="currentColor" />
        </svg>
      );
    case "convert":
      return (
        <svg {...common}>
          <path d="M7 7h11l-3-3M17 17H6l3 3" />
        </svg>
      );
    case "text":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h10M4 17h13" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <circle cx="8" cy="12" r="4" />
          <path d="M12 12h9M18 12v3M21 12v2" />
        </svg>
      );
    case "shuffle":
      return (
        <svg {...common}>
          <path d="M16 3h5v5M4 20l7-7M21 3l-7 7M16 21h5v-5M4 4l5 5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
      );
  }
}

export default function AppClient() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [oauthReady, setOauthReady] = useState({ google: false, github: false });
  const [pendingOauth, setPendingOauth] = useState<"" | "google" | "github">("");
  const [loginName, setLoginName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginError, setLoginError] = useState("");
  const [oauthId, setOauthId] = useState("");
  const [oauthSecret, setOauthSecret] = useState("");
  const [oauthError, setOauthError] = useState("");
  const [oauthSaving, setOauthSaving] = useState(false);

  const [appState, setAppState] = useState<AppState>({
    ok: true,
    version: "—",
    prefs: { show_thinking: true, enter_to_send: true },
    tools: [],
  });
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>("");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [mode, setMode] = useState("agent");
  const [workFocus, setWorkFocus] = useState<"chat" | "code">("chat");
  const [modeOpen, setModeOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState("en");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesList, setNotesList] = useState<{ name: string; chars: number; updated: number }[]>([]);
  const [noteName, setNoteName] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [settingsTab, setSettingsTab] = useState<"tools" | "features" | "teach" | "about">("tools");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voiceHint, setVoiceHint] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [landingOpen, setLandingOpen] = useState(false);
  const [bgEditId, setBgEditId] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState("#dacebe");
  const [bgImageUrl, setBgImageUrl] = useState("");
  const [bgCutout, setBgCutout] = useState(true);
  const [bgTransparent, setBgTransparent] = useState(false);
  const [bgFit, setBgFit] = useState<"contain" | "cover">("contain");
  const [bgBusy, setBgBusy] = useState(false);
  const [bgPreviewUrl, setBgPreviewUrl] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [teachInst, setTeachInst] = useState("");
  const [teachMem, setTeachMem] = useState("");
  const [teachBusy, setTeachBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [artifactOpen, setArtifactOpen] = useState(false);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const skipAutoSendRef = useRef(false);
  const voiceBaseRef = useRef("");
  const voiceFinalRef = useRef("");
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const teachFileRef = useRef<HTMLInputElement>(null);
  const projectFileRef = useRef<HTMLInputElement>(null);
  const cameraFileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const visibleArtifacts = bubbles.flatMap((b) => b.artifacts || []);
  const lastArtifactId = visibleArtifacts.at(-1)?.id || null;
  const showArtifact = artifactOpen && visibleArtifacts.length > 0;
  const paneArtifactId =
    (activeArtifactId && visibleArtifacts.some((a) => a.id === activeArtifactId) && activeArtifactId) ||
    lastArtifactId ||
    "";
  const lastAgentId = [...bubbles].reverse().find((b) => b.role === "agent" && !b.thinking && !b.error && b.text)?.id;
  const currentProject = projects.find((p) => p.id === currentProjectId) || null;
  const historyNeedle = historyQuery.trim().toLowerCase();
  const scopedChats = currentProjectId ? chats.filter((c) => c.projectId === currentProjectId) : chats;
  const visibleChats = scopedChats.filter((c) => {
    if (!historyNeedle) return true;
    if (c.title.toLowerCase().includes(historyNeedle)) return true;
    return c.messages.some((m) => m.content.toLowerCase().includes(historyNeedle));
  });

  useEffect(() => {
    try {
      setChats(JSON.parse(localStorage.getItem(STORE_KEY) || "[]"));
    } catch {
      setChats([]);
    }
    try {
      const raw = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
      setProjects(Array.isArray(raw) ? raw : []);
    } catch {
      setProjects([]);
    }
    const savedFocus = localStorage.getItem(FOCUS_KEY);
    if (savedFocus === "code" || savedFocus === "chat") setWorkFocus(savedFocus);
  }, []);

  useEffect(() => {
    if (ready && user) localStorage.setItem(STORE_KEY, JSON.stringify(chats));
  }, [chats, ready, user]);

  useEffect(() => {
    if (ready && user) localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }, [projects, ready, user]);

  useEffect(() => {
    if (!lastArtifactId) {
      setArtifactOpen(false);
      setActiveArtifactId(null);
      return;
    }
    setActiveArtifactId(lastArtifactId);
    setArtifactOpen(true);
  }, [lastArtifactId]);

  useEffect(() => {
    if (!settingsOpen) return;
    setTeachInst(appState.prefs?.teach_instructions || "");
    setTeachMem(appState.prefs?.teach_memory || "");
  }, [settingsOpen, appState.prefs?.teach_instructions, appState.prefs?.teach_memory]);

  useEffect(() => {
    if (!bgEditId) {
      setBgPreviewUrl("");
      return;
    }
    const photo = pendingPhotos.find((p) => p.id === bgEditId);
    if (!photo) return;
    const source = photo.originalDataUrl || photo.dataUrl;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void applyPhotoBackground({
        sourceUrl: source,
        color: bgColor,
        bgImageUrl: bgImageUrl || undefined,
        cutout: bgCutout,
        transparentOnly: bgTransparent,
        fit: bgFit,
        fast: true,
      })
        .then((result) => {
          if (!cancelled) setBgPreviewUrl(result.dataUrl);
        })
        .catch(() => {
          if (!cancelled) setBgPreviewUrl(source);
        });
    }, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bgEditId, bgColor, bgImageUrl, bgCutout, bgTransparent, bgFit, pendingPhotos]);

  useEffect(() => {
    async function boot() {
      const oauthErr = new URLSearchParams(window.location.search).get("oauth_error");
      if (oauthErr) {
        setPendingOauth("google");
        setOauthError(oauthErr);
        window.history.replaceState({}, "", "/");
      }
      const res = await fetch("/api/me", { credentials: "include" });
      const data = await res.json();
      setOauthReady(data.oauth || { google: false, github: false });
      if (data.user) {
        setUser(data.user);
        await loadStatus();
      }
      setReady(true);
    }
    void boot();
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      if (el?.closest(".mode-picker") || el?.closest(".user-dock") || el?.closest(".attach-picker")) return;
      setModeOpen(false);
      setUserOpen(false);
      setAttachOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setNavOpen(false);
        setSettingsOpen(false);
        setHelpOpen(false);
        setAttachOpen(false);
        setLandingOpen(false);
        setBgEditId(null);
        closeCamera();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        if (user) setSettingsOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [user]);

  useEffect(() => {
    if (!editingId || !editRef.current) return;
    const el = editRef.current;
    el.focus();
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editingId]);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
      window.speechSynthesis?.cancel();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function loadStatus() {
    const res = await fetch("/api/status", { credentials: "include" });
    const data = (await res.json()) as AppState;
    setAppState(data);
    if (data.prefs?.default_mode) setMode(data.prefs.default_mode);
    return data;
  }

  async function localLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/auth/local", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: loginName.trim(), email: loginEmail.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoginError(typeof data.detail === "string" ? data.detail : "Enter your name and a valid email.");
      return;
    }
    setUser(data.user);
    await loadStatus();
  }

  async function saveOauth(e: FormEvent) {
    e.preventDefault();
    if (!pendingOauth || !oauthId.trim() || !oauthSecret.trim()) {
      setOauthError("Enter the Client ID and Client Secret.");
      return;
    }
    setOauthSaving(true);
    setOauthError("Saving…");
    try {
      const payload =
        pendingOauth === "google"
          ? { google_client_id: oauthId.trim(), google_client_secret: oauthSecret.trim() }
          : { github_client_id: oauthId.trim(), github_client_secret: oauthSecret.trim() };
      const res = await fetch("/api/auth/keys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail;
        setOauthError(typeof detail === "string" ? detail : "Could not save those keys. Try again.");
        return;
      }
      const next = data.oauth || oauthReady;
      setOauthReady(next);
      if (!next[pendingOauth]) {
        setOauthError("Could not save those keys. Try again.");
        return;
      }
      window.location.href = pendingOauth === "google" ? "/auth/google" : "/auth/github";
    } catch (err) {
      setOauthError(String(err));
    } finally {
      setOauthSaving(false);
    }
  }

  function showMessages(messages: ChatMessage[]) {
    setEditingId(null);
    setBubbles(
      messages.map((m, i) => {
        const id = `${i}-${m.role}`;
        if (m.role === "user") {
          const parsed = parseUserFiles(m.content);
          return {
            id,
            role: "user" as const,
            html: html(parsed.caption),
            text: parsed.caption,
            files: parsed.files.length ? parsed.files : undefined,
          };
        }
        return agentFromText(id, m.content);
      })
    );
  }

  async function newChat() {
    await fetch("/api/reset", { method: "POST", credentials: "include" });
    setCurrentId(null);
    setBubbles([]);
    setNavOpen(false);
  }

  async function selectChat(id: string) {
    const item = chats.find((c) => c.id === id);
    if (!item) return;
    setCurrentId(id);
    setMode(item.mode || "agent");
    showMessages(item.messages);
    setNavOpen(false);
    await fetch("/api/reset", { method: "POST", credentials: "include" });
  }

  async function deleteChat(id: string) {
    const next = chats.filter((c) => c.id !== id);
    setChats(next);
    if (currentId === id) {
      setCurrentId(null);
      setBubbles([]);
      await fetch("/api/reset", { method: "POST", credentials: "include" });
    }
  }

  function patchProject(id: string, patch: Partial<Project>) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function selectProject(id: string) {
    setCurrentProjectId(id);
    const chat = chats.find((c) => c.id === currentId);
    if (id && chat && chat.projectId !== id) {
      await newChat();
    }
  }

  async function addProject() {
    const project: Project = {
      id: crypto.randomUUID(),
      name: `Project ${projects.length + 1}`,
      instructions: "",
      files: [],
    };
    setProjects((prev) => [project, ...prev]);
    setCurrentProjectId(project.id);
    await newChat();
  }

  async function removeProject(id: string) {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    if (!window.confirm(`Delete “${project.name}”? Chats stay in Recents.`)) return;
    setChats((prev) => prev.map((c) => (c.projectId === id ? { ...c, projectId: undefined } : c)));
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (currentProjectId === id) setCurrentProjectId("");
  }

  async function addProjectFiles(files: FileList | File[]) {
    if (!currentProject) return;
    const room = Math.max(0, 8 - currentProject.files.length);
    if (!room) {
      setVoiceHint("A project can hold up to 8 files.");
      return;
    }
    try {
      const next: ProjectFile[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/extract", { method: "POST", credentials: "include", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data.detail === "string" ? data.detail : "Could not read that file.");
        }
        next.push({
          id: crypto.randomUUID(),
          title: String(data.name || file.name).slice(0, 80),
          text: String(data.text || "").slice(0, 12000),
        });
      }
      patchProject(currentProject.id, { files: [...currentProject.files, ...next].slice(0, 8) });
      setVoiceHint("");
    } catch (err) {
      setVoiceHint(err instanceof Error ? err.message : "Could not add that file.");
    }
  }

  function dropProjectFile(fileId: string) {
    if (!currentProject) return;
    patchProject(currentProject.id, { files: currentProject.files.filter((f) => f.id !== fileId) });
  }

  async function refreshNotes() {
    const res = await fetch("/api/notes", { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    setNotesList(Array.isArray(data.notes) ? data.notes : []);
  }

  async function openNotes() {
    setUserOpen(false);
    setNavOpen(false);
    setNotesOpen(true);
    setNoteName(null);
    setNoteBody("");
    await refreshNotes();
  }

  async function openNote(name: string) {
    const res = await fetch(`/api/notes/${encodeURIComponent(name)}`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setVoiceHint(typeof data.detail === "string" ? data.detail : "Could not open that note.");
      return;
    }
    setNoteName(String(data.name || name));
    setNoteBody(String(data.content || ""));
  }

  async function removeNote(name: string) {
    if (!window.confirm(`Delete ${name}?`)) return;
    const res = await fetch(`/api/notes/${encodeURIComponent(name)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setVoiceHint(typeof data.detail === "string" ? data.detail : "Could not delete that note.");
      return;
    }
    setNotesList(Array.isArray(data.notes) ? data.notes : []);
    if (noteName === name) {
      setNoteName(null);
      setNoteBody("");
    }
  }

  function downloadNote() {
    if (!noteName) return;
    const blob = new Blob([noteBody], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = noteName;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function ensureChat(firstMessage: string, list: ChatItem[]) {
    let item = list.find((c) => c.id === currentId);
    const copy = [...list];
    if (!item) {
      item = {
        id: crypto.randomUUID(),
        title: titleFrom(firstMessage),
        mode,
        updatedAt: Date.now(),
        messages: [],
        projectId: currentProjectId || undefined,
      };
      copy.unshift(item);
      setCurrentId(item.id);
    } else if (!item.messages.length) {
      item = { ...item, title: titleFrom(firstMessage) };
      const idx = copy.findIndex((c) => c.id === item!.id);
      copy[idx] = item;
    }
    item = { ...item, updatedAt: Date.now(), mode };
    const idx = copy.findIndex((c) => c.id === item!.id);
    copy[idx] = item;
    return { item, copy };
  }

  function textOf(b: Bubble) {
    if (b.text?.trim()) return b.text.trim();
    const tmp = document.createElement("div");
    tmp.innerHTML = b.html || "";
    return (tmp.textContent || "").trim();
  }

  async function runChatTurn(
    message: string,
    history: ChatMessage[],
    item: ChatItem,
    copy: ChatItem[],
    resetBubbles?: Bubble[],
    resetMemory = false,
    images: string[] = []
  ) {
    const stored = images.length ? `${message}\n[Photo attached]` : message;
    const shown = parseUserFiles(message);
    const nextItem: ChatItem = {
      ...item,
      updatedAt: Date.now(),
      messages: [...history, { role: "user", content: stored }],
    };
    setChats(copy.map((c) => (c.id === nextItem.id ? nextItem : c)));
    const agentId = crypto.randomUUID();
    const userBubble: Bubble = {
      id: crypto.randomUUID(),
      role: "user",
      html: html(shown.caption),
      text: shown.caption,
      files: shown.files.length ? shown.files : undefined,
      images: images.length ? images : undefined,
    };
    const agentBubble: Bubble = {
      id: agentId,
      role: "agent",
      html: "Thinking…",
      thinking: true,
      trace: "",
    };
    if (resetBubbles) setBubbles([...resetBubbles, userBubble, agentBubble]);
    else setBubbles((prev) => [...prev, userBubble, agentBubble]);
    setSending(true);
    const project = projects.find((p) => p.id === (item.projectId || currentProjectId));
    try {
      if (resetMemory) {
        await fetch("/api/reset", { method: "POST", credentials: "include" });
      }
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          mode,
          history,
          images,
          lang,
          focus: workFocus,
          project_name: project?.name || "",
          project_instructions: project?.instructions || "",
          project_files: (project?.files || []).map((file) => ({ title: file.title, text: file.text })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.detail === "string" ? data.detail : `Chat failed (${res.status})`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          const line = chunk.replace(/^data: /, "").trim();
          if (!line) continue;
          const event = JSON.parse(line) as { type: string; content: string };
          if (event.type === "trace") {
            setBubbles((prev) =>
              prev.map((b) =>
                b.id === agentId
                  ? {
                      ...b,
                      html: appState.prefs?.show_thinking === false ? "Thinking…" : "",
                      trace: appState.prefs?.show_thinking === false ? "" : friendlyStatus(event.content),
                    }
                  : b
              )
            );
          } else if (event.type === "answer") {
            setBubbles((prev) =>
              prev.map((b) =>
                b.id === agentId ? agentFromText(agentId, event.content, { thinking: false, trace: "" }) : b
              )
            );
            setChats((prev) =>
              prev.map((c) =>
                c.id === nextItem.id
                  ? {
                      ...c,
                      updatedAt: Date.now(),
                      messages: [...c.messages, { role: "assistant", content: event.content }],
                    }
                  : c
              )
            );
            if (appState.prefs?.voice_read_aloud) startSpeak(agentId, event.content);
          } else if (event.type === "error") {
            setBubbles((prev) =>
              prev.map((b) =>
                b.id === agentId ? { ...b, html: event.content, error: true, thinking: false, trace: "" } : b
              )
            );
          }
        }
        if (stageRef.current) stageRef.current.scrollTop = stageRef.current.scrollHeight;
      }
    } catch (err) {
      setBubbles((prev) =>
        prev.map((b) =>
          b.id === agentId ? { ...b, html: String(err), error: true, thinking: false } : b
        )
      );
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function sendMessage(e?: FormEvent, spoken?: string) {
    e?.preventDefault();
    stopListening(true);
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
    const message = (spoken ?? input).trim();
    if ((!message && !pendingPhotos.length && !pendingFiles.length) || sending) return;
    const photos = pendingPhotos.map((p) => p.dataUrl);
    const fileBlocks = pendingFiles.map((file) => wrapFileBlock(file.name, file.text)).join("\n\n");
    const caption =
      message ||
      (pendingFiles.length ? `Read ${pendingFiles.map((f) => f.name).join(", ")}` : "") ||
      (photos.length > 1 ? "What is in these photos?" : "What is in this photo?");
    const prompt = fileBlocks ? `${caption}\n\n${fileBlocks}` : caption;
    setEditingId(null);
    setInput("");
    setPendingPhotos([]);
    setPendingFiles([]);
    setAttachOpen(false);
    if (inputRef.current) inputRef.current.style.height = "auto";
    const { item, copy } = ensureChat(caption, chats);
    const history = item.messages.map((m) => ({ role: m.role, content: m.content }));
    await runChatTurn(prompt, history, item, copy, undefined, false, photos);
  }

  function openLandingPicker() {
    if (sending) return;
    setAttachOpen(false);
    setLandingOpen(true);
  }

  function requestLanding(kind: (typeof LANDING_TYPES)[number]) {
    setLandingOpen(false);
    void sendMessage(undefined, landingPrompt(kind, lang));
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function addPhotoFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!list.length) return;
    const room = Math.max(0, 4 - pendingPhotos.length);
    if (!room) {
      setVoiceHint("You can attach up to 4 photos.");
      return;
    }
    try {
      const next: PendingPhoto[] = [];
      for (const file of list.slice(0, room)) {
        const dataUrl = await fileToJpeg(file);
        next.push({
          id: crypto.randomUUID(),
          name: file.name || "photo.jpg",
          dataUrl,
          originalDataUrl: dataUrl,
        });
      }
      setPendingPhotos((prev) => [...prev, ...next].slice(0, 4));
      setVoiceHint("");
    } catch (err) {
      setVoiceHint(err instanceof Error ? err.message : "Could not add that photo.");
    }
  }

  async function addDocFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    const room = Math.max(0, 4 - pendingFiles.length);
    if (!room) {
      setVoiceHint("You can attach up to 4 files.");
      return;
    }
    try {
      const next: PendingFile[] = [];
      for (const file of list.slice(0, room)) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/extract", { method: "POST", credentials: "include", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data.detail === "string" ? data.detail : "Could not read that file.");
        }
        next.push({ id: crypto.randomUUID(), name: data.name || file.name, text: String(data.text || "") });
      }
      setPendingFiles((prev) => [...prev, ...next].slice(0, 4));
      setVoiceHint("");
    } catch (err) {
      setVoiceHint(err instanceof Error ? err.message : "Could not add that file.");
    }
  }

  async function openCamera() {
    setAttachOpen(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraFileRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      cameraFileRef.current?.click();
    }
  }

  function snapPhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    const max = 1280;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    closeCamera();
    setPendingPhotos((prev) => {
      if (prev.length >= 4) return prev;
      return [...prev, { id: crypto.randomUUID(), name: "camera.jpg", dataUrl, originalDataUrl: dataUrl }];
    });
  }

  function openBgEditor(photo: PendingPhoto) {
    setBgEditId(photo.id);
    setBgColor("#dacebe");
    setBgImageUrl("");
    setBgCutout(true);
    setBgTransparent(false);
    setBgFit("contain");
  }

  function closeBgEditor() {
    if (bgImageUrl.startsWith("blob:")) URL.revokeObjectURL(bgImageUrl);
    setBgImageUrl("");
    setBgEditId(null);
    setBgBusy(false);
    setBgPreviewUrl("");
  }

  async function downloadBgEdit() {
    const photo = pendingPhotos.find((p) => p.id === bgEditId);
    if (!photo) return;
    setBgBusy(true);
    setVoiceHint(bgCutout ? "Making the photo transparent… first time can take a minute." : "");
    try {
      const result = await applyPhotoBackground({
        sourceUrl: photo.originalDataUrl || photo.dataUrl,
        color: bgColor,
        bgImageUrl: bgImageUrl || undefined,
        cutout: bgCutout,
        transparentOnly: bgTransparent,
        fit: bgFit,
      });
      setPendingPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, dataUrl: result.dataUrl } : p)));
      const a = document.createElement("a");
      a.href = result.dataUrl;
      a.download = `${photo.name.replace(/\.[^.]+$/, "") || "photo"}-bg.${result.ext}`;
      a.click();
      setVoiceHint("");
    } catch (err) {
      setVoiceHint(err instanceof Error ? err.message : "Could not download that photo.");
    } finally {
      setBgBusy(false);
    }
  }

  async function applyBgEdit() {
    const photo = pendingPhotos.find((p) => p.id === bgEditId);
    if (!photo) return;
    setBgBusy(true);
    setVoiceHint(bgCutout ? "Making the photo transparent… first time can take a minute." : "");
    try {
      const result = await applyPhotoBackground({
        sourceUrl: photo.originalDataUrl || photo.dataUrl,
        color: bgColor,
        bgImageUrl: bgImageUrl || undefined,
        cutout: bgCutout,
        transparentOnly: bgTransparent,
        fit: bgFit,
      });
      setPendingPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, dataUrl: result.dataUrl } : p)));
      setVoiceHint("");
      closeBgEditor();
    } catch (err) {
      setVoiceHint(err instanceof Error ? err.message : "Could not change the background.");
      setBgBusy(false);
    }
  }

  function resetBgEdit() {
    const photo = pendingPhotos.find((p) => p.id === bgEditId);
    if (!photo) return;
    setPendingPhotos((prev) =>
      prev.map((p) => (p.id === photo.id ? { ...p, dataUrl: p.originalDataUrl || p.dataUrl } : p))
    );
    closeBgEditor();
  }

  function speechLang() {
    if (lang === "hi" || lang === "bho") return "hi-IN";
    return "en-IN";
  }

  function resizeComposer() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }

  function applyVoiceText(text: string) {
    if (editingId) {
      setEditDraft(text);
      requestAnimationFrame(() => {
        const el = editRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
      });
      return;
    }
    setInput(text);
    requestAnimationFrame(resizeComposer);
  }

  function startSpeak(id: string, text: string) {
    if (!window.speechSynthesis) return;
    const clean = speakable(text);
    if (!clean) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = speechLang();
    u.onend = () => setSpeakingId((cur) => (cur === id ? null : cur));
    u.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));
    setSpeakingId(id);
    window.speechSynthesis.speak(u);
  }

  function toggleSpeak(id: string, text?: string) {
    if (speakingId === id) {
      window.speechSynthesis?.cancel();
      setSpeakingId(null);
      return;
    }
    if (text) startSpeak(id, text);
  }

  function stopListening(skipSend = false) {
    skipAutoSendRef.current = skipSend;
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }

  function toggleListen() {
    if (sending) return;
    if (listening) {
      const spoken = voiceFinalRef.current.trim();
      stopListening(true);
      if (spoken && !editingId && appState.prefs?.voice_auto_send !== false) {
        void sendMessage(undefined, spoken);
      }
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setVoiceHint("Voice input needs Chrome or Edge.");
      return;
    }
    setVoiceHint("");
    skipAutoSendRef.current = false;
    voiceBaseRef.current = (editingId ? editDraft : input).trim();
    voiceFinalRef.current = voiceBaseRef.current;
    const rec = new Ctor();
    rec.lang = speechLang();
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let finalChunk = "";
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalChunk += piece;
        else interim += piece;
      }
      if (finalChunk) {
        voiceFinalRef.current = [voiceFinalRef.current, finalChunk].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      }
      const shown = [voiceFinalRef.current, interim].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      applyVoiceText(shown);
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed") setVoiceHint("Allow the microphone to use voice input.");
      else if (ev.error === "no-speech") setVoiceHint("No speech heard. Try again.");
      else if (ev.error !== "aborted") setVoiceHint("Voice input failed. Try again.");
      setListening(false);
      recRef.current = null;
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const spoken = voiceFinalRef.current.trim();
      if (skipAutoSendRef.current || !spoken || editingId) return;
      if (appState.prefs?.voice_auto_send === false) return;
      void sendMessage(undefined, spoken);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      setVoiceHint(editingId ? "Listening… speak to edit this message." : "Listening…");
    } catch {
      setVoiceHint("Could not start the microphone.");
    }
  }

  function startEdit(bubble: Bubble) {
    if (sending || bubble.role !== "user") return;
    setEditingId(bubble.id);
    setEditDraft(textOf(bubble));
  }

  async function saveEdit(bubbleId: string) {
    const message = editDraft.trim();
    if (!message || sending) return;
    const bubbleIdx = bubbles.findIndex((b) => b.id === bubbleId);
    if (bubbleIdx < 0) return;

    const keptBubbles = bubbles.slice(0, bubbleIdx).filter((b) => !b.thinking);
    const history: ChatMessage[] = keptBubbles
      .map((b) => ({
        role: (b.role === "user" ? "user" : "assistant") as ChatMessage["role"],
        content: textOf(b),
      }))
      .filter((m) => m.content && m.content !== "Thinking…");

    setEditingId(null);
    setEditDraft("");

    let item = chats.find((c) => c.id === currentId);
    let copy = chats;
    if (!item) {
      const ensured = ensureChat(message, chats);
      item = { ...ensured.item, messages: history, title: history.length ? ensured.item.title : titleFrom(message) };
      copy = ensured.copy.map((c) => (c.id === item!.id ? item! : c));
    } else {
      item = {
        ...item,
        title: history.length === 0 ? titleFrom(message) : item.title,
        updatedAt: Date.now(),
        messages: history,
      };
      copy = chats.map((c) => (c.id === item!.id ? item! : c));
    }
    await runChatTurn(message, history, item, copy, keptBubbles, true);
  }

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && appState.prefs?.enter_to_send !== false) {
      e.preventDefault();
      void sendMessage();
    }
  }

  function onChatClick(e: ReactMouseEvent<HTMLDivElement>) {
    const btn = (e.target as HTMLElement).closest(".copy-code");
    if (!(btn instanceof HTMLButtonElement)) return;
    e.preventDefault();
    const code = btn.closest(".code-block")?.querySelector("code") || btn.closest(".code-block")?.querySelector("pre");
    if (!code) return;
    const text = (code.textContent || "").trim();
    if (!text) return;
    void copyText(text).then(() => {
      btn.textContent = "Copied";
      window.setTimeout(() => {
        if (btn.isConnected) btn.textContent = "Copy";
      }, 1400);
    });
  }

  async function copyReply(id: string, text?: string) {
    const source = (text || "").trim();
    if (!source) return;
    await copyText(codeFromReply(source));
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1400);
  }

  async function regenerate() {
    if (sending) return;
    const item = chats.find((c) => c.id === currentId);
    const msgs = item?.messages || [];
    let lastAsst = -1;
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      if (msgs[i].role === "assistant") {
        lastAsst = i;
        break;
      }
    }
    if (lastAsst < 0) return;
    let lastUser = -1;
    for (let i = lastAsst - 1; i >= 0; i -= 1) {
      if (msgs[i].role === "user") {
        lastUser = i;
        break;
      }
    }
    if (lastUser < 0) return;
    const userMsg = msgs[lastUser].content.replace(/\n\[Photo attached\]\s*$/, "");
    const history = msgs.slice(0, lastUser);
    const keptBubbles = bubbles.filter((b) => !b.thinking).slice(0, lastUser);
    const nextItem = { ...item!, messages: history, updatedAt: Date.now() };
    const copy = chats.map((c) => (c.id === nextItem.id ? nextItem : c));
    await runChatTurn(userMsg, history, nextItem, copy, keptBubbles, true);
  }

  function exportChat() {
    const item = chats.find((c) => c.id === currentId);
    const msgs = item?.messages?.length
      ? item.messages
      : bubbles
          .filter((b) => !b.thinking)
          .map((b) => ({
            role: (b.role === "user" ? "user" : "assistant") as ChatMessage["role"],
            content: textOf(b),
          }))
          .filter((m) => m.content);
    if (!msgs.length) return;
    const title = item?.title || "Agentic chat";
    const body = [`# ${title}`, "", ...msgs.map((m) => `## ${m.role === "user" ? "You" : "Agentic"}\n\n${m.content}`)].join("\n\n");
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w\s-]+/g, "").trim().slice(0, 40) || "agentic-chat"}.md`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    setUserOpen(false);
    setNavOpen(false);
  }

  async function savePref(updates: Record<string, unknown>) {
    const res = await fetch("/api/settings", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setAppState(await res.json());
  }

  async function addTeachFile(files: FileList | File[]) {
    setTeachBusy(true);
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/teach/file", { method: "POST", credentials: "include", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data.detail === "string" ? data.detail : "Could not add that training file.");
        }
        setAppState(data);
      }
    } catch (err) {
      setVoiceHint(err instanceof Error ? err.message : "Could not add that training file.");
    } finally {
      setTeachBusy(false);
    }
  }

  async function forgetTeach(id: string) {
    const res = await fetch("/api/teach/forget", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setAppState(await res.json());
  }

  async function toggleTool(tool: ToolItem) {
    const res = await fetch(tool.installed ? "/api/tools/uninstall" : "/api/tools/install", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tool.id }),
    });
    setAppState(await res.json());
  }

  async function saveGroqKey(e: FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) {
      alert("Please paste your Groq API key first.");
      return;
    }
    const res = await fetch("/api/setup", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey.trim() }),
    });
    const data = await res.json();
    if (data.ok) {
      setApiKey("");
      setAppState(data);
    } else {
      alert(data.error || "Could not save the key.");
    }
  }

  if (!ready) return <div className="app locked" />;

  const prefs = appState.prefs || {};
  const tools = appState.tools || [];
  const googleSetup = pendingOauth === "google";

  return (
    <div className={`app ${user ? "" : "locked"} ${sending ? "is-thinking" : ""} ${navOpen ? "nav-open" : ""}`}>
      {!user && (
        <div className="login-wall">
          <div className="login-card">
            <Logo large />
            <h2>Jump in</h2>
            <p>Your robot is ready. Sign in to start chatting.</p>
            <form className="login-form" onSubmit={localLogin}>
              <label htmlFor="loginName">Name</label>
              <input
                id="loginName"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                autoComplete="name"
                placeholder="Your name"
                required
                minLength={2}
              />
              <label htmlFor="loginEmail">Email</label>
              <input
                id="loginEmail"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
              <p className="login-error">{loginError}</p>
              <button className="login-continue" type="submit">
                Continue
              </button>
            </form>
            <div className="login-or">or</div>
            <div className="login-oauth">
              {/* Full navigation: OAuth must leave the SPA so the API can set cookies. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                className="oauth-btn"
                href="/auth/google"
                onClick={(e) => {
                  if (oauthReady.google) return;
                  e.preventDefault();
                  setPendingOauth("google");
                  setOauthError("");
                }}
              >
                Continue with Google
              </a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                className="oauth-btn gh"
                href="/auth/github"
                onClick={(e) => {
                  if (oauthReady.github) return;
                  e.preventDefault();
                  setPendingOauth("github");
                  setOauthError("");
                }}
              >
                Continue with GitHub
              </a>
            </div>
            {pendingOauth ? (
              <form className="oauth-setup show" onSubmit={saveOauth} autoComplete="off">
                <p>
                  {googleSetup
                    ? "Create a Web OAuth client, then paste the Client ID and Secret. Authorized redirect URI:"
                    : "Create a GitHub OAuth app, then paste the Client ID and Secret. Authorization callback URL:"}
                </p>
                <a
                  className="oauth-docs"
                  href={
                    googleSetup
                      ? "https://console.cloud.google.com/auth/clients"
                      : "https://github.com/settings/developers"
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {googleSetup ? "Open Google Cloud Console →" : "Open GitHub Developer settings →"}
                </a>
                <code>
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/auth/${pendingOauth}/callback`
                    : googleSetup
                      ? "http://127.0.0.1:3000/auth/google/callback"
                      : "http://127.0.0.1:3000/auth/github/callback"}
                </code>
                <input
                  value={oauthId}
                  onChange={(e) => setOauthId(e.target.value)}
                  placeholder={googleSetup ? "….apps.googleusercontent.com" : "GitHub Client ID"}
                  autoComplete="username"
                />
                <input
                  type="password"
                  value={oauthSecret}
                  onChange={(e) => setOauthSecret(e.target.value)}
                  placeholder="GOCSPX-…"
                  autoComplete="current-password"
                />
                <p className="login-error">{oauthError}</p>
                <div className="oauth-actions">
                  <button
                    className="oauth-cancel"
                    type="button"
                    onClick={() => {
                      setPendingOauth("");
                      setOauthId("");
                      setOauthSecret("");
                      setOauthError("");
                    }}
                  >
                    Cancel
                  </button>
                  <button className="oauth-save" type="submit" disabled={oauthSaving}>
                    Save and continue
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      )}

      <div className={`shell ${showArtifact ? "has-artifact" : ""}`}>
        <button
          className="nav-backdrop"
          type="button"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
        <aside className="sidebar">
          <div className="brand">
            <Logo />
            <div className="brand-text">
              <h1>Agentic</h1>
              <span className="brand-tag">Leap v2</span>
            </div>
            <button className="sidebar-close" type="button" aria-label="Close menu" onClick={() => setNavOpen(false)}>
              ×
            </button>
          </div>
          <button className="new-chat" type="button" onClick={() => void newChat()}>
            + New leap
          </button>
          <div className="project-picker">
            <select
              aria-label="Project"
              value={currentProjectId}
              onChange={(e) => void selectProject(e.target.value)}
            >
              <option value="">All chats</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void addProject()}>
              + Project
            </button>
          </div>
          {currentProject ? (
            <div className="project-card">
              <input
                className="project-name"
                value={currentProject.name}
                onChange={(e) => patchProject(currentProject.id, { name: e.target.value })}
                aria-label="Project name"
              />
              <textarea
                className="project-notes"
                rows={3}
                value={currentProject.instructions}
                onChange={(e) => patchProject(currentProject.id, { instructions: e.target.value })}
                placeholder="Standing instructions for this project"
              />
              <div className="project-files">
                {currentProject.files.map((file) => (
                  <div key={file.id} className="project-file">
                    <span>{file.title}</span>
                    <button type="button" aria-label={`Remove ${file.title}`} onClick={() => dropProjectFile(file.id)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="project-actions">
                <button type="button" onClick={() => projectFileRef.current?.click()}>
                  Add file
                </button>
                <button type="button" className="danger" onClick={() => void removeProject(currentProject.id)}>
                  Delete
                </button>
              </div>
              <input
                ref={projectFileRef}
                type="file"
                accept=".pdf,.txt,.md,.csv,.json,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                hidden
                onChange={(e) => {
                  if (e.target.files) void addProjectFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          ) : null}
          <div className={`mode-picker ${modeOpen ? "open" : ""}`}>
            <button
              className="mode-btn"
              type="button"
              aria-expanded={modeOpen}
              onClick={(e) => {
                e.stopPropagation();
                setModeOpen((v) => !v);
                setUserOpen(false);
              }}
            >
              <span>{MODE_LABELS[mode] || "Single agent"}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div className="mode-menu">
              <button type="button" className={mode === "agent" ? "active" : ""} onClick={() => { setMode("agent"); setModeOpen(false); }}>
                Single agent
              </button>
              <button type="button" className={mode === "crew" ? "active" : ""} onClick={() => { setMode("crew"); setModeOpen(false); }}>
                Researcher + Writer
              </button>
            </div>
          </div>
          <div className="history-label">Recents</div>
          <input
            className="history-search"
            type="search"
            value={historyQuery}
            onChange={(e) => setHistoryQuery(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
          />
          <div className="history">
            {!scopedChats.length ? (
              <div className="history-empty">{currentProjectId ? "No chats in this project" : "No chats yet"}</div>
            ) : !visibleChats.length ? (
              <div className="history-empty">No matches</div>
            ) : (
              visibleChats
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((c) => (
                  <div
                    key={c.id}
                    className={`history-item ${c.id === currentId ? "active" : ""}`}
                    onClick={() => void selectChat(c.id)}
                  >
                    <span>{c.title}</span>
                    <button
                      className="del"
                      type="button"
                      aria-label="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteChat(c.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
            )}
          </div>
          <div className={`user-dock ${userOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="user-menu">
              <div className="user-email">{user?.email}</div>
              <button className="item" type="button" onClick={() => { setUserOpen(false); setNavOpen(false); setSettingsOpen(true); }}>
                Settings <span className="hint">Ctrl+,</span>
              </button>
              <button className="item" type="button" disabled={!bubbles.length} onClick={exportChat}>
                Export chat
              </button>
              <button className="item" type="button" onClick={() => void openNotes()}>
                Notes
              </button>
              <button className="item" type="button" onClick={() => setLangOpen((v) => !v)}>
                Language
              </button>
              <div className={`lang-sub ${langOpen ? "open" : ""}`}>
                <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
                  English
                </button>
                <button type="button" className={lang === "hi" ? "active" : ""} onClick={() => setLang("hi")}>
                  Hindi
                </button>
                <button type="button" className={lang === "bho" ? "active" : ""} onClick={() => setLang("bho")}>
                  Bhojpuri
                </button>
              </div>
              <button className="item" type="button" onClick={() => { setUserOpen(false); setNavOpen(false); setHelpOpen(true); }}>
                Get help
              </button>
              <hr />
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a className="item" href="/auth/logout">
                Log out
              </a>
            </div>
            <button className="user-btn" type="button" onClick={() => setUserOpen((v) => !v)}>
              {user?.picture ? (
                <img className="avatar-img" src={user.picture} alt="" />
              ) : (
                <span className="avatar-fallback">{(user?.name || "U").trim().charAt(0).toUpperCase()}</span>
              )}
              <span>
                <strong>{user?.name || "User"}</strong>
                <em>{user?.email || ""}</em>
              </span>
            </button>
          </div>
          <div className={`model-chip ${appState.ok ? "" : "warn"}`}>
            {appState.ok
              ? `v${appState.version} · ${appState.provider} · ${appState.model}`
              : `v${appState.version || ""} · API key missing`}
          </div>
        </aside>

        <section className="main">
          <header className="topbar">
            <button
              className="menu-btn"
              type="button"
              aria-label="Open menu"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <h1>Agentic</h1>
            <button className="topbar-new" type="button" aria-label="New chat" onClick={() => void newChat()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </header>
          <div className="stage" ref={stageRef}>
            <div className="stage-inner">
              {!appState.ok && (
                <div className="setup show">
                  <h3>Add your Groq API key</h3>
                  <p>
                    Open{" "}
                    <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
                      console.groq.com/keys
                    </a>
                    , create a key, then paste it here.
                  </p>
                  <form className="setup-row" onSubmit={saveGroqKey}>
                    <input
                      type="password"
                      name="api_key"
                      placeholder="gsk_..."
                      autoComplete="off"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <button type="submit">Save</button>
                  </form>
                </div>
              )}
              {!bubbles.length && (
                <div className="empty">
                  <Logo large twinkle />
                  <h2>Ready to leap{user?.name ? `, ${user.name.trim().split(/\s+/)[0]}` : ""}?</h2>
                  <p>
                    {workFocus === "code"
                      ? "Describe the bug or what to build. You’ll get working code."
                      : "Jump in with a question, a file, or a project."}
                  </p>
                  <div className="start-chips">
                    <button type="button" disabled={sending} onClick={openLandingPicker}>
                      Make a landing page
                    </button>
                  </div>
                </div>
              )}
              <div className="chat" onClick={onChatClick}>
                {bubbles.map((b) =>
                  b.role === "user" ? (
                    editingId === b.id ? (
                      <div key={b.id} className="msg-edit">
                        <textarea
                          ref={editRef}
                          value={editDraft}
                          rows={2}
                          aria-label="Edit message"
                          onChange={(e) => {
                            setEditDraft(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setEditingId(null);
                            }
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void saveEdit(b.id);
                            }
                          }}
                        />
                        <div className="msg-edit-bar">
                          <button type="button" className="msg-edit-cancel" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                          <button type="button" className="msg-edit-save" disabled={!editDraft.trim() || sending} onClick={() => void saveEdit(b.id)}>
                            Save & retry
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={b.id} className="msg-user-wrap">
                        {b.images?.length ? (
                          <div className="msg-photos">
                            {b.images.map((src, i) => (
                              <img key={`${b.id}-img-${i}`} src={src} alt="" />
                            ))}
                          </div>
                        ) : null}
                        {b.text?.trim() ? <div className="msg user" dangerouslySetInnerHTML={{ __html: b.html }} /> : null}
                        {b.files?.length ? (
                          <div className="file-chips">
                            {b.files.map((name) => (
                              <span className="file-chip" key={`${b.id}-${name}`}>{name}</span>
                            ))}
                          </div>
                        ) : null}
                        <div className="msg-actions">
                          <button
                            type="button"
                            className="msg-action"
                            aria-label="Edit message"
                            title="Edit"
                            disabled={sending}
                            onClick={() => startEdit(b)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div key={b.id} className={`msg agent ${b.error ? "error" : ""}`}>
                      <Logo thinking={b.thinking} />
                      <div className="msg-body">
                        {b.trace ? <div className="trace">{b.trace}</div> : null}
                        <div className="md" dangerouslySetInnerHTML={{ __html: b.html }} />
                        {b.artifacts?.length ? (
                          <div className="artifact-chips">
                            {b.artifacts.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className="artifact-chip"
                                onClick={() => {
                                  setActiveArtifactId(item.id);
                                  setArtifactOpen(true);
                                }}
                              >
                                {item.title}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {!b.thinking && !b.error && b.text ? (
                          <div className="msg-actions agent-actions">
                            <button
                              type="button"
                              className="copy-reply"
                              onClick={() => void copyReply(b.id, b.text)}
                            >
                              {copiedId === b.id ? "Copied" : "Copy"}
                            </button>
                            {b.id === lastAgentId ? (
                              <button
                                type="button"
                                className="copy-reply"
                                disabled={sending}
                                onClick={() => void regenerate()}
                              >
                                Retry
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className={`msg-action ${speakingId === b.id ? "on" : ""}`}
                              aria-label={speakingId === b.id ? "Stop reading" : "Read aloud"}
                              title={speakingId === b.id ? "Stop" : "Read aloud"}
                              onClick={() => toggleSpeak(b.id, b.text)}
                            >
                              {speakingId === b.id ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                                  <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
                                </svg>
                              )}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
          <div className="composer-wrap">
            <div className="focus-toggle" role="tablist" aria-label="Chat or Code">
              <button
                type="button"
                role="tab"
                aria-selected={workFocus === "chat"}
                className={workFocus === "chat" ? "on" : ""}
                onClick={() => {
                  setWorkFocus("chat");
                  localStorage.setItem(FOCUS_KEY, "chat");
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Chat
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={workFocus === "code"}
                className={workFocus === "code" ? "on" : ""}
                onClick={() => {
                  setWorkFocus("code");
                  localStorage.setItem(FOCUS_KEY, "code");
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M8 8l-4 4 4 4M16 8l4 4-4 4" />
                </svg>
                Code
              </button>
            </div>
            {(pendingPhotos.length || pendingFiles.length) ? (
              <div className="attach-previews">
                {pendingPhotos.map((photo) => (
                  <div className="attach-preview" key={photo.id}>
                    <button type="button" className="attach-thumb" onClick={() => openBgEditor(photo)} title="Change background">
                      <img src={photo.dataUrl} alt="" />
                    </button>
                    <button
                      type="button"
                      className="attach-bg"
                      onClick={() => openBgEditor(photo)}
                    >
                      BG
                    </button>
                    <button
                      type="button"
                      className="attach-remove"
                      aria-label="Remove photo"
                      onClick={() => setPendingPhotos((prev) => prev.filter((p) => p.id !== photo.id))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {pendingFiles.map((file) => (
                  <div className="attach-file" key={file.id}>
                    <span>{file.name}</span>
                    <button
                      type="button"
                      aria-label="Remove file"
                      onClick={() => setPendingFiles((prev) => prev.filter((p) => p.id !== file.id))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <form className="composer" onSubmit={sendMessage}>
              <div className={`attach-picker ${attachOpen ? "open" : ""}`}>
                <button
                  className="attach-btn"
                  type="button"
                  aria-label="Add photo or file"
                  aria-expanded={attachOpen}
                  disabled={sending}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttachOpen((v) => !v);
                    setModeOpen(false);
                    setUserOpen(false);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                <div className="attach-menu">
                  <button type="button" onClick={() => void openCamera()}>
                    Take photo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachOpen(false);
                      galleryRef.current?.click();
                    }}
                  >
                    Choose from gallery
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachOpen(false);
                      fileRef.current?.click();
                    }}
                  >
                    Upload file
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachOpen(false);
                      openLandingPicker();
                    }}
                  >
                    Landing page
                  </button>
                </div>
              </div>
              <input
                ref={bgFileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (bgImageUrl.startsWith("blob:")) URL.revokeObjectURL(bgImageUrl);
                  setBgImageUrl(URL.createObjectURL(file));
                }}
              />
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) void addPhotoFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md,.csv,.json,.docx,application/pdf,text/plain,text/markdown,text/csv,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) void addDocFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                ref={cameraFileRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  if (e.target.files) void addPhotoFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <textarea
                ref={inputRef}
                placeholder={
                  listening
                    ? "Listening…"
                    : pendingPhotos.length || pendingFiles.length
                      ? "Add a caption…"
                      : workFocus === "code"
                        ? "Paste the error or say what to build…"
                        : "What’s the mission?"
                }
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
                }}
                onKeyDown={onComposerKey}
              />
              <button
                className={`mic-btn ${listening ? "listening" : ""}`}
                type="button"
                aria-label={listening ? "Stop listening" : "Voice input"}
                title={listening ? "Stop listening" : "Voice input"}
                disabled={sending}
                onClick={toggleListen}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" />
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3" />
                </svg>
              </button>
              <button className="send-btn" type="submit" aria-label="Send" disabled={sending || (!input.trim() && !pendingPhotos.length && !pendingFiles.length)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </form>
            {voiceHint ? <p className="voice-hint">{voiceHint}</p> : null}
            
          </div>
        </section>
        {showArtifact && paneArtifactId ? (
          <ArtifactPane
            key={paneArtifactId}
            artifacts={visibleArtifacts}
            activeId={paneArtifactId}
            onSelect={setActiveArtifactId}
            onClose={() => setArtifactOpen(false)}
          />
        ) : null}
      </div>

      <div className={`camera-overlay ${cameraOpen ? "open" : ""}`}>
        <video ref={videoRef} autoPlay playsInline muted />
        <div className="camera-bar">
          <button type="button" className="camera-cancel" onClick={closeCamera}>
            Cancel
          </button>
          <button type="button" className="camera-snap" aria-label="Capture photo" onClick={snapPhoto} />
        </div>
      </div>

      <div className={`overlay ${settingsOpen ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && setSettingsOpen(false)}>
        <div className="settings">
          <div className="settings-head">
            <h2>Settings</h2>
            <button className="close-x" type="button" onClick={() => setSettingsOpen(false)} aria-label="Close">
              ×
            </button>
          </div>
          <div className="tabs">
            <button type="button" className={settingsTab === "tools" ? "active" : ""} onClick={() => setSettingsTab("tools")}>
              Tools
            </button>
            <button type="button" className={settingsTab === "features" ? "active" : ""} onClick={() => setSettingsTab("features")}>
              Features
            </button>
            <button type="button" className={settingsTab === "teach" ? "active" : ""} onClick={() => setSettingsTab("teach")}>
              Teach
            </button>
            <button type="button" className={settingsTab === "about" ? "active" : ""} onClick={() => setSettingsTab("about")}>
              About
            </button>
          </div>
          {settingsTab === "tools" && (
            <div className="panel active">
              {tools.map((tool) => (
                <div className="tool-card" key={tool.id}>
                  <div className="tool-icon">
                    <ToolIcon name={tool.icon} />
                  </div>
                  <div>
                    <div className="chip">{tool.category}</div>
                    <h3>{tool.title}</h3>
                    <p>{tool.blurb}</p>
                  </div>
                  <button
                    className={tool.installed ? "remove" : "install"}
                    type="button"
                    onClick={() => void toggleTool(tool)}
                  >
                    {tool.installed ? "Uninstall" : "Install"}
                  </button>
                </div>
              ))}
            </div>
          )}
          {settingsTab === "features" && (
            <div className="panel active">
              <div className="row">
                <div>
                  <label>Show thinking</label>
                  <p>Display search and tool status while the agent works.</p>
                </div>
                <button
                  type="button"
                  className={`toggle ${prefs.show_thinking ? "on" : ""}`}
                  onClick={() => void savePref({ show_thinking: !prefs.show_thinking })}
                />
              </div>
              <div className="row">
                <div>
                  <label>Enter to send</label>
                  <p>Press Enter to send. Shift+Enter adds a new line.</p>
                </div>
                <button
                  type="button"
                  className={`toggle ${prefs.enter_to_send ? "on" : ""}`}
                  onClick={() => void savePref({ enter_to_send: !prefs.enter_to_send })}
                />
              </div>
              <div className="row">
                <div>
                  <label>Send after speaking</label>
                  <p>When you stop the mic, send the transcribed question.</p>
                </div>
                <button
                  type="button"
                  className={`toggle ${prefs.voice_auto_send !== false ? "on" : ""}`}
                  onClick={() => void savePref({ voice_auto_send: prefs.voice_auto_send === false })}
                />
              </div>
              <div className="row">
                <div>
                  <label>Read answers aloud</label>
                  <p>Speak the agent’s reply automatically. You can also tap the speaker on a message.</p>
                </div>
                <button
                  type="button"
                  className={`toggle ${prefs.voice_read_aloud ? "on" : ""}`}
                  onClick={() => void savePref({ voice_read_aloud: !prefs.voice_read_aloud })}
                />
              </div>
              <div className="row">
                <div>
                  <label>Max steps</label>
                  <p>How many think → tool loops per question.</p>
                </div>
                <span>
                  <input
                    type="range"
                    min={2}
                    max={16}
                    value={prefs.max_steps || 8}
                    onChange={(e) => void savePref({ max_steps: Number(e.target.value) })}
                  />{" "}
                  <b>{prefs.max_steps || 8}</b>
                </span>
              </div>
              <div className="row">
                <div>
                  <label>Creativity</label>
                  <p>Lower is more precise. Higher is more varied.</p>
                </div>
                <span>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    value={Math.round((prefs.temperature || 0.2) * 10)}
                    onChange={(e) => void savePref({ temperature: Number(e.target.value) / 10 })}
                  />{" "}
                  <b>{Number(prefs.temperature || 0.2).toFixed(1)}</b>
                </span>
              </div>
              <div className="row">
                <div>
                  <label>Clear chat history</label>
                  <p>Delete all Recents from this browser.</p>
                </div>
                <button
                  type="button"
                  className="remove"
                  onClick={() => {
                    setChats([]);
                    setCurrentId(null);
                    setBubbles([]);
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          {settingsTab === "teach" && (
            <div className="panel active">
              <p className="teach-lead">
                You can train this AI with instructions, facts, and files. That is memory — not a new neural model.
                It will use this on every chat.
              </p>
              <label className="teach-label" htmlFor="teachInst">How should it behave?</label>
              <textarea
                id="teachInst"
                className="teach-box"
                rows={4}
                value={teachInst}
                onChange={(e) => setTeachInst(e.target.value)}
                placeholder="Example: Answer in short bullets. I run a clothing shop in Patna."
              />
              <label className="teach-label" htmlFor="teachMem">Facts to remember</label>
              <textarea
                id="teachMem"
                className="teach-box"
                rows={5}
                value={teachMem}
                onChange={(e) => setTeachMem(e.target.value)}
                placeholder="Example: My name is Ravi. Brand colors are gold #db8f2a and cream #dacebe."
              />
              <button
                className="install"
                type="button"
                disabled={teachBusy}
                onClick={() => void savePref({ teach_instructions: teachInst, teach_memory: teachMem })}
              >
                Save training
              </button>
              <div className="teach-files">
                <div className="row">
                  <div>
                    <label>Training files</label>
                    <p>Upload PDF, Word, or text. Up to 5 files. The AI will study them on every chat.</p>
                  </div>
                  <button type="button" className="install" disabled={teachBusy} onClick={() => teachFileRef.current?.click()}>
                    Add file
                  </button>
                </div>
                <input
                  ref={teachFileRef}
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.json,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  hidden
                  onChange={(e) => {
                    if (e.target.files) void addTeachFile(e.target.files);
                    e.target.value = "";
                  }}
                />
                {(prefs.teach_notes || []).length ? (
                  <ul className="teach-list">
                    {(prefs.teach_notes || []).map((note) => (
                      <li key={note.id}>
                        <span>{note.title}</span>
                        <button type="button" className="remove" onClick={() => void forgetTeach(note.id)}>
                          Forget
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="teach-empty">No training files yet.</p>
                )}
              </div>
            </div>
          )}
          {settingsTab === "about" && (
            <div className="panel active">
              <div className="dev-card">
                <div className="dev-avatar" aria-hidden="true">AM</div>
                <div>
                  <p className="dev-kicker">Built and developed by</p>
                  <h3 className="dev-name">Abhishek Mishra</h3>
                  <p className="dev-role">Author · Developer</p>
                  <p className="dev-blurb">
                    This Agentic AI app — chat, tools, voice, and camera — was designed and built by Abhishek Mishra.
                  </p>
                </div>
              </div>
              <dl className="about-grid">
                <dt>Author</dt>
                <dd>Abhishek Mishra</dd>
                <dt>Version</dt>
                <dd>Agentic {appState.version || "1.6.0"}</dd>
                <dt>Provider</dt>
                <dd>{appState.provider || "not connected"}</dd>
                <dt>Model</dt>
                <dd>{appState.model || "—"}</dd>
                <dt>Installed tools</dt>
                <dd>{(prefs.installed_tools || []).length}</dd>
                <dt>Default mode</dt>
                <dd>{prefs.default_mode === "crew" ? "Researcher + Writer" : "Single agent"}</dd>
                <dt>Frontend</dt>
                <dd>Next.js</dd>
                <dt>Runtime</dt>
                <dd>Python · FastAPI · Groq-compatible LLM</dd>
              </dl>
            </div>
          )}
        </div>
      </div>

      <div className={`overlay ${helpOpen ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && setHelpOpen(false)}>
        <div className="settings">
          <div className="settings-head">
            <h2>Get help</h2>
            <button className="close-x" type="button" onClick={() => setHelpOpen(false)}>
              ×
            </button>
          </div>
          <div className="help-box">
            <p>Sign in with your name and email, or Google / GitHub. Then ask questions in the chat box.</p>
            <p>Tap the microphone to speak. After a reply, tap Retry for a new answer, or Export chat from the profile menu.</p>
            <p>Attach a PDF or text file in chat, or train it in Settings → Teach with instructions, facts, and files.</p>
            <p>Open a Project in the sidebar to keep chats, files, and standing instructions together.</p>
            <p>Ask it to save a markdown note, then open Notes from the profile menu. Ask it to run Python and it uses the code sandbox.</p>
            <p>Ask it to make a webpage or graphic — the result opens in Artifacts on the right. Tap Download to save the HTML file.</p>
            <p>Or tap + → Landing page and pick a type (shop, restaurant, portfolio…). It builds that exact page.</p>
            <p>Attach a photo, tap BG, then change the background color or set another image behind it.</p>
            <p>Use Settings to install tools like Dice or Unit Convert.</p>
            <p>Use Chat for questions and teaching. Switch to Code when you want a full working fix, not a short explanation.</p>
            <p>Single agent is best for quick questions. Researcher + Writer is better for long research.</p>
          </div>
        </div>
      </div>
      <div className={`overlay ${notesOpen ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && setNotesOpen(false)}>
        <div className="settings notes-modal">
          <div className="settings-head">
            <h2>Notes</h2>
            <button className="close-x" type="button" onClick={() => setNotesOpen(false)}>
              ×
            </button>
          </div>
          <div className="notes-layout">
            <div className="notes-side">
              {!notesList.length ? (
                <p className="history-empty">No saved notes yet. Ask the agent to save one.</p>
              ) : (
                notesList.map((note) => (
                  <button
                    key={note.name}
                    type="button"
                    className={`notes-item ${noteName === note.name ? "active" : ""}`}
                    onClick={() => void openNote(note.name)}
                  >
                    <strong>{note.name}</strong>
                    <em>{new Date(note.updated).toLocaleString()}</em>
                  </button>
                ))
              )}
            </div>
            <div className="notes-view">
              {noteName ? (
                <>
                  <div className="notes-toolbar">
                    <span>{noteName}</span>
                    <button type="button" onClick={downloadNote}>
                      Download
                    </button>
                    <button type="button" className="danger" onClick={() => void removeNote(noteName)}>
                      Delete
                    </button>
                  </div>
                  <pre className="note-body">{noteBody}</pre>
                </>
              ) : (
                <p className="history-empty">Pick a note to read it here.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className={`overlay ${landingOpen ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && setLandingOpen(false)}>
        <div className="settings landing-modal">
          <div className="settings-head">
            <h2>Landing page</h2>
            <button className="close-x" type="button" onClick={() => setLandingOpen(false)}>
              ×
            </button>
          </div>
          <p className="landing-lead">Pick the type. It will generate a full page for that style — not a generic template.</p>
          <div className="landing-grid">
            {LANDING_TYPES.map((kind) => (
              <button
                key={kind.id}
                type="button"
                className="landing-card"
                disabled={sending}
                onClick={() => requestLanding(kind)}
              >
                <strong>{kind.title}</strong>
                <span>{kind.sections.split(",")[0].trim()}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={`overlay ${bgEditId ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && closeBgEditor()}>
        <div className="settings bg-modal">
          <div className="settings-head">
            <h2>Photo background</h2>
            <button className="close-x" type="button" onClick={closeBgEditor}>
              ×
            </button>
          </div>
          {(() => {
            const photo = pendingPhotos.find((p) => p.id === bgEditId);
            if (!photo) return null;
            return (
              <>
                <div className={`bg-preview ${bgTransparent ? "checkered" : ""}`} style={bgTransparent ? undefined : { background: bgColor }}>
                  {bgPreviewUrl ? (
                    <img className="bg-preview-result" src={bgPreviewUrl} alt="" />
                  ) : (
                    <>
                      {bgImageUrl ? <img className="bg-preview-back" src={bgImageUrl} alt="" /> : null}
                      <img src={photo.originalDataUrl || photo.dataUrl} alt="" />
                    </>
                  )}
                </div>
                <p className="landing-lead">
                  Turn the photo transparent so the new color or background image shows through cleanly. First time can take a minute.
                </p>
                <div className="bg-swatches">
                  {BG_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`bg-swatch ${bgColor === hex ? "on" : ""}`}
                      style={{ background: hex }}
                      aria-label={hex}
                      onClick={() => setBgColor(hex)}
                    />
                  ))}
                  <label className="bg-swatch custom">
                    <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
                  </label>
                </div>
                <div className="bg-checks">
                  <label className="bg-check">
                    <input type="checkbox" checked={bgCutout} onChange={(e) => setBgCutout(e.target.checked)} />
                    Make image transparent
                  </label>
                  <label className="bg-check">
                    <input
                      type="checkbox"
                      checked={bgTransparent}
                      onChange={(e) => {
                        setBgTransparent(e.target.checked);
                        if (e.target.checked) setBgCutout(true);
                      }}
                    />
                    Save as transparent PNG
                  </label>
                </div>
                <div className="bg-row">
                  <span className="bg-fit-label">Background fit</span>
                  <div className="artifact-toggle">
                    <button type="button" className={bgFit === "contain" ? "on" : ""} onClick={() => setBgFit("contain")}>
                      Fit
                    </button>
                    <button type="button" className={bgFit === "cover" ? "on" : ""} onClick={() => setBgFit("cover")}>
                      Fill
                    </button>
                  </div>
                </div>
                <div className="bg-actions">
                  <button type="button" className="remove" onClick={() => bgFileRef.current?.click()}>
                    {bgImageUrl ? "Change BG image" : "Set BG image"}
                  </button>
                  {bgImageUrl ? (
                    <button
                      type="button"
                      className="remove"
                      onClick={() => {
                        if (bgImageUrl.startsWith("blob:")) URL.revokeObjectURL(bgImageUrl);
                        setBgImageUrl("");
                      }}
                    >
                      Clear image
                    </button>
                  ) : null}
                  <button type="button" className="remove" onClick={resetBgEdit}>
                    Reset
                  </button>
                  <button type="button" className="remove" disabled={bgBusy} onClick={() => void downloadBgEdit()}>
                    Download
                  </button>
                  <button type="button" className="install" disabled={bgBusy} onClick={() => void applyBgEdit()}>
                    {bgBusy ? (bgCutout ? "Making transparent…" : "Applying…") : "Apply"}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

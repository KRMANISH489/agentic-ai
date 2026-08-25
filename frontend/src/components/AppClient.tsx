"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { marked } from "marked";
import { Logo } from "@/components/Logo";
import type { AppState, ChatItem, ChatMessage, ToolItem, User } from "@/lib/types";

const STORE_KEY = "agentic.chats.v1";
const MODE_LABELS: Record<string, string> = {
  agent: "Single agent",
  crew: "Researcher + Writer",
};

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
  if (text.startsWith("tool:random_pick")) return "Picking an option…";
  if (text.startsWith("tool:")) return "Using a tool…";
  return "Thinking…";
}

function html(text: string) {
  return marked.parse(text, { async: false }) as string;
}

type PendingPhoto = { id: string; name: string; dataUrl: string };

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
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_>~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

type Bubble = {
  id: string;
  role: "user" | "agent";
  html: string;
  text?: string;
  images?: string[];
  trace?: string;
  error?: boolean;
  thinking?: boolean;
};

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
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [mode, setMode] = useState("agent");
  const [modeOpen, setModeOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState("en");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"tools" | "features" | "about">("tools");
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
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const skipAutoSendRef = useRef(false);
  const voiceBaseRef = useRef("");
  const voiceFinalRef = useRef("");
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraFileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    try {
      setChats(JSON.parse(localStorage.getItem(STORE_KEY) || "[]"));
    } catch {
      setChats([]);
    }
  }, []);

  useEffect(() => {
    if (ready && user) localStorage.setItem(STORE_KEY, JSON.stringify(chats));
  }, [chats, ready, user]);

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
      messages.map((m, i) => ({
        id: `${i}-${m.role}`,
        role: m.role === "user" ? "user" : "agent",
        html: html(m.content),
        text: m.content,
      }))
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
      html: html(message),
      text: message,
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
    try {
      if (resetMemory) {
        await fetch("/api/reset", { method: "POST", credentials: "include" });
      }
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, mode, history, images }),
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
                b.id === agentId ? { ...b, html: html(event.content), text: event.content, trace: "", thinking: false } : b
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
    if ((!message && !pendingPhotos.length) || sending) return;
    const photos = pendingPhotos.map((p) => p.dataUrl);
    const caption = message || (photos.length > 1 ? "What is in these photos?" : "What is in this photo?");
    setEditingId(null);
    setInput("");
    setPendingPhotos([]);
    setAttachOpen(false);
    if (inputRef.current) inputRef.current.style.height = "auto";
    const { item, copy } = ensureChat(caption, chats);
    const history = item.messages.map((m) => ({ role: m.role, content: m.content }));
    await runChatTurn(caption, history, item, copy, undefined, false, photos);
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
        next.push({
          id: crypto.randomUUID(),
          name: file.name || "photo.jpg",
          dataUrl: await fileToJpeg(file),
        });
      }
      setPendingPhotos((prev) => [...prev, ...next].slice(0, 4));
      setVoiceHint("");
    } catch (err) {
      setVoiceHint(err instanceof Error ? err.message : "Could not add that photo.");
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
      return [...prev, { id: crypto.randomUUID(), name: "camera.jpg", dataUrl }];
    });
  }

  function speechLang() {
    return lang === "hi" ? "hi-IN" : "en-IN";
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

  async function savePref(updates: Record<string, unknown>) {
    const res = await fetch("/api/settings", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
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
            <h2>Welcome to Agentic</h2>
            <p>Sign in to continue. Your profile will appear in the sidebar.</p>
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

      <div className="shell">
        <button
          className="nav-backdrop"
          type="button"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
        <aside className="sidebar">
          <div className="brand">
            <Logo />
            <h1>Agentic</h1>
            <button className="sidebar-close" type="button" aria-label="Close menu" onClick={() => setNavOpen(false)}>
              ×
            </button>
          </div>
          <button className="new-chat" type="button" onClick={() => void newChat()}>
            + New chat
          </button>
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
          <div className="history">
            {!chats.length ? (
              <div className="history-empty">No chats yet</div>
            ) : (
              chats
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
                  <h2>How can I help you today{user?.name ? `, ${user.name.trim().split(/\s+/)[0]}` : ""}?</h2>
                </div>
              )}
              <div className="chat">
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
                      <div>
                        {b.trace ? <div className="trace">{b.trace}</div> : null}
                        <div className="md" dangerouslySetInnerHTML={{ __html: b.html }} />
                        {!b.thinking && !b.error && b.text ? (
                          <div className="msg-actions agent-actions">
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
            {pendingPhotos.length ? (
              <div className="attach-previews">
                {pendingPhotos.map((photo) => (
                  <div className="attach-preview" key={photo.id}>
                    <img src={photo.dataUrl} alt="" />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => setPendingPhotos((prev) => prev.filter((p) => p.id !== photo.id))}
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
                  aria-label="Add photo"
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
                </div>
              </div>
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
                placeholder={listening ? "Listening…" : pendingPhotos.length ? "Add a caption…" : "How can I help you today?"}
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
              <button className="send-btn" type="submit" aria-label="Send" disabled={sending || (!input.trim() && !pendingPhotos.length)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </form>
            {voiceHint ? <p className="voice-hint">{voiceHint}</p> : null}
            
          </div>
        </section>
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
                <dd>Agentic {appState.version || "1.5.0"}</dd>
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
            <p>Tap the microphone to speak. After a reply, tap the speaker to hear it. Hover a sent message to edit it.</p>
            <p>Use Settings to install tools like Dice or Unit Convert.</p>
            <p>Single agent is best for quick questions. Researcher + Writer is better for long research.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

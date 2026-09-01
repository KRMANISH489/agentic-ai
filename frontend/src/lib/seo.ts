export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://agentic-ai-d0cx.onrender.com"
).replace(/\/$/, "");

export const SITE_NAME = "Agentic AI";
export const SITE_AUTHOR = "Abhishek Mishra";

export const DEFAULT_TITLE = "Agentic AI — ReAct Agent for Code, IT Teaching & Chat";

export const DEFAULT_DESCRIPTION =
  "Free ReAct agent by Abhishek Mishra. Teach IT in plain language, write working code, search the web, and build landing pages in one chat.";

export const KEYWORDS = [
  "Agentic AI",
  "Agentic AI chat",
  "ReAct agent",
  "AI coding tutor",
  "IT teaching AI",
  "AI code assistant",
  "free AI agent",
  "Groq AI chat",
  "Abhishek Mishra Agentic AI",
  "Hindi IT tutor",
  "AI landing page builder",
  "Python JavaScript tutor",
];

export const FEATURES = [
  {
    title: "ReAct agent, not a static chatbot",
    text: "Agentic AI thinks, calls tools, reads the result, then continues until the job is done.",
  },
  {
    title: "IT teaching in plain language",
    text: "Ask in English or Hindi. You get an analogy, a comparison table, working code, and a short recap.",
  },
  {
    title: "Chat or Code mode",
    text: "Chat explains. Code mode returns a full working fix or page, not a stub.",
  },
  {
    title: "Tools, files, and artifacts",
    text: "Weather, search, notes, a Python sandbox, photo attach, and downloadable HTML pages.",
  },
] as const;

export const FAQ = [
  {
    q: "What is Agentic AI?",
    a: "Agentic AI is a free web app by Abhishek Mishra. It is a ReAct agent: the model can use tools, check the result, and take the next step instead of only writing text.",
  },
  {
    q: "Is Agentic AI free to use?",
    a: "Yes. Open the site, sign in with your name and email or Google or GitHub, and start chatting. A Groq API key is needed on the server to run the model.",
  },
  {
    q: "Can it teach programming and IT?",
    a: "Yes. It is built to teach IT like a patient friend: one language at a time, working examples, and simple Hindi when you ask in Hindi.",
  },
  {
    q: "Does it write full code and landing pages?",
    a: "Yes. Switch to Code mode for a complete fix, or tap + → Landing page and pick a type such as shop, restaurant, or portfolio.",
  },
  {
    q: "Who built Agentic AI?",
    a: "Abhishek Mishra designed and built the app: Next.js chat UI, FastAPI backend, and the custom ReAct agent loop.",
  },
] as const;

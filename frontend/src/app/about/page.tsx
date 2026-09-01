import type { Metadata } from "next";
import Link from "next/link";
import { AboutFaq } from "@/components/AboutFaq";
import { AboutJsonLd } from "@/components/JsonLd";
import { Logo } from "@/components/Logo";
import { DEFAULT_DESCRIPTION, FEATURES, SITE_AUTHOR, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About",
  description: `About ${SITE_NAME} by ${SITE_AUTHOR}. ${DEFAULT_DESCRIPTION}`,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: `About ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
    url: `${SITE_URL}/about`,
    type: "article",
  },
};

export default function AboutPage() {
  return (
    <main className="about-page">
      <AboutJsonLd />
      <div className="about-card">
        <header className="about-head">
          <Logo />
          <div>
            <p className="about-kicker">About</p>
            <h1>Agentic AI</h1>
          </div>
          <Link className="about-back" href="/">
            Back
          </Link>
        </header>

        <p>
          A free ReAct agent by {SITE_AUTHOR}. You ask a question. It can answer, use a tool, read
          the result, and keep going until the job is done.
        </p>
        <p>
          Chat UI is Next.js. API is FastAPI. The agent loop is custom Python — not a hidden
          framework wrapper.
        </p>

        <h2>What you can do</h2>
        <ul className="about-list">
          {FEATURES.map((item) => (
            <li key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>

        <h2>Chat vs Code</h2>
        <p>
          A normal chatbot only writes text. Agentic AI can also search, check Wikipedia or weather,
          save a note, or run short Python. Use <strong>Chat</strong> for an explanation. Use{" "}
          <strong>Code</strong> for a full working file.
        </p>

        <h2>Languages</h2>
        <p>
          The UI is English. You can ask in English, Hindi, or Hinglish. Hindi questions get a
          simple Hindi reply. Code names stay in English.
        </p>

        <h2>FAQ</h2>
        <AboutFaq />

        <Link className="about-cta" href="/">
          Start chatting
        </Link>
      </div>
    </main>
  );
}

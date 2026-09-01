import type { Metadata } from "next";
import Link from "next/link";
import { AboutJsonLd } from "@/components/JsonLd";
import { DEFAULT_DESCRIPTION, FAQ, FEATURES, SITE_AUTHOR, SITE_NAME, SITE_URL } from "@/lib/seo";

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
    <main className="seo-doc">
      <AboutJsonLd />
      <header className="seo-top">
        <Link href="/">← Back to Agentic AI</Link>
      </header>
      <article className="seo-wrap">
        <p className="seo-kicker">About the product</p>
        <h1>Agentic AI by {SITE_AUTHOR}</h1>
        <p>
          Agentic AI is a free web agent for people who want to learn IT and ship real work. You
          type a goal. The agent can answer, call a tool, read the result, and continue. That loop
          is called ReAct: reason, act, observe.
        </p>
        <p>
          The app is not a wrapper around a hidden framework. The chat UI is Next.js. The API is
          FastAPI. The agent loop is custom Python. {SITE_AUTHOR} designed and built it.
        </p>

        <h2>What you can do</h2>
        <ul className="seo-list">
          {FEATURES.map((item) => (
            <li key={item.title}>
              <strong>{item.title}.</strong> {item.text}
            </li>
          ))}
        </ul>

        <h2>How it differs from a normal chatbot</h2>
        <p>
          A normal chatbot is user → model → text. Agentic AI can also search the web, look up
          Wikipedia, check weather, save a note, or run a short Python snippet in a sandbox. If a
          step fails, it can try another path.
        </p>
        <p>
          Use <strong>Chat</strong> when you want a clear explanation. Use <strong>Code</strong>{" "}
          when you want a full working file, not a sketch.
        </p>

        <h2>Languages</h2>
        <p>
          The product UI is English. You can ask in English, Hindi, or Hinglish. When you ask in
          Hindi, the agent replies in simple Hindi and keeps code identifiers in English.
        </p>

        <h2>FAQ</h2>
        <div className="seo-faq">
          {FAQ.map((item) => (
            <details key={item.q} open>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>

        <p>
          <Link href="/">Start chatting on Agentic AI</Link>
        </p>
      </article>
    </main>
  );
}

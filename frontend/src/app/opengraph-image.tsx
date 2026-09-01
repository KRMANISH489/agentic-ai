import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Agentic AI — ReAct agent for code, IT teaching, and chat";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f1f1f1",
          padding: "64px 72px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "#5e574e",
            fontSize: 28,
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "#db8f2a",
            }}
          />
          Agentic AI
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 72,
              lineHeight: 1.05,
              color: "#1a1612",
              letterSpacing: "-0.03em",
              maxWidth: 960,
            }}
          >
            Teach IT. Ship working code. In one chat.
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#5e574e",
              fontFamily: "sans-serif",
              maxWidth: 880,
            }}
          >
            Free ReAct agent by Abhishek Mishra
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#5e574e",
            fontSize: 22,
            fontFamily: "sans-serif",
          }}
        >
          <span>Chat · Code · Tools · Landing pages</span>
          <span>agentic-ai-d0cx.onrender.com</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

"use client";

import { useId } from "react";

export function Logo({
  large = false,
  thinking = false,
  twinkle = false,
}: {
  large?: boolean;
  thinking?: boolean;
  twinkle?: boolean;
}) {
  const raw = useId().replace(/:/g, "");
  const body = `${raw}-body`;
  const face = `${raw}-face`;
  return (
    <span
      className={`logo ${large ? "logo-lg" : ""} ${thinking ? "is-thinking" : ""}`}
      aria-hidden
    >
      {twinkle ? (
        <>
          <span className="twinkle t1" />
          <span className="twinkle t2" />
          <span className="twinkle t3" />
        </>
      ) : null}
      <svg className="logo-bot" viewBox="0 0 80 88" fill="none">
        <defs>
          <linearGradient id={body} x1="20" y1="18" x2="62" y2="78" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7dffd4" />
            <stop offset=".45" stopColor="#3dffc0" />
            <stop offset="1" stopColor="#12b88e" />
          </linearGradient>
          <linearGradient id={face} x1="28" y1="14" x2="54" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f4fff8" />
            <stop offset="1" stopColor="#c8ffe8" />
          </linearGradient>
        </defs>
        <ellipse className="bot-shadow" cx="40" cy="82" rx="16" ry="3.2" fill="#3dffc0" opacity=".28" />
        <g className="bot-leap">
          <path d="M40 8v7" stroke="#c8ff3d" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="40" cy="6.5" r="3.2" fill="#ff4ecd" />
          <circle cx="40" cy="6.5" r="1.2" fill="#fff" />
          <rect x="18" y="42" width="10" height="22" rx="5" fill={`url(#${body})`} transform="rotate(-38 23 53)" />
          <rect x="52" y="42" width="10" height="22" rx="5" fill={`url(#${body})`} transform="rotate(38 57 53)" />
          <rect x="26" y="48" width="28" height="24" rx="10" fill={`url(#${body})`} />
          <rect x="31" y="54" width="18" height="8" rx="4" fill="#07141c" opacity=".22" />
          <rect x="24" y="16" width="32" height="30" rx="12" fill={`url(#${face})`} />
          <rect x="27" y="20" width="26" height="18" rx="8" fill="#07141c" />
          <circle cx="35" cy="29" r="3.1" fill="#c8ff3d" />
          <circle cx="45" cy="29" r="3.1" fill="#c8ff3d" />
          <circle cx="34.2" cy="28.2" r="1.1" fill="#fff" />
          <circle cx="44.2" cy="28.2" r="1.1" fill="#fff" />
          <path d="M35 35.5c1.6 2.2 8.4 2.2 10 0" stroke="#3dffc0" strokeWidth="2" strokeLinecap="round" />
          <circle cx="30.5" cy="34.5" r="2.1" fill="#ff4ecd" opacity=".85" />
          <circle cx="49.5" cy="34.5" r="2.1" fill="#ff4ecd" opacity=".85" />
          <rect x="28" y="68" width="9" height="12" rx="4.5" fill={`url(#${body})`} transform="rotate(-18 32.5 74)" />
          <rect x="43" y="68" width="9" height="12" rx="4.5" fill={`url(#${body})`} transform="rotate(18 47.5 74)" />
        </g>
      </svg>
    </span>
  );
}

"use client";

import { useState } from "react";
import { FAQ } from "@/lib/seo";

export function AboutFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="about-faq">
      {FAQ.map((item, index) => {
        const isOpen = open === index;
        return (
          <div className={`about-faq-item ${isOpen ? "open" : ""}`} key={item.q}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : index)}
            >
              <span>{item.q}</span>
              <span aria-hidden>{isOpen ? "−" : "+"}</span>
            </button>
            <p hidden={!isOpen}>{item.a}</p>
          </div>
        );
      })}
    </div>
  );
}

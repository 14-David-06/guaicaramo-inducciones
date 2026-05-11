"use client";

import { useEffect } from "react";

/**
 * Adds the `in` class to elements with `.reveal` and `.modules-grid` when
 * they enter the viewport, triggering the CSS scroll-reveal animations.
 * Mount once at the page root.
 */
export function RevealOnScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof IntersectionObserver === "undefined") {
      // Fallback: just reveal everything immediately.
      document
      .querySelectorAll<HTMLElement>(".reveal")
        .forEach((el) => el.classList.add("in"));
      return;
    }

    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}

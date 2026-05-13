"use client";

import { useEffect, useRef, useState } from "react";

const HERO_IMAGES = [
  "/vlcsnap-2026-04-27-07h56m44s394.png",
  "/vlcsnap-2026-04-27-07h57m51s263.png",
  "/vlcsnap-2026-04-27-07h58m01s891.png",
  "/vlcsnap-2026-04-27-08h40m24s588.png",
  "/vlcsnap-2026-04-27-08h51m33s426.png",
  "/IMG_4306.JPG",
];

function useCrossfade(length: number, intervalMs = 5200) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % length), intervalMs);
    return () => clearInterval(t);
  }, [length, intervalMs]);
  return idx;
}

export function Hero() {
  const idx = useCrossfade(HERO_IMAGES.length);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = titleRef.current;
    if (!el) return;

    let raf = 0;
    function update() {
      raf = 0;
      const y = window.scrollY;
      // Fade across ~70% of viewport height. Eases out so it lingers a bit.
      const fadeDistance = window.innerHeight * 0.7;
      const t = Math.min(1, Math.max(0, y / fadeDistance));
      const opacity = 1 - t;
      el!.style.setProperty("--hero-fade", String(opacity));
      el!.style.setProperty("--hero-shift", `${t * -40}px`);
    }
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section className="hero" id="top">
      <div className="hero-stage" aria-hidden="true">
        {HERO_IMAGES.map((src, i) => (
          <div
            key={src}
            className={"hero-layer " + (i === idx ? "active kb" : "")}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
        <div className="hero-vignette" />
      </div>

      <div className="wrap hero-content">
        <h1 className="hero-title hero-title-fade" ref={titleRef}>
          <span className="line line-1">
            Naturaleza, <em>comunidad</em>
          </span>
          <span className="line line-2">y excelencia</span>
          <span className="line line-3">en armonía.</span>
        </h1>
      </div>
    </section>
  );
}

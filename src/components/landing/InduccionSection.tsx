"use client";

import { useEffect, useRef, useState } from "react";

type Pillar = {
  word: string;
  tag: string;
  Icon: React.ComponentType;
};

/* --------------------- icons (animated on reveal/hover) --------------------- */

function IconGente() {
  return (
    <svg viewBox="0 0 64 64" className="pill-icon" aria-hidden="true">
      <circle cx="32" cy="22" r="9" className="pill-stroke" />
      <path
        d="M14 52c2-9 9-14 18-14s16 5 18 14"
        className="pill-stroke"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCuidado() {
  return (
    <svg viewBox="0 0 64 64" className="pill-icon" aria-hidden="true">
      <path
        d="M32 8 L52 16 V32 C52 44 42 52 32 56 C22 52 12 44 12 32 V16 Z"
        className="pill-stroke"
        strokeLinejoin="round"
      />
      <path
        d="M22 32 L29 39 L43 25"
        className="pill-stroke pill-check"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconExcelencia() {
  return (
    <svg viewBox="0 0 64 64" className="pill-icon" aria-hidden="true">
      <polygon
        points="32,8 39,24 56,26 43,38 47,55 32,46 17,55 21,38 8,26 25,24"
        className="pill-stroke pill-star"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTierra() {
  return (
    <svg viewBox="0 0 64 64" className="pill-icon" aria-hidden="true">
      <path
        d="M14 50 C14 30 28 16 50 16 C50 36 36 50 18 50 C16.5 49.5 15.2 49.8 14 50 Z"
        className="pill-stroke pill-leaf"
        strokeLinejoin="round"
      />
      <path
        d="M14 50 C22 42 30 34 44 26"
        className="pill-stroke"
        strokeLinecap="round"
      />
    </svg>
  );
}

const PILLARS: Pillar[] = [
  { word: "Gente", tag: "La casa que cuida", Icon: IconGente },
  { word: "Cuidado", tag: "Seguridad cada día", Icon: IconCuidado },
  { word: "Excelencia", tag: "RSPO · ISCC · USDA", Icon: IconExcelencia },
  { word: "Tierra", tag: "Regeneramos el llano", Icon: IconTierra },
];

export function InduccionSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="section paper grain" id="induccion">
      <div className="wrap">
        <div
          ref={ref}
          className={`induccion-hero ${visible ? "is-visible" : ""}`}
        >
          <div className="eyebrow induccion-eyebrow">La casa Guaicaramo</div>
          <h2 className="induccion-headline">
            Conociendo <em>quienes somos</em>.
          </h2>
          <p className="induccion-lede">
            Cuatro palabras hablan de quienes somos.
          </p>

          <ul className="pillars">
            {PILLARS.map((p, i) => {
              const { Icon } = p;
              return (
                <li
                  key={p.word}
                  className="pillar"
                  style={{ ["--i" as string]: String(i) } as React.CSSProperties}
                >
                  <div className="pillar-icon-wrap">
                    <Icon />
                  </div>
                  <div className="pillar-word">{p.word}</div>
                  <div className="pillar-tag">{p.tag}</div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

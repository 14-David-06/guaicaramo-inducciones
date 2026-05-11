"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { MODULES as MODULE_DATA, type ModuleData } from "@/lib/modules-data";

export type { TopicGroup, ModuleData } from "@/lib/modules-data";
export { MODULES } from "@/lib/modules-data";

/* --------------------- per-module SVG animations --------------------- */

function AnimIntro() {
  return (
    <svg
      viewBox="0 0 240 240"
      className="mcard-anim-svg"
      style={{ width: "58%", height: "58%", opacity: 0.95 }}
    >
      <defs>
        <radialGradient id="iGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d9b77a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#d9b77a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="120" r="90" fill="url(#iGlow)" />
      <g fill="none" stroke="#f1ead8" strokeWidth="1" opacity="0.4">
        <circle cx="120" cy="120" r="70">
          <animate
            attributeName="r"
            values="66;74;66"
            dur="6s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="120" cy="120" r="54" strokeDasharray="3 6" />
      </g>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const x = 120 + Math.cos(a) * 70;
        const y = 120 + Math.sin(a) * 70;
        return (
          <circle key={i} cx={x} cy={y} r="6" fill="#d9b77a">
            <animate
              attributeName="r"
              values="4;7;4"
              dur={`${3 + i * 0.3}s`}
              repeatCount="indefinite"
              begin={`${i * 0.2}s`}
            />
          </circle>
        );
      })}
      <circle cx="120" cy="120" r="10" fill="#f1ead8" />
      <text
        x="120"
        y="125"
        textAnchor="middle"
        fontFamily="var(--font-display), serif"
        fontStyle="italic"
        fontSize="16"
        fill="#0c1f15"
      >
        G
      </text>
    </svg>
  );
}

function AnimBienestar() {
  return (
    <svg
      viewBox="0 0 240 240"
      className="mcard-anim-svg"
      style={{ width: "60%", height: "60%" }}
    >
      <g fill="none" stroke="#f1ead8" strokeWidth="1.2" opacity="0.9">
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx="120"
            cy="120"
            r={36 + i * 24}
            opacity={0.3 - i * 0.08}
          >
            <animate
              attributeName="r"
              values={`${36 + i * 24};${42 + i * 24};${36 + i * 24}`}
              dur={`${4 + i}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </g>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const x = 120 + Math.cos(a) * 82;
        const y = 120 + Math.sin(a) * 82;
        return (
          <g key={i} opacity="0.92">
            <circle cx={x} cy={y - 6} r="7" fill="#d9b77a" />
            <path
              d={`M ${x - 10} ${y + 14} Q ${x} ${y + 4} ${x + 10} ${y + 14} L ${x + 9} ${y + 22} L ${x - 9} ${y + 22} Z`}
              fill="#f1ead8"
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; 0 -2; 0 0"
                dur={`${3 + i * 0.4}s`}
                repeatCount="indefinite"
              />
            </path>
          </g>
        );
      })}
      <circle cx="120" cy="120" r="14" fill="#f1ead8" />
      <path
        d="M 110 120 L 118 128 L 132 112"
        fill="none"
        stroke="#2a5a38"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AnimSeguridad() {
  return (
    <svg
      viewBox="0 0 240 240"
      className="mcard-anim-svg"
      style={{ width: "52%", height: "52%" }}
    >
      <path
        d="M 120 40 L 186 66 L 186 130 C 186 168 160 194 120 208 C 80 194 54 168 54 130 L 54 66 Z"
        fill="none"
        stroke="#f1ead8"
        strokeWidth="1.6"
        opacity="0.35"
      >
        <animate
          attributeName="opacity"
          values="0.2;0.5;0.2"
          dur="3.5s"
          repeatCount="indefinite"
        />
      </path>
      <path
        d="M 120 56 L 172 76 L 172 128 C 172 160 152 182 120 194 C 88 182 68 160 68 128 L 68 76 Z"
        fill="#d9b77a"
        fillOpacity="0.18"
        stroke="#d9b77a"
        strokeWidth="1.4"
      />
      <rect x="110" y="100" width="20" height="52" rx="2" fill="#f1ead8">
        <animate
          attributeName="y"
          values="100;96;100"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </rect>
      <rect x="94" y="116" width="52" height="20" rx="2" fill="#f1ead8">
        <animate
          attributeName="x"
          values="94;90;94"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </rect>
      <path
        d="M 80 200 L 98 200 L 104 186 L 112 214 L 122 192 L 130 200 L 160 200"
        fill="none"
        stroke="#d9b77a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      >
        <animate
          attributeName="stroke-dasharray"
          values="0 200;200 0"
          dur="2.8s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

function AnimAmbiental() {
  return (
    <svg
      viewBox="0 0 240 240"
      className="mcard-anim-svg"
      style={{ width: "56%", height: "56%" }}
    >
      <path
        d="M 120 200 Q 118 160 120 120"
        fill="none"
        stroke="#f1ead8"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M 120 130 C 90 120 70 90 80 56 C 114 54 140 80 138 120 C 134 128 128 130 120 130 Z"
        fill="#d9b77a"
        fillOpacity="0.35"
        stroke="#f1ead8"
        strokeWidth="1.4"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="-2 120 130; 2 120 130; -2 120 130"
          dur="5s"
          repeatCount="indefinite"
        />
      </path>
      <path
        d="M 120 130 Q 105 100 90 78"
        fill="none"
        stroke="#f1ead8"
        strokeWidth="1"
        opacity="0.5"
      />
      <path
        d="M 120 170 C 140 164 156 148 156 126 C 138 126 124 140 122 166 Z"
        fill="#f1ead8"
        fillOpacity="0.3"
        stroke="#f1ead8"
        strokeWidth="1.2"
      />
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={60 + i * 60}
          cy="30"
          r="3"
          fill="#f1ead8"
          opacity="0.8"
        >
          <animate
            attributeName="cy"
            values={`20;${180 + i * 10};20`}
            dur={`${3 + i * 0.8}s`}
            repeatCount="indefinite"
            begin={`${i * 0.6}s`}
          />
          <animate
            attributeName="opacity"
            values="0;0.9;0"
            dur={`${3 + i * 0.8}s`}
            repeatCount="indefinite"
            begin={`${i * 0.6}s`}
          />
        </circle>
      ))}
    </svg>
  );
}

function AnimSistemas() {
  return (
    <svg
      viewBox="0 0 240 240"
      className="mcard-anim-svg"
      style={{ width: "58%", height: "58%" }}
    >
      <g transform="translate(120 120)">
        {[0, 1, 2].map((i) => {
          const r = 40 + i * 22;
          const pts = Array.from({ length: 6 })
            .map((_, k) => {
              const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
              return `${Math.cos(a) * r},${Math.sin(a) * r}`;
            })
            .join(" ");
          return (
            <polygon
              key={i}
              points={pts}
              fill="none"
              stroke="#f1ead8"
              strokeWidth="1.2"
              opacity={0.5 - i * 0.12}
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={i % 2 ? "0" : "60"}
                to={i % 2 ? "60" : "0"}
                dur={`${8 + i * 2}s`}
                repeatCount="indefinite"
              />
            </polygon>
          );
        })}
        <circle r="22" fill="#d9b77a" fillOpacity="0.85" />
        <path
          d="M -8 0 L -2 6 L 9 -6"
          fill="none"
          stroke="#0c1f15"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const x = 120 + Math.cos(a) * 96;
        const y = 120 + Math.sin(a) * 96;
        return (
          <circle key={i} cx={x} cy={y} r="3" fill="#f1ead8" opacity="0.7">
            <animate
              attributeName="opacity"
              values="0.2;1;0.2"
              dur={`${2 + i * 0.3}s`}
              repeatCount="indefinite"
              begin={`${i * 0.25}s`}
            />
          </circle>
        );
      })}
    </svg>
  );
}

/* --------------------- merge data + animations --------------------- */

type Module = ModuleData & { Anim: ComponentType };

const MODULES_WITH_ANIM: Module[] = MODULE_DATA.map((m) => {
  const animMap: Record<string, ComponentType> = {
    introduccion: AnimIntro,
    "bienestar-social": AnimBienestar,
    "seguridad-y-salud": AnimSeguridad,
    "gestion-ambiental": AnimAmbiental,
    "sistemas-integrados-de-gestion": AnimSistemas,
  };
  return { ...m, Anim: animMap[m.slug] ?? AnimIntro };
});

function ModuleCard({ m }: { m: Module }) {
  const { Anim } = m;
  return (
    <Link
      href={`/modulos/${m.slug}`}
      className={`mcard span-${m.span}`}
      aria-label={`Iniciar módulo ${m.num} · ${m.title}`}
    >
      <div
        className="mcard-bg"
        style={{
          backgroundImage: `url(${m.bg})`,
          backgroundPosition: m.bgPosition ?? "center",
        }}
        aria-hidden="true"
      />
      <div className="mcard-scrim" aria-hidden="true" />
      <div className="mcard-anim" aria-hidden="true">
        <Anim />
      </div>
      <div className="mcard-content">
        <div className="mcard-top">
          <span className="mcard-num">{m.num}</span>
          <span className="mcard-dur">⏱ {m.duration}</span>
        </div>
        <div>
          <div className="chip" style={{ marginBottom: 12 }}>
            {m.chip}
          </div>
          <h3 className="mcard-title">{m.title}</h3>
          <span className="mcard-cta">
            Iniciar módulo <span className="arr" />
          </span>
        </div>
      </div>
    </Link>
  );
}

interface ModulesSectionProps {
  authenticated?: boolean;
  onRequestAuth?: () => void;
}

export function ModulesSection({
  authenticated = false,
  onRequestAuth,
}: ModulesSectionProps) {
  const [inView, setInView] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="section dark" id="modulos">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow on-dark" style={{ marginBottom: 18 }}>
              Los módulos
            </div>
            <h2 className="title">
              Cinco pasos para vivir <em>el propósito</em>.
            </h2>
          </div>
          <div className="meta">
            5 módulos · ~90 min
            <br />
            Vigencia 2026
          </div>
        </div>

        <div className="modules-grid-wrapper">
          <div
            ref={gridRef}
            className={`modules-grid${authenticated ? "" : " modules-grid--locked"}${inView ? " in" : ""}`}
            aria-hidden={authenticated ? undefined : true}
          >
            {MODULES_WITH_ANIM.map((m) => (
              <ModuleCard key={m.num} m={m} />
            ))}
          </div>

          {!authenticated && (
            <div className="modules-lock-overlay" aria-live="polite">
              <div className="modules-lock-box">
                <div className="modules-lock-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    width="56"
                    height="56"
                  >
                    <rect
                      x="8"
                      y="22"
                      width="32"
                      height="22"
                      rx="4"
                      stroke="currentColor"
                      strokeWidth="2.4"
                    />
                    <path
                      d="M16 22v-6a8 8 0 0 1 16 0v6"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                    <circle cx="24" cy="33" r="3" fill="currentColor" />
                    <line
                      x1="24"
                      y1="36"
                      x2="24"
                      y2="40"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="modules-lock-text">
                  Identifícate para acceder a los módulos de inducción.
                </p>
                <button
                  className="modules-lock-btn"
                  onClick={onRequestAuth}
                  type="button"
                >
                  Autenticarse
                  <span className="arr" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


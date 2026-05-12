"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

const TABS = [
  { label: "Inicio", href: "#top" },
  { label: "Inducción", href: "#induccion" },
  { label: "Módulos", href: "#modulos" },
];

type CursorPos = { left: number; width: number; opacity: number };

export function Header({
  showNav = true,
  onModulosClick,
}: {
  showNav?: boolean;
  onModulosClick?: () => void;
} = {}) {
  const [pos, setPos] = useState<CursorPos>({ left: 0, width: 0, opacity: 0 });

  return (
    <nav className="hero-nav">
      <Link href="/" className="hero-logo" aria-label="Guaicaramo · inicio">
        <Image
          src="/logo-Guaicaramo.png"
          alt="Guaicaramo"
          width={268}
          height={118}
          priority
          loading="eager"
          className="hero-logo-img"
        />
      </Link>

      {showNav && (
        <ul
          className="nav-pill"
          onMouseLeave={() => setPos((p) => ({ ...p, opacity: 0 }))}
        >
          {TABS.map((t) => (
            <NavTab
              key={t.href}
              href={t.href}
              setPos={setPos}
              onClick={t.label === "Módulos" ? onModulosClick : undefined}
            >
              {t.label}
            </NavTab>
          ))}
          <li
            className="nav-cursor"
            aria-hidden="true"
            style={{
              left: pos.left + "px",
              width: pos.width + "px",
              opacity: pos.opacity,
            }}
          />
        </ul>
      )}

      
    </nav>
  );
}

function NavTab({
  children,
  href,
  setPos,
  onClick,
}: {
  children: React.ReactNode;
  href: string;
  setPos: (p: CursorPos) => void;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLLIElement | null>(null);
  return (
    <li
      ref={ref}
      className="nav-tab"
      onMouseEnter={() => {
        if (!ref.current) return;
        const { width } = ref.current.getBoundingClientRect();
        setPos({ width, opacity: 1, left: ref.current.offsetLeft });
      }}
    >
      <a
        href={href}
        onClick={
          onClick
            ? (e) => {
                /* scroll to section first, then open modal */
                onClick();
              }
            : undefined
        }
      >
        {children}
      </a>
    </li>
  );
}


import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { MODULES } from "@/lib/modules-data";
import { ModulePlayer } from "@/components/modulo/ModulePlayer";

const VIDEO_URL =
  "https://pub-8559129b6d5e44218087988775476431.r2.dev/videoplayback.mp4";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return MODULES.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const m = MODULES.find((x) => x.slug === slug);
  if (!m) return {};
  return {
    title: `${m.num} · ${m.title} · Guaicaramo`,
    description: m.blurb,
  };
}

export default async function ModulePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const idx = MODULES.findIndex((m) => m.slug === slug);
  if (idx === -1) notFound();
  const m = MODULES[idx];
  const nextHref = `/modulos/${m.slug}/firmar`;
  const nextLabel = "Firmar y generar certificado";

  return (
    <>
      <Header showNav={false} />

      <header className="mp-hero">
        <div
          className="mp-hero-bg"
          style={{
            backgroundImage: `url(${m.bg})`,
            backgroundPosition: m.bgPosition ?? "center",
          }}
          aria-hidden="true"
        />
        <div className="mp-hero-scrim" aria-hidden="true" />

        <div className="wrap mp-hero-content">
          <nav className="mp-crumbs" aria-label="Migajas de pan">
            <ol>
              <li>
                <Link href="/#modulos">Módulos</Link>
              </li>
              <li aria-hidden="true" className="mp-crumb-sep">
                /
              </li>
              <li>
                <span className="mp-crumb-current">
                  Módulo {m.num} · {m.title}
                </span>
              </li>
              <li aria-hidden="true" className="mp-crumb-sep">
                /
              </li>
              <li>
                <span className="mp-crumb-next">
                  Firmar y generar certificado
                </span>
              </li>
            </ol>
          </nav>

          <h1 className="mp-title">{m.title}</h1>
          <p className="mp-blurb">{m.blurb}</p>
        </div>
      </header>

      <section className="section paper grain mp-body">
        <div className="wrap">
          <div className="mp-grid">
            <aside className="mp-side">
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                Lo que verás
              </div>
              {m.topicGroups && m.topicGroups.length > 0 ? (
                <div className="mp-topic-groups">
                  {m.topicGroups.map((g, gi) => (
                    <details
                      key={gi}
                      className="mp-topic-group"
                      open={gi === 0}
                    >
                      <summary>
                        <span className="mp-topic-group-num">
                          {String(gi + 1).padStart(2, "0")}
                        </span>
                        <span className="mp-topic-group-title">
                          {g.title}
                        </span>
                        <span
                          className="mp-topic-group-count"
                          aria-hidden="true"
                        >
                          {g.items.length}
                        </span>
                        <span
                          className="mp-topic-group-chev"
                          aria-hidden="true"
                        />
                      </summary>
                      <ul className="mp-topic-group-list">
                        {g.items.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              ) : (
                <ol className="mp-topics">
                  {m.topics.map((t, i) => (
                    <li key={i}>
                      <span className="mp-topic-num">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="mp-topic-txt">{t}</span>
                    </li>
                  ))}
                </ol>
              )}

              <div className="mp-objective">
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  Objetivo
                </div>
                <p>{m.objective}</p>
              </div>
            </aside>

            <ModulePlayer
              slug={m.slug}
              videoSrc={VIDEO_URL}
              poster={m.bg}
              nextHref={nextHref}
              nextLabel={nextLabel}
            />
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

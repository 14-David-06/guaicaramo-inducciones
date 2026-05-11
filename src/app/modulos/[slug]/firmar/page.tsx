import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { MODULES } from "@/lib/modules-data";
import { SignatureForm } from "@/components/modulo/SignatureForm";

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
    title: `Firmar · ${m.num} ${m.title} · Guaicaramo`,
    description: `Validación y firma del módulo ${m.num} ${m.title}.`,
  };
}

export default async function SignPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const idx = MODULES.findIndex((m) => m.slug === slug);
  if (idx === -1) notFound();
  const m = MODULES[idx];
  const next = MODULES[idx + 1];
  const nextHref = next ? `/modulos/${next.slug}` : "/#modulos";
  const nextLabel = next
    ? `Continuar al módulo ${next.num}`
    : "Finalizar inducción";

  return (
    <>
      <Header showNav={false} />

      <header className="mp-hero sign-hero">
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
                <Link href={`/modulos/${m.slug}`}>
                  Módulo {m.num} · {m.title}
                </Link>
              </li>
              <li aria-hidden="true" className="mp-crumb-sep">
                /
              </li>
              <li>
                <span className="mp-crumb-current">
                  Validar cédula y firmar
                </span>
              </li>
            </ol>
          </nav>

          <h1 className="mp-title">Su certificado del módulo {m.num}</h1>
          <p className="mp-blurb">
            Confirmamos su identidad y registramos su firma para emitir el
            certificado de este módulo. Toma menos de un minuto.
          </p>
        </div>
      </header>

      <section className="section paper grain mp-body">
        <div className="wrap">
          <div className="sign-wrap">
            <SignatureForm
              slug={m.slug}
              moduleNum={m.num}
              moduleTitle={m.title}
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

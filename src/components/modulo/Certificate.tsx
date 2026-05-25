"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { findModule } from "@/lib/modules";

type StoredCert = {
  code: string;
  issuedAt: string;
  cedula: string;
  nombre?: string;
  firmaPng?: string;
};

const STORAGE_CERT = (slug: string) => `gc-mod-${slug}-cert`;

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const NUM_LETRAS = [
  "",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
  "veintiuno",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
  "treinta",
  "treinta y uno",
];

function formatCedula(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatFechaLarga(iso: string) {
  const d = new Date(iso);
  const day = d.getDate();
  const letra = NUM_LETRAS[day] ?? String(day);
  return `${letra.charAt(0).toUpperCase()}${letra.slice(1)} (${day}) de ${
    MONTHS[d.getMonth()]
  } de ${d.getFullYear()}`;
}

export function Certificate({ slug }: { slug: string }) {
  const mod = findModule(slug);
  const [cert, setCert] = useState<StoredCert | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Loaded as a blob: URL so there is no direct addressable image URL in the DOM.
  // The endpoint requires a valid session cookie — unauthenticated requests get 401.
  const [hrFirmaUrl, setHrFirmaUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CERT(slug));
      if (raw) setCert(JSON.parse(raw) as StoredCert);
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, [slug]);

  // Fetch the HR firma as a blob URL so no direct image URL is ever in the DOM.
  // Revoke the object URL on unmount to free memory.
  useEffect(() => {
    let objectUrl = "";
    fetch("/api/hr-firma", { credentials: "include" })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!blob) return;
        objectUrl = URL.createObjectURL(blob);
        setHrFirmaUrl(objectUrl);
      })
      .catch(() => {/* env var not set yet — silently degrade */});
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  // Backfill nombre if it's missing (cert created before nombre was stored)
  useEffect(() => {
    if (!cert || cert.nombre) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/empleado/verificar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cedula: cert.cedula }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          exists: boolean;
          nombre: string | null;
        };
        if (cancelled || !data.exists || !data.nombre) return;
        const updated = { ...cert, nombre: data.nombre };
        try {
          localStorage.setItem(STORAGE_CERT(slug), JSON.stringify(updated));
        } catch {
          /* ignore */
        }
        setCert(updated);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cert, slug]);

  if (!loaded) return null;

  if (!mod) {
    return (
      <div className="cert-empty">
        <p>Módulo no encontrado.</p>
        <Link href="/#modulos" className="btn btn-ghost">
          Volver a los módulos
        </Link>
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="cert-empty">
        <p>Aún no ha firmado este módulo.</p>
        <Link href={`/modulos/${slug}/firmar`} className="btn btn-primary">
          Firmar y generar certificado
        </Link>
      </div>
    );
  }

  const fechaLarga = formatFechaLarga(cert.issuedAt);
  const nombre = cert.nombre?.trim() || "Colaborador Guaicaramo";
  const topicsLine = mod.topics.join(", ");

  return (
    <div className="cert-page">
      <div className="cert-toolbar">
        <div className="cert-toolbar-meta">
          <span className="eyebrow">Certificado · módulo {mod.num}</span>
          <strong>{mod.title}</strong>
        </div>
        <div className="cert-toolbar-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
          >
            Imprimir / Guardar PDF
          </button>
          <Link href="/#modulos" className="btn btn-ghost">
            Volver a los módulos
          </Link>
        </div>
      </div>

      <div className="cert-wrap">
        <div className="certificate">
          <div className="cert-inner">
            <div className="chevron-band">
              <div className="chevrons">
                {Array.from({ length: 16 }).map((_, i) => (
                  <span key={i} className="chev-item" />
                ))}
              </div>
            </div>
            <div className="orange-line" />

            <div className="cert-content">
              <div className="watermark" aria-hidden="true">
                <div className="watermark-text">G</div>
              </div>

              <div className="cert-empresa">Guaicaramo S.A.S.</div>
              <div className="cert-title">
                {slug === "introduccion"
                  ? "Certificado · Inducción/Reinducción"
                  : `Certificado · Módulo ${mod.num} · ${mod.title}`}
              </div>
              <div className="constar">Se hace constar que</div>
              <div className="cert-name">{nombre}</div>
              <div className="cert-cedula">
                C.C. <span>{formatCedula(cert.cedula)}</span>
              </div>

              <p className="cert-body-text">
                Completó con éxito el módulo{" "}
                <strong>
                  {mod.num} · {mod.title}
                </strong>{" "}
                del proceso de Inducción / Reinducción de Guaicaramo S.A.S., en
                los siguientes temas: {topicsLine}.
              </p>

              <div className="h-rule">
                <span />
                <i />
                <span />
              </div>

              <div className="sig-row">
                <div className="sig-block">
                  {hrFirmaUrl ? (
                    <img
                      src={hrFirmaUrl}
                      alt="Firma Gestión Humana"
                      className="sig-img"
                      draggable={false}
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    />
                  ) : (
                    <div className="sig-space" />
                  )}
                  <div className="sig-line" />
                  <div className="sig-name">Gestión Humana</div>
                  <div className="sig-role">Guaicaramo S.A.S.</div>
                </div>
                <div className="sig-block">
                  {cert.firmaPng ? (
                    <img
                      src={cert.firmaPng}
                      alt="Firma del participante"
                      className="sig-img"
                    />
                  ) : (
                    <div className="sig-space" />
                  )}
                  <div className="sig-line" />
                  <div className="sig-name">{nombre}</div>
                  <div className="sig-role">Participante</div>
                </div>
              </div>

              <div className="bottom-info">
                <span>
                  Guaicaramo S.A.S. &nbsp;·&nbsp; Gestión Humana &nbsp;·&nbsp;
                  Código <strong>{cert.code}</strong>
                </span>
                <span>
                  Fecha de emisión:{" "}
                  <span className="date-val">{fechaLarga}</span>
                </span>
              </div>
            </div>

            <div className="orange-line" />
            <div className="chevron-band-bottom">
              <div className="chevrons-bottom">
                {Array.from({ length: 16 }).map((_, i) => (
                  <span key={i} className="chev-item-l" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Props = {
  slug: string;
  moduleNum: string;
  moduleTitle: string;
  nextHref: string;
  nextLabel: string;
};

type Step = "verify" | "sign" | "done";

const STORAGE_CERT = (slug: string) => `gc-mod-${slug}-cert`;
const STORAGE_DONE = (slug: string) => `gc-mod-${slug}-completed`;

function normalizeCedula(raw: string) {
  return raw.replace(/\D/g, "");
}

function formatCedula(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const SESSION_KEY = "gai_auth_session";

function readSessionCedula(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { expiry, cedula } = JSON.parse(raw) as { expiry: number; cedula?: string };
    if (Date.now() >= expiry) return null;
    return cedula ?? null;
  } catch {
    return null;
  }
}

export function SignatureForm({
  slug,
  moduleNum,
  moduleTitle,
  nextHref,
  nextLabel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasStrokeRef = useRef(false);

  const [step, setStep] = useState<Step>("verify");
  const [moduleDone, setModuleDone] = useState(false);
  const [cedula, setCedula] = useState("");
  const [verifiedCedula, setVerifiedCedula] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accept, setAccept] = useState(false);
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cert, setCert] = useState<{
    code: string;
    issuedAt: string;
    cedula: string;
    nombre?: string;
    firmaPng?: string;
  } | null>(null);

  // Mount: read existing state
  useEffect(() => {
    try {
      setModuleDone(localStorage.getItem(STORAGE_DONE(slug)) === "1");
      const raw = localStorage.getItem(STORAGE_CERT(slug));
      if (raw) {
        const parsed = JSON.parse(raw) as {
          code: string;
          issuedAt: string;
          cedula: string;
          nombre?: string;
          firmaPng?: string;
        };
        setCert(parsed);
        setStep("done");
        return;
      }
      // Skip verify step: use cédula from active session
      const sessionCedula = readSessionCedula();
      if (sessionCedula) {
        setVerifiedCedula(sessionCedula);
        setStep("sign");
      }
    } catch {
      /* ignore */
    }
  }, [slug]);

  // Configure canvas (HiDPI) when entering sign step
  useEffect(() => {
    if (step !== "sign") return;
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * ratio);
    c.height = Math.round(rect.height * ratio);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0c1f15";
  }, [step]);

  const getPos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawingRef.current = true;
    lastPointRef.current = getPos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || !lastPointRef.current) return;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
    hasStrokeRef.current = true;
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    lastPointRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  const clearSignature = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    hasStrokeRef.current = false;
  };

  const onVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotFound(false);

    if (!moduleDone) {
      setError(
        "Debe completar el video del módulo antes de validar y firmar."
      );
      return;
    }
    const digits = normalizeCedula(cedula);
    if (digits.length < 6 || digits.length > 12) {
      setError("Cédula inválida. Ingrese entre 6 y 12 dígitos.");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/empleado/verificar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cedula: digits }),
      });
      if (res.status === 429) {
        setError(
          "Demasiados intentos. Espere un minuto antes de volver a intentar."
        );
        return;
      }
      if (!res.ok) {
        setError("No fue posible validar en este momento. Intente de nuevo.");
        return;
      }
      const data = (await res.json()) as { exists: boolean };
      if (!data.exists) {
        setNotFound(true);
        return;
      }
      setVerifiedCedula(digits);
      setStep("sign");
    } catch {
      setError("Error de red. Verifique su conexión e intente de nuevo.");
    } finally {
      setVerifying(false);
    }
  };

  const onSign = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!verifiedCedula) {
      setError("Sesión expirada. Vuelva a validar su cédula.");
      setStep("verify");
      return;
    }
    if (!hasStrokeRef.current) {
      setError("Por favor firme en el recuadro.");
      return;
    }
    if (!accept) {
      setError("Debe aceptar la declaración para continuar.");
      return;
    }
    if (!acceptPolicy) {
      setError(
        "Debe autorizar el tratamiento de datos personales para continuar."
      );
      return;
    }

    setSubmitting(true);
    try {
      const firma = canvasRef.current?.toDataURL("image/png") ?? "";
      if (!firma.startsWith("data:image/png;base64,")) {
        setError("No se pudo capturar la firma. Intente de nuevo.");
        return;
      }

      const res = await fetch("/api/certificado", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cedula: verifiedCedula,
          moduloNum: moduleNum,
          moduloSlug: slug,
          firma,
        }),
      });

      if (res.status === 429) {
        setError(
          "Demasiados intentos. Espere un minuto antes de volver a intentar."
        );
        return;
      }
      if (res.status === 404) {
        setError(
          "Su cédula ya no se encuentra en la base. Diríjase a Gestión Humana."
        );
        setStep("verify");
        setVerifiedCedula(null);
        return;
      }
      if (!res.ok) {
        setError(
          "No fue posible registrar el certificado. Intente de nuevo."
        );
        return;
      }

      const data = (await res.json()) as {
        codigo: string;
        emitidoEn: string;
        nombre?: string;
        firmaPng?: string;
      };
      const payload = {
        code: data.codigo,
        issuedAt: data.emitidoEn,
        cedula: verifiedCedula,
        nombre: data.nombre,
        firmaPng: data.firmaPng ?? firma,
      };

      try {
        localStorage.setItem(STORAGE_CERT(slug), JSON.stringify(payload));
      } catch {
        /* ignore */
      }

      setCert(payload);
      setStep("done");
    } catch {
      setError("Error de red. Verifique su conexión e intente de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  // ------- DONE -------
  if (step === "done" && cert) {
    return (
      <div className="sign-card sign-success">
        <div className="sign-success-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28">
            <path
              d="M5 12.5 L10 17 L19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="sign-success-title">Certificado emitido</h2>
        <p className="sign-success-sub">
          Quedó registrado su paso por el módulo {moduleNum} ·{" "}
          {moduleTitle}.
        </p>

        <dl className="sign-cert">
          {cert.nombre ? (
            <div>
              <dt>Nombre</dt>
              <dd>{cert.nombre}</dd>
            </div>
          ) : null}
          <div>
            <dt>Cédula</dt>
            <dd>{formatCedula(cert.cedula)}</dd>
          </div>
          <div>
            <dt>Emitido</dt>
            <dd>
              {new Date(cert.issuedAt).toLocaleString("es-CO", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </dd>
          </div>
        </dl>

        <div className="sign-actions">
          <Link href={nextHref} className="btn btn-ghost">
            {nextLabel} <span className="btn-arrow" aria-hidden="true" />
          </Link>
          <Link href="/#modulos" className="btn btn-ghost">
            Volver a los módulos
          </Link>
        </div>
      </div>
    );
  }

  // ------- SIGN -------
  if (step === "sign") {
    return (
      <form className="sign-card" onSubmit={onSign} noValidate>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Firma
        </div>
        <h2 className="sign-title">Firme para emitir su certificado</h2>
        <p className="sign-sub">
          Cédula: <strong>{formatCedula(verifiedCedula ?? "")}</strong>
          {". "}
          Firme en el recuadro para registrar el módulo {moduleNum} ·{" "}
          {moduleTitle}.
        </p>

        <div className="sign-field">
          <div className="sign-pad-head">
            <label htmlFor="sf-pad">Firma</label>
            <button
              type="button"
              className="sign-clear"
              onClick={clearSignature}
            >
              Limpiar
            </button>
          </div>
          <canvas
            id="sf-pad"
            ref={canvasRef}
            className="sign-pad"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
          <p className="sign-hint">Firme con el mouse o con el dedo.</p>
        </div>

        <label className="sign-check">
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
          />
          <span>
            Declaro que vi el contenido completo del módulo y que la cédula
            ingresada me corresponde.
          </span>
        </label>

        <label className="sign-check">
          <input
            type="checkbox"
            checked={acceptPolicy}
            onChange={(e) => setAcceptPolicy(e.target.checked)}
          />
          <span>
            <strong>Política de Tratamiento de Datos Personales.</strong>{" "}
            Autorizo de manera libre, voluntaria e informada a GUAICARAMO,
            para realizar el tratamiento de los datos personales
            consignados en el presente formato, con el objetivo de dar
            cumplimiento a la legislación vigente en materia de protección
            de datos personales, en especial a la Ley 1581 de 2012, de
            igual forma la captura de imágenes por temas de seguridad de la
            compañía. La Política de Tratamiento de Datos Personales de
            GUAICARAMO se encuentra disponible para consulta en{" "}
            <a
              href="https://guaicaramo.com/quienes-somos/"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://guaicaramo.com/quienes-somos/
            </a>
            .
          </span>
        </label>

        {error && (
          <div className="sign-error" role="alert">
            {error}
          </div>
        )}

        <div className="sign-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            Emitir certificado{" "}
            <span className="btn-arrow" aria-hidden="true" />
          </button>
        </div>
      </form>
    );
  }

  // ------- VERIFY -------
  return (
    <form className="sign-card" onSubmit={onVerify} noValidate>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Paso 1 · Validación
      </div>
      <h2 className="sign-title">Confirme su cédula para continuar</h2>
      <p className="sign-sub">
        Verificamos que esté registrado como colaborador antes de habilitar
        la firma del módulo {moduleNum} · {moduleTitle}.
      </p>

      {!moduleDone && (
        <div className="sign-warn" role="status">
          Aún no ha completado el video del módulo. Vuelva a verlo
          completo antes de validar.
        </div>
      )}

      <div className="sign-field">
        <label htmlFor="sf-ced">Cédula de ciudadanía</label>
        <input
          id="sf-ced"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={cedula}
          onChange={(e) => {
            setCedula(e.target.value.replace(/[^\d.]/g, ""));
            setNotFound(false);
            setError(null);
          }}
          placeholder="Solo números"
          required
        />
      </div>

      {notFound && (
        <div className="sign-error sign-error-strong" role="alert">
          <strong>No encontramos su registro en la base de colaboradores.</strong>
          <br />
          Por favor diríjase al área de <em>Gestión Humana</em> para que le
          ayuden a resolver su caso.
        </div>
      )}

      {error && (
        <div className="sign-error" role="alert">
          {error}
        </div>
      )}

      <div className="sign-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={verifying || !moduleDone}
        >
          {verifying ? "Validando…" : "Validar cédula"}{" "}
          <span className="btn-arrow" aria-hidden="true" />
        </button>
        <Link href={`/modulos/${slug}`} className="btn btn-ghost">
          Volver al módulo
        </Link>
      </div>
    </form>
  );
}

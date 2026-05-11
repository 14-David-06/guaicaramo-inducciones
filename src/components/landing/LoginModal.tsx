"use client";

import { useEffect, useRef, useState } from "react";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (nombre: string) => void;
}

/* Rendered only while open — unmounts completely on close, backdrop gone */
function LoginModalContent({
  onClose,
  onSuccess,
}: Omit<LoginModalProps, "open">) {
  const [cedula, setCedula] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  /* Open the native dialog once on mount */
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function resetAndClose() {
    onClose();
  }

  /* Close on backdrop click */
  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (loading) return;
    const rect = dialogRef.current!.getBoundingClientRect();
    const outside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;
    if (outside) resetAndClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cedula.trim()) {
      setError("Ingrese su número de cédula.");
      return;
    }
    if (pin.length !== 4) {
      setError("El PIN debe tener exactamente 4 dígitos.");
      return;
    }

    setLoading(true);
    setError("");
    setErrorCode(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula, pin }),
      });

      const data: {
        ok?: boolean;
        nombre?: string;
        error?: string;
        code?: string;
      } = await res.json();

      if (res.status === 429) {
        setError(data.error ?? "Demasiadas solicitudes. Intente más tarde.");
        return;
      }
      if (!data.ok) {
        setError(data.error ?? "Credenciales incorrectas.");
        setErrorCode(data.code ?? null);
        return;
      }

      /* success — close dialog first, then unlock modules */
      onClose();
      onSuccess(data.nombre ?? "");
    } catch {
      setError("Error de conexión. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="login-modal"
      onCancel={(e) => {
        e.preventDefault();
        if (!loading) resetAndClose();
      }}
      onClick={handleDialogClick}
      aria-labelledby="login-title"
    >
      <div className="login-modal-inner" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="login-modal-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Acceso a módulos
            </div>
            <h2 id="login-title" className="login-modal-title">
              Identifícate
            </h2>
          </div>
          <button
            className="login-modal-close"
            aria-label="Cerrar"
            onClick={resetAndClose}
            type="button"
            disabled={loading}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} className="login-modal-form" noValidate>
          <div className="login-field">
            <label htmlFor="lm-cedula" className="login-label">
              Número de cédula
            </label>
            <input
              id="lm-cedula"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="username"
              className="login-input"
              placeholder="Ej. 1234567890"
              autoFocus
              value={cedula}
              disabled={loading}
              onChange={(e) => {
                setCedula(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
            />
          </div>

          <div className="login-field">
            <label htmlFor="lm-pin" className="login-label">
              PIN personal (4 dígitos)
            </label>
            <input
              id="lm-pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              className="login-input"
              placeholder="••••"
              maxLength={4}
              value={pin}
              disabled={loading}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                setError("");
              }}
            />
          </div>

          {error && (
            <div
              className={`login-error${errorCode === "not_found" ? " login-error--info" : ""}`}
            >
              {errorCode === "not_found" && (
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{ flexShrink: 0, marginTop: 2 }}
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Verificando…" : "Ingresar"}
            {!loading && <span className="arr" />}
          </button>
        </form>
      </div>
    </dialog>
  );
}

export function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  if (!open) return null;
  return <LoginModalContent onClose={onClose} onSuccess={onSuccess} />;
}

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { InduccionSection } from "./InduccionSection";
import { ModulesSection } from "./ModulesSection";
import { Footer } from "./Footer";
import { LoginModal } from "./LoginModal";

const SESSION_KEY = "gai_auth_session";
// Keep the client-side flag aligned with the server cookie's absolute lifetime
// (see ABSOLUTE_TTL_S in session-cookie.ts) to limit client/server drift.
const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 h

function readSession(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const { expiry } = JSON.parse(raw) as { expiry: number };
    return Date.now() < expiry;
  } catch {
    return false;
  }
}

function writeSession(cedula: string) {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ expiry: Date.now() + SESSION_TTL, cedula })
    );
  } catch { /* storage unavailable */ }
}

export function LandingClient() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const reason = searchParams.get("reason");
    // Any of these means the server redirected us here because our session was
    // missing, invalid or expired. The client-side localStorage flag can be
    // stale (e.g. after the session cookie expired or its format changed), so
    // we must NOT trust it here — clear it and force re-authentication. This
    // prevents an infinite bounce where the grid looks unlocked but every
    // module request is rejected by the server and the login modal never opens.
    const serverBounced =
      searchParams.get("login") === "1" ||
      searchParams.get("auth") === "required" ||
      reason === "inactive" ||
      reason === "expired";

    if (serverBounced) {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch { /* storage unavailable */ }
      setAuthenticated(false);
      setLoginOpen(true);
      if (reason === "inactive") {
        setNotice("Tu sesión expiró por inactividad. Inicia sesión de nuevo.");
      } else if (reason === "expired") {
        setNotice("Tu sesión finalizó. Inicia sesión de nuevo.");
      }
      return;
    }

    if (readSession()) {
      setAuthenticated(true);
    }
  }, [searchParams]);

  function openLogin() {
    if (authenticated) return;
    setLoginOpen(true);
  }

  function handleAuthSuccess(_nombre: string, cedula: string) {
    writeSession(cedula);
    setNotice(null);
    setAuthenticated(true);
    const returnTo = searchParams.get("next") ?? searchParams.get("return");
    const dest = returnTo?.startsWith("/modulos/") ? returnTo : "/#modulos";
    // Always hard-navigate after login: this discards the Next.js client router
    // cache (which may hold a pre-login 307 redirect for /modulos/*) and drops
    // the ?login/&reason params, so the page re-renders cleanly using the fresh
    // session cookie just set by /api/auth/login.
    window.location.href = dest;
  }

  return (
    <>
      <Header onModulosClick={openLogin} />
      <Hero />
      <InduccionSection />
      <ModulesSection
        authenticated={authenticated}
        onRequestAuth={openLogin}
      />
      <Footer />
      <LoginModal
        open={loginOpen}
        notice={notice}
        onClose={() => {
          setNotice(null);
          setLoginOpen(false);
        }}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}

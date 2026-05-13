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
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 h

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
  const searchParams = useSearchParams();

  useEffect(() => {
    if (readSession()) {
      setAuthenticated(true);
    } else if (searchParams.get("login") === "1" || searchParams.get("auth") === "required") {
      setLoginOpen(true);
    }
  }, [searchParams]);

  function openLogin() {
    if (authenticated) return;
    setLoginOpen(true);
  }

  function handleAuthSuccess(_nombre: string, cedula: string) {
    writeSession(cedula);
    setAuthenticated(true);
    const returnTo = searchParams.get("next") ?? searchParams.get("return");
    if (returnTo?.startsWith("/modulos/")) {
      // Hard navigation to bypass the Next.js router cache, which in production
      // holds a prefetch redirect for /modulos/* (proxy blocked it pre-login).
      window.location.href = returnTo;
    }
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
        onClose={() => setLoginOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}

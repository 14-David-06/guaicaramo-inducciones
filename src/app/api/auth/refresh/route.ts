import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/session-cookie";
import {
  AUTH_CODES,
  authErrorResponse,
  checkSession,
  setRenewedSessionCookie,
} from "@/lib/api-auth";
import { isSameOrigin } from "@/lib/http-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------- rate limiting: 10 attempts / minute / IP ---------- */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_MAX) return false;
  b.count += 1;
  return true;
}

/**
 * Silent renewal endpoint. The client calls this preventively while the user is
 * active. It verifies the session is still active (not idle past the inactivity
 * window and within the absolute lifetime) and slides the inactivity counter
 * forward by re-issuing the cookie. If the session already lapsed by
 * inactivity, no renewal is granted — matching the rule that an inactive
 * session cannot be revived.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";

  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intente de nuevo en un minuto." },
      { status: 429 },
    );
  }

  const cookieStore = await cookies();
  const session = await checkSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!session.ok) {
    // Map a missing/garbled refresh cookie to REFRESH_INVALID; keep the
    // inactivity/expiry codes intact so the client reacts correctly.
    const code =
      session.code === AUTH_CODES.NO_TOKEN ||
      session.code === AUTH_CODES.INVALID_TOKEN
        ? AUTH_CODES.REFRESH_INVALID
        : session.code;
    return authErrorResponse(code);
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  return setRenewedSessionCookie(res, session.renewedCookie);
}

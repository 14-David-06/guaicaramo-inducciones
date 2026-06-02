/**
 * Authentication helpers for API route handlers.
 *
 * The session lives entirely in a signed httpOnly cookie (see session-cookie.ts).
 * These helpers translate the cookie state into the precise error codes the
 * client relies on, and produce a "slid" cookie value so that every
 * authenticated request silently resets the inactivity window.
 */
import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  clearSessionCookieOptions,
  readSessionCookieValue,
  sessionCookieOptions,
  slideSessionCookieValue,
  type SessionStatus,
} from "@/lib/session-cookie";

export const AUTH_CODES = {
  NO_TOKEN: "NO_TOKEN",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  SESSION_INACTIVE: "SESSION_INACTIVE",
  REFRESH_INVALID: "REFRESH_INVALID",
} as const;

export type AuthCode = (typeof AUTH_CODES)[keyof typeof AUTH_CODES];

const MESSAGES: Record<AuthCode, string> = {
  NO_TOKEN: "No autorizado.",
  INVALID_TOKEN: "Sesión inválida.",
  TOKEN_EXPIRED: "La sesión expiró.",
  SESSION_INACTIVE: "Tu sesión expiró por inactividad.",
  REFRESH_INVALID: "No se pudo renovar la sesión.",
};

/** Build a 401 JSON response carrying a specific machine-readable code. */
export function authErrorResponse(code: AuthCode): NextResponse {
  return NextResponse.json(
    { error: MESSAGES[code], code },
    { status: 401 },
  );
}

function codeForStatus(status: Exclude<SessionStatus, "valid">): AuthCode {
  switch (status) {
    case "inactive":
      return AUTH_CODES.SESSION_INACTIVE;
    case "expired":
      return AUTH_CODES.TOKEN_EXPIRED;
    default:
      return AUTH_CODES.INVALID_TOKEN;
  }
}

export type SessionCheck =
  | { ok: true; cedula: string; issuedAt: number; renewedCookie: string }
  | { ok: false; code: AuthCode };

/**
 * Validate the session cookie value. On success returns a freshly slid cookie
 * value the caller should set on its response (silent renewal). On failure
 * returns the matching error code.
 */
export async function checkSession(
  cookieValue: string | undefined | null,
): Promise<SessionCheck> {
  if (!cookieValue) return { ok: false, code: AUTH_CODES.NO_TOKEN };

  const state = await readSessionCookieValue(cookieValue);
  if (state.status !== "valid") {
    return { ok: false, code: codeForStatus(state.status) };
  }

  const renewedCookie = await slideSessionCookieValue(
    state.cedula,
    state.issuedAt,
  );
  return {
    ok: true,
    cedula: state.cedula,
    issuedAt: state.issuedAt,
    renewedCookie,
  };
}

/** Attach a silently-renewed session cookie to an outgoing response. */
export function setRenewedSessionCookie(
  res: NextResponse,
  renewedCookie: string,
): NextResponse {
  res.cookies.set(COOKIE_NAME, renewedCookie, sessionCookieOptions());
  return res;
}

/** Attach a cookie-clearing header to an outgoing response (logout). */
export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(COOKIE_NAME, "", clearSessionCookieOptions());
  return res;
}

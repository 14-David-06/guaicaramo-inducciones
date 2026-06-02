/**
 * Edge-compatible (Web Crypto API) session cookie helpers.
 * Used by both middleware (Edge) and the login API route (Node.js).
 */

// Strip any surrounding quotes/whitespace that could appear when the value is
// copied verbatim from the .env.local format
const _cookieName = (process.env.COOKIE_NAME ?? "")
  .trim()
  .replace(/^["']|["']$/g, "");
if (!_cookieName) throw new Error("Missing COOKIE_NAME env variable");
export const COOKIE_NAME: string = _cookieName;

/**
 * Two independent limits, mirroring an access/refresh-token model but expressed
 * inside a single signed httpOnly cookie (the cookie itself is the long-lived,
 * server-held credential — there is no token in the browser's JS at all):
 *
 *  - INACTIVITY_TTL_S: the session closes if no authenticated request is made
 *    within this window. Every authenticated request slides it forward.
 *  - ABSOLUTE_TTL_S: a hard ceiling on total session lifetime, regardless of
 *    activity. Once reached the session cannot be renewed.
 */
export const INACTIVITY_TTL_S = 60 * 60; // 1 h of inactivity
export const ABSOLUTE_TTL_S = 12 * 60 * 60; // 12 h hard cap

export type SessionStatus =
  | "valid" // signature ok, active and within absolute lifetime
  | "inactive" // signature ok, but idle past INACTIVITY_TTL_S
  | "expired" // signature ok, but past ABSOLUTE_TTL_S
  | "invalid"; // missing, malformed or bad signature

export interface SessionState {
  status: SessionStatus;
  /** Cédula (digits only) of the authenticated employee bound to this session. */
  cedula: string;
  /** Unix seconds the session was first created (preserved across renewals). */
  issuedAt: number;
  /** Unix seconds of the last recorded activity. */
  lastActivity: number;
}

function getSecret(): string {
  // Accept either SESSION_SECRET (preferred) or the older SIGNATURE_ENCRYPTION_KEY
  // so deployments that only have the latter still work.
  const s = (
    process.env.SESSION_SECRET ?? process.env.SIGNATURE_ENCRYPTION_KEY ?? ""
  ).trim();
  if (!s) throw new Error("Missing SESSION_SECRET env variable");
  return s;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function fromBase64Url(s: string): ArrayBuffer {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u.buffer as ArrayBuffer;
}

function sanitizeCedula(cedula: string): string {
  return (cedula ?? "").replace(/\D/g, "");
}

/**
 * Create a fresh session cookie value bound to an employee:
 * `<cedula>.<issuedAt>.<lastActivity>.<hmac>`
 */
export async function createSessionCookieValue(
  cedula: string,
  now = nowS(),
): Promise<string> {
  return signSession(sanitizeCedula(cedula), now, now);
}

/**
 * Re-issue a cookie for an existing session, resetting the inactivity counter
 * while preserving the original `issuedAt` (so the absolute cap still applies)
 * and the bound cédula.
 */
export async function slideSessionCookieValue(
  cedula: string,
  issuedAt: number,
  now = nowS(),
): Promise<string> {
  return signSession(sanitizeCedula(cedula), issuedAt, now);
}

async function signSession(
  cedula: string,
  issuedAt: number,
  lastActivity: number,
): Promise<string> {
  const payload = `${cedula}.${issuedAt}.${lastActivity}`;
  const key = await importKey(getSecret());
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return `${payload}.${toBase64Url(sig)}`;
}

function nowS(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Parse and validate a session cookie. Distinguishes a tampered/malformed
 * cookie (`invalid`) from a genuine session that has gone idle (`inactive`) or
 * exceeded its absolute lifetime (`expired`), so callers can return precise
 * error codes.
 */
export async function readSessionCookieValue(
  value: string | undefined | null,
): Promise<SessionState> {
  const empty: SessionState = {
    status: "invalid",
    cedula: "",
    issuedAt: 0,
    lastActivity: 0,
  };
  try {
    if (!value) return empty;
    const parts = value.split(".");
    if (parts.length !== 4) return empty;
    const [cedulaRaw, issuedRaw, lastRaw, sigPart] = parts;
    const cedula = sanitizeCedula(cedulaRaw);
    const issuedAt = parseInt(issuedRaw, 10);
    const lastActivity = parseInt(lastRaw, 10);
    if (!cedula) return empty;
    if (!Number.isFinite(issuedAt) || !Number.isFinite(lastActivity)) return empty;

    const key = await importKey(getSecret());
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(sigPart),
      new TextEncoder().encode(`${cedulaRaw}.${issuedRaw}.${lastRaw}`),
    );
    if (!valid) return empty;

    const now = nowS();
    if (now - issuedAt >= ABSOLUTE_TTL_S) {
      return { status: "expired", cedula, issuedAt, lastActivity };
    }
    if (now - lastActivity >= INACTIVITY_TTL_S) {
      return { status: "inactive", cedula, issuedAt, lastActivity };
    }
    return { status: "valid", cedula, issuedAt, lastActivity };
  } catch {
    return empty;
  }
}

/** Convenience boolean check (true only when the session is fully valid). */
export async function verifySessionCookieValue(value: string): Promise<boolean> {
  return (await readSessionCookieValue(value)).status === "valid";
}

/** Cookie attributes to use when setting the session cookie. */
export function sessionCookieOptions(maxAge = INACTIVITY_TTL_S) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Attributes to expire/clear the session cookie. */
export function clearSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  };
}

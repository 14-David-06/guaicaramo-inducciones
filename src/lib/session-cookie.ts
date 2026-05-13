/**
 * Edge-compatible (Web Crypto API) session cookie helpers.
 * Used by both middleware (Edge) and the login API route (Node.js).
 */

const _cookieName = process.env.COOKIE_NAME;
if (!_cookieName) throw new Error("Missing COOKIE_NAME env variable");
export const COOKIE_NAME: string = _cookieName;
const TTL_S = 24 * 60 * 60; // 24 h

function getSecret(): string {
  const s = process.env.SESSION_SECRET ?? "";
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

/** Create a signed cookie value: `<expiry_ts>.<hmac>` */
export async function createSessionCookieValue(): Promise<string> {
  const expiry = (Math.floor(Date.now() / 1000) + TTL_S).toString();
  const key = await importKey(getSecret());
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(expiry),
  );
  return `${expiry}.${toBase64Url(sig)}`;
}

/** Returns true if the value is a valid, unexpired signed session cookie. */
export async function verifySessionCookieValue(
  value: string,
): Promise<boolean> {
  try {
    const dot = value.indexOf(".");
    if (dot === -1) return false;
    const expiry = value.slice(0, dot);
    const sigPart = value.slice(dot + 1);
    if (!expiry || !sigPart) return false;

    const now = Math.floor(Date.now() / 1000);
    if (parseInt(expiry, 10) < now) return false;

    const key = await importKey(getSecret());
    return crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(sigPart),
      new TextEncoder().encode(expiry),
    );
  } catch {
    return false;
  }
}

/** Cookie attributes to use when setting the session cookie. */
export function sessionCookieOptions(maxAge = TTL_S) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}

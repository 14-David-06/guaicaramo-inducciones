import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison. Returns false for length mismatches without
 * leaking timing information about how many characters matched.
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Compare against itself to keep the work constant-ish, then fail.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * CSRF defense for state-changing requests: require the browser-sent `Origin`
 * (or `Referer` as a fallback) to match the request host. Non-browser callers
 * that omit both are rejected. An optional allowlist can be provided via the
 * `ALLOWED_ORIGINS` env var (comma-separated hostnames).
 */
export function isSameOrigin(req: Request): boolean {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  if (!host) return false;

  const allow = new Set(
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
  allow.add(host);

  const candidate = req.headers.get("origin") ?? req.headers.get("referer");
  if (!candidate) return false;

  try {
    const originHost = new URL(candidate).host.toLowerCase();
    return allow.has(originHost);
  } catch {
    return false;
  }
}

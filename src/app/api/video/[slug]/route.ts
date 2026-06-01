import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import type { IssuedSignedToken } from "@vercel/blob";
import { COOKIE_NAME, verifySessionCookieValue } from "@/lib/session-cookie";
import { MODULES } from "@/lib/modules-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// How long issued credentials stay valid. Long enough that a single viewing
// session never outlives the signed URL, short enough to limit link sharing.
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 h
// Re-issue the delegation token a bit before it expires.
const REFRESH_BEFORE_MS = 30 * 60 * 1000; // 30 min

// In-memory cache of the store-wide delegation token (scoped to "*", get/head).
// Reused across requests so we don't hit the Blob control API on every play.
let cachedToken: { token: IssuedSignedToken; expiresAt: number } | null = null;

async function getSignedToken(rwToken: string): Promise<IssuedSignedToken> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - REFRESH_BEFORE_MS > now) {
    return cachedToken.token;
  }
  const validUntil = now + TOKEN_TTL_MS;
  const token = await issueSignedToken({
    pathname: "*",
    operations: ["get", "head"],
    validUntil,
    token: rwToken,
  });
  cachedToken = { token, expiresAt: validUntil };
  return token;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  if (
    !sessionCookie?.value ||
    !(await verifySessionCookieValue(sessionCookie.value))
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // ── Resolve blob path ─────────────────────────────────────────────────────
  const { slug } = await params;
  const moduleData = MODULES.find((m) => m.slug === slug);
  if (!moduleData?.blobPath) {
    return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
  }

  const rwToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!rwToken) {
    return NextResponse.json(
      { error: "Configuración de almacenamiento incompleta" },
      { status: 500 },
    );
  }

  // ── Generate a short-lived signed URL and redirect ────────────────────────
  // The browser then streams the video DIRECTLY from the Vercel Blob CDN
  // (native HTTP Range support, no serverless function in the data path),
  // which eliminates the buffering caused by proxying multi-GB files.
  try {
    const signedToken = await getSignedToken(rwToken);
    const { presignedUrl } = await presignUrl(signedToken, {
      operation: "get",
      pathname: moduleData.blobPath,
      access: "private",
      validUntil: Date.now() + TOKEN_TTL_MS,
    });

    // 307 keeps the GET method; the URL itself is short-lived so it cannot be
    // shared permanently. Tell the browser not to cache the redirect.
    const res = NextResponse.redirect(presignedUrl, 307);
    res.headers.set("cache-control", "private, no-store");
    return res;
  } catch {
    return NextResponse.json(
      { error: "No se pudo preparar el video" },
      { status: 502 },
    );
  }
}

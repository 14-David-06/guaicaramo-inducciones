import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifySessionCookieValue } from "@/lib/session-cookie";
import { MODULES } from "@/lib/modules-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOB_STORE_HOST =
  "7kksyp4x7tikshye.private.blob.vercel-storage.com";

// Only forward these response headers from the upstream to the client.
const FORWARDED_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "last-modified",
  "etag",
];

export async function GET(
  req: NextRequest,
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
  const module = MODULES.find((m) => m.slug === slug);
  if (!module?.blobPath) {
    return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Configuración de almacenamiento incompleta" },
      { status: 500 },
    );
  }

  // ── Proxy to private Vercel Blob ──────────────────────────────────────────
  // Encode the path, preserving any path segments.
  const encodedPath = module.blobPath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const blobUrl = `https://${BLOB_STORE_HOST}/${encodedPath}`;

  const upstreamHeaders: HeadersInit = {
    Authorization: `Bearer ${token}`,
  };

  // Forward Range header so video seeking works correctly.
  const range = req.headers.get("range");
  if (range) upstreamHeaders["Range"] = range;

  let upstream: Response;
  try {
    upstream = await fetch(blobUrl, { headers: upstreamHeaders });
  } catch {
    return NextResponse.json(
      { error: "Error al obtener el video" },
      { status: 502 },
    );
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: "Video no disponible" },
      { status: upstream.status },
    );
  }

  // Build response headers — only forward safe, relevant headers.
  const resHeaders = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const val = upstream.headers.get(name);
    if (val) resHeaders.set(name, val);
  }
  // Allow the browser's private disk cache to store segments.
  // This is essential for smooth video seeking — without it every Range
  // request re-flows through this proxy even when replaying already-seen
  // parts. "private" keeps it browser-only (no shared/CDN cache); "immutable"
  // tells the browser never to revalidate, so already-buffered ranges are
  // served instantly from disk on scrub-back / replay.
  resHeaders.set("cache-control", "private, max-age=31536000, immutable");
  // Explicit hint so browsers know range requests are supported.
  if (!resHeaders.has("accept-ranges")) {
    resHeaders.set("accept-ranges", "bytes");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

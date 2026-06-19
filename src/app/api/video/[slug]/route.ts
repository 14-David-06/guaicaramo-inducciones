import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/session-cookie";
import {
  authErrorResponse,
  checkSession,
  setRenewedSessionCookie,
} from "@/lib/api-auth";
import { MODULES } from "@/lib/modules-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const session = await checkSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!session.ok) {
    return authErrorResponse(session.code);
  }

  // ── Resolve R2 key ────────────────────────────────────────────────────────
  const { slug } = await params;
  const moduleData = MODULES.find((m) => m.slug === slug);
  if (!moduleData?.blobPath) {
    return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
  }

  // ── Proxy stream from R2 (URL never exposed to the browser) ──────────────
  // Forwarding Range allows the browser to seek without re-downloading.
  const rangeHeader = req.headers.get("range") ?? undefined;

  let s3Res;
  try {
    s3Res = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: moduleData.blobPath,
        Range: rangeHeader,
      }),
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo cargar el video" },
      { status: 502 },
    );
  }

  if (!s3Res.Body) {
    return NextResponse.json({ error: "Video vacío" }, { status: 502 });
  }

  const webStream = (
    s3Res.Body as { transformToWebStream(): ReadableStream }
  ).transformToWebStream();

  const status = rangeHeader ? 206 : 200;
  const headers = new Headers({
    "Content-Type": s3Res.ContentType ?? "video/mp4",
    // inline → browser plays in-page, never triggers "Save As"
    "Content-Disposition": "inline",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  });
  if (s3Res.ContentLength) headers.set("Content-Length", String(s3Res.ContentLength));
  if (s3Res.ContentRange)  headers.set("Content-Range", s3Res.ContentRange);

  const response = new NextResponse(webStream, { status, headers });
  setRenewedSessionCookie(response, session.renewedCookie);
  return response;
}

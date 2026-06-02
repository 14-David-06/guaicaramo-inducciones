import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const SIGNED_URL_TTL_S = 3600; // 1 hour

export async function GET(
  _req: NextRequest,
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

  // ── Generate presigned URL and redirect ───────────────────────────────────
  // getSignedUrl is a local crypto operation — no network call, no cache needed.
  // The browser streams directly from R2 (native Range support), same as before.
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: moduleData.blobPath,
    });
    const presignedUrl = await getSignedUrl(s3, command, {
      expiresIn: SIGNED_URL_TTL_S,
    });

    const res = NextResponse.redirect(presignedUrl, 307);
    res.headers.set("cache-control", "private, no-store");
    setRenewedSessionCookie(res, session.renewedCookie);
    return res;
  } catch {
    return NextResponse.json(
      { error: "No se pudo preparar el video" },
      { status: 502 },
    );
  }
}

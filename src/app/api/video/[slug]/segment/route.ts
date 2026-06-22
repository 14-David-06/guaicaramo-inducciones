import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/session-cookie";
import { authErrorResponse, checkSession, setRenewedSessionCookie } from "@/lib/api-auth";
import { MODULES } from "@/lib/modules-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Presigned URLs are embedded in the quality playlist and fetched directly
// by HLS.js from R2 — Vercel only serves this tiny text manifest.
const SEGMENT_URL_TTL_S = 7200;

// In-memory cache for raw quality playlist content (before presigning).
// Avoids a round-trip from Vercel → R2 on every quality-level switch.
// Presigning is a local HMAC op and is always done fresh per request.
const rawPlaylistCache = new Map<string, { body: string; expiresAt: number }>();
const RAW_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function makeS3() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const cookieStore = await cookies();
  const session = await checkSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!session.ok) return authErrorResponse(session.code);

  const { slug } = await params;
  const moduleData = MODULES.find((m) => m.slug === slug);
  if (!moduleData?.blobPath) {
    return NextResponse.json({ error: "Módulo no encontrado" }, { status: 404 });
  }

  // file comes as ?f=480p.m3u8 — avoids Next.js ignoring routes with file extensions
  const file = req.nextUrl.searchParams.get("f") ?? "";
  if (!/^[\w-]+\.m3u8$/.test(file)) {
    return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
  }

  const folder = "hls/" + moduleData.blobPath.replace(".mp4", "");
  const key = `${folder}/${file}`;
  const s3 = makeS3();

  // Use in-memory cached raw playlist if available — avoids Vercel → R2 round-trip
  // on quality-level switches. Presigning is always done fresh (local HMAC, no network).
  let text: string;
  const cached = rawPlaylistCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    text = cached.body;
  } else {
    let s3Res;
    try {
      s3Res = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
    } catch (err) {
      console.error("[HLS segment] GetObject failed:", key, String(err));
      return NextResponse.json({ error: "Playlist no encontrado" }, { status: 404 });
    }
    text = await s3Res.Body!.transformToString();
    rawPlaylistCache.set(key, { body: text, expiresAt: Date.now() + RAW_CACHE_TTL_MS });
  }

  // Replace every .ts filename with a fresh presigned R2 URL (local HMAC, ~ms).
  // HLS.js fetches segments directly from R2 — zero Vercel bandwidth.
  const rewritten = await Promise.all(
    text.split("\n").map((line) => {
      const t = line.trim();
      if (t.endsWith(".ts")) {
        return getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: `${folder}/${t}` }),
          { expiresIn: SEGMENT_URL_TTL_S },
        );
      }
      return Promise.resolve(line);
    }),
  );

  // Browser may cache this for up to 1 hour (presigned URLs last 2h).
  // Different users get different presigned URLs but the same underlying segments.
  const response = new NextResponse(rewritten.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "private, max-age=3600",
    },
  });
  setRenewedSessionCookie(response, session.renewedCookie);
  return response;
}

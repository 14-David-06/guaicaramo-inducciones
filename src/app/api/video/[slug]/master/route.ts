import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/session-cookie";
import { authErrorResponse, checkSession, setRenewedSessionCookie } from "@/lib/api-auth";
import { MODULES } from "@/lib/modules-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const cookieStore = await cookies();
  const session = await checkSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!session.ok) return authErrorResponse(session.code);

  const { slug } = await params;
  const moduleData = MODULES.find((m) => m.slug === slug);
  if (!moduleData?.blobPath) {
    return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
  }

  const folder = "hls/" + moduleData.blobPath.replace(".mp4", "");

  const s3 = makeS3();
  let s3Res;
  try {
    s3Res = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: `${folder}/master.m3u8`,
      }),
    );
  } catch {
    return NextResponse.json({ error: "Manifest no encontrado" }, { status: 404 });
  }

  const raw = await s3Res.Body!.transformToString();
  // Rewrite quality playlist references so HLS.js resolves them through the
  // authenticated segment route instead of treating them as relative paths.
  const text = raw
    .split("\n")
    .map((line: string) => {
      const t = line.trim();
      if (t.endsWith(".m3u8") && !t.startsWith("#")) {
        return `/api/video/${slug}/segment?f=${t}`;
      }
      return line;
    })
    .join("\n");

  const response = new NextResponse(text, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "private, no-store",
    },
  });
  setRenewedSessionCookie(response, session.renewedCookie);
  return response;
}

const R2_PUBLIC = "https://pub-21a107109d3442958dbdeff19c32e7d2.r2.dev";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Origin",
  "Access-Control-Max-Age": "86400",
};

async function verifyToken(token, secret) {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const hourStr = token.slice(0, dot);
  const hexSig = token.slice(dot + 1);
  const hour = parseInt(hourStr, 10);
  if (!isFinite(hour)) return false;

  const currentHour = Math.floor(Date.now() / 3600000);
  if (Math.abs(hour - currentHour) > 1) return false; // ±1h tolerance

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigBytes = new Uint8Array(hexSig.match(/../g).map(b => parseInt(b, 16)));
  return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(hourStr));
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/hls\/([\w-]+)\/([\w.-]+)$/);
    if (!match) return new Response("Not found", { status: 404, headers: CORS });

    const [, mod, file] = match;

    // Segments: redirect directo a R2 público (sin token — no tienen utilidad solos)
    if (file.endsWith(".ts")) {
      return Response.redirect(`${R2_PUBLIC}/hls/${mod}/${file}`, 302);
    }

    // Manifiestos (.m3u8): requieren token válido
    if (!await verifyToken(url.searchParams.get("t"), env.SESSION_SECRET)) {
      return new Response("Unauthorized", { status: 401, headers: CORS });
    }

    const r2 = await fetch(`${R2_PUBLIC}/hls/${mod}/${file}`);
    if (!r2.ok) return new Response("Not found", { status: 404, headers: CORS });

    const token = url.searchParams.get("t");
    const origin = `https://${url.hostname}`;
    const text = await r2.text();

    const rewritten = text.split("\n").map(line => {
      const t = line.trim();
      // master.m3u8: reescribir rutas de calidad para que pasen por el Worker con token
      if (file === "master.m3u8" && t.endsWith(".m3u8") && !t.startsWith("#")) {
        return `${origin}/hls/${mod}/${t}?t=${token}`;
      }
      // playlists de calidad: apuntar segmentos .ts directo a R2
      if (file !== "master.m3u8" && t.endsWith(".ts")) {
        return `${R2_PUBLIC}/hls/${mod}/${t}`;
      }
      return line;
    }).join("\n");

    return new Response(rewritten, {
      headers: {
        ...CORS,
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "private, max-age=3600",
      },
    });
  },
};

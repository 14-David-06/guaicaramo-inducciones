import { NextResponse } from "next/server";
import { findCertificadoFirma } from "@/lib/airtable";
import { decryptString } from "@/lib/crypto";
import { safeEqual } from "@/lib/http-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Devuelve la firma desencriptada (PNG en base64) de un certificado.
 * Requiere el header `x-admin-token`. El secreto se toma de ADMIN_TOKEN
 * (preferido); si no está definido, se acepta SIGNATURE_ENCRYPTION_KEY como
 * compatibilidad. La comparación es de tiempo constante.
 *
 * Uso:
 *   GET /api/certificado/firma?codigo=GC-01-552176-260427
 *     -> { codigo, hashCertificado, firmaPng }   // firmaPng es data URL
 *   GET /api/certificado/firma?codigo=...&format=png
 *     -> binario image/png (para abrir directo en el navegador)
 */
export async function GET(req: Request) {
  const token = req.headers.get("x-admin-token") ?? "";
  const expected =
    process.env.ADMIN_TOKEN || process.env.SIGNATURE_ENCRYPTION_KEY || "";
  if (!expected || !token || !safeEqual(token, expected)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const codigo = (url.searchParams.get("codigo") ?? "").trim();
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();

  if (!/^GC-\d{1,3}-\d{6}-\d{6}$/.test(codigo)) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  try {
    const found = await findCertificadoFirma(codigo);
    if (!found) {
      return NextResponse.json(
        { error: "Certificado o firma no encontrada" },
        { status: 404 }
      );
    }

    const firmaPng = decryptString(found.firmaCifrada);

    if (format === "png") {
      const base64 = firmaPng.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "cache-control": "private, no-store",
        },
      });
    }

    return NextResponse.json(
      {
        codigo,
        hashCertificado: found.hashCertificado ?? null,
        firmaPng,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[/api/certificado/firma] error:", err);
    return NextResponse.json(
      { error: "No fue posible desencriptar la firma." },
      { status: 500 }
    );
  }
}

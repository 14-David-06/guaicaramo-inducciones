import { NextResponse } from "next/server";
import {
  crearCertificado,
  findEmpleado,
  normalizeCedula,
} from "@/lib/airtable";
import { encryptString, sha256Hex } from "@/lib/crypto";
import { generateCertPdfBuffer } from "@/lib/cert-puppeteer";
import { sendCertNotification } from "@/lib/mailer";
import { MODULES } from "@/lib/modules-data";

const MAX_FIRMA_BYTES = 200_000; // ~200 KB raw base64 PNG
const FIRMA_DATA_URL_RE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string) {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_MAX) return false;
  b.count += 1;
  return true;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";

  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const obj =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const cedula = normalizeCedula(String(obj.cedula ?? ""));
  const moduloNum = String(obj.moduloNum ?? "").trim();
  const moduloSlug = String(obj.moduloSlug ?? "").trim();
  const firma = typeof obj.firma === "string" ? obj.firma : "";

  if (cedula.length < 6 || cedula.length > 12) {
    return NextResponse.json({ error: "Cédula inválida" }, { status: 400 });
  }
  if (!/^\d{1,3}$/.test(moduloNum) || !/^[a-z0-9-]{2,60}$/.test(moduloSlug)) {
    return NextResponse.json({ error: "Módulo inválido" }, { status: 400 });
  }
  if (
    !firma ||
    firma.length > MAX_FIRMA_BYTES ||
    !FIRMA_DATA_URL_RE.test(firma)
  ) {
    return NextResponse.json(
      { error: "Firma inválida o ausente." },
      { status: 400 }
    );
  }

  try {
    const empleado = await findEmpleado(cedula);
    if (!empleado) {
      return NextResponse.json(
        { error: "No encontramos su registro en la base de colaboradores." },
        { status: 404 }
      );
    }

    const issuedAt = new Date().toISOString();
    const codigo = `GC-${moduloNum}-${cedula.slice(-6)}-${issuedAt
      .slice(2, 10)
      .replace(/-/g, "")}`;

    const firmaCifrada = encryptString(firma);
    const hashCertificado = sha256Hex(
      `${codigo}|${moduloNum}-${moduloSlug}|${empleado.recordId}|${firma}`
    );

    const result = await crearCertificado({
      codigo,
      moduloVersion: `${moduloNum}-${moduloSlug}`,
      personalRecordId: empleado.recordId,
      firmaCifrada,
      hashCertificado,
    });

    const responsePayload = {
      codigo: result.codigo,
      emitidoEn: result.emitidoEn,
      nombre: empleado.nombre,
      firmaPng: firma,
    };

    // Send email notification with certificate PDF attachment (non-blocking — errors are logged only)
    const mod = MODULES.find((m) => m.slug === moduloSlug);
    if (mod) {
      generateCertPdfBuffer({
        nombre: empleado.nombre,
        cedula,
        moduloNum,
        moduloTitle: mod.title,
        moduloSlug,
        topics: mod.topics,
        codigo: result.codigo,
        issuedAt: result.emitidoEn,
        firmaPng: firma,
      })
        .then((certPdfBuffer) =>
          sendCertNotification({
            nombre: empleado.nombre,
            cedula,
            moduloNum,
            moduloTitle: mod.title,
            codigo: result.codigo,
            issuedAt: result.emitidoEn,
            certPdfBuffer,
          })
        )
        .catch((mailErr) => {
          console.error("[/api/certificado] email notification failed:", mailErr);
        });
    }

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (err) {
    console.error("[/api/certificado] error:", err);
    return NextResponse.json(
      { error: "No fue posible registrar el certificado en este momento." },
      { status: 502 }
    );
  }
}

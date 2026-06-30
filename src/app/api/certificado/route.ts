import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  crearCertificado,
  findEmpleado,
  marcarModuloCompletado,
  normalizeCedula,
} from "@/lib/airtable";
import { encryptString, sha256Hex } from "@/lib/crypto";
import { generateCertPdfBuffer } from "@/lib/cert-puppeteer";
import { subirCertificado } from "@/lib/onedrive";
import { MODULES } from "@/lib/modules-data";
import { COOKIE_NAME } from "@/lib/session-cookie";
import { authErrorResponse, checkSession } from "@/lib/api-auth";
import { isSameOrigin } from "@/lib/http-security";

// El campo "Firma Colaborador" en Airtable es texto (máx. 100 000 caracteres).
// La firma se cifra (AES-GCM) y se codifica en base64 antes de guardarla, lo que
// infla el tamaño ~33%. Limitamos el data URL a 70 000 caracteres para que la
// firma cifrada quede holgadamente por debajo del límite de Airtable.
const MAX_FIRMA_BYTES = 70_000;
const FIRMA_DATA_URL_RE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds — PDF generation + OneDrive upload can take ~20-40 s

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
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  // Require an active, valid session bound to an employee.
  const cookieStore = await cookies();
  const session = await checkSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!session.ok) {
    return authErrorResponse(session.code);
  }

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
  // The certificate may only be issued for the authenticated employee.
  if (cedula !== session.cedula) {
    return NextResponse.json(
      { error: "La cédula no corresponde a la sesión activa." },
      { status: 403 },
    );
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

    // Update the module completion checkbox in the Personal record (fire-and-forget).
    marcarModuloCompletado(empleado.recordId, moduloSlug).catch(() => { /* ignore */ });

    const responsePayload = {
      codigo: result.codigo,
      emitidoEn: result.emitidoEn,
      nombre: empleado.nombre,
      firmaPng: firma,
    };

    // Send email notification with certificate PDF attachment.
    // Must be awaited before returning — Vercel terminates the process
    // immediately after the response is sent (no background work allowed).
    const mod = MODULES.find((m) => m.slug === moduloSlug);
    if (!mod) {
      console.warn(`[/api/certificado] Módulo no encontrado: ${moduloSlug} — se omite PDF y upload`);
    }
    if (mod) {
      let certPdfBuffer: Buffer | undefined;
      try {
        certPdfBuffer = await generateCertPdfBuffer({
          nombre: empleado.nombre,
          cedula,
          moduloNum,
          moduloTitle: mod.title,
          moduloSlug,
          topics: mod.topics,
          codigo: result.codigo,
          issuedAt: result.emitidoEn,
          firmaPng: firma,
        });
      } catch (pdfErr) {
        console.error("[/api/certificado] PDF generation failed:", pdfErr);
      }

      if (certPdfBuffer) {
        try {
          await subirCertificado({
            nombrePersona: empleado.nombre,
            modulo: moduloNum,
            pdfBuffer: certPdfBuffer,
          });
        } catch (uploadErr) {
          console.error("[/api/certificado] OneDrive upload failed:", uploadErr);
        }

      }
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

import { NextResponse } from "next/server";
import { findEmpleado, normalizeCedula } from "@/lib/airtable";
import {
  createSessionCookieValue,
  sessionCookieOptions,
  COOKIE_NAME,
} from "@/lib/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------- rate limiting ---------- */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 15;
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

/* ---------- handler ---------- */
export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";

  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intente de nuevo en un minuto." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const raw =
    body && typeof body === "object" && "cedula" in body
      ? String((body as Record<string, unknown>).cedula ?? "")
      : "";
  const pinRaw =
    body && typeof body === "object" && "pin" in body
      ? String((body as Record<string, unknown>).pin ?? "")
      : "";

  const cedula = normalizeCedula(raw);
  const pin = pinRaw.replace(/\D/g, "");

  /* basic format checks */
  if (cedula.length < 6 || cedula.length > 12) {
    return NextResponse.json(
      { error: "Número de cédula inválido." },
      { status: 200 }
    );
  }
  if (pin.length !== 4) {
    return NextResponse.json(
      { error: "El PIN debe tener 4 dígitos." },
      { status: 200 }
    );
  }

  /* PIN validation lives here — never exposed to the client */
  const expectedPin = cedula.slice(-4);
  if (pin !== expectedPin) {
    return NextResponse.json(
      { error: "Cédula o PIN incorrecto." },
      { status: 200 }
    );
  }

  /* verify employee exists in Airtable */
  try {
    const emp = await findEmpleado(cedula);
    if (!emp) {
      return NextResponse.json(
        {
          error:
            "Tu cédula no está registrada en el sistema. Acércate al área de Gestión Humana para realizar tu registro antes de continuar.",
          code: "not_found",
        },
        { status: 200 }
      );
    }
    const cookieValue = await createSessionCookieValue();
    const res = NextResponse.json(
      { ok: true, nombre: emp.nombre },
      { status: 200 }
    );
    res.cookies.set(COOKIE_NAME, cookieValue, sessionCookieOptions());
    return res;
  } catch {
    return NextResponse.json(
      { error: "Error al verificar las credenciales. Intente de nuevo.", code: "server_error" },
      { status: 500 }
    );
  }
}

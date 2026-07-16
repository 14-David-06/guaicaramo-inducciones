import "server-only";
import { resolveEmpresa, type Empresa } from "./brands";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const getToken = () => getEnv("AIRTABLE_API_KEY_GUAICARAMO_INDUCCIONES");
const getBaseId = () => getEnv("AIRTABLE_BASE_ID");
const getPersonalTableId = () => getEnv("AIRTABLE_TABLE_PERSONAL_ID");
const getCertificadosTableId = () =>
  getEnv("AIRTABLE_TABLE_CERTIFICADOS_ID");

// Field IDs — referencing fields by ID avoids issues with invisible
// characters (BOM/zero-width) in field names like "﻿Empleado" / "﻿Codigo".
const F = {
  personal: {
    empleado: () => getEnv("AIRTABLE_FIELD_PERSONAL_EMPLEADO_ID"),
    nombre: () => getEnv("AIRTABLE_FIELD_PERSONAL_NOMBRE_ID"),
    empresa: () => getEnv("AIRTABLE_FIELD_PERSONAL_EMPRESA_ID"),
  },
  // Slug → env-var name for the Personal module-completion checkbox fields.
  moduleCheckboxEnvKey: {
    "introduccion":                    "AIRTABLE_FIELD_PERSONAL_M01_ID",
    "bienestar-social":                "AIRTABLE_FIELD_PERSONAL_M02_ID",
    "seguridad-y-salud":               "AIRTABLE_FIELD_PERSONAL_M03_ID",
    "gestion-ambiental":               "AIRTABLE_FIELD_PERSONAL_M04_ID",
    "sistemas-integrados-de-gestion":  "AIRTABLE_FIELD_PERSONAL_M05_ID",
  } as Record<string, string>,
  cert: {
    codigo: () => getEnv("AIRTABLE_FIELD_CERT_CODIGO_ID"),
    hash: () => getEnv("AIRTABLE_FIELD_CERT_HASH_ID"),
    firma: () => getEnv("AIRTABLE_FIELD_CERT_FIRMA_ID"),
    personal: () => getEnv("AIRTABLE_FIELD_CERT_PERSONAL2_ID"),
    moduloVersion: () => getEnv("AIRTABLE_FIELD_CERT_MODULO_VERSION_ID"),
    emitidoEn: () => getEnv("AIRTABLE_FIELD_CERT_EMITIDO_EN_ID"),
  },
} as const;

function airtableUrl(tableId: string, qs = "") {
  return `https://api.airtable.com/v0/${getBaseId()}/${tableId}${qs}`;
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

export function normalizeCedula(raw: string) {
  return raw.replace(/\D/g, "");
}

export type Empleado = { recordId: string; nombre: string; empresa: Empresa };

/**
 * Looks up a Personal record by cedula. Returns recordId + nombre,
 * or null when not found.
 */
export async function findEmpleado(
  cedula: string
): Promise<Empleado | null> {
  const digits = normalizeCedula(cedula);
  if (digits.length < 6 || digits.length > 12) return null;

  const empleadoFid = F.personal.empleado();
  const nombreFid = F.personal.nombre();
  const empresaFid = F.personal.empresa();

  const formula = encodeURIComponent(`{${empleadoFid}}=${digits}`);
  const url = airtableUrl(
    getPersonalTableId(),
    `?filterByFormula=${formula}&maxRecords=1` +
      `&returnFieldsByFieldId=true` +
      `&fields%5B%5D=${empleadoFid}&fields%5B%5D=${nombreFid}` +
      `&fields%5B%5D=${empresaFid}`
  );

  const res = await fetch(url, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Airtable lookup failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    records?: { id: string; fields: Record<string, unknown> }[];
  };
  const r = data.records?.[0];
  if (!r) return null;
  // El campo Empresa es singleSelect: Airtable lo devuelve como string con
  // returnFieldsByFieldId, pero puede venir como {name} — resolveEmpresa maneja ambos.
  const empresaRaw = r.fields[empresaFid];
  const empresaName =
    empresaRaw && typeof empresaRaw === "object"
      ? (empresaRaw as { name?: string }).name
      : (empresaRaw as string | undefined);
  return {
    recordId: r.id,
    nombre: String(r.fields[nombreFid] ?? "")
      .replace(/[\r\n\t\x00-\x1f\x7f]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    empresa: resolveEmpresa(empresaName),
  };
}

export async function findEmpleadoRecordId(
  cedula: string
): Promise<string | null> {
  return (await findEmpleado(cedula))?.recordId ?? null;
}

export async function empleadoExists(cedula: string): Promise<boolean> {
  return (await findEmpleado(cedula)) !== null;
}

export type Certificado = {
  codigo: string;
  moduloVersion: string;
  personalRecordId: string;
  firmaCifrada?: string;
  hashCertificado?: string;
};

/**
 * Creates a Certificado record. EmitidoEn is filled by Airtable (createdTime).
 */
export async function crearCertificado(
  cert: Certificado
): Promise<{ id: string; codigo: string; emitidoEn: string }> {
  const url = airtableUrl(getCertificadosTableId());
  const fields: Record<string, unknown> = {
    [F.cert.codigo()]: cert.codigo,
    [F.cert.moduloVersion()]: cert.moduloVersion,
    [F.cert.personal()]: [cert.personalRecordId],
  };
  if (cert.firmaCifrada) fields[F.cert.firma()] = cert.firmaCifrada;
  if (cert.hashCertificado) fields[F.cert.hash()] = cert.hashCertificado;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "content-type": "application/json",
    },
    body: JSON.stringify({ fields, typecast: true }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable create failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    id: string;
    createdTime?: string;
    fields: Record<string, unknown>;
  };
  const codigoFid = F.cert.codigo();
  const emitidoFid = F.cert.emitidoEn();
  return {
    id: data.id,
    codigo: String(data.fields[codigoFid] ?? cert.codigo),
    emitidoEn:
      (data.fields[emitidoFid] as string | undefined) ??
      data.createdTime ??
      new Date().toISOString(),
  };
}

/**
 * Devuelve los slugs de módulos que el empleado ya tiene certificados (ej. ["introduccion"]).
 * Usa el campo enlazado Certificados del registro Personal para evitar filtros de fórmula
 * poco confiables sobre campos de registro enlazado.
 * Lanza excepción en errores de red/API para que el llamador decida si omitir la sincronización.
 */
export async function getCertificadosDelEmpleado(
  personalRecordId: string
): Promise<string[]> {
  const certsFid      = getEnv("AIRTABLE_FIELD_PERSONAL_CERTIFICADOS_ID");
  const moduloVerFid  = F.cert.moduloVersion();

  // Step 1 — get the list of certificate record IDs from the Personal record.
  // NOTE: el endpoint GET de un registro único NO acepta el parámetro fields[]
  // (devuelve 422). Se pide el registro completo y se lee el campo por su ID.
  const r1 = await fetch(
    `https://api.airtable.com/v0/${getBaseId()}/${getPersonalTableId()}` +
    `/${encodeURIComponent(personalRecordId)}` +
    `?returnFieldsByFieldId=true`,
    { headers: authHeaders(), cache: "no-store" }
  );
  if (!r1.ok) throw new Error(`Personal fetch ${r1.status}`);
  const d1 = (await r1.json()) as { fields: Record<string, unknown> };
  const certIds = (d1.fields[certsFid] as string[] | undefined) ?? [];
  if (certIds.length === 0) return [];

  // Step 2 — fetch those cert records to read moduloVersion.
  const formula =
    certIds.length === 1
      ? `RECORD_ID()="${certIds[0]}"`
      : `OR(${certIds.map((id) => `RECORD_ID()="${id}"`).join(",")})`;
  const r2 = await fetch(
    airtableUrl(
      getCertificadosTableId(),
      `?filterByFormula=${encodeURIComponent(formula)}` +
        `&returnFieldsByFieldId=true&fields%5B%5D=${moduloVerFid}`
    ),
    { headers: authHeaders(), cache: "no-store" }
  );
  if (!r2.ok) throw new Error(`Certs fetch ${r2.status}`);
  const d2 = (await r2.json()) as { records?: { fields: Record<string, unknown> }[] };
  return (d2.records ?? [])
    .map((r) => {
      const v = r.fields[moduloVerFid];
      // singleSelect fields come back as {id, name, color} objects, not plain strings.
      return (v && typeof v === "object" ? (v as { name?: string }).name ?? "" : String(v ?? "")).trim();
    })
    .filter(Boolean)
    .map((mv) => mv.replace(/^\d+-/, "")); // "01-introduccion" → "introduccion"
}

/**
 * Marca el checkbox del módulo correspondiente en el registro Personal.
 * Llamada al emitir un certificado. Falla silenciosamente — no interrumpe el flujo.
 */
export async function marcarModuloCompletado(
  personalRecordId: string,
  moduloSlug: string
): Promise<void> {
  const envKey = F.moduleCheckboxEnvKey[moduloSlug];
  const fieldId = envKey ? process.env[envKey] : undefined;
  if (!fieldId) return;

  await fetch(
    `https://api.airtable.com/v0/${getBaseId()}/${getPersonalTableId()}/${encodeURIComponent(personalRecordId)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ fields: { [fieldId]: true } }),
      cache: "no-store",
    }
  );
}

/**
 * Sincroniza los 5 checkboxes de módulos del registro Personal con la lista
 * de slugs completados. Llamada en el login para hacer backfill desde Certificados.
 */
export async function sincronizarModulosPersonal(
  personalRecordId: string,
  completedSlugs: string[]
): Promise<void> {
  const fields: Record<string, boolean> = {};
  for (const [slug, envKey] of Object.entries(F.moduleCheckboxEnvKey)) {
    const fieldId = process.env[envKey];
    if (fieldId) fields[fieldId] = completedSlugs.includes(slug);
  }
  if (Object.keys(fields).length === 0) return;

  await fetch(
    `https://api.airtable.com/v0/${getBaseId()}/${getPersonalTableId()}/${encodeURIComponent(personalRecordId)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ fields }),
      cache: "no-store",
    }
  );
}

/**
 * Looks up a Certificado record by Codigo. Returns the encrypted Firma blob,
 * or null when not found / no signature stored.
 */
export async function findCertificadoFirma(
  codigo: string
): Promise<{ firmaCifrada: string; hashCertificado?: string } | null> {
  if (!/^[A-Z0-9-]{6,40}$/i.test(codigo)) return null;
  const codigoFid = F.cert.codigo();
  const firmaFid = F.cert.firma();
  const hashFid = F.cert.hash();
  const formula = encodeURIComponent(`{${codigoFid}}="${codigo}"`);
  const url = airtableUrl(
    getCertificadosTableId(),
    `?filterByFormula=${formula}&maxRecords=1` +
      `&returnFieldsByFieldId=true` +
      `&fields%5B%5D=${firmaFid}&fields%5B%5D=${hashFid}`
  );
  const res = await fetch(url, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Airtable lookup failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    records?: { fields: Record<string, unknown> }[];
  };
  const r = data.records?.[0];
  const firma = r?.fields[firmaFid] as string | undefined;
  if (!r || !firma) return null;
  return {
    firmaCifrada: firma,
    hashCertificado: r.fields[hashFid] as string | undefined,
  };
}

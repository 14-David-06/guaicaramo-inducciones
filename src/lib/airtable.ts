import "server-only";

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
  },
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

export type Empleado = { recordId: string; nombre: string };

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

  const formula = encodeURIComponent(`{${empleadoFid}}=${digits}`);
  const url = airtableUrl(
    getPersonalTableId(),
    `?filterByFormula=${formula}&maxRecords=1` +
      `&returnFieldsByFieldId=true` +
      `&fields%5B%5D=${empleadoFid}&fields%5B%5D=${nombreFid}`
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
  return {
    recordId: r.id,
    nombre: String(r.fields[nombreFid] ?? "").trim(),
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

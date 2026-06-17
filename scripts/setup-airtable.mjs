// Idempotent Airtable schema setup for the Guaicaramo inducciones base.
// Run with:  node scripts/setup-airtable.mjs
//
// Requires AIRTABLE_API_KEY_GUAICARAMO_INDUCCIONES in .env.local with a PAT
// that has scopes: data.records:read, data.records:write, schema.bases:read,
// schema.bases:write.
//
// The script will:
//   1. Fetch the current schema.
//   2. Create any missing tables.
//   3. Add any missing fields to existing tables (using safe types).
//   4. NEVER drop or rename anything.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  let text;
  try { text = readFileSync(filePath, "utf8"); } catch { return; }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(process.cwd(), ".env.local"));

const TOKEN   = process.env.AIRTABLE_API_KEY_GUAICARAMO_INDUCCIONES
  ?? (() => { throw new Error("Missing AIRTABLE_API_KEY_GUAICARAMO_INDUCCIONES"); })();
const BASE_ID = process.env.AIRTABLE_BASE_ID
  ?? (() => { throw new Error("Missing AIRTABLE_BASE_ID"); })();

async function api(method, path, body) {
  const res = await fetch(`https://api.airtable.com/v0${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `Airtable ${method} ${path} → ${res.status}\n${JSON.stringify(data, null, 2)}`
    );
  }
  return data;
}

const MULTI = (opts) => ({ choices: opts.map((name) => ({ name })) });

// -------- desired schema --------
// Order matters: link fields are added in a 2nd pass so target tables exist.
const TABLES = [
  {
    name: "Areas",
    description: "Catálogo de áreas funcionales.",
    fields: [
      { name: "Nombre", type: "singleLineText" },
      { name: "Activo", type: "checkbox", options: { color: "greenBright", icon: "check" } },
    ],
  },
  {
    name: "Cargos",
    description: "Catálogo de cargos.",
    fields: [
      { name: "Nombre", type: "singleLineText" },
      { name: "Activo", type: "checkbox", options: { color: "greenBright", icon: "check" } },
    ],
  },
  {
    name: "Modulos",
    description: "Cabecera estable de cada módulo de inducción.",
    fields: [
      { name: "Slug", type: "singleLineText" },
      { name: "Numero", type: "singleLineText" },
      { name: "Vigente", type: "checkbox", options: { color: "greenBright", icon: "check" } },
    ],
  },
  {
    name: "ModuloVersiones",
    description: "Versión de contenido de un módulo (video, objetivo, duración).",
    fields: [
      { name: "Etiqueta", type: "singleLineText" }, // primary
      { name: "Version", type: "number", options: { precision: 0 } },
      { name: "Titulo", type: "singleLineText" },
      { name: "DuracionMin", type: "number", options: { precision: 0 } },
      { name: "Objetivo", type: "multilineText" },
      { name: "VideoUrl", type: "url" },
      { name: "VigenteDesde", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
      { name: "VigenteHasta", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
      { name: "HashContenido", type: "singleLineText" },
    ],
    links: [{ name: "Modulo", linkedTableName: "Modulos" }],
  },
  {
    name: "Topicos",
    description: "Tópicos enumerados de cada versión de módulo (4NF).",
    fields: [
      { name: "Etiqueta", type: "singleLineText" }, // primary
      { name: "Orden", type: "number", options: { precision: 0 } },
      { name: "Texto", type: "multilineText" },
    ],
    links: [{ name: "ModuloVersion", linkedTableName: "ModuloVersiones" }],
  },
  {
    name: "Personal",
    // already exists with Empleado (number) + Nombre del empleado.
    description: "Colaboradores autorizados.",
    fields: [
      { name: "Email", type: "email" },
      { name: "Activo", type: "checkbox", options: { color: "greenBright", icon: "check" } },
      { name: "FechaIngreso", type: "date", options: { dateFormat: { name: "iso" } } },
    ],
    links: [
      { name: "Area", linkedTableName: "Areas" },
      { name: "Cargo", linkedTableName: "Cargos" },
    ],
  },
  {
    name: "SesionesVisualizacion",
    description: "Cada apertura de un video por un colaborador.",
    fields: [
      { name: "Etiqueta", type: "singleLineText" }, // primary
      { name: "IniciadaEn", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
      { name: "FinalizadaEn", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
      { name: "ProgresoMax", type: "number", options: { precision: 4 } },
      { name: "Completada", type: "checkbox", options: { color: "greenBright", icon: "check" } },
      { name: "IpHash", type: "singleLineText" },
      { name: "UserAgent", type: "multilineText" },
      { name: "Dispositivo", type: "singleSelect", options: MULTI(["desktop", "mobile", "tablet", "otro"]) },
    ],
    links: [
      { name: "Personal", linkedTableName: "Personal" },
      { name: "ModuloVersion", linkedTableName: "ModuloVersiones" },
    ],
  },
  {
    name: "Firmas",
    description: "Firma manuscrita capturada (PNG).",
    fields: [
      { name: "Codigo", type: "singleLineText" }, // primary
      { name: "Imagen", type: "multipleAttachments" },
      { name: "ImagenSha256", type: "singleLineText" },
      { name: "CreadaEn", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
    ],
  },
  {
    name: "Certificados",
    description: "Certificados emitidos. Append-only.",
    fields: [
      { name: "Codigo", type: "singleLineText" }, // primary, único por convención
      { name: "EmitidoEn", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
      { name: "HashCertificado", type: "singleLineText" },
      { name: "PDF", type: "multipleAttachments" },
      { name: "Revocado", type: "checkbox", options: { color: "redBright", icon: "check" } },
      { name: "RevocadoEn", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
      { name: "RevocadoMotivo", type: "multilineText" },
    ],
    links: [
      { name: "Personal", linkedTableName: "Personal" },
      { name: "ModuloVersion", linkedTableName: "ModuloVersiones" },
      { name: "Sesion", linkedTableName: "SesionesVisualizacion" },
      { name: "Firma", linkedTableName: "Firmas" },
    ],
  },
  {
    name: "EventosAuditoria",
    description: "Bitácora append-only de acciones sensibles.",
    fields: [
      { name: "Codigo", type: "singleLineText" }, // primary
      { name: "Entidad", type: "singleSelect", options: MULTI(["personal", "sesion", "certificado", "firma", "modulo", "modulo_version"]) },
      { name: "EntidadId", type: "singleLineText" },
      { name: "Accion", type: "singleSelect", options: MULTI([
        "verificacion_cedula_ok",
        "verificacion_cedula_falla",
        "inicio_video",
        "avance_video",
        "fin_video",
        "firma_creada",
        "certificado_emitido",
        "certificado_revocado",
        "rate_limit",
      ]) },
      { name: "ActorCedula", type: "singleLineText" },
      { name: "Payload", type: "multilineText" },
      { name: "IpHash", type: "singleLineText" },
      { name: "UserAgent", type: "multilineText" },
      { name: "CreatedAt", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
    ],
  },
];

async function main() {
  console.log("→ Leyendo esquema actual…");
  let schema = await api("GET", `/meta/bases/${BASE_ID}/tables`);
  const byName = (s) => Object.fromEntries(s.tables.map((t) => [t.name, t]));
  let tablesByName = byName(schema);

  // Pass 1: create missing tables (without link fields).
  for (const def of TABLES) {
    if (tablesByName[def.name]) continue;

    const fields = def.fields.map((f) => ({ ...f }));
    // Make the primary field the first one. Airtable requires at least one field.
    const body = {
      name: def.name,
      description: def.description,
      fields,
    };
    console.log(`+ Creando tabla "${def.name}"…`);
    await api("POST", `/meta/bases/${BASE_ID}/tables`, body);
  }

  // Refresh schema
  schema = await api("GET", `/meta/bases/${BASE_ID}/tables`);
  tablesByName = byName(schema);

  // Pass 2: add missing scalar fields and link fields.
  for (const def of TABLES) {
    const tbl = tablesByName[def.name];
    if (!tbl) {
      console.warn(`! Tabla "${def.name}" no encontrada tras crear, salto.`);
      continue;
    }
    const existingFields = new Set(tbl.fields.map((f) => f.name));

    for (const f of def.fields) {
      if (existingFields.has(f.name)) continue;
      console.log(`+ ${def.name}.${f.name} (${f.type})`);
      await api("POST", `/meta/bases/${BASE_ID}/tables/${tbl.id}/fields`, f);
    }

    for (const link of def.links ?? []) {
      if (existingFields.has(link.name)) continue;
      const target = tablesByName[link.linkedTableName];
      if (!target) {
        console.warn(
          `! Link "${def.name}.${link.name}" → tabla "${link.linkedTableName}" no existe.`
        );
        continue;
      }
      console.log(`↔ ${def.name}.${link.name} → ${link.linkedTableName}`);
      await api("POST", `/meta/bases/${BASE_ID}/tables/${tbl.id}/fields`, {
        name: link.name,
        type: "multipleRecordLinks",
        options: { linkedTableId: target.id },
      });
    }
  }

  console.log("✓ Listo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

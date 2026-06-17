/**
 * Reintenta el upload a OneDrive de los certificados que fallaron por el
 * bug de \n en el nombre del empleado (corregido en onedrive.ts).
 *
 * Uso:
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/retry-onedrive-upload.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as nodeCrypto from "node:crypto";
import { generateCertPdfBuffer } from "../src/lib/cert-puppeteer";
import { subirCertificado } from "../src/lib/onedrive";
import { MODULES } from "../src/lib/modules-data";

// ---------------------------------------------------------------------------
// Cargar variables de entorno desde .env y .env.local
// ---------------------------------------------------------------------------
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ---------------------------------------------------------------------------
// Descifrado de firma (misma lógica que crypto.ts, sin depender de server-only)
// ---------------------------------------------------------------------------
function decryptFirma(payload: string): string {
  const raw = process.env.SIGNATURE_ENCRYPTION_KEY;
  if (!raw) throw new Error("Falta SIGNATURE_ENCRYPTION_KEY");
  const key = Buffer.from(raw, "utf8");
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Formato de cifrado inválido");
  const iv   = Buffer.from(parts[1], "base64");
  const tag  = Buffer.from(parts[2], "base64");
  const data = Buffer.from(parts[3], "base64");
  const decipher = nodeCrypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ---------------------------------------------------------------------------
// Airtable REST
// ---------------------------------------------------------------------------
const BASE_ID   = process.env.AIRTABLE_BASE_ID!;
const CERTS_TBL = process.env.AIRTABLE_TABLE_CERTIFICADOS_ID!;
const PERS_TBL  = process.env.AIRTABLE_TABLE_PERSONAL_ID!;

async function atFetch(table: string, recordId: string): Promise<Record<string, unknown>> {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${table}/${recordId}?returnFieldsByFieldId=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY_GUAICARAMO_INDUCCIONES}` },
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  const body = await res.json() as { fields?: Record<string, unknown> };
  return body.fields ?? {};
}

// ---------------------------------------------------------------------------
// Registros afectados — datos completados desde la consulta anterior a Airtable
// ---------------------------------------------------------------------------
const AFFECTED = [
  { certId: "recMdQOsGWoi9lgva", personalId: "recYCoACsCtfpBbdI", cedula: "1115910960", moduloVersion: "02-bienestar-social",                codigo: "GC-02-910960-260617", emitidoEn: "2026-06-17T18:26:43.000Z" },
  { certId: "recKEEe0nMYVgQ7s5", personalId: "reccoU9hcgDW4FEBm", cedula: "7231910",    moduloVersion: "01-introduccion",                    codigo: "GC-01-231910-260617", emitidoEn: "2026-06-17T14:53:50.000Z" },
  { certId: "rec6qxPgOYuv4XwDd", personalId: "recgV6C8QN6VRr2yf", cedula: "74335672",   moduloVersion: "01-introduccion",                    codigo: "GC-01-335672-260617", emitidoEn: "2026-06-17T17:05:13.000Z" },
  { certId: "recFWFWKrSdkBVSZD", personalId: "recgV6C8QN6VRr2yf", cedula: "74335672",   moduloVersion: "02-bienestar-social",                codigo: "GC-02-335672-260617", emitidoEn: "2026-06-17T18:29:34.000Z" },
  { certId: "rec2H5tBRB0flhGqE", personalId: "recgV6C8QN6VRr2yf", cedula: "74335672",   moduloVersion: "03-seguridad-y-salud",               codigo: "GC-03-335672-260617", emitidoEn: "2026-06-17T18:47:28.000Z" },
  { certId: "reccvzo28yBPOWIRG", personalId: "recniMcKJRMgb2mQg", cedula: "1118198822",  moduloVersion: "01-introduccion",                    codigo: "GC-01-198822-260617", emitidoEn: "2026-06-17T01:06:43.000Z" },
  { certId: "rec7JQqJyz6encK22", personalId: "recniMcKJRMgb2mQg", cedula: "1118198822",  moduloVersion: "02-bienestar-social",                codigo: "GC-02-198822-260617", emitidoEn: "2026-06-17T13:32:25.000Z" },
  { certId: "recuKW44yY8qIrFIq", personalId: "recniMcKJRMgb2mQg", cedula: "1118198822",  moduloVersion: "03-seguridad-y-salud",               codigo: "GC-03-198822-260617", emitidoEn: "2026-06-17T13:39:12.000Z" },
  { certId: "rec514XGdsT3LkuR2", personalId: "recniMcKJRMgb2mQg", cedula: "1118198822",  moduloVersion: "04-gestion-ambiental",               codigo: "GC-04-198822-260617", emitidoEn: "2026-06-17T13:43:33.000Z" },
  { certId: "rec2nsd7C6eZVp9rk", personalId: "recniMcKJRMgb2mQg", cedula: "1118198822",  moduloVersion: "05-sistemas-integrados-de-gestion",  codigo: "GC-05-198822-260617", emitidoEn: "2026-06-17T13:48:57.000Z" },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  loadEnvFile(path.join(process.cwd(), ".env"));
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const nombresCache = new Map<string, string>();
  let ok = 0, errores = 0;

  for (const { certId, personalId, cedula, moduloVersion, codigo, emitidoEn } of AFFECTED) {
    console.log(`\n→ ${certId}  (cédula ${cedula})`);
    console.log(`  Código: ${codigo} | Módulo: ${moduloVersion}`);

    try {
      // 1. Firma cifrada desde Airtable
      const certFields = await atFetch(CERTS_TBL, certId);
      const firmaCifrada = certFields[process.env.AIRTABLE_FIELD_CERT_FIRMA_ID!] as string | undefined;

      if (!firmaCifrada) {
        console.warn("  ⚠ Sin firma almacenada — omitiendo");
        errores++;
        continue;
      }

      // 2. Nombre del empleado (con caché)
      let nombre = nombresCache.get(personalId);
      if (!nombre) {
        const persFields = await atFetch(PERS_TBL, personalId);
        const raw = (persFields[process.env.AIRTABLE_FIELD_PERSONAL_NOMBRE_ID!] as string) ?? "";
        nombre = raw
          .replace(/[\r\n\t\x00-\x1f\x7f]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        nombresCache.set(personalId, nombre);
      }

      console.log(`  Empleado: ${nombre}`);

      // 3. Descifrar firma
      const firmaPng = decryptFirma(firmaCifrada);

      // 4. Módulo
      const [, ...slugParts] = moduloVersion.split("-");
      const moduloSlug = slugParts.join("-");
      const mod = MODULES.find(m => m.slug === moduloSlug);
      if (!mod) {
        console.warn(`  ⚠ Módulo no encontrado: "${moduloVersion}"`);
        errores++;
        continue;
      }

      // 5. Generar PDF
      console.log("  Generando PDF...");
      const pdfBuffer = await generateCertPdfBuffer({
        nombre,
        cedula,
        moduloNum: mod.num,
        moduloTitle: mod.title,
        moduloSlug: mod.slug,
        topics: mod.topics,
        codigo,
        issuedAt: emitidoEn,
        firmaPng,
      });

      // 6. Subir a OneDrive
      console.log("  Subiendo a OneDrive...");
      await subirCertificado({ nombrePersona: nombre, modulo: mod.num, pdfBuffer });

      console.log(`  ✅ Subido correctamente`);
      ok++;
    } catch (err) {
      console.error(`  ❌ Error:`, err);
      errores++;
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Completado: ${ok} exitosos, ${errores} errores de ${AFFECTED.length} total.`);
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});

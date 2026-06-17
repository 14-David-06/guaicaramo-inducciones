/**
 * Limpia los caracteres de control (\n, \r, \t, etc.) de los nombres
 * en la tabla Personal de Airtable.
 *
 * Uso:
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/limpiar-nombres-personal.ts
 *
 * Modo dry-run (solo muestra cambios sin aplicar):
 *   DRY_RUN=1 npx tsx --tsconfig scripts/tsconfig.json scripts/limpiar-nombres-personal.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

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

function sanitizarNombre(raw: string): string {
  return raw
    .replace(/[\r\n\t\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BASE_ID    = process.env.AIRTABLE_BASE_ID!;
const TABLE_ID   = process.env.AIRTABLE_TABLE_PERSONAL_ID!;
const NOMBRE_FID = process.env.AIRTABLE_FIELD_PERSONAL_NOMBRE_ID!;
const PAGE_SIZE  = 100;
const BATCH_SIZE = 10; // máximo de Airtable por PATCH

async function airtableGet(url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY_GUAICARAMO_INDUCCIONES}` },
  });
  if (!res.ok) throw new Error(`GET ${res.status}: ${await res.text()}`);
  return res.json();
}

async function airtablePatch(records: { id: string; fields: Record<string, string> }[]) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_API_KEY_GUAICARAMO_INDUCCIONES}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ records, returnFieldsByFieldId: true }),
  });
  if (!res.ok) throw new Error(`PATCH ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env"));
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const dryRun = process.env.DRY_RUN === "1";
  if (dryRun) console.log("⚠ MODO DRY-RUN — no se aplicarán cambios.\n");

  // 1. Paginar todos los registros de Personal
  const afectados: { id: string; nombreActual: string; nombreLimpio: string }[] = [];
  let offset: string | undefined;

  do {
    const qs = new URLSearchParams({
      pageSize: String(PAGE_SIZE),
      returnFieldsByFieldId: "true",
      "fields[]": NOMBRE_FID,
    });
    if (offset) qs.set("offset", offset);

    const data = await airtableGet(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${qs}`
    ) as { records: { id: string; fields: Record<string, string> }[]; offset?: string };

    for (const r of data.records) {
      const nombreActual = r.fields[NOMBRE_FID] ?? "";
      if (/[\r\n\t\x00-\x1f\x7f]/.test(nombreActual)) {
        afectados.push({ id: r.id, nombreActual, nombreLimpio: sanitizarNombre(nombreActual) });
      }
    }

    offset = data.offset;
    process.stdout.write(`  Escaneados hasta ahora: ${afectados.length} afectados encontrados...\r`);
  } while (offset);

  console.log(`\n\nTotal con caracteres de control en el nombre: ${afectados.length}`);

  if (afectados.length === 0) {
    console.log("✅ No hay nombres que limpiar.");
    return;
  }

  // Mostrar muestra de los primeros 10
  console.log("\nMuestra (primeros 10):");
  afectados.slice(0, 10).forEach(r => {
    console.log(`  ${r.id}`);
    console.log(`    Antes : ${JSON.stringify(r.nombreActual)}`);
    console.log(`    Después: ${JSON.stringify(r.nombreLimpio)}`);
  });

  if (dryRun) {
    console.log("\n⚠ Dry-run activo — no se escribió nada.");
    return;
  }

  // 2. Actualizar en lotes de 10
  console.log("\nActualizando...");
  let actualizados = 0;
  let errores = 0;

  for (let i = 0; i < afectados.length; i += BATCH_SIZE) {
    const lote = afectados.slice(i, i + BATCH_SIZE).map(r => ({
      id: r.id,
      fields: { [NOMBRE_FID]: r.nombreLimpio },
    }));

    try {
      await airtablePatch(lote);
      actualizados += lote.length;
      process.stdout.write(`  ${actualizados}/${afectados.length} actualizados...\r`);
    } catch (err) {
      console.error(`\n❌ Error en lote ${i}–${i + BATCH_SIZE}:`, err);
      errores += lote.length;
    }
  }

  console.log(`\n\n${"─".repeat(50)}`);
  console.log(`Completado: ${actualizados} actualizados, ${errores} errores.`);
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});

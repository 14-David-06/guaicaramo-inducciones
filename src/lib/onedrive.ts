const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function getConfig() {
  const tenantId     = process.env.TENANT_ID;
  const clientId     = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const user         = process.env.ONEDRIVE_USER;

  const missing = [
    !tenantId     && "TENANT_ID",
    !clientId     && "CLIENT_ID",
    !clientSecret && "CLIENT_SECRET",
    !user         && "ONEDRIVE_USER",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`[onedrive] Variables faltantes: ${missing.join(", ")}`);
  }

  return { tenantId: tenantId!, clientId: clientId!, clientSecret: clientSecret!, user: user! };
}

async function getAccessToken(cfg: ReturnType<typeof getConfig>): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     cfg.clientId,
        client_secret: cfg.clientSecret,
        scope:         "https://graph.microsoft.com/.default",
      }).toString(),
    }
  );
  if (!res.ok) {
    throw new Error(`[onedrive] Token fallido: ${res.status} ${await res.text()}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function sanitizeFolderName(name: string): string {
  // OneDrive prohíbe: < > : " / \ | ? * y caracteres de control (incluyendo \n \r)
  return name
    .replace(/[\r\n\t\x00-\x1f\x7f]/g, " ")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\.+$/, "")
    .trim();
}

// Codifica cada segmento del path sin tocar las barras separadoras
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function folderExists(token: string, user: string, path: string): Promise<boolean> {
  const res = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(user)}/drive/root:/${encodePath(path)}`,
    { headers: authHeader(token) }
  );
  return res.ok;
}

async function createFolder(token: string, user: string, parentPath: string, folderName: string): Promise<void> {
  const endpoint = parentPath
    ? `${GRAPH_BASE}/users/${encodeURIComponent(user)}/drive/root:/${encodePath(parentPath)}:/children`
    : `${GRAPH_BASE}/users/${encodeURIComponent(user)}/drive/root/children`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { ...authHeader(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      name: folderName,
      folder: {},
    }),
  });

  // 409 Conflict = ya existe
  if (!res.ok && res.status !== 409) {
    throw new Error(
      `[onedrive] No se pudo crear carpeta "${folderName}" en "${parentPath || "root"}": ${res.status} ${await res.text()}`
    );
  }
}

async function ensurePath(token: string, user: string, folderPath: string): Promise<void> {
  // folderPath ejemplo: "Certificados/Juan Pérez"
  if (await folderExists(token, user, folderPath)) return;

  const parts = folderPath.split("/");
  let accumulated = "";
  for (const part of parts) {
    const current = accumulated ? `${accumulated}/${part}` : part;
    if (!(await folderExists(token, user, current))) {
      await createFolder(token, user, accumulated, part);
    }
    accumulated = current;
  }
}

// Etiqueta de carpeta raíz por empresa. Cada empresa guarda sus certificados
// en su propio subárbol dentro de OneDrive.
const EMPRESA_FOLDER: Record<string, string> = {
  guaicaramo: "GUAICARAMO",
  tagua: "TAGUA",
};

export interface SubirCertificadoOptions {
  nombrePersona: string;
  modulo: string;
  pdfBuffer: Buffer;
  empresa?: string; // "guaicaramo" (por defecto) | "tagua"
}

export async function subirCertificado(options: SubirCertificadoOptions): Promise<void> {
  const cfg = getConfig();
  const token = await getAccessToken(cfg);

  const empresaFolder = EMPRESA_FOLDER[options.empresa ?? "guaicaramo"] ?? EMPRESA_FOLDER.guaicaramo;
  const año           = new Date().getFullYear();
  const nombreCarpeta = sanitizeFolderName(options.nombrePersona);
  const folderPath    = `Certificados/${empresaFolder}/CERTIFICADOS ${año}/${nombreCarpeta}`;
  const filename      = `certificado_modulo_${options.modulo}.pdf`;
  const filePath      = `${folderPath}/${filename}`;

  await ensurePath(token, cfg.user, folderPath);

  const uploadRes = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(cfg.user)}/drive/root:/${encodePath(filePath)}:/content`,
    {
      method: "PUT",
      headers: { ...authHeader(token), "Content-Type": "application/pdf" },
      body: new Uint8Array(options.pdfBuffer),
    }
  );

  if (!uploadRes.ok) {
    throw new Error(
      `[onedrive] Upload fallido para "${filePath}": ${uploadRes.status} ${await uploadRes.text()}`
    );
  }

  console.log(`✅ Subido: ${filePath}`);
}

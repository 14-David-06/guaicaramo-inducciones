function getGraphConfig() {
  const clientId     = process.env.AZURE_CLIENT_ID;
  const tenantId     = process.env.AZURE_TENANT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const sender       = process.env.OUTLOOK_SENDER_EMAIL;
  const to           = process.env.EMAIL_NOTIFY_TO;

  const missing = [
    !clientId     && "AZURE_CLIENT_ID",
    !tenantId     && "AZURE_TENANT_ID",
    !clientSecret && "AZURE_CLIENT_SECRET",
    !sender       && "OUTLOOK_SENDER_EMAIL",
    !to           && "EMAIL_NOTIFY_TO",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Missing env variables: ${missing.join(", ")}`);
  }

  return { clientId: clientId!, tenantId: tenantId!, clientSecret: clientSecret!, sender: sender!, to: to! };
}

async function getAccessToken(cfg: ReturnType<typeof getGraphConfig>): Promise<string> {
  const url = `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     cfg.clientId,
    client_secret: cfg.clientSecret,
    scope:         "https://graph.microsoft.com/.default",
  });

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get MS Graph token: ${res.status} ${text}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export interface CertMailData {
  nombre: string;
  cedula: string;
  moduloNum: string;
  moduloTitle: string;
  codigo: string;
  issuedAt: string;
  certPdfBuffer: Buffer;
}

function formatCedula(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export async function sendCertNotification(data: CertMailData): Promise<void> {
  const cfg = getGraphConfig();
  const token = await getAccessToken(cfg);

  const fecha = new Date(data.issuedAt).toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#2e7d32;padding:28px 40px;">
          <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">Guaicaramo S.A.S.</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:12px;">Gestión Humana · Inducción / Reinducción</p>
        </td></tr>
        <tr><td style="background:#e65100;height:4px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 8px;color:#555;font-size:13px;text-transform:uppercase;letter-spacing:.08em;">Nuevo certificado emitido</p>
          <h1 style="margin:0 0 24px;color:#1a1a1a;font-size:20px;">Módulo ${data.moduloNum} · ${data.moduloTitle}</h1>
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;width:140px;">Nombre</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;color:#1a1a1a;font-size:13px;font-weight:600;">${data.nombre}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;">Cédula</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;color:#1a1a1a;font-size:13px;">${formatCedula(data.cedula)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;">Módulo</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;color:#1a1a1a;font-size:13px;">${data.moduloNum} · ${data.moduloTitle}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#888;font-size:13px;">Fecha de emisión</td>
              <td style="padding:10px 0;color:#1a1a1a;font-size:13px;">${fecha}</td>
            </tr>
          </table>
          <p style="margin:28px 0 0;color:#888;font-size:12px;">El certificado en PDF se adjunta a este correo.</p>
        </td></tr>
        <tr><td style="background:#2e7d32;padding:16px 40px;text-align:center;">
          <p style="margin:0;color:rgba(255,255,255,.7);font-size:11px;">Guaicaramo S.A.S. · Naturaleza, comunidad y excelencia en armonía</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const certBase64 = data.certPdfBuffer.toString("base64");
  const filename    = `certificado-${data.cedula}-modulo${data.moduloNum}.pdf`;

  const payload = {
    message: {
      subject: `[Certificado] ${data.nombre} · Módulo ${data.moduloNum} · ${data.moduloTitle}`,
      body: { contentType: "HTML", content: html },
      toRecipients: [{ emailAddress: { address: cfg.to } }],
      attachments: [
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: filename,
          contentType: "application/pdf",
          contentBytes: certBase64,
        },
      ],
    },
    saveToSentItems: true,
  };

  const graphRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.sender)}/sendMail`,
    {
      method:  "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!graphRes.ok) {
    const text = await graphRes.text();
    throw new Error(`Graph sendMail failed: ${graphRes.status} ${text}`);
  }
}

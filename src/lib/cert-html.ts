/**
 * Server-side certificate HTML generator.
 * Produces the same visual as Certificate.tsx so the admin
 * receives the exact same certificate design by email.
 */

export interface CertHtmlData {
  nombre: string;
  cedula: string;
  moduloNum: string;
  moduloTitle: string;
  moduloSlug: string;
  topics: string[];
  codigo: string;
  issuedAt: string;
  firmaPng: string;    // data URL — employee signature
  hrFirmaPng?: string; // data URL — HR signature (server-side only, never sent to browser)
}

const MONTHS = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

const NUM_LETRAS = [
  "","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve",
  "diez","once","doce","trece","catorce","quince","dieciséis","diecisiete",
  "dieciocho","diecinueve","veinte","veintiuno","veintidós","veintitrés",
  "veinticuatro","veinticinco","veintiséis","veintisiete","veintiocho",
  "veintinueve","treinta","treinta y uno",
];

function formatCedula(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatFechaLarga(iso: string) {
  const d = new Date(iso);
  const day = d.getDate();
  const letra = NUM_LETRAS[day] ?? String(day);
  return `${letra.charAt(0).toUpperCase()}${letra.slice(1)} (${day}) de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

export function generateCertHtml(data: CertHtmlData): Buffer {
  const nombre     = data.nombre.trim() || "Colaborador Guaicaramo";
  const topicsLine = data.topics.join(", ");
  const fechaLarga = formatFechaLarga(data.issuedAt);
  const certTitle  = data.moduloSlug === "introduccion"
    ? "Certificado · Inducción/Reinducción"
    : `Certificado · Módulo ${data.moduloNum} · ${data.moduloTitle}`;

  // Build chevron HTML (16 items each side)
  const chevItems  = Array.from({ length: 16 }).map(() => `<span class="chev-item"></span>`).join("");
  const chevItemsL = Array.from({ length: 16 }).map(() => `<span class="chev-item-l"></span>`).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Certificado – ${nombre} – Módulo ${data.moduloNum}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,500&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#f0f2f0;display:flex;justify-content:center;padding:32px 16px;font-family:'Inter',sans-serif;}
.cert-wrap{width:980px;max-width:100%;}
.certificate{width:100%;padding:14px;background:#2e7d32;position:relative;}
.cert-inner{background:#fff;position:relative;overflow:hidden;}
.chevron-band,.chevron-band-bottom{background:#2e7d32;height:46px;position:relative;overflow:hidden;display:flex;align-items:center;padding:0 32px;}
.chevron-band{justify-content:flex-end;}
.chevrons{position:absolute;right:0;top:0;bottom:0;display:flex;align-items:center;padding-right:8px;}
.chevrons-bottom{position:absolute;left:0;top:0;bottom:0;display:flex;align-items:center;padding-left:8px;}
.chev-item{width:0;height:0;border-top:23px solid transparent;border-bottom:23px solid transparent;border-left:18px solid rgba(255,255,255,0.22);margin-left:3px;}
.chev-item-l{width:0;height:0;border-top:23px solid transparent;border-bottom:23px solid transparent;border-right:18px solid rgba(255,255,255,0.22);margin-right:3px;}
.orange-line{height:5px;background:linear-gradient(to right,#e65100,#ff8f00,#e65100);}
.cert-content{padding:28px 60px 24px;position:relative;}
.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:260px;height:260px;border-radius:50%;border:1px solid rgba(46,125,50,0.07);box-shadow:0 0 0 30px rgba(46,125,50,0.03),0 0 0 60px rgba(46,125,50,0.02);pointer-events:none;display:flex;align-items:center;justify-content:center;}
.watermark-text{font-family:'Playfair Display',serif;font-size:96px;font-weight:700;color:rgba(46,125,50,0.05);line-height:1;user-select:none;}
.cert-empresa{font-size:30px;font-weight:800;letter-spacing:0.24em;text-transform:uppercase;color:#2e7d32;text-align:center;margin-bottom:10px;}
.cert-title{font-family:'Playfair Display',serif;font-size:32px;font-weight:700;color:#1b5e20;text-align:center;letter-spacing:0.01em;line-height:1.1;margin-bottom:18px;}
.constar{font-size:18px;font-weight:700;color:#1b3a23;text-align:center;margin-bottom:10px;letter-spacing:0.04em;}
.cert-name{font-family:'Playfair Display',serif;font-size:42px;font-style:italic;font-weight:500;color:#1b5e20;text-align:center;line-height:1.1;margin-bottom:4px;}
.cert-cedula{font-size:18px;font-weight:600;color:#555;text-align:center;margin-bottom:16px;letter-spacing:0.06em;}
.cert-body-text{font-size:13px;color:#555;line-height:1.9;text-align:center;margin:0 auto 20px;max-width:720px;}
.cert-body-text strong{color:#1b5e20;}
.h-rule{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
.h-rule span{flex:1;height:1px;background:#e8e8e8;}
.h-rule i{width:7px;height:7px;border-radius:50%;background:#e65100;flex-shrink:0;display:block;}
.sig-row{display:flex;justify-content:space-between;width:100%;gap:20px;margin-bottom:18px;}
.sig-block{display:flex;flex-direction:column;align-items:center;flex:1;gap:4px;}
.sig-space{height:50px;}
.sig-img{max-height:50px;max-width:170px;object-fit:contain;}
.sig-line{width:80%;max-width:170px;height:1px;background:#999;}
.sig-name{font-size:11.5px;font-weight:700;color:#1b5e20;text-align:center;}
.sig-role{font-size:9.5px;color:#bbb;text-transform:uppercase;letter-spacing:0.08em;text-align:center;}
.bottom-info{display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#bbb;letter-spacing:0.06em;border-top:1px solid #eee;padding-top:10px;margin-top:4px;gap:12px;flex-wrap:wrap;}
.date-val{color:#2e7d32;font-weight:700;font-size:11px;}
@media print{
  body{background:#fff!important;padding:0!important;}
  .certificate{width:100%!important;padding:8px!important;}
  .cert-content{padding:18px 40px 14px!important;}
  .cert-title{font-size:24px!important;}
  .cert-name{font-size:34px!important;}
  .chevron-band,.chevron-band-bottom{height:32px!important;}
  .chev-item,.chev-item-l{border-top-width:16px!important;border-bottom-width:16px!important;}
  .watermark{width:220px!important;height:220px!important;}
  .watermark-text{font-size:80px!important;}
  .chevron-band,.chevron-band-bottom,.orange-line,.certificate,.cert-empresa,.cert-title,.cert-name,.cert-body-text strong,.date-val,.sig-name,.h-rule i{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  @page{size:A4 landscape;margin:6mm;}
}
</style>
</head>
<body>
<div class="cert-wrap">
  <div class="certificate">
    <div class="cert-inner">
      <div class="chevron-band">
        <div class="chevrons">${chevItems}</div>
      </div>
      <div class="orange-line"></div>
      <div class="cert-content">
        <div class="watermark" aria-hidden="true">
          <div class="watermark-text">G</div>
        </div>
        <div class="cert-empresa">Guaicaramo S.A.S.</div>
        <div class="cert-title">${certTitle}</div>
        <div class="constar">Se hace constar que</div>
        <div class="cert-name">${nombre}</div>
        <div class="cert-cedula">C.C. <span>${formatCedula(data.cedula)}</span></div>
        <p class="cert-body-text">
          Completó con éxito el módulo
          <strong>${data.moduloNum} · ${data.moduloTitle}</strong>
          del proceso de Inducción / Reinducción de Guaicaramo S.A.S., en
          los siguientes temas: ${topicsLine}.
        </p>
        <div class="h-rule"><span></span><i></i><span></span></div>
        <div class="sig-row">
          <div class="sig-block">
            ${data.hrFirmaPng
              ? `<img src="${data.hrFirmaPng}" alt="Firma Gestión Humana" class="sig-img">`
              : `<div class="sig-space"></div>`}
            <div class="sig-line"></div>
            <div class="sig-name">Gestión Humana</div>
            <div class="sig-role">Guaicaramo S.A.S.</div>
          </div>
          <div class="sig-block">
            ${data.firmaPng ? `<img src="${data.firmaPng}" alt="Firma del participante" class="sig-img">` : `<div class="sig-space"></div>`}
            <div class="sig-line"></div>
            <div class="sig-name">${nombre}</div>
            <div class="sig-role">Participante</div>
          </div>
        </div>
        <div class="bottom-info">
          <span>Guaicaramo S.A.S. &nbsp;·&nbsp; Gestión Humana &nbsp;·&nbsp; Código <strong>${data.codigo}</strong></span>
          <span>Fecha de emisión: <span class="date-val">${fechaLarga}</span></span>
        </div>
      </div>
      <div class="orange-line"></div>
      <div class="chevron-band-bottom">
        <div class="chevrons-bottom">${chevItemsL}</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;

  return Buffer.from(html, "utf-8");
}

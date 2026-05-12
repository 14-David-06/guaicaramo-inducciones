/**
 * Converts a certificate HTML string to a PDF buffer using Puppeteer.
 * Runs server-side only (Node.js runtime).
 */

import puppeteer from "puppeteer";
import { generateCertHtml, type CertHtmlData } from "./cert-html";

export async function generateCertPdfBuffer(data: CertHtmlData): Promise<Buffer> {
  const html = generateCertHtml(data).toString("utf-8");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      margin: { top: "6mm", right: "6mm", bottom: "6mm", left: "6mm" },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * Converts a certificate HTML string to a PDF buffer using Puppeteer.
 * Uses @sparticuz/chromium-min for serverless (Vercel) compatibility.
 * In local development set CHROME_EXEC_PATH in .env.local to skip the
 * remote Chromium download.
 */

import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";
import { generateCertHtml, type CertHtmlData } from "./cert-html";

// Pinned Chromium build that matches @sparticuz/chromium-min expectations.
// Override in production env if needed via CHROMIUM_REMOTE_EXEC_PATH.
const DEFAULT_REMOTE_CHROMIUM =
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar";

async function getExecutablePath(): Promise<string> {
  // Local dev: point CHROME_EXEC_PATH to the system Chrome binary.
  if (process.env.CHROME_EXEC_PATH) return process.env.CHROME_EXEC_PATH;
  // Serverless (Vercel): download/cache from remote URL.
  return chromium.executablePath(
    process.env.CHROMIUM_REMOTE_EXEC_PATH ?? DEFAULT_REMOTE_CHROMIUM
  );
}

export async function generateCertPdfBuffer(data: CertHtmlData): Promise<Buffer> {
  const html = generateCertHtml(data).toString("utf-8");

  const executablePath = await getExecutablePath();

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 800 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
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

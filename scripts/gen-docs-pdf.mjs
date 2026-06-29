import { readFileSync } from "node:fs";
import { marked } from "marked";
import { chromium } from "playwright";

/**
 * Render SAAS_MASTER_DOCUMENTATION.md → .pdf using marked + the already-installed
 * Playwright Chromium (no extra puppeteer download). Run: node scripts/gen-docs-pdf.mjs
 */
const SRC = "SAAS_MASTER_DOCUMENTATION.md";
const OUT = "SAAS_MASTER_DOCUMENTATION.pdf";

const CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial,
      "Noto Sans Arabic", sans-serif;
    color: #111827; line-height: 1.55; font-size: 12px; margin: 0;
  }
  h1 { font-size: 26px; border-bottom: 3px solid #10b981; padding-bottom: 8px; margin: 0 0 12px; }
  h2 { font-size: 19px; margin: 26px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; color:#065f46; }
  h3 { font-size: 15px; margin: 18px 0 6px; color:#111827; }
  h4 { font-size: 13px; margin: 14px 0 4px; color:#374151; }
  p, li { font-size: 12px; }
  a { color: #047857; text-decoration: none; }
  code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
  pre { background: #0f172a; color: #e2e8f0; padding: 12px 14px; border-radius: 8px;
    overflow-x: auto; font-size: 10.5px; line-height: 1.45; page-break-inside: avoid; }
  pre code { background: transparent; color: inherit; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 11px; page-break-inside: avoid; }
  th, td { border: 1px solid #d1d5db; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #ecfdf5; color: #065f46; }
  blockquote { border-left: 4px solid #10b981; margin: 10px 0; padding: 4px 14px;
    background: #f0fdf4; color: #065f46; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 22px 0; }
  h1, h2, h3 { page-break-after: avoid; }
`;

const md = readFileSync(SRC, "utf8");
const bodyHtml = marked.parse(md);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${bodyHtml}</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.pdf({
    path: OUT,
    format: "A4",
    printBackground: true,
    margin: { top: "18mm", bottom: "18mm", left: "15mm", right: "15mm" },
  });
  console.log(`Wrote ${OUT}`);
} finally {
  await browser.close();
}

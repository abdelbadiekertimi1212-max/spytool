import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser } from "playwright";

import { engineConfig } from "./config";
import { randomUserAgent, sleep } from "./http";
import type { NormalizedAd } from "./types";

// Register the stealth plugin once. It patches navigator.webdriver, plugins,
// WebGL vendor, etc. to reduce automation fingerprinting on facebook.com.
// (puppeteer-extra-plugin-stealth is compatible with playwright-extra.)
let stealthRegistered = false;
function ensureStealth() {
  if (stealthRegistered) return;
  // The plugin's type targets puppeteer; playwright-extra accepts it at runtime.
  (chromium as unknown as { use: (p: unknown) => void }).use(StealthPlugin());
  stealthRegistered = true;
}

/** Plain, serializable shape returned from the in-page DOM extraction. */
interface RawAdCard {
  libraryId: string;
  pageName: string | null;
  copy: string | null;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  startedRunning: string | null;
  active: boolean;
}

function buildSearchUrl(term: string, country: string): string {
  const params = new URLSearchParams({
    active_status: "active",
    ad_type: "all",
    country,
    q: term,
    search_type: "keyword_unordered",
    media_type: "all",
  });
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

function parseStartDate(text: string | null): string | null {
  if (!text) return null;
  // e.g. "Started running on Jun 1, 2025" or "1 Jun 2025"
  const cleaned = text.replace(/^.*running on\s*/i, "").trim();
  const ts = Date.parse(cleaned);
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toISOString().slice(0, 10);
}

function deriveSnapshotUrl(libraryId: string): string {
  return `https://www.facebook.com/ads/library/?id=${libraryId}`;
}

/**
 * Scrapes the PUBLIC Meta Ad Library website using a stealth Playwright browser.
 * It searches a store's name, scrolls the results, and parses each ad card's
 * DOM for the library ID, advertiser, copy, creative media URL and run date.
 *
 * Note: the Ad Library DOM is obfuscated and changes often; the extraction is
 * intentionally heuristic (anchored on the stable "Library ID:" label) and
 * fails soft — returning whatever it can rather than throwing. For high-volume
 * production use, route this through residential proxies to avoid rate limits.
 */
export class MetaAdLibraryScraper {
  private browser: Browser | null = null;

  async init(): Promise<void> {
    ensureStealth();
    this.browser = (await chromium.launch({
      headless: engineConfig.meta.headless,
      args: [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
      ],
    })) as unknown as Browser;
  }

  async search(searchTerms: string): Promise<NormalizedAd[]> {
    if (!this.browser) {
      throw new Error("MetaAdLibraryScraper.init() must be called first.");
    }
    const term = searchTerms.trim();
    if (!term) return [];

    const { searchCountry, maxAdsPerStore, maxScrolls, navTimeoutMs } =
      engineConfig.meta;

    const context = await this.browser.newContext({
      userAgent: randomUserAgent(),
      locale: "fr-FR",
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();

    try {
      await page.goto(buildSearchUrl(term, searchCountry), {
        waitUntil: "domcontentloaded",
        timeout: navTimeoutMs,
      });

      await this.dismissConsent(page);

      // Wait for the results region to hydrate; tolerate timeouts (no results).
      await page
        .waitForFunction(() => /Library ID/i.test(document.body.innerText), {
          timeout: 15000,
        })
        .catch(() => undefined);

      // Lazy-load more cards by scrolling.
      for (let i = 0; i < maxScrolls; i += 1) {
        await page.mouse.wheel(0, 2200);
        await sleep(1200 + Math.random() * 900);
      }

      const cards = (await page.evaluate(extractAdCards)) as RawAdCard[];

      const seen = new Set<string>();
      const ads: NormalizedAd[] = [];
      for (const card of cards) {
        if (!card.libraryId || seen.has(card.libraryId)) continue;
        seen.add(card.libraryId);
        ads.push({
          metaAdId: card.libraryId,
          pageId: null,
          pageName: card.pageName,
          adCopy: card.copy,
          ctaText: null,
          snapshotUrl: deriveSnapshotUrl(card.libraryId),
          mediaUrl: card.mediaUrl,
          landingUrl: null,
          platform: "facebook",
          creativeType: card.mediaType === "video" ? "video" : "image",
          startDate: parseStartDate(card.startedRunning),
          endDate: null,
          // The search is filtered to active_status=active, so every result is active.
          isActive: true,
          raw: card,
        });
        if (ads.length >= maxAdsPerStore) break;
      }
      return ads;
    } finally {
      await context.close();
    }
  }

  /**
   * Discovery mode: run a BROAD keyword search and harvest the outbound
   * advertiser landing URLs / caption domains from the active ad cards (rather
   * than parsing ad creatives). Feeds the Auto-Discovery Engine.
   */
  async searchAdLinks(searchTerms: string): Promise<string[]> {
    if (!this.browser) {
      throw new Error("MetaAdLibraryScraper.init() must be called first.");
    }
    const term = searchTerms.trim();
    if (!term) return [];

    const { searchCountry, maxScrolls, navTimeoutMs } = engineConfig.meta;
    const context = await this.browser.newContext({
      userAgent: randomUserAgent(),
      locale: "fr-FR",
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();

    try {
      await page.goto(buildSearchUrl(term, searchCountry), {
        waitUntil: "domcontentloaded",
        timeout: navTimeoutMs,
      });
      await this.dismissConsent(page);
      await page
        .waitForFunction(() => /Library ID/i.test(document.body.innerText), {
          timeout: 15000,
        })
        .catch(() => undefined);

      for (let i = 0; i < maxScrolls; i += 1) {
        await page.mouse.wheel(0, 2200);
        await sleep(1200 + Math.random() * 900);
      }

      const links = (await page.evaluate(extractAdLinks)) as string[];
      return Array.from(new Set(links));
    } finally {
      await context.close();
    }
  }

  private async dismissConsent(page: import("playwright").Page): Promise<void> {
    const labels = [
      /allow all cookies/i,
      /accept all/i,
      /only allow essential/i,
      /decline optional cookies/i,
    ];
    for (const name of labels) {
      try {
        const btn = page.getByRole("button", { name }).first();
        if (await btn.isVisible({ timeout: 1500 })) {
          await btn.click({ timeout: 2000 });
          await sleep(800);
          return;
        }
      } catch {
        // no consent dialog / different layout — continue
      }
    }
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }
}

/**
 * Runs inside the browser (page.evaluate). Must be fully self-contained — it
 * cannot reference anything from the Node scope. Anchors on the "Library ID:"
 * label, climbs to a card-like ancestor, and extracts fields heuristically.
 */
function extractAdCards(): RawAdCard[] {
  const LIB_RE = /Library ID:?\s*(\d{6,})/i;
  const results: RawAdCard[] = [];
  const seen = new Set<string>();

  // Find near-leaf nodes that directly contain the "Library ID: <n>" text.
  const candidates = Array.from(document.querySelectorAll("div, span")).filter(
    (el) => LIB_RE.test(el.textContent || "") && el.children.length <= 2
  );

  for (const leaf of candidates) {
    const idMatch = (leaf.textContent || "").match(LIB_RE);
    if (!idMatch) continue;
    const libraryId = idMatch[1];
    if (seen.has(libraryId)) continue;

    // Climb to a card-like ancestor — but STOP before an ancestor that merges
    // multiple "Library ID"s (that would be a grid of sibling cards, causing
    // shared/over-climbed content like leaked dropdown text or one shared video).
    let card: HTMLElement = leaf as HTMLElement;
    for (let hops = 0; hops < 10; hops += 1) {
      const parent = card.parentElement;
      if (!parent) break;
      const libCount = ((parent.textContent || "").match(/Library ID/gi) || [])
        .length;
      if (libCount > 1) break; // climbing further would absorb sibling cards
      card = parent;
      if (
        card.querySelector("img, video") &&
        (card.textContent || "").length > 80
      ) {
        break;
      }
    }
    seen.add(libraryId);

    const text = (card.textContent || "").replace(/\s+/g, " ").trim();
    const active = /\bActive\b/i.test(text);

    // Run date.
    const startMatch = text.match(
      /(?:Started running on|Ran from)\s+[A-Za-z0-9 ,–-]+?(?=\s*(?:·|Platforms|Library|$))/i
    );
    const startedRunning = startMatch ? startMatch[0] : null;

    // Advertiser name: first anchor with visible text near the top of the card.
    let pageName: string | null = null;
    const anchors = Array.from(card.querySelectorAll("a"));
    for (const a of anchors) {
      const t = (a.textContent || "").trim();
      if (t && t.length <= 80 && !/library id/i.test(t)) {
        pageName = t;
        break;
      }
    }

    // Creative media.
    let mediaUrl: string | null = null;
    let mediaType: "image" | "video" | null = null;
    const video = card.querySelector("video");
    if (video) {
      mediaUrl =
        video.getAttribute("src") || video.getAttribute("poster") || null;
      mediaType = "video";
    }
    if (!mediaUrl) {
      const imgs = Array.from(card.querySelectorAll("img")).filter((img) => {
        const src = img.getAttribute("src") || "";
        const w = (img as HTMLImageElement).naturalWidth || img.clientWidth;
        return /scontent|fbcdn/i.test(src) && w >= 120;
      });
      if (imgs.length > 0) {
        mediaUrl = imgs[0].getAttribute("src");
        mediaType = "image";
      }
    }

    // Ad copy: longest leaf text block that isn't metadata or Ad Library chrome.
    const NOISE =
      /Started running|Platforms|Sponsored|Active|Inactive|Open Dropdown|See ad details|See summary details|Why am I seeing|ad details|This ad has|Sandwich Islands|Total active time/i;
    const candidates: string[] = [];
    for (const el of Array.from(card.querySelectorAll("div, span"))) {
      if (el.children.length > 0) continue; // leaf text only
      const t = (el.textContent || "").trim();
      if (t.length >= 20 && !LIB_RE.test(t) && !NOISE.test(t)) candidates.push(t);
    }
    // Prefer Arabic copy (DZ market) to avoid leaking English category/geo labels.
    const arabic = candidates.filter((t) => /[؀-ۿ]/.test(t));
    const pool = arabic.length > 0 ? arabic : candidates;
    pool.sort((a, b) => b.length - a.length);
    const copy: string | null = pool[0] ?? null;

    results.push({
      libraryId,
      pageName,
      copy,
      mediaUrl,
      mediaType,
      startedRunning,
      active,
    });
  }

  return results;
}

/**
 * Runs inside the browser (page.evaluate). Harvests candidate advertiser URLs
 * from the ad results: decoded `l.facebook.com/l.php?u=` outbound links, direct
 * external anchors, and visible caption domains (e.g. "LUMINAALGERIE.COM").
 * Meta/Facebook-owned hosts are left for the Node side to filter.
 */
function extractAdLinks(): string[] {
  const out = new Set<string>();

  for (const a of Array.from(document.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href") || "";
    if (!href) continue;
    if (href.includes("l.facebook.com/l.php")) {
      try {
        const u = new URL(href, location.href).searchParams.get("u");
        if (u) out.add(u);
      } catch {
        /* ignore malformed redirect */
      }
    } else if (/^https?:\/\//i.test(href)) {
      out.add(href);
    }
  }

  // Visible caption domains shown under each ad's CTA.
  const text = document.body.innerText || "";
  const re =
    /\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|store|shop|online|site|one|dz|co|org|me))\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.add("https://" + m[1].toLowerCase());
  }

  return Array.from(out);
}

/** One-shot helper: scrape ads for a single term, managing the browser. */
export async function scrapeActiveAds(searchTerms: string): Promise<NormalizedAd[]> {
  const scraper = new MetaAdLibraryScraper();
  await scraper.init();
  try {
    return await scraper.search(searchTerms);
  } finally {
    await scraper.close();
  }
}

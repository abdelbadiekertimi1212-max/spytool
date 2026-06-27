import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, StorePlatform } from "../../types/supabase";
import { engineConfig } from "./config";
import { fetchWithTimeout, jitter, originOf, sanitizeText } from "./http";
import { MetaAdLibraryScraper } from "./meta-ads";

type Client = SupabaseClient<Database>;

/** Hosts that are never e-commerce stores — social, link shorteners, big tech. */
const DENY = [
  "facebook.com",
  "instagram.com",
  "fb.com",
  "fb.me",
  "fb.watch",
  "fbcdn.net",
  "messenger.com",
  "whatsapp.com",
  "wa.me",
  "meta.com",
  "youtube.com",
  "youtu.be",
  "google.com",
  "goo.gl",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "t.me",
  "telegram.org",
  "linktr.ee",
  "bit.ly",
  "pinterest.com",
  "snapchat.com",
  "linkedin.com",
  "maps.app.goo.gl",
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isDenied(host: string): boolean {
  return DENY.some((d) => host === d || host.endsWith(`.${d}`));
}

function extractName(html: string): string | null {
  const og = html.match(
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i
  );
  if (og) return sanitizeText(og[1], 120);
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title) return sanitizeText(title[1].trim(), 120);
  return null;
}

export interface DetectedStore {
  platform: StorePlatform;
  origin: string;
  host: string;
  name: string | null;
}

/**
 * Resolve a candidate URL and detect whether it's a Shopify / YouCan / Storeino
 * store via host suffix, HTML/script signatures, response headers, and (for
 * Shopify) a `/products.json` probe. Returns null for anything else.
 */
export async function detectPlatform(rawUrl: string): Promise<DetectedStore | null> {
  let host: string;
  let origin: string;
  try {
    const u = new URL(rawUrl);
    host = u.hostname.replace(/^www\./, "").toLowerCase();
    origin = u.origin;
  } catch {
    return null;
  }

  // Fast path: platform-owned subdomains are unambiguous.
  if (host.endsWith(".myshopify.com"))
    return { platform: "shopify", origin, host, name: null };
  if (host.endsWith(".youcan.store") || host.endsWith(".youcan.shop"))
    return { platform: "youcan", origin, host, name: null };
  if (host.endsWith(".storeino.store") || host.endsWith(".storeino.com"))
    return { platform: "storeino", origin, host, name: null };

  let res: Response;
  try {
    res = await fetchWithTimeout(origin, {
      allowedStatuses: [401, 403, 404, 429, 500, 503],
    });
  } catch {
    return null;
  }

  let finalHost = host;
  let finalOrigin = origin;
  try {
    const fu = new URL(res.url);
    finalHost = fu.hostname.replace(/^www\./, "").toLowerCase();
    finalOrigin = fu.origin;
  } catch {
    /* keep originals */
  }

  let html = "";
  try {
    html = await res.text();
  } catch {
    /* empty body */
  }
  const hay = `${res.url} ${html}`.toLowerCase();
  const poweredBy = `${res.headers.get("powered-by") ?? ""} ${
    res.headers.get("x-powered-by") ?? ""
  }`.toLowerCase();
  const name = extractName(html);

  const result = (platform: StorePlatform): DetectedStore => ({
    platform,
    origin: finalOrigin,
    host: finalHost,
    name,
  });

  // Shopify signatures.
  if (
    finalHost.endsWith(".myshopify.com") ||
    hay.includes("cdn.shopify.com") ||
    hay.includes("/cdn/shop/") ||
    hay.includes("shopify.theme") ||
    hay.includes("window.shopify") ||
    res.headers.has("x-shopify-stage") ||
    res.headers.has("x-shopid") ||
    poweredBy.includes("shopify")
  ) {
    return result("shopify");
  }

  // YouCan signatures.
  if (
    finalHost.endsWith(".youcan.store") ||
    finalHost.endsWith(".youcan.shop") ||
    hay.includes("cdn.youcan.shop") ||
    hay.includes("youcan.shop") ||
    hay.includes("youcanjs") ||
    poweredBy.includes("youcan")
  ) {
    return result("youcan");
  }

  // Storeino signatures.
  if (
    finalHost.endsWith(".storeino.store") ||
    finalHost.endsWith(".storeino.com") ||
    hay.includes("storeino") ||
    poweredBy.includes("storeino")
  ) {
    return result("storeino");
  }

  // Shopify fallback: the public products.json endpoint.
  try {
    const pj = await fetchWithTimeout(`${origin}/products.json?limit=1`, {
      allowedStatuses: [401, 403, 404, 429],
    });
    if (pj.ok && (pj.headers.get("content-type") ?? "").includes("json")) {
      const body = (await pj.json().catch(() => null)) as {
        products?: unknown[];
      } | null;
      if (body && Array.isArray(body.products)) return result("shopify");
    }
  } catch {
    /* not shopify */
  }

  return null;
}

export interface DiscoverSummary {
  keywords: number;
  candidates: number;
  detected: number;
  inserted: number;
  insertedStores: { host: string; platform: StorePlatform }[];
}

/**
 * Auto-Discovery Engine. For each broad keyword: scrape outbound advertiser
 * links from the public Meta Ad Library, dedupe against known + denied hosts,
 * detect the platform of each new candidate, and insert valid stores.
 */
export async function discoverStores(
  client: Client,
  keywords: string[]
): Promise<DiscoverSummary> {
  // Load existing store hosts to avoid duplicate inserts.
  const existing = new Set<string>();
  const { data: stores } = await client.from("stores").select("domain, url");
  for (const s of stores ?? []) {
    const h =
      (s.domain && s.domain.replace(/^www\./, "").toLowerCase()) ||
      hostOf(s.url);
    if (h) existing.add(h);
  }

  const candidates = new Set<string>(); // origins still to inspect
  const triedHosts = new Set<string>();

  const scraper = new MetaAdLibraryScraper();
  await scraper.init();
  try {
    for (const kw of keywords) {
      let links: string[] = [];
      try {
        links = await scraper.searchAdLinks(kw);
      } catch (err) {
        console.error(`[discover] search failed "${kw}": ${(err as Error).message}`);
      }
      let kept = 0;
      for (const link of links) {
        const host = hostOf(link);
        if (!host || isDenied(host) || triedHosts.has(host)) continue;
        triedHosts.add(host);
        if (existing.has(host)) continue;
        candidates.add(originOf(`https://${host}`));
        kept += 1;
        if (kept >= engineConfig.discover.maxCandidatesPerKeyword) break;
      }
      console.log(
        `[discover] "${kw}" → ${links.length} links, ${kept} new candidate domains`
      );
      await jitter();
    }
  } finally {
    await scraper.close();
  }

  console.log(`[discover] inspecting ${candidates.size} unique candidate domains…`);

  let detected = 0;
  let inserted = 0;
  const insertedStores: { host: string; platform: StorePlatform }[] = [];

  for (const origin of Array.from(candidates)) {
    const det = await detectPlatform(origin);
    await jitter();
    if (!det) continue;
    detected += 1;
    if (existing.has(det.host)) continue;

    const { error } = await client.from("stores").upsert(
      {
        url: det.origin,
        domain: det.host,
        name: det.name,
        platform: det.platform,
        fb_page_name: det.name,
        country: "DZ",
        is_active: true,
      },
      { onConflict: "url" }
    );
    if (error) {
      console.error(`[discover] insert ${det.host}: ${error.message}`);
      continue;
    }
    existing.add(det.host);
    inserted += 1;
    insertedStores.push({ host: det.host, platform: det.platform });
    console.log(
      `[discover] + ${det.platform.toUpperCase()} ${det.host}${
        det.name ? ` (${det.name})` : ""
      }`
    );
  }

  return {
    keywords: keywords.length,
    candidates: candidates.size,
    detected,
    inserted,
    insertedStores,
  };
}

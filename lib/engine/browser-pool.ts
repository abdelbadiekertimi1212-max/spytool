import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, BrowserContext } from "playwright";

import { engineConfig, USER_AGENTS } from "./config";
import { ProxyProvider } from "./proxy";

/**
 * Phase 4 scraping-resilience infrastructure (NOT yet wired into the live
 * scrapers — opt-in). Provides a stealth browser pool, fingerprint-rotating
 * session pool, and CAPTCHA detection. Retry/backoff come from ./resilience.
 */

let stealthRegistered = false;
function ensureStealth(): void {
  if (stealthRegistered) return;
  (chromium as unknown as { use: (p: unknown) => void }).use(StealthPlugin());
  stealthRegistered = true;
}

export interface Fingerprint {
  userAgent: string;
  locale: string;
  viewport: { width: number; height: number };
}

const LOCALES = ["fr-FR", "ar-DZ", "en-US"];
const VIEWPORTS = [
  { width: 1366, height: 900 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1536, height: 864 },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** A randomized, realistic desktop fingerprint to reduce bot correlation. */
export function randomFingerprint(): Fingerprint {
  return {
    userAgent: pick(USER_AGENTS),
    locale: pick(LOCALES),
    viewport: pick(VIEWPORTS),
  };
}

/** Heuristic CAPTCHA / soft-block detection from page HTML. */
export function detectCaptcha(html: string): boolean {
  return /captcha|verify you are human|unusual traffic|are you a robot|cf-challenge|checking your browser/i.test(
    html
  );
}

/** Round-robin pool of N stealth browsers (each optionally behind a proxy). */
export class BrowserPool {
  private browsers: Browser[] = [];
  private idx = 0;

  constructor(
    private readonly size: number = engineConfig.scraping.browserPoolSize,
    private readonly proxies: ProxyProvider = new ProxyProvider()
  ) {}

  async init(): Promise<void> {
    ensureStealth();
    for (let i = 0; i < this.size; i += 1) {
      const proxy = this.proxies.next();
      const browser = (await (
        chromium as unknown as {
          launch: (o: unknown) => Promise<Browser>;
        }
      ).launch({
        headless: engineConfig.meta.headless,
        args: [
          "--no-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-dev-shm-usage",
        ],
        ...(proxy ? { proxy } : {}),
      })) as Browser;
      this.browsers.push(browser);
    }
  }

  acquire(): Browser {
    if (this.browsers.length === 0) {
      throw new Error("BrowserPool.init() must be called first.");
    }
    const browser = this.browsers[this.idx % this.browsers.length];
    this.idx += 1;
    return browser;
  }

  async close(): Promise<void> {
    await Promise.all(this.browsers.map((b) => b.close()));
    this.browsers = [];
  }
}

/**
 * Creates fingerprinted browser contexts and retires them after `maxUses`
 * (session rotation) so a single session can't be tracked indefinitely.
 */
export class SessionPool {
  private uses = 0;
  private ctx: BrowserContext | null = null;

  constructor(
    private readonly pool: BrowserPool,
    private readonly maxUses: number = engineConfig.scraping.maxSessionUses
  ) {}

  async getContext(): Promise<BrowserContext> {
    if (this.ctx && this.uses < this.maxUses) {
      this.uses += 1;
      return this.ctx;
    }
    if (this.ctx) await this.ctx.close();
    const fp = randomFingerprint();
    this.ctx = await this.pool.acquire().newContext({
      userAgent: fp.userAgent,
      locale: fp.locale,
      viewport: fp.viewport,
    });
    this.uses = 1;
    return this.ctx;
  }

  async close(): Promise<void> {
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
    }
  }
}

import { engineConfig } from "./config";

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

/** Parse a `scheme://user:pass@host:port` proxy URL into Playwright's shape. */
export function parseProxyUrl(raw: string): ProxyConfig | null {
  try {
    const u = new URL(raw);
    return {
      server: `${u.protocol}//${u.host}`,
      username: u.username || undefined,
      password: u.password || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Proxy abstraction for the scrapers. DISABLED by default (`ENABLE_PROXY=false`)
 * → `next()` returns null and the engine runs direct. When enabled with a
 * `PROXY_URLS` list, it round-robins across them. Operator supplies the proxies;
 * nothing paid is bundled.
 */
export class ProxyProvider {
  private idx = 0;

  constructor(
    private readonly enabled: boolean = engineConfig.scraping.enableProxy,
    private readonly urls: string[] = engineConfig.scraping.proxyUrls
  ) {}

  get isEnabled(): boolean {
    return this.enabled && this.urls.length > 0;
  }

  next(): ProxyConfig | null {
    if (!this.isEnabled) return null;
    const raw = this.urls[this.idx % this.urls.length];
    this.idx += 1;
    return parseProxyUrl(raw);
  }
}

import { describe, it, expect } from "vitest";

import { ProxyProvider, parseProxyUrl } from "@/lib/engine/proxy";

describe("ProxyProvider", () => {
  it("is disabled by default → next() returns null", () => {
    const p = new ProxyProvider(false, ["http://x:8080"]);
    expect(p.isEnabled).toBe(false);
    expect(p.next()).toBeNull();
  });

  it("round-robins across urls when enabled", () => {
    const p = new ProxyProvider(true, ["http://a:1", "http://b:2"]);
    expect(p.isEnabled).toBe(true);
    expect(p.next()?.server).toBe("http://a:1");
    expect(p.next()?.server).toBe("http://b:2");
    expect(p.next()?.server).toBe("http://a:1");
  });

  it("enabled but empty url list → disabled", () => {
    const p = new ProxyProvider(true, []);
    expect(p.isEnabled).toBe(false);
    expect(p.next()).toBeNull();
  });
});

describe("parseProxyUrl", () => {
  it("extracts server, username and password", () => {
    const c = parseProxyUrl("http://user:pass@1.2.3.4:8080");
    expect(c?.server).toBe("http://1.2.3.4:8080");
    expect(c?.username).toBe("user");
    expect(c?.password).toBe("pass");
  });
  it("returns null for invalid input", () => {
    expect(parseProxyUrl("not a url")).toBeNull();
  });
});

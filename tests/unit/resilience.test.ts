import { describe, it, expect, vi } from "vitest";

import {
  withRetry,
  withTimeout,
  backoffDelay,
  CircuitBreaker,
  TimeoutError,
} from "@/lib/engine/resilience";

const noSleep = () => Promise.resolve();

describe("withRetry", () => {
  it("returns immediately on success", async () => {
    const fn = vi.fn(async () => 42);
    expect(await withRetry(fn, { sleep: noSleep })).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures then succeeds", async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      n += 1;
      if (n < 3) throw new Error("transient");
      return "ok";
    });
    expect(await withRetry(fn, { retries: 3, sleep: noSleep })).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the last error after exhausting retries", async () => {
    const fn = vi.fn(async () => {
      throw new Error("nope");
    });
    await expect(withRetry(fn, { retries: 2, sleep: noSleep })).rejects.toThrow("nope");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("invokes onRetry between attempts", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn(async () => {
      throw new Error("x");
    });
    await expect(withRetry(fn, { retries: 2, sleep: noSleep, onRetry })).rejects.toThrow();
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});

describe("withTimeout", () => {
  it("resolves a fast promise", async () => {
    expect(await withTimeout(Promise.resolve("ok"), 1000)).toBe("ok");
  });
  it("rejects a slow promise with TimeoutError", async () => {
    const slow = new Promise((r) => setTimeout(() => r("late"), 50));
    await expect(withTimeout(slow, 5)).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe("backoffDelay", () => {
  it("grows exponentially and respects the cap", () => {
    const d0 = backoffDelay(0, 100);
    const d3 = backoffDelay(3, 100);
    expect(d0).toBeLessThanOrEqual(100);
    expect(d3).toBeGreaterThan(d0);
    expect(backoffDelay(20, 100, 1000)).toBeLessThanOrEqual(1000);
  });
});

describe("CircuitBreaker", () => {
  it("opens after the failure threshold and resets on success", () => {
    const cb = new CircuitBreaker(2, 50);
    expect(cb.canRequest()).toBe(true);
    cb.failure();
    cb.failure();
    expect(cb.state).toBe("open");
    expect(cb.canRequest()).toBe(false);
    cb.success();
    expect(cb.state).toBe("closed");
    expect(cb.canRequest()).toBe(true);
  });

  it("half-opens for a trial after the cooldown", async () => {
    const cb = new CircuitBreaker(1, 20);
    cb.failure();
    expect(cb.canRequest()).toBe(false);
    await new Promise((r) => setTimeout(r, 30));
    expect(cb.canRequest()).toBe(true);
  });
});

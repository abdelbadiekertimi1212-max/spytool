import { describe, it, expect } from "vitest";

import {
  PIPELINE,
  QUEUE,
  CONCURRENCY,
  JOB_OPTIONS,
  DLQ,
  nextJob,
} from "@/lib/queue/jobs";

describe("queue jobs", () => {
  it("defines the pipeline in the exact engine order", () => {
    expect(PIPELINE).toEqual(["discover", "inventory", "classify", "ads", "winners"]);
  });

  it("chains each stage to the next, tail returns null", () => {
    expect(nextJob(QUEUE.discover)).toBe("inventory");
    expect(nextJob(QUEUE.inventory)).toBe("classify");
    expect(nextJob(QUEUE.ads)).toBe("winners");
    expect(nextJob(QUEUE.winners)).toBeNull();
  });

  it("uses the required per-stage concurrency", () => {
    expect(CONCURRENCY).toMatchObject({
      discover: 1,
      inventory: 3,
      classify: 2,
      ads: 2,
      winners: 1,
    });
  });

  it("every stage has retry, backoff, timeout and a dead-letter target", () => {
    for (const name of PIPELINE) {
      const o = JOB_OPTIONS[name];
      expect(o.retryLimit).toBeGreaterThan(0);
      expect(o.retryBackoff).toBe(true);
      expect(o.expireInSeconds).toBeGreaterThan(0);
      expect(o.deadLetter).toBe(DLQ);
    }
  });
});

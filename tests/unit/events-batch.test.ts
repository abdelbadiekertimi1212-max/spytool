import { describe, it, expect } from "vitest";

import { EventBuffer } from "@/lib/events/batch";

describe("EventBuffer", () => {
  it("accumulates and drains", () => {
    const b = new EventBuffer();
    expect(b.size()).toBe(0);
    b.add({ event_name: "login" });
    b.add({ event_name: "checkout" });
    expect(b.size()).toBe(2);

    const drained = b.drain();
    expect(drained).toHaveLength(2);
    expect(b.size()).toBe(0); // drain empties the buffer
  });

  it("clear empties the buffer", () => {
    const b = new EventBuffer();
    b.add({ event_name: "bookmark" });
    b.clear();
    expect(b.size()).toBe(0);
  });
});

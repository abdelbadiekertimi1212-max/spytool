import type { TrackInput } from "./schemas";

/**
 * In-memory, per-process event buffer. Batches events so a burst of `track()`
 * calls flushes as one insert. Best-effort (serverless processes are ephemeral;
 * `flush()` is also called explicitly by the server collector).
 */
class EventBuffer {
  private items: TrackInput[] = [];

  add(event: TrackInput): void {
    this.items.push(event);
  }

  size(): number {
    return this.items.length;
  }

  /** Return and clear the buffered events. */
  drain(): TrackInput[] {
    const out = this.items;
    this.items = [];
    return out;
  }

  clear(): void {
    this.items = [];
  }
}

export const eventBuffer = new EventBuffer();
export { EventBuffer };

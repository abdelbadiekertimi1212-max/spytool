/**
 * Provider-agnostic reliability primitives for outbound calls (Groq, etc.):
 * per-attempt timeout, exponential backoff with jitter, bounded retries, and a
 * lightweight circuit breaker. Pure & dependency-free → fully unit-testable.
 */

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/** Reject if `promise` doesn't settle within `ms`. */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Exponential backoff (capped) with up to 25% negative jitter. */
export function backoffDelay(attempt: number, baseMs: number, maxMs = 30_000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.floor(exp - Math.random() * exp * 0.25);
}

export interface RetryOptions {
  /** Additional attempts after the first (default 2 → up to 3 calls). */
  retries?: number;
  baseDelayMs?: number;
  /** Per-attempt timeout in ms (0 disables). */
  timeoutMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
  /** Injectable sleep (tests pass a no-op for speed). */
  sleep?: (ms: number) => Promise<void>;
}

/** Run `fn` with timeout + exponential-backoff retries. Throws the last error. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const timeoutMs = opts.timeoutMs ?? 0;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return timeoutMs > 0 ? await withTimeout(fn(), timeoutMs) : await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      opts.onRetry?.(attempt + 1, err);
      await sleep(backoffDelay(attempt, baseDelayMs));
    }
  }
  throw lastError;
}

/**
 * Minimal circuit breaker. Opens after `threshold` consecutive failures and
 * stays open for `cooldownMs`, then allows a half-open trial request.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly threshold = 5,
    private readonly cooldownMs = 30_000
  ) {}

  canRequest(): boolean {
    if (this.failures < this.threshold) return true;
    if (Date.now() - this.openedAt >= this.cooldownMs) {
      this.failures = 0; // half-open: allow a trial
      return true;
    }
    return false;
  }

  success(): void {
    this.failures = 0;
  }

  failure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) this.openedAt = Date.now();
  }

  get state(): "open" | "closed" {
    return this.failures >= this.threshold &&
      Date.now() - this.openedAt < this.cooldownMs
      ? "open"
      : "closed";
  }
}

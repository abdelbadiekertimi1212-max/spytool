import "server-only";

import crypto from "crypto";

const MODE = process.env.CHARGILY_MODE === "live" ? "live" : "test";
const BASE_URL =
  MODE === "live"
    ? "https://pay.chargily.net/api/v2"
    : "https://pay.chargily.net/test/api/v2";

function secretKey(): string {
  const key = process.env.CHARGILY_SECRET_KEY;
  if (!key || key === "placeholder") {
    throw new Error("CHARGILY_SECRET_KEY is not configured.");
  }
  return key;
}

export interface CreateCheckoutParams {
  /** Amount in DZD (integer, Chargily minimum 50). */
  amount: number;
  successUrl: string;
  failureUrl?: string;
  webhookEndpoint?: string;
  locale?: string;
  metadata?: Record<string, unknown>;
}

export interface ChargilyCheckout {
  id: string;
  checkout_url: string;
}

/** Create a Chargily Pay V2 checkout (DZD, Edahabia/CIB). Returns the hosted URL. */
export async function createCheckout(
  params: CreateCheckoutParams
): Promise<ChargilyCheckout> {
  const res = await fetch(`${BASE_URL}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: "dzd",
      success_url: params.successUrl,
      failure_url: params.failureUrl,
      webhook_endpoint: params.webhookEndpoint,
      locale: params.locale ?? "ar",
      // Chargily V2 metadata is an array of objects.
      metadata: params.metadata ? [params.metadata] : undefined,
      pass_fees_to_customer: false,
    }),
  });

  const data = (await res.json()) as {
    id?: string;
    checkout_url?: string;
    message?: string;
  };
  if (!res.ok || !data.checkout_url || !data.id) {
    throw new Error(data.message || `Chargily checkout failed (HTTP ${res.status})`);
  }
  return { id: data.id, checkout_url: data.checkout_url };
}

/**
 * Verify the `signature` header of a Chargily webhook against the raw request
 * body using HMAC-SHA256 with the API secret key. Timing-safe comparison.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;
  const computed = crypto
    .createHmac("sha256", secretKey())
    .update(rawBody, "utf8")
    .digest("hex");
  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Webhook event shape (subset we use). */
export interface ChargilyEvent {
  id: string;
  type: string; // e.g. "checkout.paid", "checkout.failed"
  data: {
    id: string;
    status?: string;
    amount?: number;
    metadata?: Record<string, unknown> | Record<string, unknown>[];
  };
}

/** Normalize Chargily metadata (array or object) into a flat record. */
export function readMetadata(
  data: ChargilyEvent["data"]
): Record<string, unknown> {
  const m = data.metadata;
  if (Array.isArray(m)) return (m[0] as Record<string, unknown>) ?? {};
  return (m as Record<string, unknown>) ?? {};
}

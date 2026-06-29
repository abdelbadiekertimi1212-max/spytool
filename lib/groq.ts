import "server-only";

import Groq from "groq-sdk";
import { z } from "zod";

import { withRetry } from "./engine/resilience";

const OutreachSchema = z.object({
  subject: z.string().optional(),
  body: z.string().optional(),
  callHook: z.string().optional(),
});

export interface OutreachInput {
  storeName: string;
  storeUrl: string;
  platform: string;
  leadScore: number;
  topProduct?: string | null;
  dailyVelocity?: number | null;
  winnerCount?: number | null;
  /** Output language: ar | fr | en. */
  locale: string;
}

export interface OutreachOutput {
  subject: string;
  body: string;
  callHook: string;
}

const SYSTEM_PROMPT = `You are an elite B2B sales copywriter for an Algerian freelancer/agency selling growth services (Meta media-buying, COD landing-page optimization, fulfillment) to local e-commerce store owners.

You receive JSON metadata about a prospect store discovered by a "winning product" radar. Write a SHORT, highly personalized cold outreach.

Rules:
- Reference concrete signals from the data (their platform, sales momentum, that they are actively running ads) to prove relevance.
- Respect the requested locale: "ar" = Arabic (Algerian-friendly MSA), "fr" = French, "en" = English.
- Tone: confident, concise, no fluff, no spammy hype, no emojis overload (max 1).
- Output STRICT JSON only with keys: "subject" (<= 60 chars), "body" (2 short paragraphs, plain text, <= 120 words), "callHook" (1 sentence opener for a phone call).
- Do NOT include markdown, backticks, or commentary.`;

/**
 * Generate a personalized cold-outreach email + call hook with Groq/Llama-3.
 * Runs server-side only — the API key never reaches the client.
 */
export async function generateOutreach(
  input: OutreachInput
): Promise<OutreachOutput> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "placeholder") {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const groq = new Groq({ apiKey });
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const start = Date.now();
  const completion = await withRetry(
    () =>
      groq.chat.completions.create({
        model,
        temperature: 0.7,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
    { retries: 2, baseDelayMs: 600, timeoutMs: 20_000 }
  );
  console.log(
    `[outreach] groq tokens=${completion.usage?.total_tokens ?? "?"} latency=${Date.now() - start}ms`
  );

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("Groq returned malformed JSON.");
  }
  const parsed = OutreachSchema.safeParse(json).data ?? {};

  return {
    subject: parsed.subject?.trim() || "Quick idea for your store",
    body: parsed.body?.trim() || "",
    callHook: parsed.callHook?.trim() || "",
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

import type { Database } from "../../types/supabase";

type Client = SupabaseClient<Database>;

/** Fixed niche taxonomy. The classifier must map to one of these exactly. */
export const NICHES = [
  "Automotive Accessories",
  "Women's Fashion",
  "Women's Jewelry",
  "Men's Fashion",
  "Kitchen Gadgets",
  "Home & Decor",
  "Beauty & Cosmetics",
  "Health & Wellness",
  "Baby & Kids",
  "Electronics & Gadgets",
  "Phone Accessories",
  "Toys & Games",
  "Sports & Fitness",
  "Pet Supplies",
  "Tools & DIY",
  "Uncategorized",
] as const;

export type Niche = (typeof NICHES)[number];
const NICHE_SET = new Set<string>(NICHES);

const BATCH_SIZE = 25;

const SYSTEM_PROMPT = `You are a precise e-commerce product classifier for the Algerian COD market. Products may be titled in Arabic, French, or English.

You receive a JSON array of products: [{ "i": <index>, "title": "...", "desc": "..." }].

For EACH product, choose the single best-fitting niche from this EXACT list:
${NICHES.join(", ")}.

If nothing fits confidently, use "Uncategorized".

Output STRICT JSON only: { "results": [{ "i": <index>, "niche": "<one of the list>" }] }.
No markdown, no commentary. Every input index must appear exactly once.`;

function groqClient(): { groq: Groq; model: string } | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "placeholder") return null;
  return {
    groq: new Groq({ apiKey }),
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  };
}

function coerceNiche(value: unknown): Niche {
  if (typeof value === "string" && NICHE_SET.has(value)) return value as Niche;
  return "Uncategorized";
}

/**
 * Classify a batch of products (<= BATCH_SIZE) in a single Groq request.
 * Returns niches aligned to the input order. Falls back to "Uncategorized" for
 * any item the model misses. Returns all-Uncategorized if Groq isn't configured.
 */
export async function classifyBatch(
  items: { title: string; description?: string | null }[]
): Promise<Niche[]> {
  if (items.length === 0) return [];
  const client = groqClient();
  if (!client) return items.map(() => "Uncategorized");

  const payload = items.map((it, i) => ({
    i,
    title: (it.title || "").slice(0, 200),
    desc: (it.description || "").slice(0, 300),
  }));

  const completion = await client.groq.chat.completions.create({
    model: client.model,
    temperature: 0,
    max_tokens: 1500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(payload) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const out: Niche[] = items.map(() => "Uncategorized");
  try {
    const parsed = JSON.parse(raw) as {
      results?: { i?: number; niche?: string }[];
    };
    for (const r of parsed.results ?? []) {
      if (typeof r.i === "number" && r.i >= 0 && r.i < out.length) {
        out[r.i] = coerceNiche(r.niche);
      }
    }
  } catch {
    // malformed JSON → keep all Uncategorized
  }
  return out;
}

/**
 * Classify the given products and write their `niche`. Chunks into BATCH_SIZE
 * requests. Non-fatal: returns the number tagged, logs and continues on errors.
 */
export async function tagProductsByNiche(
  client: Client,
  rows: { id: string; title: string; description?: string | null }[]
): Promise<number> {
  if (rows.length === 0 || !groqClient()) return 0;

  let tagged = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    let niches: Niche[];
    try {
      niches = await classifyBatch(chunk);
    } catch (err) {
      console.error(`[classify] batch failed: ${(err as Error).message}`);
      continue;
    }
    await Promise.all(
      chunk.map((row, j) =>
        client
          .from("products")
          .update({ niche: niches[j] })
          .eq("id", row.id)
          .then(({ error }) => {
            if (!error) tagged += 1;
          })
      )
    );
  }
  return tagged;
}

/**
 * Backfill: find products with no niche yet and classify them. Used by the
 * `engine:classify` script to tag everything already in the database.
 */
export async function classifyUntagged(
  client: Client,
  max = 600
): Promise<number> {
  const { data, error } = await client
    .from("products")
    .select("id, title, description")
    .is("niche", null)
    .limit(max);
  if (error) throw new Error(`Failed to load untagged products: ${error.message}`);
  return tagProductsByNiche(client, data ?? []);
}

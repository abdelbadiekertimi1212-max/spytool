import { z } from "zod";

/** Request body schemas for the API routes (zod-validated, single source of truth). */

export const checkoutSchema = z.object({
  tier: z.enum(["starter", "pro", "agency"]),
  locale: z.enum(["ar", "fr", "en"]).optional(),
});

export const outreachSchema = z.object({
  storeId: z.string().uuid(),
  locale: z.enum(["ar", "fr", "en"]).optional(),
});

export const outreachSendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  text: z.string().min(1).max(10000),
});

/** Parse a Request JSON body against a schema; returns data or null on failure. */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>
): Promise<T | null> {
  try {
    const json = await req.json();
    const result = schema.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

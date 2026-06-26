import "server-only";

import { Resend } from "resend";

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
}

/**
 * Send a cold-outreach email via Resend. Server-side only.
 * Returns the Resend message id on success.
 */
export async function sendOutreachEmail({
  to,
  subject,
  text,
}: SendEmailParams): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === "placeholder") {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const from = process.env.RESEND_FROM_EMAIL || "leads@example.com";
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    text,
  });

  if (error) {
    throw new Error(error.message);
  }
  return { id: data?.id ?? "" };
}

import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Privacy Policy — WinnerRadar",
};

const UPDATED = "27 June 2026";

export default function PrivacyPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  return (
    <article className="container max-w-3xl space-y-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {UPDATED}</p>
      </header>

      <Section title="1. Who we are">
        WinnerRadar (&quot;we&quot;, &quot;us&quot;) is a market-intelligence platform for the
        Algerian cash-on-delivery (COD) e-commerce market, operated from Algeria.
        This policy explains what data we process and why, and is designed to
        align with Algerian Law No. 18-07 on the protection of natural persons in
        the processing of personal data.
      </Section>

      <Section title="2. Personal data we collect">
        We collect the minimum needed to run the service: your account email and
        authentication credentials (managed by our auth provider), your
        subscription status and tier, your saved bookmarks, and basic technical
        logs (e.g. request metadata) used for security and rate limiting.
      </Section>

      <Section title="3. Automated collection of public business data">
        WinnerRadar operates automated systems that collect <strong>publicly
        available business information</strong> — not personal data — including:
        product listings, prices and public inventory signals from public
        storefronts (Shopify, YouCan, Storeino), and publicly published
        advertising data from the <strong>Meta Ad Library</strong> (active ad
        creatives, ad copy and run dates that Meta itself publishes for
        transparency). We collect this commercial information about businesses,
        not about private individuals, and we use polite, rate-limited access. We
        do not bypass authentication, paywalls, or access non-public data.
      </Section>

      <Section title="4. How we use data">
        To provide and secure the service: authenticate you, manage your
        subscription, surface winning-product analytics, generate optional AI
        outreach drafts, prevent abuse (rate limiting), and improve the product.
      </Section>

      <Section title="5. Processors & third parties">
        We share data only with processors that power the service: Supabase
        (database/auth/hosting), Groq (AI classification & copy generation),
        Chargily (DZD payments), Resend (transactional email), and Upstash
        (rate-limiting). Each processes data only to deliver its function.
      </Section>

      <Section title="6. Retention & security">
        We keep personal data for as long as your account is active and as
        required by law, then delete or anonymize it. We apply Row Level Security,
        encrypted transport, and least-privilege server-side keys. No method is
        100% secure, but we work to protect your data.
      </Section>

      <Section title="7. Your rights">
        Subject to Algerian law, you may request access, correction, or deletion
        of your personal data, and may object to certain processing. Contact us to
        exercise these rights.
      </Section>

      <Section title="8. Contact">
        Questions about this policy: privacy@winnerradar.dz
      </Section>

      <footer className="border-t pt-6 text-sm text-muted-foreground">
        See also our{" "}
        <Link href="/legal/terms" className="text-winner hover:underline">
          Terms of Service
        </Link>
        .
      </footer>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </section>
  );
}

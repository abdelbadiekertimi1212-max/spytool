import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Terms of Service — WinnerRadar",
};

const UPDATED = "27 June 2026";

export default function TermsPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  return (
    <article className="container max-w-3xl space-y-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: {UPDATED}</p>
      </header>

      <Section title="1. Acceptance">
        By creating an account or using WinnerRadar you agree to these Terms. If
        you do not agree, do not use the service.
      </Section>

      <Section title="2. The service">
        WinnerRadar provides market-intelligence and analytics about the Algerian
        COD e-commerce market, including product, store and public advertising
        signals, plus optional AI-assisted outreach drafting. Insights are
        informational and probabilistic — &quot;winner&quot; indicators are estimates, not
        guarantees of sales, profit, or outcomes.
      </Section>

      <Section title="3. Data sources & responsible use">
        The platform aggregates <strong>publicly available</strong> business
        information (public storefront listings and the public Meta Ad Library).
        Data is provided &quot;as is&quot; for research. You are solely responsible for how
        you act on it and for complying with all applicable laws and the terms of
        any third-party platform you interact with. You may not resell or
        redistribute raw bulk data, abuse the API, attempt to overload the
        service, or use it for unlawful purposes.
      </Section>

      <Section title="4. Accounts & security">
        You are responsible for your account credentials and all activity under
        your account. Notify us of any unauthorized use.
      </Section>

      <Section title="5. Subscriptions & payments">
        Paid tiers are billed in Algerian Dinar (DZD) via Chargily (Edahabia /
        CIB). Access corresponds to your active tier and billing period. Fees are
        non-refundable except where required by law.
      </Section>

      <Section title="6. Intellectual property">
        The WinnerRadar software, design, and aggregated/derived analytics are our
        intellectual property. Underlying public business facts remain the data of
        their respective owners.
      </Section>

      <Section title="7. Disclaimers & limitation of liability">
        The service is provided &quot;as is&quot; without warranties. To the maximum extent
        permitted by Algerian law, we are not liable for indirect or consequential
        damages, lost profits, or business decisions made using the platform.
      </Section>

      <Section title="8. Governing law">
        These Terms are governed by the laws of the People&apos;s Democratic Republic
        of Algeria, and disputes are subject to the competent Algerian courts.
      </Section>

      <Section title="9. Changes & contact">
        We may update these Terms; continued use after changes constitutes
        acceptance. Contact: legal@winnerradar.dz
      </Section>

      <footer className="border-t pt-6 text-sm text-muted-foreground">
        See also our{" "}
        <Link href="/legal/privacy" className="text-winner hover:underline">
          Privacy Policy
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

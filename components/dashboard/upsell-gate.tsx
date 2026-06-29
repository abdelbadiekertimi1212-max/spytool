import { getTranslations } from "next-intl/server";
import { Lock, Sparkles } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Shown in place of gated content when the user has no active/trialing
 * subscription. RLS already hides the data server-side; this is the friendly UX.
 */
export async function UpsellGate() {
  const t = await getTranslations("Dashboard");
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-24 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-winner/10 text-winner">
        <Lock className="h-7 w-7" />
      </div>
      <h2 className="text-xl font-bold tracking-tight">{t("upsellTitle")}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{t("upsellBody")}</p>
      <Button asChild variant="winner" size="lg">
        <Link href="/dashboard/billing">
          <Sparkles className="h-4 w-4" />
          {t("upsellCta")}
        </Link>
      </Button>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, Sparkles } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Soft, non-blocking first-run prompt shown on the dashboard until onboarded. */
export function OnboardingCard() {
  const t = useTranslations("Onboarding");
  return (
    <Card className="border-winner/40 bg-winner/5">
      <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-winner/15 text-winner">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">{t("cardTitle")}</div>
            <div className="text-sm text-muted-foreground">{t("cardBody")}</div>
          </div>
        </div>
        <Button asChild variant="winner" className="shrink-0">
          <Link href="/dashboard/onboarding">
            {t("cardCta")}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

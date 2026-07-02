"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Crown, Loader2 } from "lucide-react";

import { PAID_TIERS } from "@/lib/billing";
import { formatDZD } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Pricing({
  currentTier,
  status,
  variant = "control",
}: {
  currentTier: string;
  status: string;
  variant?: "control" | "A" | "B";
}) {
  const t = useTranslations("Billing");
  const locale = useLocale();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Presentation experiment — ORDER only, never prices. Control = as defined;
  // A = lead with Pro; B = reverse (agency-first).
  const tiers =
    variant === "A"
      ? [...PAID_TIERS].sort((a, b) => (a.tier === "pro" ? -1 : b.tier === "pro" ? 1 : 0))
      : variant === "B"
        ? [...PAID_TIERS].slice().reverse()
        : PAID_TIERS;

  async function upgrade(tier: string) {
    setLoadingTier(tier);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.checkout_url;
    } catch (err) {
      setError((err as Error).message);
      setLoadingTier(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {t("currentPlan")}:
        <Badge variant={currentTier === "free" ? "secondary" : "winner"}>
          {t(`tier_${currentTier}`)}
        </Badge>
        <span className="text-xs">({status})</span>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((plan) => {
          const isCurrent = currentTier === plan.tier;
          const highlight = plan.tier === "pro";
          return (
            <Card
              key={plan.tier}
              className={highlight ? "border-winner/50 shadow-lg shadow-winner/5" : ""}
            >
              <CardHeader>
                {highlight ? (
                  <Badge variant="winner" className="mb-1 w-fit gap-1">
                    <Crown className="h-3 w-3" />
                    {t("popular")}
                  </Badge>
                ) : null}
                <CardTitle>{t(`tier_${plan.tier}`)}</CardTitle>
                <CardDescription>
                  <span className="text-2xl font-bold text-foreground">
                    {formatDZD(plan.priceDzd)}
                  </span>{" "}
                  {t("perMonth")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {plan.featureKeys.map((k) => (
                    <li key={k} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-winner" />
                      {t(`feat_${k}`)}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => upgrade(plan.tier)}
                  disabled={loadingTier !== null || isCurrent}
                  variant={highlight ? "winner" : "default"}
                  className="w-full"
                >
                  {loadingTier === plan.tier ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {isCurrent ? t("yourPlan") : t("upgrade")}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{t("securedBy")}</p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Calculator } from "lucide-react";

import { formatDZD } from "@/lib/format";

const DEFAULT_DELIVERY = 500; // average COD delivery cost in DZD
const DEFAULT_MARGIN = 50;

/**
 * Wholesale margin calculator. Takes the scraped selling price, subtracts an
 * average delivery cost, and shows the maximum "Target Sourcing Price" needed to
 * keep the chosen margin — i.e. the max price to source it from local wholesale
 * hubs (El Eulma / Dubai-import markets) and still profit.
 */
export function MarginCalculator({ price }: { price: number | null }) {
  const t = useTranslations("Dashboard");
  const [margin, setMargin] = useState(DEFAULT_MARGIN);
  const delivery = DEFAULT_DELIVERY;

  if (!price || price <= 0) return null;

  const net = Math.max(0, price - delivery);
  const sourcing = net * (1 - margin / 100);
  const profit = net - sourcing;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-center gap-2 text-xs font-medium">
        <Calculator className="h-3.5 w-3.5 text-winner" />
        {t("profitCalc")}
      </div>

      <label className="block space-y-1">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{t("margin")}</span>
          <span className="font-semibold text-foreground">{margin}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={80}
          step={5}
          value={margin}
          onChange={(e) => setMargin(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-[hsl(var(--winner))]"
        />
      </label>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-md bg-winner/10 p-2">
          <div className="text-sm font-bold text-winner">{formatDZD(sourcing)}</div>
          <div className="text-[10px] text-muted-foreground">{t("targetSourcing")}</div>
        </div>
        <div className="rounded-md bg-secondary/60 p-2">
          <div className="text-sm font-bold">{formatDZD(profit)}</div>
          <div className="text-[10px] text-muted-foreground">{t("profitPerUnit")}</div>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {t("marginHint", { delivery: formatDZD(delivery) })}
      </p>
    </div>
  );
}

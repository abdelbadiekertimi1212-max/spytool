"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Flame,
  TrendingUp,
  ChevronDown,
  ExternalLink,
  Calculator,
  Tag,
} from "lucide-react";

import type { WinnerProduct } from "@/lib/dashboard/types";
import { getProductImage } from "@/lib/media/serve";
import { AdCreative } from "./ad-creative";
import { MarginCalculator } from "./margin-calculator";
import { BookmarkButton } from "./bookmark-button";
import { Badge } from "@/components/ui/badge";
import { formatDZD, formatNumber, daysSince } from "@/lib/format";
import { cn } from "@/lib/utils";

const PLATFORM_LABEL: Record<string, string> = {
  shopify: "Shopify",
  youcan: "YouCan",
  storeino: "Storeino",
};

export function WinnerCard({ winner, index }: { winner: WinnerProduct; index: number }) {
  const t = useTranslations("Dashboard");
  const [showAds, setShowAds] = useState(false);
  const [showCalc, setShowCalc] = useState(false);

  const activeAds = (winner.store?.ads ?? []).filter((a) => a.is_active);
  const sinceDays = daysSince(winner.winner_since);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.4) }}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:border-winner/40 hover:shadow-lg hover:shadow-winner/5"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <Image
          src={getProductImage(winner)}
          alt={winner.title}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          unoptimized
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2">
          {winner.is_winner ? (
            <Badge variant="winner" className="gap-1 shadow">
              <Flame className="h-3 w-3" />
              {t("winner")}
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 shadow">
              {t("tracking")}
            </Badge>
          )}
          <div className="flex items-center gap-1.5">
            {winner.is_winner && sinceDays !== null ? (
              <span className="rounded-full bg-black/60 px-2 py-0.5 text-xs text-white backdrop-blur">
                {t("daysAgo", { days: sinceDays })}
              </span>
            ) : null}
            <BookmarkButton productId={winner.id} initialSaved={winner.bookmarked} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {winner.store?.name || winner.store?.url || "—"}
          </span>
          {winner.store?.platform ? (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {PLATFORM_LABEL[winner.store.platform] ?? winner.store.platform}
            </Badge>
          ) : null}
        </div>

        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold" title={winner.title}>
          {winner.title}
        </h3>

        {winner.niche ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
            <Tag className="h-3 w-3" />
            {winner.niche}
          </span>
        ) : null}

        <div className="flex items-end justify-between">
          <span className="text-base font-bold">{formatDZD(winner.price)}</span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-winner">
            <TrendingUp className="h-4 w-4" />
            {formatNumber(winner.daily_velocity, 1)}
            <span className="text-xs font-normal text-muted-foreground">
              {t("perDay")}
            </span>
          </span>
        </div>

        <div className="mt-auto" />

        <button
          type="button"
          onClick={() => setShowCalc((s) => !s)}
          className="inline-flex items-center justify-between rounded-md border border-border/60 bg-background/50 px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
        >
          <span className="inline-flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5 text-winner" />
            {t("profitCalc")}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", showCalc && "rotate-180")}
          />
        </button>
        {showCalc ? <MarginCalculator price={winner.price} /> : null}

        <button
          type="button"
          onClick={() => setShowAds((s) => !s)}
          className="inline-flex items-center justify-between rounded-md border border-border/60 bg-background/50 px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-winner/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-winner" />
            </span>
            {t("activeAdsCount", { count: activeAds.length })}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", showAds && "rotate-180")}
          />
        </button>

        {showAds ? (
          <div className="space-y-2">
            {activeAds.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noAds")}</p>
            ) : (
              activeAds.map((ad) => (
                <div
                  key={ad.id}
                  className="overflow-hidden rounded-lg border bg-background/50"
                >
                  <AdCreative ad={ad} />
                  <div className="space-y-1 p-2">
                    {ad.ad_copy ? (
                      <p className="line-clamp-3 text-xs text-foreground/90">
                        {ad.ad_copy}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      {ad.start_date ? (
                        <span>{t("running")}: {ad.start_date}</span>
                      ) : (
                        <span />
                      )}
                      {ad.landing_url ? (
                        <a
                          href={ad.landing_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-winner hover:underline"
                        >
                          {t("viewInLibrary")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

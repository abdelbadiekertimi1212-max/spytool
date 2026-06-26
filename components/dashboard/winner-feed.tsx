"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Radar } from "lucide-react";

import type { WinnerProduct } from "@/lib/dashboard/types";
import { WinnerCard } from "./winner-card";
import { Input } from "@/components/ui/input";
import { daysSince } from "@/lib/format";

type SortKey = "velocity" | "ads" | "newest" | "price";

function activeAdCount(w: WinnerProduct): number {
  return w.ads.filter((a) => a.is_active).length;
}

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function WinnerFeed({ winners }: { winners: WinnerProduct[] }) {
  const t = useTranslations("Dashboard");

  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [minVelocity, setMinVelocity] = useState(0);
  const [minAds, setMinAds] = useState(0);
  const [sinceDays, setSinceDays] = useState(0); // 0 = all-time
  const [sort, setSort] = useState<SortKey>("velocity");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = winners.filter((w) => {
      if (
        q &&
        !`${w.title} ${w.store?.name ?? ""} ${w.store?.url ?? ""}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      if (platform !== "all" && w.store?.platform !== platform) return false;
      if (w.daily_velocity < minVelocity) return false;
      if (activeAdCount(w) < minAds) return false;
      if (sinceDays > 0) {
        const d = daysSince(w.winner_since);
        if (d === null || d > sinceDays) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      switch (sort) {
        case "ads":
          return activeAdCount(b) - activeAdCount(a);
        case "newest":
          return (
            (Date.parse(b.winner_since ?? "") || 0) -
            (Date.parse(a.winner_since ?? "") || 0)
          );
        case "price":
          return (b.price ?? 0) - (a.price ?? 0);
        default:
          return b.daily_velocity - a.daily_velocity;
      }
    });
  }, [winners, search, platform, minVelocity, minAds, sinceDays, sort]);

  return (
    <div className="space-y-5">
      <div className="sticky top-16 z-30 -mx-2 flex flex-wrap items-center gap-2 rounded-xl border bg-background/80 p-3 backdrop-blur">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="ps-8"
          />
        </div>

        <select
          className={selectClass}
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          aria-label={t("filterPlatform")}
        >
          <option value="all">{t("allPlatforms")}</option>
          <option value="shopify">Shopify</option>
          <option value="youcan">YouCan</option>
          <option value="storeino">Storeino</option>
        </select>

        <select
          className={selectClass}
          value={minVelocity}
          onChange={(e) => setMinVelocity(Number(e.target.value))}
          aria-label={t("filterVelocity")}
        >
          <option value={0}>{t("anyVelocity")}</option>
          <option value={3}>≥ 3 / {t("day")}</option>
          <option value={5}>≥ 5 / {t("day")}</option>
          <option value={10}>≥ 10 / {t("day")}</option>
          <option value={20}>≥ 20 / {t("day")}</option>
        </select>

        <select
          className={selectClass}
          value={minAds}
          onChange={(e) => setMinAds(Number(e.target.value))}
          aria-label={t("filterAds")}
        >
          <option value={0}>{t("anyAds")}</option>
          <option value={1}>≥ 1 {t("ads")}</option>
          <option value={3}>≥ 3 {t("ads")}</option>
          <option value={5}>≥ 5 {t("ads")}</option>
        </select>

        <select
          className={selectClass}
          value={sinceDays}
          onChange={(e) => setSinceDays(Number(e.target.value))}
          aria-label={t("filterDate")}
        >
          <option value={0}>{t("anyDate")}</option>
          <option value={3}>{t("lastNDays", { n: 3 })}</option>
          <option value={7}>{t("lastNDays", { n: 7 })}</option>
          <option value={14}>{t("lastNDays", { n: 14 })}</option>
          <option value={30}>{t("lastNDays", { n: 30 })}</option>
        </select>

        <select
          className={selectClass}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label={t("sortBy")}
        >
          <option value="velocity">{t("sortVelocity")}</option>
          <option value="ads">{t("sortAds")}</option>
          <option value="newest">{t("sortNewest")}</option>
          <option value="price">{t("sortPrice")}</option>
        </select>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("resultCount", { count: filtered.length })}
      </p>

      {winners.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t("noMatchTitle")}
          description={t("noMatchDescription")}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((w, i) => (
            <WinnerCard key={w.id} winner={w} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-winner/10 text-winner">
        <Radar className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

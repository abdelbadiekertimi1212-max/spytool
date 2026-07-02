import { getTranslations } from "next-intl/server";

import { formatDZD } from "@/lib/format";
import { tierPrice } from "@/lib/billing";

const PLANS = ["starter", "pro", "agency"] as const;
const LIMITS: Record<string, { winners: string; bookmarks: string; outreach: string }> = {
  starter: { winners: "10/day", bookmarks: "10/day", outreach: "1/day" },
  pro: { winners: "200/day", bookmarks: "100/day", outreach: "20/day" },
  agency: { winners: "∞", bookmarks: "∞", outreach: "∞" },
};

export async function PlanMatrix({ currentTier }: { currentTier?: string }) {
  const t = await getTranslations("PlanMatrix");
  const cell = "p-3 text-center";
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="p-3 text-start font-medium">{t("feature")}</th>
            {PLANS.map((p) => (
              <th key={p} className={`${cell} capitalize`}>
                {p}
                {p === "pro" ? <span className="ms-1 text-[10px] text-winner">★</span> : null}
                {currentTier === p ? (
                  <span className="ms-1 text-[10px] text-muted-foreground">({t("current")})</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="p-3 text-muted-foreground">{t("price")}</td>
            {PLANS.map((p) => (
              <td key={p} className={`${cell} font-semibold`}>
                {formatDZD(tierPrice(p) ?? 0)}
                <span className="text-xs font-normal text-muted-foreground">/{t("mo")}</span>
              </td>
            ))}
          </tr>
          {(["winners", "bookmarks", "outreach"] as const).map((row) => (
            <tr key={row} className="border-b last:border-0">
              <td className="p-3 text-muted-foreground">{t(row)}</td>
              {PLANS.map((p) => (
                <td key={p} className={cell}>
                  {LIMITS[p][row]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Phone, Sparkles, TrendingUp, Users } from "lucide-react";

import type { LeadRow } from "@/lib/dashboard/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { OutreachModal } from "./outreach-modal";

const PLATFORM_LABEL: Record<string, string> = {
  shopify: "Shopify",
  youcan: "YouCan",
  storeino: "Storeino",
};

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const t = useTranslations("Leads");
  const [selected, setSelected] = useState<LeadRow | null>(null);
  const [open, setOpen] = useState(false);

  function openModal(lead: LeadRow) {
    setSelected(lead);
    setOpen(true);
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-winner/10 text-winner">
          <Users className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold">{t("emptyTitle")}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("emptyDescription")}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("store")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("platform")}</TableHead>
              <TableHead>{t("score")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("winners")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("velocity")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("ads")}</TableHead>
              <TableHead className="text-end">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <div className="font-medium">{lead.name || "—"}</div>
                  <div className="max-w-[200px] truncate text-xs text-muted-foreground">
                    {lead.url}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="secondary" className="text-[10px]">
                    {PLATFORM_LABEL[lead.platform] ?? lead.platform}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-winner"
                        style={{ width: `${Math.min(lead.lead_score, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold">{lead.lead_score}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {lead.winner_count}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="inline-flex items-center gap-1 text-winner">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {formatNumber(lead.max_velocity, 1)}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">{lead.active_ads}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {lead.contact_phone ? (
                      <Button asChild size="icon" variant="ghost" title={lead.contact_phone}>
                        <a href={`tel:${lead.contact_phone}`}>
                          <Phone className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : null}
                    <Button size="sm" variant="winner" onClick={() => openModal(lead)}>
                      <Sparkles className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("outreach")}</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <OutreachModal lead={selected} open={open} onOpenChange={setOpen} />
    </>
  );
}

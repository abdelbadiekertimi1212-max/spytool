"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function BillingActions({ cancelAtPeriodEnd }: { cancelAtPeriodEnd: boolean }) {
  const t = useTranslations("Billing");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function act(action: "cancel" | "resume") {
    setLoading(true);
    try {
      await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={() => act(cancelAtPeriodEnd ? "resume" : "cancel")}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {cancelAtPeriodEnd ? t("resume") : t("cancel")}
    </Button>
  );
}

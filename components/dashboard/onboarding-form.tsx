"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Client-safe category list (mirrors the niche taxonomy; not imported from the
// server-only classifier to keep groq-sdk out of the client bundle).
const CATEGORIES = [
  "Automotive Accessories",
  "Women's Fashion",
  "Women's Jewelry",
  "Men's Fashion",
  "Kitchen Gadgets",
  "Home & Decor",
  "Beauty & Cosmetics",
  "Health & Wellness",
  "Baby & Kids",
  "Electronics & Gadgets",
  "Phone Accessories",
  "Toys & Games",
  "Sports & Fitness",
  "Pet Supplies",
  "Tools & DIY",
];
const LEVELS = ["beginner", "intermediate", "advanced"] as const;

export function OnboardingForm() {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [level, setLevel] = useState<string>("beginner");
  const [country, setCountry] = useState("DZ");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCat(c: string) {
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferred_categories: selected,
          experience_level: level,
          country: country.toUpperCase().slice(0, 2),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <Card className="bg-card/60">
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">{t("interestsLabel")}</h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = selected.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCat(c)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors",
                    on
                      ? "border-winner bg-winner/15 text-winner"
                      : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  {on ? <Check className="h-3 w-3" /> : null}
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">{t("experienceLabel")}</h2>
            <div className="flex gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-xs capitalize transition-colors",
                    level === l
                      ? "border-winner bg-winner/15 text-winner"
                      : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  {t(`level_${l}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">{t("countryLabel")}</h2>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              maxLength={2}
              className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm uppercase shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button onClick={submit} disabled={loading} variant="winner" className="w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("finish")}
        </Button>
      </CardContent>
    </Card>
  );
}

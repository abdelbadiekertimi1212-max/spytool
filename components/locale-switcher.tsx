"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Globe, Check } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LABEL_KEYS: Record<Locale, "arabic" | "french" | "english"> = {
  ar: "arabic",
  fr: "french",
  en: "english",
};

export function LocaleSwitcher() {
  const t = useTranslations("Common");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onSelect(next: Locale) {
    if (next === locale) return;
    startTransition(() => {
      // `pathname` here is locale-agnostic; the navigation helper re-applies it.
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isPending} className="gap-2">
          <Globe className="h-4 w-4" />
          <span>{t(LABEL_KEYS[locale])}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {routing.locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onSelect={() => onSelect(loc)}
            className="justify-between"
          >
            {t(LABEL_KEYS[loc])}
            {loc === locale ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

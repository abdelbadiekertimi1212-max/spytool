import { defineRouting } from "next-intl/routing";

/**
 * Supported locales for the platform.
 *   - ar : Arabic  (RTL, default — primary Algerian market language)
 *   - fr : French  (LTR)
 *   - en : English (LTR)
 */
export const routing = defineRouting({
  locales: ["ar", "fr", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/** Locales that must render with `dir="rtl"`. */
export const rtlLocales: Locale[] = ["ar"];

export function getDirection(locale: string): "rtl" | "ltr" {
  return rtlLocales.includes(locale as Locale) ? "rtl" : "ltr";
}

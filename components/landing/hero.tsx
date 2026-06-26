"use client";

import { motion, type Variants } from "framer-motion";
import { useTranslations } from "next-intl";
import { ArrowRight, Radar, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export function Hero() {
  const t = useTranslations("Landing");

  return (
    <section className="relative overflow-hidden">
      {/* Cinematic radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--winner)/0.18),transparent_70%)]"
      />
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="container flex flex-col items-center gap-6 py-24 text-center md:py-32"
      >
        <motion.span
          variants={item}
          className="inline-flex items-center gap-2 rounded-full border border-winner/30 bg-winner/10 px-4 py-1.5 text-sm font-medium text-winner"
        >
          <Radar className="h-4 w-4 animate-pulse-glow" />
          {t("badge")}
        </motion.span>

        <motion.h1
          variants={item}
          className="max-w-4xl text-balance text-4xl font-bold tracking-tight md:text-6xl"
        >
          {t("title")}
        </motion.h1>

        <motion.p
          variants={item}
          className="max-w-2xl text-balance text-lg text-muted-foreground"
        >
          {t("subtitle")}
        </motion.p>

        <motion.div
          variants={item}
          className="flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button asChild size="lg" variant="winner">
            <Link href="/dashboard">
              {t("ctaPrimary")}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/#features">{t("ctaSecondary")}</Link>
          </Button>
        </motion.div>

        <motion.div
          variants={item}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border bg-card/60 px-4 py-2 text-sm text-muted-foreground backdrop-blur"
        >
          <Zap className="h-4 w-4 text-winner" />
          {t("winnerCriteria")}
        </motion.div>
      </motion.div>
    </section>
  );
}

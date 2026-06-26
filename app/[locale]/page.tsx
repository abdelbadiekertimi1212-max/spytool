import { getTranslations, setRequestLocale } from "next-intl/server";
import { Radar, TrendingUp, BadgeCheck, Users } from "lucide-react";

import { Hero } from "@/components/landing/hero";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

export default async function HomePage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations("Landing");
  const tNav = await getTranslations("Nav");

  const features = [
    {
      icon: TrendingUp,
      title: t("feature1Title"),
      description: t("feature1Desc"),
    },
    {
      icon: BadgeCheck,
      title: t("feature2Title"),
      description: t("feature2Desc"),
    },
    {
      icon: Users,
      title: t("feature3Title"),
      description: t("feature3Desc"),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Radar className="h-5 w-5 text-winner" />
            <span>WinnerRadar</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href="/#features">{tNav("features")}</Link>
            </Button>
            <LocaleSwitcher />
            <Button asChild size="sm" variant="winner">
              <Link href="/dashboard">{tNav("dashboard")}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Hero />

        <section id="features" className="container py-20">
          <div className="grid gap-6 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="border-border/60 bg-card/60">
                <CardHeader>
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-winner/10 text-winner">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} WinnerRadar — {t("winnerCriteria")}
        </div>
      </footer>
    </div>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { Sparkles } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { trackServer } from "@/lib/events/collector";
import { OnboardingForm } from "@/components/dashboard/onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    trackServer({ event_name: "onboarding_started", user_id: user.id });
  }

  const t = await getTranslations("Onboarding");

  return (
    <div className="container max-w-2xl py-10">
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-winner" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>
      <OnboardingForm />
    </div>
  );
}

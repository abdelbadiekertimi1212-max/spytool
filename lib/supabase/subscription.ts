import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

export interface SubscriptionState {
  active: boolean;
  status: string;
  tier: string;
}

/**
 * App-side mirror of the DB `private.has_active_subscription()` check. RLS is the
 * real enforcement (catalog rows are invisible without an active/trialing sub);
 * this is used to render a graceful upsell instead of an empty dashboard.
 */
export async function getSubscriptionState(
  supabase: SupabaseClient<Database>
): Promise<SubscriptionState> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { active: false, status: "none", tier: "free" };

  const { data } = await supabase
    .from("subscriptions")
    .select("status, package_tier, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return { active: false, status: "none", tier: "free" };

  const notExpired =
    !data.current_period_end ||
    new Date(data.current_period_end).getTime() > Date.now();
  const active =
    (data.status === "active" || data.status === "trialing") && notExpired;

  return { active, status: data.status, tier: data.package_tier };
}

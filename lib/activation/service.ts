import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";
import { computeActivation, type ActivationState } from "./score";

type Client = SupabaseClient<Database>;

export interface ActivationStatus extends ActivationState {
  onboarded: boolean;
}

/** Read activation signals for a user (RLS-scoped: profile, bookmarks, subscription). */
export async function getActivationStatus(
  client: Client,
  userId: string
): Promise<ActivationStatus> {
  const [{ data: profile }, { count: bookmarks }, { data: sub }] = await Promise.all([
    client.from("profiles").select("onboarding_completed_at").eq("id", userId).maybeSingle(),
    client.from("bookmarks").select("*", { count: "exact", head: true }).eq("user_id", userId),
    client.from("subscriptions").select("status, package_tier").eq("user_id", userId).maybeSingle(),
  ]);

  const onboarded = Boolean(profile?.onboarding_completed_at);
  const isPaid = Boolean(
    sub && sub.package_tier !== "free" && (sub.status === "active" || sub.status === "trialing")
  );

  const state = computeActivation({
    onboardingCompleted: onboarded,
    bookmarkCount: bookmarks ?? 0,
    isPaid,
  });
  return { ...state, onboarded };
}

/** Set of product ids the user has bookmarked (for the feed's saved state). */
export async function getUserBookmarkIds(
  client: Client,
  userId: string
): Promise<Set<string>> {
  const { data } = await client.from("bookmarks").select("product_id").eq("user_id", userId);
  return new Set((data ?? []).map((b) => b.product_id));
}

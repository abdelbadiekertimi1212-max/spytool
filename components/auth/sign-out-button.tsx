"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  function onSignOut() {
    startTransition(async () => {
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={onSignOut} disabled={isPending} className="gap-2">
      <LogOut className="h-4 w-4 rtl:rotate-180" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Radar } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Mode = "signin" | "signup";

export function LoginForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError(t("mustAgree"));
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setNotice(t("checkEmail"));
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_40%_at_50%_0%,hsl(var(--winner)/0.15),transparent_70%)]"
      />
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-winner/10 text-winner">
            <Radar className="h-6 w-6" />
          </div>
          <CardTitle>{mode === "signin" ? t("signInTitle") : t("signUpTitle")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@store.dz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            {notice ? (
              <p className="text-sm text-winner">{notice}</p>
            ) : null}

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 accent-[hsl(var(--winner))]"
                required
              />
              <span>
                {t("agreePrefix")}{" "}
                <Link
                  href="/legal/terms"
                  target="_blank"
                  className="text-winner hover:underline"
                >
                  {t("termsLink")}
                </Link>{" "}
                {t("agreeAnd")}{" "}
                <Link
                  href="/legal/privacy"
                  target="_blank"
                  className="text-winner hover:underline"
                >
                  {t("privacyLink")}
                </Link>
                .
              </span>
            </label>

            <Button
              type="submit"
              variant="winner"
              className="w-full"
              disabled={loading || !agreed}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "signin" ? t("signIn") : t("signUp")}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? t("toSignUp") : t("toSignIn")}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

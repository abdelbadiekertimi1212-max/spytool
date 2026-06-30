"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function BookmarkButton({
  productId,
  initialSaved = false,
}: {
  productId: string;
  initialSaved?: boolean;
}) {
  const t = useTranslations("Dashboard");
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    const next = !saved;
    setSaved(next); // optimistic
    setLoading(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) throw new Error("bookmark failed");
    } catch {
      setSaved(!next); // revert on failure
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      title={t(saved ? "saved" : "save")}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70",
        saved && "text-winner"
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : saved ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
    </button>
  );
}

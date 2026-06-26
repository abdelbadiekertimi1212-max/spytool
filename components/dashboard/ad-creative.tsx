"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Film, Image as ImageIcon, PlayCircle } from "lucide-react";

import type { Ad } from "@/types/supabase";

/**
 * Renders an ad's creative as a static thumbnail. Meta's fbcdn video URLs are
 * hotlink-protected / time-limited, so we never inline-play them — we attempt
 * the creative as an <img> and fall back to a branded poster on error. The whole
 * tile links to the live Ad Library snapshot so the user can watch the real ad.
 */
export function AdCreative({ ad }: { ad: Ad }) {
  const t = useTranslations("Dashboard");
  const [failed, setFailed] = useState(false);
  const isVideo = ad.creative_type === "video";
  const canShowImage = Boolean(ad.ad_creative_url) && !failed;

  const tile = (
    <div className="relative aspect-video w-full overflow-hidden bg-muted">
      {canShowImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.ad_creative_url as string}
          alt={ad.ad_copy ?? "ad creative"}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-winner/20 via-card to-background text-winner">
          {isVideo ? <Film className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
          <span className="text-[10px] font-medium text-muted-foreground">
            {isVideo ? t("activeVideoAd") : t("activeAd")}
          </span>
        </div>
      )}
      {isVideo ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <PlayCircle className="h-9 w-9 text-white/90 drop-shadow-lg" />
        </span>
      ) : null}
    </div>
  );

  if (ad.landing_url) {
    return (
      <a href={ad.landing_url} target="_blank" rel="noreferrer" className="block">
        {tile}
      </a>
    );
  }
  return tile;
}

import { engineConfig } from "./config";
import { fetchWithTimeout } from "./http";
import type { NormalizedAd } from "./types";

/**
 * Raw shape of an `ads_archive` node from the Meta Ad Library Graph API.
 * Most creative-body fields are only populated for ads about social issues /
 * elections / politics; for commercial ads we mainly get `ad_snapshot_url`.
 */
interface MetaAdNode {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_snapshot_url?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_descriptions?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  publisher_platforms?: string[];
}

interface MetaAdResponse {
  data?: MetaAdNode[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message: string; type: string; code: number };
}

const FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_snapshot_url",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_captions",
  "ad_creative_link_descriptions",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "publisher_platforms",
].join(",");

function mapPlatform(platforms?: string[]): NormalizedAd["platform"] {
  const first = (platforms?.[0] || "FACEBOOK").toUpperCase();
  switch (first) {
    case "INSTAGRAM":
      return "instagram";
    case "AUDIENCE_NETWORK":
      return "audience_network";
    case "MESSENGER":
      return "messenger";
    default:
      return "facebook";
  }
}

function normalize(node: MetaAdNode): NormalizedAd {
  return {
    metaAdId: node.id,
    pageId: node.page_id ?? null,
    pageName: node.page_name ?? null,
    adCopy: node.ad_creative_bodies?.[0] ?? null,
    ctaText: node.ad_creative_link_titles?.[0] ?? null,
    snapshotUrl: node.ad_snapshot_url ?? null,
    landingUrl: node.ad_creative_link_captions?.[0] ?? null,
    platform: mapPlatform(node.publisher_platforms),
    // The API does not expose the media type for commercial ads; default to
    // image and let the Phase 3 snapshot resolver refine it.
    creativeType: "image",
    startDate: node.ad_delivery_start_time ?? null,
    endDate: node.ad_delivery_stop_time ?? null,
    raw: node,
  };
}

export interface FetchAdsParams {
  accessToken: string;
  /** Exact Facebook Page IDs to match. Preferred over free-text search. */
  pageIds?: string[];
  /** Free-text fallback (store/brand name) when a Page ID is unknown. */
  searchTerms?: string;
}

/**
 * Fetch currently ACTIVE ads from the Meta Ad Library for the given page(s) or
 * search term, restricted to the configured reached countries (default DZ).
 * Follows pagination up to `engineConfig.meta.maxPages`.
 */
export async function fetchActiveAds({
  accessToken,
  pageIds,
  searchTerms,
}: FetchAdsParams): Promise<NormalizedAd[]> {
  if (!accessToken) {
    throw new Error("META_ACCESS_TOKEN is required to query the Ad Library.");
  }
  if ((!pageIds || pageIds.length === 0) && !searchTerms) {
    return [];
  }

  const { apiVersion, reachedCountries, pageSize, maxPages } =
    engineConfig.meta;

  const params = new URLSearchParams({
    access_token: accessToken,
    ad_type: "ALL",
    ad_active_status: "ACTIVE",
    ad_reached_countries: JSON.stringify(reachedCountries),
    fields: FIELDS,
    limit: String(pageSize),
  });

  if (pageIds && pageIds.length > 0) {
    params.set("search_page_ids", JSON.stringify(pageIds));
  } else if (searchTerms) {
    params.set("search_terms", searchTerms);
  }

  let url = `https://graph.facebook.com/${apiVersion}/ads_archive?${params.toString()}`;
  const ads: NormalizedAd[] = [];

  for (let page = 0; page < maxPages && url; page += 1) {
    const response = await fetchWithTimeout(url, { method: "GET" });
    const body = (await response.json()) as MetaAdResponse;

    if (body.error) {
      throw new Error(
        `Meta Ad Library error ${body.error.code}: ${body.error.message}`
      );
    }

    for (const node of body.data ?? []) {
      ads.push(normalize(node));
    }

    url = body.paging?.next ?? "";
  }

  return ads;
}

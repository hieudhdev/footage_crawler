import type { JsonFileCache } from "../cache.ts";
import { httpJson } from "../http.ts";
import type { Candidate, Orientation, ProviderAdapter, SearchParams } from "../types.ts";

interface CoverrUrls {
  mp4?: string;
  mp4_preview?: string;
  mp4_download?: string;
}

interface CoverrCreator {
  name?: string;
  url?: string;
}

interface CoverrVideo {
  id: string;
  title?: string;
  description?: string;
  poster?: string;
  thumbnail?: string;
  is_vertical?: boolean;
  tags?: string[] | string;
  downloads?: number;
  views?: number;
  aspect_ratio?: string;
  duration?: number | string;
  max_height?: number;
  max_width?: number;
  width?: number;
  height?: number;
  slug?: string;
  url?: string;
  urls?: CoverrUrls;
  creator?: CoverrCreator | string;
}

interface CoverrSearch {
  hits?: CoverrVideo[];
  videos?: CoverrVideo[];
}

function asDuration(raw: number | string | undefined): number | undefined {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n);
}

function tagsOf(hit: CoverrVideo): string[] {
  const fromTags = Array.isArray(hit.tags)
    ? hit.tags
    : typeof hit.tags === "string"
      ? hit.tags.split(",").map((t) => t.trim())
      : [];
  return [...fromTags, hit.title, hit.description].filter((t): t is string => Boolean(t));
}

function matchesOrientation(hit: CoverrVideo, orientation: Orientation): boolean {
  const ratio = hit.aspect_ratio ?? "";
  const vertical = hit.is_vertical === true || ratio === "9:16";
  if (orientation === "portrait") return vertical;
  if (orientation === "square") return ratio === "1:1";
  return !vertical && ratio !== "9:16";
}

function pageUrl(hit: CoverrVideo): string {
  if (hit.url) return hit.url;
  if (hit.slug) return `https://coverr.co/videos/${hit.slug}`;
  const slug = (hit.title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug) return `https://coverr.co/videos/${slug}-${String(hit.id).toLowerCase()}`;
  return `https://coverr.co/videos/${hit.id}`;
}

function creatorOf(hit: CoverrVideo): { name: string; url?: string } {
  if (typeof hit.creator === "string" && hit.creator.trim()) {
    return { name: hit.creator.trim(), url: "https://coverr.co" };
  }
  if (hit.creator && typeof hit.creator === "object") {
    const name = hit.creator.name?.trim();
    if (name) return { name, url: hit.creator.url || "https://coverr.co" };
  }
  return { name: "Coverr", url: "https://coverr.co" };
}

export async function fetchCoverrVideoPreview(
  apiKey: string,
  videoId: string,
): Promise<string | undefined> {
  const video = await httpJson<CoverrVideo>(
    `https://api.coverr.co/videos/${encodeURIComponent(videoId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  return video.urls?.mp4_preview || video.urls?.mp4;
}

export function createCoverrAdapter(apiKey: string, cache: JsonFileCache): ProviderAdapter {
  const headers = { Authorization: `Bearer ${apiKey}` };

  async function cachedGet<T>(url: string, cacheKey: string): Promise<T> {
    const hit = await cache.get<T>(cacheKey);
    if (hit) return hit;
    const data = await httpJson<T>(url, { headers });
    await cache.set(cacheKey, data);
    return data;
  }

  return {
    name: "coverr",
    supports: ["video"],
    isConfigured: () => true,

    async search(params: SearchParams): Promise<Candidate[]> {
      if (params.kind !== "video") return [];

      const qs = new URLSearchParams({
        query: params.query,
        page: "0",
        page_size: String(Math.min(Math.max(params.perPage, 1), 100)),
        sort: "popular",
        urls: "true",
      });
      const cacheKey = `videos:${qs.toString()}`;
      const data = await cachedGet<CoverrSearch>(`https://api.coverr.co/videos?${qs}`, cacheKey);
      const hits = data.hits ?? data.videos ?? [];

      return hits.flatMap((hit) => {
        if (!hit?.id) return [];
        if (!matchesOrientation(hit, params.orientation)) return [];
        const urls = hit.urls ?? {};
        const download = urls.mp4_download || urls.mp4;
        if (!download) return [];
        const width = hit.max_width || hit.width || 0;
        const height = hit.max_height || hit.height || 0;
        if (width <= 0 || height <= 0) return [];
        const who = creatorOf(hit);
        const candidate: Candidate = {
          id: `coverr:video:${hit.id}`,
          provider: "coverr",
          sourceId: String(hit.id),
          kind: "video",
          pageUrl: pageUrl(hit),
          thumbnailUrl: hit.thumbnail || hit.poster || "",
          previewUrl: urls.mp4_preview || urls.mp4,
          downloadUrl: download,
          width,
          height,
          durationSec: asDuration(hit.duration),
          downloads: hit.downloads,
          views: hit.views,
          tags: tagsOf(hit),
          creator: who.name,
          creatorUrl: who.url,
          license: "Coverr License",
          score: 0,
        };
        return [candidate];
      });
    },
  };
}

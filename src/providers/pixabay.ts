import type { JsonFileCache } from "../cache.ts";
import { httpJson } from "../http.ts";
import { pixabayOrientation } from "../orientation.ts";
import type { Candidate, ProviderAdapter, SearchParams } from "../types.ts";

interface PixabayImageHit {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
  fullHDURL?: string;
  imageURL?: string;
  imageWidth: number;
  imageHeight: number;
  views: number;
  downloads: number;
  likes: number;
  user: string;
  user_id: number;
}

interface PixabayVideoRendition {
  url: string;
  width: number;
  height: number;
  size: number;
  thumbnail: string;
}

interface PixabayVideoHit {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  duration: number;
  videos: {
    large?: PixabayVideoRendition;
    medium?: PixabayVideoRendition;
    small?: PixabayVideoRendition;
    tiny?: PixabayVideoRendition;
  };
  views: number;
  downloads: number;
  likes: number;
  user: string;
  user_id: number;
}

interface PixabaySearch<T> {
  hits: T[];
}

function pickVideo(hit: PixabayVideoHit): PixabayVideoRendition | undefined {
  const order = [hit.videos.large, hit.videos.medium, hit.videos.small, hit.videos.tiny];
  return order.find((r) => r && r.url && r.width > 0);
}

function pickPreviewVideo(hit: PixabayVideoHit): PixabayVideoRendition | undefined {
  const order = [hit.videos.small, hit.videos.tiny, hit.videos.medium];
  return order.find((r) => r && r.url && r.width > 0);
}

function tagsOf(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function userUrl(user: string, userId: number): string {
  return `https://pixabay.com/users/${encodeURIComponent(user)}-${userId}/`;
}

export function createPixabayAdapter(
  apiKey: string,
  cache: JsonFileCache,
): ProviderAdapter {
  async function cachedGet<T>(url: string, cacheKey: string): Promise<T> {
    const hit = await cache.get<T>(cacheKey);
    if (hit) return hit;
    const data = await httpJson<T>(url);
    await cache.set(cacheKey, data);
    return data;
  }

  return {
    name: "pixabay",
    supports: ["video", "image"],
    isConfigured: () => true,

    async search(params: SearchParams): Promise<Candidate[]> {
      const orientation = pixabayOrientation(params.orientation);
      const common: Record<string, string> = {
        q: params.query,
        lang: "en",
        safesearch: "true",
        order: "popular",
        per_page: String(Math.min(Math.max(params.perPage, 3), 200)),
        page: "1",
        min_width: String(params.minWidth),
        min_height: String(params.minHeight),
      };

      if (params.kind === "video") {
        const qs = new URLSearchParams({
          ...common,
          video_type: "film",
        });
        const cacheKey = `videos:${qs.toString()}`;
        qs.set("key", apiKey);
        const url = `https://pixabay.com/api/videos/?${qs}`;
        const data = await cachedGet<PixabaySearch<PixabayVideoHit>>(url, cacheKey);
        return (data.hits ?? []).flatMap((hit) => {
          const file = pickVideo(hit);
          if (!file) return [];
          const candidate: Candidate = {
            id: `pixabay:video:${hit.id}`,
            provider: "pixabay",
            sourceId: String(hit.id),
            kind: "video",
            pageUrl: hit.pageURL,
            thumbnailUrl: file.thumbnail || file.url,
            previewUrl: pickPreviewVideo(hit)?.url,
            downloadUrl: file.url,
            width: file.width,
            height: file.height,
            durationSec: hit.duration,
            likes: hit.likes,
            downloads: hit.downloads,
            views: hit.views,
            tags: tagsOf(hit.tags),
            creator: hit.user,
            creatorUrl: userUrl(hit.user, hit.user_id),
            license: "Pixabay Content License",
            score: 0,
          };
          return [candidate];
        });
      }

      const qs = new URLSearchParams({
        ...common,
        image_type: "photo",
        orientation,
        editors_choice: "false",
      });
      const cacheKey = `images:${qs.toString()}`;
      qs.set("key", apiKey);
      const url = `https://pixabay.com/api/?${qs}`;
      const data = await cachedGet<PixabaySearch<PixabayImageHit>>(url, cacheKey);
      return (data.hits ?? []).map((hit) => ({
        id: `pixabay:image:${hit.id}`,
        provider: "pixabay",
        sourceId: String(hit.id),
        kind: "image",
        pageUrl: hit.pageURL,
        thumbnailUrl: hit.previewURL || hit.webformatURL,
        previewUrl: hit.webformatURL || hit.largeImageURL,
        downloadUrl: hit.imageURL || hit.fullHDURL || hit.largeImageURL,
        width: hit.imageWidth,
        height: hit.imageHeight,
        likes: hit.likes,
        downloads: hit.downloads,
        views: hit.views,
        tags: tagsOf(hit.tags),
        creator: hit.user,
        creatorUrl: userUrl(hit.user, hit.user_id),
        license: "Pixabay Content License",
        score: 0,
      }));
    },
  };
}

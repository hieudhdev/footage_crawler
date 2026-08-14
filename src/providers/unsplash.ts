import { httpJson } from "../http.ts";
import { unsplashOrientation } from "../orientation.ts";
import type { Candidate, ProviderAdapter, SearchParams } from "../types.ts";

interface UnsplashUser {
  name: string;
  links: { html: string };
}

interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  description: string | null;
  alt_description: string | null;
  likes: number;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  links: {
    html: string;
    download_location: string;
  };
  user: UnsplashUser;
  tags?: { title: string }[];
}

interface UnsplashSearch {
  results: UnsplashPhoto[];
}

export function createUnsplashAdapter(accessKey: string): ProviderAdapter {
  const headers = { Authorization: `Client-ID ${accessKey}` };

  return {
    name: "unsplash",
    supports: ["image"],
    isConfigured: () => true,

    async search(params: SearchParams): Promise<Candidate[]> {
      if (params.kind !== "image") return [];

      const qs = new URLSearchParams({
        query: params.query,
        orientation: unsplashOrientation(params.orientation),
        content_filter: "high",
        per_page: String(Math.min(params.perPage, 30)),
        page: "1",
      });

      const data = await httpJson<UnsplashSearch>(
        `https://api.unsplash.com/search/photos?${qs}`,
        { headers },
      );

      return (data.results ?? []).map((photo) => {
        const tags = [
          photo.description,
          photo.alt_description,
          ...(photo.tags ?? []).map((t) => t.title),
        ].filter((t): t is string => Boolean(t));

        const candidate: Candidate = {
          id: `unsplash:image:${photo.id}`,
          provider: "unsplash",
          sourceId: photo.id,
          kind: "image",
          pageUrl: photo.links.html,
          thumbnailUrl: photo.urls.small,
          previewUrl: photo.urls.regular,
          downloadUrl: `${photo.urls.raw}&w=1920&fit=max`,
          width: photo.width,
          height: photo.height,
          likes: photo.likes,
          tags,
          creator: photo.user.name,
          creatorUrl: photo.user.links.html,
          license: "Unsplash License",
          downloadLocation: photo.links.download_location,
          score: 0,
        };
        return candidate;
      });
    },
  };
}

export async function triggerUnsplashDownload(
  downloadLocation: string,
  accessKey: string,
): Promise<string | undefined> {
  const data = await httpJson<{ url?: string }>(downloadLocation, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });
  return data.url;
}

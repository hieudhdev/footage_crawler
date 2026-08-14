import type { Candidate, ProviderAdapter, SearchParams } from "../types.ts";
import { httpJson } from "../http.ts";
import { pexelsSize } from "../orientation.ts";
import type { Resolution } from "../types.ts";

interface PexelsPhoto {
  id: number;
  url: string;
  photographer: string;
  photographer_url: string;
  width: number;
  height: number;
  alt: string | null;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
  };
}

interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideo {
  id: number;
  url: string;
  image: string;
  duration: number;
  user: { name: string; url: string };
  video_files: PexelsVideoFile[];
}

interface PexelsPhotoSearch {
  photos: PexelsPhoto[];
}

interface PexelsVideoSearch {
  videos: PexelsVideo[];
}

function mp4Files(files: PexelsVideoFile[]): PexelsVideoFile[] {
  const mp4 = files.filter((f) => f.file_type.includes("mp4") && f.width > 0 && f.link);
  return mp4.length ? mp4 : files.filter((f) => f.width > 0 && Boolean(f.link));
}

function pickDownloadFile(files: PexelsVideoFile[]): PexelsVideoFile | undefined {
  return [...mp4Files(files)].sort((a, b) => b.width * b.height - a.width * a.height)[0];
}

export function pickPreviewFile(files: PexelsVideoFile[]): PexelsVideoFile | undefined {
  const pool = mp4Files(files);
  if (!pool.length) return undefined;
  return [...pool].sort((a, b) => Math.abs(a.width - 960) - Math.abs(b.width - 960))[0];
}

export async function fetchPexelsVideoPreview(
  apiKey: string,
  videoId: string,
): Promise<string | undefined> {
  const video = await httpJson<PexelsVideo>(`https://api.pexels.com/v1/videos/${videoId}`, {
    headers: { Authorization: apiKey },
  });
  return pickPreviewFile(video.video_files ?? [])?.link;
}

export function createPexelsAdapter(
  apiKey: string,
  resolution: Resolution,
): ProviderAdapter {
  const headers = { Authorization: apiKey };

  return {
    name: "pexels",
    supports: ["video", "image"],
    isConfigured: () => true,

    async search(params: SearchParams): Promise<Candidate[]> {
      const size = pexelsSize(resolution);
      const qs = new URLSearchParams({
        query: params.query,
        orientation: params.orientation,
        size,
        per_page: String(params.perPage),
        page: "1",
      });

      if (params.kind === "video") {
        const data = await httpJson<PexelsVideoSearch>(
          `https://api.pexels.com/v1/videos/search?${qs}`,
          { headers },
        );
        return (data.videos ?? []).flatMap((video) => {
          const file = pickDownloadFile(video.video_files ?? []);
          if (!file) return [];
          const preview = pickPreviewFile(video.video_files ?? []);
          const candidate: Candidate = {
            id: `pexels:video:${video.id}`,
            provider: "pexels",
            sourceId: String(video.id),
            kind: "video",
            pageUrl: video.url,
            thumbnailUrl: video.image,
            previewUrl: preview?.link,
            downloadUrl: file.link,
            width: file.width,
            height: file.height,
            durationSec: video.duration,
            tags: [],
            creator: video.user?.name ?? "Unknown",
            creatorUrl: video.user?.url,
            license: "Pexels License",
            score: 0,
          };
          return [candidate];
        });
      }

      const data = await httpJson<PexelsPhotoSearch>(
        `https://api.pexels.com/v1/search?${qs}`,
        { headers },
      );
      return (data.photos ?? []).map((photo) => ({
        id: `pexels:image:${photo.id}`,
        provider: "pexels",
        sourceId: String(photo.id),
        kind: "image",
        pageUrl: photo.url,
        thumbnailUrl: photo.src.medium,
        previewUrl: photo.src.large,
        downloadUrl: photo.src.original,
        width: photo.width,
        height: photo.height,
        tags: photo.alt ? [photo.alt] : [],
        creator: photo.photographer,
        creatorUrl: photo.photographer_url,
        license: "Pexels License",
        score: 0,
      }));
    },
  };
}

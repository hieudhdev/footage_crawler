import type { AppConfig } from "./config.ts";
import { httpJson } from "./http.ts";
import type { Manifest } from "./manifest.ts";
import { writeManifest } from "./manifest.ts";
import { fetchCoverrVideoPreview } from "./providers/coverr.ts";
import { fetchPexelsVideoPreview } from "./providers/pexels.ts";
import type { Candidate } from "./types.ts";

interface PixabayVideoRendition {
  url: string;
  width: number;
}

interface PixabayVideoById {
  hits: {
    videos?: {
      large?: PixabayVideoRendition;
      medium?: PixabayVideoRendition;
      small?: PixabayVideoRendition;
      tiny?: PixabayVideoRendition;
    };
  }[];
}

async function pixabayVideoPreview(apiKey: string, id: string): Promise<string | undefined> {
  const qs = new URLSearchParams({ key: apiKey, id });
  const data = await httpJson<PixabayVideoById>(`https://pixabay.com/api/videos/?${qs}`);
  const videos = data.hits[0]?.videos;
  if (!videos) return undefined;
  const order = [videos.small, videos.tiny, videos.medium, videos.large];
  return order.find((r) => r && r.url && r.width > 0)?.url;
}

function needsVideoPreview(c: Candidate): boolean {
  return c.kind === "video" && !c.previewUrl;
}

function imagePreviewFallback(c: Candidate): string | undefined {
  if (c.kind !== "image") return undefined;
  return c.previewUrl || c.thumbnailUrl;
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i;
      i += 1;
      const item = items[idx];
      if (item !== undefined) await fn(item);
    }
  });
  await Promise.all(workers);
}

export async function hydratePreviews(
  projectDir: string,
  manifest: Manifest,
  cfg: AppConfig,
  log: (msg: string) => void,
): Promise<Manifest> {
  const pending: Candidate[] = [];
  for (const scene of manifest.scenes) {
    for (const c of scene.shortlist) {
      if (c.kind === "image" && !c.previewUrl) {
        c.previewUrl = imagePreviewFallback(c);
      }
      if (needsVideoPreview(c)) pending.push(c);
    }
  }

  if (!pending.length) return manifest;

  log(`Hydrate preview cho ${pending.length} video…`);
  await mapLimit(pending, 3, async (c) => {
    try {
      if (c.provider === "pexels" && cfg.pexelsApiKey) {
        c.previewUrl = await fetchPexelsVideoPreview(cfg.pexelsApiKey, c.sourceId);
      } else if (c.provider === "coverr" && cfg.coverrApiKey) {
        c.previewUrl = await fetchCoverrVideoPreview(cfg.coverrApiKey, c.sourceId);
      } else if (c.provider === "pixabay" && cfg.pixabayApiKey) {
        c.previewUrl = await pixabayVideoPreview(cfg.pixabayApiKey, c.sourceId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`  ! preview ${c.id}: ${message}`);
    }
  });

  await writeManifest(projectDir, manifest);
  return manifest;
}

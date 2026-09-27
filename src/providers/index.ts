import path from "node:path";
import { JsonFileCache } from "../cache.ts";
import type { AppConfig } from "../config.ts";
import type { Resolution } from "../types.ts";
import type { ProviderAdapter } from "../types.ts";
import { createCoverrAdapter } from "./coverr.ts";
import { createPexelsAdapter } from "./pexels.ts";
import { createPixabayAdapter } from "./pixabay.ts";
import { createUnsplashAdapter } from "./unsplash.ts";

export function createAdapters(
  cfg: AppConfig,
  resolution: Resolution,
): ProviderAdapter[] {
  const adapters: ProviderAdapter[] = [];
  if (cfg.pexelsApiKey) {
    adapters.push(createPexelsAdapter(cfg.pexelsApiKey, resolution));
  }
  if (cfg.coverrApiKey) {
    const cache = new JsonFileCache(path.join(cfg.cacheDir, "coverr"));
    adapters.push(createCoverrAdapter(cfg.coverrApiKey, cache));
  }
  if (cfg.pixabayApiKey) {
    const cache = new JsonFileCache(path.join(cfg.cacheDir, "pixabay"));
    adapters.push(createPixabayAdapter(cfg.pixabayApiKey, cache));
  }
  if (cfg.unsplashAccessKey) {
    adapters.push(createUnsplashAdapter(cfg.unsplashAccessKey));
  }
  return adapters;
}

export { triggerUnsplashDownload } from "./unsplash.ts";

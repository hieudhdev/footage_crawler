import { config as loadEnv } from "dotenv";
import type { Provider } from "./types.ts";

loadEnv({ quiet: true });

export interface AppConfig {
  pexelsApiKey?: string;
  pixabayApiKey?: string;
  unsplashAccessKey?: string;
  cacheDir: string;
  projectsDir: string;
}

function trim(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

export function loadConfig(): AppConfig {
  return {
    pexelsApiKey: trim(process.env.PEXELS_API_KEY),
    pixabayApiKey: trim(process.env.PIXABAY_API_KEY),
    unsplashAccessKey: trim(process.env.UNSPLASH_ACCESS_KEY),
    cacheDir: process.env.CACHE_DIR?.trim() || ".cache",
    projectsDir: process.env.PROJECTS_DIR?.trim() || "projects",
  };
}

export function configuredProviders(cfg: AppConfig): Provider[] {
  const out: Provider[] = [];
  if (cfg.pexelsApiKey) out.push("pexels");
  if (cfg.pixabayApiKey) out.push("pixabay");
  if (cfg.unsplashAccessKey) out.push("unsplash");
  return out;
}

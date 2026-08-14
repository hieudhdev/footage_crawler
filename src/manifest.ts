import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Aspect, Resolution } from "./types.ts";
import type { MatchedScene } from "./pipeline.ts";

export interface Manifest {
  project: string;
  slug: string;
  aspect: Aspect;
  minResolution: Resolution;
  createdAt: string;
  inputPath: string;
  scenes: MatchedScene[];
}

export function manifestPath(projectDir: string): string {
  return path.join(projectDir, "manifest.json");
}

export async function writeManifest(projectDir: string, manifest: Manifest): Promise<void> {
  await mkdir(projectDir, { recursive: true });
  await writeFile(manifestPath(projectDir), JSON.stringify(manifest, null, 2), "utf8");
}

export async function readManifest(projectDir: string): Promise<Manifest> {
  const raw = await readFile(manifestPath(projectDir), "utf8");
  return JSON.parse(raw) as Manifest;
}

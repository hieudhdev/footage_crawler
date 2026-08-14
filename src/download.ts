import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "./config.ts";
import { httpBuffer } from "./http.ts";
import type { Manifest } from "./manifest.ts";
import { triggerUnsplashDownload } from "./providers/index.ts";
import type { Candidate } from "./types.ts";
import { extFromKind, filenameFromQuery, uniqueFilename } from "./util.ts";

export interface CreditRow {
  sceneId: string;
  provider: string;
  creator: string;
  pageUrl: string;
  license: string;
  file: string;
}

function selectedCandidate(scene: Manifest["scenes"][number]): Candidate | undefined {
  if (!scene.selectedId) return undefined;
  return scene.shortlist.find((c) => c.id === scene.selectedId);
}

export async function downloadProject(
  projectDir: string,
  manifest: Manifest,
  cfg: AppConfig,
  log: (msg: string) => void,
): Promise<CreditRow[]> {
  const scenesDir = path.join(projectDir, "scenes");
  await mkdir(scenesDir, { recursive: true });

  const jobs = manifest.scenes
    .map((scene) => ({ scene, candidate: selectedCandidate(scene) }))
    .filter((row): row is { scene: (typeof manifest.scenes)[number]; candidate: Candidate } =>
      Boolean(row.candidate),
    );

  log(`Download ${jobs.length} file → ${scenesDir}`);

  const credits: CreditRow[] = [];
  const used = new Set<string>();

  for (const [index, { scene, candidate }] of jobs.entries()) {
    const base = filenameFromQuery(scene.queryUsed, scene.id);
    const guessExt = candidate.kind === "video" ? "mp4" : "jpg";
    log(`[${index + 1}/${jobs.length}] ${base}.${guessExt} · ${candidate.provider} ${candidate.width}x${candidate.height}`);

    let downloadUrl = candidate.downloadUrl;
    if (candidate.provider === "unsplash" && candidate.downloadLocation) {
      if (!cfg.unsplashAccessKey) {
        throw new Error("UNSPLASH_ACCESS_KEY required to download Unsplash stills");
      }
      const tracked = await triggerUnsplashDownload(
        candidate.downloadLocation,
        cfg.unsplashAccessKey,
      );
      if (tracked) downloadUrl = tracked;
    }

    const { buffer, contentType } = await httpBuffer(downloadUrl);
    const ext = extFromKind(candidate.kind, contentType, downloadUrl);
    const filename = uniqueFilename(base, ext, used, scene.id);
    await writeFile(path.join(scenesDir, filename), buffer);

    credits.push({
      sceneId: scene.id,
      provider: candidate.provider,
      creator: candidate.creator,
      pageUrl: candidate.pageUrl,
      license: candidate.license,
      file: path.join("scenes", filename).replaceAll("\\", "/"),
    });
  }

  const skippedManual = manifest.scenes.filter((s) => s.status === "manual").length;
  const skippedPick = manifest.scenes.length - jobs.length - skippedManual;
  if (skippedManual) log(`Skip ${skippedManual} làm tay`);
  if (skippedPick) log(`Skip ${skippedPick} chưa chọn`);

  await writeFile(path.join(projectDir, "credits.json"), JSON.stringify(credits, null, 2), "utf8");
  log(`Xong ${credits.length} file`);
  return credits;
}

import { readManifest, writeManifest } from "./manifest.ts";
import type { Manifest } from "./manifest.ts";

export async function pickCandidate(
  projectDir: string,
  sceneId: string,
  candidateId: string,
): Promise<Manifest> {
  const manifest = await readManifest(projectDir);
  const scene = manifest.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error(`Không thấy scene ${sceneId}`);
  if (scene.status === "manual") {
    throw new Error(`${sceneId} là ${scene.source} — làm tay, không pick stock`);
  }
  const candidate = scene.shortlist.find((c) => c.id === candidateId);
  if (!candidate) {
    const ids = scene.shortlist.map((c) => c.id).join("\n  ");
    throw new Error(`Candidate không nằm trong shortlist. Có:\n  ${ids}`);
  }
  scene.selectedId = candidate.id;
  scene.status = "matched";
  await writeManifest(projectDir, manifest);
  return manifest;
}

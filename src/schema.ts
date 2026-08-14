import { z } from "zod";
import { SCENE_SOURCES, WEB_TYPES } from "./types.ts";
import type { Aspect, MediaKind, Resolution, SceneSource } from "./types.ts";

const lower = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : value);

export const webSceneSchema = z.object({
  chapter: z.number().int().positive(),
  scene: z.number().int().positive(),
  type: z.preprocess(lower, z.enum(WEB_TYPES)),
  source: z.preprocess(lower, z.enum(SCENE_SOURCES)),
  keyword: z.string().min(1),
});

export const keywordFileSchema = z.array(webSceneSchema).min(1);

export type WebScene = z.infer<typeof webSceneSchema>;

export function splitKeywords(raw: string): string[] {
  const parts = raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.slice(0, 4);
}

export function sceneId(chapter: number, scene: number): string {
  return `c${String(chapter).padStart(2, "0")}s${String(scene).padStart(2, "0")}`;
}

export interface SceneInput {
  id: string;
  chapter: number;
  scene: number;
  source: SceneSource;
  kind: MediaKind;
  durationSec: number;
  queries: { primary: string; fallbacks: string[] };
  keywordRaw: string;
}

export interface ProjectInput {
  project: string;
  aspect: Aspect;
  minResolution: Resolution;
  scenes: SceneInput[];
}

function expandScene(row: WebScene): SceneInput {
  const phrases = splitKeywords(row.keyword);
  const primary = phrases[0];
  if (!primary) {
    throw new Error(`c${row.chapter}s${row.scene}: keyword trống sau khi tách`);
  }
  return {
    id: sceneId(row.chapter, row.scene),
    chapter: row.chapter,
    scene: row.scene,
    source: row.source,
    kind: row.type === "photo" ? "image" : "video",
    durationSec: 10,
    queries: { primary, fallbacks: phrases.slice(1) },
    keywordRaw: row.keyword.trim(),
  };
}

export function parseKeywordFile(raw: unknown, projectName: string): ProjectInput {
  const rows = keywordFileSchema.parse(raw);
  const scenes = rows.map(expandScene);
  const seen = new Set<string>();
  for (const scene of scenes) {
    if (seen.has(scene.id)) {
      throw new Error(`Trùng chapter/scene: ${scene.id}`);
    }
    seen.add(scene.id);
  }
  return {
    project: projectName,
    aspect: "16:9",
    minResolution: "fhd",
    scenes,
  };
}

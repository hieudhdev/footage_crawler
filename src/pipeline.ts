import type { ProjectInput, SceneInput } from "./schema.ts";
import { orientationFromAspect, minDims } from "./orientation.ts";
import { passesHardFilter, rankCandidates } from "./rank.ts";
import type {
  Candidate,
  MediaKind,
  Orientation,
  Provider,
  ProviderAdapter,
  SceneSource,
  SceneStatus,
} from "./types.ts";

const TARGET_SHORTLIST = 5;
const STOP_AT = 8;
const PER_PAGE = 15;

export interface MatchedScene {
  id: string;
  chapter: number;
  scene: number;
  source: SceneSource;
  durationSec: number;
  kind: MediaKind;
  orientation: Orientation;
  keywordRaw: string;
  queryUsed: string;
  queriesTried: string[];
  providersTried: Provider[];
  status: SceneStatus;
  selectedId: string | null;
  shortlist: Candidate[];
}

function queriesFor(scene: SceneInput): string[] {
  return [scene.queries.primary, ...scene.queries.fallbacks];
}

function providerOrder(
  scene: SceneInput,
  adapters: ProviderAdapter[],
): ProviderAdapter[] {
  const preferred: Provider[] =
    scene.kind === "video" ? ["pexels", "pixabay"] : ["unsplash", "pexels", "pixabay"];
  const byName = new Map(adapters.map((a) => [a.name, a]));
  const ordered: ProviderAdapter[] = [];
  for (const name of preferred) {
    const adapter = byName.get(name);
    if (adapter && adapter.supports.includes(scene.kind)) ordered.push(adapter);
  }
  return ordered;
}

function manualScene(scene: SceneInput, orientation: Orientation): MatchedScene {
  return {
    id: scene.id,
    chapter: scene.chapter,
    scene: scene.scene,
    source: scene.source,
    durationSec: scene.durationSec,
    kind: scene.kind,
    orientation,
    keywordRaw: scene.keywordRaw,
    queryUsed: scene.queries.primary,
    queriesTried: [],
    providersTried: [],
    status: "manual",
    selectedId: null,
    shortlist: [],
  };
}

export async function matchScene(
  scene: SceneInput,
  project: ProjectInput,
  adapters: ProviderAdapter[],
  log: (msg: string) => void,
): Promise<MatchedScene> {
  const orientation = orientationFromAspect(project.aspect);
  if (scene.source !== "stock") {
    return manualScene(scene, orientation);
  }

  const resolution = project.minResolution;
  const { minWidth, minHeight } = minDims(orientation, resolution);
  const queries = queriesFor(scene);
  const providers = providerOrder(scene, adapters);
  const kind = scene.kind;

  const collected: Candidate[] = [];
  const queriesTried: string[] = [];
  const providersTried: Provider[] = [];
  let queryUsed = scene.queries.primary;

  for (const query of queries) {
    queriesTried.push(query);
    for (const adapter of providers) {
      if (!providersTried.includes(adapter.name)) providersTried.push(adapter.name);
      log(`  ${scene.id} · ${adapter.name} · "${query}"`);
      try {
        const raw = await adapter.search({
          query,
          kind,
          orientation,
          minWidth,
          minHeight,
          perPage: PER_PAGE,
        });
        const filtered = raw.filter((c) =>
          passesHardFilter(c, {
            kind,
            minWidth,
            minHeight,
            durationSec: scene.durationSec,
            negative: [],
          }),
        );
        collected.push(...filtered);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`  ! ${adapter.name} lỗi: ${message}`);
      }

      const rankedSoFar = rankCandidates(collected, {
        query: scene.queries.primary,
        durationSec: scene.durationSec,
        minWidth,
        minHeight,
      });
      if (rankedSoFar.length >= STOP_AT) {
        queryUsed = query;
        return finish(scene, orientation, queryUsed, queriesTried, providersTried, rankedSoFar.slice(0, TARGET_SHORTLIST));
      }
    }
    if (collected.length >= TARGET_SHORTLIST) {
      queryUsed = query;
      break;
    }
  }

  const ranked = rankCandidates(collected, {
    query: scene.queries.primary,
    durationSec: scene.durationSec,
    minWidth,
    minHeight,
  });
  return finish(scene, orientation, queryUsed, queriesTried, providersTried, ranked.slice(0, TARGET_SHORTLIST));
}

function finish(
  scene: SceneInput,
  orientation: Orientation,
  queryUsed: string,
  queriesTried: string[],
  providersTried: Provider[],
  shortlist: Candidate[],
): MatchedScene {
  const top = shortlist[0];
  return {
    id: scene.id,
    chapter: scene.chapter,
    scene: scene.scene,
    source: scene.source,
    durationSec: scene.durationSec,
    kind: scene.kind,
    orientation,
    keywordRaw: scene.keywordRaw,
    queryUsed,
    queriesTried,
    providersTried,
    status: top ? "matched" : "unmatched",
    selectedId: top?.id ?? null,
    shortlist,
  };
}

export async function matchProject(
  project: ProjectInput,
  adapters: ProviderAdapter[],
  log: (msg: string) => void,
): Promise<MatchedScene[]> {
  const scenes: MatchedScene[] = [];
  for (const scene of project.scenes) {
    if (scene.source !== "stock") {
      log(`Scene ${scene.id} skip (${scene.source})`);
    } else {
      log(`Scene ${scene.id} (${scene.kind})`);
    }
    scenes.push(await matchScene(scene, project, adapters, log));
  }
  return scenes;
}

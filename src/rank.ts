import type { Candidate, MediaKind, Provider } from "./types.ts";

export const TARGET_SHORTLIST = 8;

export const VIDEO_QUOTAS: Partial<Record<Provider, number>> = {
  pexels: 3,
  coverr: 3,
  pixabay: 2,
};

export const PHOTO_QUOTAS: Partial<Record<Provider, number>> = {
  unsplash: 3,
  pexels: 3,
  pixabay: 2,
};

export function quotasFor(kind: MediaKind): Partial<Record<Provider, number>> {
  return kind === "video" ? VIDEO_QUOTAS : PHOTO_QUOTAS;
}

const SLACK = 0.9;

export function passesHardFilter(
  candidate: Candidate,
  opts: {
    kind: MediaKind;
    minWidth: number;
    minHeight: number;
    durationSec: number;
    negative: string[];
  },
): boolean {
  if (candidate.kind !== opts.kind) return false;
  if (candidate.width < opts.minWidth * SLACK) return false;
  if (candidate.height < opts.minHeight * SLACK) return false;

  if (opts.kind === "video") {
    const dur = candidate.durationSec ?? 0;
    if (dur < opts.durationSec * 0.85) return false;
  }

  if (opts.negative.length) {
    const hay = `${candidate.tags.join(" ")} ${candidate.creator}`.toLowerCase();
    if (opts.negative.some((term) => hay.includes(term.toLowerCase()))) return false;
  }

  return true;
}

function queryOverlap(tags: string[], query: string): number {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  if (!words.length) return 0;
  const hay = tags.join(" ").toLowerCase();
  const hits = words.filter((w) => hay.includes(w)).length;
  return hits / words.length;
}

export function scoreCandidate(
  candidate: Candidate,
  opts: { query: string; durationSec: number; minWidth: number; minHeight: number },
): number {
  const resScore = Math.min(
    (candidate.width / opts.minWidth + candidate.height / opts.minHeight) / 2,
    2,
  );

  let durationScore = 0.6;
  if (candidate.kind === "video" && candidate.durationSec) {
    const extra = candidate.durationSec / opts.durationSec;
    if (extra < 1) durationScore = 0;
    else if (extra <= 2) durationScore = 1;
    else durationScore = Math.max(0.3, 1 - (extra - 2) * 0.15);
  }

  const pop = Math.log10(1 + (candidate.downloads ?? 0) + (candidate.likes ?? 0) * 3);
  const popScore = Math.min(pop / 4, 1);
  const overlap = queryOverlap(candidate.tags, opts.query);

  return resScore * 2 + durationScore + popScore + overlap;
}

export function rankCandidates(
  candidates: Candidate[],
  opts: { query: string; durationSec: number; minWidth: number; minHeight: number },
): Candidate[] {
  const seen = new Set<string>();
  const unique: Candidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    unique.push({ ...c, score: scoreCandidate(c, opts) });
  }
  return unique.sort((a, b) => b.score - a.score);
}

export function pickDiverseShortlist(
  ranked: Candidate[],
  quotas: Partial<Record<Provider, number>>,
  target: number,
): Candidate[] {
  const picked: Candidate[] = [];
  const used = new Set<string>();
  const counts = new Map<Provider, number>();

  for (const c of ranked) {
    if (picked.length >= target) break;
    const n = counts.get(c.provider) ?? 0;
    const cap = quotas[c.provider] ?? target;
    if (n >= cap) continue;
    picked.push(c);
    used.add(c.id);
    counts.set(c.provider, n + 1);
  }

  for (const c of ranked) {
    if (picked.length >= target) break;
    if (used.has(c.id)) continue;
    picked.push(c);
  }

  return picked;
}

export function underQuota(
  ranked: Candidate[],
  provider: Provider,
  quotas: Partial<Record<Provider, number>>,
  target: number,
): boolean {
  const cap = quotas[provider] ?? target;
  return ranked.filter((c) => c.provider === provider).length < cap;
}

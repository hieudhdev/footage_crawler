export const PROVIDERS = ["pexels", "coverr", "pixabay", "unsplash"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const MEDIA_KINDS = ["video", "image"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const WEB_TYPES = ["video", "photo"] as const;
export type WebType = (typeof WEB_TYPES)[number];

export const SCENE_SOURCES = ["stock", "archival", "ai"] as const;
export type SceneSource = (typeof SCENE_SOURCES)[number];

export const ASPECTS = ["16:9", "9:16", "1:1"] as const;
export type Aspect = (typeof ASPECTS)[number];

export const ORIENTATIONS = ["landscape", "portrait", "square"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export const RESOLUTIONS = ["hd", "fhd", "4k"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export type SceneStatus = "matched" | "unmatched" | "manual";

export interface Candidate {
  id: string;
  provider: Provider;
  sourceId: string;
  kind: MediaKind;
  pageUrl: string;
  thumbnailUrl: string;
  /** Smaller video/image for review UI — not the file to save. */
  previewUrl?: string;
  downloadUrl: string;
  width: number;
  height: number;
  durationSec?: number;
  likes?: number;
  downloads?: number;
  views?: number;
  tags: string[];
  creator: string;
  creatorUrl?: string;
  license: string;
  /** Unsplash tracking endpoint — ping before saving the file. */
  downloadLocation?: string;
  score: number;
}

export interface SearchParams {
  query: string;
  kind: MediaKind;
  orientation: Orientation;
  minWidth: number;
  minHeight: number;
  perPage: number;
}

export interface ProviderAdapter {
  name: Provider;
  supports: readonly MediaKind[];
  isConfigured(): boolean;
  search(params: SearchParams): Promise<Candidate[]>;
}

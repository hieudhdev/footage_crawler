import type { Aspect, Orientation, Resolution } from "./types.ts";

export function orientationFromAspect(aspect: Aspect): Orientation {
  if (aspect === "9:16") return "portrait";
  if (aspect === "1:1") return "square";
  return "landscape";
}

export function longEdge(resolution: Resolution): number {
  if (resolution === "4k") return 3840;
  if (resolution === "hd") return 1280;
  return 1920;
}

export function shortEdge(resolution: Resolution): number {
  if (resolution === "4k") return 2160;
  if (resolution === "hd") return 720;
  return 1080;
}

export function minDims(
  orientation: Orientation,
  resolution: Resolution,
): { minWidth: number; minHeight: number } {
  const long = longEdge(resolution);
  const short = shortEdge(resolution);
  if (orientation === "portrait") return { minWidth: short, minHeight: long };
  if (orientation === "square") return { minWidth: short, minHeight: short };
  return { minWidth: long, minHeight: short };
}

export function pexelsSize(resolution: Resolution): "small" | "medium" | "large" {
  if (resolution === "4k") return "large";
  if (resolution === "hd") return "small";
  return "medium";
}

export function pixabayOrientation(orientation: Orientation): "horizontal" | "vertical" | "all" {
  if (orientation === "portrait") return "vertical";
  if (orientation === "landscape") return "horizontal";
  return "all";
}

export function unsplashOrientation(
  orientation: Orientation,
): "landscape" | "portrait" | "squarish" {
  if (orientation === "portrait") return "portrait";
  if (orientation === "square") return "squarish";
  return "landscape";
}

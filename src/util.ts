export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "project";
}

export function filenameFromQuery(query: string, fallback: string): string {
  return slugify(query) || slugify(fallback) || "scene";
}

export function uniqueFilename(base: string, ext: string, used: Set<string>, extra: string): string {
  let name = `${base}.${ext}`;
  if (used.has(name)) name = `${base}-${extra}.${ext}`;
  let n = 2;
  while (used.has(name)) {
    name = `${base}-${extra}-${n}.${ext}`;
    n += 1;
  }
  used.add(name);
  return name;
}

export function extFromKind(kind: "video" | "image", contentType: string | null, url: string): string {
  if (kind === "video") return "mp4";
  const fromType = contentType?.split(";")[0]?.trim();
  if (fromType === "image/png") return "png";
  if (fromType === "image/webp") return "webp";
  if (fromType === "image/jpeg") return "jpg";
  const path = url.split("?")[0] ?? url;
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return "jpg";
}

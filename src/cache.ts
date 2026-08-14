import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEnvelope<T> {
  storedAt: number;
  value: T;
}

export class JsonFileCache {
  constructor(private readonly dir: string) {}

  private fileFor(key: string): string {
    const hash = createHash("sha256").update(key).digest("hex");
    return path.join(this.dir, `${hash}.json`);
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await readFile(this.fileFor(key), "utf8");
      const parsed = JSON.parse(raw) as CacheEnvelope<T>;
      if (!parsed || typeof parsed.storedAt !== "number") return undefined;
      if (Date.now() - parsed.storedAt > TTL_MS) return undefined;
      return parsed.value;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const envelope: CacheEnvelope<T> = { storedAt: Date.now(), value };
    await writeFile(this.fileFor(key), JSON.stringify(envelope), "utf8");
  }
}

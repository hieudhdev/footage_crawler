import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { configuredProviders, loadConfig } from "./config.ts";
import { downloadProject } from "./download.ts";
import { readManifest, writeManifest } from "./manifest.ts";
import { pickCandidate } from "./pick.ts";
import { matchProject } from "./pipeline.ts";
import { createAdapters } from "./providers/index.ts";
import { startReviewServer } from "./review/server.ts";
import { parseKeywordFile } from "./schema.ts";
import { slugify } from "./util.ts";

const COMMANDS = new Set(["start", "search", "review", "pick", "download"]);

function log(msg: string): void {
  console.error(msg);
}

async function exampleJsonNames(): Promise<string[]> {
  try {
    const names = await readdir("examples");
    return names.filter((n) => n.endsWith(".json")).map((n) => n.replace(/\.json$/i, ""));
  } catch {
    return [];
  }
}

async function usage(): Promise<never> {
  const examples = await exampleJsonNames();
  const list = examples.length ? examples.map((n) => `  npm start -- ${n}`).join("\n") : "  (thêm file .json vào examples/)";
  console.error(`Usage:
  npm start -- <json>

Thêm JSON vào examples/, rồi:

${list}

  npm start -- morning-city
  npm start -- examples/morning-city.json

Search xong mở review. Pick + Download trên UI. Chạy lại thì ghi đè manifest.

Lệnh rời (không cần): search | review | pick | download`);
  process.exit(1);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveKeywordFile(arg: string): Promise<string> {
  const withExt = arg.endsWith(".json") ? arg : `${arg}.json`;
  const candidates = [arg, withExt, path.join("examples", arg), path.join("examples", withExt)];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return path.resolve(candidate);
  }
  throw new Error(`Không thấy JSON: ${arg}. Để trong examples/${withExt}`);
}

async function cmdSearch(inputPath: string): Promise<string> {
  const cfg = loadConfig();
  const resolved = await resolveKeywordFile(inputPath);
  const raw = await readFile(resolved, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const slug = slugify(path.basename(resolved, ".json"));
  const project = parseKeywordFile(parsed, slug);
  const adapters = createAdapters(cfg, project.minResolution);
  const ready = configuredProviders(cfg);
  const hasStock = project.scenes.some((s) => s.source === "stock");

  if (hasStock && !adapters.length) {
    throw new Error("Chưa có API key. Copy .env.example → .env rồi điền key.");
  }

  const projectDir = path.resolve(cfg.projectsDir, slug);

  log(`JSON: ${resolved}`);
  log(`Providers: ${ready.join(", ")}`);
  const scenes = await matchProject(project, adapters, log);

  await writeManifest(projectDir, {
    project: project.project,
    slug,
    aspect: project.aspect,
    minResolution: project.minResolution,
    createdAt: new Date().toISOString(),
    inputPath: resolved,
    scenes,
  });

  const stock = scenes.filter((s) => s.source === "stock").length;
  const matched = scenes.filter((s) => s.status === "matched").length;
  const manual = scenes.filter((s) => s.status === "manual").length;
  log(`${matched}/${stock} stock matched · ${manual} làm tay · ${path.join(projectDir, "manifest.json")}`);
  return projectDir;
}

async function cmdStart(inputPath: string): Promise<void> {
  const projectDir = await cmdSearch(inputPath);
  const port = Number(process.env.REVIEW_PORT) || 4173;
  await startReviewServer(projectDir, port);
}

async function cmdPick(projectDir: string, sceneId: string, candidateId: string): Promise<void> {
  const dir = path.resolve(projectDir);
  const manifest = await pickCandidate(dir, sceneId, candidateId);
  const scene = manifest.scenes.find((s) => s.id === sceneId);
  const candidate = scene?.shortlist.find((c) => c.id === candidateId);
  log(`${sceneId} → ${candidateId} (${candidate?.provider} ${candidate?.width}x${candidate?.height})`);
}

async function cmdDownload(projectDir: string): Promise<void> {
  const cfg = loadConfig();
  const dir = path.resolve(projectDir);
  const manifest = await readManifest(dir);
  const credits = await downloadProject(dir, manifest, cfg, log);
  log(`Đã tải ${credits.length} file. credits.json trong ${dir}`);
}

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) {
    await usage();
    return;
  }

  if (!COMMANDS.has(cmd)) {
    await cmdStart(cmd);
    return;
  }

  if (cmd === "start") {
    const input = args[0];
    if (!input) {
      await usage();
      return;
    }
    await cmdStart(input);
    return;
  }
  if (cmd === "search") {
    const input = args[0];
    if (!input) {
      await usage();
      return;
    }
    await cmdSearch(input);
    return;
  }
  if (cmd === "pick") {
    const [dir, sceneId, candidateId] = args;
    if (!dir || !sceneId || !candidateId) {
      await usage();
      return;
    }
    await cmdPick(dir, sceneId, candidateId);
    return;
  }
  if (cmd === "review") {
    const dir = args[0];
    if (!dir) {
      await usage();
      return;
    }
    const port = Number(process.env.REVIEW_PORT) || 4173;
    await startReviewServer(dir, port);
    return;
  }
  if (cmd === "download") {
    const dir = args[0];
    if (!dir) {
      await usage();
      return;
    }
    await cmdDownload(dir);
    return;
  }
  await usage();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

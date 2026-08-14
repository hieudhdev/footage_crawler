import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.ts";
import { downloadProject } from "../download.ts";
import { hydratePreviews } from "../hydrate.ts";
import { readManifest } from "../manifest.ts";
import { pickCandidate } from "../pick.ts";

const UI_PATH = fileURLToPath(new URL("./ui.html", import.meta.url));

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(data),
  });
  res.end(data);
}

function openBrowser(url: string): void {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], {
    detached: true,
    stdio: "ignore",
  }).unref();
}

export async function startReviewServer(projectDir: string, port = 4173): Promise<void> {
  const dir = path.resolve(projectDir);
  const cfg = loadConfig();
  const ui = await readFile(UI_PATH, "utf8");
  console.error("Đang lấy URL preview (file nhỏ, không tải 4K)…");
  await hydratePreviews(dir, await readManifest(dir), cfg, (msg) => console.error(msg));

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      const method = req.method ?? "GET";

      if (method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(ui);
        return;
      }

      if (method === "GET" && url.pathname === "/api/manifest") {
        json(res, 200, await readManifest(dir));
        return;
      }

      if (method === "POST" && url.pathname === "/api/pick") {
        const body = JSON.parse(await readBody(req)) as {
          sceneId?: string;
          candidateId?: string;
        };
        if (!body.sceneId || !body.candidateId) {
          json(res, 400, { error: "sceneId and candidateId required" });
          return;
        }
        json(res, 200, await pickCandidate(dir, body.sceneId, body.candidateId));
        return;
      }

      if (method === "POST" && url.pathname === "/api/download") {
        const logs: string[] = [];
        const manifest = await readManifest(dir);
        const credits = await downloadProject(dir, manifest, cfg, (msg) => {
          console.error(msg);
          logs.push(msg);
        });
        json(res, 200, { credits, logs, projectDir: dir });
        return;
      }

      json(res, 404, { error: "not found" });
    } catch (err) {
      json(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  const url = `http://127.0.0.1:${port}`;
  console.error(`Review: ${url}`);
  console.error(`Project: ${dir}`);
  console.error("Ctrl+C để tắt.");
  openBrowser(url);
}

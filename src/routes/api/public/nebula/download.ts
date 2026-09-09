import { createFileRoute } from "@tanstack/react-router";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MODELS_DIR = join(tmpdir(), "nebula-models");
const STATUS_FILE = join(MODELS_DIR, "_status.json");

type DownloadStatus = {
  modelId: string;
  status: "pending" | "downloading" | "done" | "error";
  progress: number;
  totalBytes: number;
  downloadedBytes: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
  files: { name: string; size: number }[];
};

async function ensureDir() {
  await mkdir(MODELS_DIR, { recursive: true });
}

async function getStatusMap(): Promise<Record<string, DownloadStatus>> {
  try {
    const raw = await readFile(STATUS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveStatusMap(map: Record<string, DownloadStatus>) {
  await ensureDir();
  await writeFile(STATUS_FILE, JSON.stringify(map, null, 2));
}

async function getFileInfo(
  modelId: string,
): Promise<{ filename: string; size: number; url: string }[]> {
  const res = await fetch(`https://huggingface.co/api/models/${modelId}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Cannot fetch model info: ${res.status}`);
  const model = await res.json();

  const siblings: { rfilename: string; size?: number }[] = model.siblings || [];
  const relevantExts = [
    ".safetensors",
    ".gguf",
    ".bin",
    ".pt",
    ".onnx",
    ".json",
    ".txt",
    ".md",
  ];
  return siblings
    .filter((s) => {
      const name = s.rfilename.toLowerCase();
      return (
        relevantExts.some((ext) => name.endsWith(ext)) &&
        !name.endsWith(".gitattributes") &&
        !name.endsWith(".huggingface")
      );
    })
    .map((s) => ({
      filename: s.rfilename,
      size: s.size || 0,
      url: `https://huggingface.co/${modelId}/resolve/main/${encodeURIComponent(s.rfilename)}`,
    }));
}

async function downloadFile(
  url: string,
  destPath: string,
  onProgress: (downloaded: number) => void,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);

  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let downloaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    downloaded += value.length;
    onProgress(downloaded);
  }

  const totalSize = chunks.reduce((acc, c) => acc + c.length, 0);
  const buffer = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  await mkdir(join(destPath, ".."), { recursive: true });
  await writeFile(destPath, buffer);
}

export const Route = createFileRoute("/api/public/nebula/download")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        try {
          await ensureDir();
          const body = await request.json();
          const modelId: string = body.modelId;
          if (!modelId) {
            return Response.json(
              { error: "Missing modelId" },
              { status: 400, headers: CORS },
            );
          }

          const statusMap = await getStatusMap();
          if (statusMap[modelId]?.status === "downloading") {
            return Response.json(
              {
                success: true,
                status: statusMap[modelId],
                message: "Already downloading",
              },
              { headers: CORS },
            );
          }
          if (statusMap[modelId]?.status === "done") {
            return Response.json(
              {
                success: true,
                status: statusMap[modelId],
                message: "Already downloaded",
              },
              { headers: CORS },
            );
          }

          const files = await getFileInfo(modelId);
          const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

          const status: DownloadStatus = {
            modelId,
            status: "downloading",
            progress: 0,
            totalBytes,
            downloadedBytes: 0,
            startedAt: new Date().toISOString(),
            files: [],
          };
          statusMap[modelId] = status;
          await saveStatusMap(statusMap);

          const modelDir = join(
            MODELS_DIR,
            modelId.replace(/\//g, "__"),
          );

          // Start async download
          (async () => {
            try {
              let downloaded = 0;
              const downloadedFiles: { name: string; size: number }[] = [];

              for (const file of files) {
                const filePath = join(modelDir, file.filename);
                await downloadFile(
                  file.url,
                  filePath,
                  (bytes) => {
                    status.downloadedBytes = downloaded + bytes;
                    status.progress =
                      status.totalBytes > 0
                        ? Math.round(
                            (status.downloadedBytes / status.totalBytes) * 100,
                          )
                        : 0;
                  },
                );
                downloaded += file.size;
                downloadedFiles.push({
                  name: file.filename,
                  size: file.size,
                });
                status.files = downloadedFiles;
                status.downloadedBytes = downloaded;
                status.progress =
                  status.totalBytes > 0
                    ? Math.round((downloaded / status.totalBytes) * 100)
                    : 0;
                statusMap[modelId] = { ...status };
                await saveStatusMap(statusMap);
              }

              status.status = "done";
              status.progress = 100;
              status.completedAt = new Date().toISOString();
              statusMap[modelId] = { ...status };
              await saveStatusMap(statusMap);
            } catch (err) {
              status.status = "error";
              status.error = String(err);
              statusMap[modelId] = { ...status };
              await saveStatusMap(statusMap);
            }
          })();

          return Response.json(
            { success: true, status, message: "Download started" },
            { headers: CORS },
          );
        } catch (err) {
          return Response.json(
            { success: false, error: String(err) },
            { status: 500, headers: CORS },
          );
        }
      },

      GET: async ({ request }) => {
        try {
          await ensureDir();
          const url = new URL(request.url);
          const modelId = url.searchParams.get("modelId");

          if (modelId) {
            const statusMap = await getStatusMap();
            const status = statusMap[modelId];
            if (!status) {
              return Response.json(
                { success: true, status: null, message: "Not found" },
                { headers: CORS },
              );
            }
            return Response.json({ success: true, status }, { headers: CORS });
          }

          const statusMap = await getStatusMap();
          const all = Object.values(statusMap);
          return Response.json(
            { success: true, models: all, count: all.length },
            { headers: CORS },
          );
        } catch (err) {
          return Response.json(
            { success: false, error: String(err) },
            { status: 500, headers: CORS },
          );
        }
      },

      DELETE: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const modelId = url.searchParams.get("modelId");
          if (!modelId) {
            return Response.json(
              { error: "Missing modelId" },
              { status: 400, headers: CORS },
            );
          }

          const modelDir = join(
            MODELS_DIR,
            modelId.replace(/\//g, "__"),
          );
          await rm(modelDir, { recursive: true, force: true });

          const statusMap = await getStatusMap();
          delete statusMap[modelId];
          await saveStatusMap(statusMap);

          return Response.json(
            { success: true, message: "Model deleted" },
            { headers: CORS },
          );
        } catch (err) {
          return Response.json(
            { success: false, error: String(err) },
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});

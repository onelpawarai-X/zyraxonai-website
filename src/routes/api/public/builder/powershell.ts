import { createFileRoute } from "@tanstack/react-router";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { spawn } from "node:child_process";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const MAX_FILES = 80;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 120_000;

type Task = "diagnose" | "build" | "test" | "package";

function safeRelativePath(value: string): string | null {
  const normalized = String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.includes("\0") ||
    normalized.split("/").some((part) => part === "..")
  )
    return null;
  return normalized;
}

async function getAuthenticatedUser(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user || null;
}

async function findPowerShell() {
  for (const command of ["pwsh", "powershell"]) {
    const result = await run(
      command,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$PSVersionTable.PSVersion.ToString()",
      ],
      process.cwd(),
      8_000,
    );
    if (result.started && result.code === 0) return command;
  }
  return null;
}

function run(command: string, args: string[], cwd: string, timeoutMs = TIMEOUT_MS) {
  return new Promise<{ started: boolean; code: number | null; stdout: string; stderr: string }>(
    (resolveResult) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      const child = spawn(command, args, {
        cwd,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const finish = (value: {
        started: boolean;
        code: number | null;
        stdout: string;
        stderr: string;
      }) => {
        if (settled) return;
        settled = true;
        resolveResult(value);
      };
      const timer = setTimeout(() => {
        try {
          child.kill();
        } catch {
          /* ignored */
        }
        finish({
          started: true,
          code: null,
          stdout,
          stderr: `${stderr}\nExecution timed out after ${timeoutMs}ms.`.trim(),
        });
      }, timeoutMs);
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
        if (stdout.length > 200_000) stdout = stdout.slice(-200_000);
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
        if (stderr.length > 200_000) stderr = stderr.slice(-200_000);
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        finish({ started: false, code: null, stdout, stderr: error.message });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        finish({ started: true, code, stdout, stderr });
      });
    },
  );
}

function scriptFor(task: Task) {
  switch (task) {
    case "diagnose":
      return [
        '$ErrorActionPreference = "Stop"',
        'Write-Output ("PowerShell " + $PSVersionTable.PSVersion.ToString())',
        'Write-Output ("OS: " + [System.Environment]::OSVersion.VersionString)',
        "node --version",
        "npm --version",
      ].join("; ");
    case "build":
      return [
        '$ErrorActionPreference = "Stop"',
        'if (-not (Test-Path package.json)) { Write-Output "No package.json; static project does not require a package build."; exit 0 }',
        "npm install --ignore-scripts --no-audit --no-fund",
        "npm run build --if-present",
      ].join("; ");
    case "test":
      return [
        '$ErrorActionPreference = "Stop"',
        'if (-not (Test-Path package.json)) { Write-Output "No package.json; no automated test command is available."; exit 0 }',
        "npm run test --if-present",
      ].join("; ");
    case "package":
      return [
        '$ErrorActionPreference = "Stop"',
        "if (Test-Path artifact.zip) { Remove-Item artifact.zip -Force }",
        "Compress-Archive -Path * -DestinationPath artifact.zip -Force",
        'Write-Output "artifact.zip created"',
      ].join("; ");
  }
}

export const Route = createFileRoute("/api/public/builder/powershell")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const user = await getAuthenticatedUser(request);
        if (!user)
          return Response.json(
            { error: "Authentication required" },
            { status: 401, headers: CORS },
          );
        const powershell = await findPowerShell();
        return Response.json(
          {
            available: !!powershell,
            executable: powershell,
            capability: "ZYRAXON PowerShell Builder Engine",
          },
          { headers: CORS },
        );
      },
      POST: async ({ request }) => {
        const user = await getAuthenticatedUser(request);
        if (!user)
          return Response.json(
            { error: "Authentication required" },
            { status: 401, headers: CORS },
          );

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
        }
        const task = body?.task as Task;
        if (!["diagnose", "build", "test", "package"].includes(task))
          return Response.json(
            { error: "Unsupported PowerShell task" },
            { status: 400, headers: CORS },
          );

        const files =
          body?.files && typeof body.files === "object"
            ? (body.files as Record<string, unknown>)
            : {};
        const entries = Object.entries(files);
        if (entries.length > MAX_FILES)
          return Response.json(
            { error: `Too many files (maximum ${MAX_FILES})` },
            { status: 413, headers: CORS },
          );

        let total = 0;
        const safeFiles: Array<[string, string]> = [];
        for (const [rawName, rawContent] of entries) {
          const name = safeRelativePath(rawName);
          if (!name || typeof rawContent !== "string")
            return Response.json(
              { error: `Invalid file path: ${rawName}` },
              { status: 400, headers: CORS },
            );
          const bytes = Buffer.byteLength(rawContent, "utf8");
          total += bytes;
          if (bytes > MAX_FILE_BYTES || total > MAX_TOTAL_BYTES)
            return Response.json(
              { error: "Generated project is too large for the execution sandbox" },
              { status: 413, headers: CORS },
            );
          safeFiles.push([name, rawContent]);
        }

        const powershell = await findPowerShell();
        if (!powershell)
          return Response.json(
            {
              error: "PowerShell is not installed on this deployment runner",
              available: false,
              runner: "Configure a Windows/PowerShell-capable runner for full application builds.",
            },
            { status: 503, headers: CORS },
          );

        const workspace = await mkdtemp(join(tmpdir(), "zyraxon-builder-"));
        try {
          for (const [name, content] of safeFiles) {
            const target = resolve(workspace, name);
            if (!(target === workspace || target.startsWith(workspace + sep)))
              return Response.json({ error: "Unsafe file path" }, { status: 400, headers: CORS });
            const parent = target.slice(0, target.length - name.split("/").pop()!.length);
            await import("node:fs/promises").then((fs) => fs.mkdir(parent, { recursive: true }));
            await writeFile(target, content, "utf8");
          }

          const script = scriptFor(task);
          const result = await run(
            powershell,
            ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
            workspace,
          );
          return Response.json(
            {
              ok: result.started && result.code === 0,
              task,
              powershell,
              exitCode: result.code,
              stdout: result.stdout,
              stderr: result.stderr,
              userId: user.id,
            },
            { status: result.started && result.code === 0 ? 200 : 502, headers: CORS },
          );
        } finally {
          await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
        }
      },
    },
  },
});

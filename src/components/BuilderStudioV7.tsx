import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  Activity,
  Bot,
  CheckCircle2,
  Code2,
  Download,
  Eye,
  FileArchive,
  FileText,
  FolderOpen,
  Github,
  Image as ImageIcon,
  Laptop,
  Loader2,
  Mic,
  MoreHorizontal,
  Moon,
  Pencil,
  Plus,
  Send,
  Smartphone,
  Sparkles,
  Sun,
  Tablet,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { createProjectZip, downloadBlob, type BuilderFile } from "@/lib/builder/artifacts";
import "../styles/builder-studio.css";
import "../styles/builder-studio-v7.css";

type Device = "desktop" | "tablet" | "mobile";
type View = "preview" | "code";
type Attachment = { name: string; mime: string; data: string; size: number };
type Msg = {
  role: "user" | "assistant";
  content: string;
  files?: BuilderFile[];
  pdf?: { title: string; content: string };
  attachments?: { name: string; mime: string; size: number }[];
  verification?: { ok: boolean; checks: string[] };
};
type Session = {
  id: string;
  title: string;
  messages: Msg[];
  files: BuilderFile[];
  activeFile: string;
  busy: boolean;
  repo?: unknown | null;
  connected?: boolean;
  updatedAt: number;
};

const MODELS = [
  { id: "zyraxon-t10", name: "ZYRAXON T10", multimodal: true },
  { id: "zyraxon-vector", name: "ZYRAXON VECTOR", multimodal: false },
  { id: "zyraxon-phantom", name: "ZYRAXON PHANTOM", multimodal: false },
];
const ext = (p: string) => {
  const n = p.split("/").pop()?.toLowerCase() || "";
  return n === "dockerfile" ? n : n.split(".").pop() || n;
};
const LANG: Record<string, string> = {
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  js: "javascript",
  mjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  md: "markdown",
  py: "python",
  java: "java",
  go: "go",
  rs: "rust",
  php: "php",
  vue: "html",
  svelte: "html",
  yaml: "yaml",
  yml: "yaml",
  sh: "shell",
};
const ICON: Record<string, string> = {
  html: "html5",
  css: "css3",
  js: "javascript",
  jsx: "react",
  ts: "typescript",
  tsx: "react",
  json: "json",
  md: "markdown",
  py: "python",
  java: "java",
  go: "go",
  rs: "rust",
  php: "php",
  vue: "vuejs",
  svelte: "svelte",
  yaml: "yaml",
  yml: "yaml",
};
function FileIcon({ path }: { path: string }) {
  const k = ext(path);
  const icon = ICON[k];
  return (
    <span className="file-icon-wrap">
      {icon ? (
        <img
          className="file-icon"
          src={`https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${icon}/${icon}-original.svg`}
          width={16}
          height={16}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span className="generic-file-icon">{k.slice(0, 3).toUpperCase()}</span>
      )}
    </span>
  );
}
function safe<T>(key: string, fallback: T): T {
  try {
    const x = localStorage.getItem(key);
    return x ? JSON.parse(x) : fallback;
  } catch {
    return fallback;
  }
}
function starter(): Session {
  return {
    id: crypto.randomUUID(),
    title: "New session",
    messages: [],
    files: [
      {
        path: "index.html",
        content:
          '<!doctype html><html><head><meta charset="utf-8"><title>ZYRAXON</title></head><body><main><h1>Start with an idea.</h1></main></body></html>',
      },
    ],
    activeFile: "index.html",
    busy: false,
    connected: false,
    updatedAt: Date.now(),
  };
}
function normalizeFiles(value: unknown): BuilderFile[] {
  return Array.isArray(value)
    ? value.filter((x: unknown) => x && typeof x.path === "string" && typeof x.content === "string")
    : [];
}
function normalizeSessions(value: unknown): Session[] {
  if (!Array.isArray(value)) return [starter()];
  const out = value.map((s: unknown) => ({
    ...starter(),
    ...s,
    files: normalizeFiles(s?.files),
    messages: Array.isArray(s?.messages) ? s.messages : [],
    busy: false,
    updatedAt: Number(s?.updatedAt) || Date.now(),
  }));
  return out.length ? out : [starter()];
}
function parseBlocks(text: string): BuilderFile[] {
  const out: BuilderFile[] = [];
  const re = /```([^\n]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const info = m[1].trim();
    let body = m[2].replace(/\r\n/g, "\n");
    let path = "";
    const marker = body.match(/^(?:file|filename|path)\s*[:=]\s*(.+)\n/i);
    if (marker) {
      path = marker[1].trim().replace(/^['"`]|['"`]$/g, "");
      body = body.slice(marker[0].length);
    }
    if (!path) {
      const named = info.match(/(?:file|filename|path)\s*[=:]\s*([^\s]+)/i);
      if (named) path = named[1];
    }
    if (!path) {
      const map: Record<string, string> = {
        html: "index.html",
        css: "styles.css",
        javascript: "script.js",
        js: "script.js",
        typescript: "main.ts",
        ts: "main.ts",
        tsx: "App.tsx",
        jsx: "App.jsx",
        json: "package.json",
        python: "main.py",
        py: "main.py",
        java: "Main.java",
      };
      path = map[info.split(/\s+/)[0].toLowerCase()] || "";
    }
    if (path) out.push({ path: path.replace(/^\/+/, ""), content: body });
  }
  const unique: BuilderFile[] = [];
  for (const f of out) {
    const i = unique.findIndex((x) => x.path === f.path);
    if (i >= 0) unique[i] = f;
    else unique.push(f);
  }
  return unique;
}
function buildPreview(files: BuilderFile[]) {
  const htmlFile =
    files.find((f) => /(^|\/)index\.html?$/i.test(f.path)) ||
    files.find((f) => /\.html?$/i.test(f.path));
  let html =
    htmlFile?.content ||
    "<!doctype html><html><body><h1>No HTML entry file yet.</h1></body></html>";
  const css = files
    .filter((f) => /\.(css|scss|sass|less)$/i.test(f.path))
    .map((f) => f.content)
    .join("\n");
  const js = files
    .filter((f) => /\.(js|mjs|cjs)$/i.test(f.path))
    .map((f) => f.content)
    .join("\n");
  html = html
    .replace(/<link[^>]+href=["'][^"']+\.(?:css|scss|sass|less)[^"']*["'][^>]*>/gi, "")
    .replace(/<script[^>]+src=["'][^"']+\.(?:js|mjs|cjs)[^"']*["'][^>]*><\/script>/gi, "");
  if (css)
    html = html.includes("</head>")
      ? html.replace("</head>", `<style data-zyraxon-css>\n${css}\n</style></head>`)
      : `<style>${css}</style>${html}`;
  if (js)
    html = html.includes("</body>")
      ? html.replace("</body>", `<script>\n${js}\n</script></body>`)
      : `${html}<script>${js}</script>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
function verifyProject(files: BuilderFile[]) {
  const checks: string[] = [];
  const html = files.find((f) => /(^|\/)index\.html?$/i.test(f.path));
  const css = files.some((f) => /\.(css|scss|sass|less)$/i.test(f.path));
  const js = files.some((f) => /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(f.path));
  checks.push(html ? "HTML entry present" : "HTML entry missing");
  if (html) checks.push(/<head[\s>]/i.test(html.content) ? "Head present" : "Head missing");
  checks.push(css ? "Styles present" : "No stylesheet found");
  checks.push(js ? "Behavior code present" : "No JS/TS behavior file found");
  const broken = files
    .filter((f) => /\.html?$/i.test(f.path))
    .some(
      (f) =>
        /href=["'][^"']+\.css|src=["'][^"']+\.js/i.test(f.content) &&
        !files.some((x) => f.content.includes(x.path.split("/").pop() || x.path)),
    );
  if (broken) checks.push("Possible broken local asset reference");
  else checks.push("Local asset references look consistent");
  return {
    ok:
      !!html &&
      checks.every(
        (x) =>
          !x.includes("missing") &&
          !x.includes("No stylesheet") &&
          !x.includes("No JS") &&
          !x.includes("Possible broken"),
      ),
    checks,
  };
}
async function fileData(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    if (file.size > 10 * 1024 * 1024)
      return reject(new Error(`${file.name} is larger than 10 MB.`));
    const r = new FileReader();
    r.onload = () =>
      resolve({
        name: file.name,
        mime: file.type || "application/octet-stream",
        data: String(r.result),
        size: file.size,
      });
    r.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    r.readAsDataURL(file);
  });
}

export default function BuilderStudioV7() {
  const [sessions, setSessions] = useState<Session[]>(() =>
    normalizeSessions(safe("zyraxon.builder.sessions.v7", [])),
  );
  const [sid, setSid] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [view, setView] = useState<View>("preview");
  const [device, setDevice] = useState<Device>("desktop");
  const [dark, setDark] = useState(true);
  const [side, setSide] = useState(false);
  const [activity, setActivity] = useState(false);
  const [gh, setGh] = useState(false);
  const [repos, setRepos] = useState<unknown[]>([]);
  const [ghToken, setGhToken] = useState(() => localStorage.getItem("zyraxon.github.token") || "");
  const [ghBusy, setGhBusy] = useState(false);
  const [ghMsg, setGhMsg] = useState("");
  const [pub, setPub] = useState(false);
  const [pubName, setPubName] = useState("");
  const [pubMsg, setPubMsg] = useState("");
  const [pubUrl, setPubUrl] = useState("");
  const [pdf, setPdf] = useState<{ title: string; content: string } | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [deviceList, setDeviceList] = useState<MediaDeviceInfo[]>([]);
  const [audioDevice, setAudioDevice] = useState("");
  const [micOpen, setMicOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const controllers = useRef(new Map<string, AbortController>());
  const media = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const current = sessions.find((s) => s.id === sid) || sessions[0];
  const files = current?.files || [];
  const active = files.find((f) => f.path === current?.activeFile) ||
    files[0] || { path: "index.html", content: "" };
  const messages = current?.messages || [];
  const preview = useMemo(() => buildPreview(files), [files]);
  useEffect(() => {
    if (!sid && sessions[0]) setSid(sessions[0].id);
    localStorage.setItem(
      "zyraxon.builder.sessions.v7",
      JSON.stringify(sessions.map((s) => ({ ...s, busy: false }))),
    );
  }, [sessions, sid]);
  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    },
    [pdfUrl],
  );
  const patch = (id: string, p: Partial<Session>) =>
    setSessions((all) => all.map((s) => (s.id === id ? { ...s, ...p, updatedAt: Date.now() } : s)));
  const updateFiles = (id: string, fn: (x: BuilderFile[]) => BuilderFile[]) =>
    setSessions((all) =>
      all.map((s) => (s.id === id ? { ...s, files: fn(s.files), updatedAt: Date.now() } : s)),
    );
  const addSession = () => {
    const s = starter();
    setSessions((a) => [s, ...a]);
    setSid(s.id);
    setInput("");
    setAttachments([]);
    setView("preview");
    setSide(false);
  };
  const renameSession = (s: Session) => {
    const name = window.prompt("Rename session", s.title)?.trim();
    if (name) patch(s.id, { title: name });
  };
  const deleteSession = (s: Session) => {
    if (sessions.length === 1) return;
    controllers.current.get(s.id)?.abort();
    setSessions((a) => a.filter((x) => x.id !== s.id));
    if (s.id === sid) {
      const next = sessions.find((x) => x.id !== s.id);
      if (next) setSid(next.id);
    }
  };
  const downloadSession = (s: Session) =>
    downloadBlob(
      createProjectZip(s.files),
      `${s.title.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "zyraxon-session"}.zip`,
    );

  async function refreshDevices() {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const list = await navigator.mediaDevices.enumerateDevices();
      setDeviceList(list.filter((d) => d.kind === "audioinput"));
    } catch {
      setDeviceList([]);
    }
  }
  async function mic() {
    setMicOpen(true);
    await refreshDevices();
  }
  async function startRecording() {
    try {
      const constraints: MediaStreamConstraints = {
        audio: audioDevice ? { deviceId: { exact: audioDevice } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      await refreshDevices();
      const recorder = new MediaRecorder(stream);
      media.current = recorder;
      chunks.current = [];
      setListening(true);
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
        try {
          const form = new FormData();
          form.append("file", blob, "recording.webm");
          const r = await fetch("/api/public/stt", { method: "POST", body: form });
          const d = await r.json();
          if (d?.success && d.text) setInput((v) => `${v}${v ? " " : ""}${d.text}`);
          else setGhMsg(d?.error || "Voice transcription failed.");
        } catch {
          setGhMsg("Voice transcription is unavailable right now.");
        } finally {
          setListening(false);
        }
      };
      recorder.start();
      window.setTimeout(() => {
        if (media.current === recorder && recorder.state === "recording") recorder.stop();
      }, 12000);
    } catch {
      setListening(false);
      setGhMsg("Microphone permission was denied or the selected device is unavailable.");
    }
  }
  function stopRecording() {
    try {
      media.current?.stop();
    } catch {
      /* ignored */
    }
    setListening(false);
  }

  async function generate() {
    const text = input.trim();
    if (!text || !current) return;
    const id = current.id;
    const userAttachments = attachments;
    setAttachments([]);
    const next = [
      ...current.messages,
      {
        role: "user" as const,
        content: text,
        attachments: userAttachments.map((a) => ({ name: a.name, mime: a.mime, size: a.size })),
      },
    ];
    patch(id, {
      messages: next,
      busy: true,
      title: current.messages.length ? current.title : text.slice(0, 36),
    });
    setInput("");
    setView("code");
    const controller = new AbortController();
    controllers.current.set(id, controller);
    let full = "";
    try {
      const r = await fetch("/api/public/builder/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          model,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          attachments: userAttachments.map((a) => ({ name: a.name, mime: a.mime, data: a.data })),
        }),
        signal: controller.signal,
      });
      if (!r.ok || !r.body)
        throw new Error((await r.text().catch(() => "")) || "AI connection failed");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const q = await reader.read();
        if (q.done) break;
        buffer += decoder.decode(q.value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const j = JSON.parse(raw);
            const c = j?.choices?.[0]?.delta?.content || j?.content || "";
            if (c) full += c;
          } catch {
            /* ignored */
          }
        }
      }
      const parsed = parseBlocks(full);
      if (parsed.length)
        updateFiles(id, (old) => {
          const n = [...old];
          for (const f of parsed) {
            const i = n.findIndex((x) => x.path === f.path);
            if (i >= 0) n[i] = f;
            else n.push(f);
          }
          return n;
        });
      const tool = /<builder-tool>\s*([\s\S]*?)\s*<\/builder-tool>/i.exec(full);
      let pdfResult: Msg["pdf"];
      if (tool) {
        try {
          const raw = JSON.parse(tool[1]);
          if (raw?.tool === "pdf.create")
            pdfResult = {
              title: String(raw.title || "ZYRAXON PDF"),
              content: String(raw.content || ""),
            };
        } catch {
          /* ignored */
        }
      }
      const finalFiles = parsed.length ? parsed : files;
      const verification = verifyProject(finalFiles);
      const summary = pdfResult
        ? "PDF created and verified."
        : parsed.length
          ? `Generated ${parsed.length} project file${parsed.length === 1 ? "" : "s"} and verified the workspace.`
          : "Task completed. Verification ran against the current workspace.";
      patch(id, {
        messages: [
          ...next,
          { role: "assistant", content: summary, files: parsed, pdf: pdfResult, verification },
        ],
        busy: false,
      });
      setView("preview");
    } catch (e) {
      if ((e as unknown)?.name !== "AbortError")
        patch(id, {
          messages: [
            ...next,
            {
              role: "assistant",
              content: e instanceof Error ? e.message : "The AI connection failed. Please retry.",
            },
          ],
          busy: false,
        });
      else patch(id, { busy: false });
    } finally {
      controllers.current.delete(id);
    }
  }

  async function connectGitHub() {
    const t = ghToken.trim();
    if (!t) return;
    localStorage.setItem("zyraxon.github.token", t);
    setGhBusy(true);
    setGhMsg("Loading repositories…");
    try {
      const r = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
        headers: { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json" },
      });
      if (!r.ok) throw new Error("GitHub token rejected.");
      setRepos(await r.json());
      setGhMsg("Select a repository to import the complete readable project.");
    } catch (e) {
      setGhMsg(e instanceof Error ? e.message : "GitHub connection failed.");
    } finally {
      setGhBusy(false);
    }
  }
  async function importRepo(repo: unknown) {
    if (!current) return;
    setGhBusy(true);
    setGhMsg(`Importing ${repo.full_name}…`);
    try {
      const h = { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json" };
      const ref = repo.default_branch || "main";
      const tr = await fetch(
        `https://api.github.com/repos/${repo.full_name}/git/trees/${ref}?recursive=1`,
        { headers: h },
      );
      if (!tr.ok) throw new Error("Could not read repository tree.");
      const tree = await tr.json();
      const blobs = (tree.tree || []).filter(
        (x: unknown) =>
          x.type === "blob" &&
          Number(x.size || 0) <= 1500000 &&
          !/\.(png|jpe?g|gif|webp|ico|pdf|zip|7z|rar|mp4|mp3|wav|mov|avi|exe|dll|woff2?|ttf|otf|class|jar)$/i.test(
            x.path,
          ),
      );
      const out: BuilderFile[] = [];
      for (let i = 0; i < blobs.length; i += 8) {
        const batch = await Promise.all(
          blobs.slice(i, i + 8).map(async (b: unknown) => {
            try {
              const r = await fetch(
                `https://api.github.com/repos/${repo.full_name}/git/blobs/${b.sha}`,
                { headers: h },
              );
              if (!r.ok) return null;
              const d = await r.json();
              return d.encoding === "base64"
                ? { path: b.path, content: decodeBase64(d.content) }
                : null;
            } catch {
              return null;
            }
          }),
        );
        out.push(...(batch.filter(Boolean) as BuilderFile[]));
      }
      if (!out.length) throw new Error("No readable project files were found.");
      patch(current.id, {
        files: out,
        activeFile: out.find((f) => f.path === "index.html")?.path || out[0].path,
        repo,
        connected: true,
      });
      setView("code");
      setGhMsg(`Connected ${repo.full_name} · ${out.length} readable files`);
      setGh(false);
    } catch (e) {
      setGhMsg(e instanceof Error ? e.message : "Repository import failed.");
    } finally {
      setGhBusy(false);
    }
  }
  async function sync() {
    if (!current?.repo || !ghToken || ghBusy) return;
    setGhBusy(true);
    try {
      const h: unknown = {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      };
      const ref = current.repo.default_branch || "main";
      for (const f of current.files) {
        const p = f.path.replace(/^\/+/, "");
        const url = `https://api.github.com/repos/${current.repo.full_name}/contents/${p}`;
        const old = await fetch(`${url}?ref=${ref}`, { headers: h });
        const body: unknown = {
          message: `chore: sync ${p} from ZYRAXON AI`,
          content: encodeBase64(f.content),
          branch: ref,
        };
        if (old.ok) body.sha = (await old.json()).sha;
        const r = await fetch(url, { method: "PUT", headers: h, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(`Failed to sync ${p}`);
      }
      setGhMsg(`Synced ${current.files.length} files to ${current.repo.full_name}.`);
    } catch (e) {
      setGhMsg(e instanceof Error ? e.message : "GitHub sync failed.");
    } finally {
      setGhBusy(false);
    }
  }
  async function publish() {
    const token = ghToken.trim() || localStorage.getItem("zyraxon.publish.token") || "";
    const name = pubName.trim().replace(/\.git$/, "");
    if (!token || !name) {
      setPubMsg("Connect GitHub first and enter a repository name.");
      return;
    }
    localStorage.setItem("zyraxon.github.token", token);
    setPubMsg("1/4 Validating GitHub token…");
    try {
      const h: unknown = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        "Content-Type": "application/json",
      };
      const me = await fetch("https://api.github.com/user", { headers: h });
      if (!me.ok) throw new Error("GitHub token was rejected or lacks repository permissions.");
      const u = await me.json();
      setPubMsg("2/4 Creating/opening repository…");
      let rr = await fetch(`https://api.github.com/repos/${u.login}/${name}`, { headers: h });
      if (rr.status === 404)
        rr = await fetch("https://api.github.com/user/repos", {
          method: "POST",
          headers: h,
          body: JSON.stringify({ name, private: false, auto_init: true }),
        });
      if (!rr.ok) throw new Error(`Repository create/open failed (${rr.status}).`);
      const repo = await rr.json();
      const ref = repo.default_branch || "main";
      setPubMsg(`3/4 Uploading ${files.length} files…`);
      for (const f of files) {
        const p = f.path.replace(/^\/+/, "");
        const url = `https://api.github.com/repos/${u.login}/${name}/contents/${p}`;
        const old = await fetch(`${url}?ref=${ref}`, { headers: h });
        const body: unknown = {
          message: `feat: publish ${p} from ZYRAXON AI`,
          content: encodeBase64(f.content),
          branch: ref,
        };
        if (old.ok) body.sha = (await old.json()).sha;
        const r = await fetch(url, { method: "PUT", headers: h, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(`Upload failed for ${p} (${r.status}).`);
      }
      setPubMsg("4/4 Enabling GitHub Pages…");
      const pages = await fetch(`https://api.github.com/repos/${u.login}/${name}/pages`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ source: { branch: ref, path: "/" }, build_type: "legacy" }),
      });
      if (!pages.ok && pages.status !== 409)
        throw new Error(
          `GitHub Pages setup failed (${pages.status}). Check Pages/Admin permissions on the token.`,
        );
      const url = `https://${u.login}.github.io/${name}/`;
      setPubUrl(url);
      setPubMsg("Published. GitHub Pages build may take a short time to become live.");
    } catch (e) {
      setPubMsg(e instanceof Error ? e.message : "Publish failed.");
    }
  }
  async function openPdf(p: { title: string; content: string }) {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    const blob = await createAiPdf(p.title, p.content);
    setPdf(p);
    setPdfUrl(URL.createObjectURL(blob));
  }
  async function closePdf() {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl("");
    setPdf(null);
  }
  async function downloadPdf(p: { title: string; content: string }) {
    const blob = await createAiPdf(p.title, p.content);
    downloadBlob(
      blob,
      `${p.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "zyraxon-document"}.pdf`,
    );
  }
  function downloadCurrentZip() {
    downloadBlob(createProjectZip(files), "zyraxon-project.zip");
  }
  function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    void Promise.all(picked.map(fileData))
      .then((a) => setAttachments((x) => [...x, ...a]))
      .catch((err) => setGhMsg(err.message));
    e.target.value = "";
  }

  return (
    <div className={`builder-root ${dark ? "is-dark" : "is-light"}`}>
      <header className="builder-topbar">
        <div className="v7-brand">
          <button className="glass-icon" onClick={() => setSide(true)} title="Open sessions">
            <Plus size={15} />
          </button>
          <a className="builder-brand" href="/">
            ZYRAXON <em>AI BLUDAR</em>
          </a>
        </div>
        <div className="builder-actions">
          <button className="glass-action" onClick={() => setPub(true)}>
            <Upload size={14} /> Publish
          </button>
          <button className="glass-action" onClick={() => setActivity((v) => !v)}>
            <Activity size={14} /> Activity
          </button>
          <button className="glass-action" onClick={() => setGh(true)}>
            <Github size={14} /> GitHub
          </button>
          <button className="glass-icon" onClick={() => setDark((v) => !v)}>
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>
      {side && (
        <>
          <div className="session-backdrop" onClick={() => setSide(false)} />
          <aside className="session-sidebar glass-card v7-sidebar">
            <div className="session-head">
              <b>Sessions</b>
              <button className="glass-icon" onClick={() => setSide(false)}>
                <X size={14} />
              </button>
            </div>
            <button className="new-session-btn" onClick={addSession}>
              <Plus size={15} /> New session
            </button>
            <div className="session-list">
              {sessions.map((s) => (
                <div className={`v7-session ${s.id === current?.id ? "selected" : ""}`} key={s.id}>
                  <button
                    className="session-main"
                    onClick={() => {
                      setSid(s.id);
                      setAttachments([]);
                      setSide(false);
                    }}
                  >
                    <Bot size={14} />
                    <span>
                      {s.title}
                      <small>{s.busy ? "Working now" : `${s.files.length} files`}</small>
                    </span>
                  </button>
                  <details>
                    <summary>
                      <MoreHorizontal size={15} />
                    </summary>
                    <div className="session-menu">
                      <button onClick={() => renameSession(s)}>
                        <Pencil size={13} /> Rename
                      </button>
                      <button onClick={() => downloadSession(s)}>
                        <Download size={13} /> Download ZIP
                      </button>
                      <button onClick={() => deleteSession(s)} disabled={sessions.length === 1}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </aside>
        </>
      )}
      <main className={`builder-main ${messages.length ? "with-workspace" : "chat-only"}`}>
        <section className="chat-pane glass-card">
          <div className="chat-title">
            <span className="eyebrow">
              <Sparkles size={11} /> AI BUILDER
            </span>
            <h1>{messages.length ? "Building with ZYRAXON" : "What are we building?"}</h1>
          </div>
          <div className="chat-history">
            {messages.length === 0 ? (
              <div className="welcome-state">
                <div className="ai-orb">
                  <Bot size={26} />
                </div>
                <h2>Describe your idea</h2>
                <p>Build complete projects, PDFs, websites and apps with a persistent workspace.</p>
                <div className="suggestions">
                  <button
                    onClick={() =>
                      setInput(
                        "Build a complete premium SaaS website with a polished responsive design, styling, interactions and all required files.",
                      )
                    }
                  >
                    <Sparkles size={14} /> AI SaaS
                  </button>
                  <button
                    onClick={() =>
                      setInput(
                        "Build a complete developer portfolio with professional UI, responsive styling and working interactions.",
                      )
                    }
                  >
                    <Code2 size={14} /> Portfolio
                  </button>
                  <button
                    onClick={() =>
                      setInput("Create a complete professional PDF report about this project.")
                    }
                  >
                    <FileText size={14} /> PDF
                  </button>
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <article className={`chat-message ${m.role}`} key={i}>
                  <span>{m.role === "user" ? "YOU" : "ZYRAXON AI"}</span>
                  <p>{m.content}</p>
                  {m.attachments?.length ? (
                    <div className="v7-attachments">
                      {m.attachments.map((a) => (
                        <span key={a.name}>
                          <ImageIcon size={12} />
                          {a.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {m.files?.length ? (
                    <div className="code-card-grid">
                      {m.files.map((f) => (
                        <button
                          key={f.path}
                          className="code-card"
                          onClick={() => {
                            patch(current!.id, { activeFile: f.path });
                            setView("code");
                          }}
                        >
                          <FileIcon path={f.path} />
                          <span>
                            <b>{f.path}</b>
                            <small>
                              {f.content.length.toLocaleString()} chars · Open in editor
                            </small>
                          </span>
                          <Code2 size={13} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {m.pdf ? (
                    <button className="pdf-result" onClick={() => void openPdf(m.pdf!)}>
                      <FileText size={14} />
                      <span>
                        <b>{m.pdf.title}</b>
                        <small>Preview and download PDF</small>
                      </span>
                      <Eye size={14} />
                    </button>
                  ) : null}
                  {m.verification ? (
                    <div className={`v7-verify ${m.verification.ok ? "ok" : "warn"}`}>
                      <CheckCircle2 size={14} />
                      <span>
                        {m.verification.ok ? "Verification passed" : "Verification found issues"} ·{" "}
                        {m.verification.checks.join(" · ")}
                      </span>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
          <div className="composer glass-card">
            {attachments.length > 0 && (
              <div className="v7-draft-files">
                {attachments.map((a) => (
                  <span key={a.name}>
                    <FileText size={12} />
                    {a.name}
                    <button
                      onClick={() => setAttachments((x) => x.filter((y) => y.name !== a.name))}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void generate();
                }
              }}
              placeholder="Describe what you want to build…"
            />
            <div className="composer-row">
              <div className="composer-left">
                <label className="select-pill">
                  <Sparkles size={14} />
                  <select value={model} onChange={(e) => setModel(e.target.value)}>
                    {MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.multimodal ? " · Media" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={`circle-btn ${listening ? "active" : ""}`}
                  onClick={() => (listening ? stopRecording() : void mic())}
                  title="Microphone"
                >
                  <Mic size={16} />
                </button>
                <button
                  className="circle-btn"
                  onClick={() => fileInput.current?.click()}
                  title="Attach image, audio or video"
                >
                  <Upload size={16} />
                </button>
                <input
                  ref={fileInput}
                  hidden
                  type="file"
                  multiple
                  accept="image/*,audio/*,video/*"
                  onChange={addFiles}
                />
              </div>
              <div className="composer-right">
                <button
                  className="circle-btn"
                  onClick={downloadCurrentZip}
                  title="Download project ZIP"
                >
                  <FileArchive size={16} />
                </button>
                <button
                  className="send-btn"
                  disabled={!input.trim() || !!current?.busy}
                  onClick={() => void generate()}
                >
                  {current?.busy ? <Loader2 size={17} className="spin" /> : <Send size={17} />}
                </button>
              </div>
            </div>
          </div>
        </section>
        {messages.length > 0 && (
          <section className="workspace-pane glass-card">
            <div className="workspace-bar">
              <div className="view-switch">
                <button
                  className={view === "preview" ? "selected" : ""}
                  onClick={() => setView("preview")}
                >
                  <Eye size={15} /> Preview
                </button>
                <button
                  className={view === "code" ? "selected" : ""}
                  onClick={() => setView("code")}
                >
                  <Code2 size={15} /> Code
                </button>
              </div>
              <div className="device-switch">
                <button
                  className={device === "desktop" ? "selected" : ""}
                  onClick={() => setDevice("desktop")}
                >
                  <Laptop size={15} />
                </button>
                <button
                  className={device === "tablet" ? "selected" : ""}
                  onClick={() => setDevice("tablet")}
                >
                  <Tablet size={15} />
                </button>
                <button
                  className={device === "mobile" ? "selected" : ""}
                  onClick={() => setDevice("mobile")}
                >
                  <Smartphone size={15} />
                </button>
              </div>
              <span className={current?.connected ? "connection live" : "connection"}>
                <i />
                {current?.repo
                  ? `Connected · ${current.repo.name}`
                  : current?.busy
                    ? "AI working…"
                    : "Ready"}
              </span>
            </div>
            {view === "preview" ? (
              <div className="preview-stage">
                <div className={`preview-device ${device}`}>
                  <iframe
                    title="Generated website preview"
                    sandbox="allow-scripts allow-forms allow-modals"
                    src={preview}
                  />
                </div>
              </div>
            ) : (
              <div className="ide-shell">
                <aside className="file-pane">
                  <div className="pane-title">
                    <span>
                      <FolderOpen size={14} /> Project files
                    </span>
                    <b>{files.length}</b>
                  </div>
                  <div className="file-list">
                    {files.map((f) => (
                      <button
                        key={f.path}
                        className={`file-row ${f.path === active.path ? "selected" : ""}`}
                        onClick={() => patch(current!.id, { activeFile: f.path })}
                      >
                        <FileIcon path={f.path} />
                        <span>{f.path}</span>
                      </button>
                    ))}
                  </div>
                </aside>
                <div className="editor-pane">
                  <div className="editor-top">
                    <span>
                      <FileIcon path={active.path} /> {active.path}
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => void sync()} disabled={!current?.repo || ghBusy}>
                        <Github size={13} /> {ghBusy ? "Syncing" : "Sync"}
                      </button>
                      <button
                        onClick={() =>
                          downloadBlob(
                            new Blob([active.content], { type: "text/plain" }),
                            active.path.split("/").pop() || "file.txt",
                          )
                        }
                      >
                        <Download size={13} /> Download
                      </button>
                    </div>
                  </div>
                  <Editor
                    theme="vs-dark"
                    language={LANG[ext(active.path)] || "plaintext"}
                    value={active.content}
                    onChange={(v) =>
                      updateFiles(current!.id, (old) =>
                        old.map((f) => (f.path === active.path ? { ...f, content: v || "" } : f)),
                      )
                    }
                    options={{
                      automaticLayout: true,
                      minimap: { enabled: false },
                      fontSize: 13,
                      padding: { top: 14 },
                      smoothScrolling: true,
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                    }}
                  />
                </div>
              </div>
            )}
          </section>
        )}
      </main>
      {activity && (
        <div className="activity-pop glass-card">
          <div>
            <b>Activity</b>
            <button className="close-btn" onClick={() => setActivity(false)}>
              <X size={14} />
            </button>
          </div>
          <p>
            {sessions.filter((s) => s.busy).length
              ? `${sessions.filter((s) => s.busy).length} session(s) are running concurrently.`
              : "All sessions idle."}
          </p>
        </div>
      )}
      {gh && (
        <div className="modal-backdrop">
          <div className="publish-modal glass-card">
            <button className="modal-close" onClick={() => setGh(false)}>
              <X size={17} />
            </button>
            <div className="modal-icon">
              <Github size={22} />
            </div>
            <h2>GitHub Project</h2>
            <p>
              Connect with a token, load repositories, then import the complete readable project
              into this workspace. Sync keeps the selected repository connected.
            </p>
            <label>
              Access token
              <input
                type="password"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                placeholder="GitHub access token"
              />
            </label>
            <button
              className="publish-submit"
              disabled={!ghToken || ghBusy}
              onClick={() => void connectGitHub()}
            >
              {ghBusy ? <Loader2 className="spin" size={16} /> : <Github size={16} />} Load
              repositories
            </button>
            {ghMsg && <div className="publish-status">{ghMsg}</div>}
            {repos.length > 0 && (
              <div className="repo-list">
                {repos.map((r) => (
                  <button className="file-row" key={r.id} onClick={() => void importRepo(r)}>
                    <Github size={13} />
                    <span>{r.full_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {pub && (
        <div className="modal-backdrop">
          <div className="publish-modal glass-card">
            <button className="modal-close" onClick={() => setPub(false)}>
              <X size={17} />
            </button>
            <div className="modal-icon">
              <Upload size={22} />
            </div>
            <h2>Publish Website</h2>
            <p>
              Uses the connected GitHub token, creates/opens the repository, uploads the complete
              project, enables Pages and returns the live URL.
            </p>
            <label>
              Repository name
              <input
                value={pubName}
                onChange={(e) => setPubName(e.target.value)}
                placeholder="my-zyraxon-site"
              />
            </label>
            <button
              className="publish-submit"
              disabled={!pubName || !files.length}
              onClick={() => void publish()}
            >
              <Upload size={16} /> Publish website
            </button>
            {pubMsg && <div className="publish-status">{pubMsg}</div>}
            {pubUrl && (
              <a className="published-url" href={pubUrl} target="_blank" rel="noreferrer">
                {pubUrl}
              </a>
            )}
          </div>
        </div>
      )}
      {micOpen && (
        <div className="modal-backdrop">
          <div className="publish-modal glass-card">
            <button
              className="modal-close"
              onClick={() => {
                setMicOpen(false);
                if (listening) stopRecording();
              }}
            >
              <X size={17} />
            </button>
            <div className="modal-icon">
              <Mic size={22} />
            </div>
            <h2>Microphone</h2>
            <p>
              Select the actual input device, including Realtek or another installed microphone.
              Permission is requested only when recording starts.
            </p>
            <label>
              Input device
              <select value={audioDevice} onChange={(e) => setAudioDevice(e.target.value)}>
                <option value="">System default</option>
                {deviceList.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="publish-submit"
              onClick={() => (listening ? stopRecording() : void startRecording())}
            >
              {listening ? (
                <>
                  <Loader2 className="spin" size={16} /> Recording…
                </>
              ) : (
                <>
                  <Mic size={16} /> Start recording
                </>
              )}
            </button>
          </div>
        </div>
      )}
      {pdf && (
        <div className="modal-backdrop">
          <div className="publish-modal glass-card pdf-modal">
            <button className="modal-close" onClick={() => void closePdf()}>
              <X size={17} />
            </button>
            <h2>{pdf.title}</h2>
            <iframe title="PDF preview" src={pdfUrl} />
            <button className="publish-submit" onClick={() => void downloadPdf(pdf)}>
              <Download size={16} /> Download PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let raw = "";
  bytes.forEach((b) => (raw += String.fromCharCode(b)));
  return btoa(raw);
}
function decodeBase64(value: string) {
  const raw = atob(value.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(raw, (c) => c.charCodeAt(0)));
}
async function createAiPdf(title: string, content: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28,
    H = 841.89,
    M = 48;
  const lines = content
    .split(/\r?\n/)
    .flatMap((x) => (x.length > 92 ? x.match(/.{1,92}/g) || [""] : [x]));
  let page = pdf.addPage([W, H]);
  let y = H - M;
  page.drawText(title, { x: M, y, size: 18, font: bold, color: rgb(0.08, 0.08, 0.08) });
  y -= 30;
  for (const line of lines) {
    if (y < M + 18) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
    page.drawText(line.slice(0, 110), { x: M, y, size: 10, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 14;
  }
  return new Blob([await pdf.save()], { type: "application/pdf" });
}

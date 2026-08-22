import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
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
  Settings,
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

type ProviderLite = {
  id: string;
  name: string;
  modelCount: number;
  popular: boolean;
  api: string | null;
  doc?: string | null;
  env?: string[];
};
type CatModel = {
  id: string;
  name: string;
  description?: string;
  multimodal: boolean;
  reasoning: boolean;
  context: number;
  output: number;
  free: boolean;
};
type ModelSelection = { model: string; provider: string };
const splitModel = (value: string): ModelSelection => {
  const i = value.lastIndexOf("@");
  if (i <= 0) return { model: value || "big-pickle", provider: "zyraxon" };
  return { model: value.slice(0, i) || "big-pickle", provider: value.slice(i + 1) || "zyraxon" };
};
const joinModel = (model: string, provider: string) => `${model}@${provider}`;
const FREE_FALLBACK = [{ id: "big-pickle", name: "Big Pickle", multimodal: false }];
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
  cjs: "javascript",
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
  const k = ext(path),
    icon = ICON[k];
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
          '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ZYRAXON</title></head><body><main><h1>Start with an idea.</h1></main></body></html>',
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
    .map((f) => `/* ${f.path} */\n${f.content}`)
    .join("\n");
  const js = files
    .filter((f) => /\.(js|mjs|cjs)$/i.test(f.path))
    .map((f) => `/* ${f.path} */\n${f.content}`)
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
  checks.push(
    broken ? "Possible broken local asset reference" : "Local asset references look consistent",
  );
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
    if (file.size > 15 * 1024 * 1024)
      return reject(new Error(`${file.name} is larger than 15 MB.`));
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
  page.drawText(title.slice(0, 90), {
    x: M,
    y,
    size: 18,
    font: bold,
    color: rgb(0.08, 0.08, 0.08),
  });
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

export default function BuilderStudioV8() {
  const [sessions, setSessions] = useState<Session[]>(() =>
    normalizeSessions(safe("zyraxon.builder.sessions.v8", safe("zyraxon.builder.sessions.v7", []))),
  );
  const [sid, setSid] = useState("");
  const [model, setModel] = useState(joinModel(FREE_FALLBACK[0]!.id, "zyraxon"));
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
  const [notice, setNotice] = useState("");
  const [streamText, setStreamText] = useState("");
  const [streamFiles, setStreamFiles] = useState<BuilderFile[]>([]);
  const [streamTick, setStreamTick] = useState(0);
  const controllers = useRef(new Map<string, AbortController>());
  const media = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [settings, setSettings] = useState(false);
  const [providers, setProviders] = useState<ProviderLite[]>([]);
  const [provQuery, setProvQuery] = useState("");
  const [activeProv, setActiveProv] = useState<ProviderLite | null>(null);
  const [provKey, setProvKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState("");
  const [connected, setConnected] = useState<
    Record<string, { apiKey: string; models: CatModel[] }>
  >(() => safe("zyraxon.builder.providers.v1", {}));
  const [freePool, setFreePool] = useState(FREE_FALLBACK);
  useEffect(() => {
    localStorage.setItem("zyraxon.builder.providers.v1", JSON.stringify(connected));
  }, [connected]);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/public/builder/chat");
        const d = await r.json();
        if (Array.isArray(d?.models) && d.models.length) {
          setFreePool(
            d.models.map((m: unknown) => ({
              id: String(m.id),
              name: String(m.name || m.id),
              multimodal: Boolean(m.multimodal),
            })),
          );
          if (typeof d?.defaultModel === "string")
            setModel((v) =>
              splitModel(v).provider === "zyraxon" ? joinModel(d.defaultModel, "zyraxon") : v,
            );
        }
      } catch {
        /* ignored */
      }
    })();
    (async () => {
      try {
        const r = await fetch("/api/public/providers");
        const d = await r.json();
        if (Array.isArray(d?.providers)) setProviders(d.providers);
      } catch {
        /* ignored */
      }
    })();
  }, []);
  const current = sessions.find((s) => s.id === sid) || sessions[0];
  const baseFiles = current?.files || [];
  const files = current?.busy && streamFiles.length ? streamFiles : baseFiles;
  const active = files.find((f) => f.path === current?.activeFile) ||
    files[0] || { path: "index.html", content: "" };
  const messages = current?.messages || [];
  const preview = useMemo(() => {
    if (streamFiles.length > 0) return buildPreview(streamFiles);
    if (files.length > 0) return buildPreview(files);
    if (streamText && current?.busy) {
      const codeBlocks = [
        ...streamText.matchAll(
          /```(?:html|css|javascript|js|tsx?|jsx?)\s+file:[^\n]*\n([\s\S]*?)```/gi,
        ),
      ];
      if (codeBlocks.length > 0) {
        const code = codeBlocks.map((m) => m[1]).join("\n");
        const html = `<!doctype html><html><head><meta charset="utf-8"><style>
          body{background:#050505;color:#e5e5e5;font-family:Inter,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}
          .loader{display:flex;flex-direction:column;align-items:center;gap:16px}
          .bar{width:200px;height:4px;background:#222;border-radius:4px;overflow:hidden}
          .bar-fill{height:100%;background:linear-gradient(90deg,#b99cff,#65ead8);border-radius:4px;animation:load 1.5s ease-in-out infinite}
          p{color:#888;font-size:13px}
          @keyframes load{0%{width:0}50%{width:100%}100%{width:0}}
        </style></head><body><div class="loader"><div class="bar"><div class="bar-fill"></div></div><p>Building website…</p></div></body></html>`;
        return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
      }
      return `data:text/html;charset=utf-8,${encodeURIComponent("<!doctype html><html><head><meta charset='utf-8'><style>body{background:#050505;color:#888;font-family:Inter,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}p{font-size:13px}</style></head><body><p>Thinking…</p></body></html>")}`;
    }
    return buildPreview(files);
  }, [files, streamFiles, streamText, current?.busy]);
  useEffect(() => {
    if (!sid && sessions[0]) setSid(sessions[0].id);
    localStorage.setItem(
      "zyraxon.builder.sessions.v8",
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
  async function openMic() {
    setMicOpen(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("This browser does not expose microphone access.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      await refreshDevices();
    } catch {
      setNotice(
        "Microphone permission is required. Allow microphone access for this site, then choose the input device.",
      );
    }
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
          form.append("language", "bn");
          const r = await fetch("/api/public/stt", { method: "POST", body: form });
          const d = await r.json();
          if (d?.success && d.text) setInput((v) => `${v}${v ? " " : ""}${d.text}`);
          else setNotice(d?.error || "Voice transcription failed.");
        } catch {
          setNotice("Voice transcription is unavailable right now.");
        } finally {
          setListening(false);
        }
      };
      recorder.start(250);
      window.setTimeout(() => {
        if (media.current === recorder && recorder.state === "recording") recorder.stop();
      }, 20000);
    } catch {
      setListening(false);
      setNotice("Microphone permission was denied or the selected device is unavailable.");
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
    let text = input.trim();
    if (!text || !current) return;
    const id = current.id;
    const userAttachments = attachments;
    setAttachments([]);
    const tokenMatch = /(github_pat_[A-Za-z0-9_]{30,}|gh[pousr]_[A-Za-z0-9]{20,})/.exec(text);
    if (tokenMatch) {
      text = text.replace(tokenMatch[0], "[GITHUB CONNECTED]").trim();
      localStorage.setItem("zyraxon.github.token", tokenMatch[0]);
      setGhToken(tokenMatch[0]);
      setNotice(
        "GitHub connected — I can now create repositories, push files and enable Pages. Just ask!",
      );
    }
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
      const sel = splitModel(model);
      const r = await fetch("/api/public/builder/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          model: sel.model,
          providerId: sel.provider,
          apiKey:
            sel.provider === "zyraxon" || sel.provider === "opencode"
              ? connected["opencode"]?.apiKey || undefined
              : connected[sel.provider]?.apiKey || undefined,
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
            if (c) {
              full += c;
              setStreamText(full);
              // Real-time code parsing: update files as code blocks complete
              const partial = parseBlocks(full);
              if (partial.length) setStreamFiles(partial);
              setStreamTick((t) => t + 1);
            }
          } catch {
            /* ignored */
          }
        }
      }
      // Fix duplicate first token (e.g. "HiHi!" from model)
      if (full.length > 4) {
        const match = full.match(/^([a-zA-Z']+)/);
        if (match && match[1].length < 12) {
          const word = match[1];
          if (full.startsWith(word + word)) full = full.slice(word.length);
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
      setStreamFiles([]);
      const tool = /<builder-tool>\s*([\s\S]*?)\s*<\/builder-tool>/i.exec(full);
      let pdfResult: Msg["pdf"];
      let engineOut: "" | string = "";
      if (tool) {
        try {
          const raw = JSON.parse(tool[1]);
          if (raw?.tool === "pdf.create")
            pdfResult = {
              title: String(raw.title || "ZYRAXON PDF"),
              content: String(raw.content || ""),
            };
          else if (raw?.tool === "powershell" && raw.command)
            engineOut = await runEngineCommand(String(raw.command));
        } catch {
          /* ignored */
        }
      }
      const ghDirectives = [...full.matchAll(/<github-tool>\s*([\s\S]*?)\s*<\/github-tool>/gi)]
        .map((m) => {
          try {
            return JSON.parse(m[1].trim());
          } catch {
            return null;
          }
        })
        .filter(Boolean) as unknown[];
      const webDirectives = [...full.matchAll(/<web-tool>\s*([\s\S]*?)\s*<\/web-tool>/gi)]
        .map((m) => {
          try {
            return JSON.parse(m[1].trim());
          } catch {
            return null;
          }
        })
        .filter(Boolean) as unknown[];
      const extras: Msg[] = [];
      if (engineOut)
        extras.push({ role: "assistant", content: `🖥 PowerShell Engine\n${engineOut}` });
      for (const w of webDirectives) {
        try {
          const out = await runWebTool(String(w.action || ""), w);
          extras.push({ role: "assistant", content: `🌐 ${String(w.action || "web")} → ${out}` });
        } catch (e) {
          extras.push({
            role: "assistant",
            content: `🌐 web action failed → ${e instanceof Error ? e.message : "unexpected error"}`,
          });
        }
      }
      for (const d of ghDirectives) {
        try {
          const out = await runGithubTool(String(d.action || ""), d);
          extras.push({
            role: "assistant",
            content: `⚙ GitHub · ${String(d.action || "action")} → ${out}`,
          });
        } catch (e) {
          extras.push({
            role: "assistant",
            content: `⚙ GitHub · ${String(d.action || "action")} failed → ${e instanceof Error ? e.message : "unexpected error"}`,
          });
        }
      }
      const latest = sessions.find((s) => s.id === id);
      const merged = parsed.reduce(
        (arr, f) => {
          const i = arr.findIndex((x) => x.path === f.path);
          if (i >= 0) arr[i] = f;
          else arr.push(f);
          return arr;
        },
        [...(latest?.files || [])],
      );
      const verification = parsed.length ? verifyProject(merged) : [];
      const summary = pdfResult
        ? full || "PDF created."
        : full.slice(0, 500) || "No response received.";
      patch(id, {
        messages: [
          ...next,
          { role: "assistant", content: summary, files: parsed, pdf: pdfResult, verification },
          ...extras,
        ],
        busy: false,
      });
      setView("preview");
      // Auto-retry: ONLY when user asked to build something AND AI didn't produce code.
      if (!parsed.length && !pdfResult && full.length > 20) {
        const hasCodeIntent = /build|create|make|design|page|site|app|landing|screenshot|pdf/i.test(
          text,
        );
        const hasTools = /<builder-tool>|<github-tool>|<web-tool>/i.test(full);
        if (hasCodeIntent || hasTools) {
          const retryNext = [
            ...next,
            { role: "assistant" as const, content: summary },
            {
              role: "user" as const,
              content:
                "Stop talking. Stop using tools. JUST output the code in fenced blocks NOW. Start with ```html file:index.html",
            },
          ];
          patch(id, { messages: retryNext, busy: true });
          try {
            const r2 = await fetch("/api/public/builder/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
              body: JSON.stringify({
                model: sel.model,
                providerId: sel.provider,
                apiKey:
                  sel.provider === "zyraxon" || sel.provider === "opencode"
                    ? connected["opencode"]?.apiKey || undefined
                    : connected[sel.provider]?.apiKey || undefined,
                messages: retryNext.map((m) => ({ role: m.role, content: m.content })),
              }),
              signal: controller.signal,
            });
            if (r2.ok && r2.body) {
              const reader2 = r2.body.getReader();
              const dec2 = new TextDecoder();
              let buf2 = "";
              let full2 = "";
              while (true) {
                const q2 = await reader2.read();
                if (q2.done) break;
                buf2 += dec2.decode(q2.value, { stream: true });
                const lines2 = buf2.split(/\r?\n/);
                buf2 = lines2.pop() || "";
                for (const line2 of lines2) {
                  if (!line2.startsWith("data:")) continue;
                  const raw2 = line2.slice(5).trim();
                  if (!raw2 || raw2 === "[DONE]") continue;
                  try {
                    const j2 = JSON.parse(raw2);
                    const c2 = j2?.choices?.[0]?.delta?.content || j2?.content || "";
                    if (c2) full2 += c2;
                  } catch {
                    /* ignored */
                  }
                }
              }
              const parsed2 = parseBlocks(full2);
              if (parsed2.length) {
                updateFiles(id, (old) => {
                  const n = [...old];
                  for (const f of parsed2) {
                    const i = n.findIndex((x) => x.path === f.path);
                    if (i >= 0) n[i] = f;
                    else n.push(f);
                  }
                  return n;
                });
                const merged2 = parsed2.reduce(
                  (arr, f) => {
                    const i = arr.findIndex((x) => x.path === f.path);
                    if (i >= 0) arr[i] = f;
                    else arr.push(f);
                    return arr;
                  },
                  [...(sessions.find((s) => s.id === id)?.files || [])],
                );
                const ver2 = verifyProject(merged2);
                patch(id, {
                  messages: [
                    ...retryNext,
                    {
                      role: "assistant",
                      content: `Generated ${parsed2.length} project file${parsed2.length === 1 ? "" : "s"} and verified the workspace.`,
                      files: parsed2,
                      verification: ver2,
                    },
                  ],
                  busy: false,
                });
                setView("preview");
              }
            }
          } catch {
            /* retry failed — keep first response */
          }
        }
      }
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
        headers: {
          Authorization: `Bearer ${t}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!r.ok) throw new Error(`GitHub token rejected (${r.status}).`);
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
      const h = {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };
      const ref = repo.default_branch || "main";
      const tr = await fetch(
        `https://api.github.com/repos/${repo.full_name}/git/trees/${ref}?recursive=1`,
        { headers: h },
      );
      if (!tr.ok) throw new Error(`Could not read repository tree (${tr.status}).`);
      const tree = await tr.json();
      if (tree.truncated)
        throw new Error("This repository is too large for a single Git tree request.");
      const blobs = (tree.tree || []).filter(
        (x: unknown) =>
          x.type === "blob" &&
          Number(x.size || 0) <= 1500000 &&
          !/\.(exe|dll|so|dylib|class|jar|zip|7z|rar)$/i.test(x.path),
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
        "X-GitHub-Api-Version": "2022-11-28",
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
        if (!r.ok) throw new Error(`Failed to sync ${p} (${r.status}).`);
      }
      setGhMsg(`Synced ${current.files.length} files to ${current.repo.full_name}.`);
      patch(current.id, { connected: true });
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
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      };
      const me = await fetch("https://api.github.com/user", { headers: h });
      if (!me.ok) throw new Error(`GitHub token was rejected (${me.status}).`);
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
        throw new Error(`GitHub Pages setup failed (${pages.status}).`);
      const url = `https://${u.login}.github.io/${name}/`;
      setPubUrl(url);
      setPubMsg("Published. GitHub Pages build may take a short time to become live.");
      patch(current.id, { repo, connected: true });
    } catch (e) {
      setPubMsg(e instanceof Error ? e.message : "Publish failed.");
    }
  }
  async function openPdf(p: { title: string; content: string }) {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdf(p);
    setPdfUrl(URL.createObjectURL(await createAiPdf(p.title, p.content)));
  }
  async function closePdf() {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl("");
    setPdf(null);
  }
  async function downloadPdf(p: { title: string; content: string }) {
    downloadBlob(
      await createAiPdf(p.title, p.content),
      `${p.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "zyraxon-document"}.pdf`,
    );
  }
  function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    void Promise.all(picked.map(fileData))
      .then((a) => setAttachments((x) => [...x, ...a]))
      .catch((err) => setNotice(err.message));
    e.target.value = "";
  }
  const modelGroups = useMemo(() => {
    const groups: { label: string; opts: { id: string; label: string }[] }[] = [];
    if (freePool.length)
      groups.push({
        label: `FREE · OpenCode Zen (${freePool.length})`,
        opts: freePool.map((m) => ({
          id: joinModel(m.id, "zyraxon"),
          label: m.name + (m.multimodal ? " · Media" : ""),
        })),
      });
    for (const p of providers) {
      const c = connected[p.id];
      if (c?.models?.length)
        groups.push({
          label: p.name,
          opts: c.models.slice(0, 300).map((m) => ({
            id: joinModel(m.id, p.id),
            label: m.name + (m.multimodal ? " · Media" : "") + (m.free ? " · FREE" : ""),
          })),
        });
    }
    return groups;
  }, [freePool, providers, connected]);
  const selectedLabel =
    modelGroups.find((g) => g.opts.some((o) => o.id === model))?.opts.find((o) => o.id === model)
      ?.label || splitModel(model).model;
  async function loadProviderModels(p: ProviderLite) {
    setConnecting(true);
    setConnectMsg(`Loading ${p.name} models…`);
    try {
      const t0 = Date.now();
      const key = provKey.trim();
      const r = await fetch(`/api/public/providers/${encodeURIComponent(p.id)}`, {
        method: "POST",
        headers: key ? { "Content-Type": "application/json" } : undefined,
        body: key ? JSON.stringify({ apiKey: key }) : undefined,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `Failed (${r.status})`);
      const models: CatModel[] = Array.isArray(d.models) ? d.models : [];
      setConnected((x) => ({ ...x, [p.id]: { apiKey: key || x[p.id]?.apiKey || "", models } }));
      await new Promise((z) => setTimeout(z, Math.max(0, 700 - (Date.now() - t0))));
      setConnectMsg(
        `${models.length} models loaded${key ? " · key saved in your browser only" : ""}`,
      );
    } catch (e) {
      setConnectMsg(e instanceof Error ? e.message : "Could not load models");
    } finally {
      setConnecting(false);
    }
  }
  function openProvider(p: ProviderLite) {
    setActiveProv(p);
    setProvKey(connected[p.id]?.apiKey || "");
    setConnectMsg("");
  }
  function disconnectProvider(id: string) {
    setConnected((x) => {
      const n = { ...x };
      delete n[id];
      return n;
    });
    if (splitModel(model).provider === id)
      setModel(joinModel(freePool[0]?.id || "big-pickle", "zyraxon"));
  }
  const filteredProviders = useMemo(() => {
    const q = provQuery.trim().toLowerCase();
    return q
      ? providers.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
      : providers;
  }, [providers, provQuery]);
  const connectedCount = Object.keys(connected).length;
  async function ghLogin(t: string) {
    const r = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json" },
    });
    if (!r.ok) throw new Error(`GitHub token rejected (${r.status})`);
    return (await r.json()).login as string;
  }
  async function runGithubTool(action: string, payload: unknown): Promise<string> {
    const t = ghToken.trim() || localStorage.getItem("zyraxon.github.token") || "";
    if (!t)
      return "No GitHub token connected yet. Paste a token (ghp_… or github_pat_…) in this chat and I will connect automatically.";
    const H = {
      Authorization: `Bearer ${t}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
    const gf = (u: string, o: unknown = {}) =>
      fetch(u, { ...o, headers: { ...H, ...(o.headers || {}) } });
    const act = String(action || "").toLowerCase();
    if (act === "status") {
      const login = await ghLogin(t);
      return `Connected as ${login}. Ready to create repos, push files and enable Pages.`;
    }
    if (act === "list_repos") {
      const r = await gf("https://api.github.com/user/repos?per_page=30&sort=updated");
      if (!r.ok) throw new Error(`List failed (${r.status})`);
      const list = await r.json();
      setRepos(list);
      return `Your latest repositories:\n${list.map((x: unknown) => `• ${x.full_name}${x.private ? " (private)" : ""}`).join("\n")}`;
    }
    const name = String(payload?.name || payload?.repo || current?.repo?.name || "")
      .trim()
      .replace(/\.git$/, "");
    if (!name && ["create_repo", "push_files", "enable_pages"].includes(act))
      return "Repository name required.";
    const login = await ghLogin(t);
    const fullName = name.includes("/") ? name : `${login}/${name}`;
    if (act === "create_repo") {
      let r = await gf(`https://api.github.com/repos/${fullName}`);
      if (r.status === 404) {
        r = await gf("https://api.github.com/user/repos", {
          method: "POST",
          body: JSON.stringify({
            name,
            private: payload.private === true,
            auto_init: true,
            description: String(payload.description || "Built with ZYRAXON AI Bludar").slice(
              0,
              200,
            ),
          }),
        });
        if (!r.ok && !(r.status === 422)) throw new Error(`Create failed (${r.status})`);
      }
      return `Repository ${fullName} is ready.`;
    }
    if (act === "push_files") {
      let r = await gf(`https://api.github.com/repos/${fullName}`);
      if (r.status === 404) {
        const c = await gf("https://api.github.com/user/repos", {
          method: "POST",
          body: JSON.stringify({ name, private: false, auto_init: true }),
        });
        if (!c.ok && c.status !== 422) throw new Error(`Repo create failed (${c.status})`);
        r = await gf(`https://api.github.com/repos/${fullName}`);
      }
      if (!r.ok) throw new Error(`Repo unavailable (${r.status})`);
      const repoMeta = await r.json();
      const ref = repoMeta.default_branch || "main";
      const fs = payload.files?.length ? payload.files : current?.files || [];
      let done = 0;
      for (const f of fs) {
        const p = String(f.path || "").replace(/^\/+/, "");
        if (!p) continue;
        const url = `https://api.github.com/repos/${fullName}/contents/${encodeURIComponent(p).replace(/%2F/g, "/")}`;
        const old = await gf(`${url}?ref=${ref}`);
        const body: unknown = {
          message: `feat: ${p} via ZYRAXON AI`,
          content: btoa(String(f.content)),
          branch: ref,
        };
        if (old.ok) body.sha = (await old.json()).sha;
        const up = await gf(url, { method: "PUT", body: JSON.stringify(body) });
        if (up.ok) done++;
        else throw new Error(`Upload failed for ${p} (${up.status})`);
      }
      patch(current!.id, { repo: repoMeta, connected: true });
      return `Pushed ${done} file${done === 1 ? "" : "s"} to ${fullName}.`;
    }
    if (act === "enable_pages" || act === "pages") {
      const pr = await gf(`https://api.github.com/repos/${fullName}`);
      if (!pr.ok) throw new Error(`Repo unavailable (${pr.status})`);
      const meta = await pr.json();
      const ref = meta.default_branch || "main";
      let hasCode = false;
      for (const f of current?.files || []) {
        if (/(^|\/)index\.html?$/i.test(f.path)) {
          hasCode = true;
          break;
        }
      }
      if (!hasCode) return "Add an index.html first, then ask me to publish.";
      const pages = await gf(`https://api.github.com/repos/${fullName}/pages`, {
        method: "POST",
        body: JSON.stringify({ source: { branch: ref, path: "/" }, build_type: "legacy" }),
      });
      if (pages.ok || pages.status === 409) {
        const url = `https://${login}.github.io/${name}/`;
        return `Live at ${url} (Pages may take ~1 minute on first build).`;
      }
      throw new Error(`Pages setup failed (${pages.status})`);
    }
    if (act === "sync") {
      if (!current?.repo)
        return "No repository connected to this session yet. Ask me to push_files to a repo first.";
      try {
        await sync();
      } catch {
        return "Sync failed.";
      }
      return "Workspace synced to GitHub.";
    }
    return `Unknown GitHub action "${action}". Available: status, list_repos, create_repo, push_files, enable_pages.`;
  }
  async function runEngineCommand(command: string) {
    const r = await fetch("/api/public/builder/engine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: String(command || "").slice(0, 2000) }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok)
      return String(d?.error || `Engine error (${r.status})`) + " " + String(d?.setup || "");
    const out = [d.stdout, d.stderr].filter(Boolean).join("\n").trim();
    return `$ ${command}\n${out.slice(0, 1800) || `(finished with exit code ${d.exitCode ?? 0})`}`;
  }
  async function runWebTool(action: string, payload: unknown): Promise<string> {
    const act = String(action || "").toLowerCase();
    if (act === "search" || act === "web_search") {
      const q = String(payload?.query || payload?.q || "").trim();
      if (!q) return "Search query required.";
      const r = await fetch(`/api/public/builder/search?q=${encodeURIComponent(q)}`);
      const d = await r.json().catch(() => null);
      if (!r.ok) return String(d?.error || `Search failed (${r.status})`);
      const results: unknown[] = (d as unknown)?.results || [];
      if (!results.length) return `No results for "${q}".`;
      return `Web results for "${q}":\n${results
        .slice(0, 8)
        .map(
          (x, i) =>
            `${i + 1}. ${x.title}\n   ${x.url}${x.snippet ? `\n   ${String(x.snippet).slice(0, 180)}` : ""}`,
        )
        .join("\n")}`;
    }
    if (act === "open_url" || act === "read_url" || act === "fetch") {
      const url = String(payload?.url || "").trim();
      if (!url) return "URL required.";
      const r = await fetch("/api/public/builder/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) return String(d?.error || `URL read failed (${r.status})`);
      return `Content of ${url}:\n${String((d as unknown)?.content || "").slice(0, 3000)}`;
    }
    return `Unknown web action "${action}". Available: search, open_url.`;
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
            <div className="v8-side-head">
              <span className="v8-side-logo">
                <Sparkles size={15} />
              </span>
              <div>
                <b>ZYRAXON AI BLUDAR</b>
                <small>
                  {sessions.length} session{sessions.length > 1 ? "s" : ""} · {connectedCount}{" "}
                  provider{connectedCount !== 1 ? "s" : ""}
                </small>
              </div>
              <button className="glass-icon" onClick={() => setSide(false)} title="Close">
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
                      setStreamText("");
                      setStreamFiles([]);
                      setStreamTick(0);
                      setSide(false);
                    }}
                  >
                    {s.busy ? <Loader2 size={14} className="spin" /> : <Bot size={14} />}
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
            <div className="v8-side-foot">
              <button
                className="v8-settings-btn"
                onClick={() => {
                  setSettings(true);
                }}
              >
                <span className="v8-set-row">
                  <Settings size={15} /> Models &amp; Providers
                </span>
                <small>Connect API keys · 190+ providers</small>
              </button>
              <a className="v8-home-link" href="/" target="_top">
                ← Back to zyraxon.ai
              </a>
            </div>
          </aside>
        </>
      )}
      <main className={`builder-main ${messages.length ? "with-workspace" : "chat-only"}`}>
        <Group orientation="horizontal" className="v8-panels">
          <Panel defaultSize={42} minSize={22} className="v8-pane">
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
                    <p>
                      Build complete projects, PDFs, websites and apps with a persistent workspace.
                    </p>
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
                  messages
                    .filter((m) => !/Stop talking\. Stop using tools/i.test(m.content))
                    .map((m, i) => {
                      const displayText =
                        m.role === "assistant"
                          ? m.content
                              .replace(/```[\s\S]*?```/g, "")
                              .replace(/```[\s\S]*$/g, "")
                              .replace(/<[-a-z]+-tool>[\s\S]*?<\/[-a-z]+-tool>/gi, "")
                              .trim()
                          : m.content;
                      return (
                        <article className={`chat-message ${m.role}`} key={i}>
                          <span>{m.role === "user" ? "YOU" : "ZYRAXON AI"}</span>
                          {displayText ? <p>{displayText}</p> : null}
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
                        </article>
                      );
                    })
                )}
                {current?.busy && streamText ? (
                  <article className="chat-message assistant streaming-msg">
                    <span>ZYRAXON AI</span>
                    <p>
                      {streamText
                        .replace(/```[\s\S]*?```/g, "")
                        .replace(/```[\s\S]*$/g, "")
                        .replace(/<[-a-z]+-tool>[\s\S]*?<\/[-a-z]+-tool>/gi, "")
                        .trim() || "Thinking…"}
                    </p>
                  </article>
                ) : null}
              </div>
              <div className="composer glass-card">
                {attachments.length > 0 && (
                  <div className="v7-draft-files">
                    {attachments.map((a) => (
                      <span key={`${a.name}-${a.size}`}>
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
                      <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        aria-label="AI model"
                      >
                        {modelGroups.map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.opts.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <button
                      className={`circle-btn ${listening ? "active" : ""}`}
                      onClick={() => (listening ? stopRecording() : void openMic())}
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
                      onClick={() => downloadBlob(createProjectZip(files), "zyraxon-project.zip")}
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
          </Panel>
          {messages.length > 0 && (
            <>
              <Separator className="v8-handle" />
              <Panel defaultSize={58} minSize={24} className="v8-pane">
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
                          options={{
                            readOnly: !!current?.busy,
                            automaticLayout: true,
                            minimap: { enabled: false },
                            fontSize: 13,
                            padding: { top: 14 },
                            smoothScrolling: true,
                            scrollBeyondLastLine: false,
                            wordWrap: "on",
                          }}
                          onChange={(v) =>
                            updateFiles(current!.id, (old) =>
                              old.map((f) =>
                                f.path === active.path ? { ...f, content: v || "" } : f,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  )}
                </section>
              </Panel>
            </>
          )}
        </Group>
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
      {notice && (
        <div className="activity-pop glass-card">
          <div>
            <b>Notice</b>
            <button className="close-btn" onClick={() => setNotice("")}>
              <X size={14} />
            </button>
          </div>
          <p>{notice}</p>
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
              into this workspace. The selected repository remains connected for Sync.
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
              Uses the saved GitHub token, creates/opens the repository, uploads the complete
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
      {settings && (
        <div className="modal-backdrop">
          <div className="publish-modal glass-card providers-modal">
            <button
              className="modal-close"
              onClick={() => {
                setSettings(false);
                setActiveProv(null);
                setConnectMsg("");
              }}
            >
              <X size={17} />
            </button>
            {!activeProv ? (
              <>
                <div className="modal-icon">
                  <Settings size={22} />
                </div>
                <h2>Models & Providers</h2>
                <p>
                  Connect any of the world's AI providers with your own API key — its full model
                  catalog loads in seconds. Keys live only in your browser and are forwarded per
                  request, never stored on our servers.
                </p>
                <input
                  className="prov-search"
                  value={provQuery}
                  onChange={(e) => setProvQuery(e.target.value)}
                  placeholder={`Search ${providers.length || "…"} providers…`}
                />
                <div className="prov-list">
                  {!provQuery && filteredProviders.some((p) => p.popular) && (
                    <small className="prov-group">★ Popular</small>
                  )}
                  {filteredProviders
                    .filter((p) => !provQuery && p.popular)
                    .map((p) => (
                      <button
                        className={`prov-item ${activeProv?.id === p.id ? "selected" : ""}`}
                        key={p.id}
                        onClick={() => openProvider(p)}
                      >
                        <span className="prov-name">{p.name}</span>
                        <span className="prov-meta">
                          {connected[p.id] ? "✓ connected" : `${p.modelCount} models`}
                        </span>
                      </button>
                    ))}
                  {filteredProviders.some((p) => !p.popular) && (
                    <small className="prov-group">{provQuery ? "Results" : "All providers"}</small>
                  )}
                  {filteredProviders
                    .filter((p) => (provQuery ? !0 : !p.popular))
                    .map((p) => (
                      <button
                        className={`prov-item ${activeProv?.id === p.id ? "selected" : ""}`}
                        key={p.id}
                        onClick={() => openProvider(p)}
                      >
                        <span className="prov-name">{p.name}</span>
                        <span className="prov-meta">
                          {connected[p.id] ? "✓ connected" : `${p.modelCount} models`}
                        </span>
                      </button>
                    ))}
                  {!filteredProviders.length && (
                    <div className="publish-status">No provider matches “{provQuery}”.</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  className="prov-back"
                  onClick={() => {
                    setActiveProv(null);
                    setConnectMsg("");
                  }}
                >
                  ← All providers
                </button>
                <div className="prov-head">
                  <b>{activeProv.name}</b>
                  <span className="prov-meta">
                    {connected[activeProv.id]?.models.length
                      ? `${connected[activeProv.id].models.length} models loaded`
                      : activeProv.modelCount + " models available"}
                  </span>
                </div>
                {activeProv.doc && (
                  <a className="prov-doc" href={activeProv.doc} target="_blank" rel="noreferrer">
                    Get an API key ↗
                  </a>
                )}
                <label>
                  {(activeProv.env?.[0] || "API") + " key"}
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={provKey}
                    onChange={(e) => setProvKey(e.target.value)}
                    placeholder="Paste your API key (stays in your browser)"
                  />
                </label>
                <div className="prov-connect-row">
                  <button
                    className="publish-submit"
                    disabled={connecting}
                    onClick={() => void loadProviderModels(activeProv)}
                  >
                    {connecting ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}{" "}
                    Load models
                  </button>
                  {connected[activeProv.id] && (
                    <button
                      className="prov-disconnect"
                      onClick={() => disconnectProvider(activeProv.id)}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
                {connectMsg && <div className="publish-status">{connectMsg}</div>}
                {!!connected[activeProv.id]?.models.length && (
                  <div className="prov-models">
                    {connected[activeProv.id].models.slice(0, 240).map((m) => (
                      <span
                        className={`prov-chip ${m.free ? "free" : ""} ${joinModel(m.id, activeProv.id) === model ? "selected" : ""}`}
                        key={m.id}
                        title={m.description || ""}
                        onClick={() => {
                          setModel(joinModel(m.id, activeProv.id));
                          setSettings(false);
                        }}
                      >
                        {m.name}
                        {joinModel(m.id, activeProv.id) === model ? " ✓" : ""}
                      </span>
                    ))}
                  </div>
                )}
              </>
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

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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

type Device = "desktop" | "tablet" | "mobile";
type Attachment = { name: string; mime: string; data: string; size: number };
type Msg = {
  role: "user" | "assistant";
  content: string;
  files?: BuilderFile[];
  pdf?: { title: string; content: string };
  attachments?: { name: string; mime: string; size: number }[];
  checks?: string[];
};
type Repo = {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
};
type Session = {
  id: string;
  title: string;
  messages: Msg[];
  files: BuilderFile[];
  activeFile: string;
  busy: boolean;
  repo?: Repo | null;
  updatedAt: number;
};

const MODELS = [
  {
    id: "zyraxon-t10",
    name: "ZYRAXON T10",
    upstream: "mimo-v2.5-free",
    context: 1000000,
    output: 131072,
    multimodal: true,
  },
  {
    id: "zyraxon-vector",
    name: "ZYRAXON VECTOR",
    upstream: "big-pickle",
    context: 200000,
    output: 32768,
    multimodal: false,
  },
  {
    id: "zyraxon-phantom",
    name: "ZYRAXON PHANTOM",
    upstream: "nemotron-3-ultra-free",
    context: 200000,
    output: 131072,
    multimodal: false,
  },
] as const;
const ext = (p: string) => p.split("/").pop()?.toLowerCase().split(".").pop() || "file";
const LANG: Record<string, string> = {
  html: "html",
  htm: "html",
  css: "css",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  jsx: "javascript",
  json: "json",
  md: "markdown",
  py: "python",
  java: "java",
  go: "go",
  rs: "rust",
  php: "php",
  yaml: "yaml",
  yml: "yaml",
  sh: "shell",
};
function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function starter(): Session {
  return {
    id: makeId(),
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
    updatedAt: Date.now(),
  };
}
function readSessions(): Session[] {
  try {
    const raw = localStorage.getItem("zyraxon.builder.sessions.v9");
    if (!raw) return [starter()];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return [starter()];
    return parsed.map((s: unknown) => ({
      ...starter(),
      ...s,
      files: Array.isArray(s.files)
        ? s.files.filter(
            (f: unknown) => f && typeof f.path === "string" && typeof f.content === "string",
          )
        : [],
      messages: Array.isArray(s.messages) ? s.messages : [],
      busy: false,
    }));
  } catch {
    return [starter()];
  }
}
function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let raw = "";
  for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw);
}
function decodeBase64(value: string) {
  const raw = atob(value.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(raw, (c) => c.charCodeAt(0)));
}
function parseGeneratedFiles(text: string): BuilderFile[] {
  const out: BuilderFile[] = [];
  const fenced = /```([^\n]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fenced.exec(text))) {
    const info = m[1].trim();
    let body = m[2].replace(/\r\n/g, "\n");
    let path = "";
    const first = body.match(/^(?:file|filename|path)\s*[:=]\s*([^\n]+)\n/i);
    if (first) {
      path = first[1].trim().replace(/^['"`]|['"`]$/g, "");
      body = body.slice(first[0].length);
    }
    const named = info.match(/(?:file|filename|path)\s*[=:]\s*([^\s]+)/i);
    if (!path && named) path = named[1];
    if (!path) {
      const lang = info.split(/\s+/)[0].toLowerCase();
      const defaults: Record<string, string> = {
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
      path = defaults[lang] || "";
    }
    if (path) out.push({ path: path.replace(/^\/+/, ""), content: body });
  }
  const tagged = /<file\s+path=["']([^"']+)["'][^>]*>([\s\S]*?)<\/file>/gi;
  while ((m = tagged.exec(text)))
    out.push({ path: m[1].trim().replace(/^\/+/, ""), content: m[2].replace(/^\n|\n$/g, "") });
  const unique: BuilderFile[] = [];
  for (const f of out) {
    const i = unique.findIndex((x) => x.path === f.path);
    if (i >= 0) unique[i] = f;
    else unique.push(f);
  }
  return unique;
}
function composePreview(files: BuilderFile[]) {
  let html =
    files.find((f) => /^index\.html?$/i.test(f.path))?.content ||
    files.find((f) => /\.html?$/i.test(f.path))?.content ||
    "<html><body><h1>No HTML entry file</h1></body></html>";
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
  return html;
}
function verify(files: BuilderFile[]) {
  const checks: string[] = [];
  const html = files.find((f) => /^index\.html?$/i.test(f.path));
  checks.push(html ? "HTML entry present" : "HTML entry missing");
  checks.push(html && /<head[\s>]/i.test(html.content) ? "Head present" : "Head missing");
  checks.push(
    files.some((f) => /\.(css|scss|sass|less)$/i.test(f.path))
      ? "Styles present"
      : "No stylesheet file",
  );
  checks.push(
    files.some((f) => /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(f.path))
      ? "Behavior file present"
      : "No behavior file",
  );
  const refs = files
    .filter((f) => /\.html?$/i.test(f.path))
    .flatMap((f) => [...f.content.matchAll(/(?:href|src)=["']([^"']+)["']/gi)].map((x) => x[1]));
  const local = refs.filter((x) => !/^https?:|^data:|^#|^mailto:/i.test(x));
  const missing = local.filter((x) => !files.some((f) => f.path === x || f.path.endsWith("/" + x)));
  checks.push(missing.length ? "Broken local references found" : "Local references checked");
  return {
    ok: checks.every(
      (x) =>
        !x.includes("missing") &&
        !x.includes("No stylesheet") &&
        !x.includes("No behavior") &&
        !x.includes("Broken"),
    ),
    checks,
  };
}
async function makePdf(title: string, content: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595,
    H = 842,
    M = 48;
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
  for (const raw of content.split(/\r?\n/)) {
    const lines = raw.length > 92 ? raw.match(/.{1,92}/g) || [""] : [raw];
    for (const line of lines) {
      if (y < M + 18) {
        page = pdf.addPage([W, H]);
        y = H - M;
      }
      page.drawText(line.slice(0, 100), { x: M, y, size: 10, font, color: rgb(0.15, 0.15, 0.15) });
      y -= 14;
    }
  }
  return new Blob([await pdf.save()], { type: "application/pdf" });
}
function fileIcon(path: string) {
  const e = ext(path);
  return e === "html"
    ? "▣"
    : e === "css"
      ? "◆"
      : e === "js" || e === "ts"
        ? "JS"
        : e === "json"
          ? "{}"
          : e.toUpperCase().slice(0, 3);
}

const CSS = `.v9{min-height:100vh;background:#070708;color:#f5f5f5;font:14px Inter,system-ui,sans-serif}.v9 *{box-sizing:border-box}.v9 button,.v9 input,.v9 textarea,.v9 select{font:inherit}.v9 button{color:inherit;background:none;border:0;cursor:pointer}.v9-top{height:64px;border-bottom:1px solid #242428;display:flex;align-items:center;justify-content:space-between;padding:0 18px;position:sticky;top:0;background:rgba(7,7,8,.92);backdrop-filter:blur(16px);z-index:20}.v9-brand{display:flex;align-items:center;gap:10px;font-weight:800}.v9-brand em{font-style:normal;color:#888;font-size:11px;margin-left:4px}.v9-actions,.v9-tools{display:flex;gap:7px;align-items:center}.v9-pill,.v9-icon{border:1px solid #303036;border-radius:10px;padding:8px 11px;background:#111116;display:flex;align-items:center;gap:7px}.v9-icon{padding:8px}.v9-layout{display:grid;grid-template-columns:380px minmax(0,1fr);gap:14px;padding:14px;min-height:calc(100vh - 64px)}.v9-chat,.v9-work{border:1px solid #29292e;background:linear-gradient(145deg,#111114,#0a0a0c);border-radius:18px;overflow:hidden;min-height:calc(100vh - 92px)}.v9-chat{display:flex;flex-direction:column}.v9-head{padding:22px 22px 10px}.v9-head small{color:#777;text-transform:uppercase;letter-spacing:.16em}.v9-head h1{font-size:24px;margin:8px 0}.v9-scroll{flex:1;overflow:auto;padding:12px 16px}.v9-msg{border:1px solid #26262b;background:#111116;border-radius:14px;padding:12px;margin:9px 0}.v9-msg.user{background:#15151b}.v9-msg>span{font-size:10px;color:#777;letter-spacing:.12em}.v9-msg p{white-space:pre-wrap;line-height:1.55;margin:8px 0 0}.v9-cards{display:grid;gap:7px;margin-top:10px}.v9-card{display:flex;align-items:center;gap:9px;text-align:left;border:1px solid #303039;background:#15151b;border-radius:11px;padding:10px}.v9-card small{display:block;color:#777;margin-top:2px}.v9-composer{border-top:1px solid #29292e;padding:12px}.v9-composer textarea{width:100%;min-height:82px;resize:vertical;background:transparent;border:0;outline:0;color:#fff}.v9-row{display:flex;justify-content:space-between;gap:8px;align-items:center}.v9-select{border:1px solid #303039;background:#15151a;border-radius:9px;padding:7px;color:#ddd;max-width:190px}.v9-send{border-radius:10px;background:#fff;color:#08080a!important;padding:9px 12px}.v9-workbar{height:54px;border-bottom:1px solid #29292e;display:flex;align-items:center;justify-content:space-between;padding:0 10px}.v9-switch{display:flex;gap:5px}.v9-switch button{padding:7px 10px;border-radius:9px}.v9-switch .on{background:#f3f3f3;color:#09090b}.v9-preview{height:calc(100vh - 147px);padding:12px;display:flex;align-items:flex-start;justify-content:center;overflow:auto;background:#0a0a0c}.v9-frame{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.35);width:100%;height:100%}.v9-frame.tablet{width:760px}.v9-frame.mobile{width:390px}.v9-frame iframe{width:100%;height:100%;border:0}.v9-ide{height:calc(100vh - 147px);display:grid;grid-template-columns:230px minmax(0,1fr)}.v9-files{border-right:1px solid #29292e;overflow:auto;padding:10px}.v9-file{width:100%;display:flex;gap:9px;align-items:center;padding:9px;border-radius:9px;text-align:left}.v9-file.active,.v9-file:hover{background:#1b1b21}.v9-editor{min-width:0}.v9-editorbar{height:44px;border-bottom:1px solid #29292e;display:flex;align-items:center;justify-content:space-between;padding:0 10px}.v9-sidebar{position:fixed;inset:0 auto 0 0;width:330px;background:#0c0c0f;border-right:1px solid #303036;z-index:50;padding:16px;box-shadow:20px 0 60px rgba(0,0,0,.45)}.v9-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:40}.v9-session{display:flex;align-items:center;border:1px solid #25252b;border-radius:10px;margin:7px 0;overflow:hidden}.v9-session>button{flex:1;text-align:left;padding:10px}.v9-menu{position:relative}.v9-menu details{padding:8px}.v9-menu-pop{position:absolute;right:0;top:34px;background:#15151a;border:1px solid #333;border-radius:10px;padding:5px;z-index:60;min-width:150px}.v9-menu-pop button{display:flex;gap:7px;width:100%;padding:8px;border-radius:7px;text-align:left}.v9-modal{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:70;display:grid;place-items:center;padding:20px}.v9-dialog{width:min(620px,100%);max-height:90vh;overflow:auto;border:1px solid #34343a;background:#111116;border-radius:16px;padding:20px}.v9-dialog label{display:block;color:#999;margin:12px 0 5px}.v9-dialog input,.v9-dialog select{width:100%;background:#09090c;border:1px solid #33333a;border-radius:9px;padding:10px;color:#fff}.v9-primary{background:#f5f5f5!important;color:#08080a!important;border-radius:9px;padding:10px 13px}.v9-repos{max-height:320px;overflow:auto;margin-top:10px}.v9-repo{width:100%;text-align:left;padding:10px;border:1px solid #29292f;border-radius:9px;margin:5px 0}.v9-status{padding:10px;border:1px solid #29292f;border-radius:9px;margin-top:10px;color:#bbb}.v9-pdf{height:62vh;width:100%;border:1px solid #333;border-radius:10px;background:#fff}.v9-verify{margin-top:9px;font-size:11px;color:#9fe0b2}.v9-attach{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.v9-attach span{border:1px solid #303038;border-radius:8px;padding:5px 7px;color:#aaa}.v9-empty{text-align:center;color:#777;padding:70px 25px}.v9-spin{animation:v9spin 1s linear infinite}@keyframes v9spin{to{transform:rotate(360deg)}}@media(max-width:900px){.v9-layout{grid-template-columns:1fr}.v9-chat{min-height:55vh}.v9-work{min-height:70vh}.v9-ide{grid-template-columns:170px 1fr}}`;

export default function BuilderStudioV9() {
  const [sessions, setSessions] = useState<Session[]>(() => readSessions());
  const [sid, setSid] = useState("");
  const [model, setModel] = useState("zyraxon-t10");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<Device>("desktop");
  const [sidebar, setSidebar] = useState(false);
  const [github, setGithub] = useState(false);
  const [publish, setPublish] = useState(false);
  const [mic, setMic] = useState(false);
  const [activity, setActivity] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem("zyraxon.github.token") || "");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [ghStatus, setGhStatus] = useState("");
  const [busyGh, setBusyGh] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [pubStatus, setPubStatus] = useState("");
  const [pubUrl, setPubUrl] = useState("");
  const [pdf, setPdf] = useState<{ title: string; content: string; url: string } | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState("");
  const controllers = useRef(new Map<string, AbortController>());
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!sid && sessions[0]) setSid(sessions[0].id);
    localStorage.setItem(
      "zyraxon.builder.sessions.v9",
      JSON.stringify(sessions.map((s) => ({ ...s, busy: false }))),
    );
  }, [sessions, sid]);
  const current = sessions.find((s) => s.id === sid) || sessions[0];
  const files = current?.files || [];
  const active = files.find((f) => f.path === current?.activeFile) || files[0];
  const selectedModel = MODELS.find((m) => m.id === model) || MODELS[0];
  const preview = useMemo(() => composePreview(files), [files]);
  const patch = (id: string, p: Partial<Session>) =>
    setSessions((all) => all.map((s) => (s.id === id ? { ...s, ...p, updatedAt: Date.now() } : s)));
  const updateFiles = (id: string, fn: (f: BuilderFile[]) => BuilderFile[]) =>
    setSessions((all) =>
      all.map((s) => (s.id === id ? { ...s, files: fn(s.files), updatedAt: Date.now() } : s)),
    );
  function newSession() {
    const s = starter();
    setSessions((a) => [s, ...a]);
    setSid(s.id);
    setInput("");
    setAttachments([]);
    setView("preview");
    setSidebar(false);
  }
  function renameSession(s: Session) {
    const n = window.prompt("Rename session", s.title)?.trim();
    if (n) patch(s.id, { title: n });
  }
  function deleteSession(s: Session) {
    if (sessions.length === 1) return;
    controllers.current.get(s.id)?.abort();
    setSessions((a) => a.filter((x) => x.id !== s.id));
    if (s.id === sid) setSid(sessions.find((x) => x.id !== s.id)?.id || "");
  }
  function downloadSession(s: Session) {
    downloadBlob(
      createProjectZip(s.files),
      `${(s.title || "zyraxon-session").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}.zip`,
    );
  }
  async function refreshDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      setDevices(
        (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput"),
      );
    } catch {
      setDevices([]);
    }
  }
  async function startMic() {
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Microphone API unavailable in this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      await refreshDevices();
      const r = new MediaRecorder(stream);
      recorder.current = r;
      chunks.current = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        try {
          const form = new FormData();
          form.append("file", blob, "recording.webm");
          form.append("language", "bn");
          const res = await fetch("/api/public/stt", { method: "POST", body: form });
          const data = await res.json();
          if (data?.success && data.text) setInput((v) => `${v}${v ? " " : ""}${data.text}`);
          else setNotice(data?.error || "Voice transcription failed.");
        } catch (e) {
          setNotice(e instanceof Error ? e.message : "Voice transcription failed.");
        }
      };
      r.start(250);
      setRecording(true);
      setMic(true);
      window.setTimeout(() => {
        if (recorder.current === r && r.state === "recording") r.stop();
      }, 20000);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Microphone permission/device access failed.");
    }
  }
  function stopMic() {
    try {
      recorder.current?.stop();
    } catch {
      /* ignored */
    }
    setRecording(false);
  }
  async function micButton() {
    if (recording) {
      stopMic();
      return;
    }
    try {
      await refreshDevices();
      if (!devices.length) {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        await refreshDevices();
      }
      setMic(true);
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Allow microphone access for this site, then retry.",
      );
    }
  }
  async function send() {
    const text = input.trim();
    if (!text || !current || current.busy) return;
    const id = current.id;
    const userFiles = attachments;
    setAttachments([]);
    setInput("");
    const user: Msg = {
      role: "user",
      content: text,
      attachments: userFiles.map((a) => ({ name: a.name, mime: a.mime, size: a.size })),
    };
    const history = [...current.messages, user];
    patch(id, {
      messages: history,
      busy: true,
      title: current.messages.length ? current.title : text.slice(0, 42),
    });
    const c = new AbortController();
    controllers.current.set(id, c);
    try {
      const res = await fetch("/api/public/builder/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          model,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          attachments: userFiles.map((a) => ({ name: a.name, mime: a.mime, data: a.data })),
        }),
        signal: c.signal,
      });
      if (!res.ok || !res.body)
        throw new Error((await res.text().catch(() => "")) || "AI request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
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
            full += j?.choices?.[0]?.delta?.content || j?.content || "";
          } catch {
            /* ignored */
          }
        }
      }
      const generated = parseGeneratedFiles(full);
      if (generated.length)
        updateFiles(id, (old) => {
          const next = [...old];
          for (const f of generated) {
            const i = next.findIndex((x) => x.path === f.path);
            if (i >= 0) next[i] = f;
            else next.push(f);
          }
          return next;
        });
      const pdfTag = /<builder-tool>\s*(\{[\s\S]*?\})\s*<\/builder-tool>/i.exec(full);
      let pdfData: Msg["pdf"];
      if (pdfTag) {
        try {
          const t = JSON.parse(pdfTag[1]);
          if (t.tool === "pdf.create" && t.content)
            pdfData = { title: String(t.title || "ZYRAXON PDF"), content: String(t.content) };
        } catch {
          /* ignored */
        }
      }
      const latestFiles = sessions.find((s) => s.id === id)?.files || [];
      const merged = generated.reduce(
        (a, f) => {
          const i = a.findIndex((x) => x.path === f.path);
          if (i >= 0) a[i] = f;
          else a.push(f);
          return a;
        },
        [...latestFiles],
      );
      const check = verify(merged);
      patch(id, {
        messages: [
          ...history,
          {
            role: "assistant",
            content: generated.length
              ? `Generated and integrated ${generated.length} project file${generated.length === 1 ? "" : "s"}.`
              : "Task response received.",
            files: generated,
            pdf: pdfData,
            checks: check.checks,
          },
        ],
        busy: false,
      });
      setView("preview");
    } catch (e) {
      if ((e as unknown)?.name !== "AbortError")
        patch(id, {
          messages: [
            ...history,
            { role: "assistant", content: e instanceof Error ? e.message : "AI request failed." },
          ],
          busy: false,
        });
      else patch(id, { busy: false });
    } finally {
      controllers.current.delete(id);
    }
  }
  async function loadRepos() {
    const t = token.trim();
    if (!t) return;
    localStorage.setItem("zyraxon.github.token", t);
    setBusyGh(true);
    setGhStatus("Loading repositories…");
    try {
      const r = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
        headers: {
          Authorization: `Bearer ${t}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!r.ok) throw new Error(`GitHub rejected the token (${r.status}).`);
      setRepos(await r.json());
      setGhStatus("Choose a repository to import its complete readable project.");
    } catch (e) {
      setGhStatus(e instanceof Error ? e.message : "GitHub connection failed.");
    } finally {
      setBusyGh(false);
    }
  }
  async function importRepo(repo: Repo) {
    if (!current) return;
    setBusyGh(true);
    setGhStatus(`Importing ${repo.full_name}…`);
    try {
      const h = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };
      const tree = await fetch(
        `https://api.github.com/repos/${repo.full_name}/git/trees/${repo.default_branch || "main"}?recursive=1`,
        { headers: h },
      );
      if (!tree.ok) throw new Error(`Repository tree request failed (${tree.status}).`);
      const td = await tree.json();
      const blobs = (td.tree || []).filter(
        (x: unknown) =>
          x.type === "blob" &&
          Number(x.size || 0) <= 1500000 &&
          !/\.(exe|dll|so|dylib|zip|7z|rar|png|jpg|jpeg|gif|webp|mp4|mp3|wav)$/i.test(x.path),
      );
      const imported: BuilderFile[] = [];
      for (let i = 0; i < blobs.length; i += 6) {
        const batch = await Promise.all(
          blobs.slice(i, i + 6).map(async (b: unknown) => {
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
        imported.push(...(batch.filter(Boolean) as BuilderFile[]));
      }
      if (!imported.length) throw new Error("No readable source files were found.");
      patch(current.id, {
        files: imported,
        activeFile: imported.find((f) => f.path === "index.html")?.path || imported[0].path,
        repo,
      });
      setGhStatus(`Connected ${repo.full_name} · ${imported.length} files`);
      setGithub(false);
      setView("code");
    } catch (e) {
      setGhStatus(e instanceof Error ? e.message : "Repository import failed.");
    } finally {
      setBusyGh(false);
    }
  }
  async function sync() {
    if (!current?.repo || busyGh) return;
    setBusyGh(true);
    try {
      const h: unknown = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      };
      for (const f of files) {
        const url = `https://api.github.com/repos/${current.repo.full_name}/contents/${f.path}`;
        const old = await fetch(url, { headers: h });
        const body: unknown = {
          message: `chore: sync ${f.path} from ZYRAXON AI`,
          content: encodeBase64(f.content),
          branch: current.repo.default_branch || "main",
        };
        if (old.ok) body.sha = (await old.json()).sha;
        const r = await fetch(url, { method: "PUT", headers: h, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(`Sync failed for ${f.path} (${r.status}).`);
      }
      setNotice(`Synced ${files.length} files to ${current.repo.full_name}.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "GitHub sync failed.");
    } finally {
      setBusyGh(false);
    }
  }
  async function doPublish() {
    const t = token.trim();
    const name = repoName.trim().replace(/\.git$/, "");
    if (!t || !name || !files.length) {
      setPubStatus("GitHub token, repository name and project files are required.");
      return;
    }
    localStorage.setItem("zyraxon.github.token", t);
    setPubStatus("Creating or opening repository…");
    try {
      const h: unknown = {
        Authorization: `Bearer ${t}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      };
      const me = await fetch("https://api.github.com/user", { headers: h });
      if (!me.ok) throw new Error(`GitHub token rejected (${me.status}).`);
      const user = await me.json();
      let rr = await fetch(`https://api.github.com/repos/${user.login}/${name}`, { headers: h });
      if (rr.status === 404)
        rr = await fetch("https://api.github.com/user/repos", {
          method: "POST",
          headers: h,
          body: JSON.stringify({
            name,
            private: false,
            auto_init: true,
            description: "Built with ZYRAXON AI",
          }),
        });
      if (!rr.ok) throw new Error(`Repository create/open failed (${rr.status}).`);
      const repo = await rr.json();
      const branch = repo.default_branch || "main";
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setPubStatus(`Uploading project ${i + 1}/${files.length}…`);
        const url = `https://api.github.com/repos/${user.login}/${name}/contents/${f.path}`;
        const old = await fetch(`${url}?ref=${branch}`, { headers: h });
        const body: unknown = {
          message: `feat: publish ${f.path} from ZYRAXON AI`,
          content: encodeBase64(f.content),
          branch,
        };
        if (old.ok) body.sha = (await old.json()).sha;
        const r = await fetch(url, { method: "PUT", headers: h, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(`Upload failed for ${f.path} (${r.status}).`);
      }
      setPubStatus("Enabling GitHub Pages…");
      const pages = await fetch(`https://api.github.com/repos/${user.login}/${name}/pages`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ source: { branch, path: "/" }, build_type: "legacy" }),
      });
      if (!pages.ok && pages.status !== 409)
        throw new Error(`Pages setup failed (${pages.status}).`);
      const url = `https://${user.login}.github.io/${name}/`;
      setPubUrl(url);
      setPubStatus("Published. GitHub Pages may need a short build time before the URL is live.");
      patch(current!.id, {
        repo: {
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          default_branch: branch,
          private: repo.private,
        },
      });
    } catch (e) {
      setPubStatus(e instanceof Error ? e.message : "Publish failed.");
    }
  }
  async function addAttachments(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    try {
      const next = await Promise.all(
        list.map(
          (file) =>
            new Promise<Attachment>((resolve, reject) => {
              if (file.size > 15 * 1024 * 1024) {
                reject(new Error(`${file.name} is larger than 15 MB.`));
                return;
              }
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
            }),
        ),
      );
      setAttachments((a) => [...a, ...next]);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Attachment failed.");
    }
    e.target.value = "";
  }
  async function showPdf(p: { title: string; content: string }) {
    const url = URL.createObjectURL(await makePdf(p.title, p.content));
    setPdf({ title: p.title, content: p.content, url });
  }
  function closePdf() {
    if (pdf) URL.revokeObjectURL(pdf.url);
    setPdf(null);
  }
  return (
    <div className="v9">
      <style>{CSS}</style>
      <header className="v9-top">
        <div className="v9-brand">
          <button className="v9-icon" onClick={() => setSidebar(true)}>
            <Plus size={15} />
          </button>
          <span>
            ZYRAXON <em>AI BLUDAR</em>
          </span>
        </div>
        <div className="v9-actions">
          <button className="v9-pill" onClick={() => setPublish(true)}>
            <Upload size={14} /> Publish
          </button>
          <button className="v9-pill" onClick={() => setActivity((v) => !v)}>
            <Activity size={14} /> Activity
          </button>
          <button className="v9-pill" onClick={() => setGithub(true)}>
            <Github size={14} /> GitHub
          </button>
        </div>
      </header>
      {sidebar && (
        <>
          <div className="v9-backdrop" onClick={() => setSidebar(false)} />
          <aside className="v9-sidebar">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b>Sessions</b>
              <button className="v9-icon" onClick={() => setSidebar(false)}>
                <X size={14} />
              </button>
            </div>
            <button
              className="v9-pill"
              style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
              onClick={newSession}
            >
              <Plus size={14} /> New session
            </button>
            {sessions.map((s) => (
              <div className="v9-session" key={s.id}>
                <button
                  onClick={() => {
                    setSid(s.id);
                    setSidebar(false);
                  }}
                >
                  <b>{s.title}</b>
                  <small style={{ display: "block", color: "#777" }}>
                    {s.busy ? "Working…" : `${s.files.length} files`}
                  </small>
                </button>
                <div className="v9-menu">
                  <details>
                    <summary>
                      <MoreHorizontal size={15} />
                    </summary>
                    <div className="v9-menu-pop">
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
              </div>
            ))}
          </aside>
        </>
      )}
      <main className="v9-layout">
        <section className="v9-chat">
          <div className="v9-head">
            <small>AI BUILDER</small>
            <h1>{current?.messages.length ? "Building with ZYRAXON" : "What are we building?"}</h1>
            <div style={{ color: "#777" }}>
              Selected: {selectedModel.name} ·{" "}
              {selectedModel.multimodal ? "image/audio/video enabled" : "text/code"}
            </div>
          </div>
          <div className="v9-scroll">
            {!current?.messages.length ? (
              <div className="v9-empty">
                <Bot size={28} />
                <h2>Describe your idea</h2>
                <p>
                  Ask for a complete website, app, codebase, or PDF. The agent decides the required
                  architecture and files.
                </p>
              </div>
            ) : (
              current.messages.map((m, i) => (
                <article className={`v9-msg ${m.role}`} key={i}>
                  <span>{m.role === "user" ? "YOU" : "ZYRAXON AI"}</span>
                  <p>{m.content}</p>
                  {m.attachments?.length ? (
                    <div className="v9-attach">
                      {m.attachments.map((a) => (
                        <span key={a.name}>
                          <ImageIcon size={11} /> {a.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {m.files?.length ? (
                    <div className="v9-cards">
                      {m.files.map((f) => (
                        <button
                          className="v9-card"
                          key={f.path}
                          onClick={() => {
                            patch(current.id, { activeFile: f.path });
                            setView("code");
                          }}
                        >
                          <b>{fileIcon(f.path)}</b>
                          <span>
                            <strong>{f.path}</strong>
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
                    <button className="v9-card" onClick={() => void showPdf(m.pdf!)}>
                      <FileText size={14} />
                      <span>
                        <strong>{m.pdf.title}</strong>
                        <small>Preview and download PDF</small>
                      </span>
                      <Eye size={14} />
                    </button>
                  ) : null}
                  {m.checks ? (
                    <div className="v9-verify">
                      <CheckCircle2 size={12} /> {m.checks.join(" · ")}
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
          <div className="v9-composer">
            {attachments.length > 0 && (
              <div className="v9-attach">
                {attachments.map((a) => (
                  <span key={`${a.name}-${a.size}`}>
                    {a.name}
                    <button onClick={() => setAttachments((x) => x.filter((y) => y !== a))}>
                      <X size={10} />
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
                  void send();
                }
              }}
              placeholder="Describe what you want to build…"
            />
            <div className="v9-row">
              <div className="v9-tools">
                <select
                  className="v9-select"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  className={`v9-icon ${recording ? "on" : ""}`}
                  onClick={() => void micButton()}
                  title="Microphone"
                >
                  <Mic size={15} />
                </button>
                <button
                  className="v9-icon"
                  onClick={() => inputRef.current?.click()}
                  title="Attach image, audio or video"
                >
                  <ImageIcon size={15} />
                </button>
                <input
                  ref={inputRef}
                  hidden
                  type="file"
                  multiple
                  accept="image/*,audio/*,video/*"
                  onChange={(e) => void addAttachments(e)}
                />
              </div>
              <div className="v9-tools">
                <button
                  className="v9-icon"
                  onClick={() => downloadBlob(createProjectZip(files), "zyraxon-project.zip")}
                  title="Download project ZIP"
                >
                  <FileArchive size={15} />
                </button>
                <button
                  className="v9-send"
                  disabled={!input.trim() || current?.busy}
                  onClick={() => void send()}
                >
                  {current?.busy ? <Loader2 size={16} className="v9-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </div>
        </section>
        <section className="v9-work">
          <div className="v9-workbar">
            <div className="v9-switch">
              <button className={view === "preview" ? "on" : ""} onClick={() => setView("preview")}>
                <Eye size={14} /> Preview
              </button>
              <button className={view === "code" ? "on" : ""} onClick={() => setView("code")}>
                <Code2 size={14} /> Code
              </button>
            </div>
            <div className="v9-tools">
              <button className="v9-icon" onClick={() => setDevice("desktop")}>
                <Laptop size={14} />
              </button>
              <button className="v9-icon" onClick={() => setDevice("tablet")}>
                <Tablet size={14} />
              </button>
              <button className="v9-icon" onClick={() => setDevice("mobile")}>
                <Smartphone size={14} />
              </button>
              {current?.repo && (
                <button className="v9-pill" onClick={() => void sync()}>
                  <Github size={13} /> Sync
                </button>
              )}
            </div>
          </div>
          {view === "preview" ? (
            <div className="v9-preview">
              <div className={`v9-frame ${device}`}>
                <iframe
                  title="Generated website preview"
                  srcDoc={preview}
                  sandbox="allow-scripts allow-forms allow-modals"
                />
              </div>
            </div>
          ) : (
            <div className="v9-ide">
              <aside className="v9-files">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "5px 4px 9px",
                    color: "#888",
                  }}
                >
                  <span>
                    <FolderOpen size={13} /> Project files
                  </span>
                  <b>{files.length}</b>
                </div>
                {files.map((f) => (
                  <button
                    key={f.path}
                    className={`v9-file ${f.path === active?.path ? "active" : ""}`}
                    onClick={() => patch(current!.id, { activeFile: f.path })}
                  >
                    <span>{fileIcon(f.path)}</span>
                    {f.path}
                  </button>
                ))}
              </aside>
              <div className="v9-editor">
                <div className="v9-editorbar">
                  <span>{active?.path || "No file selected"}</span>
                  <div className="v9-tools">
                    <button
                      className="v9-pill"
                      onClick={() => void sync()}
                      disabled={!current?.repo || busyGh}
                    >
                      <Github size={12} /> {busyGh ? "Syncing" : "Sync"}
                    </button>
                    <button
                      className="v9-pill"
                      onClick={() =>
                        active &&
                        downloadBlob(
                          new Blob([active.content], { type: "text/plain" }),
                          active.path.split("/").pop() || "file.txt",
                        )
                      }
                    >
                      <Download size={12} /> Download
                    </button>
                  </div>
                </div>
                {active ? (
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
                      wordWrap: "on",
                      scrollBeyondLastLine: false,
                    }}
                  />
                ) : (
                  <div className="v9-empty">No project file selected.</div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
      {activity && (
        <div className="v9-modal" onClick={() => setActivity(false)}>
          <div className="v9-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h2>Activity</h2>
              <button className="v9-icon" onClick={() => setActivity(false)}>
                <X size={14} />
              </button>
            </div>
            <p>
              {sessions.filter((s) => s.busy).length
                ? `${sessions.filter((s) => s.busy).length} session(s) running concurrently.`
                : "All sessions idle."}
            </p>
          </div>
        </div>
      )}
      {github && (
        <div className="v9-modal">
          <div className="v9-dialog">
            <button className="v9-icon" style={{ float: "right" }} onClick={() => setGithub(false)}>
              <X size={14} />
            </button>
            <h2>GitHub project</h2>
            <p style={{ color: "#999" }}>
              Token is kept locally in this browser. Selecting a repository imports the complete
              readable project into the workspace.
            </p>
            <label>Access token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="GitHub access token"
            />
            <button
              className="v9-primary"
              style={{ marginTop: 10 }}
              disabled={!token || busyGh}
              onClick={() => void loadRepos()}
            >
              {busyGh ? <Loader2 className="v9-spin" size={14} /> : <Github size={14} />} Load
              repositories
            </button>
            {ghStatus && <div className="v9-status">{ghStatus}</div>}
            <div className="v9-repos">
              {repos.map((r) => (
                <button className="v9-repo" key={r.id} onClick={() => void importRepo(r)}>
                  <b>{r.full_name}</b>
                  <small style={{ display: "block", color: "#777" }}>
                    {r.private ? "Private" : "Public"} · {r.default_branch}
                  </small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {publish && (
        <div className="v9-modal">
          <div className="v9-dialog">
            <button
              className="v9-icon"
              style={{ float: "right" }}
              onClick={() => setPublish(false)}
            >
              <X size={14} />
            </button>
            <h2>Publish website</h2>
            <p style={{ color: "#999" }}>
              Creates/opens a GitHub repository, uploads the complete project, enables Pages and
              returns the live URL.
            </p>
            <label>Repository name</label>
            <input
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="my-zyraxon-site"
            />
            <button
              className="v9-primary"
              style={{ marginTop: 10 }}
              disabled={!repoName || !files.length}
              onClick={() => void doPublish()}
            >
              <Upload size={14} /> Publish
            </button>
            {pubStatus && <div className="v9-status">{pubStatus}</div>}
            {pubUrl && (
              <a
                href={pubUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: "block", marginTop: 10, color: "#8fd" }}
              >
                {pubUrl}
              </a>
            )}
          </div>
        </div>
      )}
      {mic && (
        <div className="v9-modal">
          <div className="v9-dialog">
            <button
              className="v9-icon"
              style={{ float: "right" }}
              onClick={() => {
                if (recording) stopMic();
                setMic(false);
              }}
            >
              <X size={14} />
            </button>
            <h2>Microphone</h2>
            <p style={{ color: "#999" }}>
              Grant permission first so Windows/Realtek input devices can be listed.
            </p>
            <label>Input device</label>
            <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              <option value="">System default</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
            <button
              className="v9-primary"
              style={{ marginTop: 10 }}
              onClick={() => (recording ? stopMic() : void startMic())}
            >
              {recording ? (
                <>
                  <Loader2 className="v9-spin" size={14} /> Recording…
                </>
              ) : (
                <>
                  <Mic size={14} /> Start recording
                </>
              )}
            </button>
          </div>
        </div>
      )}
      {pdf && (
        <div className="v9-modal">
          <div className="v9-dialog">
            <button className="v9-icon" style={{ float: "right" }} onClick={closePdf}>
              <X size={14} />
            </button>
            <h2>{pdf.title}</h2>
            <iframe className="v9-pdf" title="PDF preview" src={pdf.url} />
            <button
              className="v9-primary"
              style={{ marginTop: 10 }}
              onClick={async () =>
                downloadBlob(
                  await makePdf(pdf.title, pdf.content),
                  `${pdf.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "zyraxon"}.pdf`,
                )
              }
            >
              <Download size={14} /> Download PDF
            </button>
          </div>
        </div>
      )}
      {notice && (
        <div className="v9-modal" onClick={() => setNotice("")}>
          <div className="v9-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Notice</h3>
            <p>{notice}</p>
            <button className="v9-primary" onClick={() => setNotice("")}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

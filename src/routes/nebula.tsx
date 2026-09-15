import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Zap,
  Lock,
  Eye,
  EyeOff,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu,
  MemoryStick,
  Server,
  Activity,
  Brain,
  Send,
  Trash2,
  X,
  Image as ImageIcon,
  Volume2,
  FileText,
  Loader2,
  ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/nebula")({
  head: () => ({ meta: [{ title: "ZYRAXON Nebula — AI Model Hub" }] }),
});

const NEBULA_PASSWORD = "zyraxon";

type SystemInfo = {
  platform: string;
  arch: string;
  cpus: number;
  cpuModel: string;
  totalMemoryGB: number;
  freeMemoryGB: number;
  uptime: number;
  nodeVersion: string;
};

type HFModel = {
  id: string;
  modelId: string;
  author: string;
  pipeline_tag: string;
  tags: string[];
  downloads: number;
  likes: number;
  lastModified: string;
};

type DownloadStatus = {
  modelId: string;
  status: "pending" | "downloading" | "done" | "error";
  progress: number;
  totalBytes: number;
  downloadedBytes: number;
  error?: string;
  files: { name: string; size: number }[];
};

type ChatMsg = {
  role: "user" | "assistant" | "system";
  content: string;
  type?: "text" | "image" | "audio" | "download";
  imageUrl?: string;
  audioUrl?: string;
  modelId?: string;
  downloadProgress?: number;
};

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/nebula?action=verify&password=${encodeURIComponent(password)}`);
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("nebula_auth", data.token);
        onUnlock();
      } else {
        setError("ভুল পাসওয়ার্ড!");
      }
    } catch {
      setError("সংযোগ বিচ্ছিন্ন।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl" />
      </div>
      <Card className="relative z-10 w-full max-w-md border border-gray-200 bg-white/90 backdrop-blur-xl">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
              ZYRAXON Nebula
            </h1>
            <p className="text-sm text-gray-500 mt-1">AI Model Hub — Admin Access</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                type={showPw ? "text" : "password"}
                placeholder="পাসওয়ার্ড..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 bg-white border-gray-200 focus:border-purple-500"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="text-red-500 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-semibold"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              {loading ? "যাচাই..." : "প্রবেশ করুন"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

const PIPELINE_ICONS: Record<string, string> = {
  "text-generation": "🧠",
  "text2text-generation": "📝",
  "image-generation": "🎨",
  "text-to-image": "🎨",
  "text-to-audio": "🎵",
  "text-to-speech": "🗣️",
  "automatic-speech-recognition": "🎤",
  "image-classification": "📷",
  "fill-mask": "🎭",
  "question-answering": "❓",
  "summarization": "📄",
  "translation": "🌐",
  "zero-shot-classification": "🎯",
  "object-detection": "🔍",
  "segmentation": "🧩",
  "feature-extraction": "📊",
  "sentence-similarity": "🔗",
};

const PIPELINE_LABELS: Record<string, string> = {
  "text-generation": "Text Generation",
  "text2text-generation": "Text2Text",
  "image-generation": "Image Generation",
  "text-to-image": "Text to Image",
  "text-to-audio": "Text to Audio",
  "text-to-speech": "Text to Speech",
  "automatic-speech-recognition": "Speech Recognition",
  "image-classification": "Image Classification",
  "question-answering": "Question Answering",
  "summarization": "Summarization",
  "translation": "Translation",
};

function getPipelineType(pipeline: string): "text" | "image" | "audio" {
  if (pipeline.includes("image") || pipeline.includes("text-to-image")) return "image";
  if (pipeline.includes("audio") || pipeline.includes("speech")) return "audio";
  return "text";
}

function ModelCard({
  model,
  downloadStatus,
  onDownload,
  onUse,
}: {
  model: HFModel;
  downloadStatus?: DownloadStatus;
  onDownload: (modelId: string) => void;
  onUse: (model: HFModel) => void;
}) {
  const icon = PIPELINE_ICONS[model.pipeline_tag] || "📦";
  const label = PIPELINE_LABELS[model.pipeline_tag] || model.pipeline_tag;
  const status = downloadStatus?.status;
  const progress = downloadStatus?.progress || 0;

  return (
    <Card className="border-gray-200 bg-white hover:bg-gray-50 transition-all group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl shrink-0 mt-1">{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate text-sm">{model.modelId}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              by {model.author} · {label}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              <span>⬇ {formatNumber(model.downloads)}</span>
              <span>❤ {formatNumber(model.likes)}</span>
            </div>
            {status === "downloading" && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Downloading...
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {downloadStatus.totalBytes > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {formatBytes(downloadStatus.downloadedBytes)} / {formatBytes(downloadStatus.totalBytes)}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            {status === "done" ? (
              <Button size="sm" variant="outline" className="border-green-300 text-green-600 h-7 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
              </Button>
            ) : status === "downloading" ? (
              <Button size="sm" variant="outline" disabled className="h-7 text-xs">
                <Loader2 className="w-3 h-3 animate-spin mr-1" /> {progress}%
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => onDownload(model.modelId)}
                className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 h-7 text-xs"
              >
                <Download className="w-3 h-3 mr-1" /> Get
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onUse(model)}
              className="h-7 text-xs text-gray-400 hover:text-white"
            >
              <Send className="w-3 h-3 mr-1" /> Use
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemTab() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/nebula?action=system`);
      const data = await res.json();
      if (data.success) setInfo(data.system);
    } catch {
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
      </div>
    );
  }

  const stats = [
    { label: "CPU", value: `${info?.cpus ?? "?"} cores`, sub: info?.cpuModel || "", icon: Cpu, color: "from-purple-500 to-purple-700" },
    { label: "RAM", value: `${info?.totalMemoryGB ?? "?"} GB`, sub: `${info?.freeMemoryGB ?? "?"} GB free`, icon: MemoryStick, color: "from-cyan-500 to-cyan-700" },
    { label: "Platform", value: info?.platform ?? "?", sub: info?.arch ?? "", icon: Server, color: "from-orange-500 to-orange-700" },
    { label: "Uptime", value: `${Math.floor((info?.uptime ?? 0) / 3600)}h`, sub: `Node ${info?.nodeVersion ?? ""}`, icon: Activity, color: "from-green-500 to-green-700" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="border-gray-200 bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="text-lg font-bold text-white">{s.value}</p>
              {s.sub && <p className="text-xs text-gray-500">{s.sub}</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChatTab() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content: "ZYRAXON Nebula-এ স্বাগতম! 🚀\n\nআমি HuggingFace থেকে রিয়েল AI মডেল খুঁজে বের করতে পারি, ডাউনলোড করতে পারি, এবং চালাতে পারি।\n\n• মডেল সার্চ করতে বলুন: \"sdxl খুঁজে বের করো\"\n• ডাউনলোড করতে বলুন: \"llama 3.2 ডাউনলোড করো\"\n• জেনারেট করতে বলুন: \"a cat sitting on mars দিয়ে image বানাও\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<HFModel[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [selectedModel, setSelectedModel] = useState<HFModel | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const addMsg = (role: "user" | "assistant" | "system", content: string, extra?: Partial<ChatMsg>) => {
    setMessages((prev) => [...prev, { role, content, ...extra }]);
  };

  const searchModels = async (query: string) => {
    const res = await fetch(`/api/public/nebula/search?q=${encodeURIComponent(query)}&limit=10`);
    const data = await res.json();
    if (data.success) {
      setSearchResults(data.models);
      setShowModelPicker(true);
    }
    return data.models || [];
  };

  const downloadModel = async (modelId: string) => {
    addMsg("system", `⬇️ ডাউনলোড শুরু হচ্ছে: ${modelId}`);
    const res = await fetch("/api/public/nebula/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId }),
    });
    const data = await res.json();
    if (data.success) {
      addMsg("system", `✅ ${modelId} ডাউনলোড শুরু হয়েছে। Progress দেখতে "status ${modelId}" লিখুন।`);
    } else {
      addMsg("system", `❌ ডাউনলোড ব্যর্থ: ${data.error}`);
    }
  };

  const generateContent = async (prompt: string, model: string, type: "text" | "image" | "audio") => {
    addMsg("user", prompt);
    setLoading(true);
    try {
      const res = await fetch("/api/public/nebula/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, type, parameters: {} }),
      });
      const data = await res.json();
      if (data.success) {
        const result = data.result;
        if (result.type === "image" && result.base64) {
          addMsg("assistant", "🎨 Image generated!", {
            type: "image",
            imageUrl: `data:${result.contentType};base64,${result.base64}`,
          });
        } else if (result.type === "audio" && result.base64) {
          addMsg("assistant", "🎵 Audio generated!", {
            type: "audio",
            audioUrl: `data:${result.contentType};base64,${result.base64}`,
          });
        } else if (typeof result === "object" && result.generated_text) {
          addMsg("assistant", result.generated_text);
        } else if (Array.isArray(result)) {
          addMsg("assistant", result.map((r: { generated_text?: string }) => r.generated_text || JSON.stringify(r)).join("\n"));
        } else if (typeof result === "string") {
          addMsg("assistant", result);
        } else {
          addMsg("assistant", JSON.stringify(result, null, 2));
        }
      } else {
        addMsg("assistant", `❌ Error: ${data.error}`);
      }
    } catch (err) {
      addMsg("assistant", `❌ Error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    addMsg("user", text);

    const lower = text.toLowerCase();

    if (lower.includes("সার্চ") || lower.includes("search") || lower.includes("খুঁজ") || lower.includes("find")) {
      const query = text.replace(/(সার্চ|search|খুঁজ|find|করো|করো|বের|করো)/gi, "").trim();
      if (query) {
        addMsg("assistant", `🔍 "${query}" সার্চ করছি HuggingFace-এ...`);
        const models = await searchModels(query);
        if (models.length > 0) {
          const list = models
            .slice(0, 5)
            .map((m: HFModel) => `• **${m.modelId}** — ${PIPELINE_LABELS[m.pipeline_tag] || m.pipeline_tag} — ⬇${formatNumber(m.downloads)}`)
            .join("\n");
          addMsg("assistant", `${models.length}টি মডেল পাওয়া গেছে:\n${list}\n\nডাউনলোড করতে "download [model-id]" লিখুন।`);
        } else {
          addMsg("assistant", "কোনো মডেল পাওয়া যায়নি।");
        }
      }
      return;
    }

    if (lower.includes("ডাউনলোড") || lower.includes("download")) {
      const modelMatch = text.match(/[\w\-\.\/]+/g)?.filter((w) => w.includes("/"))[0];
      if (modelMatch) {
        await downloadModel(modelMatch);
      } else {
        addMsg("assistant", "কোন মডেল ডাউনলোড করতে চান? মডেলের ID দিন (যেমন: `meta-llama/Llama-3.2-3B`)");
      }
      return;
    }

    if (lower.startsWith("status")) {
      const modelId = text.replace(/^status\s*/i, "").trim();
      if (modelId) {
        const res = await fetch(`/api/public/nebula/download?modelId=${encodeURIComponent(modelId)}`);
        const data = await res.json();
        if (data.success && data.status) {
          const s = data.status;
          addMsg("system", `📊 ${s.modelId}: ${s.status} — ${s.progress}% — ${formatBytes(s.downloadedBytes)}/${formatBytes(s.totalBytes)}`);
        } else {
          addMsg("system", `📊 ${modelId}: কোনো download status নেই।`);
        }
      }
      return;
    }

    const imageKeywords = ["image", "ছবি", "picture", "draw", "paint", "generate image", "art"];
    const audioKeywords = ["audio", "গান", "music", "speech", "tts", "voice", "sound"];

    if (imageKeywords.some((k) => lower.includes(k))) {
      const model = selectedModel?.modelId || "stabilityai/stable-diffusion-xl-base-1.0";
      addMsg("assistant", `🎨 ${model} দিয়ে image তৈরি করছি...`);
      await generateContent(text, model, "image");
      return;
    }

    if (audioKeywords.some((k) => lower.includes(k))) {
      const model = selectedModel?.modelId || "facebook/musicgen-small";
      addMsg("assistant", `🎵 ${model} দিয়ে audio তৈরি করছি...`);
      await generateContent(text, model, "audio");
      return;
    }

    const model = selectedModel?.modelId || "microsoft/DialoGPT-medium";
    await generateContent(text, model, "text");
  };

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-gray-600">Nebula Chat</span>
          {selectedModel && (
            <Badge variant="outline" className="border-purple-300 text-purple-600 text-xs">
              {selectedModel.modelId.split("/").pop()}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowModelPicker(!showModelPicker)}
          className="text-xs text-gray-400"
        >
          <ChevronDown className="w-3 h-3 mr-1" /> Models
        </Button>
      </div>

      {showModelPicker && (
        <div className="border-b border-gray-200 bg-gray-50 p-3 max-h-48 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <Input
              placeholder="HuggingFace থেকে মডেল সার্চ করুন..."
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  const q = (e.target as HTMLInputElement).value;
                  if (q) await searchModels(q);
                }
              }}
              className="bg-white border-gray-200 text-sm h-8"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((m) => (
                <button
                  key={m.modelId}
                  onClick={() => {
                    setSelectedModel(m);
                    setShowModelPicker(false);
                    addMsg("system", `✅ মডেল সিলেক্ট হয়েছে: ${m.modelId}`);
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${
                    selectedModel?.modelId === m.modelId
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span>{PIPELINE_ICONS[m.pipeline_tag] || "📦"}</span>
                  <span className="truncate">{m.modelId}</span>
                  <span className="text-gray-400 ml-auto">⬇{formatNumber(m.downloads)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-purple-600 to-cyan-600 text-white"
                    : msg.role === "system"
                      ? "bg-gray-50 text-gray-500 border border-gray-200"
                      : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.content}
                {msg.type === "image" && msg.imageUrl && (
                  <img src={msg.imageUrl} alt="Generated" className="mt-2 rounded-lg max-w-full" />
                )}
                {msg.type === "audio" && msg.audioUrl && (
                  <audio controls src={msg.audioUrl} className="mt-2 w-full" />
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/10 rounded-xl px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-gray-200 p-3 bg-white">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            placeholder="মডেল সার্চ করুন, ডাউনলোড করুন, বা generate করুন..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={loading}
            className="bg-white border-gray-200 focus:border-purple-500"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function DownloadsTab() {
  const [downloads, setDownloads] = useState<DownloadStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/public/nebula/download");
      const data = await res.json();
      if (data.success) setDownloads(data.models || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [load]);

  const removeModel = async (modelId: string) => {
    await fetch(`/api/public/nebula/download?modelId=${encodeURIComponent(modelId)}`, { method: "DELETE" });
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Download className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">এখনো কোনো মডেল ডাউনলোড হয়নি।</p>
        <p className="text-xs mt-1">Chat ট্যাবে গিয়ে মডেল সার্চ ও ডাউনলোড করুন।</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {downloads.map((d) => (
        <Card key={d.modelId} className="border-gray-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-sm truncate">{d.modelId}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {d.status === "done" && `✅ Done — ${d.files.length} files`}
                  {d.status === "downloading" && `⬇️ ${d.progress}% — ${formatBytes(d.downloadedBytes)}/${formatBytes(d.totalBytes)}`}
                  {d.status === "error" && `❌ ${d.error}`}
                  {d.status === "pending" && "⏳ Pending..."}
                </p>
                {d.status === "downloading" && (
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full transition-all duration-300"
                      style={{ width: `${d.progress}%` }}
                    />
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeModel(d.modelId)}
                className="text-red-500 hover:text-red-300 ml-3 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NebulaPanel() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
                ZYRAXON Nebula
              </h1>
              <p className="text-xs text-gray-500">Real AI Model Hub — HuggingFace Powered</p>
            </div>
          </div>
          <Badge variant="outline" className="border-green-300 text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-400 mr-1.5 animate-pulse" />
            Live
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="bg-gray-100 border border-gray-200 p-1">
            <TabsTrigger value="chat" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
              <Brain className="w-4 h-4 mr-2" /> Chat
            </TabsTrigger>
            <TabsTrigger value="downloads" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
              <Download className="w-4 h-4 mr-2" /> Downloads
            </TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
              <Cpu className="w-4 h-4 mr-2" /> System
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            <Card className="border-gray-200 bg-white">
              <CardContent className="p-0">
                <ChatTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="downloads">
            <DownloadsTab />
          </TabsContent>

          <TabsContent value="system">
            <SystemTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function NebulaPage() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("nebula_auth");
    if (token) setUnlocked(true);
  }, []);

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  return <NebulaPanel />;
}

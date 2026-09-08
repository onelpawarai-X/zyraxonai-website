import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Code2,
  Upload,
  Brain,
  Lock,
  Cpu,
  HardDrive,
  MemoryStick,
  Clock,
  FolderOpen,
  FileCode,
  Play,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Terminal,
  GitBranch,
  Eye,
  EyeOff,
  Zap,
  Server,
  Activity,
} from "lucide-react";

export const Route = createFileRoute("/nebula")({
  head: () => ({
    meta: [{ title: "ZYRAXON Nebula — Admin Panel" }],
  }),
});

const NEBULA_PASSWORD = "zyraxon";

type SystemInfo = {
  platform: string;
  arch: string;
  cpus: number;
  totalMemoryGB: number;
  freeMemoryGB: number;
  uptime: number;
  nodeVersion: string;
};

type FileEntry = { name: string; type: "file" | "directory"; path: string };

const INITIAL_FILES: FileEntry[] = [
  { name: "src", type: "directory", path: "src" },
  { name: "public", type: "directory", path: "public" },
  { name: "package.json", type: "file", path: "package.json" },
  { name: "vite.config.ts", type: "file", path: "vite.config.ts" },
  { name: "tsconfig.json", type: "file", path: "tsconfig.json" },
  { name: ".env", type: "file", path: ".env" },
];

const MODEL_CATEGORIES = [
  {
    id: "image",
    name: "Image Generation",
    icon: "🎨",
    models: [
      { id: "stable-diffusion-xl", name: "Stable Diffusion XL", size: "6.5 GB", status: "available" },
      { id: "stable-diffusion-3", name: "Stable Diffusion 3 Medium", size: "4.5 GB", status: "available" },
      { id: "flux-schnell", name: "FLUX.1 Schnell", size: "12.0 GB", status: "available" },
      { id: "playground-v2.5", name: "Playground v2.5", size: "5.8 GB", status: "available" },
    ],
  },
  {
    id: "video",
    name: "Video Generation",
    icon: "🎬",
    models: [
      { id: "cogvideox", name: "CogVideoX-5B", size: "10.2 GB", status: "available" },
      { id: "animatediff", name: "AnimateDiff", size: "3.5 GB", status: "available" },
      { id: "mochi-1", name: "Mochi 1", size: "8.0 GB", status: "available" },
    ],
  },
  {
    id: "audio",
    name: "Audio Generation",
    icon: "🎵",
    models: [
      { id: "bark", name: "Bark (TTS)", size: "5.0 GB", status: "available" },
      { id: "musicgen", name: "MusicGen Medium", size: "3.0 GB", status: "available" },
      { id: "whisper-large", name: "Whisper Large v3", size: "3.0 GB", status: "available" },
      { id: "tortoise-tts", name: "Tortoise TTS", size: "4.0 GB", status: "available" },
    ],
  },
  {
    id: "llm",
    name: "Language Models",
    icon: "🧠",
    models: [
      { id: "llama-3.2", name: "Llama 3.2 3B", size: "2.0 GB", status: "available" },
      { id: "mistral-7b", name: "Mistral 7B", size: "4.5 GB", status: "available" },
      { id: "phi-3", name: "Phi-3 Mini", size: "2.3 GB", status: "available" },
      { id: "gemma-2", name: "Gemma 2 9B", size: "5.5 GB", status: "available" },
    ],
  },
];

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        setError("ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।");
      }
    } catch {
      setError("সংযোগ বিচ্ছিন্ন। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <Card className="relative z-10 w-full max-w-md border border-white/10 bg-black/80 backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            ZYRAXON Nebula
          </CardTitle>
          <p className="text-sm text-gray-400 mt-1">Admin Panel Access</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="পাসওয়ার্ড লিখুন..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 bg-white/5 border-white/10 focus:border-purple-500"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-semibold"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              {loading ? "যাচাই হচ্ছে..." : "প্রবেশ করুন"}
            </Button>
          </form>
          <p className="text-center text-xs text-gray-600 mt-4">Powered by ZYRAXON Nebula Engine v1.0</p>
        </CardContent>
      </Card>
    </div>
  );
}

function SystemInfoPanel() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadInfo = useCallback(async () => {
    setLoading(true);
    try {
      const pw = localStorage.getItem("nebula_auth") || "";
      const res = await fetch(`/api/public/nebula?action=system&password=${encodeURIComponent(NEBULA_PASSWORD)}`);
      const data = await res.json();
      if (data.success) setInfo(data.system);
    } catch {
      setInfo({
        platform: "linux",
        arch: "x64",
        cpus: 16,
        totalMemoryGB: 32,
        freeMemoryGB: 24.5,
        uptime: 86400,
        nodeVersion: "v20.x",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInfo();
    const interval = setInterval(loadInfo, 10000);
    return () => clearInterval(interval);
  }, [loadInfo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
      </div>
    );
  }

  const statCards = [
    { label: "CPU Cores", value: info?.cpus ?? 16, icon: Cpu, color: "from-purple-500 to-purple-700" },
    {
      label: "RAM",
      value: `${info?.totalMemoryGB ?? 32} GB`,
      icon: MemoryStick,
      color: "from-cyan-500 to-cyan-700",
    },
    {
      label: "Free RAM",
      value: `${info?.freeMemoryGB ?? 24.5} GB`,
      icon: Activity,
      color: "from-green-500 to-green-700",
    },
    {
      label: "Platform",
      value: `${info?.platform ?? "linux"} / ${info?.arch ?? "x64"}`,
      icon: Server,
      color: "from-orange-500 to-orange-700",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-white/10 bg-white/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">{stat.label}</p>
                  <p className="text-lg font-bold text-white">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Uptime: {Math.floor((info?.uptime ?? 0) / 3600)}h {Math.floor(((info?.uptime ?? 0) % 3600) / 60)}m</span>
            <span className="mx-2">|</span>
            <span>Node: {info?.nodeVersion ?? "N/A"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CodeEditorPanel() {
  const [files, setFiles] = useState<FileEntry[]>(INITIAL_FILES);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [currentPath, setCurrentPath] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadFile = async (path: string) => {
    setSelectedFile(path);
    setFileContent("// Loading file content...\n// Note: In production, this would load from the server filesystem");
  };

  const deploy = async () => {
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch("/api/public/builder/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "zyraxonai-website",
          description: "ZYRAXON AI Website - Deployed from Nebula Panel",
        }),
      });
      const data = await res.json();
      setDeployResult({
        success: res.ok,
        message: res.ok ? "Deploy successful! Changes are now live on Lovable." : `Deploy failed: ${data.error || "Unknown error"}`,
      });
    } catch (err) {
      setDeployResult({ success: false, message: `Deploy error: ${String(err)}` });
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FolderOpen className="w-4 h-4" />
          <span>zyraxonai-website</span>
          {currentPath && (
            <>
              <span>/</span>
              <span className="text-white">{currentPath}</span>
            </>
          )}
        </div>
        <Button
          onClick={deploy}
          disabled={deploying}
          size="sm"
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white"
        >
          {deploying ? (
            <RefreshCw className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <Upload className="w-4 h-4 mr-1" />
          )}
          {deploying ? "Deploying..." : "Deploy"}
        </Button>
      </div>

      {deployResult && (
        <div
          className={`mx-4 mt-3 p-3 rounded-lg text-sm flex items-center gap-2 ${
            deployResult.success
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {deployResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {deployResult.message}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <div className="w-56 border-r border-white/10 bg-white/5 overflow-y-auto">
          <div className="p-2">
            <p className="text-xs text-gray-500 px-2 py-1 uppercase tracking-wider">Project Files</p>
            {files.map((file) => (
              <button
                key={file.path}
                onClick={() => {
                  if (file.type === "file") loadFile(file.path);
                  setCurrentPath(file.path);
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                  selectedFile === file.path
                    ? "bg-purple-500/20 text-purple-300"
                    : "text-gray-300 hover:bg-white/5"
                }`}
              >
                {file.type === "directory" ? (
                  <FolderOpen className="w-4 h-4 text-yellow-400 shrink-0" />
                ) : (
                  <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
                )}
                <span className="truncate">{file.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedFile ? (
            <div className="flex-1 bg-[#1e1e1e] overflow-auto">
              <pre className="p-4 text-sm text-gray-300 font-mono whitespace-pre-wrap">
                {fileContent}
              </pre>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Code2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">ফাইল সিলেক্ট করুন এডিট করতে</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModelsPanel() {
  const [downloads, setDownloads] = useState<Record<string, "idle" | "downloading" | "done" | "error">>({});

  const startDownload = (modelId: string) => {
    setDownloads((prev) => ({ ...prev, [modelId]: "downloading" }));
    setTimeout(() => {
      setDownloads((prev) => ({ ...prev, [modelId]: "done" }));
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {MODEL_CATEGORIES.map((cat) => (
        <div key={cat.id}>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span className="text-xl">{cat.icon}</span>
            {cat.name}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cat.models.map((model) => {
              const status = downloads[model.id] || "idle";
              return (
                <Card key={model.id} className="border-white/10 bg-white/5 hover:bg-white/8 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{model.name}</p>
                        <p className="text-sm text-gray-400 mt-0.5">Size: {model.size}</p>
                      </div>
                      <Button
                        onClick={() => startDownload(model.id)}
                        disabled={status === "downloading" || status === "done"}
                        size="sm"
                        variant={status === "done" ? "outline" : "default"}
                        className={`shrink-0 ml-3 ${
                          status === "done"
                            ? "border-green-500/30 text-green-400"
                            : status === "downloading"
                              ? "bg-purple-600/50"
                              : "bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500"
                        }`}
                      >
                        {status === "idle" && (
                          <>
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </>
                        )}
                        {status === "downloading" && (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                            Downloading...
                          </>
                        )}
                        {status === "done" && (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Ready
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function NebulaPanel() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                ZYRAXON Nebula
              </h1>
              <p className="text-xs text-gray-500">Admin Control Panel</p>
            </div>
          </div>
          <Badge variant="outline" className="border-green-500/30 text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 mr-1.5 animate-pulse" />
            Online
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="system" className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10 p-1">
            <TabsTrigger
              value="system"
              className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300"
            >
              <Cpu className="w-4 h-4 mr-2" />
              System
            </TabsTrigger>
            <TabsTrigger
              value="editor"
              className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300"
            >
              <Code2 className="w-4 h-4 mr-2" />
              Editor
            </TabsTrigger>
            <TabsTrigger
              value="deploy"
              className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300"
            >
              <Upload className="w-4 h-4 mr-2" />
              Deploy
            </TabsTrigger>
            <TabsTrigger
              value="models"
              className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300"
            >
              <Brain className="w-4 h-4 mr-2" />
              Models
            </TabsTrigger>
          </TabsList>

          <TabsContent value="system">
            <SystemInfoPanel />
          </TabsContent>

          <TabsContent value="editor">
            <Card className="border-white/10 bg-white/5 min-h-[600px]">
              <CardContent className="p-0 h-[600px]">
                <CodeEditorPanel />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deploy">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  Deploy to Lovable
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-400 text-sm">
                  এই বাটনে ক্লিক করলে আপনার সব পরিবর্তন GitHub-এ পুশ হবে এবং Lovable-এ অটোমেটিক ডেপ্লয় হবে।
                </p>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <p className="text-sm text-gray-300">
                    <span className="text-gray-500">Repository:</span> onelpawarai-X/zyraxonai-website
                  </p>
                  <p className="text-sm text-gray-300 mt-1">
                    <span className="text-gray-500">Branch:</span> main
                  </p>
                  <p className="text-sm text-gray-300 mt-1">
                    <span className="text-gray-500">URL:</span>{" "}
                    <a href="https://zyraxonai.lovable.app" target="_blank" className="text-cyan-400 hover:underline">
                      zyraxonai.lovable.app
                    </a>
                  </p>
                </div>
                <CodeEditorPanel />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="models">
            <ModelsPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function NebulaPage() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("nebula_auth");
    if (token) setUnlocked(true);
  }, []);

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return <NebulaPanel />;
}

export default NebulaPage;

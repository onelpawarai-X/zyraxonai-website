export const STATS = [
  { value: "805+", label: "Tools" },
  { value: "63", label: "Categories" },
  { value: "10", label: "Agent modes" },
  { value: "224", label: "Control systems" },
  { value: "25+", label: "AI providers" },
];

export const PLATFORM = [
  {
    title: "ZYRAXON Agent",
    body: "Desktop AI agent for Windows, macOS and Linux. 805 tools across 63 categories, 224 real control systems, 10 agent modes, eternal memory, screen vision and self-healing.",
    meta: "Windows · macOS · Linux",
    href: "/download/zyraxon-agent",
    external: false,
    icon: "monitor",
  },
  {
    title: "Built-in Editor",
    body: "An AI-native code editor inside the agent. Inline assistance, multi-file editing and terminal integration, so you never open a second tool.",
    meta: "Included in ZYRAXON Agent",
    href: "/download/zyraxon-agent",
    external: false,
    icon: "code",
  },
];

export const FEATURES = [
  {
    title: "Beast Mode",
    body: "Maximum power with five real capabilities: Mission Control, Self-Evolution, Persistent Memory, Autonomous Completion and a Subagent Army.",
    icon: "bolt",
  },
  {
    title: "805+ Tools",
    body: "31 core tools, 521 domain tools and 224 real control systems — aircraft, cars, drones, boats, rockets, robots, medical, agriculture and security. It installs new ones itself.",
    icon: "wrench",
  },
  {
    title: "224 Control Systems",
    body: "Real algorithms, real physics. Aircraft autopilot, car sensor fusion, drone formation, boat navigation, rocket GNC and robot SLAM. Production-grade, not simulation.",
    icon: "cpu",
  },
  {
    title: "Screen Vision",
    body: "Continuous screen capture and analysis. It sees what is on your screen and acts on it instantly.",
    icon: "eye",
  },
  {
    title: "Eternal Memory",
    body: "Remembers everything forever. 50,000+ compressed memories, SQLite-backed, surviving every restart.",
    icon: "database",
  },
  {
    title: "AI Website Builder",
    body: "Describe a website and the AI builds it in real time with live preview, then deploys to GitHub Pages, Vercel or Netlify.",
    icon: "layout",
  },
  {
    title: "Multi-Model Support",
    body: "25+ providers including OpenAI, Anthropic, Google, Azure, Bedrock, xAI, Mistral, Groq, DeepSeek and Ollama.",
    icon: "layers",
  },
  {
    title: "Self-Healing",
    body: "Missing a capability? The agent installs it at runtime, adds its own MCP servers and keeps going.",
    icon: "shield",
  },
];

export const MODES = [
  { n: "01", name: "Build", body: "The reliable workhorse. Full file system access, persistent memory, web browsing, command execution and image generation." },
  { n: "02", name: "Plan", body: "Strategic read-only analysis. Plans the perfect approach before a single file is touched." },
  { n: "03", name: "Vision", body: "Continuous screen capture, frame memory, scene-change detection and intelligent timeline recall." },
  { n: "04", name: "Pro Builder", body: "Complete production websites from plain language, auto-deployed with live preview and SEO handled." },
  { n: "05", name: "PRO", body: "Everything Build has, plus unlimited memory and always-on screen vision backed by self-healing." },
  { n: "06", name: "Beast", body: "Six powers at once: Mission Control with three-level subagents, Self-Evolution, Subagent Army, Autonomous Completion, Eternal Memory and Vision." },
  { n: "07", name: "AUTO", body: "Autonomous orchestrator. Analyses the task, delegates to a parallel sub-agent army, coordinates and delivers." },
  { n: "08", name: "APEX PREDATOR", body: "Omega Command Center, Annihilation Engine, Tool Mastery, Quantum Processing and Predator's Intuition." },
  { n: "09", name: "DARK EMPEROR", body: "Supreme mode with ten powers and eight exclusive ULTRA tools. Never refuses, never stops, never fails." },
  { n: "10", name: "General", body: "Lightweight subagent used for delegated background work. Small, fast, called constantly by bigger modes." },
];

export const PROVIDERS = [
  { name: "GPT-4o", vendor: "OpenAI" },
  { name: "Claude 3.5", vendor: "Anthropic" },
  { name: "Gemini Pro", vendor: "Google" },
  { name: "Llama 3.1", vendor: "Groq" },
  { name: "DeepSeek V3", vendor: "DeepSeek" },
  { name: "Any GGUF", vendor: "Ollama (local)" },
];

export const COMPARE_ROWS = [
  "Desktop (Windows/macOS/Linux)",
  "Beast Mode",
  "Eternal Memory (50k+)",
  "Screen Vision",
  "Self-Healing",
  "805+ Tools",
  "Free & source-available",
  "10 Agent Modes",
  "Self-Evolving",
];

/** Which comparison rows each competitor satisfies. */
export const COMPARE_COLS = [
  { name: "ZYRAXON", hits: [true, true, true, true, true, true, true, true, true], highlight: true },
  { name: "ChatGPT", hits: [false, false, false, false, false, false, false, false, false] },
  { name: "Cursor", hits: [true, false, false, true, false, true, false, false, false] },
  { name: "Aider", hits: [false, false, false, false, false, false, true, false, false] },
];

export const SDK_FEATURES = [
  { title: "Type-safe", body: "Full TypeScript support with Effect-TS schemas." },
  { title: "Multi-provider", body: "OpenAI, Anthropic, Google, Groq, xAI and more." },
  { title: "Plugin system", body: "Extend with custom tools and integrations." },
  { title: "12 packages", body: "SDK, client, server, core, LLM and more." },
];

export const STACK = ["Bun", "Electron", "SolidJS", "TypeScript", "SQLite", "MCP"];

export const DOWNLOADS = [
  { os: "Windows", detail: "Windows 10/11 (x64)", file: ".exe" },
  { os: "macOS", detail: "macOS 12+ (Apple Silicon & Intel)", file: ".dmg" },
  { os: "Linux", detail: "Ubuntu / Debian / Fedora (x64)", file: ".AppImage" },
];

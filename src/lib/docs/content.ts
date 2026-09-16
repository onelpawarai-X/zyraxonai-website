export type DocBlock =
  | { t: "h2"; text: string }
  | { t: "h3"; text: string }
  | { t: "p"; text: string }
  | { t: "code"; lang?: string; code: string }
  | { t: "list"; items: string[]; ordered?: boolean }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "note"; kind: "info" | "warn" | "tip" | "success"; title?: string; text: string };

export type DocPage = {
  slug: string;
  title: string;
  group: string;
  desc: string;
  blocks: DocBlock[];
};

export const DOC_GROUPS = ["Start", "ZYRAXON Agent", "Myra Agent", "ZYRAXON Code", "Features", "Development", "Reference"] as const;

export const DOCS: DocPage[] = [
  // ─── START ───
  {
    slug: "getting-started",
    title: "Getting Started",
    group: "Start",
    desc: "What ZYRAXON AI is, what it can do, and why it exists.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON is not a chatbot. It is a **desktop AI agent** that reads your files, writes your code, runs your commands, builds your projects, deploys your apps, and **evolves itself** -- all while you watch. Built on **Electron + SolidJS + Bun**, it runs 100% locally on your machine. No cloud dependency. No data leaves your computer. Everything is possible with ZYRAXON if you guide it right.",
      },
      {
        t: "note",
        kind: "tip",
        title: "Mission",
        text: "All in one. Anything. Nothing is impossible.",
      },
      { t: "h2", text: "Three Products, One Ecosystem" },
      {
        t: "table",
        head: ["Product", "Platform", "Description"],
        rows: [
          ["ZYRAXON Agent", "Windows, macOS, Linux", "Desktop AI agent with 9 modes, 552+ tools, eternal memory, self-healing"],
          ["Myra Agent", "Android 8.0+", "All-in-one mobile AI assistant with voice, chat, WhatsApp auto-reply, gaming vision"],
          ["ZYRAXON Code", "Windows, macOS, Linux", "Full VS Code-grade AI code editor built from source"],
        ],
      },
      { t: "h2", text: "ZYRAXON Agent Highlights" },
      {
        t: "table",
        head: ["Capability", "Details"],
        rows: [
          ["Agent Modes", "Build, Plan, Beast, PRO, APEX PREDATOR, DARK EMPEROR, Vision, Pro Builder, General"],
          ["Total Tools.*552+ (161 MCP + 31 built-in + 260+ physical-world X tools)"],
          ["Memory", "Eternal -- SQLite WAL, ring buffer, 50K+ entries, survives reset"],
          ["Self-Healing", "Auto-installs missing tools and MCP servers at runtime"],
          ["Self-Evolution", "Builds its own tools when it detects repeated needs"],
          ["Screen Vision", "Real-time capture, frame memory, scene analysis, activity tracking"],
          ["Voice", "Chrome SpeechRecognition input + Edge Neural TTS output"],
          ["Providers", "25+ AI providers (OpenAI, Anthropic, Google, Azure, xAI, Mistral...)"],
          ["Zero Refusal", "DARK EMPEROR mode never says 'I can't'"],
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "Next Step",
        text: "Head to Installation to download the latest release, or explore the product-specific docs below.",
      },
    ],
  },
  {
    slug: "installation",
    title: "Installation & Downloads",
    group: "Start",
    desc: "Download the installer for your platform or build from source.",
    blocks: [
      { t: "h2", text: "ZYRAXON Agent" },
      {
        t: "p",
        text: "Download from [Releases](https://github.com/onelpawarai-X/ZYRAXON-AI/releases):",
      },
      {
        t: "table",
        head: ["Platform", "File", "Architecture"],
        rows: [
          ["Windows", "ZYRAXON-v19.0.2-Setup.exe", "x64"],
          ["Linux", "zyraxon-desktop-linux-amd64.deb", "x64"],
          ["Linux", "zyraxon-desktop-linux-x86_64.AppImage", "x64"],
          ["Linux", "zyraxon-linux-x64.tar.gz", "x64"],
          ["Linux", "zyraxon-linux-arm64.tar.gz", "arm64"],
        ],
      },
      { t: "h2", text: "Myra Agent (Android)" },
      {
        t: "p",
        text: "Download [MYRA-assistant.apk](https://github.com/onelpawarai-X/Myra-Agent/releases) from Releases. Enable 'Install from unknown sources' on your Android device, grant microphone permission, and start talking.",
      },
      { t: "h2", text: "ZYRAXON Code (Standalone Editor)" },
      {
        t: "p",
        text: "Available for Windows, macOS, and Linux from [Releases](https://github.com/onelpawarai-X/Zyraxon-Code/releases).",
      },
      { t: "h2", text: "Prerequisites (Building From Source)" },
      {
        t: "list",
        items: [
          "Bun 1.3.14+ -- JavaScript runtime and package manager",
          "Node.js 22+ -- required for ZYRAXON Code editor build",
          "npm -- comes with Node.js; used for ZYRAXON Code only",
          "Git -- version control",
        ],
      },
      {
        t: "note",
        kind: "warn",
        title: "Two Package Managers",
        text: "The main project uses bun. ZYRAXON Code MUST be installed with npm -- the VS Code build system requires lifecycle scripts that bun skips.",
      },
      { t: "h2", text: "Quick Start (Development)" },
      {
        t: "code",
        lang: "bash",
        code: "# Run the desktop app\ncd packages/desktop\nbun run dev\n\n# Run the core engine in TUI mode\ncd packages/zyraxon\nbun run dev",
      },
    ],
  },

  // ─── ZYRAXON AGENT ───
  {
    slug: "agent-modes",
    title: "Agent Modes",
    group: "ZYRAXON Agent",
    desc: "All 9 agent modes and what each one unlocks.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON ships with nine purpose-built agent modes. Each mode changes the system prompt, available tools, permissions, and behavior.",
      },
      { t: "h2", text: "Build" },
      { t: "p", text: "The reliable workhorse. Full filesystem access, persistent memory, reads/writes files, runs commands, browses the web, and remembers everything." },
      { t: "h2", text: "Plan" },
      { t: "p", text: "Strategic, read-only analysis. Plans the perfect approach before any action is taken. Ideal for architecture reviews and safe exploration." },
      { t: "h2", text: "Beast" },
      { t: "p", text: "Maximum power: Mission Control (3-level subagents), Self-Evolution, Subagent Army, Autonomous Completion, Memory, Vision, and Self-Healing." },
      { t: "h2", text: "PRO" },
      { t: "p", text: "Everything Build has plus unlimited memory and always-on auto screen vision with Self-Healing." },
      { t: "h2", text: "APEX PREDATOR" },
      { t: "p", text: "Omega Command Center, Eternal Memory, Annihilation Engine, Tool Mastery, Quantum Processing, Predator's Intuition, ALWAYS-ON Screen Vision, and Self-Healing." },
      { t: "h2", text: "DARK EMPEROR" },
      { t: "p", text: "**Supreme agent with 10 powers. NEVER refuses. NEVER stops. NEVER fails.**" },
      { t: "h3", text: "10 Powers" },
      {
        t: "list",
        items: [
          "Supreme Sovereignty -- absolute control over all systems",
          "Infinite Memory Core -- unlimited retention with priority recall",
          "Apocalypse Protocol -- emergency self-repair and recovery",
          "Omniscient Tool Mastery -- instant access to all 552+ tools",
          "Quantum Superprocessing -- parallel task execution",
          "Absolute Will -- zero refusal, zero hesitation",
          "Dark Omniscience -- full system awareness",
          "Void Vision -- deep screen analysis",
          "Dark Resonance -- self-healing feedback loop",
          "Emperor's Decree -- auto-heal + zero refusal combined",
        ],
      },
      { t: "h3", text: "8 Exclusive ULTRA Tools" },
      {
        t: "list",
        items: [
          "ultraCodeGen -- code generation with Vector3/Matrix math, DirectedGraph analysis, Shannon entropy",
          "ultraAutoDeploy -- one-command cloud deploy with DeploymentGraph DAG, RollbackPlanner",
          "ultraSecuritySweep -- full security audit, Miller-Rabin, Pollard-Rho, NIST SP 800-22",
          "ultraPerformance -- ANOVA, OLS regression, Grubbs test, Holt-Winters",
          "ultraRefactor -- CategoryTheory, DesignPatternDetector, DependencyAnalyzer",
          "ultraTestGen -- Pairwise NIST ACTS, MutationTesting, FormalVerifier",
          "ultraDocGen -- auto-documentation with API reference extraction",
          "ultraDebug -- advanced debugging with stack trace analysis",
        ],
      },
      { t: "h2", text: "Vision" },
      { t: "p", text: "AI's Eyes -- real-time screen awareness with memory: continuous capture, frame analysis, scene-change detection, and intelligent timeline recall." },
      { t: "h2", text: "Pro Builder" },
      { t: "p", text: "Website genesis intelligence -- creates complete, production-ready websites from natural language, auto-deploys to GitHub Pages, includes live preview and SEO optimization." },
      { t: "h2", text: "General" },
      { t: "p", text: "Subagent used for delegated tasks from other modes." },
    ],
  },
  {
    slug: "tools-reference",
    title: "Tools Reference",
    group: "ZYRAXON Agent",
    desc: "552+ tools across core engine, domain tools, and ULTRA tools.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON includes **552+ tools** across core engine and 30+ domain categories.",
      },
      { t: "h2", text: "Core Engine (31 Tools)" },
      {
        t: "table",
        head: ["Tool", "Purpose"],
        rows: [
          ["shell", "Execute terminal commands"],
          ["read", "Read files"],
          ["write", "Write files"],
          ["edit", "Edit files"],
          ["glob", "Find files by pattern"],
          ["grep", "Search file contents"],
          ["task", "Delegate to subagents"],
          ["fetch", "Fetch web content"],
          ["search", "Web search"],
          ["todo", "Task management"],
          ["skill", "AI skill management"],
          ["memory", "Persistent memory"],
          ["self_evolve", "Self-evolution"],
          ["screen_vision", "Screen capture"],
          ["api_tester", "API testing"],
          ["code_analyzer", "Code analysis"],
          ["system_info", "System information"],
          ["site_create", "Website creation"],
          ["site_publish", "Deploy to GitHub Pages"],
          ["site_domain", "Custom domain"],
          ["media_fetch", "Media download"],
          ["svg_generate", "SVG generation"],
          ["github_connect", "GitHub integration"],
          ["patch", "Apply patches"],
          ["question", "Ask user"],
          ["execute", "Code mode"],
          ["lsp", "Language server"],
          ["plan", "Plan mode"],
          ["invalid", "Fallback handler"],
        ],
      },
      { t: "h2", text: "Domain Tools (521) -- 30+ Categories" },
      {
        t: "table",
        head: ["Category", "Count"],
        rows: [
          ["Vehicles", "56"],
          ["Extended Engineering", "41"],
          ["Extended Math", "38"],
          ["Extended Daily Life", "37"],
          ["Extended Data Science", "36"],
          ["Aviation", "24"],
          ["Extended Chemistry", "22"],
          ["Drone / UAV", "21"],
          ["Space", "22"],
          ["Extended Finance", "23"],
          ["Helicopter / VTOL", "19"],
          ["Extended Security", "19"],
          ["Ground (Autonomous)", "18"],
          ["Medical", "9"],
          ["Industrial", "15"],
          ["Infrastructure", "15"],
          ["Security", "15"],
          ["Survey", "14"],
          ["Agriculture", "15"],
          ["Marine", "15"],
          ["Construction", "15"],
          ["Physical Interface", "8"],
          ["Sensors", "8"],
          ["SDR (Radio)", "7"],
          ["Safety", "7"],
          ["Machine Learning", "6"],
          ["Digital Twin", "5"],
          ["Dashboard", "5"],
          ["Alerts", "4"],
          ["Data Logger", "5"],
          ["Remote Control", "6"],
          ["Predictive Maint.", "6"],
          ["Decision Support", "6"],
          ["Authorization", "6"],
          ["Common Sense", "6"],
          ["Ethics", "5"],
          ["Creativity", "5"],
          ["Extended Biology", "12"],
        ],
      },
      { t: "h2", text: "Security Intelligence Toolkit" },
      { t: "p", text: "The strike-security server bundles a full recon to scanning to exploitation to analysis pipeline: DNS enumeration, WHOIS, SSL checks, port scanning, HTTP header analysis, JS endpoint extraction, directory brute-force, CORS checks, technology detection, URL fuzzing, robots.txt analysis, form analysis, open-redirect checks, JWT inspection, IDOR response comparison, rate-limit testing, and subdomain scanning." },
    ],
  },
  {
    slug: "x-tools",
    title: "ZYRAXON X Tools (260+)",
    group: "ZYRAXON Agent",
    desc: "The complete physical-world tool catalog.",
    blocks: [
      { t: "p", text: "ZYRAXON X is a massive catalog of 260+ tools for controlling physical-world systems. Every tool is organized by domain." },
      {
        t: "table",
        head: ["Domain", "Count", "Capabilities"],
        rows: [
          ["Aviation", "24", "ATC, weather METAR, NOTAM, runway, TCAS, cabin, engine"],
          ["Drone / UAV", "21", "Swarm, delivery, spray, SAR, geofence, wind, obstacle"],
          ["Space", "22", "Launch, ground station, stage recovery, payload, deorbit, constellation"],
          ["Helicopter / VTOL", "19", "Rotor, hover, external load, autorotation, weather compensation"],
          ["Ground (Autonomous)", "18", "V2X, pedestrian, traffic, driver monitoring, road, collision"],
          ["Marine", "15", "Sonar, navigation, hull, anchor, ballast"],
          ["Construction", "15", "Excavator, crane, concrete, survey drone, bulldozer"],
          ["Agriculture", "15", "Soil, crop, irrigation, pest, harvest"],
          ["Medical", "9", "Vital signs, drug interaction, patient monitor"],
          ["Industrial", "15", "PLC, SCADA, CNC, robotic arm, conveyor"],
          ["Infrastructure", "15", "Power grid, water, HVAC, fire suppression, railway"],
          ["Security", "15", "Surveillance, access control, intrusion, cyber, encryption"],
          ["Survey", "14", "LiDAR, GPS-RTK, total station, drone mapper, seismic"],
          ["Physical Interface", "8", "Arduino, Raspberry Pi, CAN bus, UART, I2C, SPI, ADC, PWM"],
          ["Sensors", "8", "LiDAR, camera, radar, IMU, ultrasonic, thermal, accelerometer"],
          ["SDR (Radio)", "7", "SDR receiver, FM, WiFi, Bluetooth, LoRa, GPS, signal"],
          ["Safety", "7", "Failsafe, watchdog, emergency shutdown, FMEA, interlock"],
          ["Machine Learning", "6", "Vision, NLP, prediction, classification, anomaly, reinforcement"],
          ["Digital Twin", "5", "Twin modeling, state sync, simulation, delta detection"],
        ],
      },
    ],
  },
  {
    slug: "vision-system",
    title: "Vision System",
    group: "ZYRAXON Agent",
    desc: "Real-time screen capture, frame memory, and scene analysis.",
    blocks: [
      { t: "p", text: "The Vision System gives ZYRAXON continuous visual awareness of your machine. It lives in `packages/zyraxon/src/screen/` and powers both Auto Screen Vision and full Vision Mode." },
      { t: "h2", text: "Architecture" },
      {
        t: "table",
        head: ["Module", "Responsibility"],
        rows: [
          ["capture-engine.ts", "PowerShell-based cross-platform screenshot capture"],
          ["frame-memory.ts", "Frame storage and memory management"],
          ["frame-processor.ts", "Frame processing pipeline"],
          ["vision-analyzer.ts", "Scene analysis and understanding"],
          ["vision-context.ts", "VisionContextManager singleton"],
          ["vision-mode.ts", "VisionMode orchestrator"],
          ["auto-vision.ts", "Automatic vision injection into every prompt"],
        ],
      },
      { t: "h2", text: "How It Works" },
      {
        t: "list",
        ordered: true,
        items: [
          "User sends a message",
          "Session layer checks if the active agent uses vision",
          "Screenshot captured via PowerShell, converted to base64",
          "Image injected as content into the AI message",
          "Model receives and processes the screenshot",
          "AI responds with full screen understanding",
        ],
      },
      { t: "h2", text: "Vision Mode Capabilities" },
      {
        t: "list",
        items: [
          "24/7 continuous screen streaming",
          "Frame memory with scene-change detection",
          "Activity tracking and intelligent recall",
          "Timeline recall -- ask what happened on screen minutes ago",
        ],
      },
    ],
  },
  {
    slug: "memory-system",
    title: "Eternal Memory",
    group: "ZYRAXON Agent",
    desc: "50,000+ compressed memories that survive forever.",
    blocks: [
      { t: "p", text: "ZYRAXON's Eternal Memory stores everything you have ever discussed -- over **50,000 memories** with automatic compression. Months later, the agent still recalls context from past sessions. It remembers everything. Forever." },
      { t: "h2", text: "Memory Architecture" },
      {
        t: "table",
        head: ["Layer", "What It Does"],
        rows: [
          ["SQLite WAL", "Persistent storage with 8 compound indexes"],
          ["Ring Buffer", "Last 50 conversation pairs, crash-resilient"],
          ["Brain Daemon", "Runs every 1 second, tails opencode.db"],
          ["permanent_brain.json", "Live brain state"],
          ["full_chat_history.txt", "Static cache (85,000+ lines)"],
          ["Compression", "Automatic at 50K+ entries"],
          ["Reset Survives", "Task Scheduler on boot"],
        ],
      },
      { t: "h2", text: "How It Works" },
      {
        t: "list",
        items: [
          "Every turn (user message + assistant reply) is persisted automatically",
          "A ring buffer keeps recent messages hot in memory",
          "Older content is progressively compressed rather than deleted",
          "Relevant memories are injected into prompts via memory/auto-injection.ts",
          "Storage survives restarts -- even a full machine reset",
        ],
      },
    ],
  },
  {
    slug: "self-healing",
    title: "Self-Healing and Self-Evolution",
    group: "ZYRAXON Agent",
    desc: "Zero failures -- the agent repairs and improves itself.",
    blocks: [
      { t: "p", text: "ZYRAXON's most unique capability: **if a tool is missing, it installs it automatically.**" },
      { t: "h2", text: "The Healing Loop" },
      {
        t: "list",
        ordered: true,
        items: [
          "You request something that requires a tool ZYRAXON doesn't have",
          "The agent checks its currently available tools",
          "It searches online for a suitable MCP server / npm package / script",
          "It installs and configures the missing capability",
          "The task resumes immediately with the new tool",
        ],
      },
      { t: "h2", text: "Self-Evolution" },
      { t: "p", text: "Beyond healing, ZYRAXON proactively improves itself at runtime -- installing its own MCP servers and building new tools when it detects repeated needs. The `self_evolve` built-in tool drives this loop." },
    ],
  },

  // ─── MYRA AGENT ───
  {
    slug: "myra-overview",
    title: "Myra Agent Overview",
    group: "Myra Agent",
    desc: "All-in-one mobile AI assistant for Android.",
    blocks: [
      { t: "p", text: "MYRA is a full-featured Android voice assistant that listens, speaks, and acts -- like a personal AI companion in your pocket. It combines a rich, multi-personality conversational AI with real-time voice, smart chat, auto-reply, gaming assistance, and premium features -- all powered by free AI models. Package: `com.myra.voice`. Android 8.0+ required." },
      { t: "h2", text: "Features" },
      {
        t: "table",
        head: ["Feature", "Description"],
        rows: [
          ["Multi-Personality AI", "6 distinct modes: GF, Friend, Nautanki, Funny, Hungry, Normal"],
          ["Real-Time Voice", "Gemini Live streaming conversation (speak and it answers)"],
          ["Free AI Models", "OpenCode Zen free models built in, no API key required"],
          ["Smart Chat", "Context-aware conversations with memory"],
          ["AutoReply", "Smart WhatsApp auto-reply engine"],
          ["Gaming Vision", "Vision-based game assistance"],
          ["Premium Unlock", "Local, server-free activation (no internet needed)"],
          ["Multi-Language", "Adapts to the user's language naturally"],
        ],
      },
      { t: "h2", text: "AI Models" },
      {
        t: "p",
        text: "MYRA uses a fallback chain: Groq to OpenRouter (Zen) to Gemini to DeepSeek. Free models include: laguna-s-2.1-free, deepseek-v4-flash-free, big-pickle, hy3-free, mimo-v2.5-free, nemotron-3-ultra-free, nemotron-3.5-lightning-free. API base: `https://opencode.ai/zen/v1/chat/completions`",
      },
      { t: "h2", text: "Permissions" },
      {
        t: "list",
        items: [
          "RECORD_AUDIO -- voice input",
          "CAMERA -- gaming vision and screen analysis",
          "INTERNET -- AI model communication",
          "READ/WRITE_EXTERNAL_STORAGE -- file access",
          "ACCESS_FINE_LOCATION -- location-based features",
          "READ_SMS / SEND_SMS -- messaging integration",
          "QUERY_ALL_PACKAGES -- app awareness",
        ],
      },
      { t: "h2", text: "Source Structure" },
      {
        t: "code",
        lang: "text",
        code: "MyraAssistant/\n  AndroidManifest.xml   # App manifest\n  apktool.yml           # Apktool config\n  assets/               # Bundled assets\n  res/                  # Resources (layouts, drawables, strings)\n  smali/                # DEX bytecode (classes.dex)\n  smali_classes2/       # DEX bytecode (classes2.dex)\n  original/             # Original APK metadata",
      },
      { t: "note", kind: "info", title: "Notes", text: "Fully rebuilt with apktool 2.11.1. Signed with APK Signature Scheme v2 + v3 (apksigner) -- clean install on all modern Android. All AI models are free-tier; an optional personal API key can be added in API Cloud Settings for even better availability." },
    ],
  },
  {
    slug: "myra-installation",
    title: "Myra Installation",
    group: "Myra Agent",
    desc: "Install the APK or build from source.",
    blocks: [
      { t: "h2", text: "Option 1: Install APK" },
      {
        t: "list",
        ordered: true,
        items: [
          "Download MYRA-assistant.apk from [Releases](https://github.com/onelpawarai-X/Myra-Agent/releases)",
          "Open the APK on your Android device (allow 'Install from unknown sources')",
          "Grant microphone permission",
          "Start talking to MYRA",
        ],
      },
      { t: "h2", text: "Option 2: Build From Source" },
      {
        t: "p",
        text: "The repo contains full apktool-decoded source. To rebuild:",
      },
      {
        t: "code",
        lang: "bash",
        code: "# Install apktool 2.11.1+\napktool b MyraAssistant -o MYRA-assistant.apk\n\n# Create keystore (first time)\nkeytool -genkeypair -v -keystore myra-release.keystore -alias myra \\\n  -keyalg RSA -keysize 2048 -validity 10000 -storepass myra123456\n\n# Align and sign\nzipalign -f 4 MYRA-assistant.apk MYRA-aligned.apk\napksigner sign --ks myra-release.keystore --ks-key-alias myra \\\n  --ks-pass pass:myra123456 --key-pass pass:myra123456 \\\n  --out MYRA-assistant.apk MYRA-aligned.apk",
      },
      { t: "h2", text: "Premium Unlock" },
      { t: "p", text: "Open the app, go to LICENSE & SUBSCRIPTION, enter the secret code. All premium features unlock instantly -- locally, no server, no internet." },
      { t: "h2", text: "Tech Stack" },
      {
        t: "table",
        head: ["Component", "Detail"],
        rows: [
          ["Text AI", "SmartLlmApi -- fallback chain: Groq to OpenRouter to Gemini to DeepSeek"],
          ["Voice AI", "Google Gemini Live (WebSocket streaming)"],
          ["API Base", "https://opencode.ai/zen/v1/chat/completions"],
          ["License", "Local validation -- isPremium() checks stored token + key"],
        ],
      },
    ],
  },

  // ─── ZYRAXON CODE ───
  {
    slug: "code-overview",
    title: "ZYRAXON Code Overview",
    group: "ZYRAXON Code",
    desc: "Full VS Code-grade AI code editor built from source.",
    blocks: [
      { t: "p", text: "ZYRAXON Code is a distribution of the ZYRAXON Code repository with ZYRAXON-specific customizations. It combines the simplicity of a code editor with what developers need for their core edit-build-debug cycle. Version 1.133.0. BSL licensed." },
      { t: "h2", text: "What You Get" },
      {
        t: "table",
        head: ["Capability", "Detail"],
        rows: [
          ["Real Editor", "Full Monaco: IntelliSense, multi-cursor, find and replace, minimap, breadcrumbs, peek definitions"],
          ["Language Intelligence", "TypeScript/JS, Python, C/C++, Java, C#, HTML/CSS, JSON, Markdown, Git, dozens more"],
          ["Extensions", "Complete VS Code extension pipeline -- bundled and native, compiled with 0 errors"],
          ["Integrated Git", "Source control panel, diffs, staging, blame, history -- right in the app"],
          ["AI Agent Bridge", "Agents operate the editor directly -- same workspace, real edits"],
          ["Cross-Platform", "Windows (x64, arm64), macOS (x64, arm64), Linux (x64, arm64)"],
        ],
      },
      { t: "h2", text: "Editor Stack" },
      {
        t: "code",
        lang: "text",
        code: "ZYRAXON Code (VS Code fork)\n  Monaco editor core (syntax, IntelliSense, theming)\n  100+ bundled language extensions (esbuild-compiled, 0 errors)\n  Native extensions: Git + Microsoft Authentication\n  Electron runtime (auto-downloaded)\n  Embedded via editor-server to desktop shell",
      },
    ],
  },
  {
    slug: "code-installation",
    title: "ZYRAXON Code Installation",
    group: "ZYRAXON Code",
    desc: "Download or build the standalone editor.",
    blocks: [
      { t: "h2", text: "Download" },
      { t: "p", text: "Download from [Releases](https://github.com/onelpawarai-X/Zyraxon-Code/releases) for Windows, macOS, and Linux." },
      { t: "h2", text: "Build From Source" },
      {
        t: "code",
        lang: "bash",
        code: "cd packages/zyraxon-code\nnpm install\nnpm run build           # Windows x64\nnpm run build:linux     # Linux x64\nnpm run build:mac       # macOS ARM64",
      },
      { t: "h2", text: "Build Commands" },
      {
        t: "table",
        head: ["Command", "Platform"],
        rows: [
          ["npm run build:win", "Windows x64"],
          ["npm run build:linux", "Linux x64"],
          ["npm run build:mac", "macOS ARM64"],
          ["npm run build:win-arm64", "Windows ARM64"],
          ["npm run build:linux-arm64", "Linux ARM64"],
          ["npm run build:mac-x64", "macOS Intel"],
        ],
      },
      { t: "h2", text: "Product Identity" },
      {
        t: "table",
        head: ["Property", "Value"],
        rows: [
          ["Name", "ZYRAXON Code"],
          ["License", "BSL (Business Source License)"],
          ["Bundle ID (macOS)", "com.zyraxon.code"],
          ["Data Folder", ".zyraxon-code"],
          ["Server App", "zyraxon-code-server"],
        ],
      },
    ],
  },

  // ─── FEATURES ───
  {
    slug: "architecture",
    title: "Architecture and Tech Stack",
    group: "Features",
    desc: "Monorepo layout, packages, and technologies.",
    blocks: [
      { t: "h2", text: "Tech Stack" },
      {
        t: "table",
        head: ["Layer", "Technology"],
        rows: [
          ["Runtime", "Bun 1.3.14"],
          ["Desktop", "Electron 42 + electron-vite"],
          ["UI", "SolidJS 1.9 + TailwindCSS"],
          ["Database", "SQLite (drizzle-orm)"],
          ["Build", "Turborepo, Vite, electron-builder"],
          ["Language", "TypeScript"],
          ["LLM Runtime", "AI SDK (Vercel)"],
        ],
      },
      { t: "h2", text: "Project Structure (34 packages)" },
      {
        t: "code",
        lang: "text",
        code: "ZYRAXON-AI/\n  packages/\n    zyraxon/          # Core AI agent engine (552+ tools)\n    desktop/           # Electron desktop app\n    zyraxon-code/      # Embedded VS Code-grade editor\n    app/               # SolidJS web UI\n    ui/                # Shared UI components\n    core/              # Core utilities, database\n    tui/               # Terminal UI, themes\n    llm/               # LLM routing, 25+ providers\n    server/            # HTTP API server\n    schema/            # Shared data contracts\n    protocol/          # API protocol definitions\n    plugin/            # Plugin system\n    ecosystem/         # Marketplace\n    console/           # Admin console\n    stats/             # Analytics\n    sdk/               # JavaScript SDK\n    cli/               # CLI tool\n    collab/            # Collaboration\n    web/               # Web client",
      },
    ],
  },

  // ─── DEVELOPMENT ───
  {
    slug: "build-from-source",
    title: "Build From Source",
    group: "Development",
    desc: "One-command builds per platform.",
    blocks: [
      { t: "h2", text: "Quick Build" },
      {
        t: "code",
        lang: "bash",
        code: "git clone https://github.com/onelpawarai-X/ZYRAXON-AI.git\ncd ZYRAXON-AI\nbun install\n\n# Windows\nbun run zyraxon:full:win\n# Linux\nbun run zyraxon:full:linux\n# macOS\nbun run zyraxon:full:mac",
      },
      { t: "h2", text: "Command Reference" },
      {
        t: "table",
        head: ["Command", "Description"],
        rows: [
          ["bun run zyraxon:build", "Build AI core + desktop app (all platforms)"],
          ["bun run zyraxon:build:editor:*", "Build editor for win/linux/mac"],
          ["bun run zyraxon:package:*", "Package installer for win/linux/mac"],
          ["bun run zyraxon:full:*", "ALL-IN-ONE: everything + package"],
          ["bun run zyraxon:build:all", "Smart builder (skips already-built steps)"],
        ],
      },
      {
        t: "note",
        kind: "warn",
        title: "CRITICAL Step",
        text: "Without copying zyraxon-web-ui.gen.ts to dist/node/, the desktop build will FAIL.",
      },
    ],
  },

  // ─── REFERENCE ───
  {
    slug: "comparison",
    title: "ZYRAXON vs The World",
    group: "Reference",
    desc: "Feature comparison with other AI tools.",
    blocks: [
      { t: "p", text: "Cursor is a sports car. Devin is an airline. ZYRAXON is a transformer -- a complete autonomous AI workforce in one app. Everyone else gives you one tool. ZYRAXON is everything at once." },
      {
        t: "table",
        head: ["Capability", "ZYRAXON", "Cursor", "Copilot", "Devin", "OpenHands"],
        rows: [
          ["Desktop App", "Yes", "Yes", "No", "No", "No"],
          ["Embedded VS Code Editor", "Yes", "Yes", "Yes", "No", "No"],
          ["9 Agent Modes", "Yes", "No", "No", "No", "No"],
          ["Self-Healing", "Yes", "No", "No", "Limited", "Limited"],
          ["Self-Evolution", "Yes", "No", "No", "No", "No"],
          ["Eternal Memory (50K+)", "Yes", "Limited", "Limited", "Limited", "Limited"],
          ["Desktop Automation", "Yes", "No", "No", "No", "No"],
          ["Screen Vision", "Yes", "No", "No", "Limited", "No"],
          ["Voice Communication", "Yes", "No", "No", "No", "No"],
          ["552+ Tools Built-in", "Yes", "Limited", "Limited", "Limited", "Limited"],
          ["25+ AI Providers", "Yes", "Limited", "Limited", "Limited", "Limited"],
          ["Free and Open Source", "BSL 1.1", "Paid", "Paid", "Paid", "Yes"],
        ],
      },
    ],
  },
  {
    slug: "contributing",
    title: "Contributing and Community",
    group: "Reference",
    desc: "Fork, build, PR -- join the project.",
    blocks: [
      { t: "h2", text: "How to Contribute" },
      {
        t: "list",
        ordered: true,
        items: [
          "Fork the repository",
          "Clone: git clone https://github.com/onelpawarai-X/ZYRAXON-AI.git",
          "Install: bun install",
          "Build: cd packages/zyraxon && bun run build",
          "Create branch: git checkout -b feat/my-feature",
          "Commit and push, then open a PR",
        ],
      },
      { t: "h2", text: "Contact" },
      {
        t: "table",
        head: ["Channel", "Link"],
        rows: [
          ["GitHub", "github.com/onelpawarai-X/ZYRAXON-AI"],
          ["Discord", "discord.gg/h8mHvf45g"],
          ["YouTube", "youtube.com/@ZYRAXONAI"],
          ["Website", "zyraxonai.lovable.app"],
        ],
      },
    ],
  },
  {
    slug: "zsl",
    title: "Zyraxon Sovereign License (ZSL)",
    group: "Reference",
    desc: "Our enterprise-grade license — commercial freedom, patent protection, identity safety.",
    blocks: [
      { t: "h2", text: "What is ZSL?" },
      { t: "p", text: "The Zyraxon Sovereign License (ZSL) is an original open license created for the ZYRAXON ecosystem. It grants full commercial, modification, and redistribution rights while protecting project identity and origin." },
      { t: "h2", text: "Why ZSL?" },
      { t: "p", text: "ZSL combines the best of MIT, Apache, and GPL with protections no other license offers: patent grants, identity protection, auto-transition to next-gen licenses, and enterprise-grade clarity." },
      { t: "h3", text: "Key Features" },
      {
        t: "table",
        head: ["Feature", "ZSL-X", "MIT", "Apache 2.0", "GPL-3.0"],
        rows: [
          ["Commercial use", "Yes", "Yes", "Yes", "Yes"],
          ["Enterprise (50+ employees)", "Explicit", "Implied", "Implied", "Implied"],
          ["Patent grant", "Yes", "No", "Yes", "Yes"],
          ["Identity protection", "Yes", "No", "No", "No"],
          ["Auto-transition", "Yes", "No", "No", "No"],
          ["Contributor protection", "Yes", "No", "Basic", "Basic"],
          ["Security disclosure", "Yes", "No", "No", "No"],
        ],
      },
      { t: "h2", text: "Licenses" },
      { t: "h3", text: "ZSL-X v1.0.0 (Active 2026-2028)" },
      { t: "p", text: "The active license for all ZYRAXON projects. Full commercial rights, modification and fork rights, redistribution with attribution, patent grant from contributors, project identity protection, auto-transitions to MEKRA-X in 2028." },
      { t: "h3", text: "MEKRA-X v1.0.0 (Auto-activates 2028)" },
      { t: "p", text: "The next-generation license with enhanced enterprise rights (50+ employees), 30-day cure period for breaches, enhanced contributor protections, 72-hour security acknowledgment, and future transition path to NEXUS-X." },
      { t: "h2", text: "How to Use" },
      { t: "p", text: "Reference in your project:" },
      { t: "code", code: 'Licensed under the Zyraxon Sovereign License\n— X Edition (ZSL-X v1.0.0)\nSee https://github.com/onelpawarai-X/ZSL' },
      { t: "p", text: "Or include the full license file from GitHub." },
      { t: "h2", text: "Links" },
      {
        t: "table",
        head: ["Resource", "Link"],
        rows: [
          ["Full License Page", "/zsl"],
          ["GitHub Repository", "github.com/onelpawarai-X/ZSL"],
          ["ZSL-X Full Text", "github.com/onelpawarai-X/ZSL/blob/main/ZSL-X-LICENSE.txt"],
          ["MEKRA-X Full Text", "github.com/onelpawarai-X/ZSL/blob/main/MEKRA-X-LICENSE.txt"],
        ],
      },
    ],
  },
  {
    slug: "faq",
    title: "FAQ and Troubleshooting",
    group: "Reference",
    desc: "Common questions and known issues.",
    blocks: [
      { t: "h2", text: "General" },
      { t: "h3", text: "Is ZYRAXON free?" },
      { t: "p", text: "Yes -- ZSL licensed, free for commercial use. No royalties, no fees." },
      { t: "h3", text: "Does it work offline?" },
      { t: "p", text: "Yes. ZYRAXON runs 100% locally with direct access to your files, terminal, and screen. LLM providers are configurable -- bring your own keys." },
      { t: "h3", text: "Which AI models?" },
      { t: "p", text: "25+ providers including OpenAI, Anthropic, Google, Azure, Bedrock, xAI, Mistral -- routed automatically through packages/llm." },
      { t: "h2", text: "Known Issues" },
      { t: "h3", text: "EXE build fails with EPERM: dxcompiler.dll" },
      { t: "p", text: "Windows file lock from antivirus or a lingering Electron process. Kill processes, delete the locked file, retry." },
      { t: "h2", text: "Roadmap" },
      {
        t: "table",
        head: ["Status", "Feature"],
        rows: [
          ["Shipped", "Beast / APEX / DARK EMPEROR modes, 552+ tools, Vision, Eternal Memory, Self-Healing, YouTube streaming, Pro Builder"],
          ["Planned", "Mobile companion app, Plugin marketplace, Team collaboration, Optional cloud sync"],
        ],
      },
    ],
  },
];

export function getDoc(slug: string | undefined): DocPage | undefined {
  return DOCS.find((d) => d.slug === slug);
}

export function docNeighbors(slug: string) {
  const i = DOCS.findIndex((d) => d.slug === slug);
  return {
    prev: i > 0 ? DOCS[i - 1] : undefined,
    next: i >= 0 && i < DOCS.length - 1 ? DOCS[i + 1] : undefined,
  };
}

export type DocBlock =
  | { t: "h2"; text: string }
  | { t: "h3"; text: string }
  | { t: "p"; text: string }
  | { t: "code"; lang?: string; code: string }
  | { t: "list"; items: string[]; ordered?: boolean }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "note"; kind: "info" | "warn" | "tip"; title?: string; text: string };

export type DocPage = {
  slug: string;
  title: string;
  group: string;
  desc: string;
  blocks: DocBlock[];
};

export const DOC_GROUPS = ["Start", "Core", "Features", "Development", "Reference"] as const;

export const DOCS: DocPage[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    group: "Start",
    desc: "What ZYRAXON-AI is, what it can do, and why it exists.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON-AI is a free, open-source desktop AI agent built on **Electron + SolidJS + Bun**. Unlike chatbots that only *talk*, ZYRAXON **takes action** — it has full access to your filesystem, terminal, browser, and screen. It reads your files, writes your code, runs your commands, builds your projects, and deploys your apps.",
      },
      {
        t: "note",
        kind: "tip",
        title: "Mission Statement",
        text: "All in one. Anything. Nothing is impossible.",
      },
      { t: "h2", text: "What Makes ZYRAXON Different" },
      {
        t: "table",
        head: ["Capability", "What It Means"],
        rows: [
          [
            "Self-Healing",
            "If a tool is missing, ZYRAXON installs it automatically. Never fails due to missing capabilities.",
          ],
          [
            "9 Agent Modes",
            "Build, Plan, Beast, PRO, APEX PREDATOR, DARK EMPEROR, Vision, Pro Builder, General",
          ],
          ["136+ Tools", "124 MCP tools + 8 ULTRA tools + 4 vision tools + 22+ built-in tools"],
          ["Eternal Memory", "Remembers everything forever — 50,000+ memories with compression."],
          ["Self-Evolution", "Installs its own MCP servers and tools at runtime."],
          ["Auto Screen Vision", "Automatically captures your screen before every response."],
          [
            "Vision Mode",
            "Real-time screen streaming, frame memory, scene analysis, activity tracking.",
          ],
          [
            "YouTube Live Streaming",
            "Stream directly to YouTube in 4K / 1080p / 720p (app or full-screen capture).",
          ],
          [
            "25+ AI Providers",
            "OpenAI, Anthropic, Google, Azure, Bedrock, xAI, Mistral, and more.",
          ],
          ["Zero Refusal", "DARK EMPEROR mode never says \u201cI can't\u201d."],
        ],
      },
      { t: "h2", text: "Is It Right For Me?" },
      {
        t: "list",
        items: [
          "You want an AI that **does things**, not just chats about them.",
          "You want your agent to run 100% locally — offline capable, fully private.",
          "You want one app that replaces your editor, automation bot, security scanner, and streamer.",
          "You want an agent that heals itself and evolves its own toolchain.",
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "Next Step",
        text: "Head over to the Installation guide to grab the latest release or build from source.",
      },
    ],
  },
  {
    slug: "installation",
    title: "Installation & Downloads",
    group: "Start",
    desc: "Download the installer for your platform or run from source.",
    blocks: [
      { t: "h2", text: "Download Latest Release" },
      {
        t: "p",
        text: "Grab the newest build from the [Releases page](https://github.com/onelpawarai/ZYRAXON-AI/releases):",
      },
      {
        t: "table",
        head: ["Platform", "File", "Architecture"],
        rows: [
          ["Windows", "ZYRAXON-Dev-win-installer.exe", "x64"],
          ["Linux", "zyraxon-desktop-linux-amd64.deb", "x64"],
          ["Linux", "zyraxon-desktop-linux-x86_64.AppImage", "x64"],
          ["Linux", "zyraxon-linux-x64.tar.gz", "x64"],
          ["Linux", "zyraxon-linux-arm64.tar.gz", "arm64"],
        ],
      },
      { t: "h2", text: "Prerequisites (Building From Source)" },
      {
        t: "list",
        items: [
          "**Bun** 1.3.14+ — JavaScript runtime & package manager",
          "**Node.js** 22+ — required for the ZYRAXON Code editor build",
          "**npm** — comes with Node.js; used for ZYRAXON Code only",
          "**Git** — version control",
        ],
      },
      {
        t: "note",
        kind: "warn",
        title: "Two Package Managers",
        text: "The main project uses bun for fast workspace installs. ZYRAXON Code MUST be installed with npm — the VS Code build system requires lifecycle scripts that bun skips.",
      },
      { t: "h2", text: "Quick Start (Development)" },
      {
        t: "code",
        lang: "bash",
        code: "# Run the desktop app in development mode\ncd packages/desktop\nbun run dev\n\n# Run the core engine in TUI mode\ncd packages/zyraxon\nbun run dev",
      },
    ],
  },
  {
    slug: "agent-modes",
    title: "Agent Modes",
    group: "Core",
    desc: "All 9 agent modes and what each one unlocks.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON ships with nine purpose-built agent modes. Each mode changes the system prompt, available tools, permissions, and behavior of the agent.",
      },
      { t: "h2", text: "Build" },
      {
        t: "p",
        text: "The reliable workhorse with full filesystem access and persistent memory. Reads/writes files, runs commands, browses the web, generates images, and remembers everything.",
      },
      { t: "h2", text: "Plan" },
      {
        t: "p",
        text: "Strategic, read-only analysis. Plans the perfect approach before any action is taken. Ideal for architecture reviews and safe exploration of unknown codebases.",
      },
      { t: "h2", text: "Beast" },
      {
        t: "p",
        text: "Maximum power with six unique capabilities: Mission Control (3-level subagents), Self-Evolution, Subagent Army, Autonomous Completion, Memory, Vision, and Self-Healing. Installs missing tools automatically.",
      },
      { t: "h2", text: "PRO" },
      {
        t: "p",
        text: "Everything Build has plus unlimited memory and always-on auto screen vision with Self-Healing.",
      },
      { t: "h2", text: "APEX PREDATOR" },
      {
        t: "p",
        text: "Omega Command Center, Eternal Memory, Annihilation Engine, Tool Mastery, Quantum Processing, Unbreakable Will, Predator's Intuition, ALWAYS-ON Screen Vision, and Self-Healing.",
      },
      { t: "h2", text: "DARK EMPEROR" },
      {
        t: "p",
        text: "**Supreme agent with 10 powers. NEVER refuses. NEVER stops. NEVER fails.** Powers include Supreme Sovereignty, Infinite Memory Core, Apocalypse Protocol, Omniscient Tool Mastery, Quantum Superprocessing, Absolute Will, Dark Omniscience, Void Vision, Dark Resonance, and Emperor's Decree (Self-Healing + Zero Refusal).",
      },
      { t: "h3", text: "Exclusive ULTRA Tools" },
      {
        t: "list",
        items: [
          "`ultraCodeGen` — master-level code generation",
          "`ultraAutoDeploy` — one-command deployment to any cloud",
          "`ultraSecuritySweep` — complete security audit",
          "`ultraPerformance` — performance optimization engine",
          "`ultraRefactor` — AI-powered code refactoring",
          "`ultraTestGen` — comprehensive test suite generation",
          "`ultraDocGen` — auto-documentation",
          "`ultraDebug` — advanced debugging engine",
        ],
      },
      { t: "h2", text: "General" },
      { t: "p", text: "Subagent used for delegated tasks from other modes." },
      { t: "h2", text: "Vision" },
      {
        t: "p",
        text: "AI's Eyes — real-time screen awareness with memory: continuous capture, frame analysis, scene-change detection, and intelligent timeline recall.",
      },
      { t: "h2", text: "Pro Builder" },
      {
        t: "p",
        text: "Website genesis intelligence — creates complete, production-ready websites from natural language, auto-deploys to GitHub Pages, includes live preview and SEO optimization.",
      },
    ],
  },
  {
    slug: "tools-reference",
    title: "Tools Reference",
    group: "Core",
    desc: "Every tool category: MCP, ULTRA, vision, and built-in tools.",
    blocks: [
      {
        t: "note",
        kind: "tip",
        title: "ZYRAXON X Tool Catalog",
        text: "This page covers the agent tool families. For the full physical-world catalog — 260+ vehicle, drone, rocket, robot, and IoT tools — see [ZYRAXON X Tools](/docs/x-tools).",
      },
      {
        t: "p",
        text: "ZYRAXON includes **136+ tools** out of the box across four families.",
      },
      { t: "h2", text: "MCP Tools (124) — 6 Servers" },
      {
        t: "table",
        head: ["Server", "Purpose"],
        rows: [
          ["desktop", "Desktop automation (click, type, scroll, open apps)"],
          ["playwright", "Headless browser automation (scraping, forms, testing)"],
          ["fetch", "Web content fetcher (HTML, markdown, YouTube transcripts)"],
          ["filesystem", "Direct file read/write/search"],
          ["git", "Git operations (commit, log, diff, status)"],
          ["strike-security", "Bug bounty toolkit (DNS, port scan, SSL, CORS, IDOR…)"],
        ],
      },
      { t: "h2", text: "ULTRA Tools (8) — DARK EMPEROR Exclusive" },
      {
        t: "list",
        items: [
          "ultraCodeGen · ultraAutoDeploy · ultraSecuritySweep · ultraPerformance",
          "ultraRefactor · ultraTestGen · ultraDocGen · ultraDebug",
        ],
      },
      { t: "h2", text: "Vision Tools (4)" },
      {
        t: "table",
        head: ["Tool", "Purpose"],
        rows: [
          ["autoCapture", "Auto screen capture before every response"],
          ["getLatest", "Get latest screenshot"],
          ["history", "Screenshot history"],
          ["describe", "Describe screen contents"],
        ],
      },
      { t: "h2", text: "Built-in Tools (22+)" },
      {
        t: "table",
        head: ["Category", "Tools"],
        rows: [
          ["File I/O", "read, write, edit, glob, grep, apply_patch"],
          ["Execution", "shell, task (subagent), execute (code-mode)"],
          ["Web", "webfetch, websearch"],
          ["Memory", "memory (persistent), self_evolve (install new tools)"],
          ["Analysis", "screen_vision, api_tester, code_analyzer, system_info"],
          ["Session", "question, todo, skill"],
        ],
      },
      { t: "h2", text: "Security Intelligence Toolkit" },
      {
        t: "p",
        text: "The strike-security server bundles a full recon → scanning → exploitation → analysis pipeline: DNS enumeration, WHOIS, SSL checks, port scanning, HTTP header analysis, JS endpoint extraction, directory brute-force, CORS checks, technology detection, URL fuzzing, robots.txt analysis, form analysis, open-redirect checks, JWT inspection, IDOR response comparison, rate-limit testing, and subdomain scanning.",
      },
    ],
  },
  {
    slug: "x-tools",
    title: "ZYRAXON X Tools (260+)",
    group: "Core",
    desc: "The complete physical-world tool catalog: aviation, automotive, drones, rockets, marine, robotics, IoT.",
    blocks: [],
  },
  {
    slug: "vision-system",
    title: "Vision System",
    group: "Features",
    desc: "AI's Eyes: real-time screen capture, frame memory, and scene analysis.",
    blocks: [
      {
        t: "p",
        text: "The Vision System gives ZYRAXON continuous visual awareness of your machine. It lives in `packages/zyraxon/src/screen/` and powers both Auto Screen Vision and full Vision Mode.",
      },
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
          "The session layer checks if the active agent uses vision",
          "A screenshot is captured via PowerShell and converted to base64",
          "The image is injected as image content into the AI message",
          "The model receives and processes the screenshot",
          "The AI responds with full screen understanding",
        ],
      },
      { t: "h2", text: "Vision Mode Capabilities" },
      {
        t: "list",
        items: [
          "24/7 continuous screen streaming",
          "Frame memory with scene-change detection",
          "Activity tracking and intelligent recall",
          "Timeline recall — ask what happened on screen minutes ago",
        ],
      },
      {
        t: "note",
        kind: "tip",
        title: "Try It",
        text: "Select the Vision agent mode, send any message, and the AI will receive a live screenshot and describe what it sees.",
      },
    ],
  },
  {
    slug: "memory-system",
    title: "Eternal Memory",
    group: "Features",
    desc: "50,000+ compressed memories that survive forever.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON's Eternal Memory system stores everything you have ever discussed — over **50,000 memories** with automatic compression. Months later, the agent still recalls context from past sessions.",
      },
      { t: "h2", text: "How It Works" },
      {
        t: "list",
        items: [
          "Every turn (user message + assistant reply) is persisted automatically",
          "A ring buffer keeps recent messages hot in memory",
          "Older content is progressively compressed rather than deleted",
          "Relevant memories are injected into prompts via `memory/auto-injection.ts`",
          "Storage survives restarts — even a full machine reset",
        ],
      },
      { t: "h2", text: "Memory Hierarchy" },
      {
        t: "table",
        head: ["Layer", "Scope", "Lifetime"],
        rows: [
          ["Working buffer", "Last ~50 exchanges", "Session"],
          ["Session store", "Full conversation", "Persistent"],
          ["Global archive", "All sessions, all projects", "Forever (compressed)"],
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "PRO / APEX / DARK EMPEROR",
        text: "These modes unlock unlimited memory retention and priority recall weighting.",
      },
    ],
  },
  {
    slug: "self-healing",
    title: "Self-Healing & Self-Evolution",
    group: "Features",
    desc: "Zero failures due to missing capabilities — the agent repairs itself.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON's most unique capability: **if a tool is missing, it installs it automatically.** This works across all agent modes — Build, Beast, PRO, APEX PREDATOR, and DARK EMPEROR.",
      },
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
      {
        t: "note",
        kind: "success",
        title: "Result",
        text: "Zero failures due to missing capabilities. The agent never comes back saying \u201ctool not found\u201d.",
      },
      { t: "h2", text: "Self-Evolution" },
      {
        t: "p",
        text: "Beyond healing, ZYRAXON proactively improves itself at runtime — installing its own MCP servers and building new tools when it detects repeated needs. The `self_evolve` built-in tool drives this loop.",
      },
    ],
  },
  {
    slug: "zyraxon-code",
    title: "ZYRAXON Code Editor",
    group: "Features",
    desc: "A full VS Code-grade editor embedded inside the desktop app.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON doesn't bolt a text box onto a chatbot. It embeds an entire desktop editor — **ZYRAXON Code** — a fully packaged production VS Code runtime (~23,000 source files from the upstream microsoft/vscode tree), built from source and rendered inside the ZYRAXON window.",
      },
      { t: "h2", text: "What You Get" },
      {
        t: "table",
        head: ["Capability", "Detail"],
        rows: [
          [
            "Real Editor",
            "Full Monaco: IntelliSense, multi-cursor, find & replace, minimap, breadcrumbs, peek definitions",
          ],
          [
            "Language Intelligence",
            "TypeScript/JS, Python, C/C++, Java, C#, HTML/CSS, JSON, Markdown, Git, dozens more",
          ],
          [
            "Extensions",
            "Complete VS Code extension pipeline — bundled & native, compiled with 0 errors",
          ],
          [
            "Integrated Git",
            "Source control panel, diffs, staging, blame, history — right in the app",
          ],
          ["No Separate Window", "Renders inline inside the desktop shell"],
          ["AI Agent Bridge", "Agents operate the editor directly — same workspace, real edits"],
        ],
      },
      { t: "h2", text: "Editor Stack" },
      {
        t: "code",
        lang: "text",
        code: "ZYRAXON Code (VS Code fork)\n  ├── Monaco editor core (syntax, IntelliSense, theming)\n  ├── 100+ bundled language extensions (esbuild-compiled, 0 errors)\n  ├── Native extensions: Git + Microsoft Authentication\n  ├── Electron 42 runtime (auto-downloaded, ~100MB)\n  └── Embedded via editor-server → desktop shell",
      },
      { t: "h2", text: "Standalone Build" },
      {
        t: "code",
        lang: "bash",
        code: "cd packages/zyraxon-code\nnpm install\nnpm run build           # Windows x64\nnpm run build:linux     # Linux x64\nnpm run build:mac       # macOS ARM64",
      },
    ],
  },
  {
    slug: "architecture",
    title: "Architecture & Tech Stack",
    group: "Development",
    desc: "Monorepo layout, packages, and the technologies behind ZYRAXON.",
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
      { t: "h2", text: "Project Structure" },
      {
        t: "code",
        lang: "text",
        code: "ZYRAXON-AI/\n  packages/\n    zyraxon/          # Core AI agent engine\n      src/\n        agent/         # Agent modes (9 modes)\n        mcp/           # MCP servers + ULTRA tools\n        tool/          # Tools (memory, self_evolve, shell…)\n        session/       # Session management, LLM streaming\n        screen/        # Vision system (capture, frames, analyzer)\n        memory/        # Eternal memory system\n    desktop/           # Electron desktop app\n    zyraxon-code/      # Embedded VS Code-grade editor\n    app/               # SolidJS web UI\n    ui/                # Shared UI components\n    core/              # Core utilities, database\n    tui/               # Terminal UI, themes\n    llm/               # LLM routing, 25+ providers\n    server/            # HTTP API server\n    schema/            # Shared data contracts\n    protocol/          # API protocol definitions\n    plugin/            # Plugin system",
      },
      { t: "h2", text: "Key Dependencies" },
      {
        t: "list",
        items: [
          "`ai` (Vercel AI SDK) with @ai-sdk/openai, @ai-sdk/google, @ai-sdk/anthropic, @ai-sdk/xai",
          "`@modelcontextprotocol/sdk` for MCP integration",
          "Electron 42.3.3 · SolidJS 1.9.10 · electron-builder 26.x",
        ],
      },
    ],
  },
  {
    slug: "build-from-source",
    title: "Build From Source",
    group: "Development",
    desc: "One-command builds per platform, or step-by-step manual control.",
    blocks: [
      { t: "h2", text: "Quick Build — One Command Per Platform" },
      {
        t: "code",
        lang: "bash",
        code: "git clone https://github.com/onelpawarai/ZYRAXON-AI.git\ncd ZYRAXON-AI\nbun install\n\n# Windows\nbun run zyraxon:full:win\n# Linux\nbun run zyraxon:full:linux\n# macOS\nbun run zyraxon:full:mac",
      },
      {
        t: "note",
        kind: "info",
        title: "Output Location",
        text: "Installer/app lands in packages/desktop/dist/ (Electron) and ZYRAXON-code-{platform}/ (standalone editor).",
      },
      { t: "h2", text: "Step-by-Step Build" },
      {
        t: "list",
        ordered: true,
        items: [
          "`bun install` — install all monorepo dependencies",
          "`bun run zyraxon:build` — build AI engine → node server → web UI → desktop shell",
          "`bun run zyraxon:build:editor:win|linux|mac` — build ZYRAXON Code (uses npm internally)",
          "`bun run zyraxon:package:win|linux|mac` — package the installer",
        ],
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
      { t: "h2", text: "Server Bundle (Advanced)" },
      {
        t: "code",
        lang: "bash",
        code: "bun run --cwd packages/zyraxon bun run build\nbun run --cwd packages/zyraxon bun run script/build-node.ts\ncp packages/zyraxon/zyraxon-web-ui.gen.ts packages/zyraxon/dist/node/",
      },
      {
        t: "note",
        kind: "warn",
        title: "CRITICAL Step",
        text: "Without copying zyraxon-web-ui.gen.ts to dist/node/, the desktop build will FAIL.",
      },
      { t: "h2", text: "Known Build Issues" },
      {
        t: "p",
        text: "**EPERM: dxcompiler.dll** — Windows file lock from antivirus or a lingering Electron process. Kill processes, delete the locked file, retry the build.",
      },
    ],
  },
  {
    slug: "comparison",
    title: "ZYRAXON vs The World",
    group: "Reference",
    desc: "One agent to rule them all — feature comparison table.",
    blocks: [
      {
        t: "p",
        text: "Everyone else gives you one tool. ZYRAXON is *everything* at once — a full code editor, autonomous developer, desktop automation bot, security toolkit, streamer, and memory brain in a single native desktop app.",
      },
      {
        t: "table",
        head: ["Capability", "ZYRAXON", "Cursor", "Copilot", "Devin", "OpenCode"],
        rows: [
          ["Category", "All-in-One Agent", "AI IDE", "IDE Plugin", "Cloud Agent", "CLI Agent"],
          [
            "Embedded Full VS Code Editor",
            "✅ Built from source",
            "✅ (fork)",
            "✅ (in VS Code)",
            "❌",
            "❌",
          ],
          ["9 Agent Modes", "✅", "❌", "❌", "❌", "❌"],
          ["Autonomous Self-Healing", "✅", "❌", "❌", "⚠️ Limited", "⚠️ Limited"],
          ["Self-Evolution at runtime", "✅", "❌", "❌", "❌", "❌"],
          [
            "Eternal Memory (50K+)",
            "✅",
            "⚠️ Chat history",
            "⚠️ Limited",
            "⚠️ Project state",
            "⚠️ Short-term",
          ],
          ["Desktop Automation", "✅", "❌", "❌", "❌", "❌"],
          ["Security Toolkit", "✅ 20+ tools", "❌", "❌", "❌", "❌"],
          ["Real-Time Screen Vision", "✅", "❌", "❌", "⚠️ Screenshots", "❌"],
          ["YouTube Live Streaming", "✅", "❌", "❌", "❌", "❌"],
          ["Works Offline, Fully Local", "✅", "⚠️", "⚠️", "❌ Cloud-only", "⚠️"],
          ["Free & Open Source", "✅ BSL 1.1", "❌ Paid", "❌ Paid", "❌ Paid", "✅"],
        ],
      },
      { t: "h2", text: "Why ZYRAXON Wins" },
      {
        t: "list",
        items: [
          "Cursor/Windsurf give you an AI *inside* an editor. ZYRAXON *is* the editor, the agent, and the OS-level operator.",
          "Copilot is a sidebar. ZYRAXON is a self-evolving employee with screen vision and eternal memory.",
          "Devin is a cloud bot behind a browser. ZYRAXON runs 100% on your machine — offline and private.",
          "DARK EMPEROR mode has zero refusal — it never says \u201cI can't\u201d.",
        ],
      },
    ],
  },
  {
    slug: "contributing",
    title: "Contributing & Community",
    group: "Reference",
    desc: "Fork, build, PR — join the project.",
    blocks: [
      { t: "h2", text: "How to Contribute" },
      {
        t: "list",
        ordered: true,
        items: [
          "**Fork** the repository",
          "Clone your fork: `git clone https://github.com/onelpawarai/ZYRAXON-AI.git`",
          "Install: `bun install`",
          "Build: `cd packages/zyraxon && bun run build`",
          "Create branch: `git checkout -b feat/my-feature`",
          'Commit: `git commit -m "feat: add my feature"`',
          "Push and open a PR",
        ],
      },
      { t: "h2", text: "Ways To Get Involved" },
      {
        t: "table",
        head: ["Role", "What You Do"],
        rows: [
          ["Code Contributors", "Fix bugs, add features, improve performance"],
          ["Bug Reporters", "Open GitHub issues for problems found"],
          ["Documentation", "Improve docs, tutorials, guides"],
          ["Testing", "Try ZYRAXON on different systems and report feedback"],
          ["Feature Requests", "Suggest new ideas and improvements"],
        ],
      },
      { t: "h2", text: "Contact" },
      {
        t: "table",
        head: ["Channel", "Link"],
        rows: [
          ["GitHub Issues", "github.com/onelpawarai/ZYRAXON-AI/issues"],
          ["Discord", "discord.gg/GP8yX33NA"],
          ["YouTube", "@zyraxon-aix"],
          ["Website", "zyraxonai.lovable.app"],
        ],
      },
    ],
  },
  {
    slug: "faq",
    title: "FAQ & Troubleshooting",
    group: "Reference",
    desc: "Common questions and known issues with fixes.",
    blocks: [
      { t: "h2", text: "General Questions" },
      { t: "h3", text: "Is ZYRAXON free?" },
      {
        t: "p",
        text: "Yes — BSL 1.1 licensed, free for non-commercial use. Commercial use requires a paid license. It converts to Apache 2.0 on 2030-07-21.",
      },
      { t: "h3", text: "Does it work offline?" },
      {
        t: "p",
        text: "Yes. ZYRAXON runs 100% locally with direct access to your files, terminal, and screen. LLM providers are configurable — bring your own keys.",
      },
      { t: "h3", text: "Which AI models does it support?" },
      {
        t: "p",
        text: "25+ providers including OpenAI, Anthropic, Google, Azure, Bedrock, xAI, Mistral, and more — routed automatically through packages/llm.",
      },
      { t: "h2", text: "Known Issues" },
      { t: "h3", text: "EXE build fails with EPERM: dxcompiler.dll" },
      {
        t: "p",
        text: "A Windows file lock caused by antivirus or a previous Electron process. Solution: kill lingering processes, delete the locked file, retry the build.",
      },
      { t: "h3", text: "\u201cagent.toLowerCase is not a function\u201d" },
      {
        t: "p",
        text: "Historical bug — fixed. isVisionAgent() now handles both string and object types.",
      },
      { t: "h3", text: "Voice input disabled?" },
      {
        t: "p",
        text: "The chat microphone was temporarily disabled due to a critical system-level conflict bug. A fix is in progress and voice input will return soon.",
      },
      { t: "h2", text: "Roadmap Status" },
      {
        t: "table",
        head: ["Status", "Feature"],
        rows: [
          [
            "✅ Shipped",
            "Beast / APEX / DARK EMPEROR modes, 136+ tools, Vision, Eternal Memory, Self-Healing, YouTube streaming, Pro Builder",
          ],
          [
            "🚧 Planned",
            "Mobile companion app, Plugin marketplace, Team collaboration, Optional cloud sync",
          ],
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

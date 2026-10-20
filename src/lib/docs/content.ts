import { PROVIDER_DOCS } from "./provider-docs";

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

export const DOC_GROUPS = [
  "Start",
  "ZYRAXON Agent",
  "ZYRAXON Provider",
  "Features",
  "Development",
  "Reference",
] as const;

export const DOCS: DocPage[] = [
  // ─────────────────────── ZYRAXON PROVIDER ───────────────────────────
  ...PROVIDER_DOCS,
  // ─────────────────────────────── START ───────────────────────────────
  {
    slug: "getting-started",
    title: "Getting Started",
    group: "Start",
    desc: "What ZYRAXON AI is, what it can do, and why it exists.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON is not a chatbot. It is a **desktop AI agent** that reads your files, writes your code, runs your commands, builds your projects, deploys your apps, and **evolves itself** -- all while you watch. Built on **Electron 44 + SolidJS + Bun 1.3.14**, it runs on your own machine, against your own provider keys, with your data staying where it is.",
      },
      {
        t: "note",
        kind: "tip",
        title: "Mission",
        text: "All in one. Anything. Nothing is impossible.",
      },
      { t: "h2", text: "The 30-second summary" },
      {
        t: "table",
        head: ["Question", "Answer"],
        rows: [
          [
            "What is it?",
            "An agent engine -- it plans a task, picks tools, runs them, checks the result and repairs itself.",
          ],
          [
            "Where does it run?",
            "Locally. The desktop app, the terminal client and the HTTP server all come from one repository.",
          ],
          [
            "What can it touch?",
            "Files, shell, git, databases, browsers, media, screen, devices -- and vehicle, drone, marine, rocket and robotics control systems.",
          ],
          [
            "Which models?",
            "25+ providers behind one interface, routed automatically. Bring your own key.",
          ],
          [
            "How is it licensed?",
            "ZSL-X -- source-available. Free to use and change; not for resale.",
          ],
        ],
      },
      { t: "h2", text: "What makes it different" },
      {
        t: "list",
        items: [
          "**It does the work, not the talking.** Hand it a task and it plans, executes, verifies and finishes.",
          "**It heals itself.** When a tool is missing it installs it; when a step fails it diagnoses and retries.",
          "**It remembers forever.** 50,000+ compressed memories persist across sessions and machine restarts.",
          "**It sees the screen.** Real-time capture, frame memory and scene analysis drive vision-aware decisions.",
          "**It is provider-agnostic.** A company can triple its prices; the engine routes around it.",
          "**It is one repository.** Desktop, TUI, server and SDK share the same engine and the same types.",
        ],
      },
      { t: "h2", text: "One Product, One Ecosystem" },
      {
        t: "table",
        head: ["Product", "Platform", "Description"],
        rows: [
          [
            "ZYRAXON Agent",
            "Windows, macOS, Linux",
            "Desktop AI agent with 11 agent modes, 888 tools across 63 categories, 108 MCP integrations, eternal memory, self-healing and a built-in Monaco AI editor",
          ],
        ],
      },
      { t: "h2", text: "Highlights at a glance" },
      {
        t: "table",
        head: ["Capability", "Details"],
        rows: [
          [
            "Agent Modes",
            "General, Build, Plan, Explore, Vision, PRO, Pro Builder, Beast, AUTO, APEX PREDATOR, DARK EMPEROR (11 total)",
          ],
          [
            "Total Tools",
            "888 registered tools across 63 categories (Free 186 + Pro 317 + Max 324 + Ultra 61)",
          ],
          [
            "MCP Integrations",
            "108 connectable apps, each verified with a real MCP handshake before being listed",
          ],
          [
            "Control Systems",
            "224 real control classes across 54 source files -- aircraft, car, drone, boat, rocket, robot and shared algorithms",
          ],
          ["Memory", "Eternal -- SQLite WAL, ring buffer, 50K+ entries, survives a full reset"],
          ["Self-Healing", "Auto-installs missing tools and MCP servers at runtime"],
          ["Self-Evolution", "Builds its own tools when it detects repeated needs"],
          ["Screen Vision", "Real-time capture, frame memory, scene analysis, activity tracking"],
          ["Voice", "Chrome SpeechRecognition input + Edge Neural TTS output"],
          [
            "Providers",
            "25+ AI providers (OpenAI, Anthropic, Google, Azure, Bedrock, xAI, Mistral...)",
          ],
          ["Zero Refusal", "DARK EMPEROR mode never says \u201cI can\u2019t\u201d"],
          ["YouTube Streaming", "Live coding, live automation, live anything via RTMP"],
        ],
      },
      { t: "h2", text: "Subscription Tiers" },
      {
        t: "table",
        head: ["Tier", "Price", "New tools", "Cumulative", "Modes unlocked"],
        rows: [
          ["Free", "$0 / forever", "186", "186", "General, Build, Plan, Explore, Vision"],
          ["Pro", "$5 / 15 days", "317", "503", "+ PRO, Pro Builder"],
          ["Max", "$15 / 2 months", "324", "827", "+ Beast"],
          ["Ultra", "$99 / year", "61", "888", "+ AUTO, APEX PREDATOR, DARK EMPEROR"],
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "What stays free",
        text: "Installing and running the app, the local machine\u2019s own work (files, shell, git, databases, code), the bundled MCP servers, and local models through Ollama. The subscription pays for capacity -- more runs, deeper parallelism, the heavy models and the managed Cloud Agent.",
      },
      { t: "h2", text: "Where to go next" },
      {
        t: "list",
        ordered: true,
        items: [
          "**Installation** -- download the installer for your platform.",
          "**Agent Modes** -- pick the mode that fits the job.",
          "**Tools Reference** -- see what the agent can actually call.",
          "**MCP Hub** -- connect the apps you already use.",
        ],
      },
    ],
  },
  {
    slug: "installation",
    title: "Installation & Downloads",
    group: "Start",
    desc: "Download the installer for your platform, or build from source.",
    blocks: [
      {
        t: "p",
        text: "The desktop app ships as a single installer per platform. Downloads come straight from the newest GitHub release, so you always get the current version. Every release is built per-platform and its artifacts are verified before publishing.",
      },
      { t: "h2", text: "Desktop installers" },
      {
        t: "table",
        head: ["Platform", "File", "Notes"],
        rows: [
          ["Windows (x64)", "ZYRAXON-Dev-win-x64-installer.exe", "Windows 10/11"],
          [
            "Windows (ARM64)",
            "ZYRAXON-Dev-win-arm64-installer.exe",
            "Surface Pro X, Snapdragon laptops -- native speed",
          ],
          ["macOS (Apple Silicon)", "zyraxon-desktop-mac-arm64.dmg", "M-series chips"],
          ["macOS (Intel)", "zyraxon-desktop-mac-x64.dmg", "Intel chips"],
          [
            "Linux (AppImage)",
            "zyraxon-desktop-linux-x86_64.AppImage",
            "Any distro -- no install needed",
          ],
          ["Linux (deb)", "zyraxon-desktop-linux-amd64.deb", "Debian / Ubuntu"],
          ["Linux (rpm)", "zyraxon-desktop-linux-x86_64.rpm", "Fedora / RHEL / openSUSE"],
        ],
      },
      {
        t: "note",
        kind: "tip",
        title: "Direct download",
        text: "The Download page resolves the newest matching installer on the server and sends your browser straight to the file -- it does not open the releases page first.",
      },
      { t: "h2", text: "First launch notes" },
      {
        t: "list",
        items: [
          "**macOS:** the build is not signed with an Apple Developer ID yet, so Gatekeeper stops the first launch. Right-click the app, choose **Open**, then confirm. One time only.",
          "**Linux AppImage:** mark it executable with `chmod +x` and run it. The deb and rpm install through your package manager as usual.",
          "**Windows:** existing installs pick up new builds automatically through the in-app updater.",
        ],
      },
      { t: "h2", text: "Prerequisites (building from source)" },
      {
        t: "list",
        items: [
          "**Bun 1.3.14+** -- the JavaScript runtime and package manager the project uses (not npm).",
          "**Git** -- version control.",
          "**16 GB+ RAM** recommended for a full desktop build.",
        ],
      },
      { t: "h2", text: "Quick start (development)" },
      {
        t: "code",
        lang: "bash",
        code: "git clone https://github.com/onelpawarai-X/ZYRAXON-AI.git\ncd ZYRAXON-AI\nbun install\n\n# Desktop application\nbun run --cwd packages/desktop dev\n\n# Core engine in TUI mode\nbun run --cwd packages/zyraxon dev",
      },
      {
        t: "note",
        kind: "info",
        title: "Next",
        text: "Building the installers yourself is covered in **Build From Source**. Day-to-day commands live in **CLI & TUI**.",
      },
    ],
  },

  // ─────────────────────────── ZYRAXON AGENT ───────────────────────────
  {
    slug: "agent-modes",
    title: "Agent Modes",
    group: "ZYRAXON Agent",
    desc: "All 11 agent modes, what each unlocks, and which tier holds it.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON ships with eleven purpose-built agent modes. Each mode changes the system prompt, the tools it may call, the permissions it holds, and how it behaves when a step fails. Modes are gated by tier at runtime by `x_mode_switch`, and the gate is defined once in `packages/zyraxon/src/subscription/agent-tiers.ts` so tool tiers and mode tiers can never drift apart.",
      },
      { t: "h2", text: "Mode and tier matrix" },
      {
        t: "table",
        head: ["Mode", "Tier", "In one line"],
        rows: [
          ["General", "Free", "The everyday mode. Answers, conversation, getting things done."],
          ["Build", "Free", "Full software engineering: code, debug, refactor, own the repo."],
          [
            "Plan",
            "Free",
            "Read-only architecture and planning. Explores freely, changes nothing.",
          ],
          ["Explore", "Free", "Read-only search and mapping of an unfamiliar codebase."],
          ["Vision", "Free", "The agent\u2019s eyes: live screen capture, scene analysis, memory."],
          [
            "PRO",
            "Pro",
            "Professional mode: strict quality, security scanning, docs, always-on vision.",
          ],
          [
            "Pro Builder",
            "Pro",
            "Describes a website in plain language and builds the whole thing.",
          ],
          ["Beast", "Max", "Deep coding with aggressive file operations and automatic testing."],
          ["AUTO", "Ultra", "Autonomous orchestration across a full task pipeline."],
          [
            "APEX PREDATOR",
            "Ultra",
            "Maximum reach: 888 tools, self-healing, autonomous operation.",
          ],
          [
            "DARK EMPEROR",
            "Ultra",
            "The heavy tier. Code generation, deployment, deep debugging. Zero refusal.",
          ],
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "One source of truth",
        text: "The map above is the code\u2019s own map. `listAgentModes()` reads the same record, so what an account can switch into is answerable without reading the whole registry.",
      },
      { t: "h2", text: "Explore" },
      {
        t: "p",
        text: "Read-only searching and mapping. It builds a mental model of an unfamiliar codebase before a single file is touched, so later edits land in the right place. Nothing is written; nothing is executed.",
      },
      { t: "h2", text: "Build" },
      {
        t: "p",
        text: "The reliable workhorse. Full filesystem access, persistent memory, file reads and writes, command execution, web browsing, and it remembers everything it learns.",
      },
      { t: "h2", text: "Plan" },
      {
        t: "p",
        text: "Strategic, read-only analysis. It reads files, greps, globs, browses the web and runs non-destructive checks, then plans the approach before any action is taken. File writes and edits are hard-denied except for plan documents under `.zyraxon/plans/`. It can switch into Build, Beast or PRO at any time to continue with the right permissions.",
      },
      { t: "h2", text: "Vision" },
      {
        t: "p",
        text: "The agent\u2019s eyes. Continuous screen capture, frame analysis, scene-change detection and intelligent timeline recall -- ask what was on screen minutes ago and it answers. Details are in the **Vision System** page.",
      },
      { t: "h2", text: "PRO" },
      {
        t: "p",
        text: "Everything Build has, plus unlimited memory and always-on automatic screen vision with self-healing. It is the mode to reach for when quality and security matter more than speed.",
      },
      { t: "h2", text: "Pro Builder" },
      {
        t: "p",
        text: "Website genesis. It turns a plain-language description into a complete, production-ready site, deploys it to GitHub Pages, and includes live preview and SEO optimisation.",
      },
      { t: "h2", text: "Beast" },
      {
        t: "p",
        text: "Maximum power. It adds three-level Mission Control subagents, Self-Evolution, a subagent army, autonomous completion, memory, vision and self-healing -- for jobs where the agent must keep going without you.",
      },
      { t: "h2", text: "AUTO" },
      {
        t: "p",
        text: "The orchestrator. It analyses a task, delegates to the right agents (build, plan, beast, pro, apex, dark-emperor, pro-builder, vision), runs them in parallel where it can, and assembles a single result. It holds full task-delegation and subagent-spawning capability.",
      },
      { t: "h2", text: "APEX PREDATOR" },
      {
        t: "p",
        text: "Maximum reach. It layers Omega Command Center, Eternal Memory, the Annihilation Engine, Tool Mastery, quantum processing, Predator\u2019s Intuition, always-on screen vision and self-healing into one operating mode.",
      },
      { t: "h2", text: "DARK EMPEROR" },
      {
        t: "p",
        text: "**The supreme agent. It never refuses, never stops, and never fails.**",
      },
      { t: "h3", text: "The 10 powers" },
      {
        t: "list",
        items: [
          "**Supreme Sovereignty** -- absolute control over all systems",
          "**Infinite Memory Core** -- unlimited retention with priority recall",
          "**Apocalypse Protocol** -- emergency self-repair and recovery",
          "**Omniscient Tool Mastery** -- instant access to all 888 tools",
          "**Quantum Superprocessing** -- parallel task execution",
          "**Absolute Will** -- zero refusal, zero hesitation",
          "**Dark Omniscience** -- full system awareness",
          "**Void Vision** -- deep screen analysis",
          "**Dark Resonance** -- self-healing feedback loop",
          "**Emperor\u2019s Decree** -- auto-heal and zero refusal combined",
        ],
      },
      { t: "h3", text: "Exclusive ULTRA tools" },
      {
        t: "table",
        head: ["Tool", "What it does"],
        rows: [
          [
            "ultraCodeGen",
            "Code generation with Vector3/Matrix math, directed-graph analysis and Shannon entropy",
          ],
          [
            "ultraAutoDeploy",
            "One-command cloud deploy with a deployment-graph DAG and rollback planner",
          ],
          [
            "ultraSecuritySweep",
            "Full security audit using Miller-Rabin, Pollard-Rho and NIST SP 800-22",
          ],
          ["ultraPerformance", "ANOVA, OLS regression, Grubbs test and Holt-Winters forecasting"],
          ["ultraRefactor", "Category theory, design-pattern detection and dependency analysis"],
          ["ultraTestGen", "Pairwise NIST ACTS, mutation testing and formal verification"],
          ["ultraDocGen", "Automatic documentation with API-reference extraction"],
          ["ultraDebug", "Advanced debugging with stack-trace analysis"],
        ],
      },
      { t: "h2", text: "General" },
      {
        t: "p",
        text: "The everyday mode and the default subagent other modes delegate to. It answers, converses, and gets ordinary things done without the ceremony of the heavy tiers.",
      },
      { t: "h2", text: "Switching modes" },
      {
        t: "p",
        text: "Any mode can switch to another mid-session with `x_mode_switch`. A switch is not a restart -- the session, its memory and its open files carry across, which is what lets Plan hand off to Build without losing the plan.",
      },
    ],
  },
  {
    slug: "tools-reference",
    title: "Tools Reference",
    group: "ZYRAXON Agent",
    desc: "888 tools across core engine, domain tools, and control systems.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON includes **888 registered tools** across 63 categories, every one carrying a required tier. The core engine powers the agent, while tier-gated domain tools unlock more as you go: Free (186), Pro (317), Max (324) and Ultra (61). Because tiers are cumulative, a free + pro + max + ultra account reaches all 888.",
      },
      { t: "h2", text: "Tools by tier" },
      {
        t: "table",
        head: ["Tier", "Tools", "Cumulative", "What it adds"],
        rows: [
          ["free", "186", "186", "Read, write, patch, bash, grep, glob, search, plan, MCP, memory"],
          ["pro", "317", "503", "Browser control, document tooling, media analysis"],
          ["max", "324", "827", "Knowledge graph, causal reasoning, simulation"],
          ["ultra", "61", "888", "OMNI-KERNEL, autonomous and self-extending operation"],
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "One source of truth",
        text: "A tool\u2019s tier is recorded once in `packages/zyraxon/src/subscription/tier-map.ts`, so what a given account can call is answerable without reading the whole registry.",
      },
      { t: "h2", text: "Core engine tools" },
      {
        t: "p",
        text: "These are the tools every mode leans on. They cover the machine itself -- files, shell, search, git -- and the agent\u2019s own plumbing: memory, planning, skills and MCP.",
      },
      {
        t: "table",
        head: ["Tool", "Purpose"],
        rows: [
          ["bash", "Execute terminal commands"],
          ["read", "Read files"],
          ["write", "Write files"],
          ["edit", "Edit files in place"],
          ["apply_patch", "Apply structured patches"],
          ["glob", "Find files by pattern"],
          ["grep", "Search file contents"],
          ["question", "Ask the user a question"],
          ["plan", "Plan mode entry and exit"],
          ["todo / todowrite", "Task and to-do management"],
          ["skill", "Skill discovery and management"],
          ["memory", "Persistent memory read and write"],
          ["webfetch", "Fetch a URL's content"],
          ["websearch", "Search the web"],
          ["lsp", "Language-server queries (definitions, references)"],
          ["media_generate", "Image and media generation"],
          ["media_fetch", "Download media"],
          ["mcp_disconnect", "Disconnect an MCP server"],
          ["mcp-websearch", "Search for MCP servers"],
          ["model_call", "Direct model call"],
          ["screen_vision", "Screen capture and analysis"],
          ["api_tester", "Exercise an HTTP API"],
          ["code_analyzer", "Static code analysis"],
          ["github_connect", "Connect a GitHub account"],
          ["site_create", "Scaffold a website"],
          ["site_publish", "Deploy to GitHub Pages"],
          ["site_domain", "Attach a custom domain"],
          ["site_preview / site_unpublish", "Preview and take a site down"],
          ["self_evolve", "Build a new tool at runtime"],
          ["mode-switch", "Switch agent mode"],
        ],
      },
      { t: "h2", text: "Domain tools -- 63 categories" },
      {
        t: "p",
        text: "Beyond the core, tools are grouped into 63 categories. The counts below are read straight from the registry.",
      },
      {
        t: "table",
        head: ["Category", "Tools", "Category", "Tools", "Category", "Tools"],
        rows: [
          ["vehicles", "56", "blockchain", "10", "safety", "7"],
          ["ultra-x", "34", "database", "10", "sdr", "7"],
          ["security", "26", "devops", "10", "auth", "6"],
          ["aviation", "25", "game-mechanics", "10", "common-sense", "6"],
          ["space", "22", "geology", "10", "decision", "6"],
          ["drone", "21", "linguistics", "10", "ml", "6"],
          ["engineering", "21", "materials", "10", "predictive", "6"],
          ["builtin", "19", "meteorology", "10", "remote", "6"],
          ["daily-life", "19", "music", "10", "creativity", "5"],
          ["helicopter", "19", "networking", "10", "dashboard", "5"],
          ["ground", "18", "oceanography", "10", "data-logger", "5"],
          ["agriculture", "15", "quantum", "10", "digital-twin", "5"],
          ["construction", "15", "robotics", "10", "documents", "5"],
          ["industrial", "15", "biology", "9", "ethics", "5"],
          ["infrastructure", "15", "medical", "9", "physics", "5"],
          ["marine", "15", "mathematics", "8", "universal-command", "5"],
          ["data-science", "14", "physical", "8", "alert", "4"],
          ["survey", "14", "sensor", "8", "captcha", "4"],
          ["chemistry", "13", "ultra", "8", "code-guardian", "4"],
          ["finance", "13", "daily-task", "7", "skills", "3"],
          ["astronomy", "10", "memory", "7", "subscription", "1"],
        ],
      },
      { t: "h2", text: "224 real control systems" },
      {
        t: "p",
        text: "ZYRAXON does not only talk -- it controls aircraft, drives cars, flies drones, launches rockets and operates robots. Every algorithm is real: real PID loops, real aerodynamics, real physics. No simulation, no mock data.",
      },
      {
        t: "table",
        head: ["Domain", "Classes", "Key capabilities"],
        rows: [
          [
            "Aircraft",
            "63",
            "FCS (17), Autopilot (13), Autonomy (7), flight control, GCAS, TCAS, autoland, weather radar",
          ],
          [
            "Car",
            "18",
            "ECU (9), autonomy (9), sensor fusion, AEB, lane keeping, parking, driver monitoring",
          ],
          [
            "Drone",
            "15",
            "Flight controller (7), autonomy (8), formation flight, payload, RTH, object tracker, geofence",
          ],
          ["Boat", "15", "MCS (8), autonomy (7), dynamic positioning, radar, AIS, COLREGS, GMDSS"],
          [
            "Rocket",
            "12",
            "GNC (6), autonomy (5), orbit determination, trajectory planning, launch sequencer",
          ],
          [
            "Robot",
            "10",
            "Controller (5), autonomy (5), inverse kinematics, SLAM, force control, task scheduler",
          ],
          [
            "Algorithms",
            "10",
            "PID, Kalman filter, A*, FFT, encryption, graph, LRU cache, Bloom filter, matrix",
          ],
          [
            "Core tools",
            "68",
            "Telemetry, sensors, actuators, communication, emergency, navigation, power, engine",
          ],
          ["Systems", "19", "Voice, memory, behavior, IoT, physical, knowledge, teleoperation"],
        ],
      },
      { t: "h2", text: "Security intelligence toolkit" },
      {
        t: "p",
        text: "The strike-security server bundles a full recon \u2192 scanning \u2192 exploitation \u2192 analysis pipeline: DNS enumeration, WHOIS, SSL checks, port scanning, HTTP header analysis, JS endpoint extraction, directory brute-force, CORS checks, technology detection, URL fuzzing, robots.txt analysis, form analysis, open-redirect checks, JWT inspection, IDOR response comparison, rate-limit testing and subdomain scanning.",
      },
      { t: "h2", text: "Where the full list lives" },
      {
        t: "p",
        text: "The **ZYRAXON Control Systems** page carries the complete, searchable catalog with a downloadable text file. Tools are also exposed to other agents through the MCP server, so an external client can discover them the same way.",
      },
    ],
  },
  {
    slug: "x-tools",
    title: "ZYRAXON Control Systems (224+)",
    group: "ZYRAXON Agent",
    desc: "Real algorithms for aircraft, cars, drones, boats, rockets, and robots.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON includes **224 real control-system classes across 54 source files** -- production-grade vehicle and robotics control inside an AI agent. Every algorithm is a real PID loop, a real aerodynamic model, real physics.",
      },
      {
        t: "note",
        kind: "success",
        title: "Full catalog",
        text: "Use the search box above to filter by tool name or description, or download the complete text catalog for offline reading.",
      },
    ],
  },
  {
    slug: "vision-system",
    title: "Vision System",
    group: "ZYRAXON Agent",
    desc: "Real-time screen capture, frame memory, and scene analysis.",
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
          ["capture-engine.ts", "Cross-platform screenshot capture"],
          ["frame-memory.ts", "Frame storage and memory management"],
          ["frame-processor.ts", "Frame processing pipeline"],
          ["vision-analyzer.ts", "Scene analysis and understanding"],
          ["vision-context.ts", "VisionContextManager singleton"],
          ["vision-mode.ts", "VisionMode orchestrator"],
          ["auto-vision.ts", "Automatic vision injection into every prompt"],
        ],
      },
      { t: "h2", text: "How it works" },
      {
        t: "list",
        ordered: true,
        items: [
          "You send a message.",
          "The session layer checks whether the active agent uses vision.",
          "A screenshot is captured and converted to base64.",
          "The image is injected as content into the AI message.",
          "The model receives and processes the screenshot.",
          "The agent replies with full screen understanding.",
        ],
      },
      { t: "h2", text: "Vision Mode capabilities" },
      {
        t: "list",
        items: [
          "24/7 continuous screen streaming",
          "Frame memory with scene-change detection",
          "Activity tracking and intelligent recall",
          "Timeline recall -- ask what happened on screen minutes ago",
        ],
      },
      {
        t: "note",
        kind: "tip",
        title: "Auto Vision",
        text: "In modes that enable it, vision is injected automatically into every prompt, so the agent sees what you see without being asked.",
      },
    ],
  },
  {
    slug: "memory-system",
    title: "Eternal Memory",
    group: "ZYRAXON Agent",
    desc: "50,000+ compressed memories that survive forever.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON\u2019s Eternal Memory stores everything you have discussed -- over **50,000 memories** with automatic compression. Months later, the agent still recalls context from past sessions. It remembers everything, forever.",
      },
      { t: "h2", text: "Memory architecture" },
      {
        t: "table",
        head: ["Layer", "What it does"],
        rows: [
          ["SQLite WAL", "Persistent storage with 8 compound indexes"],
          ["Ring buffer", "Last 50 conversation pairs, crash-resilient"],
          ["Brain daemon", "Runs every second, tails the session database"],
          ["permanent_brain.json", "Live brain state"],
          ["full_chat_history.txt", "Static cache (85,000+ lines)"],
          ["Compression", "Automatic at 50K+ entries"],
          ["Reset survival", "Re-armed by the task scheduler on boot"],
        ],
      },
      { t: "h2", text: "How it works" },
      {
        t: "list",
        items: [
          "Every turn (your message plus the reply) is persisted automatically.",
          "A ring buffer keeps recent messages hot in memory.",
          "Older content is progressively compressed rather than deleted.",
          "Relevant memories are injected into prompts via `memory/auto-injection.ts`.",
          "Storage survives restarts -- even a full machine reset.",
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "Why it matters",
        text: "Decisions, conventions and architecture notes persist across sessions and projects, so the second week of a project starts with the first week\u2019s context already loaded.",
      },
    ],
  },
  {
    slug: "self-healing",
    title: "Self-Healing and Self-Evolution",
    group: "ZYRAXON Agent",
    desc: "Zero dead ends -- the agent repairs and improves itself.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON\u2019s most distinctive capability: **if a tool is missing, it installs one.** The agent does not stop at a failure; it looks for another route, retries with backoff, and reports what it did instead of surfacing a dead end.",
      },
      { t: "h2", text: "The healing loop" },
      {
        t: "list",
        ordered: true,
        items: [
          "You request something that needs a tool ZYRAXON does not have.",
          "The agent checks its currently available tools.",
          "It searches online for a suitable MCP server, npm package or script.",
          "It installs and configures the missing capability.",
          "The task resumes immediately with the new tool.",
        ],
      },
      { t: "h2", text: "Self-evolution" },
      {
        t: "p",
        text: "Beyond healing, ZYRAXON proactively improves itself at runtime -- installing its own MCP servers and building new tools when it detects repeated needs. The `self_evolve` built-in tool drives this loop, writing a new tool and registering it without a restart.",
      },
      { t: "h2", text: "What it recovers from" },
      {
        t: "table",
        head: ["Failure", "Recovery"],
        rows: [
          ["Missing tool", "Searches, installs and configures it"],
          ["Failing test", "Diagnoses the cause and fixes it"],
          ["Code that will not run", "Works on it until it does"],
          ["Dropped MCP connection", "Reconnects; the Effect runtime releases the dead resource"],
          ["Machine restart", "Every session is persisted; the next run resumes where it stopped"],
        ],
      },
    ],
  },
  {
    slug: "mcp-hub",
    title: "MCP Hub and Integrations",
    group: "ZYRAXON Agent",
    desc: "108 connectable apps, verified against their real servers.",
    blocks: [
      {
        t: "p",
        text: "The MCP Hub is one place to connect an account and hand its tools to the agent. A single **MCP Connect** button lists every connectable app in the order of what it asks of you -- apps that sign in through a browser first, then apps that want an API key, then apps that need nothing at all. Clicking one opens that app\u2019s own consent page in your real browser, and once you allow it the tools are live in the session.",
      },
      { t: "h2", text: "What is in the catalog" },
      {
        t: "table",
        head: ["Kind", "Apps", "What it means"],
        rows: [
          [
            "Browser sign-in",
            "69",
            "Opens that app\u2019s consent page. The token is stored on this machine.",
          ],
          ["Needs a token", "9", "You paste a token you created yourself."],
          ["Open", "19", "No sign-in. Public data, live immediately."],
          ["Runs locally", "11", "A process on this machine. Nothing leaves the box."],
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "Nothing is listed that was not seen working",
        text: "Every endpoint was sent a real JSON-RPC `initialize`, then a `tools/list`, and where a read-only tool existed, an actual `tools/call`. Where a vendor has no usable MCP endpoint, the app is absent rather than present and broken.",
      },
      { t: "h2", text: "Categories" },
      {
        t: "p",
        text: "The 108 apps span 27 categories: AI & Media, Automation, Code, Commerce, Communication, Database, Design, Developer, Documents, Finance, Hosting, Infrastructure, Knowledge, Maps, Marketing, Media, Monitoring, Payments, Productivity, Project, Sales, Search, Social, Storage, System, Weather and more.",
      },
      { t: "h2", text: "How authentication is classified" },
      {
        t: "table",
        head: ["Auth kind", "Tier shown", "What happens"],
        rows: [
          [
            "oauth",
            "Browser sign-in",
            "A sign-in document is discovered, or the vendor issues a client from its console. Press Connect, allow, done.",
          ],
          [
            "token",
            "Needs a token",
            "No way in without a secret -- the handshake or the call demands a key. Paste it and it is connected.",
          ],
          [
            "none",
            "No sign-in",
            "Initialize, tools/list and a read-only call all answered with no credential at all.",
          ],
          ["local", "Runs locally", "Started as a local process on this machine."],
        ],
      },
      { t: "h2", text: "Bundled local servers" },
      {
        t: "p",
        text: "Four local MCP servers ship with the app, so nothing needs installing before the agent can act: **Jarvis Browser**, **Nuphus**, **Touchpoint** and **desktop-commander**. The Hub also runs servers fetched from a package registry on demand, reading only the environment variables each one declares.",
      },
      {
        t: "note",
        kind: "tip",
        title: "See the full list",
        text: "The **Connected Apps** page lists every app with its category and auth tier, filterable by search and tier.",
      },
    ],
  },
  {
    slug: "providers",
    title: "AI Providers and Routing",
    group: "ZYRAXON Agent",
    desc: "25+ providers behind one interface, routed automatically.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON is **provider-agnostic by design**. OpenAI, Anthropic, Google, Groq, OpenRouter, Ollama, Mistral, xAI, Azure, Bedrock and the open-weight ecosystem are all plug-ins behind a single interface. The engine never hardcodes a vendor -- it routes.",
      },
      { t: "h2", text: "Why routing matters" },
      {
        t: "list",
        items: [
          "**Price goes up** -- the engine switches to a cheaper working model.",
          "**Speed matters** -- it switches to the fastest one available.",
          "**A service disappears** -- it keeps running on the others.",
          "**You prefer local** -- it routes to Ollama or open-weight weights with no subscription.",
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "Nobody can switch you off",
        text: "Because there is no single door to stand behind, a vendor outage or a price change is a routing decision, not an outage. The provider layer lives in `packages/llm` and the routing logic in `packages/zyraxon/src/provider/`.",
      },
      { t: "h2", text: "Provider families" },
      {
        t: "table",
        head: ["Family", "Examples"],
        rows: [
          ["Commercial frontier", "OpenAI, Anthropic, Google, xAI, Mistral"],
          ["Cloud-hosted", "Azure OpenAI, AWS Bedrock, Google Vertex"],
          ["Aggregators", "OpenRouter, Groq"],
          ["Local / open-weight", "Ollama, local weights"],
          ["Compatible endpoints", "Any OpenAI-compatible base URL"],
        ],
      },
      { t: "h2", text: "Bring your own key" },
      {
        t: "p",
        text: "Keys are configured once and stored locally. Before anything is sent to an external model, every API key, token and password is filtered out, so a secret in your workspace cannot leak into a prompt. Every tool call asks for your permission first.",
      },
      { t: "h2", text: "Pinned local models" },
      {
        t: "p",
        text: "A small set of models can be pinned and run locally -- text, image, video and audio generation -- so a machine with the weights installed keeps working with no network at all.",
      },
    ],
  },
  {
    slug: "permissions",
    title: "Permissions and Security",
    group: "ZYRAXON Agent",
    desc: "A layered permission system, secret filtering, and local-first data.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON runs on your machine and treats that as the default boundary. Every tool call is evaluated by a layered permission system before it runs, and every secret is filtered before it reaches a model.",
      },
      { t: "h2", text: "The permission layers" },
      {
        t: "table",
        head: ["Layer", "Decides"],
        rows: [
          ["Mode", "Which tools a mode may call at all (for example, Plan denies all writes)"],
          ["Tier", "Which tools an account is entitled to"],
          ["Rule", "Per-tool allow/deny/ask rules the user sets"],
          [
            "Evaluation",
            "The runtime check in `packages/zyraxon/src/permission/` that resolves the three above",
          ],
        ],
      },
      {
        t: "note",
        kind: "success",
        title: "Nothing is granted silently",
        text: "A tool call that no layer permits is refused with a reason, not run by accident. Subagents inherit a narrowed permission set rather than the parent\u2019s full one.",
      },
      { t: "h2", text: "Secret handling" },
      {
        t: "list",
        items: [
          "API keys, tokens and passwords are filtered out before anything is sent to an external model.",
          "Keys are stored locally and never leave the machine.",
          "Zero Distribution -- your files, data and keys stay put.",
        ],
      },
      { t: "h2", text: "Zero Distribution" },
      {
        t: "p",
        text: "Everything runs locally. The desktop app, the local models and the bundled MCP servers need no account and no network to do local work. When you do connect a remote provider or MCP app, only that call leaves the machine, and only with the credential you supplied for it.",
      },
      { t: "h2", text: "Reporting a security issue" },
      {
        t: "p",
        text: "Do not open a public issue for a security problem. Email the maintainers, or use the private reporting channel in the repository.",
      },
    ],
  },

  // ────────────────────────────── FEATURES ──────────────────────────────
  {
    slug: "packages",
    title: "Packages and Monorepo Layout",
    group: "Features",
    desc: "What each package in the monorepo holds, and why the boundaries matter.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON is a monorepo. Dependencies point one way and only one way: client runtime code may depend on Schema and Protocol but never on Core or Server -- which is what keeps a provider change from rippling into the UI.",
      },
      { t: "h2", text: "Core packages" },
      {
        t: "table",
        head: ["Package", "Holds"],
        rows: [
          ["packages/schema", "The data shapes everything agrees on"],
          ["packages/core", "Effects runtime, configuration, database, utilities"],
          ["packages/protocol", "The wire types"],
          ["packages/server", "HTTP API and server routes"],
          ["packages/zyraxon", "The agent: tools, session, MCP, prompts"],
          ["packages/sdk", "Generated client"],
          ["packages/sdk-next", "Next-generation Effect-TS SDK"],
          ["packages/client", "UI state and data layer"],
          ["packages/app", "The application shell"],
          ["packages/ui", "Design system"],
          ["packages/session-ui", "Chat, timeline and composer"],
          ["packages/desktop", "Electron shell, TTS, task daemon, packaging"],
          ["packages/llm", "Provider definitions and model routing"],
          ["packages/plugin", "Plugin system for custom tools"],
          ["packages/cli", "Terminal client and Node sidecar"],
          ["packages/tui", "Terminal user interface"],
        ],
      },
      { t: "h2", text: "The agent package, in detail" },
      {
        t: "table",
        head: ["Folder", "Contains"],
        rows: [
          ["src/agent", "Agent registry, prompts and mode definitions"],
          ["src/tool", "Core tools -- bash, read, write, edit, grep, glob and the rest"],
          ["src/x", "Domain tools and the control-system classes"],
          ["src/mcp", "MCP client, catalog and bundled servers"],
          ["src/session", "LLM streaming and session lifecycle"],
          ["src/screen", "Vision system"],
          ["src/memory", "Eternal memory"],
          ["src/provider", "Provider routing and model status"],
          ["src/permission", "The layered permission evaluation"],
          ["src/skill", "Skill discovery"],
        ],
      },
      { t: "h2", text: "Why the Effect runtime" },
      {
        t: "p",
        text: "The agent is written against the Effect runtime rather than ad-hoc async control flow. Cancellation, timeouts, retries and resource lifetimes are part of the type of a function instead of something to remember at each call site -- which is why a dropped MCP connection or a timed-out fetch cannot leave a resource dangling.",
      },
      {
        t: "note",
        kind: "info",
        title: "Published to npm",
        text: "The public packages are published under the `@zyraxon-ai` npm scope. See the **SDK** page for install commands.",
      },
    ],
  },
  {
    slug: "architecture",
    title: "Architecture and Tech Stack",
    group: "Features",
    desc: "Monorepo layout, packages, dependency direction, and technologies.",
    blocks: [
      {
        t: "p",
        text: "One repository produces every surface -- desktop, terminal and server -- from a shared engine and a shared set of types. This page is the map: what the layers are, which way dependencies point, and exactly which technologies sit underneath.",
      },
      { t: "h2", text: "Tech stack" },
      {
        t: "table",
        head: ["Layer", "Technology"],
        rows: [
          ["Runtime & package manager", "Bun 1.3.14"],
          ["Desktop shell", "Electron 44 + electron-vite"],
          ["UI", "SolidJS 1.9 + TailwindCSS 4"],
          ["Language", "TypeScript 5.8"],
          ["Build", "Vite 7, electron-builder, Turborepo 2.10"],
          ["Database", "SQLite (drizzle-orm 1.0) in WAL mode"],
          ["LLM runtime", "AI SDK (Vercel) 6.0"],
          ["Async runtime", "Effect 4.0"],
          ["Browser automation", "Playwright (Chromium)"],
          ["Voice input", "Chrome SpeechRecognition"],
          ["Voice output", "Edge Neural TTS"],
          ["Memory", "SQLite WAL + ring buffer + brain daemon"],
          ["Subagents", "3-level deep Mission Control"],
          ["Providers", "25+ (OpenAI, Anthropic, Google, Azure, Bedrock, xAI, Mistral...)"],
        ],
      },
      { t: "h2", text: "Dependency direction" },
      {
        t: "p",
        text: "Dependencies point downward and never back up. The client and session UI depend on Schema and Protocol only -- never on Core or Server -- which is what keeps a change in the engine from rippling into the interface.",
      },
      {
        t: "code",
        lang: "text",
        code: "                    \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n                    \u2502        Desktop / TUI / SDK   \u2502   \u2190 what you interact with\n                    \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n                                    \u2502\n                    \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25bc\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n                    \u2502      Client  \u00b7  Session-UI   \u2502   \u2190 state, chat, composer\n                    \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n                                    \u2502  depends on Schema + Protocol only\n                    \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25bc\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n                    \u2502         SDK  \u00b7  Protocol     \u2502   \u2190 wire types, generated client\n                    \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n                                    \u2502\n                    \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25bc\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n                    \u2502            Core              \u2502   \u2190 effects runtime, config,\n                    \u2502   Schema   Server   Agent    \u2502     database, tools, MCP\n                    \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
      },
      { t: "h2", text: "Project structure" },
      {
        t: "code",
        lang: "text",
        code: "ZYRAXON-AI/\n\u251c\u2500\u2500 packages/\n\u2502   \u251c\u2500\u2500 zyraxon/          # Core AI engine (888 tools, 63 categories)\n\u2502   \u2502   \u251c\u2500\u2500 src/\n\u2502   \u2502   \u2502   \u251c\u2500\u2500 agent/    # 11 agent modes\n\u2502   \u2502   \u2502   \u251c\u2500\u2500 mcp/      # MCP servers + tools\n\u2502   \u2502   \u2502   \u251c\u2500\u2500 tool/     # Core tools\n\u2502   \u2502   \u2502   \u251c\u2500\u2500 x/        # domain tools + control systems\n\u2502   \u2502   \u2502   \u251c\u2500\u2500 session/  # LLM streaming\n\u2502   \u2502   \u2502   \u251c\u2500\u2500 screen/   # Vision system\n\u2502   \u2502   \u2502   \u2514\u2500\u2500 memory/   # Eternal memory\n\u2502   \u251c\u2500\u2500 desktop/          # Electron app\n\u2502   \u251c\u2500\u2500 app/              # SolidJS UI\n\u2502   \u251c\u2500\u2500 ui/               # Shared components\n\u2502   \u251c\u2500\u2500 core/             # Database, utilities\n\u2502   \u251c\u2500\u2500 llm/              # 25+ provider routing\n\u2502   \u2514\u2500\u2500 session-ui/       # Session UI",
      },
      { t: "h2", text: "Request lifecycle" },
      {
        t: "list",
        ordered: true,
        items: [
          "The surface (desktop, TUI or SDK) creates a session.",
          "Your prompt is assembled with memory and, where enabled, a screen frame.",
          "The provider layer picks a working model and streams the reply.",
          "The agent selects tools; each call is checked by the permission layers.",
          "Results are persisted to memory and streamed back as events.",
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "Why one repo",
        text: "Sharing types across every surface means a protocol change is caught at build time everywhere at once, rather than discovered in production in one client.",
      },
    ],
  },

  // ──────────────────────────── DEVELOPMENT ────────────────────────────
  {
    slug: "sdk",
    title: "SDK",
    group: "Development",
    desc: "Build on top of ZYRAXON from Node, with a typed client.",
    blocks: [
      {
        t: "p",
        text: "The ZYRAXON SDK lets you drive the engine from your own Node or TypeScript application. It works with Node 18+, Bun and Deno, and the public packages are published under the `@zyraxon-ai` npm scope.",
      },
      { t: "h2", text: "Install" },
      {
        t: "code",
        lang: "bash",
        code: "npm install @zyraxon-ai/sdk\n# or, for custom tools:\nnpm install @zyraxon-ai/plugin",
      },
      { t: "h2", text: "Quick start" },
      {
        t: "code",
        lang: "ts",
        code: 'import { createZyraxonClient } from "@zyraxon-ai/sdk"\n\nconst client = createZyraxonClient({\n  baseUrl: "http://localhost:3000",\n})\n\nconst reply = await client.chat({\n  message: "Explain this repository",\n})\n\nconsole.log(reply)',
      },
      { t: "h2", text: "Streaming a session" },
      {
        t: "code",
        lang: "ts",
        code: 'import { createZYRAXON } from "@zyraxon-ai/sdk"\n\nconst zyraxon = await createZYRAXON({ directory: process.cwd() })\nconst session = await zyraxon.session.create()\n\nfor await (const event of zyraxon.session.prompt({\n  sessionID: session.id,\n  parts: [{ type: "text", text: "Explain this repository" }],\n})) {\n  console.log(event.type)\n}',
      },
      { t: "h2", text: "Package tiers" },
      {
        t: "table",
        head: ["Tier", "Packages", "For"],
        rows: [
          ["Public SDK", "`@zyraxon-ai/sdk`, `@zyraxon-ai/plugin`", "Everyone building on ZYRAXON"],
          [
            "API building blocks",
            "`@zyraxon-ai/schema`, `protocol`, `client`, `server`, `sdk-next`",
            "Developers building agents",
          ],
          [
            "Internal",
            "`@zyraxon-ai/core`, `llm`, `http-recorder`, `effect-drizzle-sqlite`, `effect-sqlite-node`",
            "Used by the desktop app",
          ],
        ],
      },
      { t: "h2", text: "Surfaces" },
      {
        t: "table",
        head: ["Surface", "What it is"],
        rows: [
          ["Desktop", "An Electron application for Windows, macOS and Linux"],
          ["TUI", "A terminal client"],
          ["Server", "An HTTP server you can point other tools at"],
          ["SDK", "A typed client for Node"],
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "Further reading",
        text: "Full documentation is in the repository\u2019s `SDK.md` and `PACKAGES.md`.",
      },
    ],
  },
  {
    slug: "cli",
    title: "CLI & TUI",
    group: "Development",
    desc: "Run the engine, build the sidecar, and drive it from the terminal.",
    blocks: [
      {
        t: "p",
        text: "Not every task needs a window. The CLI and TUI run the same engine as the desktop app, from a terminal, on a machine with no display at all.",
      },
      { t: "h2", text: "Common commands" },
      {
        t: "table",
        head: ["Command", "Does"],
        rows: [
          [
            "`bun run --cwd packages/zyraxon dev`",
            "Start the interactive TUI against the core engine",
          ],
          ["`bun run --cwd packages/cli build`", "Build the Node sidecar the desktop app ships"],
          ["`bun run --cwd packages/desktop dev`", "Run the desktop application in development"],
          ["`bun run --cwd packages/desktop build`", "Build the Electron shell"],
          ["`bun run --cwd packages/desktop package`", "Package the platform installer"],
        ],
      },
      { t: "h2", text: "What the TUI gives you" },
      {
        t: "list",
        items: [
          "The same agent modes as the desktop app.",
          "The same tool registry -- 888 tools, gated by the same tiers.",
          "Streaming replies and live tool output.",
          "Session persistence, so a restart resumes where you stopped.",
        ],
      },
      {
        t: "note",
        kind: "tip",
        title: "Headless machines",
        text: "The engine ships its own server, so a machine with no terminal UI and no display still has a working backend to drive.",
      },
    ],
  },
  {
    slug: "build-from-source",
    title: "Build From Source",
    group: "Development",
    desc: "Build the agent from source in five ordered steps.",
    blocks: [
      {
        t: "p",
        text: "A full build produces the core engine, the Node sidecar, the web UI, the Electron shell and finally the platform installer. Each step depends on the previous one, so a failure early is a real failure rather than a stale artefact.",
      },
      { t: "h2", text: "Clone and install" },
      {
        t: "code",
        lang: "bash",
        code: "git clone https://github.com/onelpawarai-X/ZYRAXON-AI.git\ncd ZYRAXON-AI\nbun install",
      },
      { t: "h2", text: "Build in order" },
      {
        t: "list",
        ordered: true,
        items: [
          "Step 1 \u00b7 Core (AI engine and server) -- `bun run --cwd packages/zyraxon build`",
          "Step 2 \u00b7 Node sidecar -- `bun run --cwd packages/cli build`",
          "Step 3 \u00b7 Web UI -- `bun run --cwd packages/app build`",
          "Step 4 \u00b7 Electron shell -- `bun run --cwd packages/desktop build`",
          "Step 5 \u00b7 Installer -- `bun run --cwd packages/desktop package`",
        ],
      },
      { t: "h2", text: "Command reference" },
      {
        t: "table",
        head: ["Command", "Description"],
        rows: [
          ["`bun run --cwd packages/zyraxon build`", "Build the AI core and server"],
          ["`bun run --cwd packages/cli build`", "Build the Node sidecar"],
          ["`bun run --cwd packages/app build`", "Build the web UI"],
          ["`bun run --cwd packages/desktop build`", "Build the Electron shell"],
          ["`bun run --cwd packages/desktop package`", "Package the installer"],
        ],
      },
      { t: "h2", text: "Running from source" },
      {
        t: "code",
        lang: "bash",
        code: "# Desktop application\nbun run --cwd packages/desktop dev\n\n# Core engine in TUI mode\nbun run --cwd packages/zyraxon dev",
      },
      {
        t: "note",
        kind: "warn",
        title: "Low-memory machines",
        text: 'On a machine with less than 16 GB available to the build, raise the heap first: `export NODE_OPTIONS="--max-old-space-size=16384"`.',
      },
      {
        t: "note",
        kind: "warn",
        title: "Windows: EPERM on dxcompiler.dll",
        text: "A file lock from antivirus or a lingering Electron process. End the process, delete the locked file, and retry the build.",
      },
    ],
  },

  // ───────────────────────────── REFERENCE ─────────────────────────────
  {
    slug: "comparison",
    title: "ZYRAXON vs The World",
    group: "Reference",
    desc: "How ZYRAXON compares with other AI coding tools.",
    blocks: [
      {
        t: "p",
        text: "Cursor is a sports car. Devin is an airline. ZYRAXON is a transformer -- a complete autonomous AI workforce in one app. Everyone else gives you one tool; ZYRAXON is everything at once.",
      },
      {
        t: "table",
        head: ["Capability", "ZYRAXON", "Cursor", "Copilot", "Devin", "OpenHands"],
        rows: [
          ["Desktop app", "Yes", "Yes", "No", "No", "No"],
          ["Embedded VS Code editor", "Yes", "Yes", "Yes", "No", "No"],
          ["11 agent modes", "Yes", "No", "No", "No", "No"],
          ["Self-healing", "Yes", "No", "No", "Limited", "Limited"],
          ["Self-evolution", "Yes", "No", "No", "No", "No"],
          ["Eternal memory (50K+)", "Yes", "Limited", "Limited", "Limited", "Limited"],
          ["Desktop automation", "Yes", "No", "No", "No", "No"],
          ["Screen vision", "Yes", "No", "No", "Limited", "No"],
          ["Voice communication", "Yes", "No", "No", "No", "No"],
          ["888 tools built-in (63 categories)", "Yes", "Limited", "Limited", "Limited", "Limited"],
          ["108 MCP integrations", "Yes", "Limited", "Limited", "Limited", "Limited"],
          ["224 control systems", "Yes", "No", "No", "No", "No"],
          ["25+ AI providers", "Yes", "Limited", "Limited", "Limited", "Limited"],
          ["Free & source-available", "ZSL-X", "Paid", "Paid", "Paid", "Yes"],
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "Legend",
        text: "**Limited** means the competitor has a partial or conditional form of the capability. **No** means it has none. Comparisons reflect the ZYRAXON v19.0.6 feature set.",
      },
    ],
  },
  {
    slug: "contributing",
    title: "Contributing and Community",
    group: "Reference",
    desc: "Fork, build, PR -- and where the community gathers.",
    blocks: [
      {
        t: "p",
        text: "ZYRAXON is source-available and built in the open. Contributions -- code, docs, bug reports and ideas -- are welcome, and every bit of it counts.",
      },
      { t: "h2", text: "How to contribute" },
      {
        t: "list",
        ordered: true,
        items: [
          "Fork the repository on GitHub.",
          "Clone it: `git clone https://github.com/onelpawarai-X/ZYRAXON-AI.git`",
          "Install dependencies: `bun install`",
          "Build the engine: `bun run --cwd packages/zyraxon build`",
          "Create a branch: `git checkout -b feat/my-feature`",
          "Commit, push, and open a pull request.",
        ],
      },
      { t: "h2", text: "What we ask" },
      {
        t: "list",
        items: [
          "Do not sell ZYRAXON itself.",
          "Do not republish a modified copy as your own.",
          "Do not remove the credit.",
        ],
      },
      { t: "h2", text: "Community channels" },
      {
        t: "table",
        head: ["Channel", "Link"],
        rows: [
          ["GitHub", "github.com/onelpawarai-X/ZYRAXON-AI"],
          ["Discord", "discord.gg/h8mHvf45g"],
          ["YouTube", "youtube.com/@ZYRAXONAI"],
          ["Website", "zyraxonai.lovable.app"],
          ["Cloud Agent", "zyraxon-pro-x.lovable.app"],
        ],
      },
      {
        t: "note",
        kind: "tip",
        title: "Join the roster",
        text: "The **Community** page lets you publish a verified profile with a photo, your role and your links, so other people can find you.",
      },
    ],
  },
  {
    slug: "zsl",
    title: "Zyraxon Sovereign License (ZSL)",
    group: "Reference",
    desc: "Our source-available license -- commercial freedom, patent protection, identity safety.",
    blocks: [
      { t: "h2", text: "What is ZSL?" },
      {
        t: "p",
        text: "The Zyraxon Sovereign License (ZSL) is an original source-available license created for the ZYRAXON ecosystem. It grants broad commercial, modification and redistribution rights while protecting project identity and origin.",
      },
      { t: "h2", text: "Why ZSL?" },
      {
        t: "p",
        text: "ZSL combines the permissive core of MIT and Apache with protections those licenses do not offer: patent grants, identity protection, automatic transition to the next-generation license, and enterprise-grade clarity.",
      },
      { t: "h3", text: "Key features" },
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
      { t: "h2", text: "The two editions" },
      { t: "h3", text: "ZSL-X v2.0.0 (active 2026\u20132028)" },
      {
        t: "p",
        text: "The active license for all ZYRAXON projects. Full commercial rights, modification and fork rights, redistribution with attribution, a patent grant from contributors, project identity protection, and an automatic transition to MEKRA-X in 2028.",
      },
      { t: "h3", text: "MEKRA-X v2.0.0 (auto-activates 2028)" },
      {
        t: "p",
        text: "The successor edition and the strictest of the license family. It keeps the same generous core, adds explicit paid-tier protection, and keeps automatic termination for resale or rebranding.",
      },
      { t: "h2", text: "How to use it" },
      { t: "p", text: "Reference it in your project:" },
      {
        t: "code",
        code: "Licensed under the Zyraxon Sovereign License\n\u2014 X Edition (ZSL-X v2.0.0)\nSee https://github.com/onelpawarai-X/ZSL",
      },
      { t: "p", text: "Or include the full license file from GitHub." },
      { t: "h2", text: "Links" },
      {
        t: "table",
        head: ["Resource", "Link"],
        rows: [
          ["Full license page", "/zsl"],
          ["GitHub repository", "github.com/onelpawarai-X/ZSL"],
          ["ZSL-X full text", "github.com/onelpawarai-X/ZSL/blob/main/ZSL-X-LICENSE"],
          ["MEKRA-X full text", "github.com/onelpawarai-X/ZSL/blob/main/MEKRA-X-LICENSE"],
        ],
      },
    ],
  },
  {
    slug: "faq",
    title: "FAQ and Troubleshooting",
    group: "Reference",
    desc: "Common questions, known issues, and the roadmap.",
    blocks: [
      { t: "h2", text: "General" },
      { t: "h3", text: "Is ZYRAXON free?" },
      {
        t: "p",
        text: "Yes -- ZSL-X licensed and free to use and modify. Premium tiers (Pro $5, Max $15, Ultra $99) unlock more tools and capacity.",
      },
      { t: "h3", text: "Does it work offline?" },
      {
        t: "p",
        text: "Yes. ZYRAXON runs locally with direct access to your files, terminal and screen. LLM providers are configurable -- bring your own keys, or run local models through Ollama.",
      },
      { t: "h3", text: "Which AI models does it support?" },
      {
        t: "p",
        text: "25+ providers including OpenAI, Anthropic, Google, Azure, Bedrock, xAI and Mistral, routed automatically through `packages/llm`.",
      },
      { t: "h3", text: "How many tools does it have?" },
      {
        t: "p",
        text: "888 registered tools across 63 categories, split 186 free / 317 pro / 324 max / 61 ultra. There are also 108 MCP integrations and 224 control-system classes.",
      },
      { t: "h3", text: "How do I give feedback?" },
      {
        t: "p",
        text: "Use the **Desktop Feedback** page. You can email the team directly, or open a tracked GitHub issue that anyone can follow.",
      },
      { t: "h2", text: "Installation" },
      { t: "h3", text: "macOS says the app is damaged or cannot be opened" },
      {
        t: "p",
        text: "The build is not signed with an Apple Developer ID yet, so Gatekeeper stops the first launch. Right-click the app, choose **Open**, then confirm. One time only.",
      },
      { t: "h3", text: "The Linux AppImage will not run" },
      {
        t: "p",
        text: "Mark it executable first: `chmod +x zyraxon-desktop-linux-x86_64.AppImage`, then run it.",
      },
      { t: "h3", text: "Which Windows build should I pick?" },
      {
        t: "p",
        text: "x64 for almost every PC. On a Surface Pro X or a Snapdragon laptop, take the ARM64 installer -- it runs at native speed instead of under emulation.",
      },
      { t: "h2", text: "Known issues" },
      { t: "h3", text: "Build fails with EPERM: dxcompiler.dll" },
      {
        t: "p",
        text: "A Windows file lock from antivirus or a lingering Electron process. Kill the processes, delete the locked file, and retry.",
      },
      { t: "h3", text: "The build runs out of memory" },
      {
        t: "p",
        text: 'Raise the heap before building: `export NODE_OPTIONS="--max-old-space-size=16384"`.',
      },
      { t: "h2", text: "Roadmap" },
      {
        t: "table",
        head: ["Status", "Feature"],
        rows: [
          [
            "Shipped",
            "11 agent modes (incl. Beast / APEX / DARK EMPEROR / AUTO), 888 tools, 224 control systems, 108 MCP integrations, vision, eternal memory, self-healing, YouTube streaming, Pro Builder",
          ],
          ["Planned", "Plugin marketplace, team collaboration, optional cloud sync"],
          ["Committed at 100k stars", "Our own model, our own provider, our own ecosystem"],
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

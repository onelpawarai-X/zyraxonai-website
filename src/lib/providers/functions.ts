/** Every function the ZYRAXON Provider offers, one entry per page.
 *
 *  The provider is one base URL, but it is not one thing: it answers a chat
 *  turn, lists models, speaks, listens, carries media, calls tools, and it is
 *  reached from Termux, OpenHands, an editor, an SDK or a bot. Each of those is
 *  a *function*, and a reader arrives wanting one of them — not a wall of prose
 *  that mentions all of them.
 *
 *  So the provider page is a hub of these, and each entry gets its own route at
 *  `/providers/<slug>` showing that function alone. A function is described by
 *  pointing at the pieces that already exist — endpoint ids from
 *  `endpoints.ts`, integration ids from `integrations.ts`, and the docs page
 *  that writes it up — so a page here can never drift from the catalogue it is
 *  built from. */

export type ProviderFunctionKind = "endpoint" | "integration";

export type ProviderFunctionGroup =
  | "Talk to a model"
  | "Speech, both ways"
  | "Use it anywhere";

export const PROVIDER_FUNCTION_GROUPS: ProviderFunctionGroup[] = [
  "Talk to a model",
  "Speech, both ways",
  "Use it anywhere",
];

export type ProviderFunction = {
  slug: string;
  name: string;
  /** A short label for the card and the breadcrumb. */
  tagline: string;
  /** One or two sentences: what this function does for the caller. */
  summary: string;
  group: ProviderFunctionGroup;
  kind: ProviderFunctionKind;
  /** A single glyph, drawn in the card's accent disc. */
  glyph: string;
  /** Endpoint ids from `endpoints.ts` this function is built from. */
  endpoints?: string[];
  /** Integration ids from `integrations.ts`, for the host-app functions. */
  integrations?: string[];
  /** The long-form write-up in `/docs`, if there is one. */
  docSlug?: string;
  tags?: string[];
  /** True for the handful the hub leads with, in the order a caller meets them. */
  featured?: boolean;
};

export const PROVIDER_FUNCTIONS: ProviderFunction[] = [
  /* ───────────────────────── talk to a model ───────────────────────── */
  {
    slug: "chat",
    name: "Chat completions",
    tagline: "The one call your app makes",
    summary:
      "OpenAI chat-completions semantics — messages in, a reply or a stream of chunks out — with optional media and tools. This is the call behind every integration on this site.",
    group: "Talk to a model",
    kind: "endpoint",
    glyph: "💬",
    endpoints: ["chat"],
    docSlug: "provider-overview",
    tags: ["Streaming", "Tool calls", "Drop-in"],
    featured: true,
  },
  {
    slug: "models",
    name: "The model line",
    tagline: "Ten names you control",
    summary:
      "Ten ZYRAXON branded models behind one endpoint, with a pool of upstream models rotating underneath each. Read the catalogue to discover them, or the provider endpoint for their live health.",
    group: "Talk to a model",
    kind: "endpoint",
    glyph: "◎",
    endpoints: ["models", "provider"],
    docSlug: "provider-models",
    tags: ["Catalogue", "Live status", "Rotation"],
    featured: true,
  },
  {
    slug: "media",
    name: "Images, audio, video and PDF",
    tagline: "Send any modality to any model",
    summary:
      "Every ZYRAXON model takes every modality. Put an image, a recording, a video or a document in a message and the turn is routed to a model that can actually read it — never a text-only model made to fail.",
    group: "Talk to a model",
    kind: "endpoint",
    glyph: "▣",
    endpoints: ["chat"],
    docSlug: "provider-multimodal",
    tags: ["Image", "Video", "Audio", "PDF", "Inline or URL"],
    featured: true,
  },
  {
    slug: "tools",
    name: "Tool calling",
    tagline: "The model asks, you execute",
    summary:
      "Define functions in the OpenAI wire shape and the model returns real tool calls you run yourself. The agent loop stays in your program, where your permissions and your side effects live.",
    group: "Talk to a model",
    kind: "endpoint",
    glyph: "⚙",
    endpoints: ["chat"],
    docSlug: "provider-tools",
    tags: ["Functions", "Agent loop"],
  },
  {
    slug: "errors",
    name: "Capacity and errors",
    tagline: "What each status means",
    summary:
      "Overload degrades instead of crashing: a request is shed fast with a 503 and a Retry-After rather than queued behind a stranger. Every status the provider returns, and the retry policy for each.",
    group: "Talk to a model",
    kind: "endpoint",
    glyph: "◈",
    endpoints: ["provider"],
    docSlug: "provider-capacity",
    tags: ["503", "Retry-After", "Lanes"],
  },

  /* ───────────────────────── speech, both ways ─────────────────────── */
  {
    slug: "speech-to-text",
    name: "Speech to text",
    tagline: "A microphone for your chat box",
    summary:
      "If you are putting a microphone in your chat box, use this endpoint: you send real-time audio and we send real-time text back. One URL, two modes — a whole recording for one transcript, or raw PCM streamed live as the person is still speaking, with partial text arriving as they talk.",
    group: "Speech, both ways",
    kind: "endpoint",
    glyph: "🎙",
    endpoints: ["stt"],
    docSlug: "provider-speech-to-text",
    tags: ["Live SSE", "Batch", "100 MB", "75 languages"],
    featured: true,
  },
  {
    slug: "text-to-speech",
    name: "Text to speech",
    tagline: "Send text, get audio",
    summary:
      "If you send us text, we send you audio back. POST the answer and an MP3 streams as it is synthesised, in the language of the text — so a Bengali answer is read by a Bengali voice, not an English one sounding out Bengali letters.",
    group: "Speech, both ways",
    kind: "endpoint",
    glyph: "🔊",
    endpoints: ["tts", "voices"],
    docSlug: "provider-text-to-speech",
    tags: ["322 voices", "75 languages", "MP3 stream"],
    featured: true,
  },

  /* ───────────────────────── use it anywhere ───────────────────────── */
  {
    slug: "termux",
    name: "Termux on Android",
    tagline: "An agent in your pocket",
    summary:
      "Run ZYRAXON from a terminal on an Android phone with one setup command. It installs a `zyraxon` chat box that streams replies and can run a tool-calling agent loop on the device.",
    group: "Use it anywhere",
    kind: "integration",
    glyph: "▤",
    integrations: ["termux"],
    docSlug: "provider-integration-termux",
    tags: ["Android", "Chat box", "Tool calls"],
  },
  {
    slug: "kali-linux",
    name: "Kali Linux and NetHunter",
    tagline: "Same userland, same client",
    summary:
      "Kali on a laptop and Kali NetHunter on a phone are the same userland, so the Termux client runs on both. Point it here and the agent has a shell on a security distribution.",
    group: "Use it anywhere",
    kind: "integration",
    glyph: "◐",
    integrations: ["kali-linux"],
    docSlug: "provider-integration-kali",
    tags: ["Kali", "NetHunter"],
  },
  {
    slug: "openhands",
    name: "OpenHands",
    tagline: "A custom model that just works",
    summary:
      "Point OpenHands at this base URL with a ZYRAXON model id and it works — including the two 401s that look alike and the `openai/` prefix LiteLLM insists on.",
    group: "Use it anywhere",
    kind: "integration",
    glyph: "✦",
    integrations: ["openhands"],
    docSlug: "provider-integration-openhands",
    tags: ["OpenHands", "LiteLLM", "Custom model"],
  },
  {
    slug: "editors",
    name: "Editors and CLI agents",
    tagline: "Cursor, Cline, Aider, Zed",
    summary:
      "Any editor or terminal agent that speaks OpenAI works: Cursor, Continue, Cline, Roo Code, Kilo Code, Aider, Zed, and anything shaped like Ollama or LocalAI.",
    group: "Use it anywhere",
    kind: "integration",
    glyph: "⌘",
    integrations: [
      "openai-compatible-apps",
      "vscode-extensions",
      "zed",
      "local-runtime-style",
      "mcp-tool-hosts",
    ],
    docSlug: "provider-integration-editors",
    tags: ["Cursor", "Cline", "Aider", "Zed", "MCP"],
  },
  {
    slug: "mobile",
    name: "Mobile apps",
    tagline: "React Native, Flutter, native",
    summary:
      "The same base URL and model id from a phone app. Nothing about the connection is browser-specific, so a React Native, Flutter, Android or iOS client uses the ordinary HTTP stack.",
    group: "Use it anywhere",
    kind: "integration",
    glyph: "▢",
    integrations: ["mobile-sdk"],
    docSlug: "provider-integration-mobile",
    tags: ["React Native", "Flutter", "iOS", "Android"],
  },
  {
    slug: "sdks",
    name: "SDKs and frameworks",
    tagline: "One base URL, every client",
    summary:
      "The OpenAI SDK, the Vercel AI SDK, LangChain, LiteLLM, cURL, and a shell in Python, PowerShell, Bash, Go, Rust, PHP, Java or .NET. Set the base URL and the key, and the framework does the rest.",
    group: "Use it anywhere",
    kind: "integration",
    glyph: "⟨⟩",
    integrations: [
      "curl",
      "openai-sdk",
      "vercel-ai-sdk",
      "langchain",
      "litellm",
      "python-shell",
      "powershell",
      "bash-shell",
      "go",
      "rust",
      "php",
      "java",
      "dotnet",
      "http-clients",
    ],
    docSlug: "provider-integration-sdks",
    tags: ["OpenAI SDK", "LangChain", "LiteLLM", "10 languages"],
  },
  {
    slug: "automation",
    name: "Bots, home and automation",
    tagline: "Discord, Slack, n8n, Home Assistant",
    summary:
      "Wire the provider into a chat bot, a home-automation flow or a workflow runner. Same endpoint, same model ids — the bot is just another OpenAI-compatible client.",
    group: "Use it anywhere",
    kind: "integration",
    glyph: "◫",
    integrations: ["chat-bots", "home-automation", "n8n"],
    docSlug: "provider-integrations",
    tags: ["Discord", "Slack", "n8n", "Home Assistant"],
  },
  {
    slug: "voice",
    name: "Voice in, voice out",
    tagline: "The whole loop, end to end",
    summary:
      "Record on the device, transcribe it, send the transcript as a chat turn, then speak the answer back — a complete hands-free loop across the speech and chat endpoints together.",
    group: "Use it anywhere",
    kind: "integration",
    glyph: "◉",
    integrations: ["voice"],
    docSlug: "speech",
    tags: ["Speech to text", "Text to speech", "Full loop"],
  },
];

export function getProviderFunction(slug: string | undefined): ProviderFunction | undefined {
  return PROVIDER_FUNCTIONS.find((f) => f.slug === slug);
}

export function providerFunctionsIn(group: ProviderFunctionGroup): ProviderFunction[] {
  return PROVIDER_FUNCTIONS.filter((f) => f.group === group);
}

export const PROVIDER_FUNCTION_STATS = {
  total: PROVIDER_FUNCTIONS.length,
  groups: PROVIDER_FUNCTION_GROUPS.length,
};

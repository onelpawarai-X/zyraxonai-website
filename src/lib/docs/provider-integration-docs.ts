/** How to use the ZYRAXON provider from every kind of client, as documentation.
 *
 *  Kept out of `content.ts` for the same reason `provider-docs.ts` is: the
 *  integration surface grows by platform, and the general docs registry should
 *  not grow with it. The shape is the shared `DocPage`, so these pages get the
 *  sidebar, search and prev/next for free.
 *
 *  The snippets and the connection fields are read from
 *  `@/lib/providers/integrations`, the same catalogue the `/providers` page and
 *  `GET /v1/integrations` serve. One source means the docs cannot describe a
 *  base URL the endpoint does not serve. */
import type { DocPage } from "./content";
import {
  ANY_API_KEY,
  API_ORIGIN,
  CHAT_URL,
  DEFAULT_MODEL,
  INTEGRATIONS_URL,
  LITELLM_MODEL,
  MODELS_URL,
  PROVIDER_URL,
  USAGE_RULES,
  V1_BASE_URL,
  getIntegration,
} from "@/lib/providers/integrations";

const ruleBlocks = USAGE_RULES.map((r) => ({ t: "h3" as const, text: r.title })).flatMap((h, i) => [
  h,
  { t: "p" as const, text: USAGE_RULES[i]!.text },
]);

/** Pull a snippet out of the catalogue by id and label, so a docs page can show
 *  the exact code the endpoint hands out. Throws at build time if the snippet is
 *  renamed, which is better than silently rendering an empty block. */
function snippet(id: string, label: string): string {
  const integration = getIntegration(id);
  const found = integration?.snippets?.find((s) => s.label === label);
  if (!found) throw new Error(`integration snippet not found: ${id} / ${label}`);
  return found.code;
}

const TERMUX = getIntegration("termux")!;
const KALI = getIntegration("kali-linux")!;
const OPENHANDS = getIntegration("openhands")!;
const MOBILE = getIntegration("mobile-sdk")!;
const COMPATIBLE = getIntegration("openai-compatible-apps")!;

const fieldTable = (integration: typeof OPENHANDS): string[][] =>
  (integration.fields ?? []).map((f) => [f.label, f.value, f.note ?? ""]);

export const PROVIDER_INTEGRATION_DOCS: DocPage[] = [
  {
    slug: "provider-integrations",
    title: "Use It From Anywhere",
    group: "ZYRAXON Provider",
    desc: "Connect Termux, OpenHands, an editor, a mobile app, an SDK or a workflow runner to the ZYRAXON line. One base URL, one model id, no adapter.",
    blocks: [
      {
        t: "p",
        text: `The ZYRAXON provider speaks the OpenAI chat-completions dialect, so the integration is the same everywhere: point a client at \`${V1_BASE_URL}\`, pick a model id, and build. There is nothing to install on our side, no provider key to buy, and no upstream vendor name in any response.`,
      },
      {
        t: "note",
        kind: "info",
        title: "The whole connection, in one box",
        text: `Base URL: \`${V1_BASE_URL}\` · Model: \`${DEFAULT_MODEL}\` · API key: \`${ANY_API_KEY}\` (any non-empty string). Read \`${MODELS_URL}\` for the current model list and live limits.`,
      },
      {
        t: "p",
        text: "The snippets and the connection fields on this page are read from the same catalogue the `/providers` page and `GET /v1/integrations` serve, so what you read here is exactly what the endpoint hands out.",
      },
      { t: "h2", text: "Pick your client" },
      {
        t: "table",
        head: ["If you use", "Go to", "What you do"],
        rows: [
          [
            "Termux on Android",
            "**Termux on Android**",
            "Run one setup script, then use the `zyraxon` command.",
          ],
          [
            "Kali Linux or NetHunter",
            "**Kali Linux and NetHunter**",
            "Install curl and jq, then use the `zyraxon-ask` script.",
          ],
          ["OpenHands", "**OpenHands**", "Fill four fields in the custom-provider form and save."],
          [
            "Cursor, Continue, Cline, Zed",
            "**Editors and CLI Agents**",
            "Set an OpenAI-compatible base URL.",
          ],
          [
            "A mobile app you are building",
            "**Mobile apps**",
            "Call the HTTP endpoint from the platform's own client.",
          ],
          [
            "cURL, the OpenAI SDK, LangChain",
            "**SDKs and Frameworks**",
            "Change the base URL and keep your code.",
          ],
          [
            "Go, Rust, PHP, Java, .NET",
            "**Languages and Runtimes**",
            "Use the standard library's HTTP client.",
          ],
          [
            "Discord, Slack, Home Assistant",
            "**Bots and Home Automation**",
            "One HTTP call per message.",
          ],
          [
            "A Python, PowerShell or Bash shell",
            "**Your Shell**",
            "Download one client and import or source it.",
          ],
          [
            "n8n, Make, Zapier, Postman",
            "**Automation and HTTP Clients**",
            "Use an HTTP request node.",
          ],
        ],
      },
      {
        t: "note",
        kind: "tip",
        title: "Machine-readable, if you would rather not read",
        text: `\`GET ${INTEGRATIONS_URL}\` returns this whole page as JSON — the base URL, the key rule, the model list location and a working snippet per platform. Point an installer or an agent at it instead of copying code by hand.`,
      },
      { t: "h2", text: "The rules of use" },
      {
        t: "p",
        text: "These apply to every client above. They are the same rules the endpoint publishes from `GET /v1/provider`, so a client can read them at runtime rather than trusting a page.",
      },
      ...ruleBlocks,
      { t: "h2", text: "Prove the connection in one call" },
      {
        t: "code",
        lang: "shell",
        code: `curl -s ${CHAT_URL} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${ANY_API_KEY}" \\
  -d '{"model":"${DEFAULT_MODEL}","messages":[{"role":"user","content":"ping"}]}' \\
| jq -r '.choices[0].message.content'`,
      },
      {
        t: "p",
        text: "If that prints a reply, the base URL and key are correct and every client below will work. If it fails, read the `type` field in the error body before changing anything else.",
      },
    ],
  },

  {
    slug: "provider-integration-termux",
    title: "Termux on Android",
    group: "ZYRAXON Provider",
    desc: "A chat box in your phone terminal: install once, run `zyraxon`, and talk to the agent. Any model, tool calling, and a full command list.",
    blocks: [
      {
        t: "p",
        text: "Termux is a real Linux userland on Android with a real package manager, so the provider works from a phone exactly as it does from a laptop. The setup script installs `curl` and `jq`, writes your settings to `~/.zyraxon/env`, and installs a `zyraxon` command.",
      },
      {
        t: "note",
        kind: "tip",
        title: "Run `zyraxon` with no arguments and you get a chat box",
        text: "Type a message, press enter, and the reply streams in. The conversation is kept, so follow-ups work. `/models` lists every model, `/model` switches to any of them, and `/agent on` lets the model read, write and run things on the device — asking first each time.",
      },
      {
        t: "note",
        kind: "warn",
        title: "Install Termux from F-Droid",
        text: "The Play Store build is abandoned and its package repositories are stale, so `pkg install` fails against it. Use F-Droid or the GitHub release.",
      },
      { t: "h2", text: "Setup" },
      {
        t: "p",
        text: "The script is served as a plain file, so you can read it before you run it. That is deliberate: a piped installer you have not read is a stranger's code running on your phone.",
      },
      { t: "code", lang: "bash", code: snippet("termux", "Setup") },
      {
        t: "p",
        text: `Download and read it first if you prefer: \`curl -fsSL ${API_ORIGIN}/integrations/termux-setup.sh\`.`,
      },
      { t: "h2", text: "The chat box" },
      {
        t: "p",
        text: "This is the whole point: one command, then a prompt. Everything below is typed into that prompt.",
      },
      { t: "code", lang: "text", code: snippet("termux", "The chat box") },
      { t: "h2", text: "Every command" },
      {
        t: "p",
        text: "These are the same commands `/help` prints inside the client, so the list is available offline and on the device.",
      },
      { t: "code", lang: "text", code: snippet("termux", "Commands") },
      {
        t: "note",
        kind: "success",
        title: "Any model, not a fixed list",
        text: "The client reads the model list live from the provider, so `/model` can select every model the provider serves today — and any model added later — with no client update. Pick by number from `/models`, or by id.",
      },
      { t: "h2", text: "What the script installs" },
      {
        t: "list",
        items: [
          "**`curl` and `jq`** through `pkg`, so the calls and the JSON parsing have real tools behind them.",
          "**`~/.zyraxon/env`** holding `ZYRAXON_BASE`, `ZYRAXON_MODEL` and `ZYRAXON_KEY` (mode 600).",
          "**`~/.local/bin/zyraxon`**, the client, with `~/.local/bin` added to `PATH` in `~/.bashrc`.",
        ],
      },
      { t: "h2", text: "One-shot use, for scripts and pipes" },
      {
        t: "p",
        text: "The same client works without the chat box, so it composes with a pipe or a cron job.",
      },
      {
        t: "list",
        items: [
          '`zyraxon "explain this repo in three bullets"` — stream one answer and exit.',
          '`zyraxon -a "create hello.py and run it"` — one agent turn with tools, then exit.',
          '`echo "what is 2+2?" | zyraxon` — read the prompt from stdin.',
          '`zyraxon -m zyraxon-apex "..."` — pick a model for one turn.',
          "`zyraxon --models` — print the live model list.",
        ],
      },
      { t: "h2", text: "Manual setup, without the script" },
      {
        t: "p",
        text: "If you would rather do it by hand, this is everything needed to make a call work — including fetching the client on its own.",
      },
      { t: "code", lang: "bash", code: snippet("termux", "Manual setup") },
      { t: "h2", text: "A streaming one-liner" },
      {
        t: "p",
        text: "This is the whole streaming path in four commands: post, unwrap the SSE frames, drop the terminator, print the deltas.",
      },
      { t: "code", lang: "bash", code: snippet("termux", "Streaming one-liner") },
      { t: "h2", text: "The agent mode, and its limits" },
      {
        t: "p",
        text: "With `/agent on` (or `-a`), the client defines three tools — `read_file`, `write_file` and `run_shell` — and runs the OpenAI tool-calling loop: send the tools, receive a call, run it, send the result back, repeat until the model stops calling. It caps at eight turns so a confused model cannot spin forever.",
      },
      {
        t: "note",
        kind: "warn",
        title: "It asks before it acts",
        text: "`write_file` and `run_shell` print the pending action and wait for a `y`. Nothing writes or executes unattended. The client is at `~/.local/bin/zyraxon` if you want to read or change that policy.",
      },
      { t: "h2", text: "Phone-specific notes" },
      {
        t: "list",
        items: TERMUX.notes ?? [],
      },
    ],
  },

  {
    slug: "provider-integration-kali",
    title: "Kali Linux and NetHunter",
    group: "ZYRAXON Provider",
    desc: "Kali on a laptop and Kali NetHunter on a phone both run the same client: install curl and jq, wire the environment, and pipe real tool output into the model.",
    blocks: [
      {
        t: "p",
        text: "Kali is a Debian-family distribution with a full shell, so the provider needs no special handling. The one thing worth doing is giving the model real evidence — pipe the output of `nmap`, `ss` or `journalctl` straight into the model instead of describing it, and the answer is grounded in what actually happened.",
      },
      {
        t: "note",
        kind: "info",
        title: "NetHunter is the same userland",
        text: "Kali NetHunter runs a full Kali chroot on an Android phone. Anything that works on a Kali desktop works inside the chroot; the phone is the only difference.",
      },
      { t: "h2", text: "Setup" },
      { t: "code", lang: "bash", code: snippet("kali-linux", "Setup") },
      { t: "h2", text: "The zyraxon-ask script" },
      {
        t: "p",
        text: "Save this as `zyraxon-ask`, `chmod +x` it, and put it on your `PATH`. It streams a reply, reads the prompt from an argument or stdin, and takes `-m` to pick a different model for one turn.",
      },
      {
        t: "p",
        text: `Download it directly: \`curl -fsSL ${API_ORIGIN}/integrations/kali-ask.sh -o ~/.local/bin/zyraxon-ask && chmod +x ~/.local/bin/zyraxon-ask\`.`,
      },
      { t: "code", lang: "bash", code: snippet("kali-linux", "zyraxon-ask script") },
      { t: "h2", text: "Kali NetHunter on a phone" },
      { t: "code", lang: "bash", code: snippet("kali-linux", "Kali NetHunter (chroot)") },
      { t: "h2", text: "Pipe real tool output" },
      {
        t: "p",
        text: "This is where the integration earns its keep: the model reads the same evidence you do, so the answer is analysis rather than a plausible guess.",
      },
      { t: "code", lang: "bash", code: snippet("kali-linux", "Pipe tool output") },
      { t: "h2", text: "Notes" },
      { t: "list", items: KALI.notes ?? [] },
    ],
  },

  {
    slug: "provider-integration-openhands",
    title: "Connecting OpenHands",
    group: "ZYRAXON Provider",
    desc: "OpenHands takes a custom provider through a small form. The four values to enter, and how to check them before you save.",
    blocks: [
      {
        t: "p",
        text: "OpenHands is an agent, so it needs a provider it can drive with tools and streaming. ZYRAXON serves both, which makes it a drop-in custom provider: four fields in a form, no code.",
      },
      { t: "h2", text: "The four fields" },
      {
        t: "table",
        head: ["Field", "Value", "Why"],
        rows: fieldTable(OPENHANDS),
      },
      {
        t: "note",
        kind: "info",
        title: "Name is optional; the model id is not",
        text: `\`Name\` is only a label for the provider entry. \`Custom Model\` must be an id the endpoint serves — \`${DEFAULT_MODEL}\` is a safe default, and \`${MODELS_URL}\` lists all ten.`,
      },
      { t: "h2", text: "Steps" },
      { t: "list", ordered: true, items: OPENHANDS.steps ?? [] },
      { t: "h2", text: "The form, as text" },
      { t: "code", lang: "text", code: snippet("openhands", "Copy these four") },
      {
        t: "note",
        kind: "warn",
        title: "Copy the Custom Model exactly, `openai/` included",
        text: `OpenHands routes the model through LiteLLM, which reads the text before the first \`/\` to choose a handler. A bare id fails with \`LLM Provider NOT provided\` before it ever calls us, so the value to enter is \`${LITELLM_MODEL}\`.`,
      },
      { t: "h2", text: 'The "LLM Provider NOT provided" error' },
      {
        t: "p",
        text: "This is the most common failure, and it happens entirely on the OpenHands side — our endpoint is never reached, so nothing here can fix it. The model string needs a provider prefix.",
      },
      {
        t: "code",
        lang: "text",
        code: snippet("openhands", 'The "LLM Provider NOT provided" error'),
      },
      { t: "h2", text: "Verify before you save" },
      {
        t: "p",
        text: "Both calls below are cheap and prove different things: the first that the base URL serves a model list, the second that a turn actually completes.",
      },
      { t: "code", lang: "bash", code: snippet("openhands", "Verify before you save") },
      { t: "h2", text: "Turn Advanced on — the Base URL only works there" },
      {
        t: "p",
        text: "OpenHands has two settings screens. The simple one has a **Provider connection** dropdown and no Base URL box; the **Advanced** toggle at the top reveals one. If you fill the simple form, OpenHands ignores your Base URL and sends the turn to OpenAI itself.",
      },
      {
        t: "note",
        kind: "warn",
        title: "Turn Advanced on before you fill anything in",
        text: 'The Base URL box appears only once Advanced is on. If your screen shows a "Provider connection: None" dropdown instead of a Base URL field, Advanced is off.',
      },
      { t: "code", lang: "text", code: snippet("openhands", "Turn Advanced ON first") },
      { t: "h2", text: "When a turn fails" },
      {
        t: "table",
        head: ["Symptom", "Cause", "Fix"],
        rows: [
          [
            "`401 Incorrect API key provided`",
            "This message is OpenAI's, so the request never reached us — OpenHands used its default URL because Advanced mode was off and your Base URL was ignored.",
            "Turn **Advanced** on, then set Base URL to the value above.",
          ],
          [
            "`LLM Provider NOT provided`",
            "OpenHands routed the model through LiteLLM, which needs a `provider/model` string.",
            `Put \`openai/\` in front of the model: \`${LITELLM_MODEL}\`. Or set \`LLM_MODEL=\"${LITELLM_MODEL}\"\` for the OpenHands process.`,
          ],
          [
            "`Unknown model`",
            "The model id is not in the list the base URL serves.",
            `Use an id from \`${MODELS_URL}\`.`,
          ],
          [
            "`401 authentication_error` (type `authentication_error`)",
            "This one is ours: the deployment requires a provider key and yours is wrong or missing.",
            "Send the key the operator gave you as the API Key field.",
          ],
          [
            "`503 upstream_gate`",
            "The upstream free tier refused this network.",
            "Call from another network, or ask the operator to set `OPENCODE_ZEN_API_KEY`.",
          ],
          [
            "`503 overloaded`",
            "At capacity; the request was shed rather than queued.",
            "Honour `Retry-After` and retry with backoff.",
          ],
        ],
      },
      {
        t: "note",
        kind: "tip",
        title: "Tell the two 401s apart",
        text: `OpenAI's 401 says "Incorrect API key provided" and names \`platform.openai.com\` — that means the request went to OpenAI, not to us. Ours carries \`type: \"authentication_error\"\` in the JSON body. Only the second is about your key.`,
      },
      {
        t: "note",
        kind: "success",
        title: "The model id is tolerant on purpose",
        text: `\`${DEFAULT_MODEL}\`, \`openai/${DEFAULT_MODEL}\`, \`zyraxon/${DEFAULT_MODEL}\` and \`zyraxon/codex\` all resolve to the same model, so you do not have to know which spelling your version of OpenHands wants.`,
      },
      {
        t: "note",
        kind: "tip",
        title: "The same fields work in any agent",
        text: "OpenHands is one host. Any agent with a *custom provider* or *OpenAI-compatible* option takes the same four values, so this page is the template for the whole class.",
      },
    ],
  },

  {
    slug: "provider-integration-editors",
    title: "Editors and CLI Agents",
    group: "ZYRAXON Provider",
    desc: "Cursor, Continue, Cline, Aider and any OpenAI-compatible editor: change the base URL and reload the model list.",
    blocks: [
      {
        t: "p",
        text: "This is the largest group of clients and the one that needs no code at all. If an app offers an OpenAI-compatible or custom base URL setting, it already speaks our dialect.",
      },
      { t: "h2", text: "What to enter" },
      { t: "table", head: ["Field", "Value", "Why"], rows: fieldTable(COMPATIBLE) },
      { t: "h2", text: "Steps" },
      { t: "list", ordered: true, items: COMPATIBLE.steps ?? [] },
      { t: "h2", text: "Continue (config.json)" },
      {
        t: "code",
        lang: "json",
        code: snippet("openai-compatible-apps", "Continue (config.json)"),
      },
      { t: "h2", text: "Aider" },
      { t: "code", lang: "bash", code: snippet("openai-compatible-apps", "Aider") },
      { t: "h2", text: "Generic environment variables" },
      {
        t: "p",
        text: "Most command-line agents read one of these names. Setting all three is harmless and saves guessing which one your tool wants.",
      },
      {
        t: "code",
        lang: "bash",
        code: snippet("openai-compatible-apps", "Generic environment variables"),
      },
      { t: "h2", text: "VS Code: Cline, Roo Code, Kilo Code, Copilot Chat" },
      {
        t: "p",
        text: "The VS Code agent extensions expose the same OpenAI-compatible provider, so the same two values work in all of them.",
      },
      {
        t: "code",
        lang: "json",
        code: snippet("vscode-extensions", "Cline / Roo (settings.json)"),
      },
      { t: "code", lang: "bash", code: snippet("vscode-extensions", "Copilot Chat / env") },
      { t: "h2", text: "Zed" },
      { t: "code", lang: "json", code: snippet("zed", "settings.json") },
      { t: "h2", text: "Ollama-style and LocalAI-style clients" },
      {
        t: "p",
        text: "A client that expects a local model server on `localhost` can be pointed at us instead — it speaks the same dialect.",
      },
      { t: "code", lang: "bash", code: snippet("local-runtime-style", "Environment") },
      { t: "h2", text: "MCP servers and agent tool hosts" },
      {
        t: "p",
        text: "An MCP server or any agent framework can use ZYRAXON as its model and keep its own tools; they travel in the request and come back as real tool calls.",
      },
      { t: "code", lang: "json", code: snippet("mcp-tool-hosts", "Tool-carrying request") },
      { t: "h2", text: "Notes" },
      { t: "list", items: COMPATIBLE.notes ?? [] },
    ],
  },

  {
    slug: "provider-integration-mobile",
    title: "Mobile Apps and Terminals",
    group: "ZYRAXON Provider",
    desc: "React Native, Flutter, Kotlin and Swift clients call the endpoint directly — no SDK, no bundler, no adapter.",
    blocks: [
      {
        t: "p",
        text: 'A mobile app does not need the OpenAI SDK. The endpoint is plain HTTPS with CORS open to `*`, so the platform\'s own HTTP client is enough, and a WebView-based app can call it directly. This is what makes "use ZYRAXON from anything" true for phones rather than only for servers.',
      },
      {
        t: "note",
        kind: "info",
        title: "The same two values",
        text: `Base URL \`${V1_BASE_URL}\`, model \`${DEFAULT_MODEL}\`, and \`Authorization: Bearer ${ANY_API_KEY}\` unless the operator set a real key.`,
      },
      { t: "h2", text: "React Native and Expo" },
      { t: "code", lang: "typescript", code: snippet("mobile-sdk", "React Native / Expo") },
      { t: "h2", text: "Flutter" },
      { t: "code", lang: "dart", code: snippet("mobile-sdk", "Flutter / Dart") },
      { t: "h2", text: "Android (Kotlin)" },
      { t: "code", lang: "kotlin", code: snippet("mobile-sdk", "Android / Kotlin") },
      { t: "h2", text: "iOS (Swift)" },
      { t: "code", lang: "swift", code: snippet("mobile-sdk", "iOS / Swift") },
      { t: "h2", text: "Voice on a phone" },
      {
        t: "p",
        text: "Record on the device, POST the file to the speech endpoint, then send the transcript as an ordinary text turn. This is more reliable than sending audio to a model that may not accept it.",
      },
      { t: "code", lang: "bash", code: snippet("voice", "Transcribe a recording") },
      { t: "h2", text: "Notes" },
      { t: "list", items: MOBILE.notes ?? [] },
    ],
  },

  {
    slug: "provider-integration-sdks",
    title: "SDKs and Frameworks",
    group: "ZYRAXON Provider",
    desc: "The OpenAI SDK, the Vercel AI SDK and LangChain, with a working tool-calling loop in TypeScript and Python.",
    blocks: [
      {
        t: "p",
        text: "When you are writing the client rather than configuring one, these are the libraries to reach for. All three take a base URL and need nothing else, and all three support streaming and tool calls against the ZYRAXON line.",
      },
      { t: "h2", text: "The OpenAI SDK" },
      { t: "code", lang: "typescript", code: snippet("openai-sdk", "Node / TypeScript") },
      { t: "code", lang: "python", code: snippet("openai-sdk", "Python") },
      { t: "h2", text: "Tool calling, end to end" },
      {
        t: "p",
        text: "The provider returns the call and you run it — that is what keeps the model from touching anything you did not authorise. These two loops are complete: they send the tools, execute the calls and feed the results back until the model stops asking.",
      },
      {
        t: "code",
        lang: "typescript",
        code: snippet("openai-sdk", "Tool calling loop (TypeScript)"),
      },
      {
        t: "note",
        kind: "info",
        title: "The Python loop",
        text: "The same loop in Python, in the **Automation and HTTP clients** page below or the Python tab on the provider page.",
      },
      { t: "h2", text: "Vercel AI SDK" },
      { t: "code", lang: "typescript", code: snippet("vercel-ai-sdk", "TypeScript") },
      { t: "h2", text: "LangChain" },
      { t: "code", lang: "python", code: snippet("langchain", "Python") },
      { t: "code", lang: "typescript", code: snippet("langchain", "JavaScript") },
      { t: "h2", text: "LiteLLM and the gateways built on it" },
      {
        t: "p",
        text: "LiteLLM picks its handler from the text before the first `/` in the model string. A bare id like `zyraxon-codex` has no `/`, so LiteLLM stops with `BadRequestError: LLM Provider NOT provided` and never calls us. Write the model as `openai/zyraxon-codex` and it uses the generic OpenAI-compatible path.",
      },
      {
        t: "note",
        kind: "warn",
        title: "This is the most common connection error",
        text: "If you see `LLM Provider NOT provided. Pass in the LLM provider you are trying to call. You passed model=zyraxon-codex`, the fix is the model string, not the URL or the key: change `zyraxon-codex` to `openai/zyraxon-codex`.",
      },
      { t: "code", lang: "python", code: snippet("litellm", "Python") },
      {
        t: "p",
        text: "The endpoint is deliberately tolerant, so all of these resolve to the same model — `zyraxon-codex`, `openai/zyraxon-codex`, `zyraxon/zyraxon-codex`, `zyraxon/codex` and `openai/zyraxon/codex`.",
      },
      { t: "code", lang: "text", code: snippet("litellm", "Model id rules") },
      { t: "h3", text: "A LiteLLM proxy in front of the whole line" },
      {
        t: "p",
        text: "Running LiteLLM as a proxy gives you its routing, budgets, logging and virtual keys on top of ZYRAXON, and lets any other client point at one local URL.",
      },
      { t: "code", lang: "yaml", code: snippet("litellm", "litellm-config.yaml") },
      { t: "code", lang: "bash", code: snippet("litellm", "Environment") },
      {
        t: "note",
        kind: "info",
        title: "The same settings work in every LiteLLM gateway",
        text: "Open WebUI, LibreChat, Dify, Flowise and Langroid all use LiteLLM underneath, so they all take the same `openai/`-prefixed model and the same base URL.",
      },
      { t: "h2", text: "Before you ship" },
      {
        t: "list",
        items: [
          `Fetch \`${MODELS_URL}\` at startup rather than hardcoding a context window; the pool changes.`,
          "Retry 429, 502 and 503 with backoff and jitter; honour `Retry-After`. Do not retry 400, 401 or 413.",
          "Log the `type` field, not just the status: `overloaded` and `upstream_gate` are both 503 but need different actions.",
          "Treat `X-ZYRAXON-Capacity: spill` as a success, and use it as a signal to slow down.",
        ],
      },
    ],
  },

  {
    slug: "provider-integration-shells",
    title: "Your Python, PowerShell or Bash Shell",
    group: "ZYRAXON Provider",
    desc: "Three ready-made clients — one per interactive shell — so the provider is a function call in the shell you already have open. Any model, streaming, and the tool-calling agent loop.",
    blocks: [
      {
        t: "p",
        text: "If you live in a Python REPL, a PowerShell session or a Bash prompt, these clients are the shortest path. Each is a single dependency-free file served from this site, so you can download it, read it, and source or import it. No package to install, no PATH to change.",
      },
      {
        t: "note",
        kind: "success",
        title: "Any model, read live",
        text: "Every client lists the models by asking the provider, so every model it serves today — and any added later — is usable with no code change. Nothing is pinned in the client.",
      },
      { t: "h2", text: "Python — a REPL, a notebook or a script" },
      {
        t: "code",
        lang: "python",
        code: `from zyraxon import Zyraxon

ai = Zyraxon()                       # any model; ai.models() lists them live
print(ai.ask("explain what a race condition is"))

for piece in ai.stream("write a haiku about the sea"):
    print(piece, end="", flush=True)

print(ai.ask("and the same in Go?"))  # the conversation is remembered`,
      },
      {
        t: "p",
        text: `Download it: \`curl -fsSL ${API_ORIGIN}/integrations/zyraxon.py -o zyraxon.py\`.`,
      },
      {
        t: "list",
        items: [
          "`Zyraxon(model=..., base_url=..., api_key=...)` — every setting has an environment-variable default.",
          "`ai.ask(prompt)` — one turn, whole reply as a string.",
          "`ai.stream(prompt)` — a generator, so the reply can be printed or forwarded as it arrives.",
          "`ai.models()` — every model the provider serves, with its live context window and modalities.",
          "`ai.reset()` — forget the conversation, keeping any system message.",
          "`ai.agent(prompt, tools, run)` — the tool-calling loop, with your tools.",
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "It runs the loop for you",
        text: "`ai.agent(...)` sends your tools, runs whatever the model calls, feeds the result back, and stops when the model answers. It also refuses to call the same tool forever — a model that repeats a call it already ran is stopped rather than looping.",
      },
      { t: "h2", text: "PowerShell — Windows PowerShell and PowerShell 7" },
      {
        t: "code",
        lang: "powershell",
        code: `. .\\zyraxon.ps1

Get-ZyraxonModels
Invoke-Zyraxon "explain what a race condition is"
Invoke-Zyraxon "write a haiku about the sea" -Stream
Invoke-ZyraxonAgent "create hello.py that prints hi, then run it" -Confirm`,
      },
      {
        t: "p",
        text: `Download it: \`Invoke-WebRequest ${API_ORIGIN}/integrations/zyraxon.ps1 -OutFile zyraxon.ps1\`.`,
      },
      {
        t: "list",
        items: [
          '`Invoke-Zyraxon "..."` returns the reply; add `-Stream` to watch it arrive.',
          "`-Model <id>` picks a model for one turn; `Set-ZyraxonConfig -Model <id>` sets it for the session.",
          "`Get-ZyraxonModels` lists every model the provider serves.",
          '`Invoke-ZyraxonAgent "..." -Confirm` runs the tool loop and asks before writing or executing.',
        ],
      },
      { t: "h2", text: "Bash and zsh — source it in the shell you have open" },
      {
        t: "code",
        lang: "bash",
        code: `. ./zyraxon.sh

zyraxon_models
zyraxon_ask "explain what a race condition is"
zyraxon_stream "write a haiku about the sea"
git diff HEAD~1 | zyraxon_ask "review this change and flag anything risky"`,
      },
      {
        t: "p",
        text: `Download it: \`curl -fsSL ${API_ORIGIN}/integrations/zyraxon.sh -o zyraxon.sh\`.`,
      },
      {
        t: "list",
        items: [
          '`zyraxon_ask [-m model] "..."` returns the reply; a piped stdin is the prompt.',
          "`zyraxon_stream` prints as it arrives.",
          "`zyraxon_agent` runs the tool loop; it asks before writing or executing.",
          "`zyraxon_models` lists every model the provider serves.",
        ],
      },
      { t: "h2", text: "The rules, for every client" },
      {
        t: "list",
        items: [
          `Base URL \`${V1_BASE_URL}\`; model any id from \`${MODELS_URL}\`; API key any non-empty string unless the operator set a real one.`,
          "Retries the transient codes (429, 502, 503) with a short backoff, and does not retry 400, 401 or 413.",
          "Every client names the ZYRAXON model in the reply, never an upstream.",
          "The agent tools are confined to the current directory and ask before they write or run. They are deliberately not a general shell escape hatch.",
        ],
      },
      {
        t: "note",
        kind: "tip",
        title: "Which model to pick",
        text: "`zyraxon-apex` is the fastest to first token in our tests; `zyraxon-pulse` is quick too and good on long input. `zyraxon-codex` is the sensible default for code. Read `models()` for the live list.",
      },
    ],
  },

  {
    slug: "provider-integration-languages",
    title: "Languages and Runtimes",
    group: "ZYRAXON Provider",
    desc: "Go, Rust, PHP, Java and .NET call the endpoint with the standard library — no client package required.",
    blocks: [
      {
        t: "p",
        text: "Not every service wants an SDK dependency. The endpoint is HTTPS and JSON, so the standard library of every mainstream language is enough. Each snippet below is a complete, runnable request.",
      },
      {
        t: "note",
        kind: "info",
        title: "The same three values everywhere",
        text: `URL \`${CHAT_URL}\`, header \`Authorization: Bearer ${ANY_API_KEY}\`, and a JSON body carrying \`model\` and \`messages\`.`,
      },
      { t: "h2", text: "Go" },
      { t: "code", lang: "go", code: snippet("go", "net/http") },
      { t: "h2", text: "Rust" },
      { t: "code", lang: "rust", code: snippet("rust", "reqwest") },
      { t: "h2", text: "PHP" },
      { t: "code", lang: "php", code: snippet("php", "cURL") },
      { t: "h2", text: "Java and the JVM" },
      { t: "code", lang: "java", code: snippet("java", "HttpClient") },
      { t: "h2", text: ".NET and C#" },
      { t: "code", lang: "csharp", code: snippet("dotnet", "HttpClient") },
      {
        t: "note",
        kind: "tip",
        title: "Streaming in any language",
        text: 'Set `"stream": true` and read the response as it arrives — the frames are standard server-sent events, so any language with an SSE or line reader can consume them.',
      },
    ],
  },

  {
    slug: "provider-integration-bots",
    title: "Bots and Home Automation",
    group: "ZYRAXON Provider",
    desc: "Discord, Slack, Telegram, Home Assistant and Node-RED: one HTTP call per message, no special client.",
    blocks: [
      {
        t: "p",
        text: 'A chat bot and a smart-home automation are both "call an HTTP endpoint and do something with the reply". Because the endpoint is CORS-open and needs no key by default, a bot is a handful of lines.',
      },
      { t: "h2", text: "Discord, Slack and Telegram" },
      { t: "code", lang: "typescript", code: snippet("chat-bots", "discord.js") },
      {
        t: "note",
        kind: "warn",
        title: "Mind the platform's own limits",
        text: "Chat platforms cap message length. Truncate or split a long reply before posting it, and rate-limit your own sends so you do not get the bot throttled.",
      },
      { t: "h2", text: "Home Assistant and Node-RED" },
      { t: "code", lang: "yaml", code: snippet("home-automation", "rest_command") },
      {
        t: "note",
        kind: "info",
        title: "Turn streaming off here",
        text: 'Automation hosts buffer the whole response, so send `"stream": false` and read `choices[0].message.content`.',
      },
      { t: "h2", text: "Where to go next" },
      {
        t: "list",
        items: [
          "**SDKs and Frameworks** — the OpenAI SDK, the Vercel AI SDK and LangChain, with full tool-calling loops.",
          "**Languages and Runtimes** — Go, Rust, PHP, Java and .NET with no client package.",
          "**Automation and HTTP Clients** — n8n, Make, Zapier and Postman.",
        ],
      },
    ],
  },

  {
    slug: "provider-integration-automation",
    title: "Automation and HTTP Clients",
    group: "ZYRAXON Provider",
    desc: "n8n, Make, Zapier and Postman reach the endpoint through a plain HTTP request node.",
    blocks: [
      {
        t: "p",
        text: "No-code runners are ordinary HTTP clients, so they need nothing beyond the chat URL and a JSON body. The one thing to remember is to turn streaming off: most workflow nodes buffer the whole response and cannot parse an event stream.",
      },
      { t: "h2", text: "n8n / Make / Zapier" },
      { t: "code", lang: "json", code: snippet("n8n", "HTTP request node") },
      {
        t: "note",
        kind: "warn",
        title: "Set stream to false",
        text: 'A workflow node that buffers the body will choke on SSE frames. Use `"stream": false` and read `choices[0].message.content`.',
      },
      { t: "h2", text: "Postman and Insomnia" },
      { t: "code", lang: "text", code: snippet("http-clients", "Request") },
      { t: "h2", text: "Python tool-calling loop" },
      {
        t: "p",
        text: "The Python equivalent of the TypeScript loop on the SDKs page, for a runner written in Python.",
      },
      { t: "code", lang: "python", code: snippet("openai-sdk", "Tool calling loop (Python)") },
      { t: "h2", text: "Discovery, from a runner" },
      {
        t: "p",
        text: "An automation can read the endpoint's own description of itself, so it does not need to be updated when the model line changes.",
      },
      {
        t: "code",
        lang: "shell",
        code: `curl -s ${MODELS_URL}          | jq -r '.data[].id'
curl -s ${PROVIDER_URL}        | jq '{modalities, overload, usage}'
curl -s ${INTEGRATIONS_URL}    | jq '.integrations[] | {id, name, category}'`,
      },
      {
        t: "note",
        kind: "tip",
        title: "Self-describing by design",
        text: "`/models`, `/provider` and `/integrations` are all public and CORS-open, so a runner can configure itself at startup instead of hardcoding what ZYRAXON serves today.",
      },
    ],
  },
];

/** How to reach the ZYRAXON provider from anywhere, as data.
 *
 *  This file holds no secrets and touches no network, so the docs page, the
 *  `/providers` page and the `/api/public/zyraxon/v1/integrations` endpoint all
 *  read the same catalogue. One list means a snippet shown on the site cannot
 *  drift from the snippet the endpoint hands out.
 *
 *  The rule every entry follows: the only thing a client needs is a base URL and
 *  a model id. Anything that already speaks the OpenAI chat-completions dialect
 *  — a desktop agent, a mobile terminal, an editor, a workflow runner — connects
 *  by changing two fields. */

export const API_ORIGIN = "https://zyraxonai.lovable.app";
export const V1_BASE_URL = `${API_ORIGIN}/api/public/zyraxon/v1`;
export const MODELS_URL = `${V1_BASE_URL}/models`;
export const CHAT_URL = `${V1_BASE_URL}/chat/completions`;
export const PROVIDER_URL = `${V1_BASE_URL}/provider`;
export const INTEGRATIONS_URL = `${V1_BASE_URL}/integrations`;

/** The model a client should pick when it has no reason to pick another. */
export const DEFAULT_MODEL = "zyraxon-codex";

/** What to put in an `apiKey` field. The endpoint only checks a key when the
 *  deployment sets `ZYRAXON_PROVIDER_KEY`; until then any non-empty string
 *  satisfies SDKs that refuse to construct a client without one. */
export const ANY_API_KEY = "zyraxon";

/** The model string to put in a field that is routed through LiteLLM.
 *
 *  LiteLLM reads the text before the first `/` to choose a handler and refuses
 *  a bare id with `BadRequestError: LLM Provider NOT provided` — before it ever
 *  calls us. A host like OpenHands exposes a single "Custom Model" box and does
 *  not say which spelling it wants, so the value that field should hold is the
 *  prefixed one. The endpoint accepts both, so this is the safe default. */
export const LITELLM_MODEL = `openai/${DEFAULT_MODEL}`;

/** The rules of use, stated once. Rendered on the provider page, published by
 *  `GET /v1/provider`, and repeated in the integration docs, so a caller reads
 *  the same contract wherever they start. */
export const USAGE_RULES: { title: string; text: string }[] = [
  {
    title: "One base URL, ten models",
    text: `Point your client at ${V1_BASE_URL} and use a ZYRAXON model id. There is no second endpoint to discover and no upstream vendor to name.`,
  },
  {
    title: "Send any non-empty key",
    text: "The OpenAI SDKs refuse to build a client without an apiKey. Until the operator sets ZYRAXON_PROVIDER_KEY, any non-empty string works. When a key is configured, send it as Authorization: Bearer <key>.",
  },
  {
    title: "Read the model list, do not hardcode limits",
    text: `Context windows, output caps and modality support move with the serving pool. Fetch ${MODELS_URL} at startup instead of baking in numbers.`,
  },
  {
    title: "Media is capped per request",
    text: "At most 12 media parts and a body under 40 MB. Base64 adds about a third, so compress and slice video and transcode long audio to low-bitrate mono before sending.",
  },
  {
    title: "You run your own tools",
    text: "Define tools in the OpenAI wire shape and the model returns real tool calls. The provider never executes them — your code performs the action and sends the result back.",
  },
  {
    title: "A rotated model is healthy, not down",
    text: 'Each ZYRAXON model is bound to a preferred upstream with the rest of the pool behind it. status: "rotated" means a sibling is covering. You keep calling the same name.',
  },
  {
    title: "Retry the right codes",
    text: "Retry 429, 502 and 503 with backoff and jitter, and honour Retry-After. Do not retry 400, 401 or 413 — fix the request instead. X-ZYRAXON-Capacity tells you whether the primary tier or the spill pool answered.",
  },
  {
    title: "Capacity degrades, it does not crash",
    text: "Primary lanes serve on ZYRAXON's own budget, overflow spills to the OpenCode Zen free pool, then queues, then sheds with 503 rather than blocking other callers.",
  },
];

export type IntegrationSnippet = {
  /** Short label for the tab or card header. */
  label: string;
  /** Fence language for the snippet. */
  lang: string;
  code: string;
};

export type IntegrationField = {
  label: string;
  value: string;
  note?: string;
};

export type Integration = {
  id: string;
  name: string;
  category: IntegrationCategory;
  blurb: string;
  /** The exact values to type into the host app's own connection form. */
  fields?: IntegrationField[];
  steps?: string[];
  snippets?: IntegrationSnippet[];
  notes?: string[];
  /** Downloadable helper a user can run instead of typing the steps. */
  download?: { href: string; label: string };
  tags?: string[];
};

export type IntegrationCategory =
  | "Terminal & Mobile"
  | "Agents & Editors"
  | "SDKs & Frameworks"
  | "Languages & Runtimes"
  | "Bots & Home"
  | "Automation & Platforms";

export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  "Terminal & Mobile",
  "Agents & Editors",
  "SDKs & Frameworks",
  "Languages & Runtimes",
  "Bots & Home",
  "Automation & Platforms",
];

const TERMUX_SETUP = `curl -fsSL ${API_ORIGIN}/integrations/termux-setup.sh | bash`;

/** The Termux chat box, as shown in the docs and on the provider page. Kept
 *  short on purpose: the full command list lives in the client's own /help, so
 *  this only has to show what it looks like to use it. */
const TERMUX_CHAT = `$ zyraxon

  ZYRAXON  ·  chat
  model zyraxon-codex   ·   tools off
  /help for commands, /exit to leave

you> explain what this repo does in three bullets
zyraxon> 1. It is a marketing and tooling site for the ZYRAXON desktop agent.
         2. Provider routes live under src/routes/api/public/zyraxon/v1.
         3. The docs are data files under src/lib/docs.

you> /agent on
tools on
you> make hello.py that prints hi, then run it
  -> write_file
write hello.py (24 bytes)? [y/N] y
  -> run_shell
run: python3 hello.py ? [y/N] y
Done — it printed: hi

you> /model 2
model is now zyraxon-apex

you> /exit
bye`;

const TERMUX_COMMANDS = `Commands inside the chat box
  /help            show this list
  /models          list every model the provider serves
  /model <n|id>    switch model — by number from /models, or by id
  /agent [on|off]  toggle tool calling (read, write, run) for the session
  /new             forget the conversation and start fresh
  /history         how many messages are in the conversation
  /save <file>     write the conversation to a file as JSON
  /exit            leave (also /quit)

Anything else you type is sent to the model.

One-shot, from the shell
  zyraxon "explain this repo"            stream one answer and exit
  zyraxon -a "make hello.py and run it"  one agent turn with tools, then exit
  zyraxon -m zyraxon-apex "..."          pick a model for one turn
  echo "what is 2+2?" | zyraxon          read the prompt from stdin
  zyraxon --models                       list the models

Any model works. The model list is read live, so every id the provider serves
today is selectable with /model — there is no fixed list in the client.`;

const TOOL_LOOP_TS = `import OpenAI from "openai";

const client = new OpenAI({ baseURL: "${V1_BASE_URL}", apiKey: "${ANY_API_KEY}" });

const tools = [
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description: "Write text to a file on disk.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
    },
  },
];

// You run the tools. The provider only returns the call.
async function runTool(name: string, args: any) {
  if (name === "write_file") {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(args.path, args.content, "utf8");
    return \`wrote \${args.path}\`;
  }
  return \`unknown tool \${name}\`;
}

const messages: any[] = [{ role: "user", content: "Save a hello world file." }];

for (let turn = 0; turn < 8; turn++) {
  const res = await client.chat.completions.create({
    model: "${DEFAULT_MODEL}",
    messages,
    tools,
  });
  const choice = res.choices[0];
  messages.push(choice.message);

  if (choice.finish_reason !== "tool_calls") break;

  for (const call of choice.message.tool_calls ?? []) {
    const result = await runTool(call.function.name, JSON.parse(call.function.arguments));
    messages.push({ role: "tool", tool_call_id: call.id, content: result });
  }
}`;

const TOOL_LOOP_PY = `from openai import OpenAI
import json, pathlib

client = OpenAI(base_url="${V1_BASE_URL}", api_key="${ANY_API_KEY}")

tools = [{
    "type": "function",
    "function": {
        "name": "write_file",
        "description": "Write text to a file on disk.",
        "parameters": {
            "type": "object",
            "properties": {"path": {"type": "string"}, "content": {"type": "string"}},
            "required": ["path", "content"],
        },
    },
}]

def run_tool(name, args):
    if name == "write_file":
        pathlib.Path(args["path"]).write_text(args["content"], encoding="utf-8")
        return f"wrote {args['path']}"
    return f"unknown tool {name}"

messages = [{"role": "user", "content": "Save a hello world file."}]

for _ in range(8):
    res = client.chat.completions.create(model="${DEFAULT_MODEL}", messages=messages, tools=tools)
    choice = res.choices[0]
    messages.append(choice.message)

    if choice.finish_reason != "tool_calls":
        break

    for call in choice.message.tool_calls or []:
        result = run_tool(call.function.name, json.loads(call.function.arguments))
        messages.append({"role": "tool", "tool_call_id": call.id, "content": result})`;

const CURL_CHAT = `curl ${CHAT_URL} \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${DEFAULT_MODEL}",
    "messages": [{ "role": "user", "content": "Hello" }],
    "stream": true
  }'`;

const OPENAI_SDK_TS = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${V1_BASE_URL}",
  apiKey: "${ANY_API_KEY}",
});

const stream = await client.chat.completions.create({
  model: "${DEFAULT_MODEL}",
  messages: [{ role: "user", content: "Build a landing page" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}`;

const OPENAI_SDK_PY = `from openai import OpenAI

client = OpenAI(base_url="${V1_BASE_URL}", api_key="${ANY_API_KEY}")

stream = client.chat.completions.create(
    model="${DEFAULT_MODEL}",
    messages=[{"role": "user", "content": "Build a landing page"}],
    stream=True,
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)`;

const VERCEL_AI_SDK = `import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";

const zyraxon = createOpenAICompatible({
  name: "zyraxon",
  baseURL: "${V1_BASE_URL}",
  apiKey: "${ANY_API_KEY}",
});

const result = streamText({
  model: zyraxon("${DEFAULT_MODEL}"),
  messages: [{ role: "user", content: "Explain a monad in one paragraph." }],
});

for await (const delta of result.textStream) process.stdout.write(delta);`;

const LANGCHAIN_PY = `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="${DEFAULT_MODEL}",
    base_url="${V1_BASE_URL}",
    api_key="${ANY_API_KEY}",
)

print(llm.invoke("Summarise this repo layout in three bullets.").content)`;

const LANGCHAIN_JS = `import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  model: "${DEFAULT_MODEL}",
  configuration: { baseURL: "${V1_BASE_URL}", apiKey: "${ANY_API_KEY}" },
});

console.log((await llm.invoke("Summarise this repo layout in three bullets.")).content);`;

const N8N_HTTP = `// n8n: HTTP Request node (or the OpenAI node with a custom base URL)
// Method: POST
// URL:    ${CHAT_URL}
// Header: Content-Type: application/json
// Header: Authorization: Bearer ${ANY_API_KEY}
{
  "model": "${DEFAULT_MODEL}",
  "messages": [{ "role": "user", "content": "{{ $json.prompt }}" }],
  "stream": false
}`;

const MOBILE_FETCH = `// React Native / Expo / any mobile JS runtime. No SDK needed.
const res = await fetch("${CHAT_URL}", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer ${ANY_API_KEY}" },
  body: JSON.stringify({
    model: "${DEFAULT_MODEL}",
    messages: [{ role: "user", content: "Plan my day." }],
    stream: false,
  }),
});

const data = await res.json();
console.log(data.choices[0].message.content);`;

const FLUTTER_DART = `import 'dart:convert';
import 'package:http/http.dart' as http;

final res = await http.post(
  Uri.parse('${CHAT_URL}'),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${ANY_API_KEY}',
  },
  body: jsonEncode({
    'model': '${DEFAULT_MODEL}',
    'messages': [
      {'role': 'user', 'content': 'Plan my day.'},
    ],
  }),
);

final content = jsonDecode(res.body)['choices'][0]['message']['content'];`;

const ANDROID_KOTLIN = `// Plain HTTP, so it works from an Android app with no OpenAI SDK at all.
val client = OkHttpClient()
val json = """
  {"model":"${DEFAULT_MODEL}","messages":[{"role":"user","content":"Plan my day."}]}
""".trimIndent()

val request = Request.Builder()
    .url("${CHAT_URL}")
    .addHeader("Content-Type", "application/json")
    .addHeader("Authorization", "Bearer ${ANY_API_KEY}")
    .post(json.toRequestBody("application/json".toMediaType()))
    .build()

client.newCall(request).execute().use { response ->
    println(response.body?.string())
}`;

const IOS_SWIFT = `// URLSession, no SDK. Works on iOS, iPadOS and watchOS.
var request = URLRequest(url: URL(string: "${CHAT_URL}")!)
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.setValue("Bearer ${ANY_API_KEY}", forHTTPHeaderField: "Authorization")
request.httpBody = try JSONSerialization.data(withJSONObject: [
    "model": "${DEFAULT_MODEL}",
    "messages": [["role": "user", "content": "Plan my day."]],
])

let (data, _) = try await URLSession.shared.data(for: request)
print(String(data: data, encoding: .utf8) ?? "")`;

const POSTMAN = `POST ${CHAT_URL}
Content-Type: application/json
Authorization: Bearer ${ANY_API_KEY}

{
  "model": "${DEFAULT_MODEL}",
  "messages": [{ "role": "user", "content": "Hello" }]
}`;

const KALI_SETUP = `# Kali Linux / any Debian-family distro, including Kali NetHunter on a phone.
sudo apt update && sudo apt install -y curl jq

export ZYRAXON_BASE="${V1_BASE_URL}"
export ZYRAXON_MODEL="${DEFAULT_MODEL}"
export ZYRAXON_KEY="${ANY_API_KEY}"

# Keep it for new shells.
cat >> ~/.bashrc <<'EOF'
export ZYRAXON_BASE="${V1_BASE_URL}"
export ZYRAXON_MODEL="${DEFAULT_MODEL}"
export ZYRAXON_KEY="${ANY_API_KEY}"
EOF

curl -s "\${ZYRAXON_BASE}/models" | jq -r '.data[].id'`;

const KALI_ASK = `#!/usr/bin/env bash
# zyraxon-ask — stream one turn from the ZYRAXON line on Kali / any Linux shell.
# Usage: zyraxon-ask "why does nmap show port 22 open?"
set -euo pipefail
: "\${ZYRAXON_BASE:?set ZYRAXON_BASE first}"
: "\${ZYRAXON_KEY:?set ZYRAXON_KEY first}"
PROMPT="\${*:-$(cat)}"

curl -sN "\${ZYRAXON_BASE}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer \${ZYRAXON_KEY}" \\
  -d "$(jq -nc --arg m "\${ZYRAXON_MODEL}" --arg p "\${PROMPT}" \\
        '{model:$m, stream:true, messages:[{role:"user",content:$p}]}')" \\
| sed -n 's/^data: //p' \\
| grep -v '^\\[DONE\\]$' \\
| jq -rj '.choices[0].delta.content // empty'
echo`;

const NETHUNTER_CHROOT = `# Kali NetHunter: run the same client inside the Kali chroot on an Android phone.
# (Termux side: install the NetHunter app, then start the chroot.)
nethunter
apt update && apt install -y curl jq

export ZYRAXON_BASE="${V1_BASE_URL}"
export ZYRAXON_MODEL="${DEFAULT_MODEL}"
export ZYRAXON_KEY="${ANY_API_KEY}"

curl -s "\${ZYRAXON_BASE}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer \${ZYRAXON_KEY}" \\
  -d "{\\"model\\":\\"\${ZYRAXON_MODEL}\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"list my open ports\\"}]}" \\
| jq -r '.choices[0].message.content'`;

const CLINE_VSCODE = `// Cline / Roo Code / Kilo Code (VS Code settings.json)
// These extensions expose an "OpenAI Compatible" provider.
{
  "cline.apiProvider": "openai",
  "cline.openAiBaseUrl": "${V1_BASE_URL}",
  "cline.openAiApiKey": "${ANY_API_KEY}",
  "cline.openAiModelId": "${DEFAULT_MODEL}"
}`;

const ROO_CODE = `// Roo Code — Settings → Providers → OpenAI Compatible
//   Base URL:  ${V1_BASE_URL}
//   API Key:   ${ANY_API_KEY}
//   Model ID:  ${DEFAULT_MODEL}
// Or, from the CLI, by environment:
export OPENAI_BASE_URL="${V1_BASE_URL}"
export OPENAI_API_KEY="${ANY_API_KEY}"`;

const ZED_SETTINGS = `// Zed — settings.json
{
  "language_models": {
    "openai": {
      "api_url": "${V1_BASE_URL}",
      "available_models": [
        { "name": "${DEFAULT_MODEL}", "max_tokens": 16000 }
      ]
    }
  }
}`;

const VSCODE_COPILOT = `// VS Code + GitHub Copilot Chat, "Bring your own model" style providers,
// or any extension that reads the OpenAI base URL from the environment.
export OPENAI_BASE_URL="${V1_BASE_URL}"
export OPENAI_API_BASE="${V1_BASE_URL}"
export OPENAI_API_KEY="${ANY_API_KEY}"
# Then start VS Code from that shell so it inherits the variables.
code .`;

const OLLAMA_STYLE = `# Any client that speaks "Ollama" or "LocalAI" over an OpenAI-compatible
# /v1 base works too — point it at us instead of localhost.
export OLLAMA_HOST="${V1_BASE_URL}"
export OPENAI_BASE_URL="${V1_BASE_URL}"
export OPENAI_API_KEY="${ANY_API_KEY}"

# Verify the same way any OpenAI client would:
curl -s "${V1_BASE_URL}/models" | jq -r '.data[].id'`;

const GO_CLIENT = `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func main() {
	body, _ := json.Marshal(map[string]any{
		"model": "${DEFAULT_MODEL}",
		"messages": []map[string]string{
			{"role": "user", "content": "Plan my day."},
		},
	})

	req, _ := http.NewRequest("POST", "${CHAT_URL}", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer ${ANY_API_KEY}")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer res.Body.Close()

	out, _ := io.ReadAll(res.Body)
	fmt.Println(string(out))
}`;

const RUST_CLIENT = `// reqwest + serde_json. No OpenAI crate needed.
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let body = serde_json::json!({
        "model": "${DEFAULT_MODEL}",
        "messages": [{ "role": "user", "content": "Plan my day." }]
    });

    let res = reqwest::Client::new()
        .post("${CHAT_URL}")
        .header("Content-Type", "application/json")
        .header("Authorization", "Bearer ${ANY_API_KEY}")
        .json(&body)
        .send()
        .await?
        .text()
        .await?;

    println!("{}", res);
    Ok(())
}`;

const PHP_CLIENT = `<?php
// Plain cURL, so it works from any PHP app, Laravel job or WordPress plugin.
$payload = json_encode([
    "model" => "${DEFAULT_MODEL}",
    "messages" => [["role" => "user", "content" => "Plan my day."]],
]);

$ch = curl_init("${CHAT_URL}");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "Authorization: Bearer ${ANY_API_KEY}",
    ],
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
]);
echo curl_exec($ch);
curl_close($ch);`;

const JAVA_CLIENT = `// Java 11+ HttpClient. Works from Spring Boot, Android or a CLI tool.
var payload = """
  {"model":"${DEFAULT_MODEL}","messages":[{"role":"user","content":"Plan my day."}]}
  """;

var request = HttpRequest.newBuilder()
    .uri(URI.create("${CHAT_URL}"))
    .header("Content-Type", "application/json")
    .header("Authorization", "Bearer ${ANY_API_KEY}")
    .POST(HttpRequest.BodyPublishers.ofString(payload))
    .build();

var response = HttpClient.newHttpClient()
    .send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`;

const DOTNET_CLIENT = `// C# / .NET. The Azure OpenAI client and the OpenAI .NET SDK both take a custom endpoint.
using var http = new HttpClient();
http.DefaultRequestHeaders.Add("Authorization", "Bearer ${ANY_API_KEY}");

var json = """
  {"model":"${DEFAULT_MODEL}","messages":[{"role":"user","content":"Plan my day."}]}
  """;

var res = await http.PostAsync(
    "${CHAT_URL}",
    new StringContent(json, System.Text.Encoding.UTF8, "application/json"));

Console.WriteLine(await res.Content.ReadAsStringAsync());`;

const HOME_ASSISTANT = `# Home Assistant, Node-RED and similar automation hosts: use a REST command
# or an HTTP request node. In configuration.yaml:

rest_command:
  zyraxon_ask:
    url: "${CHAT_URL}"
    method: POST
    headers:
      Content-Type: application/json
      Authorization: "Bearer ${ANY_API_KEY}"
    payload: >
      {"model": "${DEFAULT_MODEL}",
       "messages": [{"role": "user", "content": "{{ prompt }}"}]}`;

const DISCORD_BOT = `// A Discord bot, a Slack app or any chat integration: it is one HTTP call.
import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({ intents: [GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds] });

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const res = await fetch("${CHAT_URL}", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer ${ANY_API_KEY}" },
    body: JSON.stringify({
      model: "${DEFAULT_MODEL}",
      messages: [{ role: "user", content: msg.content }],
    }),
  });

  const data = await res.json();
  await msg.reply(data.choices[0].message.content);
});

client.login(process.env.DISCORD_TOKEN);`;

const STREAMING_PY = `from openai import OpenAI

client = OpenAI(base_url="${V1_BASE_URL}", api_key="${ANY_API_KEY}")

stream = client.chat.completions.create(
    model="${DEFAULT_MODEL}",
    messages=[{"role": "user", "content": "Write a haiku about the sea."}],
    stream=True,
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)`;

const OPENAI_COMPAT_DISCOVERY = `# Anything that can read a JSON model list can configure itself.
curl -s ${MODELS_URL} | jq -r '.data[] | "\\(.id)\\t\\(.context_window)\\t\\(.input_modalities | join(","))"'

# Provider health, capacity and overload policy:
curl -s ${PROVIDER_URL} | jq '{count, modalities, concurrency, overload}'

# The machine-readable integration catalogue (this whole page):
curl -s ${INTEGRATIONS_URL} | jq '.integrations[] | {id, name, category}'`;

const MCP_CLIENT = `// An MCP server, or any agent tool host, can call ZYRAXON as its model.
// The tool definitions travel in the request; the model returns real calls.
{
  "model": "${DEFAULT_MODEL}",
  "messages": [{ "role": "user", "content": "Read package.json and summarise it." }],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "read_file",
        "description": "Read a file from the working directory.",
        "parameters": {
          "type": "object",
          "properties": { "path": { "type": "string" } },
          "required": ["path"]
        }
      }
    }
  ]
}`;

// LiteLLM and any LiteLLM-based gateway (Open WebUI, LibreChat, Langroid,
// Dify, Flowise, Continue in LiteLLM mode). LiteLLM refuses a model string
// with no provider prefix — "LLM Provider NOT provided" — so the model must be
// written `openai/<id>`, and the `openai/` prefix is what selects the generic
// OpenAI-compatible handler. The endpoint accepts that prefix.
const LITELLM_PY = `from litellm import completion

response = completion(
    # The provider prefix is required: LiteLLM reads it to pick a handler, and
    # without it you get "LLM Provider NOT provided". The endpoint strips it.
    model="openai/${DEFAULT_MODEL}",
    api_base="${V1_BASE_URL}",
    api_key="${ANY_API_KEY}",
    messages=[{"role": "user", "content": "Explain what a reverse proxy does."}],
)

print(response.choices[0].message.content)`;

const LITELLM_CONFIG = `# litellm-config.yaml — a LiteLLM proxy that fronts ZYRAXON.
#
# Start it with:  litellm --config litellm-config.yaml --port 4000
# Then any client pointed at http://localhost:4000/v1 gets the ZYRAXON models,
# with LiteLLM's own routing, budgets, logging and key management on top.
model_list:
  - model_name: zyraxon-apex
    litellm_params:
      model: openai/zyraxon-apex
      api_base: ${V1_BASE_URL}
      api_key: ${ANY_API_KEY}
  - model_name: zyraxon-codex
    litellm_params:
      model: openai/zyraxon-codex
      api_base: ${V1_BASE_URL}
      api_key: ${ANY_API_KEY}
  - model_name: zyraxon-cyber
    litellm_params:
      model: openai/zyraxon-cyber
      api_base: ${V1_BASE_URL}
      api_key: ${ANY_API_KEY}

litellm_settings:
  drop_params: true`;

const LITELLM_ENV = `# Point LiteLLM at ZYRAXON with plain environment variables, no config file.
# The openai/ prefix in the model string is required by LiteLLM.
export OPENAI_API_BASE="${V1_BASE_URL}"
export OPENAI_API_KEY="${ANY_API_KEY}"

python - <<'PY'
from litellm import completion
r = completion(model="openai/${DEFAULT_MODEL}",
               messages=[{"role": "user", "content": "hello"}])
print(r.choices[0].message.content)
PY

# Same thing through the LiteLLM CLI:
litellm --model openai/${DEFAULT_MODEL} --api_base ${V1_BASE_URL} --api_key ${ANY_API_KEY}`;

const LITELLM_MODEL_PREFIX = `# Why the model string needs a provider prefix, and what this endpoint accepts.
#
# LiteLLM reads the text before the first "/" to choose a handler. A bare id
# like "zyraxon-codex" has no "/", so LiteLLM stops with:
#     BadRequestError: LLM Provider NOT provided
# Write "openai/zyraxon-codex" and it uses the generic OpenAI-compatible path.
#
# This endpoint is tolerant: all of these resolve to the same ZYRAXON model.
#   zyraxon-codex
#   openai/zyraxon-codex
#   zyraxon/zyraxon-codex
#   zyraxon/codex
#   openai/zyraxon/codex`;

export const INTEGRATIONS: Integration[] = [
  // ───────────────────────── TERMINAL & MOBILE ─────────────────────────
  {
    id: "termux",
    name: "Termux (Android)",
    category: "Terminal & Mobile",
    blurb:
      "Run ZYRAXON from the terminal on an Android phone. The setup script installs curl and jq, stores your settings, and adds a `zyraxon` command that opens an interactive chat box — type a message, get a streamed reply, switch models, and turn on tool calling so the agent can read, write and run things on the phone.",
    tags: ["Android", "Chat box", "Any model", "Tool calls"],
    download: {
      href: "/integrations/termux-setup.sh",
      label: "termux-setup.sh",
    },
    steps: [
      "Install Termux from F-Droid (the Play Store build is abandoned).",
      `Run the setup script: \`${TERMUX_SETUP}\``,
      "Open a new shell, or run `source ~/.bashrc`, so `zyraxon` is on your PATH.",
      "Run `zyraxon` with no arguments to open the chat box, then just type.",
      "Use `/models` and `/model` to pick any model the provider serves, and `/agent on` to let it read, write and run commands on the device.",
    ],
    snippets: [
      { label: "The chat box", lang: "text", code: TERMUX_CHAT },
      { label: "Commands", lang: "text", code: TERMUX_COMMANDS },
      {
        label: "Setup",
        lang: "bash",
        code: `# One command. Installs deps, writes ~/.zyraxon/env, installs the client.
${TERMUX_SETUP}

# Then, from any directory:
zyraxon                                  # open the chat box
zyraxon "summarise the changes in this repo"
zyraxon -a "create a hello world python file and run it"
echo "what is 2+2?" | zyraxon`,
      },
      {
        label: "Manual setup",
        lang: "bash",
        code: `pkg update && pkg upgrade -y
pkg install -y curl jq python

export ZYRAXON_BASE="${V1_BASE_URL}"
export ZYRAXON_MODEL="${DEFAULT_MODEL}"
export ZYRAXON_KEY="${ANY_API_KEY}"

# The client on its own, without the installer:
curl -fsSL ${API_ORIGIN}/integrations/zyraxon-chat.sh -o ~/.local/bin/zyraxon
chmod +x ~/.local/bin/zyraxon

curl -s "\${ZYRAXON_BASE}/models" | jq -r '.data[].id'`,
      },
      {
        label: "Streaming one-liner",
        lang: "bash",
        code: `curl -sN "\${ZYRAXON_BASE}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer \${ZYRAXON_KEY}" \\
  -d "{\\"model\\":\\"\${ZYRAXON_MODEL}\\",\\"stream\\":true,
       \\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"$1\\"}]}" \\
| sed -n 's/^data: //p' \\
| grep -v '^\\[DONE\\]$' \\
| jq -rj '.choices[0].delta.content // empty'
echo`,
      },
    ],
    notes: [
      "The chat box keeps the conversation, so follow-up questions work. `/new` clears it.",
      "Every model is selectable: the client reads the model list live, so there is no hardcoded list to go stale.",
      "Termux has no GPU and no browser, so keep media on the phone small. Images under 2 MB inline work; video should be compressed before sending.",
      "In agent mode the client runs three tools — read, write, run — and asks before it writes or executes anything. It is deliberately not a general shell escape hatch.",
      "Android may kill Termux in the background. Run `termux-wake-lock` before a long agent turn.",
    ],
  },
  {
    id: "kali-linux",
    name: "Kali Linux (desktop and NetHunter)",
    category: "Terminal & Mobile",
    blurb:
      "Kali is a Debian-family distro with a shell, so the provider works exactly as it does on any Linux box — and Kali NetHunter puts the same client on an Android phone inside its chroot. One `zyraxon-ask` script gives you a streaming prompt with your environment already wired.",
    tags: ["Kali", "NetHunter", "Debian", "Shell"],
    download: { href: "/integrations/kali-ask.sh", label: "kali-ask.sh" },
    steps: [
      "Install the two tools the client needs: `sudo apt install -y curl jq`.",
      "Export `ZYRAXON_BASE`, `ZYRAXON_MODEL` and `ZYRAXON_KEY`, or paste them into `~/.bashrc`.",
      "Download `kali-ask.sh`, `chmod +x` it, and put it on your `PATH`.",
      'Ask something: `zyraxon-ask "explain the output of this nmap scan"`.',
      "On NetHunter, start the chroot with `nethunter` first, then do the same inside it.",
    ],
    snippets: [
      { label: "Setup", lang: "bash", code: KALI_SETUP },
      { label: "zyraxon-ask script", lang: "bash", code: KALI_ASK },
      { label: "Kali NetHunter (chroot)", lang: "bash", code: NETHUNTER_CHROOT },
      {
        label: "Pipe tool output",
        lang: "bash",
        code: `# Give the model real evidence instead of a description of it.
nmap -sV -T4 192.168.1.1 -oN - | zyraxon-ask "summarise these findings for a report"
ss -tulpn | zyraxon-ask "which of these services is most exposed, and why?"
journalctl -p err -n 50 | zyraxon-ask "what broke here?"`,
      },
    ],
    notes: [
      "NetHunter's chroot is a full Kali userland, so anything that works on a Kali desktop works there — the phone is the only difference.",
      "Keep API keys out of shared shell history: put them in `~/.zyraxon/env` with mode 600 and `source` it, rather than typing them inline.",
    ],
  },
  {
    id: "mobile-sdk",
    name: "Mobile apps (React Native, Flutter, Android, iOS)",
    category: "Terminal & Mobile",
    blurb:
      "A mobile app does not need an OpenAI SDK. The endpoint is plain HTTPS with CORS open to `*`, so the platform HTTP client is enough — and the media parts are the same shapes the web client already sends.",
    tags: ["React Native", "Flutter", "Kotlin", "Swift"],
    snippets: [
      { label: "React Native / Expo", lang: "typescript", code: MOBILE_FETCH },
      { label: "Flutter / Dart", lang: "dart", code: FLUTTER_DART },
      { label: "Android / Kotlin", lang: "kotlin", code: ANDROID_KOTLIN },
      { label: "iOS / Swift", lang: "swift", code: IOS_SWIFT },
    ],
    notes: [
      "CORS allows any origin, so a WebView-based app can call the endpoint directly.",
      "For voice on mobile, POST the recording to /api/public/stt and send the transcript as a normal text turn.",
      "Keep large media off the device path: compress on the phone first, then send one or two parts.",
    ],
  },

  // ───────────────────────── AGENTS & EDITORS ──────────────────────────
  {
    id: "openhands",
    name: "OpenHands",
    category: "Agents & Editors",
    blurb:
      "OpenHands takes a custom provider through a small form. Copy the four fields below and it uses the ZYRAXON line like any other OpenAI-compatible model.",
    tags: ["Custom provider", "Base URL + API key"],
    fields: [
      { label: "Name (Optional)", value: "zyraxon" },
      {
        label: "Custom Model",
        value: LITELLM_MODEL,
        note: 'Copy this exactly, `openai/` included. OpenHands routes the model through LiteLLM, which refuses an id with no provider prefix — that is the "LLM Provider NOT provided" error.',
      },
      {
        label: "Base URL",
        value: V1_BASE_URL,
        note: "Copy this exactly, including `/v1` at the end.",
      },
      {
        label: "API Key",
        value: ANY_API_KEY,
        note: "Any non-empty value, unless the operator set ZYRAXON_PROVIDER_KEY.",
      },
    ],
    steps: [
      "Open OpenHands and go to **Settings**, then the LLM (model / provider) section.",
      "Turn **Advanced** on at the top of the page. This matters: the **Base URL** field only takes effect in Advanced mode. In the simple form OpenHands ignores it and sends the request to OpenAI instead — which is what produces `401 Incorrect API key provided: zyraxon`.",
      "Choose **Custom Model**.",
      `For **Custom Model**, copy \`${LITELLM_MODEL}\` exactly. The \`openai/\` prefix is what LiteLLM reads to pick a handler; without it OpenHands fails before it calls us, with \`LLM Provider NOT provided\`.`,
      `For **Base URL**, copy \`${V1_BASE_URL}\` exactly. If this box is missing, Advanced is not on yet.`,
      `For **API Key**, use any non-empty value — \`${ANY_API_KEY}\` here.`,
      "Press **Save Changes**, then start a conversation.",
    ],
    snippets: [
      {
        label: "Copy these four",
        lang: "text",
        code: `Name (Optional)   zyraxon
Custom Model      ${LITELLM_MODEL}
Base URL          ${V1_BASE_URL}
API Key           ${ANY_API_KEY}`,
      },
      {
        label: "Turn Advanced ON first",
        lang: "text",
        code: `OpenHands has two modes, and the Base URL only works in one of them.

  Simple form:  there is a "Provider connection" dropdown, no Base URL box
                -> OpenHands sends the turn to OpenAI itself
                -> "401 Incorrect API key provided: zyraxon"

  Advanced:     a Base URL box appears
                -> OpenHands sends the turn to whatever that box says

Turn "Advanced" on at the top of the LLM settings page before you fill
anything in. The Base URL box appears once it is on.`,
      },
      {
        label: 'The "401 Incorrect API key" error',
        lang: "text",
        code: `  Error code: 401 - Incorrect API key provided: ${ANY_API_KEY}.
  You can find your API key at https://platform.openai.com/account/api-keys

That message comes from OpenAI, not from us — the request never reached the
ZYRAXON endpoint. It means OpenHands used its default OpenAI URL instead of
your Base URL, almost always because Advanced mode is off.

Fix: turn Advanced on, then set Base URL to
  ${V1_BASE_URL}

You can confirm it reaches us, and not OpenAI, in one call:

  curl -s ${MODELS_URL} | jq -r '.data[].id'
  # prints the ZYRAXON model ids -> the URL is right`,
      },
      {
        label: 'The "LLM Provider NOT provided" error',
        lang: "text",
        code: `If OpenHands reports:

  litellm.BadRequestError: LLM Provider NOT provided.
  You passed model=${DEFAULT_MODEL}

the Custom Model field is missing its provider prefix. OpenHands routes the
model through LiteLLM, which reads the text before the first "/" to choose a
handler and refuses a bare id — it never reaches us. Add the prefix:

  Custom Model:  ${LITELLM_MODEL}

The endpoint accepts both spellings, so this works with no other change:

  ${DEFAULT_MODEL}   openai/${DEFAULT_MODEL}   zyraxon/${DEFAULT_MODEL}   zyraxon/codex

If your version reads the model from the environment instead of the form:

  export LLM_MODEL="${LITELLM_MODEL}"
  export LLM_BASE_URL="${V1_BASE_URL}"
  export LLM_API_KEY="${ANY_API_KEY}"`,
      },
      {
        label: "Verify before you save",
        lang: "bash",
        code: `# The model list is what the form needs to resolve the model id.
curl -s ${MODELS_URL} | jq -r '.data[].id'

# A one-shot turn proves the URL and key are right. Both spellings work here.
curl -s ${CHAT_URL} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${ANY_API_KEY}" \\
  -d '{"model":"${LITELLM_MODEL}","messages":[{"role":"user","content":"ping"}]}' \\
| jq -r '.choices[0].message.content'`,
      },
    ],
    notes: [
      "**Turn Advanced on.** Without it the Base URL is ignored and OpenHands calls OpenAI, which answers `401 Incorrect API key provided`.",
      "OpenHands needs the model id to exist in the list the base URL serves. `GET /models` publishes all ten, so the form resolves them without a manual override.",
      "Streaming is on by default in OpenHands; the endpoint serves SSE when `stream: true`.",
      `If you see \`LLM Provider NOT provided\`, put \`openai/\` in front of the model: \`${LITELLM_MODEL}\`. OpenHands routed it through LiteLLM, which needs a provider prefix. The endpoint accepts either spelling, so nothing else has to change.`,
    ],
  },
  {
    id: "openai-compatible-apps",
    name: "Cursor, Continue, Cline, Aider and any OpenAI-compatible app",
    category: "Agents & Editors",
    blurb:
      "Anything with an *OpenAI-compatible* or *custom base URL* setting connects with the same two values. This is the largest group of clients, and the one that needs no code at all.",
    tags: ["Drop-in", "No code"],
    fields: [
      { label: "Base URL / API base", value: V1_BASE_URL },
      { label: "Model", value: DEFAULT_MODEL },
      { label: "API key", value: ANY_API_KEY },
    ],
    steps: [
      "Find the provider or model settings in the app.",
      "Choose the OpenAI-compatible / custom option.",
      `Paste \`${V1_BASE_URL}\` as the base URL and \`${DEFAULT_MODEL}\` as the model.`,
      `Put \`${ANY_API_KEY}\` in the key field if the app insists on one.`,
      "Reload the app so it re-fetches the model list.",
    ],
    snippets: [
      {
        label: "Continue (config.json)",
        lang: "json",
        code: `{
  "models": [
    {
      "title": "ZYRAXON",
      "provider": "openai",
      "model": "${DEFAULT_MODEL}",
      "apiBase": "${V1_BASE_URL}",
      "apiKey": "${ANY_API_KEY}"
    }
  ]
}`,
      },
      {
        label: "Aider",
        lang: "bash",
        code: `export OPENAI_API_BASE="${V1_BASE_URL}"
export OPENAI_API_KEY="${ANY_API_KEY}"
aider --model openai/${DEFAULT_MODEL}`,
      },
      {
        label: "Generic environment variables",
        lang: "bash",
        code: `# Many CLIs read these directly.
export OPENAI_BASE_URL="${V1_BASE_URL}"
export OPENAI_API_BASE="${V1_BASE_URL}"
export OPENAI_API_KEY="${ANY_API_KEY}"`,
      },
    ],
    notes: [
      "Some editors cache the model list at install time. Reload after changing the base URL, or the old list keeps being offered.",
      "If an editor only accepts a fixed set of model names, pick the closest ZYRAXON id — the model id is a name, not a capability gate.",
    ],
  },

  {
    id: "vscode-extensions",
    name: "VS Code: Cline, Roo Code, Kilo Code and Copilot Chat",
    category: "Agents & Editors",
    blurb:
      "The VS Code agent extensions all expose an *OpenAI Compatible* provider, so they connect with the same base URL and key as everything else. Copilot Chat and extensions that read the OpenAI environment variables work too.",
    tags: ["VS Code", "Cline", "Roo Code", "Copilot"],
    fields: [
      { label: "Base URL", value: V1_BASE_URL },
      { label: "API key", value: ANY_API_KEY },
      { label: "Model ID", value: DEFAULT_MODEL },
    ],
    steps: [
      "Open the extension's settings and choose the OpenAI Compatible provider.",
      `Paste \`${V1_BASE_URL}\` as the base URL and \`${DEFAULT_MODEL}\` as the model id.`,
      `Put \`${ANY_API_KEY}\` in the key field if the extension insists on one.`,
      "Reload the window so the extension re-reads the model list.",
    ],
    snippets: [
      { label: "Cline / Roo (settings.json)", lang: "json", code: CLINE_VSCODE },
      { label: "Roo Code", lang: "text", code: ROO_CODE },
      { label: "Copilot Chat / env", lang: "bash", code: VSCODE_COPILOT },
    ],
    notes: [
      "Extensions that cache the model list at install time need a window reload after the base URL changes.",
    ],
  },
  {
    id: "zed",
    name: "Zed",
    category: "Agents & Editors",
    blurb:
      "Zed takes a custom OpenAI-compatible URL in its settings, so the assistant and the inline panel both run on the ZYRAXON line.",
    tags: ["Zed", "Editor"],
    snippets: [{ label: "settings.json", lang: "json", code: ZED_SETTINGS }],
  },
  {
    id: "local-runtime-style",
    name: "Ollama-style and LocalAI-style clients",
    category: "Agents & Editors",
    blurb:
      "Clients that expect a local model server on `localhost` can be pointed at us instead, because they speak the same OpenAI-compatible dialect.",
    tags: ["Drop-in", "Local server replacement"],
    snippets: [{ label: "Environment", lang: "bash", code: OLLAMA_STYLE }],
  },
  {
    id: "mcp-tool-hosts",
    name: "MCP servers and agent tool hosts",
    category: "Agents & Editors",
    blurb:
      "An MCP server or any agent framework can use ZYRAXON as its model and keep its own tool definitions — they travel in the request and come back as real tool calls.",
    tags: ["MCP", "Tool calls"],
    snippets: [{ label: "Tool-carrying request", lang: "json", code: MCP_CLIENT }],
  },

  // ───────────────────────── SDKS & FRAMEWORKS ─────────────────────────
  {
    id: "curl",
    name: "cURL",
    category: "SDKs & Frameworks",
    blurb:
      "The shortest path to a working call. Two headers and a JSON body, and it works from any machine with curl — including a phone.",
    tags: ["Anywhere", "No install"],
    snippets: [
      { label: "Streaming chat", lang: "shell", code: CURL_CHAT },
      {
        label: "Non-streaming, read the answer",
        lang: "shell",
        code: `curl -s ${CHAT_URL} \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${DEFAULT_MODEL}",
    "messages": [{ "role": "user", "content": "Hello" }]
  }' | jq -r '.choices[0].message.content'`,
      },
      {
        label: "Discover the line",
        lang: "shell",
        code: `curl -s ${MODELS_URL}      | jq -r '.data[] | "\\(.id)  \\(.context_window)"'
curl -s ${PROVIDER_URL}    | jq '{modalities, concurrency, fleet}'`,
      },
    ],
  },
  {
    id: "openai-sdk",
    name: "OpenAI SDK (Node and Python)",
    category: "SDKs & Frameworks",
    blurb:
      "The official SDKs work unchanged — only the base URL moves. This is the path to use when you want retries, typed responses and streaming without writing HTTP by hand.",
    tags: ["TypeScript", "Python", "Streaming"],
    snippets: [
      { label: "Node / TypeScript", lang: "typescript", code: OPENAI_SDK_TS },
      { label: "Python", lang: "python", code: OPENAI_SDK_PY },
      { label: "Streaming (Python)", lang: "python", code: STREAMING_PY },
      { label: "Tool calling loop (TypeScript)", lang: "typescript", code: TOOL_LOOP_TS },
      { label: "Tool calling loop (Python)", lang: "python", code: TOOL_LOOP_PY },
    ],
    notes: [
      "`function.arguments` is a JSON string, not an object. Parse it before use, and accumulate streamed fragments by index.",
    ],
  },
  {
    id: "vercel-ai-sdk",
    name: "Vercel AI SDK",
    category: "SDKs & Frameworks",
    blurb:
      "Use the OpenAI-compatible provider from `@ai-sdk/openai-compatible`. This is the same transport the ZYRAXON builder gateway uses, so the shapes are already proven.",
    tags: ["TypeScript", "Streaming"],
    snippets: [{ label: "TypeScript", lang: "typescript", code: VERCEL_AI_SDK }],
  },
  {
    id: "langchain",
    name: "LangChain",
    category: "SDKs & Frameworks",
    blurb:
      "LangChain's OpenAI integrations accept a custom base URL, so the whole chain, agent and tooling surface is available over the ZYRAXON line.",
    tags: ["Python", "JavaScript"],
    snippets: [
      { label: "Python", lang: "python", code: LANGCHAIN_PY },
      { label: "JavaScript", lang: "typescript", code: LANGCHAIN_JS },
    ],
  },
  {
    id: "litellm",
    name: "LiteLLM (and Open WebUI, LibreChat, Dify, Flowise)",
    category: "SDKs & Frameworks",
    blurb:
      'LiteLLM refuses a model string without a provider prefix — that is the "LLM Provider NOT provided" error. Write the model as `openai/zyraxon-codex` and it uses the generic OpenAI-compatible handler. Every LiteLLM-based gateway (Open WebUI, LibreChat, Dify, Flowise, Langroid) connects the same way.',
    tags: ["Python", "Proxy", "Open WebUI", "Gateways"],
    fields: [
      {
        label: "Model",
        value: `openai/${DEFAULT_MODEL}`,
        note: "The `openai/` prefix is required by LiteLLM.",
      },
      { label: "API base / api_base", value: V1_BASE_URL },
      { label: "API key", value: ANY_API_KEY },
    ],
    steps: [
      "Use the model string with its provider prefix: `openai/zyraxon-codex`. Without a prefix LiteLLM stops before it ever calls us.",
      `Set the API base to \`${V1_BASE_URL}\` and the key to any non-empty value.`,
      "For a gateway like Open WebUI, add a custom OpenAI connection with those same values and reload.",
      "To front the whole line with LiteLLM's own proxy, use the config file below.",
    ],
    snippets: [
      { label: "Python", lang: "python", code: LITELLM_PY },
      { label: "litellm-config.yaml", lang: "yaml", code: LITELLM_CONFIG },
      { label: "Environment", lang: "bash", code: LITELLM_ENV },
      { label: "Model id rules", lang: "text", code: LITELLM_MODEL_PREFIX },
    ],
    notes: [
      "The endpoint is tolerant of the prefix: `zyraxon-codex`, `openai/zyraxon-codex`, `zyraxon/zyraxon-codex` and `zyraxon/codex` all resolve to the same model.",
      "`drop_params: true` in the proxy config avoids LiteLLM sending parameters an OpenAI-compatible endpoint may not accept.",
      "This is the integration to reach for when a client insists on a `provider/model` string.",
    ],
  },

  // ───────────────────────── LANGUAGES & RUNTIMES ──────────────────────
  {
    id: "go",
    name: "Go",
    category: "Languages & Runtimes",
    blurb:
      "The standard library is enough — no third-party client required. This works from a CLI tool, a service or a Go worker.",
    tags: ["Go", "net/http"],
    snippets: [{ label: "net/http", lang: "go", code: GO_CLIENT }],
  },
  {
    id: "rust",
    name: "Rust",
    category: "Languages & Runtimes",
    blurb:
      "reqwest plus serde_json, which most Rust services already depend on. Streaming works the same way over the same URL.",
    tags: ["Rust", "reqwest"],
    snippets: [{ label: "reqwest", lang: "rust", code: RUST_CLIENT }],
  },
  {
    id: "php",
    name: "PHP",
    category: "Languages & Runtimes",
    blurb:
      "Plain cURL, so it drops into any PHP app, Laravel job, Symfony command or WordPress plugin without a client library.",
    tags: ["PHP", "cURL"],
    snippets: [{ label: "cURL", lang: "php", code: PHP_CLIENT }],
  },
  {
    id: "java",
    name: "Java, Kotlin and the JVM",
    category: "Languages & Runtimes",
    blurb:
      "The JDK's own HTTP client, so Spring Boot, a Gradle task, an Android app or a plain CLI can call the endpoint with no extra dependency.",
    tags: ["Java", "JVM", "Spring"],
    snippets: [{ label: "HttpClient", lang: "java", code: JAVA_CLIENT }],
  },
  {
    id: "dotnet",
    name: ".NET and C#",
    category: "Languages & Runtimes",
    blurb:
      "HttpClient directly, or the OpenAI .NET SDK with a custom endpoint. Either way the request shape is the same one every other client sends.",
    tags: [".NET", "C#"],
    snippets: [{ label: "HttpClient", lang: "csharp", code: DOTNET_CLIENT }],
  },

  // ───────────────────────── BOTS & HOME ───────────────────────────────
  {
    id: "chat-bots",
    name: "Discord, Slack and chat bots",
    category: "Bots & Home",
    blurb:
      "A bot is one HTTP call. Take the message, send it as a user turn, post the reply back — the same pattern works for Discord, Slack, Telegram or a chat widget on your own site.",
    tags: ["Discord", "Slack", "Bots"],
    snippets: [{ label: "discord.js", lang: "typescript", code: DISCORD_BOT }],
    notes: [
      "Bot platforms have their own message-length limits. Truncate long replies or split them before posting.",
    ],
  },
  {
    id: "home-automation",
    name: "Home Assistant, Node-RED and smart-home",
    category: "Bots & Home",
    blurb:
      "Home automation hosts are HTTP clients with a templating layer, so a REST command or an HTTP request node is the whole integration.",
    tags: ["Home Assistant", "Node-RED", "IoT"],
    snippets: [{ label: "rest_command", lang: "yaml", code: HOME_ASSISTANT }],
  },

  // ───────────────────────── AUTOMATION & PLATFORMS ────────────────────
  {
    id: "n8n",
    name: "n8n, Make and Zapier",
    category: "Automation & Platforms",
    blurb:
      "No-code runners reach the endpoint through an HTTP request node. Point the node at the chat URL and map your previous step's output into the message content.",
    tags: ["No code", "HTTP node"],
    snippets: [{ label: "HTTP request node", lang: "json", code: N8N_HTTP }],
    notes: [
      "Set `stream: false` in a workflow runner. Most nodes buffer the body and cannot parse an SSE stream.",
    ],
  },
  {
    id: "http-clients",
    name: "Postman, Insomnia and other HTTP clients",
    category: "Automation & Platforms",
    blurb:
      "For exploring the API by hand before writing code. Save the request, then swap the model id to see how another ZYRAXON model answers the same turn.",
    tags: ["Manual testing"],
    snippets: [
      { label: "Request", lang: "text", code: POSTMAN },
      { label: "Discovery", lang: "bash", code: OPENAI_COMPAT_DISCOVERY },
    ],
  },
  {
    id: "voice",
    name: "Voice input",
    category: "Automation & Platforms",
    blurb:
      "Speech-to-text is a separate endpoint, so a client can record on the device, transcribe it, then send the transcript as a normal chat turn.",
    tags: ["Speech to text"],
    snippets: [
      {
        label: "Transcribe a recording",
        lang: "bash",
        code: `curl -s ${API_ORIGIN}/api/public/stt \\
  -F "file=@recording.mp3" \\
  -F "language=en" | jq -r '.text'`,
      },
    ],
    notes: [
      "Transcribe first and send text when the model does not accept audio. Check the model list for `audio` before sending an audio part.",
    ],
  },
];

export function getIntegration(id: string): Integration | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

export function integrationsByCategory(): {
  category: IntegrationCategory;
  items: Integration[];
}[] {
  return INTEGRATION_CATEGORIES.map((category) => ({
    category,
    items: INTEGRATIONS.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);
}

/** The machine-readable view. The endpoint serves this, so a client can
 *  discover the base URL, the key rule, the models and a working snippet
 *  without reading the website. */
export function integrationsDocument() {
  return {
    object: "integrations",
    provider: { id: "zyraxon", name: "ZYRAXON" },
    endpoint: V1_BASE_URL,
    urls: {
      base: V1_BASE_URL,
      models: MODELS_URL,
      chat: CHAT_URL,
      provider: PROVIDER_URL,
      integrations: INTEGRATIONS_URL,
    },
    defaultModel: DEFAULT_MODEL,
    apiKey: {
      required: false,
      value: ANY_API_KEY,
      note: "Any non-empty string works until the deployment sets ZYRAXON_PROVIDER_KEY; then send it as Authorization: Bearer <key>.",
    },
    rules: USAGE_RULES,
    integrations: INTEGRATIONS,
  };
}

/** The ZYRAXON Provider guide, as documentation data.
 *
 *  Kept out of `content.ts` so the provider reference can grow without turning
 *  the general docs registry into a thousand-line file. The shape is the same
 *  `DocPage` the rest of the docs use, so it renders through the same shell and
 *  gains search, sidebar and prev/next for free. */
import type { DocPage } from "./content";

const ORIGIN = "https://zyraxonai.lovable.app";
const V1 = `${ORIGIN}/api/public/zyraxon/v1`;

export const PROVIDER_DOCS: DocPage[] = [
  {
    slug: "provider-overview",
    title: "ZYRAXON Provider Overview",
    group: "ZYRAXON Provider",
    desc: "Ten branded models behind one OpenAI-compatible endpoint. What it is, what it costs, and what it will not do.",
    blocks: [
      {
        t: "p",
        text: "The **ZYRAXON Provider** is our own model line, served over an API that speaks the OpenAI chat-completions dialect. You point any OpenAI client at one base URL, choose a ZYRAXON model, and build. There is no provider key to buy, no per-request billing, and no upstream vendor name anywhere in a response.",
      },
      {
        t: "note",
        kind: "info",
        title: 'What "OpenAI-compatible" actually means here',
        text: "The request and response shapes match the OpenAI chat-completions schema, including SSE streaming and tool calls. That is what makes the OpenAI SDK, LangChain, the Vercel AI SDK, and anything else that already speaks that schema work without a custom adapter.",
      },
      { t: "h2", text: "The whole integration is two URLs" },
      {
        t: "table",
        head: ["Method", "URL", "What it does"],
        rows: [
          [
            "GET",
            `${V1}/models`,
            'Lists the ten ZYRAXON models in the standard `{ object: "list", data: [...] }` shape.',
          ],
          [
            "POST",
            `${V1}/chat/completions`,
            "Runs a chat turn, streaming or not, with optional media and tools.",
          ],
          [
            "GET",
            `${V1}/provider`,
            "Live provider status: model health, capabilities and capacity.",
          ],
        ],
      },
      { t: "h2", text: "Quickstart with cURL" },
      {
        t: "code",
        lang: "shell",
        code: `curl ${V1}/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "zyraxon-apex",
    "messages": [{ "role": "user", "content": "Hello" }],
    "stream": true
  }'`,
      },
      { t: "h2", text: "Quickstart with the OpenAI SDK" },
      {
        t: "code",
        lang: "typescript",
        code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${V1}",
  apiKey: "not-needed",
});

const stream = await client.chat.completions.create({
  model: "zyraxon-codex",
  messages: [{ role: "user", content: "Build a landing page" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}`,
      },
      {
        t: "note",
        kind: "tip",
        title: "apiKey is required by the SDK, not by us",
        text: "The OpenAI SDK refuses to construct a client without an `apiKey`. Any non-empty string works; the endpoint does not require one unless the deployment sets `ZYRAXON_PROVIDER_KEY`, in which case send it as `Authorization: Bearer <key>`.",
      },
      { t: "h2", text: "What every response tells you" },
      {
        t: "table",
        head: ["Header", "Meaning"],
        rows: [
          ["`X-ZYRAXON-Model`", "The ZYRAXON model that answered, never the upstream name."],
          [
            "`X-ZYRAXON-Input-Modalities`",
            "Which modalities the turn actually used — `image`, `audio`, `video`, `pdf`. Present only when media was sent.",
          ],
          [
            "`X-ZYRAXON-Capacity`",
            "`primary` when served on ZYRAXON's own budget, `spill` when the overflow pool served it.",
          ],
        ],
      },
      {
        t: "p",
        text: "Read `X-ZYRAXON-Input-Modalities` when a media answer looks thin: if it lists `image` but you sent audio too, the audio did not reach the model, and that is a fact you can assert rather than guess.",
      },
      { t: "h2", text: "Connecting from your own tools" },
      {
        t: "p",
        text: "The endpoint is all you need, but the wiring differs by client. The **Use It From Anywhere** guide covers Termux on Android, OpenHands, editors and CLI agents, mobile apps, the SDKs, and workflow runners — each with the exact fields to enter or code to paste.",
      },
      {
        t: "note",
        kind: "tip",
        title: "One URL to discover the rest",
        text: `\`GET ${V1}/integrations\` returns the base URL, the key rule, the model list location and a working snippet per platform, as JSON.`,
      },
    ],
  },

  {
    slug: "provider-models",
    title: "The Ten ZYRAXON Models",
    group: "ZYRAXON Provider",
    desc: "What each model is for, and how to pick one. Capabilities are read live, not advertised.",
    blocks: [
      {
        t: "p",
        text: "Every model accepts **text, images, audio, video and PDFs**. You do not have to pick a model to match your input: send whatever you have to whichever ZYRAXON model you like, and the line routes the turn to an upstream that can actually process it. The list below is the intended *character* of each model — what it is tuned for — not a list of what it can accept. Live context and output limits are whatever `GET /api/public/zyraxon/v1/models` reports right now, because the serving pool changes.",
      },
      {
        t: "table",
        head: ["Model id", "Built for", "Leads with"],
        rows: [
          [
            "`zyraxon-apex`",
            "Flagship reasoning at a million tokens",
            "Reasoning · long context",
          ],
          ["`zyraxon-matrix`", "Vision plus scale reasoning", "Image · reasoning"],
          ["`zyraxon-pulse`", "Speed on long inputs", "Low latency"],
          ["`zyraxon-titan`", "Heavyweight long context", "Long context"],
          ["`zyraxon-neural`", "General reasoning", "Balanced"],
          ["`zyraxon-codex`", "Code and project building", "Code generation"],
          ["`zyraxon-visionary`", "Image and document understanding", "Image · PDF"],
          ["`zyraxon-cyber`", "Security and systems work", "Analysis"],
          ["`zyraxon-quantum`", "Math and structured reasoning", "Precision"],
          ["`zyraxon-genesis`", "Long-form writing and design", "Long output"],
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "Every model takes every modality",
        text: "The catalogue reports `input_modalities: [\"text\",\"image\",\"audio\",\"video\",\"pdf\"]` on **all ten** models, and that is a real promise: the bytes are accepted and processed. Which upstream model inside the line actually handles your turn is chosen server-side, from a live measurement of each upstream — not from what it declares — so you never have to know or care. See **Routing: how your input reaches the right model**.",
      },
      {
        t: "note",
        kind: "warn",
        title: "Do not hardcode a model's context window",
        text: "A model's advertised context and output limits move with the pool. Read them from the models list at startup, or from `GET /api/public/zyraxon/v1/provider`, instead of baking a number into your client.",
      },
      { t: "h2", text: "How to choose" },
      {
        t: "list",
        items: [
          "**You usually do not need to choose by input type.** Any model accepts any media; the routing picks the upstream. Choose by what the answer should be like.",
          "Writing code or building a project? `zyraxon-codex` is the intended default.",
          "Need the longest possible answer? `zyraxon-genesis` or `zyraxon-titan`.",
          "Need the fastest turnaround on a long prompt? `zyraxon-pulse`.",
          "Want the strongest reasoning? `zyraxon-apex`.",
        ],
      },
      {
        t: "note",
        kind: "success",
        title: "Rotation is not an outage",
        text: 'When a model reports `status: "rotated"`, its preferred binding is temporarily unavailable and a sibling is covering. The model still answers under the same name and capability profile. This is normal operation, not a failure.',
      },
    ],
  },

  {
    slug: "provider-media",
    title: "Sending Images, Audio, Video and PDFs",
    group: "ZYRAXON Provider",
    desc: "The exact part shape for every media type, the size limits, and how to slice a long recording so it is not rejected.",
    blocks: [
      {
        t: "p",
        text: "Media is sent as **content parts** inside a user message, exactly as in the OpenAI schema. The provider accepts both the raw OpenAI spellings and a canonical `file` part, so a client written against OpenAI needs no changes.",
      },
      {
        t: "note",
        kind: "warn",
        title: "Read this before sending large files",
        text: "One request carries at most **12 media parts** and a body under **40 MB**. Base64 encoding adds about a third to a file's size, so a 30 MB video becomes ~40 MB on the wire. Compress and slice before you send; do not send a single huge part and expect the server to sort it out.",
      },
      { t: "h2", text: "Two ways to send media: inline or by URL" },
      {
        t: "p",
        text: "Every media part can be given either as **inline base64** or as an **http(s) URL**. The URL form is usually what you want: your file already lives somewhere, and a URL keeps the request body small.",
      },
      {
        t: "table",
        head: ["How", "Where the bytes go", "Use it when"],
        rows: [
          [
            "Inline data URL",
            "`data:<mime>;base64,<BASE64>` in the part itself",
            "The file is small, or you have already read it into memory (a browser upload, a paste, a screenshot).",
          ],
          [
            "Remote URL",
            "`https://…` in the same field",
            "The file is large, already hosted, or produced by another service. **The server fetches it for you** and inlines it before the model is called.",
          ],
        ],
      },
      {
        t: "note",
        kind: "success",
        title: "URLs are fetched server-side, so the model always gets bytes",
        text: "Most upstream models cannot open a URL, and an `input_audio` part has no URL form at all. So when you send a URL, ZYRAXON fetches it, re-encodes it as a data URL, and routes the turn exactly as if you had sent base64. You never have to inline a large file yourself. A URL that cannot be read (404, timeout, private host) fails the turn with a clear message instead of being silently dropped.",
      },
      {
        t: "code",
        lang: "json",
        code: `{
  "role": "user",
  "content": [
    { "type": "text", "text": "Describe this recording and transcribe it." },
    { "type": "input_audio", "input_audio": { "url": "https://cdn.example.com/talk.mp3" } },
    { "type": "image_url", "image_url": { "url": "https://cdn.example.com/diagram.png" } },
    { "type": "video_url", "video_url": { "url": "https://cdn.example.com/clip.mp4" } },
    { "type": "file", "file": { "filename": "report.pdf", "file_data": "https://cdn.example.com/report.pdf" } }
  ]
}`,
      },
      {
        t: "table",
        head: ["Field", "Inline", "Remote URL"],
        rows: [
          ["Image", "`image_url: { url: \"data:image/png;base64,…\" }`", "`image_url: { url: \"https://…\" }`"],
          ["Audio", "`input_audio: { data: \"<BASE64>\", format: \"mp3\" }`", "`input_audio: { url: \"https://…\" }`"],
          ["Video", "`video_url: { url: \"data:video/mp4;base64,…\" }`", "`video_url: { url: \"https://…\" }`"],
          ["PDF", "`file: { filename, file_data: \"data:application/pdf;base64,…\" }`", "`file: { filename, file_data: \"https://…\" }`"],
        ],
      },
      { t: "h2", text: "Images" },
      {
        t: "code",
        lang: "json",
        code: `{
  "role": "user",
  "content": [
    { "type": "text", "text": "What is in this image?" },
    {
      "type": "image_url",
      "image_url": { "url": "data:image/png;base64,<BASE64>" }
    }
  ]
}`,
      },
      { t: "h2", text: "Audio" },
      {
        t: "p",
        text: "Audio uses the `input_audio` part: `data` is base64 (no data-URL prefix) and `format` names the container.",
      },
      {
        t: "code",
        lang: "json",
        code: `{
  "role": "user",
  "content": [
    { "type": "text", "text": "Transcribe and summarise this recording." },
    {
      "type": "input_audio",
      "input_audio": { "data": "<BASE64>", "format": "mp3" }
    }
  ]
}`,
      },
      {
        t: "note",
        kind: "warn",
        title: "Never send long audio as WAV",
        text: "Uncompressed mono 16 kHz WAV is about 115 MB per hour — larger than the source for anything already compressed, and guaranteed to be refused. Transcode to low-bitrate mono MP3 or AAC first. A one-hour talk at 48 kbps mono MP3 is roughly 21 MB.",
      },
      { t: "h2", text: "Video" },
      {
        t: "p",
        text: "Video uses a `video_url` part. Because a real video quickly exceeds one request, the intended pattern is to compress it, cut it into ordered slices of a few megabytes, and send the slices as separate parts **in playback order**. The model is told to treat ordered slices as one continuous recording.",
      },
      {
        t: "code",
        lang: "json",
        code: `{
  "role": "user",
  "content": [
    { "type": "text", "text": "Summarise this clip." },
    { "type": "video_url", "video_url": { "url": "data:video/mp4;base64,<SLICE 1>" } },
    { "type": "video_url", "video_url": { "url": "data:video/mp4;base64,<SLICE 2>" } }
  ]
}`,
      },
      {
        t: "note",
        kind: "tip",
        title: "How to slice a video",
        text: "Compress first with H.264 at a bitrate sized to the length, then cut with stream copy (`-c copy`) so slicing is fast and lossless. The provider's own client does exactly this: it sizes the bitrate to the duration, then cuts into near-equal ordered slices.",
      },
      { t: "h2", text: "PDFs and other documents" },
      {
        t: "code",
        lang: "json",
        code: `{
  "role": "user",
  "content": [
    { "type": "text", "text": "Summarise this contract." },
    {
      "type": "file",
      "file": { "filename": "contract.pdf", "file_data": "data:application/pdf;base64,<BASE64>" }
    }
  ]
}`,
      },
      { t: "h2", text: "Limits, in one place" },
      {
        t: "table",
        head: ["Limit", "Value", "What happens past it"],
        rows: [
          [
            "Media parts per request",
            "12",
            "Extra parts are dropped; the response still succeeds. Trim client-side and tell your user.",
          ],
          [
            "Request body",
            "40 MB",
            "The request is refused with **413** and `type: payload_too_large`.",
          ],
          [
            "Messages per request",
            "48 (most recent kept)",
            "Older turns are dropped so a long history cannot grow unbounded.",
          ],
          ["Image / PDF raw size", "2 MB inline", "Compress or downscale before sending."],
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "Large media is sliced, not rejected",
        text: "The ZYRAXON desktop and web clients compress and slice on the client before sending, so a long recording arrives as several ordered parts rather than a single refused upload. If a file is so long that even the lowest usable bitrate will not fit one turn, the leading parts are sent and the remainder is reported to the user — never dropped silently.",
      },
    ],
  },

  {
    slug: "provider-routing",
    title: "Routing: How Your Input Reaches the Right Model",
    group: "ZYRAXON Provider",
    desc: "Every model accepts every modality. Which upstream handles your turn is decided server-side, from live measurement — here is exactly how.",
    blocks: [
      {
        t: "p",
        text: "A ZYRAXON model id is a **stable name for a routing policy**, not a fixed machine. When you send a turn to `zyraxon-apex`, the line looks at what the turn actually carries, finds an upstream model measured able to process exactly that, and sends it there. You address a brand; the brand addresses a model. This is why every model can truthfully advertise `input_modalities: [\"text\",\"image\",\"audio\",\"video\",\"pdf\"]` — the media is always handled, whichever name you used.",
      },
      { t: "h2", text: "What happens to one request" },
      {
        t: "list",
        items: [
          "**1. Your media is resolved.** Any part you sent as an `http(s)` URL is fetched and inlined (see **Sending Images, Audio, Video and PDFs**). After this step the turn is fully inline and looks the same no matter how you sent it.",
          "**2. The turn's requirement is read.** The line collects which modalities the turn actually carries: `text` alone, or `text + image`, `text + audio`, `text + video`, and so on. This set is the only thing that decides the routing.",
          "**3. A capable upstream is chosen.** Candidates are filtered to those **measured** able to take every modality in the set — measurement, not declaration, because the pool's self-descriptions are known to be wrong in both directions.",
          "**4. Speed breaks the tie.** Among the capable models, the fastest measured one leads. If it fails, the chain walks to the next capable model.",
          "**5. A refusal is caught, not served.** A model that returns 200 while ignoring the media is detected and the turn is re-asked on the next capable model, instead of handing you an answer that pretends to have read the file.",
        ],
      },
      {
        t: "note",
        kind: "success",
        title: "The game is played behind the line, and you never see it",
        text: "You do not choose a model to match your input, and you do not have to know which upstream can see, hear or watch. Send text, an image, an audio file or a video to **any** ZYRAXON model. The line picks the machine. That is the entire point of the brand.",
      },
      { t: "h2", text: "Which model leads, by what the turn carries" },
      {
        t: "table",
        head: ["Your turn carries", "The line routes it to", "Why"],
        rows: [
          [
            "Text only",
            "A **text model** when one is available and equally able",
            "Text models are the fastest and cheapest, and using an omni model for plain text spends the one upstream a media turn may need. If no text model is live, a media-capable model answers — you get a correct reply either way.",
          ],
          [
            "Text + image",
            "A model measured able to **see images**",
            "The image is only processed if the model receives it. An image turn is never routed to a text-only model.",
          ],
          [
            "Text + audio",
            "A model measured able to **take audio**",
            "Audio capability is the least reliably declared, so it is only trusted after measurement.",
          ],
          [
            "Text + video",
            "A model measured able to **take video**",
            "Video is the rarest capability; the chain prefers a model that handles both text and video.",
          ],
          [
            "Image only (no text)",
            "A model measured able to **see** — never a text-only model",
            "With nothing to read as text, the media *is* the request.",
          ],
          [
            "Video only (no text)",
            "A model measured able to **take video**",
            "Same rule, for the rarest modality.",
          ],
          [
            "Anything + PDF",
            "A model that can take the document, plus whatever else the turn carries",
            "A PDF is treated as a document, not as text.",
          ],
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "Mixed turns are matched on the whole set",
        text: "If you send text **and** an image, the line needs a model that takes both — a text-only model is excluded even though it could answer the text half, because an answer that ignores your image is not an answer to your request.",
      },
      { t: "h2", text: "When the pool changes under you" },
      {
        t: "p",
        text: "The upstream pool is added to and retired without notice. The line re-reads it on a short interval and re-binds every brand to a live model, so a retired upstream degrades to a capable sibling rather than a dead end. You keep calling the same ZYRAXON name and it keeps working. A brand whose preferred upstream is temporarily absent reports `status: \"rotated\"` in the models list; it still answers.",
      },
      {
        t: "note",
        kind: "tip",
        title: "You can watch the routing decisions",
        text: "`GET /api/public/zyraxon/v1/models` publishes `input_modalities` (what the brand accepts — always all five) alongside `routed_modalities` (what the upstream currently bound to that brand was measured to accept). The second field is the live, operational view, and it is safe to log for debugging. Do not branch your client on it: the routing already did that work.",
      },
    ],
  },

  {
    slug: "provider-tools",
    title: "Tool Calling",
    group: "ZYRAXON Provider",
    desc: "Define your own tools in OpenAI wire form and get real tool calls back, streaming or not.",
    blocks: [
      {
        t: "p",
        text: 'The provider accepts a standard `tools` array. When you define tools, the model can call them: the response carries `finish_reason: "tool_calls"` and the call appears in `tool_calls` with a name and JSON arguments. This works on both the streaming and non-streaming paths.',
      },
      {
        t: "code",
        lang: "json",
        code: `{
  "model": "zyraxon-codex",
  "messages": [{ "role": "user", "content": "Save a hello world file." }],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "write_file",
        "description": "Write text to a file on disk.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string" },
            "content": { "type": "string" }
          },
          "required": ["path", "content"]
        }
      }
    }
  ]
}`,
      },
      {
        t: "p",
        text: "The reply ends the turn with the call rather than a prose answer:",
      },
      {
        t: "code",
        lang: "json",
        code: `{
  "choices": [
    {
      "finish_reason": "tool_calls",
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "write_file",
              "arguments": "{\\"path\\":\\"hello.txt\\",\\"content\\":\\"Hello, world\\"}"
            }
          }
        ]
      }
    }
  ]
}`,
      },
      { t: "h2", text: "The loop" },
      {
        t: "list",
        ordered: true,
        items: [
          "Send your `tools` array with the user message.",
          'The model replies with `finish_reason: "tool_calls"` and one or more calls.',
          'Run each call yourself, and append a message with `role: "tool"`, the matching `tool_call_id`, and the result.',
          "Call the endpoint again with the extended message list. Repeat until `finish_reason` is `stop`.",
        ],
      },
      {
        t: "note",
        kind: "warn",
        title: "Send the assistant's tool call back, not only the result",
        text: 'The message list you send on the second call must include the assistant message that asked for the tools — with its `tool_calls` array and their `id`s — followed by the `role: "tool"` result that names the same `tool_call_id`. Sending only the tool result leaves the result unmatched, and a model that cannot match a result to its call will ask for the same tool again instead of answering.',
      },
      {
        t: "note",
        kind: "warn",
        title: "You execute the tools",
        text: "The provider does not run your tools. It returns the call; your code performs the action and sends the result back. That is what keeps the model from touching anything you did not authorise.",
      },
      {
        t: "note",
        kind: "info",
        title: "Arguments are a JSON string",
        text: "As in the OpenAI schema, `function.arguments` is a string containing JSON, not an object. Parse it before use. Streamed calls arrive as fragments — accumulate them by index, then parse.",
      },
      { t: "h2", text: "The second request, in full" },
      {
        t: "p",
        text: 'This is the request that turns a tool call into an answer. The assistant message that requested the tools is echoed back verbatim, then the result is appended as a `role: "tool"` message carrying the same `tool_call_id`.',
      },
      {
        t: "code",
        lang: "json",
        code: `{
  "model": "zyraxon-codex",
  "messages": [
    { "role": "user", "content": "Save a hello world file." },
    {
      "role": "assistant",
      "content": null,
      "tool_calls": [
        {
          "id": "call_abc123",
          "type": "function",
          "function": {
            "name": "write_file",
            "arguments": "{\\"path\\":\\"hello.txt\\",\\"content\\":\\"Hello, world\\"}"
          }
        }
      ]
    },
    { "role": "tool", "tool_call_id": "call_abc123", "content": "wrote hello.txt" }
  ],
  "tools": [ /* the same tools array as before */ ]
}`,
      },
      {
        t: "note",
        kind: "success",
        title: "How you know it worked",
        text: 'The reply now has `finish_reason: "stop"` and a normal `content` answer. If you get `finish_reason: "tool_calls"` asking for the same tool again, the assistant\'s `tool_calls` block is missing from what you sent — the model never saw its own call, so it cannot see the result either.',
      },
    ],
  },

  {
    slug: "provider-capacity",
    title: "Capacity, Spillover and Errors",
    group: "ZYRAXON Provider",
    desc: "How the provider stays up under load, where excess traffic goes, and what each error code means.",
    blocks: [
      {
        t: "p",
        text: "The provider is built to absorb far more concurrent callers than its own budget can serve directly. Instead of dropping the excess, it hands it to a spill pool; instead of queueing forever, it sheds with a clear, retryable error.",
      },
      { t: "h2", text: "How load is handled" },
      {
        t: "table",
        head: ["Tier", "Behaviour"],
        rows: [
          [
            "Primary",
            "Served on ZYRAXON's own lane budget. Responses carry `X-ZYRAXON-Capacity: primary`.",
          ],
          [
            "Spill",
            "When primary lanes are full, the turn is handed to the OpenCode Zen free pool. Still a normal, successful answer, marked `spill`.",
          ],
          [
            "Queue",
            "A bounded wait for a lane before giving up, so a short burst is smoothed rather than rejected.",
          ],
          [
            "Shed",
            "If even the spill tier is saturated, the request returns **503** with `Retry-After` rather than blocking other callers.",
          ],
        ],
      },
      {
        t: "note",
        kind: "success",
        title: "Overload degrades, it does not crash",
        text: "A `spill` response is a success. Treat `X-ZYRAXON-Capacity: spill` as a signal to slow down or add retry jitter, not as an error to surface.",
      },
      { t: "h2", text: "Error codes" },
      {
        t: "table",
        head: ["Status", "type", "Meaning and what to do"],
        rows: [
          [
            "400",
            "`invalid_request_error`",
            "Unknown model, missing messages, or malformed JSON. Check the model id against `/v1/models`.",
          ],
          [
            "401",
            "`authentication_error`",
            "The deployment requires a provider key and yours is missing or wrong. Send `Authorization: Bearer <key>`.",
          ],
          [
            "413",
            "`payload_too_large`",
            "Body over the limit. Compress and slice media, then retry.",
          ],
          ["429", "`rate_limit`", "Slow down and retry with backoff."],
          [
            "502",
            "`provider_unavailable`",
            "Every model in the rotation was unavailable. Retrying usually works.",
          ],
          ["503", "`overloaded`", "At capacity; shed rather than queued. Honour `Retry-After`."],
          [
            "503",
            "`upstream_gate`",
            "The upstream free tier refused this network. Set `OPENCODE_ZEN_API_KEY` or call from a served network.",
          ],
        ],
      },
      { t: "h2", text: "Recommended retry policy" },
      {
        t: "list",
        items: [
          "Retry `429`, `502`, `503` with exponential backoff plus jitter.",
          "Honour the `Retry-After` header on `503`.",
          "Do not retry `400`, `401`, or `413` — fix the request instead.",
          "Log the `type` field, not just the status: `overloaded` and `upstream_gate` are both 503 but need different actions.",
        ],
      },
      {
        t: "note",
        kind: "tip",
        title: "Check status before a big run",
        text: "`GET /api/public/zyraxon/v1/provider` reports live model health, the current concurrency ceiling, and the overload policy, so a client can decide before it fires a batch.",
      },
    ],
  },
];

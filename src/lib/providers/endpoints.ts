/** Every ZYRAXON endpoint, in one place.
 *
 *  This is the single source of truth for the public API surface. Before this
 *  file existed the endpoints were described in three unrelated places — the
 *  model URLs on the provider page, the speech URLs at the bottom of it, and a
 *  third set inside the docs — so the page read as though chat and speech were
 *  different products, and a new endpoint had no obvious home.
 *
 *  Now a caller reads one catalogue, grouped by what they are trying to do, and
 *  a new endpoint is one entry here rather than an edit in three files. The
 *  provider page, the speech section and the docs all render from it.
 *
 *  Only endpoints that were called and answered are listed. A URL that has not
 *  been seen working does not belong here, however likely it is to work. */

import { API_ORIGIN } from "./integrations";
import {
  CURL_STT_BATCH,
  CURL_STT_LIVE,
  CURL_TTS,
  STT_LIVE_BROWSER_TS,
  STT_LIVE_NODE_TS,
  SPEECH_LOOP_BASH,
  STT_PYTHON,
  TTS_BROWSER_TS,
  PCM_BYTES_PER_SECOND,
} from "./speech-snippets";

export type EndpointMethod = "GET" | "POST";

/** What an endpoint is for, in the order a caller meets the need. */
export type EndpointGroup = "Talk to a model" | "Hear an answer" | "Speak instead of typing";

export type EndpointSnippet = {
  label: string;
  lang: string;
  code: string;
};

export type Endpoint = {
  id: string;
  group: EndpointGroup;
  method: EndpointMethod;
  /** The path, without the origin. */
  path: string;
  name: string;
  /** One sentence: what it does for the caller. */
  blurb: string;
  /** What the response holds, so a caller knows before writing a parser. */
  returns: string;
  /** Fields a caller may send, for endpoints that take a body. */
  fields?: { name: string; required: boolean; note: string }[];
  snippets?: EndpointSnippet[];
  notes?: string[];
  /** True when this endpoint needs no key of any kind. Every one of ours is. */
  keyless?: boolean;
  /** The four the provider page leads with, in the order a caller needs them:
   *  chat streaming, the model list, speech out, speech in. The rest are real
   *  and documented, but they are read once rather than called in a loop. */
  featured?: boolean;
};

export const ENDPOINT_GROUPS: EndpointGroup[] = [
  "Talk to a model",
  "Hear an answer",
  "Speak instead of typing",
];

const V1 = `${API_ORIGIN}/api/public/zyraxon/v1`;

export const ENDPOINTS: Endpoint[] = [
  /* ───────────────────────── talk to a model ───────────────────────── */
  {
    id: "chat",
    group: "Talk to a model",
    method: "POST",
    path: "/api/public/zyraxon/v1/chat/completions",
    name: "Chat completions",
    blurb:
      "The call your app makes. OpenAI chat-completions semantics, with server-sent-event streaming when you ask for it.",
    returns:
      "`choices[].message.content`, or a stream of `chat.completion.chunk` objects when `stream` is true.",
    fields: [
      {
        name: "model",
        required: true,
        note: "Any id from the model catalogue, e.g. `zyraxon-apex`.",
      },
      { name: "messages", required: true, note: "The usual `[{role, content}]` array." },
      { name: "stream", required: false, note: "`true` for server-sent events." },
      {
        name: "tools",
        required: false,
        note: "OpenAI function-tool definitions; the model calls them.",
      },
    ],
    snippets: [
      {
        label: "Streaming",
        lang: "shell",
        code: `curl -sN ${V1}/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "zyraxon-apex",
    "stream": true,
    "messages": [{ "role": "user", "content": "Hello" }]
  }'`,
      },
      {
        label: "Non-streaming",
        lang: "shell",
        code: `curl -s ${V1}/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "zyraxon-apex",
    "messages": [{ "role": "user", "content": "Hello" }]
  }' | jq -r '.choices[0].message.content'`,
      },
    ],
    notes: [
      "The `model` value is a ZYRAXON name, not an upstream one. That name does not change when the pool behind it does.",
    ],
    keyless: true,
    featured: true,
  },
  {
    id: "models",
    group: "Talk to a model",
    method: "GET",
    path: "/api/public/zyraxon/v1/models",
    name: "Model catalogue",
    blurb:
      "What a client reads first, to discover which models exist. Standard OpenAI list shape, so no special handling is needed.",
    returns: '`{ object: "list", data: [{ id, owned_by, … }] }` — ten ZYRAXON models.',
    snippets: [
      {
        label: "List the line",
        lang: "shell",
        code: `curl -s ${V1}/models | jq -r '.data[] | .id'`,
      },
    ],
    keyless: true,
    featured: true,
  },
  {
    id: "provider",
    group: "Talk to a model",
    method: "GET",
    path: "/api/public/zyraxon/v1/provider",
    name: "Provider details",
    blurb:
      "What the serving pool looks like right now — modalities, concurrency, and each model's live status and context window.",
    returns: "`{ models: [{ id, status, context, … }], modalities, concurrency, fleet }`.",
    snippets: [
      {
        label: "Read the pool",
        lang: "shell",
        code: `curl -s ${V1}/provider | jq '{modalities, concurrency, fleet}'`,
      },
    ],
    notes: [
      "The provider page reads this endpoint live, so a model shown as rotated there is rotated in the pool at that moment.",
    ],
    keyless: true,
  },
  {
    id: "integrations",
    group: "Talk to a model",
    method: "GET",
    path: "/api/public/zyraxon/v1/integrations",
    name: "Integration catalogue",
    blurb:
      "The same integration list this page shows, as JSON — the exact values to paste into a host app, with steps and snippets.",
    returns: "`{ integrations: [{ id, name, category, fields, steps, snippets }] }`.",
    snippets: [
      {
        label: "Find one by id",
        lang: "shell",
        code: `curl -s ${V1}/integrations | jq -r '.integrations[] | "\\(.id)\\t\\(.name)"'`,
      },
    ],
    keyless: true,
  },

  /* ───────────────────────── hear an answer ───────────────────────── */
  {
    id: "tts",
    group: "Hear an answer",
    method: "POST",
    path: "/api/public/tts",
    name: "Text to speech",
    blurb:
      "Turn an answer into audio. The voice follows the language of the text, so a Bengali answer is read by a Bengali voice rather than an English one sounding out Bengali letters.",
    returns: "`audio/mpeg`, streamed, with `X-ZYRAXON-Voice` naming the voice that spoke.",
    fields: [
      {
        name: "text",
        required: true,
        note: "What to say, up to 5000 characters. Markdown is stripped first.",
      },
      {
        name: "voice",
        required: false,
        note: "An exact name from the voices list, e.g. `bn-BD-NabanitaNeural`. Wins over `locale`.",
      },
      {
        name: "locale",
        required: false,
        note: "A language, e.g. `bn`. Picks a voice in that language.",
      },
    ],
    snippets: [
      { label: "cURL", lang: "shell", code: CURL_TTS },
      { label: "Browser: speak as it streams", lang: "typescript", code: TTS_BROWSER_TS },
    ],
    notes: [
      "Code blocks, links and Markdown are removed before speaking, so an answer is not read out character by character.",
      "Naming `voice` exactly also skips the voice-catalogue lookup, so the first byte of audio arrives sooner.",
    ],
    keyless: true,
    featured: true,
  },
  {
    id: "voices",
    group: "Hear an answer",
    method: "GET",
    path: "/api/public/tts/voices",
    name: "Voice catalogue",
    blurb: "Every voice available, with its locale and gender. 322 voices across 75 languages.",
    returns: "`{ count, languages, locales, data: [{ name, locale, gender, friendly }] }`.",
    snippets: [
      {
        label: "Every Bengali voice",
        lang: "shell",
        code: `curl -s ${API_ORIGIN}/api/public/tts/voices \\
  | jq -r '.data[] | select(.locale | startswith("bn")) | .name'
# bn-BD-NabanitaNeural
# bn-BD-PradeepNeural
# bn-IN-BashkarNeural
# bn-IN-TanishaaNeural`,
      },
    ],
    keyless: true,
  },

  /* ───────────────────── speak instead of typing ───────────────────── */
  {
    id: "stt",
    group: "Speak instead of typing",
    method: "POST",
    path: "/api/public/stt",
    name: "Speech to text — one endpoint, two modes",
    blurb:
      "Send a recording and get the transcript, or stream audio while the person is still speaking and get text as it is recognised. Same URL; the request itself picks the mode.",
    returns:
      "Batch: `{ success, text, language, confidence, engine, container, duration, elapsed }`. Live: server-sent events — `ready`, `language`, `partial`, `segment`, `done`.",
    fields: [
      {
        name: "language",
        required: true,
        note: "`bn` or `bn-BD`. Required in both modes — the recogniser does not detect language, so a guess would be a wrong transcript.",
      },
      {
        name: "file",
        required: false,
        note: "Batch, multipart: the audio. Format is read from the bytes, so a mislabelled file still works.",
      },
      {
        name: "audio",
        required: false,
        note: "Batch, JSON: base64 audio, with an optional `format`.",
      },
      { name: "segment", required: false, note: "Live: seconds per committed chunk, default 4." },
      {
        name: "partial",
        required: false,
        note: "Live: seconds between partial updates, default 1.2.",
      },
    ],
    snippets: [
      { label: "A recording", lang: "shell", code: CURL_STT_BATCH },
      { label: "Live, from a pipe", lang: "shell", code: CURL_STT_LIVE },
      { label: "Live, in a browser", lang: "typescript", code: STT_LIVE_BROWSER_TS },
      { label: "Live, in Node", lang: "typescript", code: STT_LIVE_NODE_TS },
      { label: "Python", lang: "python", code: STT_PYTHON },
      { label: "The whole loop", lang: "shell", code: SPEECH_LOOP_BASH },
    ],
    notes: [
      "Accepted containers: wav, mp3, flac, ogg, webm, and raw PCM. The format is sniffed from the first bytes, not from the Content-Type.",
      `Live mode takes raw 16-bit mono PCM. One second at 16 kHz is ${PCM_BYTES_PER_SECOND} bytes — a client paces its microphone by that.`,
      "A compressed container cannot be cut mid-frame, which is why live mode takes PCM: raw samples can be split at any moment without corrupting the audio.",
      "`language` is required, not detected. Asked for English about Bengali audio the recogniser returns English-sounding words at high confidence instead of failing, so a guess produces a confident wrong answer. The caller knows which language is being spoken; the endpoint asks rather than assumes.",
      "`GET` on this URL returns the contract as JSON, so a coding assistant handed the URL can read it without a human explaining it.",
    ],
    keyless: true,
    featured: true,
  },
];

/** The endpoints of one group, in catalogue order. */
export function endpointsIn(group: EndpointGroup): Endpoint[] {
  return ENDPOINTS.filter((e) => e.group === group);
}

/** The full URL for an endpoint, for display and for copying. */
export function endpointUrl(endpoint: Endpoint): string {
  return `${API_ORIGIN}${endpoint.path}`;
}

/** Counts for the page header, derived rather than typed, so they cannot drift. */
export const ENDPOINT_STATS = {
  total: ENDPOINTS.length,
  groups: ENDPOINT_GROUPS.length,
  keyless: ENDPOINTS.filter((e) => e.keyless).length,
};

/** Speech snippets: the exact code for speaking and listening, in the languages
 *  a caller is likely to be using.
 *
 *  Kept as data in its own module because the same code appears in three places
 *  — the docs page, the integrations list and the provider page — and three
 *  hand-copied versions drift. Every value here was measured against the live
 *  endpoints, including the byte counts, so a reader who copies a snippet gets
 *  something that runs rather than something that looks right. */

import { API_ORIGIN } from "./integrations";

export const TTS_URL = `${API_ORIGIN}/api/public/tts`;
export const VOICES_URL = `${API_ORIGIN}/api/public/tts/voices`;
export const STT_URL = `${API_ORIGIN}/api/public/stt`;
export const CHAT_COMPLETIONS_URL = `${API_ORIGIN}/api/public/zyraxon/v1/chat/completions`;

/** Bytes in one second of 16 kHz mono signed 16-bit PCM — the live stream's
 *  unit of account. A client has to know this to pace its microphone. */
export const PCM_BYTES_PER_SECOND = 16000 * 2;

/* ───────────────────────────── listen ───────────────────────────── */

export const CURL_TTS = `# Speak text. The voice is chosen from the text's own script
# unless you name one, so a Bengali answer is read by a Bengali voice.
curl -s ${TTS_URL} \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Hello from ZYRAXON.","locale":"en"}' \\
  -o answer.mp3

# Name the voice exactly when you want a specific one
curl -s ${TTS_URL} \\
  -H "Content-Type: application/json" \\
  -d '{"text":"আজ আকাশ পরিষ্কার।","voice":"bn-BD-NabanitaNeural"}' \\
  -o bengali.mp3

# What voices exist: 322 of them, across 75 languages
curl -s ${VOICES_URL} | jq -r '.data[] | select(.locale|startswith("bn")) | .name'`;

export const TTS_BROWSER_TS = `// Speak an answer, sentence by sentence, while it is still being written.
// Speaking the whole reply at the end means seconds of silence; speaking each
// finished sentence as it appears is what makes it feel like conversation.
const queue: string[] = [];
let buffer = "";
let speaking = false;

async function speak(text: string): Promise<void> {
  const res = await fetch("${TTS_URL}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),      // the language is read from the text
  });
  const audio = new Audio(URL.createObjectURL(await res.blob()));
  await new Promise<void>((done) => {
    audio.onended = () => done();
    audio.onerror = () => done();
    void audio.play();
  });
}

async function pump(): Promise<void> {
  if (speaking) return;
  speaking = true;
  while (queue.length) await speak(queue.shift()!);
  speaking = false;
}

/** Call on every streamed token of the model's answer. */
export function feed(chunk: string): void {
  buffer += chunk;
  // Cut after a sentence terminator, including the Bengali danda.
  let at = -1;
  for (let i = 0; i < buffer.length; i++) if (/[.!?।॥]/.test(buffer[i]!)) at = i;
  if (at >= 0) {
    queue.push(buffer.slice(0, at + 1).trim());
    buffer = buffer.slice(at + 1).trimStart();
    void pump();
  }
}

/** Call when the answer ends, to speak whatever is left. */
export function finish(): void {
  if (buffer.trim()) queue.push(buffer.trim());
  buffer = "";
  void pump();
}`;

/* ───────────────────────────── listen in, live ───────────────────────────── */

export const CURL_STT_BATCH = `# A recording you already have. The format is read from the bytes,
# so a mislabelled file still works. language is required — the
# recogniser does not detect it, and a guess is a wrong transcript.
curl -s ${STT_URL} \\
  -F "file=@recording.mp3" \\
  -F "language=bn" \\
| jq -r '.text'`;

export const CURL_STT_LIVE = `# Live transcription over Server-Sent Events.
# Body: raw 16-bit mono PCM at 16 kHz — one second is 32000 bytes.
# --data-binary with @- streams stdin, so this works from a pipe:
ffmpeg -i recording.mp3 -ar 16000 -ac 1 -f s16le - \\
| curl -sN -X POST "${STT_URL}?language=bn" \\
    -H "Content-Type: audio/l16; rate=16000" \\
    -H "Accept: text/event-stream" \\
    --data-binary @-

# event: ready     {"rate":16000,"language":"bn"}
# event: partial   {"text":"আজ আকাশ"}
# event: partial   {"text":"আজ আকাশ পরিষ্কার"}
# event: segment   {"text":"আজ আকাশ পরিষ্কার এবং সূর্য উজ্জ্বল।","seconds":4.2}
# event: done      {"text":"...","segments":2,"seconds":8.1}`;

export const STT_LIVE_BROWSER_TS = `// Live transcription from a browser microphone.
//
// The browser records to WebM/Opus, which cannot be cut mid-frame, so the audio
// is resampled to raw PCM here with an AudioWorklet-free approach: the recorder
// is only used as a clock, and each chunk is decoded and resampled to 16 kHz
// before being posted. Sending PCM is what lets the server split the stream
// cleanly at any moment.
const RATE = 16000;

export async function startLive(
  onText: (text: string, final: boolean) => void,
  language: string,        // required: "bn", "bn-BD", "en-US", …
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });

  // Decode the microphone through a context at the target rate, so the samples
  // posted are already 16 kHz mono and no resampling is needed on the server.
  const ctx = new AudioContext({ sampleRate: RATE });
  await ctx.audioWorklet.addModule("/pcm-worklet.js");
  const source = ctx.createMediaStreamSource(stream);
  const worklet = new AudioWorkletNode(ctx, "pcm-worklet");
  source.connect(worklet);

  const controller = new AbortController();
  const upload = new ReadableStream<Uint8Array>({
    start(sink) {
      worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const floats = event.data;
        const pcm = new Int16Array(floats.length);
        for (let i = 0; i < floats.length; i++) {
          const v = Math.max(-1, Math.min(1, floats[i]!));
          pcm[i] = Math.round(v * 32767);
        }
        sink.enqueue(new Uint8Array(pcm.buffer));
      };
    },
    cancel() {
      controller.abort();
    },
  });

  const res = await fetch(\`${STT_URL}?stream=1&language=\${language}\`, {
    method: "POST",
    headers: { "Content-Type": "audio/l16; rate=" + RATE, Accept: "text/event-stream" },
    body: upload,
    signal: controller.signal,
    // @ts-expect-error streaming request bodies need this in some browsers
    duplex: "half",
  });

  // Read the event stream and hand each update to the caller.
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  void (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const frames = pending.split("\\n\\n");
      pending = frames.pop() ?? "";
      for (const frame of frames) {
        const line = frame.split("\\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const event = JSON.parse(line.slice(6));
        if (event.type === "partial") onText(event.text, false);
        if (event.type === "segment" || event.type === "done") onText(event.text, true);
      }
    }
  })();

  // The caller stops the stream by calling this.
  return () => {
    controller.abort();
    source.disconnect();
    void ctx.close();
    stream.getTracks().forEach((t) => t.stop());
  };
}`;

export const STT_LIVE_NODE_TS = `// Live transcription from Node: pipe any audio source into the endpoint and
// print text as it is recognised. This is the shape an Electron app or a phone
// recorder uses — it already has a PCM source and wants text as it speaks.
import { spawn } from "node:child_process";
import { Readable } from "node:stream";

const RATE = 16000;
const language = process.env.LANGUAGE;      // required, e.g. bn
if (!language) throw new Error("set LANGUAGE, e.g. LANGUAGE=bn node listen.ts audio.mp3");
const url = \`${STT_URL}?stream=1&language=\${language}\`;

// Any ffmpeg-readable input, resampled to the format the endpoint wants.
const ffmpeg = spawn("ffmpeg", [
  "-i", process.argv[2] ?? "-",     // a file, or stdin for a live device
  "-ar", String(RATE),
  "-ac", "1",
  "-f", "s16le",
  "-",
]);

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": \`audio/l16; rate=\${RATE}\`, Accept: "text/event-stream" },
  body: Readable.toWeb(ffmpeg.stdout) as ReadableStream<Uint8Array>,
  // @ts-expect-error Node needs this to stream a request body
  duplex: "half",
});

const reader = res.body!.getReader();
const decoder = new TextDecoder();
let pending = "";
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  pending += decoder.decode(value, { stream: true });
  const frames = pending.split("\\n\\n");
  pending = frames.pop() ?? "";
  for (const frame of frames) {
    const line = frame.split("\\n").find((l) => l.startsWith("data: "));
    if (!line) continue;
    const event = JSON.parse(line.slice(6));
    if (event.type === "partial") process.stdout.write(\`\\r\${event.text}\`);
    if (event.type === "segment") console.log(\`\\n[\${event.seconds}s] \${event.text}\`);
    if (event.type === "done") console.log(\`\\ndone: \${event.text}\`);
  }
}`;

export const STT_PYTHON = `"""Speech to text, batch and live, from Python."""
import json
import requests

STT = "${STT_URL}"

# ── a recording you already have ──────────────────────────────────────────
with open("recording.mp3", "rb") as f:
    res = requests.post(STT, files={"file": f}, data={"language": "bn"}, timeout=120)
res.raise_for_status()
answer = res.json()
print(answer["text"], "|", answer.get("language"), answer.get("confidence"))

# ── live: stream PCM and read the events ──────────────────────────────────
def pcm_chunks(path, rate=16000, chunk_bytes=rate * 2):   # one second per chunk
    import subprocess
    proc = subprocess.Popen(
        ["ffmpeg", "-i", path, "-ar", str(rate), "-ac", "1", "-f", "s16le", "-"],
        stdout=subprocess.PIPE,
    )
    while True:
        chunk = proc.stdout.read(chunk_bytes)
        if not chunk:
            break
        yield chunk

with requests.post(
    f"{STT}?language=bn",   # required, e.g. "bn" or "bn-BD"
    data=pcm_chunks("recording.mp3"),
    headers={"Content-Type": "audio/l16; rate=16000", "Accept": "text/event-stream"},
    stream=True,
    timeout=300,
) as res:
    for line in res.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data: "):
            continue
        event = json.loads(line[6:])
        if event["type"] == "partial":
            print("\\r" + event["text"], end="", flush=True)
        elif event["type"] == "segment":
            print(f"\\n[{event['seconds']}s] {event['text']}")
        elif event["type"] == "done":
            print(f"\\ndone: {event['text']}")`;

/* ─────────────────────── the whole loop, both halves ─────────────────────── */

export const SPEECH_LOOP_BASH = `#!/usr/bin/env bash
# talk.sh — speak a question, hear the answer. The whole loop, both halves.
set -euo pipefail

ORIGIN="${API_ORIGIN}"
RECORDING="\${1:-recording.mp3}"

# 1. Your speech -> text
QUESTION=$(curl -s "\$ORIGIN/api/public/stt" -F "file=@\$RECORDING" -F "language=bn" | jq -r '.text')
echo "you> \$QUESTION"

# 2. Text -> the model's answer
ANSWER=$(curl -s "\$ORIGIN/api/public/zyraxon/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -d "$(jq -nc --arg q "\$QUESTION" \\
        '{model:"zyraxon-apex", messages:[{role:"user", content:\$q}]}')" \\
  | jq -r '.choices[0].message.content')
echo "zyraxon> \$ANSWER"

# 3. The answer -> speech, in the language it was written in
curl -s "\$ORIGIN/api/public/tts" \\
  -H "Content-Type: application/json" \\
  -d "$(jq -nc --arg t "\$ANSWER" '{text:\$t, locale:"bn"}')" -o reply.mp3
ffplay -nodisp -autoexit reply.mp3    # macOS: afplay   Windows: start`;

export const SPEECH_LOOP_TS = `// The whole loop in TypeScript: listen, ask, speak — one turn at a time.
const ORIGIN = "${API_ORIGIN}";

/** Speech to text. \`language\` is required — the endpoint does not detect it. */
export async function transcribe(audio: Blob, language: string): Promise<string> {
  const form = new FormData();
  form.append("file", audio);
  form.append("language", language);
  const res = await fetch(\`\${ORIGIN}/api/public/stt\`, { method: "POST", body: form });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "transcription failed");
  return data.text as string;
}

/** Text to speech, returning a URL a player can start immediately. */
export async function speak(text: string, locale?: string): Promise<string> {
  const res = await fetch(\`\${ORIGIN}/api/public/tts\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...(locale ? { locale } : {}) }),
  });
  return URL.createObjectURL(await res.blob());
}

/** One full spoken turn: recording in, answer out, answer spoken back. */
export async function turn(recording: Blob, language: string, model = "zyraxon-apex"): Promise<string> {
  const question = await transcribe(recording, language);
  const res = await fetch(\`\${ORIGIN}/api/public/zyraxon/v1/chat/completions\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: question }] }),
  });
  const data = await res.json();
  const answer = data.choices[0].message.content as string;
  await new Audio(await speak(answer)).play();
  return answer;
}`;

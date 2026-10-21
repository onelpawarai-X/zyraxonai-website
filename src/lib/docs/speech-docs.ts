/** Speech documentation: listening to an answer, and speaking to the model.
 *
 *  Kept out of `content.ts` for the same reason the provider docs are — this is
 *  a surface that grows on its own. The shape is the shared `DocPage`, so it
 *  gains the sidebar, search and prev/next for free. */
import type { DocPage } from "./content";
import { API_ORIGIN } from "@/lib/providers/integrations";

const TTS = `${API_ORIGIN}/api/public/tts`;
const VOICES = `${API_ORIGIN}/api/public/tts/voices`;
const STT = `${API_ORIGIN}/api/public/stt`;

export const SPEECH_DOCS: DocPage[] = [
  {
    slug: "speech",
    title: "Speech: Listening and Speaking",
    group: "ZYRAXON Provider",
    desc: "Hear any answer aloud in its own language, and speak to the model. 322 neural voices across 75 languages, streamed as MP3 as it is written.",
    blocks: [
      {
        t: "p",
        text: "Every answer the ZYRAXON provider produces can be **heard**, not just read — and in the language the answer was written in. Ask in Bengali, and a Bengali voice reads the reply. This is the speech-to-speech loop: your speech in, the model's answer out, both in the same language.",
      },
      {
        t: "note",
        kind: "success",
        title: "The whole feature is three endpoints",
        text: `**Listen:** \`POST ${TTS}\` — send text, get streamed MP3.\n**Voices:** \`GET ${VOICES}\` — 322 voices across 75 languages.\n**Speak:** \`POST ${STT}\` — send a recording, or stream audio live, and get the transcript.`,
      },
      { t: "h2", text: "Hear an answer" },
      {
        t: "p",
        text: "Send the answer's text and the audio starts arriving before the sentence is finished being synthesised, so a client can begin playing almost immediately rather than waiting for a whole file.",
      },
      {
        t: "code",
        lang: "bash",
        code: `curl -s ${TTS} \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Hello from ZYRAXON.","locale":"en"}' \\
  -o answer.mp3

# Play it
ffplay -nodisp -autoexit answer.mp3    # macOS: afplay   Windows: start`,
      },
      { t: "h2", text: "The same in any language" },
      {
        t: "p",
        text: "Name the language and the voice follows. A Bengali answer is read by a Bengali voice — `bn-BD-NabanitaNeural` — not by an English one reading Bengali letters.",
      },
      {
        t: "code",
        lang: "bash",
        code: `# Bengali
curl -s ${TTS} -H "Content-Type: application/json" \\
  -d '{"text":"আমি একটি ZYRAXON মডেল।","locale":"bn"}' -o bn.mp3

# Hindi, naming the voice exactly
curl -s ${TTS} -H "Content-Type: application/json" \\
  -d '{"text":"नमस्ते","voice":"hi-IN-SwaraNeural"}' -o hi.mp3

# Arabic
curl -s ${TTS} -H "Content-Type: application/json" \\
  -d '{"text":"مرحبا","locale":"ar"}' -o ar.mp3`,
      },
      {
        t: "table",
        head: ["Field", "Required", "What it does"],
        rows: [
          ["`text`", "Yes", "What to speak. Up to 5000 characters."],
          ["`voice`", "No", "An exact voice name from the voices list. Wins over `locale`."],
          [
            "`locale`",
            "No",
            "A language or region, e.g. `bn`, `bn-IN`, `en-US`. Picks a voice in that language.",
          ],
        ],
      },
      {
        t: "note",
        kind: "success",
        title: "The language is detected — you do not have to send it",
        text: "The endpoint reads the script of the text you send and picks a voice for it. Bengali text is read by a Bengali voice, Devanagari by a Hindi one, Arabic by an Arabic one, and Latin script falls back to English. This is what makes a Bengali answer audible: an English voice reading Bengali does not pronounce the letters at all. Send `locale` only when you want to override the detection.",
      },
      { t: "h2", text: "Speaking in real time" },
      {
        t: "p",
        text: "For a live conversation the audio must start before the answer is finished. Synthesising the whole reply first means seconds of silence. The pattern is to **split the answer into sentences and speak each one as it is ready**, queued in order so nothing is reordered.",
      },
      {
        t: "code",
        lang: "typescript",
        code: `// Speak an answer while it is still being written.
// A reply arrives token by token; feed the growing text and speak each
// completed sentence as it appears. The first sentence is heard while the
// model is still writing the second.
const queue: string[] = [];
let buffer = "";
let speaking = false;

async function speak(text: string) {
  const res = await fetch("${TTS}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),   // the locale is detected from the text
  });
  const audio = new Audio(URL.createObjectURL(await res.blob()));
  await new Promise<void>((done) => {
    audio.onended = () => done();
    audio.onerror = () => done();
    audio.play();
  });
}

async function pump() {
  if (speaking) return;
  speaking = true;
  while (queue.length) await speak(queue.shift()!);
  speaking = false;
}

// Call this on every streamed token.
function feed(chunk: string) {
  buffer += chunk;
  // Cut after each sentence terminator, including the Bengali danda.
  let at = -1;
  for (let i = 0; i < buffer.length; i++) if (/[.!?।॥]/.test(buffer[i]!)) at = i;
  if (at >= 0) {
    queue.push(buffer.slice(0, at + 1).trim());
    buffer = buffer.slice(at + 1).trimStart();
    void pump();
  }
}

// When the answer ends, speak whatever is left.
function finish() {
  if (buffer.trim()) queue.push(buffer.trim());
  buffer = "";
  void pump();
}`,
      },
      {
        t: "note",
        kind: "info",
        title: "How fast is a sentence",
        text: "A short sentence comes back in well under a second from this endpoint, which is what makes sentence-by-sentence playback feel like speech rather than a recording starting late.",
      },
      { t: "h2", text: "Which voices exist" },
      {
        t: "code",
        lang: "bash",
        code: `curl -s ${VOICES} | jq '{count, languages: (.languages|length)}'
# {"count": 322, "languages": 75}

# Every Bengali voice
curl -s ${VOICES} | jq -r '.data[] | select(.locale | startswith("bn")) | .name'
# bn-BD-NabanitaNeural
# bn-BD-PradeepNeural
# bn-IN-BashkarNeural
# bn-IN-TanishaaNeural`,
      },
      { t: "h2", text: "Play it in a browser, as it streams" },
      {
        t: "code",
        lang: "typescript",
        code: `// The endpoint streams MP3, so playback can start before synthesis finishes.
const res = await fetch("${TTS}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: answer, locale: "bn" }),
});

const audio = new Audio(URL.createObjectURL(await res.blob()));
await audio.play();`,
      },
      { t: "h2", text: "Speak to the model" },
      {
        t: "p",
        text: "Record on the device, transcribe it, then send the transcript as an ordinary chat turn. That is the input half of the loop.",
      },
      {
        t: "note",
        kind: "warn",
        title: "You must say which language is being spoken",
        text: "`language` is required, in both the recording and the live mode. The recogniser does not detect language — asked for English about Bengali audio it returns English-sounding words at high confidence instead of failing — so a guess is a confident wrong answer. The caller knows the language; the endpoint asks rather than assumes.",
      },
      {
        t: "code",
        lang: "bash",
        code: `TEXT=$(curl -s ${STT} -F "file=@recording.mp3" -F "language=bn" | jq -r '.text')

curl -s ${API_ORIGIN}/api/public/zyraxon/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d "{\\"model\\":\\"zyraxon-codex\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"$TEXT\\"}]}" \\
| jq -r '.choices[0].message.content'`,
      },
      { t: "h2", text: "Hear it while it is being said" },
      {
        t: "p",
        text: "The same endpoint transcribes **as you speak**. Send raw PCM and the response is a stream of server-sent events: a partial that grows word by word, and a committed segment every few seconds. The request picks the mode — an `Accept: text/event-stream` header, `?stream=1`, or a raw PCM content type.",
      },
      {
        t: "code",
        lang: "bash",
        code: `# Live, from any audio source. One second of 16 kHz mono PCM is 32000 bytes.
ffmpeg -i recording.mp3 -ar 16000 -ac 1 -f s16le - \\
| curl -sN -X POST "${STT}?stream=1&language=bn" \\
    -H "Content-Type: audio/l16; rate=16000" \\
    -H "Accept: text/event-stream" \\
    --data-binary @-

# event: ready     {"rate":16000,"language":"bn-BD"}
# event: partial   {"text":"আজ আকাশ"}
# event: partial   {"text":"আজ আকাশ পরিষ্কার"}
# event: segment   {"text":"আজ আকাশ পরিষ্কার এবং সূর্য উজ্জ্বল।","seconds":4.2}
# event: done      {"text":"...","segments":2,"seconds":8.1}`,
      },
      {
        t: "table",
        head: ["Event", "When", "What it holds"],
        rows: [
          ["`ready`", "Immediately", "The rate it is reading, and the language you asked for."],
          [
            "`partial`",
            "About every 1.2 seconds",
            "The transcript so far, growing. Replace the last line with it.",
          ],
          ["`segment`", "Every 4 seconds", "Text committed so far. This part never changes again."],
          [
            "`done`",
            "When the audio ends",
            "The whole transcript, how many chunks, and how long it heard.",
          ],
        ],
      },
      {
        t: "note",
        kind: "info",
        title: "Why live mode takes PCM and not a recording",
        text: "A WebM or Opus frame has to be decoded as a whole unit, so a compressed stream cannot be cut at an arbitrary moment without corrupting the audio. Raw PCM samples can be split anywhere, which is what lets the endpoint commit a segment mid-sentence. A browser produces PCM directly from an `AudioWorklet`, so this costs the client nothing.",
      },
      {
        t: "note",
        kind: "tip",
        title: "A word on the boundary is not lost",
        text: "When a segment closes, the last fraction of a second carries into the next one, so a word straddling the cut is heard whole rather than clipped in half. Committed text is never rewritten, so a display only ever grows.",
      },
      { t: "h2", text: "A complete spoken conversation" },
      {
        t: "p",
        text: "Transcribe the recording, ask the model, then speak the answer back. This is the whole loop in one script.",
      },
      {
        t: "code",
        lang: "bash",
        code: `#!/usr/bin/env bash
# talk.sh — speak a question, hear the answer.
set -euo pipefail

ORIGIN="https://zyraxonai.lovable.app"
# language is required — the recogniser does not detect it.
QUESTION=$(curl -s "\${ORIGIN}/api/public/stt" -F "file=@$1" -F "language=bn" | jq -r '.text')
echo "You said: $QUESTION"

ANSWER=$(curl -s "\${ORIGIN}/api/public/zyraxon/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -d "$(jq -nc --arg q "$QUESTION" \\
        '{model:"zyraxon-apex", messages:[{role:"user", content:$q}]}')" \\
  | jq -r '.choices[0].message.content')
echo "ZYRAXON: $ANSWER"

# Speak the answer in the language the question was asked in.
curl -s "\${ORIGIN}/api/public/tts" \\
  -H "Content-Type: application/json" \\
  -d "$(jq -nc --arg t "$ANSWER" '{text:$t, locale:"bn"}')" -o reply.mp3
ffplay -nodisp -autoexit reply.mp3`,
      },
      { t: "h2", text: "What gets spoken" },
      {
        t: "p",
        text: "The endpoint speaks what a person would say, not the raw Markdown. A reply containing a code block is not read character by character — that would be unusable — so a fence becomes a short spoken note, links become their label, and the punctuation goes.",
      },
      {
        t: "table",
        head: ["In the answer", "What is spoken"],
        rows: [
          ["A fenced code block", "“A code block, 12 lines.”"],
          ["`[the docs](/docs/getting-started)`", "“the docs”"],
          ["A bare URL", "“a link”"],
          ["`**important**`", "“important”"],
          ["`## Heading`", "“Heading”"],
        ],
      },
      {
        t: "note",
        kind: "warn",
        title: "Speech is opt-in",
        text: "Nothing is spoken unless a client asks for it. The site's own helper shows a **Listen** button on each answer and stays silent until it is pressed.",
      },
      { t: "h2", text: "Which engine, and why it matters" },
      {
        t: "p",
        text: "Synthesis runs on Microsoft Edge's Read Aloud engine — the same one behind the browser feature — through the same protocol. That is what gives 322 neural voices in 75 languages with no key to buy and no per-character bill. Audio is MP3 at 24 kHz mono.",
      },
      {
        t: "p",
        text: "Recognition runs on the speech service the Chromium browser uses, reached with its published client key — the same arrangement, on the other side of the conversation. It takes raw PCM and FLAC, and it does not detect language, which is why `language` is required rather than guessed.",
      },
      {
        t: "note",
        kind: "info",
        title: "Neither engine is hard-wired in",
        text: "Both are written as interchangeable backends behind one function (`src/lib/stt/engine.ts` for recognition, `src/lib/tts/edge-speech.server.ts` for synthesis). If either service changes its contract, a second backend is added beside the first and the fallback order changes — no caller is touched, and nothing needs to be rewritten.",
      },
      {
        t: "note",
        kind: "info",
        title: "What you receive",
        text: "`Content-Type: audio/mpeg`, plus `X-ZYRAXON-Voice` naming the voice that actually spoke, so a client can show which language it chose.",
      },
      { t: "h2", text: "Errors" },
      {
        t: "table",
        head: ["Status", "Means", "What to do"],
        rows: [
          [
            "`400`",
            "`text` is missing, or nothing remained after markup was removed.",
            "Send the answer's text.",
          ],
          ["`413`", "The text is over 5000 characters.", "Split it and speak it in parts."],
          [
            "`422`",
            "`language` was not sent to `/api/public/stt`.",
            "Send it, e.g. `bn`. The endpoint does not detect language.",
          ],
          ["`502`", "The speech engine refused the connection.", "Retry; it is usually transient."],
        ],
      },
    ],
  },
];

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
        text: `**Listen:** \`POST ${TTS}\` — send text, get streamed MP3.\n**Voices:** \`GET ${VOICES}\` — 322 voices across 75 languages.\n**Speak:** \`POST ${STT}\` — send a recording, get the transcript.`,
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
        t: "code",
        lang: "bash",
        code: `TEXT=$(curl -s ${STT} -F "file=@recording.mp3" -F "language=bn" | jq -r '.text')

curl -s ${API_ORIGIN}/api/public/zyraxon/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d "{\\"model\\":\\"zyraxon-codex\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"$TEXT\\"}]}" \\
| jq -r '.choices[0].message.content'`,
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
          ["`502`", "The speech engine refused the connection.", "Retry; it is usually transient."],
        ],
      },
    ],
  },
];

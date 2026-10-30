/** One large document per provider system.
 *
 *  The provider guide in `provider-docs.ts` is written as a tour: it walks a
 *  reader through the line, the media rules and the routing. These are the
 *  references it links out to — one per system, each written to stand alone so
 *  a reader who lands on one has the whole system in front of them and does not
 *  have to reassemble it from the tour.
 *
 *  Kept in its own file because a reference that grows on its own should not
 *  make the tour's file grow with it. The shape is the shared `DocPage`, so
 *  these gain the sidebar, search and prev/next for free. */
import type { DocPage } from "./content";
import { API_ORIGIN } from "@/lib/providers/integrations";

const V1 = `${API_ORIGIN}/api/public/zyraxon/v1`;
const STT = `${API_ORIGIN}/api/public/stt`;
const TTS = `${API_ORIGIN}/api/public/tts`;
const VOICES = `${API_ORIGIN}/api/public/tts/voices`;
const CHAT = `${V1}/chat/completions`;

export const PROVIDER_SYSTEM_DOCS: DocPage[] = [
  /* ─────────────────────────── speech to text ──────────────────────── */
  {
    slug: "provider-speech-to-text",
    title: "Speech to Text",
    group: "ZYRAXON Provider",
    desc: "One endpoint that turns a recording into a transcript, or a live microphone into text as the person is still speaking. Every container, both modes, and what to do when a file is huge.",
    blocks: [
      {
        t: "p",
        text: "If you are putting a **microphone** in your chat box, this is the endpoint you use. You send audio — a file you already have, or a stream while the person is still talking — and you get **text** back. One URL serves both: `POST /api/public/stt`.",
      },
      {
        t: "note",
        kind: "success",
        title: "The whole endpoint in four lines",
        text: `**Batch:** send a recording, get one transcript.\n**Live:** send raw PCM, get server-sent events — partial text as they speak, then a committed segment, then a final transcript.\n**Language is required:** \`language=bn\` or \`bn-BD\`. The recogniser does not detect it.\n**No key:** the endpoint is public.`,
      },
      { t: "h2", text: "Which mode am I in?" },
      {
        t: "p",
        text: "The request picks the mode; there is no second URL and no second client. If you have a finished file — a voice note, a call recording, a podcast — you are in **batch** mode. If you have a live microphone and want words on screen while the person is still speaking, you are in **live** mode.",
      },
      {
        t: "table",
        head: ["You have", "Mode", "How the request says so"],
        rows: [
          [
            "A file, a URL, or base64 bytes",
            "**Batch**",
            "`multipart/form-data` with a `file`, JSON with `audio`, or JSON with `url`. No streaming headers.",
          ],
          [
            "A live microphone",
            "**Live**",
            "Raw PCM in the body plus `Accept: text/event-stream`, `?stream=1`, or a raw PCM `Content-Type`.",
          ],
        ],
      },
      { t: "h2", text: "Batch: a recording you already have" },
      {
        t: "p",
        text: "Three shapes reach the same recogniser, so a browser, a server and a webhook can each send what they already have. The container is sniffed from the bytes, not from the `Content-Type`, so a mislabelled file still works.",
      },
      {
        t: "code",
        lang: "bash",
        code: `# 1. Upload the bytes — the ordinary way from a form or a file picker.
curl -s ${STT} \\
  -F "file=@recording.mp3" \\
  -F "language=bn" | jq -r '.text'

# 2. Base64 in JSON — for a client that only speaks JSON.
curl -s ${STT} \\
  -H "Content-Type: application/json" \\
  -d '{"audio":"'"$(base64 -w0 recording.mp3)"'","language":"bn"}' | jq -r '.text'

# 3. A URL the server fetches for you — no upload, no base64 inflation.
curl -s ${STT} \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com/recording.mp3","language":"bn"}' | jq -r '.text'`,
      },
      {
        t: "note",
        kind: "info",
        title: "A URL is a first-class input, not a convenience",
        text: "When you send `url`, the server downloads the audio itself, under the same size ceiling as an upload. This is what makes the endpoint usable from a webhook or a chat platform that hands you a link rather than a file, and it keeps a large recording out of your request body.",
      },
      {
        t: "h3",
        text: "What batch mode returns",
      },
      {
        t: "code",
        lang: "json",
        code: `{
  "success": true,
  "text": "আজ আকাশ পরিষ্কার এবং সূর্য উজ্জ্বল।",
  "language": "bn",
  "locale": "bn-BD",
  "confidence": 0.94,
  "engine": "chromium",
  "container": "mp3",
  "duration": 8.1,
  "elapsed": 1.96,
  "truncated": false
}`,
      },
      {
        t: "table",
        head: ["Field", "What it means"],
        rows: [
          ["`text`", "The transcript. The only field most callers read."],
          ["`language` / `locale`", "The language you asked for, and the locale it resolved to."],
          ["`confidence`", "The recogniser's own confidence, 0–1."],
          ["`engine`", "Which recognition backend answered. Informational."],
          ["`container`", "The format it sniffed from the bytes — `mp3`, `wav`, `ogg`, `flac`, `webm`, `pcm`."],
          ["`duration`", "How many seconds of audio it heard. Useful to check against the file you sent."],
          ["`elapsed`", "How long the transcription took, in seconds."],
          [
            "`truncated`",
            "`true` when the time budget ran out before the whole recording was transcribed. See *Very large recordings* below.",
          ],
        ],
      },
      { t: "h2", text: "Containers it accepts" },
      {
        t: "p",
        text: "The format is read from the first bytes of the file. A file named `.mp3` that is really a WAV is transcribed as a WAV, and a file with no extension works as long as its bytes are one of these.",
      },
      {
        t: "table",
        head: ["Container", "Notes"],
        rows: [
          ["WAV", "Any sample rate, any channel count. Downmixed and resampled server-side."],
          ["MP3", "The safest choice for a voice note or a call recording."],
          ["FLAC", "Decoded like any other container. The declared rate is read from the file, not assumed."],
          ["OGG", "Vorbis and Opus in an Ogg wrapper."],
          ["WebM", "The container a browser's `MediaRecorder` produces."],
          ["Raw PCM", "16-bit little-endian samples with no header. Send the rate in the query or a header."],
          [
            "M4A / AAC",
            "**Refused with a 400.** An `.m4a` is an MP4 container, and the recogniser does not unpack MP4. Convert it to WAV or MP3 first — see *Converting an iPhone recording* below.",
          ],
        ],
      },
      {
        t: "note",
        kind: "warn",
        title: "M4A from an iPhone is refused, not silently emptied",
        text: "An `.m4a` recorded on an iPhone or in Safari is an MP4 container. Earlier it fell through to the raw-PCM path, was read as samples, produced no speech, and came back as an empty transcript that looked exactly like \"nobody spoke\". Now it is rejected with a 400, so the failure is visible instead of silent.",
      },
      {
        t: "h3",
        text: "Converting an iPhone recording",
      },
      {
        t: "code",
        lang: "bash",
        code: `# .m4a -> .wav, keeping the sample rate. One command, no quality loss.
ffmpeg -i memo.m4a -ac 1 -ar 16000 memo.wav
curl -s ${STT} -F "file=@memo.wav" -F "language=en" | jq -r '.text'

# Or straight to MP3, which is smaller to upload.
ffmpeg -i memo.m4a -ac 1 -ar 16000 -b:a 64k memo.mp3`,
      },
      { t: "h2", text: "Live: words as they are spoken" },
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
        t: "h3",
        text: "Pacing a microphone",
      },
      {
        t: "p",
        text: "A client paces itself by bytes, not by wall-clock time. At 16 kHz, one second of 16-bit mono PCM is exactly 32 000 bytes, so a client that writes 32 000 bytes per second is in real time. Sending faster does not make recognition faster; sending slower introduces gaps the recogniser hears as silence.",
      },
      {
        t: "table",
        head: ["Sample rate", "Bytes per second (16-bit mono)"],
        rows: [
          ["8000 Hz", "16 000"],
          ["16000 Hz", "32 000"],
          ["22050 Hz", "44 100"],
          ["44100 Hz", "88 200"],
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
      { t: "h2", text: "A complete browser microphone, end to end" },
      {
        t: "p",
        text: "This is the whole live client. It captures from the microphone, converts to 16-bit mono PCM at 16 kHz, and prints partial and committed text as they arrive. Nothing else is needed to put a working microphone in a chat box.",
      },
      {
        t: "code",
        lang: "typescript",
        code: `// Live transcription from a browser microphone.
const STT = "${STT}";

async function start(language: string, onText: (text: string, done: boolean) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Ask the browser for the rate the endpoint wants, so no resampling is needed.
  const ctx = new AudioContext({ sampleRate: 16000 });
  const source = ctx.createMediaStreamSource(stream);

  // An AudioWorklet hands us raw frames; a ScriptProcessor would work too but
  // is deprecated. Either way the goal is the same: 16-bit mono samples.
  const worklet = await ctx.audioWorklet.addModule("/pcm-worklet.js");
  const node = new AudioWorkletNode(ctx, "pcm-worklet");
  source.connect(node);

  const res = await fetch(\`\${STT}?stream=1&language=\${language}\`, {
    method: "POST",
    headers: {
      "Content-Type": "audio/l16; rate=16000",
      Accept: "text/event-stream",
    },
    body: new ReadableStream({
      start(controller) {
        node.port.onmessage = (e) => controller.enqueue(new Uint8Array(e.data));
      },
      cancel() {
        node.disconnect();
        ctx.close();
      },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  // Parse the SSE frames: a blank line ends one event.
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\\n\\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.split("\\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const ev = JSON.parse(line.slice(5).trim());
      if (ev.type === "partial") onText(ev.text, false);
      if (ev.type === "segment") onText(ev.text, true);
      if (ev.type === "done") onText(ev.text, true);
    }
  }
}`,
      },
      {
        t: "note",
        kind: "info",
        title: "The worklet is five lines",
        text: "An `AudioWorkletProcessor` that forwards each input block as an `Int16Array` is all the client-side DSP this needs — no encoder, no library. The endpoint accepts 32-bit float too, but 16-bit halves the bytes on the wire with no effect on recognition.",
      },
      { t: "h2", text: "Very large recordings" },
      {
        t: "p",
        text: "A recording of an hour is a normal thing to transcribe, and the endpoint is built for it. Uploads are accepted up to **100 MB**, and a file that large does not have to fit in memory at once.",
      },
      {
        t: "note",
        kind: "success",
        title: "A 100 MB WAV and an hour-long MP3 both come back 200",
        text: "Past 8 MB the recording is decoded **window by window** instead of being held whole: about 30 seconds of audio is decoded, transcribed and released before the next window is read. Peak memory is a function of the window length, not the recording's, which is what lets an hour-long file succeed where a whole-file decode would exhaust the runtime.",
      },
      {
        t: "table",
        head: ["Size", "What happens"],
        rows: [
          [
            "Up to 8 MB",
            "Whole-file decode. Cheaper for a short clip, and the windowing overhead is not worth paying.",
          ],
          [
            "8 MB – 100 MB",
            "Streamed window by window. Peak memory tracks the ~30 s window, not the file.",
          ],
          ["Over 100 MB", "`413`, with the byte count and the limit in the message."],
        ],
      },
      {
        t: "h3",
        text: "Windows are joined in order, not in the order they finish",
      },
      {
        t: "p",
        text: "Several windows are transcribed at once, so they finish out of order. Each is written into its own slot by index and the transcript is joined in index order — never in completion order. The practical effect is that the transcript reads as one continuous piece, in the order the person spoke.",
      },
      {
        t: "note",
        kind: "warn",
        title: "The time budget, and `truncated`",
        text: "Transcription stops at a wall-clock budget of two minutes and returns what it has, with `truncated: true`. That is not an error and not a dropped connection — it is the endpoint choosing to answer with a partial transcript rather than hold the connection open indefinitely. When you see it, the transcript is real and in order; it simply covers the start of the recording. Split the recording and transcribe the parts if you need all of it.",
      },
      { t: "h2", text: "Language is required, and why" },
      {
        t: "p",
        text: "`language` is required in both modes. This is deliberate, and it is the one thing about this endpoint that surprises people.",
      },
      {
        t: "note",
        kind: "warn",
        title: "The recogniser does not detect language",
        text: "Asked for English about Bengali audio it returns English-sounding words at high confidence rather than failing, so a guess produces a **confident wrong answer** — the worst kind of failure, because nothing in the response tells you it is wrong. The caller knows which language is being spoken; the endpoint asks rather than assumes.",
      },
      {
        t: "code",
        lang: "bash",
        code: `# Bengali, with the region
curl -s ${STT} -F "file=@recording.mp3" -F "language=bn-BD" | jq -r '.text'

# Hindi
curl -s ${STT} -F "file=@recording.mp3" -F "language=hi" | jq -r '.text'

# The live mode takes it the same way, in the query string.
curl -sN -X POST "${STT}?stream=1&language=bn" --data-binary @audio.pcm`,
      },
      {
        t: "note",
        kind: "info",
        title: "Why it was removed",
        text: "Auto-detection existed and was deleted. It guessed from a few seconds of audio, and when it guessed wrong the transcript was in the wrong language with no indication — a caller could not tell a bad recording from a bad guess. Requiring the language makes the failure mode a missing field, which a client sees immediately, instead of a wrong transcript, which it does not.",
      },
      { t: "h2", text: "Errors" },
      {
        t: "table",
        head: ["Status", "Means", "What to do"],
        rows: [
          ["`400`", "The container is MP4/AAC, or no audio was found in the request.", "Convert to WAV or MP3, or check the field name."],
          ["`413`", "The upload is over 100 MB.", "Split the recording, or send a URL instead of the bytes."],
          ["`415`", "The audio is present but the format is refused.", "Re-encode to WAV, MP3, FLAC, OGG or WebM."],
          [
            "`422`",
            "`language` was not sent.",
            "Send it — `bn`, `bn-BD`, `en`, `hi`. The endpoint does not detect language.",
          ],
          ["`502`", "The recogniser refused the connection.", "Retry; it is usually transient."],
        ],
      },
      { t: "h2", text: "Which engine answers" },
      {
        t: "p",
        text: "Recognition runs on the speech service the Chromium browser uses, reached with its published client key. It takes raw PCM and FLAC, and it does not detect language. The engine is reported in the `engine` field so a caller can tell which backend produced a transcript.",
      },
      {
        t: "note",
        kind: "info",
        title: "The engine is not hard-wired in",
        text: "It is written as an interchangeable backend behind one function (`src/lib/stt/engine.ts`). If the service changes its contract, a second backend is added beside the first and the fallback order changes — no caller is touched, and nothing needs to be rewritten.",
      },
      { t: "h2", text: "The machine-readable contract" },
      {
        t: "p",
        text: "A `GET` on the same URL returns the contract as JSON, including the accepted containers, the limits and the response fields — so a coding assistant handed the URL can read it without a human explaining it.",
      },
      {
        t: "code",
        lang: "bash",
        code: `curl -s ${STT} | jq '{containers, limits, longAudio}'`,
      },
    ],
  },

  /* ─────────────────────────── text to speech ──────────────────────── */
  {
    slug: "provider-text-to-speech",
    title: "Text to Speech",
    group: "ZYRAXON Provider",
    desc: "Send text, get audio. 322 neural voices across 75 languages, streamed as MP3 as it is synthesised, with the voice following the language of the text.",
    blocks: [
      {
        t: "p",
        text: "If you send us **text**, we send you **audio** back. `POST /api/public/tts` turns an answer into speech and streams the MP3 as it is synthesised, in the language of the text — so a Bengali answer is read by a Bengali voice rather than by an English one sounding out Bengali letters.",
      },
      {
        t: "note",
        kind: "success",
        title: "The whole feature in three lines",
        text: `**Speak:** \`POST ${TTS}\` — send text, get streamed MP3.\n**Voices:** \`GET ${VOICES}\` — 322 voices across 75 languages.\n**No key:** both are public.`,
      },
      { t: "h2", text: "The simplest call there is" },
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
      {
        t: "p",
        text: "The audio starts arriving before the sentence is finished being synthesised, so a client can begin playing almost immediately rather than waiting for a whole file. The response is `Content-Type: audio/mpeg`, with `X-ZYRAXON-Voice` naming the voice that actually spoke.",
      },
      { t: "h2", text: "The voice follows the language" },
      {
        t: "p",
        text: "The endpoint reads the script of the text you send and picks a voice for it. Bengali text is read by a Bengali voice, Devanagari by a Hindi one, Arabic by an Arabic one, and Latin script falls back to English. This is what makes a Bengali answer audible at all: an English voice reading Bengali does not pronounce the letters.",
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
          ["`text`", "Yes", "What to speak. Up to 50,000 characters. Markdown is stripped first, then the text is streamed sentence by sentence."],
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
        kind: "tip",
        title: "Naming `voice` also skips a lookup",
        text: "An exact `voice` skips the voice-catalogue search, so the first byte of audio arrives sooner. It is worth doing in a loop where the language never changes.",
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
# bn-IN-TanishaaNeural

# Every language the catalogue covers
curl -s ${VOICES} | jq -r '.locales[]' | sort -u | head -20`,
      },
      {
        t: "note",
        kind: "info",
        title: "Read the catalogue once, then cache it",
        text: "The voice list changes rarely, so a client that offers a picker should fetch it once and keep it. Matching a voice to the language an answer came back in is the whole reason to read it.",
      },
      { t: "h2", text: "Speaking a streaming answer" },
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
const TTS = "${TTS}";

const queue: string[] = [];
let buffer = "";
let speaking = false;

async function speak(text: string) {
  const res = await fetch(TTS, {
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
      {
        t: "note",
        kind: "warn",
        title: "Include the danda in the split",
        text: "Bengali and Devanagari end a sentence with `।` (U+0964) and sometimes `॥`. A splitter that only looks for `.` will hand the whole paragraph to the endpoint as one sentence and defeat the point of streaming. The sample above includes both.",
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
          ["A fenced code block", "\u201cA code block, 12 lines.\u201d"],
          ["`[the docs](/docs/getting-started)`", "\u201cthe docs\u201d"],
          ["A bare URL", "\u201ca link\u201d"],
          ["`**important**`", "\u201cimportant\u201d"],
          ["`## Heading`", "\u201cHeading\u201d"],
        ],
      },
      { t: "h2", text: "Which engine answers" },
      {
        t: "p",
        text: "Synthesis runs on Microsoft Edge's Read Aloud engine — the same one behind the browser feature — through the same protocol. That is what gives 322 neural voices in 75 languages with no key to buy and no per-character bill. Audio is MP3 at 24 kHz mono.",
      },
      {
        t: "note",
        kind: "info",
        title: "The engine is not hard-wired in",
        text: "It is written as an interchangeable backend behind one function (`src/lib/tts/edge-speech.server.ts`). If the service changes its contract, a second backend is added beside the first and the fallback order changes — no caller is touched.",
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
          ["`413`", "The text is over 50,000 characters.", "Split it and speak it in parts."],
          ["`502`", "The speech engine refused the connection.", "Retry; it is usually transient."],
        ],
      },
    ],
  },

  /* ───────────────────── multimodal chat completions ───────────────── */
  {
    slug: "provider-multimodal",
    title: "Multimodal Chat",
    group: "ZYRAXON Provider",
    desc: "Video, audio, pictures and documents go into the same chat call as text. Every model takes every modality, and a media turn is routed to a model that can actually read it.",
    blocks: [
      {
        t: "p",
        text: "The chat endpoint is not text-only. A message can carry **text, an image, a recording, a video or a document**, in any combination — and every ZYRAXON model accepts every one of them. Send the media, and the turn is routed server-side to a model that can actually read it.",
      },
      {
        t: "note",
        kind: "success",
        title: "One call, every modality",
        text: `\`POST ${CHAT}\` takes the OpenAI content-parts array. Each part is either inline base64 or an \`https://\` URL. A turn that carries media is matched to a model that supports it — a video turn is never handed to a text-only model and made to fail.`,
      },
      { t: "h2", text: "The shape of a multimodal message" },
      {
        t: "p",
        text: "Instead of `content` being a string, it is an array of parts. This is the same shape OpenAI defined, so a client that already sends vision turns to OpenAI sends them here unchanged.",
      },
      {
        t: "code",
        lang: "json",
        code: `{
  "model": "zyraxon-cyber",
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "Transcribe this, then summarise it in one line." },
      { "type": "input_audio",
        "input_audio": { "data": "<base64>", "format": "wav" } },
      { "type": "image_url",
        "image_url": { "url": "data:image/png;base64,..." } },
      { "type": "video_url",
        "video_url": { "url": "https://example.com/clip.mp4" } },
      { "type": "file",
        "file": { "filename": "report.pdf",
                  "file_data": "data:application/pdf;base64,..." } }
    ]
  }]
}`,
      },
      {
        t: "table",
        head: ["Part type", "Field", "What it carries"],
        rows: [
          ["`text`", "`text`", "A plain string. Any number of text parts may be mixed with media."],
          ["`image_url`", "`image_url.url`", "A `data:` URI or an `https://` URL. PNG, JPEG, WebP, GIF."],
          ["`input_audio`", "`input_audio.data` + `.format`", "Base64 audio and its container — `wav`, `mp3`, `flac`, `ogg`, `webm`."],
          ["`video_url`", "`video_url.url`", "A `data:` URI or an `https://` URL. MP4 and WebM."],
          ["`file`", "`file.file_data` + `.filename`", "A `data:` URI of the document, with the name so the model knows what it is."],
        ],
      },
      { t: "h2", text: "Inline or by URL" },
      {
        t: "p",
        text: "Every media part takes either base64 or an `https://` URL. Send a URL and the server fetches it for you, so a large file never has to pass through your request body — which is what keeps a big video from becoming a `413`.",
      },
      {
        t: "code",
        lang: "bash",
        code: `# Inline base64 — fine for a small image.
curl -s ${CHAT} -H "Content-Type: application/json" -d '{
  "model": "zyraxon-matrix",
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "What is in this chart?" },
      { "type": "image_url",
        "image_url": { "url": "data:image/png;base64,'"$(base64 -w0 chart.png)"'" } }
    ]
  }]
}' | jq -r '.choices[0].message.content'

# By URL — the server fetches it. Use this for anything large.
curl -s ${CHAT} -H "Content-Type: application/json" -d '{
  "model": "zyraxon-cyber",
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "Summarise this recording." },
      { "type": "input_audio",
        "input_audio": { "data": "https://example.com/interview.mp3", "format": "mp3" } }
    ]
  }]
}' | jq -r '.choices[0].message.content'`,
      },
      {
        t: "note",
        kind: "info",
        title: "URLs are fetched server-side, so the model always gets bytes",
        text: "A URL is not passed to the model as a link to click — the server downloads it first and hands over the bytes. That is why a URL works for a model that cannot browse, and why the same size ceiling applies as for an inline upload.",
      },
      { t: "h2", text: "Routing: which model answers a media turn" },
      {
        t: "p",
        text: "Every ZYRAXON model is declared to take every modality, but the upstream models behind them are not identical. So the turn is matched on the **whole set** of modalities it carries, and sent to a model that can read all of them.",
      },
      {
        t: "table",
        head: ["Turn carries", "Routed to"],
        rows: [
          ["Text only", "Any model in the pool. The fastest available lane is chosen."],
          ["Text + image", "A model that reports vision."],
          ["Text + audio", "A model that reports audio input. Check `GET /v1/provider` for the live set."],
          ["Text + video", "A model that reports video. Never a text-only model."],
          ["Several at once", "Matched on the whole set — the turn needs one model that takes every part."],
        ],
      },
      {
        t: "note",
        kind: "tip",
        title: "You can see what was used",
        text: "A media response carries `X-ZYRAXON-Input-Modalities`, so you can tell a real multimodal answer from a text-only one. The live capability set is at `GET /v1/provider`.",
      },
      { t: "h2", text: "Practical rules for large media" },
      {
        t: "list",
        items: [
          "**Prefer a URL over base64** for anything over a few hundred kilobytes — base64 inflates the bytes by a third and puts them in your request body.",
          "**Never send a long recording as WAV.** A 50 MB WAV is minutes of audio; MP3 at 64–96 kbps is a fraction of that and transcribes identically.",
          "**Slice a long video.** A multi-gigabyte file becomes a handful of model-sized parts; a client that slices before upload turns a failed request into a working one.",
          "**One modality per turn is easiest to reason about.** A turn that carries four media types needs a model that supports all four; splitting it into two turns is often more robust.",
          "**Check `truncated` and the modality header** before assuming the whole file was read.",
        ],
      },
      {
        t: "note",
        kind: "warn",
        title: "A model that cannot see the media is not silently used",
        text: "The point of capability-aware routing is that a turn carrying a video does not quietly land on a text-only model and come back with an answer that ignored the video. If no model in the pool can take the whole set, the request fails visibly rather than answering without the media.",
      },
      { t: "h2", text: "Transcribe, then ask" },
      {
        t: "p",
        text: "When you only need the words from a recording, the speech endpoint is the better tool — it is built for long audio and streams very large files. Send the transcript to the chat endpoint as text. Use the audio part above when the model needs to hear the audio itself, not only read it.",
      },
      {
        t: "code",
        lang: "bash",
        code: `# The reliable path for a long recording: transcribe, then chat.
TEXT=$(curl -s ${STT} -F "file=@interview.mp3" -F "language=en" | jq -r '.text')
curl -s ${CHAT} -H "Content-Type: application/json" \\
  -d "$(jq -nc --arg t "$TEXT" \\
        '{model:"zyraxon-apex", messages:[{role:"user", content:("Summarise: " + $t)}]}')" \\
| jq -r '.choices[0].message.content'`,
      },
    ],
  },
];

# Text to Speech

Send text, get audio. 322 neural voices across 75 languages, streamed as MP3 as it is synthesised, with the voice following the language of the text.

Group: ZYRAXON Provider · Also published at https://zyraxonai.lovable.app/docs/provider-text-to-speech

---
If you send us **text**, we send you **audio** back. `POST /api/public/tts` turns an answer into speech and streams the MP3 as it is synthesised, in the language of the text — so a Bengali answer is read by a Bengali voice rather than by an English one sounding out Bengali letters.

> Success: **The whole feature in three lines**
>
> **Speak:** `POST https://zyraxonai.lovable.app/api/public/tts` — send text, get streamed MP3.
> **Voices:** `GET https://zyraxonai.lovable.app/api/public/tts/voices` — 322 voices across 75 languages.
> **No key:** both are public.

## The simplest call there is

```bash
curl -s https://zyraxonai.lovable.app/api/public/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from ZYRAXON.","locale":"en"}' \
  -o answer.mp3

# Play it
ffplay -nodisp -autoexit answer.mp3    # macOS: afplay   Windows: start
```

The audio starts arriving before the sentence is finished being synthesised, so a client can begin playing almost immediately rather than waiting for a whole file. The response is `Content-Type: audio/mpeg`, with `X-ZYRAXON-Voice` naming the voice that actually spoke.

## The voice follows the language

The endpoint reads the script of the text you send and picks a voice for it. Bengali text is read by a Bengali voice, Devanagari by a Hindi one, Arabic by an Arabic one, and Latin script falls back to English. This is what makes a Bengali answer audible at all: an English voice reading Bengali does not pronounce the letters.

```bash
# Bengali
curl -s https://zyraxonai.lovable.app/api/public/tts -H "Content-Type: application/json" \
  -d '{"text":"আমি একটি ZYRAXON মডেল।","locale":"bn"}' -o bn.mp3

# Hindi, naming the voice exactly
curl -s https://zyraxonai.lovable.app/api/public/tts -H "Content-Type: application/json" \
  -d '{"text":"नमस्ते","voice":"hi-IN-SwaraNeural"}' -o hi.mp3

# Arabic
curl -s https://zyraxonai.lovable.app/api/public/tts -H "Content-Type: application/json" \
  -d '{"text":"مرحبا","locale":"ar"}' -o ar.mp3
```

| Field | Required | What it does |
| --- | --- | --- |
| `text` | Yes | What to speak. Up to 5000 characters. Markdown is stripped first. |
| `voice` | No | An exact voice name from the voices list. Wins over `locale`. |
| `locale` | No | A language or region, e.g. `bn`, `bn-IN`, `en-US`. Picks a voice in that language. |

> Tip: **Naming `voice` also skips a lookup**
>
> An exact `voice` skips the voice-catalogue search, so the first byte of audio arrives sooner. It is worth doing in a loop where the language never changes.

## Which voices exist

```bash
curl -s https://zyraxonai.lovable.app/api/public/tts/voices | jq '{count, languages: (.languages|length)}'
# {"count": 322, "languages": 75}

# Every Bengali voice
curl -s https://zyraxonai.lovable.app/api/public/tts/voices | jq -r '.data[] | select(.locale | startswith("bn")) | .name'
# bn-BD-NabanitaNeural
# bn-BD-PradeepNeural
# bn-IN-BashkarNeural
# bn-IN-TanishaaNeural

# Every language the catalogue covers
curl -s https://zyraxonai.lovable.app/api/public/tts/voices | jq -r '.locales[]' | sort -u | head -20
```

> Note: **Read the catalogue once, then cache it**
>
> The voice list changes rarely, so a client that offers a picker should fetch it once and keep it. Matching a voice to the language an answer came back in is the whole reason to read it.

## Speaking a streaming answer

For a live conversation the audio must start before the answer is finished. Synthesising the whole reply first means seconds of silence. The pattern is to **split the answer into sentences and speak each one as it is ready**, queued in order so nothing is reordered.

```typescript
// Speak an answer while it is still being written.
// A reply arrives token by token; feed the growing text and speak each
// completed sentence as it appears. The first sentence is heard while the
// model is still writing the second.
const TTS = "https://zyraxonai.lovable.app/api/public/tts";

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
}
```

> Note: **How fast is a sentence**
>
> A short sentence comes back in well under a second from this endpoint, which is what makes sentence-by-sentence playback feel like speech rather than a recording starting late.

> Warning: **Include the danda in the split**
>
> Bengali and Devanagari end a sentence with `।` (U+0964) and sometimes `॥`. A splitter that only looks for `.` will hand the whole paragraph to the endpoint as one sentence and defeat the point of streaming. The sample above includes both.

## What gets spoken

The endpoint speaks what a person would say, not the raw Markdown. A reply containing a code block is not read character by character — that would be unusable — so a fence becomes a short spoken note, links become their label, and the punctuation goes.

| In the answer | What is spoken |
| --- | --- |
| A fenced code block | “A code block, 12 lines.” |
| `[the docs](https://zyraxonai.lovable.app/docs/getting-started)` | “the docs” |
| A bare URL | “a link” |
| `**important**` | “important” |
| `## Heading` | “Heading” |

## Which engine answers

Synthesis runs on Microsoft Edge's Read Aloud engine — the same one behind the browser feature — through the same protocol. That is what gives 322 neural voices in 75 languages with no key to buy and no per-character bill. Audio is MP3 at 24 kHz mono.

> Note: **The engine is not hard-wired in**
>
> It is written as an interchangeable backend behind one function (`src/lib/tts/edge-speech.server.ts`). If the service changes its contract, a second backend is added beside the first and the fallback order changes — no caller is touched.

## Errors

| Status | Means | What to do |
| --- | --- | --- |
| `400` | `text` is missing, or nothing remained after markup was removed. | Send the answer's text. |
| `413` | The text is over 5000 characters. | Split it and speak it in parts. |
| `502` | The speech engine refused the connection. | Retry; it is usually transient. |

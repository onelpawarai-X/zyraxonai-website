# Speech to Text

One endpoint that turns a recording into a transcript, or a live microphone into text as the person is still speaking. Every container, both modes, and what to do when a file is huge.

Group: ZYRAXON Provider · Also published at https://zyraxonai.lovable.app/docs/provider-speech-to-text

---
If you are putting a **microphone** in your chat box, this is the endpoint you use. You send audio — a file you already have, or a stream while the person is still talking — and you get **text** back. One URL serves both: `POST /api/public/stt`.

> Success: **The whole endpoint in four lines**
>
> **Batch:** send a recording, get one transcript.
> **Live:** send raw PCM, get server-sent events — partial text as they speak, then a committed segment, then a final transcript.
> **Language is required:** `language=bn` or `bn-BD`. The recogniser does not detect it.
> **No key:** the endpoint is public.

## Which mode am I in?

The request picks the mode; there is no second URL and no second client. If you have a finished file — a voice note, a call recording, a podcast — you are in **batch** mode. If you have a live microphone and want words on screen while the person is still speaking, you are in **live** mode.

| You have | Mode | How the request says so |
| --- | --- | --- |
| A file, a URL, or base64 bytes | **Batch** | `multipart/form-data` with a `file`, JSON with `audio`, or JSON with `url`. No streaming headers. |
| A live microphone | **Live** | Raw PCM in the body plus `Accept: text/event-stream`, `?stream=1`, or a raw PCM `Content-Type`. |

## Batch: a recording you already have

Three shapes reach the same recogniser, so a browser, a server and a webhook can each send what they already have. The container is sniffed from the bytes, not from the `Content-Type`, so a mislabelled file still works.

```bash
# 1. Upload the bytes — the ordinary way from a form or a file picker.
curl -s https://zyraxonai.lovable.app/api/public/stt \
  -F "file=@recording.mp3" \
  -F "language=bn" | jq -r '.text'

# 2. Base64 in JSON — for a client that only speaks JSON.
curl -s https://zyraxonai.lovable.app/api/public/stt \
  -H "Content-Type: application/json" \
  -d '{"audio":"'"$(base64 -w0 recording.mp3)"'","language":"bn"}' | jq -r '.text'

# 3. A URL the server fetches for you — no upload, no base64 inflation.
curl -s https://zyraxonai.lovable.app/api/public/stt \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/recording.mp3","language":"bn"}' | jq -r '.text'
```

> Note: **A URL is a first-class input, not a convenience**
>
> When you send `url`, the server downloads the audio itself, under the same size ceiling as an upload. This is what makes the endpoint usable from a webhook or a chat platform that hands you a link rather than a file, and it keeps a large recording out of your request body.

### What batch mode returns

```json
{
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
}
```

| Field | What it means |
| --- | --- |
| `text` | The transcript. The only field most callers read. |
| `language` / `locale` | The language you asked for, and the locale it resolved to. |
| `confidence` | The recogniser's own confidence, 0–1. |
| `engine` | Which recognition backend answered. Informational. |
| `container` | The format it sniffed from the bytes — `mp3`, `wav`, `ogg`, `flac`, `webm`, `pcm`. |
| `duration` | How many seconds of audio it heard. Useful to check against the file you sent. |
| `elapsed` | How long the transcription took, in seconds. |
| `truncated` | `true` when the time budget ran out before the whole recording was transcribed. See *Very large recordings* below. |

## Containers it accepts

The format is read from the first bytes of the file. A file named `.mp3` that is really a WAV is transcribed as a WAV, and a file with no extension works as long as its bytes are one of these.

| Container | Notes |
| --- | --- |
| WAV | Any sample rate, any channel count. Downmixed and resampled server-side. |
| MP3 | The safest choice for a voice note or a call recording. |
| FLAC | Decoded like any other container. The declared rate is read from the file, not assumed. |
| OGG | Vorbis and Opus in an Ogg wrapper. |
| WebM | The container a browser's `MediaRecorder` produces. |
| Raw PCM | 16-bit little-endian samples with no header. Send the rate in the query or a header. |
| M4A / AAC | **Refused with a 400.** An `.m4a` is an MP4 container, and the recogniser does not unpack MP4. Convert it to WAV or MP3 first — see *Converting an iPhone recording* below. |

> Warning: **M4A from an iPhone is refused, not silently emptied**
>
> An `.m4a` recorded on an iPhone or in Safari is an MP4 container. Earlier it fell through to the raw-PCM path, was read as samples, produced no speech, and came back as an empty transcript that looked exactly like "nobody spoke". Now it is rejected with a 400, so the failure is visible instead of silent.

### Converting an iPhone recording

```bash
# .m4a -> .wav, keeping the sample rate. One command, no quality loss.
ffmpeg -i memo.m4a -ac 1 -ar 16000 memo.wav
curl -s https://zyraxonai.lovable.app/api/public/stt -F "file=@memo.wav" -F "language=en" | jq -r '.text'

# Or straight to MP3, which is smaller to upload.
ffmpeg -i memo.m4a -ac 1 -ar 16000 -b:a 64k memo.mp3
```

## Live: words as they are spoken

The same endpoint transcribes **as you speak**. Send raw PCM and the response is a stream of server-sent events: a partial that grows word by word, and a committed segment every few seconds. The request picks the mode — an `Accept: text/event-stream` header, `?stream=1`, or a raw PCM content type.

```bash
# Live, from any audio source. One second of 16 kHz mono PCM is 32000 bytes.
ffmpeg -i recording.mp3 -ar 16000 -ac 1 -f s16le - \
| curl -sN -X POST "https://zyraxonai.lovable.app/api/public/stt?stream=1&language=bn" \
    -H "Content-Type: audio/l16; rate=16000" \
    -H "Accept: text/event-stream" \
    --data-binary @-

# event: ready     {"rate":16000,"language":"bn-BD"}
# event: partial   {"text":"আজ আকাশ"}
# event: partial   {"text":"আজ আকাশ পরিষ্কার"}
# event: segment   {"text":"আজ আকাশ পরিষ্কার এবং সূর্য উজ্জ্বল।","seconds":4.2}
# event: done      {"text":"...","segments":2,"seconds":8.1}
```

| Event | When | What it holds |
| --- | --- | --- |
| `ready` | Immediately | The rate it is reading, and the language you asked for. |
| `partial` | About every 1.2 seconds | The transcript so far, growing. Replace the last line with it. |
| `segment` | Every 4 seconds | Text committed so far. This part never changes again. |
| `done` | When the audio ends | The whole transcript, how many chunks, and how long it heard. |

### Pacing a microphone

A client paces itself by bytes, not by wall-clock time. At 16 kHz, one second of 16-bit mono PCM is exactly 32 000 bytes, so a client that writes 32 000 bytes per second is in real time. Sending faster does not make recognition faster; sending slower introduces gaps the recogniser hears as silence.

| Sample rate | Bytes per second (16-bit mono) |
| --- | --- |
| 8000 Hz | 16 000 |
| 16000 Hz | 32 000 |
| 22050 Hz | 44 100 |
| 44100 Hz | 88 200 |

> Note: **Why live mode takes PCM and not a recording**
>
> A WebM or Opus frame has to be decoded as a whole unit, so a compressed stream cannot be cut at an arbitrary moment without corrupting the audio. Raw PCM samples can be split anywhere, which is what lets the endpoint commit a segment mid-sentence. A browser produces PCM directly from an `AudioWorklet`, so this costs the client nothing.

> Tip: **A word on the boundary is not lost**
>
> When a segment closes, the last fraction of a second carries into the next one, so a word straddling the cut is heard whole rather than clipped in half. Committed text is never rewritten, so a display only ever grows.

## A complete browser microphone, end to end

This is the whole live client. It captures from the microphone, converts to 16-bit mono PCM at 16 kHz, and prints partial and committed text as they arrive. Nothing else is needed to put a working microphone in a chat box.

```typescript
// Live transcription from a browser microphone.
const STT = "https://zyraxonai.lovable.app/api/public/stt";

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

  const res = await fetch(`${STT}?stream=1&language=${language}`, {
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
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const ev = JSON.parse(line.slice(5).trim());
      if (ev.type === "partial") onText(ev.text, false);
      if (ev.type === "segment") onText(ev.text, true);
      if (ev.type === "done") onText(ev.text, true);
    }
  }
}
```

> Note: **The worklet is five lines**
>
> An `AudioWorkletProcessor` that forwards each input block as an `Int16Array` is all the client-side DSP this needs — no encoder, no library. The endpoint accepts 32-bit float too, but 16-bit halves the bytes on the wire with no effect on recognition.

## Very large recordings

A recording of an hour is a normal thing to transcribe, and the endpoint is built for it. Uploads are accepted up to **100 MB**, and a file that large does not have to fit in memory at once.

> Success: **A 100 MB WAV and an hour-long MP3 both come back 200**
>
> Past 8 MB the recording is decoded **window by window** instead of being held whole: about 25 seconds of audio is decoded, transcribed and released before the next window is read. Peak memory is a function of the window length, not the recording's, which is what lets an hour-long file succeed where a whole-file decode would exhaust the runtime.

| Size | What happens |
| --- | --- |
| Up to 8 MB | Whole-file decode. Cheaper for a short clip, and the windowing overhead is not worth paying. |
| 8 MB – 100 MB | Streamed window by window. Peak memory tracks the ~25 s window, not the file. |
| Over 100 MB | `413`, with the byte count and the limit in the message. |

### Windows are joined in order, not in the order they finish

Several windows are transcribed at once, so they finish out of order. Each is written into its own slot by index and the transcript is joined in index order — never in completion order. The practical effect is that the transcript reads as one continuous piece, in the order the person spoke.

> Warning: **The time budget, and `truncated`**
>
> Transcription stops at a wall-clock budget of two minutes and returns what it has, with `truncated: true`. That is not an error and not a dropped connection — it is the endpoint choosing to answer with a partial transcript rather than hold the connection open indefinitely. When you see it, the transcript is real and in order; it simply covers the start of the recording. Split the recording and transcribe the parts if you need all of it.

## Language is required, and why

`language` is required in both modes. This is deliberate, and it is the one thing about this endpoint that surprises people.

> Warning: **The recogniser does not detect language**
>
> Asked for English about Bengali audio it returns English-sounding words at high confidence rather than failing, so a guess produces a **confident wrong answer** — the worst kind of failure, because nothing in the response tells you it is wrong. The caller knows which language is being spoken; the endpoint asks rather than assumes.

```bash
# Bengali, with the region
curl -s https://zyraxonai.lovable.app/api/public/stt -F "file=@recording.mp3" -F "language=bn-BD" | jq -r '.text'

# Hindi
curl -s https://zyraxonai.lovable.app/api/public/stt -F "file=@recording.mp3" -F "language=hi" | jq -r '.text'

# The live mode takes it the same way, in the query string.
curl -sN -X POST "https://zyraxonai.lovable.app/api/public/stt?stream=1&language=bn" --data-binary @audio.pcm
```

> Note: **Why it was removed**
>
> Auto-detection existed and was deleted. It guessed from a few seconds of audio, and when it guessed wrong the transcript was in the wrong language with no indication — a caller could not tell a bad recording from a bad guess. Requiring the language makes the failure mode a missing field, which a client sees immediately, instead of a wrong transcript, which it does not.

## Errors

| Status | Means | What to do |
| --- | --- | --- |
| `400` | The container is MP4/AAC, or no audio was found in the request. | Convert to WAV or MP3, or check the field name. |
| `413` | The upload is over 100 MB. | Split the recording, or send a URL instead of the bytes. |
| `415` | The audio is present but the format is refused. | Re-encode to WAV, MP3, FLAC, OGG or WebM. |
| `422` | `language` was not sent. | Send it — `bn`, `bn-BD`, `en`, `hi`. The endpoint does not detect language. |
| `502` | The recogniser refused the connection. | Retry; it is usually transient. |

## Which engine answers

Recognition runs on the speech service the Chromium browser uses, reached with its published client key. It takes raw PCM and FLAC, and it does not detect language. The engine is reported in the `engine` field so a caller can tell which backend produced a transcript.

> Note: **The engine is not hard-wired in**
>
> It is written as an interchangeable backend behind one function (`src/lib/stt/engine.ts`). If the service changes its contract, a second backend is added beside the first and the fallback order changes — no caller is touched, and nothing needs to be rewritten.

## The machine-readable contract

A `GET` on the same URL returns the contract as JSON, including the accepted containers, the limits and the response fields — so a coding assistant handed the URL can read it without a human explaining it.

```bash
curl -s https://zyraxonai.lovable.app/api/public/stt | jq '{containers, limits, longAudio}'
```

# Multimodal Chat

Video, audio, pictures and documents go into the same chat call as text. Every model takes every modality, and a media turn is routed to a model that can actually read it.

Group: ZYRAXON Provider · Also published at https://zyraxonai.lovable.app/docs/provider-multimodal

---
The chat endpoint is not text-only. A message can carry **text, an image, a recording, a video or a document**, in any combination — and every ZYRAXON model accepts every one of them. Send the media, and the turn is routed server-side to a model that can actually read it.

> Success: **One call, every modality**
>
> `POST https://zyraxonai.lovable.app/api/public/zyraxon/v1/chat/completions` takes the OpenAI content-parts array. Each part is either inline base64 or an `https://` URL. A turn that carries media is matched to a model that supports it — a video turn is never handed to a text-only model and made to fail.

## The shape of a multimodal message

Instead of `content` being a string, it is an array of parts. This is the same shape OpenAI defined, so a client that already sends vision turns to OpenAI sends them here unchanged.

```json
{
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
}
```

| Part type | Field | What it carries |
| --- | --- | --- |
| `text` | `text` | A plain string. Any number of text parts may be mixed with media. |
| `image_url` | `image_url.url` | A `data:` URI or an `https://` URL. PNG, JPEG, WebP, GIF. |
| `input_audio` | `input_audio.data` + `.format` | Base64 audio and its container — `wav`, `mp3`, `flac`, `ogg`, `webm`. |
| `video_url` | `video_url.url` | A `data:` URI or an `https://` URL. MP4 and WebM. |
| `file` | `file.file_data` + `.filename` | A `data:` URI of the document, with the name so the model knows what it is. |

## Inline or by URL

Every media part takes either base64 or an `https://` URL. Send a URL and the server fetches it for you, so a large file never has to pass through your request body — which is what keeps a big video from becoming a `413`.

```bash
# Inline base64 — fine for a small image.
curl -s https://zyraxonai.lovable.app/api/public/zyraxon/v1/chat/completions -H "Content-Type: application/json" -d '{
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
curl -s https://zyraxonai.lovable.app/api/public/zyraxon/v1/chat/completions -H "Content-Type: application/json" -d '{
  "model": "zyraxon-cyber",
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "Summarise this recording." },
      { "type": "input_audio",
        "input_audio": { "data": "https://example.com/interview.mp3", "format": "mp3" } }
    ]
  }]
}' | jq -r '.choices[0].message.content'
```

> Note: **URLs are fetched server-side, so the model always gets bytes**
>
> A URL is not passed to the model as a link to click — the server downloads it first and hands over the bytes. That is why a URL works for a model that cannot browse, and why the same size ceiling applies as for an inline upload.

## Routing: which model answers a media turn

Every ZYRAXON model is declared to take every modality, but the upstream models behind them are not identical. So the turn is matched on the **whole set** of modalities it carries, and sent to a model that can read all of them.

| Turn carries | Routed to |
| --- | --- |
| Text only | Any model in the pool. The fastest available lane is chosen. |
| Text + image | A model that reports vision. |
| Text + audio | A model that reports audio input. Check `GET /v1/provider` for the live set. |
| Text + video | A model that reports video. Never a text-only model. |
| Several at once | Matched on the whole set — the turn needs one model that takes every part. |

> Tip: **You can see what was used**
>
> A media response carries `X-ZYRAXON-Input-Modalities`, so you can tell a real multimodal answer from a text-only one. The live capability set is at `GET /v1/provider`.

## Practical rules for large media

- **Prefer a URL over base64** for anything over a few hundred kilobytes — base64 inflates the bytes by a third and puts them in your request body.
- **Never send a long recording as WAV.** A 50 MB WAV is minutes of audio; MP3 at 64–96 kbps is a fraction of that and transcribes identically.
- **Slice a long video.** A multi-gigabyte file becomes a handful of model-sized parts; a client that slices before upload turns a failed request into a working one.
- **One modality per turn is easiest to reason about.** A turn that carries four media types needs a model that supports all four; splitting it into two turns is often more robust.
- **Check `truncated` and the modality header** before assuming the whole file was read.

> Warning: **A model that cannot see the media is not silently used**
>
> The point of capability-aware routing is that a turn carrying a video does not quietly land on a text-only model and come back with an answer that ignored the video. If no model in the pool can take the whole set, the request fails visibly rather than answering without the media.

## Transcribe, then ask

When you only need the words from a recording, the speech endpoint is the better tool — it is built for long audio and streams very large files. Send the transcript to the chat endpoint as text. Use the audio part above when the model needs to hear the audio itself, not only read it.

```bash
# The reliable path for a long recording: transcribe, then chat.
TEXT=$(curl -s https://zyraxonai.lovable.app/api/public/stt -F "file=@interview.mp3" -F "language=en" | jq -r '.text')
curl -s https://zyraxonai.lovable.app/api/public/zyraxon/v1/chat/completions -H "Content-Type: application/json" \
  -d "$(jq -nc --arg t "$TEXT" \
        '{model:"zyraxon-apex", messages:[{role:"user", content:("Summarise: " + $t)}]}')" \
| jq -r '.choices[0].message.content'
```

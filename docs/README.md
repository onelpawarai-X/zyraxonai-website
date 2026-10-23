# Documentation

Reference documents for the ZYRAXON website and the services it exposes. Each
document stands on its own: it is written to be read by someone who has the one
file open and nothing else, so it repeats the values it needs rather than
sending the reader elsewhere.

## Provider systems

The provider is one base URL, but it is not one thing. These are the references
for each system behind it.

| Document | System |
| --- | --- |
| [provider-speech-to-text.md](provider-speech-to-text.md) | Speech to text — one endpoint, batch and live, up to 100 MB |
| [provider-text-to-speech.md](provider-text-to-speech.md) | Text to speech — 322 voices, 75 languages, streamed MP3 |
| [provider-multimodal.md](provider-multimodal.md) | Multimodal chat — image, audio, video and PDF in one call |

The same three systems are also written up as pages inside the site, under
`/docs/provider-speech-to-text`, `/docs/provider-text-to-speech` and
`/docs/provider-multimodal`. Those pages are rendered from
`src/lib/docs/provider-system-docs.ts`; these Markdown files are the same
content for a reader outside the site, a code review, or a repository clone.

## Website backend

| Document | What it covers |
| --- | --- |
| [github-oauth-backend.md](github-oauth-backend.md) | The server-side GitHub OAuth bridge and the connected-account API |
| [powershell-builder-engine.md](powershell-builder-engine.md) | The authenticated Builder execution endpoint |

## Where the machine-readable copies live

Every provider endpoint describes itself, so a tool does not have to read a
Markdown file to find the contract:

| URL | What it returns |
| --- | --- |
| `GET /api/public/zyraxon/v1/endpoints` | Every endpoint, with fields, response shape and example |
| `GET /api/public/zyraxon/v1/models` | The model catalogue |
| `GET /api/public/zyraxon/v1/provider` | Live model health, modalities and capacity |
| `GET /api/public/zyraxon/v1/integrations` | The integration catalogue as JSON |
| `GET /api/public/stt` | The speech-to-text contract, including its limits |
| `GET /llms.txt` | A plain-text map of the whole surface |

## Conventions used in these documents

- Values that a caller must type exactly are shown in `code` and are copied from
  the running code, not retyped, so a document cannot drift from the endpoint it
  describes.
- A status code is always given with the action that fixes it. A document that
  lists `413` without saying "split the file, or send a URL instead" is not
  finished.
- Anything that looks like a limitation is explained, not hidden. Where a limit
  exists because of a deliberate choice — a required `language`, a two-minute
  transcription budget — the reason is in the document next to the limit.

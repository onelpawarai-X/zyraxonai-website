import { Link } from "@tanstack/react-router";
import { Card, Section, Tag } from "@/components/site/ui";
import { inlineMarkdown } from "@/lib/inline-markdown";
import { API_ORIGIN, V1_BASE_URL } from "@/lib/providers/integrations";
import { CopyButton } from "./provider-parts";

/** The three things a caller most often arrives asking about, said plainly.
 *
 *  Speech in, speech out, and "can I send a picture or a video?" are the three
 *  questions the provider gets asked first, and each has a one-line answer that
 *  a reader should not have to assemble from a dozen cards. So they are here,
 *  each pointing at its own function page, and the answer to each is the thing
 *  a caller actually needs to hear: the endpoint, and what goes in and out. */

const CARDS = [
  {
    glyph: "🎙",
    label: "Speech to text",
    slug: "speech-to-text",
    headline: "Putting a microphone in your chat box? Use this endpoint.",
    body: "You send real-time audio, we send real-time text back. POST /api/public/stt takes either a whole recording and returns one transcript, or raw PCM streamed live while the person is still speaking — partial text arrives as they talk. It is the same URL for both, and the request itself picks the mode.",
    url: `${API_ORIGIN}/api/public/stt`,
    tags: ["Live SSE", "Batch", "Up to 100 MB", "Language is required"],
  },
  {
    glyph: "🔊",
    label: "Text to speech",
    slug: "text-to-speech",
    headline: "Send us text, we send you audio.",
    body: "POST /api/public/tts turns an answer into speech and streams the MP3 back as it is synthesised. The voice follows the language of the text, so a Bengali answer is read by a Bengali voice rather than an English one sounding out Bengali letters. 322 voices across 75 languages, and no key.",
    url: `${API_ORIGIN}/api/public/tts`,
    tags: ["MP3 stream", "322 voices", "75 languages"],
  },
  {
    glyph: "▣",
    label: "Chat with any media",
    slug: "media",
    headline: "Video, audio, pictures — every model takes them all.",
    body: "The chat endpoint accepts the OpenAI content-parts array, so one message can mix text with media. Send each part inline as base64 or as an https:// URL and we fetch it server-side. A turn that carries media is routed to a model that can actually read it, so a video is never handed to a text-only model and made to fail.",
    url: `${V1_BASE_URL}/chat/completions`,
    tags: ["Image", "Video", "Audio", "PDF", "Inline or URL"],
  },
] as const;

export function ProviderHighlights() {
  return (
    <Section
      id="what-it-does"
      label="In short"
      title="Speech in, speech out, and any media in between"
      description="Three questions the provider gets asked first, each with a one-line answer and a page of its own."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Card key={c.slug} className="flex flex-col p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/12 text-[16px] text-primary">
                {c.glyph}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {c.label}
              </span>
            </div>
            <h3 className="mt-3 text-[15px] font-bold tracking-tight text-foreground">
              {c.headline}
            </h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {inlineMarkdown(c.body)}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
              <code className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
                {c.url}
              </code>
              <CopyButton text={c.url} label="copy" />
            </div>
            <Link
              to="/providers/$slug"
              params={{ slug: c.slug }}
              className="mt-3 text-[12px] font-semibold text-primary"
            >
              Open {c.label} →
            </Link>
          </Card>
        ))}
      </div>
    </Section>
  );
}

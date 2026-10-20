/** Guess the language of a piece of text, so speech can be read in it.
 *
 *  This matters more than it sounds. The speech engine will happily read Bengali
 *  text with an English voice, and the result is unintelligible — the letters
 *  are not pronounced at all. Sending the right locale is the difference between
 *  a spoken answer and noise, so it is detected rather than left to the caller.
 *
 *  Detection is by Unicode script: Bengali text is written in the Bengali
 *  block, Devanagari in its own, and so on. That is exact for the scripts that
 *  have their own block, needs no model, and cannot mislabel a sentence the way
 *  a statistical guess can. Latin script is ambiguous, so it returns undefined
 *  and the caller keeps its default. */

const SCRIPTS: Array<{ locale: string; test: RegExp }> = [
  // Order matters: the first match wins, so the more specific blocks come first.
  { locale: "bn", test: /[\u0980-\u09FF]/ }, // Bengali
  { locale: "hi", test: /[\u0900-\u097F]/ }, // Devanagari (Hindi, Marathi, Nepali)
  { locale: "ta", test: /[\u0B80-\u0BFF]/ }, // Tamil
  { locale: "te", test: /[\u0C00-\u0C7F]/ }, // Telugu
  { locale: "kn", test: /[\u0C80-\u0CFF]/ }, // Kannada
  { locale: "ml", test: /[\u0D00-\u0D7F]/ }, // Malayalam
  { locale: "gu", test: /[\u0A80-\u0AFF]/ }, // Gujarati
  { locale: "pa", test: /[\u0A00-\u0A7F]/ }, // Gurmukhi (Punjabi)
  { locale: "or", test: /[\u0B00-\u0B7F]/ }, // Odia
  { locale: "si", test: /[\u0D80-\u0DFF]/ }, // Sinhala
  { locale: "ar", test: /[\u0600-\u06FF\u0750-\u077F]/ }, // Arabic
  { locale: "fa", test: /[\u06A0-\u06FF]/ }, // Persian (a subset of the Arabic block)
  { locale: "he", test: /[\u0590-\u05FF]/ }, // Hebrew
  { locale: "ru", test: /[\u0400-\u04FF]/ }, // Cyrillic
  { locale: "el", test: /[\u0370-\u03FF]/ }, // Greek
  { locale: "th", test: /[\u0E00-\u0E7F]/ }, // Thai
  { locale: "ko", test: /[\uAC00-\uD7AF\u1100-\u11FF]/ }, // Hangul
  { locale: "ja", test: /[\u3040-\u30FF]/ }, // Hiragana / Katakana
  { locale: "zh", test: /[\u4E00-\u9FFF]/ }, // CJK ideographs
];

/** The language of `text`, or undefined when it is plain Latin script.
 *
 *  Counts characters rather than taking the first hit, so a Bengali answer that
 *  quotes an English error message is still read in Bengali. */
export function detectLocale(text: string): string | undefined {
  let best: { locale: string; count: number } | null = null;
  for (const { locale, test } of SCRIPTS) {
    const matches = text.match(new RegExp(test.source, "g"));
    const count = matches ? matches.length : 0;
    if (count > 0 && (!best || count > best.count)) best = { locale, count };
  }
  return best?.locale;
}

/** Split text into speakable pieces so speech can start before the reply ends.
 *
 *  A whole answer takes seconds to synthesise; the first sentence takes a
 *  fraction of that. Splitting on sentence boundaries and speaking each piece as
 *  it is ready is what makes the speech feel live rather than delayed. The
 *  pieces are returned in order and are joined back exactly, so nothing is lost
 *  or reordered. */
export function intoSentences(text: string, maxChars = 240): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  // Walk the text and cut after each terminator. A split on a zero-width match
  // would re-join the pieces, so each sentence is built explicitly.
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < clean.length; i++) {
    if (/[.!?।॥]/.test(clean[i]!)) {
      parts.push(clean.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  if (start < clean.length) parts.push(clean.slice(start).trim());
  const out: string[] = [];
  let buffer = "";
  for (const part of parts) {
    if (!part) continue;
    if ((buffer + " " + part).trim().length > maxChars && buffer) {
      out.push(buffer.trim());
      buffer = part;
    } else {
      buffer = buffer ? `${buffer} ${part}` : part;
    }
  }
  if (buffer.trim()) out.push(buffer.trim());

  // A single very long sentence still has to be cut, or one request carries it
  // all and the delay returns.
  return out.flatMap((piece) => {
    if (piece.length <= maxChars * 2) return [piece];
    const chunks: string[] = [];
    let rest = piece;
    while (rest.length > maxChars) {
      const cut = rest.lastIndexOf(" ", maxChars);
      const at = cut > 0 ? cut : maxChars;
      chunks.push(rest.slice(0, at));
      rest = rest.slice(at).trim();
    }
    if (rest) chunks.push(rest);
    return chunks;
  });
}

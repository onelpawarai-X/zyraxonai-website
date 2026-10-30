// Proves the two live-transcription contracts hold, and that the rolling mode
// is the one a buffering host needs.
//
// Three things are pinned here, and each one is a bug that was seen live:
//
//   1. A sliding window makes the recogniser drop the word it was primed with,
//      so a plain "does the fresh text start with what I have" check fails and
//      the whole window is re-emitted — words duplicate on screen. The overlap
//      alignment must return only the addition.
//   2. The mode predicates must agree with the transport: a raw PCM body is a
//      live stream, and `?mode=rolling` is the rolling tick and nothing else. If
//      `rolling` were allowed to fall into the SSE path the caller would get a
//      stream that only starts after they stop speaking.
//   3. The rolling mode re-sends the window, so it must never lose text when the
//      recogniser's opinion of the window's first word changes.
//
// Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/verify-stt-realtime.ts

import { alignAddition } from "../src/lib/stt/stream";
import { wantsRolling, wantsStream } from "../src/routes/api/public/stt";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
};

const req = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { method: "POST", headers });

// ── alignAddition: the addition only, never a duplicate ─────────────────────
check(
  "an empty committed text returns the whole fresh text",
  alignAddition("", "আজ সকালে আমি") === "আজ সকালে আমি",
);
check(
  "a strict extension returns only the new tail",
  alignAddition("আজ সকালে", "আজ সকালে আমি ঘুম থেকে") === " আমি ঘুম থেকে",
);
check(
  "an unchanged window returns nothing",
  alignAddition("আজ সকালে আমি", "আজ সকালে আমি") === "",
);
check(
  "a shorter fresh text (the window slid back) returns nothing",
  alignAddition("আজ সকালে আমি ঘুম", "আজ সকালে") === "",
);
check(
  "when the first word changes, the shared suffix is still found",
  alignAddition("আজ সকালে আমি ঘুম", "সকালে আমি ঘুম থেকে") === " থেকে",
  alignAddition("আজ সকালে আমি ঘুম", "সকালে আমি ঘুম থেকে"),
);
check(
  "a mid-window disagreement does not re-emit the whole window",
  alignAddition("আজ সকালে আমি ঘুম থেকে", "সকালে আমি ঘুম থেকে উঠে") === " উঠে",
  alignAddition("আজ সকালে আমি ঘুম থেকে", "সকালে আমি ঘুম থেকে উঠে"),
);
check(
  "whitespace differences do not defeat the match",
  alignAddition("আজ সকালে", "আজসকালে আমি") === " আমি",
  alignAddition("আজ সকালে", "আজসকালে আমি"),
);
check(
  "a genuinely unrelated transcript is returned whole",
  alignAddition("এক দুই তিন", "চার পাঁচ ছয়") === "চার পাঁচ ছয়",
);
check(
  "a real rolling sequence never duplicates a word",
  (() => {
    // The recogniser drops the leading word as the window slides, exactly as the
    // live endpoint was seen to do.
    const windows = [
      "আজ সকালে আমি",
      "আজ সকালে আমি ঘুম",
      "সকালে আমি ঘুম থেকে",
      "আমি ঘুম থেকে উঠে মুখ",
      "ঘুম থেকে উঠে মুখ ধুয়ে",
      "থেকে উঠে মুখ ধুয়ে চা",
    ];
    let committed = "";
    let full = "";
    for (const w of windows) {
      full += alignAddition(committed, w);
      committed = w;
    }
    const words = full.trim().split(/\s+/);
    const set = new Set(words);
    return set.size === words.length;
  })(),
);

// ── mode selection ──────────────────────────────────────────────────────────
check(
  "?mode=rolling selects the rolling tick",
  wantsRolling(req("https://x/api/public/stt?mode=rolling&language=bn")) === true,
);
check(
  "?rolling=1 selects the rolling tick",
  wantsRolling(req("https://x/api/public/stt?rolling=1&language=bn")) === true,
);
check(
  "a plain batch request is not the rolling tick",
  wantsRolling(req("https://x/api/public/stt?language=bn")) === false,
);
check(
  "?mode=live is not the rolling tick",
  wantsRolling(req("https://x/api/public/stt?mode=live&language=bn")) === false,
);
check(
  "a raw PCM body is a live stream",
  wantsStream(req("https://x/api/public/stt?language=bn", { "content-type": "audio/l16; rate=16000" })) ===
    true,
);
check(
  "an SSE accept header is a live stream",
  wantsStream(req("https://x/api/public/stt?language=bn", { accept: "text/event-stream" })) === true,
);
check(
  "a multipart upload is a batch request",
  wantsStream(req("https://x/api/public/stt?language=bn", { "content-type": "multipart/form-data" })) ===
    false,
);
check(
  "?mode=rolling is not itself an SSE stream",
  wantsStream(req("https://x/api/public/stt?mode=rolling&language=bn")) === false,
);

console.log(failures === 0 ? "\nall real-time speech checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);

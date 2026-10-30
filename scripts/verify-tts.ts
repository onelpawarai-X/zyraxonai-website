// Proves the speech pipeline is wired correctly: the token matches the
// reference algorithm, the voice picker honours the language, and markup is
// stripped before anything is spoken.
//
// The live audio path (the WebSocket to Microsoft's engine) is exercised
// separately against a running server, because it needs the network; this file
// checks the parts that must be right for that call to succeed at all.
//
// Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/verify-tts.ts
import { execFileSync } from "node:child_process";
import {
  chunkTextIntoSentences,
  escapeXml,
  normaliseGender,
  normaliseTone,
  pickVoice,
  speakable,
  ssml,
  type Voice,
} from "../src/lib/tts/edge-speech.server";
import { detectLocale, intoSentences } from "../src/lib/tts/language";
import { secMsGec, SEC_MS_GEC_VERSION } from "../src/lib/tts/edge-tts-token";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
};

// ── the token must match the reference implementation exactly ───────────────
// A token that merely looks right is rejected by the endpoint, and that failure
// is invisible until a real synthesis is attempted, so it is compared here.
let referenceOk = false;
let reference = "";
try {
  reference = execFileSync(
    "python3",
    [
      "-c",
      "import sys; sys.path.insert(0,'/home/openhands/.local/lib/python3.13/site-packages'); from edge_tts.drm import generate_sec_ms_gec_v2; print(generate_sec_ms_gec_v2(1792520000))",
    ],
    { encoding: "utf8" },
  ).trim();
  referenceOk = true;
} catch {
  console.log("SKIP  reference comparison (the edge-tts package is not installed here)");
}

if (referenceOk) {
  const mine = secMsGec(1792520000000);
  check(
    "the token matches the reference implementation byte for byte",
    mine === reference,
    `${mine}\n        ${reference}`,
  );
  check(
    "the token has the v2 shape (16 hex - 64 hex)",
    /^[0-9A-F]{16}-[0-9A-F]{64}$/.test(mine),
    mine,
  );
}
check(
  "the token version names the browser it emulates",
  /^2-\d+\.\d+\.\d+\.\d+$/.test(SEC_MS_GEC_VERSION),
  SEC_MS_GEC_VERSION,
);

// The token must change every five minutes, and be stable inside a window, or
// either it is stale (rejected) or a new one is minted per call for nothing.
const t0 = 1792520000000;
check("the token is stable inside a five-minute window", secMsGec(t0) === secMsGec(t0 + 60_000));
check(
  "the token changes across a five-minute boundary",
  secMsGec(t0) !== secMsGec(t0 + 6 * 60_000),
);

// ── the voice picker must honour the language ───────────────────────────────
const voices: Voice[] = [
  { name: "en-US-EmmaMultilingualNeural", locale: "en-US", gender: "Female" },
  { name: "en-US-AndrewNeural", locale: "en-US", gender: "Male" },
  { name: "en-GB-SoniaNeural", locale: "en-GB", gender: "Female" },
  { name: "bn-BD-NabanitaNeural", locale: "bn-BD", gender: "Female" },
  { name: "bn-BD-PradeepNeural", locale: "bn-BD", gender: "Male" },
  { name: "bn-IN-TanishaaNeural", locale: "bn-IN", gender: "Female" },
  { name: "bn-IN-BashkarNeural", locale: "bn-IN", gender: "Male" },
  { name: "hi-IN-SwaraNeural", locale: "hi-IN", gender: "Female" },
];
check(
  "a locale picks a voice in that language",
  pickVoice("bn", voices)?.startsWith("bn-") === true,
  pickVoice("bn", voices),
);
check(
  "a region locale picks that region",
  pickVoice("bn-IN", voices)?.startsWith("bn-IN-") === true,
  pickVoice("bn-IN", voices),
);
check(
  "a region locale with a gender picks that region and gender",
  pickVoice("bn-IN", voices, undefined, "male") === "bn-IN-BashkarNeural",
  pickVoice("bn-IN", voices, undefined, "male"),
);
check("a full locale matches exactly", pickVoice("hi-IN", voices) === "hi-IN-SwaraNeural");
check(
  "a named voice wins over the locale",
  pickVoice("bn", voices, "en-GB-SoniaNeural") === "en-GB-SoniaNeural",
);
check(
  "an unknown locale falls back to English",
  pickVoice("xx-YY", voices)?.startsWith("en-") === true,
  pickVoice("xx-YY", voices),
);
check("an empty locale falls back to English", pickVoice("", voices)?.startsWith("en-") === true);

// ── gender picks the kind of voice, the language still wins ─────────────────
check(
  "female picks the female Bengali voice",
  pickVoice("bn", voices, undefined, "female") === "bn-BD-NabanitaNeural",
  pickVoice("bn", voices, undefined, "female"),
);
check(
  "male picks the male Bengali voice",
  pickVoice("bn", voices, undefined, "male") === "bn-BD-PradeepNeural",
  pickVoice("bn", voices, undefined, "male"),
);
check(
  "gender is matched case-insensitively",
  pickVoice("bn", voices, undefined, "MALE") === "bn-BD-PradeepNeural",
  pickVoice("bn", voices, undefined, "MALE"),
);
check(
  "a named voice beats the gender",
  pickVoice("bn", voices, "bn-BD-NabanitaNeural", "male") === "bn-BD-NabanitaNeural",
  pickVoice("bn", voices, "bn-BD-NabanitaNeural", "male"),
);
check(
  "an unknown gender is ignored, not an error",
  pickVoice("bn", voices, undefined, "robot") === "bn-BD-NabanitaNeural",
  pickVoice("bn", voices, undefined, "robot"),
);
check(
  "a language with no voice of that gender still gets a voice in the language",
  (() => {
    const onlyFemale: Voice[] = [
      { name: "xx-XX-SoloNeural", locale: "xx-XX", gender: "Female" },
    ];
    const picked = pickVoice("xx", onlyFemale, undefined, "male");
    return picked === "xx-XX-SoloNeural";
  })(),
  pickVoice("xx", voices, undefined, "male"),
);
check(
  "a gender with no locale still picks an English voice of that gender",
  pickVoice("", voices, undefined, "female")?.startsWith("en-") === true,
  pickVoice("", voices, undefined, "female"),
);
check(
  "normaliseGender accepts female and male, in any case",
  normaliseGender("Female") === "female" &&
    normaliseGender("MALE") === "male" &&
    normaliseGender("woman") === "female" &&
    normaliseGender("man") === "male",
);
check(
  "normaliseGender treats a typo or nothing as no preference",
  normaliseGender("robot") === "" && normaliseGender(null) === "" && normaliseGender("") === "",
);

// ── what gets spoken must be speakable ──────────────────────────────────────
const withCode = "Here is how:\n\n```python\nprint('hi')\nprint('there')\n```\n\nThat is all.";
const spoken = speakable(withCode);
check("a code block is not read aloud", !spoken.includes("print("), spoken);
check("a code block is described instead", /code block, 2 lines/.test(spoken), spoken);

const withLink = "See [the docs](/docs/getting-started) for more.";
const spokenLink = speakable(withLink);
check("a link becomes its label, not its URL", spokenLink === "See the docs for more.", spokenLink);
check(
  "a bare URL is not read out",
  !speakable("Go to https://example.com/x now").includes("https://"),
);

check("bold markers are removed", speakable("**important** thing") === "important thing");
check("heading markers are removed", speakable("## Title") === "Title");
check("bullet markers are removed", speakable("- one\n- two") === "one two");
check("XML is escaped for SSML", escapeXml("a < b & c > d") === "a &lt; b &amp; c &gt; d");

// ── the answer's language must be detected, not assumed ─────────────────────
// This is what made Bengali unlistenable: an English voice reading Bengali text.
check(
  "Bengali text is detected as Bengali",
  detectLocale("আমি একটি ZYRAXON মডেল।") === "bn",
  String(detectLocale("আমি একটি ZYRAXON মডেল।")),
);
check("Hindi text is detected as Hindi", detectLocale("नमस्ते, यह ZYRAXON है।") === "hi");
check("Arabic text is detected as Arabic", detectLocale("مرحبا بك") === "ar");
check("Latin text leaves the locale unset", detectLocale("Hello from ZYRAXON.") === undefined);
check(
  "a mostly-Bengali answer with English words stays Bengali",
  detectLocale("আমি একটি ZYRAXON মডেল with some English.") === "bn",
);

// ── sentences must split, so speech can start before the reply ends ─────────
// Short sentences are deliberately joined up to a budget: fewer requests means
// speech starts sooner. What must hold is that nothing is lost and that a long
// answer is still cut into pieces.
const one = intoSentences("First sentence. Second sentence.");
check("short text stays one piece", one.length === 1, JSON.stringify(one));
check(
  "nothing is lost in the split",
  one.join(" ") === "First sentence. Second sentence.",
  one.join(" "),
);
const bangla = intoSentences("প্রথম বাক্য। দ্বিতীয় বাক্য।");
check(
  "a Bengali danda is respected",
  bangla.join(" ") === "প্রথম বাক্য। দ্বিতীয় বাক্য।",
  JSON.stringify(bangla),
);
const many = intoSentences(Array.from({ length: 30 }, (_, i) => `Sentence number ${i}.`).join(" "));
check("a long answer is cut into several pieces", many.length > 1, `${many.length} pieces`);
check(
  "every piece is within the budget",
  many.every((p) => p.length <= 480),
  JSON.stringify(many.map((p) => p.length)),
);
const long = intoSentences("A".repeat(600));
check(
  "a very long sentence is still cut",
  long.length > 1 && long.every((s) => s.length <= 480),
  JSON.stringify(long.map((s) => s.length)),
);
check("empty text produces nothing to say", intoSentences("   ").length === 0);

// ── delivery: prosody, breath, and the shape of a long reply ────────────────
// These are what make the voice sound like a person rather than a machine, and
// they are pure functions, so they can be pinned without the network.
const warm = ssml("bn-BD-NabanitaNeural", "এক, দুই। তিন", "warm");
check("a tone reaches the SSML as prosody", warm.includes("<prosody rate='-3%' pitch='+1Hz'"), warm);
check(
  "the voice and language are on the SSML",
  warm.includes("<voice name='bn-BD-NabanitaNeural'>") && warm.includes("xml:lang='bn-BD'"),
);

// The engine returns *no audio at all* when the SSML contains a pause element.
// This is the check that stops that regression coming back: markup that looks
// like a pause is the one thing that must never be sent.
check(
  "no pause element is ever sent, because the engine silences the whole reply",
  !/<break|<s>|mstts:silence/i.test(warm),
  warm,
);
check(
  "a terminator is separated from the next word, so its pause survives",
  ssml("bn-BD-NabanitaNeural", "এক।দুই", "warm").includes("এক। দুই"),
  ssml("bn-BD-NabanitaNeural", "এক।দুই", "warm"),
);
check(
  "a comma keeps its pause and gains a space",
  ssml("bn-BD-NabanitaNeural", "এক,দুই", "warm").includes("এক, দুই"),
);
check(
  "a sentence terminator is not mangled",
  ssml("en-US-EmmaMultilingualNeural", "One. Two.", "warm").includes("One. Two."),
  ssml("en-US-EmmaMultilingualNeural", "One. Two.", "warm"),
);

const expressive = ssml("en-US-EmmaMultilingualNeural", "Hello, world.", "expressive");
check(
  "expressive is a different delivery, not the same one",
  expressive.includes("rate='+2%'") && expressive.includes("pitch='+3Hz'") && expressive.includes("volume='+4%'"),
  expressive,
);
check(
  "natural leaves the engine's own rate",
  ssml("en-US-EmmaMultilingualNeural", "Hello.", "natural").includes("rate='+0%' pitch='+0Hz'"),
);
check("a misspelled tone becomes the default", normaliseTone("wram") === "warm");
check("a tone is matched case-insensitively", normaliseTone("EXPRESSIVE") === "expressive");
check("no tone at all becomes the default", normaliseTone(null) === "warm");
check("an empty code block says nothing at all", speakable("```\n\n```") === "", JSON.stringify(speakable("```\n\n```")));
check(
  "a number is not split into sentences",
  !ssml("en-US-EmmaMultilingualNeural", "Version 19.0.8 is out", "warm").includes("19. 0"),
  ssml("en-US-EmmaMultilingualNeural", "Version 19.0.8 is out", "warm"),
);
check(
  "a paragraph break is a sentence break",
  speakable("First para.\n\nSecond para.") === "First para. Second para.",
  speakable("First para.\n\nSecond para."),
);
check(
  "a hard-wrapped line is not cut into two sentences",
  speakable("A sentence that was\nwrapped by the editor.") === "A sentence that was wrapped by the editor.",
  speakable("A sentence that was\nwrapped by the editor."),
);
check(
  "a paragraph after a colon is not spoken as a full stop",
  !speakable("Here is how:\n\ncode").includes(":."),
  speakable("Here is how:\n\ncode"),
);
check(
  "a very long reply is cut for streaming",
  chunkTextIntoSentences("এক। ".repeat(600)).length > 1,
  `${chunkTextIntoSentences("এক। ".repeat(600)).length} pieces`,
);

console.log("");
if (failures) {
  console.log(`${failures} CHECK(S) FAILED`);
  process.exit(1);
}
console.log("ALL TTS CHECKS PASSED");

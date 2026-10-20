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
import { pickVoice, speakable, escapeXml, type Voice } from "../src/lib/tts/edge-speech.server";
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
  { name: "en-GB-SoniaNeural", locale: "en-GB", gender: "Female" },
  { name: "bn-BD-NabanitaNeural", locale: "bn-BD", gender: "Female" },
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
  pickVoice("bn-IN", voices) === "bn-IN-BashkarNeural",
  pickVoice("bn-IN", voices),
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

console.log("");
if (failures) {
  console.log(`${failures} CHECK(S) FAILED`);
  process.exit(1);
}
console.log("ALL TTS CHECKS PASSED");

// Proves the relay keeps the connection alive while the upstream is silent.
//
// The mock upstream waits SILENT_MS before its first token — exactly what a
// reasoning model does. The test then asserts that keepalive comments arrive
// during that silence, which is what stops a proxy from dropping the stream.
import { startMock } from "./mock-silent.mjs";

const SILENT_MS = Number(process.env.SILENT_MS || 25_000);
const HEARTBEAT_MS = 2_000; // fast, so the test does not wait ten seconds a ping
const PROBE_MS = 1_000; // short, so the probe times out and the keepalive takes over

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
};

const { server, port } = await startMock({ silentMs: SILENT_MS });
process.env.ZEN_BASE_URL = `http://127.0.0.1:${port}/v1`;
process.env.OPENCODE_ZEN_API_KEY = "test-key";
process.env.ZYRAXON_HEARTBEAT_MS = String(HEARTBEAT_MS);
// Keep the health probe short so the Response is handed back almost at once and
// the keepalive is what covers the silent window. This is the real production
// shape for a slow model: probe times out, caller is connected, pings flow.
process.env.ZYRAXON_PROBE_MS = String(PROBE_MS);

const { brandChatStream } = await import("../src/lib/providers/zyraxon-brand.server");

const served = async (modelId) =>
  modelId === "zyraxon-apex"
    ? {
        brand: { id: "zyraxon-apex", label: "ZYRAXON Apex", preferred: "mock-slow" },
        chain: ["mock-slow"],
      }
    : null;

try {
  const started = Date.now();
  const res = await brandChatStream(
    "zyraxon-apex",
    [{ role: "user", content: "hello" }],
    "test-key",
    { resolve: served },
  );

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let pings = 0;
  let content = "";
  let firstPingAt = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = dec.decode(value, { stream: true });
    for (const line of text.split("\n")) {
      if (line.startsWith(": ")) {
        pings++;
        if (firstPingAt === null) firstPingAt = Date.now() - started;
      }
    }
    if (text.includes("Hello from the slow mock")) content = text;
  }
  const total = Date.now() - started;

  check(
    "the stream finished with its content",
    content.includes("Hello from the slow mock"),
    content.slice(0, 80),
  );
  check("keepalive comments were sent while the upstream was silent", pings > 0, `${pings} pings`);
  check(
    "the first keepalive arrived before the upstream's first token",
    firstPingAt !== null && firstPingAt < SILENT_MS,
    `first ping at ${firstPingAt}ms, upstream silent for ${SILENT_MS}ms`,
  );
  check(
    "keepalives continued across the silent window",
    pings >= Math.floor(SILENT_MS / HEARTBEAT_MS) - 1,
    `${pings} pings over ${SILENT_MS}ms at ${HEARTBEAT_MS}ms`,
  );
  check("the whole turn completed", total >= SILENT_MS, `${total}ms`);
} finally {
  server.close();
}

console.log(
  "\n" + (failures === 0 ? "ALL HEARTBEAT CHECKS PASSED" : failures + " CHECK(S) FAILED"),
);
process.exit(failures === 0 ? 0 : 1);

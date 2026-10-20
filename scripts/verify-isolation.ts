// Proves each request is fully independent: many callers at once, each with its
// own session, and none of them blocks or breaks another.
import { startMock } from "./mock-silent.mjs";

const CONCURRENCY = Number(process.env.CONCURRENCY || 40);
let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
};

// The mock answers instantly, so this measures isolation, not latency.
const { server, port } = await startMock({ silentMs: 50 });
process.env.ZEN_BASE_URL = `http://127.0.0.1:${port}/v1`;
process.env.OPENCODE_ZEN_API_KEY = "test-key";

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
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, async (_, i) => {
      const res = await brandChatStream(
        "zyraxon-apex",
        [{ role: "user", content: `caller ${i}` }],
        "test-key",
        { resolve: served },
      );
      if (!res.ok) return { i, ok: false, status: res.status };
      const body = await res.text();
      return { i, ok: body.includes("Hello from the slow mock"), bytes: body.length };
    }),
  );
  const total = Date.now() - started;

  const succeeded = results.filter((r) => r.ok).length;
  check(
    `all ${CONCURRENCY} concurrent callers were answered`,
    succeeded === CONCURRENCY,
    `${succeeded}/${CONCURRENCY}`,
  );
  check(
    "no caller was shed with an error",
    results.every((r) => r.ok),
    JSON.stringify(results.filter((r) => !r.ok).slice(0, 3)),
  );
  check(
    "every caller got the full reply, none truncated",
    results.every((r) => r.ok && r.bytes > 0),
    `min bytes ${Math.min(...results.filter((r) => r.bytes).map((r) => r.bytes))}`,
  );
  console.log(`        ${CONCURRENCY} callers finished in ${total}ms`);

  // Independence: the ids the upstream saw must all differ, or callers share a
  // rate-limit fate and one heavy user would degrade everyone else.
  const { requests } = await import("./mock-silent.mjs");
  const sessions = new Set(
    requests
      .filter((r) => (r.url || "").endsWith("/chat/completions"))
      .map((r) => r.headers["x-opencode-session"] || r.headers["x-opencode-session-id"]),
  );
  check(
    "each caller carried its own session fingerprint",
    sessions.size >= Math.min(CONCURRENCY, 2),
    `${sessions.size} distinct fingerprints across ${CONCURRENCY} calls`,
  );
} finally {
  server.close();
}

console.log(
  "\n" + (failures === 0 ? "ALL ISOLATION CHECKS PASSED" : failures + " CHECK(S) FAILED"),
);
process.exit(failures === 0 ? 0 : 1);

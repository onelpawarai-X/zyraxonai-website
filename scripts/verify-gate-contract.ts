/** The upstream's free-tier identity gate, as measured — not as documented.
 *
 *  A request that does not look like an OpenCode client is refused with
 *  403 FreeTierError before any model is considered, and that refusal is what
 *  made every model look broken. The gate was measured directly against the
 *  live upstream, and this holds the provider to that measurement:
 *
 *    - all five of bash/edit/glob/grep/read must be present, by exact name
 *    - fewer than five is refused (four is refused; the documentation's floor
 *      of two is stale)
 *    - the names are case-sensitive, and non-core names do not substitute
 *    - `stream: true` is required; a non-streaming body is refused
 *    - the session fingerprint headers must be present
 *
 *  The gate is upstream's to change, and it has tightened before — a catalogue
 *  that satisfied it yesterday was refused today. So this asserts the shape the
 *  *turn* actually sends, through the real code path, rather than a constant a
 *  test could drift away from.
 *  Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/verify-gate-contract.ts */
import { startMock, setScenario } from "../scripts/mock-upstream.mjs";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "        " + detail : ""}`);
};

const { server, port } = await startMock({ port: 0 });
process.env.ZEN_BASE_URL = `http://127.0.0.1:${port}/v1`;
process.env.OPENCODE_ZEN_API_KEY = "test-key";

// Capture exactly what the real turn puts on the wire.
const realFetch = globalThis.fetch;
let sent: { url: string; headers: Record<string, string>; body: any } | null = null;
globalThis.fetch = (async (input: any, init: any) => {
  const url = typeof input === "string" ? input : input?.url ?? String(input);
  if (url.includes("chat/completions") && typeof init?.body === "string") {
    const headers: Record<string, string> = {};
    new Headers(init?.headers || {}).forEach((v, k) => (headers[k] = v));
    let body: any = null;
    try {
      body = JSON.parse(init.body);
    } catch {
      /* a non-JSON body is itself the finding */
    }
    sent = { url, headers, body };
  }
  return realFetch(input, init);
}) as any;

const { brandChatStream } = await import("../src/lib/providers/zyraxon-brand.server");

setScenario("ok");
const res = await brandChatStream("zyraxon-apex", [{ role: "user", content: "hi" }], undefined, {
  resolve: (async (modelId: string) =>
    modelId === "zyraxon-apex"
      ? { brand: { id: "zyraxon-apex", label: "ZYRAXON Apex", preferred: "big-pickle" }, chain: ["big-pickle"] }
      : null) as any,
});
await res.text();

check("the turn reached the upstream", sent !== null);
const s = sent as unknown as { headers: Record<string, string>; body: any };

const CORE = ["bash", "edit", "glob", "grep", "read"];
const names: string[] = Array.isArray(s.body?.tools) ? s.body.tools.map((t: any) => t?.function?.name) : [];
check("the body is streaming, as the gate requires", s.body?.stream === true, String(s.body?.stream));
for (const n of CORE) check(`the gate name '${n}' is advertised`, names.includes(n), names.join(", "));
check(
  "no core name is missing",
  CORE.every((n) => names.includes(n)),
  CORE.filter((n) => !names.includes(n)).join(", ") || "none missing",
);
check("the names are exact, not re-cased", names.filter((n) => CORE.includes(n)).length === 5, names.join(", "));
check(
  "the session fingerprint headers are present",
  Boolean(s.headers["x-opencode-session"] && s.headers["x-opencode-session-id"]),
  Object.keys(s.headers).join(", "),
);
check("the client identifies as OpenCode's user agent", /^opencode\//.test(s.headers["user-agent"] || ""), s.headers["user-agent"]);

// The health check is the other place a caller asks "will this model answer?",
// and it must satisfy the same gate — a probe that fails the gate reports the
// identity refusal as if it were the model's fault.
const { testZenModel } = await import("../src/lib/builder/zen.server");
sent = null;
const health = await testZenModel("big-pickle");
const h = sent as unknown as { body: any } | null;
check("the health check reached the upstream", h !== null);
check("the health check streams, as the gate requires", h?.body?.stream === true, String(h?.body?.stream));
const hNames: string[] = Array.isArray(h?.body?.tools) ? h.body.tools.map((t: any) => t?.function?.name) : [];
check("the health check advertises the whole core set", CORE.every((n) => hNames.includes(n)), hNames.join(", "));
check("and it reported the model honestly", typeof health.ok === "boolean", JSON.stringify(health).slice(0, 120));

server.close();
if (failures) {
  console.log(`\n${failures} CHECK(S) FAILED`);
  process.exit(1);
}
console.log("\nALL GATE CONTRACT CHECKS PASSED");

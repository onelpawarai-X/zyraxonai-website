// True end-to-end: the real transport (AI SDK streamText -> zenFetch ->
// egressFetch -> fetch) against a real local HTTP server that enforces the
// exact gate conditions the upstream documents. Only the network is fake.
// Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/verify-e2e.ts
import { startMock, requests, setScenario } from "../scripts/mock-upstream.mjs";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "        " + detail : ""}`);
};

const served = (id: string, chain: string[]) =>
  (async (modelId: string) =>
    modelId === id ? { brand: { id, label: "ZYRAXON Apex", preferred: chain[0] }, chain } : null) as any;

const drain = (res: Response) => res.text();

async function load() {
  // Point the transport at the mock before the module graph reads ZEN_BASE.
  const { server, port } = await startMock({ port: 0 });
  process.env.ZEN_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.OPENCODE_ZEN_API_KEY = "test-key";
  const { brandChatStream } = await import("../src/lib/providers/zyraxon-brand.server");
  return { server, brandChatStream };
}

const {
  server,
  brandChatStream,
} = await load();

try {
  // -----------------------------------------------------------------
  // E2E-1: happy path. Transport streams chunks relayed under our label,
  // and the mock proves the exact gate headers/tools were sent.
  // -----------------------------------------------------------------
  setScenario("ok");
  {
    const res = await brandChatStream(
      "zyraxon-apex",
      [{ role: "user", content: "hello" }],
      "test-key",
      undefined,
      { resolve: served("zyraxon-apex", ["beam-free"]) },
    );
    const body = await drain(res);
    const visit = requests.filter((r) => r.url.endsWith("/chat/completions")).slice(-1)[0];
    check("E2E happy path returns 200", res.status === 200, res.status);
    check("the SSE body carries both chunks", body.includes("Hello from the mock") && body.includes("upstream."), body.slice(0, 120));
    check("frames are labelled ZYRAXON Apex, not the upstream", body.includes("ZYRAXON Apex"), body.slice(0, 120));
    check("no upstream id appears in the frame", !body.includes("beam-free"));
    check("exactly one upstream call was made", requests.filter((r) => r.url.endsWith("/chat/completions")).length === 1);
    check("User-Agent is pinned to the gate value", /opencode\/1\.19\.0/.test(String(visit.headers["user-agent"])));
    check("x-opencode-session is present", Boolean(visit.headers["x-opencode-session"]));
    check("x-opencode-session-id is present", Boolean(visit.headers["x-opencode-session-id"]));
    const json = JSON.parse(visit.body);
    check("the request body names the upstream model", json.model === "beam-free", json.model);
    check("the gate-satisfying read tool is advertised", Array.isArray(json.tools) && json.tools.some((t: any) => t?.function?.name === "read"));
    check("the payload carries the user message", JSON.stringify(json).includes("hello"));
  }

  // -----------------------------------------------------------------
  // E2E-2: the preferred model is retired (404): the real transport must
  // loop the chain and serve the sibling under the same brand label.
  // -----------------------------------------------------------------
  setScenario("retire-first");
  {
    requests.length = 0;
    const res = await brandChatStream(
      "zyraxon-apex",
      [{ role: "user", content: "hi" }],
      undefined,
      { resolve: served("zyraxon-apex", ["beam-free", "big-pickle"]) },
    );
    const body = await drain(res);
    const visited = requests
      .filter((r) => r.url.endsWith("/chat/completions"))
      .map((v) => JSON.parse(v.body).model);
    check("E2E retirement falls through to the sibling", res.status === 200, res.status);
    check("the preferred model was tried first", visited[0] === "beam-free", visited[0]);
    check("the sibling was tried second", visited[1] === "big-pickle", visited[1]);
    check("the body is the sibling reply, still under our label", body.includes("ZYRAXON Apex"));
    check("no upstream id leaks into the visible stream", !body.includes("big-pickle"));
  }

  // -----------------------------------------------------------------
  // E2E-3: credential gate. Everything answers 403; the turn must come
  // back 503 upstream_gate (not 502) and name the brand, not the pool.
  // -----------------------------------------------------------------
  setScenario("gate-all");
  {
    requests.length = 0;
    const res = await brandChatStream(
      "zyraxon-apex",
      [{ role: "user", content: "hi" }],
      undefined,
      { resolve: served("zyraxon-apex", ["beam-free", "big-pickle"]) },
    );
    const body = await res.json();
    check("E2E full gate answers 503", res.status === 503, res.status);
    check("the error type is the gate, not unavailability", body.error.type === "upstream_gate", body.error.type);
    check("the gate stops before burning the whole chain", requests.filter((r) => r.url.endsWith("/chat/completions")).length === 1);
    check("the brand is named, not the upstream", body.error.model === "zyraxon-apex");
    check("the message says what is actually wrong", /OPENCODE_ZEN_API_KEY/.test(body.error.message));
  }
  // -----------------------------------------------------------------
  // E2E-4: an audio turn has no AI-SDK part, so it must go out on the raw
  // wire path. The upstream must receive `input_audio`, and the reply must
  // still be labelled as the ZYRAXON brand.
  // -----------------------------------------------------------------
  setScenario("ok");
  {
    requests.length = 0;
    const audio = [
      {
        role: "user",
        content: [
          { type: "text", text: "transcribe" },
          { type: "input_audio", input_audio: { data: "AAAA", format: "wav" } },
        ],
      },
    ];
    const res = await brandChatStream(
      "zyraxon-apex",
      audio as any,
      "test-key",
      { resolve: served("zyraxon-apex", ["beam-free"]) },
    );
    const body = await drain(res);
    const visit = requests.filter((r) => r.url.endsWith("/chat/completions")).slice(-1)[0];
    check("E2E audio turn is answered on the wire path", res.status === 200, res.status);
    check("the upstream received the raw audio part", /"input_audio"/.test(visit.body), visit.body.slice(0, 200));
    check("the reply is still labelled with the brand", body.includes("ZYRAXON Apex"), body.slice(0, 80));
  }

  // -----------------------------------------------------------------
  // E2E-5: the non-streaming wire path. A `stream: false` audio turn must
  // drain the upstream SSE and answer with one `chat.completion` object,
  // not a stream.
  // -----------------------------------------------------------------
  setScenario("ok");
  {
    requests.length = 0;
    const audio = [
      {
        role: "user",
        content: [{ type: "input_audio", input_audio: { data: "AAAA", format: "wav" } }],
      },
    ];
    const res = await brandChatStream(
      "zyraxon-apex",
      audio as any,
      "test-key",
      { stream: false, resolve: served("zyraxon-apex", ["beam-free"]) },
    );
    const json = await res.json();
    check("E2E non-streaming wire turn answers 200", res.status === 200, res.status);
    check("the body is a chat.completion object", json.object === "chat.completion", json.object);
    check(
      "the drained text is assembled from the chunks",
      json.choices?.[0]?.message?.content === "Hello from the mock upstream.",
      json.choices?.[0]?.message?.content,
    );
    check("the finish reason is carried through", json.choices?.[0]?.finish_reason === "stop", json.choices?.[0]?.finish_reason);
  }

} finally {
  server.close();
}

console.log("\n" + (failures === 0 ? "ALL E2E CHECKS PASSED" : failures + " CHECK(S) FAILED"));
process.exit(failures === 0 ? 0 : 1);

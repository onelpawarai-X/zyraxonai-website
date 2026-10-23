// A real HTTP server that speaks the OpenAI-compatible shape, used to prove the
// transport end to end without touching the network. It also enforces the same
// gate conditions the upstream does, so a passing test means the headers and the
// tool array are actually correct.
import { createServer } from "node:http";

export const requests = [];

// A single mock instance serves every scenario by switching mutable state, so
// the transport can be pointed at one fixed base URL for the whole run.
let scenario = "ok";
export function setScenario(s) {
  scenario = s;
}

export function startMock({ port = 0 } = {}) {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const url = req.url || "";
      requests.push({ url, headers: req.headers, body });
      if (url.endsWith("/models")) return models(res);
      if (!url.endsWith("/chat/completions")) return json(res, 404, { error: { message: "no route" } });
      gate(req, res, body);
    });
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function json(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function models(res) {
  json(res, 200, { object: "list", data: [{ id: "big-pickle" }, { id: "beam-free" }] });
}

// The gate: exactly the conditions the real upstream documents.
function gate(req, res, raw) {
  if (scenario === "gate-all") {
    return json(res, 403, {
      error: { message: "FreeTierError: credential gate", type: "FreeTierError" },
    });
  }
  const h = req.headers;
  const problems = [];
  if (!/^opencode\/1\.19\.0$/.test(String(h["user-agent"] || ""))) problems.push("user-agent");
  if (!h["x-opencode-session"]) problems.push("x-opencode-session");
  if (!h["x-opencode-session-id"]) problems.push("x-opencode-session-id");
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { problems.push("json"); }
  if (parsed && !Array.isArray(parsed.tools)) problems.push("tools-array");
  if (parsed && Array.isArray(parsed.tools) && !parsed.tools.some((t) => t?.function?.name === "read")) {
    problems.push("read-tool");
  }
  if (problems.length) {
    return json(res, 403, {
      error: { message: "FreeTierError: " + problems.join(","), type: "FreeTierError" },
      _debug: {
        problems,
        tools: parsed && parsed.tools,
        keys: parsed ? Object.keys(parsed) : [],
      },
    });
  }
  if (scenario === "retire-first") {
    const m = parsed?.model;
    if (m === "beam-free") return json(res, 404, { error: { message: "model not found" } });
  }
  if (scenario === "quota-all") {
    // Every model is valid but the account's free window is spent: the upstream
    // answers 429 with its own words. This is not an outage and must not be
    // reported as one — the caller needs to know the pool is intact and the
    // quota is what ran out.
    return json(res, 429, {
      error: {
        message: "Free usage limit reached. Subscribe to OpenCode Go to keep going: https://opencode.ai/go",
        type: "FreeUsageLimitError",
      },
    });
  }
  if (scenario === "media-denial") {
    // A model that never received the media still answers 200 with a refusal.
    // The first upstream refuses; the second answers, so a caller must see the
    // second's answer and never the refusal.
    if (parsed?.model === "beam-free") return streamText(res, parsed, "No audio came through with your message — the only thing I received was text.");
  }
  if (scenario === "media-denial-reasoning") {
    // The same refusal, but behind a long reasoning preamble. The peek that
    // decides whether to keep the answer must read the answer, not the
    // reasoning: counting reasoning against its budget spends the whole budget
    // before the refusal appears, and the refusal then reaches the caller.
    if (parsed?.model === "beam-free") {
      return streamReasoningThenText(
        res,
        parsed,
        Array.from({ length: 40 }, (_, i) => `thinking step ${i} about the audio and what it might contain`),
        "No audio came through with your message — the only thing I received was text.",
      );
    }
  }
  stream(res, parsed);
}

/** Stream a reasoning preamble, then a fixed answer, in the upstream's shape. */
function streamReasoningThenText(res, parsed, reasoning, text) {
  const id = "chatcmpl-mock";
  const model = parsed && parsed.model;
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const chunk = (delta, finish) => ({ id, object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: finish }], model });
  for (const r of reasoning) {
    res.write("data: " + JSON.stringify(chunk({ content: "", reasoning: r + " " }, null)) + "\n\n");
  }
  res.write("data: " + JSON.stringify(chunk({ content: text }, null)) + "\n\n");
  res.write("data: " + JSON.stringify(chunk({}, "stop")) + "\n\n");
  res.end();
}

/** Stream a single fixed answer, in the same SSE shape as `stream`. */
function streamText(res, parsed, text) {
  const id = "chatcmpl-mock";
  const model = parsed && parsed.model;
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const chunk = (delta, finish) => ({ id, object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: finish }], model });
  res.write("data: " + JSON.stringify(chunk({ content: text }, null)) + "\n\n");
  res.write("data: " + JSON.stringify(chunk({}, "stop")) + "\n\n");
  res.end();
}

function sse(res, obj) {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  res.write("data: " + JSON.stringify(obj) + "\n\n");
}
function stream(res, parsed) {
  const id = "chatcmpl-mock";
  const model = parsed && parsed.model;
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const chunk = (delta, finish) => ({ id, object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: finish }], model });
  res.write("data: " + JSON.stringify(chunk({ content: "Hello from the mock " }, null)) + "\n\n");
  res.write("data: " + JSON.stringify(chunk({ content: "upstream." }, null)) + "\n\n");
  res.write("data: " + JSON.stringify(chunk({}, "stop")) + "\n\n");
  res.end();
}

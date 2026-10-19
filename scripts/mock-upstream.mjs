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
  stream(res, parsed);
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

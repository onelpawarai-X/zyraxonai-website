// An OpenAI-compatible mock that stays silent for a while before its first
// token, the way a reasoning model does. Used to prove the relay's heartbeat
// keeps the connection alive across that silence.
import { createServer } from "node:http";

export const requests = [];

export function startMock({ silentMs = 20_000 } = {}) {
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      requests.push({ url: req.url || "", headers: req.headers, body: raw });
      if ((req.url || "").endsWith("/models")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ object: "list", data: [{ id: "mock-slow" }] }));
      }
      if (!(req.url || "").endsWith("/chat/completions")) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      const frame = (text) =>
        "data: " +
        JSON.stringify({
          object: "chat.completion.chunk",
          model: "mock-slow",
          choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
        }) +
        "\n\n";
      // Silence first: no bytes at all for `silentMs`.
      setTimeout(() => {
        res.write(frame("Hello from the slow mock"));
        res.write(
          "data: " +
            JSON.stringify({
              object: "chat.completion.chunk",
              model: "mock-slow",
              choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            }) +
            "\n\n",
        );
        res.end();
      }, silentMs);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

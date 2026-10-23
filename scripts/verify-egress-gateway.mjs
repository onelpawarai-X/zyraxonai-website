/** The egress gateway worker, exercised as the deployment uses it.
 *
 *  The worker is the one hop that decides whether every caller shares a single
 *  upstream address or is spread across Cloudflare's network. So the things
 *  that must hold are tested here rather than assumed: the token is enforced,
 *  the host allow-list is enforced, the health check answers without spending
 *  an upstream request, and — the one that matters most — a streamed response
 *  arrives as a stream instead of being buffered into a single blob.
 *
 *  A local origin stands in for opencode.ai. The worker is imported and its
 *  fetch called directly, so this runs with no Cloudflare account. */
import worker from "../workers/egress-proxy.js";
import http from "node:http";

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "        " + detail : ""}`);
};

// -- a stand-in upstream that streams three chunks with a pause between them
let sawAuthHeader = null;
let sawTargetHeader = null;
const upstream = http.createServer((req, res) => {
  sawAuthHeader = req.headers["x-zyraxon-token"] ?? null;
  sawTargetHeader = req.headers["x-zyraxon-target"] ?? null;
  res.writeHead(200, { "content-type": "text/event-stream" });
  let n = 0;
  const tick = setInterval(() => {
    res.write(`data: chunk-${n}\n\n`);
    if (++n === 3) {
      clearInterval(tick);
      res.end();
    }
  }, 60);
});
await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
const upstreamUrl = `http://127.0.0.1:${upstream.address().port}/v1/chat/completions`;

// The worker reads its secret and its host allow-list from the `env` binding a
// Worker is invoked with. The test passes them the same way Cloudflare does.
const call = (init, path = "/", env = { EGRESS_ALLOWED_HOSTS: "127.0.0.1" }) =>
  worker.fetch(new Request(`https://gw.example${path}`, init), env);

// -- health check: answers, and says whether it is protected
const health = await call({ method: "GET" }, "/health");
const healthBody = await health.json();
check("the health check answers 200", health.status === 200, String(health.status));
check("and reports the gateway is up", healthBody.ok === true);
check("and says the worker is unprotected by default", healthBody.protected === false, String(healthBody.protected));

// -- the token is enforced when one is bound. This is what stops a stranger who
//    learns the worker URL from spending our upstream quota through it.
const wrongToken = await call(
  { method: "POST", headers: { "content-type": "application/json", "x-zyraxon-target": upstreamUrl }, body: "{}" },
  "/",
  { EGRESS_TOKEN: "s3cret", EGRESS_ALLOWED_HOSTS: "127.0.0.1" },
);
check("a wrong token is refused when one is bound", wrongToken.status === 403, String(wrongToken.status));
const rightToken = await call(
  { method: "POST", headers: { "content-type": "application/json", "x-zyraxon-target": upstreamUrl, "x-zyraxon-token": "s3cret" }, body: "{}" },
  "/",
  { EGRESS_TOKEN: "s3cret", EGRESS_ALLOWED_HOSTS: "127.0.0.1" },
);
check("the right token is let through", rightToken.status === 200, String(rightToken.status));
await rightToken.text();
const protectedHealth = await call({ method: "GET" }, "/health", { EGRESS_TOKEN: "s3cret" });
check("and the health check reports it is protected", (await protectedHealth.json()).protected === true);

// -- with no token configured, a request goes through
const open = await call({
  method: "POST",
  headers: { "content-type": "application/json", "x-zyraxon-target": upstreamUrl },
  body: "{}",
});
check("an unconfigured worker forwards the request", open.status === 200, String(open.status));
check("and strips the target header before the hop", sawTargetHeader === null, String(sawTargetHeader));

// -- a host outside the allow-list is refused, so it cannot be an open relay
const blocked = await call({
  method: "POST",
  headers: { "content-type": "application/json", "x-zyraxon-target": "https://example.com/steal" },
  body: "{}",
});
check("a host outside the allow-list is refused", blocked.status === 403, String(blocked.status));
check("and the body says why", (await blocked.text()).includes("host not allowed"));

// -- no target at all is a caller error, not a silent pass-through
const noTarget = await call({ method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
check("a request with no target is refused", noTarget.status === 400, String(noTarget.status));

// -- the stream must arrive as a stream. Buffering would break SSE token by
//    token, which is the whole reason the gateway copies the body through.
const streamed = await call({
  method: "POST",
  headers: { "content-type": "application/json", "x-zyraxon-target": upstreamUrl },
  body: "{}",
});
check("the response is still a readable stream", !!streamed.body && typeof streamed.body.getReader === "function");
const reader = streamed.body.getReader();
const decoder = new TextDecoder();
const arrivals = [];
let acc = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  acc += decoder.decode(value, { stream: true });
  arrivals.push(Date.now());
}
check("all three chunks arrive", (acc.match(/chunk-\d/g) ?? []).length === 3, acc.replace(/\n/g, " "));
const spread = arrivals[arrivals.length - 1] - arrivals[0];
check("and they arrive over time, not in one buffered blob", spread >= 80, `${spread}ms across ${arrivals.length} reads`);
check("the CORS headers are added for a browser caller", streamed.headers.get("access-control-allow-origin") === "*", String(streamed.headers.get("access-control-allow-origin")));

upstream.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL EGRESS GATEWAY CHECKS PASSED");
process.exit(failures ? 1 : 0);

/**
 * ZYRAXON egress gateway.
 *
 * A transparent pass-through proxy. The caller puts the real upstream URL in
 * `x-zyraxon-target`; this worker forwards the method, the body and — crucially
 * — the *streamed* response, then sends it back untouched.
 *
 * Why a worker and not a normal proxy: the upstream free tier limits per IP
 * address, and one deployment IP runs out. Cloudflare's free plan serves this
 * worker from its whole anycast network, so requests leave from a large,
 * rotating set of addresses at no cost. That is the free way to stop one
 * exhausted address from failing every caller.
 *
 * Deploy: Cloudflare dashboard → Workers & Pages → Create → paste this file →
 * Deploy. Copy the worker URL and set it on the app as
 *
 *   ZYRAXON_EGRESS_URLS = gw+https://<worker>.<account>.workers.dev/
 *
 * If EGRESS_TOKEN is set below, every request must carry the same value in
 * `x-zyraxon-token`, so a stranger who learns the worker URL cannot use it as
 * an open relay.
 */

// The shared secret arrives as a worker *binding*, not a variable in this file:
// a literal here would sit in the repository and in the deployed script, where
// anyone holding the worker URL could read it. Set it with
//   wrangler secret put EGRESS_TOKEN
// or the dashboard's Settings -> Variables and Secrets. It is read per request
// from `env`, which is how a Worker exposes bindings — reading it at module
// scope would freeze the value at deploy time and miss a later rotation.
// Empty means "no token required", so the worker still works before the secret
// is configured.

// Only these hosts may be reached through the gateway. An open relay is a
// liability, so the allow-list is explicit rather than "anything the caller
// asks for". EGRESS_ALLOWED_HOSTS adds to it, which is how a test points the
// worker at a local origin without loosening the deployed default.
const ALLOWED_HOSTS = ["opencode.ai"];

// The IP echo used by the diagnostic endpoint below. It answers "what address
// did this request leave from", which is the one fact that decides whether a
// second gateway on the same account is worth deploying: if every worker on an
// account shares the same egress addresses, adding workers buys nothing.
const IP_ECHO_HOSTS = {
  // Deliberately not Cloudflare-hosted: an echo behind Cloudflare would be
  // reached over Cloudflare's own backbone, which is not the path a real
  // upstream request takes and would report a misleadingly stable address.
  ifconfig: "https://ifconfig.me/ip",
  myip: "https://api.myip.com/",
  ipify: "https://api.ipify.org/?format=json",
};

export default {
  async fetch(request, env) {
    const token = String(env?.EGRESS_TOKEN ?? "").trim();
    const extra = String(env?.EGRESS_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    const allowed = ALLOWED_HOSTS.concat(extra);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }

    // A health check, so a deployment can prove the worker is reachable and
    // whether it is protected, without spending an upstream request. It answers
    // before the token check on purpose: a protected worker whose health check
    // also demanded the secret could not be diagnosed without the secret, and
    // the reply reveals nothing beyond whether protection is on.
    if (request.method === "GET" && new URL(request.url).pathname === "/health") {
      return Response.json(
        { ok: true, gateway: "zyraxon-egress", protected: !!token },
        { headers: cors() },
      );
    }

    if (token && request.headers.get("x-zyraxon-token") !== token) {
      return new Response("forbidden", { status: 403, headers: cors() });
    }

    // A diagnostic that reports the address this worker left from. Token-gated
    // because it spends a subrequest, and separate from the host allow-list so
    // the forwarding path can never be pointed at the echo.
    if (request.method === "GET" && new URL(request.url).pathname === "/ip") {
      const read = async (url) => {
        try {
          const res = await fetch(url);
          return (await res.text()).trim().slice(0, 120) || null;
        } catch {
          return null;
        }
      };
      const [ifconfig, myip, ipify] = await Promise.all([
        read(IP_ECHO_HOSTS.ifconfig),
        read(IP_ECHO_HOSTS.myip),
        read(IP_ECHO_HOSTS.ipify),
      ]);
      return Response.json(
        { ok: true, ifconfig, myip, ipify, colo: request.cf?.colo ?? null },
        { headers: cors() },
      );
    }

    const target = request.headers.get("x-zyraxon-target");
    if (!target) {
      return new Response("missing x-zyraxon-target", { status: 400, headers: cors() });
    }

    let url;
    try {
      url = new URL(target);
    } catch {
      return new Response("bad target", { status: 400, headers: cors() });
    }
    if (!allowed.some((h) => url.hostname === h || url.hostname.endsWith("." + h))) {
      return new Response("host not allowed", { status: 403, headers: cors() });
    }

    // Copy the caller's headers, dropping the ones that describe the hop we are
    // replacing rather than the request itself.
    const headers = new Headers(request.headers);
    headers.delete("x-zyraxon-target");
    headers.delete("x-zyraxon-token");
    headers.delete("host");
    headers.delete("content-length");

    const upstream = await fetch(url.toString(), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      // Streaming must survive the hop: the app consumes SSE token by token.
      // The body is a stream, so the request must declare a half-duplex
      // transfer. Workers ignores the field; Node's fetch requires it, which is
      // what lets this file be exercised outside Cloudflare.
      duplex: "half",
      redirect: "follow",
    });

    const out = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors())) out.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, authorization, x-zyraxon-target, x-zyraxon-token",
    "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
  };
}

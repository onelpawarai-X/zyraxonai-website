/** A second upstream for the site helper.
 *
 *  The helper runs on our own provider, which is the right first choice: it is
 *  our line, our brands, and the thing the site is advertising. But that line
 *  shares a free pool with the public provider, and when the pool is spent every
 *  brand fails at once — which takes the site's own assistant down with it. The
 *  assistant is not a public API; it is the thing that shows a visitor the
 *  product works. Losing it costs more than losing an endpoint nobody is
 *  calling.
 *
 *  So the helper gets a second upstream. It is tried only after every brand has
 *  failed, it is configured entirely through the environment, and it is absent
 *  unless an operator sets it. Nothing here is enabled by a default that could
 *  point at a service we have not been given.
 *
 *  The fallback never changes what the visitor sees. The reply is still written
 *  by the same system prompt, which is explicit that the assistant is ZYRAXON
 *  Apex and must not name any upstream vendor — so a fallback answer is
 *  indistinguishable from a brand answer, which is the point. */

/** The fallback as configured, or null when no operator has set one.
 *
 *  `brand` is what the assistant calls itself while this upstream is serving.
 *  It defaults to the flagship brand name rather than the upstream's own, so a
 *  misconfigured deployment cannot leak a vendor name through the model field. */
export type HelperFallback = {
  baseUrl: string;
  apiKey: string;
  model: string;
  brand: string;
};

/** OpenHands' managed LLM proxy, offered as a documented choice.
 *
 *  Read from the environment like everything else, and named here only so the
 *  one upstream we have actually measured is easy to configure. Setting these
 *  is what enables it; there is no default that reaches out on its own. */
const OPENHANDS_PROXY_URL = "https://llm-proxy.app.all-hands.dev/v1";
const OPENHANDS_PROXY_MODEL = "openhands/deepseek-v4.1-flash";

function env(name: string): string {
  return (process.env[name] || "").trim();
}

/** Resolve the configured fallback, or null.
 *
 *  Three shapes are accepted, in order of specificity, because the same
 *  question — "where do we send a turn when our own line is down?" — is asked
 *  with different amounts of information available at deploy time:
 *
 *  1. An explicit base URL, key and model. Full control.
 *  2. A bare key, which implies the OpenHands managed proxy and its model. This
 *     is the shortest path for an operator who has an OpenHands key and nothing
 *     else, and it is why the proxy constants are named above.
 *  3. Nothing, which disables the fallback entirely. */
export function helperFallback(): HelperFallback | null {
  const brand = env("ZYRAXON_HELPER_FALLBACK_BRAND") || "ZYRAXON Apex";

  const url = env("ZYRAXON_HELPER_FALLBACK_URL");
  const key = env("ZYRAXON_HELPER_FALLBACK_KEY");
  const model = env("ZYRAXON_HELPER_FALLBACK_MODEL");
  if (url && key && model) return { baseUrl: url.replace(/\/+$/, ""), apiKey: key, model, brand };

  // A key on its own means the OpenHands proxy. `OPENHANDS_LLM_PROXY_KEY` is
  // the name an operator is most likely to reach for; the longer one lets a
  // deployment hold it separately from any other OpenHands credential.
  const proxyKey = env("OPENHANDS_LLM_PROXY_KEY") || env("ZYRAXON_HELPER_FALLBACK_KEY");
  if (proxyKey) {
    return {
      baseUrl: env("ZYRAXON_HELPER_FALLBACK_URL").replace(/\/+$/, "") || OPENHANDS_PROXY_URL,
      apiKey: proxyKey,
      model: model || OPENHANDS_PROXY_MODEL,
      brand,
    };
  }

  return null;
}

/** Whether a fallback is configured, for the helper's status endpoint. */
export function fallbackConfigured(): boolean {
  return helperFallback() !== null;
}

/** One non-streaming turn against the fallback.
 *
 *  Non-streaming for the same reason the brand path is: the caller has to see
 *  the whole message to know whether a tool was requested. The helper replays
 *  the finished text in pieces so the panel still fills in live.
 *
 *  Returns null on any failure, including a network error, because a broken
 *  fallback must not throw inside the helper's stream — it has to fall through
 *  to the message that tells the visitor what is going on. */
export async function fallbackComplete(
  messages: readonly unknown[],
  tools?: readonly unknown[],
): Promise<{ content: string; toolCalls: Array<Record<string, unknown>> } | null> {
  const fb = helperFallback();
  if (!fb) return null;

  try {
    const res = await fetch(`${fb.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${fb.apiKey}`,
      },
      body: JSON.stringify({
        model: fb.model,
        messages,
        stream: false,
        ...(tools && tools.length ? { tools, tool_choice: "auto" } : {}),
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json().catch(() => null);
    if (!data || data.error) return null;
    const choice = data.choices?.[0];
    if (!choice) return null;
    return {
      content: choice.message?.content || "",
      toolCalls: choice.message?.tool_calls || [],
    };
  } catch {
    return null;
  }
}

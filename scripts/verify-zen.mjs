/** Keyless-first Zen verification: free pool must work with NO API key (UA-patched requests). */
const endpoint = "https://opencode.ai/inference/v1/chat/completions";
const key = process.env.OPENCODE_ZEN_API_KEY || process.env.OPENCODE_API_KEY;
const model = process.env.ZEN_MODEL || "big-pickle";
const headers = {
  "Content-Type": "application/json",
  "User-Agent": "opencode/1.0",
  ...(key ? { Authorization: `Bearer ${key}` } : {}),
};

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30000);
try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      stream: false,
      max_tokens: 64,
      messages: [{ role: "user", content: "Reply with OK." }],
    }),
    signal: controller.signal,
  });
  const text = await response.text();
  console.log(`status=${response.status} keyless=${key ? "no" : "yes"}`);
  console.log(`model=${model}`);
  console.log(text.slice(0, 2000));
  process.exitCode = response.ok ? 0 : 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
}

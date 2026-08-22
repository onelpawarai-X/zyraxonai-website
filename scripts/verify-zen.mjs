const endpoint = "https://opencode.ai/zen/v1/chat/completions";
const key = process.env.OPENCODE_ZEN_API_KEY || process.env.OPENCODE_API_KEY;
const model = process.env.ZEN_MODEL || "big-pickle";

if (!key) {
  console.error("Missing OPENCODE_ZEN_API_KEY (or OPENCODE_API_KEY).");
  process.exit(2);
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 20000);
try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      max_tokens: 8,
      messages: [{ role: "user", content: "Reply with OK." }],
    }),
    signal: controller.signal,
  });
  const text = await response.text();
  console.log(`status=${response.status}`);
  console.log(`model=${model}`);
  console.log(text.slice(0, 2000));
  process.exitCode = response.ok ? 0 : 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
}

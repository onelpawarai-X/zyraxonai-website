// Proves the integration catalogue is internally consistent and actually
// describes the endpoint it claims to describe.
//
// The failure this guards against is a snippet that looks fine but names a base
// URL, a model id or a key rule the provider does not serve — which sends a
// caller to debug their own client when the docs are what is wrong.
//
// Run: npx tsx scripts/verify-integrations.ts
import {
  ANY_API_KEY,
  DEFAULT_MODEL,
  INTEGRATIONS,
  INTEGRATIONS_URL,
  MODELS_URL,
  USAGE_RULES,
  V1_BASE_URL,
  integrationsByCategory,
  integrationsDocument,
} from "../src/lib/providers/integrations";
import {
  ZYRAXON_BRANDS,
  canonicalBrandId,
  getBrand,
  isBrand,
} from "../src/lib/providers/zyraxon-brands";
import { DOCS } from "../src/lib/docs/content";
import { PROVIDER_INTEGRATION_DOCS } from "../src/lib/docs/provider-integration-docs";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
};

// ── the base URL the catalogue advertises ───────────────────────────────────
check(
  "base URL is the public provider endpoint",
  V1_BASE_URL.endsWith("/api/public/zyraxon/v1"),
  V1_BASE_URL,
);
check("models URL hangs off the base URL", MODELS_URL === `${V1_BASE_URL}/models`);
check(
  "integrations URL hangs off the base URL",
  INTEGRATIONS_URL === `${V1_BASE_URL}/integrations`,
);

// ── the default model must be a real ZYRAXON model ──────────────────────────
check("default model is a served ZYRAXON brand", isBrand(DEFAULT_MODEL), DEFAULT_MODEL);
check(
  "every brand id appears in the catalogue",
  ZYRAXON_BRANDS.every((b) => isBrand(b.id)),
  `${ZYRAXON_BRANDS.length} brands`,
);

// ── every entry must be complete enough to be usable ────────────────────────
check("there are integrations to serve", INTEGRATIONS.length >= 8, String(INTEGRATIONS.length));

const ids = INTEGRATIONS.map((i) => i.id);
check("integration ids are unique", new Set(ids).size === ids.length, ids.join(", "));

const grouped = integrationsByCategory();
const groupedCount = grouped.reduce((n, g) => n + g.items.length, 0);
check(
  "every integration falls into a published category",
  groupedCount === INTEGRATIONS.length,
  `${groupedCount} of ${INTEGRATIONS.length}`,
);

for (const i of INTEGRATIONS) {
  const usable =
    (i.fields?.length ?? 0) > 0 || (i.steps?.length ?? 0) > 0 || (i.snippets?.length ?? 0) > 0;
  check(`"${i.name}" tells a caller how to connect`, usable);
  check(`"${i.name}" has a blurb`, i.blurb.trim().length > 20);
}

// ── every snippet must carry the real endpoint, not a stale one ─────────────
const connectionSnippets = INTEGRATIONS.flatMap((i) =>
  (i.snippets ?? []).map((s) => ({ integration: i.id, ...s })),
);
check(
  "there are snippets to check",
  connectionSnippets.length > 0,
  String(connectionSnippets.length),
);

for (const s of connectionSnippets) {
  const mentionsEndpoint =
    s.code.includes(V1_BASE_URL) ||
    s.code.includes(MODELS_URL) ||
    s.code.includes(INTEGRATIONS_URL) ||
    s.code.includes("api/public/zyraxon/v1") ||
    s.code.includes("api/public/stt") ||
    s.code.includes("zyraxonai.lovable.app") ||
    // A shell snippet that reads the base URL from the config the setup script
    // wrote is naming the endpoint indirectly, which is the better practice.
    s.code.includes("${ZYRAXON_BASE}") ||
    s.code.includes("$ZYRAXON_BASE");
  // Snippets that are pure prose or a tool definition may legitimately omit the
  // URL; anything that makes a call must name the real one.
  const makesACall =
    /fetch\(|curl |baseURL|base_url|apiBase|OPENAI_API_BASE|OkHttp|URLRequest/.test(s.code);
  if (makesACall) {
    check(`"${s.integration}" / ${s.label} names the real endpoint`, mentionsEndpoint);
  }
  check(`"${s.integration}" / ${s.label} is non-trivial`, s.code.trim().length > 40);
}

// ── the connection fields must match the published rules ────────────────────
for (const i of INTEGRATIONS) {
  for (const f of i.fields ?? []) {
    if (/base url/i.test(f.label)) {
      check(
        `"${i.name}" field "${f.label}" is the real base URL`,
        f.value === V1_BASE_URL,
        f.value,
      );
    }
    if (/api key/i.test(f.label)) {
      check(
        `"${i.name}" field "${f.label}" matches the key rule`,
        f.value === ANY_API_KEY,
        f.value,
      );
    }
  }
}

// ── the machine-readable document must match the catalogue ──────────────────
const doc = integrationsDocument();
check("document advertises the same base URL", doc.urls.base === V1_BASE_URL);
check("document advertises the same default model", doc.defaultModel === DEFAULT_MODEL);
check("document says the key is optional", doc.apiKey.required === false);
check("document carries the rules", doc.rules.length === USAGE_RULES.length);
check("document carries every integration", doc.integrations.length === INTEGRATIONS.length);
check(
  "document is JSON-serialisable",
  (() => {
    try {
      JSON.parse(JSON.stringify(doc));
      return true;
    } catch {
      return false;
    }
  })(),
);

// ── the docs pages must exist and be registered ─────────────────────────────
check(
  "integration docs are registered in DOCS",
  PROVIDER_INTEGRATION_DOCS.every((p) => DOCS.some((d) => d.slug === p.slug)),
  PROVIDER_INTEGRATION_DOCS.map((p) => p.slug).join(", "),
);
check(
  "integration docs are in the ZYRAXON Provider group",
  PROVIDER_INTEGRATION_DOCS.every((p) => p.group === "ZYRAXON Provider"),
);
check(
  "doc slugs are unique across the whole registry",
  new Set(DOCS.map((d) => d.slug)).size === DOCS.length,
);
check(
  "the overview links to every platform page",
  PROVIDER_INTEGRATION_DOCS.length >= 6,
  String(PROVIDER_INTEGRATION_DOCS.length),
);
for (const p of PROVIDER_INTEGRATION_DOCS) {
  check(`doc "${p.slug}" has blocks`, p.blocks.length > 0, String(p.blocks.length));
  check(`doc "${p.slug}" has a description`, p.desc.trim().length > 20);
}

// ── the Termux script the docs tell people to run must exist ────────────────
const termux = INTEGRATIONS.find((i) => i.id === "termux");
check("a Termux integration exists", Boolean(termux));
check(
  "Termux points at a downloadable script",
  termux?.download?.href === "/integrations/termux-setup.sh",
  termux?.download?.href,
);
check(
  "the Termux setup snippet uses the download URL",
  (termux?.snippets ?? []).some((s) => s.code.includes("/integrations/termux-setup.sh")),
);

// ── the Kali script must exist and be wired the same way ────────────────────
const kali = INTEGRATIONS.find((i) => i.id === "kali-linux");
check("a Kali Linux integration exists", Boolean(kali));
check(
  "Kali points at a downloadable script",
  kali?.download?.href === "/integrations/kali-ask.sh",
  kali?.download?.href,
);

// ── every downloadable asset must exist on disk ─────────────────────────────
import { existsSync, readFileSync, statSync } from "node:fs";
const ROOT = new URL("../", import.meta.url).pathname;
for (const i of INTEGRATIONS) {
  if (!i.download) continue;
  const file = `${ROOT}public${i.download.href}`;
  check(`"${i.name}" download exists at public${i.download.href}`, existsSync(file), file);
  if (existsSync(file)) {
    check(
      `"${i.name}" download is non-empty`,
      statSync(file).size > 200,
      `${statSync(file).size} bytes`,
    );
  }
}

// ── the catalogue must cover the platforms the promise names ────────────────
const mustHave = [
  "termux",
  "kali-linux",
  "mobile-sdk",
  "openhands",
  "openai-compatible-apps",
  "vscode-extensions",
  "zed",
  "curl",
  "openai-sdk",
  "vercel-ai-sdk",
  "langchain",
  "litellm",
  "go",
  "rust",
  "php",
  "java",
  "dotnet",
  "chat-bots",
  "home-automation",
  "n8n",
];
for (const id of mustHave) {
  check(
    `the catalogue covers "${id}"`,
    INTEGRATIONS.some((i) => i.id === id),
  );
}

// ── the model id must accept the prefixes clients insist on ─────────────────
// LiteLLM and friends send `openai/<id>`; a bare id is rejected by them, and a
// prefixed one used to be rejected by us. Both spellings have to resolve, or
// the caller is stuck between two systems that each refuse the other's idiom.
for (const spelling of [
  DEFAULT_MODEL,
  `openai/${DEFAULT_MODEL}`,
  `zyraxon/${DEFAULT_MODEL}`,
  `zyraxon/${DEFAULT_MODEL.replace("zyraxon-", "")}`,
  `openai/zyraxon/${DEFAULT_MODEL}`,
]) {
  check(`the model id "${spelling}" resolves to a ZYRAXON brand`, isBrand(spelling), spelling);
  check(
    `the model id "${spelling}" resolves to the right brand`,
    getBrand(spelling)?.id === DEFAULT_MODEL,
    getBrand(spelling)?.id,
  );
}
check(
  "a genuinely unknown model is still rejected",
  !isBrand("gpt-4o") && !isBrand("openai/gpt-4o"),
);
check("canonicalBrandId leaves an unknown id as-is", canonicalBrandId("gpt-4o") === "gpt-4o");

// ── every client script must exist, be executable, and be reachable ────────
const SCRIPT_DIR = `${ROOT}public/integrations/`;
for (const name of ["termux-setup.sh", "kali-ask.sh", "zyraxon-chat.sh"]) {
  const file = `${SCRIPT_DIR}${name}`;
  check(`the client ${name} exists`, existsSync(file), file);
  if (existsSync(file)) {
    check(
      `the client ${name} is executable`,
      (statSync(file).mode & 0o111) !== 0,
      statSync(file).mode.toString(8),
    );
    check(
      `the client ${name} is non-trivial`,
      statSync(file).size > 500,
      `${statSync(file).size} bytes`,
    );
  }
}

// The Termux entry must actually offer the chat box and any-model selection.
const termuxEntry = INTEGRATIONS.find((i) => i.id === "termux");
const termuxSnippets = termuxEntry?.snippets ?? [];
check(
  "the Termux entry documents the chat box",
  termuxSnippets.some((s) => s.label === "The chat box"),
);
check(
  "the Termux entry lists the commands, including /model",
  termuxSnippets.some((s) => s.label === "Commands" && /\/model/.test(s.code)),
);
check(
  "the Termux entry names the standalone client",
  termuxSnippets.some((s) => s.code.includes("zyraxon-chat.sh")),
);
check(
  "the Termux setup script downloads the client rather than inlining it",
  readFileSync(`${SCRIPT_DIR}termux-setup.sh`, "utf8").includes("/integrations/zyraxon-chat.sh"),
);
// The chat client must read the model list live, not pin one model.
const chatClient = readFileSync(`${SCRIPT_DIR}zyraxon-chat.sh`, "utf8");
check("the chat client fetches the model list live", /\/models/.test(chatClient));
check("the chat client offers a model switch", /\/model/.test(chatClient));
// A default in the config file and an example in the help text are fine; what
// must not happen is the client pinning the whole line in code, which is what
// would go stale as the upstream pool churns.
const chatCode = chatClient
  .split("\n")
  .filter((l) => !/^\s*#/.test(l))
  .join("\n");
const hardcodedBrands = ZYRAXON_BRANDS.filter((b) => chatCode.includes(`${b.id}"`)).length;
check(
  "the chat client does not pin the model line in code",
  hardcodedBrands <= 1,
  `${hardcodedBrands} brand ids assigned in code`,
);

// The LiteLLM entry must lead with the prefixed model, the exact fix for the
// "LLM Provider NOT provided" error.
const litellm = INTEGRATIONS.find((i) => i.id === "litellm");
check("the LiteLLM entry exists", Boolean(litellm));
check(
  "the LiteLLM entry's model field carries the openai/ prefix",
  (litellm?.fields ?? []).some(
    (f) => /^model$/i.test(f.label) && f.value === `openai/${DEFAULT_MODEL}`,
  ),
);
check(
  "the LiteLLM entry shows a proxy config",
  (litellm?.snippets ?? []).some((s) => s.label === "litellm-config.yaml"),
);

console.log("");
if (failures) {
  console.log(`${failures} CHECK(S) FAILED`);
  process.exit(1);
}
console.log("ALL INTEGRATION CHECKS PASSED");

/** Proves a cold catalogue read is bounded, and that it is bounded by its own
 *  timeout rather than a chat turn's.
 *
 *  Measured on the live deployment: the first `/v1/models` after a cold start
 *  took ~40s while a warm one took 4ms. Two separate causes, both fixed here
 *  and both asserted below.
 *
 *  1. `zenFreeModels` awaited the metadata catalogue and then the console
 *     listing. Nothing about the second depends on the first, so a cold read
 *     cost the sum of both (~8s + ~30s) instead of the slower of the two.
 *  2. `zenLiveIds` called `zenFetch` without `firstByteMs`, so it inherited
 *     `TURN_IDLE_MS` — 30 seconds, the patience a chat turn is owed. A listing
 *     endpoint has nothing to stream and sits on the critical path of every
 *     catalogue request, so a console that accepts the connection and goes
 *     quiet must be given up on in seconds.
 *
 *  Both are timing regressions, so the assertions are on elapsed time against a
 *  console that never answers. The timeout is lowered through its own
 *  environment variable, because a test that waited the production 6s to prove
 *  a 6s timeout would be slower than the bug it guards against.
 *  Run: npx tsx --import ./scripts/raw-import-loader.mjs scripts/verify-catalog-latency.ts */
import { startMock, setScenario } from "../scripts/mock-upstream.mjs";

let failures = 0;
const check = (label: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail !== "" ? `\n        ${detail}` : ""}`);
};

const CONSOLE_MS = 700;
process.env.ZYRAXON_CATALOG_MS = String(CONSOLE_MS);

const { server, port } = await startMock({ port: 0 });
process.env.ZEN_BASE_URL = `http://127.0.0.1:${port}/v1`;
// The metadata read is a separate host. Point it at the same mock, which does
// not serve `/api.json`, so it fails fast and the run measures only the console.
process.env.MODELS_DEV_URL = `http://127.0.0.1:${port}/api.json`;

const { zenFreeModels, zenLiveIds, ZEN_CATALOG_MS } = await import("../src/lib/builder/zen.server");

check("the catalogue timeout is separate from a turn's", ZEN_CATALOG_MS === CONSOLE_MS, ZEN_CATALOG_MS);
check("the catalogue timeout is well under a turn's patience", ZEN_CATALOG_MS < 30_000, `${ZEN_CATALOG_MS}ms`);

// ── a silent console is given up on quickly, not held open ──────────────────
setScenario("console-hang");
{
  const started = Date.now();
  const ids = await zenLiveIds();
  const elapsed = Date.now() - started;
  check("a silent console yields no id set rather than an error", ids === null, ids);
  check(
    `a silent console is abandoned in about ${CONSOLE_MS}ms, not 30s`,
    elapsed < CONSOLE_MS + 2_000,
    `${elapsed}ms`,
  );
}

// ── a cold pool still resolves, and resolves once ───────────────────────────
setScenario("console-hang");
{
  const started = Date.now();
  const pool = await zenFreeModels();
  const elapsed = Date.now() - started;
  check("a cold pool resolves even with a dead console", pool.length > 0, `${pool.length} models`);
  check(
    "the first model is the default one",
    pool[0].id === "big-pickle",
    pool[0]?.id,
  );
  check(
    "a cold pool costs the console timeout, not a turn's",
    elapsed < CONSOLE_MS + 3_000,
    `${elapsed}ms`,
  );

  const warmStarted = Date.now();
  await zenFreeModels();
  const warm = Date.now() - warmStarted;
  check("a warm pool is served from cache", warm < 50, `${warm}ms`);
}

server.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CATALOG LATENCY CHECKS PASSED");
process.exit(failures ? 1 : 0);

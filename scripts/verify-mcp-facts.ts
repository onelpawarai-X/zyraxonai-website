// Fail if any surface still quotes a stale MCP count.
//
// The bug this catches is silent: the catalog is regenerated, the numbers in
// `mcp-facts.generated.ts` move, and every page that carried the old figure as a
// literal goes on serving it. The site spent a long time advertising "108 MCP
// integrations" for a catalog of 8,202 because nothing compared the two.
//
// Two checks:
//   1. Every source file that talks about MCP counts reads them from the facts
//      module, and no file outside the generated pair hardcodes a figure.
//   2. The figures the pages would render match what the catalog actually holds.
//
// Run: npx tsx scripts/verify-mcp-facts.ts
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import {
  MCP_TOTAL,
  MCP_CURATED,
  MCP_VERIFIED,
  MCP_CATEGORY_COUNT,
  MCP_CATEGORY_SIZES,
  MCP_TOTAL_TEXT,
  MCP_CURATED_TEXT,
  MCP_VERIFIED_TEXT,
} from "../src/lib/mcp-facts.generated";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
};

// ---- 1. The facts agree with the assets ------------------------------------

const index = JSON.parse(
  readFileSync(new URL("../public/mcp/index.json", import.meta.url).pathname, "utf8"),
);
check(
  "facts total matches the published index",
  MCP_TOTAL === index.total,
  `facts ${MCP_TOTAL}, index.json ${index.total}`,
);
check(
  "facts split matches the published index",
  MCP_CURATED === index.curated && MCP_VERIFIED === index.verified,
  `facts ${MCP_CURATED}/${MCP_VERIFIED}, index.json ${index.curated}/${index.verified}`,
);
check(
  "the parts add up to the whole",
  MCP_CURATED + MCP_VERIFIED === MCP_TOTAL,
  `${MCP_CURATED} + ${MCP_VERIFIED} !== ${MCP_TOTAL}`,
);
check(
  "category sizes sum to the total",
  Object.values(MCP_CATEGORY_SIZES).reduce((a, b) => a + b, 0) === MCP_TOTAL,
  `${Object.values(MCP_CATEGORY_SIZES).reduce((a, b) => a + b, 0)} !== ${MCP_TOTAL}`,
);
check(
  "category count matches the taxonomy",
  Object.keys(MCP_CATEGORY_SIZES).length === MCP_CATEGORY_COUNT,
  `${Object.keys(MCP_CATEGORY_SIZES).length} keys, ${MCP_CATEGORY_COUNT} claimed`,
);
check(
  "the text forms are just the numbers, grouped",
  MCP_TOTAL_TEXT === MCP_TOTAL.toLocaleString("en-US") &&
    MCP_CURATED_TEXT === MCP_CURATED.toLocaleString("en-US") &&
    MCP_VERIFIED_TEXT === MCP_VERIFIED.toLocaleString("en-US"),
  `${MCP_TOTAL_TEXT}/${MCP_CURATED_TEXT}/${MCP_VERIFIED_TEXT}`,
);

// The legacy static page reads this file directly, so it must carry the total.
const panel = JSON.parse(
  readFileSync(new URL("../public/mcp-apps.json", import.meta.url).pathname, "utf8"),
);
check(
  "the static page's data file carries the whole-catalog total",
  panel.total === MCP_TOTAL,
  `mcp-apps.json total ${panel.total}, expected ${MCP_TOTAL}`,
);
check(
  "the static page's data file carries the curated list",
  Array.isArray(panel.apps) && panel.apps.length === MCP_CURATED,
  `mcp-apps.json apps ${panel.apps?.length}, expected ${MCP_CURATED}`,
);

// ---- 2. No surface hardcodes a figure --------------------------------------

// The generated modules are where the numbers are allowed to live, and the
// build script is where they are written.
const ALLOWED = [
  "src/lib/mcp-facts.generated.ts",
  "src/lib/mcp-catalog.generated.ts",
  "src/lib/mcp-seo-index.server.ts",
  "scripts/build-mcp-catalog.ts",
  // This file quotes the figures in its own patterns and messages.
  "scripts/verify-mcp-facts.ts",
];

const sources = [
  ...globSync("src/**/*.{ts,tsx}", { cwd: new URL("../", import.meta.url).pathname }),
  ...globSync("scripts/**/*.{ts,mjs}", { cwd: new URL("../", import.meta.url).pathname }),
];

// A literal count reads as "108 MCP", "8,202 MCP", "108 curated", "8,202 servers".
// Quoting the figure next to a noun that means the catalog is what went stale.
const STALE = new RegExp(
  `\\b(?:8,?202|8094|8,?094|108)\\s+(?:MCP|MCP servers|servers|apps|integrations|app integrations|connectable apps|live app integrations)\\b`,
  "g",
);
// "the curated 108" and "the hand-written 108" are correct: they name the
// curated subset, not the catalog.
const CURATED_IS_FINE = /(?:curated|hand-written|one of)\s+108|108\s+curated|curated 108/;

const offenders: string[] = [];
for (const rel of sources) {
  if (ALLOWED.includes(rel)) continue;
  const text = readFileSync(new URL(`../${rel}`, import.meta.url).pathname, "utf8");
  for (const line of text.split("\n")) {
    if (CURATED_IS_FINE.test(line)) continue;
    STALE.lastIndex = 0;
    const hit = STALE.exec(line);
    if (hit) offenders.push(`${rel}: ${hit[0].trim()}`);
  }
}
check(
  "no surface hardcodes an MCP count",
  offenders.length === 0,
  offenders.length
    ? `replace with a value from @/lib/mcp-facts.generated:\n        ${offenders.join("\n        ")}`
    : "",
);

// The doc claim about the taxonomy, which was wrong for as long as the
// category scheme had 18 entries and the prose said 27.
const content = readFileSync(
  new URL("../src/lib/docs/content.ts", import.meta.url).pathname,
  "utf8",
);
const wrongCount = /span\s+(\d+)\s+categories/.exec(content);
check(
  "the docs do not claim a category count of their own",
  !wrongCount,
  wrongCount ? `docs say "span ${wrongCount[1]} categories"; use MCP_CATEGORY_COUNT` : "",
);

console.log(
  `\n${failures === 0 ? "ALL MCP FACT CHECKS PASSED" : `${failures} MCP FACT CHECK(S) FAILED`}\n` +
    `  ${MCP_TOTAL_TEXT} total, ${MCP_CURATED_TEXT} curated, ${MCP_VERIFIED_TEXT} verified, ${MCP_CATEGORY_COUNT} categories`,
);
process.exit(failures === 0 ? 0 : 1);

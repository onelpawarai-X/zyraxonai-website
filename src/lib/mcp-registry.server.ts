// Look up one MCP server for its own page, at request time.
//
// A page per server needs that server's name, category and facts to build its
// title, description, canonical and structured data. The rows are held in a
// generated module (`mcp-seo-index.server.ts`) that only this file imports, so
// the 8,094 rows never reach the browser bundle: the browser gets the small
// curated list and the category files it actually opens.
//
// A curated entry wins its slug, because its page is the richer one — it carries
// a hand-written description, the connect steps and the operator. Everything else
// resolves through the registry index.

import { MCP_CURATED, type McpServer } from "@/lib/mcp-catalog.generated";
import { SEO_CATEGORIES, SEO_CURATED_IDS, SEO_ROWS } from "@/lib/mcp-seo-index.server";
import { decodeSeoRow, describeRegistryServer, type McpSeoRow } from "@/lib/mcp-seo";

export type McpPage = {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: "browser" | "key" | "open" | "local";
  /** True when the entry is one of the hand-written 108. */
  curated: boolean;
  /** The MCP endpoint, when the server has one. */
  url: string | null;
  /** Where a visitor creates a token, for the curated token-tier entries. */
  tokenUrl: string | null;
  /** The connect steps, for the curated entries that carry them. */
  steps: string[];
  /** A note from the doc, such as reaching a server through a gateway. */
  note: string | null;
  /** Who operates the endpoint, when the doc names an operator. */
  operator: string | null;
  /** The brand domain, used for the icon. */
  domain: string | null;
  /** Brand colour, for the letter mark when there is no icon. */
  color: string;
  /** Registry facts, present only for the verified entries. */
  install?: string;
  connect?: string;
  verified?: string;
  tools?: number;
};

const curatedById = new Map(MCP_CURATED.map((e) => [e.id, e]));

function fromCurated(entry: McpServer): McpPage {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    category: entry.category,
    tier: entry.tier,
    curated: true,
    url: entry.url,
    tokenUrl: entry.tokenUrl,
    steps: entry.steps,
    note: entry.note,
    operator: entry.operator,
    domain: entry.domain,
    color: entry.color,
  };
}

function fromRegistry(id: string, row: McpSeoRow): McpPage {
  const [rowId, name, category, install, connect, verified, tools] = row;
  const tier: McpPage["tier"] =
    connect === "oauth_browser" ? "browser" : connect === "no_auth" ? "open" : "key";
  return {
    id: rowId,
    name,
    description: describeRegistryServer(name, category, install, connect, verified, tools),
    category,
    tier,
    curated: false,
    url: null,
    tokenUrl: null,
    steps: [],
    note: null,
    operator: null,
    domain: null,
    color: "#374151",
    install,
    connect,
    verified,
    tools,
  };
}

/** One server by slug, or null when no server has it. */
export function getMcpPage(id: string): McpPage | null {
  const curated = curatedById.get(id);
  if (curated) return fromCurated(curated);

  // The index is a flat array; a linear scan per request would be 8,094
  // comparisons on a page load that Googlebot also waits for, so the ids are
  // resolved to their row once and kept.
  const row = rowCache.get(id) ?? findRow(id);
  if (!row) return null;
  rowCache.set(id, row);
  return fromRegistry(id, row);
}

const rowCache = new Map<string, McpSeoRow | null>();

function findRow(id: string): McpSeoRow | null {
  for (const row of SEO_ROWS) {
    if (row[0] === id) return decodeSeoRow(row, SEO_CATEGORIES);
  }
  return null;
}

/** How many servers there are in total, curated and verified. */
export const MCP_PAGE_COUNT = MCP_CURATED.length + SEO_ROWS.length;

/** The ids of the hand-written entries, for the panel to mark them. */
export const CURATED_IDS: readonly string[] = SEO_CURATED_IDS;

/**
 * The servers related to one page: the same category, minus itself, capped.
 *
 * Read from the curated list and the registry index together, so a curated page
 * can point at registry neighbours and the other way round. This is what gives
 * every one of the 8,202 pages a set of internal links, which is how a crawler
 * reaches the pages that have no other inbound link.
 */
export function relatedMcpPages(page: McpPage, limit = 12): McpPage[] {
  const out: McpPage[] = [];

  for (const entry of MCP_CURATED) {
    if (out.length >= limit) break;
    if (entry.id === page.id || entry.category !== page.category) continue;
    out.push(fromCurated(entry));
  }

  if (out.length < limit) {
    for (const row of SEO_ROWS) {
      if (out.length >= limit) break;
      if (row[0] === page.id) continue;
      const decoded = decodeSeoRow(row, SEO_CATEGORIES);
      if (decoded[2] !== page.category) continue;
      out.push(fromRegistry(row[0], decoded));
    }
  }

  return out;
}

/** The curated entry for a slug, when there is one. Used by the panel. */
export function curatedEntry(id: string): McpServer | null {
  return curatedById.get(id) ?? null;
}

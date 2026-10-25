// The text behind an MCP server's page.
//
// Both the catalogue generator and the `/apps/<slug>` route call these, so the
// sentence a search engine reads is the same sentence the panel shows. Keeping
// one composer is what stops the two from drifting.
//
// The registry rows carry no prose of their own — the source doc gives them an
// endpoint, an install kind, a connect kind, a verification depth and a tool
// count — so the description is composed from those facts. It reads as a
// sentence rather than a field dump, because it is also the meta description.

/** One registry row, in the order the generated module stores it. */
export type McpSeoRow = [
  id: string,
  name: string,
  category: string,
  install: string,
  connect: string,
  verified: string,
  tools: number,
];

/**
 * The code tables behind the compact registry index.
 *
 * The index holds one row per server so a page can render its own title and
 * description at request time. Written out in full it was most of a megabyte, so
 * the three enumerated columns are stored as an index into these lists and
 * decoded on read. The lists are the decode side of the same encoding the
 * generator writes, which is why they live here rather than in the generator.
 */
export const INSTALL_KINDS = ["remote_http", "npx", "uvx", "docker"] as const;
export const CONNECT_KINDS = ["no_auth", "oauth_browser", "api_key", "url_input"] as const;
export const VERIFY_DEPTHS = [
  "full",
  "tools_list",
  "auth_discovery",
  "launched",
  "declared",
  "unknown",
] as const;

/** A compact registry row: the enumerated columns are indexes into the tables. */
export type McpSeoCompact = [
  id: string,
  name: string,
  categoryIndex: number,
  installIndex: number,
  connectIndex: number,
  verifyIndex: number,
  tools: number,
];

/** Decode a compact row back into the readable form. */
export function decodeSeoRow(row: McpSeoCompact, categories: readonly string[]): McpSeoRow {
  return [
    row[0],
    row[1],
    categories[row[2]] ?? "General",
    INSTALL_KINDS[row[3]] ?? "remote_http",
    CONNECT_KINDS[row[4]] ?? "no_auth",
    VERIFY_DEPTHS[row[5]] ?? "unknown",
    row[6],
  ];
}

/** How a server is installed, as a reader would say it. */
function installPhrase(install: string): string {
  switch (install) {
    case "remote_http":
      return "a remote HTTP endpoint";
    case "npx":
      return "an npm package run with npx";
    case "uvx":
      return "a PyPI package run with uvx";
    case "docker":
      return "a Docker image";
    default:
      return install.replace(/_/g, " ");
  }
}

/** What the visitor has to do before the server will run. */
function connectPhrase(connect: string): string {
  switch (connect) {
    case "no_auth":
      return "no sign-in";
    case "oauth_browser":
      return "a browser sign-in";
    case "api_key":
      return "a token you create yourself";
    case "url_input":
      return "your own address";
    default:
      return connect.replace(/_/g, " ");
  }
}

/** How far the verifier got, as a reader would say it. */
function verifiedPhrase(verified: string): string {
  switch (verified) {
    case "full":
      return "initialized it, listed its tools and completed a read-only call";
    case "tools_list":
      return "initialized it and listed its tools";
    case "auth_discovery":
      return "answered its sign-in challenge with a working discovery document";
    case "launched":
      return "resolved the package, started it and saw it ask for its key";
    case "declared":
      return "reached the endpoint and confirmed it needs a value from you";
    default:
      return "reached it, with no proof depth recorded";
  }
}

/**
 * The page description for a registry server.
 *
 * Composed rather than stored: the same sentence is used by the panel card and
 * by the page's meta description, and composing it here keeps the generated
 * module down to the facts.
 */
export function describeRegistryServer(
  name: string,
  category: string,
  install: string,
  connect: string,
  verified: string,
  tools: number,
): string {
  const toolPart = tools ? ` It exposes ${tools} tool${tools === 1 ? "" : "s"}.` : "";
  return `${name} is a ${category} MCP server installed as ${installPhrase(install)}, needing ${connectPhrase(connect)}. The verifier ${verifiedPhrase(verified)}.${toolPart}`;
}

/** A shorter description, for the panel card where space is tight. */
export function shortRegistryServer(
  name: string,
  category: string,
  connect: string,
  tools: number,
): string {
  const toolPart = tools ? `, ${tools} tool${tools === 1 ? "" : "s"}` : "";
  return `${category} MCP server · ${connectPhrase(connect)}${toolPart}`;
}

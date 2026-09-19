import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side NPM package resolver for @zyraxon-ai/* packages.
 *
 *   GET /api/public/npm-packages              -> all packages with versions
 *   GET /api/public/npm-packages?pkg=sdk      -> single package detail
 *
 * Fetches each known package individually from the npm registry.
 * This avoids search API returning wrong packages from other scopes.
 */

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=600",
};

const ORG = "zyraxon-ai";

/** All known @zyraxon-ai packages — fetched individually for accuracy. */
const KNOWN_PACKAGES = [
  "sdk",
  "sdk-next",
  "client",
  "server",
  "core",
  "llm",
  "schema",
  "protocol",
  "plugin",
  "http-recorder",
  "effect-drizzle-sqlite",
  "effect-sqlite-node",
] as const;

type NpmPackage = {
  name: string;
  scope: string;
  version: string;
  description: string;
  keywords: string[];
  date: string;
  npmUrl: string;
  installCmd: string;
};

async function fetchSinglePackage(pkgShort: string): Promise<NpmPackage | null> {
  const fullName = `@${ORG}/${pkgShort}`;
  const url = `https://registry.npmjs.org/${encodeURIComponent(fullName)}/latest`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "zyraxon-website/1.0" },
    });
    if (!res.ok) return null;
    const p: any = await res.json();
    return {
      name: p.name,
      scope: ORG,
      version: p.version || "0.0.0",
      description: p.description || "",
      keywords: p.keywords || [],
      date: p.time?.[p.version] || new Date().toISOString(),
      npmUrl: `https://www.npmjs.com/package/${p.name}`,
      installCmd: `npm install ${p.name}`,
    };
  } catch {
    return null;
  }
}

async function fetchAllPackages(): Promise<NpmPackage[]> {
  const results = await Promise.all(KNOWN_PACKAGES.map((pkg) => fetchSinglePackage(pkg)));
  return results.filter((p): p is NpmPackage => p !== null);
}

export const Route = createFileRoute("/api/public/npm-packages")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const pkg = url.searchParams.get("pkg");

          if (pkg) {
            const shortName = pkg.replace(`@${ORG}/`, "");
            const single = await fetchSinglePackage(shortName);
            if (!single) {
              return Response.json(
                { error: "Package not found", packages: [] },
                { status: 200, headers: HEADERS },
              );
            }
            return Response.json({ packages: [single] }, { headers: HEADERS });
          }

          const packages = await fetchAllPackages();
          return Response.json({ packages }, { headers: HEADERS });
        } catch (err) {
          return Response.json(
            { packages: [], error: String(err) },
            { status: 200, headers: HEADERS },
          );
        }
      },
    },
  },
});

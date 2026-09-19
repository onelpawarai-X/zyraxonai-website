import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side NPM package resolver for @zyraxon-ai/* packages.
 *
 *   GET /api/public/npm-packages              -> all packages with versions
 *   GET /api/public/npm-packages?pkg=sdk      -> single package detail
 *
 * Fetches from the public npm registry (no auth needed).
 * Caches for 10 minutes to avoid hammering the registry.
 */

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=600",
};

const ORG = "zyraxon-ai";

/** Known packages in display order. If npm has more, they appear after these. */
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

type NpmRegistryResponse = {
  objects: {
    package: {
      name: string;
      scope: string;
      version: string;
      description?: string;
      keywords?: string[];
      date: string;
      links: { npm: string };
    };
  }[];
};

async function fetchOrgPackages(): Promise<NpmPackage[]> {
  const url = `https://registry.npmjs.org/-/v1/search?text=scope:${ORG}&size=100`;
  const res = await fetch(url, {
    headers: { "User-Agent": "zyraxon-website/1.0" },
  });
  if (!res.ok) throw new Error(`npm registry ${res.status}`);
  const data: NpmRegistryResponse = await res.json();

  const packages: NpmPackage[] = data.objects.map((obj) => {
    const p = obj.package;
    const shortName = p.name.replace(`@${ORG}/`, "");
    return {
      name: p.name,
      scope: p.scope,
      version: p.version,
      description: p.description || "",
      keywords: p.keywords || [],
      date: p.date,
      npmUrl: p.links.npm,
      installCmd: `npm install ${p.name}`,
    };
  });

  // Sort: known packages first (in KNOWN_PACKAGES order), then the rest alphabetically
  const knownMap = new Map<string, number>();
  KNOWN_PACKAGES.forEach((k, i) => knownMap.set(`@${ORG}/${k}`, i));

  packages.sort((a, b) => {
    const ai = knownMap.has(a.name) ? knownMap.get(a.name)! : 999;
    const bi = knownMap.has(b.name) ? knownMap.get(b.name)! : 999;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });

  return packages;
}

/** Fetch latest version info for a single package. */
async function fetchSinglePackage(pkgName: string): Promise<NpmPackage | null> {
  const fullName = pkgName.startsWith(`@${ORG}/`) ? pkgName : `@${ORG}/${pkgName}`;
  const url = `https://registry.npmjs.org/${encodeURIComponent(fullName)}/latest`;
  const res = await fetch(url, {
    headers: { "User-Agent": "zyraxon-website/1.0" },
  });
  if (!res.ok) return null;
  const p = await res.json();
  return {
    name: p.name,
    scope: p.scope || ORG,
    version: p.version,
    description: p.description || "",
    keywords: p.keywords || [],
    date: p.time?.[p.version] || new Date().toISOString(),
    npmUrl: `https://www.npmjs.com/package/${p.name}`,
    installCmd: `npm install ${p.name}`,
  };
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
            const single = await fetchSinglePackage(pkg);
            if (!single) {
              return Response.json(
                { error: "Package not found", packages: [] },
                { status: 200, headers: HEADERS },
              );
            }
            return Response.json({ packages: [single] }, { headers: HEADERS });
          }

          const packages = await fetchOrgPackages();
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

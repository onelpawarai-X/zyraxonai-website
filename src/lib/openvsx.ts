/**
 * Open VSX Registry client.
 *
 * Reads the public registry (https://open-vsx.org) straight from the
 * browser. No API key, token or proxy is needed: the registry sends
 * `access-control-allow-origin: *` on every `/api` response.
 *
 * Endpoints used:
 *   GET /api/{namespace}                     → every extension of a publisher
 *   GET /api/{namespace}/{name}              → one extension, all versions
 *   GET /api/{namespace}/{name}/{version}    → one pinned version
 *
 * A publisher can exist with no extensions yet, in which case
 * `/api/{namespace}` answers `{"extensions": {}, ...}`.
 */

export const OPEN_VSX = "https://open-vsx.org";
const API = `${OPEN_VSX}/api`;

/** Publishers whose extensions we surface on this site. */
export const TRACKED_PUBLISHERS = ["zyraxon"] as const;

export type OpenVsxFile = { download?: string; icon?: string };

export type OpenVsxExtension = {
  namespace: string;
  name: string;
  /** Extension id in the form `namespace.name`, e.g. `zyraxon.zyraxon-vscode`. */
  extensionId: string;
  displayName: string;
  description: string;
  version: string;
  /** Every published version, newest first. */
  versions: string[];
  preRelease: boolean;
  preview: boolean;
  deprecated: boolean;
  verified: boolean;
  namespaceVerified: boolean;
  downloadCount: number;
  averageRating: number | null;
  reviewCount: number;
  timestamp: string | null;
  license: string | null;
  repository: string | null;
  homepage: string | null;
  bugs: string | null;
  categories: string[];
  tags: string[];
  engines: Record<string, string>;
  /** Direct .vsix download for the latest version. */
  downloadUrl: string;
  iconUrl: string | null;
  /** Human page on open-vsx.org. */
  registryUrl: string;
};

export type PublisherProfile = {
  namespace: string;
  verified: boolean;
  extensions: OpenVsxExtension[];
  totalDownloads: number;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value) return [value];
  return [];
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function fileUrl(
  files: unknown,
  key: string,
  fallback: { namespace: string; name: string; version: string },
): string | null {
  const rec = (files ?? {}) as Record<string, unknown>;
  const direct = rec[key];
  if (typeof direct === "string") return direct;
  // Older registry payloads nest the value under `files[key].url`.
  if (direct && typeof direct === "object" && "url" in direct) {
    const url = (direct as { url?: unknown }).url;
    if (typeof url === "string") return url;
  }
  if (key === "download") {
    const { namespace, name, version } = fallback;
    return `${API}/${namespace}/${name}/${version}/file/${namespace}.${name}-${version}.vsix`;
  }
  return null;
}

/** Sort versions newest-first using the registry's own ordering hints. */
function collectVersions(raw: Record<string, unknown>, current: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [current, ...Object.keys(raw)]) {
    if (!v || v === "latest" || v === "pre-release" || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function normalize(raw: unknown): OpenVsxExtension | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const namespace = typeof r.namespace === "string" ? r.namespace : "";
  const name = typeof r.name === "string" ? r.name : "";
  const version = typeof r.version === "string" ? r.version : "";
  if (!namespace || !name) return null;

  const allVersions = (r.allVersions ?? {}) as Record<string, unknown>;
  const files = r.files;
  const icon = fileUrl(files, "icon", { namespace, name, version });
  const downloadUrl = fileUrl(files, "download", { namespace, name, version });

  return {
    namespace,
    name,
    extensionId: `${namespace}.${name}`,
    displayName: typeof r.displayName === "string" && r.displayName ? r.displayName : name,
    description: typeof r.description === "string" ? r.description : "",
    version,
    versions: collectVersions(allVersions, version),
    preRelease: r.preRelease === true,
    preview: r.preview === true,
    deprecated: r.deprecated === true,
    verified: r.verified === true,
    namespaceVerified: r.verified === true,
    downloadCount: typeof r.downloadCount === "number" ? r.downloadCount : 0,
    averageRating: typeof r.averageRating === "number" ? r.averageRating : null,
    reviewCount: typeof r.reviewCount === "number" ? r.reviewCount : 0,
    timestamp: typeof r.timestamp === "string" ? r.timestamp : null,
    license: typeof r.license === "string" ? r.license : null,
    repository: typeof r.repository === "string" ? r.repository : null,
    homepage: typeof r.homepage === "string" ? r.homepage : null,
    bugs: typeof r.bugs === "string" ? r.bugs : null,
    categories: toArray(r.categories),
    tags: toArray(r.tags),
    engines: asRecord(r.engines),
    downloadUrl: downloadUrl ?? `${OPEN_VSX}/extension/${namespace}/${name}`,
    iconUrl: icon,
    registryUrl: `${OPEN_VSX}/extension/${namespace}/${name}`,
  };
}

async function getJson(url: string, timeoutMs = 12000): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Open VSX responded ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Every extension published under `namespace`.
 * Returns an empty list when the publisher has not published anything yet.
 */
export async function fetchPublisherExtensions(namespace: string): Promise<OpenVsxExtension[]> {
  const data = (await getJson(`${API}/${encodeURIComponent(namespace)}`)) as Record<
    string,
    unknown
  >;
  const listed = (data?.extensions ?? {}) as Record<string, unknown>;

  // Newer responses give `{ name: url }`; some give `{ name: { ... } }`.
  const names = Object.keys(listed);
  if (names.length === 0) return [];

  const details = await Promise.all(
    names.map(async (extName) => {
      const value = listed[extName];
      if (value && typeof value === "object" && "namespace" in (value as object)) {
        return normalize(value);
      }
      try {
        return normalize(await getJson(`${API}/${namespace}/${encodeURIComponent(extName)}`));
      } catch {
        return null;
      }
    }),
  );

  return details
    .filter((e): e is OpenVsxExtension => e !== null)
    .sort((a, b) => b.downloadCount - a.downloadCount);
}

export async function fetchPublisherProfile(namespace: string): Promise<PublisherProfile> {
  const extensions = await fetchPublisherExtensions(namespace);
  let verified = false;
  try {
    const meta = (await getJson(`${API}/${encodeURIComponent(namespace)}`)) as Record<
      string,
      unknown
    >;
    verified = meta?.verified === true;
  } catch {
    /* verification badge is cosmetic — ignore failures */
  }
  return {
    namespace,
    verified,
    extensions,
    totalDownloads: extensions.reduce((sum, e) => sum + e.downloadCount, 0),
  };
}

export async function fetchExtension(
  namespace: string,
  name: string,
): Promise<OpenVsxExtension | null> {
  try {
    return normalize(
      await getJson(`${API}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`),
    );
  } catch {
    return null;
  }
}

/** Profile for every tracked publisher, in parallel. */
export async function fetchAllTrackedPublishers(): Promise<PublisherProfile[]> {
  return Promise.all(TRACKED_PUBLISHERS.map((ns) => fetchPublisherProfile(ns)));
}

/** `zyraxon-code://install/extension/<id>` — hands the VSIX to the desktop app. */
export function installDeepLink(ext: OpenVsxExtension, version?: string): string {
  const q = new URLSearchParams({ version: version ?? ext.version ?? "latest" });
  if (ext.downloadUrl) q.set("package", ext.downloadUrl);
  return `zyraxon-code://install/extension/${encodeURIComponent(ext.extensionId)}?${q.toString()}`;
}

/** Pinned VSIX download for one version. */
export function vsixUrl(ext: OpenVsxExtension, version?: string): string {
  const v = version ?? ext.version;
  if (v === ext.version && ext.downloadUrl) return ext.downloadUrl;
  return `${API}/${ext.namespace}/${ext.name}/${v}/file/${ext.namespace}.${ext.name}-${v}.vsix`;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

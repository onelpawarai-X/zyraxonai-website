/**
 * ZYRAXON Agent — Marketplace install engine
 * -------------------------------------------------------------
 * Manages extension install/uninstall flow through ZYRAXON Agent.
 *
 * Detection flow:
 *   1. Check if zyraxon-code:// deep link is reachable (app installed)
 *   2. If yes → open app via deep link, extension installs automatically
 *   3. If no → show "Install ZYRAXON Agent" modal with download links
 *
 * The website keeps its own mirror of the installed set in
 * localStorage so the UI is instant and survives reloads.
 */

export type InstallState =
  | "not-installed"
  | "installing"
  | "installed"
  | "disabled"
  | "uninstalling";

export interface InstalledRecord {
  id: string;
  displayName: string;
  version: string;
  publisher: string;
  icon?: string | null;
  vsix?: string | null;
  vsixUrl?: string | null;
  source: "extension" | "mcp" | "agent-mode" | "prompt-pack" | "theme";
  installedAt: string;
  enabled: boolean;
  autoUpdate: boolean;
}

export interface InstallTarget {
  id: string;
  displayName: string;
  version: string;
  publisher: string;
  icon?: string | null;
  vsix?: string | null;
  vsixUrl?: string | null;
  source?: InstalledRecord["source"];
}

const STORAGE_KEY = "zyraxon.marketplace.installed.v1";
const SCHEME = "zyraxon-code://";
const APP_CHECK_KEY = "zyraxon_code_app_detected";
const APP_CHECK_TIME_KEY = "zyraxon_code_app_detected_at";
const APP_CHECK_TTL = 5 * 60 * 1000; // 5 minutes

/* ------------------------------------------------------------------ */
/* App detection                                                       */
/* ------------------------------------------------------------------ */

/**
 * Detect if ZYRAXON Agent is installed by trying to open a deep link.
 * Uses an iframe + timeout trick — if the app is installed, the
 * iframe loads instantly; if not, it times out.
 */
let appDetected: boolean | null = null;

export function isAppDetected(): boolean | null {
  if (typeof window === "undefined") return null;
  // Check cache first
  if (appDetected !== null) return appDetected;
  try {
    const cached = localStorage.getItem(APP_CHECK_KEY);
    const cachedAt = localStorage.getItem(APP_CHECK_TIME_KEY);
    if (cached !== null && cachedAt) {
      const age = Date.now() - parseInt(cachedAt, 10);
      if (age < APP_CHECK_TTL) {
        appDetected = cached === "true";
        return appDetected;
      }
    }
  } catch {}
  return null;
}

export function setAppDetected(detected: boolean): void {
  appDetected = detected;
  try {
    localStorage.setItem(APP_CHECK_KEY, detected ? "true" : "false");
    localStorage.setItem(APP_CHECK_TIME_KEY, String(Date.now()));
  } catch {}
}

export function clearAppDetection(): void {
  appDetected = null;
  try {
    localStorage.removeItem(APP_CHECK_KEY);
    localStorage.removeItem(APP_CHECK_TIME_KEY);
  } catch {}
}

/**
 * Try to detect the app by firing a deep link and measuring response.
 * Returns true if app is detected, false otherwise.
 */
export function detectApp(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") { resolve(false); return; }

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setAppDetected(false);
        resolve(false);
      }
    }, 2000);

    // Try to open the app
    try {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = `${SCHEME}ping`;
      document.body.appendChild(iframe);

      // If the app is installed, it should respond quickly
      window.addEventListener("message", function handler(e) {
        if (e.data === "zyraxon-code:pong" || e.data?.type === "zyraxon-code:pong") {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            setAppDetected(true);
            resolve(true);
          }
          window.removeEventListener("message", handler);
          iframe.remove();
        }
      });

      // Also try direct navigation as fallback
      window.location.href = `${SCHEME}ping`;

      setTimeout(() => iframe.remove(), 3000);
    } catch {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        setAppDetected(false);
        resolve(false);
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/* Deep links                                                          */
/* ------------------------------------------------------------------ */

export function installDeepLink(t: InstallTarget): string {
  const kind = t.source ?? "extension";
  const q = new URLSearchParams({ version: t.version || "latest" });
  if (t.vsix) q.set("package", t.vsix);
  return `${SCHEME}install/${kind}/${encodeURIComponent(t.id)}?${q.toString()}`;
}

export function uninstallDeepLink(
  id: string,
  kind: InstalledRecord["source"] = "extension",
): string {
  return `${SCHEME}uninstall/${kind}/${encodeURIComponent(id)}`;
}

export function openDeepLink(url: string): void {
  if (typeof window === "undefined") return;
  try {
    const frame = document.createElement("iframe");
    frame.style.display = "none";
    frame.src = url;
    document.body.appendChild(frame);
    window.setTimeout(() => frame.remove(), 1500);
  } catch {
    try {
      window.location.href = url;
    } catch {
      /* app not installed */
    }
  }
}

/** Open ZYRAXON Agent app (general) */
export function openApp(): void {
  if (typeof window === "undefined") return;
  try {
    window.location.href = SCHEME;
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Local registry                                                      */
/* ------------------------------------------------------------------ */

type Listener = (records: Record<string, InstalledRecord>) => void;
const listeners = new Set<Listener>();
let cache: Record<string, InstalledRecord> | null = null;

function read(): Record<string, InstalledRecord> {
  if (cache) return cache;
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as Record<string, InstalledRecord>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Record<string, InstalledRecord>): void {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((fn) => fn(next));
}

export function getInstalled(): Record<string, InstalledRecord> {
  return read();
}

export function getRecord(id: string): InstalledRecord | undefined {
  return read()[id];
}

export function isInstalled(id: string): boolean {
  return !!read()[id];
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export async function install(t: InstallTarget): Promise<InstalledRecord> {
  const detected = isAppDetected();

  if (detected === true) {
    // App is installed — open via deep link
    openDeepLink(installDeepLink(t));
  } else if (detected === null) {
    // Unknown — try to detect
    const result = await detectApp();
    if (result) {
      openDeepLink(installDeepLink(t));
    }
    // If not detected, caller should show the "Install ZYRAXON Agent" modal
  }
  // If detected === false, caller should show the modal

  const record: InstalledRecord = {
    id: t.id,
    displayName: t.displayName,
    version: t.version,
    publisher: t.publisher,
    icon: t.icon ?? null,
    vsix: t.vsix ?? null,
    source: t.source ?? "extension",
    installedAt: new Date().toISOString(),
    enabled: true,
    autoUpdate: true,
  };
  write({ ...read(), [t.id]: record });
  return record;
}

export async function uninstall(id: string): Promise<void> {
  const existing = read()[id];
  if (isAppDetected()) {
    openDeepLink(uninstallDeepLink(id, existing?.source ?? "extension"));
  }
  const next = { ...read() };
  delete next[id];
  write(next);
}

export async function setEnabled(id: string, enabled: boolean): Promise<void> {
  const existing = read()[id];
  if (!existing) return;
  if (isAppDetected()) {
    openDeepLink(
      `${SCHEME}${enabled ? "enable" : "disable"}/${existing.source}/${encodeURIComponent(id)}`,
    );
  }
  write({ ...read(), [id]: { ...existing, enabled } });
}

export function setAutoUpdate(id: string, autoUpdate: boolean): void {
  const existing = read()[id];
  if (!existing) return;
  write({ ...read(), [id]: { ...existing, autoUpdate } });
}

/* ------------------------------------------------------------------ */
/* VSIX download from VS Code Marketplace                              */
/* ------------------------------------------------------------------ */

export async function fetchVSIXUrl(extensionId: string): Promise<string | null> {
  try {
    const [publisher, name] = extensionId.split(".");
    if (!publisher || !name) return null;
    const response = await fetch(
      "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json;api-version=6.1-preview.1",
        },
        body: JSON.stringify({
          filters: [{ criteria: [{ filterType: 7, value: extensionId }] }],
          flags: 0x200,
        }),
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const extension = data?.results?.[0]?.extensions?.[0];
    if (!extension) return null;
    const version = extension.versions?.[0];
    if (!version) return null;
    const asset = version.files?.find(
      (f: any) => f.assetType === "Microsoft.VisualStudio.Services.VSIXPackage",
    );
    return asset?.source || null;
  } catch {
    return null;
  }
}

export async function installFromMarketplace(
  extensionId: string,
  displayName: string,
  publisher: string,
  icon?: string,
): Promise<InstalledRecord> {
  const vsixUrl = await fetchVSIXUrl(extensionId);
  if (!vsixUrl) throw new Error(`Could not find VSIX for ${extensionId}`);
  const target: InstallTarget = {
    id: extensionId,
    displayName,
    version: "latest",
    publisher,
    icon,
    vsixUrl,
    source: "extension",
  };
  return install(target);
}

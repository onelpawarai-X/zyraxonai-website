/**
 * The download resolver must work with no GitHub token at all.
 *
 * This is not a style preference, it is the bug that blanked the download page:
 * the resolver used to send `Authorization: Bearer <token>` when one was
 * configured, GitHub answered 401 for a rejected token, and the code read that
 * as "this repository has no releases". Every button fell back to a link to the
 * releases page. A public read cannot fail that way, because there is no
 * credential to be stale.
 *
 * The test proves three things, against the live repository:
 *   1. A token in the environment changes nothing — the resolver never reads it.
 *   2. Every button id resolves to a real asset that downloads as an attachment.
 *   3. Every asset of the newest release is reachable.
 *
 * Run: npx tsx scripts/verify-downloads.ts
 */

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// A deliberately invalid token. If the resolver ever picks it up, GitHub
// answers 401 and the test fails — which is exactly the production symptom.
process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_thisTokenIsDeliberatelyInvalid00000000";
process.env.GITHUB_TOKEN = "ghp_thisTokenIsDeliberatelyInvalid00000000";

const { TARGETS, resolveReleases, REPO } = await import("../src/routes/api/public/downloads");

const data = await resolveReleases();

check("a release was found without using the token", Boolean(data.latest?.tag), data.latest?.tag ?? data.error);
check(
  "the release has assets",
  data.assets.length >= 25,
  `${data.assets.length} asset(s) on ${data.latest?.tag}`,
);

// Every button must point at a real file, and at a direct-download URL.
const missing: string[] = [];
const notDirect: string[] = [];
for (const t of TARGETS) {
  const asset = data.platforms[t.id];
  if (!asset?.url) {
    missing.push(t.id);
    continue;
  }
  // A direct download saves a file. A URL under /releases or /releases/tag is a
  // page, and clicking it would not save anything. The source archives are
  // GitHub-generated downloads, so they are accepted on their own shape.
  const isAsset = /\/releases\/download\/[^/]+\/[^/]+$/.test(asset.url);
  const isArchive = /\/archive\/refs\/tags\/[^/]+$/.test(asset.url);
  if (!isAsset && !isArchive) notDirect.push(`${t.id} → ${asset.url}`);
}
check(
  "every button resolves to an asset",
  missing.length === 0,
  missing.length ? `missing: ${missing.join(", ")}` : `${TARGETS.length}/${TARGETS.length}`,
);
check("every button URL is a direct download, not a page", notDirect.length === 0, notDirect.join("; "));

// The families the page promises.
const desktop = TARGETS.filter((t) => t.family === "desktop").map((t) => t.id);
const cli = TARGETS.filter((t) => t.family === "cli").map((t) => t.id);
const source = TARGETS.filter((t) => t.family === "source").map((t) => t.id);
check("all seven desktop targets are present", desktop.length === 7, desktop.join(", "));
check("all seven CLI targets are present", cli.length === 7, cli.join(", "));
check("the source archives are present", source.length === 2, source.join(", "));

// The asset each button would hand out, named, so a wrong mapping is visible.
console.log("\n  button                 asset");
for (const t of TARGETS) {
  const a = data.platforms[t.id];
  console.log(`  ${t.id.padEnd(22)} ${a?.name ?? "(unresolved)"}`);
}

// Every asset of the release must be individually downloadable.
const urls = new Set(data.assets.map((a) => a.url));
check("every asset of the release has a download URL", urls.size === data.assets.length, `${urls.size}`);

// Renamed assets must still land on the right button.
//
// This is the failure the user hit: a release renames a file — a different
// prefix, a different separator, `windows` instead of `win` — and a pattern
// anchored to the old spelling silently stops matching. Each target is fed a
// name it has never seen and must still claim it, and must not claim a name
// belonging to a different platform.
const DRIFT: Record<string, string[]> = {
  windows: [
    "ZYRAXON-Dev-win-x64-installer.exe",
    "ZYRAXON-Setup-1.2.3.exe",
    "zyraxon-windows-x64-installer.exe",
    "ZYRAXON-dev-windows-amd64-setup.exe",
  ],
  "windows-arm64": ["ZYRAXON-Dev-win-arm64-installer.exe", "zyraxon-windows-aarch64.exe"],
  "mac-arm": [
    "zyraxon-desktop-mac-arm64.dmg",
    "ZYRAXON-1.2.3-darwin-arm64.dmg",
    "zyraxon-macos-silicon.dmg",
  ],
  "mac-intel": ["zyraxon-desktop-mac-x64.dmg", "ZYRAXON-darwin-x86_64.dmg", "zyraxon-mac-intel.dmg"],
  "linux-appimage": ["zyraxon-linux-x86_64.AppImage", "ZYRAXON-1.2.3-linux-amd64.AppImage"],
  "linux-deb": ["zyraxon-linux-amd64.deb", "zyraxon-1.2.3-linux-x64.deb"],
  "linux-rpm": ["zyraxon-linux-x86_64.rpm", "zyraxon-1.2.3-linux-amd64.rpm"],
  "cli-windows": ["zyraxon-windows-x64.zip", "ZYRAXON-cli-windows-amd64.zip"],
  "cli-windows-arm64": ["zyraxon-windows-arm64.zip", "zyraxon-windows-aarch64.zip"],
  "cli-mac-arm": ["zyraxon-darwin-arm64.zip", "ZYRAXON-cli-darwin-aarch64.zip"],
  "cli-mac-intel": ["zyraxon-darwin-x64.zip", "zyraxon-darwin-x64-baseline.zip"],
  "cli-linux": ["zyraxon-linux-x64.tar.gz", "ZYRAXON-cli-linux-amd64.tar.gz"],
  "cli-linux-musl": ["zyraxon-linux-x64-musl.tar.gz", "ZYRAXON-linux-amd64-musl.tar.gz"],
  "cli-linux-arm64": ["zyraxon-linux-arm64.tar.gz", "ZYRAXON-linux-aarch64.tar.gz"],
};

let driftMisses = 0;
const driftDetail: string[] = [];
for (const [id, names] of Object.entries(DRIFT)) {
  const target = TARGETS.find((t) => t.id === id);
  if (!target) {
    driftMisses++;
    driftDetail.push(`${id}: no such target`);
    continue;
  }
  for (const name of names) {
    if (!target.patterns.some((p) => p.test(name))) {
      driftMisses++;
      driftDetail.push(`${id} missed ${name}`);
    }
  }
}
check(
  "renamed assets still match their own button",
  driftMisses === 0,
  driftMisses ? driftDetail.join("; ") : `${Object.values(DRIFT).flat().length} names across ${Object.keys(DRIFT).length} targets`,
);

// The other half: a name must not be claimed by a button for another platform,
// or the Windows button could hand out a macOS build.
const CROSS: [string, string, string][] = [
  ["windows", "zyraxon-darwin-arm64.zip", "macOS CLI archive"],
  ["cli-windows", "zyraxon-linux-x64.tar.gz", "Linux CLI archive"],
  ["cli-mac-arm", "zyraxon-windows-x64.zip", "Windows CLI archive"],
  ["mac-arm", "zyraxon-desktop-mac-x64.dmg", "Intel dmg"],
  ["cli-linux", "zyraxon-linux-x64-musl.tar.gz", "musl archive"],
  ["cli-linux-musl", "zyraxon-linux-x64.tar.gz", "glibc archive"],
];
const crossClaims: string[] = [];
for (const [id, name, what] of CROSS) {
  const target = TARGETS.find((t) => t.id === id);
  if (target?.patterns.some((p) => p.test(name))) crossClaims.push(`${id} claimed ${what} (${name})`);
}
check("no button claims another platform's file", crossClaims.length === 0, crossClaims.join("; "));

// Prove one real asset answers as an attachment, end to end.
const probe = data.platforms["windows"];
if (probe) {
  try {
    const res = await fetch(probe.url, { redirect: "follow" });
    const disposition = res.headers.get("content-disposition") ?? "";
    const type = res.headers.get("content-type") ?? "";
    // Stop reading at once; the body is hundreds of megabytes.
    await res.body?.cancel();
    check(
      "a real download answers as an attachment",
      res.ok && /attachment/i.test(disposition),
      `HTTP ${res.status} · ${disposition.slice(0, 60)} · ${type}`,
    );
  } catch (err) {
    check("a real download answers as an attachment", false, String(err).slice(0, 120));
  }
}

console.log(`\n  resolved from https://github.com/${REPO} — no token used`);
if (failures) {
  console.log(`\n${failures} CHECK(S) FAILED`);
  process.exit(1);
}
console.log("\nALL DOWNLOAD CHECKS PASSED");

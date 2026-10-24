/**
 * Shared download facts for the site.
 *
 * The commands are here rather than in the pages because two pages show them
 * and they have to agree. They are written against what the release archives
 * actually contain, which was checked rather than assumed:
 *
 *   zyraxon-darwin-*.zip    → one Mach-O file named `zyraxon`, mode 644
 *   zyraxon-linux-*.tar.gz  → one ELF file named `zyraxon`, mode 644
 *   zyraxon-windows-*.zip   → one PE file named `zyraxon`, mode 644
 *
 * Two things follow from that. The binary is named `zyraxon` with no extension
 * on every platform, so the commands cannot call `zyraxon.exe` after unpacking
 * a Windows zip. And nothing in any archive carries the execute bit, so every
 * Unix command has to `chmod +x` before it will run.
 */

export const GITHUB_REPO = "onelpawarai-X/ZYRAXON-AI";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
export const RELEASES_URL = `${GITHUB_URL}/releases`;

/** The site's own origin, so the resolver-backed commands point at us. */
export const SITE_ORIGIN = "https://zyraxonai.lovable.app";

/** The npm package name for the SDK, which is separate from the CLI binary. */
export const SDK_PACKAGE = "@zyraxon-ai/sdk";

/** `label` is the full name; `short` is what fits on a switcher button. */
export type CliCommand = { label: string; short?: string; code: string };

/**
 * The asset name is discovered at download time, never written into a command.
 *
 * That is the whole point of routing through `/api/download/<id>`: GitHub asset
 * names change between releases — `ZYRAXON-Dev-win-x64-installer.exe` in one
 * tag, something else in the next — and a command with a hardcoded name breaks
 * silently the moment that happens. Here the server resolves the newest tag,
 * finds whichever file matches the platform, and 302s to it. The visitor's
 * command line never needs to know the name, and never needs to change.
 *
 * `-L` follows the redirect chain; `-O` writes the server's filename.
 */
export const CLI_COMMANDS: CliCommand[] = [
  {
    label: "macOS · Apple Silicon",
    short: "macOS · ARM",
    code: `curl -fL ${SITE_ORIGIN}/api/download/cli-mac-arm -o zyraxon.zip && unzip -o zyraxon.zip && chmod +x zyraxon && xattr -d com.apple.quarantine zyraxon 2>/dev/null; ./zyraxon --version`,
  },
  {
    label: "macOS · Intel",
    short: "macOS · Intel",
    code: `curl -fL ${SITE_ORIGIN}/api/download/cli-mac-intel -o zyraxon.zip && unzip -o zyraxon.zip && chmod +x zyraxon && xattr -d com.apple.quarantine zyraxon 2>/dev/null; ./zyraxon --version`,
  },
  {
    label: "Linux · x64",
    short: "Linux · x64",
    code: `curl -fL ${SITE_ORIGIN}/api/download/cli-linux | tar xz && chmod +x zyraxon && ./zyraxon --version`,
  },
  {
    label: "Linux · x64 (musl)",
    short: "Linux · musl",
    code: `curl -fL ${SITE_ORIGIN}/api/download/cli-linux-musl | tar xz && chmod +x zyraxon && ./zyraxon --version`,
  },
  {
    label: "Linux · ARM64",
    short: "Linux · ARM64",
    code: `curl -fL ${SITE_ORIGIN}/api/download/cli-linux-arm64 | tar xz && chmod +x zyraxon && ./zyraxon --version`,
  },
  {
    label: "Windows · PowerShell",
    short: "Windows",
    // The archive holds the binary as `zyraxon` with no extension even though it
    // is a PE file, and Windows will not run it by that name. The command
    // renames it rather than pretending `zyraxon.exe` already exists.
    code: `$d = "$env:USERPROFILE\\zyraxon"; Invoke-WebRequest "${SITE_ORIGIN}/api/download/cli-windows" -OutFile "$d.zip"; Expand-Archive "$d.zip" -DestinationPath $d -Force; Rename-Item "$d\\zyraxon" "$d\\zyraxon.exe" -Force; & "$d\\zyraxon.exe" --version`,
  },
];

/**
 * Move the downloaded binary onto the PATH.
 *
 * Kept apart from the install line above because it needs `sudo` and writes
 * outside the working directory, so it is a step a person should choose to run
 * rather than something a copy-paste does silently.
 */
export const CLI_PATH_COMMANDS: CliCommand[] = [
  {
    label: "macOS / Linux",
    code: "sudo mv zyraxon /usr/local/bin/ && zyraxon --version",
  },
  {
    label: "Windows · PowerShell",
    code: 'setx PATH "$env:USERPROFILE\\zyraxon;$env:PATH"',
  },
];

/** What you can do once it is installed. */
export const CLI_USAGE: CliCommand[] = [
  { label: "Start a session", code: "zyraxon" },
  { label: "Run one prompt", code: 'zyraxon run "summarise README.md"' },
  { label: "List models", code: "zyraxon models" },
  { label: "Update to the newest build", code: "zyraxon upgrade" },
];

/** The three platforms the homepage advertises, and where each button leads. */
export const HOME_DOWNLOADS = [
  {
    os: "Windows",
    detail: "Windows 10/11 (x64)",
    ext: ".exe",
    key: "windows",
  },
  {
    os: "macOS",
    detail: "macOS 12+ (Apple Silicon)",
    ext: ".dmg",
    key: "mac-arm",
  },
  {
    os: "Linux",
    detail: "Ubuntu / Debian / Fedora (x64)",
    ext: ".AppImage",
    key: "linux-appimage",
  },
];

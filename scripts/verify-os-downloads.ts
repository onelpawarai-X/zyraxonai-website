/**
 * The ZyraxonOS resolver must always answer with a real `.iso` file.
 *
 * The point of the module is that nothing about the OS is hardcoded: not the tag,
 * not the file name, not the size. The page offers exactly one button, so the
 * resolver must always hand back one bootable ISO. That is the kind of claim that
 * rots silently, so this test checks it against the live repository:
 *
 *   1. It resolves a release that really carries an `.iso`.
 *   2. The `.iso` it names is in that release and is a single image file.
 *   3. A release that only carries `.iso.part00` parts is skipped, not offered.
 *   4. The checksum, when published, is the ISO's own and is a real digest.
 *   5. A token in the environment changes nothing — the read is public.
 *
 * Run: npx tsx scripts/verify-os-downloads.ts
 */
let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// A deliberately invalid token. If the resolver ever picks it up, GitHub answers
// 401 and the test fails — the exact production symptom the public read avoids.
process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_thisTokenIsDeliberatelyInvalid00000000";
process.env.GITHUB_TOKEN = "ghp_thisTokenIsDeliberatelyInvalid00000000";

const { OS_ID, OS_REPO, isOsId, readIso, resolveOs, resolveOsTarget } =
  await import("../src/lib/os-releases.server");

// ── What counts as the image, on fixtures ────────────────────────────────────
//
// The repository has shipped a split image (`v9.0.0`: `.iso.part00`/`.part01`)
// beside single-file ones (`v1.0`/`v1.1`: a real `.iso`). Only a `.iso` is a file
// a visitor can boot, so the split shape must read as "no image here" and the
// resolver must step past it rather than offering a part.
{
  check(
    "a single-file release reads as its ISO",
    readIso(OS_REPO, "v1.1", [
      { name: "ZyraxonOS-1.0-amd64.iso", size: 1487339520 },
      { name: "ZyraxonOS-1.0-amd64.iso.sha256", size: 90 },
    ])?.name === "ZyraxonOS-1.0-amd64.iso",
  );
  check(
    "a split release reads as no image at all",
    readIso(OS_REPO, "v9.0.0", [
      { name: "ZyraxonOS-9.0.0-amd64.iso.part01", size: 595476480 },
      { name: "ZyraxonOS-9.0.0-amd64.iso.part00", size: 1992294400 },
      { name: "SHA256SUMS", size: 92 },
    ]) === null,
  );
  // A checksum file must never be read as the image: `.iso.sha256` does not end
  // in `.iso`, but a careless pattern is exactly how it would be.
  check(
    "a .sha256 file is not an image",
    readIso(OS_REPO, "v1.0", [{ name: "ZyraxonOS-1.0-amd64.iso.sha256", size: 90 }]) === null,
  );
  check(
    "a release with no image resolves to nothing",
    readIso(OS_REPO, "v0", [{ name: "notes.txt", size: 10 }]) === null,
  );
}

const data = await resolveOs({ fresh: true });
const rel = data.release;

check("an OS release was found without using the token", Boolean(rel), rel?.tag ?? data.error);

if (rel) {
  check("the release names an ISO", /\.iso$/i.test(rel.iso.name), rel.iso.name);
  check("the ISO has a download URL", /\/releases\/download\//.test(rel.iso.url), rel.iso.url);
  check(
    "the ISO reports a size",
    typeof rel.iso.size === "number" && rel.iso.size > 0,
    rel.iso.size,
  );

  // The button id must resolve to the same file the release names.
  check(
    "the button id resolves to the ISO",
    (await resolveOsTarget(OS_ID))?.name === rel.iso.name,
    rel.iso.name,
  );
  check("the button id is recognised", isOsId(OS_ID));
  check("an unrelated id is not claimed", !isOsId("windows") && !isOsId("android"));
  check("a part id is not claimed", !isOsId(`${OS_ID}-part01`));

  // Checksums are optional; when present the digest must be real.
  if (rel.sha256) {
    check("the ISO checksum is a 64-character hex digest", /^[0-9a-f]{64}$/.test(rel.sha256));
  } else {
    console.log("SKIP  no checksum published for this ISO");
  }

  // The image must actually answer as an attachment, end to end.
  try {
    const res = await fetch(rel.iso.url, { redirect: "follow" });
    const disposition = res.headers.get("content-disposition") ?? "";
    await res.body?.cancel();
    check(
      "the ISO answers as an attachment",
      res.ok && /attachment/i.test(disposition),
      `HTTP ${res.status} · ${disposition.slice(0, 60)}`,
    );
  } catch (err) {
    check("the ISO answers as an attachment", false, String(err).slice(0, 120));
  }

  console.log("\n  resolved image");
  console.log(`  tag        ${rel.tag}`);
  console.log(`  file       ${rel.iso.name}`);
  console.log(`  size       ${rel.iso.size}`);
  console.log(`  from       https://github.com/${OS_REPO}`);
}

if (failures) {
  console.log(`\n${failures} CHECK(S) FAILED`);
  process.exit(1);
}
console.log("\nALL ZYRAXONOS DOWNLOAD CHECKS PASSED");

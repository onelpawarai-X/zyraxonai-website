/**
 * The ZyraxonOS resolver must always answer with the newest release.
 *
 * The point of the module is that nothing about the OS is hardcoded: not the
 * tag, not the file name, not whether the image is one file or several parts.
 * That is exactly the kind of claim that rots silently, so this test checks it
 * against the live repository:
 *
 *   1. The tag it resolves is the one GitHub calls latest.
 *   2. The image it offers really is in that release, as a single ISO or as
 *      `part00`, `part01`, …
 *   3. Every part id resolves to its own part, in order.
 *   4. The checksums, when the release carries them, parse into real hashes.
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

const { OS_ID, OS_PART_PREFIX, OS_REPO, isOsId, readImage, resolveOs, resolveOsTarget } = await import(
  "../src/lib/os-releases.server"
);

// ── Both release shapes, on fixtures ─────────────────────────────────────────
//
// Only one shape is live at a time, so the other is checked here against the
// asset list that shape produces. The single-file form is what the repository
// shipped for v1.0/v1.1; the split form is what it ships now. A resolver that
// handled only the current one would break the day the next release switches
// back, which is exactly what happened between v1.1 and v9.0.0.
{
  const single = readImage(OS_REPO, "v1.1", [
    { name: "ZyraxonOS-1.0-amd64.iso", size: 1487339520 },
    { name: "ZyraxonOS-1.0-amd64.iso.sha256", size: 90 },
  ]);
  check(
    "a single-file release resolves to its ISO",
    single?.primary?.name === "ZyraxonOS-1.0-amd64.iso" && single.parts.length === 1 && !single.split,
    single?.primary?.name,
  );
  check("a single-file release keeps the ISO name", single?.isoName === "ZyraxonOS-1.0-amd64.iso", single?.isoName);
  check(
    "a single-file release reports the whole size",
    single?.totalBytes === 1487339520,
    single?.totalBytes,
  );

  const split = readImage(OS_REPO, "v9.0.0", [
    { name: "ZyraxonOS-9.0.0-amd64.iso.part01", size: 595476480 },
    { name: "ZyraxonOS-9.0.0-amd64.iso.part00", size: 1992294400 },
    { name: "SHA256SUMS", size: 92 },
  ]);
  check(
    "a split release orders its parts numerically, not by listing order",
    split?.parts.map((p) => p.name).join(",") ===
      "ZyraxonOS-9.0.0-amd64.iso.part00,ZyraxonOS-9.0.0-amd64.iso.part01",
    split?.parts.map((p) => p.name).join(","),
  );
  check("a split release is flagged as split", split?.split === true);
  check(
    "a split release rejoins to an ISO",
    split?.isoName === "ZyraxonOS-9.0.0-amd64.iso",
    split?.isoName,
  );
  check(
    "a split release sums its parts",
    split?.totalBytes === 1992294400 + 595476480,
    split?.totalBytes,
  );

  // A release with no image at all must not be mistaken for one.
  check(
    "a release with no image resolves to nothing",
    readImage(OS_REPO, "v0", [{ name: "notes.txt", size: 10 }]) === null,
  );
  // A checksum file must never be read as the image.
  check(
    "a .sha256 file is not an image",
    readImage(OS_REPO, "v0", [{ name: "ZyraxonOS-1.0-amd64.iso.sha256", size: 90 }]) === null,
  );
}

const data = await resolveOs({ fresh: true });
const rel = data.release;

check("an OS release was found without using the token", Boolean(rel), rel?.tag ?? data.error);

if (rel) {
  // The resolver must not have settled for an older tag when a newer one exists.
  const latest = await fetch(`https://github.com/${OS_REPO}/releases/latest`, {
    redirect: "manual",
  });
  const tag = (latest.headers.get("location") ?? "").match(/\/releases\/tag\/(.+)$/)?.[1];
  check(
    "the resolved tag is GitHub's latest",
    Boolean(tag) && decodeURIComponent(tag!) === rel.tag,
    `resolved ${rel.tag}, latest ${tag ? decodeURIComponent(tag) : "(unreadable)"}`,
  );

  check("the release names an image", Boolean(rel.isoName), rel.isoName ?? "(none)");
  check("the primary asset is an ISO or its first part", Boolean(rel.primary), rel.primary?.name);
  check(
    "every part is an .iso or an .iso.part<NN>",
    rel.parts.every((p) => /\.iso(\.part\d+)?$/i.test(p.name)),
    rel.parts.map((p) => p.name).join(", "),
  );

  if (rel.split) {
    check("a split image has more than one part", rel.parts.length > 1, `${rel.parts.length}`);
    check(
      "the parts are in numeric order",
      rel.parts.every((p, i) => Number(p.name.match(/\.part(\d+)$/)?.[1] ?? -1) === i),
      rel.parts.map((p) => p.name.match(/\.part(\d+)$/)?.[1]).join(","),
    );
    check(
      "the primary asset is part 0",
      rel.primary?.name.endsWith(".part00") || rel.primary?.name.endsWith(".part0"),
      rel.primary?.name,
    );
    check("a split image sums to a whole size", Boolean(rel.totalBytes), rel.totalBytes);
    // The rejoin name must still be an ISO: `cat part00 part01 > x` is only a
    // bootable image when `x` ends in `.iso`.
    check(
      "the rejoin name drops only the part suffix",
      /\.iso$/i.test(rel.isoName!),
      rel.isoName,
    );
  } else {
    check("a single-file image is one part", rel.parts.length === 1, `${rel.parts.length}`);
  }

  // Every part id the page could build must resolve to its own part.
  const ids = rel.parts.map((_, i) => `${OS_PART_PREFIX}${String(i).padStart(2, "0")}`);
  const resolved = await Promise.all(ids.map((id) => resolveOsTarget(id)));
  check(
    "every part id resolves to its own part",
    resolved.every((a, i) => a?.name === rel.parts[i]?.name),
    ids.join(", "),
  );
  check(
    "the bare id resolves to the primary asset",
    (await resolveOsTarget(OS_ID))?.name === rel.primary?.name,
    rel.primary?.name,
  );

  // The id shape is what the redirect route keys on.
  check("the bare id is recognised", isOsId(OS_ID));
  check("a part id is recognised", isOsId(`${OS_PART_PREFIX}01`));
  check("an unrelated id is not claimed", !isOsId("windows") && !isOsId("android"));
  check("an out-of-range part does not resolve", (await resolveOsTarget(`${OS_PART_PREFIX}99`)) === null);

  // Checksums are optional; when present they must be real.
  if (rel.checksums.length) {
    check(
      "every checksum is a 64-character hex digest",
      rel.checksums.every((c) => /^[0-9a-f]{64}$/.test(c.hash)),
      `${rel.checksums.length} checksum(s)`,
    );
  } else {
    console.log("SKIP  no checksum file in this release");
  }

  // The image must actually answer as an attachment, end to end.
  if (rel.primary) {
    try {
      const res = await fetch(rel.primary.url, { redirect: "follow" });
      const disposition = res.headers.get("content-disposition") ?? "";
      await res.body?.cancel();
      check(
        "the image answers as an attachment",
        res.ok && /attachment/i.test(disposition),
        `HTTP ${res.status} · ${disposition.slice(0, 60)}`,
      );
    } catch (err) {
      check("the image answers as an attachment", false, String(err).slice(0, 120));
    }
  }

  console.log("\n  resolved image");
  console.log(`  tag        ${rel.tag}`);
  console.log(`  file       ${rel.isoName}`);
  console.log(`  parts      ${rel.parts.length}${rel.split ? " (split)" : ""}`);
  console.log(`  primary    ${rel.primary?.name}`);
  console.log(`  from       https://github.com/${OS_REPO}`);
}

if (failures) {
  console.log(`\n${failures} CHECK(S) FAILED`);
  process.exit(1);
}
console.log("\nALL ZYRAXONOS DOWNLOAD CHECKS PASSED");

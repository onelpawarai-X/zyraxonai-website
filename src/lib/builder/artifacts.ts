export type BuilderFile = { path: string; content: string; encoding?: "utf8" | "base64" };

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number) {
  return new Uint8Array([value & 255, (value >>> 8) & 255]);
}
function u32(value: number) {
  return new Uint8Array([
    value & 255,
    (value >>> 8) & 255,
    (value >>> 16) & 255,
    (value >>> 24) & 255,
  ]);
}
function concat(parts: Uint8Array[]) {
  const size = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
function base64Bytes(value: string) {
  const raw = atob(value.replace(/\s/g, ""));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Store-only ZIP writer that preserves both UTF-8 source files and imported binary files. */
export function createProjectZip(files: BuilderFile[]) {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.path.replace(/^\/+/, ""));
    const data =
      file.encoding === "base64" ? base64Bytes(file.content) : encoder.encode(file.content);
    const crc = crc32(data);
    const local = concat([
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    locals.push(local);
    centrals.push(
      concat([
        new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += local.length;
  }
  const central = concat(centrals);
  const body = concat(locals);
  const end = concat([
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(body.length),
    u16(0),
  ]);
  return new Blob([body, central, end], { type: "application/zip" });
}

function pdfEscape(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7e]/g, "?");
}

/** Minimal standards-compatible PDF renderer for generated text documents. */
export function createTextPdf(title: string, content: string) {
  const lines = [title, "", ...content.split(/\r?\n/)]
    .flatMap((line) => {
      const safe = line.length > 96 ? (line.match(/.{1,96}/g) ?? [""]) : [line];
      return safe;
    })
    .slice(0, 48);
  const stream = [
    "BT",
    "/F1 18 Tf",
    "50 760 Td",
    `(${pdfEscape(lines[0] ?? "ZYRAXON PDF")}) Tj`,
    "/F1 10 Tf",
    ...lines.slice(1).map((line) => `0 -15 Td (${pdfEscape(line)}) Tj`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  const chunks = ["%PDF-1.4\n"];
  const offsets: number[] = [];
  let length = chunks[0].length;
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(length);
    const chunk = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    chunks.push(chunk);
    length += chunk.length;
  }
  const xref = length;
  chunks.push(
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`,
  );
  return new Blob(chunks, { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return url;
}

/** The `Sec-MS-GEC` token Microsoft Edge's Read Aloud endpoint demands.
 *
 *  Since late 2026 that endpoint rejects a request without a v2 token, and the
 *  v2 token is not a plain SHA-256 of a timestamp — it is a digest built from a
 *  modified SHA-256 plus a custom CS64 mixer, and only the reference
 *  implementation (the `edge-tts` project) gets it right. This is a faithful
 *  port of that algorithm, so the site can synthesise speech without depending
 *  on a Python process, which the Workers runtime cannot run anyway.
 *
 *  Everything is BigInt. The algorithm multiplies a 32-bit word by 2^32 + 1 and
 *  relies on the full 64-bit product, which a JS number cannot hold exactly, so
 *  plain arithmetic would silently produce the wrong token. BigInt is exact, and
 *  this runs once per connection rather than per token. */

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WIN_EPOCH = 11644473600;
const U32 = 0xffffffffn;

export const CHROMIUM_FULL_VERSION = "143.0.3650.75";
export const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`;
/** The synthesis host, as https rather than wss.
 *
 *  A Workers-style runtime upgrades to a WebSocket through `fetch` with an
 *  `Upgrade: websocket` header, and it rejects a `wss://` URL outright —
 *  "Fetch API cannot load". So the URL stays https and the upgrade header does
 *  the work. */
export const EDGE_WSS_URL =
  "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
export const EDGE_VOICE_LIST_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;

const SHA256_INITIAL = [
  0x6a09e667n,
  0xbb67ae85n,
  0x3c6ef372n,
  0xa54ff53an,
  0x510e527fn,
  0x9b05688cn,
  0x1f83d9abn,
  0x5be0cd19n,
];
const SHA256_STATE = [
  0xfd9fbea2n,
  0x91243ce7n,
  0xbe499094n,
  0xcd2e1e0an,
  0x6c006f49n,
  0x04bd35abn,
  0xfeb0a7e4n,
  0x03effbd2n,
];
const SHA256_SCHEDULE = [
  0xeb24bf9en,
  0x1558691fn,
  0xa0c09ee2n,
  0x0cfa32ban,
  0xa622ee8cn,
  0xd1dd9491n,
  0xc0dd25a0n,
  0xf9e70ab6n,
  0xf0c31573n,
  0x7058ce4en,
  0x7188e606n,
  0x00e5ab33n,
  0xd258b060n,
  0x72766564n,
];
const SHA256_ROUND_CONSTANTS = [
  0x428a2f98n,
  0x71374491n,
  0xb5c0fbcfn,
  0xe9b5dba5n,
  0x3956c25bn,
  0x59f111f1n,
  0x923f82a4n,
  0xab1c5ed5n,
  0xd807aa98n,
  0x12835b01n,
  0x243185ben,
  0x550c7dc3n,
  0x72be5d74n,
  0x80deb1fen,
  0x9bdc06a7n,
  0xc19bf174n,
  0xe49b69c1n,
  0xefbe4786n,
  0x0fc19dc6n,
  0x240ca1ccn,
  0x2de92c6fn,
  0x4a7484aan,
  0x5cb0a9dcn,
  0x76f988dan,
  0x983e5152n,
  0xa831c66dn,
  0xb00327c8n,
  0xbf597fc7n,
  0xc6e00bf3n,
  0xd5a79147n,
  0x06ca6351n,
  0x14292967n,
  0x27b70a85n,
  0x2e1b2138n,
  0x4d2c6dfcn,
  0x53380d13n,
  0x650a7354n,
  0x766a0abbn,
  0x81c2c92en,
  0x92722c85n,
  0xa2bfe8a1n,
  0xa81a664bn,
  0xc24b8b70n,
  0xc76c51a3n,
  0xd192e819n,
  0xd6990624n,
  0xf40e3585n,
  0x106aa070n,
  0x19a4c116n,
  0x1e376c08n,
  0x2748774cn,
  0x34b0bcb5n,
  0x391c0cb3n,
  0x4ed8aa4an,
  0x5b9cca4fn,
  0x682e6ff3n,
  0x748f82een,
  0x78a5636fn,
  0x84c87814n,
  0x8cc70208n,
  0x90befffan,
  0xa4506cebn,
  0xbef9a3f7n,
  0xc67178f2n,
];
const SHA256_ADJUSTMENT = 0xc9dc06a7n;
const SHA256_BLOCK_CONSTANTS = [
  ...SHA256_ROUND_CONSTANTS.slice(0, 14),
  SHA256_ADJUSTMENT,
  ...SHA256_ROUND_CONSTANTS.slice(15),
];
const SHA256_SIGMA0_ADJUSTMENT = 0x059c0b80n;
const SHA256_SIGMA1_ADJUSTMENT = 0x000b92c0n;

const CS64_COEFFICIENTS: Array<[bigint, bigint]> = [
  [0xe82e91b1n, 0xb32700d0n],
  [0x44de24c6n, 0x88dff51dn],
  [0x3beb65bcn, 0x29514038n],
  [0xc89c5933n, 0xb328cbdfn],
  [0x8d1ec211n, 0xd405b4d5n],
  [0x314ef5d5n, 0x26e55f3cn],
  [0xe92491b1n, 0x607801c6n],
  [0xf0a5b9d5n, 0x82b2c1fbn],
  [0x06064cf3n, 0xfa51a3dan],
  [0xda79fa60n, 0x207cc464n],
  [0xbed20560n, 0x3c3c74f3n],
  [0x89f9c9f8n, 0xd2d14b61n],
  [0x35fa38c6n, 0xbb04a2c1n],
  [0xcb49e3c6n, 0xc5626167n],
];
const CS64_FACTOR = 0x82893933n;
const CS64_ADJUSTMENT0 = 0xf2f90b1an;
const CS64_ADJUSTMENT1 = 0x0b1a0000n;

const rol16 = (v: bigint) => (((v & U32) << 16n) | ((v & U32) >> 16n)) & U32;
const sigma0 = (v: bigint) => ((v >> 7n) ^ (v << 25n) ^ (v >> 18n) ^ (v << 14n) ^ (v >> 3n)) & U32;
const sigma1 = (v: bigint) =>
  ((v >> 17n) ^ (v << 15n) ^ (v >> 19n) ^ (v << 13n) ^ (v >> 10n)) & U32;

/** Little-endian 32-bit words, zero-padded to an even count. */
function wordsLe4Even(data: Uint8Array): bigint[] {
  const padded = new Uint8Array(Math.ceil(data.length / 4) * 4);
  padded.set(data);
  const words: bigint[] = [];
  for (let i = 0; i < padded.length; i += 4) {
    words.push(
      BigInt(padded[i]! | (padded[i + 1]! << 8) | (padded[i + 2]! << 16) | (padded[i + 3]! << 24)),
    );
  }
  if (words.length % 2) words.push(0n);
  return words;
}

function sha256Rounds(state: bigint[], words: bigint[], firstRound = 0): bigint[] {
  let [a, b, c, d, e, f, g, h] = state as [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
  ];
  const constants = firstRound === 14 ? SHA256_BLOCK_CONSTANTS : SHA256_ROUND_CONSTANTS;
  const aligned = Math.min(64, Math.floor((firstRound + 7) / 8) * 8);

  for (let i = firstRound; i < aligned; i++) {
    const rotE = e * 0x100000001n;
    const rotA = a * 0x100000001n;
    const t1 =
      h +
      ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) +
      (g ^ (e & (f ^ g))) +
      constants[i]! +
      words[i]!;
    const t2 = ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((a & b) | (c & (a | b)));
    [a, b, c, d, e, f, g, h] = [(t1 + t2) & U32, a, b, c, (d + t1) & U32, e, f, g];
  }

  // Eight rounds return the working-register names to their original order, so
  // the roles are rotated in the expressions instead of moving eight values.
  for (let i = aligned; i < 64; i += 8) {
    {
      const rotE = e * 0x100000001n;
      const rotA = a * 0x100000001n;
      const t1 =
        h +
        ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) +
        (g ^ (e & (f ^ g))) +
        constants[i]! +
        words[i]!;
      d = (d + t1) & U32;
      h = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((a & b) | (c & (a | b)))) & U32;
    }
    {
      const rotE = d * 0x100000001n;
      const rotA = h * 0x100000001n;
      const t1 =
        g +
        ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) +
        (f ^ (d & (e ^ f))) +
        constants[i + 1]! +
        words[i + 1]!;
      c = (c + t1) & U32;
      g = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((h & a) | (b & (h | a)))) & U32;
    }
    {
      const rotE = c * 0x100000001n;
      const rotA = g * 0x100000001n;
      const t1 =
        f +
        ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) +
        (e ^ (c & (d ^ e))) +
        constants[i + 2]! +
        words[i + 2]!;
      b = (b + t1) & U32;
      f = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((g & h) | (a & (g | h)))) & U32;
    }
    {
      const rotE = b * 0x100000001n;
      const rotA = f * 0x100000001n;
      const t1 =
        e +
        ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) +
        (d ^ (b & (c ^ d))) +
        constants[i + 3]! +
        words[i + 3]!;
      a = (a + t1) & U32;
      e = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((f & g) | (h & (f | g)))) & U32;
    }
    {
      const rotE = a * 0x100000001n;
      const rotA = e * 0x100000001n;
      const t1 =
        d +
        ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) +
        (c ^ (a & (b ^ c))) +
        constants[i + 4]! +
        words[i + 4]!;
      h = (h + t1) & U32;
      d = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((e & f) | (g & (e | f)))) & U32;
    }
    {
      const rotE = h * 0x100000001n;
      const rotA = d * 0x100000001n;
      const t1 =
        c +
        ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) +
        (b ^ (h & (a ^ b))) +
        constants[i + 5]! +
        words[i + 5]!;
      g = (g + t1) & U32;
      c = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((d & e) | (f & (d | e)))) & U32;
    }
    {
      const rotE = g * 0x100000001n;
      const rotA = c * 0x100000001n;
      const t1 =
        b +
        ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) +
        (a ^ (g & (h ^ a))) +
        constants[i + 6]! +
        words[i + 6]!;
      f = (f + t1) & U32;
      b = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((c & d) | (e & (c | d)))) & U32;
    }
    {
      const rotE = f * 0x100000001n;
      const rotA = b * 0x100000001n;
      const t1 =
        a +
        ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) +
        (h ^ (f & (g ^ h))) +
        constants[i + 7]! +
        words[i + 7]!;
      e = (e + t1) & U32;
      a = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((b & c) | (d & (b | c)))) & U32;
    }
  }
  return [a, b, c, d, e, f, g, h];
}

function expandSchedule(words: bigint[], firstWord = 16): void {
  for (let i = firstWord; i < 64; i++) {
    const x = words[i - 2]!;
    const y = words[i - 15]!;
    const s1 = (x >> 17n) ^ (x << 15n) ^ (x >> 19n) ^ (x << 13n) ^ (x >> 10n);
    const s0 = (y >> 7n) ^ (y << 25n) ^ (y >> 18n) ^ (y << 14n) ^ (y >> 3n);
    words.push((s1 + words[i - 7]! + s0 + words[i - 16]!) & U32);
  }
}

function sha256Init(data: Uint8Array): bigint[] {
  const words: bigint[] = new Array(14).fill(0n);
  words.push(BigInt((data[0]! << 16) | (data[1]! << 8) | data[2]!));
  words.push(BigInt((data[3]! << 24) | (data[4]! << 16) | (data[5]! << 8) | data[6]!));
  for (let i = 16; i < 30; i++) {
    let value = SHA256_SCHEDULE[i - 16]!;
    if (i - 2 >= 14) {
      value += i === 16 ? sigma1(words[i - 2]!) ^ SHA256_SIGMA1_ADJUSTMENT : sigma1(words[i - 2]!);
    }
    if (i - 7 >= 14) value += words[i - 7]!;
    if (i - 15 >= 14) {
      value +=
        i === 29 ? sigma0(words[i - 15]!) ^ SHA256_SIGMA0_ADJUSTMENT : sigma0(words[i - 15]!);
    }
    words.push(value & U32);
  }
  words.push(
    (sigma1(words[28]!) +
      words[23]! +
      sigma0(words[15]!) +
      words[14]! +
      SHA256_ADJUSTMENT -
      SHA256_ROUND_CONSTANTS[14]!) &
      U32,
  );
  expandSchedule(words, 31);
  const working = sha256Rounds([...SHA256_STATE], words, 14);
  return working.map((x, i) => (x + SHA256_INITIAL[i]!) & U32);
}

function sha256Digest(data: Uint8Array): Uint8Array {
  const length = 57 + data.length;
  // Python's `%` is always non-negative; JavaScript's is not, and `55 - length`
  // is negative for every realistic input. A plain `%` here would ask for a
  // negative amount of padding and corrupt the buffer.
  const padLen = (((55 - length) % 64) + 64) % 64;
  // Mirror the reference exactly: the message is `data[7:]`, then 0x80, then
  // zero padding, then the 8-byte big-endian bit length.
  const tail = data.subarray(7);
  const padded = new Uint8Array(tail.length + 1 + padLen + 8);
  padded.set(tail, 0);
  padded[tail.length] = 0x80;
  const view = new DataView(padded.buffer);
  // The bit length is written big-endian as 64 bits; the high word is zero here.
  view.setUint32(padded.length - 8, 0, false);
  view.setUint32(padded.length - 4, (length * 8) >>> 0, false);

  let state = sha256Init(data.subarray(0, 7));
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words: bigint[] = [];
    for (let i = 0; i < 16; i++) words.push(BigInt(view.getUint32(offset + i * 4, false)));
    expandSchedule(words);
    const working = sha256Rounds([...state], words);
    state = working.map((x, i) => (x + state[i]!) & U32);
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  state.forEach((v, i) => outView.setUint32(i * 4, Number(v), false));
  return out;
}

function cs64Digest(data: Uint8Array, digest: Uint8Array): [bigint, bigint] {
  const dv = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  const keyA = BigInt(dv.getUint32(0, true)) | 1n;
  const keyB = BigInt(dv.getUint32(4, true)) | 1n;
  const factors = [(keyA * CS64_FACTOR) & U32, (keyB * CS64_FACTOR) & U32];

  const terms: bigint[] = CS64_COEFFICIENTS.map(
    ([coefficient], index) => (coefficient * factors[index % 2]!) & U32,
  );
  const offsets: bigint[] = CS64_COEFFICIENTS.map(([, offset]) => offset);

  const prefixed = new Uint8Array(data.length + 1);
  prefixed.set(data, 1);
  wordsLe4Even(prefixed).forEach((word, index) => {
    let term = word * (index % 2 === 0 ? keyA : keyB);
    let offset = rol16(word) * (index % 2 === 0 ? 0xef0569fbn : 0xc31713dbn);
    if (index === 0) {
      term += CS64_ADJUSTMENT0 * factors[0]!;
      offset += CS64_ADJUSTMENT1;
    }
    terms.push(term & U32);
    offsets.push(offset & U32);
  });

  let swapAcc = 0n;
  let swapLast = 0n;
  let state = 0n;
  let acc = 0n;
  for (let i = 0; i < terms.length; i += 2) {
    const x = terms[i]!;
    const y = terms[i + 1]!;
    let t = rol16((offsets[i]! + x) & U32);
    let q = (t * 0x76f50f34n) & U32;
    swapAcc += (rol16(q) * 0xc3efea97n + q) & U32;
    t = rol16((offsets[i + 1]! + y) & U32);
    q = (t * 0x1881ce3cn) & U32;
    swapLast = (rol16(q) * 0x35bd1ec9n + q) & U32;
    swapAcc = (swapAcc + swapLast) & U32;

    state = (state * keyA + x) & U32;
    state = (rol16(state) * 0xcf98b111n) & U32;
    state = (rol16(state) * 0x87085b9fn) & U32;
    state = (rol16(state) * 0x12ceb96dn) & U32;
    state = (rol16(state) * 0x257e1d83n) & U32;
    acc += state;
    t = (state * keyB + y) & U32;
    t = (rol16(t) * 0xa27416f5n) & U32;
    t = (rol16(t) * 0xd38396ffn) & U32;
    state = (rol16((rol16(t) * 0x7c932b89n) & U32) * 0xbfa49f69n) & U32;
    acc = (acc + state) & U32;
  }
  return [swapLast ^ state, swapAcc ^ acc];
}

const hex = (v: bigint, width: number) => v.toString(16).toUpperCase().padStart(width, "0");
const hexBytes = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

/** A 32-bit word as little-endian hex, which is how the reference packs it.
 *  The reference uses `struct.pack("<II", ...)`, so the digest bytes are the
 *  value's bytes in reverse order. Emitting the plain big-endian hex produces a
 *  token that looks right and is rejected, which is a costly thing to debug. */
function hexLE(v: bigint): string {
  const be = hex(v, 8);
  return be.slice(6, 8) + be.slice(4, 6) + be.slice(2, 4) + be.slice(0, 2);
}

/** The token value the endpoint requires, for the current five-minute window. */
export function secMsGec(now = Date.now()): string {
  let ticks = now / 1000 + WIN_EPOCH;
  ticks -= ticks % 300;
  ticks = Math.floor(ticks) * 10_000_000;
  const data = new TextEncoder().encode(`${ticks}${TRUSTED_CLIENT_TOKEN}`);
  const digest = sha256Digest(data);
  const [lo, hi] = cs64Digest(data, digest);
  return `${hexLE(lo)}${hexLE(hi)}-${hexBytes(digest)}`;
}

/** A fresh connection id, without dashes, as the endpoint expects. */
export function connectionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The full WebSocket URL for a synthesis connection. */
export function edgeSynthesisUrl(): string {
  return (
    `${EDGE_WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}` +
    `&ConnectionId=${connectionId()}`
  );
}

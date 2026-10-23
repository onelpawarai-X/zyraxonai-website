/** The free-tier reset clock: the upstream's `retry-after` is parsed, kept, and
 *  reported back with a countdown that shrinks. Proves the number a caller sees
 *  is the upstream's own, not a placeholder. */
import {
  clearQuotaReset,
  parseRetryAfter,
  noteQuotaRefusal,
  noteQuotaReset,
  quotaResetStatus,
  resetQuotaClock,
} from "../src/lib/providers/quota.server";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`PASS  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail !== undefined ? `\n        ${detail}` : ""}`);
  }
}

// parsing: delta-seconds
check("delta-seconds are read as whole seconds", parseRetryAfter("300") === 300, parseRetryAfter("300"));
check("a fractional value rounds up", parseRetryAfter("1.2") === 2, parseRetryAfter("1.2"));
check("zero is a valid value", parseRetryAfter("0") === 0, parseRetryAfter("0"));
// parsing: HTTP-date
const inTen = new Date(Date.now() + 10_000).toUTCString();
const parsed = parseRetryAfter(inTen);
check("an HTTP-date is converted to seconds", typeof parsed === "number" && parsed >= 9 && parsed <= 10, parsed);
// parsing: junk never becomes a countdown
check("a missing header is undefined", parseRetryAfter(null) === undefined, parseRetryAfter(null));
check("an empty header is undefined", parseRetryAfter("") === undefined, parseRetryAfter(""));
check("junk is undefined, not NaN", parseRetryAfter("soon") === undefined, parseRetryAfter("soon"));

// state: a recorded reset is published with a live countdown
resetQuotaClock();
check("nothing is published before a refusal", quotaResetStatus().spent === false);
noteQuotaReset(300);
const st = quotaResetStatus();
check("a spent quota is published as spent", st.spent === true, st.spent);
check("the countdown is the upstream's own number", st.retryAfterSeconds === 300, st.retryAfterSeconds);
check("an absolute reset moment is published", !Number.isNaN(Date.parse(String(st.resetAt))), st.resetAt);
check("the reset lands about 300s out", Math.abs(Date.parse(String(st.resetAt)) - (Date.now() + 300_000)) < 2_000, st.resetAt);

// state: the countdown shrinks as time passes
const later = quotaResetStatus(Date.now() + 60_000);
check("the countdown shrinks with time", later.retryAfterSeconds! < 300 && later.retryAfterSeconds! > 230, later.retryAfterSeconds);

// state: a passed reset stays spent until something is actually served.
//
// This is the bug that made two browsers disagree: an isolate whose recorded
// deadline had passed announced an open pool while every request was still
// refused, so one profile read "Free tier open, 00:00:00" and another, on a
// fresh isolate that had never seen a refusal, read the real countdown. A
// timer running out is a reason to ask again, never a reason to claim
// capacity — thirty direct attempts during that window all came back 429.
const passed = quotaResetStatus(Date.now() + 400_000);
check("a passed reset is still reported spent", passed.spent === true, passed.spent);
check("but with no countdown left to show", passed.retryAfterSeconds === undefined);
check("so a surface cannot draw a zero that means 'open'", passed.resetAt === undefined);

// state: only a served turn or a probe may reopen the pool
resetQuotaClock();
noteQuotaReset(300);
clearQuotaReset();
check("a served turn reopens the pool", quotaResetStatus().spent === false);

// state: a cold isolate admits it does not know, rather than guessing "open".
//
// This is the other half of the two-browser disagreement: an isolate that had
// never seen a refusal answered "the pool is open" because it had no record,
// not because anything had been served.
resetQuotaClock();
const cold = quotaResetStatus();
check("a cold isolate is not spent", cold.spent === false);
check("but it says so as unknown, not as open", cold.unknown === true);

// state: a refusal with no deadline still marks the pool shut for a while
resetQuotaClock();
noteQuotaRefusal();
const refused = quotaResetStatus();
check("a refusal with no deadline marks the pool spent", refused.spent === true, refused.spent);
check("and it carries no countdown to draw", refused.retryAfterSeconds === undefined);
check("the pool reopens on its own once the memory ages out", quotaResetStatus(Date.now() + 400_000).spent === false);

// state: an unusable header changes nothing
resetQuotaClock();
noteQuotaReset(undefined);
noteQuotaReset(0);
check("a refusal with no clock leaves the state untouched", quotaResetStatus().spent === false);

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL QUOTA CLOCK CHECKS PASSED");
process.exit(failures ? 1 : 0);

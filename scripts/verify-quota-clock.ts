/** The free-tier reset clock: the upstream's `retry-after` is parsed, kept, and
 *  reported back with a countdown that shrinks. Proves the number a caller sees
 *  is the upstream's own, not a placeholder. */
import {
  parseRetryAfter,
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

// state: a passed reset is not reported as spent — a turn is worth trying again
check("a passed reset is no longer spent", quotaResetStatus(Date.now() + 400_000).spent === false);
check("and it publishes no countdown", quotaResetStatus(Date.now() + 400_000).retryAfterSeconds === undefined);

// state: an unusable header changes nothing
resetQuotaClock();
noteQuotaReset(undefined);
noteQuotaReset(0);
check("a refusal with no clock leaves the state untouched", quotaResetStatus().spent === false);

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL QUOTA CLOCK CHECKS PASSED");
process.exit(failures ? 1 : 0);

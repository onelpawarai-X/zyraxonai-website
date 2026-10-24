/** The 100k-star commitment, in one place.
 *
 *  ZYRAXON's own provider is published, documented and reachable, but it is
 *  not serving turns yet. The condition is a public one: the repository reaches
 *  100,000 stars, and the company and its own provider are stood up. Until
 *  then every provider surface says so plainly, in the same words, and tells a
 *  caller how far along the count is — so the answer is never "the API is
 *  broken", it is "this is the deal, and here is the number".
 *
 *  This file is deliberately free of server-only imports: the API routes, the
 *  provider page, the docs and the homepage all read the same text from here,
 *  so a visitor and a client can never be told two different stories. */

export const STAR_REPO = "onelpawarai-X/ZYRAXON-AI";
export const STAR_REPO_URL = `https://github.com/${STAR_REPO}`;

/** The number the whole thing turns on. */
export const STAR_GOAL = 100_000;

/** The switch.
 *
 *  `false` is the state the site ships in: the provider line is published and
 *  documented, but it does not serve turns, and every request is answered with
 *  the notice below plus the live star count. When the repository reaches the
 *  goal, standing the provider up is this one flag — there is no second place
 *  that has to agree, because every surface reads the gate from here. */
export const providerGateOpen = false;

/** One sentence a machine can print, and the fields behind it. */
export const GATE_TITLE = "The ZYRAXON provider is not open yet";

export const GATE_MESSAGE =
  "Our own provider is switched off, on purpose, until this repository reaches " +
  "100,000 stars on GitHub. This is permanent: it is not a quota that resets, " +
  "not an outage, and not something a retry or a new key will get around. When " +
  "the count reaches the goal we stand up our own company and our own provider, " +
  "and this endpoint starts answering. Until then it answers with this notice " +
  "and the current star count, so you can watch it move.";

export const GATE_HOW_TO_HELP =
  "Star the repository to move the number. Every star is counted live from " +
  "GitHub and shown in the reply to every request to this endpoint.";

/** What stays available while the gate is shut.
 *
 *  Speech does not route through the model line, and the site's own read-aloud
 *  buttons use it, so it is left on. Saying that here means the notice is a
 *  complete answer rather than a blanket refusal. */
export const GATE_STILL_OPEN =
  "Text to speech and speech to text stay available: they do not run on the " +
  "model line, and the ZYRAXON site reads its own pages aloud with them.";

export type StarGateState = {
  /** Whether the provider is serving turns. False until the goal is met. */
  open: boolean;
  /** Stars needed before the provider opens. */
  goal: number;
  /** Stars counted on the last read, or null when GitHub could not be read. */
  stars: number | null;
  /** Stars still to go, or null when the count is unknown. */
  remaining: number | null;
  /** 0–1, for a progress bar. Null when the count is unknown. */
  progress: number | null;
  title: string;
  message: string;
  howToHelp: string;
  stillOpen: string;
  repo: string;
  repoUrl: string;
  /** When the count was read, so a client can tell a fresh number from a cached one. */
  checkedAt: string;
};

/** The gate as the API publishes it. `stars` is filled in by the server read. */
export function starGateState(stars: number | null, checkedAt: string): StarGateState {
  const remaining = stars === null ? null : Math.max(0, STAR_GOAL - stars);
  return {
    open: false,
    goal: STAR_GOAL,
    stars,
    remaining,
    progress: stars === null ? null : Math.min(1, stars / STAR_GOAL),
    title: GATE_TITLE,
    message: GATE_MESSAGE,
    howToHelp: GATE_HOW_TO_HELP,
    stillOpen: GATE_STILL_OPEN,
    repo: STAR_REPO,
    repoUrl: STAR_REPO_URL,
    checkedAt,
  };
}

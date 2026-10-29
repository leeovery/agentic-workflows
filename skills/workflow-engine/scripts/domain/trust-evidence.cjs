'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the evidence this machine logged on a project (16.12, 16.13)
// — each answer the trust log holds and where it stands, and with them the
// departures and the verdicts given on them, read in one pass. It counts
// nothing and stores nothing (16.13.6): the ask rule's counts are read from
// its answers (29.19), the verdict queue and `verdict give` from its
// departures and verdicts (ledger-verdicts.cjs, verdict.cjs).
//
// - The read: the project's events on this machine, whose trust log it is
//   (16.13.1) — landed in the log; waiting in a conversation after an append
//   that failed; or kept ahead of an entry this state's ledger holds, by
//   whichever of the project's clones, its landing failed or never run — each once by its id, an event under
//   another project's id never this one's (16.13.5, trust-log.cjs).
// - Each answer stands, by its event:
//   - a raise answered with Claude's sealed answer: an agreement;
//   - a raise answered with another row, or in the person's own words, which
//     name no row: a departure (16.10.1);
//   - a raise the person didn't follow: no weight (16.12.3);
//   - a call: Claude's own call;
//   - a reversal: a departure (16.10.10). It cancels the answer whose entry
//     it reverses, an agreement or a call, and rewrites nothing: that
//     answer's event stays as it was written (16.12.1, 16.12.2).
// - The departures: the entries the answers standing as departures name. A
//   departure another machine logged is none here: its verdict is given on
//   the machine where it was made.
// - The judged: the entries whose latest verdict is one — nothing, a fix
//   later or a real loss — and not a skip, which leaves a departure waiting
//   (16.10.6). The latest is the one given last, by its time, the order read
//   breaking a tie — the log's, then each conversation's — as a verdict
//   that waited lands after the log's.
// ---------------------------------------------------------------------------

const { readProjectEvents } = require('./trust-log.cjs');

/** @typedef {'agreement'|'departure'|'no-weight'|'call'} AnswerStanding */
/**
 * An answer the trust log holds: its event as written, where it stands, and
 * the id of the reversal that cancels it, null where none does.
 * @typedef {{event: Record<string, unknown>, standing: AnswerStanding, cancelled_by: string|null}} Answer
 */
/**
 * What this machine logged on a project: its answers in the order read; the
 * entries of its departures; and the entries given a verdict.
 * @typedef {{answers: Answer[], departures: Set<string>, judged: Set<string>}} Evidence
 */

/** @typedef {(event: Record<string, unknown>) => AnswerStanding} StandsBy */

/** Where an answer stands, by its event's type. @type {Readonly<Record<string, StandsBy>>} */
const STANDING = Object.freeze(/** @type {Record<string, StandsBy>} */ ({
  raise: ({ didnt_follow: didntFollow, answer, sealed }) => {
    if (didntFollow) return 'no-weight';
    return answer === sealed ? 'agreement' : 'departure';
  },
  call: () => 'call',
  reversal: () => 'departure',
}));

/**
 * Note a verdict as its entry's latest where it was given no earlier than
 * the latest read so far.
 * @param {Map<string, {at: number, verdict: unknown}>} latest @param {Record<string, unknown>} event
 */
function noteVerdict(latest, { entry, at, verdict }) {
  const given = Date.parse(/** @type {string} */ (at));
  const id = /** @type {string} */ (entry);
  if (given >= (latest.get(id)?.at ?? -Infinity)) latest.set(id, { at: given, verdict });
}

/**
 * What this machine logged on the project whose state is at `root`, read in
 * one pass. Refuses a project whose manifest holds no project_id.
 * @param {string} root the project's state root
 * @returns {Evidence}
 */
function evidenceOf(root) {
  /** @type {{event: Record<string, unknown>, standing: AnswerStanding}[]} */
  const read = [];
  /** @type {Map<unknown, string>} */
  const cancels = new Map();
  /** @type {Map<string, {at: number, verdict: unknown}>} */
  const latest = new Map();
  readProjectEvents(root, (event) => {
    const type = /** @type {string} */ (event.type);
    if (type === 'verdict') noteVerdict(latest, event);
    if (type === 'reversal') cancels.set(event.reverses, /** @type {string} */ (event.id));
    if (Object.hasOwn(STANDING, type)) read.push({ event, standing: STANDING[type](event) });
  });
  const answers = read.map((answer) => ({ ...answer, cancelled_by: cancels.get(answer.event.entry) ?? null }));
  return {
    answers,
    departures: new Set(answers.filter(({ standing }) => standing === 'departure').map(({ event }) => /** @type {string} */ (event.entry))),
    judged: new Set([...latest].filter(([, { verdict }]) => verdict !== 'skip').map(([entry]) => entry)),
  };
}

module.exports = { evidenceOf };

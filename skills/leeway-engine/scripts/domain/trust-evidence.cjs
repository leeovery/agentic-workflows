'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the evidence this machine logged on a project (16.12, 16.13)
// — each answer the trust log holds and where it stands, and with them the
// departures and the verdicts given on them, read in one pass. It counts
// nothing and stores nothing (16.13.6): the ask rule's counts are read from
// its answers (trust-counts.cjs), the verdict queue and `verdict give` from
// its departures and verdicts (ledger-verdicts.cjs, verdict.cjs).
//
// - The read: the project's events on this machine, whose trust log it is
//   (16.13.1) — landed in the log; waiting in a conversation after an append
//   that failed; or kept ahead of an entry this state's ledger holds, by
//   whichever of the project's clones, its landing failed or never run —
//   each once by its id, an event under another project's id never this
//   one's (16.13.5, trust-log.cjs). What it makes of them is pure
//   (`evidenceIn`), so the counts make the same of every project's.
// - Each answer stands, by its event:
//   - a raise answered with Claude's sealed answer — the person's "don't
//     care" among them, which lands it (raise.cjs) — or in the person's own
//     words the separate call read as it (answer-reader.cjs): an agreement;
//   - a raise answered with another row — on a replacement, keeping the
//     decision as it stands among them (raise.cjs) — or in the person's own
//     words read as another row or as none: a departure (16.10.1);
//   - a raise the person didn't follow: no weight (16.12.3);
//   - a call: Claude's own call — but one a blind question was drawn on, a
//     blind draw naming its entry, which went ahead while the question
//     waits mid-build (16.17.6): no weight, the person's answer to the
//     question its evidence, so the call is never counted beside it;
//   - a reversal: a departure (16.10.10). It cancels the answer whose entry
//     it reverses, an agreement or a call — the person's keep of Claude's
//     call gone ahead among them, its event naming the call it kept
//     (raise.cjs) — and rewrites nothing: that answer's event stays as it
//     was written (16.12.1, 16.12.2).
// - Each answer's question: its kind and Claude's sort of it (16.11, 16.3.7),
//   and the model whose call it was, as its event holds them — a reversal's
//   those of the answer it reverses, wherever each was read, its own model
//   where the log holds none — and its kind as the person last corrected the
//   kind of its entry, or of the entry a reversal reverses (16.15.4).
// - The departures: the entries the answers standing as departures name. A
//   departure another machine logged is none here: its verdict is given on
//   the machine where it was made.
// - The verdicts: each entry's, in the order given, by time, the order read
//   breaking a tie — the log's, then each conversation's — as a verdict
//   that waited lands after the log's; a correction of a verdict is one
//   given at its own time (16.15.4), at no point. Each with the point it
//   was given at, so the verdict page says where a skip was given.
// - The judged: the entries whose latest verdict is one — nothing, a fix
//   later or a real loss — and not a skip, which leaves a departure waiting
//   (16.10.6).
// - The asked: the entries given any verdict, a skip among them, each with
//   when its latest was given — the departures a verdict point has put to
//   the person, which a decided screen asks no more (16.10.2, decided.cjs).
// ---------------------------------------------------------------------------

const { readProjectEvents } = require('./trust-log.cjs');

/** @typedef {import('./event-fields.cjs').Kind} Kind */
/** @typedef {'agreement'|'departure'|'no-weight'|'call'} AnswerStanding */
/** Claude's sort of a call (16.3.7). @typedef {'one'|'several'} Sort */
/**
 * An answer the trust log holds: its event as written, where it stands, and
 * the id of the reversal that cancels it, null where none does; and its
 * question's kind and sort, each null where none is known, and the model
 * whose call it was, null where its session's was unread.
 * @typedef {{event: Record<string, unknown>, standing: AnswerStanding, cancelled_by: string|null, kind: Kind|null, sort: Sort|null, model: string|null}} Answer
 */
/** A verdict given on an entry: when, which, and the point it was given at — null for a correction. @typedef {{at: number, verdict: string, point: string|null}} Given */
/**
 * What this machine logged: its answers in the order read; the entries of
 * its departures; the verdicts given on each entry, in the order given; the
 * entries given a verdict; and those given any verdict, a skip among them,
 * by when the latest was given.
 * @typedef {{answers: Answer[], departures: Set<string>, verdicts: Map<string, Given[]>, judged: Set<string>, asked: Map<string, number>}} Evidence
 */

/** @typedef {(event: Record<string, unknown>, drawn: Set<unknown>) => AnswerStanding} StandsBy */

/** Where an answer stands, by its event's type, `drawn` the entries blind questions were drawn on. @type {Readonly<Record<string, StandsBy>>} */
const STANDING = Object.freeze(/** @type {Record<string, StandsBy>} */ ({
  raise: ({ didnt_follow: didntFollow, answer, reading, sealed }) => {
    if (didntFollow) return 'no-weight';
    return (answer ?? reading) === sealed ? 'agreement' : 'departure';
  },
  call: ({ entry }, drawn) => (drawn.has(entry) ? 'no-weight' : 'call'),
  reversal: () => 'departure',
}));

/** An event's time. @param {Record<string, unknown>} event @returns {number} */
const timeOf = (event) => Date.parse(/** @type {string} */ (event.at));

/**
 * The events read, sorted by time, the order read breaking a tie.
 * @param {Record<string, unknown>[]} events
 */
const inTimeOrder = (events) => [...events].sort((a, b) => timeOf(a) - timeOf(b));

/**
 * Each entry's verdicts — a correction of one among them — in the order
 * given.
 * @param {Record<string, unknown>[]} events in time order
 * @returns {Map<string, Given[]>}
 */
function verdictsByEntry(events) {
  /** @type {Map<string, Given[]>} */
  const verdicts = new Map();
  for (const event of events) {
    if (event.verdict === null) continue;
    const entry = /** @type {string} */ (event.entry);
    const given = verdicts.get(entry) ?? [];
    given.push({ at: timeOf(event), verdict: /** @type {string} */ (event.verdict), point: /** @type {string|undefined} */ (event.point) ?? null });
    verdicts.set(entry, given);
  }
  return verdicts;
}

/**
 * Each entry's kind as the person last corrected it.
 * @param {Record<string, unknown>[]} corrections in time order
 * @returns {Map<unknown, Kind>}
 */
function correctedKinds(corrections) {
  return new Map(corrections.filter(({ kind }) => kind !== null).map(({ entry, kind }) => [entry, /** @type {Kind} */ (kind)]));
}

/**
 * The question an answer's event answers: its kind, Claude's sort of it and
 * the model whose call it was, as `question`, the event naming it, holds
 * them, its kind as the person last corrected that of either entry — where
 * the question is none the log holds, no kind or sort, and the answer's own
 * model.
 * @param {Record<string, unknown>} event @param {Record<string, unknown>|undefined} question @param {Map<unknown, Kind>} corrected
 * @returns {{kind: Kind|null, sort: Sort|null, model: string|null}}
 */
function questionOf(event, question, corrected) {
  return {
    kind: corrected.get(event.entry) ?? corrected.get(question?.entry) ?? /** @type {Kind|null} */ (question?.kind ?? null),
    sort: /** @type {Sort|null} */ (question?.sort ?? null),
    model: /** @type {string|null} */ ((question ?? event).model),
  };
}

/**
 * The evidence `events` hold, read in the order given — a project's, or every
 * project's on the machine — each once. Pure.
 * @param {Record<string, unknown>[]} events
 * @returns {Evidence}
 */
function evidenceIn(events) {
  const read = events.filter(({ type }) => Object.hasOwn(STANDING, /** @type {string} */ (type)));
  const drawn = new Set(events.filter(({ type }) => type === 'blind-draw').map(({ entry }) => entry));
  const cancels = new Map(read.filter(({ type }) => type === 'reversal').map(({ reverses, id }) => [reverses, /** @type {string} */ (id)]));
  const questions = new Map(read.filter(({ type }) => type !== 'reversal').map((event) => [event.entry, event]));
  const ordered = inTimeOrder(events);
  const corrected = correctedKinds(ordered.filter(({ type }) => type === 'correction'));
  const answers = read.map((event) => ({
    event,
    standing: STANDING[/** @type {string} */ (event.type)](event, drawn),
    cancelled_by: cancels.get(event.entry) ?? null,
    ...questionOf(event, event.type === 'reversal' ? questions.get(event.reverses) : event, corrected),
  }));
  const verdicts = verdictsByEntry(ordered.filter(({ type }) => type === 'verdict' || type === 'correction'));
  const latest = [...verdicts].map(([entry, given]) => /** @type {[string, Given]} */ ([entry, given[given.length - 1]]));
  return {
    answers,
    departures: new Set(answers.filter(({ standing }) => standing === 'departure').map(({ event }) => /** @type {string} */ (event.entry))),
    verdicts,
    judged: new Set(latest.filter(([, { verdict }]) => verdict !== 'skip').map(([entry]) => entry)),
    asked: new Map(latest.map(([entry, { at }]) => [entry, at])),
  };
}

/**
 * What this machine logged on the project whose state is at `root`, read in
 * one pass. Refuses a project whose manifest holds no project_id.
 * @param {string} root the project's state root
 * @returns {Evidence}
 */
function evidenceOf(root) {
  /** @type {Record<string, unknown>[]} */
  const events = [];
  readProjectEvents(root, (event) => events.push(event));
  return evidenceIn(events);
}

module.exports = { evidenceIn, evidenceOf };

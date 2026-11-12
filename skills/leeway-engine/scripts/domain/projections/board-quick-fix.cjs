'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a quick-fix on the board (20.14) — This session in its one
// session, drawn from its fixes as the build reads its tasks
// (board-build.cjs), their review rounds (round-report.cjs), the ledger
// placed in it, the questions open at its places and the replacements
// this conversation raised there (raise.cjs), its short record (`summary.md`, quick-fix-record.cjs) and
// its close (finish.cjs).
//
// - Each fix is drawn as the build draws a task (20.5.2): its line the
//   build's own (`taskLine`), its state read from the tracker, the
//   questions parking it and the briefs this conversation issued for it;
//   and beneath it its pair's rounds reported whole — those sent back, the
//   one being read in this conversation, and the round its review ended in,
//   passed or settled; a round still waiting on a report is the one being
//   read. An earlier round's report that does not read leaves the fix's
//   rounds untold, said among the warnings.
// - Where it stands: the close waiting on the person once its screen draws
//   (finish.cjs, `closeVerdicts`); else working — stopped where nothing of
//   its fixes can go on without an answer, by the build's rule, as the
//   unit's standing reads it (board-standing.cjs, `tasksStopped`). Once a
//   review is asked for at its close, it stands in the review as any unit
//   does (board-review.cjs); once it closes, This session follows the
//   session to All work (board.cjs).
// - What waits on the person is the unit's one list (board-standing.cjs):
//   the questions a fix's builder parked its task on, as the build's; each
//   question asked at the quick-fix's places still open in its ledger that
//   no park holds, asked in the conversation and parking nothing (19.5.25),
//   whether or not this conversation holds its raise (questions.cjs,
//   `askedOpenIds`), and each replacement this conversation raised at
//   either place, its fixes' or its review's, still waiting; and the close, with whether a verdict is owed on a call
//   the person changed (16.10.4).
// - The change is the unit's description, pinned by the note it began
//   from — the inbox's or the roadmap's, else none.
// - CLAUDE'S CALLS are every current decision made in the quick-fix that
//   stands Claude's, read through the person's latest keep (ledger-fold.cjs,
//   `decidedNow`), but each a blind question waits on, held back until the
//   person has answered (16.17.2, questions.cjs); REPLACES, for each current
//   decision made there, the decision made in another unit its chain of
//   replacements goes back to, past those made in the quick-fix, with its
//   words, whose it was and the unit's title; both read in one read of the
//   ledger.
// - THE RECORD is `summary.md`'s, each fix's under its title, once every
//   fix has ended and one at least is done.
// ---------------------------------------------------------------------------

const { fact, placeFact } = require('../board-model.cjs');
const { readShown } = require('../ledger-read.cjs');
const { factsOf, madeOn, isCurrent, decidedNow } = require('../ledger-fold.cjs');
const { shortId } = require('../ledger-ids.cjs');
const { sealsAt, sealWaits, fixPlaces } = require('../raise.cjs');
const { askedOpenIds, heldBackIn } = require('../questions.cjs');
const { pairPassed, beingRead } = require('../round-report.cjs');
const { parseShownTask } = require('../task-id.cjs');
const { fixesUnderWay, startedOn, FIXES_PHASE } = require('../derivations.cjs');
const { closeVerdicts } = require('../finish.cjs');
const { summaryRecords, RECORD_SECTIONS } = require('../quick-fix-record.cjs');
const { seedOrigin } = require('../inbox.cjs');
const { titlecase } = require('../conventions.cjs');
const { projectName } = require('../state-checks.cjs');
const { counted } = require('./map.cjs');
const { taskLine, standingAt, questionsOf, roundsRead } = require('./board-build.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').QuickFixView} QuickFixView */
/** @typedef {import('../board-model.cjs').FixLine} FixLine */
/** @typedef {import('../board-model.cjs').WaitingLine} WaitingLine */
/** @typedef {import('../board-model.cjs').Question} Question */

/** Whether the unit is a quick-fix whose fixes are under way. @param {BoardAt} at */
const fixing = ({ manifest }) => fixesUnderWay(manifest);

/** A fix's rounds when none is told. @type {FixLine['rounds']} */
const NO_ROUNDS = Object.freeze({ sent_back: 0, reading: null, passed: null, settled: false });

/**
 * A fix's pair's rounds (the header's): those sent back, the one being read
 * in this conversation, and the round its review ended in, null for each
 * where none is, and whether that round was settled.
 * @param {BoardAt} at @param {string} task @returns {FixLine['rounds']}
 */
function roundsOf(at, task) {
  const ref = parseShownTask(at.unit, task);
  const rounds = roundsRead(at, ref);
  if (rounds === null) return NO_ROUNDS;
  const last = rounds.at(-1);
  const ended = last !== undefined && pairPassed(last) ? last : null;
  return { sent_back: rounds.filter((round) => !pairPassed(round)).length, reading: beingRead(at.cwd, ref, at.session), passed: ended?.round ?? null, settled: ended !== null && !ended.passes };
}

/** The quick-fix's fixes, each as the build draws a task with its rounds, read once a call. @param {BoardAt} at @returns {FixLine[]} */
const fixesAt = (at) => at.once('quick-fix-fixes', () => {
  const phase = standingAt(at).phases.find(({ phase: number }) => number === FIXES_PHASE.number);
  return (phase?.tasks ?? []).map((task) => {
    const line = taskLine(at, task);
    return { ...line, rounds: line.state === 'not-started' || line.state === 'closed' ? NO_ROUNDS : roundsOf(at, task.task) };
  });
});

/** The fixes done of all, a fix closed without being done in neither, and whether any is written. @param {FixLine[]} fixes @returns {QuickFixView['progress']} */
function progressOf(fixes) {
  const live = fixes.filter(({ state }) => state !== 'closed');
  return { done: live.filter(({ state }) => state === 'done').length, total: live.length, written: fixes.length > 0 };
}

/** Whether a fix has ended: done, or closed without being done. @param {FixLine} fix */
const ended = ({ state }) => state === 'done' || state === 'closed';

/**
 * What the ledger holds of the quick-fix, in one read: every current call
 * of Claude's made in it, each decision made there replacing another
 * unit's, and what waits on the person asked in its conversation — each
 * question open at its places no park holds, then each replacement raised
 * at its places in this conversation still waiting; read once a call.
 * @param {BoardAt} at
 * @returns {{calls: QuickFixView['calls'], replaces: QuickFixView['replaces'], raised: WaitingLine[]}}
 */
const ledgerAt = (at) => at.once('quick-fix-ledger', () => readShown(at.root, at.warnings, ({ folded, show, short, entryAt }) => {
  const made = [...folded.facts.keys()].filter((id) => factsOf(folded, id).kind === 'decision' && isCurrent(folded, id) && madeOn(folded, id).unit === at.unit);
  /** The decision made in another unit that `id`'s chain of replacements goes back to, past those made in the quick-fix; null where none is. @param {string} id @returns {string|null} */
  const replacing = (id) => {
    let replaced = factsOf(folded, id).replaces;
    while (replaced !== null && madeOn(folded, replaced).unit === at.unit) replaced = factsOf(folded, replaced).replaces;
    return replaced;
  };
  const ids = [...folded.facts.keys()];
  const held = heldBackIn(folded, entryAt, at.unit);
  return {
    calls: made.filter((id) => decidedNow(folded, id).by === 'claude' && replacing(id) === null && !held.has(id)).map((id) => ({ id: short(id), text: String(show(id).text) })),
    replaces: made.flatMap((id) => {
      const replaced = replacing(id);
      if (replaced === null) return [];
      const { unit } = madeOn(folded, replaced);
      return [{ id: short(replaced), text: String(show(replaced).text), by: factsOf(folded, replaced).by === 'person' ? /** @type {const} */ ('person') : /** @type {const} */ ('claude'), unit_title: titlecase(unit) }];
    }),
    raised: [
      ...askedOpenIds(folded, at.unit).map((id) => ({ kind: /** @type {const} */ ('raised'), id: short(id), text: String(show(id).text).replace(/\s+/g, ' ').trim(), page: null })),
      ...fixPlaces(at.unit).flatMap((place) => sealsAt(at.session, place)).filter((seal) => seal.answers === null && sealWaits(folded, seal))
        .map((seal) => ({ kind: /** @type {const} */ ('raised'), id: shortId(seal.id, ids), text: seal.call.question, page: null })),
    ],
  };
}));

/** What Claude asked in the quick-fix's conversation still waiting, parking nothing (19.5.25); none once its fixes are not under way. @param {BoardAt} at @returns {WaitingLine[]} */
const raisedWaits = (at) => (fixing(at) ? ledgerAt(at).raised : []);

/** The close's verdict words: none to give, each given, or how many are owed. @param {{changed: number, owed: number}} verdicts */
function verdictWords({ changed, owed }) {
  if (changed === 0) return 'you changed none of Claude\'s calls, so there is no verdict to give';
  const yours = `you changed ${counted(changed, 'call')} of Claude's`;
  if (owed === 0) return `${yours} and gave each its verdict`;
  return `${yours}, so ${owed === 1 ? 'there is a verdict' : `there are ${owed} verdicts`} to give`;
}

/**
 * The close, as what waits on the person once its screen draws (the
 * header's): what was proven, and whether a verdict is owed; null where it
 * does not draw, read once a call.
 * @param {BoardAt} at @returns {WaitingLine|null}
 */
const closeWait = (at) => at.once('quick-fix-close', () => {
  const verdicts = fixing(at) ? closeVerdicts(at.cwd, at.unit, at.warnings) : null;
  return verdicts === null ? null : { kind: 'finish', id: 'close', text: `Close: what was proven; ${verdictWords(verdicts)}`, page: null };
});

/** Where the quick-fix stands (the header's). @param {BoardAt} at @returns {QuickFixView['standing']} */
const standingOf = (at) => (closeWait(at) === null ? 'working' : 'close');

/** THE RECORD (the header's): each fix's, by its title, once every fix has ended and one is done; null before. @param {BoardAt} at @param {FixLine[]} fixes */
function recordOf(at, fixes) {
  if (!fixes.every(ended) || !fixes.some(({ state }) => state === 'done')) return null;
  const [changed, why, leaves] = RECORD_SECTIONS;
  return summaryRecords(at.cwd, at.unit).map(({ title, sections }) => ({ title, changed: sections[changed], why: sections[why], leaves: sections[leaves] }));
}

/**
 * The quick-fix's This session (the header's), with what waits on the
 * person in the unit, the unit's one list, and the questions a press can
 * queue.
 * @param {BoardAt} at @param {WaitingLine[]} waiting @returns {{view: QuickFixView, questions: Question[]}}
 */
function quickFixView(at, waiting) {
  const fixes = fixesAt(at);
  const { calls, replaces } = ledgerAt(at);
  return {
    view: {
      kind: 'quick-fix',
      unit: at.unit,
      title: at.title,
      type: at.manifest.work_type,
      project: projectName(at.cwd),
      started: startedOn(at.manifest),
      from: seedOrigin(at.manifest),
      change: String(at.manifest.description ?? ''),
      standing: standingOf(at),
      progress: progressOf(fixes),
      waiting,
      fixes,
      calls,
      replaces,
      record: recordOf(at, fixes),
    },
    questions: questionsOf(standingAt(at)),
  };
}

/** Its fixes done of all, in words; that none is written, before the first. @param {QuickFixView['progress']} progress */
const fixesWords = ({ done, total, written }) => (written ? `${done} of ${total} done` : 'no fix written yet');

/**
 * The banner's facts in a quick-fix (20.2.4): the type, stopped where
 * nothing of its fixes can go on, as the unit's standing reads it, and its
 * fixes done of all; what waits on the person is counted by the board
 * (board.cjs).
 * @param {QuickFixView} view @param {boolean} stopped @returns {{state: 'running'|'needs', facts: import('../board-model.cjs').Fact[]}}
 */
function quickFixBanner({ type, progress }, stopped) {
  return {
    state: stopped ? 'needs' : 'running',
    facts: [placeFact(type), ...(stopped ? [placeFact('stopped')] : []), fact(fixesWords(progress))],
  };
}

/** How far a quick-fix's fixes have come, as its tab and All work say it. @param {BoardAt} at */
const quickFixWords = (at) => fixesWords(progressOf(fixesAt(at)));

module.exports = { quickFixView, quickFixBanner, raisedWaits, closeWait, quickFixWords };

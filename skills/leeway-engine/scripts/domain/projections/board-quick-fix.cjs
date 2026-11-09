'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a quick-fix on the board (20.14) — This session in its one
// session, drawn from its fixes as the build reads its tasks
// (board-build.cjs), their review rounds (round-report.cjs), the ledger
// placed in it, the raises this conversation sealed at its place
// (raise.cjs), its short record (`summary.md`, quick-fix-record.cjs) and
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
//   (finish.cjs, `closeVerdicts`); else working — stopped where every fix
//   not ended waits on a question, never while the close waits. Once it
//   closes, This session follows the session to All work (board.cjs).
// - What waits on the person is the unit's one list (board-standing.cjs):
//   the questions a fix's builder parked its task on, as the build's; each
//   raise this conversation sealed at the quick-fix's place still waiting,
//   asked in the conversation and parking nothing (19.5.25); and the close,
//   with whether a verdict is owed on a call the person changed (16.10.4).
// - The change is the unit's description, pinned by the note it began
//   from — the inbox's or the roadmap's, else none.
// - CLAUDE'S CALLS are every current call of Claude's made in the
//   quick-fix; REPLACES, for each current decision made there, the decision
//   made in another unit its chain of replacements goes back to, past those
//   made in the quick-fix, with its words, whose it was and the unit; both
//   read in one read of the ledger.
// - THE RECORD is `summary.md`'s, each fix's under its title, once every
//   fix has ended and one at least is done.
// ---------------------------------------------------------------------------

const { fact, placeFact } = require('../board-model.cjs');
const { messageOf } = require('../../kernel/call.cjs');
const { readShown } = require('../ledger-read.cjs');
const { factsOf, madeOn, isCurrent } = require('../ledger-fold.cjs');
const { shortId } = require('../ledger-ids.cjs');
const { sealsAt, sealWaits } = require('../raise.cjs');
const { wholeRounds, pairPassed, beingRead } = require('../round-report.cjs');
const { parseShownTask } = require('../task-id.cjs');
const { quickFixBuild, fixesBegun, FIXES_PHASE } = require('../derivations.cjs');
const { closeVerdicts } = require('../finish.cjs');
const { summaryRecords, RECORD_SECTIONS } = require('../quick-fix-record.cjs');
const { ROADMAP_SEED } = require('../inbox.cjs');
const { titlecase } = require('../conventions.cjs');
const { projectName } = require('../state-checks.cjs');
const { counted } = require('./map.cjs');
const { taskLine, standingAt, questionsOf } = require('./board-build.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').QuickFixView} QuickFixView */
/** @typedef {import('../board-model.cjs').FixLine} FixLine */
/** @typedef {import('../board-model.cjs').WaitingLine} WaitingLine */
/** @typedef {import('../board-model.cjs').Question} Question */

const PHASE = 'implementation';

/** Whether the unit is a quick-fix whose fixes are under way. @param {BoardAt} at */
const fixing = ({ manifest }) => quickFixBuild(manifest) && fixesBegun(manifest) && manifest.status === 'in-progress';

/** Where the note a unit began from came from: the inbox, the roadmap, or none. @param {Record<string, any>} manifest @returns {'inbox'|'roadmap'|null} */
function seedOrigin(manifest) {
  const [seed] = Array.isArray(manifest.seeds) ? manifest.seeds : [];
  if (seed === undefined) return null;
  return String(seed.source).startsWith(ROADMAP_SEED) ? 'roadmap' : 'inbox';
}

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
  try {
    const rounds = wholeRounds(at.cwd, ref);
    const last = rounds.at(-1);
    const ended = last !== undefined && pairPassed(last) ? last : null;
    return { sent_back: rounds.filter((round) => !pairPassed(round)).length, reading: beingRead(at.cwd, ref, at.session), passed: ended?.round ?? null, settled: ended !== null && !ended.passes };
  } catch (err) {
    at.warnings.push(`${task}'s rounds cannot be read — ${messageOf(err)}`);
    return NO_ROUNDS;
  }
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

/** Whether every fix not ended waits on a question, one at least. @param {FixLine[]} fixes */
function everyLeftParked(fixes) {
  const left = fixes.filter((fix) => !ended(fix));
  return left.length > 0 && left.every(({ state }) => state === 'waits');
}

/**
 * What the ledger holds of the quick-fix, in one read: every current call
 * of Claude's made in it, each decision made there replacing another
 * unit's, and the raises sealed at its place in this conversation still
 * waiting on the person; read once a call.
 * @param {BoardAt} at
 * @returns {{calls: QuickFixView['calls'], replaces: QuickFixView['replaces'], raised: WaitingLine[]}}
 */
const ledgerAt = (at) => at.once('quick-fix-ledger', () => readShown(at.root, at.warnings, ({ folded, show, short }) => {
  const made = [...folded.facts.keys()].filter((id) => factsOf(folded, id).kind === 'decision' && isCurrent(folded, id) && madeOn(folded, id).unit === at.unit);
  /** The decision made in another unit that `id`'s chain of replacements goes back to, past those made in the quick-fix; null where none is. @param {string} id @returns {string|null} */
  const replacing = (id) => {
    let replaced = factsOf(folded, id).replaces;
    while (replaced !== null && madeOn(folded, replaced).unit === at.unit) replaced = factsOf(folded, replaced).replaces;
    return replaced;
  };
  const ids = [...folded.facts.keys()];
  return {
    calls: made.filter((id) => factsOf(folded, id).by === 'claude' && replacing(id) === null).map((id) => ({ id: short(id), text: String(show(id).text) })),
    replaces: made.flatMap((id) => {
      const replaced = replacing(id);
      if (replaced === null) return [];
      const { unit } = madeOn(folded, replaced);
      return [{ id: short(replaced), text: String(show(replaced).text), by: factsOf(folded, replaced).by === 'person' ? /** @type {const} */ ('person') : /** @type {const} */ ('claude'), unit, unit_title: titlecase(unit) }];
    }),
    raised: sealsAt(at.session, { unit: at.unit, phase: PHASE, topic: null }).filter((seal) => sealWaits(folded, seal))
      .map((seal) => ({ kind: /** @type {const} */ ('raised'), id: shortId(seal.id, ids), text: seal.call.question, page: null })),
  };
}));

/** The questions Claude raised in the quick-fix's conversation still waiting, parking nothing (19.5.25); none once its fixes are not under way. @param {BoardAt} at @returns {WaitingLine[]} */
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

/** Whether a quick-fix's fixes have stopped (the header's). @param {BoardAt} at */
const fixesStopped = (at) => closeWait(at) === null && everyLeftParked(fixesAt(at));

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
      started: typeof at.manifest.created === 'string' ? at.manifest.created : null,
      from: seedOrigin(at.manifest),
      change: String(at.manifest.description ?? ''),
      standing: standingOf(at),
      stopped: fixesStopped(at),
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
 * The banner's facts in a quick-fix (20.2.4): the type, stopped where every
 * fix left waits on a question, and its fixes done of all; what waits on
 * the person is counted by the board (board.cjs).
 * @param {QuickFixView} view @returns {{state: 'running'|'needs', facts: import('../board-model.cjs').Fact[]}}
 */
function quickFixBanner({ type, stopped, progress }) {
  return {
    state: stopped ? 'needs' : 'running',
    facts: [placeFact(type), ...(stopped ? [placeFact('stopped')] : []), fact(fixesWords(progress))],
  };
}

/** How far a quick-fix's fixes have come, as its tab and All work say it. @param {BoardAt} at */
const quickFixWords = (at) => fixesWords(progressOf(fixesAt(at)));

module.exports = { quickFixView, quickFixBanner, raisedWaits, closeWait, fixesStopped, quickFixWords };

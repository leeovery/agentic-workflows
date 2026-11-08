'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a bug's investigation on the board (20.12) — This session in
// a bugfix's investigation and the pages of its hunt — drawn from the hunt
// its log holds (investigation-log.cjs), the ledger at its place, its
// validations' rows (agent-state.cjs) and the raises this conversation
// sealed there (raise.cjs).
//
// - The hunt is the log's: the symptoms, each hypothesis where it stands —
//   intended where the person's ruling made it so — and each experiment
//   with what it showed (19.4.3).
// - The root cause is the log's, while its entry is current, validated once
//   the root-cause validation was taken in since it was logged, else being
//   validated; the fix is the current answer of the fix direction's
//   question (`huntEntries`).
// - Both validations always run (19.4.7): each after what it validates is
//   logged, not started until it is dispatched since, running from its
//   dispatch until it is taken in — its report landed and its findings
//   still being acted on among it — lost with the conversation that sent
//   it, or taken in with what it found, as the conclude reads it
//   (investigation-conclude.cjs, `validationSince`). Each carries the effort
//   its agent's definition fixes (brief-names.cjs).
// - What waits on the person is each raise this conversation sealed at the
//   place that the person has not answered and whose question is still open,
//   or whose decision a replacement proposes is still current — asked in
//   the conversation, never queued (20.12.1). Each says what raised it: the
//   fix direction where it is the fix direction's; else the validation
//   running when it was drawn — dispatched before it and not yet taken in,
//   its findings still being acted on, the latest where both are; else
//   nothing. And why it reached the person, the decision point's reason as
//   sealed.
// - A raise at the place carrying a step back is the fix direction's
//   (raise.cjs), and so is one down the fix direction's question: its
//   latest seal gives what stepping back found, the options, Claude's lean
//   and once answered the person's pick; with none sealed here, after a
//   /clear, what stepping back found is the log's and the pick is the fix
//   in its words, the options unknown.
// - DECIDED is what the person decided at the place, and CLAUDE'S CALLS
//   Claude's calls since the calls list was last drawn in the conversation,
//   read as `ledger since` reads them, never a look (5.8.14): each but the
//   root cause and the fix, which have sections of their own.
// - Where it stands: concluded once its item is completed; else validating
//   the root cause while it is logged and not validated; else the fix
//   direction waiting on the person; else validating the fix while it is
//   set and not validated; else investigating.
// - Nothing of earlier fixes to the area is shown or counted (20.12.3):
//   they are Claude's analysis, in the log's prose, never its lists.
// ---------------------------------------------------------------------------

const { fact, placeFact } = require('../board-model.cjs');
const { readShown, answerMap } = require('../ledger-read.cjs');
const { answerSince } = require('../ledger-since.cjs');
const { factsOf, questionStands, notCurrent } = require('../ledger-fold.cjs');
const { withUnitEntries } = require('../unit-entries.cjs');
const { shortId } = require('../ledger-ids.cjs');
const { rowStanding, answersOn } = require('../topic-map.cjs');
const { agentRows } = require('../agent-state.cjs');
const { ROLES } = require('../brief-names.cjs');
const { sealsAt } = require('../raise.cjs');
const { huntOf, huntEntries } = require('../investigation-log.cjs');
const { VALIDATIONS, validationSince } = require('../investigation-conclude.cjs');
const { itemOf } = require('../derivations.cjs');
const { projectName } = require('../state-checks.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').InvestigationView} InvestigationView */
/** @typedef {import('../board-model.cjs').HuntWait} HuntWait */
/** @typedef {import('../board-model.cjs').WaitingLine} WaitingLine */
/** @typedef {import('../board-model.cjs').HuntPage} HuntPage */
/** @typedef {import('../investigation-log.cjs').Hunt} Hunt */
/** @typedef {import('../investigation-log.cjs').Rested} Rested */
/** @typedef {import('../unit-entries.cjs').UnitView} Entries */
/** @typedef {import('../raise.cjs').Seal} Seal */
/** @typedef {import('../topic-map.cjs').Row} Row */

const PHASE = 'investigation';

/** The investigation's place, as a raise there seals it. @param {BoardAt} at */
const placeOf = (at) => ({ unit: at.unit, phase: PHASE, topic: at.unit });

/** Whether the unit's investigation is under way. @param {BoardAt} at */
const investigating = ({ manifest, unit }) => manifest.work_type === 'bugfix' && itemOf(manifest, PHASE, unit)?.status === 'in-progress';

/** The hunt the unit's log holds, read once a call. @param {BoardAt} at @returns {Hunt} */
const huntAt = (at) => at.once('hunt', () => huntOf(at.cwd, at.unit, at.warnings));

/**
 * What the hunt reads of the ledger, in one read: the unit's entries, the
 * root cause and the fix it rests on, and the raises sealed at its place
 * in this conversation; read once a call.
 * @param {BoardAt} at
 * @returns {{folded: Entries['folded'], rootCause: Rested|null, fix: (Rested & {question: Rested})|null, seals: Seal[]}}
 */
const ledgerAt = (at) => at.once('hunt-ledger', () => withUnitEntries(at.cwd, at.unit, at.warnings, (view) => {
  const { rootCause, fix } = huntEntries(at.unit, view, huntAt(at));
  return { folded: view.folded, rootCause: 'fault' in rootCause ? null : rootCause, fix: 'fault' in fix ? null : fix, seals: sealsAt(at.session, placeOf(at)) };
}));

/** Whether a question is one asked down the chain of `question`, its rewordings among it. @param {Entries['folded']} folded @param {string} question @param {string|null} asked */
const sameQuestion = (folded, question, asked) => asked !== null && factsOf(folded, asked).root === factsOf(folded, question).root;

/** Whether a seal is the fix direction's: carrying a step back, or raised on the fix direction's question. @param {BoardAt} at @param {Seal} seal */
function fixSeal(at, seal) {
  const { folded } = ledgerAt(at);
  const asked = huntAt(at).fixDirection?.entry ?? null;
  return (!seal.fact && seal.call.stepped_back !== undefined) || (seal.answers !== null && asked !== null && sameQuestion(folded, seal.answers, asked));
}

/** Whether a seal still waits on the person: unanswered, its question open or the decision it would replace current. @param {Entries['folded']} folded @param {Seal} seal */
function waits(folded, seal) {
  if (seal.answered !== null) return false;
  return seal.answers !== null ? questionStands(folded, seal.answers) === 'open' : notCurrent(folded, /** @type {NonNullable<Seal['replaces']>} */ (seal.replaces).entry) === null;
}

/**
 * What raised a seal (the header's): the fix direction, else the
 * validation running when it was drawn.
 * @param {BoardAt} at @param {Seal} seal @returns {HuntWait['raised_by']}
 */
function raisedBy(at, seal) {
  if (fixSeal(at, seal)) return 'fix-direction';
  const running = validationsOf(at).filter(({ state, since }) => state === 'running' && since !== null && since <= seal.at);
  return running.sort((a, b) => /** @type {string} */ (a.since).localeCompare(/** @type {string} */ (b.since))).at(-1)?.validation ?? null;
}

/** The raises waiting on the person, none once the investigation is no longer under way. @param {BoardAt} at @returns {Seal[]} */
const waitingSeals = (at) => (investigating(at) ? ledgerAt(at).seals.filter((seal) => waits(ledgerAt(at).folded, seal)) : []);

/**
 * What waits on the person in the investigation (the header's), each raise
 * by its id, short among the ledger's, its question, what raised it, why it
 * reached them, and, for the fix direction's, how many options it sets out.
 * @param {BoardAt} at @returns {HuntWait[]}
 */
const huntWaits = (at) => at.once('hunt-waits', () => {
  const ids = [...ledgerAt(at).folded.facts.keys()];
  return waitingSeals(at).map((seal) => {
    const by = raisedBy(at, seal);
    return {
      kind: /** @type {const} */ ('raise'), id: shortId(seal.id, ids), text: seal.call.question, page: null, raised_by: by, why: seal.reason, options: by === 'fix-direction' ? seal.call.rows.length : null,
    };
  });
});

/** What waits on the person in the investigation, as the unit's one list holds it (board-standing.cjs). @param {BoardAt} at @returns {WaitingLine[]} */
const investigationWaits = (at) => huntWaits(at).map(({ kind, id, text, page }) => ({ kind, id, text, page }));

/**
 * Each validation of the hunt (the header's): after what it validates is
 * logged, not started, running from its dispatch, lost, or taken in with
 * what it found.
 * @param {BoardAt} at @returns {InvestigationView['validations']}
 */
const validationsOf = (at) => at.once('hunt-validations', () => {
  const { folded, rootCause, fix } = ledgerAt(at);
  const rests = { ...(rootCause === null ? {} : { rootCause }), ...(fix === null ? {} : { fix }) };
  const rows = new Map(agentRows(at.cwd, at.unit, PHASE, at.unit).map((row) => [row.id, row]));
  return VALIDATIONS.map((validation) => {
    const of = /** @type {'root-cause'|'fix'} */ (validation.kind.replace(/-validation$/, ''));
    const effort = ROLES[validation.kind]?.effort ?? null;
    const line = { validation: of, effort, since: null, found: 0 };
    if (validation.since.some((entry) => !(entry in rests))) return { ...line, state: /** @type {const} */ ('after') };
    const standing = validationSince(at.cwd, at.unit, folded, validation, rests);
    if (standing === null) return { ...line, state: /** @type {const} */ ('not-started') };
    const row = rows.get(standing.id);
    if (standing.stands === 'taken-in') return { ...line, state: /** @type {const} */ ('done'), found: row?.findings.length ?? 0 };
    return { ...line, state: standing.stands === 'lost' ? /** @type {const} */ ('lost') : /** @type {const} */ ('running'), since: row?.created ?? null };
  });
});

/** Whether a validation is done. @param {BoardAt} at @param {'root-cause'|'fix'} which */
const validated = (at, which) => validationsOf(at).find(({ validation }) => validation === which)?.state === 'done';

/** Where the investigation stands (the header's). @param {BoardAt} at @returns {InvestigationView['standing']} */
function standingOf(at) {
  if (itemOf(at.manifest, PHASE, at.unit)?.status === 'completed') return 'concluded';
  const { rootCause, fix } = ledgerAt(at);
  if (rootCause !== null && !validated(at, 'root-cause')) return 'validating-root-cause';
  if (huntWaits(at).some(({ raised_by: by }) => by === 'fix-direction')) return 'fix-waits';
  if (fix !== null && !validated(at, 'fix')) return 'validating-fix';
  return 'investigating';
}

/** What the investigation is doing, as the unit's tab says it under way: validating while either validation runs, else investigating. @param {BoardAt} at */
const investigationDoing = (at) => (standingOf(at).startsWith('validating') ? 'validating' : 'investigating');

/** How many hypotheses the unit's log holds. @param {BoardAt} at */
const hypothesesCount = (at) => huntAt(at).hypotheses.length;

/** The fix direction's latest seal in this conversation, null where none is sealed here. @param {BoardAt} at @returns {Seal|null} */
const fixSealOf = (at) => ledgerAt(at).seals.filter((seal) => fixSeal(at, seal)).at(-1) ?? null;

/**
 * The fix direction (the header's): after the root cause until it is
 * validated, being set out until a raise of it, then its options waiting on
 * the person, and once they answered it or the fix is set, their pick — the
 * row's key, null for their own words — and the fix in its words.
 * @param {BoardAt} at @returns {InvestigationView['fix_direction']}
 */
function fixDirectionOf(at) {
  const { fix, rootCause } = ledgerAt(at);
  const seal = fixSealOf(at);
  const asking = seal !== null && waitingSeals(at).includes(seal);
  const options = seal === null || seal.fact ? [] : seal.call.rows.map(({ key, name }) => ({ key, name, lean: !seal.fact && seal.call.lean === key }));
  const steppedBack = seal !== null && !seal.fact && seal.call.stepped_back !== undefined ? seal.call.stepped_back : huntAt(at).fixDirection?.body ?? [];
  if (asking) return { state: 'asking', stepped_back: steppedBack, options, pick: null, fix: null };
  const answered = seal?.answered ?? null;
  if (fix !== null || answered !== null) return { state: 'picked', stepped_back: steppedBack, options, pick: answered?.answer ?? null, fix: fix?.text ?? null };
  return { state: rootCause !== null && validated(at, 'root-cause') ? 'next' : 'after', stepped_back: [], options: [], pick: null, fix: null };
}

/**
 * The map's rows at the place and Claude's calls since the person last
 * looked, in one read of the ledger, the mark left where it stands.
 * @param {BoardAt} at @returns {{rows: Row[], since: {id: string, text: string}[]}}
 */
const mapAt = (at) => at.once('hunt-map', () => readShown(at.root, at.warnings, (shower) => ({
  rows: /** @type {Row[]} */ (answerMap(shower, { unit: at.unit, topic: at.unit }, at.root).questions),
  since: /** @type {{id: string, text: string}[]} */ (/** @type {unknown} */ (answerSince(shower, { unit: at.unit, topic: at.unit }, at.root, at.warnings).calls)),
})));

/**
 * Whether an entry, by its full id or a short one, is the root cause, the
 * fix or the fix's question, each with a section of its own.
 * @param {BoardAt} at @returns {(id: string) => boolean}
 */
function ownSection(at) {
  const { rootCause, fix } = ledgerAt(at);
  const own = [rootCause?.id, fix?.id, fix?.question.id].filter((id) => id !== undefined);
  return (id) => own.some((whole) => whole.startsWith(id));
}

/** What the person decided at the place but the root cause and the fix, each by their answer. @param {BoardAt} at @returns {InvestigationView['decided']} */
function decidedOf(at) {
  const own = ownSection(at);
  return mapAt(at).rows
    .filter((row) => rowStanding(row) === 'yours' && !own(row.id) && !answersOn(row).some(({ id }) => own(id)))
    .flatMap((row) => {
      const answer = answersOn(row).filter(({ by }) => by === 'person').at(-1);
      return answer === undefined ? [] : [{ id: answer.id, text: answer.text }];
    });
}

/**
 * The investigation's This session (the header's), what waits on the
 * person read from the unit's one list with what raised each.
 * @param {BoardAt} at @param {WaitingLine[]} waiting @returns {{view: InvestigationView}}
 */
function investigationView(at, waiting) {
  const hunt = huntAt(at);
  const { rootCause } = ledgerAt(at);
  const raised = new Map(huntWaits(at).map((line) => [line.id, line]));
  return {
    view: {
      kind: 'investigation',
      unit: at.unit,
      title: at.title,
      type: at.manifest.work_type,
      project: projectName(at.cwd),
      started: typeof at.manifest.created === 'string' ? at.manifest.created : null,
      standing: standingOf(at),
      waiting: waiting.map((line) => raised.get(line.id) ?? { ...line, raised_by: null, why: null, options: null }),
      decided: decidedOf(at),
      symptoms: hunt.symptoms.map(({ text }) => text),
      hypotheses: hunt.hypotheses.map(({ name, title, state }) => ({ name, title, state })),
      experiments: hunt.experiments.map(({ name, title, showed }) => ({ name, title, showed })),
      root_cause: rootCause === null ? null : { text: rootCause.text, validated: validated(at, 'root-cause') },
      validations: validationsOf(at),
      since: mapAt(at).since.filter(({ id }) => !ownSection(at)(id)).map(({ id, text }) => ({ id, text })),
      fix_direction: fixDirectionOf(at),
    },
  };
}

/** Where the investigation stands, as its banner says it. @type {Readonly<Record<InvestigationView['standing'], string>>} */
const BANNER_WORDS = Object.freeze({
  investigating: 'investigating',
  'validating-root-cause': 'validating the root cause',
  'fix-waits': 'fix direction',
  'validating-fix': 'validating the fix',
  concluded: 'concluded · the specification next',
});

/**
 * The banner's facts in an investigation (20.2.4): the type, the phase and
 * where it stands, done once concluded; what waits on the person is the
 * board's, from the unit's one list (board.cjs).
 * @param {InvestigationView} view @returns {{state: 'running'|'done', facts: import('../board-model.cjs').Fact[]}}
 */
function investigationBanner({ type, standing }) {
  return { state: standing === 'concluded' ? 'done' : 'running', facts: [placeFact(type), placeFact(PHASE), fact(BANNER_WORDS[standing])] };
}

/** A hunt's page's text: each line beneath its entry a paragraph. @param {string[]} lines */
const bodyText = (lines) => lines.join('\n\n');

/**
 * Each page of the hunt, by its ref's part (20.12.2): a hypothesis or an
 * experiment by its name, the root cause, and what stepping back found;
 * null where the hunt holds none such.
 * @param {BoardAt} at @param {string} part @returns {Omit<HuntPage, 'kind'|'unit'>|null}
 */
function huntItem(at, part) {
  const hunt = huntAt(at);
  const hypothesis = hunt.hypotheses.find(({ name }) => name === part);
  if (hypothesis !== undefined) return { item: 'hypothesis', name: hypothesis.name, title: hypothesis.title, state: hypothesis.state, text: bodyText(hypothesis.body) };
  const experiment = hunt.experiments.find(({ name }) => name === part);
  if (experiment !== undefined) return { item: 'experiment', name: experiment.name, title: experiment.title, state: experiment.showed, text: bodyText(experiment.body) };
  const { rootCause } = ledgerAt(at);
  if (part === 'root-cause' && rootCause !== null && hunt.rootCause !== null) {
    return { item: 'root-cause', name: null, title: '', state: validated(at, 'root-cause') ? 'validated' : 'being-validated', text: bodyText([rootCause.text, ...hunt.rootCause.body]) };
  }
  const steppedBack = fixDirectionOf(at).stepped_back;
  if (part === 'stepped-back' && steppedBack.length > 0) return { item: 'stepped-back', name: null, title: '', state: null, text: bodyText(steppedBack) };
  return null;
}

/**
 * A page of the hunt read in full (20.12.2), by its ref's part; refused
 * where the hunt holds none such.
 * @param {BoardAt} at @param {string} part @returns {HuntPage}
 */
function huntPage(at, part) {
  const item = huntItem(at, part);
  if (item === null) throw new Error(`${at.unit}'s investigation holds no ${part} — a hunt's page is a hypothesis or an experiment by its name, the root cause, or what stepping back found`);
  return { kind: 'hunt', unit: at.unit, ...item };
}

/**
 * An option of the fix direction read in full (20.12.2), by its key: its
 * name and words, what the person would notice, and whether it is Claude's
 * lean or the person's pick; refused where this conversation sealed no
 * fix direction holding it.
 * @param {BoardAt} at @param {string} key @returns {HuntPage}
 */
function optionPage(at, key) {
  const seal = fixSealOf(at);
  const row = seal === null ? undefined : seal.call.rows.find((held) => held.key === key);
  if (seal === null || row === undefined) throw new Error(`${at.unit}'s fix direction holds no option ${key} in this conversation`);
  const { state, pick } = fixDirectionOf(at);
  const standing = state === 'picked' && pick === key ? 'picked' : state === 'asking' && !seal.fact && seal.call.lean === key ? 'lean' : 'option';
  return { kind: 'hunt', unit: at.unit, item: 'option', name: key, title: row.name, state: standing, text: bodyText([row.text, row.notice]) };
}

module.exports = { investigationView, investigationBanner, investigationWaits, investigationDoing, hypothesesCount, huntPage, optionPage };

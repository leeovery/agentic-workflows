'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a bug's investigation on the board (20.12) — This session in
// a bugfix's investigation and the pages of its hunt — drawn from the hunt
// its log holds (investigation-log.cjs), the ledger at its place, its
// validations' rows (agent-state.cjs) and the raises this conversation
// sealed there (raise.cjs) — at its topic, and at its own level, where a
// permission for the hunt is asked. Nothing of the hunt is read for a unit
// that is not a bugfix in its investigation, and the ledger is folded once
// a board call for every unit it draws.
//
// - The hunt is the log's: the symptoms, each hypothesis where it stands —
//   intended where the person's ruling made it so — and each experiment
//   with what it showed (19.4.3).
// - Each decision is read where its chain stands now: the root cause the
//   current entry the logged one leads to, so a replacement shows before it
//   is logged again (`rootCauseNow`); the fix the current answer of the fix
//   direction's question (`huntEntries`).
// - Both validations always run (19.4.7): each after what it validates is
//   logged, not started until it is dispatched since, running from its
//   dispatch until it is taken in — its report landed and its findings
//   still being acted on among it — lost with the conversation that sent
//   it, or taken in with what it found, as the conclude reads it
//   (investigation-conclude.cjs, `validationSince`) — but read still while a
//   finding of it surfaced as a question or a replacement still waits on
//   the person: its question open, or the decision it would replace current
//   and kept by no answer since. Each carries the effort
//   its agent's definition fixes (brief-names.cjs).
// - What waits on the person, while it is under way, is each raise this
//   conversation sealed at its places that the person has not answered and
//   whose question is still open,
//   or whose decision a replacement proposes is still current — asked in
//   the conversation, never queued (20.12.1). Each says what raised it: the
//   validation one of whose findings was surfaced as it, whatever that
//   validation's row now stands at — asked as its question, or raised
//   replacing its decision (`agent surface`); else the fix direction where
//   it is the fix direction's; else nothing.
// - The fix direction's raises are those down its question's chain — one
//   answering it, or replacing a decision of its chain (`downChain`) — and,
//   before its question is logged, one carrying a step back. The latest
//   gives the options as its screen draws them, the keep row among them,
//   Claude's lean, what stepping back found, and once answered the
//   person's pick; one the person answered by keeping the decision leaves
//   the raise before it standing. With none sealed here, after a /clear,
//   what stepping back found is the log's and the pick is the fix in its
//   words, the options unknown.
// - DECIDED is what the person decided at the place, and CLAUDE'S CALLS
//   Claude's calls since the calls list was last drawn in the conversation,
//   read as `ledger since` reads them, never a look (5.8.14): each but the
//   root cause and the fix, which have sections of their own.
// - Where it stands: concluded once its item is completed; else validating
//   the root cause while that validation runs; else validating the fix
//   while that one does; else the fix direction waiting on the person; else
//   investigating. How far it has come, as All work says it, is
//   read from what it holds: the cause found, confirmed, the fix picked —
//   as the fix direction reads its pick — confirmed.
// - Nothing of earlier fixes to the area is shown or counted (20.12.3):
//   they are Claude's analysis, in the log's prose, never its lists.
// - The hunt's moments, for a bugfix's LATELY whatever phase it is in, are
//   those its records date: each experiment, the root cause and the fix by
//   the ledger entry each rests on, the conclude by its stamp. A
//   hypothesis's line rests on no entry and no commit writes it, so its
//   being confirmed or ruled out has no time and is not a moment.
// ---------------------------------------------------------------------------

const { fact, placeFact } = require('../board-model.cjs');
const { readShown, answerMap } = require('../ledger-read.cjs');
const { answerSince } = require('../ledger-since.cjs');
const { factsOf, questionStands } = require('../ledger-fold.cjs');
const { everyUnitEntries } = require('../unit-entries.cjs');
const { shortId } = require('../ledger-ids.cjs');
const { rowStanding, answersOn } = require('../topic-map.cjs');
const { agentRows, surfacedAs } = require('../agent-state.cjs');
const { ROLES } = require('../brief-names.cjs');
const { sealsAt, sealWaits, downChain } = require('../raise.cjs');
const { drawnRows } = require('./raise.cjs');
const { huntOf, huntEntries, rootCauseNow } = require('../investigation-log.cjs');
const { VALIDATIONS, validationSince } = require('../investigation-conclude.cjs');
const { gapsIn } = require('../spec-passes.cjs');
const { itemOf } = require('../derivations.cjs');
const { projectName } = require('../state-checks.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').InvestigationView} InvestigationView */
/** @typedef {import('../board-model.cjs').HuntWait} HuntWait */
/** @typedef {import('../board-model.cjs').WaitingLine} WaitingLine */
/** @typedef {import('../board-model.cjs').HuntPage} HuntPage */
/** @typedef {import('../board-model.cjs').Moment} Moment */
/** @typedef {import('../investigation-log.cjs').Hunt} Hunt */
/** @typedef {import('../investigation-log.cjs').Rested} Rested */
/** @typedef {import('../unit-entries.cjs').UnitView} Entries */
/** @typedef {import('../raise.cjs').Seal} Seal */
/** @typedef {import('../topic-map.cjs').Row} Row */

const PHASE = 'investigation';

/** The places the investigation's raises are sealed at: its topic, and its own level. @param {BoardAt} at */
const placesOf = (at) => [at.unit, null].map((topic) => ({ unit: at.unit, phase: PHASE, topic }));

/** Whether the unit's investigation is under way. @param {BoardAt} at */
const investigating = ({ manifest, unit }) => manifest.work_type === 'bugfix' && itemOf(manifest, PHASE, unit)?.status === 'in-progress';

/** The unit's entries, from the one fold of the ledger a board call shares. @param {BoardAt} at @returns {Entries} */
const entriesAt = (at) => at.shared('unit-entries', () => everyUnitEntries(at.cwd, at.warnings))(at.unit);

/** The hunt the unit's log holds, read once a call. @param {BoardAt} at @returns {Hunt} */
const huntAt = (at) => at.once('hunt', () => huntOf(at.cwd, at.unit, at.warnings));

/**
 * What the hunt reads of the ledger, in one read: the unit's entries, the
 * root cause as it stands and the fix it rests on, whether a raise is down
 * the fix direction's question's chain, and the raises sealed at its places
 * in this conversation, oldest first; read once a call, the ledger folded
 * once for every unit the call draws.
 * @param {BoardAt} at
 * @returns {{folded: Entries['folded'], rootCause: Rested|null, fix: (Rested & {question: Rested})|null, onFix: (seal: Seal) => boolean, seals: Seal[]}}
 */
const ledgerAt = (at) => at.once('hunt-ledger', () => {
  const view = entriesAt(at);
  const hunt = huntAt(at);
  const { fix } = huntEntries(at.unit, view, hunt);
  const asked = hunt.fixDirection?.entry;
  return {
    folded: view.folded,
    rootCause: rootCauseNow(view, hunt),
    fix: 'fault' in fix ? null : fix,
    onFix: asked === undefined ? () => false : downChain(view.folded, asked),
    seals: placesOf(at).flatMap((place) => sealsAt(at.session, place)).sort((a, b) => a.at.localeCompare(b.at)),
  };
});

/** Whether a seal is the fix direction's: down its question's chain, or carrying a step back. @param {BoardAt} at @param {Seal} seal */
const fixSeal = (at, seal) => (!seal.fact && seal.call.stepped_back !== undefined) || ledgerAt(at).onFix(seal);

/** The validation each kind of row is, as a wait says what raised it. @type {Readonly<Record<string, 'root-cause'|'fix'>>} */
const VALIDATED = Object.freeze({ 'root-cause-validation': 'root-cause', 'fix-validation': 'fix' });

/**
 * Whether one of a row's findings was surfaced as the seal's raise: asked
 * as its question, any wording of it, or raised replacing its decision.
 * @param {Entries['folded']} folded @param {ReturnType<typeof surfacedAs>[number]} row @param {Seal} seal
 */
function surfacedHere(folded, { asked, raised }, seal) {
  if (seal.answers !== null) {
    const root = factsOf(folded, seal.answers).root;
    return asked.some(({ entry }) => factsOf(folded, entry).root === root);
  }
  return raised.some(({ replaces }) => replaces === seal.replaces?.entry);
}

/**
 * What raised a seal (the header's): the validation a finding of which was
 * surfaced as it, else the fix direction, else nothing.
 * @param {BoardAt} at @param {Seal} seal @returns {HuntWait['raised_by']}
 */
function raisedBy(at, seal) {
  const { folded } = ledgerAt(at);
  const row = surfacedAs(at.cwd, at.unit, PHASE, at.unit).find((held) => Object.hasOwn(VALIDATED, held.kind) && surfacedHere(folded, held, seal));
  if (row !== undefined) return VALIDATED[row.kind];
  return fixSeal(at, seal) ? 'fix-direction' : null;
}

/** The raises waiting on the person, read once a call. @param {BoardAt} at @returns {Seal[]} */
const waitingSeals = (at) => at.once('hunt-waiting', () => ledgerAt(at).seals.filter((seal) => sealWaits(ledgerAt(at).folded, seal)));

/**
 * What waits on the person in the investigation (the header's), none once
 * it is no longer under way: each raise by its id, short among the
 * ledger's, its question, what raised it, and, for the fix direction's,
 * how many options it sets out and whether Claude's lean is the first.
 * @param {BoardAt} at @returns {HuntWait[]}
 */
const investigationWaits = (at) => at.once('hunt-waits', () => {
  if (!investigating(at)) return [];
  const ids = [...ledgerAt(at).folded.facts.keys()];
  return waitingSeals(at).map((seal) => {
    const rows = fixSeal(at, seal) && !seal.fact ? drawnRows(seal) : null;
    return {
      kind: /** @type {const} */ ('raise'),
      id: shortId(seal.id, ids),
      text: seal.call.question,
      page: null,
      raised_by: raisedBy(at, seal),
      options: rows === null ? null : rows.length,
      lean_first: rows === null || seal.fact ? null : rows[0]?.key === seal.call.lean,
    };
  });
});

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
    const of = VALIDATED[validation.kind];
    const effort = ROLES[validation.kind]?.effort ?? null;
    const line = { validation: of, effort, since: null, found: 0 };
    if (validation.since.some((entry) => !(entry in rests))) return { ...line, state: /** @type {const} */ ('after') };
    const standing = validationSince(at.cwd, at.unit, folded, validation, rests);
    if (standing === null) return { ...line, state: /** @type {const} */ ('not-started') };
    const row = rows.get(standing.id);
    if (standing.stands === 'taken-in' && !stillAsking(at, folded, standing.id)) return { ...line, state: /** @type {const} */ ('done'), found: row?.findings.length ?? 0 };
    if (standing.stands === 'lost') return { ...line, state: /** @type {const} */ ('lost') };
    return { ...line, state: /** @type {const} */ ('running'), since: row?.created ?? null };
  });
});

/**
 * Whether a finding of a validation's row, surfaced as a question or a
 * replacement, still waits on the person: its question open, or the
 * decision it would replace current and kept by no answer since.
 * @param {BoardAt} at @param {Entries['folded']} folded @param {string} id
 */
function stillAsking(at, folded, id) {
  const row = surfacedAs(at.cwd, at.unit, PHASE, at.unit).find((held) => held.id === id);
  if (row === undefined) return false;
  return row.asked.some(({ entry }) => questionStands(folded, entry) === 'open') || gapsIn(folded, at.unit, [], row.raised.map((raise) => ({ ...raise, pass: id }))).raised.length > 0;
}

/** Where a validation stands. @param {BoardAt} at @param {'root-cause'|'fix'} which */
const validationAt = (at, which) => validationsOf(at).find(({ validation }) => validation === which)?.state;

/** Where the investigation stands (the header's). @param {BoardAt} at @returns {InvestigationView['standing']} */
function standingOf(at) {
  if (itemOf(at.manifest, PHASE, at.unit)?.status === 'completed') return 'concluded';
  if (validationAt(at, 'root-cause') === 'running') return 'validating-root-cause';
  if (validationAt(at, 'fix') === 'running') return 'validating-fix';
  if (waitingSeals(at).some((seal) => fixSeal(at, seal))) return 'fix-waits';
  return 'investigating';
}

/** What the investigation is doing, as the unit's tab says it under way: validating while either validation runs, else investigating. @param {BoardAt} at */
const investigationDoing = (at) => (standingOf(at).startsWith('validating') ? 'validating' : 'investigating');

/**
 * How far the investigation has come, as All work says it (20.16.1), from
 * what it holds whoever works it.
 * @param {BoardAt} at
 */
function investigationHowFar(at) {
  const { rootCause, fix } = ledgerAt(at);
  if (rootCause === null) return 'finding the cause';
  if (validationAt(at, 'root-cause') !== 'done') return 'cause found, not yet confirmed';
  if (fix === null && fixDirectionOf(at).state !== 'picked') return 'cause confirmed, the fix not yet picked';
  return validationAt(at, 'fix') === 'done' ? 'fix confirmed' : 'fix picked, not yet confirmed';
}

/** How many hypotheses the unit's log holds. @param {BoardAt} at */
const hypothesesCount = (at) => huntAt(at).hypotheses.length;

/**
 * The hunt's moments for the unit's LATELY, a bugfix's alone: each
 * experiment, the root cause written and the fix picked, each when the
 * entry it rests on was made, left out once that entry is no longer
 * current; and the conclude, when it was stamped.
 * @param {BoardAt} at @returns {Moment[]}
 */
function huntMoments(at) {
  if (at.manifest.work_type !== 'bugfix') return [];
  const { entries } = entriesAt(at);
  const { experiments, rootCause } = huntAt(at);
  const { fix } = ledgerAt(at);
  /** @type {(kind: string, when: unknown, detail: string|null) => Moment[]} */
  const moment = (kind, when, detail) => (typeof when === 'string' ? [{ kind, at: new Date(when).toISOString(), topic: null, detail }] : []);
  /** @type {(kind: string, id: string, detail: string|null) => Moment[]} */
  const rested = (kind, id, detail) => moment(kind, entries.get(id)?.line.at, detail);
  return [
    ...experiments.flatMap(({ name, title, entry }) => rested('experiment', entry, `${name} ${title}`)),
    ...(rootCause === null ? [] : rested('root-cause', rootCause.entry, null)),
    ...(fix === null ? [] : rested('fix-picked', fix.id, null)),
    ...moment('concluded', itemOf(at.manifest, PHASE, at.unit)?.concluded_at, null),
  ];
}

/** Whether the person answered a raise keeping the decision it would replace. @param {Seal} seal */
const kept = (seal) => seal.replaces !== null && seal.answered?.answer === seal.replaces.keep.key;

/** The fix direction's raises in this conversation, oldest first. @param {BoardAt} at @returns {Seal[]} */
const fixSeals = (at) => at.once('hunt-fix-seals', () => ledgerAt(at).seals.filter((seal) => fixSeal(at, seal)));

/** The fix direction's raise that stands in this conversation — the latest but one the person kept the decision on — null where none is sealed here. @param {BoardAt} at @returns {Seal|null} */
const fixSealOf = (at) => fixSeals(at).filter((seal) => !kept(seal)).at(-1) ?? null;

/**
 * The fix direction (the header's): after the root cause until it is
 * validated, being set out until a raise of it, then its options waiting on
 * the person, and once they answered it or the fix is set, their pick — the
 * row's key, null for their own words — and the fix in its words.
 * @param {BoardAt} at @returns {InvestigationView['fix_direction']}
 */
function fixDirectionOf(at) {
  const { fix } = ledgerAt(at);
  const seal = fixSealOf(at);
  const call = seal === null || seal.fact ? null : seal.call;
  const options = call === null ? [] : drawnRows(/** @type {Seal} */ (seal)).map(({ key, name }) => ({ key, name, lean: call.lean === key }));
  const steppedBack = call?.stepped_back ?? huntAt(at).fixDirection?.body ?? [];
  if (seal !== null && waitingSeals(at).includes(seal)) return { state: 'asking', stepped_back: steppedBack, options, pick: null, fix: null };
  const answered = seal?.answered ?? null;
  if (fix !== null || answered !== null) return { state: 'picked', stepped_back: steppedBack, options, pick: answered?.answer ?? null, fix: fix?.text ?? null };
  return { state: validationAt(at, 'root-cause') === 'done' ? 'next' : 'after', stepped_back: [], options: [], pick: null, fix: null };
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
 * fix or the question a raise of the fix direction answers, each with a
 * section of its own.
 * @param {BoardAt} at @returns {(id: string) => boolean}
 */
function ownSection(at) {
  const { rootCause, fix } = ledgerAt(at);
  const own = [rootCause?.id, fix?.id, fix?.question.id, ...fixSeals(at).map(({ answers }) => answers)].filter((id) => typeof id === 'string');
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
 * The investigation's This session (the header's): what waits on the
 * person its own raises alone, never what waits on the unit in a later
 * phase.
 * @param {BoardAt} at @returns {{view: InvestigationView}}
 */
function investigationView(at) {
  const hunt = huntAt(at);
  const { rootCause } = ledgerAt(at);
  const own = ownSection(at);
  return {
    view: {
      kind: 'investigation',
      unit: at.unit,
      title: at.title,
      type: at.manifest.work_type,
      project: projectName(at.cwd),
      started: typeof at.manifest.created === 'string' ? at.manifest.created : null,
      standing: standingOf(at),
      waiting: investigationWaits(at),
      decided: decidedOf(at),
      symptoms: hunt.symptoms.map(({ text }) => text),
      hypotheses: hunt.hypotheses.map(({ name, title, state }) => ({ name, title, state })),
      experiments: hunt.experiments.map(({ name, title, showed }) => ({ name, title, showed })),
      root_cause: rootCause === null ? null : { text: rootCause.text, validated: validationAt(at, 'root-cause') === 'done' },
      validations: validationsOf(at),
      since: mapAt(at).since.filter(({ id }) => !own(id)).map(({ id, text }) => ({ id, text })),
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
  if (part === 'root-cause' && rootCause !== null) {
    const validated = validationAt(at, 'root-cause') === 'done';
    const body = hunt.rootCause?.entry === rootCause.id ? hunt.rootCause.body : [];
    return { item: 'root-cause', name: null, title: '', state: validated ? 'validated' : 'being-validated', text: bodyText([rootCause.text, ...body]) };
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
  const row = seal === null || seal.fact ? undefined : drawnRows(seal).find((held) => held.key === key);
  if (seal === null || seal.fact || row === undefined) throw new Error(`${at.unit}'s fix direction holds no option ${key} in this conversation`);
  const { state, pick } = fixDirectionOf(at);
  const standing = state === 'picked' && pick === key ? 'picked' : state === 'asking' && seal.call.lean === key ? 'lean' : 'option';
  return { kind: 'hunt', unit: at.unit, item: 'option', name: key, title: row.name, state: standing, text: bodyText([row.text, row.notice]) };
}

module.exports = { investigationView, investigationBanner, investigationWaits, investigationDoing, investigationHowFar, hypothesesCount, huntMoments, huntPage, optionPage };

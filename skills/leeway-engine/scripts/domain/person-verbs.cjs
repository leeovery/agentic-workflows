'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the verbs of the record of the person (16.18, 16.5.4,
// 16.5.6) — Claude's proposal of an entry, held for the person's yes, the
// yes that writes it (person.cjs), and the care entries' screens.
//
// - `person propose [--drop]`: Claude's proposal on stdin — a preference in
//   its words, or a care entry by its kind in this project, with Claude's
//   why and its examples, each one line — to keep in the record, or, with
//   `--drop`, to drop from it (16.18.2, 16.5.4). It draws the proposal
//   screen (projections/person.cjs) and holds the proposal in the
//   conversation's folder (`person-proposal.json`, user-files.cjs) in place
//   of any held before, until the answer. Nothing else reads it: a proposal
//   steers nothing until the yes (16.S54). It refuses a proposal of another
//   shape — both entries, or neither; a care entry naming no kind one names,
//   danger among them, which always asks; a preference named as the
//   record's care entries are — a preference or a care entry the record
//   holds already, one to drop that it does not hold, a care entry outside a
//   project, and a conversation with no session to hold it in.
// - `person keep` and `person drop`: the person's yes on the proposal
//   screen — the proposal held, kept or dropped as it proposes, checked
//   again under the record's lock, then let go. Each refuses with no
//   proposal held, or one proposing the other.
// - `person keep --care <kind>` and `person drop --care <kind>`: the
//   person's own pick on the care entries' screens — a care entry on the
//   kind added in this project, or dropped from it (16.5.6) — leading to the
//   care entries' screen with the line reporting it.
// - `render care [--added <kind> | --dropped <kind>]`: the care entries'
//   screen, in the menus' frame (projections/care.cjs), the line reporting
//   the entry just added or dropped above it — the dropped kind's count
//   read as the decision point reads it, for the conversation's model now,
//   at the person's threshold. Its help draws the screen again without the
//   line. `render care-kind`, the kind pick, and `render care-drop`, the
//   drop pick.
//
// Every verb reads the record whole, and this project's state alone — its
// id, its name and, for a dropped line, the trust log's counts — never
// another project's ledger (16.18.7). The record is user-level: no verb
// takes the writer lock (engine.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { stdinObject } = require('../kernel/call.cjs');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { type, LINE, listOf } = require('./event-fields.cjs');
const { conversationDir } = require('./conversation.cjs');
const { projectName } = require('./state-checks.cjs');
const { projectId, modelOf } = require('./trust-log.cjs');
const { countsOf, stateOf } = require('./trust-counts.cjs');
const { trustSettings } = require('./trust-settings.cjs');
const { PROPOSAL } = require('./user-files.cjs');
const { CARE_KINDS, readRecord, changeRecord, careIn } = require('./person.cjs');
const { MENUS, drawMenu } = require('./menus.cjs');
const { proposalScreen } = require('./projections/person.cjs');
const { careScreen, kindPick, dropPick, addedLine, droppedLine } = require('./projections/care.cjs');

/** @typedef {import('./event-fields.cjs').Kind} Kind */
/** @typedef {import('./person.cjs').Care} Care */
/** @typedef {import('./person.cjs').PersonRecord} PersonRecord */
/** @typedef {import('./projections/surfaces.cjs').Next} Next */

/**
 * A proposal as the conversation holds it: the version of its shape, when
 * it was proposed, whether it drops the entry, the entry — a preference's
 * words, or a care entry, the other null — and Claude's why and examples.
 * @typedef {{v: number, at: string, drop: boolean, preference: string|null, care: Care|null, why: string, examples: string[]}} Proposal
 */

/** This project: its state root, its id, and its name now. @typedef {{root: string, id: string, name: string}} Here */

/** What a verb answers, and the screen it draws, '' for none. @typedef {{answer: Record<string, unknown>, screen: string}} Answered */

const PROPOSAL_VERSION = 1;
const CARE_SECTION = 'Care entries';
const PROPOSE_USAGE = 'person propose [--drop]   (a preference or a care entry\'s kind, Claude\'s why and examples as JSON on stdin)';
const KEEP_USAGE = 'person keep [--care <kind>]';
const DROP_USAGE = 'person drop [--care <kind>]';

/** The person verbs' usage, a line each. */
const PERSON_USAGE = [PROPOSE_USAGE, KEEP_USAGE, DROP_USAGE].join('\n');

// One line, as the record holds it: nothing to trim at either end.
const SAID = type('one line of text, no space at either end', (v) => LINE.test(v) && /** @type {string} */ (v).trim() === v);
const EXAMPLES = type('a list of one line of text or more, each with no space at either end', (v) => listOf(SAID).test(v) && /** @type {unknown[]} */ (v).length > 0);

/** This project, from `cwd`. @param {string} cwd @returns {Here} */
function hereOf(cwd) {
  const root = stateRoot(cwd);
  return { root, id: projectId(root), name: projectName(cwd) };
}

/** The kind `kind`, refused, in the words of `said`, where no care entry names it. @param {string} said @param {unknown} kind @returns {Kind} */
function careKind(said, kind) {
  if (!CARE_KINDS.includes(/** @type {Kind} */ (kind))) throw new Error(`${said}: ${JSON.stringify(kind)} is no kind a care entry names — ${CARE_KINDS.join(', ')}; danger always asks`);
  return /** @type {Kind} */ (kind);
}

/** The kinds under a care entry here, in the order kept. @param {PersonRecord} record @param {Here} here */
const kindsHere = (record, here) => careIn(record, here.id).map(({ kind }) => kind);

/** The conversation's session, refused, in the words of `said`, where none was handed over. @param {string} said */
function sessionOf(said) {
  const session = handedSession();
  if (session === null) throw new Error(`${said}: no conversation to hold the proposal in — Claude Code hands every command it runs a session id, and this one has none`);
  return session;
}

/** Where the conversation `session` holds its proposal. @param {string} session */
const heldPath = (session) => path.join(conversationDir(session), PROPOSAL);

/**
 * The proposal on stdin, checked: a preference or a care entry's kind,
 * one and not both, and Claude's why and examples.
 * @param {string} stdin
 * @returns {{preference: string|null, kind: Kind|null, why: string, examples: string[]}}
 */
function proposalOn(stdin) {
  const said = 'person propose';
  const given = stdinObject(stdin, said, 'the proposal');
  const fields = ['preference', 'care', 'why', 'examples'];
  const stray = Object.keys(given).find((name) => !fields.includes(name));
  if (stray !== undefined) throw new Error(`${said}: the proposal has no field ${stray} — it holds a preference or a care entry's kind, why and examples`);
  const { preference = null, care = null, why, examples } = given;
  if ((preference === null) === (care === null)) throw new Error(`${said}: the proposal names a preference or a care entry's kind, one and not both`);
  if (preference !== null && !SAID.test(preference)) throw new Error(`${said}: the proposal's preference is not ${SAID.is}`);
  if (preference === CARE_SECTION) throw new Error(`${said}: "${CARE_SECTION}" is the record's section of care entries, never a preference's words`);
  if (!SAID.test(why)) throw new Error(`${said}: the proposal's why is not ${SAID.is}`);
  if (!EXAMPLES.test(examples)) throw new Error(`${said}: the proposal's examples are not ${EXAMPLES.is}`);
  return {
    preference: /** @type {string|null} */ (preference), kind: care === null ? null : careKind(said, care), why: /** @type {string} */ (why), examples: /** @type {string[]} */ (examples),
  };
}

/** Whether the record holds the preference `words`. @param {PersonRecord} record @param {string} words */
const holdsPreference = ({ preferences }, words) => preferences.some(({ preference }) => preference === words);

/** Whether the record holds the care entry `care`. @param {PersonRecord} record @param {{project: string, kind: Kind}} care */
const holdsCare = (record, { project, kind }) => careIn(record, project).some((entry) => entry.kind === kind);

/** The entry a proposal names, as the screens name it. @param {{preference: string|null, care: Care|null}} entry */
const entryNamed = ({ preference, care }) => (care === null ? /** @type {string} */ (preference) : `${care.name}: ${care.kind}`);

/**
 * Refuse, in the words of `said`, an entry the record holds already, to be
 * kept, or one it does not hold, to be dropped.
 * @param {string} said @param {PersonRecord} record @param {{drop: boolean, preference: string|null, care: Care|null}} entry
 */
function checkStanding(said, record, entry) {
  const holds = entry.care === null ? holdsPreference(record, /** @type {string} */ (entry.preference)) : holdsCare(record, entry.care);
  if (holds && !entry.drop) throw new Error(`${said}: the record of you holds "${entryNamed(entry)}" already`);
  if (!holds && entry.drop) throw new Error(`${said}: the record of you holds no "${entryNamed(entry)}" to drop`);
}

/**
 * `person propose [--drop]` (the header's).
 * @param {string} cwd @param {string[]} args @param {() => string} stdin
 * @returns {Answered}
 */
function propose(cwd, args, stdin) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--drop')) throw new Error(`Usage: engine ${PROPOSE_USAGE}`);
  const said = 'person propose';
  const drop = args.length === 1;
  const session = sessionOf(said);
  const { preference, kind, why, examples } = proposalOn(stdin());
  /** @type {Care|null} */
  let care = null;
  if (kind !== null) {
    const here = hereOf(cwd);
    care = { project: here.id, name: here.name, kind };
  }
  /** @type {Proposal} */
  const proposal = { v: PROPOSAL_VERSION, at: new Date().toISOString(), drop, preference, care, why, examples };
  checkStanding(said, readRecord(), proposal);
  const file = heldPath(session);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, proposal);
  return { answer: { proposed: drop ? 'drop' : 'keep', entry: entryNamed(proposal) }, screen: proposalScreen(proposal) };
}

/**
 * The proposal the conversation `session` holds, refused, in the words of
 * `said`, where none is held or it proposes the other way.
 * @param {string} said @param {string} session @param {boolean} drop
 * @returns {Proposal}
 */
function heldProposal(said, session, drop) {
  const file = heldPath(session);
  if (!fs.existsSync(file)) throw new Error(`${said}: no proposal is held in this conversation — person propose draws one, and the person's yes on it ${drop ? 'drops' : 'keeps'} it`);
  const held = /** @type {Proposal} */ (JSON.parse(fs.readFileSync(file, 'utf8')));
  if (held.drop !== drop) throw new Error(`${said}: the proposal held ${held.drop ? 'drops' : 'keeps'} "${entryNamed(held)}" — its yes is person ${held.drop ? 'drop' : 'keep'}`);
  return held;
}

/**
 * The record with the entry kept in it — a preference after the rest, a
 * care entry after the rest — or dropped from it.
 * @param {PersonRecord} record @param {{drop: boolean, preference: string|null, care: Care|null, why?: string, examples?: string[]}} entry
 * @returns {PersonRecord}
 */
function changed(record, { drop, preference, care, why = '', examples = [] }) {
  if (care !== null) {
    const others = record.care.filter((entry) => entry.project !== care.project || entry.kind !== care.kind);
    return { ...record, care: drop ? others : [...record.care, care] };
  }
  const others = record.preferences.filter((entry) => entry.preference !== preference);
  return { ...record, preferences: drop ? others : [...record.preferences, { preference: /** @type {string} */ (preference), why, examples }] };
}

/**
 * The entry kept in, or dropped from, the record under its lock, checked
 * again there, in the words of `said`; its name, as the screens name it.
 * @param {string} said @param {{drop: boolean, preference: string|null, care: Care|null, why?: string, examples?: string[]}} entry
 */
function write(said, entry) {
  return changeRecord((record) => {
    checkStanding(said, record, entry);
    return { record: changed(record, entry), answer: entryNamed(entry) };
  });
}

/**
 * The person's yes on the proposal held (the header's): kept, or dropped,
 * then let go.
 * @param {boolean} drop
 * @returns {Answered}
 */
function yesTo(drop) {
  const said = `person ${drop ? 'drop' : 'keep'}`;
  const session = sessionOf(said);
  const named = write(said, heldProposal(said, session, drop));
  fs.rmSync(heldPath(session), { force: true });
  return { answer: { [drop ? 'dropped' : 'kept']: named }, screen: '' };
}

/**
 * The person's pick of `kind` on the care entries' screens (the header's):
 * its care entry here added, or dropped; and the screen reporting it next.
 * @param {string} cwd @param {boolean} drop @param {unknown} kind
 * @returns {Answered}
 */
function cared(cwd, drop, kind) {
  const said = `person ${drop ? 'drop' : 'keep'} --care`;
  const here = hereOf(cwd);
  const care = { project: here.id, name: here.name, kind: careKind(said, kind) };
  const named = write(said, { drop, preference: null, care });
  /** @type {Next} */
  const next = { kind: 'engine', argv: ['render', 'care', drop ? '--dropped' : '--added', care.kind] };
  return { answer: { [drop ? 'dropped' : 'kept']: named, next }, screen: '' };
}

/**
 * `person keep` or `person drop`, `--care <kind>` or none.
 * @param {boolean} drop
 * @returns {(cwd: string, args: string[]) => Answered}
 */
const answer = (drop) => (cwd, args) => {
  if (args.length === 0) return yesTo(drop);
  if (args.length === 2 && args[0] === '--care') return cared(cwd, drop, args[1]);
  throw new Error(`Usage: engine ${drop ? DROP_USAGE : KEEP_USAGE}`);
};

/** @type {Readonly<Record<string, (cwd: string, args: string[], stdin: () => string) => Answered>>} */
const VERBS = Object.freeze({ propose, keep: answer(false), drop: answer(true) });

/**
 * `person <propose|keep|drop>`: the verb's answer, and the screen it draws.
 * @param {string} cwd @param {string} verb @param {string[]} args @param {() => string} stdin
 * @returns {Answered}
 */
function runPersonVerb(cwd, verb, args, stdin) {
  if (!Object.hasOwn(VERBS, verb)) throw new Error(`Usage: engine person <${Object.keys(VERBS).join('|')}> …\n${PERSON_USAGE}`);
  return VERBS[verb](cwd, args, stdin);
}

/**
 * The line reporting the care entry on `kind` just added here, or dropped:
 * refused where the record says otherwise.
 * @param {string} cwd @param {Here} here @param {Kind[]} kinds @param {{added?: string, dropped?: string}} flags
 * @returns {string|null}
 */
function reported(cwd, here, kinds, { added, dropped }) {
  const said = 'render care';
  if (added !== undefined && dropped !== undefined) throw new Error(`${said}: --added and --dropped each report one change — give one`);
  if (added !== undefined) {
    const kind = careKind(said, added);
    if (!kinds.includes(kind)) throw new Error(`${said}: no care entry on ${kind} stands in ${here.name} to report added`);
    return addedLine(here.name, kind);
  }
  if (dropped === undefined) return null;
  const kind = careKind(said, dropped);
  if (kinds.includes(kind)) throw new Error(`${said}: the care entry on ${kind} still stands in ${here.name} — it was not dropped`);
  const { threshold } = trustSettings();
  const counts = countsOf(here.root, { model: modelOf(cwd), now: Date.now() });
  return droppedLine(here.name, kind, stateOf(counts.kinds[kind], threshold), threshold);
}

/**
 * `render care [--added <kind> | --dropped <kind>]` (the header's).
 * @param {string} cwd @param {{added?: string, dropped?: string}} flags
 * @returns {string}
 */
function careSurface(cwd, flags) {
  const here = hereOf(cwd);
  const kinds = kindsHere(readRecord(), here);
  return drawMenu(cwd, MENUS.care, {}, careScreen({ project: here.name, kinds, line: reported(cwd, here, kinds, flags) }));
}

/**
 * `render care-kind`: the kinds with no care entry here to pick from.
 * Refuses where every kind has one.
 * @param {string} cwd @returns {string}
 */
function careKindSurface(cwd) {
  const here = hereOf(cwd);
  const taken = kindsHere(readRecord(), here);
  const left = CARE_KINDS.filter((kind) => !taken.includes(kind));
  if (left.length === 0) throw new Error(`render care-kind: every kind a care entry names always asks in ${here.name} already`);
  return kindPick(here.name, left);
}

/**
 * `render care-drop`: the care entries here to drop one of. Refuses where
 * none stands.
 * @param {string} cwd @returns {string}
 */
function careDropSurface(cwd) {
  const here = hereOf(cwd);
  const kinds = kindsHere(readRecord(), here);
  if (kinds.length === 0) throw new Error(`render care-drop: no care entry stands in ${here.name} to drop`);
  return dropPick(here.name, kinds);
}

module.exports = { PERSON_USAGE, runPersonVerb, careSurface, careKindSurface, careDropSurface };

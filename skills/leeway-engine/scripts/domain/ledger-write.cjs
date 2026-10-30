'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's write verbs (6.1.4) — ask, find, decide, replace,
// hold, move and merge — each appending one event through the stream
// (ledger.cjs) and committing the ledger to the state branch.
//
// - Where: the engine's dot-path, `<unit>.<phase>.<topic>`, or
//   `<unit>.<phase>` for an entry made at the unit's level. The unit must
//   exist, and the phase be discovery or one of its work type's. A topic
//   exists only before the spec (4.11.2) and must hold an item in the phase;
//   from the spec on every entry is the unit's, carrying no topic (5.2.3).
//   The unit and topic must be live (5.8.17), as a move's destination must,
//   both before the lock and again under it. The session is the
//   conversation's own (CLAUDE_CODE_SESSION_ID); a write without one is
//   refused. A raise (raise.cjs), whose answer is a decision or the
//   replacement of one, reads and checks its place and its links as
//   `decide` or `replace` does before the lock, as it draws, refused in its
//   own words; and what it lands — the person's answer, their keep of the
//   decision Claude proposed to replace, or Claude's call the decision
//   point lets proceed — is that write's, or the keep's, its place read
//   again and its links checked under the same lock, after the raise's own
//   check of the ledger, in the raise's words.
// - What: the content comes as one JSON object on stdin, the links as flags.
//   Content never carries a link, nor anything the engine gives. A link names
//   an entry by a prefix of its id, resolved as git resolves a short hash
//   (5.3.5), and must name what it links to: a decision answers a question
//   (5.5.1), and only a question moves or merges. An entry is replaced,
//   held or relied on only while current — a replacement names one entry,
//   its siblings untouched (5.3.13) — a question is answered, has parts,
//   moves or merges only while current, and a merge goes into a current
//   decision — current by the one rule every read decides by
//   (ledger-fold.cjs), so a question is named in its wording, the last of
//   its line.
// - Whose: a decision answers, and a move or a merge takes, a question of the
//   write's own unit alone, while another unit's entry may be replaced
//   (5.6.1) or held. An entry is the unit's, and stands on the topic, that
//   the earliest entry of its chain in a live place was made on — normally
//   the first, a question's wording on the topic its unit last moved it to
//   — by the rule every read places it by (ledger-fold.cjs); before the
//   spec, an entry of the unit is written on only from the topic it stands
//   on: another topic's change goes to it by message (5.6.9, 10.2.2).
// - How each relates: a question moves to another topic of its unit (5.3.3),
//   or to an item of the project's roadmap as later, `roadmap:{item}`
//   (9.5.4);
//   a merge's duplicate is a current decision answering the question merged,
//   by any of its wordings, standing or set aside (ledger-fold.cjs), other
//   than the one it goes into (5.5.4, 5.5.5); a hold names the latest live
//   replacement on the way to its current form, past each merge that holds,
//   of an entry the held entry is held against: one it relies on, or the
//   question an answer answers (5.6.10); a replacement's cause is never what
//   it replaces, a new fact's being a finding and another topic's a decision
//   standing on a topic other than the one the replaced entry stands on
//   (5.3.8); who moved whom is what the departure rule allows
//   (ledger-verdicts.cjs) — never the person's answer standing over Claude's
//   lean on an entry Claude made, and on the person's replacement of a
//   decision, what its reason and the entry it replaces allow. The person's
//   entry carries no sealed answer of Claude's, and their decision on a
//   chain Claude never leaned on, written or replaced, moves no one: their
//   answer to Claude's lean is a raise's, which sealed the lean before they
//   answered. The person's keep of a decision as it stands, where Claude
//   proposed to replace it, is a raise's answer alone, no verb writing it:
//   held to the links of the replacement it stood over — the decision
//   current, the write's to replace, and the cause what the reason needs.
// - What the content says of itself: the person's decision is their own,
//   never given as "your call", "don't care" or carried over, each of which
//   is Claude's line (9.2.14, 9.2.16, 21.6.5); a finding says how it is
//   known (9.2.12), a measurement — measured, or exploratory, in the
//   conversation — with the command run and its result (9.9.7), and a
//   command never comes without its result, nor a result without its
//   command.
// - What an experiment holds open (9.1.11): a question an experiment of its
//   unit still running measures is closed by the person alone, their own
//   answer or one they hand Claude; Claude's own decision, move or merge of
//   it is refused, checked with the links, before the call and under the
//   lock.
// - What the engine sets: a replacement's kind; the question a replaced
//   decision answers, in its wording as the replacement is written — the
//   last of its line, whatever wording the replaced decision named — so it
//   is held against what it saw as an answer is (ledger-affected.cjs), or
//   the wording the replaced decision named where every wording is set
//   aside; the question a replaced question is part of; and, where the
//   content leaves them out, the replaced entry's product-wide mark (5.2.5)
//   and who moved whom where the departure rule settles it; a decision's
//   being unchecked, where the one-decision check could not judge it
//   (ledger-one-decision.cjs) — a raise's always, its draw having judged
//   its rows without the why, so the late check judges it whole
//   (ledger-late-check.cjs).
// - What the trust log is told (16.13.3, 16.13.4): Claude's answer — its
//   decision, or its replacement of a decision, the person's among them
//   (5.8.19) — logs a call, naming the entry, its kind, label and sort left
//   for the labeller and the decision point to fill; the person's
//   replacement the departure rule holds standing over a lean the entry it
//   replaces held logs a reversal, naming the entry it reverses (16.12.1,
//   ledger-verdicts.cjs). A decision carried over is no call of Claude's,
//   and logs nothing (21.1.5, 21.6.5). Any other write logs nothing. What a
//   raise lands logs the event the raise gives it: a raise answered, or a
//   call carrying the decision point's sort; a fact's answer logs none, as
//   it counts for nothing in the trust layer (16.3.8). The event is built
//   in the command that writes its line, under the writer lock, and kept
//   waiting in the conversation ahead of its line before the ledger's
//   append, so what refuses it writes nothing, a project manifest holding
//   no project_id among it; it lands after the ledger's append and before
//   its commit, the trust log's own lock taken inside the writer's, where
//   nothing but that append can fail: a failure is a warning, the event
//   waiting on. A command killed between the two leaves it waiting for the
//   conversation's next record or a boot, which lands it once the entry is
//   in the ledger, and lets it go where the entry never came, so it is
//   neither lost nor doubled (trust-log.cjs). What a raise lands lands as
//   the id its raise minted, so its rerun after a kill past the append finds
//   the ledger holding it, appends and logs nothing again, finishes what
//   the kill left — the event kept ahead of the line landed, the ledger
//   committed — and answers the line the ledger holds; its rerun after a
//   kill before the append keeps its own event in place of the one the
//   killed run kept, so the line has one event, the rerun's.
// - When: all that the request alone settles is refused before the writer
//   lock — its argv, its place, its content in the shape of the kind it
//   writes, a replacement reading that kind from the ledger — so a malformed
//   write never waits on a peer; then a decision's links are resolved and
//   checked against the ledger as it stands — folded once before the lock, a
//   replacement's reading reused — so no call is spent on a write they
//   refuse, and it is judged, one rule or several, by the separate Claude
//   call, which no peer waits on either. Under the lock the ledger is folded
//   (ledger-fold.cjs), the place's liveness read again, every link resolved
//   and its currency and relations checked again, the trust log's event
//   built and kept, the entry appended, the event landed in the trust log,
//   and the ledger committed, so no peer's write or lifecycle change lands
//   between the check and the append. The answer is made once the lock is
//   released: the entry's short id, the commit, and as warnings a push that
//   failed and what a landing finished on the way said, which a refusal
//   carries too.
//   Then, the lock released, the knowledge base's copies are rendered
//   against the ledger and indexed (ledger-copies.cjs), a failure a warning
//   on an entry that stands (22.6.15).
// ---------------------------------------------------------------------------

const { messageOf, stdinObject } = require('../kernel/call.cjs');
const { VALID_PHASES, WORK_TYPE_PIPELINES } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { appendEntry, carrying, withLedger } = require('./ledger.cjs');
const { LEDGER, HEADER, REASONS, ROADMAP, entryKind, claudesCall, roadmapItemOf, eventFields } = require('./ledger-events.cjs');
const { newId, shortId, resolveId } = require('./ledger-ids.cjs');
const { ID_FACTS, foldLedger, readFolded, factsOf, standingOf, notCurrent, currentsOf, wordingOf } = require('./ledger-fold.cjs');
const { TOPIC_PHASES, hasItem, hasTopic, hasRoadmapItem, manifestOf, experimentWaits, liveness } = require('./ledger-units.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { commitStateTail, HELD_NOTE } = require('./commit.cjs');
const { checkOneDecision } = require('./ledger-one-decision.cjs');
const { refreshLedgerCopies } = require('./ledger-copies.cjs');
const { derivedMove, movedRefusal, reverses } = require('./ledger-verdicts.cjs');
const { heldAgainst } = require('./ledger-affected.cjs');
const { newEvent, keepEvent, landKept } = require('./trust-log.cjs');

/** @typedef {import('./ledger-fold.cjs').IdFacts} IdFacts */
/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger-fold.cjs').Standing} Standing */
/** @typedef {import('./ledger-fold.cjs').Liveness} Liveness */
/** @typedef {import('./ledger-events.cjs').EntryKind} EntryKind */

/**
 * What a link must name: said for its refusal, and the test of the facts of
 * the id it names.
 * @typedef {{is: string, test: (facts: IdFacts) => boolean}} Names
 */

/**
 * Whose entries a link may name: null, anyone's; 'topic', another unit's, or
 * the write's own unit's, before the spec only its own topic's (5.6.9);
 * 'unit', the write's own unit's alone, before the spec only its own
 * topic's.
 * @typedef {null|'topic'|'unit'} Owner
 */

/**
 * A flag a write takes: the event's field it sets, how its value is shown in
 * the usage, whether it must be given and whether it may be given more than
 * once; and for a link, what it must name, whether that must be current,
 * and whose it may be.
 * @typedef {{field: string, shown: string, required: boolean, many: boolean, names: Names|null, current: boolean, owner: Owner}} Flag
 */

/**
 * A write's links as its event holds them: an id, a list of ids, or null
 * where an optional one is not given; a value as given.
 * @typedef {Record<string, string|string[]|null>} Linked
 */

/**
 * A write: the event it appends, the flags it takes, whether it is made
 * from a topic alone, and what it checks of what it is given before the
 * lock, of the places it names beyond its own as liveness reads them —
 * before the lock and again under it — and of the entries its links name
 * under it, each refused in the words of the command asking.
 * @typedef {{
 *   event: string,
 *   flags: Flag[],
 *   fromTopic: boolean,
 *   checkGiven: (said: string, at: Address, given: Map<string, string[]>) => void,
 *   checkLive: (said: string, at: Address, given: Map<string, string[]>, live: Liveness) => void,
 *   checkLinked: (said: string, linked: Linked, read: Folded) => void,
 * }} Write
 */

/**
 * What a raise checks of the ledger under the lock, before its links
 * resolve and its write's own checks run, so its refusal is the raise's
 * own (raise.cjs).
 * @typedef {(read: Folded) => void} ReadCheck
 */

/**
 * Where a write is made: the dot-path naming it, the project's state root,
 * the unit and its manifest, the phase, and the topic, or null at the
 * unit's level.
 * @typedef {{dotpath: string, root: string, unit: string, manifest: Record<string, any>, phase: string, topic: string|null}} Address
 */

/**
 * The trust log's event a write logs, built from the entry it is about to
 * append, its id minted: the event's type and its own fields.
 * @typedef {(entry: Record<string, unknown>) => {type: string, fields: Record<string, unknown>}} Logs
 */

/**
 * A write as asked, read whole and checked before the lock: the verb, the
 * command asking, as its refusals name it, where it is made, the session,
 * each flag's values by field, the kind of entry it writes — null for an
 * event that is no entry — its content, checked in that kind's shape, and,
 * for a decision, whether it lands unchecked: true until the one-decision
 * check finds it holds one rule; the id it lands as, minted by its raise,
 * or null for one minted under the lock; what it checks of the ledger under
 * the lock before its links resolve; the trust log's event it logs, or
 * null; and the ledger as it stood before the lock, folded the first time a
 * step reads it.
 * @typedef {{verb: string, said: string, write: Write, at: Address, session: string, given: Map<string, string[]>, kind: EntryKind|null, content: Record<string, unknown>, unchecked: boolean, id: string|null, checkRead: ReadCheck, logs: Logs|null, before: () => Folded}} Request
 */

/**
 * A write landed: the entry's short id, the commit, a note where the commit
 * is pending, and any warnings.
 * @typedef {{id: string, committed: string|null, note?: string, warnings?: string[]}} Landed
 */

/**
 * A raise's answer landed, and the line the ledger already held at its id —
 * written by an earlier run, so nothing was appended — or null.
 * @typedef {{landed: Landed, held: Record<string, unknown>|null}} RaiseLanded
 */

/** Where a raise was drawn: its unit, its phase, and its topic, or null at the unit's level. @typedef {{unit: string, phase: string, topic: string|null}} Place */

/**
 * How a raise lands: as `ledger decide` writes, answering its question; as
 * `ledger replace` writes, replacing a decision; or as the person's keep of
 * that decision as it stands.
 * @typedef {'decide'|'replace'|'keep'} Lands
 */

/**
 * What a raise lands (raise.cjs) — the person's answer to it, or Claude's
 * call the decision point lets proceed: the command asking, as its refusals
 * name it; where the raise was drawn; how it lands, and its links by full
 * id, as the raise sealed them; the line's content; the id it lands as,
 * minted at the draw, or null for one minted under the lock; the trust
 * log's event it logs, or null — a fact's answer logs none; and what it
 * checks of the ledger under the lock before its links resolve.
 * @typedef {{said: string, place: Place, lands: Lands, linked: Linked, content: Record<string, unknown>, id: string|null, logs: Logs|null, checkRead: ReadCheck}} Raised
 */

/** @param {string} is @param {(facts: IdFacts) => boolean} test @returns {Names} */
function names(is, test) {
  return { is, test };
}

const AN_ENTRY = names('an entry', (f) => f.kind !== null);
const A_QUESTION = names('a question', (f) => f.kind === 'question');
const A_DECISION = names('a decision', (f) => f.kind === 'decision');
const A_REPLACEMENT = names('a replacement', (f) => f.event === 'replaced');

/**
 * What a reason's cause must name, where the reason needs one (5.3.8): said
 * for its refusal, and the test of the cause's facts and where it stands
 * against where the replaced entry stands.
 * @type {Readonly<Record<string, {is: string, test: (cause: IdFacts, causeAt: Standing, replacedAt: Standing) => boolean}>>}
 */
const CAUSES = Object.freeze({
  'new-fact': { is: 'a finding', test: (cause) => cause.kind === 'finding' },
  'other-topic': {
    is: 'a decision on a topic other than the replaced entry\'s',
    test: (cause, causeAt, replacedAt) => cause.kind === 'decision' && (causeAt.unit !== replacedAt.unit || causeAt.topic !== replacedAt.topic),
  },
});

/**
 * A link to one entry.
 * @param {string} field @param {Names} what
 * @param {{required?: boolean, current?: boolean, owner?: Owner}} [opts]
 * @returns {Flag}
 */
function link(field, what, { required = false, current = false, owner = null } = {}) {
  return { field, shown: '<id>', required, many: false, names: what, current, owner };
}

/** The links to the current entries an entry relies on, any number of them. @type {Flag} */
const RELIES_ON = Object.freeze({ field: 'relies_on', shown: '<id>', required: false, many: true, names: AN_ENTRY, current: true, owner: null });

/** A plain value, naming no entry. @param {string} field @param {string} shown @returns {Flag} */
function plain(field, shown) {
  return { field, shown, required: true, many: false, names: null, current: false, owner: null };
}

/** A replacement's reason, one of the four (5.6.2). */
const REASON = plain('reason', `<${REASONS.join('|')}>`);

/** A write that checks nothing of its own. */
function nothingToCheck() {}

/**
 * @param {string} event @param {Flag[]} flags
 * @param {{fromTopic?: boolean, checkGiven?: Write['checkGiven'], checkLive?: Write['checkLive'], checkLinked?: Write['checkLinked']}} [opts]
 * @returns {Write}
 */
function writeOf(event, flags, { fromTopic = false, checkGiven = nothingToCheck, checkLive = nothingToCheck, checkLinked = nothingToCheck } = {}) {
  return { event, flags, fromTopic, checkGiven, checkLive, checkLinked };
}

/** @type {Readonly<Record<string, Write>>} */
const WRITES = Object.freeze({
  ask: writeOf('asked', [link('part_of', A_QUESTION, { current: true }), RELIES_ON]),
  find: writeOf('found', [RELIES_ON]),
  decide: writeOf('decided', [link('answers', A_QUESTION, { required: true, current: true, owner: 'unit' }), RELIES_ON]),
  replace: writeOf('replaced', [
    link('replaces', AN_ENTRY, { required: true, current: true, owner: 'topic' }),
    REASON,
    link('cause', AN_ENTRY),
    RELIES_ON,
  ], { checkGiven: checkCauseGiven, checkLinked: causeChecked('replaces') }),
  hold: writeOf('still-holds', [
    link('entry', AN_ENTRY, { required: true, current: true, owner: 'topic' }),
    link('after', A_REPLACEMENT, { required: true }),
  ], { checkLinked: checkHeld }),
  move: writeOf('moved', [link('question', A_QUESTION, { required: true, current: true, owner: 'unit' }), plain('to', `<topic|${ROADMAP}<item>>`)], {
    fromTopic: true, checkGiven: checkDestination, checkLive: checkDestinationLive,
  }),
  merge: writeOf('merged', [
    link('question', A_QUESTION, { required: true, current: true, owner: 'unit' }),
    link('into', A_DECISION, { required: true, current: true }),
    link('duplicate', A_DECISION, { current: true }),
  ], { checkLinked: checkDuplicate }),
});

/**
 * The person keeping a decision as it stands where Claude proposed to
 * replace it: a raise's answer alone writes it (raise.cjs), so no verb
 * takes it. It is held to the links the replacement it stood over was:
 * the decision current and the write's to make, and the cause what the
 * reason needs.
 */
const KEEP = writeOf('kept', [
  link('entry', A_DECISION, { required: true, current: true, owner: 'topic' }),
  REASON,
  link('cause', AN_ENTRY),
], { checkGiven: checkCauseGiven, checkLinked: causeChecked('entry') });

/** The writes a raise lands through, by how it lands. @type {Readonly<Record<Lands, Write>>} */
const RAISED = Object.freeze({ decide: WRITES.decide, replace: WRITES.replace, keep: KEEP });

/** Every field a flag sets, whichever write takes it: never content. */
const FLAG_FIELDS = new Set([...Object.values(WRITES), KEEP].flatMap((w) => w.flags.map((flag) => flag.field)));

/** The fields the engine gives an entry, never its content. */
const ENGINE_FIELDS = new Set([...HEADER.map((f) => f.name), 'of', 'unchecked']);

/** The kinds of finding that are measurements, whose command the closing pass runs again (9.9.7). */
const MEASURED = Object.freeze(['measured', 'exploratory']);

/** The content a write may leave out, and what it takes instead. @type {Readonly<Record<string, unknown>>} */
const DEFAULTS = Object.freeze({
  rules_out: [], product_wide: false, sealed: null, alternatives: [], evidence: [], kind: null, given: 'own', command: null, result: null, cites: [],
});

/** @param {Flag} flag */
function flagName(flag) {
  return `--${flag.field.replaceAll('_', '-')}`;
}

/** @param {Flag} flag */
function flagUsage(flag) {
  const shown = `${flagName(flag)} ${flag.shown}${flag.many ? ' …' : ''}`;
  return flag.required ? shown : `[${shown}]`;
}

/** @param {string} verb @param {string} [said] the command, as its usage names it */
function verbUsage(verb, said = `ledger ${verb}`) {
  return [`${said} <work-unit>.<phase>${WRITES[verb].fromTopic ? '.<topic>' : '[.<topic>]'}`, ...WRITES[verb].flags.map(flagUsage)].join(' ');
}

/** The write verbs' usage, a line each, its content as JSON on stdin. */
const LEDGER_USAGE = Object.keys(WRITES).map((verb) => `${verbUsage(verb)}   (content as JSON on stdin)`).join('\n');

/**
 * A write's argv read: the dot-path it names, and each flag's values by
 * field, in the order given. Refuses, in the words of `said`, the command
 * asking, a flag the verb does not take, a flag with no value, a flag given
 * more often than it takes, a missing required flag, and anything but one
 * dot-path, each with `usage`.
 * @param {string} verb @param {string[]} args @param {string} said @param {string} usage
 * @returns {{dotpath: string, given: Map<string, string[]>}}
 */
function readArgs(verb, args, said, usage) {
  const { flags } = WRITES[verb];
  /** @type {Map<string, string[]>} */
  const given = new Map(flags.map((flag) => [flag.field, []]));
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) {
      positional.push(args[i]);
      continue;
    }
    const flag = flags.find((f) => flagName(f) === args[i]);
    if (flag === undefined) throw new Error(`${said} takes no ${args[i]} — ${usage}`);
    const named = args[i + 1];
    if (named === undefined || named.startsWith('--') || named === '') throw new Error(`${said}: ${args[i]} takes ${flag.shown} — ${usage}`);
    /** @type {string[]} */ (given.get(flag.field)).push(named);
    i += 1;
  }
  if (positional.length !== 1) throw new Error(usage);
  for (const flag of flags) {
    const count = /** @type {string[]} */ (given.get(flag.field)).length;
    if (flag.required && count === 0) throw new Error(`${said} needs ${flagName(flag)} ${flag.shown} — ${usage}`);
    if (!flag.many && count > 1) throw new Error(`${said} takes one ${flagName(flag)} — ${usage}`);
  }
  return { dotpath: positional[0], given };
}

/** The phases a unit is written in: discovery, and its work type's. @param {Record<string, any>} manifest @returns {string[]} */
function phasesOf(manifest) {
  const workType = /** @type {keyof typeof WORK_TYPE_PIPELINES} */ (manifest.work_type);
  return ['discovery', ...(Object.hasOwn(WORK_TYPE_PIPELINES, workType) ? WORK_TYPE_PIPELINES[workType] : [])];
}

/**
 * Where a write is made, read from its dot-path. Refuses, in the words of
 * `said`, the command asking, a path of another shape, a phase that is none,
 * a unit that does not exist, a phase its work type does not have, a topic
 * from the spec on, a topic with no item in the phase, and a unit or topic
 * that is not live.
 * @param {string} cwd @param {string} said @param {string} dotpath
 * @returns {Address}
 */
function addressOf(cwd, said, dotpath) {
  const parts = dotpath.split('.');
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => part === '')) {
    throw new Error(`${said}: "${dotpath}" names no place to write — <work-unit>.<phase>.<topic>, or <work-unit>.<phase> at the unit's level`);
  }
  const [unit, phase, topic = null] = parts;
  if (!VALID_PHASES.includes(phase)) throw new Error(`${said}: "${phase}" is no phase — one of ${VALID_PHASES.join(', ')}`);
  const root = stateRoot(cwd);
  const manifest = manifestOf(root, unit);
  if (manifest === null) throw new Error(`${said}: there is no work unit "${unit}"`);
  const phases = phasesOf(manifest);
  if (!phases.includes(phase)) throw new Error(`${said}: ${unit} has no ${phase} phase — its work type, ${manifest.work_type}, has ${phases.join(', ')}`);
  if (topic !== null && !TOPIC_PHASES.includes(phase)) {
    throw new Error(`${said}: a topic exists only before the spec, and ${phase} is the unit's — write at ${unit}.${phase}`);
  }
  if (topic !== null && !hasItem(manifest, phase, topic)) throw new Error(`${said}: ${unit} has no topic "${topic}" in ${phase}`);
  const at = { dotpath, root, unit, manifest, phase, topic };
  checkPlaceLive(said, at, liveness(root));
  return at;
}

/**
 * Refuse, in the words of `said`, the command asking, a write on a unit or
 * topic that is not live as `live` reads it (5.8.17).
 * @param {string} said @param {Address} at @param {Liveness} live
 */
function checkPlaceLive(said, at, live) {
  const dead = live(at.unit, at.topic);
  if (dead !== null) throw new Error(`${said}: ${at.dotpath} takes no writes — ${dead}`);
}

/**
 * Refuse, in the words of `said`, the command asking, a plain value the
 * event cannot hold: a reason outside the four (5.6.2), a topic that is no
 * text.
 * @param {string} said @param {Write} write @param {Map<string, string[]>} given
 */
function checkValues(said, { event, flags }, given) {
  for (const flag of flags.filter((f) => f.names === null)) {
    const [named] = /** @type {string[]} */ (given.get(flag.field));
    const { type } = /** @type {import('./ledger-events.cjs').Field} */ (eventFields(event).find((f) => f.name === flag.field));
    if (!type.test(named)) throw new Error(`${said}: ${flagName(flag)} is ${type.is} — not "${named}"`);
  }
}

/**
 * Refuse a reason that needs a cause given none (5.3.8).
 * @param {string} said @param {Address} _at @param {Map<string, string[]>} given
 */
function checkCauseGiven(said, _at, given) {
  const [reason] = /** @type {string[]} */ (given.get('reason'));
  if (Object.hasOwn(CAUSES, reason) && /** @type {string[]} */ (given.get('cause')).length === 0) {
    throw new Error(`${said} --reason ${reason} needs --cause <id>: ${CAUSES[reason].is}`);
  }
}

/**
 * Refuse a move to the topic it is made from, to a topic the unit does not
 * have (5.3.3), or to a topic that is not live (5.8.17); and one to the
 * roadmap naming an item it does not hold (9.5.4).
 * @param {string} said @param {Address} at @param {Map<string, string[]>} given
 */
function checkDestination(said, at, given) {
  const [to] = /** @type {string[]} */ (given.get('to'));
  const item = roadmapItemOf(to);
  if (item !== null) {
    if (!hasRoadmapItem(at.root, item)) throw new Error(`${said}: --to names ${to}, and the roadmap has no item "${item}" — put it on the roadmap first`);
    return;
  }
  if (to === at.topic) throw new Error(`${said}: --to names ${to}, the topic it moves from — a question moves to another topic`);
  if (!hasTopic(at.manifest, to)) throw new Error(`${said}: ${at.unit} has no topic "${to}" to move the question to`);
  checkDestinationLive(said, at, given, liveness(at.root));
}

/**
 * Refuse a move to a topic that is not live as `live` reads it (5.8.17).
 * @param {string} said @param {Address} at @param {Map<string, string[]>} given @param {Liveness} live
 */
function checkDestinationLive(said, at, given, live) {
  const [to] = /** @type {string[]} */ (given.get('to'));
  if (roadmapItemOf(to) !== null) return;
  const dead = live(at.unit, to);
  if (dead !== null) throw new Error(`${said}: --to names ${to}, which takes no question — ${dead}`);
}

/** @param {IdFacts} facts */
function described(facts) {
  return facts.kind === null ? `a ${facts.event} event` : `a ${facts.kind}`;
}

/** Where in its unit an entry stands. @param {Standing} standing */
function whereItStands({ topic }) {
  return topic === null ? 'at the unit\'s level' : `on ${topic}`;
}

/**
 * Why a link whose entries are `owner`'s may not name an entry standing at
 * `standing` from `at`, or null where it may: another unit's, for a link of
 * the unit's own; before the spec, one of the unit's on another topic than
 * the write's (5.6.9).
 * @param {Owner} owner @param {Address} at @param {Standing} standing
 * @returns {string|null}
 */
function strayed(owner, at, standing) {
  if (owner === null) return null;
  if (standing.unit !== at.unit) return owner === 'unit' ? `of ${standing.unit} — it must be ${at.unit}'s own` : null;
  if (!TOPIC_PHASES.includes(at.phase) || standing.topic === at.topic) return null;
  return `${whereItStands(standing)} — before the spec a topic writes on its own entries alone, and another topic's change goes to it by message`;
}

/**
 * Why an entry that is not current cannot be named where a current one must
 * be: what replaced it or merged it away as a duplicate, and where its chain
 * leads now; or why its topic or unit is not live.
 * @param {Folded} read @param {string} id @param {import('./ledger-fold.cjs').NotCurrent} why
 * @param {(id: string) => string} short
 * @returns {string}
 */
function staleness(read, id, why, short) {
  if ('dead' in why) return `which is not current: ${why.dead}`;
  const currents = currentsOf(read, id).map(short);
  const now = currents.length === 0 ? 'nothing it leads to is current' : `the current one${currents.length > 1 ? 's are' : ' is'} ${currents.join(', ')}`;
  if ('replaced_by' in why) return `which ${short(why.replaced_by)} replaced — ${now}`;
  return `which ${short(why.merged_by)} merged as a duplicate — ${now}`;
}

/**
 * The id a link's prefix names, checked against what the link must name: an
 * entry not current is refused for a link that must be current, saying why
 * and naming the current one, and an entry the link may not name from where
 * the write is made is refused, saying where it stands — each in the words
 * of `said`, the command asking.
 * @param {string} said @param {Address} at @param {Flag} flag @param {string} prefix @param {Folded} read
 * @returns {string}
 */
function resolveLink(said, at, flag, prefix, read) {
  const { facts } = read;
  const where = `${said} ${flagName(flag)}`;
  const short = (/** @type {string} */ id) => shortId(id, facts.keys());
  let id;
  try {
    id = resolveId(prefix, facts.keys());
  } catch (err) {
    throw new Error(`${where}: ${messageOf(err)}`);
  }
  const named = /** @type {IdFacts} */ (facts.get(id));
  const what = /** @type {Names} */ (flag.names);
  if (!what.test(named)) throw new Error(`${where} names ${short(id)}, ${described(named)} — it must name ${what.is}`);
  const stale = flag.current ? notCurrent(read, id) : null;
  if (stale !== null) throw new Error(`${where} names ${short(id)}, ${staleness(read, id, stale, short)}`);
  const why = strayed(flag.owner, at, standingOf(read, id));
  if (why !== null) throw new Error(`${where} names ${short(id)}, ${described(named)} ${why}`);
  return id;
}

/**
 * Each of `flags`' fields as the event holds it: a link's prefixes resolved
 * to ids and checked, in the words of `said`, the command asking, and a
 * value as given.
 * @param {string} said @param {Flag[]} flags @param {Address} at @param {Map<string, string[]>} given @param {Folded} read
 * @returns {Linked}
 */
function linksOf(said, flags, at, given, read) {
  /** @type {Linked} */
  const fields = {};
  for (const flag of flags) {
    const values = /** @type {string[]} */ (given.get(flag.field));
    const resolved = flag.names === null ? values : [...new Set(values.map((prefix) => resolveLink(said, at, flag, prefix, read)))];
    fields[flag.field] = flag.many ? resolved : resolved[0] ?? null;
  }
  return fields;
}

/**
 * A request's links as its event holds them (`linksOf`).
 * @param {Request} request @param {Folded} read
 * @returns {Linked}
 */
function resolvedLinks({ said, write, at, given }, read) {
  return linksOf(said, write.flags, at, given, read);
}

/**
 * The check of a replacement's cause, the entry it replaces named by
 * `field` — a keep's, the entry Claude proposed to replace: refuse a cause
 * that is that entry, or that is not what the reason needs, by where each
 * stands (5.3.8).
 * @param {string} field
 * @returns {Write['checkLinked']}
 */
function causeChecked(field) {
  return (said, linked, read) => {
    if (linked.cause === null) return;
    const { facts } = read;
    const [cause, replaces, reason] = /** @type {string[]} */ ([linked.cause, linked[field], linked.reason]);
    const where = `${said} --cause names ${shortId(cause, facts.keys())}`;
    if (cause === replaces) throw new Error(`${where}, the entry it replaces — a cause is what made the change`);
    if (!Object.hasOwn(CAUSES, reason)) return;
    const named = /** @type {IdFacts} */ (facts.get(cause));
    const causeAt = standingOf(read, cause);
    if (!CAUSES[reason].test(named, causeAt, standingOf(read, replaces))) {
      throw new Error(`${where}, ${described(named)} ${whereItStands(causeAt)} — --reason ${reason} needs ${CAUSES[reason].is}`);
    }
  };
}

/**
 * Refuse a confirmation of an entry after anything but the latest live
 * replacement on the way to its current form of an entry it is held
 * against — one it relies on, or the question an answer answers (5.6.10,
 * ledger-affected.cjs): one on no such way, or an earlier one, naming the
 * latest.
 * @param {string} said @param {Linked} linked @param {Folded} read
 */
function checkHeld(said, linked, read) {
  const [entry, after] = /** @type {string[]} */ ([linked.entry, linked.after]);
  const ways = heldAgainst(read, entry);
  if (ways.some(({ replacements }) => replacements.at(-1) === after)) return;
  const short = (/** @type {string} */ id) => shortId(id, read.facts.keys());
  const passed = ways.find(({ replacements }) => replacements.includes(after));
  if (passed === undefined) {
    throw new Error(`${said} --entry names ${short(entry)}, which is held against nothing ${short(after)} changed — it holds an entry relying on or answering one whose way to its current form the replacement is on`);
  }
  throw new Error(`${said} --after names ${short(after)}, an earlier change on the way of ${short(passed.held_against)} — a hold names the latest: ${short(/** @type {string} */ (passed.replacements.at(-1)))}`);
}

/**
 * Refuse a merge's duplicate that is the entry it goes into, or that answers
 * another question than the one merged, by any of its wordings, standing or
 * set aside (5.3.13, 5.5.4, 5.5.5).
 * @param {string} said @param {Linked} linked @param {Folded} read
 */
function checkDuplicate(said, linked, read) {
  if (linked.duplicate === null) return;
  const { facts } = read;
  const [question, into, duplicate] = /** @type {string[]} */ ([linked.question, linked.into, linked.duplicate]);
  const short = (/** @type {string} */ id) => shortId(id, facts.keys());
  const where = `${said} --duplicate names ${short(duplicate)}`;
  if (duplicate === into) throw new Error(`${where}, the decision --into names — a duplicate is another entry`);
  const answers = /** @type {string} */ (factsOf(read, duplicate).answers);
  if (factsOf(read, answers).root !== factsOf(read, question).root) {
    throw new Error(`${where}, which answers ${short(answers)} — a duplicate answers the question merged, ${short(question)}, in any of its wordings`);
  }
}

/**
 * What follows from a replacement's link to what it replaces: the kind it
 * stands for; for a decision, the question it answers in its wording as the
 * replacement is written, whatever wording the replaced decision named — or
 * that one, where every wording is set aside; for a question, the question
 * it is part of. Nothing for any other write.
 * @param {Write} write @param {Linked} linked @param {Folded} read
 * @returns {Record<string, unknown>}
 */
function followed(write, linked, read) {
  if (write.event !== 'replaced') return {};
  const replaced = factsOf(read, /** @type {string} */ (linked.replaces));
  const of = replaced.kind;
  if (of === 'decision') {
    const named = /** @type {string} */ (replaced.answers);
    return { of, answers: wordingOf(read, named) ?? named };
  }
  if (of === 'question') return { of, part_of: replaced.part_of };
  return { of };
}

/**
 * The ledger folded, read against liveness as the manifests say it now.
 * @param {Address} at @param {string[]} warnings
 * @returns {Folded}
 */
function readNow(at, warnings) {
  return { facts: foldLedger(at.root, ID_FACTS, warnings), live: liveness(at.root) };
}

/**
 * The ledger as it stands before the lock, folded the first time a step
 * asks for it and never again.
 * @param {Address} at @param {string[]} warnings
 * @returns {() => Folded}
 */
function readBefore(at, warnings) {
  /** @type {Folded|null} */
  let read = null;
  return () => {
    read ??= readNow(at, warnings);
    return read;
  };
}

/**
 * The entry a replacement replaces, read from the ledger before the lock:
 * its facts, its link checked as the lock checks it again, in the words of
 * `said`, the command asking.
 * @param {string} said @param {Address} at @param {Map<string, string[]>} given @param {Folded} read
 * @returns {IdFacts}
 */
function replacedEntry(said, at, given, read) {
  const flag = /** @type {Flag} */ (WRITES.replace.flags.find((f) => f.field === 'replaces'));
  const id = resolveLink(said, at, flag, /** @type {string[]} */ (given.get('replaces'))[0], read);
  return /** @type {IdFacts} */ (read.facts.get(id));
}

/**
 * The content the write's event holds, from what stdin gave: for a
 * replacement in the shape of the entry it replaces, each field typed as its
 * schema names, one left out taking its default — for a replacement's
 * product-wide mark, the replaced entry's. Refuses, in the words of
 * `said`, the command asking, a link, a field the engine gives, a field the
 * event does not hold, and a field it needs that is missing.
 * @param {string} said @param {Write} write @param {Record<string, unknown>} given @param {IdFacts|null} replaced
 * @returns {Record<string, unknown>}
 */
function contentFields(said, write, given, replaced) {
  const fields = eventFields(write.event, replaced === null ? null : replaced.kind).filter((f) => !FLAG_FIELDS.has(f.name) && !ENGINE_FIELDS.has(f.name));
  const defaults = replaced === null || replaced.product_wide === null ? DEFAULTS : { ...DEFAULTS, product_wide: replaced.product_wide };
  for (const key of Object.keys(given)) {
    if (FLAG_FIELDS.has(key)) {
      const flag = write.flags.find((f) => f.field === key);
      throw new Error(`${said}: the content carries ${key}, a link — a link is given as a flag${flag ? ` (${flagName(flag)})` : ''}, never in the content`);
    }
    if (ENGINE_FIELDS.has(key)) throw new Error(`${said}: the content carries ${key}, which the engine gives`);
    if (!fields.some((f) => f.name === key)) {
      throw new Error(`${said}: the content has no field ${key} — it holds ${fields.map((f) => f.name).join(', ')}`);
    }
  }
  /** @type {Record<string, unknown>} */
  const content = {};
  for (const { name, type } of fields) {
    if (!Object.hasOwn(given, name)) {
      if (!Object.hasOwn(defaults, name)) throw new Error(`${said}: the content needs ${name}`);
      content[name] = structuredClone(defaults[name]);
    } else if (!type.test(given[name])) {
      throw new Error(`${said}: the content's ${name} is not ${type.is}`);
    } else {
      content[name] = given[name];
    }
  }
  return content;
}

/**
 * Claude's call logged (16.3.7), naming the entry, with its sort — null
 * where no raise sorted it — its kind and label left for the labeller.
 * @param {'one'|'several'|null} sort
 * @returns {Logs}
 */
function callLogged(sort) {
  return ({ id }) => ({ type: 'call', fields: { entry: id, kind: null, label: null, sort } });
}

/** The person's reversal logged (16.12.1), naming the entry and the entry it reverses. @type {Logs} */
const REVERSAL_LOGGED = ({ id, replaces }) => ({ type: 'reversal', fields: { entry: id, reverses: replaces } });

/**
 * The trust log's event a write logs: a call for Claude's answer, a
 * decision or a decision's replacement; a reversal for the person's
 * replacement reversing the decision it replaces; null for any other.
 * @param {EntryKind|null} kind @param {Record<string, unknown>} content @param {string|null} reason @param {IdFacts|null} replaced
 * @returns {Logs|null}
 */
function trustEventOf(kind, content, reason, replaced) {
  if (kind !== 'decision') return null;
  if (content.by === 'claude') return claudesCall(content) ? callLogged(null) : null;
  return reverses(content, kind, reason, replaced) ? REVERSAL_LOGGED : null;
}

/**
 * Refuse, in the words of `said`, the command asking, content that says
 * of itself what cannot be: the person's decision given as anything but
 * their own, a finding saying no kind, a measurement — measured or
 * exploratory — with no command run or no result, and a command or a
 * result without the other.
 * @param {string} said @param {EntryKind|null} kind @param {Record<string, unknown>} content
 */
function checkSaid(said, kind, { by, given, known, command, result }) {
  if (kind === 'decision' && by === 'person' && given !== 'own') {
    throw new Error(`${said}: the person's decision is given ${given} — the person's own is given own, and what they hand over, or what is carried over, is Claude's line, by claude`);
  }
  if (kind !== 'finding') return;
  if (known === null) throw new Error(`${said}: the content's known is null — a finding written now says how it is known`);
  if (MEASURED.includes(/** @type {string} */ (known)) && command === null) {
    throw new Error(`${said}: ${known === 'exploratory' ? 'an exploratory' : 'a measured'} finding records the command run and its result — the content needs command and result`);
  }
  if ((command === null) !== (result === null)) throw new Error(`${said}: a finding's command comes with its result — the content gives ${command === null ? 'a result and no command' : 'a command and no result'}`);
}

/**
 * Refuse, in the words of `said`, the command asking, the person's entry
 * carrying Claude's sealed answer: the person's answer to Claude's lean is
 * a raise's (raise.cjs), which sealed the lean before they answered and
 * logs the answer beside its entry.
 * @param {string} said @param {Record<string, unknown>} content
 */
function checkUnsealed(said, { by, sealed }) {
  if (by === 'person' && sealed !== undefined && sealed !== null) {
    throw new Error(`${said}: the person's entry carries sealed, Claude's lean — the person's answer to Claude's lean is recorded by raise answer, against the lean its raise sealed`);
  }
}

/** The link naming the question an event closes, by the event. @type {Readonly<Record<string, string>>} */
const CLOSES = Object.freeze({ decided: 'answers', moved: 'question', merged: 'question' });

/**
 * Refuse, in the words of `said`, the command asking, Claude's own close of
 * a question an experiment of its unit still running measures (9.1.11): its
 * decision, move or merge. The person closes it meanwhile, their own answer
 * or one they hand Claude, and once the experiment ends the discussion
 * writes the result.
 * @param {Request} request @param {Linked} linked @param {Folded} read
 */
function checkUnmeasured({ said, write, at, content }, linked, read) {
  const field = CLOSES[write.event];
  const handed = write.event === 'decided' && content.given !== 'own';
  if (field === undefined || content.by !== 'claude' || handed) return;
  const question = /** @type {string} */ (linked[field]);
  const { root } = factsOf(read, question);
  const measuring = experimentWaits(/** @type {Record<string, any>} */ (manifestOf(at.root, at.unit)))
    .find((wait) => wait.running && read.facts.has(wait.question) && factsOf(read, wait.question).root === root);
  if (measuring === undefined) return;
  throw new Error(`${said}: ${shortId(question, read.facts.keys())} is measured by experiment ${measuring.experiment}, still running — Claude never closes a question its experiment measures; the person may, and once it ends the discussion writes the result`);
}

/**
 * Where a decision or a replacement is to be written and the entries its
 * links name, read and checked as `ledger <verb>` checks them before the
 * lock, against the ledger as it stands, and refused in the words of
 * `said`, the command asking: a raise (raise.cjs), whose answer is that
 * write. Answers the place, the links, the ledger as read, and for a
 * replacement the line of the entry it replaces, else null.
 * @param {string} cwd @param {'decide'|'replace'} verb @param {string[]} args @param {string} said @param {string} usage @param {string[]} warnings
 * @returns {{at: Address, linked: Linked, read: Folded, replacing: Record<string, unknown>|null}}
 */
function writePlaced(cwd, verb, args, said, usage, warnings) {
  const write = WRITES[verb];
  const { dotpath, given } = readArgs(verb, args, said, usage);
  const at = addressOf(cwd, said, dotpath);
  checkValues(said, write, given);
  write.checkGiven(said, at, given);
  return readFolded(at.root, ID_FACTS, warnings, (facts, entryAt) => {
    const read = { facts, live: liveness(at.root) };
    const linked = linksOf(said, write.flags, at, given, read);
    write.checkLinked(said, linked, read);
    const replaces = linked.replaces ?? null;
    return { at, linked, read, replacing: typeof replaces === 'string' ? entryAt(factsOf(read, replaces).place) : null };
  });
}

/**
 * A write as asked, read whole and checked before the lock: its argv, where
 * it is made, the session, and its content in the shape of the kind it
 * writes, a replacement reading the kind it replaces from the ledger.
 * Refuses argv the verb does not take, a place it cannot write, no session,
 * a value its event cannot hold, stdin holding no JSON object, the person's
 * entry carrying Claude's sealed answer, content the kind does not hold,
 * and who moved whom the departure rule does not allow, which it sets where
 * the writer leaves it out and the rule allows one value alone.
 * @param {string} cwd @param {string} verb @param {string[]} args @param {() => string} stdin @param {string[]} warnings
 * @returns {Request}
 */
function requestOf(cwd, verb, args, stdin, warnings) {
  const said = `ledger ${verb}`;
  const write = WRITES[verb];
  const { dotpath, given } = readArgs(verb, args, said, `Usage: engine ${verbUsage(verb)}   (content as JSON on stdin)`);
  const at = addressOf(cwd, said, dotpath);
  if (write.fromTopic && at.topic === null) {
    throw new Error(TOPIC_PHASES.includes(at.phase)
      ? `${said}: a question moves from a topic — name it: ${at.unit}.${at.phase}.<topic>`
      : `${said}: a question moves from a topic, and ${at.phase} has none — a topic exists only before the spec`);
  }
  const session = handedSession();
  if (session === null) throw new Error(`${said}: no session to tag the entry with — CLAUDE_CODE_SESSION_ID is not set`);
  checkValues(said, write, given);
  write.checkGiven(said, at, given);
  const content = stdinObject(stdin(), `ledger ${verb}`, 'the entry\'s content');
  checkUnsealed(said, content);
  const before = readBefore(at, warnings);
  const replaced = write.event === 'replaced' ? replacedEntry(said, at, given, before()) : null;
  const reason = replaced === null ? null : /** @type {string[]} */ (given.get('reason'))[0];
  const kind = replaced === null ? entryKind({ event: write.event }) : replaced.kind;
  const derived = derivedMove(content, kind, reason, replaced);
  const fields = contentFields(said, write, derived === null ? content : { who_moved_whom: derived, ...content }, replaced);
  checkSaid(said, kind, fields);
  const unmoved = movedRefusal(fields, kind, reason, replaced);
  if (unmoved !== null) throw new Error(`${said}: who_moved_whom is ${fields.who_moved_whom} — ${unmoved}`);
  return {
    verb, said, write, at, session, given, kind,
    content: fields,
    unchecked: true,
    id: null,
    checkRead: nothingToCheck,
    logs: trustEventOf(kind, fields, reason, replaced),
    before,
  };
}

/** A dot-path naming `place`. @param {Place} place */
function dotpathOf({ unit, phase, topic }) {
  return [unit, phase, ...(topic === null ? [] : [topic])].join('.');
}

/** A link's ids, or a value, as a flag gives them: none where it is null. @param {string|string[]|null|undefined} value @returns {string[]} */
function valuesOf(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * What a raise lands as a request (`Raised`): made where the raise was
 * drawn and linked as it sealed, read and checked as its write reads its
 * place before the lock and its links under it, in the raise's words; its
 * content in that write's shape, what it leaves out taking its default — a
 * replacement's the shape of the entry it replaces, read before the lock
 * whether or not it is current, since the line a rerun finds landed
 * replaced it, and under the lock a ledger holding the raise's id is
 * answered before any link is checked; a decision landing unchecked.
 * @param {string} cwd @param {Raised} raised @param {string[]} warnings
 * @returns {Request}
 */
function raisedRequest(cwd, { said, place, lands, linked, content, id, logs, checkRead }, warnings) {
  const write = RAISED[lands];
  const at = addressOf(cwd, said, dotpathOf(place));
  const given = new Map(write.flags.map((flag) => [flag.field, valuesOf(linked[flag.field])]));
  const before = readBefore(at, warnings);
  const replaced = write === WRITES.replace ? factsOf(before(), /** @type {string} */ (linked.replaces)) : null;
  return {
    verb: lands, said, write, at,
    session: /** @type {string} */ (handedSession()),
    given,
    kind: replaced === null ? entryKind({ event: write.event }) : replaced.kind,
    content: contentFields(said, write, content, replaced),
    unchecked: true,
    id, checkRead, logs, before,
  };
}

/**
 * The event a request appends, its links resolved and checked against the
 * folded ledger: its tags, its content, its links, what follows from them,
 * and what the engine gives.
 * @param {Request} request @param {Folded} read
 * @returns {Record<string, unknown>}
 */
function eventOf(request, read) {
  const { write, at, session, kind, content, unchecked } = request;
  request.checkRead(read);
  const linked = resolvedLinks(request, read);
  write.checkLinked(request.said, linked, read);
  checkUnmeasured(request, linked, read);
  return {
    event: write.event, unit: at.unit, topic: at.topic, phase: at.phase, session,
    ...content, ...linked, ...followed(write, linked, read), ...(kind === 'decision' ? { unchecked } : {}),
  };
}

/**
 * A decision's links resolved and checked before the one-decision call,
 * against the ledger as read before the lock, as the lock checks them again,
 * so no call is spent on a write its links refuse. Answers the entries they
 * name, by short id, for the call's refusal.
 * @param {Request} request
 * @returns {import('./ledger-one-decision.cjs').Named}
 */
function linkedBeforeCall(request) {
  const read = request.before();
  const { answers, replaces } = eventOf(request, read);
  const short = (/** @type {unknown} */ id) => shortId(/** @type {string} */ (id), read.facts.keys());
  return { answers: short(answers), replaces: replaces === undefined ? null : short(replaces) };
}

/**
 * A write as asked, a decision among them judged by the one-decision check.
 * @param {Request} request
 * @returns {Request}
 */
function oneDecisionChecked(request) {
  return request.kind === 'decision' ? checkOneDecision(request, linkedBeforeCall(request)) : request;
}

/**
 * A ledger commit's message: the unit, the event and its id, and the topic
 * it stands on.
 * @param {string} unit @param {string} event @param {string} id @param {string|null} topic
 */
function ledgerMessage(unit, event, id, topic) {
  return `ledger(${unit}): ${event} ${id}${topic === null ? '' : ` in ${topic}`}`;
}

/**
 * The ledger committed to the state branch, under the message of the
 * request's entry `id`: a commit git refuses a warning.
 * @param {string} cwd @param {Request} request @param {string} id @param {string[]} warnings
 */
function commitLedger(cwd, { at, write }, id, warnings) {
  return commitStateTail(cwd, LEDGER, ledgerMessage(at.unit, write.event, id, at.topic), warnings);
}

/**
 * Under the writer lock: the ledger folded; where it already holds the id
 * the request's raise minted, the write a rerun of one killed past its
 * append, or of one that finished, done as the first run left it — its
 * event, kept ahead of the entry, landed, and the ledger committed —
 * nothing appended again. Else the places the write names read live again,
 * the trust log's event built and kept waiting in the conversation, the
 * entry appended, the event landed in the trust log, and the ledger
 * committed to the state branch. Answers the entry's short id, the commit,
 * and the entry the ledger already held, or null.
 * @param {string} cwd @param {Request} request @param {string[]} warnings
 * @returns {{id: string, outcome: {committed: string|null, failed: boolean, held?: true}, held: Record<string, unknown>|null}}
 */
function land(cwd, request, warnings) {
  const { said, at, write, given, logs } = request;
  const read = readNow(at, warnings);
  const id = request.id ?? newId();
  const short = shortId(id, read.facts.keys());
  if (read.facts.has(id)) {
    const held = withLedger(at.root, warnings, (ledger) => ledger.entryAt(factsOf(read, id).place));
    if (logs !== null) landKept(cwd, warnings);
    return { id: short, outcome: commitLedger(cwd, request, id, warnings), held };
  }
  checkPlaceLive(said, at, read.live);
  write.checkLive(said, at, given, read.live);
  const fields = eventOf(request, read);
  if (logs !== null) {
    const { type, fields: own } = logs({ ...fields, id });
    keepEvent(newEvent(type, own, cwd), at.root, id);
  }
  appendEntry(at.root, fields, warnings, id);
  if (logs !== null) landKept(cwd, warnings);
  return { id: short, outcome: commitLedger(cwd, request, id, warnings), held: null };
}

/**
 * A request landed under the writer lock, then the knowledge base's copies
 * rendered and indexed against the ledger; with the entry the ledger
 * already held at its id, or null.
 * @param {string} cwd @param {Request} request @param {string[]} warnings
 * @returns {RaiseLanded}
 */
function landed(cwd, request, warnings) {
  const { id, outcome, held } = withStateLock(request.at.root, () => land(cwd, request, warnings));
  refreshLedgerCopies(cwd, warnings);
  /** @type {Landed} */
  const result = { id, committed: outcome.committed };
  if (outcome.held) result.note = HELD_NOTE;
  else if (outcome.failed) result.note = 'commit pending — the entry is in the ledger, and the next ledger write or boot commits it';
  if (warnings.length > 0) result.warnings = warnings;
  return { landed: result, held };
}

/**
 * `ledger <verb>`: one event appended and committed, then the knowledge
 * base's copies rendered and indexed. Answers the entry's short id, the
 * commit, and any warnings; a commit git refused is pending, and the next
 * write's commit, or boot's, takes the ledger whole.
 * @param {string} cwd @param {string} verb @param {string[]} args @param {() => string} stdin
 * @returns {Landed}
 */
function writeLedger(cwd, verb, args, stdin) {
  /** @type {string[]} */
  const warnings = [];
  try {
    return landed(cwd, oneDecisionChecked(requestOf(cwd, verb, args, stdin, warnings)), warnings).landed;
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/**
 * What a raise lands — a decision, a replacement or a keep — through the
 * lock the ledger's writes land through: answered as `writeLedger` answers,
 * `warnings` the raise's own among them, beside the line the ledger already
 * held at its id — a rerun whose first run appended it lands nothing
 * again — or null.
 * @param {string} cwd @param {Raised} raised @param {string[]} warnings
 * @returns {RaiseLanded}
 */
function landRaised(cwd, raised, warnings) {
  try {
    return landed(cwd, raisedRequest(cwd, raised, warnings), warnings);
  } catch (err) {
    throw carrying(err, warnings);
  }
}

module.exports = { LEDGER_USAGE, WRITE_VERBS: Object.keys(WRITES), writeLedger, ledgerMessage, verbUsage, writePlaced, landRaised, callLogged, staleness };

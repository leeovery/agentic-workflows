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
//   The session is the conversation's own (CLAUDE_CODE_SESSION_ID); a write
//   without one is refused.
// - What: the content comes as one JSON object on stdin, the links as flags.
//   Content never carries a link, nor anything the engine gives. A link names
//   an entry by a prefix of its id, resolved as git resolves a short hash
//   (5.3.5), and must name what it links to: a decision answers a question
//   (5.5.1), and only a question moves or merges. An entry is replaced or
//   held only while current — a replacement names one entry, its siblings
//   untouched (5.3.13) — a question moves or merges only while current, and
//   a merge goes into a current decision.
// - Whose: a decision answers, and a move or a merge takes, a question of the
//   write's own unit alone, while another unit's entry may be replaced
//   (5.6.1) or held. Before the spec, an entry of the unit is written on only
//   from the topic it stands on, a question standing where it was last
//   moved: another topic's change goes to it by message (5.6.9, 10.2.2).
// - How each relates: a question moves to another topic of its unit (5.3.3);
//   a merge's duplicate is a current decision answering the question merged,
//   other than the one it goes into (5.5.4, 5.5.5); a held entry relies on
//   what the replacement replaced, or on an earlier entry of its chain
//   (5.6.10); a replacement's cause is never what it replaces, a new fact's
//   being a finding and another topic's a decision on a topic other than
//   the replaced entry's (5.3.8).
// - What the engine sets: a replacement's kind, the question a replaced
//   decision answers or a replaced question is part of, and, where the
//   content leaves it out, the replaced entry's product-wide mark (5.2.5). A
//   decision lands unchecked, as nothing has judged whether it holds one
//   rule (5.5.2).
// - When: all that the request alone settles is refused before the writer
//   lock — its argv, its place, its content in the shape of the kind it
//   writes, a replacement reading that kind from the ledger — so a malformed
//   write never waits on a peer. Under the lock the ledger is folded
//   (ledger-fold.cjs), every link resolved and its currency and relations
//   checked, the event appended and the ledger committed, so no peer's write
//   lands between the fold and the append. The answer is made once the lock
//   is released: the entry's short id, the commit, and as warnings a push
//   that failed and what a landing finished on the way said, which a refusal
//   carries too.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { messageOf } = require('../kernel/call.cjs');
const { isObject, workUnitManifestPath, readWorkUnitManifest } = require('../kernel/manifest-io.cjs');
const { VALID_PHASES, WORK_TYPE_PIPELINES } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { appendEntry } = require('./ledger.cjs');
const { LEDGER, HEADER, REASONS, entryKind, eventFields } = require('./ledger-events.cjs');
const { shortId, resolveId } = require('./ledger-ids.cjs');
const { ID_FACTS, foldLedger } = require('./ledger-fold.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { commitStateTail } = require('./commit.cjs');

/** @typedef {import('./ledger-fold.cjs').IdFacts} IdFacts */
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
 * A write verb: the event it appends, the flags it takes, whether it is made
 * from a topic alone, and what it checks of what it is given before the
 * lock, and of the entries its links name under it.
 * @typedef {{
 *   event: string,
 *   flags: Flag[],
 *   fromTopic: boolean,
 *   checkGiven: (at: Address, given: Map<string, string[]>) => void,
 *   checkLinked: (linked: Linked, facts: Map<string, IdFacts>) => void,
 * }} Write
 */

/**
 * Where a write is made: the project's state root, the unit and its
 * manifest, the phase, and the topic, or null at the unit's level.
 * @typedef {{root: string, unit: string, manifest: Record<string, any>, phase: string, topic: string|null}} Address
 */

/**
 * A write as asked, read whole and checked before the lock: the verb, where
 * it is made, the session, each flag's values by field, the kind of entry it
 * writes — null for an event that is no entry — and its content, checked in
 * that kind's shape.
 * @typedef {{verb: string, write: Write, at: Address, session: string, given: Map<string, string[]>, kind: EntryKind|null, content: Record<string, unknown>}} Request
 */

/** The phases a topic exists in: those before the spec (4.11.2). */
const TOPIC_PHASES = Object.freeze(['discovery', 'research', 'experiment', 'discussion', 'investigation']);

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
 * for its refusal, and the test of the cause's facts against the replaced
 * entry's.
 * @type {Readonly<Record<string, {is: string, test: (cause: IdFacts, replaced: IdFacts) => boolean}>>}
 */
const CAUSES = Object.freeze({
  'new-fact': { is: 'a finding', test: (cause) => cause.kind === 'finding' },
  'other-topic': {
    is: 'a decision on a topic other than the replaced entry\'s',
    test: (cause, replaced) => cause.kind === 'decision' && (cause.unit !== replaced.unit || cause.topic !== replaced.topic),
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

/** Links to any number of entries. @param {string} field @param {Names} what @returns {Flag} */
function links(field, what) {
  return { field, shown: '<id>', required: false, many: true, names: what, current: false, owner: null };
}

/** A plain value, naming no entry. @param {string} field @param {string} shown @returns {Flag} */
function plain(field, shown) {
  return { field, shown, required: true, many: false, names: null, current: false, owner: null };
}

/** A write that checks nothing of its own. */
function nothingToCheck() {}

/**
 * @param {string} event @param {Flag[]} flags
 * @param {{fromTopic?: boolean, checkGiven?: Write['checkGiven'], checkLinked?: Write['checkLinked']}} [opts]
 * @returns {Write}
 */
function writeOf(event, flags, { fromTopic = false, checkGiven = nothingToCheck, checkLinked = nothingToCheck } = {}) {
  return { event, flags, fromTopic, checkGiven, checkLinked };
}

/** @type {Readonly<Record<string, Write>>} */
const WRITES = Object.freeze({
  ask: writeOf('asked', [link('part_of', A_QUESTION), links('relies_on', AN_ENTRY)]),
  find: writeOf('found', [links('relies_on', AN_ENTRY)]),
  decide: writeOf('decided', [link('answers', A_QUESTION, { required: true, owner: 'unit' }), links('relies_on', AN_ENTRY)]),
  replace: writeOf('replaced', [
    link('replaces', AN_ENTRY, { required: true, current: true, owner: 'topic' }),
    plain('reason', `<${REASONS.join('|')}>`),
    link('cause', AN_ENTRY),
    links('relies_on', AN_ENTRY),
  ], { checkGiven: checkCauseGiven, checkLinked: checkCause }),
  hold: writeOf('still-holds', [
    link('entry', AN_ENTRY, { required: true, current: true, owner: 'topic' }),
    link('after', A_REPLACEMENT, { required: true }),
  ], { checkLinked: checkHeld }),
  move: writeOf('moved', [link('question', A_QUESTION, { required: true, current: true, owner: 'unit' }), plain('to', '<topic>')], { fromTopic: true, checkGiven: checkDestination }),
  merge: writeOf('merged', [
    link('question', A_QUESTION, { required: true, current: true, owner: 'unit' }),
    link('into', A_DECISION, { required: true, current: true }),
    link('duplicate', A_DECISION, { current: true }),
  ], { checkLinked: checkDuplicate }),
});

/** Every field a flag sets, whichever verb takes it: never content. */
const FLAG_FIELDS = new Set(Object.values(WRITES).flatMap((w) => w.flags.map((flag) => flag.field)));

/** The fields the engine gives an entry, never its content. */
const ENGINE_FIELDS = new Set([...HEADER.map((f) => f.name), 'of', 'unchecked']);

/** The content a write may leave out, and what it takes instead. @type {Readonly<Record<string, unknown>>} */
const DEFAULTS = Object.freeze({ rules_out: [], product_wide: false, sealed: null, alternatives: [], evidence: [], kind: null });

/** @param {Flag} flag */
function flagName(flag) {
  return `--${flag.field.replaceAll('_', '-')}`;
}

/** @param {Flag} flag */
function flagUsage(flag) {
  const shown = `${flagName(flag)} ${flag.shown}${flag.many ? ' …' : ''}`;
  return flag.required ? shown : `[${shown}]`;
}

/** @param {string} verb */
function verbUsage(verb) {
  return [`ledger ${verb} <work-unit>.<phase>${WRITES[verb].fromTopic ? '.<topic>' : '[.<topic>]'}`, ...WRITES[verb].flags.map(flagUsage)].join(' ');
}

/** The write verbs' usage, a line each, its content as JSON on stdin. */
const LEDGER_USAGE = Object.keys(WRITES).map((verb) => `${verbUsage(verb)}   (content as JSON on stdin)`).join('\n');

/**
 * A write's argv read: the dot-path it names, and each flag's values by
 * field, in the order given. Refuses a flag the verb does not take, a flag
 * with no value, a flag given more often than it takes, a missing required
 * flag, and anything but one dot-path.
 * @param {string} verb @param {string[]} args
 * @returns {{dotpath: string, given: Map<string, string[]>}}
 */
function readArgs(verb, args) {
  const { flags } = WRITES[verb];
  const usage = `Usage: engine ${verbUsage(verb)}   (content as JSON on stdin)`;
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
    if (flag === undefined) throw new Error(`ledger ${verb} takes no ${args[i]} — ${usage}`);
    const named = args[i + 1];
    if (named === undefined || named.startsWith('--') || named === '') throw new Error(`ledger ${verb}: ${args[i]} takes ${flag.shown} — ${usage}`);
    /** @type {string[]} */ (given.get(flag.field)).push(named);
    i += 1;
  }
  if (positional.length !== 1) throw new Error(usage);
  for (const flag of flags) {
    const count = /** @type {string[]} */ (given.get(flag.field)).length;
    if (flag.required && count === 0) throw new Error(`ledger ${verb} needs ${flagName(flag)} ${flag.shown} — ${usage}`);
    if (!flag.many && count > 1) throw new Error(`ledger ${verb} takes one ${flagName(flag)} — ${usage}`);
  }
  return { dotpath: positional[0], given };
}

/** The phases a unit is written in: discovery, and its work type's. @param {Record<string, any>} manifest @returns {string[]} */
function phasesOf(manifest) {
  const workType = /** @type {keyof typeof WORK_TYPE_PIPELINES} */ (manifest.work_type);
  return ['discovery', ...(Object.hasOwn(WORK_TYPE_PIPELINES, workType) ? WORK_TYPE_PIPELINES[workType] : [])];
}

/** Whether the unit's manifest holds an item named `topic` in `phase`. @param {Record<string, any>} manifest @param {string} phase @param {string} topic */
function hasItem(manifest, phase, topic) {
  const items = manifest.phases?.[phase]?.items;
  return isObject(items) && Object.hasOwn(items, topic) && isObject(items[topic]);
}

/** Whether the unit has a topic of that name. @param {Address} at @param {string} topic */
function hasTopic(at, topic) {
  return TOPIC_PHASES.some((phase) => hasItem(at.manifest, phase, topic));
}

/**
 * Where a write is made, read from its dot-path. Refuses a path of another
 * shape, a phase that is none, a unit that does not exist, a phase its work
 * type does not have, a topic from the spec on, and a topic with no item in
 * the phase.
 * @param {string} cwd @param {string} verb @param {string} dotpath
 * @returns {Address}
 */
function addressOf(cwd, verb, dotpath) {
  const parts = dotpath.split('.');
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => part === '')) {
    throw new Error(`ledger ${verb}: "${dotpath}" names no place to write — <work-unit>.<phase>.<topic>, or <work-unit>.<phase> at the unit's level`);
  }
  const [unit, phase, topic = null] = parts;
  if (!VALID_PHASES.includes(phase)) throw new Error(`ledger ${verb}: "${phase}" is no phase — one of ${VALID_PHASES.join(', ')}`);
  const root = stateRoot(cwd);
  if (!fs.existsSync(workUnitManifestPath(root, unit))) throw new Error(`ledger ${verb}: there is no work unit "${unit}"`);
  const manifest = readWorkUnitManifest(root, unit);
  const phases = phasesOf(manifest);
  if (!phases.includes(phase)) throw new Error(`ledger ${verb}: ${unit} has no ${phase} phase — its work type, ${manifest.work_type}, has ${phases.join(', ')}`);
  if (topic !== null && !TOPIC_PHASES.includes(phase)) {
    throw new Error(`ledger ${verb}: a topic exists only before the spec, and ${phase} is the unit's — write at ${unit}.${phase}`);
  }
  if (topic !== null && !hasItem(manifest, phase, topic)) throw new Error(`ledger ${verb}: ${unit} has no topic "${topic}" in ${phase}`);
  return { root, unit, manifest, phase, topic };
}

/**
 * Refuse a plain value the event cannot hold: a reason outside the four
 * (5.6.2), a topic that is no text.
 * @param {string} verb @param {Map<string, string[]>} given
 */
function checkValues(verb, given) {
  const { event, flags } = WRITES[verb];
  for (const flag of flags.filter((f) => f.names === null)) {
    const [named] = /** @type {string[]} */ (given.get(flag.field));
    const { type } = /** @type {import('./ledger-events.cjs').Field} */ (eventFields(event).find((f) => f.name === flag.field));
    if (!type.test(named)) throw new Error(`ledger ${verb}: ${flagName(flag)} is ${type.is} — not "${named}"`);
  }
}

/**
 * Refuse a reason that needs a cause given none (5.3.8).
 * @param {Address} _at @param {Map<string, string[]>} given
 */
function checkCauseGiven(_at, given) {
  const [reason] = /** @type {string[]} */ (given.get('reason'));
  if (Object.hasOwn(CAUSES, reason) && /** @type {string[]} */ (given.get('cause')).length === 0) {
    throw new Error(`ledger replace --reason ${reason} needs --cause <id>: ${CAUSES[reason].is}`);
  }
}

/**
 * Refuse a move to the topic it is made from, or to a topic the unit does
 * not have (5.3.3).
 * @param {Address} at @param {Map<string, string[]>} given
 */
function checkDestination(at, given) {
  const [to] = /** @type {string[]} */ (given.get('to'));
  if (to === at.topic) throw new Error(`ledger move: --to names ${to}, the topic it moves from — a question moves to another topic`);
  if (!hasTopic(at, to)) throw new Error(`ledger move: ${at.unit} has no topic "${to}" to move the question to`);
}

/**
 * The content on stdin: one JSON object.
 * @param {string} verb @param {string} stdin
 * @returns {Record<string, unknown>}
 */
function stdinContent(verb, stdin) {
  let content;
  try {
    content = JSON.parse(stdin);
  } catch (err) {
    throw new Error(`ledger ${verb}: the entry's content comes on stdin as a JSON object, and stdin holds no JSON — ${messageOf(err)}`);
  }
  if (!isObject(content)) throw new Error(`ledger ${verb}: the entry's content comes on stdin as a JSON object, not ${JSON.stringify(content)}`);
  return content;
}

/** @param {IdFacts} facts */
function described(facts) {
  return facts.kind === null ? `a ${facts.event} event` : `a ${facts.kind}`;
}

/** Where an entry stands in its unit. @param {IdFacts} facts */
function placeOf(facts) {
  return facts.topic === null ? 'at the unit\'s level' : `on ${facts.topic}`;
}

/** The current entry of the chain `id` starts: the last replacement down it. @param {string} id @param {Map<string, IdFacts>} facts @returns {string} */
function currentOf(id, facts) {
  const by = /** @type {IdFacts} */ (facts.get(id)).replaced_by;
  return by === null ? id : currentOf(by, facts);
}

/** The entries the replacement `id` replaced: the one it names, then each that one replaced, back down its chain. @param {string} id @param {Map<string, IdFacts>} facts @returns {string[]} */
function replacedChain(id, facts) {
  const replaced = /** @type {IdFacts} */ (facts.get(id)).replaces;
  return replaced === null ? [] : [replaced, ...replacedChain(replaced, facts)];
}

/**
 * Why a link whose entries are `owner`'s may not name `named` from `at`, or
 * null where it may: another unit's, for a link of the unit's own; before
 * the spec, one of the unit's on another topic than the write's (5.6.9).
 * @param {Owner} owner @param {Address} at @param {IdFacts} named
 * @returns {string|null}
 */
function strayed(owner, at, named) {
  if (owner === null) return null;
  if (named.unit !== at.unit) return owner === 'unit' ? `of ${named.unit} — it must be ${at.unit}'s own` : null;
  if (!TOPIC_PHASES.includes(at.phase) || named.topic === at.topic) return null;
  return `${placeOf(named)} — before the spec a topic writes on its own entries alone, and another topic's change goes to it by message`;
}

/**
 * The id a link's prefix names, checked against what the link must name: an
 * entry already replaced is refused for a link that must be current, naming
 * the current one, and an entry the link may not name from where the write
 * is made is refused, saying where it stands.
 * @param {string} verb @param {Address} at @param {Flag} flag @param {string} prefix @param {Map<string, IdFacts>} facts
 * @returns {string}
 */
function resolveLink(verb, at, flag, prefix, facts) {
  const where = `ledger ${verb} ${flagName(flag)}`;
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
  if (flag.current && named.replaced_by !== null) {
    throw new Error(`${where} names ${short(id)}, which ${short(named.replaced_by)} replaced — the current one is ${short(currentOf(id, facts))}`);
  }
  const why = strayed(flag.owner, at, named);
  if (why !== null) throw new Error(`${where} names ${short(id)}, ${described(named)} ${why}`);
  return id;
}

/**
 * Each flag's field as the event holds it: a link's prefixes resolved to
 * ids and checked, and a value as given.
 * @param {Request} request @param {Map<string, IdFacts>} facts
 * @returns {Linked}
 */
function linkFields(request, facts) {
  const { verb, write, at, given } = request;
  /** @type {Linked} */
  const fields = {};
  for (const flag of write.flags) {
    const values = /** @type {string[]} */ (given.get(flag.field));
    const resolved = flag.names === null ? values : [...new Set(values.map((prefix) => resolveLink(verb, at, flag, prefix, facts)))];
    fields[flag.field] = flag.many ? resolved : resolved[0] ?? null;
  }
  return fields;
}

/**
 * Refuse a replacement's cause that is what it replaces, or that is not what
 * its reason needs (5.3.8).
 * @param {Linked} linked @param {Map<string, IdFacts>} facts
 */
function checkCause(linked, facts) {
  if (linked.cause === null) return;
  const [cause, replaces, reason] = /** @type {string[]} */ ([linked.cause, linked.replaces, linked.reason]);
  const where = `ledger replace --cause names ${shortId(cause, facts.keys())}`;
  if (cause === replaces) throw new Error(`${where}, the entry it replaces — a cause is what made the change`);
  if (!Object.hasOwn(CAUSES, reason)) return;
  const named = /** @type {IdFacts} */ (facts.get(cause));
  if (!CAUSES[reason].test(named, /** @type {IdFacts} */ (facts.get(replaces)))) {
    throw new Error(`${where}, ${described(named)} ${placeOf(named)} — --reason ${reason} needs ${CAUSES[reason].is}`);
  }
}

/**
 * Refuse a confirmation of an entry that relies on nothing the replacement
 * replaced, down its chain (5.6.10).
 * @param {Linked} linked @param {Map<string, IdFacts>} facts
 */
function checkHeld(linked, facts) {
  const [entry, after] = /** @type {string[]} */ ([linked.entry, linked.after]);
  const chain = replacedChain(after, facts);
  if (/** @type {IdFacts} */ (facts.get(entry)).relies_on.some((id) => chain.includes(id))) return;
  const short = (/** @type {string} */ id) => shortId(id, facts.keys());
  throw new Error(`ledger hold --entry names ${short(entry)}, which relies on nothing ${short(after)} replaced — it holds an entry relying on what the replacement replaced, or on an earlier entry of its chain`);
}

/**
 * Refuse a merge's duplicate that is the entry it goes into, or that answers
 * another question than the one merged (5.5.4, 5.5.5).
 * @param {Linked} linked @param {Map<string, IdFacts>} facts
 */
function checkDuplicate(linked, facts) {
  if (linked.duplicate === null) return;
  const [question, into, duplicate] = /** @type {string[]} */ ([linked.question, linked.into, linked.duplicate]);
  const short = (/** @type {string} */ id) => shortId(id, facts.keys());
  const where = `ledger merge --duplicate names ${short(duplicate)}`;
  if (duplicate === into) throw new Error(`${where}, the decision --into names — a duplicate is another entry`);
  const answers = /** @type {string} */ (/** @type {IdFacts} */ (facts.get(duplicate)).answers);
  if (answers !== question) throw new Error(`${where}, which answers ${short(answers)} — a duplicate answers the question merged, ${short(question)}`);
}

/**
 * What follows from a replacement's link to what it replaces: the kind it
 * stands for, and the question a decision answers or a question is part of.
 * Nothing for any other write.
 * @param {Write} write @param {Linked} linked @param {Map<string, IdFacts>} facts
 * @returns {Record<string, unknown>}
 */
function followed(write, linked, facts) {
  if (write.event !== 'replaced') return {};
  const replaced = /** @type {IdFacts} */ (facts.get(/** @type {string} */ (linked.replaces)));
  const of = replaced.kind;
  if (of === 'decision') return { of, answers: replaced.answers };
  if (of === 'question') return { of, part_of: replaced.part_of };
  return { of };
}

/**
 * The entry a replacement replaces, read from the ledger before the lock:
 * its facts, its link checked as the lock checks it again.
 * @param {string} verb @param {Address} at @param {Map<string, string[]>} given @param {string[]} warnings
 * @returns {IdFacts}
 */
function replacedEntry(verb, at, given, warnings) {
  const facts = foldLedger(at.root, ID_FACTS, warnings);
  const flag = /** @type {Flag} */ (WRITES[verb].flags.find((f) => f.field === 'replaces'));
  const id = resolveLink(verb, at, flag, /** @type {string[]} */ (given.get('replaces'))[0], facts);
  return /** @type {IdFacts} */ (facts.get(id));
}

/**
 * The content the write's event holds, from what stdin gave: for a
 * replacement in the shape of the entry it replaces, each field typed as its
 * schema names, one left out taking its default — for a replacement's
 * product-wide mark, the replaced entry's. Refuses a link, a field the
 * engine gives, a field the event does not hold, and a field it needs that
 * is missing.
 * @param {string} verb @param {Write} write @param {Record<string, unknown>} given @param {IdFacts|null} replaced
 * @returns {Record<string, unknown>}
 */
function contentFields(verb, write, given, replaced) {
  const fields = eventFields(write.event, replaced === null ? null : replaced.kind).filter((f) => !FLAG_FIELDS.has(f.name) && !ENGINE_FIELDS.has(f.name));
  const defaults = replaced === null || replaced.product_wide === null ? DEFAULTS : { ...DEFAULTS, product_wide: replaced.product_wide };
  for (const key of Object.keys(given)) {
    if (FLAG_FIELDS.has(key)) {
      const flag = write.flags.find((f) => f.field === key);
      throw new Error(`ledger ${verb}: the content carries ${key}, a link — a link is given as a flag${flag ? ` (${flagName(flag)})` : ''}, never in the content`);
    }
    if (ENGINE_FIELDS.has(key)) throw new Error(`ledger ${verb}: the content carries ${key}, which the engine gives`);
    if (!fields.some((f) => f.name === key)) {
      throw new Error(`ledger ${verb}: the content has no field ${key} — it holds ${fields.map((f) => f.name).join(', ')}`);
    }
  }
  /** @type {Record<string, unknown>} */
  const content = {};
  for (const { name, type } of fields) {
    if (!Object.hasOwn(given, name)) {
      if (!Object.hasOwn(defaults, name)) throw new Error(`ledger ${verb}: the content needs ${name}`);
      content[name] = structuredClone(defaults[name]);
    } else if (!type.test(given[name])) {
      throw new Error(`ledger ${verb}: the content's ${name} is not ${type.is}`);
    } else {
      content[name] = given[name];
    }
  }
  return content;
}

/**
 * A write as asked, read whole and checked before the lock: its argv, where
 * it is made, the session, and its content in the shape of the kind it
 * writes, a replacement reading the kind it replaces from the ledger.
 * Refuses argv the verb does not take, a place it cannot write, no session,
 * a value its event cannot hold, stdin holding no JSON object, and content
 * the kind does not hold.
 * @param {string} cwd @param {string} verb @param {string[]} args @param {() => string} stdin @param {string[]} warnings
 * @returns {Request}
 */
function requestOf(cwd, verb, args, stdin, warnings) {
  if (!Object.hasOwn(WRITES, verb)) throw new Error(`Usage: engine ledger <${Object.keys(WRITES).join('|')}> …\n${LEDGER_USAGE}`);
  const write = WRITES[verb];
  const { dotpath, given } = readArgs(verb, args);
  const at = addressOf(cwd, verb, dotpath);
  if (write.fromTopic && at.topic === null) {
    throw new Error(TOPIC_PHASES.includes(at.phase)
      ? `ledger ${verb}: a question moves from a topic — name it: ${at.unit}.${at.phase}.<topic>`
      : `ledger ${verb}: a question moves from a topic, and ${at.phase} has none — a topic exists only before the spec`);
  }
  const session = process.env.CLAUDE_CODE_SESSION_ID;
  if (!session) throw new Error(`ledger ${verb}: no session to tag the entry with — CLAUDE_CODE_SESSION_ID is not set`);
  checkValues(verb, given);
  write.checkGiven(at, given);
  const content = stdinContent(verb, stdin());
  const replaced = write.event === 'replaced' ? replacedEntry(verb, at, given, warnings) : null;
  return {
    verb, write, at, session, given,
    kind: replaced === null ? entryKind({ event: write.event }) : replaced.kind,
    content: contentFields(verb, write, content, replaced),
  };
}

/**
 * The event a request appends, its links resolved and checked against the
 * ledger's facts: its tags, its content, its links, what follows from them,
 * and what the engine gives.
 * @param {Request} request @param {Map<string, IdFacts>} facts
 * @returns {Record<string, unknown>}
 */
function eventOf(request, facts) {
  const { write, at, session, kind, content } = request;
  const linked = linkFields(request, facts);
  write.checkLinked(linked, facts);
  return {
    event: write.event, unit: at.unit, topic: at.topic, phase: at.phase, session,
    ...content, ...linked, ...followed(write, linked, facts), ...(kind === 'decision' ? { unchecked: true } : {}),
  };
}

/**
 * Under the writer lock: the ledger folded, the event appended, and the
 * ledger committed to the state branch, a commit git refuses a warning.
 * Answers the entry as written and its short id.
 * @param {string} cwd @param {Request} request @param {string[]} warnings
 * @returns {{entry: Record<string, unknown>, id: string, outcome: {committed: string|null, failed: boolean}}}
 */
function land(cwd, request, warnings) {
  const { at, write } = request;
  const facts = foldLedger(at.root, ID_FACTS, warnings);
  const entry = appendEntry(at.root, eventOf(request, facts), warnings);
  const id = /** @type {string} */ (entry.id);
  const message = `ledger(${at.unit}): ${write.event} ${id}${at.topic === null ? '' : ` in ${at.topic}`}`;
  return { entry, id: shortId(id, facts.keys()), outcome: commitStateTail(cwd, LEDGER, message, warnings) };
}

/**
 * A refusal carrying, beside its own payload, what a landing finished on the
 * way said.
 * @param {unknown} err @param {string[]} warnings
 * @returns {unknown}
 */
function carrying(err, warnings) {
  if (warnings.length === 0 || !(err instanceof Error)) return err;
  const { payload } = /** @type {Error & {payload?: object}} */ (err);
  return Object.assign(err, { payload: { ...payload, warnings } });
}

/**
 * `ledger <verb>`: one event appended and committed. Answers the entry's
 * short id, the commit, and any warnings; a commit git refused is pending,
 * and the next write's commit takes the ledger whole.
 * @param {string} cwd @param {string} verb @param {string[]} args @param {() => string} stdin
 * @returns {{id: string, committed: string|null, note?: string, warnings?: string[]}}
 */
function writeLedger(cwd, verb, args, stdin) {
  /** @type {string[]} */
  const warnings = [];
  try {
    const request = requestOf(cwd, verb, args, stdin, warnings);
    const { id, outcome } = withStateLock(request.at.root, () => land(cwd, request, warnings));
    /** @type {{id: string, committed: string|null, note?: string, warnings?: string[]}} */
    const result = { id, committed: outcome.committed };
    if (outcome.failed) result.note = 'commit pending — the entry is in the ledger, and the next ledger write commits it';
    if (warnings.length > 0) result.warnings = warnings;
    return result;
  } catch (err) {
    throw carrying(err, warnings);
  }
}

module.exports = { LEDGER_USAGE, writeLedger };

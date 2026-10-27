'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's write verbs (6.1.4) — ask, find, decide, replace,
// hold, move and merge — each appending one event through the stream
// (ledger.cjs) and committing the ledger to the state branch.
//
// - Where: the engine's dot-path, `<unit>.<phase>.<topic>`, or
//   `<unit>.<phase>` for an entry made at the unit's level, which carries no
//   topic (5.2.3). The unit must exist, the phase be one, and a topic hold an
//   item in that phase. The session is the conversation's own
//   (CLAUDE_CODE_SESSION_ID); a write without one is refused.
// - What: the content comes as one JSON object on stdin, the links as flags.
//   Content never carries a link, nor anything the engine gives. A link names
//   an entry by a prefix of its id, resolved as git resolves a short hash
//   (5.3.5), and must name what it links to: a decision answers a question
//   (5.5.1), only a question moves or merges, and an entry is replaced only
//   while current — a replacement names one entry, its siblings untouched
//   (5.3.13). What follows from a link the engine sets itself: a
//   replacement's kind, and the question a replaced decision answers or a
//   replaced question is part of. A decision lands unchecked, as nothing has
//   judged whether it holds one rule (5.5.2).
// - When: the request is read whole before the writer lock is taken. Under
//   it the ledger is folded (ledger-fold.cjs), the links resolved, the event
//   appended and the ledger committed, so no peer's write lands between the
//   fold and the append; the answer is made once the lock is released: the
//   entry's short id, the commit, and as warnings a push that failed and what
//   a landing finished on the way said.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { messageOf } = require('../kernel/call.cjs');
const { workUnitManifestPath, readWorkUnitManifest } = require('../kernel/manifest-io.cjs');
const { VALID_PHASES } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { appendEntry } = require('./ledger.cjs');
const { LEDGER, HEADER, REASONS, eventFields } = require('./ledger-events.cjs');
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
 * A flag a write takes: the event's field it sets, how its value is shown in
 * the usage, whether it must be given and whether it may be given more than
 * once; and for a link, what it must name and whether that must be current.
 * @typedef {{field: string, shown: string, required: boolean, many: boolean, names: Names|null, current: boolean}} Flag
 */

/**
 * A write verb: the event it appends, the flags it takes, and whether it is
 * made from a topic alone.
 * @typedef {{event: string, flags: Flag[], fromTopic: boolean}} Write
 */

/**
 * Where a write is made: the unit and its manifest, the phase, and the
 * topic, or null at the unit's level.
 * @typedef {{unit: string, manifest: Record<string, any>, phase: string, topic: string|null}} Address
 */

/**
 * A write as asked, read before the lock: the verb, where it is made, the
 * session, each flag's values by field, and the content.
 * @typedef {{verb: string, write: Write, at: Address, session: string, given: Map<string, string[]>, content: Record<string, unknown>}} Request
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
 * A link to one entry.
 * @param {string} field @param {Names} what
 * @param {{required?: boolean, current?: boolean}} [opts]
 * @returns {Flag}
 */
function link(field, what, { required = false, current = false } = {}) {
  return { field, shown: '<id>', required, many: false, names: what, current };
}

/** Links to any number of entries. @param {string} field @param {Names} what @returns {Flag} */
function links(field, what) {
  return { field, shown: '<id>', required: false, many: true, names: what, current: false };
}

/** A plain value, naming no entry. @param {string} field @param {string} shown @returns {Flag} */
function plain(field, shown) {
  return { field, shown, required: true, many: false, names: null, current: false };
}

/** @param {string} event @param {Flag[]} flags @returns {Write} */
function writeOf(event, flags, fromTopic = false) {
  return { event, flags, fromTopic };
}

/** @type {Readonly<Record<string, Write>>} */
const WRITES = Object.freeze({
  ask: writeOf('asked', [link('part_of', A_QUESTION), links('relies_on', AN_ENTRY)]),
  find: writeOf('found', [links('relies_on', AN_ENTRY)]),
  decide: writeOf('decided', [link('answers', A_QUESTION, { required: true }), links('relies_on', AN_ENTRY)]),
  replace: writeOf('replaced', [
    link('replaces', AN_ENTRY, { required: true, current: true }),
    plain('reason', `<${REASONS.join('|')}>`),
    link('cause', AN_ENTRY),
    links('relies_on', AN_ENTRY),
  ]),
  hold: writeOf('still-holds', [link('entry', AN_ENTRY, { required: true }), link('after', A_REPLACEMENT, { required: true })]),
  move: writeOf('moved', [link('question', A_QUESTION, { required: true }), plain('to', '<topic>')], true),
  merge: writeOf('merged', [link('question', A_QUESTION, { required: true }), link('into', A_DECISION, { required: true }), link('duplicate', A_DECISION)]),
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

/** @param {unknown} value @returns {value is Record<string, any>} */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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

/**
 * Where a write is made, read from its dot-path. Refuses a path of another
 * shape, a phase that is none, a unit that does not exist, and a topic with
 * no item in the phase.
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
  if (topic !== null && !isObject(manifest.phases?.[phase]?.items?.[topic])) {
    throw new Error(`ledger ${verb}: ${unit} has no topic "${topic}" in ${phase}`);
  }
  return { unit, manifest, phase, topic };
}

/**
 * Whether the unit has a topic of that name, in any phase.
 * @param {Address} at @param {string} topic
 */
function hasTopic(at, topic) {
  return Object.values(at.manifest.phases ?? {}).some((phase) => isObject(phase?.items?.[topic]));
}

/**
 * Refuse a value flag the event cannot hold: a reason outside the four
 * (5.6.2), and a topic the unit does not have to move a question to.
 * @param {string} verb @param {Address} at @param {Map<string, string[]>} given
 */
function checkValues(verb, at, given) {
  const { event, flags } = WRITES[verb];
  for (const flag of flags.filter((f) => f.names === null)) {
    const [named] = /** @type {string[]} */ (given.get(flag.field));
    const { type } = /** @type {import('./ledger-events.cjs').Field} */ (eventFields(event).find((f) => f.name === flag.field));
    if (!type.test(named)) throw new Error(`ledger ${verb}: ${flagName(flag)} is ${type.is} — not "${named}"`);
    if (flag.field === 'to' && !hasTopic(at, named)) throw new Error(`ledger ${verb}: ${at.unit} has no topic "${named}" to move the question to`);
  }
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

/**
 * A write as asked, read whole before the lock: its argv, where it is made,
 * the session, and its content. Refuses argv the verb does not take, a place
 * it cannot write, no session, a value its event cannot hold, and stdin
 * holding no JSON object.
 * @param {string} cwd @param {string} verb @param {string[]} args @param {() => string} stdin
 * @returns {Request}
 */
function requestOf(cwd, verb, args, stdin) {
  if (!Object.hasOwn(WRITES, verb)) throw new Error(`Usage: engine ledger <${Object.keys(WRITES).join('|')}> …\n${LEDGER_USAGE}`);
  const { dotpath, given } = readArgs(verb, args);
  const at = addressOf(cwd, verb, dotpath);
  if (WRITES[verb].fromTopic && at.topic === null) {
    throw new Error(`ledger ${verb}: a question moves from a topic — name it: ${at.unit}.${at.phase}.<topic>`);
  }
  const session = process.env.CLAUDE_CODE_SESSION_ID;
  if (!session) throw new Error(`ledger ${verb}: no session to tag the entry with — CLAUDE_CODE_SESSION_ID is not set`);
  checkValues(verb, at, given);
  return { verb, write: WRITES[verb], at, session, given, content: stdinContent(verb, stdin()) };
}

/** @param {IdFacts} facts */
function described(facts) {
  return facts.kind === null ? `a ${facts.event} event` : `a ${facts.kind}`;
}

/** The current entry of the chain `id` starts: the last replacement down it. @param {string} id @param {Map<string, IdFacts>} facts @returns {string} */
function currentOf(id, facts) {
  const by = /** @type {IdFacts} */ (facts.get(id)).replaced_by;
  return by === null ? id : currentOf(by, facts);
}

/**
 * The id a link's prefix names, checked against what the link must name: an
 * entry already replaced is refused for a link that must be current, naming
 * the current one.
 * @param {Request} request @param {Flag} flag @param {string} prefix @param {Map<string, IdFacts>} facts
 * @returns {string}
 */
function resolveLink(request, flag, prefix, facts) {
  const at = `ledger ${request.verb} ${flagName(flag)}`;
  const short = (/** @type {string} */ id) => shortId(id, facts.keys());
  let id;
  try {
    id = resolveId(prefix, facts.keys());
  } catch (err) {
    throw new Error(`${at}: ${messageOf(err)}`);
  }
  const named = /** @type {IdFacts} */ (facts.get(id));
  const what = /** @type {Names} */ (flag.names);
  if (!what.test(named)) throw new Error(`${at} names ${short(id)}, ${described(named)} — it must name ${what.is}`);
  if (flag.current && named.replaced_by !== null) {
    throw new Error(`${at} names ${short(id)}, which ${short(named.replaced_by)} replaced — replace the current one, ${short(currentOf(id, facts))}`);
  }
  return id;
}

/**
 * Each flag's field as the event holds it: a link's prefixes resolved to
 * ids — a list, one id, or null where an optional one is not given — and a
 * value as given.
 * @param {Request} request @param {Map<string, IdFacts>} facts
 * @returns {Record<string, unknown>}
 */
function linkFields(request, facts) {
  /** @type {Record<string, unknown>} */
  const fields = {};
  for (const flag of request.write.flags) {
    const given = /** @type {string[]} */ (request.given.get(flag.field));
    const resolved = flag.names === null ? given : [...new Set(given.map((prefix) => resolveLink(request, flag, prefix, facts)))];
    fields[flag.field] = flag.many ? resolved : resolved[0] ?? null;
  }
  return fields;
}

/**
 * What follows from a replacement's link to what it replaces: the kind it
 * stands for, and the question a decision answers or a question is part of.
 * Nothing for any other write.
 * @param {Write} write @param {Record<string, unknown>} linked @param {Map<string, IdFacts>} facts
 * @returns {{of: EntryKind|null, fields: Record<string, unknown>}}
 */
function followed(write, linked, facts) {
  if (write.event !== 'replaced') return { of: null, fields: {} };
  const replaced = /** @type {IdFacts} */ (facts.get(/** @type {string} */ (linked.replaces)));
  const of = /** @type {EntryKind} */ (replaced.kind);
  if (of === 'decision') return { of, fields: { of, answers: replaced.answers } };
  if (of === 'question') return { of, fields: { of, part_of: replaced.part_of } };
  return { of, fields: { of } };
}

/**
 * The content an event of `of`'s kind holds, from what stdin gave: each
 * field typed as its schema names, one left out taking its default. Refuses
 * a link, a field the engine gives, a field the event does not hold, and a
 * field it needs that is missing.
 * @param {Request} request @param {EntryKind|null} of
 * @returns {Record<string, unknown>}
 */
function contentFields(request, of) {
  const { verb, write, content: given } = request;
  const fields = eventFields(write.event, of).filter((f) => !FLAG_FIELDS.has(f.name) && !ENGINE_FIELDS.has(f.name));
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
      if (!Object.hasOwn(DEFAULTS, name)) throw new Error(`ledger ${verb}: the content needs ${name}`);
      content[name] = structuredClone(DEFAULTS[name]);
    } else if (!type.test(given[name])) {
      throw new Error(`ledger ${verb}: the content's ${name} is not ${type.is}`);
    } else {
      content[name] = given[name];
    }
  }
  return content;
}

/**
 * The event a request appends, its links resolved against the ledger's
 * facts: its tags, its content, its links, what follows from them, and what
 * the engine gives.
 * @param {Request} request @param {Map<string, IdFacts>} facts
 * @returns {Record<string, unknown>}
 */
function eventOf(request, facts) {
  const { write, at, session } = request;
  const linked = linkFields(request, facts);
  const { of, fields: follows } = followed(write, linked, facts);
  const unchecked = eventFields(write.event, of).some((f) => f.name === 'unchecked') ? { unchecked: true } : {};
  return {
    event: write.event, unit: at.unit, topic: at.topic, phase: at.phase, session,
    ...contentFields(request, of), ...linked, ...follows, ...unchecked,
  };
}

/**
 * Under the writer lock: the ledger folded, the event appended, and the
 * ledger committed to the state branch, a commit git refuses a warning.
 * @param {string} cwd @param {string} root @param {Request} request @param {string[]} warnings
 * @returns {{id: string, outcome: {committed: string|null, failed: boolean}}}
 */
function land(cwd, root, request, warnings) {
  const facts = foldLedger(root, ID_FACTS, warnings);
  const entry = appendEntry(root, eventOf(request, facts), warnings);
  const id = /** @type {string} */ (entry.id);
  const { at, write } = request;
  const message = `ledger(${at.unit}): ${write.event} ${id}${at.topic === null ? '' : ` in ${at.topic}`}`;
  return { id: shortId(id, facts.keys()), outcome: commitStateTail(cwd, LEDGER, message, warnings) };
}

/**
 * `ledger <verb>`: one event appended and committed. Answers the entry's
 * short id, the commit, and any warnings; a commit git refused is pending,
 * and the next write's commit takes the ledger whole.
 * @param {string} cwd @param {string} verb @param {string[]} args @param {() => string} stdin
 * @returns {{id: string, committed: string|null, note?: string, warnings?: string[]}}
 */
function writeLedger(cwd, verb, args, stdin) {
  const request = requestOf(cwd, verb, args, stdin);
  const root = stateRoot(cwd);
  /** @type {string[]} */
  const warnings = [];
  const { id, outcome } = withStateLock(root, () => land(cwd, root, request, warnings));
  /** @type {{id: string, committed: string|null, note?: string, warnings?: string[]}} */
  const result = { id, committed: outcome.committed };
  if (outcome.failed) result.note = 'commit pending — the entry is in the ledger, and the next ledger write commits it';
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}

module.exports = { LEDGER_USAGE, writeLedger };

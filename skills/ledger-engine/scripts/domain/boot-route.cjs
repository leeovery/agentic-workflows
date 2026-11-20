'use strict';

// ---------------------------------------------------------------------------
// Domain ring: where the start goes once boot has run (18.2.14, 18.2.15,
// 22.1.6, 22.2.1) — one entry, the person's bare command and Claude's
// invocation alike, the engine choosing where it goes from the person's
// words, never the prose from who invoked it.
//
// - No words, the bare command, go to the start menu.
// - Words naming one piece of work in progress, and nothing more, go into
//   it as the start menu's number would: a unit where it stands (`handoff
//   unit`, unit-handoff.cjs), an epic's topic into the phase its topics are
//   talked through (`handoff topic`, handoff.cjs). The move is the handoff
//   table's, checked and composed as any other, and invoked in this
//   conversation with nothing cleared, so what the person just said stays
//   with the work.
// - Words asking to carry on that name nothing — "carry on", "pick up
//   where we left off" — name all the work in progress: one unit goes into
//   it, several to the pick in the start menu's order.
// - Words naming work among other words, several pieces of it, or a unit
//   that has closed go to the pick, `render work-pick`: a row for each
//   piece, and one for something new. A row's next is its move; a closed
//   unit's, the unit in manage, where it is brought back, its back the pick
//   again. The pick carries Start's move beside it, `start`, which talk
//   about the product that names work takes instead (8.2.17): it is never
//   picked between.
// - Words naming nothing go to Start's type call: discovery, for a piece of
//   work of no kind yet, the words held by the conversation.
//
// A piece of work is named by its name, or the title a rename gave a topic,
// read as words — case, hyphens and punctuation aside — standing together
// in the words given: a unit in progress whose move composes; a topic of an
// epic in progress, the epic's move standing for the topic's where that
// refuses (a decided topic, say); and a unit completed or cancelled. A
// naming the words hold inside another's is the other's: an epic named
// beside its topic names the topic. Named by the same words, a unit in
// progress wins over a topic — its own, as a pivot's first topic carries
// the epic's name, or another epic's, which naming that epic beside it
// reaches. The words a person says around a name to go there — "I'd like
// to carry on with", "what's next on", "the feature" — carry no work of
// their own (`CONNECTIVE`); any other word left over is more than the
// naming, and the pick asks.
//
// The setup gates due come with it, in the order start works them: the
// migration review, the stop at an older Claude Code and the knowledge gate
// on every entry — where this machine holds a valid knowledge
// configuration, the project adopting it, `knowledge-adopt`, with no gate
// (22.2.1); the rest on the bare command alone, the one-time offers
// waiting for it, but the brownfield read where this boot started a lost
// state again, which the person's yes asked for (`gatesDue`).
// ---------------------------------------------------------------------------

const { loadAllManifests } = require('./reads.cjs');
const { resolveHandoff, topicHandoff } = require('./handoff.cjs');
const { unitHandoff } = require('./unit-handoff.cjs');
const { progressOf, progressWords } = require('./progress.cjs');
const { titlecase } = require('./conventions.cjs');
const { topicTitles, goesBy, topicTitle } = require('./derivations.cjs');
const { startMenuRead } = require('./start-menu.cjs');
const { listed } = require('./projections/start-menu.cjs');

/** @typedef {import('./handoff.cjs').Handoff} Handoff */
/** @typedef {import('./projections/surfaces.cjs').Next} Next */
/** @typedef {import('./projections/surfaces.cjs').LabelParts} LabelParts */

/** The words that go with a name to go there, and carry no work of their own (the header's). */
const CONNECTIVE = new Set([
  'a', 'an', 'the', 'this', 'that', 'my', 'our', 'it', 'to', 'into', 'onto', 'on', 'in', 'at', 'with', 'of', 'for', 'about', 'and', 'so', 'then',
  'i', 'we', 'me', 'us', 'you', 'let', 'lets', 's', 'd', 'll', 'm', 're', 'please', 'now', 'again', 'ok', 'okay',
  'can', 'could', 'would', 'shall', 'should', 'do', 'want', 'like', 'is', 'are', 'what', 'how', 'where', 'next', 'step', 'steps',
  'continue', 'carry', 'resume', 'open', 'go', 'get', 'back', 'pick', 'up', 'left', 'off', 'keep', 'going', 'look', 'work', 'working',
  'start', 'finish', 'discuss', 'talk',
  'feature', 'epic', 'bugfix', 'quickfix', 'topic', 'discovery', 'discussion', 'investigation', 'specification', 'spec', 'build', 'review',
]);

/** The pick's surface. */
const PICK = 'work-pick';

/** The statuses a unit has closed at. */
const CLOSED = Object.freeze(['completed', 'cancelled']);

/**
 * A piece of work the words may name: a unit or an epic's topic in
 * progress, and the move into it; or a unit closed as `closed`, which the
 * pick opens in manage.
 * @typedef {{unit: string, topic?: string, closed?: undefined, next: Next} | {unit: string, topic?: undefined, closed: string}} Piece
 */

/** A piece, the names it goes by and, for a topic, its epic's, each as words. @typedef {{piece: Piece, names: string[][], epic: string[]}} Candidate */

/** A piece the words name, where its naming starts, the places of every word it takes, and whether its own name named it, not a topic's. @typedef {{piece: Piece, at: number, taken: Set<number>, own: boolean}} Naming */

/** Where the words send the start: Start's type call with them, or into a piece of work. @typedef {({kind: 'start', words: string} | {kind: 'unit', unit: string, topic?: string}) & {next: Next}} Route */

/** Where the start goes (the header's). @typedef {{go: 'menu'} | {go: 'route', route: Route} | {go: 'pick', pick: {surface: string, args: string[], start: Next}}} Entry */

/** A setup gate start works (22.2.1), by the name boot's `gates` gives it. @typedef {'migration-review'|'claude-code-floor'|'knowledge-adopt'|'knowledge'|'mod-notice'|'effort'|'walkthrough'|'session-labels'|'brownfield'|'github-rule'} Gate */

/** Text read as words: lowercase, split at anything but a letter or a digit. @param {string} text @returns {string[]} */
const wordsOf = (text) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** A move invoked in this conversation, nothing cleared: none of these moves carries an argument with a space in it. @param {Handoff} move @returns {Next} */
const invoked = (move) => ({ kind: 'invoke', skill: move.skill, args: move.args === '' ? [] : move.args.split(' ') });

/** Start's type call: discovery, for a piece of work of no kind yet. @param {string} cwd @returns {Next} */
const toStart = (cwd) => invoked(resolveHandoff(cwd, 'ledger-discovery', ['start', 'none']));

/** A closed unit in manage, opened from the pick over `matches`, which its back draws again. @param {string} unit @param {string} matches @returns {Next} */
const toManage = (unit, matches) => ({ kind: 'engine', argv: ['render', 'manage-unit', unit, '--from', 'pick', '--matches', matches] });

/** The move `compose` makes, or null where it refuses. @param {() => Handoff} compose @returns {Handoff|null} */
function composed(compose) {
  try {
    return compose();
  } catch {
    return null;
  }
}

/**
 * An epic's topics as pieces (the header's): each into its phase, or the
 * epic's own piece, where it has one, where that refuses.
 * @param {string} cwd @param {Record<string, any>} manifest @param {Piece|null} epic @returns {Candidate[]}
 */
function topicsOf(cwd, manifest, epic) {
  const unit = manifest.name;
  const titles = topicTitles(manifest);
  return Object.keys(manifest.phases?.discovery?.items ?? {}).flatMap((topic) => {
    const into = composed(() => topicHandoff(cwd, [unit, topic]));
    const piece = into === null ? epic : { unit, topic, next: invoked(into) };
    return piece === null ? [] : [{ piece, names: [wordsOf(topic), wordsOf(goesBy(titles, topic))], epic: wordsOf(unit) }];
  });
}

/** Each piece of work the words could name (the header's). @param {string} cwd @returns {Candidate[]} */
function piecesIn(cwd) {
  return loadAllManifests(cwd).flatMap(/** @returns {Candidate[]} */ (manifest) => {
    const unit = manifest.name;
    const names = [wordsOf(unit)];
    if (CLOSED.includes(manifest.status)) return [{ piece: { unit, closed: manifest.status }, names, epic: [] }];
    const move = composed(() => unitHandoff(cwd, [unit]));
    const own = move === null ? null : { unit, next: invoked(move) };
    return [...(own === null ? [] : [{ piece: own, names, epic: [] }]), ...(manifest.work_type === 'epic' ? topicsOf(cwd, manifest, own) : [])];
  });
}

/** Where `name`'s words first stand together in `words`, each by its place; none where they never do. @param {string[]} words @param {string[]} name @returns {number[]} */
function runIn(words, name) {
  for (let at = 0; at + name.length <= words.length; at++) {
    if (name.every((word, i) => words[at + i] === word)) return name.map((_, i) => at + i);
  }
  return [];
}

/** A piece as the pick names it: its unit, and its topic after a slash. @param {Piece} piece */
const matchOf = ({ unit, topic }) => (topic === undefined ? unit : `${unit}/${topic}`);

/**
 * Whether naming `b` outranks naming `a` (the header's): b takes every word
 * a takes and more, or the same words where a topic named a and a unit in
 * progress named b by its own name.
 * @param {Naming} a @param {Naming} b
 */
function outranks(a, b) {
  if (![...a.taken].every((at) => b.taken.has(at))) return false;
  return a.taken.size < b.taken.size || (!a.own && b.own && b.piece.closed === undefined);
}

/**
 * Each piece the words name, in the order they name them, and the places of
 * the words its naming takes — a topic's epic named beside it among them —
 * the namings of one piece taken together, and none another outranks.
 * @param {Candidate[]} candidates @param {string[]} words @returns {Naming[]}
 */
function namedIn(candidates, words) {
  /** @type {Map<string, Naming>} */
  const named = new Map();
  for (const { piece, names, epic } of candidates) {
    const run = names.map((name) => runIn(words, name)).find((places) => places.length > 0);
    if (run === undefined) continue;
    const own = epic.length === 0;
    const met = named.get(matchOf(piece));
    const taken = [...run, ...(own ? [] : runIn(words, epic)), ...(met?.taken ?? [])];
    named.set(matchOf(piece), { piece, at: Math.min(run[0], met?.at ?? run[0]), taken: new Set(taken), own: own || met?.own === true });
  }
  const namings = [...named.values()];
  return namings.filter((one) => !namings.some((other) => outranks(one, other))).sort((a, b) => a.at - b.at);
}

/** Start's type call with the words. @param {string} cwd @param {string} text @returns {Entry} */
const startWith = (cwd, text) => ({ go: 'route', route: { kind: 'start', words: text, next: toStart(cwd) } });

/** Into a piece of work in progress. @param {Piece & {next: Next}} piece @returns {Entry} */
const routeInto = ({ unit, topic, next }) => ({ go: 'route', route: { kind: 'unit', unit, ...(topic === undefined ? {} : { topic }), next } });

/** The pick between pieces, with Start's move for talk about the product. @param {string} cwd @param {Piece[]} pieces @returns {Entry} */
const picking = (cwd, pieces) => ({ go: 'pick', pick: { surface: PICK, args: ['--matches', pieces.map(matchOf).join(',')], start: toStart(cwd) } });

/**
 * Words that carry on and name nothing (the header's): into the one unit in
 * progress, the pick between several in the start menu's order, and Start
 * where there are none.
 * @param {string} cwd @param {Candidate[]} candidates @param {string} text @returns {Entry}
 */
function carryingOn(cwd, candidates, text) {
  const units = new Map(candidates.flatMap(({ piece }) => (piece.topic === undefined && piece.closed === undefined ? [[piece.unit, piece]] : [])));
  if (units.size === 0) return startWith(cwd, text);
  if (units.size === 1) return routeInto([...units.values()][0]);
  return picking(cwd, listed(startMenuRead(cwd).units).flatMap(({ name }) => units.get(name) ?? []));
}

/**
 * Where the start goes from the person's words (the header's): none, or
 * nothing but blanks, the menu.
 * @param {string} cwd @param {string} said @returns {Entry}
 */
function entryOf(cwd, said) {
  const text = said.trim();
  if (text === '') return { go: 'menu' };
  const words = wordsOf(text);
  const candidates = piecesIn(cwd);
  const named = namedIn(candidates, words);
  if (named.length === 0) return words.length > 0 && words.every((word) => CONNECTIVE.has(word)) ? carryingOn(cwd, candidates, text) : startWith(cwd, text);
  const [{ piece, taken }] = named;
  const more = words.some((word, at) => !taken.has(at) && !CONNECTIVE.has(word));
  return named.length > 1 || more || piece.closed !== undefined ? picking(cwd, named.map((one) => one.piece)) : routeInto(piece);
}

/**
 * The pick's row for the piece `match` names, among the pick's `matches`:
 * into an epic's topic or a unit in progress, its move composed and refused
 * as the move refuses; a closed unit, into manage.
 * @param {string} cwd @param {Map<string, Record<string, any>>} manifests @param {string} match @param {string} matches
 * @returns {{label: LabelParts, next: Next}}
 */
function pickRow(cwd, manifests, match, matches) {
  const [unit, topic] = match.split('/');
  if (topic !== undefined) {
    const next = invoked(topicHandoff(cwd, [unit, topic]));
    return { label: { head: `Continue epic: ${titlecase(unit)}`, tail: `the ${topicTitle(/** @type {Record<string, any>} */ (manifests.get(unit)), topic)} topic` }, next };
  }
  const closed = manifests.get(unit);
  if (closed !== undefined && CLOSED.includes(closed.status)) {
    return { label: { head: `Manage ${closed.work_type}: ${titlecase(unit)}`, tail: closed.status }, next: toManage(unit, matches) };
  }
  const next = invoked(unitHandoff(cwd, [unit]));
  const manifest = /** @type {Record<string, any>} */ (manifests.get(unit));
  return { label: { head: `Continue ${manifest.work_type}: ${titlecase(unit)}`, tail: progressWords(progressOf(cwd, manifest)) }, next };
}

/**
 * The pick's rows (`render work-pick --matches`): each piece the words
 * named, `<unit>` or `<unit>/<topic>`, then something new, Start's type
 * call.
 * @param {string} cwd @param {string|undefined} matches
 * @returns {{key: string|number, word?: string, label: string|LabelParts, next: Next}[]}
 */
function pickRows(cwd, matches) {
  const said = (matches ?? '').split(',').filter(Boolean);
  if (said.length === 0) throw new Error(`render ${PICK}: --matches names the pieces of work the words named, each <unit> or <unit>/<topic>, comma-joined, as boot's pick gives them`);
  const manifests = new Map(loadAllManifests(cwd).map((manifest) => [manifest.name, manifest]));
  const rows = said.map((match, at) => ({ key: at + 1, ...pickRow(cwd, manifests, match, said.join(',')) }));
  return [...rows, { key: 's', word: 'start', label: 'Start something new with these words', next: toStart(cwd) }];
}

/**
 * Boot's facts the setup gates are due by.
 * @typedef {object} GateFacts
 * @property {{changed: boolean, verify: unknown[], notices: unknown[]}} migrations
 * @property {'running'|'could'|'cannot'} mod
 * @property {string|null} effort
 * @property {string} walkthrough
 * @property {string} session_labels
 * @property {string} knowledge
 * @property {{status: string}} [system_config] this machine's knowledge configuration, where the project has no knowledge base
 * @property {string} brownfield_offer
 * @property {boolean} github_rule_offer
 */

/**
 * The setup gates due at this start (the header's): the migration review
 * where the run changed files or handed something back, the stop where
 * Claude Code is older than the floor, and while the project has no
 * knowledge base, this machine's configuration adopted where it holds a
 * valid one, else the knowledge gate; then the mod's notice where it could run
 * and is not, the effort notice where the session's effort is known — its
 * threshold the prose's (26.2.3) — and each one-time offer not yet
 * answered (O3), on the bare command, the brownfield read on any entry once
 * a lost state has started again.
 * @param {GateFacts} facts @param {{bare: boolean, outdated: boolean, restarted: boolean}} entry
 * @returns {Gate[]}
 */
function gatesDue(facts, { bare, outdated, restarted }) {
  const { migrations } = facts;
  /** Each gate in start's order, whether it is due, and whether this entry shows it. @type {[Gate, boolean, boolean][]} */
  const gates = [
    ['migration-review', migrations.changed || migrations.verify.length > 0 || migrations.notices.length > 0, true],
    ['claude-code-floor', outdated, true],
    ['knowledge-adopt', facts.knowledge === 'not-ready' && facts.system_config?.status === 'valid', true],
    ['knowledge', facts.knowledge === 'not-ready' && facts.system_config?.status !== 'valid', true],
    ['mod-notice', facts.mod === 'could', bare],
    ['effort', facts.effort !== null, bare],
    ['walkthrough', facts.walkthrough === 'none', bare],
    ['session-labels', facts.session_labels === 'prompt', bare],
    ['brownfield', facts.brownfield_offer === 'none', bare || restarted],
    ['github-rule', facts.github_rule_offer, bare],
  ];
  return gates.flatMap(([gate, due, shown]) => (due && shown ? [gate] : []));
}

module.exports = { entryOf, pickRows, gatesDue };

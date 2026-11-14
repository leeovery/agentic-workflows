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
// - Words naming work in progress among other words, or several pieces of
//   it, go to the pick, `render work-pick`: a row for each piece, and one
//   for something new, each row's next its move.
// - Words naming nothing in progress go to Start's type call: discovery,
//   for a piece of work of no kind yet, the words held by the conversation.
//
// A piece of work is named by its name, or the title a rename gave a topic,
// read as words — case, hyphens and punctuation aside — standing together
// in the words given: a unit in progress whose move composes, and a topic
// of an epic in progress whose move composes. A naming the words hold
// inside another's is the other's: an epic named beside its topic names the
// topic. The words a person says around a name to go there — "carry on
// with", "the feature" — carry no work of their own (`CONNECTIVE`); any
// other word left over is more than the naming, and the pick asks.
//
// The setup gates due come with it, in the order start works them: the
// migration review and the stop at an older Claude Code on every entry,
// since they need the person; the rest on the bare command alone, the
// one-time offers waiting for it (`gatesDue`).
// ---------------------------------------------------------------------------

const { loadAllManifests } = require('./reads.cjs');
const { resolveHandoff, topicHandoff } = require('./handoff.cjs');
const { unitHandoff } = require('./unit-handoff.cjs');
const { progressOf, progressWords } = require('./progress.cjs');
const { titlecase } = require('./conventions.cjs');
const { topicTitles, goesBy, titled } = require('./derivations.cjs');

/** @typedef {import('./handoff.cjs').Handoff} Handoff */
/** @typedef {import('./projections/surfaces.cjs').Next} Next */
/** @typedef {import('./projections/surfaces.cjs').LabelParts} LabelParts */

/** The words that go with a name to go there, and carry no work of their own (the header's). */
const CONNECTIVE = new Set([
  'a', 'an', 'the', 'this', 'that', 'my', 'our', 'to', 'into', 'on', 'in', 'at', 'with', 'of', 'for', 'and',
  'i', 'we', 'me', 'us', 'you', 'can', 'let', 'lets', 's', 'please', 'now', 'again',
  'continue', 'carry', 'resume', 'open', 'go', 'get', 'back', 'pick', 'up', 'where', 'left', 'off', 'work', 'working',
  'feature', 'epic', 'bugfix', 'quickfix', 'topic', 'discovery', 'discussion', 'investigation', 'specification', 'spec', 'build', 'review',
]);

/** The pick's surface. */
const PICK = 'work-pick';

/** A piece of work the words may name: a unit, or an epic's topic, and the move into it. @typedef {{unit: string, topic?: string, move: Handoff}} Piece */

/** Where the words send the start: Start's type call with them, or into a piece of work. @typedef {({kind: 'start', words: string} | {kind: 'unit', unit: string, topic?: string}) & {next: Next}} Route */

/** Where the start goes (the header's). @typedef {{go: 'menu'} | {go: 'route', route: Route} | {go: 'pick', pick: {surface: string, args: string[]}}} Entry */

/** A setup gate start works (22.2.1), by the name boot's `gates` gives it. @typedef {'migration-review'|'claude-code-floor'|'mod-notice'|'effort'|'walkthrough'|'session-labels'|'knowledge'|'brownfield'|'github-rule'|'github-squash'} Gate */

/** Text read as words: lowercase, split at anything but a letter or a digit. @param {string} text @returns {string[]} */
const wordsOf = (text) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** A move invoked in this conversation, nothing cleared: none of these moves carries an argument with a space in it. @param {Handoff} move @returns {Next} */
const invoked = (move) => ({ kind: 'invoke', skill: move.skill, args: move.args === '' ? [] : move.args.split(' ') });

/** Start's type call: discovery, for a piece of work of no kind yet. @param {string} cwd @returns {Next} */
const toStart = (cwd) => invoked(resolveHandoff(cwd, 'leeway-discovery', ['start', 'none']));

/** The move `compose` makes, or null where it refuses. @param {() => Handoff} compose @returns {Handoff|null} */
function composed(compose) {
  try {
    return compose();
  } catch {
    return null;
  }
}

/**
 * Each piece of work the words could name (the header's), with the names
 * it goes by and, for a topic, its epic's, each as words.
 * @param {string} cwd @returns {{piece: Piece, names: string[][], epic: string[]}[]}
 */
function piecesIn(cwd) {
  return loadAllManifests(cwd).filter((manifest) => manifest.status === 'in-progress').flatMap((manifest) => {
    const unit = manifest.name;
    const move = composed(() => unitHandoff(cwd, [unit]));
    const own = move === null ? [] : [{ piece: { unit, move }, names: [wordsOf(unit)], epic: [] }];
    if (manifest.work_type !== 'epic') return own;
    const titles = topicTitles(manifest);
    const topics = new Set([...Object.keys(manifest.phases?.discovery?.items ?? {}), ...Object.keys(manifest.phases?.discussion?.items ?? {})]);
    return [...own, ...[...topics].flatMap((topic) => {
      const into = composed(() => topicHandoff(cwd, [unit, topic]));
      return into === null ? [] : [{ piece: { unit, topic, move: into }, names: [wordsOf(topic), wordsOf(goesBy(titles, topic))], epic: wordsOf(unit) }];
    })];
  });
}

/** Where `name`'s words first stand together in `words`, each by its place; none where they never do. @param {string[]} words @param {string[]} name @returns {number[]} */
function runIn(words, name) {
  for (let at = 0; at + name.length <= words.length; at++) {
    if (name.every((word, i) => words[at + i] === word)) return name.map((_, i) => at + i);
  }
  return [];
}

/** Whether every word `a` takes is one `b` takes, and `b` takes more. @param {Set<number>} a @param {Set<number>} b */
const inside = (a, b) => a.size < b.size && [...a].every((at) => b.has(at));

/**
 * Each piece the words name, in the order they name them, and the places of
 * the words its naming takes — a topic's epic named beside it among them —
 * but a naming held inside another's (the header's).
 * @param {string} cwd @param {string[]} words @returns {{piece: Piece, at: number, taken: Set<number>}[]}
 */
function namedIn(cwd, words) {
  const named = piecesIn(cwd).flatMap(({ piece, names, epic }) => {
    const run = names.map((name) => runIn(words, name)).find((places) => places.length > 0);
    return run === undefined ? [] : [{ piece, at: run[0], taken: new Set([...run, ...(epic.length === 0 ? [] : runIn(words, epic))]) }];
  });
  return named.filter((one) => !named.some((other) => inside(one.taken, other.taken))).sort((a, b) => a.at - b.at);
}

/** A piece as the pick names it: its unit, and its topic after a slash. @param {Piece} piece */
const matchOf = ({ unit, topic }) => (topic === undefined ? unit : `${unit}/${topic}`);

/**
 * Where the start goes from the person's words (the header's): none, or
 * nothing but blanks, the menu.
 * @param {string} cwd @param {string} said @returns {Entry}
 */
function entryOf(cwd, said) {
  const text = said.trim();
  if (text === '') return { go: 'menu' };
  const words = wordsOf(text);
  const named = namedIn(cwd, words);
  if (named.length === 0) return { go: 'route', route: { kind: 'start', words: text, next: toStart(cwd) } };
  const [{ piece, taken }] = named;
  if (named.length > 1 || words.some((word, at) => !taken.has(at) && !CONNECTIVE.has(word))) {
    return { go: 'pick', pick: { surface: PICK, args: ['--matches', named.map((one) => matchOf(one.piece)).join(',')] } };
  }
  const { unit, topic, move } = piece;
  return { go: 'route', route: { kind: 'unit', unit, ...(topic === undefined ? {} : { topic }), next: invoked(move) } };
}

/**
 * The pick's rows (`render work-pick --matches`): each piece the words
 * named, `<unit>` or `<unit>/<topic>`, its move composed and refused as the
 * move refuses, then something new, Start's type call.
 * @param {string} cwd @param {string|undefined} matches
 * @returns {{key: string|number, word?: string, label: string|LabelParts, next: Next}[]}
 */
function pickRows(cwd, matches) {
  const said = (matches ?? '').split(',').filter(Boolean);
  if (said.length === 0) throw new Error(`render ${PICK}: --matches names the pieces of work the words named, each <unit> or <unit>/<topic>, comma-joined, as boot's pick gives them`);
  const manifests = new Map(loadAllManifests(cwd).map((manifest) => [manifest.name, manifest]));
  const rows = said.map((match, at) => {
    const [unit, topic] = match.split('/');
    const move = topic === undefined ? unitHandoff(cwd, [unit]) : topicHandoff(cwd, [unit, topic]);
    const manifest = /** @type {Record<string, any>} */ (manifests.get(unit));
    const label = topic === undefined
      ? { head: `Continue ${manifest.work_type}: ${titlecase(unit)}`, tail: progressWords(progressOf(cwd, manifest)) }
      : { head: `Continue epic: ${titlecase(unit)}`, tail: `the ${titled(topicTitles(manifest), topic)} topic` };
    return { key: at + 1, label, next: invoked(move) };
  });
  return [...rows, { key: 's', word: 'start', label: 'Start something new with these words', next: toStart(cwd) }];
}

/**
 * Boot's facts the setup gates are due by.
 * @typedef {object} GateFacts
 * @property {{changed: boolean, verify: unknown[], notices: unknown[]}} migrations
 * @property {'running'|'could'|'cannot'} mod
 * @property {string|null} effort
 * @property {string} walkthrough
 * @property {string} tmux_labels
 * @property {string} knowledge
 * @property {string} brownfield_offer
 * @property {boolean} github_rule_offer
 * @property {boolean} github_squash_offer
 */

/**
 * The setup gates due at this start (the header's): the migration review
 * where the run changed files or handed something back, and the stop where
 * Claude Code is older than the floor; then, on the bare command alone, the
 * mod's notice where it could run and is not, the effort notice where the
 * session's effort is known — its threshold the prose's (26.2.3) — and each
 * one-time offer not yet answered (O3).
 * @param {GateFacts} facts @param {{bare: boolean, outdated: boolean}} entry
 * @returns {Gate[]}
 */
function gatesDue(facts, { bare, outdated }) {
  const { migrations } = facts;
  /** @type {[Gate, boolean][]} */
  const always = [
    ['migration-review', migrations.changed || migrations.verify.length > 0 || migrations.notices.length > 0],
    ['claude-code-floor', outdated],
  ];
  /** @type {[Gate, boolean][]} */
  const offers = [
    ['mod-notice', facts.mod === 'could'],
    ['effort', facts.effort !== null],
    ['walkthrough', facts.walkthrough === 'none'],
    ['session-labels', facts.tmux_labels === 'prompt'],
    ['knowledge', facts.knowledge === 'not-ready'],
    ['brownfield', facts.brownfield_offer === 'none'],
    ['github-rule', facts.github_rule_offer],
    ['github-squash', facts.github_squash_offer],
  ];
  return [...always, ...(bare ? offers : [])].flatMap(([gate, due]) => (due ? [gate] : []));
}

module.exports = { CONNECTIVE, PICK, entryOf, pickRows, gatesDue };

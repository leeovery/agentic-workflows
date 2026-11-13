'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the epic's menu (18.4.17) — `render epic-menu <epic>`, drawn
// in the menus' frame (menus.cjs), which records the conversation at the
// epic as it draws (20.3.3). Drawing it runs nothing else: no analysis, no
// backfill, no stamp (1.S8, 8.S30).
//
// - Its heading is the phase the epic has come to, where the board has it
//   (board-standing.cjs): discovery, discussion, specification, build,
//   review, complete (12.15.3). Beneath it the tally: its topics, then how
//   many are decided, in progress, not started, cancelled and postponed, a
//   count none left out; then DECIDED and SET ASIDE, each a list with no
//   key (18.4.18), a postponed topic with the horizon it waits under.
// - What waits on the person comes first (18.4.2), each a numbered row with
//   its door, read once with what waits in every unit (waits.cjs): the
//   authority gates, the questions, a decided topic a changed answer holds;
//   a topic a wait is about is that wait's row alone, never listed again.
//   The verdicts waiting on the epic's departures are one row among them,
//   e/verdicts, its door the verdict page, drawn after the numbered waits.
// - Then the topics by what they need (18.4.3): those in progress, then
//   those not started, each need in the map's order; a topic not started
//   reads Start, one in progress Continue, each with mail waiting where
//   messages wait for it; a topic with experiments waiting leads into the
//   laboratory. No count of a topic's questions shows (18.4.4). A row about
//   a topic a session in another conversation holds in the phase the row
//   opens — a wait's row and a topic's the discussion, the laboratory's the
//   experiment — is struck through, naming when it was last active
//   (18.4.8); this conversation's own hold never reads as another's (1.S8),
//   and a session that ended holds nothing (18.S69).
// - Then the way on past the topics, in place of plan rows (18.4.6): once
//   every topic is decided, cancelled or postponed, s/spec, to start it or
//   carry it on; during the build its row at the phase it is at, of its
//   cut's (progress.cjs), the phase named only in the heading; then the
//   review's row, standing aside for finish once finish waits. An epic
//   built under the old plan says so in place of its build's row (P12).
// - d/discovery while the map is open, before the spec (18.4.19); b/back to
//   the start menu.
// - The recommended row leads, never one another conversation holds
//   (18.4.21): the first of what waits; else the first topic in the map's
//   foundations-first order that can be worked (18.4.7); else, while
//   nothing but verdicts waits, the spec, the build or its review; else, in
//   discovery, d. Rows follow it in their order, numbered as drawn.
// - A finished epic's menu is its complete variant (18.4.23): its heading,
//   its tally and its lists, and help and back alone.
//
// An epic this project lacks, a unit of another type, and a cancelled epic
// are refused.
// ---------------------------------------------------------------------------

const { renderTree } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');
const { handedSession, ownsRow } = require('../../kernel/process.cjs');
const { titlecase } = require('../conventions.cjs');
const { counted } = require('./map.cjs');
const { nowOf, unitRead } = require('../unit-phases.cjs');
const { knownUnit, noUnit, unitClosure } = require('../topic-standing.cjs');
const { epicDetail } = require('../epic-detail.cjs');
const { progressOf } = require('../progress.cjs');
const { waitsOf } = require('../waits.cjs');
const { scanPresence, fmtAge } = require('../presence.cjs');
const { phaseSkill } = require('../handoff.cjs');
const { MENUS, drawMenu } = require('../menus.cjs');

/** @typedef {import('../epic-detail.cjs').EpicDetail} EpicDetail */
/** @typedef {import('../epic-detail.cjs').MapRow} MapRow */
/** @typedef {import('../waits.cjs').Wait} Wait */
/** @typedef {import('../menus.cjs').MenuRow} MenuRow */
/** @typedef {import('../menus.cjs').MenuScreen} MenuScreen */
/** @typedef {import('./surfaces.cjs').Next} Next */
/** @typedef {import('./surfaces.cjs').LabelParts} LabelParts */

/**
 * A row as the menu composes it before it is numbered: its key where it is
 * lettered; where it is a topic's, the topic, the phase that topic's hold
 * is read in, and the topic's place in the map's order.
 * @typedef {{key?: string, word?: string, label: LabelParts, next: Next, topic?: string, heldIn?: string, order?: number|null}} Row
 */

const MENU = MENUS['epic-menu'];
const BACK = Object.freeze({ label: 'Back to the start menu', next: Object.freeze({ kind: 'engine', argv: ['render', 'start-menu'] }) });
const MAP_CHANGE = 'Change the map — a new topic, cancel, postpone, pull forward, reactivate, or reopen a decided topic';
const TOPIC_PHASE = 'discussion';
const LABORATORY = 'experiment';
const SEPARATOR = ' · ';

/** Each tally's count after the topics, by the map summary's name for it, with its words. */
const TALLIED = Object.freeze([['decided', 'decided'], ['in_flight', 'in progress'], ['fresh', 'not started'], ['cancelled', 'cancelled'], ['postponed', 'postponed']]);

/** A question waiting, a spec's gap among them, as its row reads. @param {Wait} wait @returns {LabelParts} */
const questionLabel = (wait) => ({ head: wait.text, tail: 'a question waiting for you' });

/** How each wait reads as a row, by its kind. @type {Readonly<Record<string, (wait: Wait, title: string) => LabelParts>>} */
const WAIT_LABELS = Object.freeze({
  map: () => ({ head: 'Approve the map', tail: 'the map waits on your yes' }),
  decided: (_wait, title) => ({ head: `Close "${title}" as decided`, tail: 'what it decided waits on your yes' }),
  ready: () => ({ head: 'Ready to build', tail: 'the spec waits on your yes' }),
  finish: () => ({ head: 'Finish', tail: 'the review passed, and finish waits on your yes' }),
  gap: questionLabel,
  question: questionLabel,
  affected: (_wait, title) => ({ head: `"${title}": a decision it relies on changed`, tail: 'confirm it still holds, or replace it' }),
});

/** A handoff into a phase of the epic, at a topic where one is named. @param {string} epic @param {string} phase @param {string} [topic] @returns {Next} */
const into = (epic, phase, topic) => ({ kind: 'handoff', skill: phaseSkill(phase), args: ['epic', epic, ...(topic === undefined ? [] : [topic])] });

/**
 * The epic `unit` names, refused where this project has none, it is of
 * another type, or it is cancelled (the header's).
 * @param {string} cwd @param {string|undefined} unit @returns {Record<string, any>}
 */
function epicNamed(cwd, unit) {
  if (unit === undefined) throw new Error('Usage: engine render epic-menu <epic>');
  const manifest = knownUnit(cwd, unit);
  if (manifest === null) throw new Error(noUnit(unit));
  if (manifest.work_type !== 'epic') throw new Error(`${unit} is a ${manifest.work_type} — only an epic has a menu of its own`);
  if (manifest.status === 'cancelled') throw new Error(/** @type {string} */ (unitClosure(manifest)));
  return manifest;
}

/**
 * The tally beneath the heading (the header's), every count but the topics'
 * own left out where it is none, wrapped to the pane between its counts,
 * never inside one.
 * @param {EpicDetail} detail @returns {string[]}
 */
function tallyOf({ map, summary }) {
  if (map.length === 0) return ['No topics on the map yet'];
  const [first, ...counts] = [counted(summary.total, 'topic'), ...TALLIED.filter(([count]) => summary[count] > 0).map(([count, words]) => `${summary[count]} ${words}`)];
  const width = displayWidth();
  return counts.reduce((lines, count) => {
    const last = lines[lines.length - 1];
    return `${last}${SEPARATOR}${count}`.length <= width ? [...lines.slice(0, -1), `${last}${SEPARATOR}${count}`] : [...lines.slice(0, -1), `${last} ·`, count];
  }, [first]);
}

/** A list with no key under its heading, where it has anything. @param {string} heading @param {string[]} titles */
function listed(heading, titles) {
  return titles.length === 0 ? [] : ['', heading, ...renderTree(titles.map((t) => ({ title: t })), { wrapTitles: true }).trimEnd().split('\n')];
}

/** How a topic set aside reads: cancelled, or postponed with the horizon it waits under. @param {EpicDetail} detail @param {MapRow} row */
function setAside({ horizons }, row) {
  if (row.lifecycle === 'cancelled') return `${row.title} — cancelled`;
  const horizon = horizons[row.name] ?? null;
  return `${row.title} — postponed${horizon === null ? '' : ` · roadmap ${horizon}`}`;
}

/**
 * What the screen shows above its question (the header's): the tally, then
 * DECIDED, but the topics a wait is about, and SET ASIDE.
 * @param {EpicDetail} detail @param {Set<string>} waiting
 * @returns {string[]}
 */
function shown(detail, waiting) {
  const decided = detail.map.filter((row) => row.lifecycle === 'decided' && !waiting.has(row.name));
  const aside = detail.map.filter((row) => row.lifecycle === 'cancelled' || row.lifecycle === 'postponed');
  return [
    ...tallyOf(detail),
    ...listed('DECIDED', decided.map((row) => row.title)),
    ...listed('SET ASIDE', aside.map((row) => setAside(detail, row))),
  ];
}

/** The rows of what waits but verdicts (the header's). @param {EpicDetail} detail @param {Wait[]} waits @returns {Row[]} */
function waitRows(detail, waits) {
  const titles = new Map(detail.map.map((row) => [row.name, row.title]));
  return waits.filter((wait) => wait.kind !== 'verdict').map((wait) => ({
    label: WAIT_LABELS[wait.kind](wait, titles.get(wait.topic ?? '') ?? ''),
    next: wait.next,
    ...(wait.topic === null ? {} : { topic: wait.topic, heldIn: TOPIC_PHASE }),
  }));
}

/** A topic's row (the header's): into the laboratory where experiments wait for it, else Start or Continue. @param {string} epic @param {EpicDetail} detail @param {MapRow} row @returns {Row} */
function topicRow(epic, { experiments }, row) {
  const cue = row.mail_waiting ? 'mail waiting' : undefined;
  const waiting = experiments[row.name] ?? 0;
  if (waiting > 0) {
    return {
      label: { head: `Continue "${row.title}" in the laboratory`, tail: `${counted(waiting, 'experiment')} waiting`, cue },
      next: into(epic, LABORATORY, row.name), topic: row.name, heldIn: LABORATORY, order: row.order,
    };
  }
  const started = row.lifecycle === 'discussing';
  return {
    label: { head: `${started ? 'Continue' : 'Start'} "${row.title}"`, tail: started ? 'in progress' : 'not started', cue },
    next: { kind: 'engine', argv: ['handoff', 'topic', epic, row.name] }, topic: row.name, heldIn: TOPIC_PHASE, order: row.order,
  };
}

/** The live topics' rows, but those a wait is about, in the map's order. @param {string} epic @param {EpicDetail} detail @param {Set<string>} waiting @returns {Row[]} */
function topicRows(epic, detail, waiting) {
  return detail.map.filter((row) => (row.lifecycle === 'fresh' || row.lifecycle === 'discussing') && !waiting.has(row.name))
    .map((row) => topicRow(epic, detail, row));
}

/**
 * The way on past the topics (the header's): the build's row or its
 * review's, numbered, where the epic has come to either and was not built
 * under the old plan; the spec's, s/spec.
 * @param {string} cwd @param {Record<string, any>} manifest @param {string} phase @param {EpicDetail} detail @param {Wait[]} waits
 * @returns {{numbered: Row[], spec: Row[]}}
 */
function onwardRows(cwd, manifest, phase, { old, spec, summary }, waits) {
  const epic = manifest.name;
  /** @type {Row[]} */
  const numbered = [];
  if (old === null && phase === 'build') {
    numbered.push({ label: { head: 'Continue the build', tail: /** @type {string} */ (progressOf(cwd, manifest).far) }, next: into(epic, 'implementation') });
  } else if (old === null && phase === 'review' && !waits.some((wait) => wait.kind === 'finish')) {
    numbered.push({ label: { head: 'Continue the review' }, next: into(epic, 'review') });
  }
  if (spec === null) return { numbered, spec: [] };
  const why = summary.decided === summary.total ? 'every topic is decided' : 'every topic is decided or set aside';
  return {
    numbered,
    spec: [{ key: 's', word: 'spec', label: spec === 'start' ? { head: 'Start the specification', tail: why } : { head: 'Continue the specification' }, next: into(epic, 'specification') }],
  };
}

/** The verdicts' row, while verdicts wait on the epic's departures. @param {Wait[]} waits @returns {Row[]} */
function verdictRows(waits) {
  const verdicts = waits.filter((wait) => wait.kind === 'verdict');
  if (verdicts.length === 0) return [];
  const head = verdicts.length === 1 ? 'Give the verdict waiting on a call you changed' : `Give the ${verdicts.length} verdicts waiting on calls you changed`;
  return [{ key: 'e', word: 'verdicts', label: { head }, next: verdicts[0].next }];
}

/**
 * What strikes each row about a topic another conversation holds in the
 * phase the row opens, naming when it was last active (the header's).
 * @param {string} cwd @param {string} epic @returns {(row: Row) => Row}
 */
function striker(cwd, epic) {
  const held = scanPresence(cwd, epic).sessions.filter((r) => r.held && !ownsRow(r));
  return (row) => {
    const hold = held.find((r) => r.phase === row.heldIn && r.topic === row.topic);
    return hold === undefined ? row : { ...row, label: { ...row.label, holder: `in session (last active ${fmtAge(hold.age_seconds)} ago)` } };
  };
}

/** Whether no other conversation holds the row. @param {Row} row */
const free = (row) => row.label.holder === undefined;

/** A topic's place in the map's order, a topic with none after every other. @param {Row} row */
const mapOrder = (row) => row.order ?? Infinity;

/**
 * The recommended row (the header's): of what waits, the topics, and the
 * way on past them.
 * @param {Row[]} waiting @param {Row[]} topics @param {{numbered: Row[], spec: Row[]}} onward @param {Row|undefined} discovery
 * @returns {Row|undefined}
 */
function recommendedOf(waiting, topics, onward, discovery) {
  const topic = topics.filter(free).reduce((/** @type {Row|undefined} */ first, row) => (first === undefined || mapOrder(row) < mapOrder(first) ? row : first), undefined);
  if (waiting.length > 0) return waiting.find(free) ?? topic;
  return topic ?? onward.spec[0] ?? onward.numbered[0] ?? discovery;
}

/**
 * The rows in the order drawn, the recommended leading, numbered as drawn
 * (the header's).
 * @param {Row[]} drawn @param {Row|undefined} recommended
 * @returns {MenuRow[]}
 */
function ordered(drawn, recommended) {
  const rows = recommended === undefined ? drawn : [recommended, ...drawn.filter((row) => row !== recommended)];
  let n = 0;
  return rows.map((row) => ({
    key: row.key ?? (n += 1),
    ...(row.word === undefined ? {} : { word: row.word }),
    label: row === recommended ? { ...row.label, recommended: true } : row.label,
    next: row.next,
  }));
}

/**
 * What waits on the person in the epic, its verdicts among it, read in the
 * conversation `session` — its seals counted, none where it is null
 * (waits.cjs).
 * @param {string} cwd @param {Record<string, any>} manifest @param {string|null} session
 * @returns {Wait[]}
 */
function epicWaits(cwd, manifest, session) {
  return /** @type {Wait[]} */ (waitsOf(cwd, [manifest], { verdicts: true, session }).waits.get(manifest.name));
}

/**
 * The epic's menu as its screen composes it (the header's), for the epic's
 * manifest and what waits in it: composing it records nothing.
 * @param {string} cwd @param {Record<string, any>} manifest @param {Wait[]} waits
 * @returns {MenuScreen}
 */
function epicMenuScreen(cwd, manifest, waits) {
  const epic = manifest.name;
  const detail = epicDetail(cwd, manifest);
  const { phase } = nowOf(unitRead(cwd, manifest));
  const title = `${titlecase(phase)} — ${titlecase(epic)}`;
  if (phase === 'complete') return { title, shows: shown(detail, new Set()), rows: [], back: BACK };
  const waiting = new Set(waits.flatMap((wait) => (wait.kind === 'verdict' || wait.topic === null ? [] : [wait.topic])));
  const onward = onwardRows(cwd, manifest, phase, detail, waits);
  const strike = striker(cwd, epic);
  const waitsDrawn = waitRows(detail, waits).map(strike);
  const topics = topicRows(epic, detail, waiting).map(strike);
  /** @type {Row[]} */
  const discovery = detail.map_closed ? [] : [{ key: 'd', word: 'discovery', label: { head: MAP_CHANGE }, next: { kind: 'handoff', skill: 'leeway-discovery', args: ['none', epic] } }];
  const recommended = recommendedOf(waitsDrawn, topics, onward, phase === 'discovery' ? discovery[0] : undefined);
  return {
    title,
    shows: shown(detail, waiting),
    ...(detail.old === null ? {} : { statement: detail.old }),
    rows: ordered([...waitsDrawn, ...verdictRows(waits), ...topics, ...onward.numbered, ...onward.spec, ...discovery], recommended),
    back: BACK,
  };
}

/**
 * `render epic-menu <epic>`: the epic's menu, read in the calling
 * conversation and drawn in the menus' frame, the conversation recorded at
 * the epic.
 * @param {string} cwd @param {string|undefined} unit @returns {string}
 */
function epicMenuSurface(cwd, unit) {
  const manifest = epicNamed(cwd, unit);
  return drawMenu(cwd, MENU, { arg: manifest.name }, epicMenuScreen(cwd, manifest, epicWaits(cwd, manifest, handedSession())));
}

module.exports = { epicMenuScreen, epicMenuSurface };

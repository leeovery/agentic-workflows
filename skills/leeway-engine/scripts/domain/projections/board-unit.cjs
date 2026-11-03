'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a unit's page on the board — an epic's page (20.8, 20.15.2)
// and any other unit's tab (20.15.1) — This session at the unit's menu, and
// in a phase whose view comes later (29.14.2).
//
// - An epic's topics stand in the map's order, each by its lifecycle
//   (computeTopicLifecycle): decided, in discussion, or not started — the
//   first not started marked next while none has started (20.11.4) — with
//   the person's questions decided of all on its map and the experiment one
//   of its open questions waits on, running or concluded with its report
//   waiting (20.13.2), read in one read of the ledger; whether this session
//   or another is in its discussion or its experiment, by the position and
//   the sessions' presence; and its messages waiting. Those cancelled or
//   postponed are set aside, a postponed one with the horizon the roadmap
//   holds it on.
// - The specification waits until it is written, runs until the build
//   begins, and is complete then; the build runs until every phase of the
//   cut has closed.
// - Any other unit's phases run from discovery, which made it, through its
//   type's pipeline (20.15.2), each complete, running, or later, by the
//   phase's status (derivations.cjs); an epic's while discovery runs before
//   any topic exists, discovery running and each after it later, with what
//   it waits on. A phase complete or running says what its records hold:
//   the discussion its decisions, the specification its sections and the
//   build phases cut, the build its tasks done of its tasks, the review its
//   round.
// - What waits on the person in a unit is each question its build waits on,
//   and each gap its specification's review waits on while the spec is
//   written and the build not begun (spec-passes.cjs).
// - Lately is the unit's moments, newest first, the latest `LATELY_SHOWN`:
//   from the state's history (state-history.cjs) and, once its build has
//   begun, from its build (board-build.cjs), each topic by its title.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { readProjectManifest } = require('../../kernel/manifest.cjs');
const { readShown, answerMap } = require('../ledger-read.cjs');
const { rowStanding } = require('../topic-map.cjs');
const { scanProject } = require('../presence.cjs');
const { liveInOrder } = require('../approve-map.cjs');
const { pastItsSpec } = require('../spec-standing.cjs');
const { specPath, specReading } = require('../spec-sections.cjs');
const { waitingGaps } = require('../spec-passes.cjs');
const { reviewStanding } = require('../review-phase.cjs');
const { cutPhases } = require('../phase-checks.cjs');
const { unitHistory } = require('../state-history.cjs');
const { computeTopicLifecycle, mailboxFiles, phaseStatus, buildBegun, buildFinished, roadmapItems, topicTitle } = require('../derivations.cjs');
const { counted } = require('./map.cjs');
const { buildView, buildWords, buildMoments } = require('./board-build.cjs');
const { rowsAt } = require('./board-review.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').EpicView} EpicView */
/** @typedef {import('../board-model.cjs').UnitView} UnitView */
/** @typedef {import('../board-model.cjs').UnitPhase} UnitPhase */
/** @typedef {import('../board-model.cjs').TopicLine} TopicLine */
/** @typedef {import('../board-model.cjs').Moment} Moment */
/** @typedef {import('../topic-map.cjs').Row} Row */

/** How many moments a unit's page shows lately. */
const LATELY_SHOWN = 10;

/** The phases a session works in a topic of an epic. */
const TOPIC_PHASES = Object.freeze(['discussion', 'experiment']);

/** Each type's phases after discovery, as its tab names them, each with the phase whose status it reads. @type {Readonly<Record<string, [string, string][]>>} */
const LINEAR_PHASES = Object.freeze({
  epic: [['discussion', 'discussion'], ['specification', 'specification'], ['build', 'implementation'], ['review', 'review']],
  feature: [['discussion', 'discussion'], ['specification', 'specification'], ['build', 'implementation'], ['review', 'review']],
  bugfix: [['investigation', 'investigation'], ['specification', 'specification'], ['build', 'implementation'], ['review', 'review']],
  'quick-fix': [['implementation', 'implementation']],
  'cross-cutting': [['discussion', 'discussion'], ['specification', 'specification']],
});

/** What an epic's phases wait on while its discovery runs (20.15.2). @type {Readonly<Record<string, string>>} */
const EPIC_WAITS = Object.freeze({ discussion: 'once the map is approved', specification: 'once every topic is decided' });

/** The sessions held elsewhere in the unit's topics, by topic: whether another session is in each. @param {BoardAt} at @returns {Set<string>} */
function othersIn(at) {
  return new Set(scanProject(at.cwd).sessions
    .filter(({ work_unit: unit, phase, held, session_id: session }) => unit === at.unit && TOPIC_PHASES.includes(phase) && held && session !== at.session)
    .map(({ topic }) => topic));
}

/**
 * Each topic's map read in one read of the ledger: the person's questions
 * decided of all, every decision on it, and the experiment its latest open
 * question measured waits on, by topic.
 * @param {BoardAt} at @param {string[]} topics
 * @returns {Map<string, {decided: number, total: number, decisions: number, experiment: TopicLine['experiment']}>}
 */
function mapsOf(at, topics) {
  return readShown(at.root, at.warnings, (shower) => new Map(topics.map((topic) => {
    const rows = /** @type {Row[]} */ (answerMap(shower, { unit: at.unit, topic }, at.root).questions);
    const standings = rows.map(rowStanding);
    const waits = rows.filter((row) => rowStanding(row) === 'open' && row.waiting_on !== null).at(-1)?.waiting_on;
    return [topic, {
      decided: standings.filter((standing) => standing === 'yours').length,
      total: standings.filter((standing) => ['open', 'moved', 'yours'].includes(standing)).length,
      decisions: standings.filter((standing) => standing !== 'open' && standing !== 'moved').length,
      experiment: waits == null ? null : { id: waits.experiment, running: waits.running },
    }];
  })));
}

/** The unit's moments, newest first, the latest shown (the header's). @param {BoardAt} at @returns {Moment[]} */
function latelyOf(at) {
  const moments = [...unitHistory(at.cwd, at.unit), ...(buildBegun(at.manifest) ? buildMoments(at) : [])];
  return moments
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, LATELY_SHOWN)
    .map((moment) => ({ ...moment, topic: moment.topic === null ? null : topicTitle(at.manifest, moment.topic) }));
}

/** The topic this session is in, in its discussion or its experiment, null where it is in none of the unit's. @param {BoardAt} at */
const sessionTopic = ({ place, unit }) => (place.unit === unit && place.phase !== null && TOPIC_PHASES.includes(place.phase) ? place.topic : null);

/** An epic's page (the header's). @param {BoardAt} at @param {boolean} atMenu @returns {EpicView} */
function epicView(at, atMenu) {
  const live = liveInOrder(at.manifest);
  const lifecycles = new Map(live.map((topic) => [topic, computeTopicLifecycle(at.manifest, topic).lifecycle]));
  const maps = mapsOf(at, live);
  const others = othersIn(at);
  const here = sessionTopic(at);
  const fresh = live.filter((topic) => lifecycles.get(topic) === 'fresh');
  const next = fresh.length === live.length ? fresh[0] : undefined;
  /** @param {string} topic @returns {TopicLine['state']} */
  const stateOf = (topic) => {
    const lifecycle = lifecycles.get(topic);
    if (lifecycle === 'decided') return 'decided';
    if (lifecycle === 'fresh') return topic === next ? 'next' : 'not-started';
    return 'discussing';
  };
  const parked = roadmapItems(readProjectManifest(at.cwd));
  const setAside = Object.keys(at.manifest.phases?.discovery?.items ?? {}).flatMap((topic) => {
    const { lifecycle } = computeTopicLifecycle(at.manifest, topic);
    if (lifecycle !== 'cancelled' && lifecycle !== 'postponed') return [];
    const horizon = lifecycle === 'postponed' ? parked[topic]?.horizon ?? null : null;
    return [{ topic, title: topicTitle(at.manifest, topic), state: /** @type {'cancelled'|'postponed'} */ (lifecycle), horizon }];
  });
  return {
    kind: 'epic',
    unit: at.unit,
    title: at.title,
    about: String(at.manifest.description ?? ''),
    at_menu: atMenu,
    progress: { decided: live.filter((topic) => lifecycles.get(topic) === 'decided').length, total: live.length, discussing: live.filter((topic) => lifecycles.get(topic) === 'discussing').length },
    topics: live.map((topic) => {
      const { decided = 0, total = 0, experiment = null } = maps.get(topic) ?? {};
      return {
        topic,
        title: topicTitle(at.manifest, topic),
        state: stateOf(topic),
        decided,
        total,
        session: topic === here ? 'this' : others.has(topic) ? 'other' : null,
        messages: mailboxFiles(at.root, at.unit, topic).length,
        experiment,
      };
    }),
    spec: buildBegun(at.manifest) ? 'complete' : pastItsSpec(at.cwd, at.manifest) ? 'running' : 'waits',
    build: buildFinished(at.manifest) ? 'complete' : buildBegun(at.manifest) ? 'running' : 'waits',
    set_aside: setAside,
    lately: latelyOf(at),
  };
}

/** The spec's sections and the build phases cut, as the tab says them. @param {BoardAt} at */
function specWords(at) {
  const file = specPath(at.cwd, at.unit);
  if (!fs.existsSync(file)) return '';
  const areas = specReading(fs.readFileSync(file, 'utf8')).headings.filter(({ kind }) => kind === 'area').length;
  const cut = cutPhases(at.manifest).length;
  return [counted(areas, 'section'), ...(cut > 0 ? [counted(cut, 'build phase')] : [])].join(' · ');
}

/** What each phase's records hold, as the tab says it, by the phase it reads. @type {Readonly<Record<string, (at: BoardAt) => string>>} */
const PHASE_WORDS = Object.freeze({
  discussion: (at) => counted(mapsOf(at, [at.unit]).get(at.unit)?.decisions ?? 0, 'decision'),
  specification: specWords,
  implementation: (at) => (buildBegun(at.manifest) ? buildWords(buildView(at).view) : ''),
  review: (at) => `round ${reviewStanding(at.cwd, at.unit, at.manifest, rowsAt(at)).round}`,
});

/** A phase's words, where its records say any. @param {BoardAt} at @param {string} reads */
const wordsOf = (at, reads) => /** @type {Record<string, (at: BoardAt) => string>} */ (PHASE_WORDS)[reads]?.(at) ?? '';

/** A phase on the unit's tab, by the status of the phase it reads. @param {BoardAt} at @param {string} phase @param {string} reads @returns {UnitPhase} */
function linearPhase(at, phase, reads) {
  const status = reads === 'review'
    ? (at.manifest.status === 'completed' ? 'completed' : buildFinished(at.manifest) ? 'in-progress' : null)
    : phaseStatus(at.manifest, reads, pastItsSpec(at.cwd, at.manifest));
  if (status === 'completed') return { phase, state: 'complete', words: wordsOf(at, reads) };
  if (status !== 'in-progress') return { phase, state: 'later', words: '' };
  return { phase, state: 'running', words: wordsOf(at, reads) };
}

/** An epic's phase while its discovery runs, before any topic exists. @param {string} phase @returns {UnitPhase} */
const epicPhase = (phase) => ({ phase, state: 'later', words: EPIC_WAITS[phase] ?? '' });

/** What waits on the person in the unit (the header's). @param {BoardAt} at @returns {UnitView['waiting']} */
function waitingIn(at) {
  if (buildBegun(at.manifest)) return (buildView(at).questions ?? []).map(({ question, asks }) => ({ kind: /** @type {const} */ ('question'), id: question, text: asks }));
  if (!fs.existsSync(specPath(at.cwd, at.unit))) return [];
  return waitingGaps(at.cwd, at.unit, at.warnings).map(({ short, text }) => ({ kind: /** @type {const} */ ('gap'), id: short, text }));
}

/** A unit's tab (the header's): an epic's only while its discovery runs before any topic exists. @param {BoardAt} at @param {boolean} atMenu @returns {UnitView} */
function linearView(at, atMenu) {
  const epic = at.manifest.work_type === 'epic';
  const after = LINEAR_PHASES[at.manifest.work_type] ?? [];
  const phases = [
    { phase: 'discovery', state: /** @type {UnitPhase['state']} */ (epic ? 'running' : 'complete'), words: '' },
    ...after.map(([phase, reads]) => (epic ? epicPhase(phase) : linearPhase(at, phase, reads))),
  ];
  return {
    kind: 'unit',
    unit: at.unit,
    title: at.title,
    type: at.manifest.work_type,
    about: String(at.manifest.description ?? ''),
    at_menu: atMenu,
    progress: { complete: phases.filter(({ state }) => state === 'complete').length, total: phases.length },
    waiting: waitingIn(at),
    phases,
    lately: latelyOf(at),
  };
}

/** Whether an epic has a topic yet: its map approved at least once. @param {Record<string, any>} manifest */
const hasTopics = (manifest) => Object.keys(manifest.phases?.discovery?.items ?? {}).length > 0;

/** A unit's page: an epic's page once it has topics, else its tab. @param {BoardAt} at @param {boolean} atMenu @returns {{view: EpicView|UnitView}} */
function unitPage(at, atMenu) {
  return { view: at.manifest.work_type === 'epic' && hasTopics(at.manifest) ? epicView(at, atMenu) : linearView(at, atMenu) };
}

/** The banner at the session's place, from the place alone: its type and the phase, or the menu. @param {BoardAt} at @returns {{state: 'running'|'idle', facts: {text: string, needs: boolean}[]}} */
function placeBanner(at) {
  const fact = (/** @type {string} */ text) => ({ text, needs: false });
  return { state: at.place.phase === null ? 'idle' : 'running', facts: [fact(at.manifest.work_type), fact(at.place.phase ?? 'at its menu')] };
}

/**
 * The banner's facts at a unit's page (20.2.4): at an epic's page its
 * topics decided of all; elsewhere the phase the session is in, or the
 * menu.
 * @param {BoardAt} at @param {EpicView|UnitView} view @returns {{state: 'running'|'idle', facts: {text: string, needs: boolean}[]}}
 */
function unitBanner(at, view) {
  if (view.kind !== 'epic') return placeBanner(at);
  const fact = (/** @type {string} */ text) => ({ text, needs: false });
  return { state: 'running', facts: [fact('epic'), fact(at.place.phase ?? 'at its menu'), fact(`${view.progress.decided} of ${view.progress.total} topics decided`)] };
}

/** How far an epic has come, as All work says it: its topics decided of all. @param {Record<string, any>} manifest */
function epicWords(manifest) {
  const live = liveInOrder(manifest);
  return `${live.filter((topic) => computeTopicLifecycle(manifest, topic).lifecycle === 'decided').length} of ${counted(live.length, 'topic')} decided`;
}

module.exports = { unitPage, unitBanner, placeBanner, epicWords };

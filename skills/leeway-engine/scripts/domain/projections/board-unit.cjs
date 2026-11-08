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
// - Where the unit stands is read from its one derivation (board-standing.cjs):
//   its phases, each complete, under way or later, and the day each complete
//   one closed; where it has come to; how the phase it is in stands —
//   running, stopped, or waiting on the person — and the unit's one list of
//   what waits on them, which the epic's page and the tab both show.
// - The specification waits until every topic is decided, is written until
//   the build begins — held by what waits on the person first in the
//   unit's list, the map the sweep staged, a gap, or ready to build's yes —
//   and is complete then; the build and review build until every phase of
//   the cut has closed, review until the unit completes, and are complete
//   then, stopped where nothing can go on and waiting on the person while
//   finish does.
// - Any other unit's tab shows each phase from discovery, an epic's until
//   its map is first approved with what each after it waits on (20.15.2). A
//   phase complete or under way says what its records hold: discovery the
//   note it began from, an epic's the topics on its map, the discussion its
//   decisions, an investigation its hypotheses, the specification its
//   sections with the build phases cut
//   once complete and its passes reported until then, the build its cut's
//   tasks done — of them while it runs — the review its round and, once
//   recorded, where it stands as the banner says it; a phase under way says
//   what it is doing, an investigation validating while either validation
//   runs, the specification where it stands as its banner says it; a phase,
//   or a stage, says whether a session is in it, this one or
//   another.
// - A unit started the day its manifest was made, as the manifest stamps it
//   (20.15.1). The tab says whether it is the unit this session is in,
//   whose questions the board holds (`here`).
// - A finished phase opens in full (20.15.3): a linear unit's discovery on
//   the note it began from — the inbox's or the roadmap's, else its brief —
//   and the discussion on its decisions.
// - Lately is the unit's moments, newest first, the latest `LATELY_SHOWN`:
//   from the state's history (state-history.cjs), its spec's review passes
//   (board-spec.cjs) and, once its build has begun, from its build
//   (board-build.cjs), each topic by its title, the spec landed with its
//   sections and phases cut, each
//   message sent with its sender, and each run of messages one topic took in
//   one moment with their count.
// ---------------------------------------------------------------------------

const { fact, placeFact } = require('../board-model.cjs');
const fs = require('fs');
const { readProjectManifest } = require('../../kernel/manifest.cjs');
const { statePath } = require('../../kernel/state-root.cjs');
const { readShown, answerMap } = require('../ledger-read.cjs');
const { rowStanding, answersOn } = require('../topic-map.cjs');
const { scanProject } = require('../presence.cjs');
const { liveInOrder } = require('../approve-map.cjs');
const { specPath, specReading } = require('../spec-sections.cjs');
const { unitHistory, sentMail } = require('../state-history.cjs');
const { ROADMAP_SEED } = require('../inbox.cjs');
const { dayBefore } = require('../dates.cjs');
const { computeTopicLifecycle, mailboxFiles, buildBegun, buildFinished, cutLength, roadmapItems, topicTitle, briefFile } = require('../derivations.cjs');
const { counted } = require('./map.cjs');
const { buildView, buildMoments } = require('./board-build.cjs');
const { roundWords } = require('./board-review.cjs');
const { passMoments, reportedOf, specDoing } = require('./board-spec.cjs');
const { sentBy } = require('./board-discussion.cjs');
const { mapCount, textOf } = require('./board-discovery.cjs');
const { phasesAt, nowOf, waitingOn, standingOf, holds, closedOn, startedOf, pastDiscovery } = require('./board-standing.cjs');
const { investigationDoing, hypothesesCount } = require('./board-investigation.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').EpicView} EpicView */
/** @typedef {import('../board-model.cjs').UnitView} UnitView */
/** @typedef {import('../board-model.cjs').UnitPhase} UnitPhase */
/** @typedef {import('../board-model.cjs').TopicLine} TopicLine */
/** @typedef {import('../board-model.cjs').Moment} Moment */
/** @typedef {import('../board-model.cjs').PhasePage} PhasePage */
/** @typedef {import('../topic-map.cjs').Row} Row */
/** @typedef {'this'|'other'|null} SessionIn */

/** How many moments a unit's page shows lately. */
const LATELY_SHOWN = 10;

/** The phases a session works in a topic of an epic. */
const TOPIC_PHASES = Object.freeze(['discussion', 'experiment']);

/** What an epic's phases wait on while its discovery runs (20.15.2). @type {Readonly<Record<string, string>>} */
const EPIC_WAITS = Object.freeze({ discussion: 'once the map is approved', specification: 'once every topic is decided' });

/** The sessions the project holds, read once a call. @param {BoardAt} at @returns {ReturnType<typeof scanProject>['sessions']} */
const presenceOf = (at) => at.once('presence', () => scanProject(at.cwd).sessions);

/** The sessions held elsewhere in the unit's topics, by topic: whether another session is in each. @param {BoardAt} at @returns {Set<string>} */
function othersIn(at) {
  return new Set(presenceOf(at)
    .filter(({ work_unit: unit, phase, held, session_id: session }) => unit === at.unit && TOPIC_PHASES.includes(phase) && held && session !== at.session)
    .map(({ topic }) => topic));
}

/** The session in each of the unit's phases, by phase: this one where it is, else another holding its presence there. @param {BoardAt} at @returns {Map<string, 'this'|'other'>} */
function sessionsIn(at) {
  /** @type {Map<string, 'this'|'other'>} */
  const by = new Map(presenceOf(at)
    .filter(({ work_unit: unit, held, session_id: session }) => unit === at.unit && held && session !== at.session)
    .map(({ phase }) => [phase, 'other']));
  if (at.place.unit === at.unit && at.place.phase !== null) by.set(at.place.phase, 'this');
  return by;
}

/** The session in any of the phases given, this one first. @param {Map<string, 'this'|'other'>} sessions @param {string[]} phases @returns {SessionIn} */
function sessionOf(sessions, phases) {
  const found = phases.map((phase) => sessions.get(phase));
  if (found.includes('this')) return 'this';
  return found.includes('other') ? 'other' : null;
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

/** Who sent each message to the unit's topics since `from`, by the topic and the message's file. @param {BoardAt} at @param {string} from @returns {Map<string, string>} */
function sendersOf(at, from) {
  return new Map(sentMail(at.cwd, at.unit, from).map(({ to, file, from: sender }) => [`${to}/${file}`, sentBy(sender).from]));
}

/** A message sent or taken in, with its sender in place of its file, where the mail names one; one taken in counted. @param {Map<string, string>} senders @param {Moment} moment @returns {Moment} */
function withSender(senders, moment) {
  if (moment.kind !== 'sent' && moment.kind !== 'answered') return moment;
  const sender = senders.get(`${moment.topic}/${moment.detail}`) || null;
  return moment.kind === 'answered' ? { ...moment, detail: sender, count: 1 } : { ...moment, detail: sender };
}

/** The moments, each run of messages one topic took in made one with their count, its sender kept only where it was one. @param {Moment[]} moments @returns {Moment[]} */
function intakes(moments) {
  /** @type {Moment[]} */
  const out = [];
  for (const moment of moments) {
    const last = out.at(-1);
    if (moment.kind === 'answered' && last?.kind === 'answered' && last.topic === moment.topic) out[out.length - 1] = { ...last, detail: null, count: (last.count ?? 1) + 1 };
    else out.push(moment);
  }
  return out;
}

/**
 * How far back a message LATELY shows was sent: by the oldest moment of mail
 * it shows — one taken in was sent before it, so from the unit's start for
 * that; one sent, from its own time.
 * @param {BoardAt} at @param {Moment} oldest
 */
const sentSince = (at, oldest) => (oldest.kind === 'sent' ? oldest.at : dayBefore(at.manifest.created) ?? oldest.at);

/** The unit's moments, newest first, the latest shown (the header's). @param {BoardAt} at @returns {Moment[]} */
function latelyOf(at) {
  const moments = [...unitHistory(at.cwd, at.unit), ...passMoments(at), ...(buildBegun(at.manifest) ? buildMoments(at) : [])].sort((a, b) => b.at.localeCompare(a.at));
  const mail = moments.filter(({ kind }) => kind === 'sent' || kind === 'answered');
  const oldest = mail.at(-1);
  const senders = oldest === undefined ? new Map() : sendersOf(at, sentSince(at, oldest));
  return intakes(moments.map((moment) => withSender(senders, moment)))
    .slice(0, LATELY_SHOWN)
    .map((moment) => ({ ...moment, topic: moment.topic === null ? null : topicTitle(at.manifest, moment.topic), ...(moment.kind === 'spec-landed' ? { detail: landedWords(at) } : {}) }));
}

/** The topic this session is in, in its discussion or its experiment, null where it is in none of the unit's. @param {BoardAt} at */
const sessionTopic = ({ place, unit }) => (place.unit === unit && place.phase !== null && TOPIC_PHASES.includes(place.phase) ? place.topic : null);

/** What holds the specification on the epic's page, by the first wait of the unit's one list that holds it. @type {Readonly<Record<string, EpicView['spec']['state']>>} */
const SPEC_HELD = Object.freeze({ map: 'map', gap: 'asking', ready: 'ready' });

/**
 * Where the specification stands on the epic's page: waiting on the topics,
 * being written, held by what waits on the person — the map the sweep
 * staged, a gap, or ready to build's yes — or complete.
 * @param {BoardAt} at @returns {EpicView['spec']['state']}
 */
function specState(at) {
  const { phase } = nowOf(at);
  if (phase === 'discussion') return 'waits';
  if (phase !== 'specification') return 'complete';
  const held = waitingOn(at).find(holds);
  return held === undefined ? 'running' : SPEC_HELD[held.kind];
}

/**
 * The specification on the epic's page: where it stands, and while it is
 * written what it is doing as its banner and All work say it (`specDoing`).
 * @param {BoardAt} at @param {SessionIn} session @returns {EpicView['spec']}
 */
function specOf(at, session) {
  const state = specState(at);
  return { state, words: state === 'running' ? specDoing(at, waitingOn(at)) : '', session };
}

/** Where the build and review stand on the epic's page, by the derivation's phase and standing. @type {Readonly<Record<string, EpicView['build']['state']>>} */
const UNDER_WAY = Object.freeze({ build: 'building', review: 'reviewing' });

/**
 * Where the build and review stand on the epic's page: after the
 * specification, building or in review, stopped, finish waiting on the
 * person, or complete.
 * @param {BoardAt} at @returns {EpicView['build']['state']}
 */
function buildState(at) {
  const { phase } = nowOf(at);
  if (phase === 'complete') return 'complete';
  const running = UNDER_WAY[phase];
  if (running === undefined) return 'waits';
  const standing = standingOf(at);
  if (standing === 'stopped') return 'stopped';
  return standing === 'waits' && waitingOn(at).some(({ kind }) => kind === 'finish') ? 'finish' : running;
}

/** An epic's page (the header's). @param {BoardAt} at @param {boolean} atMenu @returns {EpicView} */
function epicView(at, atMenu) {
  const live = liveInOrder(at.manifest);
  const lifecycles = new Map(live.map((topic) => [topic, computeTopicLifecycle(at.manifest, topic).lifecycle]));
  const maps = mapsOf(at, live);
  const others = othersIn(at);
  const sessions = sessionsIn(at);
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
    started: startedOf(at),
    now: nowOf(at),
    at_menu: atMenu,
    here: at.place.unit === at.unit,
    progress: { decided: live.filter((topic) => lifecycles.get(topic) === 'decided').length, total: live.length, discussing: live.filter((topic) => lifecycles.get(topic) === 'discussing').length },
    waiting: waitingOn(at),
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
    spec: specOf(at, sessionOf(sessions, ['specification'])),
    build: { state: buildState(at), session: sessionOf(sessions, ['implementation', 'review']) },
    set_aside: setAside,
    lately: latelyOf(at),
  };
}

/** The spec's sections and the phases cut, as LATELY says them of the spec landed, null where the spec is not written. @param {BoardAt} at */
function landedWords(at) {
  const areas = specAreas(at);
  if (areas === null) return null;
  const cut = cutLength(at.manifest);
  return [counted(areas, 'section'), ...(cut > 0 ? [`${counted(cut, 'phase')} cut`] : [])].join(', ');
}

/** How many sections the unit's spec holds, null where it is not written. @param {BoardAt} at */
function specAreas(at) {
  const file = specPath(at.cwd, at.unit);
  return fs.existsSync(file) ? specReading(fs.readFileSync(file, 'utf8')).headings.filter(({ kind }) => kind === 'area').length : null;
}

/** The spec's sections, and the build phases cut once it is complete, else the passes reported, as the tab says them. @param {BoardAt} at */
function specWords(at) {
  const areas = specAreas(at);
  if (areas === null) return '';
  const after = buildBegun(at.manifest) ? counted(cutLength(at.manifest), 'build phase') : counted(reportedOf(at).length, 'pass', 'passes');
  return `${counted(areas, 'section')} · ${after}`;
}

/** The cut's tasks done, of them while the build runs, as the tab says them; the review's fix tasks are not the build's. @param {BoardAt} at */
function buildTasks(at) {
  const cut = buildView(at).view.phases.filter(({ phase }) => phase <= cutLength(at.manifest));
  const done = cut.reduce((sum, phase) => sum + phase.done, 0);
  return buildFinished(at.manifest) ? `${counted(done, 'task')} done` : `${done} of ${counted(cut.reduce((sum, phase) => sum + phase.total, 0), 'task')} done`;
}

/** The notes the unit was started from, as its manifest lists them. @param {BoardAt} at @returns {{path: string, source: string}[]} */
const seedsOf = ({ manifest }) => (Array.isArray(manifest.seeds) ? manifest.seeds : []);

/** Whether a note the unit was started from is the roadmap's. @param {{source: string}} seed */
const fromRoadmap = ({ source }) => String(source).startsWith(ROADMAP_SEED);

/** Where a linear unit's discovery began, as the tab says it: an inbox note, the roadmap's, or the seed. @param {BoardAt} at */
function seedWords(at) {
  const [seed] = seedsOf(at);
  if (seed === undefined) return 'the seed';
  return fromRoadmap(seed) ? 'from the roadmap' : 'from your inbox note';
}

/** The hypotheses an investigation's log holds, as the tab says them, empty while it holds none. @param {BoardAt} at */
function hypothesesWords(at) {
  const count = hypothesesCount(at);
  return count === 0 ? '' : counted(count, 'hypothesis', 'hypotheses');
}

/** What each phase's records hold, as the tab says it, by the phase it reads. @type {Readonly<Record<string, (at: BoardAt) => string>>} */
const PHASE_WORDS = Object.freeze({
  discovery: seedWords,
  discussion: (at) => counted(mapsOf(at, [at.unit]).get(at.unit)?.decisions ?? 0, 'decision'),
  investigation: hypothesesWords,
  specification: specWords,
  implementation: (at) => (buildBegun(at.manifest) ? buildTasks(at) : ''),
  review: (at) => {
    const { round, words } = roundWords(at);
    return words ?? `round ${round}`;
  },
});

/** A phase's words, where its records say any. @param {BoardAt} at @param {string} reads */
const wordsOf = (at, reads) => /** @type {Record<string, (at: BoardAt) => string>} */ (PHASE_WORDS)[reads]?.(at) ?? '';

/** What a phase under way is doing, by the phase it reads: the specification where it stands, as its banner says it. @type {Readonly<Record<string, (at: BoardAt) => string>>} */
const DOING = Object.freeze({
  discovery: () => 'shaping',
  discussion: () => 'discussing',
  investigation: investigationDoing,
  specification: (at) => specDoing(at, waitingOn(at)),
  implementation: (at) => (at.manifest.work_type === 'quick-fix' ? 'working' : 'building'),
  review: () => 'reviewing',
});

/** What a phase under way is doing, by the phase it reads. @param {BoardAt} at @param {string} reads */
const doingOf = (at, reads) => /** @type {Record<string, (at: BoardAt) => string>} */ (DOING)[reads]?.(at) ?? '';

/** A linear unit's discovery in full: each note it was started from, else its brief. @param {BoardAt} at @returns {PhasePage['sections']} */
function seedSections(at) {
  const seeds = seedsOf(at);
  if (seeds.length === 0) return [{ heading: 'The seed', text: textOf(statePath(at.cwd, briefFile(at.unit, at.unit))) }];
  return seeds.map((seed) => ({ heading: fromRoadmap(seed) ? 'The roadmap\'s note' : 'Your note', text: textOf(statePath(at.cwd, at.unit, seed.path)) }));
}

/** A linear unit's discussion in full: each decision on its map, its question with its answer. @param {BoardAt} at @returns {PhasePage['sections']} */
function decisionSections(at) {
  const rows = readShown(at.root, at.warnings, (shower) => /** @type {Row[]} */ (answerMap(shower, { unit: at.unit, topic: at.unit }, at.root).questions));
  const said = (/** @type {string} */ text) => text.replace(/\s+/g, ' ').trim();
  const decided = rows.filter((row) => !['open', 'moved'].includes(rowStanding(row)));
  return [{ heading: 'Decisions', text: decided.map((row) => `${said(row.text)}: ${answersOn(row).map(({ text }) => said(text)).join(' ')}`).join('\n\n') }];
}

/** The finished phases of a linear unit that open in full, each with what its page shows. @type {Readonly<Record<string, (at: BoardAt) => PhasePage['sections']>>} */
const PHASE_PAGES = Object.freeze({ discovery: seedSections, discussion: decisionSections });

/**
 * A phase on the unit's tab: where it stands — the phase the unit is in as
 * it stands — what its records hold, and the day it closed.
 * @param {BoardAt} at @param {Map<string, 'this'|'other'>} sessions @param {import('./board-standing.cjs').PhaseAt} held @returns {UnitPhase}
 */
function phaseLine(at, sessions, { phase, reads, status, on }) {
  const session = sessionOf(sessions, [reads]);
  if (status === 'complete') return { phase, state: 'complete', words: wordsOf(at, reads), doing: '', on, session, page: Object.hasOwn(PHASE_PAGES, reads) };
  if (status !== 'running') return { phase, state: 'later', words: '', doing: '', on: null, session, page: false };
  return { phase, state: standingOf(at), words: wordsOf(at, reads), doing: doingOf(at, reads), on: null, session, page: false };
}

/** What an epic's discovery has on its map so far, as the tab says it, empty while it holds none. @param {BoardAt} at */
function mapWords(at) {
  const topics = mapCount(at.cwd, at.manifest);
  return topics === 0 ? '' : counted(topics, 'topic');
}

/**
 * An epic's phase while its discovery runs, before any topic exists:
 * discovery with the topics on its map, waiting on the person while the map
 * does; each after it with what it waits on.
 * @param {BoardAt} at @param {Map<string, 'this'|'other'>} sessions @param {import('./board-standing.cjs').PhaseAt} held @returns {UnitPhase}
 */
function shapingPhase(at, sessions, { phase }) {
  const session = sessionOf(sessions, [phase]);
  if (phase !== 'discovery') return { phase, state: 'later', words: EPIC_WAITS[phase] ?? '', doing: '', on: null, session, page: false };
  return { phase, state: standingOf(at), words: mapWords(at), doing: doingOf(at, phase), on: null, session, page: false };
}

/** A unit's tab (the header's): an epic's only until its map is first approved. @param {BoardAt} at @param {boolean} atMenu @returns {UnitView} */
function linearView(at, atMenu) {
  const line = at.manifest.work_type === 'epic' ? shapingPhase : phaseLine;
  const sessions = sessionsIn(at);
  const phases = phasesAt(at).map((held) => line(at, sessions, held));
  return {
    kind: 'unit',
    unit: at.unit,
    title: at.title,
    type: at.manifest.work_type,
    about: String(at.manifest.description ?? ''),
    started: startedOf(at),
    now: nowOf(at),
    at_menu: atMenu,
    here: at.place.unit === at.unit,
    progress: { complete: phases.filter(({ state }) => state === 'complete').length, total: phases.length },
    waiting: waitingOn(at),
    phases,
    lately: latelyOf(at),
  };
}

/** A unit's page: an epic's page once its map is approved, else its tab. @param {BoardAt} at @param {boolean} atMenu @returns {{view: EpicView|UnitView}} */
function unitPage(at, atMenu) {
  return { view: pastDiscovery(at.manifest) ? epicView(at, atMenu) : linearView(at, atMenu) };
}

/**
 * A finished phase of a linear unit read in full (20.15.3), by its name:
 * the day it closed, what it produced, and its sections; refused for a
 * phase that opens on no page of its own, or is not finished.
 * @param {BoardAt} at @param {string} phase @returns {PhasePage}
 */
function phasePage(at, phase) {
  const sections = /** @type {Record<string, (at: BoardAt) => PhasePage['sections']>} */ (PHASE_PAGES)[phase];
  const finished = sections !== undefined && at.manifest.work_type !== 'epic' && phasesAt(at).some(({ reads, status }) => reads === phase && status === 'complete');
  if (!finished) throw new Error(`${at.unit} has no finished ${phase} that opens in full — a linear unit's discovery and discussion do, once complete`);
  return { kind: 'phase', unit: at.unit, title: at.title, phase, on: closedOn(at, phase), words: wordsOf(at, phase), sections: sections(at) };
}

/** The banner at the session's place, from the place alone: its type and the phase, or the menu; what waits on the person is the board's (board.cjs). @param {BoardAt} at @returns {{state: 'running'|'idle', facts: {text: string, needs: boolean}[]}} */
function placeBanner(at) {
  return { state: at.place.phase === null ? 'idle' : 'running', facts: [placeFact(at.manifest.work_type), placeFact(at.place.phase ?? 'at its menu')] };
}

/**
 * The banner's facts at a unit's page (20.2.4): at an epic's page its
 * topics decided of all; elsewhere the phase the session is in, or the
 * menu; what waits on the person is the board's (board.cjs).
 * @param {BoardAt} at @param {EpicView|UnitView} view @returns {{state: 'running'|'idle', facts: {text: string, needs: boolean}[]}}
 */
function unitBanner(at, view) {
  if (view.kind !== 'epic') return placeBanner(at);
  return { state: 'running', facts: [placeFact('epic'), placeFact(at.place.phase ?? 'at its menu'), fact(`${view.progress.decided} of ${view.progress.total} topics decided`)] };
}

/** How far an epic in its discussion has come, as All work says it: its topics decided of all. @param {Record<string, any>} manifest */
function epicWords(manifest) {
  const live = liveInOrder(manifest);
  return `${live.filter((topic) => computeTopicLifecycle(manifest, topic).lifecycle === 'decided').length} of ${counted(live.length, 'topic')} decided`;
}

module.exports = { unitPage, phasePage, unitBanner, placeBanner, epicWords };

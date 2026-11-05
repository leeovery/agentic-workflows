'use strict';

// ---------------------------------------------------------------------------
// Domain ring: an epic's discovery on the board (20.11) — This session in
// discovery and a topic's brief — read from the epic's map, the map Claude
// staged for approve the map (approve-map.cjs), and the discovery sessions'
// logs: the latest's number and the day it started, and what every log says
// under its fixed headings (discovery-log.cjs) — the directions not taken,
// the person's views of the product, and each spike's tool, live link and
// what it showed.
//
// - The map is the staged one while approve the map waits on the person, its
//   topics and parks; else the epic's map, its live topics in order, and
//   nothing parked yet.
// - A topic opens on its discussion's page once its discussion is under
//   way or decided, or was cancelled after it started (20.8.3); else — not
//   started, postponed, or cancelled before it started — on its brief, each
//   of the brief's sections by its heading, with the messages waiting in
//   its mailbox (20.11.2).
// - Its spikes are the unit's spike folders, in the order they started,
//   each reference or canonical as its links give it (asset.cjs), and each
//   opens on its page (20.11.3).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { statePath, cacheScratch } = require('../../kernel/state-root.cjs');
const { stagedOrNone, liveInOrder } = require('../approve-map.cjs');
const { sessionLogs, sessionLogsAt } = require('../discovery-session.cjs');
const { heardIn, sessionStarted } = require('../discovery-log.cjs');
const { spikesOf, spikeStatuses } = require('../asset.cjs');
const { headedSections } = require('../markdown-sections.cjs');
const { titlecase } = require('../conventions.cjs');
const { briefFile, computeTopicLifecycle, itemOf, topicKey, topicTitle } = require('../derivations.cjs');
const { messagesIn } = require('./board-discussion.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').DiscoveryView} DiscoveryView */

/** A topic of the epic's map, with its summary. @param {BoardAt} at @param {string} topic */
function mapLine(at, topic) {
  return { topic, title: topicTitle(at.manifest, topic), summary: String(itemOf(at.manifest, 'discovery', topic)?.summary ?? '') };
}

/**
 * The unit's discovery logs, in session order, each its number, its path
 * from the state root and its text, read once a call.
 * @param {BoardAt} at @returns {{number: number, rel: string, text: string}[]}
 */
const logsAt = (at) => at.once('discovery-logs', () => {
  const folder = sessionLogsAt(at.unit);
  return sessionLogs(statePath(at.cwd, folder)).map(({ number, file }) => ({ number, rel: path.posix.join(folder, file), text: fs.readFileSync(statePath(at.cwd, folder, file), 'utf8') }));
});

/** What the unit's discovery logs say under their fixed headings, read once a call. @param {BoardAt} at */
const heardAt = (at) => at.once('discovery-heard', () => heardIn(logsAt(at), spikesOf(at.root, at.unit), at.warnings));

/**
 * The unit's spikes, in the order they started, each with what the logs
 * say of it (the header's), and its live link.
 * @param {BoardAt} at @returns {(import('../board-model.cjs').SpikeLine & {link: string|null})[]}
 */
function spikesAt(at) {
  const statuses = spikeStatuses(at.cwd, at.unit, at.warnings);
  const { spikes } = heardAt(at);
  return spikesOf(at.root, at.unit).map((spike) => {
    const said = spikes.get(spike);
    return { spike, title: titlecase(spike.replace(/^\d+-/, '')), status: statuses.get(spike) ?? null, tool: said?.tool ?? null, showed: said?.showed ?? null, link: said?.link ?? null };
  });
}

/** Discovery's This session (the header's). @param {BoardAt} at @returns {{view: DiscoveryView}} */
function discoveryView(at) {
  const staged = stagedOrNone(at.cwd, at.unit);
  const session = logsAt(at).at(-1);
  const { notTaken, views } = heardAt(at);
  return {
    view: {
      kind: 'discovery',
      unit: at.unit,
      title: at.title,
      type: at.manifest.work_type,
      session: session?.number ?? null,
      started: session === undefined ? null : sessionStarted(session.text),
      waits: staged !== null,
      map: staged === null
        ? liveInOrder(at.manifest).map((topic) => mapLine(at, topic))
        : staged.topics.map(({ name, summary }) => (summary === undefined ? mapLine(at, name) : { topic: name, title: topicTitle(at.manifest, name), summary })),
      roadmap: (staged?.parks ?? []).map(({ summary, horizon }) => ({ title: summary, horizon })),
      not_taken: notTaken,
      views,
      spikes: spikesAt(at).map(({ link: _link, ...line }) => line),
    },
  };
}

/**
 * The banner's facts in discovery (20.2.4): the topics on the map, and the
 * map waiting on the person while approve the map does.
 * @param {DiscoveryView} view @returns {{state: 'running'|'needs', facts: {text: string, needs: boolean}[]}}
 */
function discoveryBanner({ type, map, waits }) {
  const fact = (/** @type {string} */ text, needs = false) => ({ text, needs });
  return {
    state: waits ? 'needs' : 'running',
    facts: [fact(type), fact('discovery'), fact(`${map.length} ${map.length === 1 ? 'topic' : 'topics'} on the map`), ...(waits ? [fact('the map waits on you', true)] : [])],
  };
}

/** The lifecycles of a topic whose discussion has started and stands: under way, or decided. */
const STARTED = Object.freeze(['discussing', 'decided']);

/** Whether a topic's discussion ran before it was cancelled: its item stood past unstarted when the cancel set it aside. @param {Record<string, any>|undefined} item */
const ranBeforeCancel = (item) => item !== undefined && item.status === 'cancelled' && typeof item.previous_status === 'string' && item.previous_status !== 'unstarted';

/** Whether a topic of the unit opens on its discussion (the header's). @param {BoardAt} at @param {string} said */
function topicStarted(at, said) {
  const topic = topicKey(at.manifest, said);
  const { lifecycle } = computeTopicLifecycle(at.manifest, topic);
  return STARTED.includes(lifecycle) || (lifecycle === 'cancelled' && ranBeforeCancel(itemOf(at.manifest, 'discussion', topic)));
}

/** How many topics an epic's map holds: the staged map's while approve the map waits on the person, else its live topics. @param {string} cwd @param {Record<string, any>} manifest */
const mapCount = (cwd, manifest) => stagedOrNone(cwd, manifest.name)?.topics.length ?? liveInOrder(manifest).length;

/** A brief's text from its file, empty where none is written. @param {string} file */
const textOf = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

/**
 * A topic's brief (20.11.2): its place on the map, its summary, its
 * brief's sections — while approve the map waits, the staged map's, a topic
 * new to it read from its draft — and the messages waiting for it; refused
 * where the map lacks the topic.
 * @param {BoardAt} at @param {string} said @returns {import('../board-model.cjs').BriefPage}
 */
function briefPage(at, said) {
  const topic = topicKey(at.manifest, said);
  const staged = stagedOrNone(at.cwd, at.unit)?.topics.find(({ name }) => name === topic);
  if (staged === undefined && itemOf(at.manifest, 'discovery', topic) === undefined) throw new Error(`${at.unit}'s map holds no topic "${said}"`);
  const { map } = discoveryView(at).view;
  const place = map.findIndex((line) => line.topic === topic);
  const { title, summary } = place === -1 ? mapLine(at, topic) : map[place];
  return {
    kind: 'brief',
    unit: at.unit,
    topic,
    title,
    order: place === -1 ? null : place + 1,
    of: map.length,
    summary,
    sections: headedSections(textOf(staged?.brief === undefined ? statePath(at.cwd, briefFile(at.unit, topic)) : cacheScratch(at.cwd, staged.brief, 'the brief\'s draft'))),
    messages: messagesIn(at, topic),
  };
}

/**
 * A spike's page (20.11.3), by its folder; refused where the unit has no
 * such spike.
 * @param {BoardAt} at @param {string} spike @returns {import('../board-model.cjs').SpikePage}
 */
function spikePage(at, spike) {
  const held = spikesAt(at).find((line) => line.spike === spike);
  if (held === undefined) throw new Error(`${at.unit} has no spike ${spike}`);
  const { link, ...line } = held;
  return { kind: 'spike', unit: at.unit, ...line, path: path.posix.join(at.unit, 'spikes', spike), link };
}

module.exports = { discoveryView, discoveryBanner, briefPage, topicStarted, spikePage, mapCount };

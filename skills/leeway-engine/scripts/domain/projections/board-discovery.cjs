'use strict';

// ---------------------------------------------------------------------------
// Domain ring: an epic's discovery on the board (20.11) — This session in
// discovery and a topic's brief — read from the epic's map, the map Claude
// staged for approve the map (approve-map.cjs), and the discovery session's
// log.
//
// - The map is the staged one while approve the map waits on the person, its
//   topics and parks; else the epic's map, its live topics in order, and
//   nothing parked yet.
// - A topic opens on its brief before it starts (20.11.2), each of the
//   brief's sections by its heading, and on its discussion's page once it
//   has (20.8.3).
// - Its spikes are the unit's spike folders, in the order they started,
//   each reference or canonical as its links give it (asset.cjs), and each
//   opens on its page (20.11.3).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { statePath, cacheScratch } = require('../../kernel/state-root.cjs');
const { stagedOrNone, liveInOrder } = require('../approve-map.cjs');
const { latestSessionLog } = require('../discovery-session.cjs');
const { spikesOf, spikeStatuses } = require('../asset.cjs');
const { headedSections } = require('../markdown-sections.cjs');
const { titlecase } = require('../conventions.cjs');
const { briefFile, computeTopicLifecycle, itemOf, topicKey, topicTitle } = require('../derivations.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').DiscoveryView} DiscoveryView */

/** A topic of the epic's map, with its summary. @param {BoardAt} at @param {string} topic */
function mapLine(at, topic) {
  return { topic, title: topicTitle(at.manifest, topic), summary: String(itemOf(at.manifest, 'discovery', topic)?.summary ?? '') };
}

/** The unit's spikes, in the order they started (the header's). @param {BoardAt} at @returns {import('../board-model.cjs').SpikeLine[]} */
function spikesAt(at) {
  const statuses = spikeStatuses(at.cwd, at.unit, at.warnings);
  return spikesOf(at.root, at.unit).map((spike) => ({ spike, title: titlecase(spike.replace(/^\d+-/, '')), status: statuses.get(spike) ?? null }));
}

/** Discovery's This session (the header's). @param {BoardAt} at @returns {{view: DiscoveryView}} */
function discoveryView(at) {
  const staged = stagedOrNone(at.cwd, at.unit);
  const session = latestSessionLog(statePath(at.cwd, at.unit, 'discovery'));
  return {
    view: {
      kind: 'discovery',
      unit: at.unit,
      title: at.title,
      type: at.manifest.work_type,
      session: session?.number ?? null,
      waits: staged !== null,
      map: staged === null
        ? liveInOrder(at.manifest).map((topic) => mapLine(at, topic))
        : staged.topics.map(({ name, summary }) => (summary === undefined ? mapLine(at, name) : { topic: name, title: topicTitle(at.manifest, name), summary })),
      roadmap: (staged?.parks ?? []).map(({ summary, horizon }) => ({ title: summary, horizon })),
      spikes: spikesAt(at),
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

/** Whether a topic of the unit has started: its lifecycle is past fresh. @param {BoardAt} at @param {string} said */
function topicStarted(at, said) {
  return computeTopicLifecycle(at.manifest, topicKey(at.manifest, said)).lifecycle !== 'fresh';
}

/** A brief's text from its file, empty where none is written. @param {string} file */
const textOf = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

/**
 * A topic's brief (20.11.2): its place on the map, its summary and its
 * brief's sections — while approve the map waits, the staged map's, a topic
 * new to it read from its draft; refused where the map lacks the topic.
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
  };
}

/**
 * A spike's page (20.11.3), by its folder; refused where the unit has no
 * such spike.
 * @param {BoardAt} at @param {string} spike @returns {import('../board-model.cjs').SpikePage}
 */
function spikePage(at, spike) {
  const line = spikesAt(at).find((held) => held.spike === spike);
  if (line === undefined) throw new Error(`${at.unit} has no spike ${spike}`);
  return { kind: 'spike', unit: at.unit, ...line, path: path.posix.join(at.unit, 'spikes', spike) };
}

module.exports = { discoveryView, discoveryBanner, briefPage, topicStarted, spikePage };

'use strict';

// ---------------------------------------------------------------------------
// Domain ring: an experiment on the board (20.13) — This session in an
// experiment, read from the topic's experiment series on the manifest
// (experiment.cjs) and the question it measures on the ledger.
//
// - The experiment shown is the topic's live one, the latest by id; else
//   its latest, concluded or abandoned.
// - Its question is the map's question it measures (9.1.11), else its slug
//   titled; the day it was approved is the one `experiment approve` held on
//   the record, none where the record holds none.
// - Its problem, design and report are Claude's documents in its record's
//   folder (experiment-paths.cjs): the view carries the problem as the topic
//   put it, the design by its sections once written, and whether the report
//   is, which opens in full on its page.
// - Its runs are the tally `experiment runs` last recorded on the record,
//   each condition with its runs done of its runs and their median; the
//   banner counts them while it runs (20.2.4).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { statePath } = require('../../kernel/state-root.cjs');
const { EXPERIMENT_TERMINAL_STATUSES, compareExperimentIds } = require('../../kernel/manifest-schema.cjs');
const { recordDir } = require('../experiment-paths.cjs');
const { withUnitEntries } = require('../unit-entries.cjs');
const { headedSections } = require('../markdown-sections.cjs');
const { titlecase } = require('../conventions.cjs');
const { topicKey, topicTitle } = require('../derivations.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').ExperimentView} ExperimentView */

/**
 * The topic's experiment the session is in (the header's), refused where
 * the topic has none.
 * @param {BoardAt} at @param {string} topic @returns {[string, Record<string, any>]}
 */
function experimentOf(at, topic) {
  const records = Object.entries(at.manifest.phases?.experiment?.items?.[topic]?.experiments ?? {}).sort(([a], [b]) => compareExperimentIds(a, b));
  const live = records.filter(([, record]) => !EXPERIMENT_TERMINAL_STATUSES.includes(record.status));
  const shown = live.at(-1) ?? records.at(-1);
  if (shown === undefined) throw new Error(`${topicTitle(at.manifest, topic)} has run no experiment`);
  return shown;
}

/** A document of the topic's experiment `id`, empty where it is not written. @param {BoardAt} at @param {string} topic @param {string} id @param {string} name */
function recordText(at, topic, id, name) {
  const file = statePath(at.cwd, path.join(recordDir(at.unit, topic, id, at.manifest.phases.experiment.items[topic].experiments), name));
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

/** The runs recorded on an experiment's record, by condition, none before the first. @param {Record<string, any>} record @returns {import('../board-model.cjs').RunsLine[]} */
const runsOf = (record) => (record.runs ?? []).map((/** @type {Record<string, any>} */ { condition, of, done, median, unit }) => ({ condition, of, done, median, unit: unit ?? null }));

/** An experiment's This session (the header's). @param {BoardAt} at @returns {{view: ExperimentView}} */
function experimentView(at) {
  const topic = topicKey(at.manifest, /** @type {string} */ (at.place.topic));
  const [id, record] = experimentOf(at, topic);
  const report = recordText(at, topic, id, 'report.md');
  const question = typeof record.question === 'string'
    ? withUnitEntries(at.cwd, at.unit, at.warnings, ({ entries }) => entries.get(record.question)?.line.text)
    : undefined;
  return {
    view: {
      kind: 'experiment',
      unit: at.unit,
      title: at.title,
      type: at.manifest.work_type,
      id,
      question: typeof question === 'string' ? question : titlecase(record.slug),
      topic,
      topic_title: topicTitle(at.manifest, topic),
      status: record.status,
      approved: typeof record.approved === 'string' ? record.approved : null,
      verdict: record.verdict ?? null,
      reason: record.reason ?? null,
      problem: recordText(at, topic, id, 'problem.md').trim(),
      design: headedSections(recordText(at, topic, id, 'design.md')),
      runs: runsOf(record),
      report: report.trim() !== '',
    },
  };
}

/**
 * The report of a topic's experiment read in full (20.13.1); refused where
 * the topic has no such experiment, or its report is not written.
 * @param {BoardAt} at @param {string} said @param {string} id @returns {import('../board-model.cjs').ReportPage}
 */
function reportPage(at, said, id) {
  const topic = topicKey(at.manifest, said);
  const held = at.manifest.phases?.experiment?.items?.[topic]?.experiments?.[id];
  const text = held === undefined ? '' : recordText(at, topic, id, 'report.md');
  if (text.trim() === '') throw new Error(`${topicTitle(at.manifest, topic)}'s experiment ${id} has no report written`);
  return { kind: 'experiment-report', unit: at.unit, topic, id, text };
}

/**
 * The banner's facts in an experiment (20.2.4): its id, then its runs done
 * of all while it runs with runs recorded, else where it stands —
 * concluded once its verdict is in.
 * @param {ExperimentView} view @returns {{state: 'running'|'done', facts: {text: string, needs: boolean}[]}}
 */
function experimentBanner({ type, id, status, runs }) {
  const fact = (/** @type {string} */ text) => ({ text, needs: false });
  const ended = EXPERIMENT_TERMINAL_STATUSES.includes(status);
  const sum = (/** @type {'done'|'of'} */ key) => runs.reduce((total, line) => total + line[key], 0);
  const standing = ended || runs.length === 0 ? status : `${sum('done')} of ${sum('of')} runs`;
  return { state: ended ? 'done' : 'running', facts: [fact(type), fact(`experiment ${id}`), fact(standing)] };
}

module.exports = { experimentView, experimentBanner, reportPage };

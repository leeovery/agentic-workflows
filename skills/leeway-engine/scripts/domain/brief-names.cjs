'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what a brief is called (6.5), shared by its fill (brief.cjs)
// and the hook before Agent and SendMessage (brief-guard.cjs). Each role
// names the agent it is dispatched as, whose brief its first line says it
// is, and the records its brief draws on (6.5.4, 6.5.11): the reviewer's
// agent is dispatched for a task and for a phase's review, each with its
// own template (6.5.2), and the builder's for a task and its fix rounds. A
// brief is kept in the folder of the conversation that issued it
// (conversation.cjs):
// `briefs/{id}.md`, what the agent is handed, and beside it `{id}.json`,
// whose it is, `{role, agent, unit, task, topic}`. A dispatch carries it
// by its pointer, `brief:{id}`, alone; the hook's refusals are appended to
// `brief-refusals.jsonl` in the system config directory.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { conversationDir } = require('./conversation.cjs');

/** The folder of a conversation's briefs. */
const BRIEFS = 'briefs';

/** The brief hook's refusals, in the system config directory (brief-guard.cjs). */
const BRIEF_REFUSALS = 'brief-refusals.jsonl';

/** What a dispatch carries in place of its brief, before the brief's id. */
const POINTER = 'brief:';

/** A brief's id, as `newId` mints one. */
const ID = '[0-9A-Za-z]+';

/** A pointer anywhere in a text, its id captured. */
const POINTED = new RegExp(`${POINTER}(${ID})`);

/** How the workflows' agents are named: the hook acts on every agent so named, and on no other. */
const OURS = 'leeway-';

/**
 * Each role: the agent it is dispatched as, named `{OURS}…`, whose brief
 * its first line says it is, the records its brief draws on, by their
 * slots, and, for a role whose agent writes its report into an agent store
 * — its topic's, or for a unit's role the unit's — the kind of dispatch it
 * is briefed for (agent-state.cjs).
 * @type {Readonly<Record<string, {agent: string, whose: string, records: readonly string[], kind?: string}>>}
 */
const ROLES = Object.freeze({
  builder: { agent: 'leeway-builder', whose: 'the builder\'s', records: ['task', 'spec-sections', 'decided-calls', 'linters'] },
  reviewer: { agent: 'leeway-reviewer', whose: 'the reviewer\'s', records: ['task', 'spec-sections', 'decided-calls', 'diff-range', 'linters', 'round-report-to'] },
  fix: { agent: 'leeway-builder', whose: 'the fix round\'s', records: ['reports'] },
  'product-researcher': { agent: 'leeway-product-researcher', whose: 'the product researcher\'s', records: [] },
  'deep-dive': {
    agent: 'leeway-deep-dive', whose: 'the deep dive\'s', kind: 'deep-dive', records: ['question', 'dive-kind', 'topic-record', 'product-record', 'report-to'],
  },
  perspective: {
    agent: 'leeway-discussion-perspective', whose: 'the perspective\'s', kind: 'perspective', records: ['question', 'lens', 'topic-record', 'product-record', 'report-to'],
  },
  synthesis: {
    agent: 'leeway-discussion-synthesis', whose: 'the synthesis\'s', kind: 'synthesis', records: ['pair-question', 'perspectives', 'topic-record', 'report-to'],
  },
  'discussion-reviewer': {
    agent: 'leeway-discussion-reviewer', whose: 'the discussion reviewer\'s', kind: 'review', records: ['topic-record', 'topic-log', 'other-records', 'product-record', 'report-to'],
  },
  'closing-pass-reader': {
    agent: 'leeway-closing-pass-reader',
    whose: 'the closing-pass reader\'s',
    kind: 'closing-pass',
    records: ['topic-record', 'topic-log', 'other-records', 'product-record', 'gap-review', 'dismissed', 'report-to'],
  },
  'plain-search': { agent: 'leeway-plain-search', whose: 'the plain search\'s', records: ['knowledge-query'] },
  'migration-topic': { agent: 'leeway-migration-topic', whose: 'the migration\'s, for one topic', records: ['migrated-topic', 'verifier-findings', 'carry-refusal', 'directive'] },
  'migration-verifier': { agent: 'leeway-migration-verifier', whose: 'the migration verifier\'s', records: ['migrated-topic', 'composed-record', 'directive'] },
  'phase-cut': { agent: 'leeway-phase-cut', whose: 'the phase cut\'s', records: ['spec-outline', 'spec-scenarios', 'relies-on-graph', 'cut-requests', 'cut-refusal', 'cut-to'] },
  sweep: { agent: 'leeway-sweep', whose: 'the sweep\'s', records: ['unit-records', 'product-record', 'dismissed', 'sweep-refusal', 'sweep-to'] },
  'spec-writer': {
    agent: 'leeway-spec-writer',
    whose: 'the spec writer\'s',
    records: ['spec-to', 'unit-records', 'topic-logs', 'canonical-assets', 'builder-calls', 'changed-entries', 'review-findings', 'wording-changes', 'held-numbers', 'invented-lines', 'land-refusal'],
  },
  'spec-reviewer': {
    agent: 'leeway-spec-reviewer',
    whose: 'the spec reviewer\'s',
    kind: 'spec-review',
    records: ['changed-sections', 'invented-lines', 'measured-findings', 'product-cites', 'unit-records', 'builder-calls', 'report-refusal', 'unit-report-to'],
  },
  'task-writer': {
    agent: 'leeway-task-writer',
    whose: 'the task writer\'s',
    records: ['cut-phase', 'phase-sections', 'phase-scenarios', 'held-notes', 'written-tasks', 'earlier-tasks', 'build-calls', 'affected-entries', 'task-files-to'],
  },
  consolidation: {
    agent: 'leeway-consolidation', whose: 'the consolidation agent\'s', records: ['phase-notes', 'phase-tasks', 'phase-diff-range', 'consolidation-to', 'task-files-to'],
  },
  'phase-review': {
    agent: 'leeway-reviewer', whose: 'the phase review\'s', records: ['cut-phase', 'phase-sections', 'phase-criteria', 'relied-on', 'decided-calls', 'phase-diff-range', 'recorded-runs', 'mutants', 'linters', 'phase-report-to'],
  },
});

/** Where a conversation keeps a brief. @param {string} session @param {string} id */
function briefPath(session, id) {
  return path.join(conversationDir(session), BRIEFS, `${id}.md`);
}

/** Where a conversation keeps the record of whose a brief is. @param {string} session @param {string} id */
function issuedPath(session, id) {
  return path.join(conversationDir(session), BRIEFS, `${id}.json`);
}

/** @typedef {{role: string, agent: string, unit: string|null, task: string|null, topic: string|null}} Issued */

/** The pointer a dispatch carries for a brief. @param {string} id */
function pointerOf(id) {
  return `${POINTER}${id}`;
}

/** The id the first pointer in a text names; null where it holds none. @param {string} text */
function pointedId(text) {
  return POINTED.exec(text)?.[1] ?? null;
}

/** Whether a value reads as a brief's id. @param {unknown} value @returns {value is string} */
function isBriefId(value) {
  return typeof value === 'string' && new RegExp(`^${ID}$`).test(value);
}

/**
 * The record of whose the brief `id` is, as the conversation `session`
 * stored it beside the brief; null where it stored none, or it names no
 * agent.
 * @param {string} session @param {string} id @returns {Issued|null}
 */
function issuedOf(session, id) {
  try {
    const issued = JSON.parse(fs.readFileSync(issuedPath(session, id), 'utf8'));
    return issued !== null && typeof issued === 'object' && typeof issued.agent === 'string' ? issued : null;
  } catch {
    return null;
  }
}

module.exports = { OURS, POINTER, ROLES, BRIEFS, BRIEF_REFUSALS, briefPath, issuedPath, pointerOf, pointedId, isBriefId, issuedOf };

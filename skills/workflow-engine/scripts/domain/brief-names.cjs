'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what a brief is called (6.5), shared by its fill (brief.cjs)
// and the hook before Agent and SendMessage (brief-guard.cjs). Each role
// names the agent it is dispatched as, whose brief its first line says it
// is, and the records its brief draws on (6.5.4, 6.5.11). A brief is kept
// in the folder of the conversation that issued it (conversation.cjs):
// `briefs/{id}.md`, what the agent is handed, and beside it `{id}.json`,
// whose it is, `{role, agent, unit, task}`. A dispatch carries it
// by its pointer, `brief:{id}`, alone; the hook's refusals are appended to
// `brief-refusals.jsonl` in the system config directory.
// ---------------------------------------------------------------------------

const path = require('path');
const { conversationDir } = require('./conversation.cjs');

/** The folder of a conversation's briefs. */
const BRIEFS = 'briefs';

/** The brief hook's refusals, in the system config directory (brief-guard.cjs). */
const BRIEF_REFUSALS = 'brief-refusals.jsonl';

/** What a dispatch carries in place of its brief, before the brief's id. */
const POINTER = 'brief:';

/** A pointer anywhere in a text, its id captured. */
const POINTED = new RegExp(`${POINTER}([0-9A-Za-z]+)`);

/**
 * Each role: the agent it is dispatched as, whose brief its first line says
 * it is, and the records its brief draws on, by their slots.
 * @type {Readonly<Record<string, {agent: string, whose: string, records: readonly string[]}>>}
 */
const ROLES = Object.freeze({
  builder: { agent: 'leeway-builder', whose: 'the builder\'s', records: ['task', 'spec-sections', 'decided-calls', 'linters'] },
  'product-researcher': { agent: 'leeway-product-researcher', whose: 'the product researcher\'s', records: [] },
});

/** Where a conversation keeps a brief. @param {string} session @param {string} id */
function briefPath(session, id) {
  return path.join(conversationDir(session), BRIEFS, `${id}.md`);
}

/** Where a conversation keeps the record of whose a brief is. @param {string} session @param {string} id */
function issuedPath(session, id) {
  return path.join(conversationDir(session), BRIEFS, `${id}.json`);
}

/** @typedef {{role: string, agent: string, unit: string|null, task: string|null}} Issued */

/** The pointer a dispatch carries for a brief. @param {string} id */
function pointerOf(id) {
  return `${POINTER}${id}`;
}

/** The id the first pointer in a text names; null where it holds none. @param {string} text */
function pointedId(text) {
  return POINTED.exec(text)?.[1] ?? null;
}

module.exports = { ROLES, BRIEFS, BRIEF_REFUSALS, briefPath, issuedPath, pointerOf, pointedId };

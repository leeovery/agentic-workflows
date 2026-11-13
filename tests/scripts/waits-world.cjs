'use strict';

// ---------------------------------------------------------------------------
// What the waits suites share (test-engine-waits.cjs,
// test-engine-waits-spec.cjs, test-engine-waits-bug.cjs,
// test-engine-waits-build.cjs, test-engine-waits-quick-fix.cjs): what waits
// in each unit named, read in process, in the conversation named or in none;
// how far a unit has come, as its row says it; a door into a phase of a
// unit, and into a topic; and a wait as the read lists it, a raise the
// conversation sealed by its seal's id.
// ---------------------------------------------------------------------------

const assert = require('node:assert');
const path = require('path');
const { readManifest } = require('./engine-harness.cjs');
const { withEnv } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { waitsOf } = require(path.join(SCRIPTS, 'domain/waits.cjs'));
const { progressOf, progressWords } = require(path.join(SCRIPTS, 'domain/progress.cjs'));

/** @typedef {import('../../skills/leeway-engine/scripts/domain/waits.cjs').Wait} Wait */

/** A wait listed (the header's). @typedef {Omit<Wait, 'seal'> & {seal?: string}} Listed */

/**
 * What waits in each unit named, read in the conversation `session` — none
 * where it is not given — its seals in `config`; the read warns of nothing.
 * @param {string} dir @param {string[]} units @param {{verdicts?: boolean, config?: string, session?: string}} [opts]
 * @returns {Record<string, Listed[]>}
 */
function waitsIn(dir, units, { verdicts = false, config, session } = {}) {
  const read = () => waitsOf(dir, units.map((unit) => readManifest(dir, unit)), { verdicts, session: session ?? null });
  const { waits, warnings } = config === undefined ? read() : withEnv({ LEEWAY_CONFIG_DIR: config }, read);
  assert.deepStrictEqual(warnings, []);
  return Object.fromEntries([...waits].map(([unit, listed]) => [unit, listed.map(({ seal, ...wait }) => (seal === undefined ? wait : { ...wait, seal: seal.id }))]));
}

/** How far a unit has come, as its row says it. @param {string} dir @param {string} unit */
const progress = (dir, unit) => progressWords(progressOf(dir, readManifest(dir, unit)));

/** The door into a phase of a unit. @param {string} skill @param {string} type @param {string} unit */
const door = (skill, type, unit) => ({ kind: 'handoff', skill, args: [type, unit] });

/** The door into a topic of a unit, by `handoff topic`. @param {string} unit @param {string} topic */
const topicDoor = (unit, topic) => ({ kind: 'engine', argv: ['handoff', 'topic', unit, topic] });

/** A wait as the read lists it. @param {Wait['kind']} kind @param {string} id @param {string} text @param {Wait['next']} next @param {string|null} [topic] @returns {Wait} */
const wait = (kind, id, text, next, topic = null) => ({ kind, id, text, topic, next });

/** A raise the conversation sealed, as the read lists it: the wait, and the seal it waits as. @param {Wait} raised @param {string} seal @returns {Listed} */
const sealed = (raised, seal) => ({ ...raised, seal });

module.exports = { waitsIn, progress, door, topicDoor, wait, sealed };

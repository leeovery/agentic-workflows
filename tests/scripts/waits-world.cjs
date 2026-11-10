'use strict';

// ---------------------------------------------------------------------------
// What the waits suites share (test-engine-waits.cjs,
// test-engine-waits-build.cjs, test-engine-waits-quick-fix.cjs): what
// waits in each unit named, read in process with no conversation of its
// own; how far a unit has come, as its row says it; a door into a phase of
// a unit; and a wait as the read lists it.
// ---------------------------------------------------------------------------

const assert = require('node:assert');
const path = require('path');
const { readManifest } = require('./engine-harness.cjs');
const { withEnv } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { waitsOf } = require(path.join(SCRIPTS, 'domain/waits.cjs'));
const { progressOf, progressWords } = require(path.join(SCRIPTS, 'domain/progress.cjs'));

/** @typedef {import('../../skills/leeway-engine/scripts/domain/waits.cjs').Wait} Wait */

/**
 * What waits in each unit named, read with no conversation, the trust log
 * and the conversations' seals in `config` where one is given; the read
 * warns of nothing.
 * @param {string} dir @param {string[]} units @param {{verdicts?: boolean, config?: string}} [opts]
 * @returns {Record<string, Wait[]>}
 */
function waitsIn(dir, units, { verdicts = false, config } = {}) {
  const read = () => waitsOf(dir, units.map((unit) => readManifest(dir, unit)), { verdicts });
  const { waits, warnings } = config === undefined ? read() : withEnv({ LEEWAY_CONFIG_DIR: config }, read);
  assert.deepStrictEqual(warnings, []);
  return Object.fromEntries(waits);
}

/** How far a unit has come, as its row says it. @param {string} dir @param {string} unit */
const progress = (dir, unit) => progressWords(progressOf(dir, readManifest(dir, unit)));

/** The door into a phase of a unit, at its topic where one is named. @param {string} skill @param {string} type @param {string} unit @param {string} [topic] */
const door = (skill, type, unit, topic) => ({ kind: 'handoff', skill, args: [type, unit, ...(topic === undefined ? [] : [topic])] });

/** A wait as the read lists it. @param {Wait['kind']} kind @param {string} id @param {string} text @param {Wait['next']} next @param {string|null} [topic] @returns {Wait} */
const wait = (kind, id, text, next, topic = null) => ({ kind, id, text, topic, next });

module.exports = { waitsIn, progress, door, wait };

'use strict';

// ---------------------------------------------------------------------------
// What the matrix's suites share (test-engine-matrix.cjs,
// test-engine-matrix-replay.cjs): trust-world.cjs's folder for each test,
// its config folder holding the trust log, the record, the settings and the
// conversation (`useMatrixWorld`) — and in it, as `fumi`, a copy of a
// project world built once: its unit's manifest written, the note window
// and the menu bar under discussion and the tray cancelled. The engine runs
// in process through the harness, on the frozen clock, in one conversation:
// a surface drawn, a command run or refused, a row picked at the gate shown.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');

const { ok, output, refuses, screenOf, readState, layout, fixtureFrom, withFrozenClock } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { idOf, SESSION, lines, useTrustWorld } = require('./trust-world.cjs');

const ENV = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION });
const UNIT = 'fumi';
const OTHER = idOf('Aircon');

/** An engine command a row leads to. @param {...string} argv */
const engine = (...argv) => ({ kind: 'engine', argv });
const CARRY_ON = Object.freeze({ kind: 'continue' });

/** A surface drawn in the conversation on the frozen clock. @param {string} dir @param {string[]} args */
const render = (dir, args) => withFrozenClock(() => output(dir, ['render', ...args], { env: ENV }));

/** A command that must succeed in the conversation on the frozen clock: its response. @param {string} dir @param {string[]} args */
const run = (dir, args) => withFrozenClock(() => ok(dir, args, { env: ENV }));

/** A command refused in the conversation on the frozen clock: its error. @param {string} dir @param {string[]} args */
const refused = (dir, args) => withFrozenClock(() => refuses(dir, args, { env: ENV }).error);

/** The person's pick of the row `key` at the gate `gate` shown: the gate's response. @param {string} dir @param {string} gate @param {string} key */
const pick = (dir, gate, key) => run(dir, ['gate', gate, '--pick', key]);

/** A screen as read: its title, then each section's lines. @param {string} out @param {string[]} sections */
const screen = (out, sections) => sections.flatMap((name) => (name === 'TITLE' ? screenOf(out, name).map((line) => line.replace(/^# /, '')) : screenOf(out, name)));

// The project world: its unit's topics, the note window and the menu bar
// under discussion, and the tray cancelled.
const world = fixtureFrom('engine-matrix-', (dir) => {
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: { discussion: { items: { 'note-window': { status: 'in-progress' }, 'menu-bar': { status: 'in-progress' }, tray: { status: 'cancelled' } } } },
  });
});

/**
 * Each test's folder, its config folder holding the trust log, the record,
 * the settings and the conversation, for the suite's tests named `prefix`:
 * the folder, the trust log, and the project world copied into it.
 * @param {string} prefix
 */
function useMatrixWorld(prefix) {
  const { folder, logPath } = useTrustWorld(prefix);

  /** The log holding `events`. @param {Record<string, unknown>[]} events */
  function logHolding(events) {
    fs.mkdirSync(path.dirname(logPath()), { recursive: true });
    fs.writeFileSync(logPath(), lines(...events));
  }

  /** The settings file in this test's config folder. */
  const settingsFile = () => path.join(folder(), 'config', 'config.json');

  /** The settings file holding `text`, as the person or the knowledge base's setup left it. @param {string} text */
  function settingsHolding(text) {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), text);
  }

  /** This test's project, `fumi`, and the id the trust log keys it by. */
  function fumi() {
    const dir = world(path.join(folder(), 'fumi'));
    return { dir, id: /** @type {string} */ (JSON.parse(readState(dir, layout.projectManifest)).project_id) };
  }

  /** The record of the person holding the care entries `entries` alone, each `[kind, project id, when added]`, the project Fumi. @param {...[string, string, number]} entries */
  function careHeld(...entries) {
    fs.mkdirSync(path.join(folder(), 'config'), { recursive: true });
    fs.writeFileSync(path.join(folder(), 'config', 'person.md'), `<!-- leeway: the record of you, version 1 -->\n\n# The record of you\n\n## Care entries\n\n${entries.map(([kind, id, added]) => `- Fumi: ${kind} · ${id} · ${new Date(added).toISOString()}`).join('\n')}\n`);
  }

  return { folder, logPath, logHolding, settingsFile, settingsHolding, fumi, careHeld };
}

module.exports = { UNIT, OTHER, engine, CARRY_ON, render, run, refused, pick, screen, useMatrixWorld };

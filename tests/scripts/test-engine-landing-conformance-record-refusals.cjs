'use strict';

// ---------------------------------------------------------------------------
// The landing record where a `land` verb refuses or its record fails
// (landing-record.cjs, 7.2.22), against each shipped driver in turn. A
// refusal records nothing where nothing moved, as every refusal leaves the
// state as it found it; one after a merge records what that merge landed,
// by the engine, and nothing its read found landed by hand. A record not
// written after a merge leaves the verb's answer standing, a warning beside
// it, and the next verb acting on the landing records the task by its read.
// A task whose branch was rewritten, merged into or left behind after its
// landing is test-engine-landing-conformance-record-rewritten.cjs's,
// -merged-past.cjs's and -behind.cjs's. Conformance layer: the landing
// world (landing-world.cjs), built once per driver and copied for each
// test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { fixtureFrom, cleanupFixture, readManifest, stateGit } = harness;
const { UNIT, TASKS, openArgs, own, cutTask, buildLanding, finishReady } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

const { card, rounding } = TASKS;

for (const { name } of listDrivers('landing')) {
  /**
   * @type {{
   *   env: Record<string, string|undefined>, prepare: (dir: string) => void,
   *   byHand: Record<string, (dir: string, branch: string) => void>,
   * }}
   */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const as = { env: side.env };
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, as);
  const refused = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.refuses(at, args, as).error;
  const world = fixtureFrom(`engine-landing-record-refusals-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });
  /** The unit's landing records in the project's repository, each task's as `by`. @param {string} at */
  const recordedBy = (at) => Object.fromEntries(Object.entries(readManifest(at, UNIT).landings ?? {}).map(([id, byRepo]) => [id, /** @type {any} */ (byRepo)['.'].by]));
  /** The state branch's newest commit's subject. @param {string} at */
  const lastState = (at) => stateGit(at, ['log', '-1', '--format=%s']).trim();

  describe(`the ${name} landing driver's landing record where a verb refuses or its record fails (7.2.22)`, () => {
    it('a refusal records nothing where nothing moved: the state branch as it was', () => {
      const at = (dir = world());
      const before = lastState(at);
      refused(at, ['land', 'phase', UNIT, '1']);

      assert.deepStrictEqual([readManifest(at, UNIT).landings, lastState(at)], [undefined, before]);
    });

    it('a refusal after a merge records what that merge landed and nothing else: land finish merges phase 1, then refuses on phase 4\'s conflict with it, 1.1 recorded by the engine, 2.1 landed by hand after the last verb unrecorded', () => {
      const at = (dir = world());
      ok(at, openArgs(card));
      ok(at, openArgs(rounding));
      ok(at, openArgs(cutTask(at, '4.1', 'fix', 'Word the card', 'main', { 'card.txt': 'a card\n' })));
      Object.values(side.byHand)[0](at, rounding.branch);
      finishReady(at);
      refused(at, ['land', 'finish', UNIT]);

      assert.deepStrictEqual([recordedBy(at), lastState(at)], [{ [`${UNIT}-1-1`]: 'engine' }, `land(${UNIT}): record 1.1 landed`]);
    });

    it('a record not written after a merge leaves the verb\'s answer standing, a warning beside it, and the next verb acting on the landing records the task by its read', (t) => {
      const at = (dir = world());
      ok(at, openArgs(card));
      const write = fs.writeFileSync;
      t.mock.method(fs, 'writeFileSync', (/** @type {fs.PathOrFileDescriptor} */ file, /** @type {string} */ text, /** @type {fs.WriteFileOptions} */ options) => {
        if (String(file).endsWith('.tmp') && String(text).includes('"landings"')) throw new Error('the disk is full');
        return write(file, text, options);
      });
      const merged = ok(at, ['land', 'phase', UNIT, '1']);
      t.mock.restoreAll();
      const unrecorded = readManifest(at, UNIT).landings;
      const again = ok(at, ['land', 'phase', UNIT, '1']);

      assert.deepStrictEqual([own(merged).merged, merged.warnings.filter((/** @type {string} */ said) => said.startsWith('the landing record')), unrecorded, again.already, recordedBy(at)], [
        ['1.1'], ['the landing record was not written (the disk is full) — the next verb acting on the landing records it'], undefined, true, { [`${UNIT}-1-1`]: 'read' },
      ]);
    });
  });
}

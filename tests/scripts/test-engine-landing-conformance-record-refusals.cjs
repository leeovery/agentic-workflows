'use strict';

// ---------------------------------------------------------------------------
// The landing record where a `land` verb refuses or its record fails
// (landing-record.cjs, 7.2.22), against each shipped driver in turn. A
// refusal records nothing where nothing moved, as every refusal leaves the
// state as it found it; one after a merge records what that merge landed,
// by the engine, and nothing its read found landed by hand. A task landed
// by hand whose branch is rewritten past the default branch before any verb
// read it is refused by `land open`, `land phase` and `land finish` alike,
// before anything moves, naming the commit that landed and the way back to
// it; put back, it is recorded by its read at that landing and that commit
// (F1). A record not written after a merge leaves the verb's answer
// standing, a warning beside it, and the next verb acting on the landing
// records the task by its read. Conformance layer: the landing world
// (landing-world.cjs), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { tip, git, fixtureFrom, cleanupFixture, readManifest, stateGit } = harness;
const { UNIT, BASE, TASKS, openArgs, own, cutTask, commitFiles, buildLanding, finishReady } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { card, rounding } = TASKS;

for (const { name } of listDrivers('landing')) {
  /** @type {{env: Record<string, string|undefined>, prepare: (dir: string) => void, byHand: Record<string, (dir: string, branch: string) => void>}} */
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

    it('a task landed by hand, then its branch rewritten past the default branch before any verb read it: land open, land phase and land finish each refuse before anything moves, naming the commit that landed and the way back to it; put back, land open answers already, recording it by its read at that landing and that commit (F1)', () => {
      const at = (dir = world());
      ok(at, openArgs(card));
      const landed = tip(at, card.branch);
      Object.values(side.byHand)[0](at, card.branch);
      const landing = tip(at, 'main');
      commitFiles(at, card.branch, BASE, { 'card.txt': 'card, rewritten\n' });
      const refusals = [openArgs(card), ['land', 'phase', UNIT, '1']].map((args) => refused(at, args));
      finishReady(at);
      refusals.push(refused(at, ['land', 'finish', UNIT]));
      const stood = tip(at, 'main');
      git(at, ['branch', '-f', card.branch, landed]);
      const again = ok(at, openArgs(card));
      const { by, commit, tip: recorded } = readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'];

      assert.deepStrictEqual([refusals, stood, again.already, [by, commit, recorded]], [
        Array(3).fill(`land: task 1.1's branch ${card.branch} was rewritten after its work landed on main (${landing.slice(0, 7)}): its commit ${landed.slice(0, 7)} landed, and the branch no longer holds it — put the branch back where it landed, git branch -f ${card.branch} ${landed.slice(0, 7)}, and run this again; work past that goes on top of it`),
        landing, true, ['read', landing, landed],
      ]);
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

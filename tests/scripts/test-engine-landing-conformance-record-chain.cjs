'use strict';

// ---------------------------------------------------------------------------
// A chain whose later task rewrites, then deletes, the earlier task's lines
// (task-landed.cjs, the ancestor rule; landing-record.cjs, 7.2.22), through
// the `land` verbs, against each shipped driver in turn: task 1.5 cut from
// 1.4, rewriting then deleting 1.4's lines, so 1.4's own change never
// reaches the default branch, yet it lands with the chain above it. Landed
// by `land phase` (round 7's S1), both are recorded, a second merging
// nothing. Landed with no record, as the engine before the record or a
// crash between a merge and its record leaves it, the later task then
// changed after its landing, the first verb acting on it lands that change
// alone and records the earlier task by its read, the later by the engine
// with its first landing kept. Landed by hand — squashed under the default
// message, squashed under the person's own, or with a merge commit —
// `land phase` records both by its read and lands neither again.
// Conformance layer: the landing world (landing-world.cjs), the chain
// opened in it, built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git, tip, fixtureFrom, cleanupFixture, readManifest, writeState, commitAll } = harness;
const { UNIT, openArgs, own, cutTask, commitFiles, buildLanding } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const WAYS = ['a squash under the default message', 'a squash under the person\'s own message', 'a merge commit'];

for (const { name } of listDrivers('landing')) {
  /** @type {{env: Record<string, string|undefined>, prepare: (dir: string) => void, phaseByHand: Record<string, (dir: string, phase: number) => void>}} */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const as = { env: side.env };
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, as);
  /** The chain's two tasks, as the world cut them. @type {{earlier: {branch: string}, later: {branch: string}}} */
  const chain = { earlier: { branch: '' }, later: { branch: '' } };
  const world = fixtureFrom(`engine-landing-record-chain-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
    const earlier = cutTask(dir, '1.4', 'feat', 'Write tip', 'main', { 'tip.txt': 'one\n' });
    commitFiles(dir, earlier.branch, earlier.branch, { 'tip.txt': 'one\ntwo\n' });
    const later = cutTask(dir, '1.5', 'feat', 'Take note', earlier.branch, { 'note.txt': 'note\n' });
    commitFiles(dir, later.branch, later.branch, { 'tip.txt': 'rewritten\n' });
    commitFiles(dir, later.branch, later.branch, {}, { removed: ['tip.txt'] });
    ok(dir, openArgs(earlier));
    ok(dir, openArgs(later));
    Object.assign(chain, { earlier, later });
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });

  describe(`the ${name} landing driver's chain, 1.5 cut from 1.4 rewriting then deleting its lines (the ancestor rule, 7.2.22)`, () => {
    it('land phase records both, and a second merges nothing (S1)', () => {
      const at = (dir = world());
      ok(at, ['land', 'phase', UNIT, '1']);
      const again = ok(at, ['land', 'phase', UNIT, '1']);

      assert.deepStrictEqual([Object.keys(readManifest(at, UNIT).landings).sort(), again.already, git(at, ['ls-tree', '--name-only', 'main', '--', 'tip.txt', 'note.txt']).trim()], [
        [`${UNIT}-1-4`, `${UNIT}-1-5`], true, 'note.txt',
      ]);
    });

    it('landed with no record, as the engine before the record or a crash between a merge and its record leaves it, the later task then changed after its landing: the first land phase lands that change alone, recording the earlier by its read at its landing and the later by the engine at that change\'s, its first landing kept, and a second merges nothing (S1, R29, R30)', () => {
      const at = (dir = world());
      ok(at, ['land', 'phase', UNIT, '1']);
      const landings = [tip(at, 'main~1'), tip(at, 'main')];
      const manifest = readManifest(at, UNIT);
      delete manifest.landings;
      writeState(at, `${UNIT}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
      commitAll(at, 'no record');
      commitFiles(at, chain.later.branch, chain.later.branch, { 'note-more.txt': 'more\n' });
      const first = own(ok(at, ['land', 'phase', UNIT, '1']));
      const records = [`${UNIT}-1-4`, `${UNIT}-1-5`].map((id) => readManifest(at, UNIT).landings[id]['.']);
      const again = ok(at, ['land', 'phase', UNIT, '1']).already;

      assert.deepStrictEqual([
        first.merged, git(at, ['ls-tree', '--name-only', 'main', '--', 'tip.txt', 'note.txt', 'note-more.txt']).trim().split('\n'),
        records.map(({ by, commit, first: landed, tip: landedTip }) => ({ by, commit, first: landed, tip: landedTip })), again,
      ], [['1.5'], ['note-more.txt', 'note.txt'], [
        { by: 'read', commit: landings[0], first: landings[0], tip: tip(at, chain.earlier.branch) },
        { by: 'engine', commit: tip(at, 'main'), first: landings[1], tip: tip(at, chain.later.branch) },
      ], true]);
    });

    for (const way of WAYS) {
      it(`its phase landed by ${way}: land phase records both tasks by its read and lands neither again`, () => {
        const at = (dir = world());
        side.phaseByHand[way](at, 1);
        const main = tip(at, 'main');
        const answer = ok(at, ['land', 'phase', UNIT, '1']);
        const recorded = Object.entries(readManifest(at, UNIT).landings ?? {}).map(([id, byRepo]) => [id, /** @type {any} */ (byRepo)['.'].by]).sort();

        assert.deepStrictEqual([answer.already, recorded, tip(at, 'main')], [true, [[`${UNIT}-1-4`, 'read'], [`${UNIT}-1-5`, 'read']], main]);
      });
    }
  });
}

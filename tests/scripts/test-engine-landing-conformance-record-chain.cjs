'use strict';

// ---------------------------------------------------------------------------
// A chain whose later task rewrites, then deletes, the earlier task's lines
// (task-landed.cjs, the chain read; landing-record.cjs, 7.2.22), through
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
// `land phase` records both by its read and lands neither again. 1.5's
// branch alone squashed by hand, exactly or with a change of the person's
// own in the same commit, lands 1.4 with it, the whole of 1.5's work from
// its cut landed holding 1.4's (S2) — and so where its note is worded the
// person's way in the squash, then worded back in a commit of their own,
// which no one commit holds, so 1.5 lands by its tip read whole alone and
// 1.4 beneath it (`beneath`): never opened, `land open` answers each
// already, recorded by its read where the default branch then stands;
// opened, `land phase` records both so and lands neither again, 1.4's
// lines staying gone. 1.4 alone squashed by hand, 1.5 then opened lays its
// change from where its own work starts, never over their merge base,
// which would bring 1.4's lines back, so `land phase` lands them gone; the
// default branch moved on first, a task cut from 1.5's branch then opened
// lays its change past 1.5's, never its branch's whole tree, which would
// take that move back.
// Conformance layer: the landing world (landing-world.cjs), the chain cut
// in it, and opened in a second, each built once per driver and copied for
// each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git, tip, fixtureFrom, cleanupFixture, readManifest, writeState, commitAll } = harness;
const fs = require('fs');
const { UNIT, openArgs, own, cutTask, commitFiles, buildLanding } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

const WAYS = ['a squash under the default message', 'a squash under the person\'s own message', 'a merge commit'];

for (const { name } of listDrivers('landing')) {
  /**
   * @type {{
   *   env: Record<string, string|undefined>, prepare: (dir: string) => void, phaseByHand: Record<string, (dir: string, phase: number) => void>,
   *   pushed: (dir: string, into: string) => void, defaultTip: (dir: string) => string, holds: (dir: string) => string[], squashedHere: (dir: string, branch: string) => void,
   *   pulled: (dir: string) => void, on: (dir: string) => string,
   * }}
   */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const as = { env: side.env };
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, as);
  /** The chain's two tasks, as the world cut them. @type {{earlier: {branch: string}, later: {branch: string}}} */
  const chain = { earlier: { branch: '' }, later: { branch: '' } };
  /** The chain cut in the world at `dir`, its two tasks. @param {string} dir */
  const cutChain = (dir) => {
    buildLanding(dir);
    side.prepare(dir);
    const earlier = cutTask(dir, '1.4', 'feat', 'Write tip', 'main', { 'tip.txt': 'one\n' });
    commitFiles(dir, earlier.branch, earlier.branch, { 'tip.txt': 'one\ntwo\n' });
    const later = cutTask(dir, '1.5', 'feat', 'Take note', earlier.branch, { 'note.txt': 'note\n' });
    commitFiles(dir, later.branch, later.branch, { 'tip.txt': 'rewritten\n' });
    commitFiles(dir, later.branch, later.branch, {}, { removed: ['tip.txt'] });
    Object.assign(chain, { earlier, later });
    return { earlier, later };
  };
  const cut = fixtureFrom(`engine-landing-record-chain-cut-${name}-`, cutChain);
  const world = fixtureFrom(`engine-landing-record-chain-${name}-`, (dir) => {
    const { earlier, later } = cutChain(dir);
    ok(dir, openArgs(earlier));
    ok(dir, openArgs(later));
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });
  /**
   * 1.5's branch squashed by hand onto the default branch under the
   * person's own message — with a change of their own to app.txt in the
   * same commit where `way` says, or its note worded their own way there,
   * then worded back as the task has it in a commit of its own — and pushed
   * where there is a host: the default branch's tip.
   * @param {string} at @param {'exactly'|'own'|'worded back'} way
   */
  const squashedLater = (at, way) => {
    const back = git(at, ['symbolic-ref', '--short', 'HEAD']).trim();
    git(at, ['switch', '-q', 'main']);
    git(at, ['merge', '-q', '--squash', chain.later.branch]);
    const mine = { exactly: {}, own: { 'app.txt': 'app, reworded in the squash\n' }, 'worded back': { 'note.txt': 'note, in my words\n' } }[way];
    for (const [file, words] of Object.entries(mine)) {
      fs.writeFileSync(path.join(at, file), words);
      git(at, ['add', file]);
    }
    git(at, ['commit', '-q', '-m', 'In my own words']);
    if (way === 'worded back') {
      fs.writeFileSync(path.join(at, 'note.txt'), 'note\n');
      git(at, ['commit', '-q', '-am', 'Word the note as the task has it']);
    }
    side.pushed(at, 'main');
    git(at, ['switch', '-q', back]);
    return side.defaultTip(at);
  };
  /** The chain's records: who landed each and its first landing. @param {string} at */
  const chainRecords = (at) => [`${UNIT}-1-4`, `${UNIT}-1-5`].map((id) => {
    const { by, first } = readManifest(at, UNIT).landings[id]['.'];
    return { by, first };
  });

  describe(`the ${name} landing driver's chain, 1.5 cut from 1.4 rewriting then deleting its lines (the chain read, 7.2.22)`, () => {
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

    for (const [how, way] of /** @type {[string, 'exactly'|'own'|'worded back'][]} */ ([
      ['exactly', 'exactly'],
      ['with a change of the person\'s own in the same commit', 'own'],
      ['with its note worded the person\'s way, then worded back in a commit of their own, its tip read whole the only read landing it', 'worded back'],
    ])) {
      it(`never opened, 1.5's branch squashed by hand ${how}: land open answers each already, both recorded by its read where the default branch then stands, 1.4's lines never landed (S2)`, () => {
        const at = (dir = cut());
        const squash = squashedLater(at, way);
        const answers = [chain.earlier, chain.later].map((task) => ok(at, openArgs(task)).already);

        assert.deepStrictEqual([answers, chainRecords(at), side.holds(at).includes('tip.txt'), side.defaultTip(at)], [
          [true, true], [{ by: 'read', first: squash }, { by: 'read', first: squash }], false, squash,
        ]);
      });

      it(`both opened, 1.5's branch squashed by hand ${how}: land phase records both by its read where the default branch then stands and lands neither again, 1.4's lines staying gone (S2)`, () => {
        const at = (dir = world());
        const squash = squashedLater(at, way);
        const answer = ok(at, ['land', 'phase', UNIT, '1']);

        assert.deepStrictEqual([answer.already, chainRecords(at), side.holds(at).includes('tip.txt'), side.defaultTip(at)], [
          true, [{ by: 'read', first: squash }, { by: 'read', first: squash }], false, squash,
        ]);
      });
    }

    it('never opened, 1.4 alone squashed by hand, then 1.5 opened: its change is laid from where its own work starts, and land phase lands it with 1.4\'s lines gone', () => {
      const at = (dir = cut());
      side.squashedHere(at, chain.earlier.branch);
      ok(at, openArgs(chain.later));
      ok(at, ['land', 'phase', UNIT, '1']);
      const held = side.holds(at);

      assert.deepStrictEqual([held.includes('tip.txt'), held.includes('note.txt'), ok(at, ['land', 'phase', UNIT, '1']).already], [false, true, true]);
    });

    it('never opened, 1.4 alone squashed by hand, the default branch then moving on, 1.5 opened, then 1.6 cut from 1.5\'s branch and opened: 1.6\'s change is laid past 1.5\'s, and land phase lands both, 1.4\'s lines gone and the default branch\'s move kept', () => {
      const at = (dir = cut());
      side.squashedHere(at, chain.earlier.branch);
      side.pulled(at);
      git(at, ['switch', '-q', 'main']);
      fs.writeFileSync(path.join(at, 'app.txt'), 'app, my way\n');
      git(at, ['commit', '-q', '-am', 'Word the app my way']);
      side.pushed(at, 'main');
      ok(at, openArgs(chain.later));
      const next = cutTask(at, '1.6', 'feat', 'Add more', chain.later.branch, { 'more.txt': 'more\n' });
      ok(at, openArgs(next));
      ok(at, ['land', 'phase', UNIT, '1']);
      const held = side.holds(at);

      assert.deepStrictEqual([['tip.txt', 'note.txt', 'more.txt'].map((file) => held.includes(file)), git(side.on(at), ['show', 'main:app.txt'])], [[false, true, true], 'app, my way\n']);
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

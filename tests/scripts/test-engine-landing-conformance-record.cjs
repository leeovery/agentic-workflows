'use strict';

// ---------------------------------------------------------------------------
// The landing record through the `land` verbs (landing-record.cjs, 7.2.22),
// against each shipped driver in turn: a phase landed records each task it
// lands, by the engine, at the commit on the default branch naming it, the
// tip its branch landed at, `first` its landing, committed to the state
// branch; a task recorded stays landed, its branch moved onto its landing
// after, and is read by its record only on a revision whose first-parent
// line holds that landing. A recorded task's branch rewritten past its
// landing is changed after it, and land finish lands its change and reads
// it landed after, the record moved to that landing, `first` kept (R29,
// R30). A chain whose later task rewrites, then deletes, the earlier task's
// lines (round 7's S1) lands with both recorded, a second `land phase`
// merging nothing. A unit landed with no record, as the engine before the
// record or a crash between a merge and its record leaves it — such a
// chain, its later task then changed after its landing — is read at the
// first verb acting on it, which lands that change alone and records the
// earlier task by its read, the later by the engine with its first landing
// kept. A refusal records nothing where nothing moved, as every refusal
// leaves the state as it found it; one after a merge records what that
// merge landed, by the engine, and nothing its read found landed by hand.
// A task landed by hand whose branch is rewritten past the default branch
// before any verb read it is refused at its opening, naming the commit that
// landed and the way back to it (F1). A read for display records nothing.
// Conformance layer: the landing world (landing-world.cjs), built once per
// driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git, tip, fixtureFrom, cleanupFixture, readManifest, stateGit, writeState, commitAll, statePath } = harness;
const { UNIT, BASE, TASKS, TRACKER, openArgs, own, cutTask, commitFiles, buildLanding, mergeBack, finishReady } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { unitLanded } = require('../../skills/leeway-engine/scripts/domain/task-landed.cjs');
const { projectRepos } = require('../../skills/leeway-engine/scripts/kernel/repos.cjs');

const { card, total, rounding } = TASKS;

for (const { name } of listDrivers('landing')) {
  /** @type {{env: Record<string, string|undefined>, prepare: (dir: string) => void}} */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const as = { env: side.env };
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, as);
  const world = fixtureFrom(`engine-landing-record-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });
  const project = () => {
    dir = world();
    return dir;
  };
  /** The unit's landing records, each task's in the project's repository as `[by, the landing's subject — a host's pull request's number aside — its tip, first is its commit]`. @param {string} at */
  const recorded = (at) => Object.fromEntries(Object.entries(readManifest(at, UNIT).landings ?? {}).map(([id, byRepo]) => {
    const { commit, tip: landedTip, first, by } = /** @type {any} */ (byRepo)['.'];
    return [id, [by, git(at, ['log', '-1', '--format=%s', commit]).trim().replace(/ \(#\d+\)$/, ''), landedTip, first === commit]];
  }));
  /** The state branch's newest commit's subject. @param {string} at */
  const lastState = (at) => stateGit(at, ['log', '-1', '--format=%s']).trim();

  describe(`the ${name} landing driver's landing record (7.2.22)`, () => {
    it('records each task a phase lands, by the engine, at the commit naming it, the tip its branch landed at, committed to the state branch; its branch moved onto the landing after, a task stays landed', () => {
      const at = project();
      ok(at, openArgs(total));
      mergeBack(at, card.branch, total.branch);
      ok(at, openArgs(card));
      const tips = [card, total].map(({ branch }) => tip(at, branch));
      ok(at, ['land', 'phase', UNIT, '1']);
      const state = lastState(at);
      git(at, ['branch', '-f', card.branch, 'main']);
      const stays = unitLanded(at, UNIT, projectRepos(at), null).landed({ unit: UNIT, phase: 1, n: 1 });

      assert.deepStrictEqual([recorded(at), state, stays], [{
        [`${UNIT}-1-2`]: ['engine', 'feat(pay): Show total', tips[1], true],
        [`${UNIT}-1-1`]: ['engine', 'feat(pay): Add card', tips[0], true],
      }, `land(${UNIT}): record 1.2, 1.1 landed`, true]);
    });

    it('a recorded landing is read only on a revision whose first-parent line holds it: the task not landed on the commit before it, landed on it', () => {
      const at = project();
      ok(at, openArgs(card));
      ok(at, ['land', 'phase', UNIT, '1']);
      const [repo] = projectRepos(at);
      const read = unitLanded(at, UNIT, [repo], null);

      assert.deepStrictEqual(['main~1', 'main'].map((rev) => read.on(repo, tip(at, rev)).task({ unit: UNIT, phase: 1, n: 1 }).landed), [false, true]);
    });

    it('a recorded task\'s branch rewritten past its landing, its last commit made again: changed after its landing, land finish lands its change and reads it landed after, the record moved to that landing by the engine, its first landing kept (R29, R30)', () => {
      const at = project();
      ok(at, openArgs(card));
      ok(at, ['land', 'phase', UNIT, '1']);
      const subject = recorded(at)[`${UNIT}-1-1`][1];
      const first = readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'].commit;
      const remade = commitFiles(at, card.branch, `${card.branch}^`, { ...card.files, 'card-more.txt': 'more\n' });
      const landed = () => unitLanded(at, UNIT, projectRepos(at), null).landed({ unit: UNIT, phase: 1, n: 1 });
      const before = landed();
      finishReady(at);
      const finished = own(ok(at, ['land', 'finish', UNIT]));

      assert.deepStrictEqual([before, finished.phases.map((/** @type {{merged: string[]}} */ { merged }) => merged), git(at, ['show', 'main:card-more.txt']), recorded(at)[`${UNIT}-1-1`], readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'].first, landed()], [
        false, [['1.1']], 'more\n', ['engine', subject, remade, false], first, true,
      ]);
    });

    it('a chain whose later task rewrites, then deletes, the earlier task\'s lines: land phase records both, and a second merges nothing (S1)', () => {
      const at = project();
      const earlier = cutTask(at, '1.4', 'feat', 'Write tip', 'main', { 'tip.txt': 'one\n' });
      commitFiles(at, earlier.branch, earlier.branch, { 'tip.txt': 'one\ntwo\n' });
      const later = cutTask(at, '1.5', 'feat', 'Take note', earlier.branch, { 'note.txt': 'note\n' });
      commitFiles(at, later.branch, later.branch, { 'tip.txt': 'rewritten\n' });
      commitFiles(at, later.branch, later.branch, {}, { removed: ['tip.txt'] });
      ok(at, openArgs(earlier));
      ok(at, openArgs(later));
      ok(at, ['land', 'phase', UNIT, '1']);
      const again = ok(at, ['land', 'phase', UNIT, '1']);

      assert.deepStrictEqual([Object.keys(recorded(at)).sort(), again.already, git(at, ['ls-tree', '--name-only', 'main', '--', 'tip.txt', 'note.txt']).trim()], [
        [`${UNIT}-1-4`, `${UNIT}-1-5`], true, 'note.txt',
      ]);
    });

    it('a unit landed with no record, as the engine before the record or a crash between a merge and its record leaves it — a chain whose later task rewrites, then deletes, the earlier task\'s lines, the later then changed after its landing: the first land phase lands that change alone, recording the earlier by its read at its landing and the later by the engine at that change\'s, its first landing kept, and a second merges nothing (S1, R29, R30)', () => {
      const at = project();
      const earlier = cutTask(at, '1.4', 'feat', 'Write tip', 'main', { 'tip.txt': 'one\n' });
      commitFiles(at, earlier.branch, earlier.branch, { 'tip.txt': 'one\ntwo\n' });
      const later = cutTask(at, '1.5', 'feat', 'Take note', earlier.branch, { 'note.txt': 'note\n' });
      commitFiles(at, later.branch, later.branch, { 'tip.txt': 'rewritten\n' });
      commitFiles(at, later.branch, later.branch, {}, { removed: ['tip.txt'] });
      ok(at, openArgs(earlier));
      ok(at, openArgs(later));
      ok(at, ['land', 'phase', UNIT, '1']);
      const landings = [tip(at, 'main~1'), tip(at, 'main')];
      const manifest = readManifest(at, UNIT);
      delete manifest.landings;
      writeState(at, `${UNIT}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
      commitAll(at, 'no record');
      const changed = commitFiles(at, later.branch, later.branch, { 'note-more.txt': 'more\n' });
      const first = own(ok(at, ['land', 'phase', UNIT, '1']));
      const records = [`${UNIT}-1-4`, `${UNIT}-1-5`].map((id) => readManifest(at, UNIT).landings[id]['.']);
      const again = ok(at, ['land', 'phase', UNIT, '1']).already;

      assert.deepStrictEqual([
        first.merged, git(at, ['ls-tree', '--name-only', 'main', '--', 'tip.txt', 'note.txt', 'note-more.txt']).trim().split('\n'),
        records.map(({ by, commit, first: landed, tip: landedTip }) => ({ by, commit, first: landed, tip: landedTip })), again,
      ], [['1.5'], ['note-more.txt', 'note.txt'], [
        { by: 'read', commit: landings[0], first: landings[0], tip: tip(at, earlier.branch) },
        { by: 'engine', commit: tip(at, 'main'), first: landings[1], tip: changed },
      ], true]);
    });

    it('a refusal records nothing where nothing moved: the state branch as it was', () => {
      const at = project();
      const before = lastState(at);
      harness.refuses(at, ['land', 'phase', UNIT, '1'], as);

      assert.deepStrictEqual([readManifest(at, UNIT).landings, lastState(at)], [undefined, before]);
    });

    it('a refusal after a merge records what that merge landed and nothing else: land finish merges phase 1, then refuses on phase 4\'s conflict with it, 1.1 recorded by the engine, 2.1 landed by hand after the last verb unrecorded', () => {
      const at = project();
      ok(at, openArgs(card));
      ok(at, openArgs(rounding));
      ok(at, openArgs(cutTask(at, '4.1', 'fix', 'Word the card', 'main', { 'card.txt': 'a card\n' })));
      Object.values(side.byHand)[0](at, rounding.branch);
      finishReady(at);
      harness.refuses(at, ['land', 'finish', UNIT], as);

      assert.deepStrictEqual([Object.keys(recorded(at)), recorded(at)[`${UNIT}-1-1`][0], lastState(at)], [[`${UNIT}-1-1`], 'engine', `land(${UNIT}): record 1.1 landed`]);
    });

    it('a task landed by hand, then its branch rewritten past the default branch before any verb read it: land open refuses, naming the commit that landed and the way back to it; put back, it answers already, recorded by its read (F1)', () => {
      const at = project();
      ok(at, openArgs(card));
      const landed = tip(at, card.branch);
      Object.values(side.byHand)[0](at, card.branch);
      const landing = tip(at, 'main');
      commitFiles(at, card.branch, BASE, { 'card.txt': 'card, rewritten\n' });
      const refusal = harness.refuses(at, openArgs(card), as).error;
      git(at, ['branch', '-f', card.branch, landed]);
      const again = ok(at, openArgs(card));

      assert.deepStrictEqual([refusal, again.already, recorded(at)[`${UNIT}-1-1`][0]], [
        `land: task 1.1's branch ${card.branch} was rewritten after its work landed on main (${landing.slice(0, 7)}): its commit ${landed.slice(0, 7)} landed, and the branch no longer holds it — put the branch back where it landed, git branch -f ${card.branch} ${landed.slice(0, 7)}, and run this again; work past that goes on top of it`,
        true, 'read',
      ]);
    });

    it('a read for display writes nothing over a landing by hand no verb recorded: the phase close\'s checklist reads its phase landed — one task recorded by the verb after it, the other landed by hand since — leaving the record and the state branch as they were', () => {
      const at = project();
      ok(at, openArgs(card));
      Object.values(side.byHand)[0](at, card.branch);
      mergeBack(at, total.branch, 'main');
      ok(at, openArgs(total));
      Object.values(side.byHand)[0](at, total.branch);
      for (const n of [3, 9]) TRACKER.close(statePath(at), { unit: UNIT, phase: 1, n }, 'not needed');
      finishReady(at);
      const before = [Object.keys(recorded(at)), lastState(at)];
      const shown = ok(at, ['checklist', 'show', 'phase-close', UNIT, '1'], { env: { ...side.env, CLAUDE_CODE_SESSION_ID: 'record' } });

      assert.deepStrictEqual([shown.items.find((/** @type {{key: string}} */ { key }) => key === 'stack-merged').state, Object.keys(recorded(at)), lastState(at)], ['done', ...before]);
      assert.deepStrictEqual(before[0], [`${UNIT}-1-1`]);
    });
  });
}

'use strict';

// ---------------------------------------------------------------------------
// The landing record's write (landing-record.cjs, 7.2.22): each landing on
// the unit's manifest, by its task and its repository, `first` its first
// landing's commit, `at` the landing commit's committer time, committed to
// the state branch under a subject naming the tasks; one recorded at that
// commit already writing nothing; a task landing again taking its new
// commit, tip, `by` and `at`, `first` kept, and the records of its other
// repositories left as they are, each read back as its own alone; the
// record kept through the unit's cancel and reactivate. Read back (task-landed.cjs), a recorded fix's commit up to
// its recorded tip has landed, a later fix having undone its change, which
// its change alone, with no pull request read, does not say; a recorded
// task's commit past its recorded tip, taking a file back that the next
// adds again, has landed with its work as read. Git layer:
// the write called in process on a project world built once and copied
// for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { ok, git, head, lastMessage, readManifest, createFile, commitCode, commitAll, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { recordLandings, recordsIn } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/landing-record.cjs'));
const { repoLanded } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/task-landed.cjs'));
const { TRAILER } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/commit-task.cjs'));
const { quickFixBranch } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/landing-names.cjs'));

const UNIT = 'pay';

const world = fixtureFrom('engine-landing-record-', (template) => {
  createManifest(template, UNIT, { created: '2026-07-01' });
  ok(template, ['manifest', 'set', 'project.work_units.pay.work_type', 'feature']);
  commitAll(template, 'pay made');
  for (const name of ['one', 'two', 'three']) {
    createFile(template, `${name}.txt`, `${name}\n`);
    commitCode(template, name);
  }
});

/** @type {string|null} */
let dir = null;
afterEach(() => {
  if (dir !== null) cleanupFixture(dir);
  dir = null;
});

/** A copy of the world, with its code commits oldest first. */
const project = () => {
  dir = world();
  return { at: dir, commits: git(dir, ['log', '--reverse', '--format=%H', 'main']).trim().split('\n').slice(-3) };
};

/** The commit the code's checkout is at. @param {string} at */
const codeHead = (at) => git(at, ['rev-parse', 'HEAD']).trim();

/** The commit's committer time, as the record holds it. @param {string} at @param {string} sha */
const timeOf = (at, sha) => new Date(git(at, ['log', '-1', '--format=%cI', sha]).trim()).toISOString();

/** A landing of the task `n` of phase 1 in the repository `repo`. @param {string} at @param {number} n @param {string} commit @param {string} tip @param {'engine'|'read'} by @param {string} [repo] */
const landing = (at, n, commit, tip, by, repo = '.') => ({ id: `${UNIT}-1-${n}`, repo, root: at, commit, tip, by });

describe('the landing record\'s write (7.2.22)', () => {
  it('records each landing at its commit, first that commit, at its committer time, in one state commit naming the tasks', () => {
    const { at, commits: [one, two, three] } = project();
    const warnings = [];
    const wrote = recordLandings(at, UNIT, [landing(at, 2, three, two, 'engine'), landing(at, 1, three, one, 'engine')], warnings);

    assert.deepStrictEqual([wrote, warnings, readManifest(at, UNIT).landings, lastMessage(at)], [true, [], {
      [`${UNIT}-1-2`]: { '.': { commit: three, tip: two, first: three, by: 'engine', at: timeOf(at, three) } },
      [`${UNIT}-1-1`]: { '.': { commit: three, tip: one, first: three, by: 'engine', at: timeOf(at, three) } },
    }, `land(${UNIT}): record 1.2, 1.1 landed`]);
  });

  it('a landing recorded at its commit already writes nothing, and commits nothing', () => {
    const { at, commits: [one, two] } = project();
    recordLandings(at, UNIT, [landing(at, 1, two, one, 'engine')], []);
    const before = head(at);

    assert.deepStrictEqual([recordLandings(at, UNIT, [landing(at, 1, two, one, 'read')], []), head(at), readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'].by], [false, before, 'engine']);
  });

  it('a task landing again takes its new commit, tip, by and at, first kept, its record in another repository left as it is and read back as that repository\'s alone, a task recorded only here none there (R30)', () => {
    const { at, commits: [one, two, three] } = project();
    recordLandings(at, UNIT, [landing(at, 1, one, one, 'engine'), landing(at, 1, one, one, 'engine', 'ext'), landing(at, 2, two, two, 'engine')], []);
    recordLandings(at, UNIT, [landing(at, 1, three, two, 'read')], []);
    const manifest = readManifest(at, UNIT);
    const ext = { commit: one, tip: one, first: one, by: 'engine', at: timeOf(at, one) };

    assert.deepStrictEqual([manifest.landings[`${UNIT}-1-1`], [...recordsIn(manifest, 'ext')]], [{
      '.': { commit: three, tip: two, first: one, by: 'read', at: timeOf(at, three) },
      ext,
    }, [[`${UNIT}-1-1`, ext]]]);
  });

  it('a recorded fix\'s commit has landed though a later fix on the quick-fix\'s branch undid its change, the branch squashed onto main under the person\'s own message; read by its change alone, with no pull request read, it has not', () => {
    const { at, commits: [one] } = project();
    git(at, ['switch', '-q', '-c', quickFixBranch(UNIT), one]);
    createFile(at, 'tip.txt', 'tip\n');
    commitCode(at, `fix(pay): write the tip\n\n${TRAILER}: ${UNIT}-1-1`);
    const undone = codeHead(at);
    git(at, ['rm', '-q', 'tip.txt']);
    createFile(at, 'note.txt', 'note\n');
    commitCode(at, `fix(pay): note it instead\n\n${TRAILER}: ${UNIT}-1-2`);
    git(at, ['switch', '-q', 'main']);
    git(at, ['merge', '-q', '--squash', quickFixBranch(UNIT)]);
    commitCode(at, 'In my own words');
    const squash = codeHead(at);
    const read = (/** @type {Map<string, any>} */ recorded) => repoLanded(at, UNIT, 'refs/heads/main', { since: null, recorded }).landedCommit(undone, `${UNIT}-1-1`);

    assert.deepStrictEqual([read(new Map([[`${UNIT}-1-1`, { commit: squash, tip: undone, first: squash, by: 'engine', at: '' }]])), read(new Map())], [true, false]);
  });

  it('a recorded task whose branch then deleted a file it added and added it back: landed, the deletion landed with its work as read, past its recorded tip', () => {
    const { at, commits: [one] } = project();
    const branch = 'feat/pay-1.1-tip';
    git(at, ['switch', '-q', '-c', branch, one]);
    createFile(at, 'tip.txt', 'tip\n');
    commitCode(at, `feat(pay): write the tip\n\n${TRAILER}: ${UNIT}-1-1`);
    const landed = codeHead(at);
    git(at, ['switch', '-q', 'main']);
    git(at, ['merge', '-q', '--squash', branch]);
    commitCode(at, `feat(pay): write the tip\n\n${TRAILER}: ${UNIT}-1-1`);
    const squash = codeHead(at);
    git(at, ['switch', '-q', branch]);
    git(at, ['rm', '-q', 'tip.txt']);
    commitCode(at, `feat(pay): drop the tip\n\n${TRAILER}: ${UNIT}-1-1`);
    const dropped = codeHead(at);
    createFile(at, 'tip.txt', 'tip\n');
    commitCode(at, `feat(pay): the tip again\n\n${TRAILER}: ${UNIT}-1-1`);
    git(at, ['switch', '-q', 'main']);
    const read = repoLanded(at, UNIT, 'refs/heads/main', { since: null, recorded: new Map([[`${UNIT}-1-1`, { commit: squash, tip: landed, first: squash, by: 'engine', at: '' }]]) });

    assert.deepStrictEqual([read.stands({ unit: UNIT, phase: 1, n: 1 }), read.landedCommit(dropped, `${UNIT}-1-1`)], ['landed', true]);
  });

  it('keeps the record through the unit\'s cancel and reactivate', () => {
    const { at, commits: [one] } = project();
    recordLandings(at, UNIT, [landing(at, 1, one, one, 'engine')], []);
    const recorded = readManifest(at, UNIT).landings;
    ok(at, ['workunit', 'cancel', UNIT]);
    ok(at, ['workunit', 'reactivate', UNIT]);

    assert.deepStrictEqual(readManifest(at, UNIT).landings, recorded);
  });
});

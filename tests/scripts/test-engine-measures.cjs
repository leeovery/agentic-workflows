'use strict';

// ---------------------------------------------------------------------------
// The measures (leeway-engine/scripts/domain/measures.cjs), over the
// projects named, the calling one where none is: `engine measures findings
// [--project <path>]…`, review findings per phase (17.1.5, 17.2.4) —
// discussion's reviews and closing pass, the spec's review, the task
// writer, the build's pairs and the review phase, from the ledger's
// findings and the pairs' recorded verdicts and rounds (17.S3), a report
// that does not read passed over and named; `engine measures bugs …`, bugs
// found after review, each bugfix by the unit whose code it fixes once that
// unit's review ended, grouped by area, answered beside the findings per
// phase in one call (17.S4, 17.S6's code half); and their refusals.
//
// The task writer's count is Claude's questions in the build on no task:
// the consolidation agent's and the orchestrator's own are Claude's on no
// task too, and nothing on the ledger tells them apart, so a test cannot
// pin them out. The spec's review's count is its questions alone: a
// replacement it prompts is the person's or Claude's on the ledger, and a
// rewrite never reaches it.
//
// Layer: verb. Worlds: review-world.cjs's, copied for each test — its two
// calls in the build each made for a task, so none is the task writer's —
// and beside it a second project of this file's own, built once and
// copied, holding one finding of its spec's review and one bug found after
// its review. What a conclude records of a bug is written into the
// bugfixes' manifests here; the conclude writing it is
// test-engine-investigation.cjs's.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fixtureFrom, cleanupFixture, commitAll } = require('./engine-harness.cjs');
const {
  UNIT, useWorld, env, reportText, firstRoundFailed, writeState, createManifest, refusedPristine, ok, assert,
} = require('./review-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

/** A question asked at `at`, which must succeed, `flags` given. @param {string} at @param {string} by @param {string} text @param {string[]} [flags] @param {string} [cwd] */
const asked = (at, by, text, flags = [], cwd = dir) => ok(cwd, ['ledger', 'ask', at, ...flags], { env: env(), stdin: JSON.stringify({ by, who_moved_whom: 'none', text }) });

/**
 * A bugfix whose investigation concluded on `day` of November, keeping what
 * the bug is in as its conclude does.
 * @param {string} at @param {string} name @param {number} day @param {{fixes?: string, after_review?: boolean, area?: string}} bug
 */
const bugfix = (at, name, day, bug) => createManifest(at, name, {
  work_type: 'bugfix', phases: { investigation: { items: { [name]: { status: 'completed', concluded_at: `2026-11-${String(day).padStart(2, '0')}T09:00:00.000Z`, ...bug } } } },
});

const other = fixtureFrom('measures-other-', (at) => {
  createManifest(at, 'shop', {});
  bugfix(at, 'lost-basket', 1, { fixes: 'shop', after_review: true, area: 'checkout' });
  commitAll(at, 'init');
  asked('shop.specification', 'review', 'Does a basket outlive the session?', [], at);
});

/** A reviewer's report written at `rel`, its findings each `- {call}: {text}`. @param {string} rel @param {string[]} findings */
const reportAt = (rel, findings) => writeState(dir, `${UNIT}/${rel}`, reportText(findings));

describe('measures findings (17.1.5, 17.2.4)', () => {
  it('17.S3: shows the findings of each phase of the pipeline over the projects named — the ledger\'s review findings by their phase, the task writer\'s gaps, the build\'s pairs and the review phase by call, round and failure — a report that does not read named', () => {
    createManifest(dir, 'talk', { phases: { discussion: { items: { talk: { status: 'in-progress' } } } } });
    commitAll(dir, 'a feature under discussion');
    asked('talk.discussion.talk', 'review', 'Is a talk ever private?');
    asked('talk.discussion.talk', 'claude', 'What is a talk called?');
    asked(`${UNIT}.specification`, 'review', 'Is a refund ever partial?');
    asked(`${UNIT}.implementation`, 'claude', 'Which gateway takes a card?');
    asked(`${UNIT}.implementation`, 'claude', 'Is the retry logged?', ['--task', '1.1']);
    asked(`${UNIT}.implementation`, 'person', 'Is the card form ours?');
    asked(`${UNIT}.implementation`, 'review', 'Is the gateway ever down?');
    reportAt('build/tasks/1.1/round-1-a.md', ['serious: A card is charged twice.']);
    reportAt('build/tasks/1.1/round-1-b.md', []);
    reportAt('build/tasks/1.1/round-2-a.md', ['nit: The card field is terse.']);
    reportAt('build/tasks/1.1/round-2-b.md', []);
    reportAt('build/phases/phase-1/review-a.md', []);
    reportAt('build/phases/phase-1/review-b.md', ['nit: The receipt is plain.']);
    writeState(dir, `${UNIT}/build/tasks/1.2/round-1-a.md`, 'Looks fine.\n');
    firstRoundFailed();
    const elsewhere = other();

    try {
      const { unread, ...found } = ok(dir, ['measures', 'findings', '--project', dir, '--project', elsewhere]);
      assert.deepStrictEqual(found, {
        ok: true,
        projects: [dir, elsewhere],
        phases: [
          { phase: 'discussion', findings: 1 },
          { phase: 'specification', findings: 2 },
          { phase: 'task-writer', findings: 1 },
          { phase: 'build', findings: 3, calls: { serious: 1, bug: 0, nit: 2 }, rounds: 3, failed: 1 },
          { phase: 'review', findings: 1, calls: { serious: 0, bug: 1, nit: 0 }, rounds: 1, failed: 1 },
        ],
      });
      assert.deepStrictEqual(unread.map((/** @type {string} */ line) => line.split(' — ')[0]), [path.join(dir, '.leeway', UNIT, 'build', 'tasks', '1.2', 'round-1-a.md')]);
    } finally {
      cleanupFixture(elsewhere);
    }
  });

  it('counts a phase review split into areas as one round, failed where any area\'s report failed', () => {
    reportAt('build/phases/phase-2/1-a.md', ['bug: A refund is lost.']);
    reportAt('build/phases/phase-2/1-b.md', []);
    reportAt('build/phases/phase-2/2-a.md', ['nit: The refund note is terse.']);
    reportAt('build/phases/phase-2/2-b.md', []);

    assert.deepStrictEqual(ok(dir, ['measures', 'findings']).phases[3], { phase: 'build', findings: 2, calls: { serious: 0, bug: 1, nit: 1 }, rounds: 1, failed: 1 });
  });

  it('reads the calling project where none is named, and refuses a project with no workflows state and arguments of another shape, writing nothing', () => {
    asked(`${UNIT}.specification`, 'review', 'Is a refund ever partial?');
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'measures-bare-'));

    try {
      assert.deepStrictEqual(ok(dir, ['measures', 'findings']).phases[1], { phase: 'specification', findings: 1 });
      assert.match(refusedPristine(dir, ['measures', 'findings', '--project', bare]).error, new RegExp(`^measures findings: no workflows state for ${bare}`));
      for (const args of [['measures'], ['measures', 'calls'], ['measures', 'findings', 'more'], ['measures', 'findings', 'bugs'], ['measures', 'findings', '--unit', UNIT], ['measures', 'bugs', '--area', 'checkout']]) {
        assert.strictEqual(refusedPristine(dir, args).error, 'Usage: engine measures findings|bugs [--project <path>]…', args.join(' '));
      }
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe('measures bugs (17.1.6, 17.3.1)', () => {
  it('17.S4, 17.S6: counts each bugfix by the unit whose code it fixes where its conclude found that unit\'s review ended, grouped by area — folded for case and spacing, by its first spelling, a record left out among them — each project\'s own, then by the unit, each in name order; beside the findings per phase over the same projects, in one call', () => {
    bugfix(dir, 'double-charge', 2, { fixes: 'cards', after_review: true, area: 'Checkout' });
    bugfix(dir, 'card-declined', 3, { fixes: 'cards', after_review: true, area: ' checkout ' });
    bugfix(dir, 'refund-twice', 4, { fixes: 'refunds', after_review: true, area: 'CHECKOUT' });
    bugfix(dir, 'refund-rounding', 5, { fixes: 'refunds', after_review: true, area: 'card  refunds' });
    bugfix(dir, 'card-refund', 7, { fixes: 'cards', after_review: true, area: 'Card refunds' });
    bugfix(dir, 'odd-total', 6, { fixes: 'cards', after_review: true });
    bugfix(dir, 'early', 8, { fixes: 'draft', after_review: false, area: 'checkout' });
    bugfix(dir, 'old-code', 1, { area: 'CheckOut' });
    ok(dir, ['manifest', 'set', 'card-refund', 'status', 'cancelled']);
    createManifest(dir, 'moved', { phases: { investigation: { items: { moved: { status: 'completed', fixes: 'cards', after_review: true, area: 'checkout' } } } } });
    const project = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', 'manifest.json'), 'utf8'));
    const units = fs.readdirSync(path.join(dir, '.leeway'), { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name).sort().reverse();
    writeState(dir, 'manifest.json', JSON.stringify({ ...project, work_units: Object.fromEntries(units.map((unit) => [unit, project.work_units?.[unit] ?? {}])) }, null, 2));
    const elsewhere = other();

    try {
      const { phases, unread, ...bugs } = ok(dir, ['measures', 'bugs', '--project', dir, '--project', elsewhere]);
      assert.deepStrictEqual(bugs, {
        ok: true,
        projects: [dir, elsewhere],
        bugs: [
          { project: dir, area: 'card  refunds', count: 2, fixed: [{ unit: 'cards', bugfixes: ['card-refund'] }, { unit: 'refunds', bugfixes: ['refund-rounding'] }] },
          { project: dir, area: 'CheckOut', count: 3, fixed: [{ unit: 'cards', bugfixes: ['card-declined', 'double-charge'] }, { unit: 'refunds', bugfixes: ['refund-twice'] }] },
          { project: dir, area: null, count: 1, fixed: [{ unit: 'cards', bugfixes: ['odd-total'] }] },
          { project: elsewhere, area: 'checkout', count: 1, fixed: [{ unit: 'shop', bugfixes: ['lost-basket'] }] },
        ],
      }, 'a bug in code no unit built, one concluded before its unit\'s review ended, and a unit moved off bugfix are left out; a cancelled bugfix counts');
      const findings = ok(dir, ['measures', 'findings', '--project', dir, '--project', elsewhere]);
      assert.deepStrictEqual({ phases, unread }, { phases: findings.phases, unread: findings.unread }, 'the findings per phase beside them, as measures findings answers them');
    } finally {
      cleanupFixture(elsewhere);
    }
  });
});

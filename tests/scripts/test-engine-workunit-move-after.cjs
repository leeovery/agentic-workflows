'use strict';

// ---------------------------------------------------------------------------
// A unit's move to another type, beyond the quick-fix's stage and yes
// (leeway-engine/scripts/domain/workunit-move.cjs; 19.4.22, 19.5.9,
// 19.5.16, P7): the new type's build meeting nothing of the fixes — a
// feature's phase 1 written and task 1.1's branch laid, a bugfix's
// reproducing task 1.1 created, on the local landing driver, the fix's kept
// branch read by no landing as the unit's; a bugfix moved to a feature,
// re-typed in place, its investigation item dropped and its brief
// rewritten, its lines carried to the discussion and its log set aside, the
// finding citing it following (19.S30); every refusal, writing nothing — a
// type that does not move, a move its type does not take, a unit not in
// progress or of a retired type, a quick-fix its old scoping made, a unit
// past its spec, a bugfix away from its investigation or with its root
// cause's validation not taken in since it was logged (19.4.7) — and the yes's
// checks made again against the unit as it stands; and the yes stopped
// before its save run again whole, answering what the second call did. A
// quick-fix's stage and yes are test-engine-workunit-move.cjs's.
//
// Layer: git. World: workunit-move-world.cjs, built once and copied. Each
// test's conversation keeps its records in a config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, okSections, refuses, refusedPristine, git, stateGit, statePath, layout, writeState,
  readState, readManifest, cleanupFixture, killedAt, STATE_DIR_NAME,
} = require('./engine-harness.cjs');
const {
  QF, BUG, EPIC, ENGINE, BRANCH, KEPT, STAGED, INVESTIGATION_LOG, EARLIER, fixFile, made, world,
  moveHelpers,
} = require('./workunit-move-world.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { taskBranch, isUnitBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));

let dir = ''; // the project
const {
  env, staged, moved, refusedStage, branchOut, fixes, ledgerLines, earlierReads, config,
} = moveHelpers(() => dir);

afterEach(() => {
  cleanupFixture(dir);
});

describe('what the new type\'s build meets: nothing of the fixes (19.5.16)', () => {
  /** Task 1.1 of the moved quick-fix created from a task file of `type`: its answer. @param {string} type @param {string} title */
  function firstTask(type, title) {
    ok(dir, ['task', 'phase', QF, '1', '--title', 'The flag']);
    return ok(dir, ['task', 'create', QF, '1', '--file', writeState(dir, layout.cache(`${QF}-task.md`), fixFile(1, title, type))]);
  }

  it('a quick-fix moved mid-fix to a feature: its build writes phase 1 and lays task 1.1\'s branch, the fix\'s kept branch untouched and read by no landing as the unit\'s', () => {
    dir = world();
    const fixCommit = git(dir, ['rev-parse', BRANCH]).trim();
    moved(QF, 'feature');
    const title = 'Take both spellings';
    assert.strictEqual(firstTask('feat', title).task, '1.1');
    ok(dir, ['task', 'start', QF, '1.1'], { env: env() });
    const tree = path.join(fs.realpathSync(config()), 'builder');
    git(dir, ['worktree', 'add', '-q', '-b', 'worktree-agent-builder', tree, 'HEAD']);
    const laid = ok(tree, ['task', 'worktree', QF, '1.1'], { env: env() });

    assert.deepStrictEqual([laid.branch, git(dir, ['rev-parse', KEPT]).trim(), isUnitBranch(QF, KEPT)], [taskBranch({ unit: QF, phase: 1, n: 1 }, 'feat', title), fixCommit, false]);
  });

  it('a quick-fix moved to a bugfix: its reproducing task, 1.1, created', () => {
    dir = world();
    moved(QF, 'bugfix');

    const created = firstTask('test', 'Prove the flag is misspelt');

    assert.deepStrictEqual([created.task, ok(dir, ['task', 'list', QF, '1']).tasks.map(({ task, title, status }) => [task, title, status])], ['1.1', [['1.1', 'Prove the flag is misspelt', 'open']]]);
  });
});

describe('the yes: a bugfix moved to a feature (19.S30, 19.4.22)', () => {
  it('re-types it in place, its investigation item dropped and its brief rewritten, its lines carried to the discussion and its log set aside, the finding citing it following, and hands off into the discussion — whose first opening reads the investigation\'s log and the topic\'s record as its earlier ones, keeping a log of its own', () => {
    dir = world();
    const investigated = readState(dir, INVESTIGATION_LOG);
    const res = moved(BUG, 'feature');

    assert.deepStrictEqual([res.fixes_closed, res.branches, res.checkout, res.next], [[], [], null, { kind: 'handoff', skill: 'leeway-discussion-process', args: ['feature', BUG] }]);
    const manifest = readManifest(dir, BUG);
    assert.deepStrictEqual([manifest.work_type, manifest.phases], ['feature', { discussion: { items: { [BUG]: { status: 'unstarted' } } } }]);
    assert.deepStrictEqual(readManifest(dir, '.').work_units[BUG], { work_type: 'feature' });
    assert.strictEqual(readState(dir, layout.brief(BUG, BUG)), '# hunt\n\nWhat the work showed.\n');
    const { v: _v, id: _id, at: _at, ...carry } = ledgerLines().at(-1);
    assert.deepStrictEqual(carry, {
      event: 'rehomed', unit: BUG, topic: BUG, phase: 'discussion', session: 'sess-1',
      lines: [ledgerLines().find((l) => l.id.startsWith(made.found)).id], files: [[INVESTIGATION_LOG, EARLIER(BUG, 'investigation-log.md')]],
    });
    assert.deepStrictEqual([fs.existsSync(statePath(dir, INVESTIGATION_LOG)), readState(dir, EARLIER(BUG, 'investigation-log.md'))], [false, investigated]);

    const { sections } = okSections(dir, ['enter', 'discussion', BUG], { env: env() });
    assert.deepStrictEqual(earlierReads(sections), [`earlier record: \`${ENGINE} ledger record ${BUG} ${BUG}\``, `earlier log: ${statePath(dir, EARLIER(BUG, 'investigation-log.md'))}`]);
    assert.deepStrictEqual(ok(dir, ['ledger', 'record', BUG, BUG]).findings.map((f) => [f.text, f.phase, f.cites.map((c) => c.path)]), [
      ['Every save takes the session list as the whole truth.', 'discussion', [EARLIER(BUG, 'investigation-log.md')]],
    ]);
    assert.ok(sections.includes(`\nlog: ${statePath(dir, INVESTIGATION_LOG)}\n`), 'the discussion keeps a log of its own, where the investigation\'s was');
  });
});

describe('what the move refuses (19.5.9, 19.4.22, P7)', () => {
  it('refuses a type that does not move, a move its type does not take, a unit not in progress or of a type the reshape retires, a quick-fix its old scoping made, a unit past its spec, and a bugfix away from its investigation — each at the stage, nothing written', () => {
    dir = world();
    assert.deepStrictEqual([
      refusedStage(EPIC, 'feature'),
      refusedStage('notes', 'bugfix'),
      refusedStage(BUG, 'bugfix'),
      refusedStage(QF, 'epic'),
      refusedStage('parked', 'feature'),
      refusedStage('concern', 'feature'),
      refusedStage('scoped', 'feature'),
      refusedStage('specced', 'feature'),
      refusedStage('fixed', 'feature'),
      refusedStage('fresh', 'feature'),
    ], [
      `${EPIC} is an epic, which moves nowhere — a quick-fix moves to a feature or a bugfix, and a bugfix to a feature`,
      'notes is a feature, which moves nowhere — a quick-fix moves to a feature or a bugfix, and a bugfix to a feature',
      `${BUG} is a bugfix, which moves to a feature — not to "bugfix"`,
      `${QF} is a quick-fix, which moves to a feature or a bugfix — not to "epic"`,
      'parked is cancelled — only work in progress moves',
      'concern is a cross-cutting unit, a type the reshape retires — it waits on the reshape\'s 29.17 migration, and nothing is done in it until then',
      'scoped was scoped under the old plan, and moves once the reshape\'s 29.17 migration has cut it',
      'specced has its spec — it carries on as work of its own',
      'a bugfix moves to a feature from its investigation, and fixed\'s has concluded — the work carries on in its spec',
      'a bugfix moves to a feature from its investigation, and fresh\'s has not begun',
    ]);
  });

  it('refuses a bugfix whose root cause logged has no validation taken in since it was — none dispatched, then one still running — each naming its way on, and stages it once that validation is taken in (19.4.7)', () => {
    dir = world();
    const at = `${BUG}.investigation.${BUG}`;
    const { write } = ledgerHelpers(() => dir);
    const cause = write('ask', at, [], { ...MADE, text: 'What empties the saved state?' }).id;
    const rootCause = write('decide', at, ['--answers', cause], { ...MADE, text: 'Every save takes the session list as the whole truth.', why: 'The capture is all it reads.' }).id;
    ok(dir, ['investigation-log', 'root-cause', BUG, '--entry', rootCause]);
    const none = refusedStage(BUG, 'feature');
    const row = ok(dir, ['agent', 'dispatch', BUG, 'investigation', BUG, '--kind', 'root-cause-validation'], { env: env() });
    const running = refusedStage(BUG, 'feature');
    fs.writeFileSync(row.file, `# Validation — ${row.id}\n\n## Summary\n\nIt holds.\n\n## Findings\n\nNone identified.\n`);
    ok(dir, ['agent', 'scan', BUG, 'investigation', BUG], { env: env() });
    ok(dir, ['agent', 'ack', BUG, 'investigation', BUG, row.id, '--clean'], { env: env() });

    const waits = `${BUG} moves to a feature once its root cause's validation is taken in, and the root cause ${rootCause}`;
    assert.deepStrictEqual([none, running], [
      `${waits} has not been validated since it was logged — both validations always run: engine agent dispatch ${BUG} investigation ${BUG} --kind root-cause-validation, its brief engine brief root-cause-validation ${BUG} --agent <id>, and its report taken in`,
      `${waits} is being validated — ${row.id} is still running — the move waits for its report`,
    ]);
    assert.deepStrictEqual(staged(BUG, 'feature').res, { ok: true, work_unit: BUG, from: 'bugfix', to: 'feature' });
  });

  it('checks the move again at the yes, against the unit as it stands, nothing moved: a fix of the quick-fix landed since the stage, the unit cancelled since, its spec written since, its investigation concluded since', () => {
    /** The yes refused after `change`, made between the stage and it: its error. @param {string} unit @param {() => void} change */
    function refusedYes(unit, change) {
      cleanupFixture(dir);
      dir = world();
      staged(unit, 'feature');
      change();
      return refusedPristine(dir, ['start-this-work', 'yes'], { env: env() }).error;
    }

    assert.deepStrictEqual([
      refusedYes(QF, () => git(dir, ['branch', '-f', 'main', BRANCH])),
      refusedYes(QF, () => ok(dir, ['workunit', 'cancel', QF])),
      refusedYes(BUG, () => writeState(dir, layout.unit(BUG, 'spec.md'), '# Spec\n')),
      refusedYes(BUG, () => ok(dir, ['manifest', 'set', `${BUG}.investigation.${BUG}`, 'status=completed'])),
    ], [
      `start-this-work yes: ${QF}'s fix 1.1 has landed — finish the quick-fix, then start the feature as work of its own`,
      `start-this-work yes: ${QF} is cancelled — only work in progress moves`,
      `start-this-work yes: ${BUG} has its spec — it carries on as work of its own`,
      `start-this-work yes: a bugfix moves to a feature from its investigation, and ${BUG}'s has concluded — the work carries on in its spec`,
    ]);
  });
});

describe('the yes run again (19.5.16)', () => {
  it('stopped before the manifests\' save, every step before it done, a second yes completes the move whole, its commit taking every path, and answers what it did itself — no fix closed, no branch kept, the checkout where the first left it', () => {
    dir = world();
    staged(QF, 'feature');
    killedAt({ method: 'renameSync', file: `${STATE_DIR_NAME}/manifest.json`, when: 'before' }, dir, ['start-this-work', 'yes'], { env: env() });
    const stopped = [readManifest(dir, QF).work_type, git(dir, ['branch', '--list', BRANCH]), fs.existsSync(statePath(dir, QF, 'build')), ledgerLines().at(-1).event];
    const res = ok(dir, ['start-this-work', 'yes'], { env: env() });

    assert.deepStrictEqual(stopped, ['quick-fix', '', false, 'rehomed']);
    const [first, again] = ledgerLines().filter((line) => line.event === 'rehomed');
    assert.deepStrictEqual(again.lines, first.lines, 'the second carry lists the same lines, never the first carry');
    assert.deepStrictEqual([res.work_type, res.fixes_closed, res.branches, res.checkout, readManifest(dir, '.').work_units[QF]], ['feature', [], [], null, { work_type: 'feature' }]);
    assert.deepStrictEqual([git(dir, ['branch', '--list', KEPT]).trim(), branchOut()], [KEPT, 'main']);
    assert.strictEqual(refuses(dir, ['task', 'list', QF, '1']).error, `phase 1 of ${QF} is not written`);
    const record = ok(dir, ['ledger', 'record', QF, QF]);
    assert.deepStrictEqual([record.questions.map((q) => [q.text, q.phase]), record.decisions.map((d) => d.cites.map((c) => c.path))], [
      [['Should --color still work?', 'discussion'], ['Which spelling does the help use?', 'discussion']],
      [[EARLIER(QF, 'build/log.md')]],
    ]);
    assert.deepStrictEqual([fs.existsSync(statePath(dir, STAGED)), stateGit(dir, ['status', '--porcelain'])], [false, '']);
  });
});

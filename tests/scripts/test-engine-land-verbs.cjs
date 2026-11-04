'use strict';

// ---------------------------------------------------------------------------
// The `land` verbs' argv contract (leeway-engine/scripts/domain/landing.cjs,
// with landing-git.cjs and landing-names.cjs): the usage and the shapes they
// refuse, writing nothing; the landing driver settled and committed by the
// first verb where no setting names one, and kept once it does (7.S21); the
// default branch read off the remote, `init.defaultBranch`, `main` or
// `master`, never the state branch (4.9.4); a task's type and title read
// from the tracker once there is a default branch, a task it lacks or holds
// with no type refused — one ended in words of its own — what the read
// commits and is warned of answered, a refusal after a commit carrying its
// warnings, and its branch named from them and judged by its own change;
// and a project inside a larger repository reading the change from its own
// folder alone, but for the state, at the repository's top (7.2.17),
// naming a nested repository from its own folder and the person's own
// checkout as theirs. And what the build's reviews ask first: `chain`
// refusing a task its pair has not passed — no round reported, its last
// failed and not settled, or a report that does not read — and chaining it
// once the orchestrator settles that round (12.1.4, 13.4.6); `phase`
// refusing a phase the cut holds until its phase review has passed, or
// failed and been settled (13.10.1), its refusal naming the settlement,
// and a fix phase past the cut asking none (7.2.4, P14); what a phase review
// passed means, test-engine-build-checklists.cjs's. What every driver does
// is the landing conformance suites'; the local driver's stacks,
// test-engine-land-local.cjs's; the person's checkouts,
// test-engine-land-checkout.cjs's and test-engine-land-worktrees.cjs's. Verb
// layer: the landing world (landing-world.cjs), built once and copied for
// each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  ok, refuses, git, stateGit, tip, head, lastMessage, initRepo, statePath, layout, readState, writeState, readManifest, accountTaken,
} = require('./engine-harness.cjs');
const {
  UNIT, TASKS, TRACKER, openArgs, own, track, cutTask, commitFiles, landedOn, setLandingDriver, useLandingWorld, followRemedy, short, way, moveStep, strayRefusal: stray,
  refusedMoving,
} = require('./landing-world.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { STATE_BRANCH } = require('../../skills/leeway-engine/scripts/domain/state-worktree.cjs');
const { roundReportPath, phaseReviewPath } = require('../../skills/leeway-engine/scripts/domain/round-report.cjs');
const { parseShownTask } = require('../../skills/leeway-engine/scripts/domain/task-id.cjs');
const { REVIEWER_LETTERS } = require('../../skills/leeway-engine/scripts/kernel/reviewers.cjs');

const { card } = TASKS;
const project = useLandingWorld('engine-land-verbs-');

/** The state branch's tip, and whether a project manifest is there. @param {string} dir */
const stateAt = (dir) => ({ tip: head(dir), manifest: fs.existsSync(statePath(dir, layout.projectManifest)) });

/** The default task driver's side of the suites, what a person might do in its tool. */
const SIDE = require(path.join(__dirname, '..', 'drivers', TRACKER.name, 'task.cjs'));

describe('land: what it refuses before anything is read, writing nothing', () => {
  it('refuses another sub-verb, a missing or extra argument or flag, with the usage', () => {
    const dir = project();
    const before = stateAt(dir);
    const usage = 'Usage: engine land open <work-unit> <phase>.<task> | engine land chain <work-unit> <phase>.<task>'
      + ' | engine land phase <work-unit> <phase> | engine land finish <work-unit>';
    for (const args of [
      ['land'], ['land', 'merge', 'pay'], ['land', 'open', 'pay'], [...openArgs(card), '--type', 'feat'], [...openArgs(card), '--title', 'Add card'],
      ['land', 'chain', 'pay'], ['land', 'phase', 'pay', '1', '2'], ['land', 'finish'],
    ]) {
      assert.strictEqual(refuses(dir, args).error, usage, args.join(' '));
    }
    assert.deepStrictEqual(stateAt(dir), before);
  });

  it('refuses a unit, task or phase of another shape', () => {
    const dir = project();
    const before = stateAt(dir);
    const refusals = /** @type {[string[], string][]} */ ([
      [['land', 'open', 'Pay', '1.1'], 'task-id: Work unit name "Pay" must be a kebab-case slug — lowercase letters and digits, joined by single hyphens'],
      [['land', 'open', 'pay', '1-1'], 'task-id: "1-1" is not a task — it is {phase}.{n}'],
      [['land', 'phase', 'pay', '01'], 'task-id: "01" is not a phase — it is a whole number from 1'],
      [['land', 'finish', 'discussion'], 'task-id: Work unit name "discussion" conflicts with a phase name'],
    ]);
    for (const [args, error] of refusals) assert.strictEqual(refuses(dir, args).error, error, args.join(' '));
    assert.deepStrictEqual(stateAt(dir), before);
  });
});

describe('land open: the task\'s type and title, the tracker\'s (7.2.18, 12.4.1)', () => {
  it('refuses a task the tracker lacks, and one it holds with no type, naming the verb that gives it one — and opens it once given, writing nothing before', () => {
    const dir = project();
    const before = stateAt(dir);
    SIDE.makeTask(statePath(dir), 'Card limits', { unit: 'pay', phase: 1, n: 6 });
    const untyped = refuses(dir, ['land', 'open', 'pay', '1.6']).error;
    assert.deepStrictEqual([refuses(dir, ['land', 'open', 'pay', '1.7']).error, untyped], [
      'land: task 1.7 of pay is not in the tracker — open a task it holds, as `task list pay 1` lists them',
      'land: task 1.6 has no type in the tracker, and its branch and landing are named from it — give it one with `task type pay 1.6 <type>` and open it again',
    ]);
    assert.deepStrictEqual(stateAt(dir), before);
    ok(dir, ['task', 'type', 'pay', '1.6', 'feat']);
    accountTaken(dir, 'pay', '1.6');
    commitFiles(dir, 'feat/pay-1.6-card-limits', 'main', { 'limits.txt': 'limits\n' });
    assert.strictEqual(ok(dir, ['land', 'open', 'pay', '1.6']).branch, 'feat/pay-1.6-card-limits');
  });

  it('refuses a task ended with no type, which `task type` refuses too, naming a way that takes its change', () => {
    const dir = project();
    SIDE.makeTask(statePath(dir), 'Card limits', { unit: 'pay', phase: 1, n: 6 });
    ok(dir, ['task', 'close', 'pay', '1.6', '--reason', 'not wanted']);
    const before = stateAt(dir);
    assert.strictEqual(
      refuses(dir, ['land', 'open', 'pay', '1.6']).error,
      'land: task 1.6 is closed in the tracker with no type, and only a task not yet ended takes one — its branch and landing are named from its type, '
      + 'so land its change as a task of its own, made with `task create pay 1 --file <path>`',
    );
    assert.deepStrictEqual(stateAt(dir), before);
  });

  it('reads the tracker only once the repository has a default branch, so a task it lacks is refused for that first, writing nothing', () => {
    const dir = project();
    const before = stateAt(dir);
    git(dir, ['branch', '-m', 'main', 'trunk']);
    assert.match(refuses(dir, ['land', 'open', 'pay', '1.7']).error, /^land: no default branch to land on — /);
    assert.deepStrictEqual(stateAt(dir), before);
  });

  it('refuses a task whose branch, named from its type and title, is not there', () => {
    const dir = project();
    const tracked = [track(dir, '1.4', 'feat', 'Pay by link: QR codes, NFC & café terminals'), track(dir, '1.5', 'fix', 'Итоги корзины')];
    const before = stateAt(dir);
    assert.deepStrictEqual(tracked.map((task) => refuses(dir, openArgs(task)).error), [
      'land: task 1.4 has no branch feat/pay-1.4-pay-by-link-qr-codes-nfc-cafe-terminals, the name its type and title in the tracker give it — name its branch so and open it again',
      'land: task 1.5 has no branch fix/pay-1.5-task, the name its type and title in the tracker give it — name its branch so and open it again',
    ]);
    assert.deepStrictEqual(stateAt(dir), before);
  });

  it('answers what its read of the tracker committed and was warned of: the setting up the state branch lacks, committed and not pushed', () => {
    const dir = project();
    setLandingDriver(dir, 'local');
    const ignore = statePath(dir, '.gitignore');
    const local = new Set(TRACKER.localFiles());
    fs.writeFileSync(ignore, fs.readFileSync(ignore, 'utf8').split('\n').filter((line) => !local.has(line)).join('\n'));
    stateGit(dir, ['commit', '-q', '-m', 'the tracker\'s ignore lines gone', '--', layout.gitignore]);
    git(dir, ['remote', 'add', 'origin', path.join(dir, '..', 'nowhere.git')]);

    const { committed, warnings } = ok(dir, openArgs(card));

    assert.deepStrictEqual([committed, lastMessage(dir)], [head(dir).slice(0, committed.length), 'task(pay): set up the tracker']);
    assert.deepStrictEqual(warnings.map((warning) => warning.split(' — ')[0]), [`${STATE_BRANCH} is committed here but was not pushed to origin`]);
  });

  it('carries what a commit before its refusal was warned of in the refusal: the tracker\'s setting up, and the landing driver\'s setting', () => {
    const unpushed = `— and ${STATE_BRANCH} is committed here but was not pushed to origin — `;
    const tracker = project();
    setLandingDriver(tracker, 'local');
    const ignore = statePath(tracker, '.gitignore');
    const local = new Set(TRACKER.localFiles());
    fs.writeFileSync(ignore, fs.readFileSync(ignore, 'utf8').split('\n').filter((line) => !local.has(line)).join('\n'));
    stateGit(tracker, ['commit', '-q', '-m', 'the tracker\'s ignore lines gone', '--', layout.gitignore]);
    git(tracker, ['remote', 'add', 'origin', path.join(tracker, '..', 'nowhere.git')]);
    const lacking = track(tracker, '1.4', 'feat', 'Card limits');
    const unbranched = refuses(tracker, openArgs(lacking)).error;
    assert.ok(unbranched.startsWith(`land: task 1.4 has no branch ${lacking.branch}, the name its type and title in the tracker give it — name its branch so and open it again ${unpushed}`), unbranched);
    assert.strictEqual(lastMessage(tracker), 'task(pay): set up the tracker');

    const driver = project();
    git(driver, ['remote', 'add', 'origin', path.join(driver, '..', 'nowhere.git')]);
    const unopened = refuses(driver, ['land', 'phase', 'pay', '3']).error;
    assert.ok(unopened.startsWith(`land: phase 3 of pay has no task opened — open its tasks first ${unpushed}`), unopened);
    assert.strictEqual(lastMessage(driver), 'chore: the landing driver is local');
  });
});

describe('land: the landing driver setting (7.1.4, 7.S21)', () => {
  it('is settled by the first verb where none is set — the local driver, with no remote — and its state commit carries it; a GitHub remote added later leaves it', () => {
    const dir = project();
    const opened = ok(dir, openArgs(card));
    assert.deepStrictEqual([opened.driver, opened.committed], ['local', head(dir).slice(0, opened.committed.length)]);
    assert.strictEqual(stateGit(dir, ['show', '--name-only', '--format=%s', 'HEAD']), 'chore: the landing driver is local\n\nmanifest.json\n');
    assert.strictEqual(JSON.parse(readState(dir, layout.projectManifest)).drivers.landing, 'local');

    git(dir, ['remote', 'add', 'origin', 'git@github.com:acme/pay.git']);
    const before = stateAt(dir);
    const chained = ok(dir, ['land', 'chain', 'pay', '1.1']);
    assert.deepStrictEqual([chained.driver, 'committed' in chained, stateAt(dir)], ['local', false, before]);
  });

  it('is committed once settled though the driver then refuses', () => {
    const dir = project();
    assert.strictEqual(refuses(dir, ['land', 'chain', 'pay', '1.1']).error, 'land: task 1.1 is not open — open it first');
    assert.strictEqual(lastMessage(dir), 'chore: the landing driver is local');
  });
});

describe('land: the default branch everything lands on', () => {
  it('is the branch the remote names its HEAD, which the repository must have — made from the remote\'s as the refusal says', () => {
    const dir = project();
    setLandingDriver(dir, 'local');
    git(dir, ['remote', 'add', 'origin', 'https://git.example.org/acme/pay.git']);
    git(dir, ['update-ref', 'refs/remotes/origin/trunk', 'main']);
    git(dir, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk']);
    const { error } = refuses(dir, openArgs(card));
    assert.strictEqual(error, 'land: the default branch is trunk, and the repository has no local branch of that name — make one with `git branch trunk origin/trunk`');
    followRemedy(dir, error);
    assert.strictEqual(own(ok(dir, openArgs(card))).base, 'trunk');
  });

  it('is the branch init.defaultBranch names where there is no remote, ahead of main', () => {
    const dir = project();
    git(dir, ['branch', 'trunk', 'main']);
    git(dir, ['config', 'init.defaultBranch', 'trunk']);
    assert.strictEqual(own(ok(dir, openArgs(card))).base, 'trunk');
  });

  it('is never the branch the main checkout is on: with nothing naming one, the verb refuses, saying how to name it, and lands there once named', () => {
    const dir = project();
    const before = stateAt(dir);
    git(dir, ['branch', '-m', 'main', 'trunk']);
    assert.strictEqual(
      refuses(dir, openArgs(card)).error,
      'land: no default branch to land on — the remote names none, and the repository has no branch init.defaultBranch names, nor main or master; '
      + 'name it with `git config init.defaultBranch <branch>` in the project',
    );
    assert.deepStrictEqual(stateAt(dir), before);
    git(dir, ['config', 'init.defaultBranch', 'trunk']);
    assert.strictEqual(own(ok(dir, openArgs(card))).base, 'trunk');
  });

  it('4.S20: is never the state branch: the verb refuses, writing nothing (4.9.4)', () => {
    const dir = project();
    const before = stateAt(dir);
    git(dir, ['config', 'init.defaultBranch', 'leeway-state']);
    assert.strictEqual(
      refuses(dir, openArgs(card)).error,
      'land: the default branch reads as leeway-state, the workflows\' state branch, which nothing lands on — name the project\'s own with `git config init.defaultBranch <branch>`',
    );
    assert.deepStrictEqual(stateAt(dir), before);
  });
});

describe('land open: a task judged by its own change', () => {
  it('takes nothing the default branch gained since the task was cut for the task\'s own change', () => {
    const dir = project();
    git(dir, ['update-index', '--add', '--cacheinfo', `160000,${tip(dir, 'main')},vendor/lib`]);
    git(dir, ['commit', '-q', '-m', 'vendor the lib']);
    assert.strictEqual(
      refuses(dir, openArgs(card)).error,
      `land: task 1.1's branch ${card.branch} does not descend from the chain's tip, main (${tip(dir, 'main').slice(0, 7)}) — merge it back onto main first`,
    );
  });

  describe('in a project that is a folder inside a larger repository (7.2.17)', () => {
    /** The landing world with its project in a folder of it, `app`, from which every verb runs. @returns {[string, string]} the repository, the project */
    const nested = () => {
      const dir = project();
      const app = path.join(dir, 'app');
      fs.mkdirSync(app);
      return [dir, app];
    };

    it('refuses a task carrying the state, which sits at the repository\'s top whatever the person\'s diff.relative', () => {
      const [dir, app] = nested();
      git(dir, ['config', 'diff.relative', 'true']);
      const notes = cutTask(dir, '1.4', 'feat', 'Note it', 'main', { 'app/note.txt': 'note\n', '.leeway/notes.md': 'state\n' });
      assert.strictEqual(
        refuses(app, openArgs(notes)).error,
        'land: task 1.4\'s change carries .leeway/notes.md — the workflows\' state never lands on a code branch, so take it off the task\'s branch and open the task again',
      );
    });

    it('opens a task that changes a folder outside the project, a nested repository\'s pointer there among it, read from its own folder alone — the change landing as the branch holds it', () => {
      const [dir, app] = nested();
      const shared = cutTask(dir, '1.4', 'feat', 'Share it', 'main', { 'app/app.txt': 'app\n', 'other/o.txt': 'o\n' }, { gitlinks: { 'other/lib': tip(dir, 'main') } });
      ok(app, openArgs(shared));
      assert.deepStrictEqual(landedOn(dir, 'feat/pay-phase-1').map(({ paths }) => paths), [['app/app.txt', 'other/lib', 'other/o.txt']]);
    });

    it('names a nested repository holding work on the task\'s branch from the project\'s folder, its refusal given there', () => {
      const [, app] = nested();
      const lib = initRepo(path.join(app, 'vendor', 'lib'));
      git(lib, ['commit', '-q', '--allow-empty', '-m', 'lib']);
      git(lib, ['branch', '-m', 'main', 'trunk']);
      git(lib, ['checkout', '-q', '-b', card.branch]);
      git(lib, ['commit', '-q', '--allow-empty', '-m', 'card']);
      assert.strictEqual(
        refuses(app, openArgs(card)).error,
        'land: in vendor/lib, no default branch to land on — the remote names none, and the repository has no branch init.defaultBranch names, nor main or master; '
        + 'name it with `git config init.defaultBranch <branch>` there',
      );
    });

    it('names the person\'s own checkout, at the repository\'s top, as theirs in a remedy given from the project\'s folder', () => {
      const [dir, app] = nested();
      const phase = 'feat/pay-phase-1';
      ok(app, openArgs(card));
      const top = commitFiles(dir, phase, phase, { 'tidy.txt': 'tidy\n' }, { message: 'my tidy' });
      git(dir, ['checkout', '-q', phase]);
      const refusal = refuses(app, ['land', 'chain', 'pay', '1.1']).error;
      assert.strictEqual(refusal, stray(phase, 1, top, 'my tidy', way(dir, { path: dir, here: true }, phase, moveStep(phase, `${short(top)}^`, `take ${short(top)} off ${phase}`))));
      followRemedy(app, refusal);
      assert.deepStrictEqual(own(ok(app, ['land', 'chain', 'pay', '1.1'])).stack, ['1.1']);
    });
  });
});

describe('land: what the build\'s reviews ask first (12.1.4, 7.2.4)', () => {
  /** A reviewer's report, its verdict given. @param {'pass'|'fail'} verdict */
  const reportOf = (verdict) => `# Review\n\n## Findings\n\n${verdict === 'pass' ? 'None.' : '- bug: the card is charged twice.\n  Scenario: a card taken twice.'}\n\nVerdict: ${verdict}\n`;

  it('refuses to chain a task no round of whose review is reported, whose last round failed unsettled, or whose report does not read, moving nothing — and chains it once the orchestrator settles that round (13.4.6)', () => {
    const dir = project();
    ok(dir, openArgs(card));
    ok(dir, ['task', 'start', UNIT, card.shown]);
    const ref = parseShownTask(UNIT, card.shown);
    const chain = ['land', 'chain', UNIT, card.shown];
    for (const letter of REVIEWER_LETTERS) fs.rmSync(statePath(dir, roundReportPath(ref, 1, letter)));
    const unreported = refusedMoving(dir, chain);
    REVIEWER_LETTERS.forEach((letter, i) => writeState(dir, roundReportPath(ref, 1, letter), reportOf(i === 0 ? 'fail' : 'pass')));
    const failed = refusedMoving(dir, chain);
    writeState(dir, roundReportPath(ref, 1, REVIEWER_LETTERS[1]), 'Looks fine.\n');
    const unread = refusedMoving(dir, chain);

    assert.deepStrictEqual([unreported, failed], [
      'land: task 1.1 has no review round reported — a task chains into its phase\'s stack once its pair has passed it',
      'land: round 1 of task 1.1 did not pass — a task chains into its phase\'s stack once every reviewer of a round passes it, or once the orchestrator settles it: task settle pay 1.1 --file <why>',
    ]);
    assert.ok(unread.startsWith(`land: ${roundReportPath(ref, 1, REVIEWER_LETTERS[1])} does not read as a reviewer's report — `), unread);
    writeState(dir, roundReportPath(ref, 1, REVIEWER_LETTERS[1]), reportOf('pass'));
    ok(dir, ['task', 'settle', UNIT, card.shown, '--file', writeState(dir, `.cache/${UNIT}/why.md`, 'The charge is the driver\'s; the orchestrator fixed it there.\n')]);
    assert.deepStrictEqual(own(ok(dir, chain)).stack, ['1.1']);
  });

  it('refuses to merge a phase the cut holds until its phase review has passed, or failed and been settled — every task done settling nothing — moving nothing, and merges it once passed (13.10.1); a fix phase past the cut asking none (P14)', () => {
    const dir = project();
    createManifest(dir, UNIT, { ...readManifest(dir, UNIT), build: { position: 'auto' }, cut: { phases: [{ name: 'Cards', goal: 'Cards are taken.', scenarios: ['1.S1'], sections: ['1'], relies_on: [] }] } });
    ok(dir, openArgs(card));
    ok(dir, ['land', 'chain', UNIT, card.shown]);
    const unreviewed = refusedMoving(dir, ['land', 'phase', UNIT, '1']);
    REVIEWER_LETTERS.forEach((letter, i) => writeState(dir, phaseReviewPath(UNIT, 1, letter), reportOf(i === 0 ? 'fail' : 'pass')));
    ok(dir, ['task', 'done', UNIT, card.shown]);
    const unsettled = refusedMoving(dir, ['land', 'phase', UNIT, '1']);
    ok(dir, ['task', 'settle', UNIT, '--phase', '1', '--file', writeState(dir, `.cache/${UNIT}/why.md`, 'The double charge is the driver\'s, outside this phase.\n')]);

    assert.deepStrictEqual([unreviewed, unsettled], [
      `land: phase 1 of pay merges once its phase review has passed and its fixes are done — phase 1 of pay has no phase review reported — its reviewers write their reports in ${UNIT}/build/phases/phase-1/`,
      'land: phase 1 of pay merges once its phase review has passed and its fixes are done — phase 1\'s review failed, and no settlement answers it — write its fixes as tasks of the phase, then settle it, naming them: task settle pay --phase 1 --file <why> [--fixes <task>,…]',
    ]);
    assert.deepStrictEqual(own(ok(dir, ['land', 'phase', UNIT, '1'])).merged, ['1.1']);
    assert.strictEqual(refuses(dir, ['land', 'phase', UNIT, '2']).error, 'land: phase 2 of pay has no task opened — open its tasks first');
  });
});

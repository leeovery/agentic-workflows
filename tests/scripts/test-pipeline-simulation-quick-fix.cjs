'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's quick-fix scenarios: scoping registering the
// specification and the plan in one pass, its build refused as one under
// the old plan until the reshape's 29.17 cuts it (P12); and a quick-fix
// built by the build's own arm, three fixes on its one branch through its
// one pull request, each fix's short record written, the pull request
// merged by hand mid-set and the branch cut again for the fix after it,
// whose share in the project's nested clone the door records on the unit's
// manifest before it commits there, and the unit closed, landing it there
// too (19.5.6, 19.5.15, R14, R18), the board drawing its close waiting and
// then following the session to All work (20.14). Its review is
// test-pipeline-simulation-quick-fix-review.cjs's, its moves
// test-pipeline-simulation-quick-fix-move.cjs's.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const {
  Sim, sessionLog, handoffEntry, handoff, answerGate, bridgeTo, linearPick, startNew, startUnit, writeTasks, finishClosed,
} = require('./pipeline-world.cjs');
const { git } = require('./engine-harness.cjs');

describe('pipeline simulation: quick-fix', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('quick-fix: scoping registers spec+plan in one pass, each gate answered through `gate`, and its build waits on 29.17\'s cut', () => {
    // Setup offers the GitHub rule; the person declines, and the flow runs
    // what the row leads to rather than branching on the answer itself.
    sim.render(['github-rule-gate'], { expect: 'content' });
    const declined = answerGate(sim, 'github rule gate', '--pick', 'n');
    assert.deepStrictEqual(declined.next, { kind: 'engine', argv: ['github-rule', 'no'] });
    assert.strictEqual(sim.run(declined.next.argv).github_rule, 'declined');

    const wu = 'typo';
    startNew(sim, 'quick-fix');
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'quick-fix', '--description', 'Rename a flag', '--session-log-file', log]);

    // Scoping (write-tasks): the spec commits BEFORE the baseline is captured,
    // so spec_commit always names a commit containing the specification.
    handoff(sim, `/leeway-scoping-process quick-fix ${wu}`);
    handoffEntry(sim, wu, 'scoping', wu);
    assert.match(sim.render(['scoping-questions', wu, '--open', 'where,exclusions'], { expect: 'content' }),
      /Scoping: Typo\n\nA few questions to scope this change:\n\n- Where in the codebase\?/);
    sim.write(`.leeway/${wu}/specification/${wu}/specification.md`, '# Spec\n');
    sim.run(['topic', 'start', wu, 'specification', wu]);
    sim.run(['topic', 'complete', wu, 'specification', wu]);
    sim.write(`.leeway/${wu}/planning/${wu}/planning.md`, '# Plan\n');
    const baseline = sim.run(['commit', wu, '-m', `scoping(${wu}): specification baseline`]);
    assert.ok(baseline.committed, 'the baseline commit lands the spec');
    sim.run(['topic', 'start', wu, 'planning', wu]);
    sim.run(['manifest', 'set', 'project.defaults.plan_format', 'local-markdown']);
    // Scoping's format step fetches the same offer planning does.
    assert.match(sim.render(['plan-format-gate'], { expect: 'content' }), /Use the same format\?/);
    answerGate(sim, 'plan format gate', '--pick', 'n');
    // Declining it opens the same catalogue, its offer written under scoping's own cache.
    const formats = sim.write(`.leeway/.cache/${wu}/scoping/${wu}/format-offer.json`, {
      formats: [{ name: 'sample-format', label: 'Sample Format — the row the payload named' }],
    });
    assert.match(sim.render(['plan-format-gate', '--variant', 'select', '--file', formats], { expect: 'content' }),
      /\*\*`1`\*\* → Sample Format/);
    sim.run(['manifest', 'set', `${wu}.planning.${wu}`,
      'format=local-markdown', `spec_commit=${baseline.committed}`,
      'review_cycle=0', 'phase=1', 'task=~',
      `external_id=${wu}`, `task_map.${wu}-1=${wu}-1`,
      `task_map.${wu}-1-1=${wu}-1-1`, 'storage_paths=[]']);
    sim.run(['topic', 'complete', wu, 'planning', wu]);
    sim.run(['topic', 'start', wu, 'scoping', wu]);
    sim.run(['topic', 'complete', wu, 'scoping', wu]);
    sim.run(['commit', wu, '-m', `scoping(${wu}): register plan`, '--plan', wu]);
    sim.render(['phase-completed', wu, '--phase', 'scoping', '--paths'], { expect: 'content' });
    // A session that stops here resumes from the quick-fix's continue menu,
    // which hands off where the bridge does.
    assert.strictEqual(linearPick(sim, wu, 'continue').line, `→ Implementation · ${wu}`);

    // The bridge's hop out of scoping: on into implementation, or back into
    // scoping, the quick-fix's one revisit candidate — and no skipping review
    // off this hop.
    const qfGate = sim.render(['next-phase-gate', wu, '--prev', 'scoping', '--next', 'implementation'], { expect: 'content' });
    assert.match(qfGate, /\*\*`r\/revisit`\*\* → Revisit an earlier phase/);
    assert.doesNotMatch(qfGate, /d\/done/);
    answerGate(sim, 'next phase gate', '--pick', 'y');
    bridgeTo(sim, wu, 'implementation');
    // Scoping's spec and plan items stand on the manifest, so the build's
    // entry refuses the quick-fix as one built under the old plan (P12).
    sim.refuses(['enter', 'implementation', wu], /^typo was built under the old plan, and its build is entered once the reshape's 29\.17 migration has cut it$/);
  });

  it('quick-fix: its build entered, three fixes built in the project\'s checkout on its one branch, each recorded, pushed to its one pull request and done; the pull request merged by hand mid-set, the fix after it on the branch cut again, its share in the nested clone recorded; and the close landing what is left in one commit naming the fix it holds in each, then naming the start menu', () => {
    const wu = 'typo';
    const branch = `fix/${wu}`;
    startUnit(sim, 'quick-fix', wu, 'The --color flag is spelt --colour');
    assert.strictEqual(sim.run(['enter', 'implementation', wu]).entered, true);
    const base = git(sim.dir, ['rev-parse', 'main']).trim();
    /** Fix `n` written, started, committed through the door, recorded, pushed to the pull request and done: its start's answer. @param {number} n @param {string} title @param {string[]} files */
    const built = (n, title, files) => {
      const [fix] = writeTasks(sim, wu, 1, [{ title, type: 'fix', reference: 'none', scenarios: [`${n}.S1 Given the help, when it is read, then it names --colour.`] }]);
      const started = sim.run(['task', 'start', wu, fix]);
      for (const file of files) sim.write(file, '--colour\n');
      sim.run(['commit', '--paths', ...files, '--task', wu, fix, '-m', `fix(${wu}): ${title.toLowerCase()}`]);
      const record = sim.write(`.leeway/.cache/${wu}/build/record.md`, `## What changed\n${title}.\n\n## Why\nIt was spelt the American way.\n\n## Leaves out\nOld scripts.\n`);
      sim.run(['quick-fix', 'record', wu, fix, '--file', record]);
      sim.run(['land', 'open', wu, fix]);
      sim.run(['task', 'done', wu, fix]);
      return started;
    };
    const first = built(1, 'Spell the flag --colour', ['src/flag.js']);
    built(2, 'Spell the help --colour', ['src/help.js']);
    // The person merges the pull request by hand mid-set, a squash on main.
    git(sim.dir, ['switch', '-q', 'main']);
    git(sim.dir, ['merge', '-q', '--squash', branch]);
    git(sim.dir, ['commit', '-q', '-m', 'Spell it the British way']);
    git(sim.dir, ['switch', '-q', branch]);
    const third = built(3, 'Spell the docs --colour', ['docs/flags.md', 'api/flags.md']);
    const recorded = sim.manifest(wu).fixes.repos;
    sim.write(`.leeway/${wu}/build/log.md`, '# The fixes\n');
    finishClosed(sim, wu);
    sim.render(['finish', wu], { expect: 'content' });
    const closing = sim.run(['board', sim.env.CLAUDE_CODE_SESSION_ID]).view;
    const yes = sim.run(answerGate(sim, 'finish', '--pick', 'y').next.argv);
    const closed = sim.run(['board', sim.env.CLAUDE_CODE_SESSION_ID]);

    assert.deepStrictEqual([first.branch, third.branch, third.cut_again?.map((/** @type {any} */ { replayed }) => replayed)], [branch, branch, [[]]]);
    assert.deepStrictEqual([recorded, yes.landed.map((/** @type {{repo: string, merged: string[]}} */ { repo, merged }) => [repo, merged]), yes.next], [
      ['api'], [['api', ['1.3']], ['.', ['1.3']]], { kind: 'handoff', skill: 'leeway', args: [] },
    ]);
    assert.deepStrictEqual(git(sim.api, ['log', '-1', '--format=%B', 'main']).match(/^Task: .*$/gm), [`Task: ${wu}-1-3`]);
    assert.strictEqual(sim.manifest(wu).status, 'completed');
    assert.deepStrictEqual([closing.kind, closing.standing, closing.progress, closing.record.map((/** @type {{title: string}} */ { title }) => title), closed.view.kind, closed.banner.state], [
      'quick-fix', 'close', { done: 3, total: 3, written: true }, ['Spell the flag --colour', 'Spell the help --colour', 'Spell the docs --colour'], 'all', 'done',
    ], 'the board draws the close waiting, then follows the session to All work');
    assert.deepStrictEqual([git(sim.dir, ['log', '--format=%s', `${base}..main`]).trim().split('\n'), git(sim.dir, ['log', '-1', '--format=%B', 'main']).match(/^Task: .*$/gm)], [
      [`fix(${wu}): The --color flag is spelt --colour`, 'Spell it the British way'], [`Task: ${wu}-1-3`],
    ]);
  });
});

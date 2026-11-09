'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's quick-fix scenarios: scoping registering the
// specification and the plan in one pass, its build refused as one under
// the old plan until the reshape's 29.17 cuts it (P12); a quick-fix built
// by the build's own arm, three fixes on its one branch through its one
// pull request, each fix's short record written, the pull request merged by
// hand mid-set and the branch cut again for the fix after it, whose share in
// the project's nested clone the door records on the unit's manifest before
// it commits there, and the unit closed, landing it there too (19.5.6,
// 19.5.15, R14, R18); and a quick-fix moved mid-fix to a feature
// through start this work's screen, its pipeline carrying on to the build —
// ready to build showing the call its fix made among Claude's, the build's
// task writer's brief and task 1.1 meeting none of the quick-fix's calls —
// or to a bugfix, handed to its investigation (19.5.9).
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
  Sim, sessionLog, handoffEntry, handoff, answerGate, discussed, bridgeTo, linearPick, startNew, briefDraft, specWritten, specReviewed, cutTheSpec, readyToBuild, intoTheBuild,
  linearBuildPick, buildEntry, briefOf, writePhaseTasks, startPhase, startUnit, writeTasks, finishClosed,
} = require('./pipeline-world.cjs');
const { git } = require('./engine-harness.cjs');

/**
 * The unit moved to `to` as the prose moves it (19.5.9): Claude's payload
 * staged on start this work's screen, the person's yes at its gate, and the
 * yes it leads to run. Answers the yes's answer.
 * @param {Sim} sim @param {string} wu @param {string} to
 */
function movedTo(sim, wu, to) {
  const file = sim.write(`.leeway/.cache/scratch/${wu}-move.json`, { description: `The ${wu} work, as ${to} work.`, reason: 'It needs a decision beyond a quick call.', brief: briefDraft(sim, wu, wu) });
  sim.run(['workunit', 'move', wu, '--to', to, '--file', file]);
  const { next } = answerGate(sim, 'start this work', '--pick', 'y');
  return sim.run(next.argv);
}

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
    const yes = sim.run(answerGate(sim, 'finish', '--pick', 'y').next.argv);

    assert.deepStrictEqual([first.branch, third.branch, third.cut_again?.map((/** @type {any} */ { replayed }) => replayed)], [branch, branch, [[]]]);
    assert.deepStrictEqual([recorded, yes.landed.map((/** @type {{repo: string, merged: string[]}} */ { repo, merged }) => [repo, merged]), yes.next], [
      ['api'], [['api', ['1.3']], ['.', ['1.3']]], { kind: 'handoff', skill: 'leeway', args: [] },
    ]);
    assert.deepStrictEqual(git(sim.api, ['log', '-1', '--format=%B', 'main']).match(/^Task: .*$/gm), [`Task: ${wu}-1-3`]);
    assert.strictEqual(sim.manifest(wu).status, 'completed');
    assert.deepStrictEqual([git(sim.dir, ['log', '--format=%s', `${base}..main`]).trim().split('\n'), git(sim.dir, ['log', '-1', '--format=%B', 'main']).match(/^Task: .*$/gm)], [
      [`fix(${wu}): The --color flag is spelt --colour`, 'Spell it the British way'], [`Task: ${wu}-1-3`],
    ]);
  });

  it('quick-fix moved to a feature: start this work\'s screen, its yes re-typing the unit, and the pipeline carrying on — the call its fix made read on the topic\'s record and shown at ready to build among Claude\'s, and none of the feature\'s build\'s', () => {
    const wu = 'grows';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'quick-fix', '--description', 'Looked small', '--session-log-file', log]);

    // Its fix 1.1 begun, and a call of Claude's made for it.
    sim.run(['enter', 'implementation', wu]);
    sim.run(['task', 'create', wu, '1', '--file', sim.write(`.leeway/.cache/${wu}-fix.md`, [
      '# Spell the flag', '', '## Type', 'fix', '', '## Problem', 'p', '', '## Solution', 's', '', '## Outcome', 'o', '',
      '## Acceptance scenarios', '- 1.S1 Given the help, when read, then spelt right.', '', '## Spec reference', 'none',
    ].join('\n'))]);
    sim.run(['task', 'start', wu, '1.1']);
    const made = { by: 'claude', who_moved_whom: 'none' };
    const asked = sim.run(['ledger', 'ask', `${wu}.implementation`], null, JSON.stringify({ ...made, text: 'Which spelling does the help use?' })).id;
    sim.run(['ledger', 'decide', `${wu}.implementation`, '--answers', asked, '--task', '1.1'], null, JSON.stringify({ ...made, text: 'QUICK-FIX CALL: the help says colour.', why: 'The flag is colour.' }));

    // Complexity check (complexity-check B): which criteria the change fails
    // is the session's read, so the messages ride a payload; the type is the
    // surface's to check. The move re-types the unit at start this work's yes.
    const concerns = sim.write(`.leeway/.cache/${wu}/scoping/${wu}/complexity.json`,
      { concerns: ['Requires design decisions about the new API surface'] });
    assert.match(sim.render(['complexity-gate', wu, '--file', concerns], { expect: 'content' }),
      /• Requires design decisions about the new API surface/);
    const { next } = movedTo(sim, wu, 'feature');
    sim.refuses(['render', 'complexity-gate', wu, '--file', concerns],
      /"grows" is a feature — the complexity check is the quick-fix's own/);

    // The move hands straight to the new type's first phase — a feature's
    // discussion, which it runs normally to its yes: moved mid-fix, it asks,
    // decides and closes at its topic as a unit before its spec.
    assert.strictEqual(handoff(sim, `/${next.skill} ${next.args.join(' ')}`).text, `Invoke \`/leeway-discussion-process feature ${wu}\`.`);
    assert.deepStrictEqual(discussed(sim, wu, wu).next, { kind: 'handoff', skill: 'leeway-specification-process', args: ['feature', wu] });
    assert.deepStrictEqual(sim.run(['ledger', 'record', wu, wu]).decisions.map((d) => [d.text, d.phase]), [['QUICK-FIX CALL: the help says colour.', 'discussion'], ['This.', 'discussion']]);

    // Its spec to ready to build, which shows the call the fix made among
    // Claude's, one the person has not seen; the build begun in auto.
    specWritten(sim, wu, [wu]);
    specReviewed(sim, wu);
    cutTheSpec(sim, wu, [{ name: 'The work', goal: 'The work holds as decided.', scenarios: ['1.S1'], sections: ['1'], relies_on: [] }]);
    assert.match(readyToBuild(sim, wu), /^\*\*`c\/calls`\*\* +→ See Claude's 1 call$/m);
    assert.match(sim.render(['ready-to-build', wu, '--calls'], { expect: 'content' }), /QUICK-FIX CALL: the help says colour\./);
    intoTheBuild(sim, wu, sim.run(answerGate(sim, 'ready to build', '--pick', 'a').next.argv));

    // The feature's build: its task writer's brief and its own task 1.1
    // meet none of the quick-fix's calls.
    linearBuildPick(sim, wu, 'implementation');
    buildEntry(sim, wu);
    assert.doesNotMatch(briefOf(sim, sim.run(['brief', 'task-writer', wu, '1'])), /QUICK-FIX CALL/);
    writePhaseTasks(sim, wu, 1, 'The work', [{ title: 'Write the ledger', scenarios: ['1.S1'] }]);
    startPhase(sim, wu, 1);
    sim.run(['task', 'start', wu, '1.1']);
    const page = JSON.parse(sim.read(['board', sim.env.CLAUDE_CODE_SESSION_ID, '--tab', 'unit', '--page', 'task:1.1'])).view;
    assert.deepStrictEqual([page.kind, page.calls], ['task', []]);
  });

  it('quick-fix moved to a bugfix hands straight to its investigation', () => {
    const wu = 'deeper';
    sim.run(['workunit', 'create', wu, 'quick-fix', '--description', 'Looked small', '--session-log-file', sessionLog(sim, wu)]);
    const { next } = movedTo(sim, wu, 'bugfix');
    assert.strictEqual(handoff(sim, `/${next.skill} ${next.args.join(' ')}`).text, `Invoke \`/leeway-investigation-process bugfix ${wu}\`.`);
  });
});

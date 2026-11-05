'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's quick-fix scenarios: scoping registering the
// specification and the plan in one pass, its build refused as one under
// the old plan until the reshape's 29.17 cuts it (P12); and a quick-fix
// promoted to a feature, its pipeline carrying on, or to a bugfix, handed
// to its investigation.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { Sim, sessionLog, handoffEntry, handoff, answerGate, discussed, bridgeTo, linearPick, startNew } = require('./pipeline-world.cjs');

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

  it('quick-fix promotion: work_type flips to feature and the pipeline continues', () => {
    const wu = 'grows';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'quick-fix', '--description', 'Looked small', '--session-log-file', log]);

    // Complexity check (complexity-check B): which criteria the change fails
    // is the session's read, so the messages ride a payload; the type is the
    // surface's to check. Both manifests flip, then commit.
    const concerns = sim.write(`.leeway/.cache/${wu}/scoping/${wu}/complexity.json`,
      { concerns: ['Requires design decisions about the new API surface'] });
    assert.match(sim.render(['complexity-gate', wu, '--file', concerns], { expect: 'content' }),
      /• Requires design decisions about the new API surface/);
    sim.run(['manifest', 'set', wu, 'work_type', 'feature']);
    sim.run(['manifest', 'set', `project.work_units.${wu}.work_type`, 'feature']);
    sim.run(['commit', '--workflows', '-m', `workflow(${wu}): promote quick-fix to feature`]);
    assert.strictEqual(sim.manifest(wu).work_type, 'feature');
    sim.refuses(['render', 'complexity-gate', wu, '--file', concerns],
      /"grows" is a feature — the complexity check is the quick-fix's own/);

    // The promotion hands straight to the new type's first phase (complexity-
    // check C) — a feature's discussion, which it runs normally to its yes.
    assert.strictEqual(handoff(sim, `/leeway-discussion-process feature ${wu}`).text, `Invoke \`/leeway-discussion-process feature ${wu}\`.`);
    assert.deepStrictEqual(discussed(sim, wu, wu).next, { kind: 'handoff', skill: 'leeway-specification-process', args: ['feature', wu] });
  });

  it('quick-fix promotion to a bugfix hands straight to its investigation', () => {
    const wu = 'deeper';
    sim.run(['workunit', 'create', wu, 'quick-fix', '--description', 'Looked small', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['manifest', 'set', wu, 'work_type', 'bugfix']);
    sim.run(['manifest', 'set', `project.work_units.${wu}.work_type`, 'bugfix']);
    sim.run(['commit', '--workflows', '-m', `workflow(${wu}): promote quick-fix to bugfix`]);
    assert.strictEqual(handoff(sim, `/leeway-investigation-process bugfix ${wu}`).text, `Invoke \`/leeway-investigation-process bugfix ${wu}\`.`);
  });
});

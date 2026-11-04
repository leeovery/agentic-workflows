'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic delivery, on a unit whose building began
// under the old spec, keeping its spec's item, which planning reads until
// 29.17 migrates it: the map's provenance recovery; a dependency's stops
// and its satisfying; review remediation through its plan phases; and the
// discovery-gap candidates.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { Sim, sessionLog, discussed, keptOldSpec } = require('./pipeline-world.cjs');

describe('pipeline simulation: epic delivery', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('epic: provenance recovery, a dependency held and satisfied, remediation, the gap candidates', () => {
    const wu = 'overhaul';
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Payments overhaul', '--session-log-file', sessionLog(sim, wu)]);
    /** @param {string} topic @param {string} [text] */
    const draft = (topic, text = `# Brief — ${topic}\n`) => sim.write(`.leeway/.cache/${wu}/discovery/${topic}/brief-draft.md`, text);
    sim.run(['topic', 'add-batch', wu, '--file', sim.write(`.leeway/.cache/${wu}/discovery/topics.json`, [
      { name: 'alpha', summary: 'Alpha summary', brief: draft('alpha') },
      { name: 'beta', summary: 'Beta summary', brief: draft('beta') },
      { name: 'gamma-prime', summary: 'Gamma, sharpened', brief: draft('gamma-prime') },
    ])]);
    sim.run(['topic', 'order', wu, 'alpha=1', 'beta=2', 'gamma-prime=3']);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): synthesise 3 topics`]);
    // The map as its lifecycle leaves it: alpha and beta decided,
    // gamma-prime cancelled, delta a row a message opened.
    for (const topic of ['alpha', 'beta']) discussed(sim, wu, topic);
    sim.run(['topic', 'cancel', wu, 'discovery', 'gamma-prime']);
    sim.run(['topic', 'add', wu, 'delta', '--source', 'message:alpha', '--summary', 'Delta summary', '--brief', draft('delta'), '--re-add']);
    // The map's provenance recovery has its own two stops (summary-backfill
    // B and D). Every row landed with its summary and no description: the
    // batch shows each summary it keeps, and no line of it is edited here.
    const summaries = sim.write(`.leeway/.cache/${wu}/discovery/summaries.json`, { summaries: {} });
    assert.match(sim.render(['summary-backfill-gate', wu, '--variant', 'batch', '--file', summaries], { expect: 'content' }),
      /Proposed summaries for 4 topic\(s\):[\s\S]*3\. Delta\n {7}Delta summary {2}\(already populated\)/);
    assert.match(sim.render(['summary-backfill-gate', wu, '--variant', 'proposed', '--file', summaries], { expect: 'content' }), /Delta summary/);
    const unsourced = sim.write(`.leeway/.cache/${wu}/discovery/unsourced.json`, { names: ['delta'] });
    assert.match(sim.render(['summary-backfill-gate', wu, '--variant', 'unsourced', '--file', unsourced],
      { expect: 'content' }), /1 topic\(s\) have no source file to draft from:/);
    // Beta's building began under the old spec, whose item it keeps.
    keptOldSpec(sim, wu, 'beta');
    sim.run(['topic', 'start', wu, 'planning', 'beta']);
    sim.run(['topic', 'complete', wu, 'planning', 'beta']);
    sim.run(['manifest', 'set', `${wu}.planning.beta`,
      'external_dependencies.alpha.description=Needs alpha shipped',
      'external_dependencies.alpha.state=unresolved']);
    // Implementation's two dependency stops at its start, and the planning-side
    // approval over the resolutions the plan recorded.
    assert.match(sim.render(['external-dependency-gate', `${wu}.planning.beta`, '--variant', 'blocking',
      '--blocking', 'alpha'], { expect: 'content' }), /Alpha\n {2}├─ Needs alpha shipped\n {2}└─ No plan exists[\s\S]*MENU: blocking dependencies gate/);
    // One blocking dependency leaves nothing to pick; leaving to implement it is the terminal blocker.
    assert.match(sim.render(['external-dependency-gate', `${wu}.planning.beta`, '--variant', 'pick',
      '--blocking', 'alpha'], { expect: 'content' }), /DISPLAY: auto-select[^\n]*\nAutomatically proceeding with "Alpha"\./);
    assert.match(sim.render(['external-dependency-gate', `${wu}.planning.beta`, '--variant', 'exit',
      '--blocking', 'alpha'], { expect: 'content' }), /⚑ "Beta" is blocked until these dependencies are resolved/);
    sim.render(['dependency-approval-gate', `${wu}.planning.beta`, '--variant', 'resolution'], { expect: 'content' });
    // mark-dependency-satisfied.md, which implementation's dependency check
    // loads: the record, then the confined sweep commit.
    sim.run(['manifest', 'set', `${wu}.planning.beta`, 'external_dependencies.alpha.state', 'satisfied_externally']);
    sim.run(['commit', wu, '--topic', 'planning/beta', '--sweep', '-m', `impl(${wu}): mark alpha dependency as satisfied externally`]);

    // Review's staging walks the manifest with validated vocabularies.
    sim.run(['manifest', 'set', `${wu}.review.beta`, 'staging.c1.gate_mode=gated', 'staging.c1.tasks.1=pending', 'staging.c1.tasks.2=pending']);
    sim.run(['manifest', 'set', `${wu}.review.beta`, 'staging.c1.tasks.1', 'approved']);
    sim.refuses(['manifest', 'set', `${wu}.review.beta`, 'staging.c1.tasks.2', 'later'], /Invalid staging task status/);
    // The approval overview joins the staging read to the render — the exact
    // sequence the loop prose prescribes: read statuses, build the payload
    // with them, render the worklist. A staging value the renderer rejects
    // would break here, not on the user's screen.
    const cycle = JSON.parse(sim.read(['manifest', 'get', `${wu}.review.beta`, 'staging.c1']));
    sim.write('.leeway/.cache/scratch/tasks-overview.json', JSON.stringify({
      label: 'Review synthesis cycle 1',
      tasks: Object.keys(cycle.tasks).map((n) => ({ title: `Task ${n}`, severity: 'Important', status: cycle.tasks[n] })),
    }));
    const overview = sim.render(['tasks-overview', `${wu}.review.beta`, '--file', '.leeway/.cache/scratch/tasks-overview.json'], { expect: 'content' });
    assert.match(overview, /1 remaining/, 'the approved row moves the remaining count');
    sim.write('.leeway/.cache/scratch/findings-summary.json', JSON.stringify({
      review_label: 'Integrity Review',
      items: [
        { title: 'Missing Outcome field', tag: 'Minor', summary: 'Task 1-1 lacks the Outcome field.', status: 'approved' },
        { title: 'Orphaned dependency', tag: 'Minor', summary: 'Task 2-3 depends on a removed task.' },
      ],
    }));
    const summary = sim.render(['findings-summary', `${wu}.planning.beta`, '--file', '.leeway/.cache/scratch/findings-summary.json'], { expect: 'content' });
    assert.match(summary, /~~Missing Outcome field~~/, 'the resolved finding renders struck');
    assert.match(summary, /1 remaining/, 'the pending finding moves the remaining count');
    // A choice walks alone, its sides recommended-first.
    const choice = {
      n: 2, total: 2, title: 'Declined Card Copy', meta: [['Category', 'gap']], move: 'choice',
      problem: 'A declined shopper sees nothing.',
      options: [{ summary: 'Show the bank\'s reason' }, { summary: 'Show a generic message', recommended: true }],
    };
    sim.write('.leeway/.cache/scratch/finding-choice.json', JSON.stringify(choice));
    sim.render(['finding', `${wu}.planning.beta`, '--file', '.leeway/.cache/scratch/finding-choice.json'], { expect: 'content' });
    // The review restart clears its staging subtree (exists-guarded delete) so a
    // stale cycle can never hijack the post-restart loop's crash-resume guards.
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.review.beta`, 'staging']).trim(), 'true');
    sim.run(['manifest', 'delete', `${wu}.review.beta`, 'staging']);
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.review.beta`, 'staging']).trim(), 'false');
    sim.refuses(['manifest', 'delete', `${wu}.review.beta`, 'staging'], /not found/);

    // Review remediation lands as a plan phase the writer appends
    // (review-actions-loop.md F), and that phase banks and closes through its
    // boundary like any other — every phase but a quick-fix's does
    // (task-loop.md H, consolidation-pass.md).
    sim.run(['task', 'init', wu, 'beta']);
    sim.run(['manifest', 'set', `${wu}.planning.beta`, 'task_map.beta-2-1=beta-2-1', 'task_map.beta-2-2=beta-2-2']);
    assert.strictEqual(sim.run(['task', 'start', wu, 'beta', 'beta-2-1']).do_banking, true,
      'a remediation task banks — its phase takes the boundary that drains the deposit');
    sim.run(['manifest', 'push', `${wu}.implementation.beta`, 'bank',
      '{"task":"beta-2-1","source":"reviewer","summary":"guard duplicated from the fix","failure":"a rule change lands in one copy and not the other — the two callers disagree silently","detail":"src/a.js:12 mirrors src/b.js:40","files":["src/a.js","src/b.js"]}']);
    sim.run(['task', 'complete', wu, 'beta', 'beta-2-1', '--phase', '2', '--next-task', 'beta-2-2']);
    sim.run(['task', 'start', wu, 'beta', 'beta-2-2']);
    sim.run(['task', 'complete', wu, 'beta', 'beta-2-2', '--phase', '2', '--next-task', '~']);
    // The pass's prelude reads the review item's staging as its second
    // settled-directions source — cleared by the restart above, so it prints
    // empty — and the sweep finds nothing (consolidation-pass.md F).
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.review.beta`, 'staging']).trim(), '',
      'the restart left no review staging for the pass to read');
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.implementation.beta`, 'bank']).trim(), 'true');
    sim.run(['manifest', 'delete', `${wu}.implementation.beta`, 'bank']);
    sim.run(['manifest', 'push', `${wu}.implementation.beta`, 'consolidated_phases', '2']);
    sim.run(['task', 'complete', wu, 'beta', 'beta-2-2', '--phase', '2', '--phase-complete']);
    const remediated = sim.manifest(wu).phases.implementation.items.beta;
    assert.deepStrictEqual(remediated.consolidated_phases, [2], 'the remediation phase records its boundary');
    assert.deepStrictEqual(remediated.completed_phases, [2], 'the remediation phase completes consolidated');
    assert.strictEqual('bank' in remediated, false, 'the boundary emptied the remediation phase\'s bank');

    // The review restart closes an abandoned remediation phase without a
    // sweep (leeway-review-process/SKILL.md, restart step 4): the bank and
    // the half-walked boundary are dropped, the boundary is marked, and the
    // unrun task is skipped on the phase's close — a task of that phase never
    // banks again.
    sim.run(['manifest', 'set', `${wu}.planning.beta`, 'task_map.beta-3-1=beta-3-1', 'task_map.beta-3-2=beta-3-2']);
    sim.run(['task', 'start', wu, 'beta', 'beta-3-1']);
    sim.run(['manifest', 'push', `${wu}.implementation.beta`, 'bank',
      '{"task":"beta-3-1","source":"executor","summary":"dead scaffolding the fix orphaned","failure":"a reader wires the orphaned export into new code and ships a path nothing tests","detail":"src/c.js:8 export unused","files":["src/c.js"]}']);
    sim.run(['task', 'complete', wu, 'beta', 'beta-3-1', '--phase', '3', '--next-task', '~']);
    sim.run(['manifest', 'set', `${wu}.implementation.beta`, 'staging.p3.gate_mode=gated', 'staging.p3.tasks.1=pending']);
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.implementation.beta`, 'bank']).trim(), 'true');
    sim.run(['manifest', 'delete', `${wu}.implementation.beta`, 'bank']);
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.implementation.beta`, 'staging.p3']).trim(), 'true');
    sim.run(['manifest', 'delete', `${wu}.implementation.beta`, 'staging.p3']);
    sim.run(['manifest', 'push', `${wu}.implementation.beta`, 'consolidated_phases', '3']);
    sim.run(['task', 'complete', wu, 'beta', 'beta-3-2', '--phase', '3', '--skipped', '--phase-complete']);
    const abandoned = sim.manifest(wu).phases.implementation.items.beta;
    assert.deepStrictEqual(abandoned.completed_phases, [2, 3], 'the abandoned phase records complete');
    assert.deepStrictEqual(abandoned.consolidated_phases, [2, 3], 'the abandoned phase records its boundary without a sweep');
    assert.strictEqual('bank' in abandoned, false, 'the restart dropped the bank');
    assert.strictEqual('p3' in (abandoned.staging || {}), false, 'the restart dropped the half-walked boundary');
    assert.strictEqual(sim.run(['task', 'start', wu, 'beta', 'beta-3-2']).do_banking, false,
      'a task of the closed remediation phase never banks again');
    // The discovery-gap-analysis approval gate: candidates staged under the
    // analysis' own subtree, decided one at a time, an approved candidate
    // landing on the map with the analysis' provenance and a brief of its
    // own, and the subtree cleared when the analysis closes.
    sim.run(['manifest', 'set', `${wu}.discovery`,
      'analysis_staging.discovery-gap-analysis.gate_mode=gated',
      'analysis_staging.discovery-gap-analysis.candidates.epsilon.status=pending',
      'analysis_staging.discovery-gap-analysis.candidates.zeta.status=pending']);
    assert.match(sim.render(['candidate-gate', wu, '--variant', 'announce'], { expect: 'content' }),
      /Gap analysis surfaced 2 candidate topic\(s\)\./, 'the walk opens on the pending count');
    // The gate itself renders from the staged subtree — gated mode answers
    // with the menu, and a candidate the manifest no longer marks pending
    // never renders at all.
    sim.write('.leeway/.cache/scratch/candidate.json', JSON.stringify({
      name: 'epsilon', summary: 'Epsilon summary',
    }));
    assert.match(
      sim.render(['candidate-gate', wu, '--file', '.leeway/.cache/scratch/candidate.json'], { expect: 'content' }),
      /Add this topic to the map\?/, 'the gated candidate stops for a decision');
    sim.run(['manifest', 'set', `${wu}.discovery`, 'analysis_staging.discovery-gap-analysis.candidates.epsilon.status', 'approved']);
    sim.run(['manifest', 'set', `${wu}.discovery`, 'analysis_staging.discovery-gap-analysis.candidates.zeta.status', 'skipped']);
    sim.refuses(['manifest', 'set', `${wu}.discovery`, 'analysis_staging.discovery-gap-analysis.candidates.zeta.status', 'later'],
      /Invalid candidate status/);
    // An approved gap candidate lands with its brief, as a harvested topic
    // does.
    const brief = '# Discovery Brief — Epsilon\n\nDrawn from the discovery-gap analysis, read out of alpha and beta.\n';
    sim.run(['topic', 'add', wu, 'epsilon', '--summary', 'Epsilon summary', '--source', 'gap-analysis', '--brief', draft('epsilon', brief)]);
    assert.strictEqual(sim.manifest(wu).phases.discovery.items.epsilon.source, 'gap-analysis');
    assert.strictEqual(fs.readFileSync(path.join(sim.dir, `.leeway/${wu}/topics/epsilon/brief.md`), 'utf8'), brief);
    sim.run(['manifest', 'delete', `${wu}.discovery`, 'analysis_staging.discovery-gap-analysis']);
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.discovery`, 'analysis_staging.discovery-gap-analysis']).trim(), 'false');
    assert.match(sim.render(['candidate-gate', wu, '--variant', 'announce'], { expect: 'content' }), /Nothing new to review\./);

    // The epic menu's banner and completion offer render at every state.
    sim.render(['phase-completed', wu, '--phase', 'implementation'], { expect: 'content' });
    sim.render(['epic-all-done-gate', wu], { expect: 'content' });
  });
});

'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic supersession: two decided topics grouped
// into one specification that supersedes the per-topic one; the spec
// boundary's hops as a discussion reopens and a message lands; the build
// order; a dependency held and satisfied; review remediation through its
// plan phases; the discovery-gap candidates; the locks a later stage holds;
// and the gap exit's new topic.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-epic/scripts/gateway.cjs'));
const { bulletRow } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/surfaces.cjs'));
const {
  Sim, sessionLog, send, handoff, arriveAtEpicMenu, epicPick, epicKey, enterEntry, decideTopic, discussed,
} = require('./pipeline-world.cjs');

const { specDetail } = require('./pipeline-oracle.cjs');

describe('pipeline simulation: epic supersession', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('epic: grouping supersession, the spec boundary, the build order, remediation, the gap exit', () => {
    const wu = 'overhaul';
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Payments overhaul', '--session-log-file', sessionLog(sim, wu)]);
    sim.write(`.leeway/${wu}/discovery/briefs/alpha.md`, '# Brief — Alpha\n');
    sim.write(`.leeway/${wu}/discovery/briefs/beta.md`, '# Brief — Beta\n');
    sim.run(['discovery-map', 'add-batch', wu, '--file', sim.write(`.leeway/.cache/${wu}/discovery/topics.json`, [
      { name: 'alpha', routing: 'discussion', summary: 'Alpha summary', brief_path: 'discovery/briefs/alpha.md' },
      { name: 'beta', routing: 'discussion', summary: 'Beta summary', brief_path: 'discovery/briefs/beta.md' },
      { name: 'gamma-prime', routing: 'discussion', summary: 'Gamma, sharpened' },
    ])]);
    sim.run(['discovery-map', 'sequence', wu, 'alpha=1', 'beta=2', 'gamma-prime=3']);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): synthesise 3 topics`]);
    // The map as its lifecycle leaves it: alpha and beta decided,
    // gamma-prime cancelled, delta a row a message opened.
    for (const topic of ['alpha', 'beta']) discussed(sim, wu, topic);
    sim.run(['topic', 'cancel', wu, 'discovery', 'gamma-prime']);
    sim.run(['discovery-map', 'add', wu, 'delta', 'discussion', '--summary', 'Delta summary', '--source', 'message:alpha']);
    /** @param {string} topic @param {string} text */
    const ask = (topic, text) => sim.run(['ledger', 'ask', `${wu}.discussion.${topic}`], null,
      JSON.stringify({ by: 'claude', who_moved_whom: 'none', text })).id;
    /** @param {string} topic @param {string} question @param {string} text */
    const decide = (topic, question, text) => sim.run(['ledger', 'decide', `${wu}.discussion.${topic}`, '--answers', question], null,
      JSON.stringify({ by: 'claude', who_moved_whom: 'none', text, why: 'The record settles it.' }));

    // Grouping: alpha and beta unify into one spec; sources gate, then the
    // per-topic spec items are superseded by the unified one. The menu's
    // specification row carries no route and never meets the soft gate —
    // the menu runs the grouping itself, and the handoff refuses an epic's
    // specification without its topic. It reads the scenario, asks before
    // the analysis, and the map's provenance recovery has its own two stops
    // (summary-backfill B and D).
    assert.strictEqual(epicKey(sim, wu, 'analyze_discussions').route, null);
    sim.refuses(['render', 'epic-soft-gate', wu, '--action', 'analyze_discussions'], /unknown --action "analyze_discussions"/);
    sim.refuses(['handoff', '/leeway-specification-process', 'epic', wu], /^an epic enters specification at a topic$/);
    assert.match(EPIC_GATEWAY.specScenario(sim.dir, wu), /^scenario: analyze$/m);
    assert.match(sim.render(['analysis-proceed-gate', wu], { expect: 'content' }),
      /^=== DISPLAY: analysis prompt [^\n]*\n> Your discussions will be analyzed for natural groupings[\s\S]*Proceed with analysis\?/);
    // Every row landed with its summary and no description: the batch shows
    // each summary it keeps, and no line of it is edited here.
    const summaries = sim.write(`.leeway/.cache/${wu}/discovery/summaries.json`, { summaries: {} });
    assert.match(sim.render(['summary-backfill-gate', wu, '--variant', 'batch', '--file', summaries], { expect: 'content' }),
      /Proposed summaries for 4 topic\(s\):[\s\S]*3\. Delta {2}\(discussion\)\n {7}Delta summary {2}\(already populated\)/);
    assert.match(sim.render(['summary-backfill-gate', wu, '--variant', 'proposed', '--file', summaries], { expect: 'content' }), /Delta summary/);
    const unsourced = sim.write(`.leeway/.cache/${wu}/discovery/unsourced.json`, { names: ['delta'] });
    assert.match(sim.render(['summary-backfill-gate', wu, '--variant', 'unsourced', '--file', unsourced],
      { expect: 'content' }), /1 topic\(s\) have no source file to draft from:/);
    // The analysis reconciles its grouping into a proposed item.
    const grouping = sim.write(`.leeway/.cache/${wu}/specification/reconcile-ops.json`,
      [{ op: 'set', path: `${wu}.specification.alpha`, fields: { status: 'proposed', 'sources.alpha.status': 'pending' } }]);
    sim.run(['manifest', 'apply', wu, '--file', grouping]);
    // The reconcile moved the scenario, so the analysis exit routes on a
    // fresh read: a proposed item standing lands on the groupings. A plain
    // start's confirm answers empty, and the pick hands off with its topic.
    assert.match(EPIC_GATEWAY.specScenario(sim.dir, wu), /^scenario: groupings$/m);
    sim.render(['spec-confirm-gate', `${wu}.specification.alpha`], { expect: 'empty' });
    handoff(sim, `/leeway-specification-process epic ${wu} alpha`);
    sim.run(['topic', 'start', wu, 'specification', 'alpha']);
    assert.deepStrictEqual(sim.run(['topic', 'incorporations', wu, 'alpha']).incorporations, []);
    sim.run(['manifest', 'set', `${wu}.specification.alpha`, 'sources.alpha.status', 'incorporated']);
    sim.write(`.leeway/${wu}/specification/alpha/specification.md`, '# Spec — Alpha\n');
    sim.run(['topic', 'complete', wu, 'specification', 'alpha']);
    assert.deepStrictEqual(sim.run(['topic', 'incorporations', wu, 'alpha']).incorporations, []);
    arriveAtEpicMenu(sim, wu, 'specification');
    // Unify reconciles before its confirm: the proposed `unified` item with
    // every completed discussion pending, and its birth order, ride one
    // apply (bare numbers — the field surface refuses a quoted one); a later
    // regroup renumbers the whole live set through the same door. The apply
    // carries the conditional stale delete the prose collects: a spec
    // completed above, so `manifest exists` answers true and the flag clears
    // alongside the birth orders.
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.specification`, 'build_order_stale']), 'true');
    const birthOps = sim.write(`.leeway/.cache/${wu}/specification/unify-ops.json`,
      [{ op: 'set', path: `${wu}.specification.unified`,
        fields: { status: 'proposed', 'sources.alpha.status': 'pending', 'sources.beta.status': 'pending', order: 1 } },
       { op: 'set', path: `${wu}.specification.alpha`, fields: { order: 2 } },
       { op: 'delete', path: `${wu}.specification`, field: 'build_order_stale' }]);
    sim.run(['manifest', 'apply', wu, '--file', birthOps]);
    assert.strictEqual(sim.manifest(wu).phases.specification.items.unified.order, 1);
    assert.strictEqual(sim.manifest(wu).phases.specification.build_order_stale, undefined,
      'the reconcile is the sequencing — its apply clears the flag');
    const superseded = bulletRow(`${path.join(sim.dir, `.leeway/${wu}/specification/alpha/specification.md`)} → will be superseded`).join('\n');
    assert.ok(sim.render(['spec-confirm-gate', `${wu}.specification.unified`, '--unify'], { expect: 'content' })
      .includes(`Existing specifications to incorporate:\n${superseded}\n`), 'the incorporated specification is named whole');
    handoff(sim, `/leeway-specification-process epic ${wu} unified`);
    // The start records what it incorporates, and the session reads it back
    // at its setup — the same answer the confirm drew.
    sim.run(['topic', 'start', wu, 'specification', 'unified']);
    assert.deepStrictEqual(sim.manifest(wu).phases.specification.items.unified.incorporates, ['alpha']);
    assert.deepStrictEqual(sim.run(['topic', 'incorporations', wu, 'unified']).incorporations,
      [{ topic: 'alpha', path: path.join(sim.dir, `.leeway/${wu}/specification/alpha/specification.md`), covers: ['alpha'] }]);
    const regroupOps = sim.write(`.leeway/.cache/${wu}/specification/reconcile-ops.json`,
      [{ op: 'set', path: `${wu}.specification.alpha`, fields: { order: 1 } },
       { op: 'set', path: `${wu}.specification.unified`, fields: { order: 2 } }]);
    sim.run(['manifest', 'apply', wu, '--file', regroupOps]);
    assert.strictEqual(sim.manifest(wu).phases.specification.items.alpha.order, 1, 'regroup renumbers wholesale');
    // A regroup whose every grouping maps to a started specification leaves
    // nothing proposed: the analysis exit's fresh read lands on the specs menu.
    assert.match(EPIC_GATEWAY.specScenario(sim.dir, wu), /^scenario: specs-menu$/m);
    sim.run(['manifest', 'set', `${wu}.specification.unified`,
      'sources.alpha.status=incorporated', 'sources.beta.status=incorporated']);
    sim.write(`.leeway/${wu}/specification/unified/specification.md`, '# Spec — Unified\n');
    sim.run(['commit', wu, '-m', `spec(${wu}): unified`, '--topic', 'specification/unified']);
    sim.run(['topic', 'complete', wu, 'specification', 'unified']);
    // Completion supersedes each specification the start incorporated, read
    // afresh — and a superseded one drops out of the read.
    for (const { topic } of sim.run(['topic', 'incorporations', wu, 'unified']).incorporations) {
      sim.run(['topic', 'supersede', wu, 'specification', topic, '--by', 'unified']);
      assert.match(sim.render(['topic-receipt', `${wu}.specification.${topic}`, '--verb', 'supersede', '--warn'], { expect: 'content' }),
        /⚑ Knowledge removal warning\n {4}The spec is superseded\./);
    }
    assert.strictEqual(sim.manifest(wu).phases.specification.items.alpha.superseded_by, 'unified');
    assert.deepStrictEqual(sim.run(['topic', 'incorporations', wu, 'unified']).incorporations, []);
    sim.run(['commit', wu, '-m', `spec(${wu}): mark incorporated specifications as superseded`, '--topic', 'specification/unified']);

    // A completed epic specification flags the build order stale; the
    // sequence verb writes the whole live set (superseded alpha is terminal —
    // refused by name, owed no number) and clears the flag.
    assert.strictEqual(sim.manifest(wu).phases.specification.build_order_stale, true);
    sim.refuses(['build-order', 'sequence', wu, 'unified=1', 'alpha=2'], /terminal topics carry no build order/);
    sim.run(['build-order', 'sequence', wu, 'unified=1']);
    const specData = sim.manifest(wu).phases.specification;
    assert.strictEqual(specData.items.unified.order, 1);
    assert.strictEqual(specData.build_order_stale, undefined, 'sequencing clears the stale flag');
    // The soft gate is engine-rendered and empty when nothing sits ahead —
    // unified is the whole live set, so planning it raises no message.
    sim.render(['epic-soft-gate', wu, '--action', 'start_planning', '--topic', 'unified'], { expect: 'empty' });
    epicPick(sim, wu, 'start_planning', 'unified');

    // A dep-blocked plan loses its implementation row; the u/unblock option
    // and the unblock-menu sub-view are the escape hatch, and marking the
    // dependency satisfied externally restores the row.
    sim.run(['topic', 'start', wu, 'planning', 'unified']);
    sim.run(['topic', 'complete', wu, 'planning', 'unified']);
    arriveAtEpicMenu(sim, wu, 'planning');
    sim.run(['manifest', 'set', `${wu}.planning.unified`,
      'external_dependencies.alpha.description=Needs alpha shipped',
      'external_dependencies.alpha.state=unresolved']);
    // Implementation's two dependency stops at its start, and the planning-side
    // approval over the resolutions the plan recorded.
    assert.match(sim.render(['external-dependency-gate', `${wu}.planning.unified`, '--variant', 'blocking',
      '--blocking', 'alpha'], { expect: 'content' }), /Alpha\n {2}├─ Needs alpha shipped\n {2}└─ No plan exists[\s\S]*MENU: blocking dependencies gate/);
    // One blocking dependency leaves nothing to pick; leaving to implement it is the terminal blocker.
    assert.match(sim.render(['external-dependency-gate', `${wu}.planning.unified`, '--variant', 'pick',
      '--blocking', 'alpha'], { expect: 'content' }), /DISPLAY: auto-select[^\n]*\nAutomatically proceeding with "Alpha"\./);
    assert.match(sim.render(['external-dependency-gate', `${wu}.planning.unified`, '--variant', 'exit',
      '--blocking', 'alpha'], { expect: 'content' }), /⚑ "Unified" is blocked until these dependencies are resolved/);
    sim.render(['dependency-approval-gate', `${wu}.planning.unified`, '--variant', 'resolution'], { expect: 'content' });
    const epicDetailNow = () => EPIC_GATEWAY.discover(sim.dir, wu);
    const menuNow = () => require(path.join(ROOT, 'skills/leeway-engine/scripts/lib.cjs')).project.epicMenu(wu, epicDetailNow());
    let keys = menuNow().keys;
    assert.ok(!keys.some((k) => k.action === 'start_implementation' && k.topic === 'unified'),
      'a dep-blocked implementation start carries no menu row');
    assert.ok(keys.some((k) => k.action === 'unblock_plan'), 'the unblock option surfaces');
    const unblockView = require(path.join(ROOT, 'skills/leeway-engine/scripts/lib.cjs')).project.epicUnblockMenu(epicDetailNow());
    assert.deepStrictEqual(unblockView.keys.map((k) => [k.key, k.action, k.topic, k.dep ?? null])[0],
      ['1', 'unblock', 'unified', 'alpha']);
    // mark-dependency-satisfied.md, which the unblock and implementation's
    // dependency check both load: the record, then the confined sweep commit.
    sim.run(['manifest', 'set', `${wu}.planning.unified`, 'external_dependencies.alpha.state', 'satisfied_externally']);
    sim.run(['commit', wu, '--topic', 'planning/unified', '--sweep', '-m', `impl(${wu}): mark alpha dependency as satisfied externally`]);
    keys = menuNow().keys;
    assert.ok(keys.some((k) => k.action === 'start_implementation' && k.topic === 'unified'),
      'a satisfied dependency restores the implementation row');
    assert.ok(!keys.some((k) => k.action === 'unblock_plan'), 'the unblock option withdraws');

    // Supersession is terminal: the absorbed spec cannot restart or complete.
    sim.refuses(['topic', 'start', wu, 'specification', 'alpha'], /superseded/);
    sim.refuses(['topic', 'complete', wu, 'specification', 'alpha'], /superseded/);

    // The discussion hop finds the grouped spec by reverse join: re-deciding
    // beta flags 'unified' (a spec named differently) and stales its beta row;
    // the superseded alpha spec is terminal — never flagged.
    const betaReopen = sim.run(['topic', 'reopen', wu, 'discussion', 'beta']);
    assert.deepStrictEqual(betaReopen.reconcile_flagged, [{ phase: 'specification', topic: 'unified' }]);
    assert.deepStrictEqual(betaReopen.sources_staled, ['unified']);
    const unified = sim.manifest(wu).phases.specification.items.unified;
    assert.strictEqual(unified.reconcile_needed, 'discussion');
    assert.strictEqual(unified.sources.beta.status, 'stale');
    assert.strictEqual(unified.sources.alpha.status, 'incorporated', 'sibling rows untouched');
    assert.strictEqual(sim.manifest(wu).phases.specification.items.alpha.reconcile_needed, undefined);
    // While beta is back in-progress, the spec boundary hard-blocks the spec it
    // sources: the entry gate refuses direct entry, and the scoped view marks
    // the row blocked (unselectable until the discussion re-concludes).
    const gateWhileOpen = sim.render(['entry-gate', `${wu}.specification.unified`], { expect: 'content' });
    assert.match(gateWhileOpen, /Sources for "Unified" are not concluded: beta/);
    const openView = specDetail(sim.dir, wu);
    assert.strictEqual(openView.scenario, 'blocked-discussions-open',
      'the single fast-path into an itself-blocked spec derives the terminal scenario');
    const openRow = openView.actionable.find((r) => r.name === 'unified');
    assert.strictEqual(openRow.blocked, true);
    assert.deepStrictEqual(openRow.open_sources, ['beta']);
    enterEntry(sim, wu, 'discussion', 'beta');
    decideTopic(sim, wu, 'beta');
    sim.render(['entry-gate', `${wu}.specification.unified`], { expect: 'empty' });
    assert.strictEqual(specDetail(sim.dir, wu).actionable.find((r) => r.name === 'unified').blocked, false);
    // While stale, the spec boundary keeps the spec actionable — never
    // concluded — and the stale row rides the detail.
    const staleView = specDetail(sim.dir, wu);
    // The menu routes on its scenario read, which carries no gate: the specs
    // menu is fetched by the display that shows it.
    assert.strictEqual(staleView.scenario, 'specs-menu');
    const routingRead = EPIC_GATEWAY.specScenario(sim.dir, wu);
    assert.match(routingRead, /^scenario: specs-menu$/m);
    assert.doesNotMatch(routingRead, /^=== (MENU|DISPLAY|TITLE)/m);
    const unifiedRow = staleView.actionable.find((r) => r.name === 'unified');
    assert.ok(unifiedRow, 'staled spec stays actionable');
    assert.strictEqual(unifiedRow.stale, 1);
    // A continue hands off on the pick: its start already took in what it
    // incorporates, so the confirm answers empty.
    sim.render(['spec-confirm-gate', `${wu}.specification.unified`], { expect: 'empty' });
    // Reconciliation: the advisory clears the flag as the spec starts; the
    // diff-guided re-extraction re-incorporates the row, and the spec reads
    // as concluded again — a refine, whose confirm answers empty too.
    sim.run(['manifest', 'delete', `${wu}.specification.unified`, 'reconcile_needed']);
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'sources.beta.status', 'incorporated']);
    assert.ok(specDetail(sim.dir, wu).concluded.some((r) => r.name === 'unified'));
    sim.render(['spec-confirm-gate', `${wu}.specification.unified`], { expect: 'empty' });

    // A message landing on the spec'd completed discussion takes the same
    // hop — no completed→in-progress transition skips it.
    const landedReopen = send(sim, wu, 'beta', 'alpha', 'late-call');
    assert.strictEqual(landedReopen.reopened, true);
    assert.strictEqual(landedReopen.reconcile_flagged, true);
    assert.deepStrictEqual(landedReopen.sources_staled, ['unified']);
    const lateCall = ask('beta', 'Does the late call change beta?');
    sim.run(['topic', 'answered', wu, 'beta', '001-late-call', '--entry', lateCall]);
    decide('beta', lateCall, 'No.');
    decideTopic(sim, wu, 'beta');
    sim.run(['manifest', 'delete', `${wu}.specification.unified`, 'reconcile_needed']);
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'sources.beta.status', 'incorporated']);

    // The quiet-edit safety valve: a spec-side resolution amends beta's
    // document in place — `sources stale` runs the same reverse join with no
    // reopen, `--except` sparing the invoking spec whose extraction of the
    // resolution is current by construction.
    const quietSpared = sim.run(['sources', 'stale', wu, 'beta', '--except', 'unified']);
    assert.deepStrictEqual(quietSpared.staled, [], 'the invoking spec is spared');
    const quiet = sim.run(['sources', 'stale', wu, 'beta']);
    assert.deepStrictEqual(quiet.staled, ['unified']);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.beta.status, 'completed', 'no reopen — the discussion is untouched');
    assert.strictEqual(sim.manifest(wu).phases.specification.items.unified.sources.beta.status, 'stale');
    sim.run(['manifest', 'delete', `${wu}.specification.unified`, 'reconcile_needed']);
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'sources.beta.status', 'incorporated']);

    // The grouping's bookkeeping: the wildcard snapshot and the analysis cache
    // metadata (a phase-level write on discussion).
    const statuses = sim.read(['manifest', 'get', `${wu}.specification.*`, 'status']);
    assert.match(statuses, /superseded/);
    sim.run(['manifest', 'set', `${wu}.discussion`, 'analysis_cache.checksum', 'abc123']);
    sim.run(['manifest', 'set', `${wu}.discussion`, 'analysis_cache.generated', '2026-07-23']);

    // Staging, candidate, and tracking state walks the manifest with
    // validated vocabularies at every step.
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'review_cycle=1', 'review_baseline_words=6835']);
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.specification.unified`, 'review_baseline_words']), '6835',
      'the construction baseline survives as a number the growth diagnostic can read');
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'tracking.review-claims-tracking-c1', 'in-progress']);
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'tracking.review-claims-tracking-c1', 'complete']);
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'tracking.review-input-tracking-c1', 'in-progress']);
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'tracking.review-input-tracking-c1', 'complete']);
    sim.refuses(['manifest', 'set', `${wu}.specification.unified`, 'tracking.review-input-tracking-c1', 'done'], /Invalid tracking status/);
    // The review loop's two gates and the conclusion's consent gates render
    // from the same address the prose fetches them at; a non-specification
    // address refuses.
    assert.match(sim.render(['spec-review-gate', `${wu}.specification.unified`, '--variant', 'continue'], { expect: 'content' }),
      /Continue with review\?/);
    assert.match(sim.render(['spec-review-gate', `${wu}.specification.unified`, '--variant', 'reloop'], { expect: 'content' }),
      /Run another review cycle\?/);
    // The epic's cross-cutting assessment above its confirm, from a judgment payload.
    const assessment = sim.write(`.leeway/.cache/${wu}/specification/unified/assessment.json`,
      { cross_cutting: false, rationale: 'It builds the unified pipeline.' });
    assert.match(sim.render(['spec-completion-gate', `${wu}.specification.unified`, '--variant', 'assessment', '--file', assessment], { expect: 'content' }),
      /This specification is directly plannable[\s\S]*Confirm this assessment\?/);
    assert.match(sim.render(['spec-completion-gate', `${wu}.specification.unified`, '--variant', 'signoff'], { expect: 'content' }),
      /Ready to conclude\?/);
    sim.refuses(['render', 'spec-review-gate', `${wu}.review.unified`, '--variant', 'reloop'],
      /address must be <work_unit>\.specification\.<topic>/);
    sim.refuses(['render', 'spec-completion-gate', `${wu}.review.unified`, '--variant', 'signoff'],
      /address must be <work_unit>\.specification\.<topic>/);
    // The escalation diagnostic renders from a judgment payload; the counts,
    // growth arithmetic, and advisory flags are the surface's own.
    sim.write('.leeway/.cache/scratch/convergence.json', JSON.stringify({
      loop_type: 'spec-review', latest_cycle: 5, trend: 'converging',
      resolved: [], recurring: [], new: [{ title: 'Sweep table omits a file' }],
      stream_counts: [{ label: 'claims', count: 0 }, { label: 'input review', count: 1 }, { label: 'gap analysis', count: 0 }],
      review_baseline_words: 6835, live_words: 13637,
    }));
    const diagnostic = sim.render(['convergence-diagnostic', `${wu}.specification.unified`, '--file', '.leeway/.cache/scratch/convergence.json'], { expect: 'content' });
    assert.match(diagnostic, /\(\+6802 net across review\)/);
    assert.match(diagnostic.replace(/\n\s+/g, ' '), /growth from review-authored rules is the review deciding for the user/,
      'the growth flag names review-authored growth');
    sim.run(['manifest', 'set', `${wu}.review.unified`, 'staging.c1.gate_mode=gated', 'staging.c1.tasks.1=pending', 'staging.c1.tasks.2=pending']);
    sim.run(['manifest', 'set', `${wu}.review.unified`, 'staging.c1.tasks.1', 'approved']);
    sim.refuses(['manifest', 'set', `${wu}.review.unified`, 'staging.c1.tasks.2', 'later'], /Invalid staging task status/);
    // The approval overview joins the staging read to the render — the exact
    // sequence the loop prose prescribes: read statuses, build the payload
    // with them, render the worklist. A staging value the renderer rejects
    // would break here, not on the user's screen.
    const cycle = JSON.parse(sim.read(['manifest', 'get', `${wu}.review.unified`, 'staging.c1']));
    sim.write('.leeway/.cache/scratch/tasks-overview.json', JSON.stringify({
      label: 'Review synthesis cycle 1',
      tasks: Object.keys(cycle.tasks).map((n) => ({ title: `Task ${n}`, severity: 'Important', status: cycle.tasks[n] })),
    }));
    const overview = sim.render(['tasks-overview', `${wu}.review.unified`, '--file', '.leeway/.cache/scratch/tasks-overview.json'], { expect: 'content' });
    assert.match(overview, /1 remaining/, 'the approved row moves the remaining count');
    sim.write('.leeway/.cache/scratch/findings-summary.json', JSON.stringify({
      review_label: 'Integrity Review',
      items: [
        { title: 'Missing Outcome field', tag: 'Minor', summary: 'Task 1-1 lacks the Outcome field.', status: 'approved' },
        { title: 'Orphaned dependency', tag: 'Minor', summary: 'Task 2-3 depends on a removed task.' },
      ],
    }));
    const summary = sim.render(['findings-summary', `${wu}.specification.unified`, '--file', '.leeway/.cache/scratch/findings-summary.json'], { expect: 'content' });
    assert.match(summary, /~~Missing Outcome field~~/, 'the resolved finding renders struck');
    assert.match(summary, /1 remaining/, 'the pending finding moves the remaining count');
    // A choice walks alone, its sides recommended-first.
    const choice = {
      n: 2, total: 2, title: 'Declined Card Copy', meta: [['Category', 'gap']], move: 'choice',
      problem: 'A declined shopper sees nothing.',
      options: [{ summary: 'Show the bank\'s reason' }, { summary: 'Show a generic message', recommended: true }],
    };
    sim.write('.leeway/.cache/scratch/spec-choice.json', JSON.stringify(choice));
    sim.render(['finding', `${wu}.specification.unified`, '--file', '.leeway/.cache/scratch/spec-choice.json'], { expect: 'content' });
    // The specification's calls batch — gated it asks once for the screen
    // and offers the flip; under auto the same screen lands as a display,
    // the one gate that never stops.
    sim.write('.leeway/.cache/scratch/finding-batch.json', JSON.stringify({
      remaining: 0,
      items: [
        { title: 'A repeated field name resolves to its last occurrence', detail: 'The sweep table leans this way; first-wins also fits the record.' },
        { title: 'An empty bare value writes a newline', detail: 'The output contract leans this way; zero bytes also fits the record.' },
      ],
    }));
    const settledBatch = sim.render(['finding-batch', `${wu}.specification.unified`, '--file', '.leeway/.cache/scratch/finding-batch.json'], { expect: 'content' });
    assert.match(settledBatch, /DISPLAY: finding batch/, 'the batch renders its screen at a specification address');
    assert.match(settledBatch, /`◆ Document them\?`/, 'the batch asks to document the calls');
    assert.match(settledBatch, /`a\/auto`/, 'the screen offers the flip that retires the rest');
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'finding_gate_mode', 'auto']);
    const autoBatch = sim.render(['finding-batch', `${wu}.specification.unified`, '--file', '.leeway/.cache/scratch/finding-batch.json'], { expect: 'content' });
    assert.match(autoBatch, /DISPLAY: finding batch auto-approved/, 'auto lands the screen as a display');
    assert.match(autoBatch, /Documenting all 2 \[auto\]\./);
    assert.ok(!autoBatch.includes('MENU'), 'auto means auto — the batch never stops');
    // The review restart clears its staging subtree (exists-guarded delete) so a
    // stale cycle can never hijack the post-restart loop's crash-resume guards.
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.review.unified`, 'staging']).trim(), 'true');
    sim.run(['manifest', 'delete', `${wu}.review.unified`, 'staging']);
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.review.unified`, 'staging']).trim(), 'false');
    sim.refuses(['manifest', 'delete', `${wu}.review.unified`, 'staging'], /not found/);

    // Review remediation lands as a plan phase the writer appends
    // (review-actions-loop.md F), and that phase banks and closes through its
    // boundary like any other — every phase but a quick-fix's does
    // (task-loop.md H, consolidation-pass.md).
    sim.run(['task', 'init', wu, 'unified']);
    sim.run(['manifest', 'set', `${wu}.planning.unified`, 'task_map.unified-2-1=unified-2-1', 'task_map.unified-2-2=unified-2-2']);
    assert.strictEqual(sim.run(['task', 'start', wu, 'unified', 'unified-2-1']).do_banking, true,
      'a remediation task banks — its phase takes the boundary that drains the deposit');
    sim.run(['manifest', 'push', `${wu}.implementation.unified`, 'bank',
      '{"task":"unified-2-1","source":"reviewer","summary":"guard duplicated from the fix","failure":"a rule change lands in one copy and not the other — the two callers disagree silently","detail":"src/a.js:12 mirrors src/b.js:40","files":["src/a.js","src/b.js"]}']);
    sim.run(['task', 'complete', wu, 'unified', 'unified-2-1', '--phase', '2', '--next-task', 'unified-2-2']);
    sim.run(['task', 'start', wu, 'unified', 'unified-2-2']);
    sim.run(['task', 'complete', wu, 'unified', 'unified-2-2', '--phase', '2', '--next-task', '~']);
    // The pass's prelude reads the review item's staging as its second
    // settled-directions source — cleared by the restart above, so it prints
    // empty — and the sweep finds nothing (consolidation-pass.md F).
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.review.unified`, 'staging']).trim(), '',
      'the restart left no review staging for the pass to read');
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.implementation.unified`, 'bank']).trim(), 'true');
    sim.run(['manifest', 'delete', `${wu}.implementation.unified`, 'bank']);
    sim.run(['manifest', 'push', `${wu}.implementation.unified`, 'consolidated_phases', '2']);
    sim.run(['task', 'complete', wu, 'unified', 'unified-2-2', '--phase', '2', '--phase-complete']);
    const remediated = sim.manifest(wu).phases.implementation.items.unified;
    assert.deepStrictEqual(remediated.consolidated_phases, [2], 'the remediation phase records its boundary');
    assert.deepStrictEqual(remediated.completed_phases, [2], 'the remediation phase completes consolidated');
    assert.strictEqual('bank' in remediated, false, 'the boundary emptied the remediation phase\'s bank');

    // The review restart closes an abandoned remediation phase without a
    // sweep (leeway-review-process/SKILL.md, restart step 4): the bank and
    // the half-walked boundary are dropped, the boundary is marked, and the
    // unrun task is skipped on the phase's close — a task of that phase never
    // banks again.
    sim.run(['manifest', 'set', `${wu}.planning.unified`, 'task_map.unified-3-1=unified-3-1', 'task_map.unified-3-2=unified-3-2']);
    sim.run(['task', 'start', wu, 'unified', 'unified-3-1']);
    sim.run(['manifest', 'push', `${wu}.implementation.unified`, 'bank',
      '{"task":"unified-3-1","source":"executor","summary":"dead scaffolding the fix orphaned","failure":"a reader wires the orphaned export into new code and ships a path nothing tests","detail":"src/c.js:8 export unused","files":["src/c.js"]}']);
    sim.run(['task', 'complete', wu, 'unified', 'unified-3-1', '--phase', '3', '--next-task', '~']);
    sim.run(['manifest', 'set', `${wu}.implementation.unified`, 'staging.p3.gate_mode=gated', 'staging.p3.tasks.1=pending']);
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.implementation.unified`, 'bank']).trim(), 'true');
    sim.run(['manifest', 'delete', `${wu}.implementation.unified`, 'bank']);
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.implementation.unified`, 'staging.p3']).trim(), 'true');
    sim.run(['manifest', 'delete', `${wu}.implementation.unified`, 'staging.p3']);
    sim.run(['manifest', 'push', `${wu}.implementation.unified`, 'consolidated_phases', '3']);
    sim.run(['task', 'complete', wu, 'unified', 'unified-3-2', '--phase', '3', '--skipped', '--phase-complete']);
    const abandoned = sim.manifest(wu).phases.implementation.items.unified;
    assert.deepStrictEqual(abandoned.completed_phases, [2, 3], 'the abandoned phase records complete');
    assert.deepStrictEqual(abandoned.consolidated_phases, [2, 3], 'the abandoned phase records its boundary without a sweep');
    assert.strictEqual('bank' in abandoned, false, 'the restart dropped the bank');
    assert.strictEqual('p3' in (abandoned.staging || {}), false, 'the restart dropped the half-walked boundary');
    assert.strictEqual(sim.run(['task', 'start', wu, 'unified', 'unified-3-2']).do_banking, false,
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
      name: 'epsilon', routing: 'discussion', summary: 'Epsilon summary',
    }));
    assert.match(
      sim.render(['candidate-gate', wu, '--file', '.leeway/.cache/scratch/candidate.json'], { expect: 'content' }),
      /Add this topic to the map\?/, 'the gated candidate stops for a decision');
    sim.run(['manifest', 'set', `${wu}.discovery`, 'analysis_staging.discovery-gap-analysis.candidates.epsilon.status', 'approved']);
    sim.run(['manifest', 'set', `${wu}.discovery`, 'analysis_staging.discovery-gap-analysis.candidates.zeta.status', 'skipped']);
    sim.refuses(['manifest', 'set', `${wu}.discovery`, 'analysis_staging.discovery-gap-analysis.candidates.zeta.status', 'later'],
      /Invalid candidate status/);
    // Row first, brief second: the add is what refuses a duplicate name.
    sim.run(['discovery-map', 'add', wu, 'epsilon', 'discussion', '--summary', 'Epsilon summary',
      '--source', 'gap-analysis', '--brief-path', 'discovery/briefs/epsilon.md']);
    const epsilon = sim.manifest(wu).phases.discovery.items.epsilon;
    assert.strictEqual(epsilon.source, 'gap-analysis');
    assert.strictEqual(epsilon.brief_path, 'discovery/briefs/epsilon.md',
      'an approved gap candidate carries its brief pointer, as a harvested topic does');
    sim.write(`.leeway/${wu}/discovery/briefs/epsilon.md`, [
      '# Discovery Brief — Epsilon',
      '',
      'Drawn from the discovery-gap analysis, read out of alpha.md, beta.md.',
      '',
    ].join('\n'));
    sim.run(['manifest', 'delete', `${wu}.discovery`, 'analysis_staging.discovery-gap-analysis']);
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.discovery`, 'analysis_staging.discovery-gap-analysis']).trim(), 'false');
    assert.match(sim.render(['candidate-gate', wu, '--variant', 'announce'], { expect: 'content' }), /Nothing new to review\./);

    // The epic menu's banner and completion offer render at every state.
    sim.render(['phase-completed', wu, '--phase', 'specification'], { expect: 'content' });
    sim.render(['epic-all-done-gate', wu], { expect: 'content' });

    // A later stage locks the earlier, and nothing rolls through: the
    // started specification holds its source topic, the code under the
    // specification holds the specification. The menu lists both, keyless
    // with the reason; the gate and the verb refuse.
    const units = EPIC_GATEWAY.discover(sim.dir, wu).cancellable;
    assert.strictEqual(units.find((u) => u.stage === 'discovery' && u.name === 'beta').locked,
      'locked by specification "Unified" — cancel it first');
    assert.strictEqual(units.find((u) => u.stage === 'specification' && u.name === 'unified').locked,
      'implementation started — fix forward');
    sim.refuses(['topic', 'cancel', wu, 'discovery', 'beta'],
      /cancelling "beta" is refused while the specification "unified" sources its discussion — cancel the specification first/);
    sim.refuses(['render', 'cancel-gate', `${wu}.discovery.beta`], /locked by the specification sourcing its discussion \("unified"\)/);
    sim.refuses(['topic', 'cancel', wu, 'specification', 'unified'],
      /"unified" is locked — implementation has started; code in the tree is fixed forward, and the work-unit cancel abandons the epic/);
    sim.refuses(['render', 'cancel-gate', `${wu}.specification.unified`], /is locked — implementation has started/);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.beta.status, 'completed');
    assert.strictEqual(sim.manifest(wu).phases.specification.items.unified.status, 'completed');

    // The gap exit's new-topic destination: a gap the room has to take is
    // offered three homes on an epic, and the `t/topic` pick opens one on
    // the map, parks the gap on it, and joins it to this specification's
    // sources — which then waits for it exactly as for a reopened source.
    sim.write('.leeway/.cache/scratch/gap-route.json', JSON.stringify({
      lane: 'review', doc: 'refund-window', title: 'The refund window is undecided',
      context: 'No source bounds how long a refund can be claimed.',
    }));
    const gapGate = sim.render(['incoherence-gate', `${wu}.specification.unified`,
      '--file', '.leeway/.cache/scratch/gap-route.json', '--variant', 'gap-route'], { expect: 'content' });
    assert.match(gapGate, /`◆ Reopen it\?`/, 'an epic gap is a fork between three homes, not an acknowledgement');
    assert.match(gapGate, /`y\/yes`.+→ Reopen "refund-window" with the gap and pause here/);
    assert.match(gapGate, /`t\/topic`/);
    assert.match(gapGate, /`r\/roadmap`/);
    sim.write('.leeway/.cache/scratch/message-scratch.md', 'Refund window\n\nHow long can a refund be claimed?\n');
    sim.run(['discovery-map', 'add', wu, 'refund-window', 'discussion',
      '--summary', 'How long a refund can be claimed', '--source', 'message:unified']);
    sim.run(['topic', 'send', wu, 'refund-window', '--from', 'alpha', '--content', '.leeway/.cache/scratch/message-scratch.md', '--slug', 'refund-window']);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items['refund-window'].status, 'unstarted');
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'sources.refund-window.status', 'pending']);
    const blockedByGap = () => EPIC_GATEWAY.discover(sim.dir, wu).spec_blocked;
    assert.deepStrictEqual(blockedByGap(), [{ name: 'unified', by: ['refund-window'] }],
      'a source that has never concluded blocks its spec like one back in-progress');
    assert.match(sim.render(['entry-gate', `${wu}.specification.unified`], { expect: 'content' }),
      /Sources for "Unified" are not concluded: refund-window/);
    sim.refuses(['topic', 'complete', wu, 'specification', 'unified'],
      /unresolved source rows \(refund-window\)/);
    // Opening the conversation releases nothing: the specification waits for
    // the answer, not for the room to sit.
    enterEntry(sim, wu, 'discussion', 'refund-window');
    assert.deepStrictEqual(blockedByGap(), [{ name: 'unified', by: ['refund-window'] }]);
    assert.match(sim.render(['entry-gate', `${wu}.specification.unified`], { expect: 'content' }),
      /Sources for "Unified" are not concluded: refund-window/);
  });
});

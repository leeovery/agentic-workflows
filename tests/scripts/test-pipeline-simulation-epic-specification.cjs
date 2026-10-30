'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic specification scenarios: a specification
// pausing on a gap it routed; a cancel discarding the last grouping over a
// still-valid analysis cache; a grouping started over a started
// specification's discussion; the single-discussion path's confirm, and a
// unit named `unified`; a plan held while its specification is unsettled;
// and the send door reaching the hold.
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
const { epicMenu } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/epic.cjs'));
const {
  Sim, sessionLog, send, mappedEpic, menuEntry, handoffEntry, handoff, bridgeTo, arriveAtEpicMenu, epicPick, epicKey, literal,
} = require('./pipeline-world.cjs');

const { specDetail } = require('./pipeline-oracle.cjs');

describe('pipeline simulation: epic-specification', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('a specification pausing on a gap it routed goes through the bridge — a linear unit into the reopened record, an epic to its menu', () => {
    // The gap exit (resolve-source-incoherence B → D): the message lands in
    // the source's mailbox, reopening it and staling the spec's row;
    // the pause commits the session's work and hands off as a pause. The
    // gap routes into the first of the specification's sources.
    const pauseOnGap = (wu, spec, [source, ...rest]) => {
      menuEntry(sim, wu);
      handoffEntry(sim, wu, 'specification', spec);
      sim.run(['topic', 'start', wu, 'specification', spec]);
      sim.run(['manifest', 'set', `${wu}.specification.${spec}`,
        ...[source, ...rest].map((name) => `sources.${name}.status=incorporated`)]);
      const message = sim.write('.leeway/.cache/scratch/spec-gap.md', 'Gap — retry window\n\nWhat the spec needs decided.\n');
      const landed = sim.run(['topic', 'send', wu, source, '--from', source, '--content', message, '--slug', 'retry-window']);
      assert.strictEqual(landed.reopened, true);
      assert.deepStrictEqual(landed.sources_staled, [spec]);
      sim.run(['commit', wu, '-m', `spec(${wu}): pause — gap routed to ${source}`, '--topic', `specification/${spec}`]);
    };

    // A linear unit hands straight into the record the gap reopened — the
    // bridge's paused arm takes the derived next phase and offers nothing.
    const feature = 'retry';
    sim.run(['workunit', 'create', feature, 'feature', '--description', 'Retries', '--session-log-file', sessionLog(sim, feature)]);
    sim.run(['topic', 'start', feature, 'discussion', feature]);
    sim.write(`.leeway/${feature}/discussion/${feature}.md`, `# Discussion — ${feature}\n`);
    sim.run(['topic', 'complete', feature, 'discussion', feature]);
    pauseOnGap(feature, feature, [feature]);
    bridgeTo(sim, feature, 'discussion');

    const bugfix = 'stall';
    sim.run(['workunit', 'create', bugfix, 'bugfix', '--description', 'Stalls', '--session-log-file', sessionLog(sim, bugfix)]);
    sim.run(['topic', 'start', bugfix, 'investigation', bugfix]);
    sim.write(`.leeway/${bugfix}/investigation/${bugfix}.md`, `# Investigation — ${bugfix}\n`);
    sim.run(['topic', 'complete', bugfix, 'investigation', bugfix]);
    pauseOnGap(bugfix, bugfix, [bugfix]);
    bridgeTo(sim, bugfix, 'investigation');

    // An epic returns to its menu, whose banner names what the specification
    // awaits; the routed discussion's re-conclusion leaves the bare line.
    const epic = 'panes';
    mappedEpic(sim, epic, ['note-window', 'layout']);
    for (const topic of ['note-window', 'layout']) {
      sim.run(['topic', 'start', epic, 'discussion', topic]);
      sim.write(`.leeway/${epic}/discussion/${topic}.md`, `# Discussion — ${topic}\n`);
      sim.run(['topic', 'complete', epic, 'discussion', topic]);
    }
    pauseOnGap(epic, 'windows', ['note-window', 'layout']);
    assert.match(arriveAtEpicMenu(sim, epic, 'specification', 'paused'),
      /\nSpecification paused for "Panes" — "Windows" awaits the note-window discussion\.\n$/);
    sim.run(['topic', 'complete', epic, 'discussion', 'note-window']);
    assert.match(sim.render(['phase-paused', epic, '--phase', 'specification'], { expect: 'content' }),
      /\nSpecification paused for "Panes"\.\n$/);
  });

  it('a cancel that discards the last grouping over a still-valid analysis cache lands the specification on analyze', () => {
    const wu = 'regroup';
    mappedEpic(sim, wu, ['alpha', 'beta', 'gamma']);
    for (const name of ['alpha', 'beta', 'gamma']) {
      sim.run(['topic', 'start', wu, 'discussion', name]);
      sim.write(`.leeway/${wu}/discussion/${name}.md`, `# Discussion — ${name}\n`);
      sim.run(['topic', 'complete', wu, 'discussion', name]);
    }
    // The analysis reconciles one grouping over all three, then stamps the
    // cache over the discussion files.
    sim.run(['manifest', 'apply', wu, '--file', sim.write(`.leeway/.cache/${wu}/specification/reconcile-ops.json`,
      [{ op: 'set', path: `${wu}.specification.whole`, fields: {
        status: 'proposed', 'sources.alpha.status': 'pending', 'sources.beta.status': 'pending', 'sources.gamma.status': 'pending',
      } }])]);
    const checksum = /^discussions_checksum: (\S+)$/m.exec(EPIC_GATEWAY.specScenario(sim.dir, wu))[1];
    sim.run(['manifest', 'set', `${wu}.discussion`, 'analysis_cache.checksum', checksum]);
    sim.run(['manifest', 'set', `${wu}.discussion`, 'analysis_cache.generated', '2026-10-06']);
    assert.strictEqual(specDetail(sim.dir, wu).scenario, 'groupings');

    // The cancel leaves gamma's file on disk, so the cache stays valid while
    // the grouping it backed is gone — the analysis reruns behind its gate.
    assert.deepStrictEqual(sim.run(['topic', 'cancel', wu, 'discovery', 'gamma']).discarded, ['whole']);
    const routing = EPIC_GATEWAY.specScenario(sim.dir, wu);
    assert.match(routing, /^scenario: analyze$/m);
    assert.match(routing, /^cache_status: valid$/m);
    assert.strictEqual(epicKey(sim, wu, 'analyze_discussions').route, null);
    sim.render(['analysis-proceed-gate', wu], { expect: 'content' });
  });

  it('the epic menu\'s start of a grouping over a started specification\'s discussion incorporates it, and its completion supersedes it', () => {
    const wu = 'merge';
    mappedEpic(sim, wu, ['ranking', 'synonyms', 'stray']);
    for (const name of ['ranking', 'synonyms', 'stray']) {
      sim.run(['topic', 'start', wu, 'discussion', name]);
      sim.write(`.leeway/${wu}/discussion/${name}.md`, `# Discussion — ${name}\n`);
      sim.run(['topic', 'complete', wu, 'discussion', name]);
    }
    // The `ranking` specification started from its own grouping and
    // concluded; a later analysis keeps a grouping apart that takes in
    // ranking's discussion beside synonyms — fewer than a majority of it is
    // ranking's.
    sim.run(['manifest', 'set', `${wu}.specification.ranking`, 'status=proposed', 'sources.ranking.status=pending', 'sources.stray.status=pending']);
    sim.run(['topic', 'start', wu, 'specification', 'ranking']);
    sim.run(['manifest', 'set', `${wu}.specification.ranking`, 'sources.ranking.status=incorporated', 'sources.stray.status=incorporated']);
    sim.write(`.leeway/${wu}/specification/ranking/specification.md`, '# Spec — Ranking\n');
    sim.run(['topic', 'complete', wu, 'specification', 'ranking']);
    sim.run(['manifest', 'apply', wu, '--file', sim.write(`.leeway/.cache/${wu}/specification/reconcile-ops.json`,
      [{ op: 'set', path: `${wu}.specification.search`, fields: {
        status: 'proposed', 'sources.ranking.status': 'pending', 'sources.synonyms.status': 'pending',
      } }])]);
    sim.run(['build-order', 'sequence', wu, 'ranking=1', 'search=2']);

    // The epic menu's own start row reaches the same confirm the grouping
    // menu's pick does: the start incorporates ranking, so it renders.
    assert.match(sim.render(['spec-confirm-gate', `${wu}.specification.search`], { expect: 'content' }),
      new RegExp(`Sources:\\n {2}• ranking \\(has individual spec — will be incorporated\\)\\n {2}• synonyms\\n[\\s\\S]*After completion:\\n {2}${literal(path.join(sim.dir, '.leeway/merge/specification/ranking/specification.md'))} → marked as superseded`));
    epicPick(sim, wu, 'start_specification', 'search');

    // The start records what it takes in; the session reads it at setup, and
    // a resume reads it the same — ranking, never the other way round.
    sim.run(['topic', 'start', wu, 'specification', 'search']);
    const RANKING = { topic: 'ranking', path: path.join(sim.dir, `.leeway/${wu}/specification/ranking/specification.md`), covers: ['ranking'] };
    assert.deepStrictEqual(sim.run(['topic', 'incorporations', wu, 'search']).incorporations, [RANKING]);
    assert.deepStrictEqual(sim.run(['topic', 'incorporations', wu, 'ranking']).incorporations, []);
    // Mid-window both read started and share a discussion; a continue of
    // either hands off on its pick.
    sim.render(['spec-confirm-gate', `${wu}.specification.search`], { expect: 'empty' });
    sim.render(['spec-confirm-gate', `${wu}.specification.ranking`], { expect: 'empty' });
    assert.deepStrictEqual(sim.run(['topic', 'incorporations', wu, 'search']).incorporations, [RANKING]);

    sim.run(['manifest', 'set', `${wu}.specification.search`, 'sources.ranking.status=incorporated', 'sources.synonyms.status=incorporated']);
    sim.write(`.leeway/${wu}/specification/search/specification.md`, '# Spec — Search\n');
    sim.run(['commit', wu, '-m', `spec(${wu}): search`, '--topic', 'specification/search']);
    sim.run(['topic', 'complete', wu, 'specification', 'search']);
    for (const { topic } of sim.run(['topic', 'incorporations', wu, 'search']).incorporations) {
      sim.run(['topic', 'supersede', wu, 'specification', topic, '--by', 'search']);
    }
    sim.run(['commit', wu, '-m', `spec(${wu}): mark incorporated specifications as superseded`, '--topic', 'specification/search']);
    const items = sim.manifest(wu).phases.specification.items;
    assert.strictEqual(items.ranking.status, 'superseded');
    assert.strictEqual(items.ranking.superseded_by, 'search');
    assert.deepStrictEqual(sim.run(['topic', 'incorporations', wu, 'search']).incorporations, []);
    // Ranking's other discussion, which the incorporating grouping never
    // took as a source, is unaccounted again — the next analysis groups it.
    assert.deepStrictEqual(specDetail(sim.dir, wu).unassigned, ['stray']);
  });

  it('the epic menu\'s single-discussion path confirms before it hands off — a create, a refine, and a continue alike', () => {
    const wu = 'solo';
    mappedEpic(sim, wu, ['checkout']);
    sim.run(['topic', 'start', wu, 'discussion', 'checkout']);
    sim.write(`.leeway/${wu}/discussion/checkout.md`, '# Discussion — checkout\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'checkout']);
    assert.strictEqual(epicKey(sim, wu, 'analyze_discussions').route, null);
    const single = (expect) => sim.render(['spec-confirm-gate', `${wu}.specification.${wu}`, '--single'], { expect });

    // No specification covers the lone discussion: the path proceeds with
    // the work unit's name, and nothing is picked, so the create confirms
    // before anything lands — a decline leaves the manifest as it was.
    const scenario = EPIC_GATEWAY.specScenario(sim.dir, wu);
    assert.match(scenario, /^scenario: single$/m);
    assert.match(scenario, /^single_variant: no-spec$/m);
    assert.match(scenario, /^single_discussion: checkout$/m);
    assert.match(scenario, new RegExp(`^proceed_name: ${wu}$`, 'm'));
    assert.match(single('content'), new RegExp(`Creating specification: Solo\\n\\nSources:\\n {2}• checkout\\n\\nOutput: ${literal(path.join(sim.dir, '.leeway/solo/specification/solo/specification.md'))}\\n[\\s\\S]*MENU: spec confirm gate`));
    assert.strictEqual(sim.manifest(wu).phases.specification, undefined, 'the confirm writes nothing — a decline leaves no grouping');
    sim.refuses(['render', 'spec-confirm-gate', `${wu}.specification.${wu}`], /no specification "solo" — the confirm reads the item the pick names/);

    // The yes lands the grouping, so the route selection's own confirm finds
    // a plain start and answers empty: one confirm, then the handoff.
    sim.run(['manifest', 'set', `${wu}.specification.${wu}`, 'status=proposed', 'sources.checkout.status=pending']);
    sim.run(['commit', wu, '--state', '-m', `spec(${wu}): propose ${wu}`]);
    sim.render(['spec-confirm-gate', `${wu}.specification.${wu}`], { expect: 'empty' });
    handoff(sim, `/leeway-specification-process epic ${wu} ${wu}`);
    sim.run(['topic', 'start', wu, 'specification', wu]);
    sim.run(['manifest', 'set', `${wu}.specification.${wu}`, 'sources.checkout.status', 'incorporated']);
    sim.write(`.leeway/${wu}/specification/${wu}/specification.md`, '# Spec — Solo\n');
    sim.run(['topic', 'complete', wu, 'specification', wu]);

    // The covering specification concluded: the path proceeds with it as a
    // refine, which still confirms — the menu opening on where a change of
    // decision belongs.
    assert.match(EPIC_GATEWAY.specScenario(sim.dir, wu), /^single_variant: has-spec$/m);
    const soloSpec = literal(path.join(sim.dir, '.leeway/solo/specification/solo/specification.md'));
    assert.match(single('content'), new RegExp(`Refining specification: Solo\\n\\nExisting: ${soloSpec} \\[completed\\]\\n\\nAll sources extracted:\\n {2}• checkout\\n[\\s\\S]*A refinement is for factual corrections and sharpening\\.`));
    sim.render(['spec-confirm-gate', `${wu}.specification.${wu}`], { expect: 'empty' });

    // A re-decided discussion stales its row: the path proceeds as a
    // continue, confirming the reconcile it carries.
    sim.run(['topic', 'reopen', wu, 'discussion', 'checkout']);
    sim.run(['topic', 'complete', wu, 'discussion', 'checkout']);
    assert.match(single('content'), new RegExp(`Continuing specification: Solo\\n\\nExisting: ${soloSpec} \\[completed\\]\\n\\nSources re-decided since extraction \\(reconcile\\):\\n {2}• checkout \\[stale\\]\\n`));
    sim.render(['spec-confirm-gate', `${wu}.specification.${wu}`], { expect: 'empty' });
    handoff(sim, `/leeway-specification-process epic ${wu} ${wu}`);
  });

  it('an epic named `unified` confirms its single-discussion path once, and its grouping of that name starts plainly from the epic menu', () => {
    const wu = 'unified';
    mappedEpic(sim, wu, ['checkout']);
    sim.run(['topic', 'start', wu, 'discussion', 'checkout']);
    sim.write(`.leeway/${wu}/discussion/checkout.md`, '# Discussion — checkout\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'checkout']);
    assert.match(EPIC_GATEWAY.specScenario(sim.dir, wu), /^proceed_name: unified$/m);
    sim.render(['spec-confirm-gate', `${wu}.specification.${wu}`, '--single'], { expect: 'content' });
    sim.run(['manifest', 'set', `${wu}.specification.${wu}`, 'status=proposed', 'sources.checkout.status=pending']);
    sim.run(['commit', wu, '--state', '-m', `spec(${wu}): propose ${wu}`]);
    // The route selection's confirm finds a plain start: the single path's
    // one confirm stands alone, and the epic menu's own start row for the
    // grouping hands off on its pick.
    sim.render(['spec-confirm-gate', `${wu}.specification.${wu}`], { expect: 'empty' });
    handoff(sim, `/leeway-specification-process epic ${wu} ${wu}`);
    epicPick(sim, wu, 'start_specification', wu);
  });

  it('a plan is held while its specification is unsettled — entry, birth, conclusion, and the menu row alike', () => {
    const wu = 'holdplan';
    mappedEpic(sim, wu, ['billing', 'fees']);
    /** Walk a topic Discovery → a concluded specification extracting its discussion. */
    const settle = (topic) => {
      sim.run(['topic', 'start', wu, 'discussion', topic]);
      sim.write(`.leeway/${wu}/discussion/${topic}.md`, `# ${topic}\n`);
      sim.run(['topic', 'complete', wu, 'discussion', topic]);
      sim.run(['topic', 'start', wu, 'specification', topic]);
      sim.run(['manifest', 'set', `${wu}.specification.${topic}`, `sources.${topic}.status`, 'incorporated']);
      sim.write(`.leeway/${wu}/specification/${topic}/specification.md`, `# Spec — ${topic}\n`);
      sim.run(['topic', 'complete', wu, 'specification', topic]);
    };
    settle('billing');
    settle('fees');

    // A settled record opens the plan: the entry passes and the birth stands.
    sim.render(['entry-gate', `${wu}.planning.billing`], { expect: 'empty' });
    sim.run(['topic', 'start', wu, 'planning', 'billing']);

    // A message lands back on both source discussions: each specification's
    // row stales and takes the flag — the record is moving beneath the plan.
    for (const topic of ['billing', 'fees']) {
      const ro = sim.run(['topic', 'reopen', wu, 'discussion', topic]);
      assert.deepStrictEqual(ro.sources_staled, [topic]);
      assert.deepStrictEqual(ro.reconcile_flagged, [{ phase: 'specification', topic }]);
    }

    // Every planning surface holds: the conclusion, the entry, an unborn
    // plan's birth, and the epic menu's rows.
    sim.refuses(['topic', 'complete', wu, 'planning', 'billing'],
      /^planning "billing" awaits its specification \(a source has moved beneath the extraction \(billing\), its own input moved\) — settle the specification to release the wait$/);
    sim.refuses(['topic', 'start', wu, 'planning', 'fees'],
      /^planning can't start on "fees" — its specification is unsettled \(a source has moved beneath the extraction \(fees\), its own input moved\); a plan is built from a settled record, so the specification's entry is the way in$/);
    assert.match(sim.render(['entry-gate', `${wu}.planning.billing`], { expect: 'content' }),
      /Entry blocked — the specification for "Billing" is unsettled/);
    // The pause is the plan's, in the plan's voice.
    assert.match(sim.render(['wait-gate', `${wu}.planning.billing`], { expect: 'content' }),
      /⚑ Conclusion blocked — this plan awaits its specification[\s\S]*Keep planning here/);
    assert.match(arriveAtEpicMenu(sim, wu, 'planning', 'paused'),
      /Planning paused for "Holdplan" — "Billing" awaits its specification/);
    const planRows = () => epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys
      .filter((k) => k.action === 'continue_planning' || k.action === 'start_planning').map((k) => k.topic).sort();
    assert.deepStrictEqual(planRows(), [], 'a held plan carries no menu row — the specification\'s is the way in');
    assert.deepStrictEqual(EPIC_GATEWAY.discover(sim.dir, wu).phases.planning[0].blocked_by, ['specification']);

    // The specification reconciles — the discussion re-concludes, the row
    // re-incorporates, the flag clears — and every hold releases with it.
    for (const topic of ['billing', 'fees']) {
      sim.run(['topic', 'complete', wu, 'discussion', topic]);
      sim.run(['manifest', 'delete', `${wu}.specification.${topic}`, 'reconcile_needed']);
      sim.run(['manifest', 'set', `${wu}.specification.${topic}`, `sources.${topic}.status`, 'incorporated']);
    }
    sim.render(['entry-gate', `${wu}.planning.billing`], { expect: 'empty' });
    assert.deepStrictEqual(planRows(), ['billing', 'fees'], 'the settled record returns both rows');
    sim.write(`.leeway/${wu}/planning/billing/planning.md`, '# Plan\n');
    assert.strictEqual(sim.run(['topic', 'complete', wu, 'planning', 'billing']).status, 'completed');
    sim.run(['topic', 'start', wu, 'planning', 'fees']);
  });

  it('the send door reaches the hold, and a planning-origin sources stale spares the plan\'s own specification', () => {
    const wu = 'holdgate';
    mappedEpic(sim, wu, ['shared']);
    // One discussion, two specifications extracting it, a plan on one.
    sim.run(['topic', 'start', wu, 'discussion', 'shared']);
    sim.write(`.leeway/${wu}/discussion/shared.md`, '# Shared\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'shared']);
    for (const spec of ['alpha-spec', 'beta-spec']) {
      sim.run(['topic', 'start', wu, 'specification', spec]);
      sim.run(['manifest', 'set', `${wu}.specification.${spec}`, 'sources.shared.status', 'incorporated']);
      sim.write(`.leeway/${wu}/specification/${spec}/specification.md`, `# Spec — ${spec}\n`);
      sim.run(['topic', 'complete', wu, 'specification', spec]);
    }
    sim.run(['topic', 'start', wu, 'planning', 'alpha-spec']);

    // D4's door: a send lands a message on the source discussion.
    // The specification never transitions — it still reads `completed` —
    // and its source row alone carries the landing, which is why the hold
    // cannot key on the specification's status.
    const landed = send(sim, wu, 'shared', 'shared');
    assert.deepStrictEqual(landed.sources_staled.sort(), ['alpha-spec', 'beta-spec']);
    assert.strictEqual(sim.manifest(wu).phases.specification.items['alpha-spec'].status, 'completed',
      'the specification never transitioned — only its row moved');
    sim.refuses(['topic', 'complete', wu, 'planning', 'alpha-spec'], /awaits its specification/);

    // Reconcile both specifications and the hold releases.
    sim.run(['topic', 'complete', wu, 'discussion', 'shared']);
    for (const spec of ['alpha-spec', 'beta-spec']) {
      sim.run(['manifest', 'delete', `${wu}.specification.${spec}`, 'reconcile_needed']);
      sim.run(['manifest', 'set', `${wu}.specification.${spec}`, 'sources.shared.status', 'incorporated']);
    }
    sim.render(['wait-gate', `${wu}.planning.alpha-spec`], { expect: 'empty' });

    // A decision landed from planning amends the discussion in place and
    // reindexes it (landing-a-resolution.md): the sibling extraction goes
    // stale, the plan's own specification is spared because the planner
    // re-aligned it — so the plan is never held — and the landing commits
    // over the discussion's topic.
    const amended = `.leeway/${wu}/discussion/shared.md`;
    sim.write(amended, '# Shared\n\n## Retention\n\nRecords are kept for a year.\n');
    const reindexed = sim.engine(['knowledge', 'index', amended]);
    assert.strictEqual(reindexed.code, 0, reindexed.stderr);
    assert.match(reindexed.stdout, new RegExp(`^Indexed \\d+ chunks from ${literal(path.join(sim.dir, amended))}\\n$`));
    const staled = sim.run(['sources', 'stale', wu, 'shared', '--except', 'alpha-spec']);
    assert.deepStrictEqual(staled.staled, ['beta-spec']);
    sim.run(['commit', wu, '-m', `discussion(${wu}/shared): records are kept for a year`, '--topic', 'discussion/shared', '--sweep']);
    assert.strictEqual(sim.manifest(wu).phases.specification.items['alpha-spec'].sources.shared.status, 'incorporated');
    sim.render(['entry-gate', `${wu}.planning.alpha-spec`], { expect: 'empty' });
    sim.render(['wait-gate', `${wu}.planning.alpha-spec`], { expect: 'empty' });
    sim.write(`.leeway/${wu}/planning/alpha-spec/planning.md`, '# Plan\n');
    assert.strictEqual(sim.run(['topic', 'complete', wu, 'planning', 'alpha-spec']).status, 'completed');
  });
});

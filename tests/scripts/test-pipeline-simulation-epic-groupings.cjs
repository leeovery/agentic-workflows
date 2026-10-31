'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic groupings: a cancel discarding the last
// grouping, the analysis cache stale without the record it took; a grouping
// started over a started specification's discussion, incorporating it and
// superseding it at completion; and a unit named `unified`, whose
// single-discussion path confirms once and whose grouping of that name
// starts plainly. The specification's own pauses and confirms are
// test-pipeline-simulation-epic-specification.cjs.
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
const { Sim, mappedEpic, handoff, discussed, epicPick, epicKey, literal } = require('./pipeline-world.cjs');

const { specDetail } = require('./pipeline-oracle.cjs');

describe('pipeline simulation: epic groupings', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('a cancel that discards the last grouping lands the specification on analyze, the cache stale without the record it took', () => {
    const wu = 'regroup';
    mappedEpic(sim, wu, ['alpha', 'beta', 'gamma']);
    for (const name of ['alpha', 'beta', 'gamma']) {
      discussed(sim, wu, name);
    }
    // The analysis reconciles one grouping over all three, then stamps the
    // cache over the decided discussions' records.
    sim.run(['manifest', 'apply', wu, '--file', sim.write(`.leeway/.cache/${wu}/specification/reconcile-ops.json`,
      [{ op: 'set', path: `${wu}.specification.whole`, fields: {
        status: 'proposed', 'sources.alpha.status': 'pending', 'sources.beta.status': 'pending', 'sources.gamma.status': 'pending',
      } }])]);
    const checksum = /^discussions_checksum: (\S+)$/m.exec(EPIC_GATEWAY.specScenario(sim.dir, wu))[1];
    sim.run(['manifest', 'set', `${wu}.discussion`, 'analysis_cache.checksum', checksum]);
    sim.run(['manifest', 'set', `${wu}.discussion`, 'analysis_cache.generated', '2026-10-06']);
    assert.strictEqual(specDetail(sim.dir, wu).scenario, 'groupings');

    // The cancel takes gamma out of what the analysis read, so the cache is
    // stale and the grouping it backed is gone — the analysis reruns behind
    // its gate.
    assert.deepStrictEqual(sim.run(['topic', 'cancel', wu, 'discovery', 'gamma']).discarded, ['whole']);
    const routing = EPIC_GATEWAY.specScenario(sim.dir, wu);
    assert.match(routing, /^scenario: analyze$/m);
    assert.match(routing, /^cache_status: stale$/m);
    assert.strictEqual(epicKey(sim, wu, 'analyze_discussions').route, null);
    sim.render(['analysis-proceed-gate', wu], { expect: 'content' });
  });

  it('the epic menu\'s start of a grouping over a started specification\'s discussion incorporates it, and its completion supersedes it', () => {
    const wu = 'merge';
    mappedEpic(sim, wu, ['ranking', 'synonyms', 'stray']);
    for (const name of ['ranking', 'synonyms', 'stray']) {
      discussed(sim, wu, name);
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

  it('an epic named `unified` confirms its single-discussion path once, and its grouping of that name starts plainly from the epic menu', () => {
    const wu = 'unified';
    mappedEpic(sim, wu, ['checkout']);
    discussed(sim, wu, 'checkout');
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
});

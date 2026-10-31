'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's specification scenarios: a specification
// pausing on a gap it routed, a linear unit's into the reopened record and
// an epic's to its menu; and the epic menu's single-discussion path, which
// confirms before it hands off — a create, a refine and a continue alike.
// Groupings are test-pipeline-simulation-epic-groupings.cjs; a plan held on
// its specification, test-pipeline-simulation-plan-holds.cjs.
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
const {
  Sim, sessionLog, send, mappedEpic, menuEntry, handoffEntry, handoff, discussed, bridgeTo, arriveAtEpicMenu, epicKey, literal,
} = require('./pipeline-world.cjs');

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
    discussed(sim, feature, feature);
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
      discussed(sim, epic, topic);
    }
    pauseOnGap(epic, 'windows', ['note-window', 'layout']);
    assert.match(arriveAtEpicMenu(sim, epic, 'specification', 'paused'),
      /\nSpecification paused for "Panes" — "Windows" awaits the note-window discussion\.\n$/);
    discussed(sim, epic, 'note-window');
    assert.match(sim.render(['phase-paused', epic, '--phase', 'specification'], { expect: 'content' }),
      /\nSpecification paused for "Panes"\.\n$/);
  });

  it('the epic menu\'s single-discussion path confirms before it hands off — a create, a refine, and a continue alike', () => {
    const wu = 'solo';
    mappedEpic(sim, wu, ['checkout']);
    discussed(sim, wu, 'checkout');
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
    discussed(sim, wu, 'checkout');
    assert.match(single('content'), new RegExp(`Continuing specification: Solo\\n\\nExisting: ${soloSpec} \\[completed\\]\\n\\nSources re-decided since extraction \\(reconcile\\):\\n {2}• checkout \\[stale\\]\\n`));
    sim.render(['spec-confirm-gate', `${wu}.specification.${wu}`], { expect: 'empty' });
    handoff(sim, `/leeway-specification-process epic ${wu} ${wu}`);
  });
});

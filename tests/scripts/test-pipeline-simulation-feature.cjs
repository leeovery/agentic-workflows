'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's feature scenarios: the pipeline from discovery
// into the build — its discussion closing into its spec with no gate, the
// spec entered at the unit, landed, reviewed and cut into phases, and the
// one screen, decided and ready to build, whose pick marks the topic
// decided, lands its product-record line and parks its candidate, and
// begins the build; the start menu's working set of inbox ideas and a bug
// seeding discovery; a discussion entered through `enter`, begun and then
// resumed by a later conversation; and a point needing decisions of its own
// pivoting the unit to an epic, the conversation carrying on in its topic.
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
const ROOT = path.join(__dirname, '../..');
const { KNOWLEDGE_DIR } = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/knowledge/files.cjs'));
const { statePath } = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/state-root.cjs'));
const { sectionOf } = require('./engine-harness.cjs');
const {
  Sim, sessionLog, enterEntry, carryOn, handoff, handoffBy, answerGate, gatesAnswered, decideTopic, startPick, startNew, shapedInTheProduct, briefDraft, startThisWork, workTheSet,
  specEntry, specReviewed, cutTheSpec, readyToBuild, intoTheBuild,
} = require('./pipeline-world.cjs');

const { shellWords } = require('./pipeline-oracle.cjs');

describe('pipeline simulation: feature', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('feature: discovery → discussion → spec → into the build, the person stopped at start this work and at one screen, decided and ready to build, and at no approve-the-map or decided screen (8.S18, 19.S5, 19.S29, 3.S5, 9.S23, 11.S14)', () => {
    const wu = 'pay';
    // The start menu's new-feature pick hands the work to discovery, which
    // shapes it in the product's conversation; start this work's yes creates
    // the unit, its brief its one topic's, and hands it to its discussion.
    startNew(sim);
    const shaped = shapedInTheProduct(sim, 'payments');
    const started = startThisWork(sim, {
      type: 'feature', name: wu, description: 'Payments feature', reason: 'One topic, decided in one discussion.',
      shaped_by: [shaped], brief: briefDraft(sim, wu, wu),
    });
    assert.deepStrictEqual(started.next, { kind: 'handoff', skill: 'leeway-discussion-process', args: ['feature', wu] });
    handoff(sim, `/leeway-discussion-process feature ${wu}`);

    // First phase: discussion (topic = work unit for single-topic types),
    // entered through `enter`, which starts it; the conversation reads the
    // product record before it opens. The opening settles everything but one
    // question, and the person's answer to it is all the topic needs to
    // close (19.S5).
    enterEntry(sim, wu, 'discussion', wu);
    sim.run(['ledger', 'product', wu, wu]);
    const at = `${wu}.discussion.${wu}`;
    const person = { by: 'person', who_moved_whom: 'none' };
    const asked = sim.run(['ledger', 'ask', at], null, JSON.stringify({ ...person, text: 'Which card networks does checkout take?' })).id;
    const card = sim.run(['ledger', 'decide', at, '--answers', asked], null, JSON.stringify({ ...person, text: 'Visa and Mastercard.', why: 'Our acquirer takes those two.' })).id;
    sim.write(`.leeway/${wu}/topics/${wu}/log.md`, `# ${wu}\n\nVisa and Mastercard; refunds left to another day.\n`);
    // The person puts Apple Pay off for later, naming its horizon: it goes on
    // the roadmap at once. The closing pass then finds work no topic owns,
    // which the person says waits for later too: a feature has no map, so
    // that candidate parks on the roadmap at the one screen's yes.
    sim.run(['roadmap', 'add', 'apple-pay', '--horizon', 'later', '--summary', 'Take Apple Pay.', '--origin', `park:${wu}`, '--source', `${wu}/topics/${wu}`]);
    // Nothing of the person's open and the closing pass run, the topic closes
    // into its spec with no gate (11.2.1): its payload staged for the one
    // screen, the conversation handed off; the topic not yet decided, which
    // the one screen marks it, and decided's own screen refused it.
    const closed = decideTopic(sim, wu, wu, {
      lines: [{ text: 'Payments take Visa and Mastercard only.', why: 'The acquirer takes those two.', widens: card }],
      candidates: [{ name: 'refunds', reason: 'Nothing decides how a refund reaches the card.', horizon: 'later' }],
    });
    assert.deepStrictEqual(closed, { ok: true, unit: wu, topic: wu, lines: 1, withdrawals: 0, candidates: ['refunds'], next: { kind: 'handoff', skill: 'leeway-specification-process', args: ['feature', wu] } });
    assert.deepStrictEqual([sim.manifest(wu).phases.discussion.items[wu].status, handoffBy(sim, ['handoff', 'unit', wu]).invoked], ['in-progress', `/leeway-specification-process feature ${wu}`],
      'its Continue goes into the spec, the topic staged there');
    sim.refuses(['render', 'decided', `${wu}.${wu}`], /^render decided: pay is a feature, whose topic closes into its spec with no gate/);
    handoff(sim, `/leeway-specification-process feature ${wu}`);

    // The spec, entered at the unit, lands citing what was decided, is
    // reviewed and cut into phases.
    specEntry(sim, wu, [wu]);
    sim.run(['brief', 'spec-writer', wu]);
    sim.write(`.leeway/${wu}/spec.md`, [
      '# Pay', '', '## 1. Checkout', '', '### 1.1 Cards', '', `1.1.1 Checkout takes Visa and Mastercard. [${card}]`, '',
      '## 1-S. Scenarios for §1', '', '1.S1 Given a Visa, when it pays, then checkout takes it. (1.1.1)', '',
    ].join('\n'));
    assert.deepStrictEqual(sim.run(['spec', 'land', wu]).invented, []);
    specReviewed(sim, wu);
    cutTheSpec(sim, wu, [{ name: 'Cards', goal: 'Checkout takes the cards decided.', scenarios: ['1.S1'], sections: ['1'], relies_on: [] }]);
    // Decided and ready to build come as one screen (3.S5, 9.S23, 11.S14):
    // what the person decided, the product-record line and the candidate
    // beside the outline and the cut, its pick marking the topic decided.
    const screen = readyToBuild(sim, wu);
    const display = sectionOf(screen, 'DISPLAY: ready to build');
    assert.deepStrictEqual(display.split('\n\n').map((block) => block.split('\n')[0]),
      ['Pay — decided, and ready to build', 'WHAT YOU DECIDED (1)', 'FOR THE PRODUCT RECORD (1 line)', 'TO THE ROADMAP (1)', 'THE OUTLINE (1 section)', 'THE PHASE CUT (1 phase · 1 scenario)']);
    const gate = sectionOf(screen, 'MENU: ready to build');
    assert.match(gate, /^Your pick marks Pay decided, with the product-record line and the roadmap item, approves the outline and the phase cut, and starts the build in that position\.$/m);
    assert.deepStrictEqual([...gate.matchAll(/^\*\*`?([a-zA-Z]+(?:\/[a-z]+)?)`?\*\*/gm)].map((m) => m[1]), ['a/auto', 's/step', 'x/strike', 'Comment']);

    // The pick lands the line, parks the candidate on the roadmap, marks the
    // topic decided and begins the build; the completion indexes the
    // records into a store, which every commit's audit in `run` holds
    // untracked from here on.
    const begun = intoTheBuild(sim, wu, sim.run(answerGate(sim, 'ready to build', '--pick', 'a').next.argv));
    assert.deepStrictEqual([begun.position, begun.lines.length, begun.parked], ['auto', 1, [{ name: 'refunds', horizon: 'later' }]]);
    assert.deepStrictEqual([sim.manifest(wu).phases.discussion.items[wu].status, Object.keys(sim.manifest(wu).phases)], ['completed', ['discussion']],
      '19.S29: the topic decided at the one screen, and no phase ran but the pipeline\'s — no experiment the discussion did not call, no investigation');
    assert.ok(fs.existsSync(statePath(sim.dir, KNOWLEDGE_DIR, 'store.bin')), 'the completion built the store');
    assert.match(sim.render(['knowledge-ready'], { expect: 'content' }), /^Knowledge base ready — keyword-only\.$/m);
    // The engine's own door reads back what the close indexed in process: the
    // records — the topic's, and the unit's own, which holds the line.
    assert.deepStrictEqual(sim.engine(['knowledge', 'check']), { stdout: 'ready\n', stderr: '', code: 0 });
    assert.match(sim.engine(['knowledge', 'status']).stdout, /^By phase:\n {2}record: 3\n\n/m);
    assert.deepStrictEqual(gatesAnswered(sim), ['start menu', 'start this work', 'ready to build'], '8.S18: past the start menu\'s pick that began it, the person was stopped at start this work and the one screen alone');
  });

  it('start: a working set of inbox ideas and a bug hands discovery its seeds, which start this work lands as a feature, where no investigation runs for the bug (19.S9)', () => {
    const ideas = [
      sim.write('.leeway/.inbox/ideas/2026-01-01--saved-search-filters.md', '# Saved Search Filters\n'),
      sim.write('.leeway/.inbox/ideas/2026-01-01--filter-default-view.md', '# Filter Default View\n'),
      sim.write('.leeway/.inbox/bugs/2026-01-01--filters-lost-on-reload.md', '# Filters Lost On Reload\n'),
    ];
    assert.strictEqual(startPick(sim, 't'), null, 'the start menu\'s triage carries on in the conversation, into the inbox');
    // Ideas carry no work type, so discovery decides it.
    const seeds = ideas.map((rel) => path.join(sim.dir, rel));
    const route = `/leeway-discovery start none "${seeds.join(',')}"`;
    assert.strictEqual(workTheSet(sim, ideas).text, `Invoke \`${route}\`.`);
    const wu = 'saved-filters';
    const started = startThisWork(sim, {
      type: 'feature', name: wu, description: 'Saved search filters', reason: 'One topic, decided in one discussion.',
      shaped_by: [shapedInTheProduct(sim, 'filters')], seeds, brief: briefDraft(sim, wu, wu),
    });
    assert.deepStrictEqual(started.seeds.map((/** @type {{source: string}} */ seed) => seed.source), ['inbox:idea', 'inbox:idea', 'inbox:bug']);
    assert.deepStrictEqual([started.next.skill, handoffBy(sim, ['handoff', 'unit', wu]).invoked], ['leeway-discussion-process', `/leeway-discussion-process feature ${wu}`], 'the bug is the feature\'s to discuss: no investigation runs for it');
    sim.refuses(['enter', 'investigation', wu], /^a feature has no investigation/);
    // The yes moved the seeds out of the inbox, and the handoff checks each
    // is still there — so it can only come first.
    sim.refuses(['handoff', ...shellWords(route)], /inbox file not found/);
  });

  it('feature: a discussion entered through `enter` — the first entry starts it on what discovery left, a later conversation resumes it on its record and its log', () => {
    const wu = 'filters';
    const keys = () => [...sim.sections.matchAll(/^([a-z ]+): /gm)].map((m) => m[1]);
    const header = () => /^log header: (.*)$/m.exec(sim.sections)?.[1];
    const log = `.leeway/${wu}/topics/${wu}/log.md`;
    startNew(sim);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Saved filters', '--session-log-file', sessionLog(sim, wu)]);
    handoff(sim, `/leeway-discussion-process feature ${wu}`);
    const first = enterEntry(sim, wu, 'discussion', wu);
    assert.deepStrictEqual([first.started, typeof first.committed], [true, 'string'], 'the first entry starts the topic and commits the start');
    assert.ok(!fs.existsSync(path.join(sim.dir, log)), 'nothing is written ahead of the opening');
    assert.deepStrictEqual(keys(), ['discovery log', 'product', 'log', 'log header']);
    sim.write(log, `${header()}\n\nWhere it stands.\n`);
    assert.doesNotMatch(carryOn(sim).text, /has not written to the log yet/, 'the conversation that wrote the log owes no header');

    const again = enterEntry(sim, wu, 'discussion', wu);
    assert.deepStrictEqual([again.started, again.committed], [false, undefined], 'a later entry resumes, starting nothing');
    assert.deepStrictEqual(keys(), ['discovery log', 'product', 'record', 'map', 'affected', 'log', 'log header'], 'a new conversation owes its own header');
    assert.match(carryOn(sim).text, /has not written to the log yet/);
  });

  it('feature: a point needing decisions of its own pivots the unit to an epic at the person\'s yes — the point a new topic on its map, its question moved there by message — and the conversation carries on in its own topic (19.S33)', () => {
    const wu = 'filters';
    startNew(sim);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Saved filters', '--session-log-file', sessionLog(sim, wu)]);
    handoff(sim, `/leeway-discussion-process feature ${wu}`);
    enterEntry(sim, wu, 'discussion', wu);
    const at = `${wu}.discussion.${wu}`;
    const person = { by: 'person', who_moved_whom: 'none' };
    const point = sim.run(['ledger', 'ask', at], null, JSON.stringify({ ...person, text: 'Who may see a filter shared with a team?' })).id;

    sim.run(['workunit', 'pivot', wu, '--summary', 'Filters saved and shared', '--description', 'A filter kept by name, for its owner and those it is shared with.']);
    const added = sim.run(['topic', 'add', wu, 'sharing', '--summary', 'Who sees a shared filter', '--brief', briefDraft(sim, wu, 'sharing')]);
    const message = sim.write(`.leeway/.cache/${wu}/discussion/${wu}/message-team-sight.md`, 'Who sees a shared filter\n\nSharing needs decisions of its own.\n');
    const sent = sim.run(['topic', 'send', wu, 'sharing', '--from', wu, '--content', message, '--slug', 'team-sight']);
    sim.run(['ledger', 'move', at, '--question', point, '--to', 'sharing'], null, JSON.stringify(person));
    assert.match(sim.render(['send-report', `${wu}.sharing`, '--sent', sent.message_path], { expect: 'content' }), /^Sent to Sharing, on Filters$/m);

    const manifest = sim.manifest(wu);
    assert.deepStrictEqual([manifest.work_type, Object.keys(manifest.phases.discovery.items), typeof added.committed], ['epic', [wu, 'sharing'], 'string']);
    assert.deepStrictEqual(sim.run(['topic', 'mailbox', wu, 'sharing']).files, [sent.message_path]);
    assert.deepStrictEqual([manifest.phases.discussion.items[wu].status, carryOn(sim).position], ['in-progress', { name: wu, phase: 'discussion', topic: wu }]);
  });
});

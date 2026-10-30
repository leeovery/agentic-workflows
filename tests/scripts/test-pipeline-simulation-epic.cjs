'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic scenarios: research first, the topic's
// own row, with a message raised and answered through the topic's one
// mailbox; the d and r doors naming the new topic; an
// arrival that backfills; the last review handing off to the menu; and a
// completed discussion reopened and completed again, the map deriving
// throughout. The map's own lifecycle is test-pipeline-simulation-epic-map.cjs.
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
const BRIDGE = require(path.join(ROOT, 'skills/leeway-bridge/scripts/gateway.cjs'));
const { epicMenu } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/epic.cjs'));
const { drawLabel } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/surfaces.cjs'));
const {
  Sim, sessionLog, send, mappedEpic, arrive, menuEntry, handoffEntry, enterEntry, handoff, arriveAtEpicMenu, epicPick, walkDeliveryPhases,
} = require('./pipeline-world.cjs');


describe('pipeline simulation: epic', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('epic: research first — the research is the topic\'s own row and a reopen flags the live discussion; a message lands in the topic\'s one mailbox, raised at the entry and answered by the question it raised; one to the decided topic sets it back in progress', () => {
    const wu = 'orbit';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Orbit', '--session-log-file', log]);
    const topics = sim.write(`.leeway/.cache/${wu}/discovery/topics.json`, [
      { name: 'alpha', routing: 'research', summary: 'Alpha summary' },
      { name: 'beta', routing: 'research', summary: 'Beta summary' },
    ]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', topics]);
    sim.run(['discovery-map', 'sequence', wu, 'alpha=1', 'beta=2']);
    const rows = (topic) => epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys
      .filter((k) => k.topic === topic).map((k) => [k.action, drawLabel(k.label)]);

    // The research is alpha's own row; it lands — the discussion row
    // returns, the gate clears, and the discussion is born; each row the
    // menu offers hands off to its phase.
    epicPick(sim, wu, 'start_research', 'alpha');
    sim.run(['topic', 'start', wu, 'research', 'alpha']);
    sim.write(`.leeway/${wu}/research/alpha.md`, '# Research — Alpha\n');
    sim.run(['commit', wu, '-m', `research(${wu}): alpha`, '--topic', 'research/alpha']);
    sim.run(['research-threads', 'add', wu, 'alpha', 'kept', '--question', 'Does the register survive the lifecycle?', '--origin', 'user']);
    const registerBefore = JSON.stringify(sim.manifest(wu).phases.research.items.alpha.threads);
    sim.run(['topic', 'complete', wu, 'research', 'alpha']);
    assert.strictEqual(JSON.stringify(sim.manifest(wu).phases.research.items.alpha.threads), registerBefore, 'completion leaves the register whole');
    assert.deepStrictEqual(rows('alpha').map((r) => r[0]), ['start_discussion_after_research']);
    epicPick(sim, wu, 'start_discussion_after_research', 'alpha');
    sim.render(['entry-gate', `${wu}.discussion.alpha`], { expect: 'empty' });
    sim.run(['topic', 'start', wu, 'discussion', 'alpha']);

    // A reopen of the research beneath the discussion now in flight flags it
    // and holds it shut at both ends: the topic's one row is its research
    // (the discussion is not offered), the entry gate refuses, the
    // conclusion refuses — while the session already inside resumes; the
    // soft gate passes the research row's actions.
    const hop = sim.run(['topic', 'reopen', wu, 'research', 'alpha']);
    assert.strictEqual(JSON.stringify(sim.manifest(wu).phases.research.items.alpha.threads), registerBefore, 'a reopen leaves the register whole');
    // The restart's guarded delete: the register goes only when the item carries one.
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.research.alpha`, 'threads']).trim(), 'true');
    sim.run(['manifest', 'delete', `${wu}.research.alpha`, 'threads']);
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.research.alpha`, 'threads']).trim(), 'false');
    sim.refuses(['manifest', 'delete', `${wu}.research.alpha`, 'threads'], /not found/);
    assert.deepStrictEqual(hop.reconcile_flagged, [{ phase: 'discussion', topic: 'alpha' }]);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.alpha.reconcile_needed, 'research');
    sim.refuses(['topic', 'complete', wu, 'discussion', 'alpha'], /awaits research on the topic/);
    assert.deepStrictEqual(rows('alpha').map((r) => r[0]), ['continue_research']);
    assert.strictEqual(sim.run(['topic', 'start', wu, 'discussion', 'alpha']).created, false);
    assert.match(sim.render(['entry-gate', `${wu}.discussion.alpha`], { expect: 'content' }), /awaits research on "Alpha" \(in flight\)/);
    // A peer still sitting in the held discussion keeps its row on the menu
    // — struck, beneath the research row — over the scan the gateway hands
    // the projection; the hold released, the topic is its research row alone.
    const peerInAlpha = sim.session('peer-in-alpha', 1);
    peerInAlpha.run(['presence', 'beat', wu, 'discussion', 'alpha']);
    const heldScan = sim.run(['presence', 'scan', wu]).sessions;
    assert.strictEqual(heldScan.find((r) => r.phase === 'discussion' && r.topic === 'alpha').held, true);
    assert.deepStrictEqual(
      epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu), { presence: heldScan }).keys
        .filter((k) => k.topic === 'alpha').map((k) => [k.action, k.in_session === true, k.blocked_by]),
      [['continue_research', false, undefined], ['continue_discussion', true, ['research']]]);
    peerInAlpha.run(['presence', 'clear', wu, 'discussion', 'alpha']);
    assert.deepStrictEqual(
      epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu), { presence: sim.run(['presence', 'scan', wu]).sessions }).keys
        .filter((k) => k.topic === 'alpha').map((k) => k.action),
      ['continue_research']);
    // A landing is the engine's own act — never held: it waits in the
    // topic's one mailbox, the discussion under way left as it stands, and
    // the mail rides alpha's row; the report ends with the way into it.
    const decision = send(sim, wu, 'alpha', 'a-decision');
    assert.strictEqual(decision.message_path, path.join(sim.dir, `.leeway/${wu}/topics/alpha/mail/001-a-decision.md`));
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.alpha.status, 'in-progress');
    assert.deepStrictEqual(rows('alpha'), [['continue_research', 'Continue "Alpha" — *research* · mail waiting']]);
    assert.match(sim.render(['send-report', `${wu}.alpha`, '--sent', decision.message_path], { expect: 'content' }), /^\/leeway orbit alpha$/m);
    sim.refuses(['discovery-map', 'handle', wu, 'alpha'], /messages wait in its mailbox/);
    sim.render(['epic-soft-gate', wu, '--action', 'continue_research', '--topic', 'alpha'], { expect: 'empty' });
    sim.render(['epic-soft-gate', wu, '--action', 'start_research', '--topic', 'beta'], { expect: 'empty' });
    sim.run(['topic', 'complete', wu, 'research', 'alpha']);
    // Landed: the wait and the gate release, the discussion row returns, and
    // the discussion resumes.
    sim.render(['wait-gate', `${wu}.discussion.alpha`], { expect: 'empty' });
    sim.render(['entry-gate', `${wu}.discussion.alpha`], { expect: 'empty' });
    assert.deepStrictEqual(rows('alpha').map((r) => r[0]), ['continue_discussion']);
    assert.strictEqual(sim.run(['topic', 'start', wu, 'discussion', 'alpha']).created, false);
    // The session inside reads the landed research at its next check and
    // clears the flag (prose-owned — simulated here); the completion
    // refuses until it has.
    sim.refuses(['topic', 'complete', wu, 'discussion', 'alpha'], /carries reconcile_needed: research/);
    sim.run(['manifest', 'delete', `${wu}.discussion.alpha`, 'reconcile_needed']);
    // The entry raises the waiting message before anything is read; the
    // question it raised is asked, and the message answered by it leaves.
    enterEntry(sim, wu, 'discussion', 'alpha');
    assert.match(sim.sections, /^=== DISPLAY: waiting mail [^\n]*\n1 message waiting — raised before anything else\n\na-decision\n/);
    const raised = sim.run(['ledger', 'ask', `${wu}.discussion.alpha`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Does a-decision change alpha?' }));
    assert.strictEqual(sim.run(['topic', 'answered', wu, 'alpha', '001-a-decision', '--entry', raised.id]).remaining, 0);
    assert.deepStrictEqual(rows('alpha'), [['continue_discussion', 'Continue "Alpha" — *discussion*']]);
    sim.run(['topic', 'complete', wu, 'discussion', 'alpha']);

    // A message to the decided topic sets it back in progress, its mail
    // waiting on its row; answered, it is decided again.
    const late = send(sim, wu, 'alpha', 'late-call');
    assert.strictEqual(late.reopened, true);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.alpha.status, 'in-progress');
    assert.deepStrictEqual(rows('alpha'), [['continue_discussion', 'Continue "Alpha" — *discussion* · mail waiting']]);
    const lateQuestion = sim.run(['ledger', 'ask', `${wu}.discussion.alpha`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Does the late call hold?' }));
    sim.run(['topic', 'answered', wu, 'alpha', '001-late-call', '--entry', lateQuestion.id]);
    sim.run(['topic', 'complete', wu, 'discussion', 'alpha']);

    // A concluded discussion is held while its research reopens beneath it:
    // the discussion's reopen refuses until that research lands again.
    sim.run(['topic', 'reopen', wu, 'research', 'alpha']);
    sim.refuses(['topic', 'reopen', wu, 'discussion', 'alpha'],
      /discussion can't reopen on "alpha" — research is in flight on it; research feeds discussion, so it lands first — the menu names the way in/);
    assert.deepStrictEqual(rows('alpha').map((r) => r[0]), ['continue_research']);
    sim.write(`.leeway/${wu}/research/alpha.md`, '# Research — Alpha\n\nThe landed message.\n');
    sim.run(['commit', wu, '-m', `research(${wu}): alpha lands the message`, '--topic', 'research/alpha']);
    sim.run(['topic', 'complete', wu, 'research', 'alpha']);
    sim.run(['manifest', 'delete', `${wu}.discussion.alpha`, 'reconcile_needed']);
    assert.strictEqual(sim.run(['topic', 'reopen', wu, 'discussion', 'alpha']).status, 'in-progress');
    sim.run(['topic', 'complete', wu, 'discussion', 'alpha']);
  });

  it('epic: the d and r doors name the new topic and land its map row before the handoff carries it — a name on the map puts the menu back', () => {
    const wu = 'lumen';
    mappedEpic(sim, wu, ['alpha']);
    handoff(sim, `/leeway-continue-epic ${wu}`);
    arrive(sim, wu);

    // The doors are the menu's own flows: rows with no route, never handed to
    // the soft gate, and the handoff refuses an epic's research or discussion
    // without a topic.
    const doors = epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys
      .filter((k) => k.action === 'new_discussion' || k.action === 'new_research');
    assert.deepStrictEqual(doors.map((k) => [k.key, k.route]), [['d', null], ['r', null]]);
    for (const [phase, action] of [['discussion', 'new_discussion'], ['research', 'new_research']]) {
      sim.refuses(['render', 'epic-soft-gate', wu, '--action', action], new RegExp(`unknown --action "${action}"`));
      sim.refuses(['handoff', `/leeway-${phase}-process`, 'epic', wu], new RegExp(`^an epic enters ${phase} at a topic`));
    }

    // A name already on the map is refused before anything lands.
    const before = JSON.stringify(sim.manifest(wu));
    assert.match(sim.render(['direct-entry-gate', `${wu}.discussion.alpha`], { expect: 'content' }), /Its row on the menu names the next step\./);
    assert.strictEqual(JSON.stringify(sim.manifest(wu)), before, 'a refused name writes nothing');

    // A new name passes, lands on the map started fresh, and hands off with the
    // topic — the route its own start row builds. The phase's ensure finds the
    // row, and its source sends the topic to the interview.
    for (const [phase, topic] of [['discussion', 'omega'], ['research', 'zeta']]) {
      sim.render(['direct-entry-gate', `${wu}.${phase}.${topic}`], { expect: 'empty' });
      assert.strictEqual(sim.read(['manifest', 'get', `${wu}.discovery.${topic}`]), '');
      sim.run(['discovery-map', 'add', wu, topic, phase, '--source', 'direct-start',
        '--summary', `What ${topic} covers`, '--description', `Why ${topic} matters now.`, '--force-dismissed']);
      const route = `/leeway-${phase}-process epic ${wu} ${topic}`;
      assert.strictEqual(handoff(sim, route).args, `epic ${wu} ${topic}`);
      assert.strictEqual(epicPick(sim, wu, `start_${phase}`, topic).text, `Invoke \`${route}\`.`);
      assert.strictEqual(sim.read(['manifest', 'get', `${wu}.discovery.${topic}`, 'source']), 'direct-start');
      menuEntry(sim, wu);
      handoffEntry(sim, wu, phase, topic);
      sim.run(['topic', 'start', wu, phase, topic]);
    }
  });

  it('an epic arrival that backfills hands the menu off to start afresh, carrying the banner', () => {
    // A discussion sends a message to a topic it opens (create-discovery-
    // topic B): the row lands with no summary or description for the next
    // epic entry to draft. The conclusion's arrival meets it at Step 2, the
    // backfill commits, and backfill-checks C hands the menu off with the
    // arguments it arrived with — the fresh menu recovers nothing and leads
    // with the banner.
    const wu = 'sends';
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Sends', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', sim.write(`.leeway/.cache/${wu}/discovery/topics.json`,
      [{ name: 'alpha', routing: 'discussion', summary: 'Alpha', description: 'What alpha settles.' }])]);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): shape the map`]);
    const toRecover = () => EPIC_GATEWAY.formatScoped(wu, EPIC_GATEWAY.discover(sim.dir, wu))
      .split('\n').filter((line) => /summary=absent|description=absent/.test(line));

    menuEntry(sim, wu);
    handoffEntry(sim, wu, 'discussion', 'alpha');
    sim.run(['topic', 'start', wu, 'discussion', 'alpha']);
    sim.write(`.leeway/${wu}/discussion/alpha.md`, '# Discussion — Alpha\n');
    sim.run(['discovery-map', 'add', wu, 'beta', 'discussion', '--source', 'message:alpha', '--backfill', '--force-dismissed']);
    const message = sim.write('.leeway/.cache/scratch/message.md', 'Off-topic\n\nDetails.\n');
    sim.run(['topic', 'send', wu, 'beta', '--content', message, '--slug', 'off-topic']);
    sim.run(['commit', wu, '-m', `discussion(${wu}/alpha): capture`, '--topic', 'discussion/alpha']);
    sim.run(['topic', 'complete', wu, 'discussion', 'alpha']);

    handoff(sim, `/leeway-continue-epic ${wu} discussion completed`);
    arrive(sim, wu);
    assert.deepStrictEqual(toRecover().map((line) => line.match(/^ {2}- \S+ (\S+) /)[1]), ['beta']);
    // The stub has no file to draft from: the batch, then the unsourced gate,
    // whose provide row lands the person's summary.
    assert.match(sim.render(['summary-backfill-gate', wu, '--variant', 'batch', '--file',
      sim.write(`.leeway/.cache/${wu}/discovery/summaries.json`, { summaries: { beta: null } })], { expect: 'content' }),
    /1\. Beta {2}\(discussion\)\n {7}\(source file missing — please provide\)[\s\S]*Accept these summaries\?/);
    sim.render(['summary-backfill-gate', wu, '--variant', 'unsourced', '--file',
      sim.write(`.leeway/.cache/${wu}/discovery/unsourced.json`, { names: ['beta'] })], { expect: 'content' });
    sim.run(['manifest', 'apply', wu, '--file', sim.write(`.leeway/.cache/${wu}/discovery/backfill-ops.json`,
      [{ op: 'set', path: `${wu}.discovery.beta`, fields: { summary: 'Beta', description: 'What beta settles.' } }])]);
    sim.run(['commit', wu, '-m', `discovery(${wu}): backfill 2 discovery summary field(s)`, '--discovery']);

    assert.match(arriveAtEpicMenu(sim, wu, 'discussion'), /Discussion completed for "Sends"\./);
    assert.deepStrictEqual(toRecover(), [], 'the fresh menu finds nothing to recover');
  });

  it('epic: the last review hands off to the menu, which banners it and offers to complete the epic', () => {
    const wu = 'wrapup';
    mappedEpic(sim, wu, ['alpha']);
    sim.run(['topic', 'start', wu, 'discussion', 'alpha']);
    sim.write(`.leeway/${wu}/discussion/alpha.md`, '# Discussion — Alpha\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'alpha']);
    sim.run(['topic', 'start', wu, 'specification', 'alpha']);
    sim.run(['manifest', 'set', `${wu}.specification.alpha`, 'sources.alpha.status', 'incorporated']);
    sim.write(`.leeway/${wu}/specification/alpha/specification.md`, '# Spec — Alpha\n');
    sim.run(['topic', 'complete', wu, 'specification', 'alpha']);
    sim.run(['build-order', 'sequence', wu, 'alpha=1']);
    sim.run(['topic', 'start', wu, 'planning', 'alpha']);
    sim.run(['manifest', 'set', `${wu}.planning.alpha`, 'format=local-markdown', 'task_map.alpha-1-1=alpha-1-1', 'storage_paths=[]']);
    sim.run(['topic', 'complete', wu, 'planning', 'alpha']);
    sim.run(['task', 'init', wu, 'alpha']);
    sim.run(['task', 'start', wu, 'alpha', 'alpha-1-1']);
    sim.run(['task', 'complete', wu, 'alpha', 'alpha-1-1', '--phase', '1', '--next-task', '~']);
    sim.run(['manifest', 'push', `${wu}.implementation.alpha`, 'consolidated_phases', '1']);
    sim.run(['task', 'complete', wu, 'alpha', 'alpha-1-1', '--phase', '1', '--phase-complete']);
    sim.run(['topic', 'complete', wu, 'implementation', 'alpha']);
    // Short of the last review the menu shows the banner and no offer, and
    // its review row hands off to the review.
    assert.match(arriveAtEpicMenu(sim, wu, 'implementation'), /Implementation completed for "Wrapup"\./);
    assert.match(EPIC_GATEWAY.formatScoped(wu, EPIC_GATEWAY.discover(sim.dir, wu)), /^all_done: false$/m);
    assert.strictEqual(epicPick(sim, wu, 'start_review', 'alpha').line, '→ Review · alpha');
    sim.run(['topic', 'start', wu, 'review', 'alpha']);
    sim.run(['topic', 'complete', wu, 'review', 'alpha']);

    assert.match(EPIC_GATEWAY.formatScoped(wu, EPIC_GATEWAY.discover(sim.dir, wu)), /^all_done: true$/m);
    assert.match(arriveAtEpicMenu(sim, wu, 'review'), /Review completed for "Wrapup"\./);
    assert.match(sim.render(['epic-all-done-gate', wu], { expect: 'content' }), /◆ Mark it completed\?/);
    sim.run(['workunit', 'complete', wu, '-m', `workflow(${wu}): complete epic pipeline`]);
    assert.match(sim.render(['workunit-receipt', wu, '--verb', 'complete', '--pipeline'], { expect: 'content' }), /Epic Completed/);
  });

  it('backwards: reopen a completed discussion, re-complete, and the map keeps deriving', () => {
    const wu = 'revisit';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Revisit flow', '--session-log-file', log]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write(`.leeway/${wu}/discussion/${wu}.md`, '# Discussion\n');
    sim.run(['topic', 'complete', wu, 'discussion', wu]);

    // Going backwards from the bridge's revisit arm: the gate offers the
    // completed discussion, the revisit menu numbers it, and the pick hands
    // off the route the gateway names for it — where resuming is not
    // starting: start refuses, reopen works.
    arrive(sim, wu);
    const dump = BRIDGE.format(BRIDGE.discover(sim.dir, wu));
    assert.match(dump, /^revisitable_phases: discussion$/m);
    assert.match(sim.render(['next-phase-gate', wu, '--prev', 'discussion', '--next', 'specification'], { expect: 'content' }),
      /\*\*`r\/revisit`\*\* → Revisit an earlier phase/);
    assert.match(sim.render(['revisit-phases', wu], { expect: 'content' }), /\*\*`1`\*\* +→ Discussion — \*completed\*/);
    assert.match(dump, new RegExp(`^revisit_routes: /leeway-discussion-process feature ${wu}$`, 'm'));
    handoff(sim, `/leeway-discussion-process feature ${wu}`);
    sim.refuses(['topic', 'start', wu, 'discussion', wu], /reopen/);
    sim.run(['topic', 'reopen', wu, 'discussion', wu]);
    sim.render(['phase-note', `${wu}.discussion.${wu}`, '--verb', 'Reopening'], { expect: 'content' });
    assert.strictEqual(sim.manifest(wu).phases.discussion.items[wu].status, 'in-progress');
    sim.render(['resume-gate', `${wu}.discussion.${wu}`], { expect: 'content' });
    sim.run(['topic', 'complete', wu, 'discussion', wu]);

    // Reopen after downstream exists: the spec keeps its state, derivations hold.
    sim.render(['entry-gate', `${wu}.specification.${wu}`], { expect: 'empty' });
    handoffEntry(sim, wu, 'specification', wu);
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.specification.${wu}`, 'status']), '', 'no specification item — a first start');
    sim.run(['topic', 'start', wu, 'specification', wu]);
    sim.run(['topic', 'reopen', wu, 'discussion', wu]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    assert.strictEqual(sim.manifest(wu).phases.specification.items[wu].status, 'in-progress');

    // Run the pipeline out, then walk the hop family backwards: staleness
    // lands at each reopen, one hop downstream, value = the upstream phase.
    walkDeliveryPhases(sim, wu, wu, { sources: [wu] });

    // discussion → specification (reverse join): flag + stale source row.
    let ro = sim.run(['topic', 'reopen', wu, 'discussion', wu]);
    assert.deepStrictEqual(ro.reconcile_flagged, [{ phase: 'specification', topic: wu }]);
    assert.deepStrictEqual(ro.sources_staled, [wu]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    // Re-completion clears nothing: the flag waits for the entry advisory,
    // the stale row for the spec's own reconciliation.
    let spec = sim.manifest(wu).phases.specification.items[wu];
    assert.strictEqual(spec.reconcile_needed, 'discussion');
    assert.strictEqual(spec.sources[wu].status, 'stale');
    // The read side never routes forward past the flag: the bridge's next
    // phase is the flagged spec, not done — the terminal branch stays untaken.
    const bridged = BRIDGE.discover(sim.dir, wu);
    assert.strictEqual(bridged.next_phase, 'specification');
    assert.deepStrictEqual(bridged.reconcile_pending, [`specification/${wu} (discussion)`]);
    sim.run(['manifest', 'delete', `${wu}.specification.${wu}`, 'reconcile_needed']);
    // The flag is not the whole signal: a source row still reading stale is
    // the specification moving with no flag and no reopen, and the walk stops
    // there rather than handing the plan a document about to change.
    assert.strictEqual(BRIDGE.discover(sim.dir, wu).next_phase, 'specification');
    sim.run(['manifest', 'set', `${wu}.specification.${wu}`, `sources.${wu}.status`, 'incorporated']);
    assert.strictEqual(BRIDGE.discover(sim.dir, wu).next_phase, 'done', 'every row incorporated: the record has stopped moving');

    // specification → planning: the pipeline hop, same-named item.
    ro = sim.run(['topic', 'reopen', wu, 'specification', wu]);
    assert.deepStrictEqual(ro.reconcile_flagged, [{ phase: 'planning', topic: wu }]);
    assert.strictEqual(ro.sources_staled, undefined);
    assert.strictEqual(sim.manifest(wu).phases.planning.items[wu].reconcile_needed, 'specification');
    sim.run(['topic', 'complete', wu, 'specification', wu]);
    sim.run(['manifest', 'delete', `${wu}.planning.${wu}`, 'reconcile_needed']);

    // planning → implementation.
    ro = sim.run(['topic', 'reopen', wu, 'planning', wu]);
    assert.deepStrictEqual(ro.reconcile_flagged, [{ phase: 'implementation', topic: wu }]);
    assert.strictEqual(sim.manifest(wu).phases.implementation.items[wu].reconcile_needed, 'planning');
    sim.run(['topic', 'complete', wu, 'planning', wu]);
    sim.run(['manifest', 'delete', `${wu}.implementation.${wu}`, 'reconcile_needed']);

    // implementation → review; a second reopen never clobbers the live flag.
    ro = sim.run(['topic', 'reopen', wu, 'implementation', wu]);
    assert.deepStrictEqual(ro.reconcile_flagged, [{ phase: 'review', topic: wu }]);
    assert.strictEqual(sim.manifest(wu).phases.review.items[wu].reconcile_needed, 'implementation');
    sim.run(['topic', 'complete', wu, 'implementation', wu]);
    ro = sim.run(['topic', 'reopen', wu, 'implementation', wu]);
    assert.strictEqual(ro.reconcile_flagged, undefined, 'existing flag never clobbered');
    sim.run(['topic', 'complete', wu, 'implementation', wu]);
    sim.run(['manifest', 'delete', `${wu}.review.${wu}`, 'reconcile_needed']);

    // review is the pipeline tail — reopening it flags nothing.
    ro = sim.run(['topic', 'reopen', wu, 'review', wu]);
    assert.strictEqual(ro.reconcile_flagged, undefined);
    sim.run(['topic', 'complete', wu, 'review', wu]);
    // Every flag cleared, every phase re-completed: the pipeline reads done.
    assert.strictEqual(BRIDGE.discover(sim.dir, wu).next_phase, 'done');
  });
});

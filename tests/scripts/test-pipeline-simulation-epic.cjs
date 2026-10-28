'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic scenarios: the map's lifecycle, per-topic
// phases, grouping supersession, cancel and reactivate; research first,
// its parked stub the topic's own row; the d and r doors naming the new
// topic; the last review handing off to the menu; an arrival that
// backfills; and a completed discussion reopened and completed again.
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
const { mapState } = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/discussion-map.cjs'));
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/workflow-continue-epic/scripts/gateway.cjs'));
const BRIDGE = require(path.join(ROOT, 'skills/workflow-bridge/scripts/gateway.cjs'));
const {
  epicMenu, epicDashboard,
} = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/projections/epic.cjs'));
const {
  drawLabel, bulletRow,
} = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/projections/surfaces.cjs'));
const { git, stateGit } = require('./engine-harness.cjs');
const {
  Sim, sessionLog, send, mappedEpic, carryOn, arrive, menuEntry, handoffEntry, handoff, arriveAtEpicMenu, pauseCheck, epicPick, epicKey, backToStart, startNew, walkDeliveryPhases,
} = require('./pipeline-world.cjs');

const { specDetail } = require('./pipeline-oracle.cjs');

describe('pipeline simulation: epic', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('epic: research first — a parked stub is the topic\'s own row, no discussion is born over it, no dead end buries it, and a reopen flags the live discussion', () => {
    const wu = 'orbit';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Orbit', '--session-log-file', log]);
    const topics = sim.write(`.leeway/.cache/${wu}/discovery/topics.json`, [
      { name: 'alpha', routing: 'discussion', summary: 'Alpha summary' },
      { name: 'beta', routing: 'research', summary: 'Beta summary' },
    ]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', topics]);
    sim.run(['discovery-map', 'sequence', wu, 'alpha=1', 'beta=2']);
    const rows = (topic) => epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys
      .filter((k) => k.topic === topic).map((k) => [k.action, drawLabel(k.label)]);

    // A research-side message parks on alpha before any discussion exists —
    // the research is alpha's own row, and the discussion is held for it at
    // the birth guard, the d door, and the entry gate alike.
    send(sim, wu, 'research', 'alpha', 'first-question');
    assert.deepStrictEqual(rows('alpha'), [['start_research', 'Start research for "Alpha" — *mail waiting*']]);
    sim.refuses(['topic', 'start', wu, 'discussion', 'alpha'],
      /discussion can't start on "alpha" — research is parked on it \(mail waiting\); research feeds discussion, so it lands first — the menu names the way in/);
    assert.match(sim.render(['direct-entry-gate', `${wu}.discussion.alpha`], { expect: 'content' }),
      /research is parked on it \(mail waiting\)[\s\S]*Its research row is the way in/);
    assert.match(sim.render(['entry-gate', `${wu}.discussion.alpha`], { expect: 'content' }),
      /Entry blocked — this discussion awaits research on "Alpha" \(parked — not yet started\)[\s\S]*Return to the epic menu — its research row is the way in\./);
    sim.refuses(['discovery-map', 'handle', wu, 'alpha'], /messages wait in its research mailbox/);

    // The research lands — the discussion row returns, the gate clears, and
    // the discussion is born; each row the menu offers hands off to its phase.
    epicPick(sim, wu, 'start_research', 'alpha');
    sim.run(['topic', 'start', wu, 'research', 'alpha']);
    sim.write(`.leeway/${wu}/research/alpha.md`, '# Research — Alpha\n');
    sim.run(['commit', wu, '-m', `research(${wu}): alpha`, '--topic', 'research/alpha']);
    sim.run(['topic', 'absorb', wu, 'research', 'alpha', '--file', '001-first-question.md', '-m', `research(${wu}): absorb 001-first-question`]);
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
    // A landing is the engine's own act — never held, whichever side it parks on.
    const decision = send(sim, wu, 'discussion', 'alpha', 'a-decision');
    assert.strictEqual(decision.status, 'in-progress');
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
    sim.run(['topic', 'absorb', wu, 'discussion', 'alpha', '--file', path.basename(decision.message_path),
      '--subtopic', 'a-decision', '-m', `discussion(${wu}/alpha): absorb a-decision`]);
    sim.run(['topic', 'complete', wu, 'discussion', 'alpha']);

    // A concluded discussion is held the same way: a research-side landing
    // beneath it reopens the research, and the discussion's reopen refuses
    // until that research lands again.
    const second = send(sim, wu, 'research', 'alpha', 'second-question');
    assert.strictEqual(second.reopened, true);
    sim.refuses(['topic', 'reopen', wu, 'discussion', 'alpha'],
      /discussion can't reopen on "alpha" — research is in flight on it; research feeds discussion, so it lands first — the menu names the way in/);
    assert.deepStrictEqual(rows('alpha').map((r) => r[0]), ['continue_research']);
    sim.write(`.leeway/${wu}/research/alpha.md`, '# Research — Alpha\n\nThe landed message.\n');
    sim.run(['commit', wu, '-m', `research(${wu}): alpha lands the message`, '--topic', 'research/alpha']);
    sim.run(['topic', 'absorb', wu, 'research', 'alpha', '--file', path.basename(second.message_path), '-m', `research(${wu}): absorb second-question`]);
    sim.run(['topic', 'complete', wu, 'research', 'alpha']);
    sim.run(['manifest', 'delete', `${wu}.discussion.alpha`, 'reconcile_needed']);
    assert.strictEqual(sim.run(['topic', 'reopen', wu, 'discussion', 'alpha']).status, 'in-progress');
    sim.run(['topic', 'complete', wu, 'discussion', 'alpha']);
  });

  it('epic: the d and r doors name the new topic and land its map row before the handoff carries it — a name on the map puts the menu back', () => {
    const wu = 'lumen';
    mappedEpic(sim, wu, ['alpha']);
    handoff(sim, `/workflow-continue-epic ${wu}`);
    arrive(sim, wu);

    // The doors are the menu's own flows: rows with no route, never handed to
    // the soft gate, and the handoff refuses an epic's research or discussion
    // without a topic.
    const doors = epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys
      .filter((k) => k.action === 'new_discussion' || k.action === 'new_research');
    assert.deepStrictEqual(doors.map((k) => [k.key, k.route]), [['d', null], ['r', null]]);
    for (const [phase, action] of [['discussion', 'new_discussion'], ['research', 'new_research']]) {
      sim.refuses(['render', 'epic-soft-gate', wu, '--action', action], new RegExp(`unknown --action "${action}"`));
      sim.refuses(['handoff', `/workflow-${phase}-process`, 'epic', wu], new RegExp(`^an epic enters ${phase} at a topic`));
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
      const route = `/workflow-${phase}-process epic ${wu} ${topic}`;
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
    const message = sim.write('.leeway/.cache/scratch/message.md', '### Off-topic\n*From: alpha · discussion · 2026-01-01*\n\nDetails.\n');
    sim.run(['topic', 'send', wu, 'discussion', 'beta', '--content', message, '--slug', 'off-topic',
      '-m', `discussion(${wu}/alpha): send message to beta`]);
    sim.run(['commit', wu, '-m', `discussion(${wu}/alpha): capture`, '--topic', 'discussion/alpha']);
    sim.run(['topic', 'complete', wu, 'discussion', 'alpha']);

    handoff(sim, `/workflow-continue-epic ${wu} discussion completed`);
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

  it('epic: map lifecycle, per-topic phases, grouping supersession, cancel/reactivate', () => {
    const wu = 'overhaul';
    startNew(sim, 'epic');
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Payments overhaul', '--session-log-file', log]);
    // The work-type commit opened the session; discovery's run step labels
    // its place, and the conversation carries on from the open session's log.
    assert.strictEqual(sim.run(['session', 'label', wu, 'discovery', wu]).labelled, false);
    const shaping = carryOn(sim);
    assert.deepStrictEqual(shaping.position, { name: wu, phase: 'discovery', topic: wu });
    assert.strictEqual(shaping.skill, path.join(sim.dir, '.claude/skills/workflow-discovery/SKILL.md'));
    assert.deepStrictEqual(shaping.files, [path.join(sim.dir, `.leeway/${wu}/discovery/sessions/session-001.md`)]);
    assert.match(shaping.text, /^The conversation was just compacted\. This conversation is working in the discovery of the epic "overhaul"\. /);

    // Harvest: three topics in one batch, briefs pointed.
    const topics = sim.write(`.leeway/.cache/${wu}/discovery/topics.json`, [
      { name: 'alpha', routing: 'research', summary: 'Alpha summary', brief_path: 'discovery/briefs/alpha.md' },
      { name: 'beta', routing: 'discussion', summary: 'Beta summary', brief_path: 'discovery/briefs/beta.md' },
      { name: 'gamma', routing: 'discussion', summary: 'Gamma summary' },
    ]);
    sim.write(`.leeway/${wu}/discovery/briefs/alpha.md`, '# Brief — Alpha\n');
    sim.write(`.leeway/${wu}/discovery/briefs/beta.md`, '# Brief — Beta\n');
    const batch = sim.run(['discovery-map', 'add-batch', wu, '--file', topics]);
    assert.strictEqual(batch.map_total, 3);
    sim.run(['discovery-map', 'sequence', wu, 'alpha=1', 'beta=2', 'gamma=3']);

    // The map gates the birth of a phase item — the menu row is the way in:
    // a discussion cannot be born on a research-routed topic whose research
    // has not run, nor research on a discussion-routed one. The d/r doors'
    // gate refuses the same names and passes a name not on the map.
    sim.refuses(['topic', 'start', wu, 'discussion', 'alpha'], /routed to research and nothing has started/);
    sim.refuses(['topic', 'start', wu, 'research', 'beta'], /routed to discussion and nothing has started/);
    sim.render(['direct-entry-gate', `${wu}.discussion.alpha`], { expect: 'content' });
    sim.render(['direct-entry-gate', `${wu}.research.beta`], { expect: 'content' });
    sim.render(['direct-entry-gate', `${wu}.discussion.omega`], { expect: 'empty' });

    // Map operations the session loop supports.
    sim.run(['discovery-map', 'edit', wu, 'gamma', '--summary', 'Gamma, sharpened']);
    sim.run(['discovery-map', 'rename', wu, 'gamma', 'gamma-prime']);
    sim.run(['discovery-map', 'reroute', wu, 'gamma-prime', 'research']);
    // The discovery session's cadence commit: its own paths only — a live
    // research or discussion session's topic file is never swept.
    sim.run(['commit', wu, '--discovery', '-m', `discovery(${wu}): shape the map`]);
    // A session interrupted here resumes from the epic menu, whose discovery
    // row hands the epic back to discovery.
    assert.strictEqual(epicPick(sim, wu, 'continue_discovery').line, `→ Discovery · ${wu}`);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): synthesise 3 topics`]);
    // The discovery hand-off lands on the epic menu — the bridge's discovery
    // continuation into workflow-continue-epic, no banner — which labels the
    // work unit alone on arrival.
    handoff(sim, `/workflow-continue-epic ${wu}`);
    arrive(sim, wu);

    // Alpha: research then discussion; regenerated-brief reconcile flag rides.
    // Each menu pick into a topic's phase hands off to that phase's skill.
    assert.strictEqual(epicPick(sim, wu, 'start_research', 'alpha').args, `epic ${wu} alpha`);
    sim.run(['topic', 'start', wu, 'research', 'alpha']);
    // The thread register — what alpha set out to learn. Every verb is a
    // locked manifest write with no commit; the register renders as a lens
    // at the session's transitions, and the conclude gate carries it as the
    // hand-off whenever a thread stands — nothing gates on a thread's state.
    assert.ok(!sim.render(['research-conclude-gate', `${wu}.research.alpha`], { expect: 'content' }).includes('DISPLAY: research threads'),
      'an empty register prepends nothing to the conclude gate');
    sim.render(['research-threads', `${wu}.research.alpha`], { expect: 'empty' });
    sim.refuses(['research-threads', 'add', wu, 'beta', 'scope', '--question', 'What must beta cover?', '--origin', 'seed'],
      /no research item "beta"/);
    const seeded = sim.run(['research-threads', 'add', wu, 'alpha', 'scope', '--question', 'What does alpha have to cover?', '--origin', 'seed']);
    assert.strictEqual(seeded.status, 'open');
    sim.run(['research-threads', 'add', wu, 'alpha', 'edges', '--question', 'Which edges does the brief name?', '--origin', 'brief', '--parent', 'scope']);
    sim.refuses(['research-threads', 'add', wu, 'alpha', 'deeper', '--question', 'Deeper still?', '--origin', 'user', '--parent', 'edges'], /two levels max/);
    sim.refuses(['research-threads', 'add', wu, 'alpha', 'scope', '--question', 'Again?', '--origin', 'user'], /already exists/);
    sim.refuses(['research-threads', 'add', wu, 'alpha', 'typo', '--question', 'Q?', '--origin', 'deep-dive-x'], /thread origin must be/);
    sim.refuses(['research-threads', 'add', wu, 'alpha', 'orphan', '--question', 'Q?', '--origin', 'user', '--parent', 'ghost'], /parent thread "ghost" not found/);
    sim.run(['research-threads', 'set', wu, 'alpha', 'scope', 'digging']);
    sim.run(['research-threads', 'set', wu, 'alpha', 'scope=learned', 'edges=learned']);
    sim.refuses(['research-threads', 'set', wu, 'alpha', 'scope', 'edges=open'], /never mixed/);
    sim.run(['research-threads', 'add', wu, 'alpha', 'cold-start', '--question', 'How does alpha behave on a cold start?', '--origin', 'conversation']);
    sim.run(['research-threads', 'set', wu, 'alpha', 'cold-start', 'parked', '--note', 'needs a machine cycle']);
    sim.refuses(['research-threads', 'set', wu, 'alpha', 'cold-start', 'open', '--note', 'still'], /parked thread alone/);
    sim.run(['research-threads', 'reframe', wu, 'alpha', 'cold-start', '--question', 'Does alpha place correctly on a cold start?']);
    sim.refuses(['research-threads', 'remove', wu, 'alpha', 'scope'], /"edges" nests under it; pass --into <survivor>/);
    // A merge with children moves them under the survivor in the same write.
    sim.run(['research-threads', 'add', wu, 'alpha', 'reach', '--question', 'How far does alpha reach?', '--origin', 'Legacy Topic']);
    const mergedInto = sim.run(['research-threads', 'remove', wu, 'alpha', 'scope', '--into', 'reach']);
    assert.strictEqual(mergedInto.into, 'reach');
    assert.strictEqual(sim.manifest(wu).phases.research.items.alpha.threads.edges.parent, 'reach', 'the child moved under the survivor');
    sim.refuses(['research-threads', 'remove', wu, 'alpha', 'edges', '--into', 'edges'], /can't merge into itself/);
    const merged = sim.run(['research-threads', 'remove', wu, 'alpha', 'edges']);
    sim.run(['research-threads', 'remove', wu, 'alpha', 'reach']);
    assert.deepStrictEqual(merged.counts, { open: 1, digging: 0, learned: 0, parked: 1 });
    sim.run(['research-threads', 'add', wu, 'alpha', 'scope', '--question', 'What does alpha have to cover?', '--origin', 'seed']);
    sim.run(['research-threads', 'set', wu, 'alpha', 'scope', 'learned']);
    assert.match(sim.render(['research-threads', `${wu}.research.alpha`], { expect: 'content' }),
      /Research Threads — Alpha \(2 threads — 1 learned · 1 parked\)/);
    const gate = sim.render(['research-conclude-gate', `${wu}.research.alpha`, '--dead-end'], { expect: 'content' });
    assert.ok(gate.indexOf('DISPLAY: research threads') < gate.indexOf('MENU: research conclude gate'),
      'the register rides above the conclude gate as the hand-off');
    assert.match(gate, /↳ Needs a machine cycle/);
    assert.match(gate, /d\/dead-end/);
    // Research in flight is no message of a discussion entry — the soft gate
    // is empty for a discussion start while alpha's research runs.
    sim.render(['epic-soft-gate', wu, '--action', 'start_discussion', '--topic', 'beta'], { expect: 'empty' });
    sim.write(`.leeway/${wu}/research/alpha.md`, '# Research — Alpha\n');
    sim.run(['commit', wu, '-m', `research(${wu}): alpha`, '--topic', 'research/alpha']);
    sim.run(['topic', 'complete', wu, 'research', 'alpha']);
    assert.match(arriveAtEpicMenu(sim, wu, 'research'), /Research completed for "Overhaul"\./);
    // The menu's way back: the start menu, the epic still its row.
    assert.ok(backToStart(sim, epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys)
      .some((k) => k.action === 'continue_work_unit' && k.route === `/workflow-continue-epic ${wu}`));
    const ops = sim.write(`.leeway/.cache/${wu}/discovery/reconcile-ops.json`,
      [{ op: 'set', path: `${wu}.research.alpha`, fields: { reconcile_needed: true } }]);
    sim.run(['manifest', 'apply', wu, '--file', ops]);
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.research.alpha`, 'reconcile_needed']), 'true');
    sim.run(['manifest', 'delete', `${wu}.research.alpha`, 'reconcile_needed']);

    epicPick(sim, wu, 'start_discussion_after_research', 'alpha');
    sim.render(['entry-gate', `${wu}.discussion.alpha`], { expect: 'empty' });
    sim.run(['topic', 'start', wu, 'discussion', 'alpha']);

    // A dismissed finding's ground rides the topic and is carried into every
    // later review dispatch; the user's recall pulls it back off.
    sim.run(['manifest', 'push', `${wu}.discussion.alpha`, 'dismissed_grounds',
      'Vendor pricing tiers beyond the shortlist']);
    assert.deepStrictEqual(sim.manifest(wu).phases.discussion.items.alpha.dismissed_grounds,
      ['Vendor pricing tiers beyond the shortlist']);
    sim.run(['manifest', 'pull', `${wu}.discussion.alpha`, 'dismissed_grounds',
      'Vendor pricing tiers beyond the shortlist']);
    assert.deepStrictEqual(sim.manifest(wu).phases.discussion.items.alpha.dismissed_grounds, []);
    sim.write(`.leeway/${wu}/discussion/alpha.md`, '# Discussion — Alpha\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'alpha']);
    arriveAtEpicMenu(sim, wu, 'discussion');

    // The hop on a direct reopen: research alpha beneath alpha's decided
    // discussion — the same flag a message landing sets.
    const reopenHop = sim.run(['topic', 'reopen', wu, 'research', 'alpha']);
    assert.deepStrictEqual(reopenHop.reconcile_flagged, [{ phase: 'discussion', topic: 'alpha' }]);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.alpha.reconcile_needed, 'research');
    sim.run(['topic', 'complete', wu, 'research', 'alpha']);
    sim.run(['manifest', 'delete', `${wu}.discussion.alpha`, 'reconcile_needed']);

    // Beta discussed to a decided map; gamma-prime cancelled mid-flight and
    // reactivated later.
    epicPick(sim, wu, 'start_discussion', 'beta');
    sim.render(['entry-gate', `${wu}.discussion.beta`], { expect: 'empty' });
    sim.run(['topic', 'start', wu, 'discussion', 'beta']);
    // A signal over a map with nothing on it takes the map gate's empty
    // branch: neither settled nor holding anything open, so no defer gate.
    const emptyMap = mapState(sim.manifest(wu), 'beta');
    assert.strictEqual(emptyMap.all_decided, false);
    assert.deepStrictEqual(emptyMap.unresolved, []);
    sim.refuses(['render', 'defer-gate', `${wu}.discussion.beta`], /nothing on "beta"'s map is undecided/);
    sim.run(['discussion-map', 'add', wu, 'beta', 'retry-policy']);
    // Review arming: the first background review is free and snapshots the
    // map; after a completed cycle the next refuses until the Discussion Map
    // moves forward min(cycles, 3) times; --final — the mandatory closing
    // pass — bypasses the movement gate.
    const rev1 = sim.run(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review']);
    sim.write(rev1.file, '# Findings\n');
    sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    // The conclusion's drain offer reads the acknowledged row's own count and
    // refuses every other state — pending before the ack, incorporated after
    // the last finding surfaces.
    sim.refuses(['render', 'review-findings-gate', `${wu}.discussion.beta`], /"review-001" is pending/);
    sim.run(['agent', 'ack', wu, 'discussion', 'beta', rev1.id, '--findings', 'F1']);
    // The surfacing protocol's opt-in gate: the kind and the count off the
    // acknowledged row, the lane split from the judgment payload.
    sim.write('.leeway/.cache/scratch/announce.json', JSON.stringify({ shape: '1 needs a call' }));
    assert.match(
      sim.render(['finding-announce', `${wu}.discussion.beta`, '--id', rev1.id, '--file', '.leeway/.cache/scratch/announce.json'], { expect: 'content' }),
      /Background review returned — 1 finding\(s\): 1 needs a call\./, 'the announce gate reads the row and the payload');
    assert.match(sim.render(['review-findings-gate', `${wu}.discussion.beta`], { expect: 'content' }),
      /The review left 1 finding still to walk\./, 'the drain offer counts the row\'s unsurfaced findings');
    sim.run(['agent', 'surface', wu, 'discussion', 'beta', rev1.id, 'F1']);
    sim.refuses(['render', 'review-findings-gate', `${wu}.discussion.beta`], /"review-001" is incorporated/);
    sim.refuses(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review'],
      /review dispatch blocked: quiet — 0 of 1 map moves since review-001/);
    const quietScan = sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    assert.deepStrictEqual(quietScan.review_arming,
      { armed: false, cycles: 1, map_moves_seen: 0, map_moves_needed: 1, reason: 'quiet — 0 of 1 map moves since review-001' },
      'scan answers the same verdict dispatch enforces');
    sim.run(['discussion-map', 'set', wu, 'beta', 'retry-policy', 'decided']);
    const rev2 = sim.run(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review']);
    assert.strictEqual(rev2.id, 'review-002', 'one forward move re-arms the second review');
    sim.write(rev2.file, '# Findings\n');
    sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    sim.run(['agent', 'ack', wu, 'discussion', 'beta', rev2.id, '--clean']);
    const revFinal = sim.run(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review', '--final']);
    assert.strictEqual(revFinal.id, 'review-003', 'the closing pass dispatches over a quiet map');
    sim.write(revFinal.file, '# Findings\n');
    sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    sim.run(['agent', 'ack', wu, 'discussion', 'beta', revFinal.id, '--clean']);
    sim.write(`.leeway/${wu}/discussion/beta.md`, '# Discussion — Beta\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'beta']);

    // The message-fold settle: a send reopens the concluded discussion, the
    // raise arms new ground, and the absorb settles that ground into the
    // review anchor — a sitting that only drained the mailbox arms no review;
    // its review duty belongs to the closing gates' final pass.
    sim.write('.leeway/.cache/scratch/message-scratch.md',
      '### Escalation path\n*From: alpha · discussion · 2026-07-23*\n\nWho gets paged?\n');
    const sent = sim.run(['topic', 'send', wu, 'discussion', 'beta',
      '--content', '.leeway/.cache/scratch/message-scratch.md', '--slug', 'escalation-path',
      '-m', `discussion(${wu}/alpha): send message to beta`]);
    assert.strictEqual(sent.reopened, true, 'a delivery beneath a concluded discussion reopens it');
    // The cue follows the mailbox, not the status: the reopened item is
    // in-progress with no stub to read, yet its rows say what waits — and
    // the fold retires the cue.
    const betaRow = () => drawLabel(epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys
      .find((k) => k.topic === 'beta' && k.action === 'continue_discussion').label);
    assert.strictEqual(betaRow(), 'Continue "Beta" — *discussion* · mail waiting');
    assert.match(epicDashboard(wu, EPIC_GATEWAY.discover(sim.dir, wu)).replace(/\n[ │]+/g, ' '),
      /Discussing · mail waiting/);
    sim.refuses(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review'],
      /review dispatch blocked/);
    sim.run(['discussion-map', 'add', wu, 'beta', 'escalation-path']);
    sim.run(['discussion-map', 'set', wu, 'beta', 'escalation-path', 'exploring']);
    sim.run(['discussion-map', 'set', wu, 'beta', 'escalation-path', 'decided']);
    sim.refuses(['topic', 'absorb', wu, 'discussion', 'beta',
      '--file', '001-escalation-path.md', '-m', 'x'], /a discussion fold names its ground/);
    const folded = sim.run(['topic', 'absorb', wu, 'discussion', 'beta',
      '--file', '001-escalation-path.md', '--subtopic', 'escalation-path',
      '-m', `discussion(${wu}/beta): absorb 001-escalation-path (from alpha)`]);
    assert.strictEqual(folded.arming_settled, true, 'the fold\'s ground joins the anchor snapshot');
    assert.strictEqual(folded.remaining, 0);
    assert.strictEqual(betaRow(), 'Continue "Beta" — *discussion*', 'the drained mailbox retires the cue');
    // The drained mailbox re-arms nothing — the fold never counts as movement.
    sim.refuses(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review'],
      /0 of 3 map moves since review-003/);
    sim.run(['topic', 'complete', wu, 'discussion', 'beta']);

    sim.run(['topic', 'start', wu, 'research', 'gamma-prime']);
    sim.run(['topic', 'cancel', wu, 'discovery', 'gamma-prime']);
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.gamma-prime`, '--verb', 'cancel'], { expect: 'content' }),
      /Cancelled "Gamma Prime"\./, 'topic cancel receipt renders from the cancelled unit');
    const cancelled = sim.manifest(wu).phases.discovery.items['gamma-prime'];
    assert.strictEqual(cancelled.cancelled, true, 'the map row carries the marker');
    assert.ok(!('order' in cancelled), 'cancel stashes the map order');
    assert.strictEqual(cancelled.previous_order, 3);
    assert.strictEqual(sim.manifest(wu).phases.research.items['gamma-prime'].status, 'cancelled', 'the research goes with the topic');
    sim.run(['topic', 'reactivate', wu, 'discovery', 'gamma-prime']);
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.gamma-prime`, '--verb', 'reactivate'], { expect: 'content' }),
      /Reactivated "Gamma Prime"\. Restored research \[in-progress\]\./, 'topic reactivate receipt names what returned');
    assert.strictEqual(sim.manifest(wu).phases.discovery.items['gamma-prime'].order, 3,
      'reactivate restores the map order');
    assert.strictEqual(sim.manifest(wu).phases.discovery.items['gamma-prime'].cancelled, undefined, 'the marker is gone');
    sim.run(['topic', 'cancel', wu, 'discovery', 'gamma-prime']);

    // Delta: an off-topic message sent from alpha parks on an unstarted
    // topic — the item is unstarted, never in-progress; the send is one
    // self-committing transaction (engine-numbered message file, scratch
    // consumed, commit confined to message + manifest).
    sim.run(['discovery-map', 'add', wu, 'delta', 'research', '--summary', 'Delta summary', '--source', 'message:alpha']);
    sim.write('.leeway/.cache/scratch/message-scratch.md',
      '### Parked message\n*From: alpha · discussion · 2026-07-23*\n\nDetails.\n');
    const parked = sim.run(['topic', 'send', wu, 'research', 'delta',
      '--content', '.leeway/.cache/scratch/message-scratch.md', '--slug', 'parked-message',
      '-m', `discussion(${wu}/alpha): send message to delta`]);
    assert.strictEqual(parked.status, 'unstarted');
    assert.strictEqual(parked.created, true);
    assert.strictEqual(parked.message_path, path.join(sim.dir, `.leeway/${wu}/research/.mailbox/delta/001-parked-message.md`));
    assert.ok(parked.committed, 'the send self-commits');
    assert.ok(!fs.existsSync(path.join(sim.dir, '.leeway/.cache/scratch/message-scratch.md')), 'scratch consumed');
    const mailbox = sim.run(['topic', 'mailbox', wu, 'research', 'delta']);
    assert.strictEqual(mailbox.count, 1);
    assert.deepStrictEqual(mailbox.files, [parked.message_path], 'the read verb lists the delivered message');
    // The mailbox read is reachable for any topic — a session checking a
    // foreign mailbox must not manufacture a hold there. No verb has yet
    // acted on delta from this session, so the read stamps nothing.
    assert.ok(!fs.existsSync(path.join(sim.dir, `.leeway/.cache/${wu}/research/delta/presence`)),
      'a mailbox read never creates a heartbeat');
    // Research carries no review — the refusal is on kind, before any mailbox
    // read — and the deep dive, the phase's one instrument, is never gated
    // by the mailbox.
    sim.refuses(['agent', 'dispatch', wu, 'research', 'delta', '--kind', 'review'],
      /research carries no review — the deep dive is the phase's instrument/);
    sim.run(['agent', 'dispatch', wu, 'research', 'delta', '--kind', 'deep-dive', '--label', 'scope']);
    assert.ok(fs.existsSync(path.join(sim.dir, `.leeway/.cache/${wu}/research/delta/presence`)),
      'the write-shaped verb is what claims the slot');
    // topic absorb — the send's mirror: send a second message, absorb it,
    // and the self-committing response answers what remains.
    sim.write('.leeway/.cache/scratch/message-scratch.md',
      '### Second parked\n*From: alpha · discussion · 2026-07-23*\n\nMore.\n');
    sim.run(['topic', 'send', wu, 'research', 'delta',
      '--content', '.leeway/.cache/scratch/message-scratch.md', '--slug', 'second-parked',
      '-m', `discussion(${wu}/alpha): send message to delta`]);
    // The fold enters the message on the register with the sending topic as its origin.
    const entered = sim.run(['research-threads', 'add', wu, 'delta', 'second-parked', '--question', 'More?', '--origin', 'alpha']);
    assert.strictEqual(entered.origin, 'alpha');
    sim.run(['research-threads', 'set', wu, 'delta', 'second-parked', 'learned']);
    const absorbed = sim.run(['topic', 'absorb', wu, 'research', 'delta',
      '--file', '002-second-parked.md', '-m', `research(${wu}/delta): absorb 002-second-parked (from alpha)`]);
    assert.strictEqual(absorbed.absorbed, '002-second-parked.md');
    assert.strictEqual(absorbed.remaining, 1, 'the absorb answers the post-deletion count');
    assert.ok(absorbed.committed, 'absorb self-commits');
    assert.ok(!fs.existsSync(path.join(sim.dir, `.leeway/${wu}/research/.mailbox/delta/002-second-parked.md`)), 'message file deleted');
    // topic forward — the wrong-side repair: the raise judges the remaining
    // message owed the pair's other phase-side, the offer gate renders over
    // the live mailbox, and one transaction moves it — destination parked as a
    // fresh unstarted stub, the emptied source stub removed.
    sim.write('.leeway/.cache/scratch/forward-offer.json', JSON.stringify({
      file: '001-parked-message.md', title: 'Parked message', reason: 'it asks delta to decide, not to explore.',
    }));
    sim.render(['forward-offer', `${wu}.research.delta`, '--file', '.leeway/.cache/scratch/forward-offer.json'], { expect: 'content' });
    const moved = sim.run(['topic', 'forward', wu, 'research', 'discussion', 'delta',
      '--file', '001-parked-message.md', '-m', `research(${wu}/delta): forward 001-parked-message to discussion`]);
    assert.strictEqual(moved.remaining, 0);
    assert.strictEqual(moved.created, true);
    assert.strictEqual(moved.source_item_removed, true, 'the emptied research stub is removed');
    assert.strictEqual(moved.message_path, path.join(sim.dir, `.leeway/${wu}/discussion/.mailbox/delta/001-parked-message.md`));
    assert.ok(moved.committed, 'forward self-commits');
    assert.strictEqual(sim.manifest(wu).phases.research.items.delta, undefined);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.delta.status, 'unstarted');
    // …and the mirror move restores the research-side parking for the steps below.
    const movedBack = sim.run(['topic', 'forward', wu, 'discussion', 'research', 'delta',
      '--file', '001-parked-message.md', '-m', `discussion(${wu}/delta): forward 001-parked-message to research`]);
    assert.strictEqual(movedBack.source_item_removed, true);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.delta, undefined);
    assert.strictEqual(sim.manifest(wu).phases.research.items.delta.status, 'unstarted');
    assert.deepStrictEqual(sim.run(['topic', 'mailbox', wu, 'research', 'delta']).files,
      [path.join(sim.dir, `.leeway/${wu}/research/.mailbox/delta/001-parked-message.md`)]);
    // The raise's display surfaces: the fresh-sitting notice, the offer gate
    // (agenda payload validated against the live mailbox), and the conclusion
    // blocker — the entry itself is read by the session, never rendered.
    sim.write('.leeway/.cache/scratch/mail-offer.json', JSON.stringify({
      items: [{ file: '001-parked-message.md', title: 'Parked message', origin: 'alpha', from_phase: 'discussion', from_date: '2026-07-23' }],
    }));
    sim.render(['mail-announce', `${wu}.research.delta`], { expect: 'content' });
    sim.render(['mail-offer', `${wu}.research.delta`, '--file', '.leeway/.cache/scratch/mail-offer.json'], { expect: 'content' });
    sim.render(['mail-block', `${wu}.research.delta`], { expect: 'content' });
    // Judgment landing: a research-side delivery beneath beta's completed
    // discussion parks the message AND flags the discussion for
    // reconciliation — the discussion itself stays completed.
    sim.write('.leeway/.cache/scratch/message-scratch.md', '### Feasibility question\n*From: alpha · discussion · 2026-07-23*\n\nIs this even possible?\n');
    const flagged = sim.run(['topic', 'send', wu, 'research', 'beta',
      '--content', '.leeway/.cache/scratch/message-scratch.md', '--slug', 'feasibility-question',
      '-m', `discussion(${wu}/alpha): send message to beta`]);
    assert.strictEqual(flagged.reconcile_flagged, true);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.beta.reconcile_needed, 'research');
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.beta.status, 'completed');
    // The absorb drains the mailbox; a deep dive — research's one agent kind —
    // dispatches over the drained topic.
    sim.run(['topic', 'absorb', wu, 'research', 'beta',
      '--file', '001-feasibility-question.md', '-m', `research(${wu}/beta): absorb 001-feasibility-question (from alpha)`]);
    sim.run(['agent', 'dispatch', wu, 'research', 'beta', '--kind', 'deep-dive', '--label', 'feasibility']);
    // Presence: heartbeats are mechanical, so the verbs already run on this
    // work unit's topics have stamped them — no prose ever beats.
    const rowOf = (scan, phase, topic) => scan.sessions.find((r) => r.phase === phase && r.topic === topic);
    assert.ok(rowOf(sim.run(['presence', 'scan', wu]), 'research', 'beta'),
      'the verbs a session runs on its own topic leave a heartbeat behind');
    // A beat reads held (deferral territory for the bridge, in-session
    // territory for the epic view); the orderly clear drops it.
    sim.run(['presence', 'beat', wu, 'research', 'alpha']);
    const present = sim.run(['presence', 'scan', wu]);
    assert.strictEqual(rowOf(present, 'research', 'alpha').held, true);
    assert.ok(!('live' in rowOf(present, 'research', 'alpha')), 'held is the one verdict — idle time is shown, never judged');
    assert.strictEqual(present.held_sources, 0, 'a session\'s own rows never defer it');
    assert.strictEqual(sim.sections, '', 'and no deferral section rides its scan');
    sim.run(['presence', 'clear', wu, 'research', 'alpha']);
    assert.strictEqual(rowOf(sim.run(['presence', 'scan', wu]), 'research', 'alpha'), undefined);
    // The project-wide scan is the code gate's read: every work unit's rows,
    // each naming its own.
    const project = sim.run(['presence', 'scan']);
    assert.strictEqual(project.scope, 'project');
    assert.ok(project.sessions.every((r) => typeof r.work_unit === 'string'), 'every row names its work unit');
    // The SessionEnd cleanup sweeps by owning session id — a peer session's
    // heartbeat survives.
    sim.write(`.leeway/.cache/${wu}/discussion/beta/presence`,
      JSON.stringify({ pid: null, pid_start: null, session_id: 'sim-sess' }) + '\n');
    sim.write(`.leeway/.cache/${wu}/discussion/gamma/presence`,
      JSON.stringify({ pid: null, pid_start: null, session_id: 'peer-sess' }) + '\n');
    const swept = sim.run(['presence', 'cleanup', 'sim-sess']);
    assert.deepStrictEqual(swept.cleared, [{ work_unit: wu, phase: 'discussion', topic: 'beta' }]);
    assert.ok(rowOf(sim.run(['presence', 'scan', wu]), 'discussion', 'gamma'), 'the peer\'s heartbeat is left alone');
    sim.run(['presence', 'cleanup', 'peer-sess']);
    assert.strictEqual(rowOf(sim.run(['presence', 'scan', wu]), 'discussion', 'gamma'), undefined);
    // The same hook records the ending conversation's transcript in its
    // folder, which every call the sim makes has marked; a conversation that
    // never ran the workflows has no folder and gets none.
    const ending = (/** @type {string} */ id) => JSON.stringify({ session_id: id, transcript_path: `/transcripts/${id}.jsonl`, hook_event_name: 'SessionEnd', reason: 'clear' });
    assert.deepStrictEqual(sim.run(['conversation', 'end'], null, ending('sim-session')), { ok: true, recorded: true });
    assert.deepStrictEqual(sim.run(['conversation', 'end'], null, ending('plain-sess')), { ok: true, recorded: false });
    // Session labels, as every process skill's Step 0 issues them: an
    // unrecorded opt-in answers a disabled no-op, and a bad argument refuses
    // all the same — the place is checked before anything is labelled or
    // recorded; opted in (the choice lands on the project manifest, and the
    // project's settings gain `session cleanup` beside the `presence
    // cleanup` and `conversation end` every project's SessionEnd hook
    // carries, plus a SessionStart `session resume` matched to resume,
    // committed together) but outside tmux (the sim strips the identity)
    // answers no-tmux; an unknown phase refuses; a hand-stamped manifest
    // false disables; the SessionEnd restore sweep answers with nothing to
    // restore and the SessionStart resume — on stderr, its stdout being
    // conversation context — with nothing to resume; opting out takes
    // `session cleanup` and `session resume` back out and leaves the
    // workflows' own, the layout hook before every write among them, which
    // refuses a Write to the ledger and lets one to a manifest through.
    const label0 = sim.run(['session', 'label', wu, 'research', 'alpha']);
    assert.deepStrictEqual(label0, { ok: true, labelled: false, reason: 'disabled' });
    sim.refuses(['session', 'label', wu, 'deploying', 'alpha'], /unknown phase/);
    sim.run(['session', 'label-config', 'true']);
    assert.strictEqual(sim.read(['manifest', 'get', 'project.defaults.tmux_labels']), 'true');
    const hookVerbs = () => Object.fromEntries(
      Object.entries(JSON.parse(fs.readFileSync(path.join(sim.dir, '.claude', 'settings.json'), 'utf8')).hooks)
        .map(([event, groups]) => [event, groups.flatMap((g) => g.hooks.map((h) => h.command.slice(h.command.indexOf('engine.cjs"'))))]));
    assert.deepStrictEqual(hookVerbs(), {
      SessionEnd: ['engine.cjs" session cleanup', 'engine.cjs" presence cleanup', 'engine.cjs" conversation end'],
      SessionStart: ['engine.cjs" session resume'],
      PreToolUse: ['engine.cjs" layout guard'],
    }, 'the opt-in installs the session hooks on both events, beside the layout hook');
    assert.strictEqual(stateGit(sim.dir, ['log', '-1', '--pretty=%s']).trim(), 'chore: record session-label choice',
      'the choice is state');
    assert.strictEqual(git(sim.dir, ['log', '-1', '--pretty=%s']).trim(), 'chore: record session-label choice',
      'and the hooks it synced are the code tree\'s');
    const label1 = sim.run(['session', 'label', wu, 'discussion', 'alpha']);
    assert.deepStrictEqual(label1, { ok: true, labelled: false, reason: 'no-tmux' });
    sim.refuses(['session', 'label', wu, 'deploying', 'alpha'], /unknown phase/);
    // The arrival forms, enabled and outside tmux: a work unit and the two
    // project identities (no directory behind them) validate and answer
    // no-tmux; a phase without its topic, a name that is neither, and an
    // identity carrying a phase refuse.
    for (const name of [wu, 'roadmap', 'baseline']) {
      assert.deepStrictEqual(sim.run(['session', 'label', name]), { ok: true, labelled: false, reason: 'no-tmux' });
    }
    sim.refuses(['session', 'label', wu, 'discussion'], /Usage: engine session label <name> \[<phase> <topic>\]/);
    sim.refuses(['session', 'label', 'ghost'], /no work unit directory/);
    sim.refuses(['session', 'label', 'roadmap', 'discovery', 'roadmap'], /no work unit directory/);
    sim.run(['manifest', 'set', 'project.defaults.tmux_labels', 'false']);
    assert.deepStrictEqual(sim.run(['session', 'label', wu, 'discussion', 'alpha']),
      { ok: true, labelled: false, reason: 'disabled' });
    sim.run(['manifest', 'delete', 'project.defaults.tmux_labels']);
    assert.deepStrictEqual(sim.run(['session', 'cleanup', 'sim-sess']), { ok: true, restored: false });
    assert.deepStrictEqual(sim.runOnStderr(['session', 'resume', 'sim-sess']), { ok: true, resumed: false });
    sim.run(['session', 'label-config', 'false']);
    assert.strictEqual(sim.read(['manifest', 'get', 'project.defaults.tmux_labels']), 'false');
    assert.deepStrictEqual(hookVerbs(), {
      SessionEnd: ['engine.cjs" presence cleanup', 'engine.cjs" conversation end'],
      PreToolUse: ['engine.cjs" layout guard'],
    }, 'opting out leaves the workflows\' own in place');
    const beforeWrite = (/** @type {string} */ rel) => sim.engine(['layout', 'guard'], null, JSON.stringify({
      hook_event_name: 'PreToolUse', cwd: sim.dir, tool_name: 'Write', tool_input: { file_path: path.join(sim.dir, '.leeway', rel), content: '' },
    }));
    assert.strictEqual(beforeWrite('.ledger.jsonl').code, 2, 'the ledger is the engine\'s alone');
    assert.deepStrictEqual(beforeWrite('manifest.json'), { stdout: '', stderr: '', code: 0 });
    // Concurrent-session shape: a --topic commit slices out only its own
    // topic's paths — a peer topic's dirty file survives unstaged and
    // uncommitted, and the commit contains no path outside the topic + manifest.
    sim.write(`.leeway/${wu}/research/alpha.md`, '# Research: Alpha\n\nown progress\n');
    sim.write(`.leeway/${wu}/research/delta.md`,
      '# Research: Delta\n\nThe parked message, worked here. Peer dirt.\n');
    sim.run(['commit', wu, '-m', `research(${wu}/alpha): progress`, '--topic', 'research/alpha']);
    const porcelain = stateGit(sim.dir, ['status', '--porcelain']);
    assert.match(porcelain, /research\/delta\.md/, 'peer topic dirt survives a --topic commit');
    const headPaths = git(sim.dir, ['show', '--name-only', '--pretty=format:', 'HEAD']);
    assert.ok(!headPaths.includes('research/delta.md'), 'peer topic path absent from the --topic commit');
    sim.run(['commit', wu, '-m', `research(${wu}): sweep delta dirt for the next steps`, '--topic', 'research/delta', '--sweep']);
    const reparked = send(sim, wu, 'research', 'delta', 'third-parked');
    assert.strictEqual(reparked.created, false);
    assert.strictEqual(reparked.status, 'unstarted');
    // A stub refuses the verbs that would bury or absorb never-worked messages
    // — as the source and as the absorbing --by target alike.
    sim.refuses(['topic', 'complete', wu, 'research', 'delta'], /unstarted/);
    sim.refuses(['topic', 'supersede', wu, 'research', 'delta', '--by', 'alpha'], /unstarted/);
    sim.refuses(['topic', 'supersede', wu, 'research', 'alpha', '--by', 'delta'], /cannot absorb/);
    // Landing on a completed discussion reopens it to receive the entry. The
    // drain's fold-into-existing branch: the message collides with a decided
    // subtopic, so the fold flips it back to exploring — re-arming the
    // conclusion gate — and the session re-decides before re-completing.
    const reopened = send(sim, wu, 'discussion', 'beta', 'retry-policy');
    assert.strictEqual(reopened.reopened, true);
    assert.strictEqual(reopened.status, 'in-progress');
    sim.refuses(['discussion-map', 'add', wu, 'beta', 'retry-policy'], /already exists/);
    const rearmed = sim.run(['discussion-map', 'set', wu, 'beta', 'retry-policy', 'exploring']);
    assert.strictEqual(rearmed.all_decided, false, 'the fold re-arms the conclusion gate');
    const redecided = sim.run(['discussion-map', 'set', wu, 'beta', 'retry-policy', 'decided']);
    assert.strictEqual(redecided.all_decided, true);
    // Research feeds discussion. The earlier research-side landing left a
    // parked stub beneath beta, and its flag rode the reopen until the
    // session's re-entry cleared it (prose-owned — simulated here). A fresh
    // research-side landing beneath the discussion now in flight flags it
    // again: the hop out of research reaches a live discussion, not only a
    // decided one.
    sim.run(['manifest', 'delete', `${wu}.discussion.beta`, 'reconcile_needed']);
    sim.write('.leeway/.cache/scratch/message-scratch.md', '### Cost model\n*From: alpha · discussion · 2026-07-23*\n\nWhat does it cost?\n');
    const landedLive = sim.run(['topic', 'send', wu, 'research', 'beta',
      '--content', '.leeway/.cache/scratch/message-scratch.md', '--slug', 'cost-model',
      '-m', `discussion(${wu}/alpha): send message to beta`]);
    assert.strictEqual(landedLive.reconcile_flagged, true, 'the hop out of research flags the discussion in flight');
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.beta.reconcile_needed, 'research');
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.beta.status, 'in-progress');
    // The parked stub is a wait the discussion cannot conclude over — derived
    // from the stub's status, never stored. The refusal names it, the wait
    // gate is its graceful face, and the epic menu's row for beta is its
    // research row — the discussion is held at entry, not offered.
    sim.refuses(['topic', 'complete', wu, 'discussion', 'beta'],
      /awaits research on the topic — conclude the research to release the wait/);
    const waitGate = sim.render(['wait-gate', `${wu}.discussion.beta`], { expect: 'content' });
    assert.match(waitGate, /Conclusion blocked — this discussion awaits research on "Beta" \(parked — not yet started\)/);
    // The pause runs the in-flight check, then hands off to the epic menu,
    // whose banner names the paused conversation by topic.
    assert.deepStrictEqual(pauseCheck(sim, wu, 'discussion', 'beta'), []);
    assert.match(arriveAtEpicMenu(sim, wu, 'discussion', 'paused'),
      /"Beta" awaits research on the topic \(parked — not yet started\)\./);
    const betaRows = epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys
      .filter((k) => k.topic === 'beta').map((k) => k.action);
    assert.deepStrictEqual(betaRows, ['start_research'], 'the research row is the topic\'s own');
    assert.strictEqual(sim.run(['topic', 'start', wu, 'discussion', 'beta']).created, false, 'the session inside resumes');
    assert.match(sim.render(['entry-gate', `${wu}.discussion.beta`], { expect: 'content' }),
      /Entry blocked — this discussion awaits research on "Beta" \(parked — not yet started\)/);
    assert.match(epicDashboard(wu, EPIC_GATEWAY.discover(sim.dir, wu)).replace(/\n[ │]+/g, ' '),
      /Discussing · awaiting research · mail waiting · input moved/);
    // The research row is the way in: the stub starts (the birth guard's
    // allowance), the gate reads the research in flight, the waiting message
    // folds, the research lands — and the wait releases.
    const started = sim.run(['topic', 'start', wu, 'research', 'beta']);
    assert.strictEqual(started.created, false);
    assert.match(sim.render(['wait-gate', `${wu}.discussion.beta`], { expect: 'content' }), /awaits research on "Beta" \(in flight\)/);
    const landedFile = path.basename(landedLive.message_path);
    sim.run(['topic', 'absorb', wu, 'research', 'beta',
      '--file', landedFile, '-m', `research(${wu}/beta): absorb ${landedFile} (from alpha)`]);
    sim.write(`.leeway/${wu}/research/beta.md`, '# Research — Beta\n\nThe cost model.\n');
    sim.run(['commit', wu, '-m', `research(${wu}): beta`, '--topic', 'research/beta']);
    sim.run(['topic', 'complete', wu, 'research', 'beta']);
    sim.render(['wait-gate', `${wu}.discussion.beta`], { expect: 'empty' });
    sim.render(['entry-gate', `${wu}.discussion.beta`], { expect: 'empty' });
    // The landed research is read — at re-entry, or at the session's next
    // check — and the read clears the flag (prose-owned — simulated here);
    // the completion refuses until it does, then the discussion concludes.
    sim.refuses(['topic', 'complete', wu, 'discussion', 'beta'], /carries reconcile_needed: research/);
    sim.run(['manifest', 'delete', `${wu}.discussion.beta`, 'reconcile_needed']);
    sim.run(['topic', 'complete', wu, 'discussion', 'beta']);

    // The topic's cancel/reactivate round-trips the stub; start is the one
    // exit from unstarted.
    sim.run(['topic', 'cancel', wu, 'discovery', 'delta']);
    assert.strictEqual(sim.manifest(wu).phases.research.items.delta.previous_status, 'unstarted');
    sim.run(['topic', 'reactivate', wu, 'discovery', 'delta']);
    assert.strictEqual(sim.manifest(wu).phases.research.items.delta.status, 'unstarted');
    // A parked research stub starts from its menu row — the r door refuses
    // it like any mapped name, the discussion side of the same name too.
    sim.render(['direct-entry-gate', `${wu}.research.delta`], { expect: 'content' });
    sim.render(['direct-entry-gate', `${wu}.discussion.delta`], { expect: 'content' });
    const drained = sim.run(['topic', 'start', wu, 'research', 'delta']);
    assert.strictEqual(drained.status, 'in-progress');
    assert.strictEqual(drained.created, false);
    sim.write(`.leeway/${wu}/research/delta.md`, '# Research — Delta\n\nDrained the parked message.\n');
    sim.run(['commit', wu, '-m', `research(${wu}): delta`, '--topic', 'research/delta']);
    // The session drains the mailbox before it concludes — a dead end never
    // buries a message.
    for (const waiting of sim.run(['topic', 'mailbox', wu, 'research', 'delta']).files.map((f) => path.basename(f))) {
      sim.run(['topic', 'absorb', wu, 'research', 'delta',
        '--file', waiting, '-m', `research(${wu}/delta): absorb ${waiting} (from alpha)`]);
    }
    sim.run(['topic', 'complete', wu, 'research', 'delta']);

    // Dead end: the conclude gate's second arm marks the map item, and the
    // research still completes and indexes as normal. The marker is the whole
    // move — the record is untouched — and it is reversible both ways.
    const deadEnd = sim.run(['discovery-map', 'handle', wu, 'delta']);
    assert.strictEqual(deadEnd.handled, true);
    assert.strictEqual(deadEnd.lifecycle, 'handled');
    assert.strictEqual(sim.manifest(wu).phases.discovery.items.delta.handled, true);
    assert.strictEqual(sim.manifest(wu).phases.research.items.delta.status, 'completed',
      'the dead-end marker leaves the research record alone');
    // A send aimed at the closed topic stops at the gate — the surface
    // derives the closure from the same join the marker wrote.
    assert.match(sim.render(['send-closed-target', `${wu}.discovery.delta`], { expect: 'content' }),
      /"delta" is closed as a dead end, so it won't pick up messages\./);
    sim.refuses(['discovery-map', 'handle', wu, 'delta'],
      /"delta" can't be closed as a dead end — it's already closed/);
    const reopenedMap = sim.run(['discovery-map', 'unhandle', wu, 'delta']);
    assert.strictEqual(reopenedMap.handled, false);
    assert.strictEqual(reopenedMap.lifecycle, 'ready_for_discussion',
      'reopening returns the topic to its name-matched lifecycle');
    assert.strictEqual(sim.manifest(wu).phases.discovery.items.delta.handled, undefined);
    sim.refuses(['discovery-map', 'unhandle', wu, 'delta'],
      /"delta" can't be reopened — it isn't closed as a dead end, so there's nothing to reopen/);

    // Grouping: alpha and beta unify into one spec; sources gate, then the
    // per-topic spec items are superseded by the unified one. The menu's
    // specification row carries no route and never meets the soft gate —
    // the menu runs the grouping itself, and the handoff refuses an epic's
    // specification without its topic. It reads the scenario, asks before
    // the analysis, and the map's provenance recovery has its own two stops
    // (summary-backfill B and D).
    assert.strictEqual(epicKey(sim, wu, 'analyze_discussions').route, null);
    sim.refuses(['render', 'epic-soft-gate', wu, '--action', 'analyze_discussions'], /unknown --action "analyze_discussions"/);
    sim.refuses(['handoff', '/workflow-specification-process', 'epic', wu], /^an epic enters specification at a topic$/);
    assert.match(EPIC_GATEWAY.specScenario(sim.dir, wu), /^scenario: analyze$/m);
    assert.match(sim.render(['analysis-proceed-gate', wu], { expect: 'content' }),
      /^=== DISPLAY: analysis prompt [^\n]*\n> Your discussions will be analyzed for natural groupings[\s\S]*Proceed with analysis\?/);
    // Every row landed with its summary and no description: the batch shows
    // each summary it keeps, and no line of it is edited here.
    const summaries = sim.write(`.leeway/.cache/${wu}/discovery/summaries.json`, { summaries: {} });
    assert.match(sim.render(['summary-backfill-gate', wu, '--variant', 'batch', '--file', summaries], { expect: 'content' }),
      /Proposed summaries for 4 topic\(s\):[\s\S]*3\. Delta {2}\(research\)\n {7}Delta summary {2}\(already populated\)/);
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
    handoff(sim, `/workflow-specification-process epic ${wu} alpha`);
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
    handoff(sim, `/workflow-specification-process epic ${wu} unified`);
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
    const menuNow = () => require(path.join(ROOT, 'skills/workflow-engine/scripts/lib.cjs')).project.epicMenu(wu, epicDetailNow());
    let keys = menuNow().keys;
    assert.ok(!keys.some((k) => k.action === 'start_implementation' && k.topic === 'unified'),
      'a dep-blocked implementation start carries no menu row');
    assert.ok(keys.some((k) => k.action === 'unblock_plan'), 'the unblock option surfaces');
    const unblockView = require(path.join(ROOT, 'skills/workflow-engine/scripts/lib.cjs')).project.epicUnblockMenu(epicDetailNow());
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
    sim.run(['topic', 'complete', wu, 'discussion', 'beta']);
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
    const landedReopen = send(sim, wu, 'discussion', 'beta', 'late-call');
    assert.strictEqual(landedReopen.reopened, true);
    assert.strictEqual(landedReopen.reconcile_flagged, true);
    assert.deepStrictEqual(landedReopen.sources_staled, ['unified']);
    sim.run(['topic', 'complete', wu, 'discussion', 'beta']);
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
    // The specification's calls batch on the settled lane — gated it asks
    // once for the screen and offers the flip; under auto the same screen
    // lands as a display, the one gate that never stops.
    sim.write('.leeway/.cache/scratch/finding-batch.json', JSON.stringify({
      lane: 'settled',
      remaining: 0,
      items: [
        { title: 'A repeated field name resolves to its last occurrence', detail: 'The sweep table leans this way; first-wins also fits the record.' },
        { title: 'An empty bare value writes a newline', detail: 'The output contract leans this way; zero bytes also fits the record.' },
      ],
    }));
    const settledBatch = sim.render(['finding-batch', `${wu}.specification.unified`, '--file', '.leeway/.cache/scratch/finding-batch.json'], { expect: 'content' });
    assert.match(settledBatch, /DISPLAY: finding batch/, 'the settled lane renders its screen at a specification address');
    assert.match(settledBatch, /`◆ Document them\?`/, 'the batch asks the call lane\'s question');
    assert.match(settledBatch, /`a\/auto`/, 'the screen offers the flip that retires the rest');
    sim.write('.leeway/.cache/scratch/finding-batch-decide.json', JSON.stringify({
      lane: 'decide', items: [{ title: 'A', detail: 'a.' }],
    }));
    sim.refuses(['render', 'finding-batch', `${wu}.specification.unified`, '--file', '.leeway/.cache/scratch/finding-batch-decide.json'],
      /lane "decide" is not served at the specification phase/);
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
    // sweep (workflow-review-process/SKILL.md, restart step 4): the bank and
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
    sim.write('.leeway/.cache/scratch/message-scratch.md',
      '### Refund window\n*From: unified · specification · 2026-07-23*\n\nHow long can a refund be claimed?\n');
    sim.run(['discovery-map', 'add', wu, 'refund-window', 'discussion',
      '--summary', 'How long a refund can be claimed', '--source', 'message:unified']);
    const gapParked = sim.run(['topic', 'send', wu, 'discussion', 'refund-window',
      '--content', '.leeway/.cache/scratch/message-scratch.md', '--slug', 'refund-window',
      '-m', `spec(${wu}/unified): send the refund-window gap to its own topic`]);
    assert.strictEqual(gapParked.status, 'unstarted');
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
    sim.run(['topic', 'start', wu, 'discussion', 'refund-window']);
    assert.deepStrictEqual(blockedByGap(), [{ name: 'unified', by: ['refund-window'] }]);
    assert.match(sim.render(['entry-gate', `${wu}.specification.unified`], { expect: 'content' }),
      /Sources for "Unified" are not concluded: refund-window/);
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
    assert.match(dump, new RegExp(`^revisit_routes: /workflow-discussion-process feature ${wu}$`, 'm'));
    handoff(sim, `/workflow-discussion-process feature ${wu}`);
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

'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's feature scenarios: the whole pipeline from
// discovery to a completed review; the start menu's working set of inbox
// ideas seeding discovery; a discussion entered through `enter`, begun and
// then resumed by a later conversation; research started beneath a live
// discussion, and research reopened beneath one in session; review skipped at
// the next-phase gate, and a failed review reopening implementation; the
// implementation loop's fix and analysis cycles surviving a resume.
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
const BRIDGE = require(path.join(ROOT, 'skills/leeway-bridge/scripts/gateway.cjs'));
const { statePath } = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/state-root.cjs'));
const {
  Sim, sessionLog, handoffEntry, enterEntry, carryOn, handoff, decideTopic, bridgeTo, pauseCheck, linearPick, startKeys, startNew, workTheSet, walkDeliveryPhasesToImplementation, walkDeliveryPhases, literal,
} = require('./pipeline-world.cjs');

const { shellWords } = require('./pipeline-oracle.cjs');

describe('pipeline simulation: feature', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('feature: discovery → discussion → spec → plan → implement → review → complete', () => {
    const wu = 'pay';
    // The start menu's new-feature pick hands the work to discovery, whose
    // confirm creates the unit.
    startNew(sim, 'feature');
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Payments feature', '--session-log-file', log]);
    // Discovery's single-phase endpoint (first-phase-routing A): which of
    // research and discussion leans is the session's read, so it rides a
    // payload; having the choice at all is the work type's.
    const read = sim.write(`.leeway/.cache/${wu}/discovery/first-phase.json`,
      { read: "The shape's clear and the open questions are trade-offs — I'd start with discussion." });
    assert.match(sim.render(['first-phase-gate', wu, '--file', read], { expect: 'content' }),
      /\*\*`d\/discussion`\*\* → Ready to discuss and make decisions/);
    // Nothing completed and no review to skip: the bridge's gate renders
    // empty and the continuation goes straight to the handoff.
    sim.render(['next-phase-gate', wu, '--prev', 'experiment', '--next', 'discussion'], { expect: 'empty' });
    // Discovery's conclusion hands the work to the first phase it settled.
    handoff(sim, `/leeway-discussion-process feature ${wu}`);

    // First phase: discussion (topic = work unit for single-topic types).
    // The discussion fetches the research gate before any status read.
    handoffEntry(sim, wu, 'discussion', wu);
    sim.render(['entry-gate', `${wu}.discussion.${wu}`], { expect: 'empty' });
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write(`.leeway/${wu}/discussion/${wu}.md`, `# Discussion — ${wu}\n`);
    assert.match(sim.render(['step-opening', `${wu}.discussion.${wu}`, '--step', 'session'], { expect: 'content' }),
      /□ Discussion Session[\s\S]*> Discussion starting\./);
    sim.run(['commit', wu, '-m', `discussion(${wu}): capture`, '--topic', `discussion/${wu}`]);
    // The person answers their question, and the topic closes at the decided
    // screen: its yes lands Claude's product-record line, completes the topic
    // and hands it to the specification.
    const at = `${wu}.discussion.${wu}`;
    const person = { by: 'person', who_moved_whom: 'none' };
    const asked = sim.run(['ledger', 'ask', at], null, JSON.stringify({ ...person, text: 'Which card networks does checkout take?' })).id;
    const card = sim.run(['ledger', 'decide', at, '--answers', asked], null, JSON.stringify({ ...person, text: 'Visa and Mastercard.', why: 'Our acquirer takes those two.' })).id;
    const decided = decideTopic(sim, wu, wu, { lines: [{ text: 'Payments take Visa and Mastercard only.', why: 'The acquirer takes those two.', widens: card }], candidates: [] });
    assert.deepStrictEqual(decided.next, { kind: 'handoff', skill: 'leeway-specification-process', args: ['feature', wu] });
    assert.strictEqual(BRIDGE.discover(sim.dir, wu).next_phase, 'specification');
    // The completion indexed into a store, which every commit's audit in
    // `run` holds untracked from here on.
    assert.ok(fs.existsSync(statePath(sim.dir, KNOWLEDGE_DIR, 'store.bin')), 'the completion built the store');
    assert.match(sim.render(['knowledge-ready'], { expect: 'content' }), /^Knowledge base ready — keyword-only\.$/m);
    // The engine's own door reads back what the close indexed in process: the
    // records — the topic's, and the unit's own, which holds the line — and
    // the discussion beside them.
    assert.deepStrictEqual(sim.engine(['knowledge', 'check']), { stdout: 'ready\n', stderr: '', code: 0 });
    assert.match(sim.engine(['knowledge', 'status']).stdout, /^By phase:\n {2}record: 3\n {2}discussion: 1$/m);
    // A hop short of review carries no skip row — proceed or revisit.
    const hop = sim.render(['next-phase-gate', wu, '--prev', 'discussion', '--next', 'specification'], { expect: 'content' });
    assert.match(hop, /\*\*`y\/yes`\*\* +→ Proceed to specification/);
    assert.match(hop, /\*\*`r\/revisit`\*\* → Revisit an earlier phase/);
    assert.ok(!hop.includes('d/done'), hop);

    walkDeliveryPhases(sim, wu, wu, { sources: [wu] });

    // The bridge's one stop before review: proceed, complete without
    // review, or revisit — every earlier phase is completed, so all three.
    const gate = sim.render(['next-phase-gate', wu, '--prev', 'implementation', '--next', 'review'], { expect: 'content' });
    assert.match(gate, /\*\*`y\/yes`\*\* +→ Proceed to review/);
    assert.match(gate, /\*\*`d\/done`\*\* +→ Complete without review/);
    assert.match(gate, /\*\*`r\/revisit`\*\* → Revisit an earlier phase/);
    const done = sim.run(['workunit', 'complete', wu, '-m', `workflow(${wu}): pipeline complete`]);
    assert.strictEqual(done.status, 'completed');
    assert.strictEqual(sim.manifest(wu).status, 'completed');
    assert.match(sim.render(['workunit-receipt', wu, '--verb', 'complete', '--pipeline'], { expect: 'content' }),
      /Feature Completed/, 'pipeline completion renders the banner receipt');
    // A completed unit is the one state the corrigendum protocol edits — the
    // gate derives the spec path from the address it is given.
    const correctionScreen = sim.render(['correction-gate', `${wu}.specification.${wu}`], { expect: 'content' });
    assert.match(correctionScreen, new RegExp(`Correcting ${literal(path.join(sim.dir, `.leeway/${wu}/specification/${wu}/specification.md`))}\\.`));
    assert.match(correctionScreen, /`◆ Apply the correction protocol\?`/);
  });

  it('start: a working set of inbox ideas hands discovery its seeds, which the work-type commit lands', () => {
    const ideas = [
      sim.write('.leeway/.inbox/ideas/2026-01-01--saved-search-filters.md', '# Saved Search Filters\n'),
      sim.write('.leeway/.inbox/ideas/2026-01-01--filter-default-view.md', '# Filter Default View\n'),
    ];
    assert.ok(startKeys(sim).some((k) => k.action === 'view_inbox'), 'the start menu offers the inbox');
    // Ideas carry no work type, so discovery decides it.
    const route = `/leeway-discovery none none "${ideas.map((rel) => path.join(sim.dir, rel)).join(',')}"`;
    assert.strictEqual(workTheSet(sim, ideas).text, `Invoke \`${route}\`.`);
    // Discovery opens on the seeds before any work unit exists, naming them
    // from the inbox paths the route carries.
    sim.write('.leeway/.cache/discovery-opener.json', JSON.stringify({ sketch: 'Filters that persist.', question: 'Who saves one first?' }));
    assert.match(sim.render(['opener', '--variant', 'inbox', '--path', ideas.join(','), '--file', '.leeway/.cache/discovery-opener.json'], { expect: 'content' }),
      /I've read your 2 ideas\. Here's the shape I'm picking up:/);
    const wu = 'saved-filters';
    const created = sim.run(['workunit', 'create', wu, 'feature', '--description', 'Saved search filters',
      '--session-log-file', sessionLog(sim, wu), ...ideas.flatMap((seed) => ['--seed', seed])]);
    assert.deepStrictEqual(created.seeds.map((seed) => seed.source), ['inbox:idea', 'inbox:idea']);
    // The commit moved the seeds out of the inbox, and the handoff checks each
    // is still there — so it can only come first.
    sim.refuses(['handoff', ...shellWords(route)], /inbox file not found/);
  });

  it('feature: a discussion entered through `enter` — the first entry starts it on what discovery left, a later conversation resumes it on its record and its log', () => {
    const wu = 'filters';
    const keys = () => [...sim.sections.matchAll(/^([a-z ]+): /gm)].map((m) => m[1]);
    const header = () => /^log header: (.*)$/m.exec(sim.sections)?.[1];
    const log = `.leeway/${wu}/topics/${wu}/log.md`;
    startNew(sim, 'feature');
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

  it('feature: research started beneath the live discussion routes the continue to the research and holds the discussion shut', () => {
    const wu = 'ledger';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Ledger feature', '--session-log-file', log]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write(`.leeway/${wu}/discussion/${wu}.md`, `# Discussion — ${wu}\n`);
    sim.run(['commit', wu, '-m', `discussion(${wu}): capture`, '--topic', `discussion/${wu}`]);
    // Research started beneath the discussion: research feeds discussion —
    // the linear continue routes to it, and the discussion is held at entry
    // and at its conclusion alike, the entry gate naming the work unit's
    // next step. The session already inside resumes: the engine holds
    // births, not resumes.
    sim.run(['topic', 'start', wu, 'research', wu]);
    assert.strictEqual(BRIDGE.discover(sim.dir, wu).next_phase, 'research');
    assert.strictEqual(sim.run(['topic', 'start', wu, 'discussion', wu]).created, false);
    assert.match(sim.render(['entry-gate', `${wu}.discussion.${wu}`], { expect: 'content' }),
      /Entry blocked — this discussion awaits research on "Ledger" \(in flight\)[\s\S]*Continue the work unit — the research is its next step\./);
    sim.refuses(['topic', 'complete', wu, 'discussion', wu], /awaits research on the topic/);
    // The pause runs the in-flight check, then hands the session to the
    // bridge: its banner names what the unit's one
    // conversation awaits — the linear clause drops the topic name — and the
    // continuation routes to the research.
    assert.deepStrictEqual(pauseCheck(sim, wu, 'discussion', wu), []);
    assert.match(sim.render(['phase-paused', wu, '--phase', 'discussion'], { expect: 'content' }),
      /^=== DISPLAY: phase paused .*\nDiscussion paused for "Ledger" — awaiting research on the topic \(in flight\)\.\n$/);
    // The feature's continue menu proceeds to the research, handing off to it.
    assert.strictEqual(linearPick(sim, wu, 'continue').line, '→ Research · ledger');
    assert.match(sim.render(['step-opening', `${wu}.research.${wu}`, '--step', 'session'], { expect: 'content' }),
      /□ Research Session[\s\S]*> Starting the research session\./);
    assert.strictEqual(BRIDGE.discover(sim.dir, wu).next_phase, 'research');
    assert.match(sim.render(['entry-gate', `${wu}.discussion.${wu}`], { expect: 'content' }), /awaits research on "Ledger" \(in flight\)/);
    assert.match(sim.render(['phase-paused', wu, '--phase', 'discussion'], { expect: 'content' }),
      /awaiting research on the topic \(in flight\)\./);
    // The single-topic register keys on the work unit's own name; an open
    // thread is a fine way to conclude — the gate shows it and asks the same.
    sim.run(['research-threads', 'add', wu, wu, 'balance-rounding', '--question', 'Where does the ledger round a balance?', '--origin', 'seed']);
    sim.write(`.leeway/${wu}/research/${wu}.md`, `# Research — ${wu}\n`);
    sim.run(['commit', wu, '-m', `research(${wu}): open the question`, '--topic', `research/${wu}`]);
    assert.match(sim.render(['research-conclude-gate', `${wu}.research.${wu}`], { expect: 'content' }),
      /Research Threads — Ledger \(1 thread\)\n {2}└─ ○ Where does the ledger round a balance\?\s+\[seed\]\n=== MENU: research conclude gate/);
    sim.run(['topic', 'complete', wu, 'research', wu]);
    // Landed: the gates release and the discussion resumes. A pause banner
    // rendered over a wait a peer has since landed says only the bare truth.
    sim.render(['entry-gate', `${wu}.discussion.${wu}`], { expect: 'empty' });
    assert.match(sim.render(['phase-paused', wu, '--phase', 'discussion'], { expect: 'content' }),
      /\nDiscussion paused for "Ledger"\.\n$/);
    assert.strictEqual(BRIDGE.discover(sim.dir, wu).next_phase, 'discussion');
    assert.strictEqual(sim.run(['topic', 'start', wu, 'discussion', wu]).created, false);
    assert.match(sim.render(['step-opening', `${wu}.discussion.${wu}`, '--step', 'session', '--resumed'], { expect: 'content' }),
      /> Picking the discussion back up where the map leaves it\./, 'the session the research held picks back up');
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    // A concluded discussion is held the same way: its research reopened
    // beneath it, the discussion's reopen refuses until that research lands
    // again.
    sim.run(['topic', 'reopen', wu, 'research', wu]);
    sim.refuses(['topic', 'reopen', wu, 'discussion', wu],
      /discussion can't reopen on "ledger" — research is in flight on it; research feeds discussion, so it lands first — the menu names the way in/);
    assert.strictEqual(BRIDGE.discover(sim.dir, wu).next_phase, 'research');
    sim.write(`.leeway/${wu}/research/${wu}.md`, `# Research — ${wu}\n\nThe second question.\n`);
    sim.run(['commit', wu, '-m', `research(${wu}): the second question`, '--topic', `research/${wu}`]);
    sim.run(['topic', 'complete', wu, 'research', wu]);
    sim.run(['manifest', 'delete', `${wu}.discussion.${wu}`, 'reconcile_needed']);
    assert.strictEqual(sim.run(['topic', 'reopen', wu, 'discussion', wu]).status, 'in-progress');
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
  });

  it('feature: research landing beneath a discussion in session is read before the close — the completion refuses over the unread flag', () => {
    const wu = 'tally';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Tally feature', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['topic', 'start', wu, 'research', wu]);
    sim.write(`.leeway/${wu}/research/${wu}.md`, `# Research — ${wu}\n`);
    sim.run(['commit', wu, '-m', `research(${wu}): capture`, '--topic', `research/${wu}`]);
    sim.run(['topic', 'complete', wu, 'research', wu]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write(`.leeway/${wu}/discussion/${wu}.md`, `# Discussion — ${wu}\n`);
    sim.run(['commit', wu, '-m', `discussion(${wu}): capture`, '--topic', `discussion/${wu}`]);
    // A peer reopens the research beneath the discussion in session: the
    // discussion is flagged. While the research is outstanding the wait —
    // not the flag — holds the close, and the session's own check stays
    // silent.
    const peer = sim.session('peer-in-research', 1);
    assert.deepStrictEqual(peer.run(['topic', 'reopen', wu, 'research', wu]).reconcile_flagged, [{ phase: 'discussion', topic: wu }]);
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.discussion.${wu}`, 'reconcile_needed']), 'research');
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.research.${wu}`, 'status']), 'in-progress');
    sim.refuses(['topic', 'complete', wu, 'discussion', wu], /^discussion "tally" awaits research on the topic/);
    // The peer concludes the research: the wait releases, and the unread
    // flag is now what holds the close.
    sim.write(`.leeway/${wu}/research/${wu}.md`, `# Research — ${wu}\n\nRounds to the nearest unit.\n`);
    sim.run(['commit', wu, '-m', `research(${wu}): the rounding answer`, '--topic', `research/${wu}`]);
    sim.run(['topic', 'complete', wu, 'research', wu]);
    // The session's next check — the loop's break, or the close: the flag
    // reads `research`, the research item `completed`, so
    // the advisory reads the research file and clears the flag (prose-owned —
    // simulated here); until it does, the completion refuses.
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.discussion.${wu}`, 'reconcile_needed']), 'research');
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.research.${wu}`, 'status']), 'completed');
    sim.refuses(['topic', 'complete', wu, 'discussion', wu],
      /^discussion "tally" carries reconcile_needed: research — the topic's research landed beneath this conversation; read what landed into the session and clear the flag before concluding$/);
    sim.run(['manifest', 'delete', `${wu}.discussion.${wu}`, 'reconcile_needed']);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    assert.strictEqual(BRIDGE.discover(sim.dir, wu).next_phase, 'specification');
  });

  it('feature: review skipped at the next-phase gate', () => {
    const wu = 'quick-ship';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Ship it', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    walkDeliveryPhasesToImplementation(sim, wu, wu);
    assert.match(sim.render(['next-phase-gate', wu, '--prev', 'implementation', '--next', 'review'], { expect: 'content' }),
      /Complete without review/, 'the review hop offers the skip');
    sim.run(['workunit', 'complete', wu, '-m', `workflow(${wu}): complete feature pipeline (review skipped)`]);
    assert.strictEqual(sim.manifest(wu).status, 'completed');
    assert.match(sim.render(['workunit-receipt', wu, '--verb', 'complete', '--pipeline', '--skipped-review'], { expect: 'content' }),
      /review skipped/, 'skipped-review completion renders its banner');
  });

  it('feature: a failed review re-opens implementation and hands off to it', () => {
    const wu = 'patch-up';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Patch it up', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    walkDeliveryPhasesToImplementation(sim, wu, wu);
    bridgeTo(sim, wu, 'review');
    handoffEntry(sim, wu, 'review', wu);
    sim.run(['topic', 'start', wu, 'review', wu]);
    // The fail arm (review-actions-loop G): the approved remediation is in
    // the plan, implementation re-opens, and the review hands off to it —
    // the topic named for every type, nothing carried but the arguments.
    sim.run(['manifest', 'set', `${wu}.review.${wu}`, 'staging.c1.gate_mode=gated', 'staging.c1.tasks.1=approved']);
    sim.run(['topic', 'reopen', wu, 'implementation', wu]);
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'updated', '2026-07-23']);
    sim.run(['commit', wu, '-m', `review(${wu}): re-open implementation tracking`, '--topic', `review/${wu}`]);
    assert.strictEqual(sim.read(['manifest', 'get', wu, 'work_type']), 'feature');
    const carried = handoff(sim, `/leeway-implementation-process feature ${wu} ${wu}`);
    assert.strictEqual(carried.line, `→ Implementation · ${wu}`);
    assert.strictEqual(sim.manifest(wu).phases.review.items[wu].status, 'in-progress', 'the review stays open for the next cycle');
  });

  it('implementation loop: fix cycles, analysis cycles, and gate-mode bookkeeping survive resume', () => {
    const wu = 'loop';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Task loop', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    sim.run(['topic', 'start', wu, 'specification', wu]);
    sim.run(['topic', 'complete', wu, 'specification', wu]);
    sim.run(['topic', 'start', wu, 'planning', wu]);
    sim.run(['manifest', 'set', `${wu}.planning.${wu}`,
      'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
      'finding_gate_mode=gated', 'review_cycle=0', 'phase=1', 'task=~',
      `task_map.${wu}-1-1=${wu}-1-1`, `task_map.${wu}-1-2=${wu}-1-2`, 'storage_paths=[]']);
    sim.run(['topic', 'complete', wu, 'planning', wu]);

    // No `topic start` — task init creates, per implementation-process Step 0.
    const init = sim.run(['task', 'init', wu, wu]);
    assert.strictEqual(init.mode, 'created', 'fresh implementation takes the created arm');
    assert.strictEqual(init.gates.task_gate_mode, 'gated');
    assert.strictEqual(init.gates.consolidation_gate_mode, 'gated', 'the boundary walk gate ships gated');
    // The setup steps (project-skills-discovery.md, linter-setup.md) read the
    // topic's answers: task init leaves both absent, so a fresh topic is asked.
    // A confirmed empty set — here the skip-again gate's `yes` — is stored as
    // [] and answers every later session.
    for (const field of ['project_skills', 'linters']) {
      assert.strictEqual(sim.read(['manifest', 'get', `${wu}.implementation.${wu}`, field]), '',
        `task init leaves ${field} absent — never asked`);
      sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, field, '[]']);
    }
    sim.run(['commit', wu, '-m', `impl(${wu}): start implementation`, '--topic', `implementation/${wu}`]);
    const firstStart = sim.run(['task', 'start', wu, wu, `${wu}-1-1`]);
    assert.strictEqual(firstStart.mode, 'started', 'a task taken up fresh dispatches the executor');
    assert.strictEqual(firstStart.do_banking, true, 'a plan task before any boundary banks — its phase is still taking deposits');
    // The brief announces the dispatch — the shared task header plus summary and watch.
    const briefPayload = sim.write(`.leeway/.cache/${wu}/implementation/${wu}/task-brief.json`,
      { id: `${wu}-1-1`, title: 'Wire the auth entry point', current: 1, total: 2, phase: '1 — Core', position: '1 of 2 in phase', summary: 'Wire the auth entry point.', watch: ['the login redirect'] });
    const brief = sim.render(['task-brief', `${wu}.implementation.${wu}`, '--file', briefPayload], { expect: 'content' });
    assert.match(brief, /DISPLAY: task brief/, 'pre-dispatch brief renders its section');
    assert.match(brief, /^\*\*`▪ Wire the auth entry point \(1 of 2\)`\*\*$/m,
      'the brief heads itself with the task marker — no prose-authored title above the call');
    assert.match(brief, /\*\*Watch\*\*:\n- the login redirect/, 'the brief carries its watch list');
    // Gates are fetched at their own stage — the task verbs answer with pure JSON.
    assert.match(sim.render(['task-gate', `${wu}.implementation.${wu}`], { expect: 'content' }),
      /MENU: task gate/, 'gated task gate renders its menu');
    const blockedPayload = sim.write(`.leeway/.cache/${wu}/implementation/${wu}/blocked-tasks.json`,
      { tasks: [{ id: `${wu}-1-2`, name: 'Expire idle sessions', blockers: [{ id: `${wu}-1-1`, status: 'in-progress' }] }] });
    assert.match(sim.render(['blocked-tasks', `${wu}.implementation.${wu}`, '--file', blockedPayload], { expect: 'content' }),
      /1 task is still open[\s\S]*MENU: blocked tasks/, 'blocked-tasks stop renders the open tasks above its menu');
    const findings = sim.write(`.leeway/.cache/${wu}/implementation/${wu}/findings.json`,
      { findings: [{ title: 'Loose end', severity: 'minor' }] });
    sim.run(['task', 'fix-attempt', wu, wu, `${wu}-1-1`, '--findings-file', findings]);
    assert.ok(fs.existsSync(path.join(sim.dir, '.leeway', wu, 'implementation', wu, `fix-tracking-${wu}-1-1.md`)),
      'fix history is committed history, not purgeable cache');
    assert.match(sim.render(['fix-gate', `${wu}.implementation.${wu}`], { expect: 'content' }),
      /MENU: fix gate/, 'gated fix gate renders its menu');
    // A fresh session opening on this task: `task init` resumes the item and
    // `task start` re-runs over the in-flight pair. The `resumed` mode is what
    // routes stage A to the pending fix gate instead of dispatching an
    // executor blind to findings the user has never answered.
    assert.strictEqual(sim.run(['task', 'init', wu, wu]).counters.fix_attempts, 1,
      'the in-flight pair survives the session reset');
    for (const field of ['project_skills', 'linters']) {
      assert.strictEqual(sim.read(['manifest', 'get', `${wu}.implementation.${wu}`, field]), '[]',
        `the resume keeps the confirmed empty ${field} — setup returns without asking`);
    }
    const resumedStart = sim.run(['task', 'start', wu, wu, `${wu}-1-1`]);
    assert.strictEqual(resumedStart.mode, 'resumed', 'restarting the in-flight task reports the resume');
    assert.strictEqual(resumedStart.do_banking, true, 'the resume answers the banking question too');
    assert.strictEqual(sim.manifest(wu).phases.implementation.items[wu].fix_attempts, 1,
      'the resume leaves the attempt count untouched');
    // The result header is one surface for every presentation moment.
    const resultPayload = sim.write(`.leeway/.cache/${wu}/implementation/${wu}/task-result.json`,
      { id: `${wu}-1-1`, title: 'Wire the auth entry point', current: 1, total: 2, phase: '1 — Core', position: '1 of 2 in phase' });
    assert.match(sim.render(['task-result', `${wu}.implementation.${wu}`, '--file', resultPayload, '--result', 'blocked'], { expect: 'content' }),
      /\*\*`▪ Wire the auth entry point \(1 of 2\)`\*\*\n\n\*\*⚑ Blocked\*\* — \*the executor stopped before completing this task\*/,
      'an executor block renders the marker above the alert verdict');
    assert.match(sim.render(['task-result', `${wu}.implementation.${wu}`, '--file', resultPayload, '--result', 'needs-changes'], { expect: 'content' }),
      /\*\*◐ Needs changes\*\* — \*attempt 1, escalates at 3\*/, 'below-threshold needs-changes renders the calm verdict');
    // Two more attempts reach the fix threshold — the verdict names it.
    sim.run(['task', 'fix-attempt', wu, wu, `${wu}-1-1`, '--findings-file', findings]);
    sim.run(['task', 'fix-attempt', wu, wu, `${wu}-1-1`, '--findings-file', findings]);
    assert.match(sim.render(['task-result', `${wu}.implementation.${wu}`, '--file', resultPayload, '--result', 'needs-changes'], { expect: 'content' }),
      /\*\*◐ Needs changes\*\* — \*attempt 3, escalation threshold reached\*/,
      'threshold-forced needs-changes names the reached threshold');
    assert.match(sim.render(['task-result', `${wu}.implementation.${wu}`, '--file', resultPayload, '--result', 'approved'], { expect: 'content' }),
      /\*\*✓ Approved\*\* — \*after 3 needs-changes rounds\*/, 'approval names the needs-changes round count');
    assert.match(sim.render(['fix-gate', `${wu}.implementation.${wu}`], { expect: 'content' }),
      /MENU: fix gate/, 'threshold-forced fix gate renders its menu');
    sim.run(['task', 'complete', wu, wu, `${wu}-1-1`, '--phase', '1', '--next-task', `${wu}-1-2`]);

    // Auto gates render a continuation artifact — the loop never ends a turn by
    // silence. The task gate takes the phase-bounded opt-in (`b/bounded`), the
    // fix gate the full one (`a/auto`): both render the same continuation, and
    // only the phase record below tells them apart.
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'task_gate_mode=bounded', 'fix_gate_mode=auto']);
    assert.strictEqual(sim.run(['task', 'start', wu, wu, `${wu}-1-2`]).do_banking, true,
      'the phase is still open — its next plan task banks too');
    // Every task start gets its brief; the stale first-task payload refuses, the rewritten one renders.
    const staleBrief = sim.engine(['render', 'task-brief', `${wu}.implementation.${wu}`, '--file', briefPayload]);
    assert.strictEqual(staleBrief.code, 1, 'a stale brief payload refuses rather than rendering the previous task');
    assert.match(staleBrief.stderr, /stale task-brief\.json/, "the refusal names the previous task's payload as stale");
    const briefPayload2 = sim.write(`.leeway/.cache/${wu}/implementation/${wu}/task-brief.json`,
      { id: `${wu}-1-2`, title: 'Close out the auth flow', current: 2, total: 2, phase: '1 — Core', position: '2 of 2 in phase', external: { label: 'tick', id: 'TCK-2' }, summary: 'Close out the auth flow.' });
    assert.match(sim.render(['task-brief', `${wu}.implementation.${wu}`, '--file', briefPayload2], { expect: 'content' }),
      new RegExp(`\\*\\*Id\\*\\*: \`${wu}-1-2\` · tick \`TCK-2\``), 'the brief carries the format display identifier');
    // The result payload is rewritten per task — the header refuses the previous task's id.
    const resultPayload2 = sim.write(`.leeway/.cache/${wu}/implementation/${wu}/task-result.json`,
      { id: `${wu}-1-2`, title: 'Close out the auth flow', current: 2, total: 2, phase: '1 — Core', position: '2 of 2 in phase' });
    assert.match(sim.render(['task-result', `${wu}.implementation.${wu}`, '--file', resultPayload2, '--result', 'approved'], { expect: 'content' }),
      /\*\*✓ Approved\*\*\n/, 'a clean task renders the bare approved verdict');
    const taskGate = sim.render(['task-gate', `${wu}.implementation.${wu}`], { expect: 'content' });
    assert.match(taskGate, /DISPLAY: task gate auto-approved/, 'auto task gate renders its continuation line');
    assert.match(taskGate, /approved \[auto\]\. Committing and moving to the next task\./,
      'continuation line names the action that follows');
    sim.run(['task', 'fix-attempt', wu, wu, `${wu}-1-2`, '--findings-file', findings]);
    const fixGate = sim.render(['fix-gate', `${wu}.implementation.${wu}`], { expect: 'content' });
    assert.match(fixGate, /DISPLAY: fix gate auto-accepted/, 'auto fix gate renders its continuation line');
    assert.match(fixGate, /accepted \[auto\]\. Passing the findings to the executor\./,
      'continuation line names the dispatch that follows');
    // Phase 1's boundary: tasks done, the pass owed — the completion defers
    // its flag (task-loop H `boundary` disposition), the pass stages a
    // consolidation task in the still-open phase (consolidation-pass.md B–E),
    // and the phase records once it lands.
    const bankEntry = `{"task":"${wu}-1-2","source":"reviewer","summary":"near-miss helpers","failure":"a gateway shape change handled at one site and missed at the other — an order paid and never marked paid","detail":"src/x.js:3 vs src/y.js:9","files":["src/x.js","src/y.js"]}`;
    sim.run(['manifest', 'push', `${wu}.implementation.${wu}`, 'bank', bankEntry]);
    const boundary = sim.run(['task', 'complete', wu, wu, `${wu}-1-2`, '--phase', '1', '--next-task', '~']);
    assert.strictEqual(boundary.recorded.gates_reset, undefined, 'the deferred completion is not the phase\'s close');
    assert.strictEqual(sim.manifest(wu).phases.implementation.items[wu].task_gate_mode, 'bounded',
      'bounded auto holds while the phase stays open for the consolidation pass');
    // B's spec-defect settle, before any proposal is staged: a record-settled
    // correction lands on the same unit's concluded spec — in-place edit +
    // corrigendum, re-index through the engine's knowledge door — then the
    // same-unit route's scoped commit (--sweep leaves the spec topic's
    // presence untouched), with the work unit still in-progress and
    // implementation live.
    const correctedSpec = `.leeway/${wu}/specification/${wu}/specification.md`;
    sim.write(correctedSpec,
      `# Spec — ${wu}\n\n## Corrigenda\n\n> **Corrigendum 2026-01-01** (from \`implementation/${wu}\`): "intent.js" — corrected: payment-intent.js.\n`);
    const reindex = sim.engine(['knowledge', 'index', correctedSpec]);
    assert.strictEqual(reindex.code, 0, reindex.stderr);
    assert.match(reindex.stdout, new RegExp(`^Indexed \\d+ chunks from ${literal(path.join(sim.dir, correctedSpec))}\\n$`));
    sim.run(['commit', wu, '-m', `specification(${wu}): corrigendum from implementation/${wu}`,
      '--topic', `specification/${wu}`, '--sweep']);
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`,
      'staging.p1.tasks.1=pending', 'staging.p1.tasks.2=pending', 'staging.p1.tasks.3=pending']);
    sim.refuses(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.p1.tasks.1', 'perhaps'], /Invalid staging task status/);
    const overviewPayload = sim.write(`.leeway/.cache/${wu}/implementation/${wu}/tasks-overview.json`,
      { label: 'Phase 1 consolidation', tasks: [
        { title: 'Merge the near-miss helpers', severity: 'near-miss', status: 'pending' },
        { title: 'Drop the dead formatter', severity: 'dead-code', status: 'pending' },
        { title: 'Settle the page size', severity: 'behaviour', status: 'pending' },
      ] });
    assert.match(sim.render(['tasks-overview', `${wu}.implementation.${wu}`, '--file', overviewPayload], { expect: 'content' }),
      /Phase 1 consolidation/, 'the boundary walk renders the shared overview surface');
    // One payload file, rewritten per item — the walk's three shapes over it:
    // a proposal carrying its outcome, a bare proposal (no outcome), and a
    // proposal carrying an open decision.
    const consolidationPayload = sim.write(`.leeway/.cache/${wu}/implementation/${wu}/proposed-task.json`, {
      current: 1, total: 3, title: 'Merge the near-miss helpers', severity: 'near-miss',
      placement: 'phase 1', problem: 'p', solution: 's', outcome: 'o',
    });
    const outcomeGate = sim.render(['proposed-task', `${wu}.implementation.${wu}`,
      '--file', consolidationPayload, '--gate', 'gated', '--comment-hint', 'Provide feedback to adjust'], { expect: 'content' });
    assert.match(outcomeGate, /Placement: phase 1/, 'the boundary walk renders the shared per-task surface');
    assert.match(outcomeGate, /\*\*Outcome\*\*: o/, 'a proposal may carry its outcome');
    assert.ok(!/\*\*Do\*\*:|\*\*Acceptance Criteria\*\*:/.test(outcomeGate),
      'the boundary walk never renders authored blocks');
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.p1.tasks.1', 'approved']);
    sim.write(`.leeway/.cache/${wu}/implementation/${wu}/proposed-task.json`, {
      current: 2, total: 3, title: 'Drop the dead formatter', severity: 'dead-code',
      placement: 'phase 1', problem: 'p', solution: 's',
    });
    const proposalGate = sim.render(['proposed-task', `${wu}.implementation.${wu}`,
      '--file', consolidationPayload, '--gate', 'gated', '--comment-hint', 'Provide feedback to adjust'], { expect: 'content' });
    assert.match(proposalGate, /MENU: task approval/, 'a proposal keeps the walk\'s approval gate');
    assert.ok(!/\*\*Do\*\*:|\*\*Acceptance Criteria\*\*:|\*\*Outcome\*\*|t\/technical/.test(proposalGate),
      'proposal altitude renders only what the payload carries');
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.p1.tasks.2', 'skipped']);
    sim.write(`.leeway/.cache/${wu}/implementation/${wu}/proposed-task.json`, {
      current: 3, total: 3, title: 'Settle the page size', severity: 'behaviour',
      placement: 'phase 1', problem: 'p', solution: 's',
      decision: { question: 'Which page size stands?', options: ['A4 on the renderer', 'preferCssPageSize'] },
    });
    // A decision without its stakes never renders — the argument for the stop
    // is part of the payload contract.
    sim.refuses(['render', 'proposed-task', `${wu}.implementation.${wu}`,
      '--file', consolidationPayload, '--gate', 'auto'],
      /"stakes" must be a non-empty string when "decision" is present/);
    sim.write(`.leeway/.cache/${wu}/implementation/${wu}/proposed-task.json`, {
      current: 3, total: 3, title: 'Settle the page size', severity: 'behaviour',
      placement: 'phase 1', problem: 'p', solution: 's',
      stakes: 'Each side changes the shipped output; no measurement picks between them.',
      decision: { question: 'Which page size stands?', options: [
        'A4 on the renderer', { summary: 'preferCssPageSize', recommended: true },
      ] },
    });
    const decisionGate = sim.render(['proposed-task', `${wu}.implementation.${wu}`,
      '--file', consolidationPayload, '--gate', 'auto', '--comment-hint', 'Provide feedback to adjust'], { expect: 'content' });
    assert.match(decisionGate, /MENU: task decision/, 'an open decision stops the walk even under auto');
    assert.match(decisionGate, /\*\*Decision\*\*: Which page size stands\?/, 'the question is the menu\'s statement label, never the glyphed chrome');
    assert.ok(!/\*\*Problem\*\*|\*\*Solution\*\*|\*\*Stakes\*\*/.test(decisionGate),
      'the staged record never renders — the session composes the raise between the two emissions');
    assert.match(decisionGate, /Auto is on — stopping anyway/, 'the stop over the auto opt-in announces itself');
    assert.match(decisionGate, /\*\*`1`\*\* +→ preferCssPageSize \(recommended\)/, 'the recommended side orders first with its suffix');
    assert.match(decisionGate, /\*\*`2`\*\* +→ A4 on the renderer/, 'the sides are the menu options');
    assert.match(decisionGate, /t\/technical/, 'the technical arm reaches the staged record');
    assert.ok(!/a\/auto|DISPLAY: task auto-approved/.test(decisionGate),
      'approving a decision blind is not one of the calls auto makes');
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.p1.tasks.3', 'skipped']);
    // The pass marks itself landed before the plan write — a crash after this
    // point resumes at task creation, never a re-sweep.
    sim.run(['manifest', 'push', `${wu}.implementation.${wu}`, 'consolidated_phases', '1']);
    sim.run(['manifest', 'set', `${wu}.planning.${wu}`, `task_map.${wu}-1-3`, `${wu}-1-3`]);
    // The bank empties once the tasks exist in the plan — the whole field,
    // never an entry at a time (consolidation-pass.md E).
    sim.run(['manifest', 'delete', `${wu}.implementation.${wu}`, 'bank']);
    // The consolidation task runs through the ordinary loop; its completion
    // finds the phase consolidated and records it.
    const started = sim.run(['task', 'start', wu, wu, `${wu}-1-3`]);
    assert.strictEqual(started.gates.task_gate_mode, 'bounded', 'the consolidation task runs under the same bounded auto');
    assert.strictEqual(started.do_banking, false,
      'the consolidation task never banks — its phase has staged its walk and recorded the pass, and either closes the bank');
    assert.match(sim.render(['task-gate', `${wu}.implementation.${wu}`], { expect: 'content' }),
      /DISPLAY: task gate auto-approved/, 'a bounded task gate is an auto gate until the phase closes');
    const closed = sim.run(['task', 'complete', wu, wu, `${wu}-1-3`, '--phase', '1', '--next-task', '~', '--phase-complete']);
    assert.deepStrictEqual(closed.recorded.gates_reset, ['task_gate_mode'], 'the phase record names the bounded gate it returned to gated');
    const loopItem = sim.manifest(wu).phases.implementation.items[wu];
    assert.deepStrictEqual(loopItem.consolidated_phases, [1], 'the boundary marker survives');
    assert.deepStrictEqual(loopItem.completed_phases, [1], 'the phase records complete after consolidation');
    assert.strictEqual('bank' in loopItem, false, 'the boundary emptied the bank');
    assert.strictEqual(loopItem.task_gate_mode, 'gated', 'bounded ends with the phase — the next task\'s gate is a menu');
    assert.strictEqual(loopItem.fix_gate_mode, 'auto', 'full auto is the session\'s and outlives the phase');

    // The analysis loop's cycle gate (analysis-loop.md A): the record counts
    // the topic's lifetime — one counter, no per-session twin — and the
    // over-limit callout refuses while the count sits within the limit.
    const cycle = sim.run(['task', 'analysis-cycle', wu, wu]);
    assert.deepStrictEqual(cycle, { ok: true, cycle_total: 1, over_cycle_limit: false, analysis_gate_mode: 'gated' },
      'the cycle record answers the lifetime count and its verdict against the limit');
    assert.strictEqual('analysis_cycle_session' in sim.manifest(wu).phases.implementation.items[wu], false,
      'no session counter is ever written');
    sim.refuses(['render', 'cycle-limit', `${wu}.implementation.${wu}`], /within the cycle limit/);
    assert.match(sim.render(['cycle-gate'], { expect: 'content' }),
      /MENU: cycle gate/, 'cycle gate renders its menu');
    // The checkpoint reads the uncommitted code (analysis-loop.md B) — none,
    // so no gate — and the agents' scope is the topic's task commits
    // (invoke-analysis.md), none of which this loop's bookkeeping made.
    assert.deepStrictEqual(JSON.parse(sim.read(['code', 'status'])).files, [], 'no code is uncommitted — the checkpoint passes');
    assert.deepStrictEqual(JSON.parse(sim.read(['code', 'log', wu, wu])), { ok: true, commits: [], files: [], repos: [] },
      'a topic with no task commits has an empty scope');
    // An analysis cycle's staging walks the manifest; all-skipped is a legal exit.
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.c1.tasks.1=pending', 'staging.c1.tasks.2=pending']);
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.c1.tasks.1', 'skipped']);
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.c1.tasks.2', 'skipped']);

    // A second cycle stages a task the user approves, and the writer lands it
    // in a new analysis phase (analysis-loop.md H). That phase banks and takes
    // the boundary like any other — every phase but a quick-fix's does
    // (task-loop.md H, consolidation-pass.md).
    assert.strictEqual(sim.run(['task', 'analysis-cycle', wu, wu]).cycle_total, 2, 'the count carries across cycles');
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.c2.tasks.1', 'pending']);
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.c2.tasks.1', 'approved']);
    // The cycle's one-edit fixes fold into a single corrections proposal
    // (analysis-loop.md E, consolidation-pass.md B); its `corrections`
    // severity rides both shared surfaces like any class tag.
    const correctionsOverview = sim.write(`.leeway/.cache/${wu}/implementation/${wu}/tasks-overview.json`,
      { label: 'Analysis cycle 2', tasks: [{ title: 'Corrections', severity: 'corrections', status: 'approved' }] });
    assert.match(sim.render(['tasks-overview', `${wu}.implementation.${wu}`, '--file', correctionsOverview], { expect: 'content' }),
      /\[corrections\]/, 'the corrections bundle carries its severity as the worklist tag');
    const correctionsPayload = sim.write(`.leeway/.cache/${wu}/implementation/${wu}/proposed-task.json`, {
      current: 1, total: 1, title: 'Corrections', severity: 'corrections', sources: 'standards',
      problem: 'p', solution: 's',
    });
    assert.match(sim.render(['proposed-task', `${wu}.implementation.${wu}`, '--file', correctionsPayload, '--gate', 'gated'], { expect: 'content' }),
      /\*\*`▪ Corrections`\*\* \(corrections\)/, 'a corrections proposal renders its severity beside the head');
    sim.run(['manifest', 'set', `${wu}.planning.${wu}`, `task_map.${wu}-2-1`, `${wu}-2-1`]);
    const analysisTask = sim.run(['task', 'start', wu, wu, `${wu}-2-1`]);
    assert.strictEqual(analysisTask.mode, 'started', 'the analysis task is taken up fresh');
    assert.strictEqual(analysisTask.do_banking, true,
      'a task of an analysis phase banks — its own boundary drains the deposit');
    sim.run(['manifest', 'push', `${wu}.implementation.${wu}`, 'bank',
      `{"task":"${wu}-2-1","source":"executor","summary":"corrections helper duplicated","failure":"a rule change lands in one copy and not the other — the two callers disagree silently","detail":"src/a.js:12 mirrors src/b.js:40","files":["src/a.js","src/b.js"]}`]);
    // The analysis phase closes through its boundary like a plan phase: the
    // completion defers its flag; the pass reads the review item's staging as
    // its second settled-directions source — empty on a topic no review has
    // staged — and the sweep finds nothing; the bank empties, the boundary is
    // marked, and the re-record closes the phase (consolidation-pass.md F).
    sim.run(['task', 'complete', wu, wu, `${wu}-2-1`, '--phase', '2', '--next-task', '~']);
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.review.${wu}`, 'staging']).trim(), '',
      'a topic with no review item prints an empty review staging');
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.implementation.${wu}`, 'bank']).trim(), 'true');
    sim.run(['manifest', 'delete', `${wu}.implementation.${wu}`, 'bank']);
    sim.run(['manifest', 'push', `${wu}.implementation.${wu}`, 'consolidated_phases', '2']);
    sim.run(['task', 'complete', wu, wu, `${wu}-2-1`, '--phase', '2', '--phase-complete']);
    const analysisItem = sim.manifest(wu).phases.implementation.items[wu];
    assert.deepStrictEqual(analysisItem.consolidated_phases, [1, 2], 'the analysis phase records its boundary');
    assert.deepStrictEqual(analysisItem.completed_phases, [1, 2], 'the analysis phase completes consolidated');
    assert.strictEqual('bank' in analysisItem, false, 'the boundary emptied the analysis phase\'s bank');
    // A plan phase added at the tail afterwards (ad-hoc-plan-changes.md) banks
    // too — every phase but a quick-fix's does, whatever the cycle count says.
    sim.run(['manifest', 'set', `${wu}.planning.${wu}`, `task_map.${wu}-3-1`, `${wu}-3-1`]);
    assert.strictEqual(sim.run(['task', 'start', wu, wu, `${wu}-3-1`]).do_banking, true,
      'a phase added after the analysis loop has run banks — the cycle count is never the switch');
    sim.run(['task', 'complete', wu, wu, `${wu}-3-1`, '--phase', '3', '--next-task', '~']);
    // From the fourth cycle the lifetime count trips the gate: the record says
    // so, and the over-limit callout renders (analysis-loop.md A).
    sim.run(['task', 'analysis-cycle', wu, wu]);
    assert.strictEqual(sim.run(['task', 'analysis-cycle', wu, wu]).over_cycle_limit, true,
      'the fourth cycle on the topic trips the lifetime limit');
    assert.match(sim.render(['cycle-limit', `${wu}.implementation.${wu}`], { expect: 'content' }),
      /Analysis cycle 4 on this topic — over the cycle limit of 3/, 'the callout names the lifetime count');

    // The ad hoc plan-changes gate stages under its own family key (ad-hoc-plan-changes.md E/F)
    // and renders the shared proposed-task surface without the synthesis-only fields.
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`,
      'staging.ad-hoc-1.gate_mode=gated', 'staging.ad-hoc-1.tasks.1=pending']);
    const adhocPayload = `.leeway/.cache/${wu}/implementation/${wu}/proposed-task.json`;
    fs.mkdirSync(path.dirname(path.join(sim.dir, adhocPayload)), { recursive: true });
    fs.writeFileSync(path.join(sim.dir, adhocPayload), JSON.stringify({
      current: 1, total: 1, title: 'Fix redirect', placement: 'phase 1', priority: '1',
      problem: 'p', solution: 's', outcome: 'o', steps: ['1. x'], criteria: ['- c'],
    }));
    const adhocGate = sim.render(['proposed-task', `${wu}.implementation.${wu}`,
      '--file', adhocPayload, '--gate', 'gated'], { expect: 'content' });
    assert.match(adhocGate, /Placement: phase 1/, 'ad hoc payload renders its placement line');
    assert.match(adhocGate, /MENU: task approval/, 'ad hoc gate carries the shared approval menu');
    assert.ok(!/Sources:/.test(adhocGate), 'absent synthesis fields render nothing');
    assert.match(adhocGate, /\*\*`▪ Fix redirect`\*\*/,
      'head takes the task-header marker idiom, ordinal omitted for a batch of one');
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.ad-hoc-1.tasks.1', 'approved']);

    // A resumed session resets gate modes to gated — the session is the outer
    // bound of both auto modes.
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'task_gate_mode=bounded', 'fix_gate_mode=auto']);
    const resumed = sim.run(['task', 'init', wu, wu]);
    assert.strictEqual(resumed.mode, 'resumed', 'second init is a genuine resume');
    assert.strictEqual(resumed.gates.task_gate_mode, 'gated', 'resume resets bounded to gated');
    assert.strictEqual(resumed.gates.fix_gate_mode, 'gated', 'resume resets auto to gated');
    assert.strictEqual(resumed.gates.consolidation_gate_mode, 'gated', 'the boundary gate resets with the session');
    assert.deepStrictEqual(resumed.counters, { fix_attempts: 0, analysis_cycle_total: 4 },
      'the resume leaves the lifetime cycle count alone — the limit outlives the session');
    const completed = sim.manifest(wu).phases.implementation.items[wu].completed_tasks;
    assert.deepStrictEqual([...completed].sort(), [`${wu}-1-1`, `${wu}-1-2`, `${wu}-1-3`, `${wu}-2-1`, `${wu}-3-1`],
      'completed_tasks carries each id once — the boundary re-record must not double-count');
  });
});

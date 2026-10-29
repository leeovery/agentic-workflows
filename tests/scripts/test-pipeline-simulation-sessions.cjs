'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's sessions: background agents from dispatch to
// incorporation; restarts committing in order; the migration gate's yes;
// boot's lost-state screen and the GitHub offer; and concurrent sessions
// whose interleaved commits stay confined.
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
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '../..');
const { KNOWLEDGE_DIR } = require(path.join(ROOT, 'skills/workflow-engine/scripts/kernel/knowledge/files.cjs'));
const { githubOffline, git, stateGit } = require('./engine-harness.cjs');
const { STATE_DIR_NAME, statePath } = require(path.join(ROOT, 'skills/workflow-engine/scripts/kernel/state-root.cjs'));
const { Sim, sessionLog, handoff } = require('./pipeline-world.cjs');

describe('pipeline simulation: sessions', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('background agents: dispatch → completion scan → ack → surface → incorporate', () => {
    const wu = 'agents';
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Agent lifecycle', '--session-log-file', sessionLog(sim, wu)]);
    const topics = sim.write(`.leeway/.cache/${wu}/discovery/topics.json`,
      [{ name: 'alpha', routing: 'research', summary: 'Alpha' }, { name: 'beta', routing: 'discussion', summary: 'Beta' }]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', topics]);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): two topics`]);

    // Research carries the deep dive alone: a review is refused on kind, and
    // the dive walks the store's lifecycle — nothing readable while it runs,
    // the report's existence its completion signal, a clean ack its close.
    // A traversal topic refuses at every verb — the colocation promise
    // depends on it.
    sim.run(['topic', 'start', wu, 'research', 'alpha']);
    sim.refuses(['agent', 'dispatch', wu, 'research', '../../../escape', '--kind', 'deep-dive', '--label', 'auth'], /Invalid topic/);
    sim.refuses(['agent', 'dispatch', wu, 'research', 'alpha', '--kind', 'review'],
      /research carries no review — the deep dive is the phase's instrument/);
    // The register thread the dive digs, marked as the fold prescribes.
    sim.run(['research-threads', 'add', wu, 'alpha', 'auth', '--question', 'How does auth land?', '--origin', 'user']);
    const dive = sim.run(['agent', 'dispatch', wu, 'research', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    assert.strictEqual(dive.id, 'deep-dive-001-auth');
    sim.run(['research-threads', 'set', wu, 'alpha', 'auth', 'digging']);
    let scan = sim.run(['agent', 'scan', wu, 'research', 'alpha']);
    assert.deepStrictEqual(scan.pending, [], 'nothing readable while the dive runs');
    sim.refuses(['agent', 'ack', wu, 'research', 'alpha', dive.id, '--clean'], /in-flight/);
    sim.write(dive.file, '# Nothing novel\n');
    scan = sim.run(['agent', 'scan', wu, 'research', 'alpha']);
    assert.deepStrictEqual(scan.pending.map((/** @type {any} */ r) => r.id), [dive.id]);
    // The fold: the thread learned, the row closed clean, an opened line a child thread under it.
    sim.run(['research-threads', 'set', wu, 'alpha', 'auth', 'learned']);
    const clean = sim.run(['agent', 'ack', wu, 'research', 'alpha', dive.id, '--clean']);
    assert.strictEqual(clean.status, 'incorporated');
    const opened = sim.run(['research-threads', 'add', wu, 'alpha', 'auth-refresh', '--question', 'How does a refresh land?', '--origin', 'deep-dive-001', '--parent', 'auth']);
    assert.strictEqual(opened.parent, 'auth');
    sim.write(`.leeway/${wu}/research/alpha.md`, '# Research — Alpha\n');
    sim.run(['topic', 'complete', wu, 'research', 'alpha']);

    // The review's surfacing lifecycle, in the phase that carries it: no file
    // exists until the sub-agent writes one; the report lands, the row
    // promotes, and its findings drain by walk, by skip-all, by lane, and by
    // screen. The rows past the first ride --final — a review the user asked
    // for — so the map need not move between them; the movement gate is the
    // epic mainline's to pin.
    sim.run(['topic', 'start', wu, 'discussion', 'beta']);
    sim.render(['opener', `${wu}.discussion.beta`, '--variant', 'discussion'], { expect: 'content' });
    const review = sim.run(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review']);
    scan = sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    assert.deepStrictEqual(scan.pending, [], 'nothing readable while the review runs');
    sim.write(review.file, '# Review findings\n\n## F1\n\n## F2\n');
    scan = sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    assert.deepStrictEqual(scan.pending.map((/** @type {any} */ r) => r.id), ['review-001']);
    sim.run(['agent', 'ack', wu, 'discussion', 'beta', 'review-001', '--findings', 'F1,F2']);
    sim.run(['agent', 'announce', wu, 'discussion', 'beta', 'review-001']);
    sim.run(['agent', 'surface', wu, 'discussion', 'beta', 'review-001', 'F1']);
    const last = sim.run(['agent', 'surface', wu, 'discussion', 'beta', 'review-001', 'F2']);
    assert.strictEqual(last.status, 'incorporated', 'last finding auto-incorporates');

    // Skip-all from acknowledged: declined ids stay recorded unsurfaced.
    const skipAll = sim.run(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review', '--final']);
    sim.write(skipAll.file, '# More findings\n\n### F9: x\n');
    sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    sim.run(['agent', 'ack', wu, 'discussion', 'beta', skipAll.id, '--findings', 'F9']);
    const closedEarly = sim.run(['agent', 'incorporate', wu, 'discussion', 'beta', skipAll.id]);
    assert.deepStrictEqual(closedEarly.remaining, ['F9'], 'skip-all keeps the declined record');

    // A surfacing lane: the batch renders from a payload, then drains in one
    // call — the apply/route screens' call sequence, not the walk's.
    const laned = sim.run(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review', '--final']);
    sim.write(laned.file, '# Laned findings\n\n### F1: a\n\n### F2: b\n\n### F3: c\n');
    sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    sim.run(['agent', 'ack', wu, 'discussion', 'beta', laned.id, '--findings', 'F1,F2,F3']);
    sim.run(['agent', 'announce', wu, 'discussion', 'beta', laned.id]);
    const payload = `.leeway/.cache/${wu}/discussion/beta/batch-apply.json`;
    sim.write(payload, JSON.stringify({
      lane: 'apply',
      items: [{ title: 'a', detail: 'follows from the tier decision' }, { title: 'b', detail: 'retracted rationale, unstruck' }],
    }));
    // A drain's first screen opens on its lane's marker; whether a screen is
    // the first is the session's to know, so it passes the flag.
    assert.match(sim.render(['finding-batch', `${wu}.discussion.beta`, '--file', payload, '--first'], { expect: 'content' }),
      /^\*\*`▪ No Decision Needed`\*\*$/m, 'the apply lane opens on its marker');
    // The decide lane carries the veto menu; a screen past the five-item cap
    // is refused whole — pagination is the prose's job, screens the engine's.
    const decidePayload = `.leeway/.cache/${wu}/discussion/beta/batch-decide.json`;
    sim.write(decidePayload, JSON.stringify({
      lane: 'decide',
      items: [{ title: 'd', detail: 'determined by the tier decision' }],
    }));
    const decided = sim.render(['finding-batch', `${wu}.discussion.beta`, '--file', decidePayload, '--first'], { expect: 'content' });
    assert.match(decided, /\*\*Discuss\*\*/, 'the decide menu carries the discuss route');
    assert.match(decided, /^\*\*`▪ Decided From the Record`\*\*$/m, 'the decide lane opens on its marker');
    sim.write(decidePayload, JSON.stringify({
      lane: 'decide',
      items: Array.from({ length: 6 }, (_, i) => ({ title: `d${i}`, detail: 'x' })),
    }));
    sim.refuses(['render', 'finding-batch', `${wu}.discussion.beta`, '--file', decidePayload], /at most 5 items/);
    // The route lane requires each item's title alongside its target — a
    // producer still writing the bare {target, detail} pair fails here.
    const routePayload = `.leeway/.cache/${wu}/discussion/beta/batch-route.json`;
    sim.write(routePayload, JSON.stringify({
      lane: 'route',
      items: [{ title: 'c', target: 'alpha', detail: 'their subtopic owns the claim' }],
    }));
    const routed = sim.render(['finding-batch', `${wu}.discussion.beta`, '--file', routePayload, '--first'], { expect: 'content' });
    assert.match(routed, /\[→ alpha\]/, 'the destination rides the tag slot');
    assert.match(routed, /^\*\*`▪ Belongs Elsewhere`\*\*$/m, 'the route lane opens on its marker');
    sim.write(routePayload, JSON.stringify({ lane: 'route', items: [{ target: 'alpha', detail: 'd' }] }));
    sim.refuses(['render', 'finding-batch', `${wu}.discussion.beta`, '--file', routePayload], /item 1 is missing "title"/);
    const applied = sim.run(['agent', 'surface', wu, 'discussion', 'beta', laned.id, 'F1,F2']);
    assert.deepStrictEqual(applied.remaining, ['F3'], 'a batch drains its lane and leaves the rest');
    const walked = sim.run(['agent', 'surface', wu, 'discussion', 'beta', laned.id, 'F3']);
    assert.strictEqual(walked.status, 'incorporated', 'the walk finishes what the batch left');

    // A lane past the cap drains over screens: render at most five with the
    // remainder on the confirm, surface that screen, return for the next.
    const paged = sim.run(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review', '--final']);
    const ids = Array.from({ length: 11 }, (_, i) => `F${i + 1}`);
    sim.write(paged.file, `# Paged findings\n\n${ids.map((f) => `### ${f}: x\n`).join('\n')}`);
    sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    sim.run(['agent', 'ack', wu, 'discussion', 'beta', paged.id, '--findings', ids.join(',')]);
    sim.run(['agent', 'announce', wu, 'discussion', 'beta', paged.id]);
    const screen = (from, remaining) => {
      sim.write(payload, JSON.stringify({
        lane: 'apply',
        remaining,
        items: ids.slice(from, from + 5).map((f) => ({ title: f, detail: 'd' })),
      }));
      const opening = from === 0 ? ['--first'] : [];
      return sim.render(['finding-batch', `${wu}.discussion.beta`, '--file', payload, ...opening], { expect: 'content' });
    };
    const first = screen(0, 6);
    assert.match(first, /`◆ Apply them\?`/, 'the screen asks its question');
    assert.match(first, /`▪ No Decision Needed`/, 'the first screen opens on the marker');
    assert.match(first, /\(6 more after this\)/, 'screen one names the remainder');
    let row = sim.run(['agent', 'surface', wu, 'discussion', 'beta', paged.id, ids.slice(0, 5).join(',')]);
    assert.strictEqual(row.remaining.length, 6, 'first screen drains five');
    const second = screen(5, 1);
    assert.match(second, /\(1 more after this\)/, 'screen two names the remainder');
    assert.doesNotMatch(second, /▪/, 'a later screen carries no marker');
    row = sim.run(['agent', 'surface', wu, 'discussion', 'beta', paged.id, ids.slice(5, 10).join(',')]);
    assert.strictEqual(row.remaining.length, 1, 'second screen drains five more');
    const singleton = screen(10, 0);
    assert.match(singleton, /`◆ Apply it\?`/, 'a singleton asks in the singular');
    assert.match(singleton, /Apply it, then move on\n/, 'the last screen is a singleton with no tail');
    row = sim.run(['agent', 'surface', wu, 'discussion', 'beta', paged.id, 'F11']);
    assert.strictEqual(row.status, 'incorporated', 'the last screen incorporates the row');

    // Guards hold mid-lifecycle; the drained topic concludes.
    sim.refuses(['agent', 'surface', wu, 'discussion', 'beta', 'review-001', 'F1'], /incorporated/);
    sim.write(`.leeway/${wu}/discussion/beta.md`, '# Discussion — Beta\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'beta']);

    // A perspective council in discussion: the pair is one set, synthesis
    // joins it by number, and a half-landed council is never synthesisable.
    sim.run(['topic', 'start', wu, 'discussion', 'alpha']);
    const pair = sim.run(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'perspective',
      '--label', 'user-centric', '--label', 'capability-first']);
    assert.strictEqual(pair.agents.length, 2);
    assert.ok(pair.agents.every((a) => a.id.includes(`-${pair.set}-`)), 'one shared set number');
    sim.write(pair.agents[0].file, '# The user-centric case\n');
    scan = sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    assert.strictEqual(scan.pending.length + scan.in_flight.length, 2,
      'a half-landed council: one report in, one still out');
    sim.refuses(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'synthesis', '--set', pair.set], /not complete/);
    sim.refuses(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'synthesis', '--set', '009'], /No perspective set/);

    sim.write(pair.agents[1].file, '# The capability-first case\n');
    sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    const syn = sim.run(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'synthesis', '--set', pair.set]);
    assert.strictEqual(syn.id, `synthesis-${pair.set}`);
    sim.refuses(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'synthesis', '--set', pair.set], /already has a live synthesis/);
    for (const a of pair.agents) sim.run(['agent', 'incorporate', wu, 'discussion', 'alpha', a.id]);
    sim.write(syn.file, '# Landscape\n\n### T1: the tradeoff\n');
    scan = sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    assert.deepStrictEqual(scan.pending.map((/** @type {any} */ r) => r.id), [syn.id],
      'consumed perspectives never mask the synthesis');

    // The discussion closing sequence: the synthesis drains, the closing
    // probe classifies off the scan lists, the final review dispatches
    // (--final — the mandatory pass is exempt from the movement gate) and
    // drains, and a satisfied probe precedes completion.
    sim.run(['agent', 'ack', wu, 'discussion', 'alpha', syn.id, '--findings', 'T1']);
    sim.run(['agent', 'announce', wu, 'discussion', 'alpha', syn.id]);
    const synDone = sim.run(['agent', 'surface', wu, 'discussion', 'alpha', syn.id, 'T1']);
    assert.strictEqual(synDone.status, 'incorporated');

    const reviewRows = (s) => [...s.in_flight, ...s.pending, ...s.acknowledged, ...s.incorporated]
      .filter((r) => r.kind === 'review');
    let probe = sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    assert.strictEqual(reviewRows(probe).length, 0, 'probe: no review row — the due classification');
    assert.deepStrictEqual(probe.pending, [], 'nothing else awaits surfacing');

    const fin = sim.run(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'review', '--final']);
    sim.write(fin.file, '# Final review\n\n## G1\n');
    sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    sim.run(['agent', 'ack', wu, 'discussion', 'alpha', fin.id, '--findings', 'G1']);
    sim.run(['agent', 'announce', wu, 'discussion', 'alpha', fin.id]);
    const finDone = sim.run(['agent', 'surface', wu, 'discussion', 'alpha', fin.id, 'G1']);
    assert.strictEqual(finDone.status, 'incorporated');

    probe = sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    assert.strictEqual(probe.in_flight.length + probe.pending.length + probe.acknowledged.length, 0,
      'probe: nothing owed — the satisfied classification');
    assert.strictEqual(reviewRows(probe)[0].status, 'incorporated');

    // The map gate over the user's signal: the defer gate is fetched where it
    // is shown, the map above its consent; the batch its yes runs settles the
    // stragglers in one uniform write and answers with the map's convergence
    // state once — after which there is nothing left to defer.
    sim.run(['discussion-map', 'add', wu, 'alpha', 'edge-a']);
    sim.run(['discussion-map', 'add', wu, 'alpha', 'edge-b']);
    const deferGate = sim.render(['defer-gate', `${wu}.discussion.alpha`], { expect: 'content' });
    assert.ok(deferGate.indexOf('=== DISPLAY: discussion map') < deferGate.indexOf('=== MENU: defer gate'), 'the map, then the consent');
    assert.match(deferGate, /There are still 2 subtopics not yet decided/);
    const deferredBatch = sim.run(['discussion-map', 'set', wu, 'alpha', 'edge-a=deferred', 'edge-b=deferred']);
    assert.deepStrictEqual(deferredBatch.set, { 'edge-a': 'deferred', 'edge-b': 'deferred' });
    assert.strictEqual(deferredBatch.all_decided, true, 'the batch response carries convergence — no follow-up read');
    sim.refuses(['render', 'defer-gate', `${wu}.discussion.alpha`], /nothing on "alpha"'s map is undecided/);

    sim.write(`.leeway/${wu}/discussion/alpha.md`, '# Discussion — Alpha\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'alpha']);
  });

  it('restart: the cleanup commits while the plan item lives, the entry goes last', () => {
    const wu = 'redo';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Redo it', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write(`.leeway/${wu}/discussion/${wu}.md`, '# Discussion — Redo\n');
    sim.run(['commit', wu, '-m', `discussion(${wu}): capture`, '--topic', `discussion/${wu}`]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    sim.run(['topic', 'start', wu, 'specification', wu]);
    sim.run(['topic', 'complete', wu, 'specification', wu]);
    sim.run(['topic', 'start', wu, 'planning', wu]);
    sim.write(`.leeway/${wu}/planning/${wu}/planning.md`, `# Plan — ${wu}\n`);
    sim.write(`.leeway/${wu}/planning/${wu}/tasks/${wu}-1-1.md`, '---\nid: redo-1-1\n---\n\n# A task\n');
    sim.run(['manifest', 'set', `${wu}.planning.${wu}`,
      'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
      'finding_gate_mode=gated', 'review_cycle=0', 'phase=1', 'task=~',
      `task_map.${wu}-1-1=${wu}-1-1`, 'storage_paths=[]']);
    sim.run(['commit', wu, '-m', `plan(${wu}): author`, '--plan', wu]);

    // A peer session is mid-write on the discussion beside it — the restart's
    // two commits must not touch that.
    sim.write(`.leeway/${wu}/discussion/${wu}.md`, '# Discussion — Redo\n\npeer session dirt\n');

    // The restart, in prose order: files first, committed through `--plan`
    // while the planning item still resolves it.
    fs.rmSync(path.join(sim.dir, `.leeway/${wu}/planning/${wu}`), { recursive: true, force: true });
    const cleanup = sim.run(['commit', wu, '-m', `planning(${wu}): restart planning — clear the authored plan`, '--plan', wu]);
    assert.match(cleanup.committed, /^[0-9a-f]+$/, 'the cleanup commits while the item lives');
    const cleaned = stateGit(sim.dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).split('\n').map((l) => l.trim()).filter(Boolean).map((rel) => `.leeway/${rel}`);
    assert.ok(cleaned.includes(`.leeway/${wu}/planning/${wu}/planning.md`), 'the deleted plan files ride the cleanup');
    assert.ok(!cleaned.includes(`.leeway/${wu}/discussion/${wu}.md`), 'the peer session\'s dirt does not');

    // The entry goes last, committed on the topic's own scope.
    sim.run(['manifest', 'delete', `${wu}.planning`, `items.${wu}`]);
    assert.strictEqual(sim.manifest(wu).phases.planning.items[wu], undefined);
    const closed = sim.run(['commit', wu, '-m', `planning(${wu}): restart planning`, '--topic', `planning/${wu}`]);
    assert.match(closed.committed, /^[0-9a-f]+$/);
    assert.deepStrictEqual(stateGit(sim.dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).split('\n').map((l) => l.trim()).filter(Boolean),
      [`${wu}/manifest.json`], 'only the entry\'s removal — the plan files are already in');
    assert.match(stateGit(sim.dir, ['status', '--porcelain']), /discussion\/redo\.md/, 'the peer\'s dirt survives both commits');

    // And the reason the order is what it is: `--plan` cannot resolve a
    // deleted item, so a cleanup committed after the delete has no scope.
    sim.refuses(['commit', wu, '-m', 'too late', '--plan', wu], /no planning item/);
  });

  it('restart: a quick-fix commits the plan first, then everything its work unit is', () => {
    const wu = 'typo';
    sim.run(['workunit', 'create', wu, 'quick-fix', '--description', 'Fix the typo', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['topic', 'start', wu, 'scoping', wu]);
    sim.write(`.leeway/${wu}/specification/${wu}/specification.md`, `# Spec — ${wu}\n\n## Change\n\nThe footer's typo is corrected.\n`);
    sim.run(['topic', 'start', wu, 'specification', wu]);
    sim.run(['topic', 'complete', wu, 'specification', wu]);
    sim.run(['commit', wu, '-m', `spec(${wu}): quick-fix specification`, '--topic', `specification/${wu}`]);
    sim.run(['topic', 'start', wu, 'planning', wu]);
    sim.write(`.leeway/${wu}/planning/${wu}/planning.md`, `# Plan — ${wu}\n`);
    sim.run(['manifest', 'set', `${wu}.planning.${wu}`,
      'format=local-markdown', 'task_list_gate_mode=auto', 'author_gate_mode=auto',
      'finding_gate_mode=auto', 'review_cycle=0', 'phase=1', 'task=~',
      `task_map.${wu}-1-1=${wu}-1-1`, 'storage_paths=[]']);
    sim.run(['topic', 'complete', wu, 'planning', wu]);
    sim.run(['commit', wu, '-m', `scoping(${wu}): register plan`, '--plan', wu]);

    fs.rmSync(path.join(sim.dir, `.leeway/${wu}/specification/${wu}`), { recursive: true, force: true });
    fs.rmSync(path.join(sim.dir, `.leeway/${wu}/planning/${wu}`), { recursive: true, force: true });
    // The spec's knowledge-base entry goes with its file, through the door.
    const removal = ['knowledge', 'remove', '--work-unit', wu, '--phase', 'specification', '--topic', wu];
    const removed = sim.engine(removal);
    assert.strictEqual(removed.code, 0, removed.stderr);
    assert.match(removed.stdout, new RegExp(`^Removed [1-9]\\d* chunks for ${wu}/specification/${wu}\\n$`));
    assert.strictEqual(sim.engine([...removal, '--dry-run']).stdout, `Would remove 0 chunks for ${wu}/specification/${wu}\n`,
      'none of the spec\'s chunks is left');
    const cleanup = sim.run(['commit', wu, '-m', `scoping(${wu}): restart scoping — clear the authored plan`, '--plan', wu]);
    const cleaned = stateGit(sim.dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).split('\n').map((l) => l.trim()).filter(Boolean).map((rel) => `.leeway/${rel}`);
    assert.match(cleanup.committed, /^[0-9a-f]+$/);
    assert.ok(cleaned.includes(`.leeway/${wu}/planning/${wu}/planning.md`), 'the plan half rides --plan');
    assert.ok(!cleaned.includes(`.leeway/${wu}/specification/${wu}/specification.md`),
      'the spec is outside the plan scope and waits for the closing commit');

    sim.run(['manifest', 'delete', `${wu}.specification`, `items.${wu}`]);
    sim.run(['manifest', 'delete', `${wu}.planning`, `items.${wu}`]);
    assert.strictEqual(sim.manifest(wu).phases.scoping.items[wu].status, 'in-progress',
      'the scoping item stays in progress — the fresh run re-completes it');
    sim.run(['commit', wu, '-m', `scoping(${wu}): restart scoping`]);
    const closed = stateGit(sim.dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).split('\n').map((l) => l.trim()).filter(Boolean);
    assert.ok(closed.includes(`${wu}/specification/${wu}/specification.md`), 'the deleted spec lands here');
    assert.ok(closed.includes(`${wu}/manifest.json`), 'and both entry removals with it');
    assert.deepStrictEqual(stateGit(sim.dir, ['status', '--porcelain', '--', wu]).split('\n').filter(Boolean), [],
      'the restart leaves nothing of the work unit behind');
  });

  it('the migration gate\'s yes: one commit lands every path the workflows own, and a code session\'s staging stays out', () => {
    const wu = 'upgraded';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Carried through an upgrade', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write('.claude/settings.json', '{}\n');
    sim.write('.gitignore', '.leeway/\nnode_modules\n');
    sim.write('src/app.js', 'const x = 1;\n');
    git(sim.dir, ['add', '-A']);
    git(sim.dir, ['commit', '-q', '-m', 'a project mid-flight']);

    // What a boot's migrations leave for the review gate, beside a code
    // session's staged work.
    sim.write('.claude/settings.json', '{"permissions":{}}\n');
    sim.write('.worktreeinclude', `${STATE_DIR_NAME}/${KNOWLEDGE_DIR}/store.bin\n`);
    sim.write('.gitignore', '.leeway/\nnode_modules\n.DS_Store\n');
    sim.write('.leeway/.state/migrations', '062\n');
    sim.write('src/app.js', 'const x = 2;\n');
    git(sim.dir, ['add', '--', 'src/app.js']);

    // The summary rides a payload in the cache, which the commit below never
    // carries, with every notice boot's migrations handed back for the person.
    const applied = sim.write('.leeway/.cache/migrations-applied.json', {
      summary: 'Restored the settings and the worktree include.',
      notices: ['A setting you may want back was removed.'],
      migrations: 1,
      files: 3,
    });
    assert.match(sim.render(['migrations-applied', '--file', applied], { expect: 'content' }),
      /\*\*Migrations Applied\*\*\n\nRestored the settings and the worktree include\.\n\nA setting you may want back was removed\.\n\n1 migration\(s\), 3 file\(s\) updated\./);
    assert.match(sim.render(['migration-gate'], { expect: 'content' }), /Ready to continue\?/);
    const landed = sim.run(['commit', '--migrations', '-m', 'chore: apply workflow migrations']);
    assert.strictEqual(landed.committed, stateGit(sim.dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(landed.code_committed, git(sim.dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.deepStrictEqual(stateGit(sim.dir, ['show', '--name-status', '--pretty=format:', 'HEAD']).split('\n').filter(Boolean).sort(), [
      'A\t.state/migrations',
      `M\t${wu}/manifest.json`,
    ], 'the whole state rides the reviewed commit — the topic start the session had not yet committed among it');
    assert.deepStrictEqual(git(sim.dir, ['show', '--name-status', '--pretty=format:', 'HEAD']).split('\n').filter(Boolean).sort(), [
      'A\t.worktreeinclude',
      'M\t.claude/settings.json',
      'M\t.gitignore',
    ]);
    assert.strictEqual(git(sim.dir, ['diff', '--cached', '--name-only']).trim(), 'src/app.js', 'the code session\'s staging stays staged');

    // The unit carries on from the upgraded tree.
    sim.write(`.leeway/${wu}/discussion/${wu}.md`, '# Discussion — Upgraded\n');
    sim.run(['commit', wu, '-m', `discussion(${wu}): capture`, '--topic', `discussion/${wu}`]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
  });

  it('boot: a git below the floor stops at its screen; lost state stops at its screen and the yes starts it again; a GitHub remote gets the rule\'s offer once, and the no is recorded', () => {
    // A machine whose git is older than the engine's floor stops before
    // anything runs.
    const bin = fs.mkdtempSync(path.join(sim.configDir, 'old-git-'));
    fs.writeFileSync(path.join(bin, 'git'), "#!/bin/sh\necho 'git version 2.39.5 (Apple Git-154)'\n", { mode: 0o755 });
    const oldGit = { PATH: bin };
    assert.deepStrictEqual(sim.run(['boot'], oldGit), { ok: true, state: 'git', warnings: [] });
    assert.match(sim.render(['git-floor-stop'], { expect: 'content', identity: oldGit }), /Leeway runs on git 2\.40\.0 or newer/);

    // The state branch and its worktree gone, the code tree still ignoring
    // the state: lost, here and with no remote to restore it from.
    git(sim.dir, ['worktree', 'remove', '--force', '--force', statePath(sim.dir)]);
    git(sim.dir, ['branch', '-D', 'leeway-state']);

    assert.deepStrictEqual(sim.run(['boot']), { ok: true, state: 'lost', warnings: [] });
    assert.ok(!fs.existsSync(statePath(sim.dir)), 'the stop wrote state');
    assert.match(sim.render(['state-lost-gate'], { expect: 'content' }), /Start again with a fresh state\?/);
    const restarted = sim.run(['boot', '--start-again']);
    assert.deepStrictEqual([restarted.state, restarted.github_rule_offer], ['restarted', false]);
    assert.strictEqual(stateGit(sim.dir, ['rev-list', '--max-parents=0', 'leeway-state']).trim().split('\n').length, 1, 'the fresh state is one orphan line');

    // A remote on GitHub, out of reach: boot works on the state it has, and
    // offers the rule until the offer is answered.
    git(sim.dir, ['remote', 'add', 'origin', 'git@github.com:acme/portal.git']);
    sim.env = { ...sim.env, ...githubOffline(sim.configDir), GIT_SSH_COMMAND: 'false' };
    const offered = sim.run(['boot']);
    assert.deepStrictEqual([offered.state, offered.github_rule_offer], ['ready', true]);
    assert.match(sim.render(['github-rule-gate'], { expect: 'content' }), /Set that rule on GitHub\?/);
    assert.strictEqual(sim.run(['github-rule', 'no']).github_rule, 'declined');
    assert.strictEqual(sim.run(['boot']).github_rule_offer, false);
    sim.refuses(['github-rule', 'yes'], /an answer is recorded once/);
  });

  // -------------------------------------------------------------------------
  // Concurrency — several sessions on one checkout, interleaved.
  //
  // Every engine call is atomic under its own locks (the manifest lock, the
  // commit lock), so a sequential interleave IS the correctness test: what a
  // real concurrent run can produce is some ordering of these calls, and the
  // question a scenario has to answer is whether any ordering lets one
  // session's commit take another's paths. The invariant this pins is the
  // whole programme in one line: no commit ever contains a foreign session's
  // path (design/concurrent-phases.md).
  // -------------------------------------------------------------------------

  it('concurrent sessions: interleaved commits stay confined, the code slot holds, a dead peer is swept', () => {
    const wu = 'relay';

    // --- the map both sessions inherit -------------------------------------
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Event relay overhaul', '--session-log-file', log]);
    const topics = sim.write(`.leeway/.cache/${wu}/discovery/topics.json`, [
      { name: 'ingest', routing: 'discussion', summary: 'How events arrive' },
      { name: 'ranking', routing: 'discussion', summary: 'How events are ordered' },
      { name: 'metrics', routing: 'research', summary: 'What good looks like' },
      { name: 'dispatch', routing: 'discussion', summary: 'How events leave' },
    ]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', topics]);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): synthesise 4 topics`]);

    // ingest is discussed and ready to specify; dispatch is built out to the
    // edge of implementation. Both were finished before this scenario opens.
    sim.run(['topic', 'start', wu, 'discussion', 'ingest']);
    sim.write(`.leeway/${wu}/discussion/ingest.md`, '# Discussion — Ingest\n\nDecided: batch intake.\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'ingest']);
    sim.run(['topic', 'start', wu, 'discussion', 'dispatch']);
    sim.run(['topic', 'complete', wu, 'discussion', 'dispatch']);
    sim.run(['topic', 'start', wu, 'specification', 'dispatch']);
    sim.run(['topic', 'complete', wu, 'specification', 'dispatch']);
    sim.run(['topic', 'start', wu, 'planning', 'dispatch']);
    sim.run(['manifest', 'set', `${wu}.planning.dispatch`,
      'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
      'finding_gate_mode=gated', 'review_cycle=0', 'phase=1', 'task=~',
      'task_map.dispatch-1-1=dispatch-1-1', 'storage_paths=[]']);
    sim.run(['topic', 'complete', wu, 'planning', 'dispatch']);
    sim.run(['commit', wu, '-m', `workflow(${wu}): set the board`]);

    // The setup ran as one session: its starts beat and its completions
    // cleared, so the scenario opens on a checkout nobody holds.
    assert.deepStrictEqual(sim.run(['presence', 'scan', wu]).sessions, [],
      'the board starts with no session holding anything');

    /** A pid that is certainly not running: a child spawned and reaped. */
    const reapedPid = () => {
      const res = spawnSync('node', ['-e', '']);
      assert.ok(res.pid, 'could not mint a dead pid');
      return res.pid;
    };

    const specSession = sim.session('spec-session', process.ppid);
    const talkSession = sim.session('discussion-session', 1);
    const codeSession = sim.session('code-session');
    const secondCoder = sim.session('review-session', reapedPid());

    const SPEC_FILE = `.leeway/${wu}/specification/ingest/specification.md`;
    const TALK_FILE = `.leeway/${wu}/discussion/ranking.md`;
    const CODE_FILE = 'src/relay/dispatch.js';
    const lines = (out) => out.split('\n').filter(Boolean);
    /** The paths the head commit on a branch carries, named from the project. */
    const committedPaths = (state) => (state
      ? lines(stateGit(sim.dir, ['show', '--name-only', '--pretty=format:', 'HEAD'])).map((l) => `${STATE_DIR_NAME}/${l.trim()}`)
      : lines(git(sim.dir, ['show', '--name-only', '--pretty=format:', 'HEAD'])).map((l) => l.trim()));
    /** Both trees' dirt, named from the project. */
    const dirty = () => [
      ...lines(git(sim.dir, ['status', '--porcelain'])).map((l) => l.slice(3).trim()),
      ...lines(stateGit(sim.dir, ['status', '--porcelain'])).map((l) => `${STATE_DIR_NAME}/${l.slice(3).trim()}`),
    ];
    /** No commit ever contains a foreign session's path. */
    const confined = (label, own, foreign) => {
      const paths = committedPaths(own[0].startsWith(`${STATE_DIR_NAME}/`));
      assert.ok(paths.length > 0, `[${label}] committed nothing`);
      for (const p of paths) {
        assert.ok(own.some((o) => p === o || p.startsWith(`${o}/`)),
          `[${label}] committed ${p}, outside the action's own scope`);
      }
      for (const f of foreign) {
        assert.ok(!paths.includes(f), `[${label}] swept a peer's path: ${f}`);
      }
    };
    const specScope = [`.leeway/${wu}/specification/ingest`, `.leeway/${wu}/manifest.json`];
    const talkScope = [`.leeway/${wu}/discussion/ranking.md`, `.leeway/${wu}/discussion/.mailbox/ranking`, `.leeway/${wu}/manifest.json`];

    // --- A1 · B1 · A2 · B2: two document sessions, alternating -------------
    // A: a specification session on ingest. B: a discussion session on
    // ranking. Neither knows the other exists; both write into one work unit
    // and commit through the same door.
    specSession.run(['topic', 'start', wu, 'specification', 'ingest']);
    talkSession.run(['topic', 'start', wu, 'discussion', 'ranking']);

    specSession.write(SPEC_FILE, '# Specification — Ingest\n\n## Requirements\n\n- Batch intake.\n');
    specSession.run(['manifest', 'set', `${wu}.specification.ingest`, 'sources.ingest.status', 'pending']);
    talkSession.write(TALK_FILE, '# Discussion — Ranking\n\n## Context\n\nOrdering under replay.\n');
    talkSession.run(['discussion-map', 'add', wu, 'ranking', 'replay-order']);

    // A commits with B's half-written document sitting dirty beside it.
    specSession.run(['commit', wu, '-m', `spec(${wu}/ingest): construct`, '--topic', 'specification/ingest']);
    confined('A1', specScope, [TALK_FILE]);
    assert.ok(dirty().includes(TALK_FILE), "the peer's uncommitted document survives A's commit");

    // B commits next, and A's spec is already landed — so B's confinement is
    // proven by what its commit does NOT reach for, not by what is dirty.
    talkSession.run(['commit', wu, '-m', `discussion(${wu}/ranking): capture`, '--topic', 'discussion/ranking']);
    confined('B1', talkScope, [SPEC_FILE]);

    // Round two, both sessions still live, both amending their own document.
    specSession.write(SPEC_FILE, '# Specification — Ingest\n\n## Requirements\n\n- Batch intake.\n- Replay is idempotent.\n');
    talkSession.write(TALK_FILE, '# Discussion — Ranking\n\n## Context\n\nOrdering under replay.\n\n## Decisions\n\n- Order by sequence number.\n');
    specSession.run(['commit', wu, '-m', `spec(${wu}/ingest): idempotent replay`, '--topic', 'specification/ingest']);
    confined('A2', specScope, [TALK_FILE]);
    assert.ok(dirty().includes(TALK_FILE), "B's second edit survives A's second commit");
    talkSession.run(['discussion-map', 'set', wu, 'ranking', 'replay-order', 'decided']);
    talkSession.run(['commit', wu, '-m', `discussion(${wu}/ranking): decide replay order`, '--topic', 'discussion/ranking']);
    confined('B2', talkScope, [SPEC_FILE]);

    // Both artifacts survive intact — each holds its own session's words, and
    // neither lost a write to the other's commit.
    assert.match(fs.readFileSync(path.join(sim.dir, SPEC_FILE), 'utf8'), /Replay is idempotent/);
    assert.match(fs.readFileSync(path.join(sim.dir, TALK_FILE), 'utf8'), /Order by sequence number/);
    assert.deepStrictEqual(dirty().filter((p) => p === SPEC_FILE || p === TALK_FILE), [],
      'both sessions committed their own work in full');

    // --- presence through the interleave -----------------------------------
    const rowOf = (scan, phase, topic) => scan.sessions.find((r) => r.phase === phase && r.topic === topic);
    const interleaved = sim.run(['presence', 'scan', wu]);
    const specRow = rowOf(interleaved, 'specification', 'ingest');
    const talkRow = rowOf(interleaved, 'discussion', 'ranking');
    assert.strictEqual(specRow.session_id, 'spec-session', "A's heartbeat carries A's identity");
    assert.strictEqual(talkRow.session_id, 'discussion-session', "B's heartbeat carries B's identity");
    assert.ok(specRow.held && talkRow.held, 'both document sessions read held');
    assert.strictEqual(interleaved.held_sources, 1,
      'only the discussion counts as a source — a held spec session defers no analysis');
    assert.ok(sim.sections.includes('=== DISPLAY: presence deferral') && sim.sections.replace(/\n +/g, ' ').includes('discussion/ranking (last active'),
      `the deferral section rides the scan the dispatch prose reads it from: ${sim.sections}`);

    // --- the code slot ------------------------------------------------------
    // The slot is taken at the entry chokepoint, not at the first commit:
    // reading a free slot is how a code session claims it, so the window
    // between entering the phase and writing anything is not a window.
    const codeSlot = path.join(sim.dir, '.leeway/.cache', wu, 'implementation/dispatch/presence');
    assert.ok(!fs.existsSync(codeSlot), 'nobody holds the code slot before anyone enters');
    codeSession.render(['code-gate', `${wu}.implementation.dispatch`], { expect: 'empty' });
    assert.strictEqual(JSON.parse(fs.readFileSync(codeSlot, 'utf8')).session_id, 'code-session',
      'the entry-gate render is the claim');

    codeSession.run(['task', 'init', wu, 'dispatch']);
    codeSession.run(['task', 'start', wu, 'dispatch', 'dispatch-1-1']);
    sim.write(CODE_FILE, "export function dispatch(event) { return sink.write(event); }\n");
    // And the code commit beats it too: `--for` names the code topic, and
    // code is the one scope no layout derives.
    const firstCode = codeSession.run(['commit', '--paths', CODE_FILE, '-m', 'feat(relay): dispatch events',
      '--for', wu, 'implementation/dispatch']);
    assert.deepStrictEqual(firstCode.left_dirty, [], 'the task committed everything it touched');
    assert.strictEqual(JSON.parse(fs.readFileSync(codeSlot, 'utf8')).session_id, 'code-session',
      'the cadence commit keeps the hold alive');
    confined('C1', [CODE_FILE], [SPEC_FILE, TALK_FILE]);

    // A second code entrant — a different session, a different pid — is
    // gated; the holder reading the same surface is not gated against itself.
    const gate = secondCoder.render(['code-gate', `${wu}.review.dispatch`], { expect: 'content' });
    assert.match(gate, /Another session is implementing "Dispatch" \(relay\)/,
      'the gate names who holds the slot, where, and for how long');
    assert.match(gate, /Code phases run one at a time/);
    // Backing out of the gate on an epic hands the work to the epic menu.
    handoff(sim, `/workflow-continue-epic ${wu}`);
    codeSession.render(['code-gate', `${wu}.implementation.dispatch`], { expect: 'empty' });

    // --- a document session commits while the code session holds ------------
    // The doc commit never takes code dirt, and the code commit's left_dirty
    // never names workflow dirt: each half of the checkout is the other's
    // business, and both are running at once.
    sim.write(CODE_FILE, "export function dispatch(event) { return sink.write(event); }\nexport const ORDERED = true;\n");
    sim.write('src/relay/sink.js', '// a file the task forgot to name\n');
    talkSession.write(TALK_FILE, '# Discussion — Ranking\n\n## Context\n\nOrdering under replay.\n\n## Decisions\n\n- Order by sequence number.\n- Ties break on arrival.\n');
    talkSession.run(['commit', wu, '-m', `discussion(${wu}/ranking): tie-break`, '--topic', 'discussion/ranking']);
    confined('B3', talkScope, [CODE_FILE, 'src/relay/sink.js']);
    assert.ok(dirty().includes(CODE_FILE), "the code session's dirt survives a doc session's commit");

    // Now the reverse, with a document session's dirt sitting on the tree.
    specSession.write(SPEC_FILE, '# Specification — Ingest\n\n## Requirements\n\n- Batch intake.\n- Replay is idempotent.\n- Ties break on arrival.\n');
    const secondCode = codeSession.run(['commit', '--paths', CODE_FILE, '-m', 'feat(relay): ordered dispatch',
      '--for', wu, 'implementation/dispatch']);
    confined('C2', [CODE_FILE], [SPEC_FILE, TALK_FILE]);
    assert.deepStrictEqual(secondCode.left_dirty, ['src/relay/sink.js'],
      'the forgotten code path comes back, and nothing under .leeway ever does');
    assert.ok(dirty().includes(SPEC_FILE), "the doc session's dirt is not the code session's to commit");
    specSession.run(['commit', wu, '-m', `spec(${wu}/ingest): tie-break`, '--topic', 'specification/ingest']);
    codeSession.run(['commit', '--paths', 'src/relay/sink.js', '-m', 'chore(relay): the rest',
      '--for', wu, 'implementation/dispatch']);

    // Three sessions hold, one of them code; the source count is unmoved.
    const holding = sim.run(['presence', 'scan', wu]);
    assert.strictEqual(holding.held, 3, 'two document sessions and one code session hold');
    assert.strictEqual(holding.held_sources, 1, 'a held code session defers no analysis either');
    assert.strictEqual(rowOf(holding, 'implementation', 'dispatch').session_id, 'code-session');

    // --- the dead peer's leavings ------------------------------------------
    // A research session died mid-write: its document is uncommitted and its
    // heartbeat names a process that is gone. A concluding session sweeps it.
    const ghostPid = reapedPid();
    sim.run(['topic', 'start', wu, 'research', 'metrics']);
    sim.write(`.leeway/${wu}/research/metrics.md`, '# Research — Metrics\n\nHalf a paragraph.\n');
    sim.write(`.leeway/.cache/${wu}/research/metrics/presence`,
      JSON.stringify({ pid: ghostPid, pid_start: null, session_id: 'ghost-session' }) + '\n');
    const beforeSweep = rowOf(sim.run(['presence', 'scan', wu]), 'research', 'metrics');
    assert.strictEqual(beforeSweep.held, false, 'a heartbeat whose process is gone reads unheld');

    talkSession.run(['commit', wu, '--topic', 'research/metrics', '--sweep',
      '-m', `chore(${wu}/metrics): sweep session leavings`]);
    confined('sweep', [`.leeway/${wu}/research/metrics.md`, `.leeway/${wu}/research/.mailbox/metrics`, `.leeway/${wu}/manifest.json`],
      [SPEC_FILE, TALK_FILE, CODE_FILE]);
    assert.ok(!dirty().includes(`.leeway/${wu}/research/metrics.md`), "the dead session's document is committed");

    // The sweeper never stamps its identity on the topic it just cleaned —
    // a beat there would resurrect a hold nobody holds.
    const afterSweep = rowOf(sim.run(['presence', 'scan', wu]), 'research', 'metrics');
    assert.strictEqual(afterSweep.session_id, 'ghost-session', 'the sweep left the dead record alone');
    assert.strictEqual(afterSweep.held, false, 'the swept topic is not resurrected');

    // The suppression is what did it: the same commit without `--sweep` beats.
    sim.write(`.leeway/${wu}/research/metrics.md`, '# Research — Metrics\n\nHalf a paragraph.\n\nPicked back up.\n');
    talkSession.run(['commit', wu, '--topic', 'research/metrics',
      '-m', `research(${wu}/metrics): pick the thread back up`]);
    const adopted = rowOf(sim.run(['presence', 'scan', wu]), 'research', 'metrics');
    assert.strictEqual(adopted.session_id, 'discussion-session', 'a session-cadence commit stamps the caller');
    assert.strictEqual(adopted.held, true);

    // --- the terminal clear -------------------------------------------------
    // The conclusion's commit, over the completed item, clears instead of
    // beating, or the topic would read held forever after its session ended.
    talkSession.run(['topic', 'complete', wu, 'discussion', 'ranking']);
    talkSession.run(['commit', wu, '--topic', 'discussion/ranking',
      '-m', `discussion(${wu}): complete ranking discussion`]);
    assert.strictEqual(rowOf(sim.run(['presence', 'scan', wu]), 'discussion', 'ranking'), undefined,
      'the terminal commit drops the heartbeat');
    assert.ok(rowOf(sim.run(['presence', 'scan', wu]), 'specification', 'ingest'),
      "and leaves every peer session's hold standing");

    // --- the code slot's release -------------------------------------------
    // Review closes its topic and commits the report; the checkout's one code
    // slot must be free the moment the topic is finished, not when the
    // process eventually dies.
    codeSession.run(['topic', 'complete', wu, 'implementation', 'dispatch']);
    codeSession.write(`.leeway/${wu}/implementation/dispatch/report.md`, '# Implementation — Dispatch\n\nDone.\n');
    codeSession.run(['commit', wu, '--topic', 'implementation/dispatch',
      '-m', `impl(${wu}): conclude dispatch`]);
    assert.strictEqual(rowOf(sim.run(['presence', 'scan', wu]), 'implementation', 'dispatch'), undefined,
      'the close released the slot, and the commit after it did not take it back');
    assert.strictEqual(
      require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/presence.cjs')).heldCodeSessions(sim.dir).length, 0,
      'so the next code session walks straight in');
  });
});

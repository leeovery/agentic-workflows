'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's sessions: background agents from dispatch to
// incorporation; restarts committing in order; the migration gate's yes;
// and boot's lost-state screen and the GitHub offer. Concurrent sessions
// are test-pipeline-simulation-concurrency.cjs.
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
const { githubOffline, git, stateGit } = require('./engine-harness.cjs');
const { STATE_DIR_NAME, statePath } = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/state-root.cjs'));
const { Sim, sessionLog, mappedEpic, enterEntry, decideTopic, discussed, askedOn } = require('./pipeline-world.cjs');

describe('pipeline simulation: sessions', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('background agents: dispatch → completion scan → ack → surface, each finding a question the review asked', () => {
    const wu = 'agents';
    mappedEpic(sim, wu, ['alpha', 'beta']);
    /** @param {string} topic @param {string} text */
    const reviewAsks = (topic, text) => sim.run(['ledger', 'ask', `${wu}.discussion.${topic}`], null,
      JSON.stringify({ by: 'review', who_moved_whom: 'none', text })).id;
    /** @param {string} topic @param {string} question */
    const claudeDecides = (topic, question) => sim.run(['ledger', 'decide', `${wu}.discussion.${topic}`, '--answers', question], null,
      JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Settled from the record.', why: 'The record answers it.' }));

    // A deep dive learns what the room cannot answer, its question on the
    // map: nothing readable while it runs, the report's existence its
    // completion signal, a clean ack its close. A traversal topic refuses at
    // every verb — the colocation promise depends on it.
    enterEntry(sim, wu, 'discussion', 'alpha');
    const auth = askedOn(sim, wu, 'alpha', 'How does auth land?');
    sim.refuses(['agent', 'dispatch', wu, 'discussion', '../../../escape', '--kind', 'deep-dive', '--label', 'auth'], /Invalid topic/);
    const dive = sim.run(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    assert.strictEqual(dive.id, 'deep-dive-001-auth');
    let scan = sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    assert.deepStrictEqual(scan.pending, [], 'nothing readable while the dive runs');
    sim.refuses(['agent', 'ack', wu, 'discussion', 'alpha', dive.id, '--clean'], /in-flight/);
    sim.write(dive.file, '# Nothing novel\n');
    scan = sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    assert.deepStrictEqual(scan.pending.map((/** @type {any} */ r) => r.id), [dive.id]);
    assert.strictEqual(sim.run(['agent', 'ack', wu, 'discussion', 'alpha', dive.id, '--clean']).status, 'incorporated');

    // The review's lifecycle: no file exists until the sub-agent writes one;
    // the report lands, the row promotes, and each finding is taken as a
    // question the review asked, recorded as it is taken — the last closes
    // the report, and a finding taken twice refuses.
    enterEntry(sim, wu, 'discussion', 'beta');
    const review = sim.run(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review']);
    scan = sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    assert.deepStrictEqual(scan.pending, [], 'nothing readable while the review runs');
    sim.write(review.file, '# Review findings\n\n## F1\n\n## F2\n');
    scan = sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    assert.deepStrictEqual(scan.pending.map((/** @type {any} */ r) => r.id), ['review-001']);
    sim.run(['agent', 'ack', wu, 'discussion', 'beta', 'review-001', '--findings', 'F1,F2']);
    const findings = ['F1', 'F2'].map((finding) => {
      const asked = reviewAsks('beta', `What does ${finding} ask?`);
      return { asked, row: sim.run(['agent', 'surface', wu, 'discussion', 'beta', 'review-001', finding]) };
    });
    assert.deepStrictEqual(findings.map((f) => f.row.status), ['acknowledged', 'incorporated'], 'the last finding closes the report');
    sim.refuses(['agent', 'surface', wu, 'discussion', 'beta', 'review-001', 'F1'], /incorporated/);
    for (const { asked } of findings) claudeDecides('beta', asked);
    decideTopic(sim, wu, 'beta');

    // A perspective council: the pair is one set, synthesis joins it by
    // number, and a half-landed council is never synthesisable.
    enterEntry(sim, wu, 'discussion', 'alpha');
    const pair = sim.run(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'perspective',
      '--label', 'user-centric', '--label', 'capability-first']);
    assert.strictEqual(pair.agents.length, 2);
    assert.ok(pair.agents.every((/** @type {any} */ a) => a.id.includes(`-${pair.set}-`)), 'one shared set number');
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

    // The synthesis's tension is told and closes the report; the review the
    // person asks for rides --final, and its finding is a question like any
    // other — then nothing is owed and the topic is decided.
    sim.run(['agent', 'ack', wu, 'discussion', 'alpha', syn.id, '--findings', 'T1']);
    assert.strictEqual(sim.run(['agent', 'surface', wu, 'discussion', 'alpha', syn.id, 'T1']).status, 'incorporated');

    const reviewRows = (/** @type {any} */ s) => [...s.in_flight, ...s.pending, ...s.acknowledged, ...s.incorporated]
      .filter((r) => r.kind === 'review');
    let probe = sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    assert.strictEqual(reviewRows(probe).length, 0, 'no review row on alpha yet');
    assert.deepStrictEqual(probe.pending, [], 'nothing else awaits surfacing');

    const fin = sim.run(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'review', '--final']);
    sim.write(fin.file, '# Final review\n\n## G1\n');
    sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    sim.run(['agent', 'ack', wu, 'discussion', 'alpha', fin.id, '--findings', 'G1']);
    const g1 = reviewAsks('alpha', 'What does G1 ask?');
    assert.strictEqual(sim.run(['agent', 'surface', wu, 'discussion', 'alpha', fin.id, 'G1']).status, 'incorporated');

    probe = sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    assert.strictEqual(probe.in_flight.length + probe.pending.length + probe.acknowledged.length, 0, 'nothing owed');
    assert.strictEqual(reviewRows(probe)[0].status, 'incorporated');
    for (const question of [auth, g1]) claudeDecides('alpha', question);
    decideTopic(sim, wu, 'alpha');
  });

  it('restart: the cleanup commits while the plan item lives, the entry goes last', () => {
    const wu = 'redo';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Redo it', '--session-log-file', sessionLog(sim, wu)]);
    discussed(sim, wu, wu);
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

    // A peer session is mid-write on the specification beside it — the
    // restart's two commits must not touch that.
    const peerDoc = `.leeway/${wu}/specification/${wu}/specification.md`;
    sim.write(peerDoc, '# Specification — Redo\n\npeer session dirt\n');

    // The restart, in prose order: files first, committed through `--plan`
    // while the planning item still resolves it.
    fs.rmSync(path.join(sim.dir, `.leeway/${wu}/planning/${wu}`), { recursive: true, force: true });
    const cleanup = sim.run(['commit', wu, '-m', `planning(${wu}): restart planning — clear the authored plan`, '--plan', wu]);
    assert.match(cleanup.committed, /^[0-9a-f]+$/, 'the cleanup commits while the item lives');
    const cleaned = stateGit(sim.dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).split('\n').map((l) => l.trim()).filter(Boolean).map((rel) => `.leeway/${rel}`);
    assert.ok(cleaned.includes(`.leeway/${wu}/planning/${wu}/planning.md`), 'the deleted plan files ride the cleanup');
    assert.ok(!cleaned.includes(peerDoc), 'the peer session\'s dirt does not');

    // The entry goes last, committed on the topic's own scope.
    sim.run(['manifest', 'delete', `${wu}.planning`, `items.${wu}`]);
    assert.strictEqual(sim.manifest(wu).phases.planning.items[wu], undefined);
    const closed = sim.run(['commit', wu, '-m', `planning(${wu}): restart planning`, '--topic', `planning/${wu}`]);
    assert.match(closed.committed, /^[0-9a-f]+$/);
    assert.deepStrictEqual(stateGit(sim.dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).split('\n').map((l) => l.trim()).filter(Boolean),
      [`${wu}/manifest.json`], 'only the entry\'s removal — the plan files are already in');
    assert.match(stateGit(sim.dir, ['status', '--porcelain', '-uall']), /redo\/specification\/redo\/specification\.md/, 'the peer\'s dirt survives both commits');

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
    enterEntry(sim, wu, 'discussion', wu);
    sim.write(`.leeway/${wu}/topics/${wu}/log.md`, '# Discussion — Upgraded\n');
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
      `A\t${wu}/topics/${wu}/log.md`,
    ], 'the whole state rides the reviewed commit — the log the session had not yet committed among it');
    assert.deepStrictEqual(git(sim.dir, ['show', '--name-status', '--pretty=format:', 'HEAD']).split('\n').filter(Boolean).sort(), [
      'A\t.worktreeinclude',
      'M\t.claude/settings.json',
      'M\t.gitignore',
    ]);
    assert.strictEqual(git(sim.dir, ['diff', '--cached', '--name-only']).trim(), 'src/app.js', 'the code session\'s staging stays staged');

    // The unit carries on from the upgraded tree.
    sim.write(`.leeway/${wu}/topics/${wu}/log.md`, '# Discussion — Upgraded\n\nCarried on.\n');
    sim.run(['ledger', 'ask', `${wu}.discussion.${wu}`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'What survives the upgrade?' }));
    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain', '--', wu]).trim(), '', 'the question\'s commit carries the log along');
  });

  it('boot: a git below the floor stops at its screen; lost state stops at its screen and the yes starts it again; a GitHub remote gets the rule\'s offer and the squash default\'s once each, and each no is recorded', () => {
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
    assert.deepStrictEqual([restarted.state, restarted.github_rule_offer, restarted.github_squash_offer], ['restarted', false, false]);
    assert.strictEqual(stateGit(sim.dir, ['rev-list', '--max-parents=0', 'leeway-state']).trim().split('\n').length, 1, 'the fresh state is one orphan line');

    // A remote on GitHub, out of reach: boot works on the state it has, and
    // offers the rule, and the squash default its landing on GitHub needs,
    // until each offer is answered.
    git(sim.dir, ['remote', 'add', 'origin', 'git@github.com:acme/portal.git']);
    sim.env = { ...sim.env, ...githubOffline(sim.configDir), GIT_SSH_COMMAND: 'false' };
    const offered = sim.run(['boot']);
    assert.deepStrictEqual([offered.state, offered.github_rule_offer, offered.github_squash_offer], ['ready', true, true]);
    assert.match(sim.render(['github-rule-gate'], { expect: 'content' }), /Set that rule on GitHub\?/);
    assert.strictEqual(sim.run(['github-rule', 'no']).github_rule, 'declined');
    assert.match(sim.render(['github-squash-gate'], { expect: 'content' }), /Squash from the pull request's title and description\?/);
    assert.strictEqual(sim.run(['github-squash', 'no']).github_squash, 'declined');
    const answered = sim.run(['boot']);
    assert.deepStrictEqual([answered.github_rule_offer, answered.github_squash_offer], [false, false]);
    sim.refuses(['github-rule', 'yes'], /an answer is recorded once/);
    sim.refuses(['github-squash', 'no'], /only a yes is taken again/);
  });

});

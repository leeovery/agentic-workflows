'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic map: the discovery map's lifecycle
// through its topics' discussions — a review's back-off, mail reopening a
// decided topic, presence, session labels and the hooks, a topic cancelled
// and reactivated, the map's own verbs — each brief written with its topic,
// a rename, a brief refused once its topic has started, a decided topic
// renamed and a message aimed at its new name, a topic a message names
// landed with its brief, one removed with its mail sent to the inbox, and one
// taking in the roadmap idea of its name — the map deriving after every
// change. What
// the grouping makes of the decided topics is
// test-pipeline-simulation-epic-supersession.cjs.
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
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-epic/scripts/gateway.cjs'));
const DISCOVERY_GATEWAY = require(path.join(ROOT, 'skills/leeway-discovery/scripts/gateway.cjs'));
const {
  epicMenu, epicDashboard,
} = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/epic.cjs'));
const { drawLabel } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/surfaces.cjs'));
const { git, stateGit, GUARD_GROUPS } = require('./engine-harness.cjs');
const {
  Sim, sessionLog, send, carryOn, arrive, handoff, arriveAtEpicMenu, epicPick, backToStart, startNew, enterEntry, decideTopic, discussed,
} = require('./pipeline-world.cjs');

describe('pipeline simulation: epic map', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('epic: map lifecycle, per-topic discussions, mail, presence, cancel/reactivate, the map\'s verbs', () => {
    const wu = 'overhaul';
    startNew(sim, 'epic');
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Payments overhaul', '--session-log-file', log]);
    // The work-type commit opened the session; discovery's run step labels
    // its place, and the conversation carries on from the open session's log.
    assert.strictEqual(sim.run(['session', 'label', wu, 'discovery', wu]).labelled, false);
    const shaping = carryOn(sim);
    assert.deepStrictEqual(shaping.position, { name: wu, phase: 'discovery', topic: wu });
    assert.strictEqual(shaping.skill, path.join(sim.dir, '.claude/skills/leeway-discovery/SKILL.md'));
    assert.deepStrictEqual(shaping.files, [path.join(sim.dir, `.leeway/${wu}/discovery/session-001.md`)]);
    assert.match(shaping.text, /^The conversation was just compacted\. This conversation is working in the discovery of the epic "overhaul"\. /);

    // Harvest: three topics in one batch, each landing with its brief from
    // Claude's draft.
    /** @param {string} topic */
    const draft = (topic) => sim.write(`.leeway/.cache/${wu}/discovery/${topic}/brief-draft.md`, `# Brief — ${topic}\n\nLeans toward a nightly run.\n`);
    const topics = sim.write(`.leeway/.cache/${wu}/discovery/topics.json`, ['alpha', 'beta', 'gamma'].map((name) => ({ name, summary: `${name} summary`, brief: draft(name) })));
    const batch = sim.run(['topic', 'add-batch', wu, '--file', topics]);
    assert.strictEqual(batch.map_total, 3);
    assert.match(sim.sections, /^Added 3 topics to the map: "Alpha", "Beta", "Gamma"\.$/m);
    assert.strictEqual(fs.readFileSync(path.join(sim.dir, `.leeway/${wu}/topics/beta/brief.md`), 'utf8'), '# Brief — beta\n\nLeans toward a nightly run.\n');
    sim.run(['topic', 'order', wu, 'alpha=1', 'beta=2', 'gamma=3']);

    // The menu row is the way into a mapped topic: the d door's gate refuses
    // a name on the map and passes one not on it.
    sim.render(['direct-entry-gate', `${wu}.discussion.alpha`], { expect: 'content' });
    sim.render(['direct-entry-gate', `${wu}.discussion.omega`], { expect: 'empty' });

    // The map's verbs, each at the person's word with its one-line report: an
    // edit, a brief rewritten before its topic starts, and an unstarted
    // topic's rename, which moves its brief with it.
    sim.run(['topic', 'edit', wu, 'gamma', '--summary', 'Gamma, sharpened']);
    sim.run(['topic', 'brief', wu, 'beta', '--brief', draft('beta')]);
    sim.run(['topic', 'rename', wu, 'gamma', 'gamma-prime']);
    assert.match(sim.sections, /^Renamed "Gamma" to "Gamma Prime"\.$/m);
    assert.ok(fs.existsSync(path.join(sim.dir, `.leeway/${wu}/topics/gamma-prime/brief.md`)), 'the brief moved with its topic');
    // The discovery session's cadence commit.
    sim.run(['commit', wu, '--discovery', '-m', `discovery(${wu}): shape the map`]);
    // A session interrupted here resumes from the epic menu, whose discovery
    // row hands the epic back to discovery.
    assert.strictEqual(epicPick(sim, wu, 'continue_discovery').line, `→ Discovery · ${wu}`);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): synthesise 3 topics`]);
    // The discovery hand-off lands on the epic menu — the bridge's discovery
    // continuation into leeway-continue-epic, no banner — which labels the
    // work unit alone on arrival.
    handoff(sim, `/leeway-continue-epic ${wu}`);
    arrive(sim, wu);

    // Alpha: its menu row hands off to its discussion, decided at the
    // decided screen, back on the epic menu.
    assert.strictEqual(epicPick(sim, wu, 'start_discussion', 'alpha').args, `epic ${wu} alpha`);
    discussed(sim, wu, 'alpha');
    assert.match(arriveAtEpicMenu(sim, wu, 'discussion'), /Discussion completed for "Overhaul"\./);
    // The menu's way back: the start menu, the epic still its row.
    assert.ok(backToStart(sim, epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys)
      .some((k) => k.action === 'continue_work_unit' && k.route === `/leeway-continue-epic ${wu}`));

    // Beta discussed to its decided screen, a background review's back-off
    // walked on the way; gamma-prime cancelled mid-flight and reactivated
    // later.
    /** @param {string} topic @param {string} text @param {string} [by] */
    const ask = (topic, text, by = 'claude') => sim.run(['ledger', 'ask', `${wu}.discussion.${topic}`], null,
      JSON.stringify({ by, who_moved_whom: 'none', text })).id;
    /** @param {string} topic @param {string} question @param {string} text */
    const decide = (topic, question, text) => sim.run(['ledger', 'decide', `${wu}.discussion.${topic}`, '--answers', question], null,
      JSON.stringify({ by: 'claude', who_moved_whom: 'none', text, why: 'The record settles it.' }));
    epicPick(sim, wu, 'start_discussion', 'beta');
    enterEntry(sim, wu, 'discussion', 'beta');
    // Started, beta's brief stays as it was written: what bears on it now
    // goes as a message.
    sim.refuses(['topic', 'brief', wu, 'beta', '--brief', draft('beta')], /^topic brief: "beta" started — what bears on it goes as a message$/);
    const retryPolicy = ask('beta', 'Which retry policy?');
    // Review arming: the first background review is free and stamps the
    // ledger's mark; after a completed cycle the next refuses until the topic
    // has moved on the ledger min(cycles, 3) times; --final bypasses the
    // movement gate. Each dispatch is briefed by the engine, its brief
    // naming the dispatch's report.
    const rev1 = sim.run(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review']);
    sim.run(['brief', 'discussion-reviewer', wu, 'beta', '--agent', rev1.id]);
    sim.write(rev1.file, '# Findings\n');
    sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    sim.run(['agent', 'ack', wu, 'discussion', 'beta', rev1.id, '--findings', 'F1']);
    // The finding is a question the review asked, taken as it is surfaced.
    const f1 = ask('beta', 'What does F1 ask?', 'review');
    sim.run(['agent', 'surface', wu, 'discussion', 'beta', rev1.id, 'F1']);
    sim.refuses(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review'],
      /review dispatch blocked: quiet — 0 of 1 moves since review-001/);
    const quietScan = sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    assert.deepStrictEqual(quietScan.review_arming,
      { armed: false, cycles: 1, moves_seen: 0, moves_needed: 1, reason: 'quiet — 0 of 1 moves since review-001' },
      'scan answers the same verdict dispatch enforces');
    const revFinal = sim.run(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review', '--final']);
    assert.strictEqual(revFinal.id, 'review-002', 'a review the person asks for dispatches over a quiet topic');
    sim.run(['brief', 'discussion-reviewer', wu, 'beta', '--agent', revFinal.id]);
    sim.write(revFinal.file, '# Findings\n');
    sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    sim.run(['agent', 'ack', wu, 'discussion', 'beta', revFinal.id, '--clean']);
    // A decision is a move on the ledger; the review the person asked for
    // was a cycle too, so two are owed now.
    decide('beta', retryPolicy, 'Exponential back-off.');
    assert.strictEqual(sim.run(['agent', 'scan', wu, 'discussion', 'beta']).review_arming.reason, 'quiet — 1 of 2 moves since review-002');
    // The closing pass's fresh reader: dispatched with no arming, briefed
    // with the gap review the agent store and the ledger answer.
    const pass = sim.run(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'closing-pass']);
    sim.run(['brief', 'closing-pass-reader', wu, 'beta', '--agent', pass.id]);
    sim.write(pass.file, '# Closing Pass\n');
    sim.run(['agent', 'scan', wu, 'discussion', 'beta']);
    sim.run(['agent', 'ack', wu, 'discussion', 'beta', pass.id, '--clean']);
    decide('beta', f1, 'Nothing more to settle.');
    sim.write(`.leeway/${wu}/topics/beta/log.md`, '# Discussion — Beta\n');
    decideTopic(sim, wu, 'beta');

    // A message reopens the concluded discussion: its mail waits on its rows
    // and holds the review shut; the question it raised answers it, and that
    // question is a move on the back-off like any other.
    sim.write('.leeway/.cache/scratch/message-scratch.md', 'Escalation path\n\nWho gets paged?\n');
    const sent = sim.run(['topic', 'send', wu, 'beta', '--from', 'alpha', '--content', '.leeway/.cache/scratch/message-scratch.md', '--slug', 'escalation-path']);
    assert.strictEqual(sent.reopened, true, 'a delivery to a concluded discussion reopens it');
    // The cue follows the mailbox, not the status: the reopened item is
    // in-progress with no stub to read, yet its rows say what waits — and
    // the answer retires the cue.
    const betaRow = () => drawLabel(epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys
      .find((k) => k.topic === 'beta' && k.action === 'continue_discussion').label);
    assert.strictEqual(betaRow(), 'Continue "Beta" — *discussion* · mail waiting');
    assert.match(epicDashboard(wu, EPIC_GATEWAY.discover(sim.dir, wu)).replace(/\n[ │]+/g, ' '),
      /Discussing · mail waiting/);
    sim.refuses(['agent', 'dispatch', wu, 'discussion', 'beta', '--kind', 'review'],
      /review dispatch blocked/);
    const movesSeen = () => sim.run(['agent', 'scan', wu, 'discussion', 'beta']).review_arming.moves_seen;
    const before = movesSeen();
    const escalation = ask('beta', 'Who gets paged?');
    const answered = sim.run(['topic', 'answered', wu, 'beta', '001-escalation-path', '--entry', escalation]);
    assert.deepStrictEqual([answered.remaining, Boolean(answered.committed)], [0, true]);
    assert.strictEqual(betaRow(), 'Continue "Beta" — *discussion*', 'the answered mailbox retires the cue');
    assert.strictEqual(movesSeen(), before + 1, 'the question the message raised is a move');
    decide('beta', escalation, 'The on-call engineer.');
    decideTopic(sim, wu, 'beta');

    enterEntry(sim, wu, 'discussion', 'gamma-prime');
    sim.run(['topic', 'cancel', wu, 'discovery', 'gamma-prime']);
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.gamma-prime`, '--verb', 'cancel'], { expect: 'content' }),
      /Cancelled "Gamma Prime"\./, 'topic cancel receipt renders from the cancelled unit');
    const cancelled = sim.manifest(wu).phases.discovery.items['gamma-prime'];
    assert.strictEqual(cancelled.cancelled, true, 'the map row carries the marker');
    assert.ok(!('order' in cancelled), 'cancel stashes the map order');
    assert.strictEqual(cancelled.previous_order, 3);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items['gamma-prime'].status, 'cancelled', 'the discussion goes with the topic');
    sim.run(['topic', 'reactivate', wu, 'discovery', 'gamma-prime']);
    assert.match(sim.render(['topic-receipt', `${wu}.discovery.gamma-prime`, '--verb', 'reactivate'], { expect: 'content' }),
      /Reactivated "Gamma Prime"\. Restored discussion \[in-progress\]\./, 'topic reactivate receipt names what returned');
    assert.strictEqual(sim.manifest(wu).phases.discovery.items['gamma-prime'].order, 3,
      'reactivate restores the map order');
    assert.strictEqual(sim.manifest(wu).phases.discovery.items['gamma-prime'].cancelled, undefined, 'the marker is gone');
    sim.run(['topic', 'cancel', wu, 'discovery', 'gamma-prime']);

    // Delta: an off-topic message sent from alpha parks on a topic not yet
    // talked through — its discussion created, not started; the send is one
    // self-committing transaction (engine-numbered message file, scratch
    // consumed, commit confined to message + manifest).
    sim.run(['topic', 'add', wu, 'delta', '--source', 'message:alpha', '--summary', 'Delta summary', '--brief', draft('delta'), '--re-add']);
    sim.write('.leeway/.cache/scratch/message-scratch.md', 'Parked message\n\nDetails.\n');
    const parked = sim.run(['topic', 'send', wu, 'delta', '--from', 'alpha', '--content', '.leeway/.cache/scratch/message-scratch.md', '--slug', 'parked-message']);
    assert.strictEqual(parked.message_path, path.join(sim.dir, `.leeway/${wu}/topics/delta/mail/001-parked-message.md`));
    assert.deepStrictEqual(sim.manifest(wu).phases.discussion.items.delta, { status: 'unstarted' });
    assert.ok(parked.committed, 'the send self-commits');
    assert.ok(!fs.existsSync(path.join(sim.dir, '.leeway/.cache/scratch/message-scratch.md')), 'scratch consumed');
    const mailbox = sim.run(['topic', 'mailbox', wu, 'delta']);
    assert.strictEqual(mailbox.count, 1);
    assert.deepStrictEqual(mailbox.files, [parked.message_path], 'the read verb lists the delivered message');
    // The mailbox read is reachable for any topic — a session checking a
    // foreign mailbox must not manufacture a hold there. No verb has yet
    // acted on delta from this session, so the read stamps nothing.
    assert.ok(!fs.existsSync(path.join(sim.dir, `.leeway/.cache/${wu}/discussion/delta/presence`)),
      'a mailbox read never creates a heartbeat');
    // topic answered — the send's mirror: send a second message, answer it
    // by the question it raised, and the self-committing response answers
    // what remains.
    sim.write('.leeway/.cache/scratch/message-scratch.md', 'Second parked\n\nMore.\n');
    sim.run(['topic', 'send', wu, 'delta', '--from', 'alpha', '--content', '.leeway/.cache/scratch/message-scratch.md', '--slug', 'second-parked']);
    const more = sim.run(['ledger', 'ask', `${wu}.discussion.delta`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'More?' }));
    const cleared = sim.run(['topic', 'answered', wu, 'delta', '002-second-parked', '--entry', more.id]);
    assert.strictEqual(cleared.answered, '002-second-parked.md');
    assert.strictEqual(cleared.remaining, 1, 'the answer answers the post-removal count');
    assert.ok(cleared.committed, 'answered self-commits');
    assert.ok(!fs.existsSync(path.join(sim.dir, `.leeway/${wu}/topics/delta/mail/002-second-parked.md`)), 'message file removed');
    assert.ok(fs.existsSync(path.join(sim.dir, `.leeway/.cache/${wu}/discussion/delta/presence`)),
      'the write-shaped verb is what claims the slot');
    // The raise's display surfaces: the fresh-sitting notice, the offer gate
    // (agenda payload validated against the live mailbox), and the conclusion
    // blocker — the entry itself is read by the session, never rendered.
    sim.write('.leeway/.cache/scratch/mail-offer.json', JSON.stringify({
      items: [{ file: '001-parked-message.md', title: 'Parked message', from: 'From Alpha · 23 Jul' }],
    }));
    sim.render(['mail-announce', `${wu}.discussion.delta`], { expect: 'content' });
    sim.render(['mail-offer', `${wu}.discussion.delta`, '--file', '.leeway/.cache/scratch/mail-offer.json'], { expect: 'content' });
    sim.render(['mail-block', `${wu}.discussion.delta`], { expect: 'content' });
    // Presence: heartbeats are mechanical, so the verbs already run on this
    // work unit's topics have stamped them — no prose ever beats.
    const rowOf = (scan, phase, topic) => scan.sessions.find((r) => r.phase === phase && r.topic === topic);
    assert.ok(rowOf(sim.run(['presence', 'scan', wu]), 'discussion', 'delta'),
      'the verbs a session runs on its own topic leave a heartbeat behind');
    // A beat reads held (deferral territory for the bridge, in-session
    // territory for the epic view); the orderly clear drops it.
    sim.run(['presence', 'beat', wu, 'discussion', 'alpha']);
    const present = sim.run(['presence', 'scan', wu]);
    assert.strictEqual(rowOf(present, 'discussion', 'alpha').held, true);
    assert.ok(!('live' in rowOf(present, 'discussion', 'alpha')), 'held is the one verdict — idle time is shown, never judged');
    assert.strictEqual(present.held_sources, 0, 'a session\'s own rows never defer it');
    assert.strictEqual(sim.sections, '', 'and no deferral section rides its scan');
    sim.run(['presence', 'clear', wu, 'discussion', 'alpha']);
    assert.strictEqual(rowOf(sim.run(['presence', 'scan', wu]), 'discussion', 'alpha'), undefined);
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
    // refuses a Write to the ledger and lets one to a manifest through, the
    // brief hook before every dispatch, and the shell hook before every shell
    // command, which refuses a raw commit in the state worktree and lets the
    // engine's own commands through.
    const label0 = sim.run(['session', 'label', wu, 'discussion', 'alpha']);
    assert.deepStrictEqual(label0, { ok: true, labelled: false, reason: 'disabled' });
    sim.refuses(['session', 'label', wu, 'deploying', 'alpha'], /unknown phase/);
    sim.run(['session', 'label-config', 'true']);
    assert.strictEqual(sim.read(['manifest', 'get', 'project.defaults.tmux_labels']), 'true');
    const verbOf = (/** @type {{command: string}} */ h) => h.command.slice(h.command.indexOf('engine.cjs"'));
    const hookVerbs = () => Object.fromEntries(
      Object.entries(JSON.parse(fs.readFileSync(path.join(sim.dir, '.claude', 'settings.json'), 'utf8')).hooks)
        .map(([event, groups]) => [event, groups.flatMap((g) => g.hooks.map(verbOf))]));
    const guardVerbs = GUARD_GROUPS.flatMap((g) => g.hooks.map(verbOf));
    assert.deepStrictEqual(hookVerbs(), {
      SessionEnd: ['engine.cjs" session cleanup', 'engine.cjs" presence cleanup', 'engine.cjs" conversation end'],
      SessionStart: ['engine.cjs" session resume'],
      PreToolUse: guardVerbs,
    }, 'the opt-in installs the session hooks on both events, beside the layout, brief and shell hooks');
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
    for (const name of [wu, 'roadmap', 'product']) {
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
      PreToolUse: guardVerbs,
    }, 'opting out leaves the workflows\' own in place');
    const beforeWrite = (/** @type {string} */ rel) => sim.engine(['layout', 'guard'], null, JSON.stringify({
      hook_event_name: 'PreToolUse', cwd: sim.dir, tool_name: 'Write', tool_input: { file_path: path.join(sim.dir, '.leeway', rel), content: '' },
    }));
    assert.strictEqual(beforeWrite('.ledger.jsonl').code, 2, 'the ledger is the engine\'s alone');
    assert.strictEqual(beforeWrite('manifest.json').code, 2, 'and so is the project manifest');
    assert.deepStrictEqual(beforeWrite(`${wu}/topics/alpha/log.md`), { stdout: '', stderr: '', code: 0 }, 'the log the session writes next is in the layout');
    const beforeBash = (/** @type {string} */ command) => sim.engine(['shell', 'guard'], null, JSON.stringify({
      hook_event_name: 'PreToolUse', cwd: sim.dir, tool_name: 'Bash', tool_input: { command },
    }));
    assert.strictEqual(beforeBash('cd .leeway && git commit -am x').code, 2, 'every state commit is the engine\'s');
    assert.deepStrictEqual(beforeBash(`node .claude/skills/leeway-engine/scripts/engine.cjs commit ${wu} -m x`), { stdout: '', stderr: '', code: 0 });
    const reparked = send(sim, wu, 'delta', 'alpha', 'third-parked');
    assert.strictEqual(reparked.message_path, path.join(sim.dir, `.leeway/${wu}/topics/delta/mail/002-third-parked.md`));
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.delta.status, 'unstarted');
    // Beta renamed once decided goes by the new name, its key kept: a message
    // the person aims at that name finds beta's row on the map's reader by
    // the name it goes by, as sending-a-message reads it. Landing on a decided
    // discussion reopens it to receive the entry: the question the message
    // raised is answered, and the topic is decided again.
    sim.run(['topic', 'rename', wu, 'beta', 'retry-rules']);
    assert.match(sim.sections, /^Renamed "Beta" to "Retry Rules"\.$/m);
    const rows = DISCOVERY_GATEWAY.format(DISCOVERY_GATEWAY.discover(sim.dir, wu)).split('\n');
    const [, target] = /** @type {RegExpExecArray} */ (/^ {2}- \S+ (\S+) \[\w+\] goes_by=retry-rules /.exec(/** @type {string} */ (rows.find((line) => line.includes(' goes_by=retry-rules ')))));
    assert.strictEqual(target, 'beta');
    const reopened = send(sim, wu, target, 'alpha', 'retry-policy');
    assert.strictEqual(reopened.reopened, true);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.beta.status, 'in-progress');
    const retry = ask('beta', 'Does the retry policy still hold?');
    sim.run(['topic', 'answered', wu, 'beta', '001-retry-policy', '--entry', retry]);
    decide('beta', retry, 'It holds.');
    decideTopic(sim, wu, 'beta');

    // The topic's cancel/reactivate round-trips the stub.
    sim.run(['topic', 'cancel', wu, 'discovery', 'delta']);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.delta.previous_status, 'unstarted');
    sim.run(['topic', 'reactivate', wu, 'discovery', 'delta']);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.delta.status, 'unstarted');
    // The d door refuses delta like any mapped name. The ledger names it now,
    // so it leaves the map only by its cancel.
    sim.render(['direct-entry-gate', `${wu}.discussion.delta`], { expect: 'content' });
    sim.refuses(['topic', 'remove', wu, 'delta'], /^"delta" can't be removed — the ledger holds entries on it, which name it for good; cancel from the epic menu instead$/);

    // Epsilon: a topic a message names that the map lacks, landed with a
    // brief drawn from the message, then removed before anyone starts it —
    // its waiting message an idea in the inbox, which its report names, its
    // name struck from the map; a later send to it lands in the inbox too.
    sim.run(['topic', 'add', wu, 'epsilon', '--source', 'message:alpha', '--summary', 'Epsilon summary', '--brief', draft('epsilon'), '--re-add']);
    send(sim, wu, 'epsilon', 'alpha', 'stray-thought');
    const removed = sim.run(['topic', 'remove', wu, 'epsilon']);
    assert.match(sim.sections, /^Removed "Epsilon" from the map\. Its 1 waiting message went to the inbox as an idea\.$/m);
    assert.deepStrictEqual(removed.inbox.map((file) => path.relative(sim.dir, file).replace(/\d{4}-\d{2}-\d{2}/, 'DATE')), ['.leeway/.inbox/ideas/DATE--stray-thought.md']);
    assert.deepStrictEqual([fs.existsSync(path.join(sim.dir, `.leeway/${wu}/topics/epsilon`)), sim.manifest(wu).phases.discovery.dismissed], [false, ['epsilon']]);
    assert.ok(send(sim, wu, 'epsilon', 'alpha', 'late-thought').inbox_path, 'a send to a removed topic goes to the inbox');

    // Zeta: a topic a message names that waits on the roadmap as an idea of
    // its name. The add refuses to stand beside it, and lands again taking it
    // in, as create-discovery-topic does.
    sim.run(['roadmap', 'horizon', 'add', 'later']);
    sim.run(['roadmap', 'add', 'zeta', '--horizon', 'later', '--summary', 'Zeta, waiting']);
    const zeta = ['topic', 'add', wu, 'zeta', '--source', 'message:alpha', '--summary', 'Zeta summary', '--brief', draft('zeta'), '--re-add'];
    sim.refuses(zeta, /^topic add: "zeta" would stand beside the waiting roadmap item of its name — take it in with --from-roadmap zeta, or name the topic apart$/);
    assert.strictEqual(sim.run([...zeta, '--from-roadmap', 'zeta']).from_roadmap, 'zeta');
    send(sim, wu, 'zeta', 'alpha', 'roadmap-thought');
  });
});

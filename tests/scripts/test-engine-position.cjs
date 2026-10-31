'use strict';

//
// Tests for the conversation's position (domain/position.cjs): what every
// arrival records in the conversation's folder, labels on or off — a phase,
// a work unit's menu, the project-level places — a place this project lacks
// refused, marking the conversation first where the call runs in a
// workflows project, and nothing without a session id; the task `task
// start` adds and its `task complete` takes off; the executor the gate mod's
// `conversation executor` adds beside a task in flight, riding with that task
// alone; the start menu's repair dropping it; and `conversation position`,
// which answers what to re-read to carry on there: the skill that runs the
// work, then the topic's documents this project has, each by its absolute
// path under the project root, as the note a compaction hands up and one line
// of JSON for the gate mod — nothing from a place no longer open, or one
// whose skill the project lacks. A discussion's note carries its recovery
// whole (24.2.6): the topic's record and its log, the log caught up from the
// conversation's transcript, and the line its next write opens with where
// the log does not name the conversation yet, or another conversation has
// written since (24.S10, 9.S67); so does
// discovery's, at an epic its map and its open log, at the product's
// conversation its open log (24.S19, 8.S67); every other phase's sends
// Claude to its skill's own steps.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { skillAt } = require('../../skills/leeway-engine/scripts/domain/position.cjs');
const { OPENING_SKILLS } = require('../../skills/leeway-engine/scripts/domain/handoff.cjs');
const { PROJECT_IDENTITIES, VALID_PHASES } = require('../../skills/leeway-engine/scripts/kernel/manifest-schema.cjs');

// The phases whose note carries the recovery whole, their skills keeping no
// steps of their own for it.
const WHOLE = ['discussion', 'discovery'];

let dir; // a workflows project
let config; // this test's system config directory
let claude; // this test's Claude Code config directory

/** The engine as the conversation `sessionId` runs it — null runs it with no id. */
function env(sessionId = 'sess-1') {
  return { LEEWAY_CONFIG_DIR: config, CLAUDE_CONFIG_DIR: claude, CLAUDE_CODE_SESSION_ID: sessionId ?? undefined, TMUX: undefined, TMUX_PANE: undefined };
}

/** A call that must succeed, its response line parsed. */
function ok(args, sessionId) {
  return harness.ok(dir, args, { env: env(sessionId) });
}

/** The conversation's folder. */
function folder(sessionId = 'sess-1') {
  return path.join(config, 'conversations', sessionId);
}

/** The position recorded for a conversation, or null. */
function position(sessionId = 'sess-1') {
  try { return JSON.parse(fs.readFileSync(path.join(folder(sessionId), 'position.json'), 'utf8')); } catch { return null; }
}

/** Hand-write a position, its conversation marked. */
function writePosition(record, sessionId = 'sess-1') {
  fs.mkdirSync(folder(sessionId), { recursive: true });
  fs.writeFileSync(path.join(folder(sessionId), 'workflow'), '');
  fs.writeFileSync(path.join(folder(sessionId), 'position.json'), JSON.stringify(record));
}

/** Mark a conversation as the engine does: any call it makes in the project. */
function mark(sessionId = 'sess-1') {
  harness.output(dir, ['manifest', 'exists', 'pay'], { env: env(sessionId) });
}

/** A file in the project, its directory made. */
function write(rel, content = '# content\n') {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), content);
  return rel;
}

/** A file of the project, by its absolute path. */
function abs(rel) {
  return path.join(dir, rel);
}

/** A skill installed in the project, as its SKILL.md. */
function install(skill) {
  return write(`.claude/skills/${skill}/SKILL.md`, `# ${skill}\n`);
}

/** A work unit's manifest, its `phases` given. */
function workUnit(name, workType, phases = {}, extra = {}) {
  write(`.leeway/${name}/manifest.json`, JSON.stringify({ name, work_type: workType, status: 'in-progress', phases, ...extra }, null, 2));
}

/** `conversation position`'s answer: the DATA text and the parsed POSITION line. */
function reads(args = [], sessionId = 'sess-1') {
  const out = harness.output(dir, ['conversation', 'position', ...args], { env: env(sessionId) });
  const marker = '=== POSITION (json for the gate mod — never display) ===\n';
  const data = '=== DATA (reason from this — never display or parse the sections below) ===\n';
  assert.ok(out.startsWith(data), out);
  const at = out.indexOf(marker);
  assert.ok(at !== -1, out);
  const json = JSON.parse(out.slice(at + marker.length).trim());
  assert.strictEqual(out.slice(data.length, at), `${json.text}\n`, 'the DATA section is the message the JSON carries');
  return json;
}

beforeEach(() => {
  dir = harness.setupGitFixture('engine-position-');
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-position-config-'));
  claude = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-position-claude-'));
  workUnit('pay', 'epic', {
    implementation: { items: { ledger: { status: 'in-progress', current_task: null, fix_attempts: 0 } } },
    planning: { items: { ledger: { status: 'completed', format: 'flat-files' } } },
  });
  mark();
});

afterEach(() => {
  for (const d of [dir, config, claude]) fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('the position every arrival records', () => {
  it('records each place the label calls name, labels off — a phase, a work unit, the project-level places', () => {
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'discussion', topic: 'ledger' });
    ok(['session', 'label', 'pay']);
    assert.deepStrictEqual(position(), { name: 'pay' });
    for (const name of ['roadmap', 'baseline']) {
      ok(['session', 'label', name]);
      assert.deepStrictEqual(position(), { name });
    }
  });

  it('a conversation\'s first call records its place, marking the conversation — a handoff\'s new conversation arrives before any other call', () => {
    assert.ok(!fs.existsSync(folder('sess-new')), 'no call has marked it');
    ok(['session', 'label', 'roadmap'], 'sess-new');
    assert.ok(fs.existsSync(path.join(folder('sess-new'), 'workflow')), 'the label marked the conversation');
    assert.deepStrictEqual(position('sess-new'), { name: 'roadmap' });
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3'], 'sess-task');
    assert.ok(fs.existsSync(path.join(folder('sess-task'), 'workflow')), 'task start marked the conversation');
    assert.deepStrictEqual(position('sess-task'), { name: 'pay', phase: 'implementation', topic: 'ledger', task: '2.3' });
  });

  it('no session id records nothing', () => {
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    ok(['session', 'label', 'pay', 'review', 'ledger'], null);
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3'], null);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'discussion', topic: 'ledger' });
  });

  it('a call run outside a workflows project records nothing and marks nothing', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-position-outside-'));
    try {
      harness.ok(outside, ['session', 'label', 'roadmap'], { env: env('sess-out') });
      assert.ok(!fs.existsSync(folder('sess-out')), 'no folder for a conversation that never ran in a workflows project');
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('refuses a place this project lacks, labels off, keeping the last one — a missing work unit, an unknown phase, an identity with a phase, an illegal name', () => {
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    const missing = (name) => `no work unit directory: ${abs(`.leeway/${name}`)}`;
    for (const [args, error] of [
      [['ghost'], missing('ghost')],
      [['pay', 'deploying', 'ledger'], /^unknown phase "deploying" — one of /],
      [['ghost', 'discussion', 'ledger'], missing('ghost')],
      [['roadmap', 'discovery', 'roadmap'], missing('roadmap')],
      [['pay', 'discussion', 'led.ger'], /^"led\.ger" is not a legal topic name/],
      [['p.ay'], /^"p\.ay" is not a legal work unit name/],
    ]) {
      const refused = harness.refuses(dir, ['session', 'label', ...args], { env: env() }).error;
      if (typeof error === 'string') assert.strictEqual(refused, error, args.join(' '));
      else assert.match(refused, error, args.join(' '));
    }
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'discussion', topic: 'ledger' });
  });

  it('task start adds the task in flight; that task\'s complete takes it off, another\'s leaves it', () => {
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'ledger', task: '2.3' });
    ok(['task', 'complete', 'pay', 'ledger', 'ledger-1-1']);
    assert.strictEqual(position().task, '2.3', 'an out-of-band completion of another task');
    ok(['task', 'complete', 'pay', 'ledger', 'ledger-2-3', '--next-task', '~']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'ledger' });
  });

  it('a task completed by its external id comes off as its internal id would', () => {
    workUnit('pay', 'epic', {
      implementation: { items: { ledger: { status: 'in-progress', current_task: null, fix_attempts: 0 } } },
      planning: { items: { ledger: { status: 'completed', format: 'flat-files', task_map: { 'ledger-2-3': 'EXT-7' } } } },
    });
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
    ok(['task', 'complete', 'pay', 'ledger', '--external', 'EXT-7', '--next-task', '~']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'ledger' });
  });

  it('a re-label of the same implementation keeps the task; arriving anywhere else leaves none behind', () => {
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    assert.strictEqual(position().task, '2.3');
    ok(['session', 'label', 'pay']);
    assert.deepStrictEqual(position(), { name: 'pay' });
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'ledger' }, 'no task until task start');
  });

  it('task start writes the whole position — the conversation is in that implementation, on that task', () => {
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    ok(['task', 'start', 'pay', 'ledger', 'ledger-1-4']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'ledger', task: '1.4' });
  });

  it('the start menu is no position: repair takes the calling conversation\'s own off, labels off, and leaves another\'s', () => {
    writePosition({ name: 'pay' }, 'sess-2');
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    assert.deepStrictEqual(ok(['session', 'repair']), { ok: true, repaired: false });
    assert.strictEqual(position(), null);
    assert.deepStrictEqual(position('sess-2'), { name: 'pay' });
  });

  it('a position that cannot be written never fails the verb', () => {
    fs.mkdirSync(path.join(folder(), 'position.json'));
    assert.deepStrictEqual(ok(['session', 'label', 'pay', 'discussion', 'ledger']), { ok: true, labelled: false, reason: 'disabled' });
    assert.strictEqual(ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']).task, 'ledger-2-3');
  });
});

describe('the executor the gate mod records', () => {
  const AGENT = 'aa76bd7f82a2ef3e4';

  /** The gate mod's call as it sees the executor dispatched, its answer parsed. */
  function executor(agentId = AGENT, sessionId = 'sess-1') {
    return ok(['conversation', 'executor', sessionId, agentId], null);
  }

  /** The conversation in that implementation, on task 2.3, its executor recorded. */
  function onTask() {
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
    assert.deepStrictEqual(executor(), { ok: true, recorded: true });
  }

  it('records the agent id beside the task in flight', () => {
    onTask();
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'ledger', task: '2.3', executor: AGENT });
  });

  it('records nothing without a task in flight — no position, another phase, an implementation between tasks', () => {
    assert.deepStrictEqual(executor(AGENT, 'sess-none'), { ok: true, recorded: false });
    assert.strictEqual(position('sess-none'), null);
    for (const place of [['pay', 'discussion', 'ledger'], ['pay'], ['pay', 'implementation', 'ledger']]) {
      ok(['session', 'label', ...place]);
      const before = position();
      assert.deepStrictEqual(executor(), { ok: true, recorded: false }, place.join(' '));
      assert.deepStrictEqual(position(), before, place.join(' '));
    }
  });

  it('records on the conversation it names, never the calling one', () => {
    onTask();
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3'], 'sess-2');
    const calling = position();
    assert.deepStrictEqual(ok(['conversation', 'executor', 'sess-2', 'ab12'], 'sess-1'), { ok: true, recorded: true });
    assert.strictEqual(position('sess-2').executor, 'ab12');
    assert.deepStrictEqual(position(), calling, 'the calling conversation\'s position is untouched');
  });

  it('a later dispatch for the same task replaces it', () => {
    onTask();
    executor('ab12');
    assert.strictEqual(position().executor, 'ab12');
  });

  it('task start re-run for the task in flight keeps it; another task starts without one', () => {
    onTask();
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
    assert.strictEqual(position().executor, AGENT, 'the recovery steps re-run task start for the task in flight');
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-4']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'ledger', task: '2.4' });
  });

  it('task start for the same step in another implementation starts without one', () => {
    workUnit('pay', 'epic', {
      implementation: { items: {
        ledger: { status: 'in-progress', current_task: null, fix_attempts: 0 },
        refunds: { status: 'in-progress', current_task: null, fix_attempts: 0 },
      } },
    });
    onTask();
    ok(['task', 'start', 'pay', 'refunds', 'refunds-2-3']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'refunds', task: '2.3' });
  });

  it('the task\'s completion takes it off with the task', () => {
    onTask();
    ok(['task', 'complete', 'pay', 'ledger', 'ledger-1-1']);
    assert.strictEqual(position().executor, AGENT, 'another task\'s completion leaves it');
    ok(['task', 'complete', 'pay', 'ledger', 'ledger-2-3', '--next-task', '~']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'ledger' });
  });

  it('a re-label of the same implementation keeps it; arriving anywhere else leaves none behind', () => {
    onTask();
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    assert.strictEqual(position().executor, AGENT);
    ok(['session', 'label', 'pay']);
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
    assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'ledger', task: '2.3' });
  });

  it('a stored executor that does not read as an agent id is ignored, never carried on', () => {
    install('leeway-implementation-process');
    for (const stored of ['a b', '../x', '`x`', '', 7, null, ['a1']]) {
      writePosition({ name: 'pay', phase: 'implementation', topic: 'ledger', task: '2.3', executor: stored });
      const answer = reads();
      assert.deepStrictEqual(answer.position, { name: 'pay', phase: 'implementation', topic: 'ledger', task: '2.3' }, JSON.stringify(stored));
      assert.doesNotMatch(answer.text, /executor/, JSON.stringify(stored));
      ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
      assert.deepStrictEqual(position(), { name: 'pay', phase: 'implementation', topic: 'ledger', task: '2.3' }, JSON.stringify(stored));
    }
  });

  it('refuses an agent id that is not one, a missing argument, and an extra one, recording nothing', () => {
    onTask();
    const usage = /^Usage: engine conversation executor <session-id> <agent-id> — the agent id letters, digits, - and _ alone$/;
    for (const args of [['sess-1', 'a b'], ['sess-1', '../x'], ['sess-1', 'a`b'], ['sess-1', ''], ['sess-1'], [], ['', AGENT], ['sess-1', AGENT, 'x']]) {
      assert.match(harness.refuses(dir, ['conversation', 'executor', ...args], { env: env(null) }).error, usage, JSON.stringify(args));
    }
    assert.strictEqual(position().executor, AGENT);
  });

  it('a position that cannot be written records nothing, the file left as it was', () => {
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
    const file = path.join(folder(), 'position.json');
    const before = fs.readFileSync(file, 'utf8');
    fs.chmodSync(folder(), 0o555);
    try {
      assert.deepStrictEqual(executor(), { ok: true, recorded: false });
    } finally {
      fs.chmodSync(folder(), 0o755);
    }
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before);
  });
});

describe('conversation position', () => {
  /** The note for a skill that runs the work and the files after it. */
  function note(where, skill, files) {
    const follow = `The conversation was just compacted. This conversation is working in ${where}. Follow the ${skill} skill's "Resuming After Context Refresh" steps now, before anything else: re-read ${abs(`.claude/skills/${skill}/SKILL.md`)} and its framework in full`;
    return files.length > 0 ? [`${follow}, then re-read these in full:`, ...files.map((f) => `- ${abs(f)}`)].join('\n') : `${follow}.`;
  }

  it('names only skills that open a conversation — a phase\'s own, discovery\'s, a project place\'s; none at a work unit\'s menu — each its note sends Claude to carrying the recovery steps', () => {
    const skills = [...VALID_PHASES.map((phase) => skillAt('pay', phase)), ...PROJECT_IDENTITIES.map((name) => skillAt(name))];
    assert.strictEqual(skills.length, 12);
    for (const skill of skills) assert.ok(skill !== null && OPENING_SKILLS.includes(skill), `${skill} is a skill a conversation opens on`);
    const whole = WHOLE.map((phase) => skillAt('pay', phase));
    for (const skill of skills.filter((named) => !whole.includes(named))) {
      const file = path.join(__dirname, '../../skills', skill, 'SKILL.md');
      assert.ok(fs.existsSync(file), `${skill} exists`);
      const text = fs.readFileSync(file, 'utf8');
      const at = text.indexOf('\n## Resuming After Context Refresh\n');
      assert.ok(at !== -1, `${skill} carries the recovery steps`);
      const recovery = text.slice(at, text.indexOf('\n---\n', at));
      const steps = recovery.split('\n').filter((line) => /^\d+\. /.test(line));
      assert.match(steps[steps.length - 1], /^\d+\. \*\*Carry on from where the conversation was\*\*, as if the break never happened — no recap and no announcement\. Where the person's message is waiting, take it at the (step|stage) it arrived at, unless it only asks to carry on\. /,
        `${skill}'s recovery ends by carrying on`);
      assert.doesNotMatch(recovery, /announce your position|wait for confirmation|position is confirmed/i, `${skill}'s recovery waits on nobody`);
      assert.match(recovery, /\nDo not guess at progress or continue from memory\./, `${skill}'s recovery reads state from disk`);
    }
    assert.strictEqual(skillAt('pay'), null);
  });

  it('a conversation with no position has nothing to carry on from', () => {
    assert.deepStrictEqual(reads(), {
      session_id: 'sess-1',
      position: null,
      place: null,
      skill: null,
      files: [],
      text: 'This conversation holds no workflow position, so there is nothing to carry on from.',
    });
  });

  it('a work unit\'s menu carries nothing on: nothing to carry on from, the position named', () => {
    install('leeway-continue-epic');
    ok(['session', 'label', 'pay']);
    assert.deepStrictEqual(reads(), {
      session_id: 'sess-1',
      position: { name: 'pay' },
      place: 'pay',
      skill: null,
      files: [],
      text: 'This conversation is at the epic "pay", outside any phase, so there is nothing to carry on from.',
    });
  });

  /** A discussion's note: its log named where written, the transcript found or not, the log's header line owed or not — again where the conversation wrote there before another. */
  function topicNote(where, unit, topic, { log = false, transcript = null, header = null, again = false } = {}) {
    const logFile = abs(`.leeway/${unit}/topics/${topic}/log.md`);
    return [
      `The conversation was just compacted. This conversation is working in ${where}. Before anything else, re-read these in full, running each engine call:`,
      `- ${abs('.claude/skills/leeway-discussion-process/SKILL.md')} and its framework`,
      `- \`node .claude/skills/leeway-engine/scripts/engine.cjs ledger record ${unit} ${topic}\``,
      ...(log ? [`- ${logFile}`] : []),
      transcript === null
        ? 'This conversation\'s transcript cannot be found: say so in one line, and carry on from the log.'
        : `Catch the log, ${logFile}, up from this conversation's transcript, ${transcript}, from the log's last write onward.`,
      ...(header === null ? [] : [again
        ? `Another conversation has written to the log since this one did: its next write opens with this line again: \`${header}\``
        : `This conversation has not written to the log yet: its first write opens with this line: \`${header}\``]),
      'Then carry on from where the conversation was, as if the break never happened — no recap and no announcement.',
    ].join('\n');
  }

  /** The conversation's transcript, where Claude Code keeps it. */
  function transcript(sessionId = 'sess-1') {
    const file = path.join(claude, 'projects', '-Users-person-pay', `${sessionId}.jsonl`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
    return file;
  }

  it('a discussion carries its recovery whole: the skill, the topic\'s record and its log, the log caught up from the conversation\'s transcript (24.S10)', () => {
    install('leeway-discussion-process');
    write('.leeway/pay/topics/ledger/log.md', '## 2026-01-01 · session sess-1\n\nWhere it stands.\n');
    const file = transcript();
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    const answer = reads();
    assert.deepStrictEqual([answer.position, answer.place, answer.skill, answer.files], [
      { name: 'pay', phase: 'discussion', topic: 'ledger' }, 'pay › discussion › ledger',
      abs('.claude/skills/leeway-discussion-process/SKILL.md'), [abs('.leeway/pay/topics/ledger/log.md')],
    ]);
    assert.strictEqual(answer.text, topicNote('the discussion of "ledger" in the epic "pay"', 'pay', 'ledger', { log: true, transcript: file }));
  });

  it('a discussion whose log does not name the conversation yet: the line its first write opens with, and a transcript gone said in one line; and one another conversation has written since: the line again (9.S67)', () => {
    install('leeway-discussion-process');
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    const today = harness.FROZEN_AT.slice(0, 10);
    const unwritten = harness.withFrozenClock(() => reads());
    assert.deepStrictEqual(unwritten.files, []);
    assert.strictEqual(unwritten.text, topicNote('the discussion of "ledger" in the epic "pay"', 'pay', 'ledger', { header: `## ${today} · session sess-1` }));
    write('.leeway/pay/topics/ledger/log.md', '## 2026-01-01 · session sess-2\n');
    const file = transcript();
    assert.strictEqual(harness.withFrozenClock(() => reads()).text, topicNote('the discussion of "ledger" in the epic "pay"', 'pay', 'ledger', {
      log: true, transcript: file, header: `## ${today} · session sess-1 · transcript ${file}`,
    }), 'another conversation\'s write leaves this one\'s line owed');
    write('.leeway/pay/topics/ledger/log.md', '## 2026-01-01 · session sess-1\n\nMine.\n\n## 2026-01-02 · session sess-2\n\nTheirs.\n');
    assert.strictEqual(harness.withFrozenClock(() => reads()).text, topicNote('the discussion of "ledger" in the epic "pay"', 'pay', 'ledger', {
      log: true, transcript: file, header: `## ${today} · session sess-1 · transcript ${file}`, again: true,
    }), 'the log\'s last line naming another, this conversation\'s is owed again');
  });

  it('names the work unit by its work type, the topic collapsed where it is the work unit', () => {
    workUnit('auth', 'feature');
    install('leeway-discussion-process');
    write('.leeway/auth/topics/auth/log.md', '## 2026-01-01 · session sess-1\n');
    ok(['session', 'label', 'auth', 'discussion', 'auth']);
    const answer = reads();
    assert.strictEqual(answer.text, topicNote('the discussion of the feature "auth"', 'auth', 'auth', { log: true }));
    assert.strictEqual(answer.place, 'auth › discussion');
  });

  it('an implementation task: the skill, the plan format\'s reading adapter, and the task\'s file where the plan keeps one', () => {
    install('leeway-implementation-process');
    write('.claude/skills/leeway-planning-process/references/output-formats/flat-files/reading.md');
    write('.leeway/pay/planning/ledger/planning.md');
    write('.leeway/pay/planning/ledger/tasks/ledger-2-3.md');
    write('.leeway/pay/planning/ledger/tasks/ledger-2-4.md');
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
    const answer = reads();
    assert.deepStrictEqual(answer.files, [
      abs('.claude/skills/leeway-planning-process/references/output-formats/flat-files/reading.md'),
      abs('.leeway/pay/planning/ledger/tasks/ledger-2-3.md'),
    ]);
    assert.strictEqual(answer.text, [
      `The conversation was just compacted. This conversation is working in the implementation of "ledger" in the epic "pay", on task 2.3 (internal id \`ledger-2-3\`). Follow the leeway-implementation-process skill's "Resuming After Context Refresh" steps now, before anything else: re-read ${dir}/.claude/skills/leeway-implementation-process/SKILL.md and its framework in full, then re-read these in full:`,
      `- ${dir}/.claude/skills/leeway-planning-process/references/output-formats/flat-files/reading.md`,
      `- ${dir}/.leeway/pay/planning/ledger/tasks/ledger-2-3.md`,
    ].join('\n'));
    assert.strictEqual(answer.place, 'pay › implementation › ledger');
  });

  it('an implementation task with its executor recorded: the note names the agent its later rounds continue', () => {
    install('leeway-implementation-process');
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
    ok(['conversation', 'executor', 'sess-1', 'aa76bd7f82a2ef3e4'], null);
    const answer = reads();
    assert.deepStrictEqual(answer.position, { name: 'pay', phase: 'implementation', topic: 'ledger', task: '2.3', executor: 'aa76bd7f82a2ef3e4' });
    assert.strictEqual(answer.place, 'pay › implementation › ledger');
    assert.strictEqual(answer.text, note('the implementation of "ledger" in the epic "pay", on task 2.3 (internal id `ledger-2-3`), its executor agent `aa76bd7f82a2ef3e4`', 'leeway-implementation-process', []));
  });

  it('an implementation task whose plan names no format, or one no file can be named for, names no reading adapter', () => {
    install('leeway-implementation-process');
    write('.leeway/pay/planning/ledger/tasks/ledger-2-3.md');
    for (const format of [undefined, '../flat-files', 7]) {
      workUnit('pay', 'epic', {
        implementation: { items: { ledger: { status: 'in-progress', current_task: null, fix_attempts: 0 } } },
        planning: { items: { ledger: { status: 'completed', ...(format === undefined ? {} : { format }) } } },
      });
      ok(['session', 'label', 'pay', 'implementation', 'ledger']);
      ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
      assert.deepStrictEqual(reads().files, [abs('.leeway/pay/planning/ledger/tasks/ledger-2-3.md')], String(format));
    }
  });

  it('an implementation with no task in flight: the skill alone', () => {
    install('leeway-implementation-process');
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    const answer = reads();
    assert.deepStrictEqual([answer.skill, answer.files], [abs('.claude/skills/leeway-implementation-process/SKILL.md'), []]);
    assert.strictEqual(answer.text, `The conversation was just compacted. This conversation is working in the implementation of "ledger" in the epic "pay". Follow the leeway-implementation-process skill's "Resuming After Context Refresh" steps now, before anything else: re-read ${dir}/.claude/skills/leeway-implementation-process/SKILL.md and its framework in full.`);
  });

  it('names only what this project has — a missing document is left out', () => {
    install('leeway-specification-process');
    ok(['session', 'label', 'pay', 'specification', 'ledger']);
    assert.deepStrictEqual(reads().files, []);
    assert.strictEqual(reads().text, note('the specification of "ledger" in the epic "pay"', 'leeway-specification-process', []));
    write('.leeway/pay/specification/ledger/specification.md');
    assert.deepStrictEqual(reads().files, [abs('.leeway/pay/specification/ledger/specification.md')]);
  });

  it('a place whose skill this project lacks carries nothing on, whatever documents it has', () => {
    write('.leeway/pay/specification/ledger/specification.md');
    ok(['session', 'label', 'pay', 'specification', 'ledger']);
    assert.deepStrictEqual(reads(), {
      session_id: 'sess-1',
      position: { name: 'pay', phase: 'specification', topic: 'ledger' },
      place: 'pay › specification › ledger',
      skill: null,
      files: [],
      text: 'This conversation was working in the specification of "ledger" in the epic "pay", but this project has no leeway-specification-process skill, so there is nothing to carry on from.',
    });
  });

  it('each phase names its own documents', () => {
    workUnit('fix', 'quick-fix');
    const cases = [
      ['investigation', 'ledger', ['.leeway/pay/investigation/ledger.md']],
      ['specification', 'ledger', ['.leeway/pay/specification/ledger/specification.md']],
      ['planning', 'ledger', ['.leeway/pay/planning/ledger/planning.md', '.leeway/pay/planning/ledger/phase-2-tasks.md', '.leeway/pay/planning/ledger/phase-10-tasks.md']],
      ['review', 'ledger', ['.leeway/pay/review/ledger/report.md']],
    ];
    for (const [phase, topic, files] of cases) {
      install(`leeway-${phase}-process`);
      for (const f of files) write(f);
      ok(['session', 'label', 'pay', phase, topic]);
      const answer = reads();
      assert.strictEqual(answer.skill, abs(`.claude/skills/leeway-${phase}-process/SKILL.md`), phase);
      assert.deepStrictEqual(answer.files, files.map(abs), phase);
      assert.strictEqual(answer.text, note(`the ${phase} of "${topic}" in the epic "pay"`, `leeway-${phase}-process`, files), phase);
    }
    install('leeway-scoping-process');
    write('.leeway/fix/specification/fix/specification.md');
    write('.leeway/fix/planning/fix/planning.md');
    ok(['session', 'label', 'fix', 'scoping', 'fix']);
    const scoping = reads();
    assert.deepStrictEqual(scoping.files, ['.leeway/fix/specification/fix/specification.md', '.leeway/fix/planning/fix/planning.md'].map(abs));
    assert.strictEqual(scoping.text, note('the scoping of the quick-fix "fix"', 'leeway-scoping-process', [
      '.leeway/fix/specification/fix/specification.md', '.leeway/fix/planning/fix/planning.md',
    ]));
  });

  /** A discovery home's note: its calls, then its log caught up from the transcript, found or not. */
  function discoveryNote(where, calls, log, transcript = null) {
    return [
      `The conversation was just compacted. This conversation is working in ${where}. Before anything else, re-read these in full, running each engine call:`,
      `- ${abs('.claude/skills/leeway-discovery/SKILL.md')} and its framework`,
      ...calls.map((call) => `- \`${call}\``),
      `- ${abs(log)}`,
      transcript === null
        ? 'This conversation\'s transcript cannot be found: say so in one line, and carry on from the log.'
        : `Catch the log, ${abs(log)}, up from this conversation's transcript, ${transcript}, from the log's last write onward.`,
      'Then carry on from where the conversation was, as if the break never happened — no recap and no announcement.',
    ].join('\n');
  }

  it('an epic\'s discovery carries its recovery whole: the skill, the unit\'s map and the open log — the latest on disk where none is open — caught up from the log\'s transcript (24.S19, 8.S67)', () => {
    install('leeway-discovery');
    for (const n of ['001', '002', '010']) write(`.leeway/pay/discovery/session-${n}.md`, '## 2026-01-01 · session sess-1\n');
    const file = transcript();
    ok(['session', 'label', 'pay', 'discovery', 'pay']);
    const map = 'node .claude/skills/leeway-discovery/scripts/gateway.cjs map-view pay';
    let answer = reads();
    assert.deepStrictEqual([answer.skill, answer.files], [abs('.claude/skills/leeway-discovery/SKILL.md'), [abs('.leeway/pay/discovery/session-010.md')]]);
    assert.strictEqual(answer.text, discoveryNote('the discovery of the epic "pay"', [map], '.leeway/pay/discovery/session-010.md', file));
    workUnit('pay', 'epic', { discovery: { active_session: '002' } });
    answer = reads();
    assert.deepStrictEqual(answer.files, [abs('.leeway/pay/discovery/session-002.md')]);
    assert.strictEqual(answer.text, discoveryNote('the discovery of the epic "pay"', [map], '.leeway/pay/discovery/session-002.md', file));
  });

  it('an experiment: each live record\'s files in register order, a concluded one\'s left out', () => {
    install('leeway-experiment-process');
    workUnit('pay', 'epic', {
      experiment: { items: { ledger: { status: 'in-progress', experiments: {
        'E2.1': { slug: 'batch', status: 'designed' },
        E2: { slug: 'throughput', status: 'running' },
        E1: { slug: 'latency', status: 'concluded' },
        'E1.1': { slug: 'warm', status: 'running' },
      } } } },
    });
    for (const f of [
      'E1-latency/report.md', 'E1-latency/E1.1-warm/problem.md',
      'E2-throughput/problem.md', 'E2-throughput/design.md', 'E2-throughput/report.md',
      'E2-throughput/E2.1-batch/problem.md',
    ]) write(`.leeway/pay/topics/ledger/experiments/${f}`);
    ok(['session', 'label', 'pay', 'experiment', 'ledger']);
    assert.deepStrictEqual(reads().files, [
      '.leeway/pay/topics/ledger/experiments/E1-latency/E1.1-warm/problem.md',
      '.leeway/pay/topics/ledger/experiments/E2-throughput/problem.md',
      '.leeway/pay/topics/ledger/experiments/E2-throughput/design.md',
      '.leeway/pay/topics/ledger/experiments/E2-throughput/report.md',
      '.leeway/pay/topics/ledger/experiments/E2-throughput/E2.1-batch/problem.md',
    ].map(abs));
  });

  it('an experiment series whose records name no directory contributes no files', () => {
    install('leeway-experiment-process');
    workUnit('pay', 'epic', {
      experiment: { items: { ledger: { status: 'in-progress', experiments: { 'E3.1': { slug: 'orphan', status: 'running' } } } } },
    });
    ok(['session', 'label', 'pay', 'experiment', 'ledger']);
    const answer = reads();
    assert.deepStrictEqual([answer.skill, answer.files], [abs('.claude/skills/leeway-experiment-process/SKILL.md'), []]);
  });

  it('the project-level places: the product\'s conversation, carried whole in discovery\'s skill before any unit exists, its open log caught up from the transcript (24.S19); the roadmap with the product\'s open session\'s log; the baseline its skill alone', () => {
    install('leeway-roadmap');
    install('leeway-baseline');
    install('leeway-discovery');
    write('.leeway/.product/sessions/session-003.md', '## 2026-01-01 · session sess-1\n');
    ok(['session', 'label', 'roadmap']);
    assert.deepStrictEqual([reads().skill, reads().files], [abs('.claude/skills/leeway-roadmap/SKILL.md'), []], 'no session open');
    write('.leeway/manifest.json', JSON.stringify({ product_session: '003' }));
    const roadmap = reads();
    assert.deepStrictEqual(roadmap.files, [abs('.leeway/.product/sessions/session-003.md')]);
    assert.strictEqual(roadmap.place, 'roadmap');
    assert.strictEqual(roadmap.text, note('the project\'s roadmap', 'leeway-roadmap', ['.leeway/.product/sessions/session-003.md']));
    ok(['session', 'label', 'product']);
    const product = reads();
    assert.deepStrictEqual([product.skill, product.files, product.place], [abs('.claude/skills/leeway-discovery/SKILL.md'), [abs('.leeway/.product/sessions/session-003.md')], 'product']);
    assert.strictEqual(product.text, discoveryNote('the product\'s conversation', [], '.leeway/.product/sessions/session-003.md'), 'the transcript gone, said in one line');
    const file = transcript();
    assert.strictEqual(reads().text, discoveryNote('the product\'s conversation', [], '.leeway/.product/sessions/session-003.md', file));
    ok(['session', 'label', 'baseline']);
    const baseline = reads();
    assert.deepStrictEqual([baseline.skill, baseline.files, baseline.place], [abs('.claude/skills/leeway-baseline/SKILL.md'), [], 'baseline']);
    assert.strictEqual(baseline.text, note('the project\'s baseline', 'leeway-baseline', []));
  });

  it('a place no longer open carries nothing on — the work unit gone from this project or closed, the place\'s item closed', () => {
    install('leeway-discussion-process');
    write('.leeway/pay/topics/ledger/log.md');
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    const closed = (text) => assert.deepStrictEqual(reads(), {
      session_id: 'sess-1',
      position: { name: 'pay', phase: 'discussion', topic: 'ledger' },
      place: 'pay › discussion › ledger',
      skill: null,
      files: [],
      text,
    });
    for (const status of ['cancelled', 'postponed', 'superseded', 'promoted']) {
      workUnit('pay', 'epic', { discussion: { items: { ledger: { status } } } });
      closed(`This conversation was working in the discussion of "ledger" in the epic "pay", but the discussion is ${status}, so there is nothing to carry on from.`);
    }
    workUnit('pay', 'epic', { discussion: { items: { ledger: { status: 'in-progress' } } } }, { status: 'completed' });
    closed('This conversation was working in the discussion of "ledger" in the epic "pay", but "pay" is completed, so there is nothing to carry on from.');
    fs.rmSync(path.join(dir, '.leeway', 'pay'), { recursive: true });
    closed('This conversation was working in the discussion of "ledger" in "pay", but this project has no work unit "pay", so there is nothing to carry on from.');
  });

  it('an experiment under a topic cancelled from the epic menu carries nothing on — the series settles, the map row is cancelled', () => {
    install('leeway-experiment-process');
    workUnit('pay', 'epic', {
      discovery: { items: { ledger: { routing: 'discussion', summary: 'The ledger.', source: 'discovery' } } },
      discussion: { items: { ledger: { status: 'in-progress', awaiting_experiments: ['E1'] } } },
      experiment: { items: { ledger: { status: 'in-progress', experiments: { E1: { slug: 'latency', status: 'running' } } } } },
    });
    harness.commitAll(dir, 'the epic');
    write('.leeway/pay/topics/ledger/experiments/E1-latency/problem.md');
    ok(['session', 'label', 'pay', 'experiment', 'ledger']);
    assert.notStrictEqual(reads().skill, null, 'the running laboratory carries on');
    ok(['topic', 'cancel', 'pay', 'discovery', 'ledger']);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.leeway/pay/manifest.json'), 'utf8'));
    assert.notStrictEqual(manifest.phases.experiment.items.ledger.status, 'cancelled', 'the series item itself is not what closes');
    const answer = reads();
    assert.deepStrictEqual([answer.skill, answer.files], [null, []]);
    assert.strictEqual(answer.text, 'This conversation was working in the experiment of "ledger" in the epic "pay", but the topic is cancelled, so there is nothing to carry on from.');
  });

  it('a concluded discussion whose topic was postponed to the roadmap carries nothing on', () => {
    workUnit('pay', 'epic', {
      discovery: { items: { ledger: { routing: 'discussion', summary: 'The ledger.', source: 'discovery' } } },
      discussion: { items: { ledger: { status: 'completed' } } },
    });
    harness.commitAll(dir, 'the epic');
    install('leeway-discussion-process');
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    assert.notStrictEqual(reads().skill, null, 'the concluded discussion carries on');
    ok(['topic', 'postpone', 'pay', 'ledger', '--horizon', 'later']);
    const answer = reads();
    assert.deepStrictEqual([answer.skill, answer.files], [null, []]);
    assert.strictEqual(answer.text, 'This conversation was working in the discussion of "ledger" in the epic "pay", but the discussion is postponed, so there is nothing to carry on from.');
  });

  it('a concluded experiment series whose topic was postponed to the roadmap carries nothing on — the series stays as it stands, the map row is postponed', () => {
    install('leeway-experiment-process');
    workUnit('pay', 'epic', {
      discovery: { items: { ledger: { routing: 'discussion', summary: 'The ledger.', source: 'discovery' } } },
      discussion: { items: { ledger: { status: 'completed' } } },
      experiment: { items: { ledger: { status: 'completed', experiments: { E1: { slug: 'latency', status: 'concluded', verdict: 'Fast enough.' } } } } },
    });
    harness.commitAll(dir, 'the epic');
    ok(['session', 'label', 'pay', 'experiment', 'ledger']);
    assert.notStrictEqual(reads().skill, null, 'the concluded series carries on');
    ok(['topic', 'postpone', 'pay', 'ledger', '--horizon', 'later']);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.leeway/pay/manifest.json'), 'utf8'));
    assert.strictEqual(manifest.phases.experiment.items.ledger.status, 'completed', 'the series item itself is not what closes');
    const answer = reads();
    assert.deepStrictEqual([answer.skill, answer.files], [null, []]);
    assert.strictEqual(answer.text, 'This conversation was working in the experiment of "ledger" in the epic "pay", but the topic is postponed, so there is nothing to carry on from.');
  });

  it('an experiment and a discussion close with their topic on the map; a specification and a plan do not', () => {
    for (const marker of ['cancelled', 'postponed']) {
      for (const [phase, closes] of [['experiment', true], ['discussion', true], ['specification', false], ['planning', false]]) {
        install(`leeway-${phase}-process`);
        workUnit('pay', 'epic', {
          discovery: { items: { ledger: { [marker]: true } } },
          [phase]: { items: { ledger: { status: 'in-progress' } } },
        });
        ok(['session', 'label', 'pay', phase, 'ledger']);
        const answer = reads();
        assert.strictEqual(answer.skill === null, closes, `${phase} under a ${marker} topic`);
        if (closes) assert.deepStrictEqual(answer.files, [], `${phase} under a ${marker} topic names no files`);
        if (closes) assert.match(answer.text, new RegExp(`but the topic is ${marker}, so there is nothing to carry on from\\.$`));
      }
    }
  });

  it('a work unit\'s menu no longer open says so', () => {
    ok(['session', 'label', 'pay']);
    workUnit('pay', 'epic', {}, { status: 'cancelled' });
    const answer = reads();
    assert.deepStrictEqual([answer.skill, answer.files], [null, []]);
    assert.strictEqual(answer.text, 'This conversation was working in the epic "pay", but "pay" is cancelled, so there is nothing to carry on from.');
  });

  it('a conversation a handoff began carries on from the place its first call labelled', () => {
    install('leeway-roadmap');
    ok(['session', 'label', 'roadmap'], 'sess-handed');
    const carried = reads([], 'sess-handed');
    assert.deepStrictEqual([carried.position, carried.skill], [{ name: 'roadmap' }, abs('.claude/skills/leeway-roadmap/SKILL.md')]);
    assert.strictEqual(carried.text, note('the project\'s roadmap', 'leeway-roadmap', []));
  });

  it('names each file under the root of the project the call runs in, a dashed or dotted root spelled as it is', () => {
    const root = harness.setupFixtureAt(path.join(dir, 'code', 'my-repo.app'));
    fs.mkdirSync(path.join(root, '.claude', 'skills', 'leeway-investigation-process'), { recursive: true });
    fs.writeFileSync(path.join(root, '.claude', 'skills', 'leeway-investigation-process', 'SKILL.md'), '# investigation\n');
    fs.mkdirSync(path.join(root, '.leeway', 'pay', 'investigation'), { recursive: true });
    fs.writeFileSync(path.join(root, '.leeway', 'pay', 'manifest.json'), JSON.stringify({ name: 'pay', work_type: 'epic', status: 'in-progress', phases: {} }));
    fs.writeFileSync(path.join(root, '.leeway', 'pay', 'investigation', 'ledger.md'), '# ledger\n');
    writePosition({ name: 'pay', phase: 'investigation', topic: 'ledger' });
    const out = harness.output(root, ['conversation', 'position'], { env: env() });
    const answer = JSON.parse(out.slice(out.indexOf('=== POSITION')).split('\n')[1]);
    assert.deepStrictEqual(answer.files, [path.join(root, '.leeway/pay/investigation/ledger.md')]);
    assert.ok(answer.text.endsWith(`\n- ${root}/.leeway/pay/investigation/ledger.md`), answer.text);
  });

  it('reads another conversation by its id, from any project the call runs in; the calling one\'s by default', () => {
    writePosition({ name: 'pay', phase: 'discussion', topic: 'ledger' }, 'sess-2');
    assert.strictEqual(reads().position, null);
    assert.deepStrictEqual(reads(['sess-2']).position, { name: 'pay', phase: 'discussion', topic: 'ledger' });
    assert.deepStrictEqual(reads([], 'sess-2').session_id, 'sess-2');
  });

  it('refuses with no session id at all, and an extra argument', () => {
    for (const [args, sessionId] of [[[], null], [['a', 'b'], 'sess-1']]) {
      assert.match(harness.refuses(dir, ['conversation', 'position', ...args], { env: env(sessionId) }).error,
        /^Usage: engine conversation position \[session-id\] — the calling conversation's CLAUDE_CODE_SESSION_ID when no id is given$/);
    }
  });

  it('writes nothing', () => {
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    const before = fs.readFileSync(path.join(folder(), 'position.json'), 'utf8');
    reads();
    assert.strictEqual(fs.readFileSync(path.join(folder(), 'position.json'), 'utf8'), before);
  });
});

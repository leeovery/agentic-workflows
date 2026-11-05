'use strict';

//
// Tests for the conversation's position (domain/position.cjs): what every
// arrival records in the conversation's folder, labels on or off — a phase,
// a work unit's menu, the project-level places — a place this project lacks
// refused, marking the conversation first where the call runs in a
// workflows project, and nothing without a session id; the builder and
// reviewers the gate mod's `conversation builder` records against the task
// its brief was issued for, riding with that task alone, two recorded at
// once both standing (24.2.4, 13.3.3, 12.S21) — the tracker's `task start`
// and `task done` on the position are test-engine-task-verbs.cjs's; the
// start menu's repair dropping it, a record racing the drop never bringing
// it back, and boot's leaving it, the place it left kept until a position is
// recorded again; and `conversation position`,
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
// conversation its open log (24.S19, 8.S67); and specification's, at the
// unit, each live topic's record and log, the files linked canonical, then
// the spec once written and its cut, and the review page while it is open,
// a concluded spec carrying nothing on;
// every other phase's sends Claude to its skill's own steps, a build's
// naming each task in flight with its builder and its pair (24.S12), and a
// build not to be entered carries nothing on (P12).
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { skillAt } = require('../../skills/leeway-engine/scripts/domain/position.cjs');
const { ROLES } = require('../../skills/leeway-engine/scripts/domain/brief-names.cjs');
const { storeBrief } = require('../../skills/leeway-engine/scripts/domain/brief.cjs');
const { HANDOFF_TARGETS } = require('../../skills/leeway-engine/scripts/domain/handoff.cjs');
const { PROJECT_IDENTITIES, VALID_PHASES } = require('../../skills/leeway-engine/scripts/kernel/manifest-schema.cjs');

// The phases whose note carries the recovery whole, their skills keeping no
// steps of their own for it.
const WHOLE = ['discussion', 'investigation', 'discovery', 'specification', 'implementation', 'review'];

const POSITION_MODULE = path.join(__dirname, '../../skills/leeway-engine/scripts/domain/position.cjs');

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

/** A task just put in flight: no builder or reviewer recorded yet. */
const fresh = (task) => ({ task, builder: null, reviewers: [] });

/**
 * A brief the conversation issued for the `role`'s agent, stored as `brief`
 * stores it — for the unit's task, or with no task, for its topic.
 */
function issue(id, role, task, unit = 'pay', sessionId = 'sess-1') {
  const issued = { role, agent: ROLES[role].agent, unit, task, topic: task === null ? 'ledger' : null };
  harness.withEnv({ LEEWAY_CONFIG_DIR: config }, () => storeBrief(sessionId, id, `Brief ${id}\n`, issued));
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
  workUnit('pay', 'epic', {}, { build: { position: 'auto' } });
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
    for (const name of ['roadmap', 'product']) {
      ok(['session', 'label', name]);
      assert.deepStrictEqual(position(), { name });
    }
  });

  it('a conversation\'s first call records its place, marking the conversation — a handoff\'s new conversation arrives before any other call', () => {
    assert.ok(!fs.existsSync(folder('sess-new')), 'no call has marked it');
    ok(['session', 'label', 'roadmap'], 'sess-new');
    assert.ok(fs.existsSync(path.join(folder('sess-new'), 'workflow')), 'the label marked the conversation');
    assert.deepStrictEqual(position('sess-new'), { name: 'roadmap' });
  });

  it('no session id records nothing', () => {
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    ok(['session', 'label', 'pay', 'review', 'pay'], null);
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

  it('the start menu is no position: repair takes the calling conversation\'s own off, labels off, and leaves another\'s', () => {
    writePosition({ name: 'pay' }, 'sess-2');
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    assert.deepStrictEqual(ok(['session', 'repair']), { ok: true, repaired: false });
    assert.strictEqual(position(), null);
    assert.deepStrictEqual(position('sess-2'), { name: 'pay' });
  });

  it('boot leaves the position for the start menu, keeping the place it left where that names a phase until a position is recorded again; at a unit\'s menu it keeps none (D38)', () => {
    const left = () => {
      try { return JSON.parse(fs.readFileSync(path.join(folder(), 'left.json'), 'utf8')); } catch { return null; }
    };
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    ok(['boot']);
    const booted = [position(), left()];
    ok(['session', 'label', 'pay']);
    const arrived = [position(), left()];
    ok(['boot']);

    assert.deepStrictEqual([booted, arrived, [position(), left()]], [[null, { name: 'pay', phase: 'discussion' }], [{ name: 'pay' }, null], [null, null]]);
  });

  it('a position that cannot be written never fails the verb', () => {
    fs.mkdirSync(path.join(folder(), 'position.json'));
    assert.deepStrictEqual(ok(['session', 'label', 'pay', 'discussion', 'ledger']), { ok: true, labelled: false, reason: 'disabled' });
  });
});

describe('the builders and reviewers the gate mod records (24.2.4, 13.3.3, 29.14.8)', () => {
  const AGENT = 'aa76bd7f82a2ef3e4';
  /** The unit's build: the tracker's tasks are in flight at the unit's implementation. */
  const BUILD = { name: 'pay', phase: 'implementation', topic: 'pay' };

  /** The gate mod's call as it sees a dispatch answered, its answer parsed — a builder's or a reviewer's naming its brief. */
  function dispatched(agentId, brief, sessionId = 'sess-1') {
    return ok(['conversation', 'builder', sessionId, agentId, '--brief', brief], null);
  }

  /** The conversation in the unit's build, on task 1.1, its builder recorded. */
  function onTask() {
    writePosition({ ...BUILD, tasks: [fresh('1.1')] });
    issue('B11', 'builder', '1.1');
    assert.deepStrictEqual(dispatched(AGENT, 'B11'), { ok: true, recorded: true });
  }

  it('a builder\'s dispatch is recorded against the task its brief was issued for — several in flight, each its own (12.S21)', () => {
    writePosition({ ...BUILD, tasks: [fresh('1.1'), fresh('1.2')] });
    issue('B11', 'builder', '1.1');
    issue('B12', 'builder', '1.2');

    assert.deepStrictEqual([dispatched('b12', 'B12'), dispatched('b11', 'B11')], [{ ok: true, recorded: true }, { ok: true, recorded: true }]);

    assert.deepStrictEqual(position(), { ...BUILD, tasks: [{ task: '1.1', builder: 'b11', reviewers: [] }, { task: '1.2', builder: 'b12', reviewers: [] }] });
  });

  it('the pair: each reviewer joins its task\'s reviewers, once; a later builder\'s dispatch, the fix round\'s brief among them, replaces the builder (13.3.3)', () => {
    writePosition({ ...BUILD, tasks: [fresh('1.1'), fresh('1.2')] });
    issue('B11', 'builder', '1.1');
    issue('R1', 'reviewer', '1.1');
    issue('R2', 'reviewer', '1.1');
    issue('F11', 'fix', '1.1');

    for (const [agentId, brief] of [['b11', 'B11'], ['r1', 'R1'], ['r2', 'R2'], ['r1', 'R1']]) dispatched(agentId, brief);
    assert.deepStrictEqual(position().tasks, [{ task: '1.1', builder: 'b11', reviewers: ['r1', 'r2'] }, fresh('1.2')]);

    dispatched('b9', 'F11');
    assert.deepStrictEqual(position().tasks, [{ task: '1.1', builder: 'b9', reviewers: ['r1', 'r2'] }, fresh('1.2')]);
  });

  it('records nothing where its brief names no task in flight at its unit\'s build — never issued here, another agent\'s, a task not in flight, another unit\'s, a topic\'s implementation, no position, another place', () => {
    writePosition({ ...BUILD, tasks: [fresh('1.1')] });
    issue('B12', 'builder', '1.2');
    issue('REF', 'builder', '1.1', 'refunds');
    issue('DIVE', 'deep-dive', null);
    issue('B11', 'builder', '1.1');
    const before = position();
    for (const brief of ['NOPE', 'B12', 'REF', 'DIVE']) assert.deepStrictEqual(dispatched('a1', brief), { ok: true, recorded: false }, brief);
    assert.deepStrictEqual(position(), before);

    writePosition({ name: 'pay', phase: 'implementation', topic: 'ledger', tasks: [fresh('1.1')] }, 'sess-2');
    issue('B11', 'builder', '1.1', 'pay', 'sess-2');
    assert.deepStrictEqual(dispatched('a1', 'B11', 'sess-2'), { ok: true, recorded: false }, 'a task of that number in a topic\'s implementation');
    assert.deepStrictEqual(dispatched('a1', 'B11', 'sess-none'), { ok: true, recorded: false });
    assert.strictEqual(position('sess-none'), null);
    for (const place of [['pay', 'discussion', 'ledger'], ['pay']]) {
      ok(['session', 'label', ...place]);
      const at = position();
      assert.deepStrictEqual(dispatched('a1', 'B11'), { ok: true, recorded: false }, place.join(' '));
      assert.deepStrictEqual(position(), at, place.join(' '));
    }
  });

  it('records on the conversation it names, never the calling one', () => {
    onTask();
    writePosition({ ...BUILD, tasks: [fresh('1.1')] }, 'sess-2');
    issue('B11', 'builder', '1.1', 'pay', 'sess-2');
    const calling = position();
    assert.deepStrictEqual(ok(['conversation', 'builder', 'sess-2', 'ab12', '--brief', 'B11'], 'sess-1'), { ok: true, recorded: true });
    assert.strictEqual(position('sess-2').tasks[0].builder, 'ab12');
    assert.deepStrictEqual(position(), calling, 'the calling conversation\'s position is untouched');
  });

  it('a task\'s agents ride with it: task start re-run keeps them, another task starts beside it with none, and its close takes them off with it', () => {
    ok(['task', 'phase', 'pay', '1', '--title', 'Ledger']);
    const file = write('task.md', '# Keep the ledger\n\n## Type\nfeat\n\n## Problem\nA.\n\n## Solution\nB.\n\n## Outcome\nC.\n\n## Acceptance scenarios\n- Given a, when b, then c.\n\n## Spec reference\n§1\n');
    for (const n of [1, 2]) ok(['task', 'create', 'pay', '1', '--file', abs(file)], `create-${n}`);
    fs.rmSync(abs(file));
    writePosition({ ...BUILD, tasks: [{ task: '1.1', builder: AGENT, reviewers: ['r1', 'r2'] }] });
    const [held] = position().tasks;
    ok(['task', 'start', 'pay', '1.1']);
    assert.deepStrictEqual(position().tasks, [held], 'the recovery steps re-run task start for the task in flight');
    ok(['task', 'start', 'pay', '1.2']);
    assert.deepStrictEqual(position().tasks, [held, fresh('1.2')]);
    ok(['task', 'close', 'pay', '1.1', '--reason', 'The ledger keeps itself.']);
    assert.deepStrictEqual(position().tasks, [fresh('1.2')]);
  });

  it('a re-label of the unit\'s build keeps them; arriving anywhere else leaves none behind', () => {
    onTask();
    ok(['session', 'label', 'pay', 'implementation', 'pay']);
    assert.strictEqual(position().tasks[0].builder, AGENT);
    ok(['session', 'label', 'pay']);
    assert.deepStrictEqual(position(), { name: 'pay' });
    ok(['session', 'label', 'pay', 'implementation', 'pay']);
    assert.deepStrictEqual(position(), BUILD, 'no task until task start');
  });

  it('refuses an agent id that is not one, a brief id that is not one or none, a missing argument and an extra one, recording nothing', () => {
    onTask();
    const usage = /^Usage: engine conversation builder <session-id> <agent-id> --brief <id> — the agent id letters, digits, - and _ alone, the brief's id as `engine brief` answers it$/;
    for (const args of [
      ['sess-1', 'a b', '--brief', 'B11'], ['sess-1', '../x', '--brief', 'B11'], ['sess-1', 'a`b', '--brief', 'B11'], ['sess-1', '', '--brief', 'B11'],
      ['sess-1'], [], ['', AGENT, '--brief', 'B11'], ['sess-1', AGENT], ['sess-1', AGENT, 'x'],
      ['sess-1', AGENT, '--brief'], ['sess-1', AGENT, '--brief', '../B1'], ['sess-1', AGENT, '--brief', ''], ['sess-1', AGENT, '--brief=B1'],
      ['sess-1', AGENT, '--brief', 'B1', 'x'], ['sess-1', AGENT, '--task', 'B1'],
    ]) {
      assert.match(harness.refuses(dir, ['conversation', 'builder', ...args], { env: env(null) }).error, usage, JSON.stringify(args));
    }
    assert.strictEqual(position().tasks[0].builder, AGENT);
  });

  it('a position that cannot be written records nothing, the file left as it was', () => {
    writePosition({ ...BUILD, tasks: [fresh('1.1')] });
    issue('B11', 'builder', '1.1');
    const file = path.join(folder(), 'position.json');
    const before = fs.readFileSync(file, 'utf8');
    fs.chmodSync(folder(), 0o555);
    try {
      assert.deepStrictEqual(dispatched(AGENT, 'B11'), { ok: true, recorded: false });
    } finally {
      fs.chmodSync(folder(), 0o755);
    }
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before);
  });

  it('a pair dispatched side by side: two records at once on a barrier each stand, every reviewer kept in the order each recorded, and the lock found held', async () => {
    writePosition({ ...BUILD, tasks: [fresh('1.1')] });
    issue('R1', 'reviewer', '1.1');
    issue('R2', 'reviewer', '1.1');
    const lock = `${path.join(folder(), 'position.json')}.lock`;
    const met = path.join(config, 'met');
    const reports = await harness.contend(2, [
      'const [brief, lock, met] = process.argv.slice(1);',
      `const { recordBuilder } = require(${JSON.stringify(POSITION_MODULE)});`,
      'const link = fs.linkSync;',
      'let taken = 0;',
      "fs.linkSync = (from, to) => { try { return link(from, to); } catch (err) { if (to === lock && err.code === 'EEXIST') { taken += 1; fs.writeFileSync(met, ''); } throw err; } };",
      'atBarrier();',
      // Each records ten at least, and goes on until one of them has found the lock held.
      'const ids = [];',
      "while (ids.length < 10 || (!fs.existsSync(met) && ids.length < 500)) { const id = `${brief}-${ids.length}`; if (recordBuilder('sess-1', id, brief).recorded) ids.push(id); }",
      'report({ taken, ids });',
    ].join('\n'), (i) => [`R${i + 1}`, lock, met], { ...process.env, LEEWAY_CONFIG_DIR: config });

    assert.ok(reports[0].taken + reports[1].taken > 0, 'neither found the lock held: the two never met');
    const { reviewers } = position().tasks[0];
    assert.strictEqual(reviewers.length, reports[0].ids.length + reports[1].ids.length);
    for (const { ids } of reports) assert.deepStrictEqual(reviewers.filter((id) => ids.includes(id)), ids);
  });

  it('a drop racing a record: the drop waits on the lock the record holds, so the record\'s write never brings the dropped position back', async () => {
    writePosition({ ...BUILD, tasks: [fresh('1.1')] });
    issue('B11', 'builder', '1.1');
    const file = path.join(folder(), 'position.json');
    const met = path.join(config, 'met');
    const reports = await harness.contend(2, [
      'const [part, file, met] = process.argv.slice(1);',
      `const { recordBuilder, dropPosition } = require(${JSON.stringify(POSITION_MODULE)});`,
      "if (part === 'record') {",
      '  const rename = fs.renameSync;',
      '  const pause = new Int32Array(new SharedArrayBuffer(4));',
      // The record, its position read, holds its write until the drop has found the lock held — or, with no lock, has deleted the file.
      '  fs.renameSync = (from, to) => { if (to === file) { atBarrier(); while (!fs.existsSync(met) && fs.existsSync(file)) Atomics.wait(pause, 0, 0, 5); } return rename(from, to); };',
      "  report(recordBuilder('sess-1', 'b1', 'B11'));",
      '} else {',
      '  const link = fs.linkSync;',
      "  fs.linkSync = (from, to) => { try { return link(from, to); } catch (err) { if (to === `${file}.lock` && err.code === 'EEXIST') fs.writeFileSync(met, ''); throw err; } };",
      '  atBarrier();',
      "  dropPosition('sess-1');",
      '  report({ dropped: true });',
      '}',
    ].join('\n'), (i) => [i === 0 ? 'record' : 'drop', file, met], { ...process.env, LEEWAY_CONFIG_DIR: config });

    assert.deepStrictEqual(reports, [{ recorded: true }, { dropped: true }]);
    assert.strictEqual(position(), null, 'the dropped position came back');
    assert.ok(fs.existsSync(met), 'the drop never found the lock held: the two never met');
  });
});

describe('conversation position', () => {
  /** The note for a skill that runs the work and the files after it. */
  function note(where, skill, files) {
    const follow = `The conversation was just compacted. This conversation is working in ${where}. Follow the ${skill} skill's "Resuming After Context Refresh" steps now, before anything else: re-read ${abs(`.claude/skills/${skill}/SKILL.md`)} and its framework in full`;
    return files.length > 0 ? [`${follow}, then re-read these in full:`, ...files.map((f) => `- ${abs(f)}`)].join('\n') : `${follow}.`;
  }

  it('names only skills that open a conversation — a phase\'s own, discovery\'s, a project place\'s; none at a work unit\'s menu — each its note sends Claude to carrying the recovery steps', () => {
    const skills = [...VALID_PHASES.filter((phase) => phase !== 'planning').map((phase) => skillAt('pay', phase)), ...PROJECT_IDENTITIES.map((name) => skillAt(name))];
    assert.strictEqual(skills.length, 10);
    for (const skill of skills) assert.ok(skill !== null && HANDOFF_TARGETS.includes(skill), `${skill} is a skill a conversation opens on`);
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
    assert.deepStrictEqual([skillAt('pay'), skillAt('pay', 'planning')], [null, null], 'a unit\'s menu, and planning, whose items are scoping\'s');
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

  /** A topic's note, a discussion's or an investigation's: its log named where written, the transcript found or not, the log's header line owed or not — again where the conversation wrote there before another. */
  function topicNote(where, unit, topic, { log = false, transcript = null, header = null, again = false, phase = 'discussion' } = {}) {
    const logFile = abs(`.leeway/${unit}/topics/${topic}/log.md`);
    return [
      `The conversation was just compacted. This conversation is working in ${where}. Before anything else, re-read these in full, running each engine call:`,
      `- ${abs(`.claude/skills/leeway-${phase}-process/SKILL.md`)} and its framework`,
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

  it('a bugfix\'s investigation carries its recovery whole, as a discussion does — the topic\'s record and its log, the investigation itself, caught up from the transcript, and no document beside them (19.4.3)', () => {
    install('leeway-investigation-process');
    write('.leeway/pay/topics/ledger/log.md', '## 2026-01-01 · session sess-1\n\nThe hunt so far.\n');
    write('.leeway/pay/investigation/ledger.md');
    const file = transcript();
    ok(['session', 'label', 'pay', 'investigation', 'ledger']);
    const answer = reads();
    assert.deepStrictEqual([answer.skill, answer.files], [
      abs('.claude/skills/leeway-investigation-process/SKILL.md'), [abs('.leeway/pay/topics/ledger/log.md')],
    ]);
    assert.strictEqual(answer.text, topicNote('the investigation of "ledger" in the epic "pay"', 'pay', 'ledger', {
      phase: 'investigation', log: true, transcript: file,
    }));
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

  it('a specification carries its recovery whole, at the unit: each live topic\'s record and its log, the unit\'s own record, the files linked canonical, then the spec once written and the cut once cut, and the review page while it is open, and no log of its own (24.2.6)', () => {
    install('leeway-specification-process');
    const pay = (/** @type {string} */ ledger) => workUnit('pay', 'epic', {
      discovery: { items: { ledger: { order: 1 }, refunds: { order: 2, cancelled: true } } },
      discussion: { items: { ledger: { status: ledger }, refunds: { status: 'cancelled' } } },
    });
    pay('in-progress');
    const log = write('.leeway/pay/topics/ledger/log.md');
    const made = { by: 'claude', who_moved_whom: 'none' };
    const asked = harness.ok(dir, ['ledger', 'ask', 'pay.discussion.ledger'], { env: env(), stdin: JSON.stringify({ ...made, text: 'What does the ledger hold?' }) }).id;
    const decided = harness.ok(dir, ['ledger', 'decide', 'pay.discussion.ledger', '--answers', asked], { env: env(), stdin: JSON.stringify({ ...made, text: 'Entries.', why: 'Because.' }) }).id;
    pay('completed');
    const asset = write('.leeway/pay/assets/flow.png');
    ok(['asset', 'add', 'pay', 'pay/assets/flow.png', '--entry', decided, '--status', 'canonical']);
    ok(['session', 'label', 'pay', 'specification', 'pay']);
    const engine = 'node .claude/skills/leeway-engine/scripts/engine.cjs';
    const specNote = (/** @type {string[]} */ calls, /** @type {string[]} */ files, /** @type {string[]} */ lines = []) => [
      'The conversation was just compacted. This conversation is working in the specification of the epic "pay". Before anything else, re-read these in full, running each engine call:',
      `- ${abs('.claude/skills/leeway-specification-process/SKILL.md')} and its framework`,
      ...calls.map((call) => `- \`${engine} ${call}\``),
      ...files.map((file) => `- ${abs(file)}`),
      ...lines,
      'Then carry on from where the conversation was, as if the break never happened — no recap and no announcement.',
    ].join('\n');
    const unwritten = reads();
    const spec = write('.leeway/pay/spec.md');
    const manifest = JSON.parse(fs.readFileSync(abs('.leeway/pay/manifest.json'), 'utf8'));
    workUnit('pay', 'epic', manifest.phases, { cut: { phases: [] } });
    const written = reads();
    const url = 'https://claude.ai/public/artifacts/pay';
    write('.leeway/.cache/pay/specification/published.json', JSON.stringify({ url, at: '2026-11-01T00:00:00.000Z' }));
    const open = reads();

    assert.deepStrictEqual([unwritten.place, unwritten.files, unwritten.text], ['pay › specification', [abs(log), abs(asset)], specNote(['ledger record pay ledger', 'ledger record pay'], [log, asset])]);
    assert.deepStrictEqual([written.files, written.text], [[abs(log), abs(asset), abs(spec)], specNote(['ledger record pay ledger', 'ledger record pay', 'manifest get pay cut'], [log, asset, spec])]);
    assert.strictEqual(open.text, specNote(['ledger record pay ledger', 'ledger record pay', 'manifest get pay cut'], [log, asset, spec], [
      `The review page is open at ${url}; its marks are read back into ${abs('.leeway/.cache/pay/specification/read-back.json')}.`,
    ]), 'while the review page is open, the note names its address and the file its marks are read back to');
  });

  it('a spec concluded, its build begun, carries nothing on', () => {
    install('leeway-specification-process');
    workUnit('pay', 'epic', {}, { build: { position: 'auto' } });
    ok(['session', 'label', 'pay', 'specification', 'pay']);
    assert.deepStrictEqual([reads().skill, reads().text], [null, 'This conversation was working in the specification of the epic "pay", but its spec is concluded, so there is nothing to carry on from.']);
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

  it('24.S12: a build that compacts with three tasks in flight — the note names each with its builder and its pair, so a fix round on any goes back to that task\'s builder, a re-review to its pair', () => {
    install('leeway-implementation-process');
    const tasks = [fresh('1.1'), fresh('1.2'), fresh('2.1')];
    writePosition({ name: 'pay', phase: 'implementation', topic: 'pay', tasks });
    for (const [brief, role, task, agentId] of [
      ['B11', 'builder', '1.1', 'b11'], ['B12', 'builder', '1.2', 'b12'], ['B21', 'builder', '2.1', 'b21'],
      ['R1', 'reviewer', '1.1', 'r1'], ['R2', 'reviewer', '1.1', 'r2'], ['R3', 'reviewer', '1.2', 'r3'],
    ]) {
      issue(brief, role, task);
      ok(['conversation', 'builder', 'sess-1', agentId, '--brief', brief], null);
    }
    const answer = reads();
    assert.deepStrictEqual(answer.position.tasks, [
      { task: '1.1', builder: 'b11', reviewers: ['r1', 'r2'] }, { task: '1.2', builder: 'b12', reviewers: ['r3'] }, { task: '2.1', builder: 'b21', reviewers: [] },
    ]);
    assert.deepStrictEqual(answer.text.split('\n').filter((line) => line.startsWith('in flight: ')), [
      'in flight: task 1.1, its builder agent `b11`, its reviewer agents `r1` and `r2`',
      'in flight: task 1.2, its builder agent `b12`, its reviewer agent `r3`',
      'in flight: task 2.1, its builder agent `b21`',
    ]);
  });

  it('a build not to be entered carries nothing on, at either of its places — a unit built under the old plan, and a quick-fix\'s review, which the person has not asked for (P12, 19.5.14)', () => {
    install('leeway-implementation-process');
    install('leeway-review-process');
    workUnit('pay', 'epic', { implementation: { items: { ledger: { status: 'in-progress' } } } }, { build: { position: 'auto' } });
    workUnit('fix', 'quick-fix');
    const notes = [['pay', 'implementation'], ['pay', 'review'], ['fix', 'review']].map(([unit, phase]) => {
      writePosition({ name: unit, phase, topic: unit });
      const { skill, files, text } = reads();
      return [skill, files, text];
    });

    assert.deepStrictEqual(notes, [
      [null, [], 'This conversation was working in the implementation of the epic "pay", but pay was built under the old plan, and its build is entered once the reshape\'s 29.17 migration has cut it, so there is nothing to carry on from.'],
      [null, [], 'This conversation was working in the review of the epic "pay", but pay was built under the old plan, and its build is entered once the reshape\'s 29.17 migration has cut it, so there is nothing to carry on from.'],
      [null, [], 'This conversation was working in the review of the quick-fix "fix", but fix is a quick-fix, whose review runs only once the person asks for one at its close — the review on request is built with the reshape\'s 29.15, so there is nothing to carry on from.'],
    ]);
  });

  it('a quick-fix\'s implementation, which its own arm enters, carries on as its entry reads it: the unit\'s record by its call, then its change and its fixes', () => {
    install('leeway-implementation-process');
    workUnit('fix', 'quick-fix', {}, { description: 'Spell the flag --colour' });
    writePosition({ name: 'fix', phase: 'implementation', topic: 'fix' });
    const { skill, text } = reads();

    assert.strictEqual(skill, abs('.claude/skills/leeway-implementation-process/SKILL.md'));
    for (const line of ['ledger record fix`', 'change: Spell the flag --colour', 'tasks: none yet']) assert.ok(text.includes(line), `the note names ${line}\n${text}`);
  });

  it('names only what this project has — a missing document is left out', () => {
    install('leeway-investigation-process');
    ok(['session', 'label', 'pay', 'investigation', 'ledger']);
    assert.deepStrictEqual(reads().files, []);
    write('.leeway/pay/topics/ledger/log.md');
    assert.deepStrictEqual(reads().files, [abs('.leeway/pay/topics/ledger/log.md')]);
  });

  it('a place whose skill this project lacks carries nothing on, whatever documents it has', () => {
    write('.leeway/pay/topics/ledger/log.md');
    ok(['session', 'label', 'pay', 'investigation', 'ledger']);
    assert.deepStrictEqual(reads(), {
      session_id: 'sess-1',
      position: { name: 'pay', phase: 'investigation', topic: 'ledger' },
      place: 'pay › investigation › ledger',
      skill: null,
      files: [],
      text: 'This conversation was working in the investigation of "ledger" in the epic "pay", but this project has no leeway-investigation-process skill, so there is nothing to carry on from.',
    });
  });

  it('a scoping names its own documents, its skill\'s own steps carrying it on', () => {
    workUnit('fix', 'quick-fix');
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
    const map = 'node .claude/skills/leeway-engine/scripts/engine.cjs render discovery-map pay';
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

  it('the project-level places: the product\'s conversation, carried whole in discovery\'s skill before any unit exists, its open log caught up from the transcript (24.S19); the roadmap with the product\'s open session\'s log', () => {
    install('leeway-roadmap');
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
  });

  it('a position left at the baseline, a place the project no longer has, carries nothing on', () => {
    writePosition({ name: 'baseline' });
    assert.deepStrictEqual(reads(), {
      session_id: 'sess-1',
      position: { name: 'baseline' },
      place: 'baseline',
      skill: null,
      files: [],
      text: 'This conversation was working in "baseline", but this project has no work unit "baseline", so there is nothing to carry on from.',
    });
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
      discovery: { items: { ledger: { summary: 'The ledger.', source: 'discovery' } } },
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
      discovery: { items: { ledger: { summary: 'The ledger.', source: 'discovery' } } },
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
      discovery: { items: { ledger: { summary: 'The ledger.', source: 'discovery' } } },
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

  it('an experiment and a discussion close with their topic on the map; the spec does not', () => {
    for (const marker of ['cancelled', 'postponed']) {
      for (const [phase, place, closes] of [['experiment', 'ledger', true], ['discussion', 'ledger', true], ['specification', 'pay', false]]) {
        install(`leeway-${phase}-process`);
        workUnit('pay', 'epic', {
          discovery: { items: { ledger: { [marker]: true } } },
          ...(closes ? { [phase]: { items: { ledger: { status: 'in-progress' } } } } : {}),
        });
        ok(['session', 'label', 'pay', phase, place]);
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
    fs.mkdirSync(path.join(root, '.leeway', 'pay', 'topics', 'ledger'), { recursive: true });
    fs.writeFileSync(path.join(root, '.leeway', 'pay', 'manifest.json'), JSON.stringify({ name: 'pay', work_type: 'epic', status: 'in-progress', phases: {} }));
    fs.writeFileSync(path.join(root, '.leeway', 'pay', 'topics', 'ledger', 'log.md'), '# ledger\n');
    writePosition({ name: 'pay', phase: 'investigation', topic: 'ledger' });
    const out = harness.output(root, ['conversation', 'position'], { env: env() });
    const answer = JSON.parse(out.slice(out.indexOf('=== POSITION')).split('\n')[1]);
    assert.deepStrictEqual(answer.files, [path.join(root, '.leeway/pay/topics/ledger/log.md')]);
    assert.ok(answer.text.includes(`\n- ${root}/.leeway/pay/topics/ledger/log.md\n`), answer.text);
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

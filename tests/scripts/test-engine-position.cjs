'use strict';

//
// Tests for the conversation's position (domain/position.cjs): what every
// arrival records in the conversation's folder, labels on or off — a phase,
// a work unit's menu, the project-level places — only for a conversation
// the engine has marked and only a place this project has; the task `task
// start` adds and its `task complete` takes off; the start menu's repair
// dropping it; and `conversation position`, which answers what to re-read
// to carry on there: the skill that runs the work, then the topic's
// documents this project has, each by its absolute path under the project
// root, as a message composed for the conversation and one line of JSON for
// a mod.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');

let dir; // a workflows project
let config; // this test's system config directory

/** The engine as the conversation `sessionId` runs it — null runs it with no id. */
function env(sessionId = 'sess-1') {
  return { WORKFLOWS_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: sessionId ?? undefined, TMUX: undefined, TMUX_PANE: undefined };
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
  write(`.workflows/${name}/manifest.json`, JSON.stringify({ name, work_type: workType, status: 'in-progress', phases, ...extra }, null, 2));
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
  workUnit('pay', 'epic', {
    implementation: { items: { ledger: { status: 'in-progress', current_task: null, fix_attempts: 0 } } },
    planning: { items: { ledger: { status: 'completed', format: 'flat-files' } } },
  });
  mark();
});

afterEach(() => {
  for (const d of [dir, config]) fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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

  it('records only for a conversation the engine has marked — the first call marks it after it runs, and no id records nothing', () => {
    ok(['session', 'label', 'pay', 'discussion', 'ledger'], 'sess-new');
    assert.strictEqual(position('sess-new'), null, 'never creating the folder');
    ok(['session', 'label', 'pay', 'discussion', 'ledger'], 'sess-new');
    assert.deepStrictEqual(position('sess-new'), { name: 'pay', phase: 'discussion', topic: 'ledger' });
    ok(['session', 'label', 'pay', 'review', 'ledger'], null);
    assert.deepStrictEqual(position('sess-new'), { name: 'pay', phase: 'discussion', topic: 'ledger' });
  });

  it('records no place this project lacks, keeping the last one — a missing work unit, an unknown phase, an identity with a phase', () => {
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    ok(['session', 'label', 'ghost']);
    ok(['session', 'label', 'pay', 'deploying', 'ledger']);
    ok(['session', 'label', 'ghost', 'discussion', 'ledger']);
    ok(['session', 'label', 'roadmap', 'discovery', 'roadmap']);
    ok(['session', 'label', 'pay', 'discussion', 'led.ger']);
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

describe('conversation position', () => {
  it('a conversation with no position has nothing to carry on from', () => {
    assert.deepStrictEqual(reads(), {
      session_id: 'sess-1',
      position: null,
      skill: null,
      files: [],
      text: 'This conversation holds no workflow position, so there is nothing to carry on from.',
    });
  });

  it('a work unit\'s menu runs no work: nothing to carry on from, the position named', () => {
    install('workflow-continue-epic');
    ok(['session', 'label', 'pay']);
    assert.deepStrictEqual(reads(), {
      session_id: 'sess-1',
      position: { name: 'pay' },
      skill: null,
      files: [],
      text: 'This conversation is at the epic "pay", outside any phase, so there is nothing to carry on from.',
    });
  });

  it('a discussion: its processing skill, its load directives followed, then the discussion', () => {
    install('workflow-discussion-process');
    write('.workflows/pay/discussion/ledger.md');
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    const answer = reads();
    assert.deepStrictEqual(answer.position, { name: 'pay', phase: 'discussion', topic: 'ledger' });
    assert.strictEqual(answer.skill, abs('.claude/skills/workflow-discussion-process/SKILL.md'));
    assert.deepStrictEqual(answer.files, [abs('.workflows/pay/discussion/ledger.md')]);
    assert.strictEqual(answer.text, [
      `This conversation is working in the discussion of "ledger" in "pay". To carry on there, re-read \`${dir}/.claude/skills/workflow-discussion-process/SKILL.md\` in full and follow its load directives, then re-read these in full:`,
      `- ${dir}/.workflows/pay/discussion/ledger.md`,
    ].join('\n'));
  });

  it('an implementation task: the skill, the plan format\'s reading adapter, and the task\'s file where the plan keeps one', () => {
    install('workflow-implementation-process');
    write('.claude/skills/workflow-planning-process/references/output-formats/flat-files/reading.md');
    write('.workflows/pay/planning/ledger/planning.md');
    write('.workflows/pay/planning/ledger/tasks/ledger-2-3.md');
    write('.workflows/pay/planning/ledger/tasks/ledger-2-4.md');
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
    const answer = reads();
    assert.deepStrictEqual(answer.files, [
      abs('.claude/skills/workflow-planning-process/references/output-formats/flat-files/reading.md'),
      abs('.workflows/pay/planning/ledger/tasks/ledger-2-3.md'),
    ]);
    assert.strictEqual(answer.text, [
      `This conversation is working in the implementation of "ledger" in "pay", on task 2.3 (internal id \`ledger-2-3\`). To carry on there, re-read \`${dir}/.claude/skills/workflow-implementation-process/SKILL.md\` in full and follow its load directives, then re-read these in full:`,
      `- ${dir}/.claude/skills/workflow-planning-process/references/output-formats/flat-files/reading.md`,
      `- ${dir}/.workflows/pay/planning/ledger/tasks/ledger-2-3.md`,
    ].join('\n'));
  });

  it('an implementation with no task in flight: the skill alone', () => {
    install('workflow-implementation-process');
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    const answer = reads();
    assert.deepStrictEqual([answer.skill, answer.files], [abs('.claude/skills/workflow-implementation-process/SKILL.md'), []]);
    assert.strictEqual(answer.text, `This conversation is working in the implementation of "ledger" in "pay". To carry on there, re-read \`${dir}/.claude/skills/workflow-implementation-process/SKILL.md\` in full and follow its load directives.`);
  });

  it('names only what this project has — a missing document is left out, a missing skill too', () => {
    ok(['session', 'label', 'pay', 'specification', 'ledger']);
    assert.strictEqual(reads().text, 'This conversation is working in the specification of "ledger" in "pay". Nothing of it is in this project to re-read.');
    write('.workflows/pay/specification/ledger/specification.md');
    assert.deepStrictEqual(reads(), {
      session_id: 'sess-1',
      position: { name: 'pay', phase: 'specification', topic: 'ledger' },
      skill: null,
      files: [abs('.workflows/pay/specification/ledger/specification.md')],
      text: `This conversation is working in the specification of "ledger" in "pay". To carry on there, re-read these in full:\n- ${dir}/.workflows/pay/specification/ledger/specification.md`,
    });
  });

  it('each phase names its own documents, the topic collapsed where it is the work unit', () => {
    workUnit('fix', 'quick-fix');
    const cases = [
      ['research', 'ledger', ['.workflows/pay/research/ledger.md']],
      ['investigation', 'ledger', ['.workflows/pay/investigation/ledger.md']],
      ['specification', 'ledger', ['.workflows/pay/specification/ledger/specification.md']],
      ['planning', 'ledger', ['.workflows/pay/planning/ledger/planning.md', '.workflows/pay/planning/ledger/phase-2-tasks.md', '.workflows/pay/planning/ledger/phase-10-tasks.md']],
      ['review', 'ledger', ['.workflows/pay/review/ledger/report.md']],
    ];
    for (const [phase, topic, files] of cases) {
      install(`workflow-${phase}-process`);
      for (const f of files) write(f);
      ok(['session', 'label', 'pay', phase, topic]);
      const answer = reads();
      assert.strictEqual(answer.skill, abs(`.claude/skills/workflow-${phase}-process/SKILL.md`), phase);
      assert.deepStrictEqual(answer.files, files.map(abs), phase);
    }
    install('workflow-scoping-process');
    write('.workflows/fix/specification/fix/specification.md');
    write('.workflows/fix/planning/fix/planning.md');
    ok(['session', 'label', 'fix', 'scoping', 'fix']);
    const scoping = reads();
    assert.deepStrictEqual(scoping.files, ['.workflows/fix/specification/fix/specification.md', '.workflows/fix/planning/fix/planning.md'].map(abs));
    assert.match(scoping.text, /^This conversation is working in the scoping of "fix"\. /);
  });

  it('discovery: the open session\'s log, else the latest on disk', () => {
    install('workflow-discovery');
    for (const n of ['001', '002', '010']) write(`.workflows/pay/discovery/sessions/session-${n}.md`);
    ok(['session', 'label', 'pay', 'discovery', 'pay']);
    let answer = reads();
    assert.strictEqual(answer.skill, abs('.claude/skills/workflow-discovery/SKILL.md'));
    assert.deepStrictEqual(answer.files, [abs('.workflows/pay/discovery/sessions/session-010.md')]);
    workUnit('pay', 'epic', { discovery: { active_session: '002' } });
    answer = reads();
    assert.deepStrictEqual(answer.files, [abs('.workflows/pay/discovery/sessions/session-002.md')]);
  });

  it('an experiment: each live record\'s files, a concluded one\'s left out', () => {
    install('workflow-experiment-process');
    workUnit('pay', 'epic', {
      experiment: { items: { ledger: { status: 'in-progress', experiments: {
        E1: { slug: 'latency', status: 'concluded' },
        E2: { slug: 'throughput', status: 'running' },
        'E2.1': { slug: 'batch', status: 'designed' },
      } } } },
    });
    for (const f of [
      'E1-latency/report.md',
      'E2-throughput/problem.md', 'E2-throughput/design.md', 'E2-throughput/report.md',
      'E2-throughput/E2.1-batch/problem.md',
    ]) write(`.workflows/pay/experiment/ledger/${f}`);
    ok(['session', 'label', 'pay', 'experiment', 'ledger']);
    assert.deepStrictEqual(reads().files, [
      '.workflows/pay/experiment/ledger/E2-throughput/problem.md',
      '.workflows/pay/experiment/ledger/E2-throughput/design.md',
      '.workflows/pay/experiment/ledger/E2-throughput/report.md',
      '.workflows/pay/experiment/ledger/E2-throughput/E2.1-batch/problem.md',
    ].map(abs));
  });

  it('the project-level places: the roadmap with its open session\'s log, the baseline its skill alone', () => {
    install('workflow-roadmap');
    install('workflow-baseline');
    write('.workflows/.roadmap/sessions/session-003.md');
    ok(['session', 'label', 'roadmap']);
    assert.deepStrictEqual([reads().skill, reads().files], [abs('.claude/skills/workflow-roadmap/SKILL.md'), []], 'no session open');
    write('.workflows/manifest.json', JSON.stringify({ roadmap: { active_session: '003' } }));
    const roadmap = reads();
    assert.deepStrictEqual(roadmap.files, [abs('.workflows/.roadmap/sessions/session-003.md')]);
    assert.match(roadmap.text, /^This conversation is working in the product roadmap\. /);
    ok(['session', 'label', 'baseline']);
    const baseline = reads();
    assert.deepStrictEqual([baseline.skill, baseline.files], [abs('.claude/skills/workflow-baseline/SKILL.md'), []]);
    assert.match(baseline.text, /^This conversation is working in the baseline assessment\. /);
  });

  it('names each file under the root of the project the call runs in, a dashed or dotted root spelled as it is', () => {
    const root = path.join(dir, 'code', 'my-repo.app');
    fs.mkdirSync(path.join(root, '.workflows', 'pay', 'discussion'), { recursive: true });
    fs.writeFileSync(path.join(root, '.workflows', 'pay', 'discussion', 'ledger.md'), '# ledger\n');
    writePosition({ name: 'pay', phase: 'discussion', topic: 'ledger' });
    const out = harness.output(root, ['conversation', 'position'], { env: env() });
    const answer = JSON.parse(out.slice(out.indexOf('=== POSITION')).split('\n')[1]);
    assert.deepStrictEqual(answer.files, [path.join(root, '.workflows/pay/discussion/ledger.md')]);
    assert.ok(answer.text.endsWith(`\n- ${root}/.workflows/pay/discussion/ledger.md`), answer.text);
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

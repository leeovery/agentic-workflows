'use strict';

//
// Tests for the conversation's position (domain/position.cjs): what every
// arrival records in the conversation's folder, labels on or off — a phase,
// a work unit's menu, the project-level places — a place this project lacks
// refused, marking the conversation first where the call runs in a
// workflows project, and nothing without a session id; the task `task
// start` adds and its `task complete` takes off; the start menu's repair
// dropping it; and `conversation position`, which answers what to re-read
// to carry on there: the skill that runs the work, then the topic's
// documents this project has, each by its absolute path under the project
// root, as the note a compaction hands up and one line of JSON for the gate
// mod — nothing from a place no longer open, or one whose skill the project
// lacks.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { skillAt } = require('../../skills/workflow-engine/scripts/domain/position.cjs');
const { OPENING_SKILLS } = require('../../skills/workflow-engine/scripts/domain/handoff.cjs');
const { PROJECT_IDENTITIES, VALID_PHASES } = require('../../skills/workflow-engine/scripts/kernel/manifest-schema.cjs');

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

/** Git in the project. */
function git(args) {
  return harness.git(dir, args);
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
    for (const [args, error] of [
      [['ghost'], /^no work unit directory: \.workflows\/ghost$/],
      [['pay', 'deploying', 'ledger'], /^unknown phase "deploying" — one of /],
      [['ghost', 'discussion', 'ledger'], /^no work unit directory: \.workflows\/ghost$/],
      [['roadmap', 'discovery', 'roadmap'], /^no work unit directory: \.workflows\/roadmap$/],
      [['pay', 'discussion', 'led.ger'], /^"led\.ger" is not a legal topic name/],
      [['p.ay'], /^"p\.ay" is not a legal work unit name/],
    ]) {
      assert.match(harness.refuses(dir, ['session', 'label', ...args], { env: env() }).error, error, args.join(' '));
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

describe('conversation position', () => {
  /** The note for a skill that runs the work and the files after it. */
  function note(where, skill, files) {
    const follow = `The conversation was just compacted. This conversation is working in ${where}. Follow the ${skill} skill's "Resuming After Context Refresh" steps now, before anything else: re-read ${abs(`.claude/skills/${skill}/SKILL.md`)} and its framework in full`;
    return files.length > 0 ? [`${follow}, then re-read these in full:`, ...files.map((f) => `- ${abs(f)}`)].join('\n') : `${follow}.`;
  }

  it('names only skills that carry the recovery steps and open a conversation — a phase\'s own, discovery\'s, a project place\'s; none at a work unit\'s menu', () => {
    const skills = [...VALID_PHASES.map((phase) => skillAt('pay', phase)), ...PROJECT_IDENTITIES.map((name) => skillAt(name))];
    assert.strictEqual(skills.length, 12);
    for (const skill of skills) {
      assert.ok(skill !== null && OPENING_SKILLS.includes(skill), `${skill} is a skill a conversation opens on`);
      const file = path.join(__dirname, '../../skills', skill, 'SKILL.md');
      assert.ok(fs.existsSync(file), `${skill} exists`);
      assert.match(fs.readFileSync(file, 'utf8'), /\n## Resuming After Context Refresh\n/, `${skill} carries the recovery steps`);
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
    install('workflow-continue-epic');
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

  it('a discussion: its phase skill\'s recovery steps, then the discussion', () => {
    install('workflow-discussion-process');
    write('.workflows/pay/discussion/ledger.md');
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    const answer = reads();
    assert.deepStrictEqual(answer.position, { name: 'pay', phase: 'discussion', topic: 'ledger' });
    assert.strictEqual(answer.place, 'pay › discussion › ledger');
    assert.strictEqual(answer.skill, abs('.claude/skills/workflow-discussion-process/SKILL.md'));
    assert.deepStrictEqual(answer.files, [abs('.workflows/pay/discussion/ledger.md')]);
    assert.strictEqual(answer.text, [
      `The conversation was just compacted. This conversation is working in the discussion of "ledger" in the epic "pay". Follow the workflow-discussion-process skill's "Resuming After Context Refresh" steps now, before anything else: re-read ${dir}/.claude/skills/workflow-discussion-process/SKILL.md and its framework in full, then re-read these in full:`,
      `- ${dir}/.workflows/pay/discussion/ledger.md`,
    ].join('\n'));
  });

  it('names the work unit by its work type, the topic collapsed where it is the work unit', () => {
    workUnit('auth', 'feature');
    install('workflow-discussion-process');
    write('.workflows/auth/discussion/auth.md');
    ok(['session', 'label', 'auth', 'discussion', 'auth']);
    const answer = reads();
    assert.strictEqual(answer.text, note('the discussion of the feature "auth"', 'workflow-discussion-process', ['.workflows/auth/discussion/auth.md']));
    assert.strictEqual(answer.place, 'auth › discussion');
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
      `The conversation was just compacted. This conversation is working in the implementation of "ledger" in the epic "pay", on task 2.3 (internal id \`ledger-2-3\`). Follow the workflow-implementation-process skill's "Resuming After Context Refresh" steps now, before anything else: re-read ${dir}/.claude/skills/workflow-implementation-process/SKILL.md and its framework in full, then re-read these in full:`,
      `- ${dir}/.claude/skills/workflow-planning-process/references/output-formats/flat-files/reading.md`,
      `- ${dir}/.workflows/pay/planning/ledger/tasks/ledger-2-3.md`,
    ].join('\n'));
    assert.strictEqual(answer.place, 'pay › implementation › ledger');
  });

  it('an implementation task whose plan names no format, or one no file can be named for, names no reading adapter', () => {
    install('workflow-implementation-process');
    write('.workflows/pay/planning/ledger/tasks/ledger-2-3.md');
    for (const format of [undefined, '../flat-files', 7]) {
      workUnit('pay', 'epic', {
        implementation: { items: { ledger: { status: 'in-progress', current_task: null, fix_attempts: 0 } } },
        planning: { items: { ledger: { status: 'completed', ...(format === undefined ? {} : { format }) } } },
      });
      ok(['session', 'label', 'pay', 'implementation', 'ledger']);
      ok(['task', 'start', 'pay', 'ledger', 'ledger-2-3']);
      assert.deepStrictEqual(reads().files, [abs('.workflows/pay/planning/ledger/tasks/ledger-2-3.md')], String(format));
    }
  });

  it('an implementation with no task in flight: the skill alone', () => {
    install('workflow-implementation-process');
    ok(['session', 'label', 'pay', 'implementation', 'ledger']);
    const answer = reads();
    assert.deepStrictEqual([answer.skill, answer.files], [abs('.claude/skills/workflow-implementation-process/SKILL.md'), []]);
    assert.strictEqual(answer.text, `The conversation was just compacted. This conversation is working in the implementation of "ledger" in the epic "pay". Follow the workflow-implementation-process skill's "Resuming After Context Refresh" steps now, before anything else: re-read ${dir}/.claude/skills/workflow-implementation-process/SKILL.md and its framework in full.`);
  });

  it('names only what this project has — a missing document is left out', () => {
    install('workflow-specification-process');
    ok(['session', 'label', 'pay', 'specification', 'ledger']);
    assert.deepStrictEqual(reads().files, []);
    assert.strictEqual(reads().text, note('the specification of "ledger" in the epic "pay"', 'workflow-specification-process', []));
    write('.workflows/pay/specification/ledger/specification.md');
    assert.deepStrictEqual(reads().files, [abs('.workflows/pay/specification/ledger/specification.md')]);
  });

  it('a place whose skill this project lacks carries nothing on, whatever documents it has', () => {
    write('.workflows/pay/specification/ledger/specification.md');
    ok(['session', 'label', 'pay', 'specification', 'ledger']);
    assert.deepStrictEqual(reads(), {
      session_id: 'sess-1',
      position: { name: 'pay', phase: 'specification', topic: 'ledger' },
      place: 'pay › specification › ledger',
      skill: null,
      files: [],
      text: 'This conversation was working in the specification of "ledger" in the epic "pay", but this project has no workflow-specification-process skill, so there is nothing to carry on from.',
    });
  });

  it('each phase names its own documents', () => {
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
      assert.strictEqual(answer.text, note(`the ${phase} of "${topic}" in the epic "pay"`, `workflow-${phase}-process`, files), phase);
    }
    install('workflow-scoping-process');
    write('.workflows/fix/specification/fix/specification.md');
    write('.workflows/fix/planning/fix/planning.md');
    ok(['session', 'label', 'fix', 'scoping', 'fix']);
    const scoping = reads();
    assert.deepStrictEqual(scoping.files, ['.workflows/fix/specification/fix/specification.md', '.workflows/fix/planning/fix/planning.md'].map(abs));
    assert.strictEqual(scoping.text, note('the scoping of the quick-fix "fix"', 'workflow-scoping-process', [
      '.workflows/fix/specification/fix/specification.md', '.workflows/fix/planning/fix/planning.md',
    ]));
  });

  it('discovery: the open session\'s log, else the latest on disk', () => {
    install('workflow-discovery');
    for (const n of ['001', '002', '010']) write(`.workflows/pay/discovery/sessions/session-${n}.md`);
    ok(['session', 'label', 'pay', 'discovery', 'pay']);
    let answer = reads();
    assert.strictEqual(answer.skill, abs('.claude/skills/workflow-discovery/SKILL.md'));
    assert.deepStrictEqual(answer.files, [abs('.workflows/pay/discovery/sessions/session-010.md')]);
    assert.strictEqual(answer.text, note('the discovery of the epic "pay"', 'workflow-discovery', ['.workflows/pay/discovery/sessions/session-010.md']));
    workUnit('pay', 'epic', { discovery: { active_session: '002' } });
    answer = reads();
    assert.deepStrictEqual(answer.files, [abs('.workflows/pay/discovery/sessions/session-002.md')]);
  });

  it('an experiment: each live record\'s files in register order, a concluded one\'s left out', () => {
    install('workflow-experiment-process');
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
    ]) write(`.workflows/pay/experiment/ledger/${f}`);
    ok(['session', 'label', 'pay', 'experiment', 'ledger']);
    assert.deepStrictEqual(reads().files, [
      '.workflows/pay/experiment/ledger/E1-latency/E1.1-warm/problem.md',
      '.workflows/pay/experiment/ledger/E2-throughput/problem.md',
      '.workflows/pay/experiment/ledger/E2-throughput/design.md',
      '.workflows/pay/experiment/ledger/E2-throughput/report.md',
      '.workflows/pay/experiment/ledger/E2-throughput/E2.1-batch/problem.md',
    ].map(abs));
  });

  it('an experiment series whose records name no directory contributes no files', () => {
    install('workflow-experiment-process');
    workUnit('pay', 'epic', {
      experiment: { items: { ledger: { status: 'in-progress', experiments: { 'E3.1': { slug: 'orphan', status: 'running' } } } } },
    });
    ok(['session', 'label', 'pay', 'experiment', 'ledger']);
    const answer = reads();
    assert.deepStrictEqual([answer.skill, answer.files], [abs('.claude/skills/workflow-experiment-process/SKILL.md'), []]);
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
    assert.strictEqual(roadmap.place, 'roadmap');
    assert.strictEqual(roadmap.text, note('the project\'s roadmap', 'workflow-roadmap', ['.workflows/.roadmap/sessions/session-003.md']));
    ok(['session', 'label', 'baseline']);
    const baseline = reads();
    assert.deepStrictEqual([baseline.skill, baseline.files, baseline.place], [abs('.claude/skills/workflow-baseline/SKILL.md'), [], 'baseline']);
    assert.strictEqual(baseline.text, note('the project\'s baseline', 'workflow-baseline', []));
  });

  it('a place no longer open carries nothing on — the work unit gone from this project or closed, the place\'s item closed', () => {
    install('workflow-discussion-process');
    write('.workflows/pay/discussion/ledger.md');
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
    fs.rmSync(path.join(dir, '.workflows', 'pay'), { recursive: true });
    closed('This conversation was working in the discussion of "ledger" in "pay", but this project has no work unit "pay", so there is nothing to carry on from.');
  });

  it('an experiment under a topic cancelled from the epic menu carries nothing on — the series settles, the map row is cancelled', () => {
    install('workflow-experiment-process');
    workUnit('pay', 'epic', {
      discovery: { items: { ledger: { routing: 'discussion', summary: 'The ledger.', source: 'discovery' } } },
      discussion: { items: { ledger: { status: 'in-progress', awaiting_experiments: ['E1'] } } },
      experiment: { items: { ledger: { status: 'in-progress', experiments: { E1: { slug: 'latency', status: 'running' } } } } },
    });
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'the epic']);
    write('.workflows/pay/experiment/ledger/E1-latency/problem.md');
    ok(['session', 'label', 'pay', 'experiment', 'ledger']);
    assert.notStrictEqual(reads().skill, null, 'the running laboratory carries on');
    ok(['topic', 'cancel', 'pay', 'discovery', 'ledger']);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/pay/manifest.json'), 'utf8'));
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
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'the epic']);
    install('workflow-discussion-process');
    ok(['session', 'label', 'pay', 'discussion', 'ledger']);
    assert.notStrictEqual(reads().skill, null, 'the concluded discussion carries on');
    ok(['topic', 'postpone', 'pay', 'ledger', '--horizon', 'later']);
    const answer = reads();
    assert.deepStrictEqual([answer.skill, answer.files], [null, []]);
    assert.strictEqual(answer.text, 'This conversation was working in the discussion of "ledger" in the epic "pay", but the discussion is postponed, so there is nothing to carry on from.');
  });

  it('research, an experiment and a discussion close with their topic on the map; a specification and a plan do not', () => {
    for (const marker of ['cancelled', 'postponed']) {
      for (const [phase, closes] of [['research', true], ['experiment', true], ['discussion', true], ['specification', false], ['planning', false]]) {
        install(`workflow-${phase}-process`);
        workUnit('pay', 'epic', {
          discovery: { items: { ledger: { [marker]: true } } },
          [phase]: { items: { ledger: { status: 'in-progress' } } },
        });
        ok(['session', 'label', 'pay', phase, 'ledger']);
        const answer = reads();
        assert.strictEqual(answer.skill === null, closes, `${phase} under a ${marker} topic`);
        if (closes) assert.match(answer.text, new RegExp(`but the topic is ${marker}, so there is nothing to carry on from\\.$`));
      }
    }
  });

  it('a work unit\'s menu no longer open says so', () => {
    ok(['session', 'label', 'pay']);
    workUnit('pay', 'epic', {}, { status: 'cancelled' });
    assert.strictEqual(reads().text, 'This conversation was working in the epic "pay", but "pay" is cancelled, so there is nothing to carry on from.');
  });

  it('a conversation a handoff began carries on from the place its first call labelled', () => {
    install('workflow-roadmap');
    ok(['session', 'label', 'roadmap'], 'sess-handed');
    const carried = reads([], 'sess-handed');
    assert.deepStrictEqual([carried.position, carried.skill], [{ name: 'roadmap' }, abs('.claude/skills/workflow-roadmap/SKILL.md')]);
    assert.strictEqual(carried.text, note('the project\'s roadmap', 'workflow-roadmap', []));
  });

  it('names each file under the root of the project the call runs in, a dashed or dotted root spelled as it is', () => {
    const root = path.join(dir, 'code', 'my-repo.app');
    fs.mkdirSync(path.join(root, '.claude', 'skills', 'workflow-discussion-process'), { recursive: true });
    fs.writeFileSync(path.join(root, '.claude', 'skills', 'workflow-discussion-process', 'SKILL.md'), '# discussion\n');
    fs.mkdirSync(path.join(root, '.workflows', 'pay', 'discussion'), { recursive: true });
    fs.writeFileSync(path.join(root, '.workflows', 'pay', 'manifest.json'), JSON.stringify({ name: 'pay', work_type: 'epic', status: 'in-progress', phases: {} }));
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

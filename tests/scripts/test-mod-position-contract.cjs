'use strict';

// What the mods read of `conversation position` is what the engine writes:
// the gate mod knows a workflow conversation by the engine's mark, finds the
// answer by its POSITION section marker and reads the keys of its one line of
// JSON, the rows mod knows a compaction's note by the engine's opening words,
// and both name the record of the notes handed up alike; the gate mod's
// spinner reads the position file the engine keeps, by its name and keys,
// again after the entry and each task verb the engine moves it with;
// and the gate mod records each task's builder and reviewers, the brief
// named by the pointer the engine issues, through the verb the engine
// answers, which the note then names.
// Each literal is read off the mod's source — a mod cannot import the engine
// — and held against a real answer.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { PROJECT_IDENTITIES, VALID_PHASES } = require('../../skills/leeway-engine/scripts/kernel/manifest-schema.cjs');
const { TASK_VERBS } = require('../../skills/leeway-engine/scripts/domain/task-verbs.cjs');
const { POINTER, ROLES, pointerOf } = require('../../skills/leeway-engine/scripts/domain/brief-names.cjs');
const { storeBrief } = require('../../skills/leeway-engine/scripts/domain/brief.cjs');
const { newId } = require('../../skills/leeway-engine/scripts/domain/ledger-ids.cjs');

const ROOT = path.join(__dirname, '..', '..');

const source = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** A string constant's value, as the mod's source spells it. */
function literal(rel, name) {
  const found = new RegExp(`const ${name} = '([^']*)'`).exec(source(rel));
  assert.ok(found, `${rel} names ${name}`);
  return found[1];
}

let dir;
let config;

const env = () => ({ LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined });

/** The engine's answer for a conversation at a discussion: its whole output, and its POSITION line parsed. */
function answer() {
  harness.ok(dir, ['session', 'label', 'pay', 'discussion', 'ledger'], { env: env() });
  const out = harness.output(dir, ['conversation', 'position'], { env: env() });
  const lines = out.split('\n');
  const at = lines.findIndex((line) => line.startsWith(literal('skills/leeway-gates/hooks/compaction.ts', 'POSITION_MARKER')));
  assert.notStrictEqual(at, -1, out);
  return { out, json: JSON.parse(lines[at + 1]) };
}

/**
 * Task 1.1 of the unit's build in flight in this conversation, through the
 * tracker's verbs, and the agent its brief `id` was issued for recorded
 * against it as the gate mod records one.
 * @param {string} id @param {'builder'|'reviewer'} role @param {string} agentId
 */
function building(id, role, agentId) {
  fs.writeFileSync(path.join(dir, '.leeway/pay/manifest.json'), JSON.stringify({ name: 'pay', work_type: 'epic', status: 'in-progress', phases: {}, build: { position: 'auto' } }));
  harness.commitAll(dir, 'the build begun');
  harness.ok(dir, ['task', 'phase', 'pay', '1', '--title', 'Ledger'], { env: env() });
  const file = path.join(config, 'task.md');
  fs.writeFileSync(file, '# Keep the ledger\n\n## Type\nfeat\n\n## Problem\nA.\n\n## Solution\nB.\n\n## Outcome\nC.\n\n## Acceptance scenarios\n- Given a, when b, then c.\n\n## Spec reference\n§1\n');
  harness.ok(dir, ['task', 'create', 'pay', '1', '--file', file], { env: env() });
  harness.ok(dir, ['task', 'start', 'pay', '1.1'], { env: env() });
  harness.withEnv({ LEEWAY_CONFIG_DIR: config }, () => storeBrief('sess-1', id, `Brief ${id}\n`, { role, agent: ROLES[role].agent, unit: 'pay', task: '1.1', topic: null }));
  assert.deepStrictEqual(harness.ok(dir, ['conversation', 'builder', 'sess-1', agentId, '--brief', id], { env: env() }), { ok: true, recorded: true });
}

beforeEach(() => {
  dir = harness.setupGitFixture('mod-position-contract-');
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'mod-position-contract-config-'));
  for (const [rel, content] of [
    ['.leeway/pay/manifest.json', JSON.stringify({ name: 'pay', work_type: 'epic', status: 'in-progress', phases: {} })],
    ['.leeway/pay/topics/ledger/log.md', '# ledger\n'],
    ['.claude/skills/leeway-discussion-process/SKILL.md', '# discussion\n'],
  ]) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
});

afterEach(() => {
  for (const d of [dir, config]) fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('the mods read conversation position as the engine writes it', () => {
  it('the gate mod knows a workflow conversation by the file the engine marks it with', () => {
    answer();
    const mark = literal('skills/leeway-gates/hooks/folder.ts', 'MARKER');
    assert.ok(fs.existsSync(path.join(config, 'conversations', 'sess-1', mark)), `the engine marks the conversation "${mark}"`);
  });

  it('the gate mod finds the POSITION line by the marker the engine opens it with', () => {
    const marker = literal('skills/leeway-gates/hooks/compaction.ts', 'POSITION_MARKER');
    assert.ok(answer().out.split('\n').some((line) => line.startsWith(marker)));
  });

  it('the gate mod reads the keys the engine writes — the note, the skill and the place', () => {
    const read = /const \{ (\w+), (\w+), (\w+) \} = JSON\.parse/.exec(source('skills/leeway-gates/hooks/compaction.ts'));
    assert.ok(read, 'the gate mod destructures the POSITION line');
    const { json } = answer();
    assert.deepStrictEqual(read.slice(1).sort(), ['place', 'skill', 'text']);
    for (const key of read.slice(1)) assert.ok(key in json, `the engine writes ${key}`);
    assert.strictEqual(typeof json.text, 'string');
    assert.strictEqual(typeof json.skill, 'string');
    assert.strictEqual(json.place, 'pay › discussion › ledger');
  });

  it('both mods name the record of the notes handed up alike, keyed by the note the row shows, valued by the engine\'s place', () => {
    const gates = literal('skills/leeway-gates/hooks/compaction.ts', 'COMPACTED');
    assert.strictEqual(literal('skills/leeway-gates-rows/hooks/compacted.ts', 'COMPACTED'), gates);
    assert.match(source('skills/leeway-gates/hooks/compaction.ts'), /\[text\.trim\(\)\]: place/, 'the gate mod keys each note by its text, trimmed, and values it by the place');
    assert.match(source('skills/leeway-gates-rows/hooks/compacted.ts'), /notes\[text\]/, 'the rows mod looks the row\'s trimmed text up');
    const { json } = answer();
    assert.strictEqual(json.text, json.text.trim(), 'the note is the key the row\'s trimmed text finds');
  });

  it('the spinner reads the position file the engine writes, by the keys it writes, each task in flight as `{phase}.{n}` with its agents', () => {
    building(newId(), 'builder', 'aa76bd7f82a2ef3e4');
    const file = path.join(config, 'conversations', 'sess-1', literal('skills/leeway-gates/hooks/folder.ts', 'POSITION'));
    assert.ok(fs.existsSync(file), 'the engine keeps the position under the name the mod reads');
    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepStrictEqual(written, { name: 'pay', phase: 'implementation', topic: 'pay', tasks: [{ task: '1.1', builder: 'aa76bd7f82a2ef3e4', reviewers: [] }] });
    /** The keys a type the mod declares names. @param {string} name */
    const keysOf = (name) => {
      const type = new RegExp(`export type ${name} = \\{([^}]*)\\}`).exec(source('skills/leeway-gates/hooks/position.ts'));
      assert.ok(type, `the spinner declares the ${name} it reads`);
      return [...type[1].matchAll(/(\w+)\??: /g)].map((m) => m[1]).sort();
    };
    assert.deepStrictEqual(Object.keys(written).sort(), keysOf('Position'), 'the spinner reads every key the engine writes');
    assert.deepStrictEqual(Object.keys(written.tasks[0]).sort(), keysOf('InFlight'), 'and every key of a task in flight');
    assert.match(source('skills/leeway-gates/hooks/position.ts'), /`task \$\{task\}`/, 'the spinner says the one task as the engine writes it');
    assert.match(source('skills/leeway-gates/hooks/position.ts'), /`\$\{tasks\.length\} tasks`/, 'and several by their count');
  });

  it('the spinner reads the position again after each task verb that moves it — the tracker\'s start, done and close', () => {
    const moves = /const MOVES =\s*\/(.+)\/\n/.exec(source('skills/leeway-gates/hooks/spinner.ts'));
    assert.ok(moves, 'the spinner declares the calls that move the position');
    const engine = literal('skills/leeway-gates/hooks/folder.ts', 'ENGINE');
    for (const verb of ['start', 'done', 'close']) {
      assert.ok(Object.hasOwn(TASK_VERBS, verb), `the engine dispatches task ${verb}`);
      assert.match(`node ${engine} task ${verb} pay 1.1`, new RegExp(moves[1]), `task ${verb}`);
    }
  });

  it('the spinner reads the position again after the entry the engine records it through', () => {
    const moves = /const MOVES =\s*\/(.+)\/\n/.exec(source('skills/leeway-gates/hooks/spinner.ts'));
    assert.ok(moves, 'the spinner declares the calls that move the position');
    fs.writeFileSync(path.join(dir, '.leeway/pay/manifest.json'), JSON.stringify({
      name: 'pay', work_type: 'epic', status: 'in-progress',
      phases: {
        discovery: { items: { ledger: { order: 1, summary: 'The ledger', source: 'discovery' } } },
        discussion: { items: { ledger: { status: 'in-progress' } } },
      },
    }));
    harness.ok(dir, ['enter', 'discussion', 'pay', 'ledger'], { env: env() });
    const file = path.join(config, 'conversations', 'sess-1', literal('skills/leeway-gates/hooks/folder.ts', 'POSITION'));
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { name: 'pay', phase: 'discussion', topic: 'ledger' });
    assert.match(`node ${literal('skills/leeway-gates/hooks/folder.ts', 'ENGINE')} enter discussion pay ledger`, new RegExp(moves[1]));
  });

  it('the spinner has a word for every phase and project-level place the engine records', () => {
    const words = (name) => {
      const map = new RegExp(`const ${name}[^=]*= new Map\\(\\[([\\s\\S]*?)\\]\\)`).exec(source('skills/leeway-gates/hooks/position.ts'));
      assert.ok(map, `the spinner declares ${name}`);
      return [...map[1].matchAll(/\['([^']+)', '[^']+'\]/g)].map((m) => m[1]).sort();
    };
    assert.deepStrictEqual(words('PHASE_WORDS'), [...VALID_PHASES].sort());
    assert.deepStrictEqual(words('PLACE_WORDS'), [...PROJECT_IDENTITIES].sort());
  });

  it('the gate mod records the agents a build dispatches, the brief named by the pointer the engine issues, through the verb the engine answers', () => {
    const builder = 'skills/leeway-gates/hooks/builder.ts';
    assert.deepStrictEqual([literal(builder, 'BUILDER'), literal(builder, 'REVIEWER')], [ROLES.builder.agent, ROLES.reviewer.agent], 'the agents the builder\'s and the reviewer\'s briefs are issued for');
    assert.strictEqual(literal(builder, 'POINTER'), POINTER);
    const pointed = /const POINTED = new RegExp\(`\^\$\{POINTER\}(.+)\$`\)/.exec(source(builder));
    assert.ok(pointed, 'the gate mod reads the brief\'s id off the pointer');
    const id = newId();
    assert.strictEqual(new RegExp(`^${POINTER}${pointed[1]}$`).exec(pointerOf(id))?.[1], id, 'the gate mod reads the id off the pointer the engine issues');
    const call = /\['node', `\$\{root\}\/\$\{ENGINE\}`, '(\w+)', '(\w+)', await \$\.session\.id\(\), agentId, \.\.\.brief\]/.exec(source(builder));
    assert.ok(call, 'the gate mod runs the engine with the session id, the agent id and the brief');
    assert.match(source(builder), /\['--brief', id\]/, 'the brief is handed as the engine takes it');
    const engine = literal('skills/leeway-gates/hooks/folder.ts', 'ENGINE');
    assert.ok(engine.startsWith('.claude/') && fs.existsSync(path.join(ROOT, engine.slice('.claude/'.length))), `the gate mod runs the engine where a project installs it (${engine})`);
    const file = path.join(config, 'conversations', 'sess-1', literal('skills/leeway-gates/hooks/folder.ts', 'POSITION'));

    assert.deepStrictEqual([call[1], call[2]], ['conversation', 'builder'], 'the verb the engine records a dispatch through');
    building(id, 'reviewer', 'ab12cd34');
    const builderBrief = newId();
    harness.withEnv({ LEEWAY_CONFIG_DIR: config }, () => storeBrief('sess-1', builderBrief, `Brief ${builderBrief}\n`, { role: 'builder', agent: ROLES.builder.agent, unit: 'pay', task: '1.1', topic: null }));
    assert.deepStrictEqual(harness.ok(dir, [call[1], call[2], 'sess-1', 'aa76bd7f82a2ef3e4', '--brief', builderBrief], { env: env() }), { ok: true, recorded: true });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).tasks, [{ task: '1.1', builder: 'aa76bd7f82a2ef3e4', reviewers: ['ab12cd34'] }]);
  });

  it('the rows mod knows the note by the words the engine opens it with', () => {
    const opening = literal('skills/leeway-gates-rows/hooks/compacted.ts', 'OPENING');
    assert.ok(answer().json.text.startsWith(opening), `the note opens "${opening}"`);
  });
});

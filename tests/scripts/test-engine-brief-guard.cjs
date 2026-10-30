'use strict';

// ---------------------------------------------------------------------------
// The brief hook (workflow-engine/scripts/domain/brief-guard.cjs): `engine
// brief guard`, Claude Code's hook before Agent and SendMessage, fed its
// JSON on stdin as Claude Code sends it. A call reaching none of the
// workflows' agents — Claude's own subagents, a `workflow-*` agent, a
// message to one, a recipient with no record, input it cannot read — passes
// untouched: exit 0, nothing said, nothing recorded (6.5.8). A call of one,
// named `leeway-*` — by Agent's `subagent_type`, or by the agent type a
// SendMessage recipient's record names — carrying its brief's pointer alone
// is answered with the tool's input whole, the stored brief in place of the
// pointer in every field holding it, and no permission decision (6.S16,
// 6.S33) — a fix round's brief among them, by SendMessage to the builder
// (6.S17). Every other is refused with exit 2, its reason on stderr, and one
// line appended to the brief hook's refusals: no template, no brief, a brief
// never issued in the conversation stdin names, a pointer with anything
// beside it, another agent's brief, and any failure checking it (6.5.9).
//
// Layer: verb, and process for the shell door. World: a project with one
// work unit and a task ready for its builder, two reviewers' reports on it,
// the builder's brief and the fix round's issued once for the file; a
// project with no unit, the product researcher's brief issued in it; a
// conversation's transcript folder holding its subagents' records.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  ENGINE, call, ok, statePath, layout, writeState, readState, commitAll, fixtureFrom, setupGitFixture, cleanupFixture, withFrozenClock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { BRIEF_REFUSALS, briefPath, issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { SPEC_FILE } = require(path.join(SCRIPTS, 'domain/spec-sections.cjs'));
const { systemConfigDir } = require(path.join(SCRIPTS, 'kernel/system-config.cjs'));

const UNIT = 'pay';
const SESSION_ID = 'guard-session';
const OTHER_SESSION = 'other-session';
const REFUSALS = path.join(systemConfigDir(), BRIEF_REFUSALS);
const STAMPED = FROZEN_AT.replace(/\.\d{3}Z$/, 'Z');
const TASK = [
  '# Take a card', '', '## Type', 'feat', '', '## Problem', 'A card cannot be taken.', '', '## Solution', 'Add the card form.', '',
  '## Outcome', 'A card is taken.', '', '## Acceptance scenarios', '- Given a card, when it is taken, then it is charged.', '', '## Spec reference', '§1',
].join('\n');

/** The two reviewers' reports on the first task, in the unit's build folder. */
const REPORTS = Object.freeze([layout.unit(UNIT, 'build/tasks/1.1/round-1-a.md'), layout.unit(UNIT, 'build/tasks/1.1/round-1-b.md')]);

/** The unit, its spec of one area, its first task citing it, and two reports on that task. */
const unitWorld = fixtureFrom('brief-guard-', (dir) => {
  createManifest(dir, UNIT, {});
  writeState(dir, layout.unit(UNIT, SPEC_FILE), '# Payments\n\n## 1. Cards\n\nA card is taken once.\n');
  writeState(dir, REPORTS[0], 'Verdict: fail\n\n- card.js keeps the token in plain text.\n');
  writeState(dir, REPORTS[1], 'Verdict: fail\n\n- The receipt omits the amount.\n');
  commitAll(dir, 'init');
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'Cards']);
  const file = path.join(dir, '..', 'task.md');
  fs.writeFileSync(file, TASK);
  ok(dir, ['task', 'create', UNIT, '1', '--file', file]);
});

/** @type {string} */
let dir;
/** @type {string} */
let bare;
/** @type {string} */
let projects;
/** Each brief issued for the file, by name: its id, and the brief as stored. @type {Record<string, {id: string, text: string}>} */
const briefs = {};

/** A brief issued in `at`, in the conversation `session`. @param {string} at @param {string[]} args @param {string} session */
function issued(at, args, session) {
  const { id } = ok(at, ['brief', ...args], { env: { CLAUDE_CODE_SESSION_ID: session } });
  return { id, text: fs.readFileSync(briefPath(session, id), 'utf8') };
}

/** A subagent of the conversation recorded as dispatched as `agentType`. @param {string} id @param {string} agentType */
function recordSubagent(id, agentType) {
  const subagents = path.join(projects, '-tmp-project', SESSION_ID, 'subagents');
  fs.mkdirSync(subagents, { recursive: true });
  fs.writeFileSync(path.join(subagents, `agent-${id}.meta.json`), JSON.stringify({ agentType, description: 'a subagent' }));
}

before(() => {
  dir = unitWorld();
  bare = fs.realpathSync(setupGitFixture('brief-guard-bare-'));
  projects = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'brief-guard-projects-')));
  briefs.builder = issued(dir, ['builder', UNIT, '1.1'], SESSION_ID);
  briefs.fix = issued(dir, ['fix', UNIT, '1.1', '--report-a', statePath(dir, REPORTS[0]), '--report-b', statePath(dir, REPORTS[1])], SESSION_ID);
  briefs.researcher = issued(bare, ['product-researcher'], SESSION_ID);
  briefs.elsewhere = issued(dir, ['builder', UNIT, '1.1'], OTHER_SESSION);
  recordSubagent('a1builder', 'leeway-builder');
  recordSubagent('a2explore', 'Explore');
  recordSubagent('a3workflow', 'workflow-task-executor');
  fs.writeFileSync(path.join(projects, '-tmp-project', SESSION_ID, 'subagents', 'agent-a4torn.meta.json'), '{"agentType": "leeway-bu');
});

after(() => {
  for (const at of [dir, bare, projects]) cleanupFixture(at);
  for (const session of [SESSION_ID, OTHER_SESSION]) fs.rmSync(conversationDir(session), { recursive: true, force: true });
});

afterEach(() => {
  fs.rmSync(REFUSALS, { force: true });
});

/**
 * The hook's stdin, as Claude Code writes it before a tool call.
 * @param {string} tool @param {Record<string, unknown>} toolInput @param {Record<string, unknown>} [fields] the call's own, over the conversation's
 */
function hookInput(tool, toolInput, fields = {}) {
  return JSON.stringify({
    session_id: SESSION_ID, transcript_path: path.join(projects, '-tmp-project', `${SESSION_ID}.jsonl`), cwd: dir, permission_mode: 'default',
    hook_event_name: 'PreToolUse', tool_name: tool, tool_input: toolInput, tool_use_id: 'toolu_01', ...fields,
  });
}

/** An Agent call's input, as Claude Code sends it. @param {string} type @param {string} prompt */
const agentCall = (type, prompt) => ({ description: 'Build task 1.1', prompt, subagent_type: type, run_in_background: true });

/** A SendMessage call's input, as Claude Code sends it, its text in both fields. @param {string} to @param {string} text */
const messageCall = (to, text) => ({ to, summary: 'the fix round', message: text, type: 'message', recipient: to, recipient_kind: 'agent', content: text });

/**
 * The hook run on a call in the unit's project, the clock frozen.
 * @param {string} tool @param {Record<string, unknown>} toolInput @param {Record<string, unknown>} [fields] @param {Record<string, string>} [env]
 */
function guard(tool, toolInput, fields, env) {
  return withFrozenClock(() => call(dir, ['brief', 'guard'], { env, stdin: hookInput(tool, toolInput, fields) }));
}

/** The refusals recorded, parsed. */
const recorded = () => (fs.existsSync(REFUSALS) ? fs.readFileSync(REFUSALS, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : []);

/** @param {{code: number, stdout: string, stderr: string}} res @param {string} what */
function assertUntouched(res, what) {
  assert.deepStrictEqual({ code: res.code, stdout: res.stdout, stderr: res.stderr }, { code: 0, stdout: '', stderr: '' }, what);
  assert.deepStrictEqual(recorded(), [], `${what}: nothing recorded`);
}

/**
 * The hook's answer: the tool's input whole, with `brief` in each of the
 * fields named, and no permission decision; nothing recorded.
 * @param {{code: number, stdout: string, stderr: string}} res @param {Record<string, unknown>} toolInput @param {string[]} fields @param {string} brief
 */
function assertSwapped(res, toolInput, fields, brief) {
  assert.deepStrictEqual([res.code, res.stderr], [0, '']);
  const updatedInput = { ...toolInput, ...Object.fromEntries(fields.map((field) => [field, brief])) };
  assert.strictEqual(res.stdout, `${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput } })}\n`);
  assert.deepStrictEqual(recorded(), []);
}

/**
 * A refusal: exit 2, its detail alone on stderr, nothing on stdout, and its
 * line the last recorded.
 * @param {{code: number, stdout: string, stderr: string}} res
 * @param {{tool: string, agent: string, brief: string|null, reason: string, detail: string}} line
 * @param {{project_id?: string|null, project?: string|null, session?: string|null}} [at]
 */
function assertRefused(res, line, at = {}) {
  assert.deepStrictEqual({ code: res.code, stdout: res.stdout, stderr: res.stderr }, { code: 2, stdout: '', stderr: `${line.detail}\n` }, line.reason);
  const project = { project_id: JSON.parse(readState(dir, layout.projectManifest)).project_id, project: path.basename(dir), session: SESSION_ID };
  assert.deepStrictEqual(recorded().at(-1), {
    v: 1, at: STAMPED, ...project, ...at, tool: line.tool, agent: line.agent, brief: line.brief, reason: line.reason, detail: line.detail,
  });
}

const pointer = (/** @type {string} */ id) => `brief:${id}`;

describe('a call reaching none of the workflows\' agents, untouched (6.5.8)', () => {
  it('Claude\'s own subagents — Explore, general-purpose, a workflow-* agent — and a message to one pass: exit 0, nothing said, nothing recorded, whatever the text carries, the calling conversation left unmarked', () => {
    const unmarked = { CLAUDE_CODE_SESSION_ID: 'unmarked-session' };
    for (const type of ['Explore', 'general-purpose', 'workflow-task-executor', 'my-leeway-x', 'leeway']) {
      assertUntouched(guard('Agent', agentCall(type, 'Find the card form.'), {}, unmarked), type);
      assertUntouched(guard('Agent', agentCall(type, pointer('Missing0000000000000')), {}, unmarked), `${type} carrying a pointer`);
    }
    for (const to of ['a2explore', 'a3workflow']) assertUntouched(guard('SendMessage', messageCall(to, 'Carry on.'), {}, unmarked), `a message to ${to}`);
    assert.ok(!fs.existsSync(conversationDir('unmarked-session')), 'a hook target never marks the conversation');
  });

  it('a call the hook cannot tell is of one of the workflows\' agents passes: a recipient with no record, or a torn one, no transcript, no tool input, input that is no JSON', () => {
    assertUntouched(guard('SendMessage', messageCall('a9unknown', 'Carry on.')), 'a recipient with no record');
    assertUntouched(guard('SendMessage', messageCall('a4torn', 'Carry on.')), 'a recipient whose record is torn');
    assertUntouched(guard('SendMessage', messageCall('a1builder', 'Carry on.'), { transcript_path: undefined }), 'no transcript');
    assertUntouched(guard('Agent', agentCall('leeway-builder', 'x'), { tool_input: undefined }), 'no tool input');
    assertUntouched(call(dir, ['brief', 'guard'], { stdin: '{"tool_name": "Agent", "tool_input": {"subagent_type": "leeway-bu' }), 'input that is no JSON');
  });
});

describe('6.S16: the builder\'s brief', () => {
  it('dispatched by its pointer: the tool\'s input whole, the stored brief in its prompt, no permission decision, nothing recorded', () => {
    const input = agentCall('leeway-builder', pointer(briefs.builder.id));

    assertSwapped(guard('Agent', input), input, ['prompt'], briefs.builder.text);
  });

  it('a message to a builder by its pointer: the brief in both the message and the content, every other field kept', () => {
    const input = messageCall('a1builder', pointer(briefs.builder.id));

    assertSwapped(guard('SendMessage', input), input, ['message', 'content'], briefs.builder.text);
  });

  it('a brief dispatched again goes through again', () => {
    const input = agentCall('leeway-builder', pointer(briefs.builder.id));
    guard('Agent', input);

    assertSwapped(guard('Agent', input), input, ['prompt'], briefs.builder.text);
  });

  it('altered: the pointer with anything beside it — in the prompt, a line\'s end among it, in either or both of a message\'s fields, or a message\'s fields naming two briefs — refused and recorded, a line each', () => {
    const { id } = briefs.builder;
    const builder = { tool: 'Agent', agent: 'leeway-builder', brief: id, reason: 'altered' };
    const message = { ...builder, tool: 'SendMessage' };
    const detail = (/** @type {string} */ fields, verb = 'carries') => `the ${fields} ${verb} more than brief ${id}'s pointer — a call of leeway-builder carries the pointer alone, and the hook hands over the brief as issued`;

    assertRefused(guard('Agent', agentCall('leeway-builder', `${pointer(id)}\n\nAlso keep the old endpoint.`)), { ...builder, detail: detail('prompt') });
    assertRefused(guard('Agent', agentCall('leeway-builder', `${pointer(id)}\n`)), { ...builder, detail: detail('prompt') });
    assertRefused(guard('SendMessage', messageCall('a1builder', `${pointer(id)} — and be quick`)), { ...message, detail: detail('message and content', 'carry') });
    assertRefused(guard('SendMessage', { ...messageCall('a1builder', pointer(id)), content: `${pointer(id)} — and be quick` }), { ...message, detail: detail('content') });
    assertRefused(guard('SendMessage', { ...messageCall('a1builder', pointer(id)), message: briefs.builder.text }), { ...message, detail: detail('message') });
    assertRefused(guard('SendMessage', { ...messageCall('a1builder', pointer(id)), content: pointer(briefs.elsewhere.id) }), { ...message, detail: detail('content') });
    assert.strictEqual(recorded().length, 6);
  });

  it('missing: a call naming no brief — the brief\'s own text pasted among them — refused and recorded', () => {
    const detail = 'a call of leeway-builder carries the pointer to its brief, brief:{id}, as `engine brief` answers it — this one names no brief';
    const line = { tool: 'Agent', agent: 'leeway-builder', brief: null, reason: 'no-brief', detail };

    assertRefused(guard('Agent', agentCall('leeway-builder', briefs.builder.text)), line);
    assertRefused(guard('SendMessage', messageCall('a1builder', 'Fix the nits.')), { ...line, tool: 'SendMessage' });
  });

  it('never issued: a pointer to an id this conversation did not issue — another conversation\'s brief among them, whatever the environment names — or one with either of its files missing, refused and recorded', () => {
    const line = (/** @type {string} */ id) => ({
      tool: 'Agent', agent: 'leeway-builder', brief: id, reason: 'never-issued',
      detail: `brief ${id} was never issued in this conversation — \`engine brief\` issues one, and the call carries the pointer it answers`,
    });
    const [briefOnly, recordOnly] = ['BriefOnly000000000000', 'RecordOnly00000000000'];
    fs.writeFileSync(briefPath(SESSION_ID, briefOnly), briefs.builder.text);
    fs.writeFileSync(issuedPath(SESSION_ID, recordOnly), JSON.stringify({ role: 'builder', agent: 'leeway-builder', unit: UNIT, task: '1.1' }));

    assertRefused(guard('Agent', agentCall('leeway-builder', pointer('Never0000000000000000'))), line('Never0000000000000000'));
    const { id } = briefs.elsewhere;
    assertRefused(guard('Agent', agentCall('leeway-builder', pointer(id)), {}, { CLAUDE_CODE_SESSION_ID: OTHER_SESSION }), line(id));
    assertRefused(guard('Agent', agentCall('leeway-builder', pointer(briefOnly))), line(briefOnly));
    assertRefused(guard('Agent', agentCall('leeway-builder', pointer(recordOnly))), line(recordOnly));
  });

  it('another agent\'s: a brief issued for another agent, refused and recorded', () => {
    const [builder, researcher] = [briefs.builder.id, briefs.researcher.id];

    assertRefused(guard('Agent', agentCall('leeway-builder', pointer(researcher))), {
      tool: 'Agent', agent: 'leeway-builder', brief: researcher, reason: 'other-agent',
      detail: `brief ${researcher} was issued for leeway-product-researcher, not leeway-builder — \`engine brief builder\` or \`engine brief fix\` issues one for leeway-builder`,
    });
    assertRefused(guard('Agent', agentCall('leeway-product-researcher', pointer(builder))), {
      tool: 'Agent', agent: 'leeway-product-researcher', brief: builder, reason: 'other-agent',
      detail: `brief ${builder} was issued for leeway-builder, not leeway-product-researcher — \`engine brief product-researcher\` issues one for leeway-product-researcher`,
    });
  });

  it('one of the workflows\' agents no role is dispatched as is refused and recorded, whatever it carries', () => {
    assertRefused(guard('Agent', agentCall('leeway-scribe', pointer(briefs.builder.id))), {
      tool: 'Agent', agent: 'leeway-scribe', brief: null, reason: 'no-template',
      detail: 'leeway-scribe is named as one of the workflows\' agents, and no role is dispatched as leeway-scribe — there is no template to brief it from',
    });
  });

  it('a failure checking one of the workflows\' agents refuses and is recorded: no session id, before any brief is read; a brief issued as no agent, its id kept', () => {
    const line = { tool: 'Agent', agent: 'leeway-builder', brief: null, reason: 'error' };
    const torn = 'Torn00000000000000000';
    fs.writeFileSync(briefPath(SESSION_ID, torn), briefs.builder.text);
    fs.writeFileSync(issuedPath(SESSION_ID, torn), JSON.stringify({ role: 'builder' }));

    assertRefused(guard('Agent', agentCall('leeway-builder', pointer(briefs.builder.id)), { session_id: undefined }), {
      ...line, detail: 'the brief for leeway-builder could not be checked: the hook was handed no session id',
    }, { session: null });
    assertRefused(guard('Agent', agentCall('leeway-builder', pointer(torn))), {
      ...line, brief: torn, detail: `the brief for leeway-builder could not be checked: what brief ${torn} was issued as names no agent`,
    });
  });
});

describe('6.S17: the fix round\'s brief', () => {
  it('a message to the builder carrying its pointer goes through, the brief with the two reports in both the message and the content', () => {
    const input = messageCall('a1builder', pointer(briefs.fix.id));

    assertSwapped(guard('SendMessage', input), input, ['message', 'content'], briefs.fix.text);
  });
});

describe('6.S33: the product researcher\'s brief, issued with no work unit', () => {
  it('found in the conversation\'s briefs and through; a dispatch whose content differs refused, its line appended', () => {
    const { id, text } = briefs.researcher;
    const input = { ...agentCall('leeway-product-researcher', pointer(id)), description: 'Research the code' };
    const run = (/** @type {Record<string, unknown>} */ toolInput) => withFrozenClock(() => call(bare, ['brief', 'guard'], { stdin: hookInput('Agent', toolInput, { cwd: bare }) }));

    assertSwapped(run(input), input, ['prompt'], text);
    const res = run({ ...input, prompt: `${pointer(id)}\nLook at the payments code first.` });
    assertRefused(res, {
      tool: 'Agent', agent: 'leeway-product-researcher', brief: id, reason: 'altered',
      detail: `the prompt carries more than brief ${id}'s pointer — a call of leeway-product-researcher carries the pointer alone, and the hook hands over the brief as issued`,
    }, { project_id: JSON.parse(readState(bare, layout.projectManifest)).project_id, project: path.basename(bare) });
  });
});

describe('the shell door', () => {
  it('a spawned hook prints the hook\'s answer alone and exits 0 for a brief it hands over, exits 2 with nothing on stdout for a refusal, and 0 with nothing at all for a call not its own', () => {
    const run = (/** @type {Record<string, unknown>} */ toolInput) => spawnSync('node', [ENGINE, 'brief', 'guard'], { cwd: dir, encoding: 'utf8', input: hookInput('Agent', toolInput) });
    const input = agentCall('leeway-builder', pointer(briefs.builder.id));

    const swapped = run(input);
    assert.deepStrictEqual([swapped.status, swapped.stderr], [0, '']);
    assert.deepStrictEqual(JSON.parse(swapped.stdout), { hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...input, prompt: briefs.builder.text } } });
    const refused = run({ ...input, prompt: 'Build it.' });
    assert.deepStrictEqual([refused.status, refused.stdout], [2, '']);
    assert.match(refused.stderr, /this one names no brief\n$/);
    const untouched = run(agentCall('Explore', 'Find the form.'));
    assert.deepStrictEqual([untouched.status, untouched.stdout, untouched.stderr], [0, '', '']);
  });

  it('a stray argument is a usage error, which lets the call through', () => {
    const res = call(dir, ['brief', 'guard', 'extra'], { stdin: hookInput('Agent', agentCall('leeway-builder', 'x')) });
    assert.strictEqual(res.code, 1);
    assert.match(res.stderr, /^Usage: engine brief guard/);
    assert.deepStrictEqual(recorded(), []);
  });
});

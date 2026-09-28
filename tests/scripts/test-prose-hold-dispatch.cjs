'use strict';

// Every dispatch a walker makes is held, and every send continuing one:
// recorded whole and refused before any agent starts, so a case can claim
// what a dispatch carried and which agent a later round continued, and no
// real agent ever runs inside a world. Two failures matter above
// the rest — a walker's call let through, and an orchestrator's call
// blocked (which would stop every run before it began) — so both are
// pinned here, along with how the hold finds a world the payload never
// names.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { spawnSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const worlds = require('../prose/lib/worlds.cjs');
const { loadTemplate, fill } = require('../prose/lib/prompts.cjs');

const HOOK = path.join(__dirname, '..', 'prose', 'lib', 'hold-dispatch.cjs');

let world;
let config;

function env(extra = {}) {
  return { ...process.env, CLAUDE_CONFIG_DIR: config, ...extra };
}

/** Feed the hook a payload exactly as the harness would, on stdin. */
function fire(payload, extra) {
  const r = spawnSync('node', [HOOK], { input: JSON.stringify(payload), env: env(extra), encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function fireAsync(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [HOOK], { env: env() });
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout }));
    child.stdin.end(JSON.stringify(payload));
  });
}

/** A walker's dispatch, in the shape Claude Code hands a PreToolUse hook. */
function dispatch({ id = 'toolu_01', agent = 'workflow-specification-review-input', prompt, tool = 'Agent', type = 'prose-walker', ...rest } = {}) {
  return {
    hook_event_name: 'PreToolUse',
    tool_name: tool,
    agent_type: type,
    agent_id: 'a1b2c3',
    tool_use_id: id,
    tool_input: {
      subagent_type: agent,
      description: 'Input review cycle 1',
      prompt: prompt === undefined ? `Work in ${world}.\nSource material: .workflows/pay/discussion/pay.md` : prompt,
      run_in_background: true,
    },
    ...rest,
  };
}

/** A walker's send continuing the agent a held dispatch was given `to`. */
function send({ id = 'toolu_02', to = 'toolu_01', message, type = 'prose-walker' } = {}) {
  return {
    hook_event_name: 'PreToolUse',
    tool_name: 'SendMessage',
    agent_type: type,
    agent_id: 'a1b2c3',
    tool_use_id: id,
    tool_input: {
      to,
      summary: 'Retry round for pay-1-2',
      message: message === undefined ? `Retry in ${world}.\nNext attempt: key the guard on the intent` : message,
    },
  };
}

function denial(out) {
  assert.equal(out.status, 0, `the hook exits 0 (stderr: ${out.stderr})`);
  const parsed = JSON.parse(out.stdout);
  assert.ok(!('continue' in parsed), 'never continue:false — the walker must go on');
  return parsed.hookSpecificOutput;
}

const records = () => worlds.readDispatches(world);
const rows = () => worlds.readActionRows(world);

/** A transcript under the fake config, where findAgentTranscript looks. */
function writeTranscript(agentId, firstTurn) {
  const dir = path.join(config, 'projects', 'some-project', 'some-session', 'subagents');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `agent-${agentId}.jsonl`);
  fs.writeFileSync(file, `${JSON.stringify({ type: 'user', message: { role: 'user', content: firstTurn } })}\n`);
  return file;
}

beforeEach(() => {
  world = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-world-'));
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-config-'));
});

afterEach(() => {
  fs.rmSync(world, { recursive: true, force: true });
  fs.rmSync(config, { recursive: true, force: true });
});

describe('the hold — a walker\'s dispatch', () => {
  it('is refused with the dispatch-held reason from the walker template, and never stops the walker', () => {
    const decision = denial(fire(dispatch()));
    assert.equal(decision.hookEventName, 'PreToolUse');
    assert.equal(decision.permissionDecision, 'deny');
    const reason = loadTemplate('walker')['dispatch-held'];
    assert.ok(reason && reason.includes('{{agent_id}}'), 'the template carries the section, with a slot for the id');
    assert.equal(decision.permissionDecisionReason, fill(reason, { agent_id: 'toolu_01' }));
  });

  it('names its own tool_use_id as the held agent\'s id, for a later send to address', () => {
    const decision = denial(fire(dispatch({ id: 'toolu_01AJX9Jn44LMhWCo6UDu8gcF' })));
    assert.ok(decision.permissionDecisionReason.includes('`toolu_01AJX9Jn44LMhWCo6UDu8gcF`'));
    assert.ok(!decision.permissionDecisionReason.includes('{{'), 'no slot left unfilled');
  });

  it('holds the Task alias the same way', () => {
    assert.equal(denial(fire(dispatch({ tool: 'Task' }))).permissionDecision, 'deny');
    const [r] = records();
    assert.equal(r.tool_name, 'Task');
    assert.equal(rows()[0].tool, 'Agent', 'the ordering row names a dispatch whatever the tool is called');
  });

  it('records the call verbatim — the prompt uncapped, its newlines kept — and a held row in the action log', () => {
    const prompt = `Work in ${world}.\n\n${'input '.repeat(3000)}\nlast line`;
    const payload = dispatch({ prompt });
    fire(payload);
    assert.deepEqual(records(), [{ tool_use_id: 'toolu_01', tool_name: 'Agent', tool_input: payload.tool_input }]);
    const log = fs.readFileSync(path.join(world, worlds.ACTION_LOG), 'utf8');
    assert.equal(log, 'PreToolUse\tAgent\tworkflow-specification-review-input — Input review cycle 1\theld\ttoolu_01\n');
  });

  it('resolves the world from the walker\'s transcript, by agent id, when the payload names none', () => {
    writeTranscript('a1b2c3', `Project directory — your cwd for EVERY command: ${world}`);
    denial(fire(dispatch({ prompt: 'Review .workflows/pay/specification/pay/specification.md' })));
    assert.equal(records().length, 1, 'recorded into the world the transcript walked');
    assert.equal(rows()[0].outcome, 'held');
  });

  it('finds the transcript beside the session a payload names before searching every project', () => {
    const session = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-session-'));
    try {
      const subagents = path.join(session, 'sess-1', 'subagents');
      fs.mkdirSync(subagents, { recursive: true });
      fs.writeFileSync(path.join(subagents, 'agent-a1b2c3.jsonl'),
        `${JSON.stringify({ message: { role: 'user', content: `Walk in ${world}.` } })}\n`);
      denial(fire(dispatch({ prompt: 'no world here', transcript_path: path.join(session, 'sess-1.jsonl') })));
      assert.equal(records().length, 1);
    } finally {
      fs.rmSync(session, { recursive: true, force: true });
    }
  });

  it('still refuses a call whose world it cannot find — fail closed, nothing recorded anywhere', () => {
    const decision = denial(fire(dispatch({ prompt: 'no world here', agent_id: 'ffffff' })));
    assert.equal(decision.permissionDecision, 'deny');
    assert.deepEqual(fs.readdirSync(world), [], 'no world was named, so none was written');
  });

  it('still refuses when the world named has already gone', () => {
    const gone = path.join(os.tmpdir(), 'prose-world-GONE00');
    assert.equal(denial(fire(dispatch({ prompt: `Work in ${gone}.`, agent_id: 'ffffff' }))).permissionDecision, 'deny');
  });

  it('records a parallel batch in the order its calls reached the hold, each under its own id', () => {
    const agents = ['analysis-duplication', 'analysis-standards', 'analysis-architecture'];
    agents.forEach((agent, i) => denial(fire(dispatch({ id: `toolu_0${i + 1}`, agent }))));
    assert.deepEqual(records().map((r) => [r.tool_use_id, r.tool_input.subagent_type]),
      agents.map((a, i) => [`toolu_0${i + 1}`, a]));
    assert.deepEqual(rows().map((r) => [r.output, r.detail.split(' — ')[0]]),
      agents.map((a, i) => [`toolu_0${i + 1}`, a]));
  });

  it('keeps every record whole when the calls reach the hold at once', async () => {
    const outs = await Promise.all([1, 2, 3, 4].map((n) => fireAsync(dispatch({
      id: `toolu_p${n}`, agent: `agent-${n}`, prompt: `Work in ${world}.\n${String(n).repeat(20000)}`,
    }))));
    for (const out of outs) assert.equal(JSON.parse(out.stdout).hookSpecificOutput.permissionDecision, 'deny');
    const ids = records().map((r) => r.tool_use_id).sort();
    assert.deepEqual(ids, ['toolu_p1', 'toolu_p2', 'toolu_p3', 'toolu_p4'], 'every line parses, one per call');
    assert.equal(new Set(rows().map((r) => r.output)).size, 4);
  });
});

describe('the hold — a walker\'s send', () => {
  it('is refused with the send-held reason from the walker template', () => {
    const decision = denial(fire(send()));
    assert.equal(decision.permissionDecision, 'deny');
    const reason = loadTemplate('walker')['send-held'];
    assert.ok(reason && reason.length > 0, 'the template carries the section');
    assert.equal(decision.permissionDecisionReason, reason);
  });

  it('records the send whole beside the dispatch it continues, and a held SendMessage row in order', () => {
    fire(dispatch({ id: 'toolu_01' }));
    const message = `Retry in ${world}.\n\n${'next attempt '.repeat(2000)}\nlast line`;
    const payload = send({ id: 'toolu_02', to: 'toolu_01', message });
    fire(payload);
    assert.deepEqual(records().map((r) => r.tool_use_id), ['toolu_01', 'toolu_02']);
    assert.deepEqual(records()[1], { tool_use_id: 'toolu_02', tool_name: 'SendMessage', tool_input: payload.tool_input });
    const log = fs.readFileSync(path.join(world, worlds.ACTION_LOG), 'utf8').split('\n');
    assert.equal(log[1], 'PreToolUse\tSendMessage\ttoolu_01 — Retry round for pay-1-2\theld\ttoolu_02');
  });

  it('resolves the world from the walker\'s transcript when the message names none', () => {
    writeTranscript('a1b2c3', `Project directory — your cwd for EVERY command: ${world}`);
    denial(fire(send({ message: 'Next attempt: key the guard on the intent' })));
    assert.equal(records().length, 1);
    assert.equal(rows()[0].tool, 'SendMessage');
  });

  it('still refuses a send whose world it cannot find — fail closed', () => {
    const decision = denial(fire(send({ message: 'no world here' })));
    assert.equal(decision.permissionDecision, 'deny');
    assert.deepEqual(fs.readdirSync(world), []);
  });
});

describe('the hold — everyone else\'s calls', () => {
  it('never touches the orchestrator\'s own send: no output, nothing recorded', () => {
    const out = fire(send({ type: 'prose-orchestrator', to: 'prose-walker' }));
    assert.equal(out.status, 0);
    assert.equal(out.stdout, '');
    assert.deepEqual(fs.readdirSync(world), []);
  });

  it('never touches the orchestrator dispatching a walker: no output, nothing recorded', () => {
    const out = fire(dispatch({ type: 'prose-orchestrator', agent: 'prose-walker' }));
    assert.equal(out.status, 0);
    assert.equal(out.stdout, '', 'no decision at all — the call proceeds as if no hook ran');
    assert.deepEqual(fs.readdirSync(world), []);
  });

  it('never touches the orchestrator dispatching the asserter, or the main session', () => {
    for (const type of ['prose-orchestrator', undefined]) {
      const payload = dispatch({ agent: 'prose-asserter' });
      if (type) payload.agent_type = type; else delete payload.agent_type;
      const out = fire(payload);
      assert.equal(out.stdout, '');
    }
    assert.deepEqual(fs.readdirSync(world), []);
  });

  it('ignores a walker tool that is not a dispatch', () => {
    const out = fire({ ...dispatch(), tool_name: 'Bash', tool_input: { command: `ls ${world}` } });
    assert.equal(out.stdout, '');
    assert.deepEqual(fs.readdirSync(world), []);
  });

  it('exits quietly on a payload that is not JSON', () => {
    const r = spawnSync('node', [HOOK], { input: 'not json', env: env(), encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  });
});

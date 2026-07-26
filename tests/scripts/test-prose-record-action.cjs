'use strict';

// The prose-test recorder is the only witness to what a walker actually
// did — and it went a long stretch silently dropping every stop event,
// because a stop payload names no file and the recorder scopes work to a
// world by finding its path in the payload. Nothing failed; the record
// was simply short. These tests pin the resolution paths so that class of
// silence cannot return.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOOK = path.join(__dirname, '..', 'prose', 'lib', 'record-action.cjs');
const LOG = '.walk-actions.log';

let world;
let projectDir;

/** Feed the hook a payload exactly as the harness would, on stdin. */
function fire(payload) {
  execFileSync('node', [HOOK], {
    input: JSON.stringify(payload),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });
}

function logLines() {
  const file = path.join(world, LOG);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
}

/** A transcript in the shape the runtime writes: one JSON object per line. */
function writeTranscript(entries) {
  const file = path.join(world, 'agent-transcript.jsonl');
  fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n'));
  return file;
}

beforeEach(() => {
  world = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-world-'));
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-project-'));
});

afterEach(() => {
  fs.rmSync(world, { recursive: true, force: true });
  fs.rmSync(projectDir, { recursive: true, force: true });
});

describe('prose recorder — tool events', () => {
  it('records a call scoped to the world named in its input', () => {
    fire({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      agent_type: 'prose-walker',
      tool_input: { command: `cd ${world} && engine boot` },
    });
    const [row] = logLines();
    assert.match(row, /^PreToolUse\tBash\t/);
  });

  it('records the output of a call, so a claim about it can be checked', () => {
    fire({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      agent_type: 'prose-walker',
      tool_input: { command: `cd ${world} && engine view` },
      tool_output: 'MENU: 1. Continue "Pay"',
    });
    const [row] = logLines();
    assert.ok(row.includes('\tok\t'), 'a successful call is marked ok');
    assert.ok(row.includes('MENU: 1. Continue "Pay"'), 'output is recorded verbatim');
  });

  it('marks a failing call so a walk cannot look cleaner than it was', () => {
    fire({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      agent_type: 'prose-walker',
      tool_input: { command: `cd ${world} && engine nope` },
      tool_output: 'unknown command',
      tool_output_is_error: true,
    });
    assert.ok(logLines()[0].includes('\tERROR\t'));
  });

  it('ignores anything happening outside a world', () => {
    fire({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      agent_type: 'prose-walker',
      tool_input: { command: 'git status' },
    });
    assert.deepEqual(logLines(), []);
  });
});

describe('prose recorder — the stop event', () => {
  it('resolves the world from the transcript, which the payload omits', () => {
    const transcript = writeTranscript([
      { message: { model: 'claude-sonnet-5' }, cwd: world },
    ]);
    fire({
      hook_event_name: 'SubagentStop',
      agent_type: 'prose-walker',
      agent_transcript_path: transcript,
      last_assistant_message: 'STOPPED: end of flow',
    });
    assert.equal(logLines().length, 1, 'the stop event reaches the world log');
  });

  it('names the model the walk actually ran on', () => {
    const transcript = writeTranscript([
      { message: { model: 'claude-sonnet-5' }, cwd: world },
      { message: { model: 'claude-sonnet-5' } },
    ]);
    fire({
      hook_event_name: 'SubagentStop',
      agent_type: 'prose-walker',
      agent_transcript_path: transcript,
      last_assistant_message: 'STOPPED: end of flow',
    });
    const [row] = logLines();
    assert.equal(row.split('\t')[2], 'claude-sonnet-5');
    assert.ok(row.includes('STOPPED: end of flow'), 'the final message is recorded too');
  });

  it('names every model when a walk did not run on just one', () => {
    const transcript = writeTranscript([
      { message: { model: 'claude-sonnet-5' }, cwd: world },
      { message: { model: 'claude-opus-5' } },
    ]);
    fire({
      hook_event_name: 'SubagentStop',
      agent_type: 'prose-walker',
      agent_transcript_path: transcript,
    });
    assert.equal(logLines()[0].split('\t')[2], 'claude-sonnet-5,claude-opus-5');
  });

  it('says so rather than guessing when the model cannot be read', () => {
    const transcript = writeTranscript([{ cwd: world }]);
    fire({
      hook_event_name: 'SubagentStop',
      agent_type: 'prose-walker',
      agent_transcript_path: transcript,
    });
    assert.equal(logLines()[0].split('\t')[2], 'model-unknown');
  });

  it('survives a partial line, which a live transcript can end on', () => {
    const file = path.join(world, 'partial.jsonl');
    fs.writeFileSync(
      file,
      `${JSON.stringify({ message: { model: 'claude-sonnet-5' }, cwd: world })}\n{ truncated`,
    );
    fire({
      hook_event_name: 'SubagentStop',
      agent_type: 'prose-walker',
      agent_transcript_path: file,
    });
    assert.equal(logLines()[0].split('\t')[2], 'claude-sonnet-5');
  });

  it('stays silent when a stop names no readable transcript', () => {
    // A real transcript lives outside the world, so an unreadable one
    // leaves nothing anywhere in the payload to scope the record to.
    fire({
      hook_event_name: 'SubagentStop',
      agent_type: 'prose-walker',
      agent_transcript_path: path.join(projectDir, 'absent.jsonl'),
    });
    assert.deepEqual(logLines(), []);
  });
});

describe('prose recorder — the asserter contract', () => {
  it('logs an asserter tool call as a violation, away from any world', () => {
    fire({
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      agent_type: 'prose-asserter',
      tool_input: { file_path: `${world}/.workflows/manifest.json` },
    });
    const violations = path.join(projectDir, 'tests/prose/.agent-tool-use.log');
    assert.ok(fs.existsSync(violations), 'the breach is recorded');
    assert.ok(fs.readFileSync(violations, 'utf8').includes('prose-asserter'));
    assert.deepEqual(logLines(), [], 'and never into the world it was judging');
  });

  it('does not count an asserter finishing as a breach', () => {
    fire({
      hook_event_name: 'SubagentStop',
      agent_type: 'prose-asserter',
      agent_transcript_path: writeTranscript([{ message: { model: 'claude-opus-5' } }]),
    });
    const violations = path.join(projectDir, 'tests/prose/.agent-tool-use.log');
    assert.equal(fs.existsSync(violations), false);
  });
});

describe('prose recorder — it never breaks what it observes', () => {
  it('exits quietly on a payload that is not JSON', () => {
    execFileSync('node', [HOOK], {
      input: 'not json at all',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    });
  });

  it('exits quietly when the world named has already been destroyed', () => {
    const gone = path.join(os.tmpdir(), 'prose-world-ZZZZZZ');
    fire({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      agent_type: 'prose-walker',
      tool_input: { command: `cd ${gone} && ls` },
    });
  });
});

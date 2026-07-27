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

  it('records a command output, so a claim about it can be checked', () => {
    fire({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      agent_type: 'prose-walker',
      tool_input: { command: `cd ${world} && engine view` },
      tool_response: { stdout: 'MENU: 1. Continue "Pay"', stderr: '' },
    });
    const [row] = logLines();
    assert.ok(row.includes('\tok\t'), 'a successful call is marked ok');
    assert.ok(row.includes('MENU: 1. Continue "Pay"'), 'output is recorded, not just its status');
  });

  it('keeps stderr, where a command often says what went wrong', () => {
    fire({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      agent_type: 'prose-walker',
      tool_input: { command: `cd ${world} && engine view` },
      tool_response: { stdout: 'partial output', stderr: 'warning: store is stale' },
    });
    const [row] = logLines();
    assert.ok(row.includes('partial output'));
    assert.ok(row.includes('warning: store is stale'));
  });

  it('keeps what a write put in a file — claims rest on it', () => {
    // A read is incidental; a write is the artifact a phase leaves behind.
    // Trimming this left a claim about a written file unprovable, because
    // the response was the only copy of that content.
    const written = `## Symptoms\n${'detail '.repeat(400)}`;
    fire({
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      agent_type: 'prose-walker',
      tool_input: { file_path: `${world}/.workflows/crash-fix/investigation/crash-fix.md` },
      tool_response: { filePath: 'crash-fix.md', newString: written },
    });
    const [row] = logLines();
    assert.ok(!row.includes('[truncated]'), 'the written content survives');
    assert.ok(row.includes('detail detail'), 'and is legible in the record');
  });

  it('keeps a Write the same way', () => {
    const written = 'x'.repeat(3000);
    fire({
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      agent_type: 'prose-walker',
      tool_input: { file_path: `${world}/.workflows/notes.md` },
      tool_response: { type: 'create', content: written },
    });
    assert.ok(!logLines()[0].includes('[truncated]'));
  });

  it('gives a command far more room than a file read', () => {
    const long = 'x'.repeat(1800);
    fire({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      agent_type: 'prose-walker',
      tool_input: { command: `cd ${world} && engine view` },
      tool_response: { stdout: long },
    });
    assert.ok(!logLines()[0].includes('[truncated]'), 'a rendered section survives whole');

    fs.rmSync(path.join(world, LOG));
    fire({
      hook_event_name: 'PostToolUse',
      tool_name: 'Read',
      agent_type: 'prose-walker',
      tool_input: { file_path: `${world}/big.md` },
      tool_response: { file: { content: long } },
    });
    assert.ok(logLines()[0].includes('[truncated]'), 'a file read is trimmed — no claim rests on it');
  });

  it('records a tool that answers in its own shape, not a shell’s', () => {
    fire({
      hook_event_name: 'PostToolUse',
      tool_name: 'Read',
      agent_type: 'prose-walker',
      tool_input: { file_path: `${world}/notes.md` },
      tool_response: { file: { filePath: 'notes.md', numLines: 3 } },
    });
    assert.ok(logLines()[0].includes('numLines'));
  });

  it('marks a failing call so a walk cannot look cleaner than it was', () => {
    fire({
      hook_event_name: 'PostToolUseFailure',
      tool_name: 'Bash',
      agent_type: 'prose-walker',
      tool_input: { command: `cd ${world} && engine nope` },
      tool_response: { stdout: 'Exit code 1\nUsage: engine <command>', stderr: '' },
    });
    const [row] = logLines();
    assert.ok(row.includes('\tFAILED\t'));
    assert.ok(row.includes('Usage: engine <command>'), 'and says what came back');
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

  it('lifts the walk out turn by turn, not just the message returned', () => {
    const transcript = writeTranscript([
      { message: { model: 'claude-sonnet-5', content: [{ type: 'text', text: 'ENTERED: a.md § Step 1' }] }, cwd: world },
      { message: { content: [{ type: 'tool_use', name: 'Bash' }] } },
      { message: { content: [{ type: 'text', text: 'EMITTED (menu):\n  Which feature?' }] } },
      { message: { content: [{ type: 'text', text: 'STOPPED: end of flow' }] } },
    ]);
    fire({
      hook_event_name: 'SubagentStop',
      agent_type: 'prose-walker',
      agent_transcript_path: transcript,
      last_assistant_message: 'STOPPED: end of flow',
    });
    const walk = fs.readFileSync(path.join(world, '.walk-transcript.log'), 'utf8');
    assert.ok(walk.includes('ENTERED: a.md § Step 1'), 'an early turn survives');
    assert.ok(walk.includes('Which feature?'), 'and what it emitted mid-walk');
    assert.ok(walk.includes('STOPPED: end of flow'));
    assert.ok(walk.indexOf('ENTERED') < walk.indexOf('Which feature?'), 'in the order they happened');
  });

  it('appends the closing turn the stop race leaves out of the transcript', () => {
    // The hook runs inside the stop sequence: the agent's last message is
    // still being appended as it reads. That turn is where a closing
    // emission lives, so the payload's copy stands in for it.
    const transcript = writeTranscript([
      { message: { model: 'claude-sonnet-5', content: [{ type: 'text', text: 'ENTERED: § Step 4' }] }, cwd: world },
    ]);
    fire({
      hook_event_name: 'SubagentStop',
      agent_type: 'prose-walker',
      agent_transcript_path: transcript,
      last_assistant_message: 'EMITTED (handoff block):\n  Source: .workflows/pay/discussion/pay.md',
    });
    const walk = fs.readFileSync(path.join(world, '.walk-transcript.log'), 'utf8');
    assert.ok(walk.includes('ENTERED: § Step 4'), 'the transcript turns survive');
    assert.ok(walk.includes('Source: .workflows/pay/discussion/pay.md'), 'and the closing turn arrives');
    assert.ok(walk.indexOf('Step 4') < walk.indexOf('Source:'), 'in that order');
  });

  it('does not double-record a closing turn the transcript already caught', () => {
    const closing = 'STOPPED: end of flow';
    const transcript = writeTranscript([
      { message: { model: 'x', content: [{ type: 'text', text: 'ENTERED: § Step 4' }] }, cwd: world },
      { message: { content: [{ type: 'text', text: closing }] } },
    ]);
    fire({
      hook_event_name: 'SubagentStop',
      agent_type: 'prose-walker',
      agent_transcript_path: transcript,
      last_assistant_message: closing,
    });
    const walk = fs.readFileSync(path.join(world, '.walk-transcript.log'), 'utf8');
    assert.equal(walk.split(closing).length - 1, 1, 'recorded once, not twice');
  });

  it('keeps a genuine repeat — a step that ran twice must stay visible', () => {
    const twice = 'ENTERED: § Step 4';
    const transcript = writeTranscript([
      { message: { model: 'x', content: [{ type: 'text', text: twice }] }, cwd: world },
      { message: { content: [{ type: 'text', text: twice }] } },
    ]);
    fire({
      hook_event_name: 'SubagentStop',
      agent_type: 'prose-walker',
      agent_transcript_path: transcript,
      last_assistant_message: 'STOPPED: done',
    });
    const walk = fs.readFileSync(path.join(world, '.walk-transcript.log'), 'utf8');
    assert.equal(walk.split(twice).length - 1, 2, 'both occurrences survive');
  });

  it('records the closing turn whole — a final emission is evidence', () => {
    const long = `EMITTED:\n${'x'.repeat(3000)}`;
    fire({
      hook_event_name: 'SubagentStop',
      agent_type: 'prose-walker',
      agent_transcript_path: writeTranscript([{ message: { model: 'x' }, cwd: world }]),
      last_assistant_message: long,
    });
    const walk = fs.readFileSync(path.join(world, '.walk-transcript.log'), 'utf8');
    assert.ok(!walk.includes('[truncated]'), 'the walk log caps nothing');
    assert.ok(walk.includes('x'.repeat(3000)));
  });

  it('writes no walk file when the transcript holds no turns', () => {
    fire({
      hook_event_name: 'SubagentStop',
      agent_type: 'prose-walker',
      agent_transcript_path: writeTranscript([{ message: { model: 'x' }, cwd: world }]),
    });
    assert.equal(fs.existsSync(path.join(world, '.walk-transcript.log')), false);
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

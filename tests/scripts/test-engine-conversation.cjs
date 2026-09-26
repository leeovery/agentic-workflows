'use strict';

//
// Tests for the conversation folder, `.workflows/.cache/.conversations/
// {session-id}/`: the mark every engine and gateway call leaves where Claude
// Code handed it a session id — once, never without an id, never from the
// commands Claude Code's own hooks run — `conversation end`, the SessionEnd
// hook's record of the transcript path, written only where the folder
// exists, and the tidy boot runs over the folders.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const harness = require('./engine-harness.cjs');
const { tidyConversations } = require('../../skills/workflow-engine/scripts/domain/conversation.cjs');

const SKILLS = path.resolve(__dirname, '..', '..', 'skills');

let dir;

function setup() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-conversation-'));
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
}

function teardown() {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function conversationsRoot() {
  return path.join(dir, '.workflows', '.cache', '.conversations');
}

/** @param {string} id */
function folder(id) {
  return path.join(conversationsRoot(), id);
}

/** @param {string} id */
function marker(id) {
  return path.join(folder(id), 'workflow');
}

/** The transcript path a conversation's folder records, or null. @param {string} id */
function transcriptOf(id) {
  try { return fs.readFileSync(path.join(folder(id), 'transcript'), 'utf8'); } catch { return null; }
}

/** @param {string} id */
const session = (id) => ({ CLAUDE_CODE_SESSION_ID: id });

/** The SessionEnd hook's stdin, as Claude Code writes it. @param {object} fields */
const endInput = (fields) => JSON.stringify({ hook_event_name: 'SessionEnd', reason: 'clear', cwd: dir, ...fields });

/** A conversation's folder holding `files`, by name. @param {string} id @param {Record<string, string>} files */
function writeConversation(id, files) {
  fs.mkdirSync(folder(id), { recursive: true });
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(folder(id), name), content);
}

describe('the mark', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('an engine call carrying a session id marks its conversation', () => {
    harness.ok(dir, ['session', 'repair'], { env: session('sess-1') });
    assert.ok(fs.existsSync(marker('sess-1')));
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['sess-1']);
  });

  it('a call that fails marks it all the same', () => {
    harness.refuses(dir, ['topic', 'start', 'nowhere', 'discussion', 'nowhere'], { env: session('sess-1') });
    assert.ok(fs.existsSync(marker('sess-1')));
  });

  it('no session id, no mark — absent or empty', () => {
    harness.ok(dir, ['session', 'repair']);
    harness.ok(dir, ['session', 'repair'], { env: session('') });
    assert.ok(!fs.existsSync(conversationsRoot()));
  });

  it('is written once — a mark already there is left as it stands', () => {
    writeConversation('sess-1', { workflow: 'first' });
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(marker('sess-1'), past, past);
    harness.ok(dir, ['session', 'repair'], { env: session('sess-1') });
    assert.strictEqual(fs.readFileSync(marker('sess-1'), 'utf8'), 'first');
    assert.strictEqual(fs.statSync(marker('sess-1')).mtimeMs, past.getTime());
  });

  it('the commands Claude Code\'s own hooks run never mark — any conversation in the project ends and resumes through them', () => {
    const input = endInput({ session_id: 'sess-1', transcript_path: '/t/sess-1.jsonl' });
    for (const args of [['presence', 'cleanup'], ['session', 'cleanup'], ['session', 'resume'], ['conversation', 'end']]) {
      const res = harness.call(dir, args, { env: session('sess-1'), stdin: input });
      assert.strictEqual(res.code, 0, `${args.join(' ')}: ${res.stderr}`);
    }
    assert.ok(!fs.existsSync(conversationsRoot()));
  });

  it('every gateway script marks the conversation that runs it, whatever its answer', () => {
    const gateways = fs.readdirSync(SKILLS)
      .filter((d) => d !== 'workflow-engine' && fs.existsSync(path.join(SKILLS, d, 'scripts/gateway.cjs')));
    assert.ok(gateways.length > 5, `found ${gateways.length} gateways — the skills read is broken`);
    for (const gateway of gateways) {
      spawnSync('node', [path.join(SKILLS, gateway, 'scripts/gateway.cjs')],
        { cwd: dir, encoding: 'utf8', env: { ...process.env, ...session(`via-${gateway}`) } });
    }
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()).sort(), gateways.map((g) => `via-${g}`).sort());
  });

  it('the folder is named by the id\'s safe characters alone — never outside the root', () => {
    harness.ok(dir, ['session', 'repair'], { env: session('a/../../evil') });
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['aevil']);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows', 'evil')));
  });

  it('a mark that cannot be written costs the command nothing', () => {
    fs.writeFileSync(path.join(dir, '.workflows', '.cache'), 'a file where the cache must go');
    assert.deepStrictEqual(harness.ok(dir, ['session', 'repair'], { env: session('sess-1') }), { ok: true, repaired: false });
  });
});

describe('engine conversation end', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('records the transcript path from the SessionEnd hook\'s stdin JSON in the conversation\'s folder', () => {
    writeConversation('sess-1', { workflow: '' });
    const res = harness.ok(dir, ['conversation', 'end'], { stdin: endInput({ session_id: 'sess-1', transcript_path: '/t/sess-1.jsonl' }) });
    assert.deepStrictEqual(res, { ok: true, recorded: true });
    assert.strictEqual(transcriptOf('sess-1'), '/t/sess-1.jsonl');
  });

  it('a later end records the path afresh — a conversation resumed from another directory moves its transcript', () => {
    writeConversation('sess-1', { workflow: '', transcript: '/old/sess-1.jsonl' });
    harness.ok(dir, ['conversation', 'end'], { stdin: endInput({ session_id: 'sess-1', transcript_path: '/new/sess-1.jsonl' }) });
    assert.strictEqual(transcriptOf('sess-1'), '/new/sess-1.jsonl');
  });

  it('a conversation that never ran the workflows gets nothing — no folder is made for it', () => {
    const res = harness.ok(dir, ['conversation', 'end'], { stdin: endInput({ session_id: 'sess-1', transcript_path: '/t/sess-1.jsonl' }) });
    assert.deepStrictEqual(res, { ok: true, recorded: false });
    assert.ok(!fs.existsSync(conversationsRoot()));
  });

  it('records nothing without a session id and a transcript path, each a string', () => {
    writeConversation('sess-1', { workflow: '' });
    for (const stdin of ['', '{}', 'not json', '[]', endInput({ session_id: 'sess-1' }), endInput({ transcript_path: '/t/x.jsonl' }),
      endInput({ session_id: 'sess-1', transcript_path: '' }), endInput({ session_id: 7, transcript_path: '/t/x.jsonl' }),
      endInput({ session_id: 'sess-1', transcript_path: ['/t/x.jsonl'] })]) {
      assert.deepStrictEqual(harness.ok(dir, ['conversation', 'end'], { stdin }), { ok: true, recorded: false }, stdin);
    }
    assert.strictEqual(transcriptOf('sess-1'), null);
  });

  it('a hook-supplied session id never escapes the root — its safe characters alone name the folder', () => {
    writeConversation('evil', { workflow: '' });
    harness.ok(dir, ['conversation', 'end'], { stdin: endInput({ session_id: '../../evil', transcript_path: '/t/evil.jsonl' }) });
    assert.strictEqual(transcriptOf('evil'), '/t/evil.jsonl');
    assert.ok(!fs.existsSync(path.join(dir, 'transcript')));
  });

  it('a hook fired outside the project root finds the project through CLAUDE_PROJECT_DIR', () => {
    writeConversation('sess-1', { workflow: '' });
    const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-conversation-elsewhere-'));
    try {
      const res = harness.ok(elsewhere, ['conversation', 'end'], {
        env: { CLAUDE_PROJECT_DIR: dir },
        stdin: endInput({ session_id: 'sess-1', transcript_path: '/t/sess-1.jsonl' }),
      });
      assert.deepStrictEqual(res, { ok: true, recorded: true });
      assert.strictEqual(transcriptOf('sess-1'), '/t/sess-1.jsonl');
    } finally {
      fs.rmSync(elsewhere, { recursive: true, force: true });
    }
  });

  it('a record that cannot be written answers nothing recorded, never a failure — a hook must exit clean', () => {
    writeConversation('sess-1', { workflow: '' });
    fs.mkdirSync(path.join(folder('sess-1'), 'transcript'));
    const res = harness.ok(dir, ['conversation', 'end'], { stdin: endInput({ session_id: 'sess-1', transcript_path: '/t/sess-1.jsonl' }) });
    assert.deepStrictEqual(res, { ok: true, recorded: false });
  });

  it('refuses an argument loudly — an authoring bug, never a silent no-op', () => {
    const err = harness.refuses(dir, ['conversation', 'end', 'sess-1']);
    assert.match(err.error, /Usage: engine conversation end/);
    assert.match(harness.refuses(dir, ['conversation', 'begin']).error, /Usage: engine conversation end/);
  });
});

describe('tidyConversations', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('deletes exactly the folders whose transcript names a file that is gone', () => {
    const live = path.join(dir, 'live.jsonl');
    fs.writeFileSync(live, '');
    writeConversation('gone', { workflow: '', transcript: path.join(dir, 'gone.jsonl'), 'position.json': '{"name":"pay"}', 'gate.json': 'null' });
    writeConversation('live', { workflow: '', transcript: live, 'gate.json': 'null' });
    writeConversation('unnamed', { workflow: '', 'position.json': '{"name":"pay"}' });
    writeConversation('empty', { workflow: '', transcript: '' });
    tidyConversations(dir);
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()).sort(), ['empty', 'live', 'unnamed']);
    assert.deepStrictEqual(fs.readdirSync(folder('live')).sort(), ['gate.json', 'transcript', 'workflow']);
  });

  it('keeps a folder for as long as its transcript is there — no age is ever read', () => {
    const live = path.join(dir, 'live.jsonl');
    fs.writeFileSync(live, '');
    writeConversation('old', { workflow: '', transcript: live });
    const past = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000);
    fs.utimesSync(path.join(folder('old'), 'workflow'), past, past);
    fs.utimesSync(folder('old'), past, past);
    tidyConversations(dir);
    assert.ok(fs.existsSync(folder('old')));
  });

  it('leaves what is not a folder, and a project with no conversations, alone', () => {
    tidyConversations(dir);
    fs.mkdirSync(conversationsRoot(), { recursive: true });
    fs.writeFileSync(path.join(conversationsRoot(), 'stray'), '/gone/transcript.jsonl');
    tidyConversations(dir);
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['stray']);
  });
});

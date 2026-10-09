'use strict';

//
// Tests for the conversation folder, `{config}/conversations/{session-id}/`
// beside the system config — `WORKFLOWS_CONFIG_DIR`, else
// `~/.config/workflows` — and found by the session id alone from wherever a
// command runs: the mark every engine and gateway call leaves where Claude
// Code handed it a session id — once, never without an id, never outside a
// workflows project, never from the commands Claude Code's own hooks run —
// `conversation end`, the SessionEnd hook's record of the transcript path as
// the hook hands it, written only where the folder exists, and the tidy any
// project's boot runs over every folder, looking for the transcript by its
// file name in every project folder of the projects directory the recorded
// path names — a leading `~` read as the home directory, a relative path as
// naming none, each projects directory read once.
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

let dir; // a workflows project
let config; // this test's system config directory
let pinned; // the suite's own, put back after

function setup() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-conversation-'));
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-conversation-config-'));
  pinned = process.env.WORKFLOWS_CONFIG_DIR;
  process.env.WORKFLOWS_CONFIG_DIR = config;
}

function teardown() {
  process.env.WORKFLOWS_CONFIG_DIR = pinned;
  for (const d of [dir, config]) fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

/** A directory beside the project, removed after `fn`. @param {(elsewhere: string) => void} fn */
function inScratch(fn) {
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-conversation-elsewhere-'));
  try {
    fn(elsewhere);
  } finally {
    fs.rmSync(elsewhere, { recursive: true, force: true });
  }
}

function conversationsRoot() {
  return path.join(config, 'conversations');
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

  it('an engine call carrying a session id marks its conversation, in its folder beside the system config — nothing lands in the project', () => {
    harness.ok(dir, ['session', 'repair'], { env: session('sess-1') });
    assert.ok(fs.existsSync(marker('sess-1')));
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['sess-1']);
    assert.deepStrictEqual(fs.readdirSync(path.join(dir, '.workflows')), []);
  });

  it('with no WORKFLOWS_CONFIG_DIR — unset or empty — the folder sits in the home directory\'s `.config/workflows`', () => {
    inScratch((home) => {
      harness.ok(dir, ['session', 'repair'], { env: { ...session('sess-1'), HOME: home, WORKFLOWS_CONFIG_DIR: undefined } });
      harness.ok(dir, ['session', 'repair'], { env: { ...session('sess-2'), HOME: home, WORKFLOWS_CONFIG_DIR: '' } });
      assert.deepStrictEqual(fs.readdirSync(path.join(home, '.config', 'workflows', 'conversations')).sort(), ['sess-1', 'sess-2']);
    });
    assert.ok(!fs.existsSync(conversationsRoot()));
  });

  it('a call that fails marks it all the same', () => {
    harness.refuses(dir, ['topic', 'start', 'nowhere', 'discussion', 'nowhere'], { env: session('sess-1') });
    assert.ok(fs.existsSync(marker('sess-1')));
  });

  it('a command that waits on the embedding provider marks it once it answers, whatever its answer', async () => {
    const answered = await harness.callAsync(dir, ['knowledge', 'query', 'cards'], { env: session('sess-waits') });
    assert.strictEqual(answered.code, 0, answered.stderr);
    assert.ok(fs.existsSync(marker('sess-waits')));
    const refused = await harness.callAsync(dir, ['knowledge', 'query', ' '], { env: session('sess-refused') });
    assert.strictEqual(refused.code, 1);
    assert.ok(fs.existsSync(marker('sess-refused')));
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

  it('marks only inside a workflows project — an engine call or a gateway run where no `.workflows/` exists makes none', () => {
    inScratch((bare) => {
      harness.call(bare, ['session', 'repair'], { env: session('sess-1') });
      spawnSync('node', [path.join(SKILLS, 'workflow-start', 'scripts/gateway.cjs')],
        { cwd: bare, encoding: 'utf8', env: { ...process.env, ...session('sess-1') } });
      assert.deepStrictEqual(fs.readdirSync(bare), []);
    });
    assert.ok(!fs.existsSync(conversationsRoot()));
  });

  it('the folder is named by the id\'s safe characters alone — never outside the root', () => {
    harness.ok(dir, ['session', 'repair'], { env: session('a/../../evil') });
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['aevil']);
    assert.deepStrictEqual(fs.readdirSync(config), ['conversations']);
  });

  it('a mark that cannot be written costs the command nothing', () => {
    fs.writeFileSync(conversationsRoot(), 'a file where the folders must go');
    assert.deepStrictEqual(harness.ok(dir, ['session', 'repair'], { env: session('sess-1') }), { ok: true, repaired: false });
  });
});

describe('one folder, found by the id from anywhere', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('a mark made in one project is the folder a hook fired from another project, or from a directory Claude moved to, records into', () => {
    harness.ok(dir, ['session', 'repair'], { env: session('sess-1') });
    const subdirectory = path.join(dir, 'src', 'lib');
    fs.mkdirSync(subdirectory, { recursive: true });
    inScratch((other) => {
      fs.mkdirSync(path.join(other, '.workflows'));
      assert.deepStrictEqual(harness.ok(other, ['conversation', 'end'], { stdin: endInput({ session_id: 'sess-1', transcript_path: '/a/sess-1.jsonl' }) }),
        { ok: true, recorded: true });
      assert.strictEqual(transcriptOf('sess-1'), '/a/sess-1.jsonl');
    });
    assert.deepStrictEqual(harness.ok(subdirectory, ['conversation', 'end'], { stdin: endInput({ session_id: 'sess-1', transcript_path: '/b/sess-1.jsonl' }) }),
      { ok: true, recorded: true });
    assert.strictEqual(transcriptOf('sess-1'), '/b/sess-1.jsonl');
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['sess-1']);
  });

  it('a call from another workflows project marks nothing new — the conversation\'s folder is already there', () => {
    harness.ok(dir, ['session', 'repair'], { env: session('sess-1') });
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(marker('sess-1'), past, past);
    inScratch((other) => {
      fs.mkdirSync(path.join(other, '.workflows'));
      harness.ok(other, ['session', 'repair'], { env: session('sess-1') });
    });
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['sess-1']);
    assert.strictEqual(fs.statSync(marker('sess-1')).mtimeMs, past.getTime());
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

  it('a later end records the path it is handed over the one before', () => {
    writeConversation('sess-1', { workflow: '', transcript: '/old/sess-1.jsonl' });
    harness.ok(dir, ['conversation', 'end'], { stdin: endInput({ session_id: 'sess-1', transcript_path: '/new/sess-1.jsonl' }) });
    assert.strictEqual(transcriptOf('sess-1'), '/new/sess-1.jsonl');
  });

  it('records the path as the hook hands it — a leading `~` and a relative path alike, left to the tidy to read', () => {
    writeConversation('sess-1', { workflow: '' });
    writeConversation('sess-2', { workflow: '' });
    harness.ok(dir, ['conversation', 'end'], { stdin: endInput({ session_id: 'sess-1', transcript_path: '~/.claude/projects/p/sess-1.jsonl' }) });
    harness.ok(dir, ['conversation', 'end'], { stdin: endInput({ session_id: 'sess-2', transcript_path: 'projects/p/sess-2.jsonl' }) });
    assert.strictEqual(transcriptOf('sess-1'), '~/.claude/projects/p/sess-1.jsonl');
    assert.strictEqual(transcriptOf('sess-2'), 'projects/p/sess-2.jsonl');
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
    assert.deepStrictEqual(fs.readdirSync(config), ['conversations']);
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['evil']);
  });

  it('a hook fired where no project is finds the folder by the id alone', () => {
    writeConversation('sess-1', { workflow: '' });
    inScratch((elsewhere) => {
      const res = harness.ok(elsewhere, ['conversation', 'end'], { stdin: endInput({ session_id: 'sess-1', transcript_path: '/t/sess-1.jsonl' }) });
      assert.deepStrictEqual(res, { ok: true, recorded: true });
    });
    assert.strictEqual(transcriptOf('sess-1'), '/t/sess-1.jsonl');
  });

  it('a record that cannot be written answers nothing recorded, never a failure — a hook must exit clean', () => {
    writeConversation('sess-1', { workflow: '' });
    fs.mkdirSync(path.join(folder('sess-1'), 'transcript'));
    const res = harness.ok(dir, ['conversation', 'end'], { stdin: endInput({ session_id: 'sess-1', transcript_path: '/t/sess-1.jsonl' }) });
    assert.deepStrictEqual(res, { ok: true, recorded: false });
  });

  it('refuses an argument loudly — an authoring bug, never a silent no-op', () => {
    assert.match(harness.refuses(dir, ['conversation', 'end', 'sess-1']).error, /^Usage: engine conversation end$/);
    for (const args of [['conversation', 'begin'], ['conversation']]) {
      assert.match(harness.refuses(dir, args).error, /^Usage: engine conversation <end\|position> …$/, args.join(' '));
    }
  });
});

describe('tidyConversations', () => {
  beforeEach(setup);
  afterEach(teardown);

  /** This test's own directory of Claude Code projects. */
  const projects = () => path.join(dir, 'projects');

  /** The path of `id`'s transcript in project folder `key` of `under`. @param {string} key @param {string} id */
  const transcriptPath = (key, id, under = projects()) => path.join(under, key, `${id}.jsonl`);

  /** `id`'s transcript, made in project folder `key` of `under`. @param {string} key @param {string} id */
  function transcript(key, id, under = projects()) {
    const file = transcriptPath(key, id, under);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
    return file;
  }

  it('deletes exactly the folders whose transcript no project folder holds', () => {
    const live = transcript('-Users-me-app', 'live');
    writeConversation('gone', { workflow: '', transcript: transcriptPath('-Users-me-app', 'gone'), 'position.json': '{"name":"pay"}', 'gate.json': 'null' });
    writeConversation('live', { workflow: '', transcript: live, 'gate.json': 'null' });
    writeConversation('unnamed', { workflow: '', 'position.json': '{"name":"pay"}' });
    writeConversation('empty', { workflow: '', transcript: '' });
    tidyConversations();
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()).sort(), ['empty', 'live', 'unnamed']);
    assert.deepStrictEqual(fs.readdirSync(folder('live')).sort(), ['gate.json', 'transcript', 'workflow']);
  });

  it('finds the transcript by its name in another project folder — a resume from another directory hands over a path under that directory\'s key while the transcript stays where the conversation began — and deletes the folder once none holds it', () => {
    transcript('-Users-me-app-wt', 'another');
    const file = transcript('-Users-me-app', 'sess-1');
    writeConversation('sess-1', { workflow: '', transcript: transcriptPath('-Users-me-app-wt', 'sess-1'), 'gate.json': 'null' });
    tidyConversations();
    assert.deepStrictEqual(fs.readdirSync(folder('sess-1')).sort(), ['gate.json', 'transcript', 'workflow']);
    fs.unlinkSync(file);
    tidyConversations();
    assert.ok(!fs.existsSync(folder('sess-1')));
  });

  it('a projects directory that no longer exists holds no transcript — the folder goes', () => {
    writeConversation('sess-1', { workflow: '', transcript: transcriptPath('-Users-me-app', 'sess-1') });
    tidyConversations();
    assert.ok(!fs.existsSync(folder('sess-1')));
  });

  it('keeps the folder while its projects directory, or a project folder in it, cannot be read — and deletes it once they can', () => {
    transcript('-Users-me-app', 'another');
    writeConversation('sess-1', { workflow: '', transcript: transcriptPath('-Users-me-app', 'sess-1') });
    for (const locked of [path.join(projects(), '-Users-me-app'), projects()]) {
      fs.chmodSync(locked, 0o000);
      try {
        tidyConversations();
      } finally {
        fs.chmodSync(locked, 0o755);
      }
      assert.ok(fs.existsSync(folder('sess-1')), locked);
    }
    tidyConversations();
    assert.ok(!fs.existsSync(folder('sess-1')));
  });

  it('a file beside the project folders is no project folder — it holds no transcript and never stops the read', () => {
    fs.mkdirSync(projects());
    fs.writeFileSync(path.join(projects(), 'sess-1.jsonl'), '');
    writeConversation('sess-1', { workflow: '', transcript: transcriptPath('-Users-me-app', 'sess-1') });
    tidyConversations();
    assert.ok(!fs.existsSync(folder('sess-1')));
  });

  it('looks only in the projects directory the recorded path names — never the home directory\'s, never another conversation\'s', () => {
    const a = path.join(dir, 'a', 'projects');
    const b = path.join(dir, 'b', 'projects');
    transcript('p', 'one', a);
    transcript('p', 'two', b);
    const home = process.env.HOME;
    process.env.HOME = dir;
    try {
      transcript('p', 'one', path.join(dir, '.claude', 'projects'));
      transcript('p', 'two', path.join(dir, '.claude', 'projects'));
      writeConversation('one', { workflow: '', transcript: transcriptPath('p', 'one', b) });
      writeConversation('two', { workflow: '', transcript: transcriptPath('q', 'two', a) });
      writeConversation('kept', { workflow: '', transcript: transcriptPath('q', 'one', a) });
      tidyConversations();
    } finally {
      process.env.HOME = home;
    }
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['kept']);
  });

  it('reads each projects directory once, however many folders name it', () => {
    transcript('p', 'live');
    for (const id of ['a', 'b', 'c']) writeConversation(id, { workflow: '', transcript: transcriptPath('p', id) });
    writeConversation('live', { workflow: '', transcript: transcriptPath('q', 'live') });
    /** @type {string[]} */
    const reads = [];
    const readdirSync = fs.readdirSync;
    fs.readdirSync = /** @type {typeof fs.readdirSync} */ ((target, ...rest) => {
      reads.push(String(target));
      return readdirSync(target, ...rest);
    });
    try {
      tidyConversations();
    } finally {
      fs.readdirSync = readdirSync;
    }
    assert.deepStrictEqual(reads.filter((r) => r.startsWith(projects())), [projects(), path.join(projects(), 'p')]);
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['live']);
  });

  it('a folder that cannot be deleted costs the tidy nothing — the rest are tidied all the same', () => {
    writeConversation('stuck', { workflow: '', transcript: transcriptPath('p', 'stuck') });
    writeConversation('gone', { workflow: '', transcript: transcriptPath('p', 'gone') });
    const locked = path.join(folder('stuck'), 'locked');
    fs.mkdirSync(locked);
    fs.writeFileSync(path.join(locked, 'held'), '');
    fs.chmodSync(locked, 0o555);
    try {
      tidyConversations();
    } finally {
      fs.chmodSync(locked, 0o755);
    }
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['stuck']);
  });

  it('keeps a folder for as long as its transcript is there — no age is ever read', () => {
    const live = transcript('p', 'live');
    writeConversation('old', { workflow: '', transcript: live });
    const past = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000);
    fs.utimesSync(path.join(folder('old'), 'workflow'), past, past);
    fs.utimesSync(folder('old'), past, past);
    tidyConversations();
    assert.ok(fs.existsSync(folder('old')));
  });

  it('reads a leading `~` as the home directory — the folder stays while the file there does, and goes once it is gone', () => {
    const home = process.env.HOME;
    process.env.HOME = dir;
    try {
      fs.mkdirSync(path.join(dir, '.claude', 'projects', 'p'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.claude', 'projects', 'p', 'live.jsonl'), '');
      writeConversation('live', { workflow: '', transcript: '~/.claude/projects/p/live.jsonl' });
      writeConversation('gone', { workflow: '', transcript: '~/.claude/projects/p/gone.jsonl' });
      tidyConversations();
    } finally {
      process.env.HOME = home;
    }
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['live']);
  });

  it('a relative path names no projects directory — its folder stays', () => {
    writeConversation('bare', { workflow: '', transcript: 'gone.jsonl' });
    writeConversation('nested', { workflow: '', transcript: 'projects/p/gone.jsonl' });
    writeConversation('user', { workflow: '', transcript: '~someone/gone.jsonl' });
    tidyConversations();
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()).sort(), ['bare', 'nested', 'user']);
  });

  it('leaves what is not a folder, and a machine with no conversations, alone', () => {
    tidyConversations();
    fs.mkdirSync(conversationsRoot(), { recursive: true });
    fs.writeFileSync(path.join(conversationsRoot(), 'stray'), '/gone/transcript.jsonl');
    tidyConversations();
    assert.deepStrictEqual(fs.readdirSync(conversationsRoot()), ['stray']);
  });
});

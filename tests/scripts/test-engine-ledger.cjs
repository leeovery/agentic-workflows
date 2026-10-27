'use strict';

// ---------------------------------------------------------------------------
// The ledger's data layer (workflow-engine/scripts/domain/ledger.cjs): the
// events and their schemas (domain/ledger-events.cjs), their ids
// (domain/ledger-ids.cjs), the streamed read, the append, the append-only
// check on every read and at every state commit (domain/ledger-check.cjs),
// the engine's stop and its screen (domain/projections/ledger.cjs), and the
// conversion door only a migration passes (domain/ledger-conversion.cjs):
// each event written with its fields in the schema's order on a line of its
// own; a nanoid shown by its shortest unique prefix and resolved as git
// resolves a short hash; a line validated as it is read, a field a later
// release added taking its default; a ledger past the read budget read a
// line at a time; one entry appended whole or not at all, under the writer
// lock; a rewritten, removed, swapped or truncated line, or a shorter file,
// stopping the read and refusing the commit, in a sha1 repository and a
// sha256 one, the branch read before the file and a failed check made again
// under the lock; and a migration's converted copy, its every event through
// with the same ids in the same order, let through for its own commit
// alone.
//
// Real repositories in temp folders, each with its state worktree made
// through the machinery. A `git` first on PATH, or a stand-in for a call the
// suite cannot reach, plays a commit landing between two reads or a kill.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn, spawnSync } = require('child_process');

const { git, initRepo, ok, refuses, output, setupGitFixture, cleanupFixture, statePath } = require('./engine-harness.cjs');
const { auditMarkers } = require('./gate-audit.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const LEDGER_MODULE = path.join(SCRIPTS, 'domain/ledger.cjs');
const CONVERSION_MODULE = path.join(SCRIPTS, 'domain/ledger-conversion.cjs');
const { ledgerChange, checkLedger, readLedger, appendEntry, ledgerStopSurface } = require(LEDGER_MODULE);
const { LEDGER, LEDGER_VERSION, SCHEMA, LedgerLineError, LedgerNewer, validEvent, parseEntry } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const { ID_LENGTH, SHORT_MIN, newId, shortIds, resolveId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { LedgerChanged, checkLedgerCommit, keptStop } = require(path.join(SCRIPTS, 'domain/ledger-check.cjs'));
const { convertLedger } = require(CONVERSION_MODULE);
const { STATE_BRANCH, createState, withStateLock, commitState, openWorktree } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { ledgerStop } = require(path.join(SCRIPTS, 'domain/projections/ledger.cjs'));
const { READ_BUDGET_BYTES } = require(path.join(SCRIPTS, 'kernel/git.cjs'));
const { processStartTime } = require(path.join(SCRIPTS, 'kernel/process.cjs'));

/** @type {string} */
let world;

beforeEach(() => {
  world = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-')));
});

afterEach(() => {
  fs.rmSync(world, { recursive: true, force: true });
});

const TAGS = Object.freeze({ unit: 'fumi', topic: 'note-window', phase: 'discussion', session: 'session-1' });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const AT = '2026-10-27T09:00:00Z';

/**
 * A project named Fumi with one code commit, and its state.
 * @param {{objectFormat?: 'sha1'|'sha256'}} [opts]
 * @returns {{main: string, root: string}}
 */
function project({ objectFormat = 'sha1' } = {}) {
  const main = path.join(world, 'fumi');
  if (objectFormat === 'sha1') {
    initRepo(main);
  } else {
    fs.mkdirSync(main);
    git(main, ['init', '-q', '-b', 'main', `--object-format=${objectFormat}`]);
    git(main, ['config', 'user.email', 'test@example.com']);
    git(main, ['config', 'user.name', 'Test']);
    git(main, ['config', 'commit.gpgsign', 'false']);
  }
  fs.writeFileSync(path.join(main, 'README.md'), '# Fumi\n');
  git(main, ['add', 'README.md']);
  git(main, ['commit', '-q', '-m', 'code']);
  const root = path.join(main, '.leeway');
  createState(root);
  return { main, root };
}

/** A question's fields. @param {Record<string, unknown>} [fields] */
function question(fields = {}) {
  return { event: 'asked', ...TAGS, ...MADE, text: 'What is a fumi, at its most basic?', part_of: null, relies_on: [], ...fields };
}

/** A decision's fields, closing `answers`. @param {string} answers @param {Record<string, unknown>} [fields] */
function decision(answers, fields = {}) {
  return {
    event: 'decided', ...TAGS, ...MADE, answers, text: 'A near-frameless floating note.', why: 'Notes are furniture on the desk.',
    rules_out: ['a title bar'], relies_on: [], product_wide: false, sealed: null, alternatives: [], evidence: [], kind: null, unchecked: false, ...fields,
  };
}

/** @param {string} root */
function ledgerText(root) {
  return fs.readFileSync(path.join(root, LEDGER), 'utf8');
}

/** @param {string} root @param {string} text */
function writeLedger(root, text) {
  fs.writeFileSync(path.join(root, LEDGER), text);
}

/** The ledger committed, through the engine's door. @param {string} root @param {string} [message] */
function commitLedger(root, message = 'state: the ledger') {
  return withStateLock(root, () => commitState(root, [LEDGER], message));
}

/** @param {string} dir @param {string} ref */
function tip(dir, ref) {
  return git(dir, ['rev-parse', ref]).trim();
}

/** A question and two decisions on it appended and committed: the ledger's three lines. @param {string} root @returns {string[]} */
function threeCommitted(root) {
  const q = appendEntry(root, question(), []);
  appendEntry(root, decision(/** @type {string} */ (q.id)), []);
  appendEntry(root, decision(/** @type {string} */ (q.id), { text: 'Its controls appear on hover.' }), []);
  commitLedger(root);
  return ledgerText(root).split('\n').slice(0, 3);
}

/** The state worktree's own git dir. @param {string} root */
function gitDirOf(root) {
  return git(root, ['rev-parse', '--absolute-git-dir']).trim();
}

/** What the check found, the engine's stop it throws beside it, kept as found. @param {string} root */
function stopped(root) {
  const change = ledgerChange(root);
  assert.throws(() => checkLedger(root, []), (err) => err instanceof LedgerChanged && err.payload.stop === 'ledger' && /changed outside the engine/.test(err.message));
  assert.deepStrictEqual(keptStop(gitDirOf(root)), { stop: 'changed', ...change });
  return change;
}

/**
 * Run `fn` with git tracing into a file, answering the git commands traced.
 * @template T @param {() => T} fn @returns {{result: T, traced: string[]}}
 */
function traced(fn) {
  const file = path.join(world, 'git-trace.log');
  fs.rmSync(file, { force: true });
  process.env.GIT_TRACE = file;
  try {
    const result = fn();
    const log = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    return { result, traced: [...log.matchAll(/trace: built-in: git (.*)$/gm)].map((m) => m[1]) };
  } finally {
    delete process.env.GIT_TRACE;
  }
}

/** The lock file written as held by this live process — a peer holding the writer lock, to any other process. @param {string} root */
function holdLock(root) {
  const lock = path.join(root, '.lock');
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, pid_start: processStartTime(process.pid) }));
  return lock;
}

/** A child running `call` on the ledger module, given `root`. @param {string} root @param {string} call @param {Record<string, string>} [env] */
function ledgerChild(root, call, env = {}) {
  return spawn('node', ['-e', `const ledger = require(process.argv[1]); const root = process.argv[2]; ${call};`, LEDGER_MODULE, root], {
    env: { ...process.env, ...env },
  });
}

/** A child's exit and what it wrote. @param {import('child_process').ChildProcess} child */
function settled(child) {
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk) => { stdout += chunk; });
  child.stderr?.on('data', (chunk) => { stderr += chunk; });
  return new Promise((resolve) => child.on('close', (code) => resolve({ code, stdout, stderr })));
}

/** Whether `child` is still running after `ms`. @param {Promise<unknown>} exit @param {number} ms */
async function stillRunning(exit, ms) {
  return (await Promise.race([exit.then(() => false), new Promise((resolve) => setTimeout(() => resolve(true), ms))]));
}

describe('the events and their schemas', () => {
  const HEADER = ['v', 'id', 'event', 'unit', 'topic', 'phase', 'session', 'at'];
  const BY = ['by', 'who_moved_whom'];
  const QUESTION = ['text', 'part_of', 'relies_on'];
  const FINDING = ['text', 'how', 'relies_on', 'product_wide'];
  const DECISION = ['answers', 'text', 'why', 'rules_out', 'relies_on', 'product_wide', 'sealed', 'alternatives', 'evidence', 'kind', 'unchecked'];

  it('writes every event §5 names, and merged and checked, each with its fields in its schema\'s order on a line of its own, ended by LF alone', () => {
    const { root } = project();
    const q = /** @type {string} */ (appendEntry(root, question(), []).id);
    const f = /** @type {string} */ (appendEntry(root, { event: 'found', ...TAGS, ...MADE, text: 'CKSyncEngine ships from macOS 14.', how: 'documented', relies_on: [], product_wide: false }, []).id);
    const d = /** @type {string} */ (appendEntry(root, decision(q, { relies_on: [f] }), []).id);
    const r = /** @type {string} */ (appendEntry(root, {
      ...decision(q, { text: 'A frameless surface.' }), event: 'replaced', replaces: d, reason: 'new-fact', cause: f, drops: ['a title bar'], of: 'decision',
    }, []).id);
    appendEntry(root, { event: 'still-holds', ...TAGS, ...MADE, entry: d, after: r }, []);
    appendEntry(root, { event: 'moved', ...TAGS, ...MADE, question: q, to: 'space-homing' }, []);
    appendEntry(root, { event: 'merged', ...TAGS, ...MADE, question: q, into: d, duplicate: null }, []);
    appendEntry(root, { event: 'checked', ...TAGS, entry: d, rules: 'one' }, []);

    const text = ledgerText(root);
    assert.ok(text.endsWith('\n') && !text.includes('\r'), 'a line ends with LF alone');
    const lines = text.split('\n').slice(0, -1);
    assert.deepStrictEqual(lines.map((line) => Object.keys(JSON.parse(line))), [
      [...HEADER, ...BY, ...QUESTION],
      [...HEADER, ...BY, ...FINDING],
      [...HEADER, ...BY, ...DECISION],
      [...HEADER, ...BY, 'replaces', 'reason', 'cause', 'drops', 'of', ...DECISION],
      [...HEADER, ...BY, 'entry', 'after'],
      [...HEADER, ...BY, 'question', 'to'],
      [...HEADER, ...BY, 'question', 'into', 'duplicate'],
      [...HEADER, 'entry', 'rules'],
    ]);
    assert.deepStrictEqual(Object.keys(SCHEMA.events).sort(), ['asked', 'checked', 'decided', 'found', 'merged', 'moved', 'replaced', 'still-holds']);
  });

  it('carries in a replacement the content of what it replaces: a question\'s, a finding\'s or a decision\'s', () => {
    const shapes = {
      question: { text: 'Where does a note go?', part_of: null, relies_on: [] },
      finding: { text: 'Spaces keep their ids.', how: 'seen in a spike', relies_on: [], product_wide: true },
    };
    for (const [of, content] of Object.entries(shapes)) {
      const event = validEvent({ v: 1, id: newId(), event: 'replaced', ...TAGS, at: AT, ...MADE, replaces: newId(), reason: 'was-wrong', cause: null, drops: [], of, ...content });
      assert.deepStrictEqual(Object.keys(event).slice(-Object.keys(content).length), Object.keys(content));
    }
    assert.throws(() => validEvent({ v: 1, id: newId(), event: 'replaced', ...TAGS, at: AT, ...MADE, replaces: newId(), reason: 'was-wrong', cause: null, drops: [], of: 'finding', ...shapes.question }),
      /the replaced event needs how/);
    assert.throws(() => validEvent({ v: 1, id: newId(), event: 'replaced', ...TAGS, at: AT, ...MADE, replaces: newId(), reason: 'was-wrong', cause: null, drops: [], of: 'rule', ...shapes.question }),
      /its of is not one of question, finding, decision/);
    assert.throws(() => validEvent({ v: 1, id: newId(), event: 'replaced', ...TAGS, at: AT, ...MADE, replaces: newId(), reason: 'a whim', cause: null, drops: [], of: 'question', ...shapes.question }),
      /its reason is not one of new-fact, other-topic, changed-mind, was-wrong/);
  });

  it('refuses a value that is no event of the shape its version names, saying why', () => {
    const base = { v: 1, id: newId(), ...TAGS, at: AT, ...question() };
    const cases = [
      [[], /not a JSON object/],
      [{ ...base, v: 0 }, /its v, 0, is not a schema version/],
      [{ ...base, v: '1' }, /its v, "1", is not a schema version/],
      [{ ...base, v: 1.5 }, /its v, 1.5, is not a schema version/],
      [{ ...base, event: 'noted' }, /its event "noted" is none of version 1's: asked, found/],
      [{ ...base, id: 'Q1' }, /its id is not an entry id/],
      [{ ...base, unit: '' }, /its unit is not non-empty text/],
      [{ ...base, at: 'yesterday' }, /its at is not a UTC time/],
      [{ ...base, by: 'someone' }, /its by is not one of person, claude, review/],
      [{ ...base, relies_on: ['Q1'] }, /its relies_on is not a list of an entry id/],
      [{ ...base, part_of: undefined }, /its part_of is not an entry id, or null/],
      [{ ...base, kind: 'look' }, /the asked event has no field kind at version 1/],
      [Object.fromEntries(Object.entries(base).filter(([key]) => key !== 'text')), /the asked event needs text/],
      [{ ...decision(newId()), v: 1, id: newId(), at: AT, by: 'review' }, /its by is not one of person, claude/],
      [{ ...decision(newId()), v: 1, id: newId(), at: AT, kind: 'taste' }, /its kind is not one of process, danger, contract, scope, look, words, behaviour, internals, or null/],
      [{ ...decision(newId()), v: 1, id: newId(), at: AT, answers: null }, /its answers is not an entry id/],
    ];
    for (const [value, message] of cases) assert.throws(() => validEvent(value), (err) => err instanceof LedgerLineError && message.test(err.message), `${JSON.stringify(value)} was not refused as ${message}`);
  });

  it('gives an entry its version, id and time, and refuses a caller naming any of them, appending nothing', () => {
    const { root } = project();
    const before = Date.now() - 1000;

    const entry = appendEntry(root, question(), []);

    assert.strictEqual(entry.v, LEDGER_VERSION);
    assert.match(/** @type {string} */ (entry.id), new RegExp(`^[0-9A-Za-z]{${ID_LENGTH}}$`));
    assert.ok(Date.parse(/** @type {string} */ (entry.at)) >= before && Date.parse(/** @type {string} */ (entry.at)) <= Date.now());
    assert.deepStrictEqual(JSON.parse(ledgerText(root)), entry);
    for (const assigned of [{ id: newId() }, { v: 1 }, { at: AT }]) {
      assert.throws(() => appendEntry(root, question(assigned), []), /is the engine's to give — nothing appended/);
    }
    assert.throws(() => appendEntry(root, decision(newId(), { answers: undefined }), []), /its answers is not an entry id/);
    assert.strictEqual(ledgerText(root).split('\n').length, 2);
  });
});

describe('ids', () => {
  it('draws a nanoid of 21 letters and digits from crypto: ten thousand drawn, never two alike, every character in use', () => {
    const ids = Array.from({ length: 10000 }, () => newId());
    assert.ok(ids.every((id) => /^[0-9A-Za-z]{21}$/.test(id)));
    assert.strictEqual(new Set(ids).size, ids.length);
    assert.strictEqual(new Set(ids.join('')).size, 62);
  });

  it('shows an id by its shortest prefix no other id shares, never under six characters', () => {
    const lone = 'Xk3vQ9a1b2c3d4e5f6g7h';
    const twins = ['Xk3vQ9Za1b2c3d4e5f6g7', 'Xk3vQ9Zb1b2c3d4e5f6g7'];
    const shorts = shortIds([lone, ...twins, lone]);

    assert.deepStrictEqual([...shorts], [[twins[0], 'Xk3vQ9Za'], [twins[1], 'Xk3vQ9Zb'], [lone, 'Xk3vQ9a']]);
    assert.strictEqual(shortIds(['Ab0000000000000000000']).get('Ab0000000000000000000'), 'Ab0000');
    assert.strictEqual(SHORT_MIN, 6);
  });

  it('resolves a prefix as git resolves a short hash: the one id it begins, refused where it begins none or several, or is under four characters', () => {
    const ids = ['Xk3vQ9Za1b2c3d4e5f6g7', 'Xk3vQ9Zb1b2c3d4e5f6g7', 'Pq0000000000000000000'];

    assert.strictEqual(resolveId('Xk3vQ9Zb', ids), ids[1]);
    assert.strictEqual(resolveId('Pq00', ids), ids[2]);
    assert.strictEqual(resolveId(ids[0], ids), ids[0]);
    assert.throws(() => resolveId('Xk3vQ9Z', ids), /"Xk3vQ9Z" is ambiguous: 2 ledger entries' ids begin with it/);
    assert.throws(() => resolveId('Zz00', ids), /no ledger entry's id begins "Zz00"/);
    assert.throws(() => resolveId('Pq0', ids), /too short to name a ledger entry/);
    assert.throws(() => resolveId('xk3vQ9Zb', ids), /no ledger entry's id begins/);
  });
});

describe('the streamed reader', () => {
  it('reads every entry in order, each line read as an event of the current shape; no ledger reads as none', () => {
    const { root } = project();
    assert.deepStrictEqual([...readLedger(root, [])], []);
    const written = [appendEntry(root, question(), [])];
    written.push(appendEntry(root, decision(/** @type {string} */ (written[0].id)), []));
    commitLedger(root);
    written.push(appendEntry(root, decision(/** @type {string} */ (written[0].id), { text: 'Appended, not yet committed.' }), []));

    assert.deepStrictEqual([...readLedger(root, [])], written);
  });

  it('refuses a line that is no entry, naming its number: one that is not JSON, one of another shape, and an unfinished last line', () => {
    const { root } = project();
    const q = appendEntry(root, question(), []);
    commitLedger(root);
    const committed = ledgerText(root);
    const cases = [
      ['not json\n', /line 2 of the ledger is not JSON: not json/],
      [`${JSON.stringify({ ...q, id: newId(), why: 'a decision\'s field' })}\n`, /line 2 of the ledger is no ledger entry: the asked event has no field why at version 1/],
      [JSON.stringify({ ...q, id: newId() }).slice(0, 40), /line 2 of the ledger is not JSON/],
      ['\n', /line 2 of the ledger is not JSON/],
    ];
    for (const [tail, message] of cases) {
      writeLedger(root, committed + tail);
      assert.throws(() => [...readLedger(root, [])], (err) => err instanceof LedgerLineError && message.test(err.message), `${JSON.stringify(tail)} was not refused as ${message}`);
    }
  });

  it('reads a line written before a later version added a field as valid, the field taking its stated default; a line of that version must carry it (5.S24)', () => {
    const { root } = project();
    const q = appendEntry(root, question(), []);
    const line = ledgerText(root).trim();
    const flag = { is: 'true or false', test: (/** @type {unknown} */ v) => typeof v === 'boolean' };
    const later = {
      version: 2,
      events: {
        ...SCHEMA.events,
        asked: { since: 1, fields: [...SCHEMA.events.asked.fields, { name: 'raised', type: flag, added: { version: 2, default: false } }] },
        noted: { since: 2, fields: [{ name: 'text', type: { is: 'text', test: (/** @type {unknown} */ v) => typeof v === 'string' } }] },
      },
    };

    assert.deepStrictEqual(parseEntry(line, 1, later), { ...q, raised: false });
    assert.strictEqual(parseEntry(JSON.stringify({ ...q, v: 2, raised: true }), 1, later).raised, true);
    assert.throws(() => parseEntry(JSON.stringify({ ...q, v: 2 }), 1, later), /line 1 of the ledger is no ledger entry: the asked event needs raised/);
    assert.throws(() => parseEntry(JSON.stringify({ ...q, raised: true }), 1, later), /the asked event has no field raised at version 1/);
    const noted = { v: 2, id: newId(), event: 'noted', ...TAGS, at: AT, text: 'Seen.' };
    assert.strictEqual(parseEntry(JSON.stringify(noted), 1, later).text, 'Seen.');
    assert.throws(() => parseEntry(JSON.stringify({ ...noted, v: 1 }), 1, later), /its event "noted" is none of version 1's/);
    assert.deepStrictEqual(parseEntry(line, 1), q);
  });

  it('stops on a line a newer release wrote, keeping its stop, and never reads it; a line of a version it knows with a field or an event it does not is a broken line', () => {
    const { main, root } = project();
    const q = appendEntry(root, question(), []);
    commitLedger(root);
    const newer = JSON.stringify({ ...q, v: 2, id: newId(), raised: true });
    writeLedger(root, `${ledgerText(root)}${newer}\n`);
    const gitDir = gitDirOf(root);

    const read = [];
    assert.throws(() => { for (const entry of readLedger(root, [])) read.push(entry); },
      (err) => err instanceof LedgerNewer && !(err instanceof LedgerLineError) && err.payload.stop === 'ledger'
        && /holds entries a newer Leeway wrote, at schema version 2, and the workflows here read up to version 1 — update the workflows on this machine \(pull the project's code\) and start again/.test(err.message));
    assert.deepStrictEqual(read, [q]);
    assert.deepStrictEqual(keptStop(gitDir), { stop: 'newer', version: 2, reads: 1 });
    assert.strictEqual(ledgerStopSurface(main, {}), [
      '=== DISPLAY: ledger stop (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ The engine stopped: the ledger holds entries a newer Leeway wrote',
      '',
      '=== DISPLAY: ledger account (emit verbatim as markdown (not a code block)) ===',
      "> Fumi's ledger holds entries at schema version 2, and the workflows on this machine read up to version 1, so the engine reads none of it.",
      '>',
      "> Update the workflows on this machine — pull the project's code — and start again.",
      '',
    ].join('\n'));

    for (const broken of [{ ...q, id: newId(), raised: true }, { ...q, id: newId(), event: 'noted' }]) {
      writeLedger(root, `${git(root, ['show', `${STATE_BRANCH}:${LEDGER}`])}${JSON.stringify(broken)}\n`);
      assert.throws(() => [...readLedger(root, [])], (err) => err instanceof LedgerLineError && /^line 2 of the ledger is no ledger entry: /.test(err.message));
    }
  });

  it('reads a ledger past the 64 MiB a pipe holds a line at a time: the check hashes it, extracting nothing, and only finding a changed line writes the blob out', () => {
    const { main, root } = project();
    git(main, ['config', 'core.looseCompression', '0']);
    const file = path.join(root, LEDGER);
    const fd = fs.openSync(file, 'w');
    let size = 0;
    let count = 0;
    let last = '';
    try {
      while (size <= READ_BUDGET_BYTES) {
        last = `${JSON.stringify(validEvent({ v: 1, id: newId(), event: 'found', ...TAGS, at: AT, ...MADE, text: 'x'.repeat(2000), how: 'measured', relies_on: [], product_wide: false }))}\n`;
        fs.writeSync(fd, last);
        size += Buffer.byteLength(last);
        count += 1;
      }
    } finally {
      fs.closeSync(fd);
    }
    commitLedger(root, 'state: a long ledger');

    const clean = traced(() => {
      let read = 0;
      for (const entry of readLedger(root, [])) {
        read += 1;
        if (read === count) assert.strictEqual(`${JSON.stringify(entry)}\n`, last);
      }
      return read;
    });
    assert.strictEqual(clean.result, count);
    assert.ok(clean.traced.every((call) => !/^(cat-file blob|show)\b/.test(call)), `the clean read wrote a blob out: ${clean.traced}`);

    appendEntry(root, question(), []);
    assert.notStrictEqual(commitLedger(root, 'state: one more').commit, null);
    const fd2 = fs.openSync(file, 'r+');
    try {
      fs.writeSync(fd2, 'X', size - 10);
    } finally {
      fs.closeSync(fd2);
    }
    const changed = traced(() => ledgerChange(root));
    assert.deepStrictEqual(changed.result, { line: count, found: `${last.slice(0, -10)}X${last.slice(-9, -1)}` });
    assert.ok(changed.traced.some((call) => call.startsWith('cat-file blob')), `finding the line wrote no blob out: ${changed.traced}`);
    assert.throws(() => commitLedger(root), LedgerChanged);
  });
});

describe('the append', () => {
  it('appends each entry as a whole line after the last, never editing a line before it', () => {
    const { root } = project();
    const texts = [];
    const q = appendEntry(root, question(), []);
    texts.push(ledgerText(root));
    for (const text of ['One.', 'Two.']) {
      appendEntry(root, decision(/** @type {string} */ (q.id), { text }), []);
      texts.push(ledgerText(root));
    }

    texts.forEach((text, i) => {
      assert.strictEqual(text.split('\n').length, i + 2);
      if (i > 0) assert.ok(text.startsWith(texts[i - 1]), `append ${i + 1} edited what was there`);
    });
  });

  it('replaces the file whole: killed before the rename, the ledger stands as it was with no half line, and the next append clears the copy left', () => {
    const { root } = project();
    const q = appendEntry(root, question(), []);
    const before = ledgerText(root);
    const file = path.join(root, LEDGER);
    const rename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (to === file) throw new Error('killed');
      return rename(from, to);
    };
    try {
      assert.throws(() => appendEntry(root, decision(/** @type {string} */ (q.id)), []), /killed/);
    } finally {
      fs.renameSync = rename;
    }
    const left = fs.readdirSync(root).filter((name) => name.startsWith(`${LEDGER}.`));
    assert.strictEqual(ledgerText(root), before);
    assert.strictEqual(left.length, 1);
    assert.strictEqual(spawnSync('git', ['check-ignore', '-q', left[0]], { cwd: root }).status, 0, 'the copy a kill leaves is not ignored');

    appendEntry(root, decision(/** @type {string} */ (q.id)), []);

    assert.deepStrictEqual(fs.readdirSync(root).filter((name) => name.startsWith(`${LEDGER}.`)), []);
    assert.strictEqual(ledgerText(root).split('\n').length, 3);
  });

  it('appends under the writer lock, timed under it: a live peer holding it, the append waits, then lands with the time it took the lock', async () => {
    const { root } = project();
    appendEntry(root, question(), []);
    const before = ledgerText(root);
    const lock = holdLock(root);
    const exit = settled(ledgerChild(root, `ledger.appendEntry(root, ${JSON.stringify(question({ text: 'Waited its turn?' }))}, [])`));

    assert.ok(await stillRunning(exit, 2000), 'the append did not wait on the peer');
    assert.strictEqual(ledgerText(root), before);
    const released = Math.floor(Date.now() / 1000) * 1000;
    fs.unlinkSync(lock);

    const { code, stderr } = /** @type {{code: number, stderr: string}} */ (await exit);
    assert.strictEqual(code, 0, stderr);
    const landed = JSON.parse(ledgerText(root).split('\n')[1]);
    assert.strictEqual(landed.text, 'Waited its turn?');
    assert.ok(Date.parse(landed.at) >= released, `the append was timed before it took the lock: ${landed.at}`);
  });

  it('refuses to append to a ledger the check stops on, or one ending in an unfinished line, appending nothing', () => {
    const { root } = project();
    const lines = threeCommitted(root);
    writeLedger(root, `${lines[0]}\n${lines[2]}\n`);
    assert.throws(() => appendEntry(root, question(), []), LedgerChanged);
    assert.strictEqual(ledgerText(root), `${lines[0]}\n${lines[2]}\n`);

    const unfinished = `${lines.join('\n')}\n{"v":1,"id":`;
    writeLedger(root, unfinished);
    assert.throws(() => appendEntry(root, question(), []), /ends in an unfinished line — nothing appended/);
    assert.strictEqual(ledgerText(root), unfinished);
  });
});

describe('the append-only check on a read', () => {
  it('passes a ledger as committed, and one grown only at its end', () => {
    const { root } = project();
    checkLedger(root, []);
    threeCommitted(root);
    assert.strictEqual(ledgerChange(root), null);
    appendEntry(root, question(), []);
    assert.strictEqual(ledgerChange(root), null);
    checkLedger(root, []);
  });

  it('stops on a rewritten line, a removed one, two swapped, a truncated last line, a blank line put in, a file shorter than the committed one, and none: showing the first line not as committed', () => {
    const { root } = project();
    const [a, b, c] = threeCommitted(root);
    const rewritten = b.replace('A near-frameless floating note.', 'A floating note.');
    const cases = [
      [`${a}\n${rewritten}\n${c}\n`, { line: 2, found: rewritten }],
      [`${a}\n${c}\n`, { line: 2, found: c }],
      [`${b}\n${a}\n${c}\n`, { line: 1, found: b }],
      [`${a}\n${b}\n${c.slice(0, 50)}`, { line: 3, found: c.slice(0, 50) }],
      [`${a}\n${b}\n${c}`, { line: 3, found: c }],
      [`${a}\n\n${b}\n${c}\n`, { line: 2, found: '' }],
      [`${a}\n`, { line: 2, found: null }],
    ];
    for (const [text, change] of cases) {
      writeLedger(root, /** @type {string} */ (text));
      assert.deepStrictEqual(stopped(root), change, `not stopped as ${JSON.stringify(change)}`);
    }
    fs.rmSync(path.join(root, LEDGER));
    assert.deepStrictEqual(stopped(root), { line: 1, found: null });
  });

  it('hashes the file against the blob in a repository whose objects are named by sha256 too', () => {
    const { main, root } = project({ objectFormat: 'sha256' });
    const [a, b, c] = threeCommitted(root);
    assert.strictEqual(git(main, ['rev-parse', `${STATE_BRANCH}:${LEDGER}`]).trim().length, 64);
    assert.strictEqual(ledgerChange(root), null);

    writeLedger(root, `${a}\n${c}\n${b}\n`);

    assert.deepStrictEqual(stopped(root), { line: 2, found: c });
    assert.throws(() => commitLedger(root), LedgerChanged);
  });

  it('reads the branch before the file: an append committed between the two reads never reads as a change, and the check waits on no lock', () => {
    const { root } = project();
    threeCommitted(root);
    const later = JSON.stringify(validEvent({ v: 1, id: newId(), at: AT, ...question({ text: 'Landed between the reads?' }) }));
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(world, 'git-'));
    fs.writeFileSync(path.join(wrapper, 'git'), [
      '#!/bin/sh',
      `real="${real}"`,
      'case "$*" in',
      '  *"--batch-check="*)',
      `    if [ ! -f "${wrapper}/done" ]; then`,
      `      touch "${wrapper}/done"`,
      `      printf '%s\\n' '${later}' >> "${path.join(root, LEDGER)}"`,
      `      "$real" -C "${root}" commit -q -m 'state: landed between the reads' -- ${LEDGER}`,
      '    fi',
      '    ;;',
      'esac',
      'exec "$real" "$@"',
      '',
    ].join('\n'), { mode: 0o755 });
    holdLock(root);

    const res = spawnSync('node', ['-e', 'require(process.argv[1]).checkLedger(process.argv[2], []); process.stdout.write("as committed")', LEDGER_MODULE, root], {
      encoding: 'utf8', timeout: 10000, env: { ...process.env, PATH: `${wrapper}:${process.env.PATH}` },
    });

    assert.deepStrictEqual([res.signal, res.status, res.stdout], [null, 0, 'as committed'], res.stderr);
    assert.ok(fs.existsSync(path.join(wrapper, 'done')), 'nothing landed between the reads');
    assert.ok(git(root, ['show', `${STATE_BRANCH}:${LEDGER}`]).endsWith(`${later}\n`));
  });

  it('makes a failed check again under the writer lock before it stops: a landing that rewrote the file before moving the branch passes once it lands', async () => {
    const { root } = project();
    const [a, b] = threeCommitted(root);
    const lock = holdLock(root);
    writeLedger(root, `${b}\n${a}\n`);
    const exit = settled(ledgerChild(root, 'ledger.checkLedger(root, []); process.stdout.write("as committed")'));

    assert.ok(await stillRunning(exit, 1500), 'the check stopped without waiting for the lock');
    git(root, ['commit', '-q', '-m', 'state: the landing moves the branch', '--', LEDGER]);
    fs.unlinkSync(lock);

    assert.deepStrictEqual(await exit, { code: 0, stdout: 'as committed', stderr: '' });
  });

  it('clears the blobs a killed check left written out in the git dir, never a running process\'s', () => {
    const { root } = project();
    const [a, b] = threeCommitted(root);
    const gitDir = gitDirOf(root);
    const gone = spawnSync('node', ['-e', '0']).pid;
    const running = spawn('sleep', ['30']);
    try {
      fs.writeFileSync(path.join(gitDir, `leeway-ledger.${gone}.abc`), 'x'.repeat(4096));
      fs.writeFileSync(path.join(gitDir, `leeway-ledger.${running.pid}.abc`), 'x');
      writeLedger(root, `${b}\n${a}\n`);

      assert.throws(() => checkLedger(root, []), LedgerChanged);

      assert.deepStrictEqual(fs.readdirSync(gitDir).filter((name) => name.startsWith('leeway-ledger.')), [`leeway-ledger.${running.pid}.abc`]);
    } finally {
      running.kill();
    }
  });

  it('stops once it holds the lock where the ledger is still not as committed', async () => {
    const { root } = project();
    const [a, b] = threeCommitted(root);
    const lock = holdLock(root);
    writeLedger(root, `${b}\n${a}\n`);
    const exit = settled(ledgerChild(root, 'ledger.checkLedger(root, [])'));

    assert.ok(await stillRunning(exit, 1500), 'the check stopped without waiting for the lock');
    fs.unlinkSync(lock);

    const { code, stderr } = /** @type {{code: number, stderr: string}} */ (await exit);
    assert.strictEqual(code, 1);
    assert.match(stderr, /\.ledger\.jsonl changed outside the engine: line 1 is not the line committed there — the engine stops here/);
  });
});

describe('the append-only check on a state commit (5.S6)', () => {
  it('commits a ledger that only grew, and a commit that leaves the ledger alone', () => {
    const { main, root } = project();
    threeCommitted(root);
    appendEntry(root, question(), []);
    assert.notStrictEqual(commitLedger(root).commit, null);
    fs.writeFileSync(path.join(root, 'manifest.json'), '{}\n');
    writeLedger(root, 'not the ledger committed\n');
    assert.notStrictEqual(withStateLock(root, () => commitState(root, ['manifest.json'], 'state: the manifest')).commit, null);
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:${LEDGER}`]).split('\n').length, 5);
  });

  it('refuses a commit whose ledger does not start, byte for byte, with its parent\'s: a rewritten line, a removed one, a truncated last line, a shorter file, none — nothing committed', () => {
    const { main, root } = project();
    const [a, b, c] = threeCommitted(root);
    const before = tip(main, STATE_BRANCH);
    const rewritten = c.replace('Its controls appear on hover.', 'Its controls are always shown.');
    const cases = [
      [`${a}\n${b}\n${rewritten}\n`, { line: 3, found: rewritten }],
      [`${b}\n${c}\n`, { line: 1, found: b }],
      [`${a}\n${b}\n${c.slice(0, 30)}`, { line: 3, found: c.slice(0, 30) }],
      [`${a}\n${b}\n`, { line: 3, found: null }],
      [null, { line: 1, found: null }],
    ];
    for (const [text, change] of cases) {
      if (text === null) fs.rmSync(path.join(root, LEDGER));
      else writeLedger(root, /** @type {string} */ (text));
      assert.throws(() => commitLedger(root), (err) => err instanceof LedgerChanged && /— nothing committed$/.test(err.message) && JSON.stringify(err.change) === JSON.stringify(change),
        `not refused as ${JSON.stringify(change)}`);
      assert.deepStrictEqual(keptStop(gitDirOf(root)), { stop: 'changed', ...change });
      assert.throws(() => withStateLock(root, () => commitState(root, ['.'], 'state: everything')), LedgerChanged);
      assert.strictEqual(tip(main, STATE_BRANCH), before);
    }
  });

  it('judges the ledger the commit holds, not the file, where the two differ', () => {
    const { main, root } = project();
    const [a, b] = threeCommitted(root);
    const worktree = /** @type {import('../../skills/workflow-engine/scripts/domain/state-worktree.cjs').OpenWorktree} */ (openWorktree(root));
    /** @param {string} text */
    const treeHolding = (text) => {
      const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: main, encoding: 'utf8', input: text }).trim();
      return execFileSync('git', ['mktree'], { cwd: main, encoding: 'utf8', input: `100644 blob ${blob}\t${LEDGER}\n` }).trim();
    };
    const grown = `${ledgerText(root)}${a}\n`;

    writeLedger(root, 'z\n');
    assert.strictEqual(checkLedgerCommit(worktree, STATE_BRANCH, treeHolding(grown)), null);
    writeLedger(root, grown);
    assert.throws(() => checkLedgerCommit(worktree, STATE_BRANCH, treeHolding(`${b}\n${a}\n`)), (err) => err instanceof LedgerChanged && err.change.line === 1);
  });

  it('stops the engine\'s commit door with the ledger\'s screen, which `render ledger-stop` draws', () => {
    const dir = setupGitFixture('ledger-door-');
    try {
      const root = statePath(dir);
      const q = appendEntry(root, question(), []);
      appendEntry(root, decision(/** @type {string} */ (q.id)), []);
      assert.ok(ok(dir, ['commit', '--workflows', '-m', 'state: two entries']).committed);
      assert.match(refuses(dir, ['render', 'ledger-stop']).error, /no stop on the ledger is kept — nothing stopped the engine/);
      const [first] = ledgerText(root).split('\n');
      writeLedger(root, `${first}\n`);

      const refusal = refuses(dir, ['commit', '--workflows', '-m', 'state: a shorter ledger']);

      assert.strictEqual(refusal.stop, 'ledger');
      assert.match(refusal.error, /\.ledger\.jsonl changed outside the engine: it ends before line 2, which was committed — nothing committed/);
      const screen = output(dir, ['render', 'ledger-stop']);
      assert.strictEqual(screen, ledgerStopSurface(dir, {}));
      assert.match(screen, /'s ledger only grows at its end, and it ends before line 2, which the state branch last committed\.\n/);
      auditMarkers(screen, 'ledger stop');
    } finally {
      cleanupFixture(dir);
    }
  });
});

describe('the stop\'s screen (5.4.4)', () => {
  const INDENT = '  ';

  it('names the project, the line by its number, and the line found there, indented, its id in short form, cut short', () => {
    const found = '{"v":1,"id":"Xk3vQ9a1b2c3d4e5f6g7h","event":"decided","unit":"mint","topic":"token-auth"}';

    assert.strictEqual(ledgerStop('Mint', { line: 1204, found }, 'Xk3vQ9'), [
      '=== DISPLAY: ledger stop (emit verbatim as a properties code block (```properties fence)) ===',
      "⚑ The engine stopped: a ledger line isn't as it was committed",
      '',
      '=== DISPLAY: ledger account (emit verbatim as markdown (not a code block)) ===',
      "> Mint's ledger only grows at its end, and line 1,204 isn't the line the state branch last committed there. The line it found:",
      `> ${INDENT}{"v":1,"id":"Xk3vQ9…","event":"decided","unit":"mint","topi…`,
      '> Something outside the engine changed, removed or reordered the ledger, so the engine stops here.',
      '',
    ].join('\n'));
  });

  it('says the ledger ends before a line it lost, shows a blank line as one, escapes the markdown a line holds, and shows an id whole where no shorter form names it', () => {
    assert.match(ledgerStop('Mint', { line: 3, found: null }, null), /\n> Mint's ledger only grows at its end, and it ends before line 3, which the state branch last committed\.\n> Something outside/);
    assert.match(ledgerStop('Mint', { line: 2, found: '' }, null), new RegExp(`\\n> ${INDENT}\\*a blank line\\*\\n`));
    assert.match(ledgerStop('Mint', { line: 2, found: '{"why":"*not* `code`"}' }, null), new RegExp(`\\n> ${INDENT}\\{"why":"\\\\\\*not\\\\\\* \\\\\`code\\\\\`"\\}\\n`));
    assert.match(ledgerStop('Mint', { line: 2, found: '{"id":"Q1"}' }, 'Q1'), /\{"id":"Q1"\}\n/);
  });

  it('draws the stop the engine kept, the id in its shortest form among the ledger\'s ids, and refuses where none is kept', () => {
    const { main, root } = project();
    const twin = `${newId().slice(0, 7)}`;
    const [a, b] = [`${twin}${newId().slice(0, 14)}`, `${twin}${newId().slice(0, 14)}`];
    const lines = [a, b].map((id) => JSON.stringify(validEvent({ v: 1, id, at: AT, ...question() })));
    writeLedger(root, `${lines.join('\n')}\n`);
    commitLedger(root);
    assert.throws(() => ledgerStopSurface(main, {}), /render ledger-stop: no stop on the ledger is kept — nothing stopped the engine/);
    writeLedger(root, `${lines[1]}\n${lines[0]}\n`);

    assert.throws(() => checkLedger(root, []), LedgerChanged);

    const shared = [...a].findIndex((ch, i) => ch !== b[i]);
    assert.ok(ledgerStopSurface(main, {}).includes(`{"v":1,"id":"${b.slice(0, Math.max(6, shared + 1))}…"`));
    writeLedger(root, `${lines.join('\n')}\n`);
    fs.writeFileSync(path.join(root, 'manifest.json'), '{}\n');
    withStateLock(root, () => commitState(root, ['manifest.json'], 'state: a commit lands'));
    assert.throws(() => ledgerStopSurface(main, {}), /no stop on the ledger is kept/);
  });
});

/**
 * A migration at `rel` in the world, converting the ledger with the
 * converter whose source is `convert`, loaded.
 * @param {string} rel @param {string} convert
 * @returns {{run: (opts: {projectDir: string}) => {events: number, warnings: string[]}}}
 */
function migrationAt(rel, convert) {
  const file = path.join(world, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, [
    "'use strict';",
    `const { convertLedger } = require(${JSON.stringify(CONVERSION_MODULE)});`,
    `module.exports = { id: '900', description: 'the ledger converted', run: ({ projectDir }) => convertLedger(projectDir, ${convert}) };`,
    '',
  ].join('\n'));
  return require(file);
}

// The shape before: each event's name under `type`, at version 0.
const TO_CURRENT = 'function* (events) { for (const { v, type, ...rest } of events) yield { v: 1, event: type, ...rest }; }';

/** A question and its decision committed in the shape before: the ledger's text. @param {string} root */
function oldShapeCommitted(root) {
  const q = validEvent({ v: 1, id: newId(), at: AT, ...question() });
  const d = validEvent({ v: 1, id: newId(), at: AT, ...decision(/** @type {string} */ (q.id)) });
  const text = [q, d].map(({ v, event, ...rest }) => `${JSON.stringify({ v: 0, type: event, ...rest })}\n`).join('');
  writeLedger(root, text);
  commitLedger(root, 'state: the ledger in the shape before');
  return text;
}

/** Where the conversion's pass stands. @param {string} root */
function passFile(root) {
  return path.resolve(root, git(root, ['rev-parse', '--git-path', 'leeway-ledger-conversion.json']).trim());
}

describe('the conversion door (5.S25)', () => {
  it('converts the stream, every event through with its id in its order; the commit carrying the copy passes the check, that commit alone, and git keeps the original byte for byte', () => {
    const { main, root } = project();
    const original = oldShapeCommitted(root);

    assert.deepStrictEqual(migrationAt('migrations/900-ledger-event-field.cjs', TO_CURRENT).run({ projectDir: main }), { events: 2, warnings: [] });

    const converted = [...readLedger(root, [])];
    assert.deepStrictEqual(converted.map((e) => e.event), ['asked', 'decided']);
    assert.deepStrictEqual(converted.map((e) => e.id), original.trim().split('\n').map((line) => JSON.parse(line).id));
    fs.writeFileSync(path.join(root, 'manifest.json'), '{}\n');
    withStateLock(root, () => commitState(root, ['manifest.json'], 'state: not the ledger'));
    assert.ok(fs.existsSync(passFile(root)), 'a commit without the copy spent the pass');

    assert.notStrictEqual(commitLedger(root, 'chore: migrate the ledger').commit, null);

    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}^:${LEDGER}`]), original);
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:${LEDGER}`]), ledgerText(root));
    assert.ok(!fs.existsSync(passFile(root)), 'the pass outlived its commit');
    appendEntry(root, question(), []);
    assert.notStrictEqual(commitLedger(root).commit, null);
    writeLedger(root, ledgerText(root).split('\n').reverse().join('\n'));
    assert.throws(() => commitLedger(root), LedgerChanged);
  });

  it('refuses a copy that drops an event, adds one, changes an id, reorders them or is no entry, changing nothing', () => {
    const { main, root } = project();
    const original = oldShapeCommitted(root);
    const [first, second] = original.trim().split('\n').map((line) => JSON.parse(line).id);
    const converters = [
      ['function* (events) { let n = 0; for (const { v, type, ...rest } of events) if (n++ === 0) yield { v: 1, event: type, ...rest }; }', `at line 2 the ledger holds ${second} and the copy none`],
      [`function* (events) { yield* (${TO_CURRENT})(events); yield { id: 'added' }; }`, 'at line 3 the ledger holds no event and the copy added'],
      ['function* (events) { for (const { v, type, ...rest } of events) yield { v: 1, event: type, ...rest, id: `${rest.id}x` }; }', `at line 1 the ledger holds ${first} and the copy ${first}x`],
      [`function* (events) { yield* [...(${TO_CURRENT})(events)].reverse(); }`, `at line 1 the ledger holds ${first} and the copy ${second}`],
      ['function* (events) { for (const e of events) yield null; }', 'line 1 of the converted copy is not an entry with an id'],
    ];
    converters.forEach(([convert, message], i) => {
      const migration = migrationAt(`migrations/90${i}-ledger.cjs`, convert);
      assert.throws(() => migration.run({ projectDir: main }), (err) => err instanceof Error && err.message.includes(message) && err.message.endsWith('— nothing converted'), `not refused: ${message}`);
      assert.strictEqual(ledgerText(root), original);
      assert.ok(!fs.existsSync(passFile(root)));
      assert.deepStrictEqual(fs.readdirSync(root).filter((name) => name.startsWith(`${LEDGER}.`)), []);
    });
  });

  it('is passed only by a migration: from anywhere else it refuses, converting nothing', () => {
    const { main, root } = project();
    const original = oldShapeCommitted(root);
    const identity = 'function* (events) { yield* events; }';

    assert.throws(() => convertLedger(main, function* (events) { yield* events; }), /only a migration converts the ledger's shape, and .*test-engine-ledger\.cjs is no migration — nothing converted/);
    for (const rel of ['scripts/900-convert.cjs', 'migrations/convert.cjs', 'migrations/900-convert.js']) {
      assert.throws(() => migrationAt(rel, identity).run({ projectDir: main }), /only a migration converts the ledger's shape/, `${rel} passed the door`);
    }
    assert.strictEqual(ledgerText(root), original);
    assert.deepStrictEqual(migrationAt('migrations/900-convert.cjs', identity).run({ projectDir: main }), { events: 2, warnings: [] });
  });

  it('refuses a ledger the check stops on, converting nothing', () => {
    const { main, root } = project();
    const original = oldShapeCommitted(root);
    const swapped = original.trim().split('\n').reverse().map((line) => `${line}\n`).join('');
    writeLedger(root, swapped);

    assert.throws(() => migrationAt('migrations/900-convert.cjs', TO_CURRENT).run({ projectDir: main }), (err) => err instanceof LedgerChanged && /— nothing converted$/.test(err.message));
    assert.strictEqual(ledgerText(root), swapped);
    assert.ok(!fs.existsSync(passFile(root)));
  });

  it('killed between leaving the pass and renaming the copy in, leaves the original standing, which the check passes and a commit leaves as it was', () => {
    const { main, root } = project();
    const original = oldShapeCommitted(root);
    const file = path.join(root, LEDGER);
    const rename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (to === file) throw new Error('killed');
      return rename(from, to);
    };
    try {
      assert.throws(() => migrationAt('migrations/900-convert.cjs', TO_CURRENT).run({ projectDir: main }), /killed/);
    } finally {
      fs.renameSync = rename;
    }

    assert.strictEqual(ledgerText(root), original);
    assert.ok(fs.existsSync(passFile(root)));
    assert.strictEqual(ledgerChange(root), null);
    assert.strictEqual(commitLedger(root).commit, null);
    assert.deepStrictEqual(migrationAt('migrations/901-convert.cjs', TO_CURRENT).run({ projectDir: main }), { events: 2, warnings: [] });
    assert.notStrictEqual(commitLedger(root, 'chore: migrate the ledger').commit, null);
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}^:${LEDGER}`]), original);
  });

  it('commits first the lines an earlier write left uncommitted, never stopping on them, so every line it rewrites is in git as written', () => {
    const { main, root } = project();
    const original = oldShapeCommitted(root);
    const { v, event, ...rest } = validEvent({ v: 1, id: newId(), at: AT, ...question({ text: 'Left uncommitted?' }) });
    const tail = `${JSON.stringify({ v: 0, type: event, ...rest })}\n`;
    writeLedger(root, `${original}${tail}`);
    const before = tip(main, STATE_BRANCH);

    assert.deepStrictEqual(migrationAt('migrations/900-convert.cjs', TO_CURRENT).run({ projectDir: main }), { events: 3, warnings: [] });

    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:${LEDGER}`]), `${original}${tail}`);
    assert.strictEqual(tip(main, `${STATE_BRANCH}^`), before);
    assert.strictEqual(git(main, ['log', '-1', '--format=%s', STATE_BRANCH]).trim(), 'state: the ledger as written, before its conversion');
    assert.notStrictEqual(commitLedger(root, 'chore: migrate the ledger').commit, null);
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}^:${LEDGER}`]), `${original}${tail}`);
    assert.deepStrictEqual([...readLedger(root, [])].map((e) => e.text), ['What is a fumi, at its most basic?', 'A near-frameless floating note.', 'Left uncommitted?']);
  });

  it('honours a pass only where its copy, stored in git, keeps the door\'s rule: a pass written by hand lifts no removed line from a read or a commit', () => {
    const { main, root } = project();
    const lines = threeCommitted(root);
    const before = tip(main, STATE_BRANCH);
    const from = { oid: tip(main, `${STATE_BRANCH}:${LEDGER}`), size: Buffer.byteLength(ledgerText(root)) };
    /** @param {string} text @param {boolean} [stored] */
    const forge = (text, stored = true) => {
      writeLedger(root, text);
      const oid = git(root, ['hash-object', ...(stored ? ['-w'] : []), '--', LEDGER]).trim();
      fs.writeFileSync(passFile(root), JSON.stringify({ from, to: { oid, size: Buffer.byteLength(text) } }));
    };

    forge(`${lines[0]}\n${lines[2]}\n`);
    assert.throws(() => checkLedger(root, []), (err) => err instanceof LedgerChanged && err.change.line === 2);
    assert.throws(() => commitLedger(root), LedgerChanged);
    const kept = lines.map((line) => `${JSON.stringify({ ...JSON.parse(line), text: 'Converted.' })}\n`).join('');
    forge(kept, false);
    assert.throws(() => checkLedger(root, []), (err) => err instanceof LedgerChanged && err.change.line === 1);
    assert.strictEqual(tip(main, STATE_BRANCH), before);

    forge(kept);
    checkLedger(root, []);
    assert.notStrictEqual(commitLedger(root, 'chore: migrate the ledger').commit, null);
    assert.strictEqual(git(main, ['show', `${STATE_BRANCH}:${LEDGER}`]), kept);
  });
});

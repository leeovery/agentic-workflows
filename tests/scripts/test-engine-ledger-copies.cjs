'use strict';

// ---------------------------------------------------------------------------
// The ledger's rendered copies (workflow-engine/scripts/domain/ledger-copies.cjs
// and domain/projections/ledger-copy.cjs) and their indexing: after a ledger
// write, and after a lifecycle change that sets a topic or unit aside or
// brings it back, the copies in the gitignored `.knowledge/` are rendered
// against the ledger — each record holding a current entry, a topic's or a
// unit's own level's, its current answers only, and the product record's
// file — and the knowledge base indexes the records, never the product
// record's file nor the ledger. A replaced answer leaves the copy and the
// search at once; a record relying on it renders again; a cancelled or
// postponed place loses its copy until it is back. Boot renders what is
// missing or stale before its knowledge pass, and a render or an index that
// fails is a warning the next start makes good.
//
// Real repositories in temp folders, each with its state worktree and its
// knowledge set up keyword-only; the unit's manifest written there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');

// Seams, set before the engine is loaded so the copies' render binds them: a
// test hooks the render's claim, and the moment its fold has read the ledger
// and what is live.
const manifestIo = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const projection = require(path.join(SCRIPTS, 'domain/projections/ledger-copy.cjs'));
/** @type {{claimed: ((release: () => void) => () => void)|null, folded: (() => void)|null}} */
const seams = { claimed: null, folded: null };
const { tryClaimFile, productCopy } = { tryClaimFile: manifestIo.tryClaimFile, productCopy: projection.productCopy };
manifestIo.tryClaimFile = (/** @type {string} */ file, /** @type {number|undefined} */ staleMs) => {
  const release = tryClaimFile(file, staleMs);
  return release && seams.claimed ? seams.claimed(release) : release;
};
projection.productCopy = (/** @type {any} */ view) => {
  if (seams.folded) seams.folded();
  return productCopy(view);
};

const { ENGINE, ok, callAsync, keywordOnlyKnowledge, indexedFiles, statePath, stateGit, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const store = require(path.join(SCRIPTS, 'kernel/knowledge/store.cjs'));
const { knowledgeFiles } = require(path.join(SCRIPTS, 'kernel/knowledge/files.cjs'));
const { LEDGER } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const { followingLiveness } = require(path.join(SCRIPTS, 'domain/ledger-copies.cjs'));
const { readWorkUnitManifest, writeWorkUnitManifestAtomic } = manifestIo;
const { ExitSignal } = require(path.join(SCRIPTS, 'kernel/call.cjs'));

const UNIT = 'fumi';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'session-1' });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const NOTE = `${UNIT}.discussion.note-window`;
const SPACE = `${UNIT}.discussion.space-homing`;
const NOTE_COPY = '.knowledge/records/fumi/note-window.md';
const SPACE_COPY = '.knowledge/records/fumi/space-homing.md';

/** A discovery map row a topic's cancel and postpone take. @param {number} order @param {string} summary */
function row(order, summary) {
  return { order, summary, routing: 'discussion', source: 'discovery' };
}

/** @type {string} */
let dir;

beforeEach(() => {
  dir = setupGitFixture('ledger-copies-');
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: { 'note-window': row(1, 'The note window'), 'space-homing': row(2, 'Where notes open') } },
      discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
    },
  });
  keywordOnlyKnowledge(dir);
});

afterEach(() => {
  seams.claimed = null;
  seams.folded = null;
  cleanupFixture(dir);
});

/**
 * One ledger write that must succeed: its response.
 * @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content
 */
function write(verb, address, flags, content) {
  return ok(dir, ['ledger', verb, address, ...flags], { env: SESSION, stdin: JSON.stringify(content) });
}

/** A question asked at `address`: its short id. @param {string} address @param {string} text */
function ask(address, text) {
  return write('ask', address, [], { ...MADE, text }).id;
}

/** A decision answering `question` at `address`: its short id. @param {string} address @param {string} question @param {string} text @param {string[]} [flags] @param {Record<string, unknown>} [content] */
function decide(address, question, text, flags = [], content = {}) {
  return write('decide', address, ['--answers', question, ...flags], { ...MADE, text, why: 'It follows the person.', ...content }).id;
}

/** `old` replaced at `address`, a changed mind: the response. @param {string} address @param {string} old @param {Record<string, unknown>} content */
function change(address, old, content) {
  return write('replace', address, ['--replaces', old, '--reason', 'changed-mind'], { ...MADE, drops: ['the old one'], ...content });
}

/**
 * One engine command run as its own process: its pid, and once it ends its
 * exit code and what `atExit` saw the moment it did.
 * @template T
 * @param {string[]} args @param {Record<string, unknown>|null} content its stdin, none where null
 * @param {() => T} [atExit]
 * @returns {{pid: number|undefined, done: Promise<{code: number|null, seen: T|undefined}>}}
 */
function spawnEngine(args, content, atExit) {
  const stdin = stdinFile(content);
  const child = spawn('node', [ENGINE, ...args], { cwd: dir, env: { ...process.env, ...SESSION }, stdio: [stdin, 'ignore', 'ignore'] });
  fs.closeSync(stdin);
  return { pid: child.pid, done: new Promise((resolve) => child.on('close', (code) => resolve({ code, seen: atExit?.() }))) };
}

/**
 * One engine command run under a shell of its own, which reaps it the moment
 * it is killed even while this process is busy: its process id, once
 * written, and its end.
 * @param {string[]} args @param {Record<string, unknown>} content
 */
function spawnReaped(args, content) {
  const pidFile = path.join(dir, `pid-${spawned += 1}`);
  const input = stdinPath(content);
  const shell = spawn('sh', ['-c', '"$@" < "$LEEWAY_TEST_STDIN" & echo $! > "$LEEWAY_TEST_PID"; wait', 'sh', 'node', ENGINE, ...args], {
    cwd: dir, env: { ...process.env, ...SESSION, LEEWAY_TEST_STDIN: input, LEEWAY_TEST_PID: pidFile }, stdio: 'ignore',
  });
  return { pid: () => (fs.existsSync(pidFile) ? Number(fs.readFileSync(pidFile, 'utf8')) || null : null), done: new Promise((resolve) => shell.on('close', resolve)) };
}

/** A command's stdin as an open file, so it reads it whole even while a seam holds this process. @param {Record<string, unknown>|null} content none where null */
function stdinFile(content) {
  return fs.openSync(stdinPath(content), 'r');
}

/** A command's stdin written to a file: its path. @param {Record<string, unknown>|null} content none where null */
function stdinPath(content) {
  const input = path.join(dir, `stdin-${spawned += 1}.json`);
  fs.writeFileSync(input, content === null ? '' : JSON.stringify({ ...MADE, ...content }));
  return input;
}

/** How many engine processes this suite has started. */
let spawned = 0;

/** A synchronous wait, for a seam that runs inside the engine's own call. @param {() => boolean} reached */
function holdUntil(reached) {
  const pause = new Int32Array(new SharedArrayBuffer(4));
  for (let tries = 0; !reached() && tries < 400; tries += 1) Atomics.wait(pause, 0, 0, 50);
}

/** The state branch's commit count. */
function commits() {
  return Number(stateGit(dir, ['rev-list', '--count', 'HEAD']));
}

/** A barrier: waits until `reached` holds, failing with `what` after half a minute. @param {() => boolean} reached @param {string} what */
async function until(reached, what) {
  for (let tries = 0; !reached() && tries < 600; tries += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(reached(), what);
}

/** A copy's text, state-relative, or null where there is none. @param {string} rel */
function copy(rel) {
  const file = statePath(dir, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/** The identities the store holds, `{unit}/{phase}/{topic}`, sorted. */
function identities() {
  const file = knowledgeFiles(statePath(dir)).store;
  return [...new Set(store.allChunks(store.loadStore(file)).map((c) => `${c.work_unit}/${c.phase}/${c.topic}`))].sort();
}

/** The text of every chunk the store holds. */
function indexedText() {
  return store.allChunks(store.loadStore(knowledgeFiles(statePath(dir)).store)).map((c) => c.content).join('\n');
}

/** A read by area: the knowledge base searched over the records alone. @param {string[]} terms */
async function byArea(...terms) {
  const res = await callAsync(dir, ['knowledge', 'query', ...terms, '--phase', 'record']);
  assert.strictEqual(res.code, 0, res.stderr);
  return res.stdout;
}

/** A decision on the note window, a floating panel ruling out a document window: its question's and its own short ids. */
function floatingPanel() {
  const question = ask(NOTE, 'Is a note a window?');
  return { question, decision: decide(NOTE, question, 'A floating panel.', [], { rules_out: ['a document window', 'a sheet'] }) };
}

describe('a record\'s copy (5.8.12, 22.6.6, 22.6.7)', () => {
  it('is rendered and indexed once its topic\'s entries change: each question a heading with its answer, why and what it rules out, a finding and an open question beside them, outside every tracked file (4.S25, 22.S18)', () => {
    const { question, decision } = floatingPanel();
    const finding = write('find', NOTE, [], { ...MADE, text: 'Panels float above every Space.', how: 'a spike' }).id;
    const open = ask(NOTE, 'Does a panel take focus?');

    assert.strictEqual(copy(NOTE_COPY), [
      '# fumi / note-window',
      '',
      '## Is a note a window?',
      '',
      `Asked by Claude. Entry ${question}.`,
      '',
      'A floating panel.',
      '',
      'Why: It follows the person.',
      '',
      'Rules out:',
      '- a document window',
      '- a sheet',
      '',
      `Decided by Claude. Entry ${decision}.`,
      '',
      '## Does a panel take focus?',
      '',
      `Asked by Claude. Entry ${open}.`,
      '',
      'Not decided yet.',
      '',
      '## Finding: Panels float above every Space.',
      '',
      'Panels float above every Space.',
      '',
      'How it is known: a spike',
      '',
      `Found by Claude. Entry ${finding}.`,
      '',
    ].join('\n'));
    assert.deepStrictEqual(indexedFiles(dir), [NOTE_COPY]);
    assert.strictEqual(stateGit(dir, ['status', '--porcelain', '--', '.knowledge', '.cache']), '');
    assert.strictEqual(stateGit(dir, ['ls-tree', '-r', '--name-only', 'HEAD', '--', '.knowledge', '.cache']), '');
    assert.deepStrictEqual(fs.readdirSync(statePath(dir, UNIT)), ['manifest.json'], 'a record file sits in the unit\'s tree');
  });

  it('shows the answer that replaced one and drops the one replaced, from the copy and from a read by area, the ledger never indexed (5.S22, 22.S16, 5.S29)', async () => {
    const { decision } = floatingPanel();
    assert.match(await byArea('floating'), /\[record \| fumi\/note-window /);

    const framed = change(NOTE, decision, { text: 'A framed panel.', why: 'Frames read as furniture.', rules_out: [] }).id;

    const text = /** @type {string} */ (copy(NOTE_COPY));
    assert.match(text, /^## Is a note a window\?\n\nAsked by Claude\. Entry \w+\.\n\nA framed panel\.\n\nWhy: Frames read as furniture\.\n\nDecided by Claude\. Entry \w+\.$/m);
    assert.ok(text.includes(`Entry ${framed}.`));
    assert.doesNotMatch(text, /floating|document window/);
    assert.match(await byArea('floating'), /\[0 results\]/);
    assert.match(await byArea('framed'), /\[record \| fumi\/note-window /);
    assert.deepStrictEqual(indexedFiles(dir), [NOTE_COPY]);
    assert.ok(fs.existsSync(statePath(dir, LEDGER)));
  });

  it('renders again where a record relies on an answer that is replaced, the new answer shown from its own topic (5.8.4, 5.S20)', () => {
    const { decision } = floatingPanel();
    decide(SPACE, ask(SPACE, 'Does a note open on the active Space?'), 'Yes.', ['--relies-on', decision]);
    assert.match(/** @type {string} */ (copy(SPACE_COPY)), /^## From fumi \/ note-window: A floating panel\.$/m);

    change(NOTE, decision, { text: 'A framed panel.', why: 'Frames read as furniture.' });

    const relying = /** @type {string} */ (copy(SPACE_COPY));
    assert.match(relying, /^## From fumi \/ note-window: A framed panel\.\n\nA framed panel\.\n\nWhy: Frames read as furniture\.\n\nDecided by Claude, in fumi \/ note-window\. Entry \w+\.$/m);
    assert.doesNotMatch(relying, /floating/);
  });

  it('renders one at a time and no writer waits on its claim: a write that lands while a render holds it returns once the holder has rendered and indexed it, the store ending with the later text (5.8.12, 5.S22)', async () => {
    const { decision } = floatingPanel();
    const files = knowledgeFiles(statePath(dir));
    fs.writeFileSync(files.lock, String(process.pid));
    const before = commits();
    const holder = spawnEngine(['ledger', 'replace', NOTE, '--replaces', decision, '--reason', 'changed-mind'], { text: 'A framed panel.', why: 'Frames read as furniture.', drops: ['the old one'] });
    /** @type {ReturnType<typeof spawnEngine<{copy: string|null, indexed: string}>>|null} */
    let later = null;
    try {
      // The barrier: the holder has rendered its write and waits on the store inside its index pass.
      await until(() => commits() === before + 1 && /A framed panel\./.test(copy(NOTE_COPY) ?? ''), 'the replace did not commit and render');
      const marked = fs.readFileSync(files.copiesOutdated, 'utf8');
      later = spawnEngine(['ledger', 'find', NOTE], { text: 'Panels float above every Space.', how: 'a spike' }, () => ({ copy: copy(NOTE_COPY), indexed: indexedText() }));
      await until(() => commits() === before + 2 && fs.readFileSync(files.copiesOutdated, 'utf8') !== marked, 'the finding did not commit and mark the copies');

      assert.strictEqual(JSON.parse(fs.readFileSync(files.copies, 'utf8')).pid, holder.pid, 'the holder let the claim go before its index pass');
      assert.doesNotMatch(/** @type {string} */ (copy(NOTE_COPY)), /Finding/, 'the later write rendered while another held the claim');
    } finally {
      fs.rmSync(files.lock, { force: true });
    }
    const [held, landed] = await Promise.all([holder.done, /** @type {NonNullable<typeof later>} */ (later).done]);
    assert.deepStrictEqual([held.code, landed.code], [0, 0]);

    // What the later writer's own session would read the moment it returned.
    const seen = /** @type {{copy: string, indexed: string}} */ (landed.seen);
    assert.match(seen.copy, /^## Finding: Panels float above every Space\.$/m);
    assert.match(seen.indexed, /Panels float above every Space\./);
    assert.ok(!fs.existsSync(files.copies), 'the holder kept the claim');
    const text = /** @type {string} */ (copy(NOTE_COPY));
    assert.match(text, /^A framed panel\.$/m);
    assert.match(text, /^## Finding: Panels float above every Space\.$/m);
    const indexed = indexedText();
    assert.match(indexed, /A framed panel\./);
    assert.match(indexed, /Panels float above every Space\./);
    assert.doesNotMatch(indexed, /floating/i);
  });

  it('renders again once it lets the claim go, where a write marked the copies as it did', () => {
    const files = knowledgeFiles(statePath(dir));
    let renders = 0;
    seams.claimed = (release) => {
      renders += 1;
      if (renders > 1) return release;
      return () => {
        const [time, pid] = fs.readFileSync(files.copiesOutdated, 'utf8').split('.');
        fs.writeFileSync(files.copiesOutdated, `${(BigInt(time) + 1n).toString().padStart(time.length, '0')}.${pid}`);
        release();
      };
    };
    ask(NOTE, 'Is a note a window?');
    assert.strictEqual(renders, 2);
  });

  it('follows a change to what is live that undoes another while its render is part way through: the copies end as the last change left them (5.8.17)', async () => {
    ask(NOTE, 'Is a note a window?');
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    const files = knowledgeFiles(statePath(dir));
    /** @type {ReturnType<typeof spawnEngine>|null} */
    let undoing = null;
    seams.folded = () => {
      seams.folded = null;
      const marked = fs.readFileSync(files.copiesOutdated, 'utf8');
      undoing = spawnEngine(['topic', 'cancel', UNIT, 'discovery', 'note-window'], null);
      holdUntil(() => fs.readFileSync(files.copiesOutdated, 'utf8') !== marked);
    };

    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.strictEqual((await /** @type {NonNullable<typeof undoing>} */ (undoing).done).code, 0);

    assert.strictEqual(copy(NOTE_COPY), null);
    assert.deepStrictEqual(indexedFiles(dir), []);
  });

  it('leaves no write behind where its render fails part way: the claim comes free, and the writer it held back renders its own write (22.6.15)', async () => {
    const question = ask(NOTE, 'Is a note a window?');
    const files = knowledgeFiles(statePath(dir));
    /** @type {ReturnType<typeof spawnEngine<string|null>>|null} */
    let waiting = null;
    seams.folded = () => {
      seams.folded = null;
      const marked = fs.readFileSync(files.copiesOutdated, 'utf8');
      waiting = spawnEngine(['ledger', 'find', NOTE], { text: 'Panels float above every Space.', how: 'a spike' }, () => copy(NOTE_COPY));
      holdUntil(() => fs.readFileSync(files.copiesOutdated, 'utf8') !== marked);
      throw new Error('the render broke');
    };

    const decided = write('decide', NOTE, ['--answers', question], { ...MADE, text: 'A floating panel.', why: 'It follows the person.' });
    assert.match(decided.warnings.join('\n'), /^knowledge record render failed: the render broke/m);
    const found = await /** @type {NonNullable<typeof waiting>} */ (waiting).done;

    assert.strictEqual(found.code, 0);
    assert.match(/** @type {string} */ (found.seen), /^## Finding: Panels float above every Space\.$/m);
    assert.match(/** @type {string} */ (found.seen), /^A floating panel\.$/m);
    assert.match(indexedText(), /Panels float above every Space\./);
  });

  it('takes the claim over from a holder killed part way, once its process is gone: the writer waiting on it renders its own write', async () => {
    const { decision } = floatingPanel();
    const files = knowledgeFiles(statePath(dir));
    fs.writeFileSync(files.lock, String(process.pid));
    const before = commits();
    const holder = spawnReaped(['ledger', 'replace', NOTE, '--replaces', decision, '--reason', 'changed-mind'], { text: 'A framed panel.', why: 'Frames read as furniture.', drops: ['the old one'] });
    try {
      // The barrier: the holder has rendered its write and waits on the store inside its index pass.
      await until(() => commits() === before + 1 && /A framed panel\./.test(copy(NOTE_COPY) ?? '') && holder.pid() !== null, 'the replace did not commit and render');
      // The holder is killed while the write below waits on it — a second into a wait bounded at ten.
      const killer = spawn('sh', ['-c', 'sleep 1; kill -9 "$0"; rm -f "$1"', String(holder.pid()), files.lock], { stdio: 'ignore' });
      const found = write('find', NOTE, [], { ...MADE, text: 'Panels float above every Space.', how: 'a spike' });
      await new Promise((resolve) => killer.on('close', resolve));

      assert.deepStrictEqual(found.warnings ?? [], []);
      const text = /** @type {string} */ (copy(NOTE_COPY));
      assert.match(text, /^A framed panel\.$/m);
      assert.match(text, /^## Finding: Panels float above every Space\.$/m);
      assert.match(indexedText(), /Panels float above every Space\./);
      assert.doesNotMatch(indexedText(), /floating/i);
    } finally {
      fs.rmSync(files.lock, { force: true });
      await holder.done;
    }
  });

  it('takes over the claim from a render whose process is gone', () => {
    const files = knowledgeFiles(statePath(dir));
    fs.writeFileSync(files.copies, JSON.stringify({ pid: 2 ** 22 + 1, pid_start: 'long gone' }));
    floatingPanel();
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /^A floating panel\.$/m);
    assert.ok(!fs.existsSync(files.copies));
  });

  it('keeps each entry inside its own section, whatever its text holds: a line that would open a heading or a fence reads as text', () => {
    const question = ask(NOTE, 'Is a note a window?');
    decide(NOTE, question, 'A panel.\n## Not a heading\n```', [], { why: 'It floats.\r# Nor this', rules_out: ['a window\n  ### nor this', 'a sheet\r\n\f\u00a0~~~'] });
    write('find', NOTE, [], { ...MADE, text: 'Panels float.\n~~~', how: 'a spike\n\v## still the finding' });

    const text = /** @type {string} */ (copy(NOTE_COPY));
    // Lines as the chunker breaks them, and its own matches for a heading and a fence.
    const opening = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((line) => /^(#{1,6})\s+(.*)$/.test(line) || /^\s*(```+|~~~+)/.test(line));
    assert.deepStrictEqual(opening, ['# fumi / note-window', '## Is a note a window?', '## Finding: Panels float. ~~~']);
    assert.match(text, /^\\## Not a heading\n\\```$/m);
    assert.match(text, /^Why: It floats\.\n\\# Nor this$/m);
    assert.match(text, /^- a window\n {2}\\### nor this$/m);
    assert.match(text, /^- a sheet\n\f\u00a0\\~~~$/m);
    assert.match(text, /^\\~~~$/m);
    assert.match(text, /^\v\\## still the finding$/m);
  });

  it('heads a decision whose question is set aside with its own words, so no words of an entry that is not current reach a copy, the product record\'s file or a search (5.8.17)', async () => {
    const question = ask(NOTE, 'Is a note a zebrawindow?');
    decide(`${UNIT}.specification`, question, 'Notes float as panels.', [], { product_wide: true });

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);

    const own = /** @type {string} */ (copy('.knowledge/records/fumi.md'));
    assert.match(own, /^## Notes float as panels\.\n\nNotes float as panels\.$/m);
    assert.doesNotMatch(own, /zebrawindow/);
    assert.doesNotMatch(/** @type {string} */ (copy('.knowledge/product.md')), /zebrawindow/);
    assert.match(/** @type {string} */ (copy('.knowledge/product.md')), /^## Notes float as panels\.$/m);
    assert.match(await callAsync(dir, ['knowledge', 'query', 'zebrawindow']).then((r) => r.stdout), /\[0 results\]/);
  });

  it('removes a temporary file a render killed before its rename left behind, and a mark\'s once it is older than any live writer\'s', () => {
    floatingPanel();
    const left = [statePath(dir, '.knowledge/records/fumi/.note-window.md.99999.tmp'), statePath(dir, '.knowledge/.product.md.99999.tmp')];
    for (const file of left) fs.writeFileSync(file, 'half a copy');
    const marks = ['.copies-outdated', '.copies-rendered', '.copies-live.json'].map((name) => statePath(dir, `.knowledge/.${name}.99999.tmp`));
    for (const file of marks) fs.writeFileSync(file, 'half a mark');
    const writing = statePath(dir, '.knowledge/..copies-outdated.99998.tmp');
    fs.writeFileSync(writing, 'a writer\'s, being written');
    for (const file of marks) fs.utimesSync(file, new Date(Date.now() - 120000), new Date(Date.now() - 120000));
    left.push(...marks);

    ask(SPACE, 'Does a note open on the active Space?');

    assert.deepStrictEqual(left.filter((file) => fs.existsSync(file)), []);
    assert.ok(fs.existsSync(writing), 'a mark a live writer may be renaming was swept');
  });

  it('gives a unit\'s own level a record of its own, apart from a topic named as the unit is (5.2.3)', () => {
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    ask('mint.discussion.mint', 'Does Mint float its notes?');
    ask('mint.specification', 'Does the spec cover a second display?');

    assert.match(/** @type {string} */ (copy('.knowledge/records/mint.md')), /^# mint, at the unit's level\n\n## Does the spec cover a second display\?\n\nAsked by Claude\. Entry \w+\.\n\nNot decided yet\.\n$/);
    assert.match(/** @type {string} */ (copy('.knowledge/records/mint/mint.md')), /^# mint \/ mint\n\n## Does Mint float its notes\?\n/);
    assert.deepStrictEqual(identities(), ['mint/record/.unit', 'mint/record/mint']);
  });
});

describe('the product record\'s file (5.8.13, 8.9.13, 22.6.12)', () => {
  it('is rewritten to show the current product-wide entries whenever one changes, and is never indexed (5.S21, 8.S26, 22.S24)', async () => {
    const finding = write('find', NOTE, [], { ...MADE, text: 'Notes are furniture.', how: 'the person said so', product_wide: true }).id;
    assert.match(/** @type {string} */ (copy('.knowledge/product.md')), /^## Finding: Notes are furniture\.\n\nNotes are furniture\.\n\nHow it is known: the person said so\n\nFound by Claude, product-wide, in fumi \/ note-window\. Entry \w+\.$/m);

    change(NOTE, finding, { text: 'Notes are tools.', how: 'a later spike' });

    const product = /** @type {string} */ (copy('.knowledge/product.md'));
    assert.match(product, /^# The product record\n/);
    assert.match(product, /^## Finding: Notes are tools\.$/m);
    assert.doesNotMatch(product, /furniture/);
    assert.deepStrictEqual(indexedFiles(dir), [NOTE_COPY]);
    assert.match(await callAsync(dir, ['knowledge', 'query', 'tools']).then((r) => r.stdout), /\[1 results\][\s\S]*\[record \| fumi\/note-window /);
    assert.strictEqual(stateGit(dir, ['status', '--porcelain', '--', '.knowledge']), '');
  });
});

describe('a place set aside (5.8.17)', () => {
  it('loses its copy and its chunks while its topic is cancelled, and another unit\'s records follow a unit\'s cancel and reactivate, all back once reactivated (5.S32)', async () => {
    const { decision } = floatingPanel();

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    assert.strictEqual(copy(NOTE_COPY), null);
    assert.deepStrictEqual(indexedFiles(dir), []);
    assert.match(await byArea('floating'), /\[0 results\]/);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A floating panel\./);
    assert.deepStrictEqual(indexedFiles(dir), [NOTE_COPY]);

    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    change('mint.discussion.mint', decision, { text: 'A framed panel.', why: 'Mint frames its notes.' });
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A framed panel\./);
    ok(dir, ['workunit', 'cancel', 'mint']);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A floating panel\./);
    assert.match(await byArea('floating'), /\[record \| fumi\/note-window /);
    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A framed panel\./);
    assert.match(await byArea('floating'), /\[0 results\]/);
  });

  it('follows every change to what is live, however it is made: a feature absorbed into an epic, and a topic set aside by a field write', async () => {
    const { decision } = floatingPanel();
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    change('mint.discussion.mint', decision, { text: 'A framed panel.', why: 'Mint frames its notes.' });
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A framed panel\./);
    fs.mkdirSync(statePath(dir, 'mint/discussion'));
    fs.writeFileSync(statePath(dir, 'mint/discussion/mint.md'), '# Mint\n');

    ok(dir, ['workunit', 'absorb', 'mint', '--into', UNIT, '--topic', 'mint-notes']);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A floating panel\./);
    assert.match(await byArea('framed'), /\[0 results\]/);

    ok(dir, ['manifest', 'set', `${UNIT}.discovery.note-window`, 'cancelled', 'true']);
    assert.strictEqual(copy(NOTE_COPY), null);
    assert.match(await byArea('floating'), /\[0 results\]/);
  });

  it('loses a unit\'s copies while it is cancelled, and has them back when it is completed from there', () => {
    const finished = { items: { mint: { status: 'completed' } } };
    createManifest(dir, 'mint', {
      work_type: 'feature',
      phases: { discussion: finished, specification: finished, planning: finished, implementation: finished, review: finished },
    });
    ask('mint.discussion.mint', 'Does Mint float its notes?');

    ok(dir, ['workunit', 'cancel', 'mint']);
    assert.strictEqual(copy('.knowledge/records/mint/mint.md'), null);
    assert.deepStrictEqual(indexedFiles(dir), []);
    ok(dir, ['workunit', 'complete', 'mint', '-m', 'workflow(mint): complete']);
    assert.match(/** @type {string} */ (copy('.knowledge/records/mint/mint.md')), /^## Does Mint float its notes\?$/m);
    assert.deepStrictEqual(indexedFiles(dir), ['.knowledge/records/mint/mint.md']);
  });

  it('loses its copy while its topic is postponed, and has it back once pulled back into its own epic (5.S32)', async () => {
    floatingPanel();

    ok(dir, ['topic', 'postpone', UNIT, 'note-window', '--horizon', 'later']);
    assert.strictEqual(copy(NOTE_COPY), null);
    assert.match(await byArea('floating'), /\[0 results\]/);

    ok(dir, ['roadmap', 'pull-forward', 'note-window', '--into', UNIT]);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A floating panel\./);
    assert.match(await byArea('floating'), /\[record \| fumi\/note-window /);
  });
});

describe('boot (22.6.14, 22.6.15)', () => {
  it('renders each copy that is missing or stale against the ledger, removes one no record holds, and indexes them (22.S19)', () => {
    floatingPanel();
    decide(SPACE, ask(SPACE, 'Does a note open on the active Space?'), 'Yes.');
    fs.rmSync(statePath(dir, NOTE_COPY));
    fs.writeFileSync(statePath(dir, SPACE_COPY), '# stale\n');
    fs.writeFileSync(statePath(dir, '.knowledge/records/fumi/gone.md'), '# gone\n');
    fs.rmSync(statePath(dir, '.knowledge/product.md'));

    ok(dir, ['boot']);

    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A floating panel\./);
    assert.match(/** @type {string} */ (copy(SPACE_COPY)), /^## Does a note open on the active Space\?\n\nAsked by Claude\. Entry \w+\.\n\nYes\./m);
    assert.strictEqual(copy('.knowledge/records/fumi/gone.md'), null);
    assert.match(/** @type {string} */ (copy('.knowledge/product.md')), /Nothing is marked product-wide yet\./);
    assert.deepStrictEqual(indexedFiles(dir), [NOTE_COPY, SPACE_COPY]);
  });

  it('makes good an index that failed after an entry changed: the entry stands, the write warns, and the next start indexes the record into the store it failed on (22.S36)', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const { store: storeFile } = knowledgeFiles(statePath(dir));
    const working = fs.readFileSync(storeFile);
    fs.writeFileSync(storeFile, 'not a store');
    const decided = write('decide', NOTE, ['--answers', question], { ...MADE, text: 'A floating panel.', why: 'It follows the person.' });

    assert.match(decided.warnings.join('\n'), /^knowledge index \(\.knowledge\/records\/fumi\/note-window\.md\) failed: /m);
    assert.ok(!fs.existsSync(knowledgeFiles(statePath(dir)).copies), 'a failed index kept the render\'s claim');
    assert.strictEqual(stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim(), LEDGER);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A floating panel\./);

    fs.writeFileSync(storeFile, working);
    assert.ok(!indexedText().includes('A floating panel.'), 'the store held the decision before the start');
    ok(dir, ['boot']);
    assert.ok(indexedText().includes('A floating panel.'), 'the start did not index the record the write failed to');
  });

  it('makes good a render that failed after an entry changed: the entry stands, the write warns, and the next start renders and indexes the record (22.S36)', () => {
    fs.writeFileSync(statePath(dir, '.knowledge/records'), 'in the way\n');
    const asked = write('ask', NOTE, [], { ...MADE, text: 'Is a note a window?' });

    assert.match(asked.warnings.join('\n'), /^knowledge record render failed: .* — the next start renders it again$/m);
    assert.strictEqual(stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim(), LEDGER);
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    const reactivated = ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.match(reactivated.warnings.join('\n'), /^knowledge record render failed: /m, 'a lifecycle change does not carry the render\'s failure');

    fs.rmSync(statePath(dir, '.knowledge/records'));
    ok(dir, ['boot']);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /^## Is a note a window\?$/m);
    assert.deepStrictEqual(indexedFiles(dir), [NOTE_COPY]);
  });
});

describe('a command run under the writer lock', () => {
  it('renders nothing where it leaves what is live as it was, and renders where it moves it', () => {
    ask(NOTE, 'Is a note a window?');
    fs.rmSync(statePath(dir, NOTE_COPY));

    ok(dir, ['manifest', 'set', `${UNIT}.discovery.note-window`, 'summary', 'The note window, floating']);
    assert.strictEqual(copy(NOTE_COPY), null, 'a command that moved nothing live rendered the copies');

    ok(dir, ['manifest', 'set', `${UNIT}.discovery.space-homing`, 'cancelled', 'true']);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /^## Is a note a window\?$/m);
  });
});

describe('a command that fails', () => {
  it('carries a render\'s failure on its refusal, where it changed what is live before it failed (22.6.15)', () => {
    ask(NOTE, 'Is a note a window?');
    ok(dir, ['manifest', 'set', 'fumi.discovery.note-window', 'cancelled', 'true']);
    fs.rmSync(statePath(dir, '.knowledge/records'), { recursive: true });
    fs.writeFileSync(statePath(dir, '.knowledge/records'), 'in the way\n');
    /** @type {{out: string[], err: string[]}} */
    const said = { out: [], err: [] };
    const call = { cwd: dir, out: (/** @type {string} */ text) => said.out.push(text), err: (/** @type {string} */ text) => said.err.push(text), stdin: () => '' };

    assert.throws(() => followingLiveness(call, statePath(dir), (held) => {
      const manifest = readWorkUnitManifest(statePath(dir), UNIT);
      delete manifest.phases.discovery.items['note-window'].cancelled;
      writeWorkUnitManifestAtomic(statePath(dir), UNIT, manifest);
      held.err(`${JSON.stringify({ ok: false, error: 'the commit failed' })}\n`);
      throw new ExitSignal(1);
    }), ExitSignal);

    assert.deepStrictEqual(said.out, []);
    const refusal = JSON.parse(said.err.join(''));
    assert.strictEqual(refusal.error, 'the commit failed');
    assert.match(refusal.warnings.join('\n'), /^knowledge record render failed: /m);
  });
});

describe('the knowledge base\'s reach (22.6.1)', () => {
  it('finds one unit\'s records from a session in another (22.S20)', async () => {
    floatingPanel();
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    ask('mint.discussion.mint', 'Does Mint float its notes?');

    const found = await callAsync(dir, ['knowledge', 'query', 'float', 'floating', '--phase', 'record'], { env: SESSION });
    assert.match(found.stdout, /\[record \| fumi\/note-window /);
    assert.match(found.stdout, /\[record \| mint\/mint /);
  });
});

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

const { ok, callAsync, keywordOnlyKnowledge, unreadableKnowledge, indexedFiles, statePath, stateGit, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const store = require(path.join(SCRIPTS, 'kernel/knowledge/store.cjs'));
const { knowledgeFiles } = require(path.join(SCRIPTS, 'kernel/knowledge/files.cjs'));
const { LEDGER } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));

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
  return write('decide', address, ['--answers', question, ...flags], { ...MADE, text, why: `Why: ${text}`, ...content }).id;
}

/** `old` replaced at `address`, a changed mind: the response. @param {string} address @param {string} old @param {Record<string, unknown>} content */
function change(address, old, content) {
  return write('replace', address, ['--replaces', old, '--reason', 'changed-mind'], { ...MADE, drops: ['the old one'], ...content });
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
      'Why: Why: A floating panel.',
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
    const before = { note: copy(NOTE_COPY), space: copy(SPACE_COPY) };

    ok(dir, ['boot']);

    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A floating panel\./);
    assert.match(/** @type {string} */ (copy(SPACE_COPY)), /^## Does a note open on the active Space\?\n\nAsked by Claude\. Entry \w+\.\n\nYes\./m);
    assert.notDeepStrictEqual({ note: copy(NOTE_COPY), space: copy(SPACE_COPY) }, before);
    assert.strictEqual(copy('.knowledge/records/fumi/gone.md'), null);
    assert.match(/** @type {string} */ (copy('.knowledge/product.md')), /Nothing is marked product-wide yet\./);
    assert.deepStrictEqual(indexedFiles(dir), [NOTE_COPY, SPACE_COPY]);
  });

  it('makes good an index that failed after an entry changed: the entry stands, the write warns, and the next start indexes the record (22.S36)', () => {
    unreadableKnowledge(dir);
    const question = ask(NOTE, 'Is a note a window?');
    const decided = write('decide', NOTE, ['--answers', question], { ...MADE, text: 'A floating panel.', why: 'It follows the person.' });

    assert.match(decided.warnings.join('\n'), /^knowledge index \(\.knowledge\/records\/fumi\/note-window\.md\) failed: /m);
    assert.strictEqual(stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim(), LEDGER);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A floating panel\./);

    const files = knowledgeFiles(statePath(dir));
    fs.rmSync(files.store);
    fs.rmSync(files.metadata);
    ok(dir, ['boot']);
    assert.deepStrictEqual(indexedFiles(dir), [NOTE_COPY]);
  });

  it('makes good a render that failed after an entry changed: the entry stands, the write warns, and the next start renders and indexes the record (22.S36)', () => {
    fs.writeFileSync(statePath(dir, '.knowledge/records'), 'in the way\n');
    const asked = write('ask', NOTE, [], { ...MADE, text: 'Is a note a window?' });

    assert.match(asked.warnings.join('\n'), /^knowledge record render failed: .* — the next start renders it again$/m);
    assert.strictEqual(stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim(), LEDGER);

    fs.rmSync(statePath(dir, '.knowledge/records'));
    ok(dir, ['boot']);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /^## Is a note a window\?$/m);
    assert.deepStrictEqual(indexedFiles(dir), [NOTE_COPY]);
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

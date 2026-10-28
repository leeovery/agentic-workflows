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
// postponed place loses its copy until it is back.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, its knowledge set up keyword-only; the unit's manifest written
// there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
// The seams go in before the engine loads, so the copies' render binds them.
const { seams, clearSeams } = require('./ledger-copies-seams.cjs');
const { UNIT, SESSION, MADE, NOTE, SPACE, NOTE_COPY, SPACE_COPY, copiesHelpers, useCopiesWorld } = require('./ledger-world.cjs');
const { ok, callAsync, indexedFiles, statePath, stateGit } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const store = require(path.join(SCRIPTS, 'kernel/knowledge/store.cjs'));
const { knowledgeFiles } = require(path.join(SCRIPTS, 'kernel/knowledge/files.cjs'));
const { LEDGER } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));

const MINT_COPY = '.knowledge/records/mint/mint.md';

const dir = useCopiesWorld();
afterEach(clearSeams);

const { write, ask, decide, copy, floatingPanel } = copiesHelpers(dir);

/** `old` replaced at `address`, a changed mind: the response. @param {string} address @param {string} old @param {Record<string, unknown>} content */
function change(address, old, content) {
  return write('replace', address, ['--replaces', old, '--reason', 'changed-mind'], { ...MADE, drops: ['the old one'], ...content });
}

/** The identities the store holds, `{unit}/{phase}/{topic}`, sorted. */
function identities() {
  const file = knowledgeFiles(statePath(dir())).store;
  return [...new Set(store.allChunks(store.loadStore(file)).map((c) => `${c.work_unit}/${c.phase}/${c.topic}`))].sort();
}

/** A read by area: the knowledge base searched over the records alone. @param {string[]} terms */
async function byArea(...terms) {
  const res = await callAsync(dir(), ['knowledge', 'query', ...terms, '--phase', 'record']);
  assert.strictEqual(res.code, 0, res.stderr);
  return res.stdout;
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
    assert.deepStrictEqual(indexedFiles(dir()), [NOTE_COPY]);
    assert.strictEqual(stateGit(dir(), ['status', '--porcelain', '--', '.knowledge', '.cache']), '');
    assert.strictEqual(stateGit(dir(), ['ls-tree', '-r', '--name-only', 'HEAD', '--', '.knowledge', '.cache']), '');
    assert.deepStrictEqual(fs.readdirSync(statePath(dir(), UNIT)), ['manifest.json'], 'a record file sits in the unit\'s tree');
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
    assert.deepStrictEqual(indexedFiles(dir()), [NOTE_COPY]);
    assert.ok(fs.existsSync(statePath(dir(), LEDGER)));
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

  it('renders again once it lets the claim go, where a write marked the copies as it did', () => {
    const files = knowledgeFiles(statePath(dir()));
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

  it('takes over the claim from a render whose process is gone', () => {
    const files = knowledgeFiles(statePath(dir()));
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

    ok(dir(), ['topic', 'cancel', UNIT, 'discovery', 'note-window']);

    const own = /** @type {string} */ (copy('.knowledge/records/fumi.md'));
    assert.match(own, /^## Notes float as panels\.\n\nNotes float as panels\.$/m);
    assert.doesNotMatch(own, /zebrawindow/);
    assert.doesNotMatch(/** @type {string} */ (copy('.knowledge/product.md')), /zebrawindow/);
    assert.match(/** @type {string} */ (copy('.knowledge/product.md')), /^## Notes float as panels\.$/m);
    assert.match(await callAsync(dir(), ['knowledge', 'query', 'zebrawindow']).then((r) => r.stdout), /\[0 results\]/);
  });

  it('removes a temporary file a render killed before its rename left behind, and a mark\'s once it is older than any live writer\'s', () => {
    floatingPanel();
    const left = [statePath(dir(), '.knowledge/records/fumi/.note-window.md.99999.tmp'), statePath(dir(), '.knowledge/.product.md.99999.tmp')];
    for (const file of left) fs.writeFileSync(file, 'half a copy');
    const marks = ['.copies-outdated', '.copies-rendered', '.copies-live.json'].map((name) => statePath(dir(), `.knowledge/.${name}.99999.tmp`));
    for (const file of marks) fs.writeFileSync(file, 'half a mark');
    const writing = statePath(dir(), '.knowledge/..copies-outdated.99998.tmp');
    fs.writeFileSync(writing, 'a writer\'s, being written');
    for (const file of marks) fs.utimesSync(file, new Date(Date.now() - 120000), new Date(Date.now() - 120000));
    left.push(...marks);

    ask(SPACE, 'Does a note open on the active Space?');

    assert.deepStrictEqual(left.filter((file) => fs.existsSync(file)), []);
    assert.ok(fs.existsSync(writing), 'a mark a live writer may be renaming was swept');
  });

  it('gives a unit\'s own level a record of its own, apart from a topic named as the unit is (5.2.3)', () => {
    createManifest(dir(), 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    ask('mint.discussion.mint', 'Does Mint float its notes?');
    ask('mint.specification', 'Does the spec cover a second display?');

    assert.match(/** @type {string} */ (copy('.knowledge/records/mint.md')), /^# mint, at the unit's level\n\n## Does the spec cover a second display\?\n\nAsked by Claude\. Entry \w+\.\n\nNot decided yet\.\n$/);
    assert.match(/** @type {string} */ (copy(MINT_COPY)), /^# mint \/ mint\n\n## Does Mint float its notes\?\n/);
    assert.deepStrictEqual(identities(), ['mint/record/.unit', 'mint/record/mint']);
  });

  it('heads a decision answering a question elsewhere with the question in the wording that stands, though the wording it names is set aside (5.3.13, 5.8.17)', () => {
    createManifest(dir(), 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    const question = ask(NOTE, 'Does a note open on the active Space?');
    const reworded = write('replace', 'mint.discussion.mint', ['--replaces', question, '--reason', 'changed-mind'], { ...MADE, drops: ['active'], text: 'Does a Mint note open on the active Space?' }).id;
    decide(`${UNIT}.specification`, reworded, 'It opens where the person is.');

    ok(dir(), ['workunit', 'cancel', 'mint']);

    assert.match(/** @type {string} */ (copy('.knowledge/records/fumi.md')), /^## Does a note open on the active Space\?\n\nIt opens where the person is\.$/m);
  });

  it('shows another unit\'s replacement of an answer in both places: the current answer where the answer stands, and in the record of the topic it was made on, from there (5.8.19)', () => {
    const { decision } = floatingPanel();
    createManifest(dir(), 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });

    const framed = change('mint.discussion.mint', decision, { text: 'A framed panel.', why: 'Mint frames its notes.' }).id;

    assert.match(/** @type {string} */ (copy(NOTE_COPY)), new RegExp(`^A framed panel\\.\\n\\nWhy: Mint frames its notes\\.\\n\\nDecided by Claude\\. Entry ${framed}\\.$`, 'm'));
    assert.strictEqual(copy(MINT_COPY), [
      '# mint / mint',
      '',
      '## From fumi / note-window: A framed panel.',
      '',
      'A framed panel.',
      '',
      'Why: Mint frames its notes.',
      '',
      `Decided by Claude, in fumi / note-window. Entry ${framed}.`,
      '',
    ].join('\n'));
    assert.deepStrictEqual(indexedFiles(dir()), [NOTE_COPY, MINT_COPY]);
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
    assert.deepStrictEqual(indexedFiles(dir()), [NOTE_COPY]);
    assert.match(await callAsync(dir(), ['knowledge', 'query', 'tools']).then((r) => r.stdout), /\[1 results\][\s\S]*\[record \| fumi\/note-window /);
    assert.strictEqual(stateGit(dir(), ['status', '--porcelain', '--', '.knowledge']), '');
  });
});

describe('a place set aside (5.8.17)', () => {
  it('loses its copy and its chunks while its topic is cancelled, and another unit\'s records follow a unit\'s cancel and reactivate, all back once reactivated (5.S32)', async () => {
    const { decision } = floatingPanel();

    ok(dir(), ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    assert.strictEqual(copy(NOTE_COPY), null);
    assert.deepStrictEqual(indexedFiles(dir()), []);
    assert.match(await byArea('floating'), /\[0 results\]/);
    ok(dir(), ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A floating panel\./);
    assert.deepStrictEqual(indexedFiles(dir()), [NOTE_COPY]);

    createManifest(dir(), 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    change('mint.discussion.mint', decision, { text: 'A framed panel.', why: 'Mint frames its notes.' });
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A framed panel\./);
    ok(dir(), ['workunit', 'cancel', 'mint']);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A floating panel\./);
    assert.match(await byArea('floating'), /\[record \| fumi\/note-window /);
    ok(dir(), ['workunit', 'reactivate', 'mint']);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A framed panel\./);
    assert.match(await byArea('floating'), /\[0 results\]/);
  });

  it('follows every change to what is live, however it is made: a feature absorbed into an epic, and a topic set aside by a field write', async () => {
    const { decision } = floatingPanel();
    createManifest(dir(), 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    change('mint.discussion.mint', decision, { text: 'A framed panel.', why: 'Mint frames its notes.' });
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A framed panel\./);
    fs.mkdirSync(statePath(dir(), 'mint/discussion'));
    fs.writeFileSync(statePath(dir(), 'mint/discussion/mint.md'), '# Mint\n');

    ok(dir(), ['workunit', 'absorb', 'mint', '--into', UNIT, '--topic', 'mint-notes']);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A floating panel\./);
    assert.match(await byArea('framed'), /\[0 results\]/);

    ok(dir(), ['manifest', 'set', `${UNIT}.discovery.note-window`, 'cancelled', 'true']);
    assert.strictEqual(copy(NOTE_COPY), null);
    assert.match(await byArea('floating'), /\[0 results\]/);
  });

  it('loses a unit\'s copies while it is cancelled, and has them back when it is completed from there', () => {
    const finished = { items: { mint: { status: 'completed' } } };
    createManifest(dir(), 'mint', {
      work_type: 'feature',
      phases: { discussion: finished, specification: finished, planning: finished, implementation: finished, review: finished },
    });
    ask('mint.discussion.mint', 'Does Mint float its notes?');

    ok(dir(), ['workunit', 'cancel', 'mint']);
    assert.strictEqual(copy(MINT_COPY), null);
    assert.deepStrictEqual(indexedFiles(dir()), []);
    ok(dir(), ['workunit', 'complete', 'mint', '-m', 'workflow(mint): complete']);
    assert.match(/** @type {string} */ (copy(MINT_COPY)), /^## Does Mint float its notes\?$/m);
    assert.deepStrictEqual(indexedFiles(dir()), [MINT_COPY]);
  });

  it('loses its copy while its topic is postponed, and has it back once pulled back into its own epic (5.S32)', async () => {
    floatingPanel();

    ok(dir(), ['topic', 'postpone', UNIT, 'note-window', '--horizon', 'later']);
    assert.strictEqual(copy(NOTE_COPY), null);
    assert.match(await byArea('floating'), /\[0 results\]/);

    ok(dir(), ['roadmap', 'pull-forward', 'note-window', '--into', UNIT]);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A floating panel\./);
    assert.match(await byArea('floating'), /\[record \| fumi\/note-window /);
  });
});

describe('a command run under the writer lock', () => {
  it('renders nothing where it leaves what is live as it was, and renders where it moves it', () => {
    ask(NOTE, 'Is a note a window?');
    fs.rmSync(statePath(dir(), NOTE_COPY));

    ok(dir(), ['manifest', 'set', `${UNIT}.discovery.note-window`, 'summary', 'The note window, floating']);
    assert.strictEqual(copy(NOTE_COPY), null, 'a command that moved nothing live rendered the copies');

    ok(dir(), ['manifest', 'set', `${UNIT}.discovery.space-homing`, 'cancelled', 'true']);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /^## Is a note a window\?$/m);
  });
});

describe('the knowledge base\'s reach (22.6.1)', () => {
  it('finds one unit\'s records from a session in another (22.S20)', async () => {
    floatingPanel();
    createManifest(dir(), 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    ask('mint.discussion.mint', 'Does Mint float its notes?');

    const found = await callAsync(dir(), ['knowledge', 'query', 'float', 'floating', '--phase', 'record'], { env: SESSION });
    assert.match(found.stdout, /\[record \| fumi\/note-window /);
    assert.match(found.stdout, /\[record \| mint\/mint /);
  });
});

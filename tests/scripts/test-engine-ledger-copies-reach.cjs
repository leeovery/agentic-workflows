'use strict';

// ---------------------------------------------------------------------------
// What the knowledge base reaches of the ledger's copies
// (leeway-engine/scripts/domain/ledger-copies.cjs; 5.8.13, 22.6.1, 22.6.12):
// the product record's file rewritten whenever a product-wide entry changes,
// and never indexed; a topic's record indexed and never its log; answers from
// the records alone — never a seed, an asset, an inbox item or the product
// record's file — an asset reached through the entry that links it; and one
// unit's records found from a session in another.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, its knowledge set up keyword-only; the unit's manifest written
// there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { UNIT, SESSION, MADE, NOTE, NOTE_COPY, copiesHelpers, useCopiesWorld } = require('./ledger-world.cjs');
const { ok, callAsync, indexedFiles, statePath, stateGit, layout, writeState, readManifest } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const dir = useCopiesWorld();
const { write, ask, copy, floatingPanel, writtenOn, change } = copiesHelpers(dir);

describe('the product record\'s file (5.8.13, 8.9.13, 22.6.12)', () => {
  it('is rewritten to show the current product-wide entries whenever one changes, and is never indexed (5.S21, 8.S26, 22.S24)', async () => {
    const finding = write('find', NOTE, [], { ...MADE, text: 'Notes are furniture.', how: 'the person said so', known: 'read', product_wide: true }).id;
    assert.ok(/** @type {string} */ (copy('.knowledge/product.md')).includes([
      '## Finding: Notes are furniture.', '', 'Notes are furniture.', '', 'How it is known: read, the person said so', '',
      `Found by Claude on ${writtenOn(finding)}, product-wide, in fumi / note-window. Entry ${finding}.`,
    ].join('\n')));

    change(NOTE, finding, { text: 'Notes are tools.', how: 'a later spike', known: 'spike' });

    const product = /** @type {string} */ (copy('.knowledge/product.md'));
    assert.match(product, /^# The product record\n/);
    assert.match(product, /^## Finding: Notes are tools\.$/m);
    assert.doesNotMatch(product, /furniture/);
    assert.deepStrictEqual(indexedFiles(dir()), [NOTE_COPY]);
    assert.match(await callAsync(dir(), ['knowledge', 'query', 'tools']).then((r) => r.stdout), /\[1 results\][\s\S]*\[record \| fumi\/note-window /);
    assert.strictEqual(stateGit(dir(), ['status', '--porcelain', '--', '.knowledge']), '');
  });
});

describe('the knowledge base\'s reach (22.6.1, 22.6.12)', () => {
  it('indexes a topic\'s record and never its log, at a write and at a full index (9.S43)', async () => {
    const log = statePath(dir(), UNIT, 'topics/note-window/log.md');
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.writeFileSync(log, '# note-window\n\n## Session 1\n\nCorduroy marmalade.\n');
    floatingPanel();
    assert.deepStrictEqual(indexedFiles(dir()), [NOTE_COPY]);

    const full = await callAsync(dir(), ['knowledge', 'index'], { env: SESSION });
    assert.strictEqual(full.code, 0, full.stderr);
    assert.deepStrictEqual(indexedFiles(dir()), [NOTE_COPY]);
    assert.doesNotMatch((await callAsync(dir(), ['knowledge', 'query', 'corduroy', 'marmalade'])).stdout, /Corduroy/);
  });

  it('answers from the records alone — never from a seed, an asset, an inbox item or the product record\'s file — and reaches an asset through the entry that links it (22.S30, 9.S54)', async () => {
    const sketch = layout.assets(UNIT, 'panel-sketch.md');
    writeState(dir(), sketch, '# Panel sketch\n\nQuokka sketch.\n');
    writeState(dir(), layout.seed(UNIT, 'floating-notes'), '# Floating notes\n\nQuokka seed.\n');
    writeState(dir(), layout.manifest(UNIT), JSON.stringify({ ...readManifest(dir(), UNIT), seeds: [{ path: 'seeds/floating-notes.md', source: 'inbox:idea' }] }, null, 2) + '\n');
    writeState(dir(), layout.inbox('ideas', '2026-01-06--quokka.md'), '# Quokka\n\nQuokka idea.\n');
    write('find', NOTE, [], { ...MADE, text: 'Quokka notes float.', how: 'the person said so', known: 'read', product_wide: true });
    const { decision } = floatingPanel();
    ok(dir(), ['asset', 'add', UNIT, sketch, '--entry', decision, '--status', 'reference'], { env: SESSION });
    const full = await callAsync(dir(), ['knowledge', 'index'], { env: SESSION });
    assert.strictEqual(full.code, 0, full.stderr);

    /** The files a query's results came from, state-relative. @param {string[]} terms */
    const sources = async (...terms) => {
      const { stdout } = await callAsync(dir(), ['knowledge', 'query', ...terms]);
      return { stdout, files: [...stdout.matchAll(/^Source: (.+?)(?::L[\d-]+)?$/gm)].map(([, file]) => path.relative(statePath(dir()), file)) };
    };
    assert.match(/** @type {string} */ (copy('.knowledge/product.md')), /Quokka notes float\./);
    assert.deepStrictEqual((await sources('quokka')).files, [NOTE_COPY]);
    const found = await sources('panel sketch');
    assert.deepStrictEqual(found.files, [NOTE_COPY]);
    assert.match(found.stdout, new RegExp(`^- ${sketch}, reference$`, 'm'));
  });

  it('finds one unit\'s records from a session in another (22.S20)', async () => {
    floatingPanel();
    createManifest(dir(), 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    ask('mint.discussion.mint', 'Does Mint float its notes?');

    const found = await callAsync(dir(), ['knowledge', 'query', 'float', 'floating', '--phase', 'record'], { env: SESSION });
    assert.match(found.stdout, /\[record \| fumi\/note-window /);
    assert.match(found.stdout, /\[record \| mint\/mint /);
  });
});

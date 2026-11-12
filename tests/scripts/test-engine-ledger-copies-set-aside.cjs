'use strict';

// ---------------------------------------------------------------------------
// The ledger's rendered copies following what is live
// (leeway-engine/scripts/domain/ledger-copies.cjs, 5.8.17): after a
// lifecycle change that sets a topic or unit aside or brings it back, however
// it is made, the copies are rendered again and indexed — a cancelled or
// postponed place losing its copy and its chunks until it is back, another
// unit's records following a unit's cancel — and a command run under the
// writer lock renders only where it moves what is live.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, its knowledge set up keyword-only; the unit's manifest written
// there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { UNIT, SESSION, NOTE, NOTE_COPY, MINT_COPY, copiesHelpers, useCopiesWorld } = require('./ledger-world.cjs');
const { ok, indexedFiles, statePath, layout, completeUnit } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const dir = useCopiesWorld();
const { ask, copy, floatingPanel, change, byArea } = copiesHelpers(dir);

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

  it('follows every change to what is live, however it is made: a feature absorbed into an epic, its lines then the epic topic\'s, and a topic set aside by a field write', async () => {
    const { decision } = floatingPanel();
    createManifest(dir(), 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    change('mint.discussion.mint', decision, { text: 'A framed panel.', why: 'Mint frames its notes.' });
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A framed panel\./);
    fs.mkdirSync(statePath(dir(), 'mint/topics/mint'), { recursive: true });
    fs.writeFileSync(statePath(dir(), 'mint/topics/mint/log.md'), '# Mint\n');

    ok(dir(), ['workunit', 'absorb', 'mint', '--into', UNIT, '--topic', 'mint-notes', '--summary', 'Mint\'s notes'], { env: SESSION });
    assert.strictEqual(copy(MINT_COPY), null);
    assert.match(/** @type {string} */ (copy(layout.knowledge('records', UNIT, 'mint-notes.md'))), /A framed panel\./);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A framed panel\./);
    assert.match(await byArea('framed'), /\[record \| fumi\/mint-notes /);

    ok(dir(), ['manifest', 'set', `${UNIT}.discovery.note-window`, 'cancelled', 'true']);
    assert.strictEqual(copy(NOTE_COPY), null);
    assert.match(await byArea('floating'), /\[0 results\]/);
  });

  it('loses a unit\'s copies while it is cancelled, and has them back when it is completed from there', () => {
    createManifest(dir(), 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    ask('mint.discussion.mint', 'Does Mint float its notes?');
    const finished = { items: { mint: { status: 'completed' } } };
    createManifest(dir(), 'mint', {
      work_type: 'feature',
      phases: { discussion: finished, specification: finished, planning: finished, implementation: finished, review: finished },
    });

    ok(dir(), ['workunit', 'cancel', 'mint']);
    assert.strictEqual(copy(MINT_COPY), null);
    assert.deepStrictEqual(indexedFiles(dir()), []);
    completeUnit(dir(), 'mint');
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

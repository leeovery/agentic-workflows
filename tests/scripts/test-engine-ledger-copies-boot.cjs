'use strict';

// ---------------------------------------------------------------------------
// The ledger's copies made good (workflow-engine/scripts/domain/ledger-copies.cjs,
// run by `engine boot`): boot renders each copy that is missing or stale
// against the ledger before its knowledge pass, removes one no record holds,
// and indexes them; a render or an index that fails after an entry changed
// leaves the entry standing and warns, and the next start makes it good; a
// command that fails after changing what is live carries the render's
// failure on its refusal.
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

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { UNIT, MADE, NOTE, SPACE, NOTE_COPY, SPACE_COPY, copiesHelpers, useCopiesWorld } = require('./ledger-world.cjs');
const manifestIo = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const { ok, indexedFiles, statePath, stateGit } = require('./engine-harness.cjs');
const { knowledgeFiles } = require(path.join(SCRIPTS, 'kernel/knowledge/files.cjs'));
const { LEDGER } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const { followingLiveness } = require(path.join(SCRIPTS, 'domain/ledger-copies.cjs'));
const { readWorkUnitManifest, writeWorkUnitManifestAtomic } = manifestIo;
const { ExitSignal } = require(path.join(SCRIPTS, 'kernel/call.cjs'));

const dir = useCopiesWorld();

const { write, ask, decide, copy, indexedText, floatingPanel } = copiesHelpers(dir);

describe('boot (22.6.14, 22.6.15)', () => {
  it('renders each copy that is missing or stale against the ledger, removes one no record holds, and indexes them (22.S19)', () => {
    floatingPanel();
    decide(SPACE, ask(SPACE, 'Does a note open on the active Space?'), 'Yes.');
    fs.rmSync(statePath(dir(), NOTE_COPY));
    fs.writeFileSync(statePath(dir(), SPACE_COPY), '# stale\n');
    fs.writeFileSync(statePath(dir(), '.knowledge/records/fumi/gone.md'), '# gone\n');
    fs.rmSync(statePath(dir(), '.knowledge/product.md'));

    ok(dir(), ['boot']);

    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A floating panel\./);
    assert.match(/** @type {string} */ (copy(SPACE_COPY)), /^## Does a note open on the active Space\?\n\nAsked by Claude\. Entry \w+\.\n\nYes\./m);
    assert.strictEqual(copy('.knowledge/records/fumi/gone.md'), null);
    assert.match(/** @type {string} */ (copy('.knowledge/product.md')), /Nothing is marked product-wide yet\./);
    assert.deepStrictEqual(indexedFiles(dir()), [NOTE_COPY, SPACE_COPY]);
  });

  it('makes good an index that failed after an entry changed: the entry stands, the write warns, and the next start indexes the record into the store it failed on (22.S36)', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const { store: storeFile } = knowledgeFiles(statePath(dir()));
    const working = fs.readFileSync(storeFile);
    fs.writeFileSync(storeFile, 'not a store');
    const decided = write('decide', NOTE, ['--answers', question], { ...MADE, text: 'A floating panel.', why: 'It follows the person.' });

    assert.match(decided.warnings.join('\n'), /^knowledge index \(\.knowledge\/records\/fumi\/note-window\.md\) failed: /m);
    assert.ok(!fs.existsSync(knowledgeFiles(statePath(dir())).copies), 'a failed index kept the render\'s claim');
    assert.strictEqual(stateGit(dir(), ['show', '--name-only', '--pretty=format:', 'HEAD']).trim(), LEDGER);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /A floating panel\./);

    fs.writeFileSync(storeFile, working);
    assert.ok(!indexedText().includes('A floating panel.'), 'the store held the decision before the start');
    ok(dir(), ['boot']);
    assert.ok(indexedText().includes('A floating panel.'), 'the start did not index the record the write failed to');
  });

  it('makes good a render that failed after an entry changed: the entry stands, the write warns, and the next start renders and indexes the record (22.S36)', () => {
    fs.writeFileSync(statePath(dir(), '.knowledge/records'), 'in the way\n');
    const asked = write('ask', NOTE, [], { ...MADE, text: 'Is a note a window?' });

    assert.match(asked.warnings.join('\n'), /^knowledge record render failed: .* — the next start renders it again$/m);
    assert.strictEqual(stateGit(dir(), ['show', '--name-only', '--pretty=format:', 'HEAD']).trim(), LEDGER);
    ok(dir(), ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    const reactivated = ok(dir(), ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.match(reactivated.warnings.join('\n'), /^knowledge record render failed: /m, 'a lifecycle change does not carry the render\'s failure');

    fs.rmSync(statePath(dir(), '.knowledge/records'));
    ok(dir(), ['boot']);
    assert.match(/** @type {string} */ (copy(NOTE_COPY)), /^## Is a note a window\?$/m);
    assert.deepStrictEqual(indexedFiles(dir()), [NOTE_COPY]);
  });
});

describe('a command that fails', () => {
  it('carries a render\'s failure on its refusal, where it changed what is live before it failed (22.6.15)', () => {
    ask(NOTE, 'Is a note a window?');
    ok(dir(), ['manifest', 'set', 'fumi.discovery.note-window', 'cancelled', 'true']);
    fs.rmSync(statePath(dir(), '.knowledge/records'), { recursive: true });
    fs.writeFileSync(statePath(dir(), '.knowledge/records'), 'in the way\n');
    /** @type {{out: string[], err: string[]}} */
    const said = { out: [], err: [] };
    const call = { cwd: dir(), out: (/** @type {string} */ text) => said.out.push(text), err: (/** @type {string} */ text) => said.err.push(text), stdin: () => '' };

    assert.throws(() => followingLiveness(call, statePath(dir()), (held) => {
      const manifest = readWorkUnitManifest(statePath(dir()), UNIT);
      delete manifest.phases.discovery.items['note-window'].cancelled;
      writeWorkUnitManifestAtomic(statePath(dir()), UNIT, manifest);
      held.err(`${JSON.stringify({ ok: false, error: 'the commit failed' })}\n`);
      throw new ExitSignal(1);
    }), ExitSignal);

    assert.deepStrictEqual(said.out, []);
    const refusal = JSON.parse(said.err.join(''));
    assert.strictEqual(refusal.error, 'the commit failed');
    assert.match(refusal.warnings.join('\n'), /^knowledge record render failed: /m);
  });
});

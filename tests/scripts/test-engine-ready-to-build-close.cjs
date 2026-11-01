'use strict';

// ---------------------------------------------------------------------------
// The close ready to build stands on (leeway-engine/scripts/domain/checklist.cjs,
// `readyClose`; ready-to-build.cjs): the landed spec alone, the close, the
// screen and the yes refused while spec.md holds changes that have not
// landed (11.8.1); ready to build's checklist closed, voided by a land or a
// cut after it (E12); phases-complete open while the cut no longer holds
// against the spec landed since (11.5.9); and an engine item failing since
// the close — the
// split, a decided topic postponed while the spec is written, its lines then
// invented (11.S18). Every refusal writes and commits nothing.
//
// Layer: verb. World: the ready to build world landed, its checklist open
// (ready-to-build-world.cjs), copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { ok, output, refuses, sectionOf, statePath, layout, writeState, readState, readManifest, stateGit } = require('./engine-harness.cjs');
const { UNIT, SESSION, CARDS, REFUNDS, cut, reviewPass, landReviewed, closeReady, landed, useReadyWorld, readyHelpers } = require('./ready-to-build-world.cjs');

const dir = useReadyWorld(landed);
const { screen, refused, yes } = readyHelpers(dir);

describe('the close the screen stands on (E12)', () => {
  it('refuses until ready to build\'s checklist is closed, writing nothing', () => {
    assert.strictEqual(refused(['render', 'ready-to-build', UNIT]), `render ready-to-build: ready-to-build is open — its items are worked, then it is closed: checklist close ready-to-build ${UNIT}`);
  });

  it('keeps on the close what the spec and the cut held, and is voided by a land after it, until the checklist is worked afresh and closed again', () => {
    const { closed: at } = closeReady(dir());
    const record = readManifest(dir(), UNIT).checklists['ready-to-build'];
    assert.deepStrictEqual(Object.keys(record), ['items', 'closed', 'spec_hash', 'cut_hash']);
    assert.match(record.spec_hash, /^[0-9a-f]{12}$/);
    writeState(dir(), layout.unit(UNIT, 'spec.md'), readState(dir(), layout.unit(UNIT, 'spec.md')).replace('are taken.', 'are taken, and no other.'));
    ok(dir(), ['spec', 'land', UNIT]);

    const voided = `ready-to-build was closed before ${UNIT}'s spec changed — a land after the close voids it, so its items are worked afresh and it is closed again`;
    assert.strictEqual(refused(['render', 'ready-to-build', UNIT]), `render ready-to-build: ${voided}`);
    assert.strictEqual(refused(['ready-to-build', 'yes', UNIT, '--position', 'auto']), `ready-to-build yes: ${voided}`);
    assert.match(refuses(dir(), ['checklist', 'close', 'ready-to-build', UNIT]).error, /has items open: replacements-checked, review-settled, invariants-checked$/);
    reviewPass(dir());
    assert.ok(closeReady(dir()).closed > at);
    assert.match(screen(), /=== MENU: ready to build /);
  });

  it('refuses to close over a spec.md holding changes that have not landed, and once landed closes over the landed text (11.8.1)', () => {
    const edited = readState(dir(), layout.unit(UNIT, 'spec.md')).replace('## 2. Refunds', '## 2. Refunds, whole');
    writeState(dir(), layout.unit(UNIT, 'spec.md'), edited);
    for (const item of ['replacements-checked', 'invariants-checked']) ok(dir(), ['checklist', 'done', 'ready-to-build', UNIT, item]);

    const unlanded = `${UNIT}'s spec has changes that haven't landed — land them: spec land ${UNIT}`;
    assert.strictEqual(refused(['checklist', 'close', 'ready-to-build', UNIT]), `checklist close: ${unlanded}`);
    assert.strictEqual(refused(['render', 'ready-to-build', UNIT]), `render ready-to-build: ${unlanded}`);
    landReviewed(dir());
    ok(dir(), ['checklist', 'close', 'ready-to-build', UNIT]);
    assert.match(sectionOf(screen(), 'DISPLAY: ready to build'), /\n {2}└─ 2 Refunds, whole\n/);
    yes(['--position', 'auto']);
    assert.strictEqual(stateGit(dir(), ['status', '--porcelain', '--', layout.unit(UNIT, 'spec.md')]), '', 'the build reads the spec the state holds');
  });

  it('refuses the screen, the yes and a close again over changes made after the close that have not landed — never read as a land after the close — and stands again once spec.md is the landed text (11.8.1)', () => {
    closeReady(dir());
    const file = layout.unit(UNIT, 'spec.md');
    const landedText = readState(dir(), file);
    const unlanded = `${UNIT}'s spec has changes that haven't landed — land them: spec land ${UNIT}`;
    const seen = [];
    for (const disk of [landedText.replace('are taken.', 'are taken, and no other.'), null]) {
      if (disk === null) fs.rmSync(statePath(dir(), file));
      else writeState(dir(), file, disk);
      seen.push([
        refused(['render', 'ready-to-build', UNIT]),
        refused(['ready-to-build', 'yes', UNIT, '--position', 'auto']),
        refused(['checklist', 'close', 'ready-to-build', UNIT]),
      ]);
    }

    assert.deepStrictEqual(seen, Array(2).fill([`render ready-to-build: ${unlanded}`, `ready-to-build yes: ${unlanded}`, `checklist close: ${unlanded}`]));
    writeState(dir(), file, landedText);
    assert.match(screen(), /=== MENU: ready to build /);
  });

  it('is voided by a cut after it', () => {
    closeReady(dir());
    cut(dir(), [{ ...CARDS, goal: 'Cards, sooner.' }, REFUNDS]);

    assert.strictEqual(refused(['ready-to-build', 'yes', UNIT, '--position', 'auto']), `ready-to-build yes: ready-to-build was closed before ${UNIT}'s spec was cut again — a cut after the close voids it, so its items are worked afresh and it is closed again`);
  });

  it('holds phases-complete open while the cut no longer holds against the spec landed since — a re-land adding a scenario no phase places — until the cut places it (11.5.9)', () => {
    closeReady(dir());
    const file = layout.unit(UNIT, 'spec.md');
    writeState(dir(), file, `${readState(dir(), file)}\n2.S2 Given a refund, when it is asked for twice, then the second is refused. (2.1.1)\n`);
    landReviewed(dir());
    const phasesComplete = () => JSON.parse(output(dir(), ['checklist', 'show', 'ready-to-build', UNIT])).items.find((/** @type {{key: string}} */ item) => item.key === 'phases-complete').state;
    for (const item of ['replacements-checked', 'invariants-checked']) ok(dir(), ['checklist', 'done', 'ready-to-build', UNIT, item]);

    assert.deepStrictEqual([phasesComplete(), refuses(dir(), ['checklist', 'close', 'ready-to-build', UNIT]).error], ['open', `checklist close: ready-to-build has items open: phases-complete`]);
    cut(dir(), [CARDS, { ...REFUNDS, scenarios: ['2.S1', '2.S2'] }]);
    assert.strictEqual(phasesComplete(), 'done');
    closeReady(dir());
    assert.match(screen(), /=== MENU: ready to build /);
  });

  it('refuses while an item the engine checks fails since the close: a decided topic postponed for a split leaves the lines citing it invented, so the spec is written again (11.10.3, 11.S18)', () => {
    closeReady(dir());
    const postponed = ok(dir(), ['topic', 'postpone', UNIT, 'refunds', '--horizon', 'next'], { env: SESSION });

    assert.strictEqual(postponed.status, 'postponed');
    assert.deepStrictEqual(ok(dir(), ['spec', 'land', UNIT]).invented.map((/** @type {{number: string}} */ line) => line.number), ['2.1.1']);
    assert.strictEqual(refused(['render', 'ready-to-build', UNIT]), 'render ready-to-build: ready-to-build has items open since its close: statements-traced — they are worked, and it is closed again');
  });
});

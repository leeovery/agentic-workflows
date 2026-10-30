'use strict';

// ---------------------------------------------------------------------------
// The phase cut (leeway-engine/scripts/domain/cut.cjs): `engine cut <unit>
// --file <cut.json>`. The cut written onto the unit's manifest as the file
// gives it, `{phases: [{name, goal, scenarios, sections, relies_on}]}`, each
// phase's fields in that order, and committed alone on the state branch, under the writer lock; each refusal of
// 11.5.9 — a scenario or a section the spec lacks, a scenario in two phases
// or in none, a phase relying on itself or a later one, another unit the
// project lacks, a unit with no spec, a file of another shape — naming the
// fault and writing nothing; a second cut replacing the whole cut until a
// phase has started — its start's checklist closed, not merely open — then
// keeping every phase to the last started, whatever order its fields are
// given in, and changing only those after.
//
// Layer: verb. World: a project with two units, built once and copied: one
// whose `spec.md` holds areas 1 to 3 and scenarios 1.S1, 3.S1 and 3.S2
// (11.S31's), and one, `billing`, with no spec. A phase's start is its
// checklist closed on the manifest: by `checklist close` for a first phase
// relying on nothing, and written by hand for later ones, whose starts would
// need each phase before them worked to its close first.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, refusedPristine, statePath, layout, writeState, readManifest, commitAll, stateGit, lastMessage, fixtureFrom, cleanupFixture, lockAttempts, holdLock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const { SPEC_FILE } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/spec-sections.cjs'));

const UNIT = 'payments';

const SPEC = [
  '# Payments', '',
  '## 1. Cards', 'A card is taken once.', '',
  '### 1.1 The form', '1.S1 Given a card form, when the number is typed, then it is checked.', '',
  '## 2. Receipts', 'A receipt names its charge.', '',
  '## 3. Refunds', 'A refund names its charge.', '',
  '3.S1 Given a charge, when it is refunded whole, then the card is credited.', '',
  '3.S2 Given a charge, when part of it is refunded, then the rest stands.', '',
].join('\n');

const world = fixtureFrom('cut-', (dir) => {
  createManifest(dir, UNIT, {});
  writeState(dir, layout.unit(UNIT, SPEC_FILE), SPEC);
  createManifest(dir, 'billing', {});
  commitAll(dir, 'init');
});

/** @typedef {{name: string, goal: string, scenarios: string[], sections: string[], relies_on: Array<number|string>}} Phase */

/** @param {string} name @param {Partial<Phase>} [fields] @returns {Phase} */
const phase = (name, fields = {}) => ({ name, goal: `${name} work.`, scenarios: [], sections: [], relies_on: [], ...fields });

const CARDS = phase('Cards', { scenarios: ['1.S1'], sections: ['1.1', '2'], relies_on: ['billing'] });
const REFUNDS = phase('Refunds', { scenarios: ['3.S1', '3.S2'], sections: ['3'], relies_on: [1] });

let dir = '';
beforeEach(() => { dir = world(); });
afterEach(() => { cleanupFixture(dir); });

/** The file a cut is given in, outside the state. @param {unknown} cut */
function cutFile(cut) {
  const file = path.join(dir, 'cut.json');
  fs.writeFileSync(file, typeof cut === 'string' ? cut : JSON.stringify(cut));
  return file;
}

/** @param {Phase[]} phases @param {string} [unit] */
const cut = (phases, unit = UNIT) => ok(dir, ['cut', unit, '--file', cutFile({ phases })]);

/** The refusal's error for a cut, nothing written or committed. @param {unknown} given @param {string} [unit] */
const refused = (given, unit = UNIT) => refusedPristine(dir, ['cut', unit, '--file', cutFile(given)]).error;

/** The unit's checklists as given, written onto its manifest. @param {Record<string, object>} checklists */
function withChecklists(checklists) {
  writeState(dir, layout.manifest(UNIT), JSON.stringify({ ...readManifest(dir, UNIT), checklists }, null, 2));
}

/** The phases through `number` marked started, their start's checklist closed. @param {number} number */
const startThrough = (number) => withChecklists(Object.fromEntries(Array.from({ length: number }, (_, at) => [`phase-${at + 1}-start`, { items: {}, closed: FROZEN_AT }])));

/** A phase with its fields in another order than the manifest keeps. @param {Phase} given */
const reordered = ({ relies_on: on, sections, scenarios, goal, name }) => ({ relies_on: on, sections, scenarios, goal, name });

describe('a cut written (11.5.8)', () => {
  it('lands on the unit\'s manifest as given, its phases in build order, and is committed alone on the state branch', () => {
    const before = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const res = cut([CARDS, REFUNDS]);

    assert.deepStrictEqual(res, { ok: true, unit: UNIT, phases: 2, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.deepStrictEqual(readManifest(dir, UNIT).cut, { phases: [CARDS, REFUNDS] });
    assert.strictEqual(lastMessage(dir), `cut(${UNIT}): 2 phases`);
    assert.deepStrictEqual(stateGit(dir, ['log', '--format=', '--name-only', `${before}..HEAD`]).trim().split('\n'), [layout.manifest(UNIT)]);
  });

  it('keeps each phase\'s fields in the manifest\'s order, whatever order the file gives them in', () => {
    cut([reordered(CARDS), REFUNDS]);

    assert.deepStrictEqual(Object.keys(readManifest(dir, UNIT).cut.phases[0]), ['name', 'goal', 'scenarios', 'sections', 'relies_on']);
  });

  it('runs under the writer lock: a live holder keeps the manifest unwritten until it lets go', (t) => {
    const lock = holdLock(statePath(dir, layout.lock));
    /** @type {unknown[]} */
    const whileHeld = [];
    const attempts = lockAttempts(t, lock, () => {
      whileHeld.push(readManifest(dir, UNIT).cut);
      fs.unlinkSync(lock);
    });

    cut([CARDS, REFUNDS]);

    assert.deepStrictEqual([attempts, whileHeld, readManifest(dir, UNIT).cut], [['taken', 'made'], [undefined], { phases: [CARDS, REFUNDS] }]);
  });
});

describe('the refusals (11.5.9, 11.S31), nothing written', () => {
  it('a scenario the spec lacks', () => {
    assert.strictEqual(refused({ phases: [CARDS, { ...REFUNDS, scenarios: ['3.S1', '3.S2', '3.S9'] }] }), 'cut: phase 2 places scenario 3.S9, which spec.md lacks');
  });

  it('a section the spec lacks, a deeper address among them', () => {
    assert.strictEqual(refused({ phases: [{ ...CARDS, sections: ['1.2', '1.1.1'] }, REFUNDS] }),
      'cut: phase 1 draws on section "1.2", which spec.md lacks; phase 1 draws on section "1.1.1", which spec.md lacks');
  });

  it('a scenario in two phases', () => {
    assert.strictEqual(refused({ phases: [{ ...CARDS, scenarios: ['1.S1', '3.S1'] }, REFUNDS] }), 'cut: scenario 3.S1 is in phases 1 and 2');
  });

  it('a scenario in no phase', () => {
    assert.strictEqual(refused({ phases: [CARDS, { ...REFUNDS, scenarios: ['3.S1'] }] }), 'cut: scenario 3.S2 is in no phase');
  });

  it('a phase relying on itself, or on one after it', () => {
    assert.strictEqual(refused({ phases: [{ ...CARDS, relies_on: [2] }, { ...REFUNDS, relies_on: [2] }] }),
      'cut: phase 1 relies on phase 2, which comes after it; phase 2 relies on itself');
  });

  it('another unit the project lacks, a path reaching one among them, and the unit\'s own name', () => {
    assert.strictEqual(refused({ phases: [{ ...CARDS, relies_on: ['ledger', 'Not A Unit', './billing'] }, { ...REFUNDS, relies_on: [UNIT] }] }), [
      'cut: phase 1 relies on "ledger", a work unit the project lacks', 'phase 1 relies on "Not A Unit", a work unit the project lacks',
      'phase 1 relies on "./billing", a work unit the project lacks', `phase 2 relies on ${UNIT}, its own unit — an earlier phase is named by its number`,
    ].join('; '));
  });

  it('a unit with no spec.md, a spec giving a scenario twice, and a unit the project lacks', () => {
    assert.strictEqual(refused({ phases: [CARDS] }, 'billing'), 'cut: billing has no spec — its folder holds no spec.md');
    writeState(dir, layout.unit(UNIT, SPEC_FILE), `${SPEC}3.S1 Given the refund again.\n`);
    assert.strictEqual(refused({ phases: [CARDS, REFUNDS] }), 'cut: the spec gives scenario 3.S1 twice, on lines 15 and 18');
    assert.strictEqual(refused({ phases: [CARDS] }, 'ledger'), 'cut: there is no work unit "ledger"');
  });

  it('a file of another shape: not JSON, no phases, a phase\'s fields missing, extra or of another kind, a list naming one twice', () => {
    const file = path.join(dir, 'cut.json');
    assert.match(refused('{"phases": ['), new RegExp(`^cut: ${file} holds no cut: `));
    for (const given of [{ phases: [] }, { phases: [CARDS], order: [1] }, [CARDS]]) {
      assert.strictEqual(refused(given), `cut: ${file} holds no cut — a cut is {"phases": [{name, goal, scenarios, sections, relies_on}, …]}`);
    }
    const { goal, ...goalless } = CARDS;
    assert.strictEqual(refused({ phases: [goalless, { ...REFUNDS, built: true }] }),
      'cut: phase 1 is not {name, goal, scenarios, sections, relies_on}; phase 2 is not {name, goal, scenarios, sections, relies_on}');
    assert.strictEqual(refused({ phases: [{ ...CARDS, name: ' ', scenarios: '1.S1' }, { ...REFUNDS, sections: ['3', '3'], relies_on: [0] }] }), [
      'cut: phase 1\'s name is not text', 'phase 1\'s scenarios is not a list of scenario ids, each once',
      'phase 2\'s sections is not a list of section addresses, each once', 'phase 2\'s relies_on is not a list of earlier phases by number and other units by name, each once',
    ].join('; '));
  });

  it('the usage, for arguments of another shape', () => {
    const usage = 'Usage: engine cut <work-unit> --file <cut.json>';
    for (const args of [['cut', UNIT], ['cut', '--file', 'cut.json'], ['cut', UNIT, 'billing', '--file', 'cut.json'], ['cut', UNIT, '--file', 'cut.json', '--force', 'yes']]) {
      assert.strictEqual(refusedPristine(dir, args).error, usage);
    }
  });
});

describe('a second cut (E10)', () => {
  it('replaces the whole cut while no phase has started', () => {
    cut([CARDS, REFUNDS]);
    const whole = phase('Everything', { scenarios: ['1.S1', '3.S1', '3.S2'], sections: ['1', '2', '3'] });

    assert.strictEqual(cut([whole]).phases, 1);
    assert.deepStrictEqual(readManifest(dir, UNIT).cut, { phases: [whole] });
    assert.strictEqual(lastMessage(dir), `cut(${UNIT}): 1 phase`);
  });

  it('once a phase has started, keeps it and every phase before it, and changes those after', () => {
    const refundWhole = phase('Whole refunds', { scenarios: ['3.S1'], sections: ['3'], relies_on: [1] });
    cut([CARDS, refundWhole, phase('Part refunds', { scenarios: ['3.S2'], relies_on: [2] })]);
    startThrough(2);
    const after = [phase('Part refunds', { scenarios: ['3.S2'], sections: ['3'], relies_on: [2] }), phase('Polish', { relies_on: [1, 3] })];

    cut([CARDS, refundWhole, ...after]);

    assert.deepStrictEqual(readManifest(dir, UNIT).cut, { phases: [CARDS, refundWhole, ...after] });
  });

  it('once a phase has started, refuses a cut changing it, one before it, or dropping it', () => {
    cut([CARDS, REFUNDS]);
    startThrough(2);
    const fault = (/** @type {string} */ how, /** @type {number} */ phase) => `phase 2 has started, and the cut ${how} phase ${phase} — a cut keeps every phase to 2 as it stands and changes only those after`;

    assert.strictEqual(refused({ phases: [{ ...CARDS, goal: 'Cards, sooner.' }, REFUNDS] }), `cut: ${fault('changes', 1)}`);
    assert.strictEqual(refused({ phases: [CARDS, { ...REFUNDS, sections: ['2', '3'] }] }), `cut: ${fault('changes', 2)}`);
    assert.strictEqual(refused({ phases: [CARDS] }), ['cut: scenario 3.S1 is in no phase', 'scenario 3.S2 is in no phase', fault('drops', 2)].join('; '));
  });

  it('a started phase restated with its fields in another order is unchanged', () => {
    cut([CARDS, REFUNDS]);
    startThrough(1);

    cut([reordered(CARDS), { ...REFUNDS, goal: 'Refunds, whole and part.' }]);

    assert.deepStrictEqual(readManifest(dir, UNIT).cut, { phases: [CARDS, { ...REFUNDS, goal: 'Refunds, whole and part.' }] });
  });

  it('a phase whose start\'s checklist is open, items marked and no close, has not started; `checklist close` starts it', () => {
    const cards = { ...CARDS, relies_on: [] };
    cut([cards, REFUNDS]);
    ok(dir, ['checklist', 'done', 'phase-start', UNIT, '1', 'tasks-written']);
    ok(dir, ['checklist', 'done', 'phase-start', UNIT, '1', 'design-settled']);
    const sooner = { ...cards, goal: 'Cards, sooner.' };

    cut([sooner, REFUNDS]);
    ok(dir, ['checklist', 'close', 'phase-start', UNIT, '1']);

    assert.deepStrictEqual(readManifest(dir, UNIT).cut, { phases: [sooner, REFUNDS] });
    assert.match(refused({ phases: [cards, REFUNDS] }), /^cut: phase 1 has started, and the cut changes phase 1 — /);
  });
});

'use strict';

// ---------------------------------------------------------------------------
// The phase cut (leeway-engine/scripts/domain/cut.cjs): `engine cut <unit>
// --file <cut.json>`. The cut written onto the unit's manifest as the file
// gives it, `{phases: [{name, goal, scenarios, sections, relies_on}]}`, each
// phase's fields in that order, and committed alone on the state branch, under the writer lock; each refusal of
// 11.5.9 — a scenario or a section the spec lacks, a scenario in two phases
// or in none, a phase relying on itself or a later one, another unit the
// project lacks, a unit with no spec or one its lines refuse, a file of
// another shape — naming the fault and writing nothing; a second cut
// replacing the whole cut until a
// phase has started — its start's checklist closed, not merely open — then
// keeping every phase to the last started, whatever order its fields are
// given in, and changing only those after.
//
// The cut's corridor: `engine brief phase-cut <unit>`, the phase cut's
// agent briefed from the spec's outline, its scenarios each with its area,
// and the graph of what its parts rely on, drawn from the entries its lines
// cite (11.5.6, 11.S7) — a part relying on another where a line of it cites
// an entry relying on one, in its current form or through entries no line
// cites, a line of the other cites, each link between a pair joined; none
// within a part, none for a part citing nothing, none to another unit's
// entry — and where the cut goes; the cut the agent stages there refused by
// `cut`, and the fresh brief carrying that refusal, verbatim, until the cut
// lands on the manifest and none is recorded (11.S5); every refusal of the
// brief storing none, a cancelled unit's among them.
//
// Layer: verb. Worlds, each built once and copied: a project with two
// units, one whose `spec.md` holds areas 1 to 3 and scenarios 1.S1, 3.S1
// and 3.S2 (11.S31's), and one, `billing`, with no spec. A phase's start is
// its checklist closed on the manifest: by `checklist close` for a first
// phase relying on nothing, and written by hand for later ones, whose
// starts would need each phase before them worked to its close first. And
// for the corridor, an epic whose topics' entries rely on each other — one
// on an entry since replaced, one on another unit's that relies back on
// it, one through an entry its spec cites nowhere — and whose spec cites them, in statements and a
// screen.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, refusedPristine, statePath, layout, writeState, readState, readManifest, commitAll, stateGit, lastMessage, fixtureFrom, cleanupFixture, lockAttempts, holdLock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { SPEC_FILE } = require(path.join(SCRIPTS, 'domain/spec-sections.cjs'));
const { briefPath, issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const TEMPLATES = path.join(__dirname, '../../skills/leeway-engine/content/briefs');

const UNIT = 'payments';

const SPEC = [
  '# Payments', '',
  '## 1. Cards', '', '### 1.1 The form', '', '1.1.1 A card is taken once. [builder]', '',
  '## 1-S. Scenarios for §1', '', '1.S1 Given a card form, when the number is typed, then it is checked. (1.1.1)', '',
  '## 2. Receipts', '', '### 2.1 The charge', '', '2.1.1 A receipt names its charge. [builder]', '',
  '## 3. Refunds', '', '### 3.1 The charge', '', '3.1.1 A refund names its charge. [builder]', '',
  '## 3-S. Scenarios for §3', '',
  '3.S1 Given a charge, when it is refunded whole, then the card is credited. (3.1.1)', '',
  '3.S2 Given a charge, when part of it is refunded, then the rest stands. (3.1.1)', '',
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

/** Each test of the block starting from a copy of `made`. @param {() => string} made */
function useWorld(made) {
  beforeEach(() => { dir = made(); });
  afterEach(() => { cleanupFixture(dir); });
}

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
  useWorld(world);

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
  useWorld(world);

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

  it('a unit with no spec.md, a spec its lines refuse — a scenario given twice, a note — and a unit the project lacks', () => {
    assert.strictEqual(refused({ phases: [CARDS] }, 'billing'), 'cut: billing has no spec — its folder holds no spec.md');
    writeState(dir, layout.unit(UNIT, SPEC_FILE), `${SPEC}\n3.S1 Given the refund again. (3.1.1)\n`);
    assert.strictEqual(refused({ phases: [CARDS, REFUNDS] }), 'cut: the spec gives scenario 3.S1 twice, on lines 27 and 31');
    writeState(dir, layout.unit(UNIT, SPEC_FILE), SPEC.replace('## 2. Receipts', '## 2. Receipts\n\nA receipt is kept.'));
    assert.strictEqual(refused({ phases: [CARDS, REFUNDS] }), 'cut: line 15 opens a note, a block with no number after a heading — every requirement is a numbered line, N.M.K or N.Sk');
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
  useWorld(world);

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

const EPIC = 'shop';
const SESSION_ID = 'cut-corridor-session';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const STAGED = layout.cache(EPIC, 'specification', 'cut.json');

/** Each entry's short id by name, filled as the corridor's world is built. @type {Record<string, string>} */
const made = {};

/** The epic's spec, citing the entries its world wrote. */
const shopSpec = () => [
  '# Shop', '',
  '## 1. Cards', '',
  '### 1.1 The form', '', `1.1.1 The form takes Visa and Mastercard. [${made.cards}]`, '',
  '### 1.2 The brand', '', `1.2.1 The form shows the card's brand. [${made.brand}]`, '',
  '### 1.3 The corners', '', '1.3.1 The corners are rounded. [builder]', '',
  '## 1-S. Scenarios for §1', '', '1.S1 Given a card form, when a Visa is typed, then its brand shows. (1.1.1, 1.2.1)', '',
  '## 2. Refunds', '',
  '### 2.1 Whole', '', `2.1.1 A refund goes back to the card. [${made.refunds}]`, '', `2.1.2 A refund costs nothing. [${made.fee}]`, '',
  '### 2.2 Partial', '', `2.2.1 Part of a charge may be refunded. [${made.partial}]`, '',
  `Screen: the refund form: [${made.form}]`, '', '```text', 'Refund £4 to Visa •• 4242', '```', '',
  '## 2-S. Scenarios for §2', '',
  '2.S1 Given a charge, when it is refunded whole, then the card is credited. (2.1.1)', '',
  '2.S2 Given a charge, when part of it is refunded, then the rest stands. (2.2.1)', '',
].join('\n');

const corridorWorld = fixtureFrom('cut-corridor-', (dir) => {
  const mapped = (/** @type {number} */ order) => ({ order, summary: `Topic ${order}`, source: 'discovery' });
  createManifest(dir, EPIC, {
    work_type: 'epic',
    phases: { discovery: { items: { cards: mapped(1), refunds: mapped(2) } }, discussion: { items: { cards: { status: 'in-progress' }, refunds: { status: 'in-progress' } } } },
  });
  createManifest(dir, 'billing', { phases: { discussion: { items: { billing: { status: 'in-progress' } } } } });
  commitAll(dir, 'init');
  const { write } = ledgerHelpers(() => dir);
  const [cards, refunds, billing] = [`${EPIC}.discussion.cards`, `${EPIC}.discussion.refunds`, 'billing.discussion.billing'];
  const decide = (/** @type {string} */ at, /** @type {string} */ text, /** @type {string[]} */ ...relied) => {
    const asked = write('ask', at, [], { ...PERSON, text: `What of ${text}?` }).id;
    return write('decide', at, ['--answers', asked, ...relied.flatMap((id) => ['--relies-on', id])], { ...PERSON, text, why: `Why: ${text}` }).id;
  };
  made.cardsOld = decide(cards, 'Visa alone.');
  made.invoice = decide(billing, 'Each charge on the invoice.', made.cardsOld);
  made.refunds = decide(refunds, 'Back to the card.', made.cardsOld, made.invoice);
  made.cards = write('replace', cards, ['--replaces', made.cardsOld, '--reason', 'changed-mind'], { ...PERSON, drops: ['Visa alone'], text: 'Visa and Mastercard.', why: 'Both are taken.' }).id;
  made.brand = write('find', cards, [], { ...MADE, text: 'The form shows the brand.', how: 'read in the code', known: 'read' }).id;
  made.fee = decide(refunds, 'No fee.', made.refunds, made.cards);
  made.partial = decide(refunds, 'Part refunds.', made.refunds, made.brand);
  made.limits = decide(refunds, 'A refund is limited to what the card took.', made.cards);
  made.form = decide(refunds, 'The refund form names the card.', made.limits);
  writeState(dir, layout.unit(EPIC, SPEC_FILE), shopSpec());
  commitAll(dir, 'spec');
});

/** A brief for the phase cut issued: its response, and the brief as stored. @param {string} [unit] */
function briefed(unit = EPIC) {
  const res = ok(dir, ['brief', 'phase-cut', unit], { env: SESSION });
  return { res, brief: fs.readFileSync(briefPath(SESSION_ID, res.id), 'utf8') };
}

/** The phase cut's template, its slots filled with `drawn`. @param {Record<string, string>} drawn */
function filledCutTemplate(drawn) {
  return fs.readFileSync(path.join(TEMPLATES, 'phase-cut.md'), 'utf8').split('\n').map((line) => drawn[line.slice(2, -2)] ?? line).join('\n');
}

/** The section a heading opens in a brief, to the next top-level heading. @param {string} brief @param {string} heading */
function section(brief, heading) {
  const from = brief.indexOf(`\n# ${heading}\n\n`);
  assert.ok(from >= 0, `no section ${heading}`);
  const body = brief.slice(from + heading.length + 5);
  const end = body.indexOf('\n# ');
  return (end < 0 ? body : body.slice(0, end)).trimEnd();
}

/** The cut staged where the corridor's agent writes it: its absolute path. @param {Phase[]} phases */
const staged = (phases) => writeState(dir, STAGED, JSON.stringify({ phases }));

const GRAPH = 'What the spec\'s parts rely on';
const WHOLE = phase('Whole refunds', { scenarios: ['1.S1', '2.S1'], sections: ['1.1', '1.2', '2.1'] });
const PART = phase('Part refunds', { scenarios: ['2.S2'], sections: ['1.2', '2.1', '2.2'], relies_on: [1] });

describe('the cut\'s corridor (11.5.1, 11.5.6, 11.S5, 11.S7)', () => {
  useWorld(corridorWorld);
  afterEach(() => { fs.rmSync(conversationDir(SESSION_ID), { recursive: true, force: true }); });

  it('briefs the phase cut for the unit from the spec\'s outline, its scenarios each with its area, the graph of what its parts rely on, and where the cut goes', () => {
    const { res, brief } = briefed();

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'phase-cut', agent: 'leeway-phase-cut', pointer: `brief:${res.id}` });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')), { role: 'phase-cut', agent: 'leeway-phase-cut', unit: EPIC, task: null, topic: null });
    assert.strictEqual(brief, `Brief ${res.id} — the phase cut's, for ${EPIC}\n\n${filledCutTemplate({
      'spec-outline': [
        `\`${statePath(dir, layout.unit(EPIC, SPEC_FILE))}\``, '',
        '- §1 Cards', '  - §1.1 The form', '  - §1.2 The brand', '  - §1.3 The corners', '- §2 Refunds', '  - §2.1 Whole', '  - §2.2 Partial',
      ].join('\n'),
      'spec-scenarios': [
        '- 1.S1, of §1 Cards: Given a card form, when a Visa is typed, then its brand shows. (1.1.1, 1.2.1)',
        '- 2.S1, of §2 Refunds: Given a charge, when it is refunded whole, then the card is credited. (2.1.1)',
        '- 2.S2, of §2 Refunds: Given a charge, when part of it is refunded, then the rest stands. (2.2.1)',
      ].join('\n'),
      'relies-on-graph': section(brief, GRAPH),
      'cut-refusal': 'None recorded.',
      'cut-to': `\`${statePath(dir, STAGED)}\``,
    })}`);
  });

  it('a part relies on another where a line of it cites an entry relying on one a line of the other cites, in its current form or through entries no line cites, each link between them joined, the parts it relies on in the spec\'s order — none within a part, from a part citing nothing, or to another unit', () => {
    writeState(dir, layout.unit(EPIC, SPEC_FILE), shopSpec().replace('[builder]', `[builder]\n\n1.3.2 Each charge is on the invoice. [${made.invoice}]`));

    assert.strictEqual(section(briefed().brief, GRAPH), [
      `- §2.1 relies on §1.1: 2.1.1 cites ${made.refunds}, which relies on ${made.cards}, cited by 1.1.1; 2.1.2 cites ${made.fee}, which relies on ${made.cards}, cited by 1.1.1`,
      `- §2.2 relies on §1.1: 2.2.1-scr1 cites ${made.form}, which relies on ${made.limits}, which relies on ${made.cards}, cited by 1.1.1`,
      `- §2.2 relies on §1.2: 2.2.1 cites ${made.partial}, which relies on ${made.brand}, cited by 1.2.1`,
      `- §2.2 relies on §2.1: 2.2.1 cites ${made.partial}, which relies on ${made.refunds}, cited by 2.1.1`,
    ].join('\n'));
  });

  it('a spec whose lines cite nothing has no graph', () => {
    writeState(dir, layout.unit(EPIC, SPEC_FILE), shopSpec().replace(/\[[0-9A-Za-z]+\]/g, '[builder]'));

    assert.strictEqual(section(briefed().brief, GRAPH), 'None recorded.');
  });

  it('a staged cut `cut` refuses comes back verbatim in a fresh brief, until the cut lands on the manifest, spec.md holding none, and none is recorded', () => {
    const file = staged([WHOLE, { ...PART, scenarios: [], relies_on: [3] }]);
    const refusal = refusedPristine(dir, ['cut', EPIC, '--file', file]).error;
    assert.strictEqual(refusal, 'cut: scenario 2.S2 is in no phase; phase 2 relies on phase 3, which comes after it');

    assert.strictEqual(section(briefed().brief, 'The staged cut\'s refusal'), refusal);

    staged([WHOLE, PART]);
    ok(dir, ['cut', EPIC, '--file', file]);
    assert.deepStrictEqual(readManifest(dir, EPIC).cut, { phases: [WHOLE, PART] });
    assert.strictEqual(readState(dir, layout.unit(EPIC, SPEC_FILE)), shopSpec());
    assert.strictEqual(section(briefed().brief, 'The staged cut\'s refusal'), 'None recorded.');
  });

  it('refuses, storing no brief, a unit the project lacks, one cancelled, one with no spec, a spec its grammar refuses, and arguments of another shape', () => {
    const refusedBrief = (/** @type {string[]} */ args) => refusedPristine(dir, ['brief', ...args], { env: SESSION }).error;
    assert.strictEqual(refusedBrief(['phase-cut', 'ledger']), 'Work unit "ledger" not found');
    const live = readState(dir, layout.manifest(EPIC));
    writeState(dir, layout.manifest(EPIC), JSON.stringify({ ...JSON.parse(live), status: 'cancelled' }));
    assert.strictEqual(refusedBrief(['phase-cut', EPIC]), `brief: ${EPIC} is cancelled — reactivating it comes first`);
    writeState(dir, layout.manifest(EPIC), live);
    assert.strictEqual(refusedBrief(['phase-cut', 'billing']), 'billing has no spec — its folder holds no spec.md');
    writeState(dir, layout.unit(EPIC, SPEC_FILE), shopSpec().replace('## 2. Refunds', '## 2. Refunds\n\nRefunds are kept.'));
    assert.match(refusedBrief(['phase-cut', EPIC]), /^brief: shop's spec\.md does not read —\nline \d+ opens a note, /);
    for (const args of [['phase-cut'], ['phase-cut', EPIC, 'refunds']]) assert.match(refusedBrief(args), /^Usage: /);
    assert.ok(!fs.existsSync(path.dirname(briefPath(SESSION_ID, 'x'))));
  });
});

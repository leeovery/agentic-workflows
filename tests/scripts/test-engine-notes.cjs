'use strict';

// ---------------------------------------------------------------------------
// The notes for later and their consolidation (leeway-engine/scripts/
// domain/notes.cjs): `engine task note <unit> --file <note> [--phase N]`.
// A note deposited into the unit's notes as it arrives, numbered after the
// last, and committed alone (12.10.2, 13.S8); one held for a phase not yet
// written, for its task writer (12.9.10); every refusal writing and
// committing nothing, no such file among them, and a notes file not
// numbered from 1 refused with how the person puts it right. A phase's
// consolidation report read by its grammar — each note dropped with its
// reason or made a task (12.10.3, 12.10.4), as a careful writer writes the
// list, or `None` as all it holds; an item opening on a note that does not
// read refused for what it is — and the phase's notes consolidated where it
// has none to take, report or not, or where its report takes every note no
// other phase's report took, whatever their numbers, and none held for a
// phase, each once (15.S13); a note banked after the consolidation one
// more, its line read wherever it comes.
//
// Layer: verb. World: a project with one work unit, built once and copied:
// its cut of three phases on its manifest, its first phase written in the
// tracker.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, refuses, refusedPristine, statePath, layout, writeState, readState, stateGit, lastMessage, touched, commitAll, fixtureFrom,
} = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { readConsolidation, consolidationFaults } = require(path.join(SCRIPTS, 'domain/notes.cjs'));

const UNIT = 'pay';
const NOTES = layout.unit(UNIT, 'build/notes.md');

/** A phase of the cut. @param {string} name */
const phase = (name) => ({ name, goal: `${name} work.`, scenarios: [], sections: [], relies_on: [] });

/** The unit, its cut of three phases, its first written in the tracker. */
const notesWorld = fixtureFrom('notes-', (dir) => {
  createManifest(dir, UNIT, { cut: { phases: [phase('Cards'), phase('Refunds'), phase('Webhooks')] } });
  createManifest(dir, 'bare', {});
  commitAll(dir, 'init');
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'Cards']);
});

/** @type {string} */
let dir;

const folder = useTempFolder('notes-');
beforeEach(() => { dir = notesWorld(path.join(folder(), 'project')); });

/** A note's text in a file of the test's own: its path. @param {string} text */
function noteFile(text) {
  const file = path.join(folder(), 'note.md');
  fs.writeFileSync(file, text);
  return file;
}

/** A note deposited: the verb's answer. @param {string} text @param {string[]} [more] */
const deposit = (text, more = []) => ok(dir, ['task', 'note', UNIT, '--file', noteFile(text), ...more]);

/** A phase's consolidation report written, its notes' items as given. @param {number} number @param {string[]} items */
function consolidated(number, items) {
  writeState(dir, layout.unit(UNIT, `build/phases/phase-${number}/consolidation.md`), `Read against the phase's code.\n\n## The notes\n\n${items.join('\n')}\n`);
}

/** A refusal leaving the tree and the state branch as they were: its error. @param {string[]} args @param {RegExp} pattern */
function refusedWith(args, pattern) {
  const { error } = refusedPristine(dir, ['task', 'note', ...args]);
  assert.match(error, pattern);
}

describe('task note (12.10.2, 6.1.7)', () => {
  it('13.S8: a gap beyond the task deposited as it arrives — `## Note 1` over its text, the notes committed alone', () => {
    const res = deposit('  The receipt omits the currency where the card is foreign.\n\n');

    assert.deepStrictEqual(res, { ok: true, number: 1, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.strictEqual(readState(dir, NOTES), '## Note 1\n\nThe receipt omits the currency where the card is foreign.\n');
    assert.deepStrictEqual([lastMessage(dir), touched(statePath(dir), 'HEAD')], ['task(pay): note 1', [`A\t${NOTES}`]]);
  });

  it('12.9.10: each note numbered after the last, one held for a phase not yet written read so, for that phase\'s task writer', () => {
    deposit('The receipt omits the currency.');
    const held = deposit('Webhooks retry with backoff.\n\n```md\n### Not a note\n```', ['--phase', '3']);

    assert.deepStrictEqual([held.number, held.phase, lastMessage(dir)], [2, 3, 'task(pay): note 2, for phase 3']);
    assert.strictEqual(readState(dir, NOTES), '## Note 1\n\nThe receipt omits the currency.\n\n## Note 2, for phase 3\n\nWebhooks retry with backoff.\n\n```md\n### Not a note\n```\n');
  });

  it('a unit the project lacks, no such file, a note holding nothing or a heading at level one or two, and arguments of another shape', () => {
    refusedWith(['nope', '--file', noteFile('A gap.')], /^task note: there is no work unit "nope"$/);
    refusedWith([UNIT, '--file', noteFile('  \n')], /^task note: .*note\.md holds nothing to note$/);
    refusedWith([UNIT, '--file', path.join(folder(), 'missing.md')], /^task note: there is no file .*missing\.md$/);
    refusedWith([UNIT, '--file', noteFile('A gap.\n\n## Another\n\nText.')], /^task note: a note holds no heading at level one or two, which would read as another note — "## Another"$/);
    for (const args of [[UNIT], [UNIT, '--file', noteFile('A gap.'), '--phase'], ['--file', noteFile('A gap.')]]) {
      assert.match(refuses(dir, ['task', 'note', ...args]).error, /^Usage: engine task note <unit> --file <note> \[--phase <N>\]$/, args.join(' '));
    }
  });

  it('a notes file holding anything but notes numbered from 1 refuses, naming the fault and how the person puts it right by hand', () => {
    const putRight = 'the engine writes its notes, through task note, and the person puts the file right by hand: each note under its heading, `## Note {k}` or `## Note {k}, for phase {N}`, numbered from 1 in the order they stand; the next note commits the file';
    deposit('The receipt omits the currency.');
    const held = readState(dir, NOTES);
    writeState(dir, NOTES, `${held}\n## Note 1\n\nRefund totals round twice.\n`);
    assert.strictEqual(refusedPristine(dir, ['task', 'note', UNIT, '--file', noteFile('A gap.')]).error, `task note: pay/build/notes.md numbers note 2 as 1 — ${putRight}`);
    writeState(dir, NOTES, `# Notes\n\n${held}`);
    assert.strictEqual(refusedPristine(dir, ['task', 'note', UNIT, '--file', noteFile('A gap.')]).error, `task note: pay/build/notes.md holds "# Notes", which is no note — ${putRight}`);
  });

  it('a note held for a phase of a unit with no cut, one its cut lacks, and one the tracker has written, whose finds are tasks there', () => {
    const file = noteFile('A gap.');
    refusedWith(['bare', '--file', file, '--phase', '1'], /^task note: bare has no cut — a note is held for a phase of its cut$/);
    refusedWith([UNIT, '--file', file, '--phase', '4'], /^task note: pay's cut has no phase 4 — its phases are 1 to 3$/);
    refusedWith([UNIT, '--file', file, '--phase', '1'], /^task note: phase 1 of pay is written already — a find for it is a task there: engine task create pay 1 --file <task>$/);
  });
});

describe('the notes consolidated at a phase\'s end (12.10.3, 12.10.4)', () => {
  it('a report read by its grammar: each item the notes it takes, dropped with why or made a task, its other lines its own', () => {
    assert.deepStrictEqual(readConsolidation('Grouped.\n\n## The notes\n\n- Note 1: dropped — 2.3\'s formatter settles it.\n- Note 2, Note 4: a task — Retry webhooks with backoff\n  Both name the retries.\n'), [
      { notes: [1], kind: 'dropped', text: '2.3\'s formatter settles it.' },
      { notes: [2, 4], kind: 'task', text: 'Retry webhooks with backoff\nBoth name the retries.' },
    ]);
  });

  it('a report read as a careful writer writes it: `*` bullets, any case, a dash for the em dash, lead-in prose, lines at the margin under an item; `None` as all it holds takes none; prose alone does not read', () => {
    assert.deepStrictEqual(readConsolidation('## The notes\n\nTwo notes reached the phase.\n\n* note 1: Dropped - settled by 2.3.\nThe formatter covers it.\n\n- Note 2: A TASK – Retry webhooks\n'), [
      { notes: [1], kind: 'dropped', text: 'settled by 2.3.\nThe formatter covers it.' },
      { notes: [2], kind: 'task', text: 'Retry webhooks' },
    ]);
    for (const none of ['None.', 'None', '**None** — every note was settled by the code.', '- None.']) assert.deepStrictEqual(readConsolidation(`## The notes\n\n${none}\n`), [], none);
    for (const text of ['Note 1 is settled.', 'No note reached the phase.\n\nNone']) assert.throws(() => readConsolidation(`## The notes\n\n${text}\n`), /^Error: nothing under ## The notes takes a note/, text);
  });

  it('an item opening on a note that does not read is refused for what it is, naming it — never left to read as a note not taken', () => {
    const grammar = 'each item reads `- Note {k}: dropped — {why}` or `- Note {k}[, Note {k}…]: a task — {title}`';
    const items = ['- Note 2 and Note 3: a task — Retry webhooks', '- Note 1: dropped: the formatter settles it', '- **Note 1**: dropped — the formatter settles it', '* Notes 4, 5: dropped — settled'];
    assert.throws(() => readConsolidation(`## The notes\n\n${items.join('\n')}\n`), (err) => err instanceof Error && err.message === items.map((item) => `"${item}" under ## The notes does not read as the notes it takes — ${grammar}`).join('; '));

    deposit('The receipt omits the currency.');
    consolidated(1, ['- Note 1: dropped: the formatter settles it']);
    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 1), [`pay/build/phases/phase-1/consolidation.md does not read as a consolidation report — "- Note 1: dropped: the formatter settles it" under ## The notes does not read as the notes it takes — ${grammar}`]);
  });

  it('15.S13: a note proposing a check, made a task at the phase\'s end, with every other note dropped with its reason: the phase\'s notes consolidated', () => {
    deposit('The same unchecked import came back in 1.2 and 1.4: an architecture test for the import rule would catch it.');
    deposit('The receipt omits the currency.');
    deposit('Webhooks retry with backoff.', ['--phase', '3']);
    consolidated(1, ['- Note 1: a task — Add an architecture test for the import rule', '- Note 2: dropped — 1.3\'s formatter settles it.']);

    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 1), []);
  });

  it('a phase with no notes to take is consolidated, with no report or one saying `None`: no note banked, or every note held for a phase', () => {
    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 1), []);
    deposit('Webhooks retry with backoff.', ['--phase', '3']);
    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 1), []);
    for (const none of ['None.', 'None']) {
      consolidated(1, [none]);
      assert.deepStrictEqual(consolidationFaults(dir, UNIT, 1), [], none);
    }
  });

  it('phases closing in either order: a higher phase closing first takes its notes, and the lower one takes only those no other phase took', () => {
    deposit('The receipt omits the currency.');
    deposit('Refund totals round twice.');
    consolidated(3, ['- Note 1: dropped — 3.2\'s formatter settles it.']);

    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 2), ['phase 2 of pay has no consolidation report, and a note waits for one: note 2 — pay/build/phases/phase-2/consolidation.md']);
    consolidated(2, ['- Note 2: a task — Round refund totals once']);
    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 2), []);
    consolidated(2, ['- Note 1, Note 2: a task — Round refund totals once']);
    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 2), ['note 1 was consolidated in phase 3']);
  });

  it('12.10.3: a note banked after the phase\'s consolidation is one more it takes, the report gaining its line after the rest, read wherever it comes', () => {
    deposit('The receipt omits the currency.');
    consolidated(1, ['- Note 1: dropped — 1.3\'s formatter settles it.']);
    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 1), []);
    deposit('Refund totals round twice.');

    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 1), ['note 2 is neither dropped nor made a task']);
    consolidated(1, ['- Note 1: dropped — 1.3\'s formatter settles it.', '', 'Banked since:', '', '- Note 2: a task — Round refund totals once']);
    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 1), []);
  });

  it('a later phase takes the notes no earlier phase\'s report took, and none it took', () => {
    deposit('The receipt omits the currency.');
    consolidated(1, ['- Note 1: dropped — 1.3\'s formatter settles it.']);
    deposit('Refund totals round twice.');
    consolidated(2, ['- Note 2: a task — Round refund totals once']);

    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 2), []);
    consolidated(2, ['- Note 1, Note 2: a task — Round refund totals once']);
    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 2), ['note 1 was consolidated in phase 1']);
  });

  it('what stands between a phase and its notes consolidated, every fault named: no report, one that does not read, a note left out, taken twice, one there is not, and one held for a phase', () => {
    deposit('The receipt omits the currency.');
    deposit('Refund totals round twice.');
    deposit('Webhooks retry with backoff.', ['--phase', '3']);

    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 1), ['phase 1 of pay has no consolidation report, and notes wait for one: note 1, note 2 — pay/build/phases/phase-1/consolidation.md']);
    writeState(dir, layout.unit(UNIT, 'build/phases/phase-1/consolidation.md'), '## The notes\n\nNote 1 is settled.\n');
    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 1), [
      'pay/build/phases/phase-1/consolidation.md does not read as a consolidation report — nothing under ## The notes takes a note — each item reads `- Note {k}: dropped — {why}` or `- Note {k}[, Note {k}…]: a task — {title}` — or all it holds is `None.`',
    ]);
    consolidated(1, ['- Note 1: dropped — settled.', '- Note 1, Note 9: a task — Round once', '- Note 3: dropped — later.']);
    assert.deepStrictEqual(consolidationFaults(dir, UNIT, 1), [
      'note 1 is taken twice', 'there is no note 9', 'note 3 is held for phase 3, whose task writer takes it', 'note 2 is neither dropped nor made a task',
    ]);
  });
});

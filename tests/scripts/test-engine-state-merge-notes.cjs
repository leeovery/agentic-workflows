'use strict';

// ---------------------------------------------------------------------------
// A unit's notes for later in a second clone's merge
// (leeway-engine/scripts/domain/state-merge-paths.cjs, the notes placed
// before the tree merges and merged by note; state-merge-rules.cjs,
// `notesMerged`; 4.7, 12.10, 6.1.7): notes both machines banked — the
// remote's at their numbers, this machine's after them in their order, one
// held for a phase still held, one both banked alike one — so `task note`
// and the readers the briefs draw on (`notesHeldFor`, `notesToTake`) read
// the merged file; this machine's consolidation reports renamed with its
// notes, the remote's standing, one both machines extended merged in one
// numbering, and those it holds uncommitted carried too; one of this
// machine's that does not read set aside, the stop's notice acknowledged;
// and a copy that does not read as notes refused.
//
// Layer: git. World: real repositories in a temp folder per test, a project
// on a bare remote and a second clone of it on "another machine"
// (state-merge-world.cjs), sharing a unit with a cut of three phases and
// one note, each machine's notes written as `task note` writes them.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, git, layout, commitOnState } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { STATE_BRANCH } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { catchUpState, stateMergeGateSurface } = require(path.join(SCRIPTS, 'domain/state-merge.cjs'));
const { notesAppended, notesHeldFor, notesToTake, consolidationFaults } = require(path.join(SCRIPTS, 'domain/notes.cjs'));

const { readFile, createFile } = require('./discovery-test-utils.cjs');
const { useWorld, machinesSharing, blobId, status, commitUnpushed, json, pickShown } = require('./state-merge-world.cjs');

const world = useWorld();

const UNIT = 'pay';
const NOTES = layout.unit(UNIT, 'build/notes.md');
const CARDS = 'Reading a card back never checks its expiry.';
const RECEIPT = 'The receipt omits the currency.';
const REFUNDS = 'Refund totals round twice.';
const WEBHOOKS = 'Webhooks retry with backoff.';
const MANIFEST = json({
  name: UNIT,
  work_type: 'feature',
  status: 'in-progress',
  description: 'Payments',
  phases: {},
  cut: { phases: ['Cards', 'Refunds', 'Webhooks'].map((name) => ({ name, goal: `${name} work.`, scenarios: [], sections: [], relies_on: [] })) },
});

/** A notes file as `task note` writes it, numbered from 1: each note its text, or its text and the phase it is held for. @param {...(string|[string, number])} held */
function notes(...held) {
  return notesAppended('', held.map((note, i) => (typeof note === 'string' ? { note: i + 1, phase: null, text: note } : { note: i + 1, phase: note[1], text: note[0] })));
}

/** A phase's consolidation report's path. @param {number} phase */
const report = (phase) => layout.unit(UNIT, `build/phases/phase-${phase}/consolidation.md`);

/** A consolidation report taking the notes its items name. @param {...string} items */
const consolidation = (...items) => `Read against the phase's code.\n\n## The notes\n\n${items.join('\n')}\n`;

/** Two machines sharing the unit, its first note and `extra`. @param {Record<string, string>} [extra] */
function sharing(extra = {}) {
  return machinesSharing({ [layout.manifest(UNIT)]: MANIFEST, [NOTES]: notes(CARDS), ...extra });
}

/** The merge's note on notes this machine banked under numbers the remote banked too. @param {string} moves @param {string} [named] */
function movedNote(moves, named = '') {
  return `notes in .leeway/${NOTES} were banked under the same numbers on both machines: the remote's keep theirs, and this machine's follow them — ${moves}${named}`;
}

describe('notes both machines banked (12.10.2)', () => {
  it('keeps the remote\'s notes at their numbers and writes this machine\'s after them, in their order, the one held for a phase still held for it', () => {
    const { here, there } = sharing();
    commitUnpushed(here, { [NOTES]: notes(CARDS, [WEBHOOKS, 3], REFUNDS) });
    commitOnState(there.root, { [NOTES]: notes(CARDS, RECEIPT) });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed, out.conflicts], ['merged', true, []]);
    assert.strictEqual(readFile(here.root, NOTES), notes(CARDS, RECEIPT, [WEBHOOKS, 3], REFUNDS));
    assert.deepStrictEqual(out.warnings, [movedNote('note 2 is now note 3, note 3 is now note 4')]);
    assert.strictEqual(status(here.root), '');
  });

  it('takes a note both machines banked alike as one, and one held for a phase as another than the same words held for none', () => {
    const { here, there } = sharing();
    commitUnpushed(here, { [NOTES]: notes(CARDS, REFUNDS, [WEBHOOKS, 3]) });
    commitOnState(there.root, { [NOTES]: notes(CARDS, REFUNDS, WEBHOOKS, RECEIPT) });

    const out = catchUpState(here.root);

    assert.strictEqual(readFile(here.root, NOTES), notes(CARDS, REFUNDS, WEBHOOKS, RECEIPT, [WEBHOOKS, 3]));
    assert.deepStrictEqual(out.warnings, [movedNote('note 3 is now note 5')]);
  });

  it('leaves the merged notes for the next note and the briefs\' readers: the held note for its phase\'s task writer, the rest for the consolidation, the next numbered after the last', () => {
    const { here, there } = sharing();
    commitUnpushed(here, { [NOTES]: notes(CARDS, [WEBHOOKS, 3]) });
    commitOnState(there.root, { [NOTES]: notes(CARDS, RECEIPT) });
    catchUpState(here.root);
    const file = path.join(world(), 'note.md');
    fs.writeFileSync(file, REFUNDS);

    assert.deepStrictEqual(notesHeldFor(here.main, UNIT, 3), [{ note: 3, phase: 3, text: WEBHOOKS }]);
    assert.deepStrictEqual(notesToTake(here.main, UNIT, 1).map(({ note }) => note), [1, 2]);
    assert.strictEqual(ok(here.main, ['task', 'note', UNIT, '--file', file]).number, 4);
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${NOTES}`]), notes(CARDS, RECEIPT, [WEBHOOKS, 3], REFUNDS));
  });

  it('refuses a copy that does not read as notes, naming it from the project root and the side', () => {
    const { here, there } = sharing();
    commitUnpushed(here, { [NOTES]: `${notes(CARDS, REFUNDS)}\n## Note 2\n\n${WEBHOOKS}\n` });
    commitOnState(there.root, { [NOTES]: notes(CARDS, RECEIPT) });

    assert.throws(() => catchUpState(here.root), (err) => err instanceof Error
      && err.message === `cannot merge .leeway/${NOTES}: this machine's copy numbers note 3 as 2`);
  });
});

describe('the consolidation reports naming the notes (12.10.3)', () => {
  it('renames the notes this machine\'s report takes as they move, every other byte as it was; the remote\'s report keeps the remote\'s, and every phase\'s notes stay consolidated', () => {
    const { here, there } = sharing({ [report(1)]: consolidation('- Note 1: dropped — 1.3\'s formatter settles it.') });
    commitUnpushed(here, { [NOTES]: notes(CARDS, REFUNDS, WEBHOOKS), [report(2)]: consolidation('- Note 2: dropped — 2.2 settles it.', '- Note 3: a task — Retry webhooks with backoff') });
    commitOnState(there.root, { [NOTES]: notes(CARDS, RECEIPT), [report(3)]: consolidation('- Note 2: a task — Show the currency') });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.conflicts], ['merged', []]);
    assert.deepStrictEqual([1, 2, 3].map((phase) => readFile(here.root, report(phase))), [
      consolidation('- Note 1: dropped — 1.3\'s formatter settles it.'),
      consolidation('- Note 3: dropped — 2.2 settles it.', '- Note 4: a task — Retry webhooks with backoff'),
      consolidation('- Note 2: a task — Show the currency'),
    ]);
    assert.deepStrictEqual([1, 2, 3].map((phase) => consolidationFaults(here.main, UNIT, phase)), [[], [], []]);
    assert.deepStrictEqual(out.warnings, [movedNote('note 2 is now note 3, note 3 is now note 4', `; .leeway/${report(2)} names them so`)]);
  });

  it('merges a report both machines extended in one numbering, this machine\'s renamed before the lines merge', () => {
    const { here, there } = sharing({ [report(1)]: consolidation('- Note 1: dropped — settled.') });
    commitUnpushed(here, { [NOTES]: notes(CARDS, REFUNDS), [report(1)]: consolidation('- Note 1: dropped — settled.', '- Note 2: a task — Round refund totals once') });
    commitOnState(there.root, { [NOTES]: notes(CARDS, RECEIPT), [report(1)]: consolidation('- Note 1: dropped — settled.', '- Note 2: dropped — the receipt names it.') });

    const out = catchUpState(here.root);

    assert.strictEqual(readFile(here.root, report(1)), consolidation('- Note 1: dropped — settled.', '- Note 2: dropped — the receipt names it.', '- Note 3: a task — Round refund totals once'));
    assert.deepStrictEqual(consolidationFaults(here.main, UNIT, 1), []);
  });

  it('carries this machine\'s uncommitted reports to the notes\' numbers after the merge against their committed copies renamed too — one changed, one whose item the branch renamed dropped, one new — left uncommitted', () => {
    const { here, there } = sharing({ [report(1)]: consolidation('- Note 1: dropped — settled.') });
    commitUnpushed(here, {
      [NOTES]: notes(CARDS, REFUNDS, WEBHOOKS),
      [report(1)]: consolidation('- Note 1: dropped — settled.', '- Note 2: dropped — 1.2 rounds once.'),
      [report(2)]: consolidation('- Note 3: a task — Retry webhooks with backoff'),
    });
    createFile(here.root, report(1), consolidation('- Note 1: dropped — settled.', '- Note 2: dropped — 1.2 rounds once, and 1.3 too.'));
    createFile(here.root, report(2), consolidation('None.'));
    createFile(here.root, report(3), consolidation('- Note 3: a task — Retry webhooks with backoff'));
    commitOnState(there.root, { [NOTES]: notes(CARDS, RECEIPT) });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.uncommitted.merged], ['merged', [report(1), report(2), report(3)]]);
    assert.deepStrictEqual([1, 2].map((phase) => git(here.main, ['show', `${STATE_BRANCH}:${report(phase)}`])), [
      consolidation('- Note 1: dropped — settled.', '- Note 3: dropped — 1.2 rounds once.'),
      consolidation('- Note 4: a task — Retry webhooks with backoff'),
    ]);
    assert.deepStrictEqual([1, 2, 3].map((phase) => readFile(here.root, report(phase))), [
      consolidation('- Note 1: dropped — settled.', '- Note 3: dropped — 1.2 rounds once, and 1.3 too.'),
      consolidation('None.'),
      consolidation('- Note 4: a task — Retry webhooks with backoff'),
    ]);
    assert.strictEqual(status(here.root), ` M ${report(1)}\n M ${report(2)}\n?? ${report(3)}\n`);
    assert.deepStrictEqual(out.warnings, [
      movedNote('note 2 is now note 3, note 3 is now note 4', `; .leeway/${report(1)}, .leeway/${report(2)} name them so`),
      `.leeway/${report(1)}, .leeway/${report(3)} name this machine's notes by their numbers in the merge`,
    ]);
  });

  it('stops where this machine\'s report does not read, its names not to be found: the screen names it and where it is kept; carrying on sets it beside, none at its path', () => {
    const unread = consolidation('- Note 2: dropped: the receipt names it.');
    const { here, there } = sharing();
    commitUnpushed(here, { [NOTES]: notes(CARDS, REFUNDS), [report(1)]: unread });
    commitOnState(there.root, { [NOTES]: notes(CARDS, RECEIPT) });
    const beside = layout.unit(UNIT, `build/phases/phase-1/consolidation.${blobId(unread).slice(0, 8)}.md`);

    const stopped = catchUpState(here.root);

    assert.deepStrictEqual([stopped.action, stopped.conflicts], ['stopped', [
      { file: report(1), setAside: { phase: 1, stays: false, renumbered: [{ from: 2, to: 3 }] }, beside, pick: null, uncommitted: false },
    ]]);
    const screen = stateMergeGateSurface(here.main, {});
    assert.match(screen, /^⚑ The state merge stopped: the consolidation report of phase 1 of pay set aside$/m);
    assert.ok(screen.includes(`> No report stays at \`.leeway/${report(1)}\`, and this machine's copy is kept beside it as \`.leeway/${beside}\`.`));
    assert.throws(() => pickShown(here, '2'), /carry on past a consolidation report set aside: pick 1, got "2"/);

    const out = pickShown(here, '1');

    assert.deepStrictEqual([out.action, out.pushed], ['merged', true]);
    assert.strictEqual(readFile(here.root, NOTES), notes(CARDS, RECEIPT, REFUNDS));
    assert.ok(!fs.existsSync(path.join(here.root, report(1))), 'this machine\'s report stayed at its path');
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${beside}`]), unread);
  });
});

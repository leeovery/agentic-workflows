'use strict';

// ---------------------------------------------------------------------------
// The close a topic's decided gate stands on (leeway-engine/scripts/
// domain/checklist.cjs, domain/decided.cjs): a topic a message set back in
// progress closed afresh before its gate shows again, counting the verdicts
// its close asks, a decision the record widens already taking no second
// line, the yes refused while a line widens a decision replaced since, a
// line widening the replacement replacing it and a withdrawal taking a line
// out, one rule standing, a yes killed after they landed run again (P9,
// 8.9.2); a message delivered or
// a question opened since the close voiding it, the payload staged against
// it refused by the screen and the yes alike, and a decision changed since
// voiding nothing.
//
// Layer: verb. World: the decided suites' (decided-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const { ok, output, refusedPristine, sectionOf, readManifest, statePath, killedAt } = require('./engine-harness.cjs');
const { UNIT, SESSION, MADE, NOTE, ledgerHelpers } = require('./ledger-world.cjs');
const { PERSON, NO_PAYLOAD, NOTE_MAP, writeIn, markAllButTheClosingPass, useDecidedWorld, decidedHelpers } = require('./decided-world.cjs');

const dir = useDecidedWorld();
const { close, payload, screen, staged, answer, run, reverse } = decidedHelpers(dir);
const { entries } = ledgerHelpers(dir);

describe('a topic set back in progress (P9, 10.2.7)', () => {
  it('shows its gate again only once closed afresh, counting the verdicts this close asks; a decision widened already takes no second line, the yes refuses while a line widens a decision replaced since, until a line widening the replacement at the end of its chain replaces it or a withdrawal takes it out, one rule standing once a yes killed after they landed runs again', () => {
    close();
    reverse(NOTE_MAP.title.answer, 'Hello.');
    staged({ lines: [
      { text: 'Sync is on once a folder is picked.', why: 'It holds for the product.', widens: NOTE_MAP.sync.answer },
      { text: 'First run shows the product before it asks.', why: 'The tour first holds everywhere.', widens: NOTE_MAP.shape.answer },
    ], candidates: [] });
    run(answer('verdict', 'n'));
    screen();
    run(answer('decided', 'y'));
    const scratch = statePath(dir(), '.cache', 'scratch', 'note.md');
    fs.writeFileSync(scratch, 'A login item needs a banner\n\nThe space-homing topic found one.\n');
    ok(dir(), ['topic', 'send', UNIT, 'note-window', '--from', 'space-homing', '--content', scratch, '--slug', 'banner'], { env: SESSION });
    assert.strictEqual(readManifest(dir(), UNIT).phases.discussion.items['note-window'].status, 'in-progress');
    const shown = ['render', 'decided', `${UNIT}.note-window`, '--file', payload(NO_PAYLOAD)];
    assert.match(refusedPristine(dir(), shown, { env: SESSION }).error, /^render decided: decided\.note-window's close was taken by the decided gate's yes, and the topic was set back in progress since/);
    const banner = writeIn(dir(), 'ask', NOTE, [], { ...MADE, text: 'Does a login item need a banner?' });
    ok(dir(), ['topic', 'answered', UNIT, 'note-window', '001-banner', '--entry', banner], { env: SESSION });
    writeIn(dir(), 'decide', NOTE, ['--answers', banner], { ...PERSON, text: 'A banner once.', why: 'Because.' });
    assert.match(refusedPristine(dir(), ['checklist', 'close', 'decided', UNIT, 'note-window'], { env: SESSION }).error, /has items open: closing-pass, decisions-entered/, 'marks before the last close count for nothing');
    markAllButTheClosingPass(dir(), UNIT, 'note-window');
    close();
    reverse(NOTE_MAP.price.answer, 'A price line at the end.');
    assert.match(output(dir(), shown, { env: SESSION }), /YOUR VERDICT \(1 of 1 call you changed\)\n {2}└─ Is pricing mentioned\?/, 'the departure given its verdict at the earlier close is not this close\'s');
    run(answer('verdict', 'n'));
    assert.match(screen(), /WHAT YOU DECIDED \(4\)\n {2}├─ How does first run open\?\n {2}├─ What is the screen titled\?\n {2}├─ Is pricing mentioned\?\n {2}└─ Does a login item need a banner\?\n\nCLAUDE'S CALLS \(3\)[\s\S]*MENU: decided/,
      'the call the product-record line widened is still Claude\'s');
    assert.strictEqual(readManifest(dir(), UNIT).phases.discussion.items['note-window'].status, 'in-progress', 'the topic is decided only by the gate\'s yes');
    const [widened, tour] = ok(dir(), ['ledger', 'product']).decisions;
    const again = ['render', 'decided', `${UNIT}.note-window`, '--file', payload({ lines: [{ text: 'Sync stays on.', why: 'Again.', widens: NOTE_MAP.sync.answer }], candidates: [] })];
    assert.strictEqual(refusedPristine(dir(), again, { env: SESSION }).error,
      `render decided: line 1 widens ${NOTE_MAP.sync.answer}: ${widened.id} widens it for the product already — "Sync is on once a folder is picked."`);
    const replaced = writeIn(dir(), 'replace', NOTE, ['--replaces', NOTE_MAP.sync.answer, '--reason', 'changed-mind'], { ...MADE, drops: ['on once a folder is picked'], text: 'Off until turned on.', why: 'The banner asks first.' });
    const resync = writeIn(dir(), 'replace', NOTE, ['--replaces', replaced, '--reason', 'changed-mind'], { ...MADE, drops: ['until turned on'], text: 'Off until the banner is answered.', why: 'The banner turns it on.' });
    const local = writeIn(dir(), 'replace', NOTE, ['--replaces', NOTE_MAP.shape.answer, '--reason', 'changed-mind'], { ...PERSON, drops: ['the tour'], text: 'The note window first.', why: 'Only this topic opens on it.' });
    staged(NO_PAYLOAD);
    const yes = ['decided', 'yes', UNIT, 'note-window'];
    const unreplaced = (/** @type {{id: string, text: string}} */ line) => `decided yes: the product record's line ${line.id}, "${line.text}", widens a decision of note-window replaced since, and nothing staged replaces or withdraws it — a line widening the replacement, or a withdrawal of the line, is staged with --file`;
    assert.strictEqual(refusedPristine(dir(), yes, { env: SESSION }).error, unreplaced(widened));
    const replacing = { text: 'Sync is off until you turn it on.', why: 'It holds for the product.', widens: resync };
    staged({ lines: [replacing], candidates: [] });
    assert.strictEqual(refusedPristine(dir(), yes, { env: SESSION }).error, unreplaced(tour), 'a line replacing one record line leaves the other still to replace or withdraw');
    const withdrawing = { line: tour.id, why: 'Only the note window opens on the tour now.' };
    const drawing = (/** @type {Record<string, unknown>} */ given) => ['render', 'decided', `${UNIT}.note-window`, '--file', payload(given)];
    assert.strictEqual(refusedPristine(dir(), drawing({ lines: [], withdraws: [withdrawing, withdrawing], candidates: [] }), { env: SESSION }).error,
      `render decided: withdrawal 2 withdraws ${tour.id}, as withdrawal 1 does`);
    assert.strictEqual(refusedPristine(dir(), drawing({ lines: [replacing], withdraws: [{ line: widened.id, why: 'Gone.' }], candidates: [] }), { env: SESSION }).error,
      `render decided: withdrawal 1 withdraws ${widened.id}, which line 1 replaces — a record line is replaced or withdrawn`);
    const both = staged({ lines: [replacing], withdraws: [withdrawing], candidates: [] });
    assert.match(sectionOf(both, 'DISPLAY: decided'), /\nFOR THE PRODUCT RECORD \(1 line · 1 withdrawn\)\n {2}· Sync is off until you turn it on\.\n {4}↳ Replaces: Sync is on once a folder is picked\.\n {2}· Only the note window opens on the tour now\.\n {4}↳ Withdraws: First run shows the product before it asks\.\n/);
    assert.match(sectionOf(both, 'MENU: decided'), /^Your yes marks Note Window decided, with the product-record line and the withdrawal\.$/m);
    const reshaped = writeIn(dir(), 'replace', NOTE, ['--replaces', local, '--reason', 'changed-mind'], { ...PERSON, drops: ['first'], text: 'The note window, then the tour.', why: 'The tour still helps.' });
    assert.match(refusedPristine(dir(), yes, { env: SESSION }).error, /^decided yes: withdrawal 1 cannot land — .*; it is staged again with --file$/, 'a withdrawal whose decision was replaced since it was staged lands nothing, the line beside it neither');
    staged({ lines: [replacing], withdraws: [withdrawing], candidates: [] });
    killedAt({ method: 'renameSync', file: `${UNIT}/manifest.json`, when: 'before' }, dir(), yes, { env: SESSION });
    const landed = entries().length;
    assert.deepStrictEqual(ok(dir(), ['ledger', 'product']).decisions.map((/** @type {{text: string}} */ d) => d.text), ['Sync is off until you turn it on.'], 'the replacement and the withdrawal landed before the kill');
    run(answer('decided', 'y'));
    assert.strictEqual(entries().length, landed, 'the yes run again lands neither a second time');
    assert.strictEqual(readManifest(dir(), UNIT).phases.discussion.items['note-window'].status, 'completed');
    assert.deepStrictEqual(ok(dir(), ['ledger', 'product']).decisions.map((/** @type {{text: string}} */ d) => d.text), ['Sync is off until you turn it on.'],
      'one rule stands: the line widening the replacement replaced the line widening the decision it replaced, and the withdrawn line left the record');
    const withdrawal = entries().filter(({ event }) => event === 'replaced').at(-1);
    assert.deepStrictEqual({ by: withdrawal.by, topic: withdrawal.topic, text: withdrawal.text, why: withdrawal.why, wide: withdrawal.product_wide, drops: withdrawal.drops, reliesOn: withdrawal.relies_on.map((/** @type {string} */ id) => id.startsWith(reshaped)) },
      { by: 'person', topic: null, text: 'The note window, then the tour.', why: 'Only the note window opens on the tour now.', wide: false, drops: ['First run shows the product before it asks.'], reliesOn: [true] },
      'the withdrawal replaces the line, at the unit\'s level and not for the product, by the decision the widened one now stands as');
    assert.ok(withdrawal.replaces.startsWith(tour.id));
  });

  it('voids the close with a message delivered since, its answer leaving it void, and the payload staged against it refused by the screen and the yes alike', () => {
    close();
    staged({ lines: [{ text: 'Sync is on everywhere.', why: 'Why.', widens: NOTE_MAP.sync.answer }], candidates: [] });
    const scratch = payload(NO_PAYLOAD);
    fs.writeFileSync(scratch, 'Sync off\n\nSpace homing decided sync stays off.\n');
    ok(dir(), ['topic', 'send', UNIT, 'note-window', '--from', 'space-homing', '--content', scratch, '--slug', 'sync-off'], { env: SESSION });
    const asked = NOTE_MAP.sync.question;
    ok(dir(), ['topic', 'answered', UNIT, 'note-window', '001-sync-off', '--entry', asked], { env: SESSION });
    const voided = 'decided.note-window was closed before a message delivered to note-window — its items are worked afresh and it is closed again';
    assert.strictEqual(refusedPristine(dir(), ['render', 'decided', `${UNIT}.note-window`], { env: SESSION }).error, `render decided: ${voided}`);
    assert.strictEqual(refusedPristine(dir(), ['decided', 'yes', UNIT, 'note-window'], { env: SESSION }).error, `decided yes: ${voided}`);
    markAllButTheClosingPass(dir(), UNIT, 'note-window');
    close();
    const earlier = 'what is staged for note-window was drawn for an earlier close — it is staged again with --file';
    assert.strictEqual(refusedPristine(dir(), ['render', 'decided', `${UNIT}.note-window`], { env: SESSION }).error, `render decided: ${earlier}`);
    assert.strictEqual(refusedPristine(dir(), ['decided', 'yes', UNIT, 'note-window'], { env: SESSION }).error, `decided yes: ${earlier}`);
  });

  it('voids the close with a question opened on the topic since — asked there, or moved to it — and never with a decision changed', () => {
    close();
    staged(NO_PAYLOAD);
    writeIn(dir(), 'replace', NOTE, ['--replaces', NOTE_MAP.title.answer, '--reason', 'changed-mind'], { ...MADE, drops: ['welcome'], text: 'Hello.', why: 'A comment at the gate.' });
    assert.match(screen(), /MENU: decided/, 'a decision changed at a comment leaves the close standing');
    const opened = 'was closed before a question opened on note-window — its items are worked afresh and it is closed again';
    writeIn(dir(), 'decide', NOTE, ['--answers', writeIn(dir(), 'ask', NOTE, [], { ...MADE, text: 'Is the window resizable?' })], { ...MADE, text: 'Yes.', why: 'Because.' });
    assert.strictEqual(refusedPristine(dir(), ['render', 'decided', `${UNIT}.note-window`], { env: SESSION }).error, `render decided: decided.note-window ${opened}`);
    markAllButTheClosingPass(dir(), UNIT, 'note-window');
    close();
    assert.match(staged(NO_PAYLOAD), /MENU: decided/);
    const homing = `${UNIT}.discussion.space-homing`;
    const moved = writeIn(dir(), 'ask', homing, [], { ...MADE, text: 'Does a note remember its space?' });
    writeIn(dir(), 'move', homing, ['--question', moved, '--to', 'note-window'], MADE);
    assert.match(refusedPristine(dir(), ['render', 'decided', `${UNIT}.note-window`], { env: SESSION }).error, new RegExp(opened));
  });
});

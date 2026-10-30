'use strict';

// ---------------------------------------------------------------------------
// The close a topic's decided gate stands on (leeway-engine/scripts/
// domain/checklist.cjs, domain/decided.cjs): a topic a message set back in
// progress closed afresh before its gate shows again, counting the verdicts
// its close asks, a decision the record widens already taking no second
// line and a replacement of it widened afresh (P9); a message delivered or
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

const { ok, output, refusedPristine, readManifest, statePath } = require('./engine-harness.cjs');
const { UNIT, SESSION, MADE, NOTE } = require('./ledger-world.cjs');
const { PERSON, NO_PAYLOAD, NOTE_MAP, writeIn, markAllButTheClosingPass, useDecidedWorld, decidedHelpers } = require('./decided-world.cjs');

const dir = useDecidedWorld();
const { close, payload, screen, staged, answer, run, reverse } = decidedHelpers(dir);

describe('a topic set back in progress (P9, 10.2.7)', () => {
  it('shows its gate again only once closed afresh, counting the verdicts this close asks, and the next decided takes the gate\'s yes again', () => {
    close();
    reverse(NOTE_MAP.title.answer, 'Hello.');
    staged({ lines: [{ text: 'Sync is on once a folder is picked.', why: 'It holds for the product.', widens: NOTE_MAP.sync.answer }], candidates: [] });
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
    const [widened] = ok(dir(), ['ledger', 'product']).decisions;
    const again = ['render', 'decided', `${UNIT}.note-window`, '--file', payload({ lines: [{ text: 'Sync stays on.', why: 'Again.', widens: NOTE_MAP.sync.answer }], candidates: [] })];
    assert.strictEqual(refusedPristine(dir(), again, { env: SESSION }).error,
      `render decided: line 1 widens ${NOTE_MAP.sync.answer}: ${widened.id} widens it for the product already — "Sync is on once a folder is picked."`);
    const resync = writeIn(dir(), 'replace', NOTE, ['--replaces', NOTE_MAP.sync.answer, '--reason', 'changed-mind'], { ...MADE, drops: ['on once a folder is picked'], text: 'Off until turned on.', why: 'The banner asks first.' });
    staged({ lines: [{ text: 'Sync is off until you turn it on.', why: 'It holds for the product.', widens: resync }], candidates: [] });
    run(answer('decided', 'y'));
    assert.strictEqual(readManifest(dir(), UNIT).phases.discussion.items['note-window'].status, 'completed');
    assert.deepStrictEqual(ok(dir(), ['ledger', 'product']).decisions.map((/** @type {{text: string}} */ d) => d.text), ['Sync is on once a folder is picked.', 'Sync is off until you turn it on.'],
      'a replacement is another decision, widened afresh');
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

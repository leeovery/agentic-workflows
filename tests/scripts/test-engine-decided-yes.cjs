'use strict';

// ---------------------------------------------------------------------------
// A topic's decided gate answered (leeway-engine/scripts/domain/
// decided.cjs): `engine decided yes`, the person's yes landing each line as
// a product-wide decision of its own at the unit's level (8.S25), the
// candidates not struck on the epic's map, the topic decided and what comes
// next; a refused yes writing nothing, and a yes run again after a kill
// landing nothing twice — a restage after it taking no second line; the
// yes refused with nothing staged, a verdict still to ask, or no
// conversation; and a product-record line changed through a comment, never
// struck (9.S55).
//
// Layer: verb. World: the decided suites' (decided-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const { ok, refusedPristine, readManifest, statePath, lastMessage, killedAt } = require('./engine-harness.cjs');
const { UNIT, SESSION, MADE, NOTE, ledgerHelpers } = require('./ledger-world.cjs');
const { SOLO, NO_PAYLOAD, NOTE_MAP, writeIn, sectionOf, useDecidedWorld, decidedHelpers } = require('./decided-world.cjs');

const dir = useDecidedWorld();
const { close, payload, staged, answer, run, reverse } = decidedHelpers(dir);
const { entries, full } = ledgerHelpers(dir);

describe('the decided gate\'s yes (8.S25, 9.7.3)', () => {
  it('stages the lines and the candidates in the cache, nothing on the ledger or the map, then lands each line as the person\'s product-wide decision, the candidates on the map, the topic decided, and the epic\'s menu next', () => {
    close();
    const before = entries().length;
    const out = staged({
      lines: [
        { text: 'Sync stays off until you turn it on.', why: 'The sync call holds for the whole product.', widens: NOTE_MAP.sync.answer },
        { text: 'First run shows the product before it asks.', why: 'The tour first holds everywhere.', widens: NOTE_MAP.shape.answer },
      ],
      candidates: [{ name: 'removing-fumi', reason: 'Nothing decides what removing Fumi takes back.' }],
    });
    assert.strictEqual(entries().length, before, 'nothing reaches the ledger before the yes (P10)');
    assert.ok(!('removing-fumi' in readManifest(dir(), UNIT).phases.discovery.items), 'nor the map');
    assert.ok(fs.existsSync(statePath(dir(), '.cache', UNIT, 'discussion', 'note-window', 'decided.json')), 'the payload is staged in the topic\'s cache');
    assert.match(sectionOf(out, 'MENU: decided'), /^Your yes marks Note Window decided, with the 2 product-record lines and the candidate\.$/m);

    const yes = answer('decided', 'y');
    assert.deepStrictEqual(yes, { kind: 'engine', argv: ['decided', 'yes', UNIT, 'note-window'] });
    const map = ok(dir(), ['ledger', 'map', UNIT, 'note-window']).questions;
    const res = run(yes);
    const lines = entries().slice(before);
    assert.deepStrictEqual(lines.map(({ event, topic, by, given, who_moved_whom: moved, product_wide: wide, relies_on: reliesOn, text }) => ({ event, topic, by, given, moved, wide, reliesOn, text })), [
      { event: 'asked', topic: null, by: 'claude', given: undefined, moved: 'none', wide: undefined, reliesOn: [full(NOTE_MAP.sync.answer)], text: 'Is sync on at first run?' },
      { event: 'decided', topic: null, by: 'person', given: 'own', moved: 'none', wide: true, reliesOn: [full(NOTE_MAP.sync.answer)], text: 'Sync stays off until you turn it on.' },
      { event: 'asked', topic: null, by: 'claude', given: undefined, moved: 'none', wide: undefined, reliesOn: [full(NOTE_MAP.shape.answer)], text: 'How does first run open?' },
      { event: 'decided', topic: null, by: 'person', given: 'own', moved: 'none', wide: true, reliesOn: [full(NOTE_MAP.shape.answer)], text: 'First run shows the product before it asks.' },
    ]);
    assert.deepStrictEqual([lines[1].answers, lines[3].answers], [lines[0].id, lines[2].id], 'each line answers its own question, at the unit\'s level');
    assert.deepStrictEqual(ok(dir(), ['ledger', 'map', UNIT, 'note-window']).questions, map, 'the topic\'s map is as it was: a line answers none of its questions');
    assert.deepStrictEqual(ok(dir(), ['ledger', 'product']).decisions.map((/** @type {{text: string}} */ d) => d.text), ['Sync stays off until you turn it on.', 'First run shows the product before it asks.']);
    const manifest = readManifest(dir(), UNIT);
    assert.deepStrictEqual(manifest.phases.discovery.items['removing-fumi'], { routing: 'discussion', source: 'topic:note-window', summary: 'Nothing decides what removing Fumi takes back.' });
    assert.strictEqual(manifest.phases.discussion.items['note-window'].status, 'completed');
    assert.deepStrictEqual(res.next, { kind: 'handoff', skill: 'leeway-continue-epic', args: [UNIT, 'discussion', 'completed'] });
    assert.deepStrictEqual([res.lines.length, res.candidates, res.warnings], [2, ['removing-fumi'], undefined]);
    assert.strictEqual(lastMessage(dir()), 'decided(fumi): note-window');
    assert.ok(!fs.existsSync(statePath(dir(), '.cache', UNIT, 'discussion', 'note-window', 'decided.json')), 'the staged payload goes');
  });

  it('checks every line before it writes one: a refused yes lands nothing, and once staged again each line lands once', () => {
    close();
    const lines = [
      { text: 'First run shows the product before it asks.', why: 'The tour first holds everywhere.', widens: NOTE_MAP.shape.answer },
      { text: 'Sync is on once a folder is picked.', why: 'The sync call holds for the whole product.', widens: NOTE_MAP.sync.answer },
    ];
    staged({ lines, candidates: [] });
    const replacement = writeIn(dir(), 'replace', NOTE, ['--replaces', NOTE_MAP.sync.answer, '--reason', 'changed-mind'], { ...MADE, drops: ['on by default'], text: 'Sync is off until turned on.', why: 'A comment at the gate.' });
    const before = entries().length;
    assert.match(refusedPristine(dir(), ['decided', 'yes', UNIT, 'note-window'], { env: SESSION }).error, /^decided yes: line 2 cannot land — .*; it is staged again with --file$/);
    assert.strictEqual(entries().length, before, 'line 1 never landed');
    staged({ lines: [lines[0], { ...lines[1], text: 'Sync is off until turned on.', widens: replacement }], candidates: [{ name: 'removing-fumi', reason: 'R.' }] });
    ok(dir(), ['discovery-map', 'add', UNIT, 'removing-fumi', 'discussion', '--summary', 'Added at the map meanwhile.'], { env: SESSION });
    assert.strictEqual(refusedPristine(dir(), ['decided', 'yes', UNIT, 'note-window'], { env: SESSION }).error,
      'decided yes: the candidates: "removing-fumi" is already on the map — nothing was added; edit it, or pick a different name');
    assert.strictEqual(entries().length, before, 'a candidate the map now refuses lands no line either');
    staged({ lines: [lines[0], { ...lines[1], text: 'Sync is off until turned on.', widens: replacement }], candidates: [] });
    run(answer('decided', 'y'));
    assert.deepStrictEqual(ok(dir(), ['ledger', 'product']).decisions.map((/** @type {{text: string}} */ d) => d.text), ['First run shows the product before it asks.', 'Sync is off until turned on.']);
  });

  it('lands no line twice when a yes killed after its lines landed is run again, each line keeping the ids it was staged with', () => {
    close();
    staged({ lines: [{ text: 'First run shows the product before it asks.', why: 'The tour first holds everywhere.', widens: NOTE_MAP.shape.answer }], candidates: [] });
    killedAt({ method: 'renameSync', file: `${UNIT}/manifest.json`, when: 'before' }, dir(), ['decided', 'yes', UNIT, 'note-window'], { env: SESSION });
    assert.deepStrictEqual(ok(dir(), ['ledger', 'product']).decisions.map((/** @type {{text: string}} */ d) => d.text), ['First run shows the product before it asks.'], 'the line landed before the kill');
    assert.strictEqual(readManifest(dir(), UNIT).phases.discussion.items['note-window'].status, 'in-progress');
    const restaged = ['render', 'decided', `${UNIT}.note-window`, '--file', payload({ lines: [{ text: 'First run shows the product first.', why: 'Again.', widens: NOTE_MAP.shape.answer }], candidates: [] })];
    assert.match(refusedPristine(dir(), restaged, { env: SESSION }).error, /^render decided: line 1 widens \S+: \S+ widens it for the product already — "First run shows the product before it asks\."$/, 'a restage after the kill lands the line no second time');
    run(answer('decided', 'y'));
    assert.deepStrictEqual(ok(dir(), ['ledger', 'product']).decisions.map((/** @type {{text: string}} */ d) => d.text), ['First run shows the product before it asks.']);
    assert.strictEqual(readManifest(dir(), UNIT).phases.discussion.items['note-window'].status, 'completed');
  });

  it('hands a feature\'s decided topic off to its specification', () => {
    close(SOLO, SOLO);
    staged(NO_PAYLOAD, `${SOLO}.${SOLO}`);
    assert.deepStrictEqual(run(answer('decided', 'y')).next, { kind: 'handoff', skill: 'leeway-specification-process', args: ['feature', SOLO] });
  });

  it('refuses with nothing staged, while a verdict is still to ask, and without a conversation, writing nothing', () => {
    close();
    const yes = ['decided', 'yes', UNIT, 'note-window'];
    assert.match(refusedPristine(dir(), yes, { env: SESSION }).error, /^decided yes: nothing is staged for note-window — render decided fumi\.note-window --file <payload\.json> stages Claude's lines and candidates$/);
    staged(NO_PAYLOAD);
    assert.match(refusedPristine(dir(), yes, { env: { CLAUDE_CODE_SESSION_ID: undefined } }).error, /^decided yes: no conversation to write in/);
    reverse(NOTE_MAP.title.answer, 'Hello.');
    assert.strictEqual(refusedPristine(dir(), yes, { env: SESSION }).error, 'decided yes: a verdict is still to ask — render decided asks each before the yes');
  });

  it('offers no strike for a product-record line: a comment changes it, staged again (9.S55)', () => {
    close();
    const out = staged({ lines: [{ text: 'Sync is on.', why: 'Why.', widens: NOTE_MAP.sync.answer }], candidates: [] });
    const gate = sectionOf(out, 'MENU: decided');
    assert.ok(!gate.includes('s/strike'), 'a line has no strike of its own');
    assert.match(gate, /^\*\*Comment\*\* → Tell me what to change — a product-record line included$/m);
    ok(dir(), ['gate', 'decided', '--typed', 'comment'], { env: SESSION });
    assert.match(staged({ lines: [{ text: 'Sync stays off.', why: 'The person said so.', widens: NOTE_MAP.sync.answer }], candidates: [] }), /· Sync stays off\./);
    run(answer('decided', 'y'));
    assert.deepStrictEqual(ok(dir(), ['ledger', 'product']).decisions.map((/** @type {{text: string}} */ d) => d.text), ['Sync stays off.']);
  });
});

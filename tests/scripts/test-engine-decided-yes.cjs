'use strict';

// ---------------------------------------------------------------------------
// A topic's decided gate answered (leeway-engine/scripts/domain/
// decided.cjs): `engine decided yes`, the person's yes landing each line as
// a product-wide decision of its own at the unit's level (8.S25), the
// candidates not struck on the epic's map with their briefs (8.S59), by
// every check `topic add-batch` makes, a roadmap twin among them (8.1.6),
// or in a unit with one topic parked on the roadmap (8.S31), the struck
// names recorded as the person's answer and refused when a later close
// stages them (8.S60), the topic decided and
// what comes next, the counts it covers in words; a refused yes writing
// nothing, and a yes run again after a kill
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

const { ok, refusedPristine, sectionOf, readManifest, readState, statePath, layout, stateGit, lastMessage, killedAt } = require('./engine-harness.cjs');
const { UNIT, SESSION, MADE, NOTE, ledgerHelpers } = require('./ledger-world.cjs');
const { SOLO, SOLO_LOG, NO_PAYLOAD, NOTE_MAP, writeIn, markAllButTheClosingPass, useDecidedWorld, decidedHelpers } = require('./decided-world.cjs');

const dir = useDecidedWorld();
const { close, payload, candidate, staged, answer, run, reverse } = decidedHelpers(dir);
const { entries, full } = ledgerHelpers(dir);

/** The paths the state's last commit wrote. */
const committedPaths = () => stateGit(dir(), ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n');

describe('the decided gate\'s yes (8.S25, 8.S28, 9.7.3)', () => {
  it('stages the lines and the candidates in the cache, nothing on the ledger or the map, then lands each line as the person\'s product-wide decision, the candidates not struck on the map, the topic decided, and the epic\'s menu next', () => {
    close();
    const taken = candidate('removing-fumi', 'Nothing decides what removing Fumi takes back.');
    const before = entries().length;
    const out = staged({
      lines: [
        { text: 'Sync stays off until you turn it on.', why: 'The sync call holds for the whole product.', widens: NOTE_MAP.sync.answer },
        { text: 'First run shows the product before it asks.', why: 'The tour first holds everywhere.', widens: NOTE_MAP.shape.answer },
      ],
      candidates: [taken, candidate('dock-icon', 'S.')],
    });
    assert.strictEqual(entries().length, before, 'nothing reaches the ledger before the yes (P10)');
    assert.ok(!('removing-fumi' in readManifest(dir(), UNIT).phases.discovery.items), 'nor the map');
    assert.ok(fs.existsSync(statePath(dir(), '.cache', UNIT, 'discussion', 'note-window', 'decided.json')), 'the payload is staged in the topic\'s cache');
    assert.match(sectionOf(out, 'MENU: decided'), /^Your yes marks Note Window decided, with the two product-record lines and the two candidates\.$/m);
    ok(dir(), ['decided', 'strike', UNIT, 'note-window', '2'], { env: SESSION });

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
    const product = ok(dir(), ['ledger', 'product']);
    assert.deepStrictEqual([product.findings, product.decisions.map((/** @type {{text: string}} */ d) => d.text), product.discovery], [[], ['Sync stays off until you turn it on.', 'First run shows the product before it asks.'], []],
      '8.S28: with no product conversation, the product record holds the lines the yes landed and nothing else');
    const manifest = readManifest(dir(), UNIT);
    assert.deepStrictEqual(manifest.phases.discovery.items['removing-fumi'], { source: 'topic:note-window', summary: 'Nothing decides what removing Fumi takes back.' });
    assert.strictEqual(readState(dir(), layout.unit(UNIT, 'topics/removing-fumi/brief.md')), '# removing-fumi\n\nWhat it is, where it was read, why it matters, its open questions.\n',
      '8.S59: the taken candidate lands with its brief, the draft installed');
    assert.ok(!fs.existsSync(taken.brief), 'the draft is consumed');
    assert.ok(!('dock-icon' in manifest.phases.discovery.items), 'the struck candidate stays off the map');
    assert.deepStrictEqual(manifest.phases.discovery.dismissed, ['dock-badge', 'dock-icon'], '8.S60: the struck candidate is the person\'s answer, beside the names struck before');
    assert.strictEqual(manifest.phases.discussion.items['note-window'].status, 'completed');
    assert.deepStrictEqual(res.next, { kind: 'handoff', skill: 'leeway-continue-epic', args: [UNIT, 'discussion', 'completed'] });
    assert.deepStrictEqual([res.lines.length, res.candidates, res.struck, res.parked, res.warnings], [2, ['removing-fumi'], ['dock-icon'], undefined, undefined]);
    assert.strictEqual(lastMessage(dir()), 'decided(fumi): note-window');
    assert.deepStrictEqual(committedPaths(), [layout.manifest(UNIT), layout.brief(UNIT, 'removing-fumi')].sort(), 'the yes commits the map and the brief it installed');
    assert.ok(!fs.existsSync(statePath(dir(), '.cache', UNIT, 'discussion', 'note-window', 'decided.json')), 'the staged payload goes');
  });

  it('8.S60: refuses a name the person struck at a yes when a later close stages it', () => {
    close();
    staged({ lines: [], candidates: [candidate('dock-icon', 'S.')] });
    ok(dir(), ['decided', 'strike', UNIT, 'note-window', '1'], { env: SESSION });
    run(answer('decided', 'y'));
    markAllButTheClosingPass(dir(), UNIT, 'space-homing');
    close(UNIT, 'space-homing');
    assert.strictEqual(refusedPristine(dir(), ['render', 'decided', `${UNIT}.space-homing`, '--file', payload({ lines: [], candidates: [candidate('dock-icon', 'Again.')] })], { env: SESSION }).error,
      'render decided: the candidates: "dock-icon" was previously dismissed from this map — nothing was added; the person re-adds it on the map');
  });

  it('lands the candidates by every check topic add-batch makes: a twin of a waiting roadmap item, appearing since the screen, refuses the yes; taken in, the item leaves the roadmap with it (8.1.6)', () => {
    close();
    const line = { text: 'Sync stays off until you turn it on.', why: 'The sync call holds for the whole product.', widens: NOTE_MAP.sync.answer };
    staged({ lines: [line], candidates: [candidate('widget-sync', 'Nothing owns syncing widgets.')] });
    ok(dir(), ['roadmap', 'add', 'widget-sync', '--horizon', 'later', '--summary', 'Sync widgets.'], { env: SESSION });
    const [before, ledger] = [readState(dir(), layout.manifest(UNIT)), entries().length];
    assert.strictEqual(refusedPristine(dir(), ['decided', 'yes', UNIT, 'note-window'], { env: SESSION }).error,
      'decided yes: the candidates: "widget-sync" would stand beside the waiting roadmap item of its name — take it in with "from_roadmap": "widget-sync", or name the topic apart');
    assert.deepStrictEqual([readState(dir(), layout.manifest(UNIT)), entries().length], [before, ledger], 'the twin is checked before the line lands');
    staged({ lines: [line], candidates: [{ ...candidate('widget-sync', 'Nothing owns syncing widgets.'), from_roadmap: 'widget-sync' }] });
    run(answer('decided', 'y'));
    assert.deepStrictEqual([readManifest(dir(), UNIT).phases.discovery.items['widget-sync'].source, ok(dir(), ['roadmap', 'state']).items.find((/** @type {{name: string}} */ i) => i.name === 'widget-sync').state],
      ['topic:note-window,roadmap:widget-sync', 'in-flight']);
    assert.ok(committedPaths().includes(layout.projectManifest), 'the project manifest rides the yes\'s commit');
  });

  it('8.S31: in a unit with one topic, the yes parks each candidate standing on the horizon the person named, from the topic and pointing into its log; a struck one is recorded as the person\'s answer, which they can roadmap themselves (8.10.11)', () => {
    close(SOLO, SOLO);
    const shown = staged({ lines: [], candidates: [{ name: 'streak-freeze', reason: 'Nothing decides what a missed day costs.', horizon: 'later' }, { name: 'tally-widget', reason: 'S.', horizon: 'next' }] }, `${SOLO}.${SOLO}`);
    assert.match(sectionOf(shown, 'DISPLAY: decided'), /\nTO THE ROADMAP \(2\)\n {2}├─ ○ Streak Freeze +\[later\]\n/);
    assert.match(sectionOf(shown, 'MENU: decided'), /^Your yes marks Solo decided, with the two roadmap items\.$/m);
    assert.match(sectionOf(shown, 'MENU: decided'), /^\*\*`s\/strike`\*\* +→ Strike a candidate — it doesn't go on the roadmap$/m);
    ok(dir(), ['decided', 'strike', SOLO, SOLO, '2'], { env: SESSION });

    const res = run(answer('decided', 'y'));
    assert.deepStrictEqual([res.candidates, res.parked, res.struck], [['streak-freeze'], [{ name: 'streak-freeze', horizon: 'later' }], ['tally-widget']]);
    const { roadmap } = JSON.parse(readState(dir(), layout.projectManifest));
    assert.deepStrictEqual([roadmap.horizons, roadmap.items['streak-freeze'], roadmap.items['tally-widget']],
      [['later'], { horizon: 'later', summary: 'Nothing decides what a missed day costs.', kind: 'idea', origin: `topic:${SOLO}/${SOLO}`, sources: [SOLO_LOG] }, undefined]);
    assert.deepStrictEqual(readManifest(dir(), SOLO).phases.discovery, { dismissed: ['tally-widget'] }, 'the struck name is the person\'s answer, and the unit gains no map');
    assert.deepStrictEqual(committedPaths(), [layout.projectManifest, layout.manifest(SOLO)].sort(), 'the park rides the yes\'s commit');
    ok(dir(), ['roadmap', 'add', 'tally-widget', '--horizon', 'next', '--summary', 'S.'], { env: SESSION });
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
    staged({ lines: [lines[0], { ...lines[1], text: 'Sync is off until turned on.', widens: replacement }], candidates: [candidate('removing-fumi', 'R.')] });
    ok(dir(), ['topic', 'add', UNIT, 'removing-fumi', '--summary', 'Added at the map meanwhile.', '--brief', candidate('removing-fumi', 'R.').brief], { env: SESSION });
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

  it('offers no strike for a product-record line: a comment changes it (9.S55)', () => {
    close();
    const out = staged({ lines: [{ text: 'Sync is on.', why: 'Why.', widens: NOTE_MAP.sync.answer }], candidates: [] });
    const gate = sectionOf(out, 'MENU: decided');
    assert.ok(!gate.includes('s/strike'), 'a line has no strike of its own');
    assert.match(gate, /^\*\*Comment\*\* → Tell me what to change — a product-record line included$/m);
    ok(dir(), ['gate', 'decided', '--typed', 'comment'], { env: SESSION });
  });
});

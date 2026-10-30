'use strict';

// ---------------------------------------------------------------------------
// A topic's close (leeway-engine/scripts/domain/decided.cjs, its screens
// domain/projections/decided.cjs, the close it stands on
// domain/checklist.cjs): `engine render decided`, the decided screen once
// the topic's checklist is closed — what the person decided, Claude's calls
// counted by kind and listed on asking, the product-record lines and the
// candidates Claude's payload stages, every skip with its reason (6.S12),
// a verdict asked of each departure on the topic one at a time (16.S33),
// none where the person changed none (16.S34), then the decided gate
// (9.S21); nothing on the ledger or the map before the yes; `engine decided
// yes`, the person's yes landing each line as a product-wide decision
// (8.S25), the candidates not struck on the epic's map, the topic decided
// and what comes next; `engine decided strike` and `render decided-strike`
// (P8); a product-record line changed through a comment, never struck
// (9.S55); the screen refused while the checklist is open, a payload
// staged for an earlier close refused, a refused yes writing nothing and a
// yes run again after a kill landing nothing twice; a restage keeping the
// strikes; a message delivered or a question opened since the close voiding
// it, a decision changed since voiding nothing, and a topic a message set
// back in progress closed afresh before its gate shows again (P9); a
// running experiment holding the close (9.S61); and the wait for the
// topic's agents still running (9.S63).
//
// Layer: verb. Worlds, built once and copied: an epic, `fumi`, its two
// topics under discussion, the note window's map written through the
// ledger's verbs — the person's own answer, Claude's calls of two kinds and
// one unlabelled, a call handed over — and its decided checklist marked but
// for the closing pass; and a feature, `solo`, whose one question the
// person answered, its checklist marked but for the closing pass. Each test
// keeps the trust log in a config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, output, refusedPristine, readManifest, statePath, fixtureFrom, cleanupFixture, lastMessage, killedAt } = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, MADE, NOTE, SPACE, row, ledgerHelpers } = require('./ledger-world.cjs');

const SOLO = 'solo';
const SOLO_AT = `${SOLO}.discussion.${SOLO}`;
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });

/** Claude's items of the decided checklist, but the closing pass. */
const MARKED = ['decisions-entered', 'replacements-checked', 'conflicts-read', 'findings-rerun', 'product-lines-shown'];

/** The decided checklist of `topic`, as the world's manifests hold it: marked but for the closing pass. @param {string} topic */
function markedButTheClosingPass(topic) {
  const items = Object.fromEntries(MARKED.map((item) => [item, { state: 'done', at: '2026-10-01T09:00:00.000Z' }]));
  return { decided: { [topic]: { items } } };
}

/** The decided checklist of `unit`'s `topic` marked again but for the closing pass. @param {string} dir @param {string} unit @param {string} topic */
function markAllButTheClosingPass(dir, unit, topic) {
  for (const item of MARKED) ok(dir, ['checklist', 'done', 'decided', unit, topic, item], { env: SESSION });
}

/** One ledger write in `dir`: its short id. @param {string} dir @param {string} verb @param {string} at @param {string[]} flags @param {Record<string, unknown>} content */
function writeIn(dir, verb, at, flags, content) {
  return ok(dir, ['ledger', verb, at, ...flags], { env: SESSION, stdin: JSON.stringify(content) }).id;
}

/** A question asked at `at` and answered as `answer` says: both short ids. @param {string} dir @param {string} at @param {string} text @param {Record<string, unknown>} answer */
function answeredIn(dir, at, text, answer) {
  const question = writeIn(dir, 'ask', at, [], { ...MADE, text });
  return { question, answer: writeIn(dir, 'decide', at, ['--answers', question], { why: 'Because.', ...answer }) };
}

/** The note window's entries, by name, as the world wrote them. @type {Record<string, {question: string, answer: string}>} */
const NOTE_MAP = {};

const world = fixtureFrom('decided-', (dir) => {
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: { 'note-window': row(1, 'The note window'), 'space-homing': row(2, 'Where notes open') }, dismissed: ['dock-badge'] },
      discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
    },
    checklists: markedButTheClosingPass('note-window'),
  });
  createManifest(dir, SOLO, { phases: { discussion: { items: { [SOLO]: { status: 'in-progress' } } } }, checklists: markedButTheClosingPass(SOLO) });
  Object.assign(NOTE_MAP, {
    shape: answeredIn(dir, NOTE, 'How does first run open?', { ...PERSON, text: 'The tour first.' }),
    title: answeredIn(dir, NOTE, 'What is the screen titled?', { ...MADE, text: 'Welcome.', kind: 'words' }),
    sync: answeredIn(dir, NOTE, 'Is sync on at first run?', { ...MADE, text: 'On, once a folder is picked.', kind: 'behaviour' }),
    price: answeredIn(dir, NOTE, 'Is pricing mentioned?', { ...MADE, text: 'Not in first run.', kind: 'behaviour' }),
    banner: answeredIn(dir, NOTE, 'Is there a login item banner?', { ...MADE, text: 'No banner.' }),
    corner: answeredIn(dir, NOTE, 'Which corner does a note open in?', { ...MADE, given: 'your-call', text: 'Top left.' }),
  });
  answeredIn(dir, SOLO_AT, 'Does a tally reset daily?', { ...PERSON, text: 'At midnight.' });
});

const config = useTempFolder('decided-config-');

/** @type {string} */
let dir;
/** @type {string|undefined} */
let pinned;

beforeEach(() => {
  dir = world();
  pinned = process.env.LEEWAY_CONFIG_DIR;
  process.env.LEEWAY_CONFIG_DIR = config();
});

afterEach(() => {
  process.env.LEEWAY_CONFIG_DIR = pinned;
  cleanupFixture(dir);
});

const { entries, full } = ledgerHelpers(() => dir);

/** The closing pass marked done on `unit`'s `topic`, and the checklist closed. @param {string} [unit] @param {string} [topic] */
function close(unit = UNIT, topic = 'note-window') {
  ok(dir, ['checklist', 'done', 'decided', unit, topic, 'closing-pass'], { env: SESSION });
  return ok(dir, ['checklist', 'close', 'decided', unit, topic], { env: SESSION });
}

/** Claude's payload written to the cache: its path. @param {Record<string, unknown>} payload */
function payload(payload) {
  const file = statePath(dir, '.cache', 'scratch', `decided-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload));
  return file;
}

const NO_PAYLOAD = Object.freeze({ lines: [], candidates: [] });

/** The decided screen of `address`, `flags` given. @param {string[]} [flags] @param {string} [address] */
function screen(flags = [], address = `${UNIT}.note-window`) {
  return output(dir, ['render', 'decided', address, ...flags], { env: SESSION });
}

/** The screen staged from `given`. @param {Record<string, unknown>} given @param {string} [address] */
function staged(given, address) {
  return screen(['--file', payload(given)], address);
}

/** The person's answer at the gate shown: what it leads to. @param {string} name @param {string} key */
function answer(name, key) {
  return ok(dir, ['gate', name, '--pick', key], { env: SESSION }).next;
}

/** What a gate's `next` of kind engine runs, answered. @param {{kind: string, argv: string[]}} next */
function run(next) {
  assert.strictEqual(next.kind, 'engine');
  return next.argv[0] === 'render' ? output(dir, next.argv, { env: SESSION }) : ok(dir, next.argv, { env: SESSION });
}

/** The person's reversal of Claude's call on the note window: the departure's short id. @param {string} call @param {string} text */
function reverse(call, text) {
  return writeIn(dir, 'replace', NOTE, ['--replaces', call, '--reason', 'changed-mind'], { by: 'person', drops: ['the old answer'], text, why: 'The person wants it so.' });
}

/** A section of a render by its marker's name. @param {string} out @param {string} name */
function sectionOf(out, name) {
  const at = out.indexOf(`=== ${name} (`);
  assert.ok(at !== -1, `no ${name} section in:\n${out}`);
  const body = out.slice(out.indexOf('\n', at) + 1);
  const end = body.search(/^=== /m);
  return end === -1 ? body : body.slice(0, end);
}

describe('the decided screen (9.7.3, 9.S21)', () => {
  it('shows what the person decided, Claude\'s calls by kind with those unlabelled said so, the lines, the candidates and the skip, then the decided gate', () => {
    ok(dir, ['checklist', 'skip', 'decided', UNIT, 'note-window', 'closing-pass', '--reason', 'its third re-read reworded one line, and nothing else moved'], { env: SESSION });
    ok(dir, ['checklist', 'close', 'decided', UNIT, 'note-window'], { env: SESSION });
    const out = staged({
      lines: [{ text: 'First run shows the product before it asks for anything.', why: 'The tour-first call holds for every first run.', widens: NOTE_MAP.shape.answer }],
      candidates: [{ name: 'removing-fumi', reason: 'First run asks for a login item, and no topic decides what removing Fumi takes back.' }],
    });
    assert.strictEqual(sectionOf(out, 'DISPLAY: decided'), [
      'Note Window — decided',
      '',
      'WHAT YOU DECIDED (1)',
      '  └─ How does first run open?',
      '',
      'CLAUDE\'S CALLS (5)',
      '  2 behaviour · 1 words · 2 unlabelled — the labeller gives each its kind',
      '',
      'FOR THE PRODUCT RECORD (1 line)',
      '  · First run shows the product before it asks for anything.',
      '',
      'NEW-TOPIC CANDIDATES (1)',
      '  └─ ○ Removing Fumi',
      '        First run asks for a login item, and no topic decides',
      '        what removing Fumi takes back.',
      '',
      '  ⚑ Skipped: the closing pass run, and its last re-read changing',
      '    nothing — its third re-read reworded one line, and nothing',
      '    else moved',
      '',
    ].join('\n'));
    assert.ok(!out.includes('YOUR VERDICT'), 'the person changed no call, so no verdict is asked (16.S34)');
    const gate = sectionOf(out, 'MENU: decided');
    assert.match(gate, /^Your yes marks Note Window decided, with the product-record line and the candidate\.$/m);
    assert.deepStrictEqual([...gate.matchAll(/^\*\*`?([a-z/]+|Comment)`?\*\*/gm)].map((m) => m[1]), ['y/yes', 'c/calls', 's/strike', 'Comment']);
  });

  it('lists Claude\'s calls with --calls, each under its kind, and draws the gate without the calls row', () => {
    close();
    staged(NO_PAYLOAD);
    const out = screen(['--calls']);
    assert.match(sectionOf(out, 'DISPLAY: decided'), /CLAUDE'S CALLS \(5\)\n {2}2 behaviour · 1 words · 2 unlabelled — the labeller gives each its kind\n {2}├─ ◇ What is the screen titled\? +\[words\]\n {2}│ {5}Welcome\.\n/);
    assert.match(out, /◇ Which corner does a note open in\? +\[unlabelled\]/, 'a call handed over is Claude\'s');
    assert.ok(!sectionOf(out, 'MENU: decided').includes('c/calls'));
  });

  it('refuses while the checklist is open, writing nothing; once the item is skipped and the checklist closed it shows the skip (6.S12)', () => {
    const shown = ['render', 'decided', `${UNIT}.note-window`, '--file', payload(NO_PAYLOAD)];
    assert.match(refusedPristine(dir, shown, { env: SESSION }).error, /^render decided: decided\.note-window is open — its items are worked, then it is closed: checklist close decided fumi note-window$/);
    ok(dir, ['checklist', 'skip', 'decided', UNIT, 'note-window', 'closing-pass', '--reason', 'one reader ran'], { env: SESSION });
    ok(dir, ['checklist', 'close', 'decided', UNIT, 'note-window'], { env: SESSION });
    assert.match(output(dir, shown, { env: SESSION }), /⚑ Skipped: the closing pass run, and its last re-read changing\n {4}nothing — one reader ran/);
  });

  it('asks a verdict of each call the person changed on the topic, one at a time, a skip moving on, then the gate (16.S33)', () => {
    close();
    const homing = answeredIn(dir, SPACE, 'Does a space remember its notes?', { ...MADE, text: 'Yes.' });
    const elsewhere = writeIn(dir, 'replace', SPACE, ['--replaces', homing.answer, '--reason', 'changed-mind'], { by: 'person', drops: ['the old answer'], text: 'No.', why: 'The person wants it so.' });
    const sync = reverse(NOTE_MAP.sync.answer, 'Off until you turn it on.');
    const price = reverse(NOTE_MAP.price.answer, 'A price line at the end.');
    const first = staged(NO_PAYLOAD);
    assert.match(sectionOf(first, 'DISPLAY: decided'), /YOUR VERDICT \(1 of 2 calls you changed\)\n {2}└─ Is sync on at first run\?\n {8}My answer: On, once a folder is picked\.\n {8}Yours: Off until you turn it on\.\n$/);
    assert.ok(!first.includes('MENU: decided'), 'the gate waits on the verdicts');
    const rows = [...sectionOf(first, 'MENU: verdict').matchAll(/^\*\*`([a-z]\/[a-z]+)`\*\*/gm)].map((m) => m[1]);
    assert.deepStrictEqual(rows, ['n/nothing', 'f/fix', 'l/loss', 's/skip']);
    const given = run(answer('verdict', 'n'));
    assert.deepStrictEqual(given, { ok: true, entry: sync, verdict: 'nothing', point: 'decided' });
    assert.match(screen(), /YOUR VERDICT \(2 of 2 calls you changed\)\n {2}└─ Is pricing mentioned\?/);
    assert.strictEqual(run(answer('verdict', 's')).entry, price);
    const last = screen();
    assert.ok(!last.includes('YOUR VERDICT'), 'a skip was asked: it waits in the verdict queue, never asked here again');
    assert.match(last, /MENU: decided/);
    assert.deepStrictEqual(ok(dir, ['verdict', 'queue']).departures.map((/** @type {{id: string}} */ d) => d.id), [elsewhere, price], 'the skipped verdict waits in the queue (16.10.6), and the departure on another topic, never asked here');
  });

  it('refuses a payload that names no decision on the map, a candidate the map cannot take or a feature has no map for, and one of another shape, staging nothing', () => {
    close();
    close(SOLO, SOLO);
    const finding = writeIn(dir, 'find', NOTE, [], { ...MADE, text: 'Fumi asks for Accessibility.', how: 'read the code', known: 'read' });
    const cases = [
      [{ lines: [{ text: 'A rule.', why: 'Why.', widens: finding }], candidates: [] }, `line 1 widens ${finding}: ${finding} is no decision`],
      [{ lines: [{ text: 'A rule.', why: 'Why.', widens: NOTE_MAP.shape.question }], candidates: [] }, `line 1 widens ${NOTE_MAP.shape.question}: ${NOTE_MAP.shape.question} is no decision`],
      [{ lines: [], candidates: [{ name: 'space-homing', reason: 'R.' }] }, 'the candidates: "space-homing" is already on the map — nothing was added; edit it, or pick a different name'],
      [{ lines: [], candidates: [{ name: 'dock-badge', reason: 'R.' }] }, 'the candidates: "dock-badge" was previously dismissed from this map — nothing was added; the person re-adds it on the map'],
      [{ lines: [], candidates: [{ name: 'dock.badge', reason: 'R.' }] }, 'the candidates: entry 1 — "dock.badge" is not a legal topic name (dots and slashes break manifest addressing)'],
      [{ lines: [], candidates: [{ name: 'a', reason: 'R.' }, { name: 'a', reason: 'S.' }] }, 'the candidates: "a" appears more than once in the batch'],
      [{ lines: [] }, 'the payload must be {lines, candidates}'],
    ];
    for (const [given, refusal] of cases) {
      const res = refusedPristine(dir, ['render', 'decided', `${UNIT}.note-window`, '--file', payload(/** @type {Record<string, unknown>} */ (given))], { env: SESSION });
      assert.strictEqual(res.error, `render decided: ${refusal}`);
    }
    const res = refusedPristine(dir, ['render', 'decided', `${SOLO}.${SOLO}`, '--file', payload({ lines: [], candidates: [{ name: 'streaks', reason: 'R.' }] })], { env: SESSION });
    assert.strictEqual(res.error, 'render decided: a feature has no map to add a topic to — candidates are an epic\'s');
    assert.ok(!fs.existsSync(statePath(dir, '.cache', UNIT, 'discussion', 'note-window', 'decided.json')));
  });

  it('shows the rows carried over apart, a block of their own, never among what the person decided or Claude\'s calls; and where nothing was the person\'s, says what every question was', () => {
    answeredIn(dir, NOTE, 'Does a note dim when idle?', { ...MADE, given: 'carried', text: 'After a minute.' });
    close();
    const display = sectionOf(staged(NO_PAYLOAD), 'DISPLAY: decided');
    assert.match(display, /\nWHAT YOU DECIDED \(1\)\n {2}└─ How does first run open\?\n\nCARRIED OVER \(1\)\n {2}└─ Does a note dim when idle\?\n\nCLAUDE'S CALLS \(5\)\n/);

    answeredIn(dir, SPACE, 'Does a space keep its own notes?', { ...MADE, given: 'carried', text: 'Each its own.' });
    answeredIn(dir, SPACE, 'Is a space named?', { ...MADE, text: 'By its folder.' });
    writeIn(dir, 'move', SPACE, ['--question', writeIn(dir, 'ask', SPACE, [], { ...MADE, text: 'Where does a note open?' }), '--to', 'note-window'], MADE);
    markAllButTheClosingPass(dir, UNIT, 'space-homing');
    close(UNIT, 'space-homing');
    assert.match(sectionOf(staged(NO_PAYLOAD, `${UNIT}.space-homing`), 'DISPLAY: decided'),
      /\nWHAT YOU DECIDED \(0\)\n {2}Nothing of yours — every question was a call of mine, carried over or moved on\n\nCARRIED OVER \(1\)\n {2}└─ Does a space keep its own notes\?\n\nCLAUDE'S CALLS \(1\)\n/);

    createManifest(dir, 'bare', { phases: { discussion: { items: { bare: { status: 'in-progress' } } } }, checklists: markedButTheClosingPass('bare') });
    close('bare', 'bare');
    assert.match(staged(NO_PAYLOAD, 'bare.bare'), /\nWHAT YOU DECIDED \(0\)\n {2}Nothing of yours — no question was asked\n/);
  });
});

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
    assert.ok(!('removing-fumi' in readManifest(dir, UNIT).phases.discovery.items), 'nor the map');
    assert.ok(fs.existsSync(statePath(dir, '.cache', UNIT, 'discussion', 'note-window', 'decided.json')), 'the payload is staged in the topic\'s cache');
    assert.match(sectionOf(out, 'MENU: decided'), /^Your yes marks Note Window decided, with the 2 product-record lines and the candidate\.$/m);

    const yes = answer('decided', 'y');
    assert.deepStrictEqual(yes, { kind: 'engine', argv: ['decided', 'yes', UNIT, 'note-window'] });
    const map = ok(dir, ['ledger', 'map', UNIT, 'note-window']).questions;
    const res = run(yes);
    const lines = entries().slice(before);
    assert.deepStrictEqual(lines.map(({ event, topic, by, given, who_moved_whom: moved, product_wide: wide, relies_on: reliesOn, text }) => ({ event, topic, by, given, moved, wide, reliesOn, text })), [
      { event: 'asked', topic: null, by: 'claude', given: undefined, moved: 'none', wide: undefined, reliesOn: [full(NOTE_MAP.sync.answer)], text: 'Is sync on at first run?' },
      { event: 'decided', topic: null, by: 'person', given: 'own', moved: 'none', wide: true, reliesOn: [full(NOTE_MAP.sync.answer)], text: 'Sync stays off until you turn it on.' },
      { event: 'asked', topic: null, by: 'claude', given: undefined, moved: 'none', wide: undefined, reliesOn: [full(NOTE_MAP.shape.answer)], text: 'How does first run open?' },
      { event: 'decided', topic: null, by: 'person', given: 'own', moved: 'none', wide: true, reliesOn: [full(NOTE_MAP.shape.answer)], text: 'First run shows the product before it asks.' },
    ]);
    assert.deepStrictEqual([lines[1].answers, lines[3].answers], [lines[0].id, lines[2].id], 'each line answers its own question, at the unit\'s level');
    assert.deepStrictEqual(ok(dir, ['ledger', 'map', UNIT, 'note-window']).questions, map, 'the topic\'s map is as it was: a line answers none of its questions');
    assert.deepStrictEqual(ok(dir, ['ledger', 'product']).decisions.map((/** @type {{text: string}} */ d) => d.text), ['Sync stays off until you turn it on.', 'First run shows the product before it asks.']);
    const manifest = readManifest(dir, UNIT);
    assert.deepStrictEqual(manifest.phases.discovery.items['removing-fumi'], { routing: 'discussion', source: 'topic:note-window', summary: 'Nothing decides what removing Fumi takes back.' });
    assert.strictEqual(manifest.phases.discussion.items['note-window'].status, 'completed');
    assert.deepStrictEqual(res.next, { kind: 'handoff', skill: 'leeway-continue-epic', args: [UNIT, 'discussion', 'completed'] });
    assert.deepStrictEqual([res.lines.length, res.candidates, res.warnings], [2, ['removing-fumi'], undefined]);
    assert.strictEqual(lastMessage(dir), 'decided(fumi): note-window');
    assert.ok(!fs.existsSync(statePath(dir, '.cache', UNIT, 'discussion', 'note-window', 'decided.json')), 'the staged payload goes');
  });

  it('checks every line before it writes one: a refused yes lands nothing, and once staged again each line lands once', () => {
    close();
    const lines = [
      { text: 'First run shows the product before it asks.', why: 'The tour first holds everywhere.', widens: NOTE_MAP.shape.answer },
      { text: 'Sync is on once a folder is picked.', why: 'The sync call holds for the whole product.', widens: NOTE_MAP.sync.answer },
    ];
    staged({ lines, candidates: [] });
    const replacement = writeIn(dir, 'replace', NOTE, ['--replaces', NOTE_MAP.sync.answer, '--reason', 'changed-mind'], { ...MADE, drops: ['on by default'], text: 'Sync is off until turned on.', why: 'A comment at the gate.' });
    const before = entries().length;
    assert.match(refusedPristine(dir, ['decided', 'yes', UNIT, 'note-window'], { env: SESSION }).error, /^decided yes: line 2 cannot land — .*; it is staged again with --file$/);
    assert.strictEqual(entries().length, before, 'line 1 never landed');
    staged({ lines: [lines[0], { ...lines[1], text: 'Sync is off until turned on.', widens: replacement }], candidates: [{ name: 'removing-fumi', reason: 'R.' }] });
    ok(dir, ['discovery-map', 'add', UNIT, 'removing-fumi', 'discussion', '--summary', 'Added at the map meanwhile.'], { env: SESSION });
    assert.strictEqual(refusedPristine(dir, ['decided', 'yes', UNIT, 'note-window'], { env: SESSION }).error,
      'decided yes: the candidates: "removing-fumi" is already on the map — nothing was added; edit it, or pick a different name');
    assert.strictEqual(entries().length, before, 'a candidate the map now refuses lands no line either');
    staged({ lines: [lines[0], { ...lines[1], text: 'Sync is off until turned on.', widens: replacement }], candidates: [] });
    run(answer('decided', 'y'));
    assert.deepStrictEqual(ok(dir, ['ledger', 'product']).decisions.map((/** @type {{text: string}} */ d) => d.text), ['First run shows the product before it asks.', 'Sync is off until turned on.']);
  });

  it('lands no line twice when a yes killed after its lines landed is run again, each line keeping the ids it was staged with', () => {
    close();
    staged({ lines: [{ text: 'First run shows the product before it asks.', why: 'The tour first holds everywhere.', widens: NOTE_MAP.shape.answer }], candidates: [] });
    killedAt({ method: 'renameSync', file: `${UNIT}/manifest.json`, when: 'before' }, dir, ['decided', 'yes', UNIT, 'note-window'], { env: SESSION });
    assert.deepStrictEqual(ok(dir, ['ledger', 'product']).decisions.map((/** @type {{text: string}} */ d) => d.text), ['First run shows the product before it asks.'], 'the line landed before the kill');
    assert.strictEqual(readManifest(dir, UNIT).phases.discussion.items['note-window'].status, 'in-progress');
    const restaged = ['render', 'decided', `${UNIT}.note-window`, '--file', payload({ lines: [{ text: 'First run shows the product first.', why: 'Again.', widens: NOTE_MAP.shape.answer }], candidates: [] })];
    assert.match(refusedPristine(dir, restaged, { env: SESSION }).error, /^render decided: line 1 widens \S+: \S+ widens it for the product already — "First run shows the product before it asks\."$/, 'a restage after the kill lands the line no second time');
    run(answer('decided', 'y'));
    assert.deepStrictEqual(ok(dir, ['ledger', 'product']).decisions.map((/** @type {{text: string}} */ d) => d.text), ['First run shows the product before it asks.']);
    assert.strictEqual(readManifest(dir, UNIT).phases.discussion.items['note-window'].status, 'completed');
  });

  it('hands a feature\'s decided topic off to its specification', () => {
    close(SOLO, SOLO);
    staged(NO_PAYLOAD, `${SOLO}.${SOLO}`);
    assert.deepStrictEqual(run(answer('decided', 'y')).next, { kind: 'handoff', skill: 'leeway-specification-process', args: ['feature', SOLO] });
  });

  it('refuses with nothing staged, while a verdict is still to ask, and without a conversation, writing nothing', () => {
    close();
    const yes = ['decided', 'yes', UNIT, 'note-window'];
    assert.match(refusedPristine(dir, yes, { env: SESSION }).error, /^decided yes: nothing is staged for note-window — render decided fumi\.note-window --file <payload\.json> stages Claude's lines and candidates$/);
    staged(NO_PAYLOAD);
    assert.match(refusedPristine(dir, yes, { env: { CLAUDE_CODE_SESSION_ID: undefined } }).error, /^decided yes: no conversation to write in/);
    reverse(NOTE_MAP.title.answer, 'Hello.');
    assert.strictEqual(refusedPristine(dir, yes, { env: SESSION }).error, 'decided yes: a verdict is still to ask — render decided asks each before the yes');
  });

  it('offers no strike for a product-record line: a comment changes it, staged again (9.S55)', () => {
    close();
    const out = staged({ lines: [{ text: 'Sync is on.', why: 'Why.', widens: NOTE_MAP.sync.answer }], candidates: [] });
    const gate = sectionOf(out, 'MENU: decided');
    assert.ok(!gate.includes('s/strike'), 'a line has no strike of its own');
    assert.match(gate, /^\*\*Comment\*\* → Tell me what to change — a product-record line included$/m);
    ok(dir, ['gate', 'decided', '--typed', 'comment'], { env: SESSION });
    assert.match(staged({ lines: [{ text: 'Sync stays off.', why: 'The person said so.', widens: NOTE_MAP.sync.answer }], candidates: [] }), /· Sync stays off\./);
    run(answer('decided', 'y'));
    assert.deepStrictEqual(ok(dir, ['ledger', 'product']).decisions.map((/** @type {{text: string}} */ d) => d.text), ['Sync stays off.']);
  });
});

describe('striking a candidate (P8)', () => {
  it('strikes a lone candidate from the gate, and the yes leaves it off the map', () => {
    close();
    staged({ lines: [], candidates: [{ name: 'removing-fumi', reason: 'R.' }] });
    const struck = run(answer('decided', 's'));
    assert.deepStrictEqual(struck, { ok: true, unit: UNIT, topic: 'note-window', struck: 'removing-fumi', next: { kind: 'engine', argv: ['render', 'decided', `${UNIT}.note-window`] } });
    const again = run(struck.next);
    assert.match(again, /└─ ⊘ Removing Fumi +\[struck\]/);
    assert.match(sectionOf(again, 'MENU: decided'), /^Your yes marks Note Window decided\.$/m);
    assert.ok(!sectionOf(again, 'MENU: decided').includes('s/strike'));
    assert.deepStrictEqual(run(answer('decided', 'y')).candidates, []);
    assert.ok(!('removing-fumi' in readManifest(dir, UNIT).phases.discovery.items));
  });

  it('picks the candidate by its number where more than one stands', () => {
    close();
    staged({ lines: [], candidates: [{ name: 'removing-fumi', reason: 'R.' }, { name: 'dock-icon', reason: 'S.' }, { name: 'menu-extra', reason: 'T.' }] });
    const pick = run(answer('decided', 's'));
    assert.deepStrictEqual([...sectionOf(pick, 'MENU: decided strike').matchAll(/^\*\*`([a-z0-9/]+)`\*\* +→ (.*)$/gm)].map((m) => [m[1], m[2]]),
      [['1', 'Removing Fumi'], ['2', 'Dock Icon'], ['3', 'Menu Extra'], ['b/back', 'Back to the decided screen — nothing struck']]);
    assert.match(run(run(answer('decided strike', '2')).next), /├─ ⊘ Dock Icon +\[struck\]/);
    assert.deepStrictEqual(run(answer('decided', 'y')).candidates, ['removing-fumi', 'menu-extra']);
  });

  it('keeps the strike of every candidate a restage still names', () => {
    close();
    const candidates = [{ name: 'removing-fumi', reason: 'R.' }, { name: 'dock-icon', reason: 'S.' }];
    staged({ lines: [], candidates });
    ok(dir, ['decided', 'strike', UNIT, 'note-window', '1'], { env: SESSION });
    const again = staged({ lines: [{ text: 'Sync is on.', why: 'Why.', widens: NOTE_MAP.sync.answer }], candidates: [...candidates].reverse() });
    assert.match(again, /└─ ⊘ Removing Fumi +\[struck\]/);
    assert.deepStrictEqual(run(answer('decided', 'y')).candidates, ['dock-icon']);
  });

  it('undoes a strike, the candidate standing again on the screen; refuses a candidate the payload lacks, one struck already, and one not struck', () => {
    close();
    staged({ lines: [], candidates: [{ name: 'removing-fumi', reason: 'R.' }] });
    ok(dir, ['decided', 'strike', UNIT, 'note-window', '1'], { env: SESSION });
    assert.strictEqual(refusedPristine(dir, ['decided', 'strike', UNIT, 'note-window', '1'], { env: SESSION }).error, 'decided strike: "removing-fumi" is struck already');
    assert.strictEqual(refusedPristine(dir, ['decided', 'strike', UNIT, 'note-window', '2'], { env: SESSION }).error, 'decided strike: there is no candidate 2 — the candidates are 1 to 1');
    const kept = ok(dir, ['decided', 'unstrike', UNIT, 'note-window', '1'], { env: SESSION });
    assert.deepStrictEqual(kept, { ok: true, unit: UNIT, topic: 'note-window', unstruck: 'removing-fumi', next: { kind: 'engine', argv: ['render', 'decided', `${UNIT}.note-window`] } });
    const again = run(kept.next);
    assert.match(again, /└─ ○ Removing Fumi\n/);
    assert.match(sectionOf(again, 'MENU: decided'), /^Your yes marks Note Window decided, with the candidate\.$/m);
    assert.strictEqual(refusedPristine(dir, ['decided', 'unstrike', UNIT, 'note-window', '1'], { env: SESSION }).error, 'decided unstrike: "removing-fumi" is not struck');
  });
});

describe('a topic set back in progress (P9, 10.2.7)', () => {
  it('shows its gate again only once closed afresh, counting the verdicts this close asks, and the next decided takes the gate\'s yes again', () => {
    close();
    reverse(NOTE_MAP.title.answer, 'Hello.');
    staged({ lines: [{ text: 'Sync is on once a folder is picked.', why: 'It holds for the product.', widens: NOTE_MAP.sync.answer }], candidates: [] });
    run(answer('verdict', 'n'));
    screen();
    run(answer('decided', 'y'));
    const scratch = statePath(dir, '.cache', 'scratch', 'note.md');
    fs.writeFileSync(scratch, 'A login item needs a banner\n\nThe space-homing topic found one.\n');
    ok(dir, ['topic', 'send', UNIT, 'note-window', '--from', 'space-homing', '--content', scratch, '--slug', 'banner'], { env: SESSION });
    assert.strictEqual(readManifest(dir, UNIT).phases.discussion.items['note-window'].status, 'in-progress');
    const shown = ['render', 'decided', `${UNIT}.note-window`, '--file', payload(NO_PAYLOAD)];
    assert.match(refusedPristine(dir, shown, { env: SESSION }).error, /^render decided: decided\.note-window's close was taken by the decided gate's yes, and the topic was set back in progress since/);
    const banner = writeIn(dir, 'ask', NOTE, [], { ...MADE, text: 'Does a login item need a banner?' });
    ok(dir, ['topic', 'answered', UNIT, 'note-window', '001-banner', '--entry', banner], { env: SESSION });
    writeIn(dir, 'decide', NOTE, ['--answers', banner], { ...PERSON, text: 'A banner once.', why: 'Because.' });
    assert.match(refusedPristine(dir, ['checklist', 'close', 'decided', UNIT, 'note-window'], { env: SESSION }).error, /has items open: closing-pass, decisions-entered/, 'marks before the last close count for nothing');
    markAllButTheClosingPass(dir, UNIT, 'note-window');
    close();
    reverse(NOTE_MAP.price.answer, 'A price line at the end.');
    assert.match(output(dir, shown, { env: SESSION }), /YOUR VERDICT \(1 of 1 call you changed\)\n {2}└─ Is pricing mentioned\?/, 'the departure given its verdict at the earlier close is not this close\'s');
    run(answer('verdict', 'n'));
    assert.match(screen(), /WHAT YOU DECIDED \(4\)\n {2}├─ How does first run open\?\n {2}├─ What is the screen titled\?\n {2}├─ Is pricing mentioned\?\n {2}└─ Does a login item need a banner\?\n\nCLAUDE'S CALLS \(3\)[\s\S]*MENU: decided/,
      'the call the product-record line widened is still Claude\'s');
    assert.strictEqual(readManifest(dir, UNIT).phases.discussion.items['note-window'].status, 'in-progress', 'the topic is decided only by the gate\'s yes');
    const [widened] = ok(dir, ['ledger', 'product']).decisions;
    const again = ['render', 'decided', `${UNIT}.note-window`, '--file', payload({ lines: [{ text: 'Sync stays on.', why: 'Again.', widens: NOTE_MAP.sync.answer }], candidates: [] })];
    assert.strictEqual(refusedPristine(dir, again, { env: SESSION }).error,
      `render decided: line 1 widens ${NOTE_MAP.sync.answer}: ${widened.id} widens it for the product already — "Sync is on once a folder is picked."`);
    const resync = writeIn(dir, 'replace', NOTE, ['--replaces', NOTE_MAP.sync.answer, '--reason', 'changed-mind'], { ...MADE, drops: ['on once a folder is picked'], text: 'Off until turned on.', why: 'The banner asks first.' });
    staged({ lines: [{ text: 'Sync is off until you turn it on.', why: 'It holds for the product.', widens: resync }], candidates: [] });
    run(answer('decided', 'y'));
    assert.strictEqual(readManifest(dir, UNIT).phases.discussion.items['note-window'].status, 'completed');
    assert.deepStrictEqual(ok(dir, ['ledger', 'product']).decisions.map((/** @type {{text: string}} */ d) => d.text), ['Sync is on once a folder is picked.', 'Sync is off until you turn it on.'],
      'a replacement is another decision, widened afresh');
  });

  it('voids the close with a message delivered since, its answer leaving it void, and the payload staged against it refused by the screen and the yes alike', () => {
    close();
    staged({ lines: [{ text: 'Sync is on everywhere.', why: 'Why.', widens: NOTE_MAP.sync.answer }], candidates: [] });
    const scratch = payload(NO_PAYLOAD);
    fs.writeFileSync(scratch, 'Sync off\n\nSpace homing decided sync stays off.\n');
    ok(dir, ['topic', 'send', UNIT, 'note-window', '--from', 'space-homing', '--content', scratch, '--slug', 'sync-off'], { env: SESSION });
    const asked = NOTE_MAP.sync.question;
    ok(dir, ['topic', 'answered', UNIT, 'note-window', '001-sync-off', '--entry', asked], { env: SESSION });
    const voided = 'decided.note-window was closed before a message delivered to note-window — its items are worked afresh and it is closed again';
    assert.strictEqual(refusedPristine(dir, ['render', 'decided', `${UNIT}.note-window`], { env: SESSION }).error, `render decided: ${voided}`);
    assert.strictEqual(refusedPristine(dir, ['decided', 'yes', UNIT, 'note-window'], { env: SESSION }).error, `decided yes: ${voided}`);
    markAllButTheClosingPass(dir, UNIT, 'note-window');
    close();
    const earlier = 'what is staged for note-window was drawn for an earlier close — it is staged again with --file';
    assert.strictEqual(refusedPristine(dir, ['render', 'decided', `${UNIT}.note-window`], { env: SESSION }).error, `render decided: ${earlier}`);
    assert.strictEqual(refusedPristine(dir, ['decided', 'yes', UNIT, 'note-window'], { env: SESSION }).error, `decided yes: ${earlier}`);
  });

  it('voids the close with a question opened on the topic since — asked there, or moved to it — and never with a decision changed', () => {
    close();
    staged(NO_PAYLOAD);
    writeIn(dir, 'replace', NOTE, ['--replaces', NOTE_MAP.title.answer, '--reason', 'changed-mind'], { ...MADE, drops: ['welcome'], text: 'Hello.', why: 'A comment at the gate.' });
    assert.match(screen(), /MENU: decided/, 'a decision changed at a comment leaves the close standing');
    const opened = 'was closed before a question opened on note-window — its items are worked afresh and it is closed again';
    writeIn(dir, 'decide', NOTE, ['--answers', writeIn(dir, 'ask', NOTE, [], { ...MADE, text: 'Is the window resizable?' })], { ...MADE, text: 'Yes.', why: 'Because.' });
    assert.strictEqual(refusedPristine(dir, ['render', 'decided', `${UNIT}.note-window`], { env: SESSION }).error, `render decided: decided.note-window ${opened}`);
    markAllButTheClosingPass(dir, UNIT, 'note-window');
    close();
    assert.match(staged(NO_PAYLOAD), /MENU: decided/);
    const homing = `${UNIT}.discussion.space-homing`;
    const moved = writeIn(dir, 'ask', homing, [], { ...MADE, text: 'Does a note remember its space?' });
    writeIn(dir, 'move', homing, ['--question', moved, '--to', 'note-window'], MADE);
    assert.match(refusedPristine(dir, ['render', 'decided', `${UNIT}.note-window`], { env: SESSION }).error, new RegExp(opened));
  });
});

describe('what holds the close (9.S16, 9.S61)', () => {
  it('closes with Claude\'s calls standing once nothing of the person\'s is open, and holds while an experiment still running measures a question', () => {
    const timing = writeIn(dir, 'ask', NOTE, [], { ...MADE, text: 'How fast does a note open?' });
    createManifest(dir, UNIT, {
      ...readManifest(dir, UNIT),
      phases: { ...readManifest(dir, UNIT).phases, experiment: { items: { 'note-window': { status: 'in-progress', experiments: { E1: { slug: 'open-time', status: 'running', question: full(timing) } } } } } },
    });
    ok(dir, ['checklist', 'done', 'decided', UNIT, 'note-window', 'closing-pass'], { env: SESSION });
    assert.match(refusedPristine(dir, ['checklist', 'close', 'decided', UNIT, 'note-window'], { env: SESSION }).error, /has items open: questions-closed$/);
    writeIn(dir, 'decide', NOTE, ['--answers', timing], { ...PERSON, text: 'Under a frame.', why: 'The person closed it while it ran.' });
    ok(dir, ['checklist', 'close', 'decided', UNIT, 'note-window'], { env: SESSION });
  });
});

describe('the wait for agents (9.7.8, 9.S63)', () => {
  const wait = () => output(dir, ['render', 'wait-agents', `${UNIT}.note-window`], { env: SESSION });
  const RUNNING = { ...SESSION, CLAUDE_PID: String(process.pid) };

  it('shows only while one of the topic\'s agents is running, each by its kind, and is empty once its report lands', () => {
    assert.strictEqual(wait(), '', 'nothing runs');
    const dive = ok(dir, ['agent', 'dispatch', UNIT, 'discussion', 'note-window', '--kind', 'deep-dive'], { env: RUNNING }).id;
    ok(dir, ['agent', 'dispatch', UNIT, 'discussion', 'note-window', '--kind', 'review'], { env: RUNNING });
    assert.strictEqual(sectionOf(wait(), 'MENU: wait for agents'), [
      '· · · · · · · · · · · ·',
      'Still running on Note Window: 1 deep dive, 1 review.',
      '',
      '**`◆ Wait for them?`**',
      '',
      '**`w/wait`** → Wait — take in what they find first',
      '**`g/go`**   → Go on — their reports wait for the next opening',
      '',
    ].join('\n'));
    assert.deepStrictEqual(answer('wait for agents', 'w'), { kind: 'engine', argv: ['render', 'wait-agents', `${UNIT}.note-window`] }, 'the wait draws the gate again once the reports land');
    wait();
    assert.deepStrictEqual(answer('wait for agents', 'g'), { kind: 'continue' }, 'the go goes on to the close');
    fs.writeFileSync(statePath(dir, '.cache', UNIT, 'discussion', 'note-window', `${dive}.md`), 'Found.\n');
    assert.match(wait(), /Still running on Note Window: 1 review\./);
  });

  it('refuses a topic the unit lacks', () => {
    assert.strictEqual(refusedPristine(dir, ['render', 'wait-agents', `${UNIT}.ghost`]).error, 'render wait-agents: fumi has no topic "ghost"');
  });
});

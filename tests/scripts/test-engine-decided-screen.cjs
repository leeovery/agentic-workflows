'use strict';

// ---------------------------------------------------------------------------
// A topic's decided screen and what Claude stages on it (leeway-engine/
// scripts/domain/decided.cjs, its screens domain/projections/decided.cjs,
// the close it stands on domain/checklist.cjs): `engine render decided`,
// shown once the topic's checklist is closed — what the person decided, the
// rows carried over apart from it, Claude's calls counted by kind and
// listed on asking, the product-record lines and the candidates the payload
// stages, every skip with its reason (6.S12) — a verdict asked of each
// departure on the topic one at a time (16.S33), none where the person
// changed none (16.S34), then the decided gate (9.S21); a payload the map
// or the record refuses staging nothing; `engine decided strike|unstrike`
// and `render decided-strike` (P8); a running experiment holding the close
// (9.S61); and the wait for the topic's agents still running (9.S63).
//
// Layer: verb. World: the decided suites' (decided-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const { ok, output, refusedPristine, readManifest, statePath } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, MADE, NOTE, SPACE, ledgerHelpers } = require('./ledger-world.cjs');
const { SOLO, PERSON, NO_PAYLOAD, NOTE_MAP, writeIn, answeredIn, markAllButTheClosingPass, sectionOf, useDecidedWorld, decidedHelpers } = require('./decided-world.cjs');

const dir = useDecidedWorld();
const { close, payload, screen, staged, answer, run, reverse } = decidedHelpers(dir);
const { full, carriedOver } = ledgerHelpers(dir);

describe('the decided screen (9.7.3, 9.S21)', () => {
  it('shows what the person decided, Claude\'s calls by kind with those unlabelled said so, the lines, the candidates and the skip, then the decided gate; and with --calls lists each call under its kind, one handed over marked so, drawing the gate without the calls row', () => {
    ok(dir(), ['checklist', 'skip', 'decided', UNIT, 'note-window', 'closing-pass', '--reason', 'its third re-read reworded one line, and nothing else moved'], { env: SESSION });
    ok(dir(), ['checklist', 'close', 'decided', UNIT, 'note-window'], { env: SESSION });
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

    const listed = screen(['--calls']);
    assert.match(sectionOf(listed, 'DISPLAY: decided'), /CLAUDE'S CALLS \(5\)\n {2}2 behaviour · 1 words · 2 unlabelled — the labeller gives each its kind\n {2}├─ ◇ What is the screen titled\? +\[words\]\n {2}│ {5}Welcome\.\n/);
    assert.match(listed, /◇ Which corner does a note open in\? +\[unlabelled · your call\]/, 'a call handed over is Claude\'s, marked handed over');
    assert.ok(!sectionOf(listed, 'MENU: decided').includes('c/calls'), 'the calls listed, the gate draws no calls row');
  });

  it('refuses while the checklist is open, writing nothing; once the item is skipped and the checklist closed it shows the skip (6.S12)', () => {
    const shown = ['render', 'decided', `${UNIT}.note-window`, '--file', payload(NO_PAYLOAD)];
    assert.match(refusedPristine(dir(), shown, { env: SESSION }).error, /^render decided: decided\.note-window is open — its items are worked, then it is closed: checklist close decided fumi note-window$/);
    ok(dir(), ['checklist', 'skip', 'decided', UNIT, 'note-window', 'closing-pass', '--reason', 'one reader ran'], { env: SESSION });
    ok(dir(), ['checklist', 'close', 'decided', UNIT, 'note-window'], { env: SESSION });
    assert.match(output(dir(), shown, { env: SESSION }), /⚑ Skipped: the closing pass run, and its last re-read changing\n {4}nothing — one reader ran/);
  });

  it('asks a verdict of each call the person changed on the topic, one at a time, a skip moving on, then the gate (16.S33)', () => {
    close();
    const homing = answeredIn(dir(), SPACE, 'Does a space remember its notes?', { ...MADE, text: 'Yes.' });
    const elsewhere = writeIn(dir(), 'replace', SPACE, ['--replaces', homing.answer, '--reason', 'changed-mind'], { by: 'person', drops: ['the old answer'], text: 'No.', why: 'The person wants it so.' });
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
    assert.deepStrictEqual(ok(dir(), ['verdict', 'queue']).departures.map((/** @type {{id: string}} */ d) => d.id), [elsewhere, price], 'the skipped verdict waits in the queue (16.10.6), and the departure on another topic, never asked here');
  });

  it('refuses a payload that names no decision on the map, a candidate the map cannot take or a feature has no map for, and one of another shape, staging nothing', () => {
    close();
    close(SOLO, SOLO);
    const finding = writeIn(dir(), 'find', NOTE, [], { ...MADE, text: 'Fumi asks for Accessibility.', how: 'read the code', known: 'read' });
    const cases = [
      [{ lines: [{ text: 'A rule.', why: 'Why.', widens: finding }], candidates: [] }, `line 1 widens ${finding}: ${finding} is no decision`],
      [{ lines: [{ text: 'A rule.', why: 'Why.', widens: NOTE_MAP.shape.question }], candidates: [] }, `line 1 widens ${NOTE_MAP.shape.question}: ${NOTE_MAP.shape.question} is no decision`],
      [{ lines: [{ text: 'A rule.', why: 'Why.', widens: NOTE_MAP.shape.answer }, { text: 'Another.', why: 'Why.', widens: NOTE_MAP.shape.answer }], candidates: [] }, `line 2 widens ${NOTE_MAP.shape.answer}, as line 1 does — a decision takes one line`],
      [{ lines: [], candidates: [{ name: 'space-homing', reason: 'R.' }] }, 'the candidates: "space-homing" is already on the map — nothing was added; edit it, or pick a different name'],
      [{ lines: [], candidates: [{ name: 'dock-badge', reason: 'R.' }] }, 'the candidates: "dock-badge" was previously dismissed from this map — nothing was added; the person re-adds it on the map'],
      [{ lines: [], candidates: [{ name: 'dock.badge', reason: 'R.' }] }, 'the candidates: entry 1 — "dock.badge" is not a legal topic name (dots and slashes break manifest addressing)'],
      [{ lines: [], candidates: [{ name: 'a', reason: 'R.' }, { name: 'a', reason: 'S.' }] }, 'the candidates: "a" appears more than once in the batch'],
      [{ lines: [] }, 'the payload must be {lines, candidates}'],
    ];
    for (const [given, refusal] of cases) {
      const res = refusedPristine(dir(), ['render', 'decided', `${UNIT}.note-window`, '--file', payload(/** @type {Record<string, unknown>} */ (given))], { env: SESSION });
      assert.strictEqual(res.error, `render decided: ${refusal}`);
    }
    const res = refusedPristine(dir(), ['render', 'decided', `${SOLO}.${SOLO}`, '--file', payload({ lines: [], candidates: [{ name: 'streaks', reason: 'R.' }] })], { env: SESSION });
    assert.strictEqual(res.error, 'render decided: a feature has no map to add a topic to — candidates are an epic\'s');
    assert.ok(!fs.existsSync(statePath(dir(), '.cache', UNIT, 'discussion', 'note-window', 'decided.json')));
  });

  it('shows the rows carried over apart, a block of their own, never among what the person decided or Claude\'s calls; and where nothing was the person\'s, says what every question was', () => {
    carriedOver(SPACE, writeIn(dir(), 'ask', SPACE, [], { ...MADE, text: 'Does a space keep its own notes?' }), 'Each its own.');
    answeredIn(dir(), SPACE, 'Is a space named?', { ...MADE, text: 'By its folder.' });
    writeIn(dir(), 'move', SPACE, ['--question', writeIn(dir(), 'ask', SPACE, [], { ...MADE, text: 'Where does a note open?' }), '--to', 'note-window'], MADE);
    markAllButTheClosingPass(dir(), UNIT, 'space-homing');
    close(UNIT, 'space-homing');
    assert.match(sectionOf(staged(NO_PAYLOAD, `${UNIT}.space-homing`), 'DISPLAY: decided'),
      /\nWHAT YOU DECIDED \(0\)\n {2}Nothing of yours — every question was a call of mine, carried over or moved on\n\nCARRIED OVER \(1\)\n {2}└─ Does a space keep its own notes\?\n\nCLAUDE'S CALLS \(1\)\n/);

    createManifest(dir(), 'bare', { phases: { discussion: { items: { bare: { status: 'in-progress' } } } } });
    markAllButTheClosingPass(dir(), 'bare', 'bare');
    close('bare', 'bare');
    assert.match(staged(NO_PAYLOAD, 'bare.bare'), /\nWHAT YOU DECIDED \(0\)\n {2}Nothing of yours — no question was asked\n/);
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
    assert.ok(!('removing-fumi' in readManifest(dir(), UNIT).phases.discovery.items));
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
    ok(dir(), ['decided', 'strike', UNIT, 'note-window', '1'], { env: SESSION });
    const again = staged({ lines: [{ text: 'Sync is on.', why: 'Why.', widens: NOTE_MAP.sync.answer }], candidates: [...candidates].reverse() });
    assert.match(again, /└─ ⊘ Removing Fumi +\[struck\]/);
    assert.deepStrictEqual(run(answer('decided', 'y')).candidates, ['dock-icon']);
  });

  it('undoes a strike, the candidate standing again on the screen; refuses a candidate the payload lacks, one struck already, and one not struck', () => {
    close();
    staged({ lines: [], candidates: [{ name: 'removing-fumi', reason: 'R.' }] });
    ok(dir(), ['decided', 'strike', UNIT, 'note-window', '1'], { env: SESSION });
    assert.strictEqual(refusedPristine(dir(), ['decided', 'strike', UNIT, 'note-window', '1'], { env: SESSION }).error, 'decided strike: "removing-fumi" is struck already');
    assert.strictEqual(refusedPristine(dir(), ['decided', 'strike', UNIT, 'note-window', '2'], { env: SESSION }).error, 'decided strike: there is no candidate 2 — the candidates are 1 to 1');
    const kept = ok(dir(), ['decided', 'unstrike', UNIT, 'note-window', '1'], { env: SESSION });
    assert.deepStrictEqual(kept, { ok: true, unit: UNIT, topic: 'note-window', unstruck: 'removing-fumi', next: { kind: 'engine', argv: ['render', 'decided', `${UNIT}.note-window`] } });
    const again = run(kept.next);
    assert.match(again, /└─ ○ Removing Fumi\n/);
    assert.match(sectionOf(again, 'MENU: decided'), /^Your yes marks Note Window decided, with the candidate\.$/m);
    assert.strictEqual(refusedPristine(dir(), ['decided', 'unstrike', UNIT, 'note-window', '1'], { env: SESSION }).error, 'decided unstrike: "removing-fumi" is not struck');
  });
});

describe('what holds the close (9.S16, 9.S61)', () => {
  it('closes with Claude\'s calls standing once nothing of the person\'s is open, and holds while an experiment still running measures a question', () => {
    const timing = writeIn(dir(), 'ask', NOTE, [], { ...MADE, text: 'How fast does a note open?' });
    createManifest(dir(), UNIT, {
      ...readManifest(dir(), UNIT),
      phases: { ...readManifest(dir(), UNIT).phases, experiment: { items: { 'note-window': { status: 'in-progress', experiments: { E1: { slug: 'open-time', status: 'running', question: full(timing) } } } } } },
    });
    ok(dir(), ['checklist', 'done', 'decided', UNIT, 'note-window', 'closing-pass'], { env: SESSION });
    assert.match(refusedPristine(dir(), ['checklist', 'close', 'decided', UNIT, 'note-window'], { env: SESSION }).error, /has items open: questions-closed$/);
    writeIn(dir(), 'decide', NOTE, ['--answers', timing], { ...PERSON, text: 'Under a frame.', why: 'The person closed it while it ran.' });
    ok(dir(), ['checklist', 'close', 'decided', UNIT, 'note-window'], { env: SESSION });
  });
});

describe('the wait for agents (9.7.8, 9.S63)', () => {
  const wait = () => output(dir(), ['render', 'wait-agents', `${UNIT}.note-window`], { env: SESSION });
  const RUNNING = { ...SESSION, CLAUDE_PID: String(process.pid) };

  it('shows only while one of the topic\'s agents is running, each by its kind, and is empty once its report lands', () => {
    assert.strictEqual(wait(), '', 'nothing runs');
    const dive = ok(dir(), ['agent', 'dispatch', UNIT, 'discussion', 'note-window', '--kind', 'deep-dive'], { env: RUNNING }).id;
    ok(dir(), ['agent', 'dispatch', UNIT, 'discussion', 'note-window', '--kind', 'review'], { env: RUNNING });
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
    fs.writeFileSync(statePath(dir(), '.cache', UNIT, 'discussion', 'note-window', `${dive}.md`), 'Found.\n');
    assert.match(wait(), /Still running on Note Window: 1 review\./);
  });

  it('refuses a topic the unit lacks', () => {
    assert.strictEqual(refusedPristine(dir(), ['render', 'wait-agents', `${UNIT}.ghost`]).error, 'render wait-agents: fumi has no topic "ghost"');
  });
});

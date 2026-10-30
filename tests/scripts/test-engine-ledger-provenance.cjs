'use strict';

// ---------------------------------------------------------------------------
// What an entry says of where it came from, from the ledger's version 2
// (leeway-engine/scripts/domain/ledger-events.cjs, written by
// domain/ledger-write.cjs, folded by domain/ledger-fold.cjs and read by
// domain/ledger-read.cjs): who decided a decision — the person, Claude, the
// person handing it over, the builder, or carried over, who decided it
// unrecorded — how a finding is known, a measurement with the command run
// and its result, the sections each entry cites, and the files linked from
// an entry, each with the status its latest live link gives it; and a
// ledger version 1 wrote, read through every projection at version 2's
// defaults.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there; the asset links appended
// in process, as no verb writes one yet.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, refuses, stateGit, statePath, layout, keywordOnlyKnowledge, cleanupFixture } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { appendEntry } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));

const { UNIT, SESSION_ID, MADE, NOTE, SPACE, NOTE_COPY, ids, ledgerReadHelpers, ledgerWriteHelpers, ledgerWorld } = require('./ledger-world.cjs');

const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const CITES = Object.freeze([{ path: `${UNIT}/discussion/note-window.md`, section: 'Session 1 — 2026-10-30' }]);

/** @type {string} */
let dir;

beforeEach(() => {
  dir = ledgerWorld('ledger-provenance-');
});

afterEach(() => {
  cleanupFixture(dir);
});

const { write, ask, find, decide, read, rawLines, full, line, mint } = ledgerReadHelpers(() => dir);
const { refused } = ledgerWriteHelpers(() => dir);

/** Who decided each answer on the note window's map, by its `by` and `given`. */
function answeredBy() {
  return read('map', UNIT, 'note-window').questions.map((/** @type {{answers: Record<string, unknown>[]}} */ row) => row.answers.map((a) => [a.by, a.given]));
}

describe('who decided (9.2.14–9.2.16, 21.6.5)', () => {
  it('9.S4, 9.S44: lands the person\'s decision — the scope call agreed after the opening among them — through the verb as their own, and the record shows it by its short id, decided by the person', () => {
    const scope = ask(NOTE, 'What does the note window cover?');

    const decided = write('decide', NOTE, ['--answers', scope], { ...PERSON, text: 'The window and its frame.', why: 'Where it opens is space homing\'s.', kind: 'scope' }).id;

    assert.ok(full(decided).startsWith(decided) && decided.length < full(decided).length, `${decided} is no short id`);
    const [shown] = read('record', UNIT, 'note-window').decisions;
    assert.deepStrictEqual([shown.id, shown.by, shown.given, shown.kind], [decided, 'person', 'own', 'scope']);
  });

  it('9.S7: lands "your call" as Claude\'s answer handed over and "don\'t care" as the builder\'s, Claude\'s calls both, and one carried over as Claude\'s line, no call — never the person\'s, whose decision given any way but their own is refused', () => {
    const handed = decide(NOTE, ask(NOTE, 'Does a note snap to the grid?'), 'Notes snap to an 8-point grid.', [], { given: 'your-call' });
    const builders = decide(NOTE, ask(NOTE, 'What radius are a note\'s corners?'), 'Ten points.', [], { given: 'dont-care' });
    decide(NOTE, ask(NOTE, 'Does a note dim when idle?'), 'Notes dim after a minute.', [], { given: 'carried' });
    const open = ask(NOTE, 'Is a note a window?');

    for (const given of ['your-call', 'dont-care', 'carried']) {
      refused('decide', NOTE, ['--answers', open], { ...PERSON, text: 'A panel.', why: 'Lighter.', given },
        new RegExp(`^ledger decide: the person's decision is given ${given} — the person's own is given own, and what they hand over, or what is carried over, is Claude's line, by claude$`));
    }
    assert.deepStrictEqual(answeredBy(), [[['claude', 'your-call']], [['claude', 'dont-care']], [['claude', 'carried']], []]);
    assert.deepStrictEqual(ids(read('since', UNIT, 'note-window').calls), [handed, builders]);
  });
});

describe('how a finding is known (9.2.12, 9.9.7)', () => {
  it('9.S6, 9.S62: shows a fact measured in the topic, and one measured in the conversation with no experiment, in the record\'s findings beside its decisions, each saying how it is known — its kind, in words, the command run and its result — and when', () => {
    const measured = find(NOTE, 'A panel opens in 4 ms.', [], { how: 'timed the open', known: 'measured', command: 'swift run bench open', result: 'median 4.1 ms over 50 runs' });
    const exploratory = find(NOTE, 'A sheet opens in 9 ms.', [], { how: 'timed once in the conversation', known: 'exploratory', command: 'swift run bench sheet', result: '9.3 ms' });
    const decided = decide(NOTE, ask(NOTE, 'Is a note a panel?'), 'A panel.', ['--relies-on', measured]);

    const record = read('record', UNIT, 'note-window');

    assert.deepStrictEqual(record.findings.map((/** @type {Record<string, unknown>} */ f) => [f.id, f.known, f.how, f.command, f.result, f.at]), [
      [measured, 'measured', 'timed the open', 'swift run bench open', 'median 4.1 ms over 50 runs', line(measured).at],
      [exploratory, 'exploratory', 'timed once in the conversation', 'swift run bench sheet', '9.3 ms', line(exploratory).at],
    ]);
    assert.deepStrictEqual(ids(record.decisions), [decided]);
  });

  it('refuses a finding saying no kind, a measured one without the command run and its result, and a command without its result or a result without its command, appending nothing', () => {
    const fact = { ...MADE, text: 'A panel opens in 4 ms.', how: 'timed the open' };

    refused('find', NOTE, [], fact, /^ledger find: the content needs known$/);
    refused('find', NOTE, [], { ...fact, known: 'measured' }, /^ledger find: a measured finding records the command run and its result — the content needs command and result$/);
    refused('find', NOTE, [], { ...fact, known: 'exploratory', command: 'swift run bench open' }, /^ledger find: a finding's command comes with its result — the content gives a command and no result$/);
    refused('find', NOTE, [], { ...fact, known: 'documented', result: '4.1 ms' }, /^ledger find: a finding's command comes with its result — the content gives a result and no command$/);
  });
});

describe('what an entry cites (21.6.3, 21.6.4)', () => {
  it('carries the sections an entry of each kind cites as written — a question, a finding, a decision and a replacement — none where it cites none, and refuses a citation that is no path from the state root and a heading in it', () => {
    const spec = [...CITES, { path: `${UNIT}/specification/notes/specification.md`, section: 'Windows' }];
    const asked = write('ask', NOTE, [], { ...MADE, text: 'Is a note a window?', cites: CITES }).id;
    const found = find(NOTE, 'Panels float.', [], { cites: CITES });
    const decided = decide(NOTE, asked, 'A panel.', [], { cites: spec });
    const snapping = ask(NOTE, 'Does a note snap?');
    const plain = decide(NOTE, snapping, 'Notes snap.');
    const changed = write('replace', NOTE, ['--replaces', plain, '--reason', 'changed-mind'], { ...MADE, drops: ['snap'], text: 'Notes float free.', why: 'Free.', cites: CITES }).id;

    const record = read('record', UNIT, 'note-window');
    const cited = (/** @type {Record<string, unknown>[]} */ shown) => shown.map((e) => [e.id, e.cites]);
    assert.deepStrictEqual([...cited(record.questions), ...cited(record.findings), ...cited(record.decisions)], [
      [asked, CITES], [snapping, []], [found, CITES], [decided, spec], [changed, CITES],
    ]);
    assert.deepStrictEqual(record.decisions[1].replaced.map((/** @type {Record<string, unknown>} */ e) => [e.id, e.cites]), [[plain, []]]);
    for (const cite of [{ path: '../notes.md', section: 'Windows' }, { path: '/notes.md', section: 'Windows' }, { path: 'notes.md' }, { path: 'notes.md', section: 'Windows', line: 3 }, { path: 'notes.md', section: '' }]) {
      refused('ask', NOTE, [], { ...MADE, text: 'Is a note a sheet?', cites: [cite] }, /^ledger ask: the content's cites is not a list of a citation, \{path, section\}: a path from the state root and a heading$/);
    }
  });
});

describe('the files an entry links (9.10.5–9.10.7, 9.10.16)', () => {
  /**
   * A file linked from `entry` where `at` says, as the asset verb will link
   * one, committed.
   * @param {string} entry @param {string} file @param {string} status @param {string|null} [into]
   * @param {{unit: string, topic: string}} [at]
   */
  function link(entry, file, status, into = null, at = { unit: UNIT, topic: 'note-window' }) {
    appendEntry(statePath(dir), { event: 'asset', ...at, phase: 'discussion', session: SESSION_ID, entry: full(entry), path: file, status, into }, []);
    stateGit(dir, ['add', layout.ledger]);
    stateGit(dir, ['commit', '-q', '-m', 'state: a file linked']);
  }

  it('folds the links per entry and file, the latest live one standing, in the order each file was first linked: a link made in a unit since cancelled stands no more, and a link is no entry of any record or map', () => {
    mint();
    const asked = ask(NOTE, 'What does a note look like?');
    const decided = decide(NOTE, asked, 'A frameless panel.');
    const mock = `${UNIT}/assets/note-mock.png`;
    const frame = `${UNIT}/spikes/001-frame/Frame.swift`;
    link(decided, mock, 'reference');
    link(decided, frame, 'reference');
    link(decided, mock, 'canonical');
    link(decided, frame, 'lifted', 'Sources/Note/Frame.swift', { unit: 'mint', topic: 'mint' });

    const record = read('record', UNIT, 'note-window');

    assert.deepStrictEqual(record.decisions[0].assets, [{ path: mock, status: 'canonical', into: null }, { path: frame, status: 'lifted', into: 'Sources/Note/Frame.swift' }]);
    assert.deepStrictEqual([ids(record.questions), ids(record.findings), ids(record.decisions), ids(read('map', UNIT, 'note-window').questions)], [[asked], [], [decided], [asked]]);
    ok(dir, ['workunit', 'cancel', 'mint']);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions[0].assets, [{ path: mock, status: 'canonical', into: null }, { path: frame, status: 'reference', into: null }]);
  });
});

describe('a ledger version 1 wrote (5.7.2)', () => {
  /** Every projection of the ledger in `at`, and the note window's copy. @param {string} at */
  function projections(at) {
    const reading = (/** @type {string[]} */ ...args) => ok(at, args);
    return {
      record: reading('ledger', 'record', UNIT, 'note-window'),
      unit: reading('ledger', 'record', UNIT),
      map: reading('ledger', 'map', UNIT, 'note-window'),
      product: reading('ledger', 'product'),
      since: reading('ledger', 'since', UNIT),
      affected: reading('ledger', 'affected', UNIT),
      verdicts: reading('verdict', 'queue'),
    };
  }

  it('reads every projection as version 2 would but a finding\'s kind, unsaid — no citation, the command and result none, each decision its maker\'s own — and renders it so; a version-1 line holding a field version 2 added is broken, and an asset line', () => {
    const written = ledgerWorld('ledger-provenance-v2-');
    try {
      keywordOnlyKnowledge(written);
      const there = ledgerReadHelpers(() => written);
      const question = there.ask(NOTE, 'Is a note a window?');
      const call = there.decide(NOTE, question, 'A panel.', [], { product_wide: true });
      there.find(NOTE, 'Panels float above every Space.', [], { how: 'the person said so', known: 'read' });
      there.ask(SPACE, 'Does a panel follow the person?', ['--relies-on', call]);
      there.decide(NOTE, there.ask(NOTE, 'Does a note snap?'), 'Notes snap to the grid.');
      there.write('replace', NOTE, ['--replaces', call, '--reason', 'changed-mind'], { by: 'person', drops: ['a panel'], text: 'A document window.', why: 'Notes are documents.' });
      const expected = JSON.parse(JSON.stringify(projections(written)), (key, value) => (key === 'known' ? null : value));
      const copied = fs.readFileSync(statePath(written, NOTE_COPY), 'utf8').replace('How it is known: read, the person said so', 'How it is known: the person said so');
      const v1 = there.rawLines().map((raw) => {
        const { given: _given, known: _known, command: _command, result: _result, cites: _cites, ...fields } = JSON.parse(raw);
        return `${JSON.stringify({ ...fields, v: 1 })}\n`;
      });
      keywordOnlyKnowledge(dir);
      fs.writeFileSync(statePath(dir, layout.ledger), v1.join(''));
      stateGit(dir, ['add', layout.ledger]);
      stateGit(dir, ['commit', '-q', '-m', 'state: the ledger version 1 wrote']);

      assert.deepStrictEqual(projections(dir), expected);
      ask(SPACE, 'Does a panel take focus?');
      assert.strictEqual(fs.readFileSync(statePath(dir, NOTE_COPY), 'utf8'), copied);
    } finally {
      cleanupFixture(written);
    }
    const lines = rawLines().map((raw) => `${raw}\n`);
    const decision = JSON.parse(/** @type {string} */ (lines.find((raw) => JSON.parse(raw).event === 'decided')));
    const asset = { v: 1, id: 'z'.repeat(21), event: 'asset', unit: UNIT, topic: 'note-window', phase: 'discussion', session: SESSION_ID, at: decision.at, entry: decision.id, path: `${UNIT}/assets/note-mock.png`, status: 'canonical', into: null };
    /** The refusal a read gives with `tail` appended, uncommitted. @param {Record<string, unknown>} tail */
    const brokenBy = (tail) => {
      fs.writeFileSync(statePath(dir, layout.ledger), [...lines, `${JSON.stringify(tail)}\n`].join(''));
      return refuses(dir, ['ledger', 'record', UNIT, 'note-window']).error;
    };
    assert.match(brokenBy({ ...decision, id: 'z'.repeat(21), given: 'own' }), new RegExp(`^line ${lines.length + 1} of the ledger is no ledger entry: the decided event has no field given at version 1`));
    assert.match(brokenBy(asset), new RegExp(`^line ${lines.length + 1} of the ledger is no ledger entry: its event "asset" is none of version 1's`));
  });
});

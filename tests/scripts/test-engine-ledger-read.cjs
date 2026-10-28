'use strict';

// ---------------------------------------------------------------------------
// The ledger's read verbs (workflow-engine/scripts/domain/ledger-read.cjs)
// and the fold they read through (domain/ledger-fold.cjs): `engine ledger
// record|product`, each a projection of the ledger answered as JSON — the
// current entries standing in a unit or a topic, with the live answers each
// replaced folded beneath it and the confirmations that it still holds, its
// moves as history, and the current entries standing elsewhere that it
// relies on, read from their own lines; the entries marked product-wide.
// Siblings stand apart. A ledger past the 64 MiB a pipe holds is read
// without being held: each read answers under a heap a reader holding its
// lines cannot fit in.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ENGINE, ok, refuses, stateGit, statePath, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { LEDGER, validEvent } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { appendEntry } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { READ_BUDGET_BYTES } = require(path.join(SCRIPTS, 'kernel/git.cjs'));

const {
  UNIT, SESSION_ID, SESSION, MADE, NOTE, SPACE, HEAP_MB, ids, ledgerReadHelpers, ledgerWorld,
} = require('./ledger-world.cjs');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = ledgerWorld('ledger-read-');
});

afterEach(() => {
  cleanupFixture(dir);
});

const { write, ask, find, decide, change, read, rawLines, events, full, line, current } = ledgerReadHelpers(() => dir);

describe('a record (5.6.5, 5.8.4)', () => {
  it('shows a decision replaced through `ledger replace` with "a changed mind" by the replacement, the decision folded beneath it, its line byte for byte unchanged (2.S11, 5.S8)', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const old = decide(NOTE, question, 'A near-frameless floating note.');
    const before = rawLines();

    const replacement = change(NOTE, old, 'A frameless surface.');

    assert.deepStrictEqual(rawLines().slice(0, -1), before, 'the replacement edited a line before it');
    assert.deepStrictEqual([events().at(-1).event, events().at(-1).replaces, events().at(-1).reason], ['replaced', full(old), 'changed-mind']);
    const record = read('record', UNIT, 'note-window');
    assert.deepStrictEqual(record, {
      ok: true, unit: UNIT, topic: 'note-window', live: true,
      questions: [current(question)], findings: [], decisions: [current(replacement, [old])], moved: [], merged: [], other_topics: [],
    });
  });

  it('shows a chain three deep with the current answer first and the answers it replaced beneath it, newest first and oldest last', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const first = decide(NOTE, question, 'A window.');
    const second = change(NOTE, first, 'A panel.');
    const third = change(NOTE, second, 'A frameless surface.');

    const { decisions } = read('record', UNIT, 'note-window');

    assert.deepStrictEqual(decisions, [current(third, [second, first])]);
    assert.deepStrictEqual([decisions[0].text, ...decisions[0].replaced.map((/** @type {{text: string}} */ e) => e.text)], ['A frameless surface.', 'A panel.', 'A window.']);
  });

  it('keeps siblings apart (5.3.13): one answer replaced leaves the other current, and the question\'s current answer is the untouched sibling and the replacement', () => {
    const question = ask(NOTE, 'How does a note look?');
    const frame = decide(NOTE, question, 'Near-frameless.');
    const hover = decide(NOTE, question, 'Its controls appear on hover.');

    const reframed = change(NOTE, frame, 'Frameless.');

    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(hover), current(reframed, [frame])]);
    const [rowShown] = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual([rowShown.stands, rowShown.answers.map((/** @type {{id: string}} */ a) => a.id)], ['answered', [hover, reframed]]);
  });

  it('shows each confirmation that an entry still holds beneath the entry it confirms (5.6.5)', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const old = decide(NOTE, question, 'A window.');
    const relying = find(NOTE, 'A window takes focus.', ['--relies-on', old]);
    const replacement = change(NOTE, old, 'A panel.');

    const confirmed = write('hold', NOTE, ['--entry', relying, '--after', replacement], MADE).id;

    assert.deepStrictEqual(read('record', UNIT, 'note-window').findings, [current(relying, [], [confirmed])]);
    assert.strictEqual(line(confirmed).after, replacement);
  });

  it('shows another topic\'s current answer it relies on from that topic\'s own entry, and the new one once it is replaced (5.S20)', () => {
    const theirs = decide(SPACE, ask(SPACE, 'Does a note follow the person?'), 'A note follows the person.');
    const ours = decide(NOTE, ask(NOTE, 'Does a note float?'), 'Notes float above every Space.', ['--relies-on', theirs]);

    assert.deepStrictEqual(read('record', UNIT, 'note-window').other_topics, [{ ...line(theirs), named: [theirs] }]);

    const replaced = change(SPACE, theirs, 'A note follows the person, on every display.');

    const record = read('record', UNIT, 'note-window');
    assert.deepStrictEqual(record.other_topics, [{ ...line(replaced), named: [theirs] }]);
    assert.deepStrictEqual(record.decisions, [current(ours)], 'the record restated the other topic\'s answer');
  });

  it('shows a question moved to another topic in the old topic\'s record and on the new topic\'s map (5.S16)', () => {
    const question = ask(NOTE, 'Which Space does a new note open on?');

    const moved = write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE).id;

    assert.deepStrictEqual([events().at(-1).event, events().at(-1).question, events().at(-1).to], ['moved', full(question), 'space-homing']);
    const old = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([old.moved, old.questions], [[{ ...line(moved), text: 'Which Space does a new note open on?' }], []]);
    assert.deepStrictEqual(read('record', UNIT, 'space-homing').questions, [current(question)]);
    const [movedIn] = read('map', UNIT, 'space-homing').questions;
    assert.deepStrictEqual([movedIn.id, movedIn.stands, movedIn.moved_from], [question, 'open', 'note-window']);
    const [movedAway] = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual([movedAway.id, movedAway.stands, movedAway.moved_to], [question, 'moved-away', 'space-homing']);
  });

  it('reads a unit\'s every current entry, its topics\' and those made at its level, the replaced ones only beneath what replaced them', () => {
    const asked = ask(NOTE, 'Is a note a window?');
    const old = decide(NOTE, asked, 'A window.');
    const replacement = change(NOTE, old, 'A panel.');
    const elsewhere = ask(SPACE, 'Where does a note open?');
    const unitLevel = ask(`${UNIT}.specification`, 'Does the spec cover a second display?');

    const record = read('record', UNIT);

    assert.deepStrictEqual([record.topic, record.live, ids(record.questions), record.decisions], [null, true, [asked, elsewhere, unitLevel], [current(replacement, [old])]]);
    assert.deepStrictEqual(record.questions.map((/** @type {{topic: string|null}} */ q) => q.topic), ['note-window', 'space-homing', null]);
  });

  it('tags an entry with the unit whose session wrote it, and a session in a later unit reads that unit\'s entries directly (5.S28)', () => {
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    const question = write('ask', NOTE, [], { ...MADE, text: 'Is a note a window?' }, { CLAUDE_CODE_SESSION_ID: 'fumi-session' }).id;
    const decided = write('decide', NOTE, ['--answers', question], { ...MADE, text: 'A panel.', why: 'It floats.' }, { CLAUDE_CODE_SESSION_ID: 'fumi-session' }).id;
    assert.deepStrictEqual(events().map((e) => [e.unit, e.session]), [[UNIT, 'fumi-session'], [UNIT, 'fumi-session']]);

    write('ask', 'mint.discussion.mint', [], { ...MADE, text: 'Does Mint import Fumi\'s notes?' }, { CLAUDE_CODE_SESSION_ID: 'mint-session' });
    const fromMint = ok(dir, ['ledger', 'record', UNIT], { env: { CLAUDE_CODE_SESSION_ID: 'mint-session' } });

    assert.deepStrictEqual([ids(fromMint.questions), fromMint.decisions], [[question], [current(decided)]]);
    assert.deepStrictEqual(ok(dir, ['ledger', 'record', UNIT, 'note-window'], { env: { CLAUDE_CODE_SESSION_ID: 'mint-session' } }).decisions, [current(decided)]);
  });

  it('leaves both replacements of one entry current where two clones each replaced it, each with the entry beneath it', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const old = decide(NOTE, question, 'A window.');
    const here = change(NOTE, old, 'A panel.');
    const fields = /** @type {Record<string, any>} */ (events().find((e) => e.id === full(here)));
    const { v: _v, id: _id, at: _at, ...replacement } = fields;
    const there = /** @type {string} */ (appendEntry(statePath(dir), { ...replacement, session: 'other-clone', text: 'A sheet.' }, []).id).slice(0, 6);

    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(here, [old]), current(there, [old])]);
    assert.deepStrictEqual(read('map', UNIT, 'note-window').questions[0].answers.map((/** @type {{id: string}} */ a) => a.id), [here, there]);
    const refusal = refuses(dir, ['ledger', 'replace', NOTE, '--replaces', old, '--reason', 'changed-mind'], { env: SESSION, stdin: JSON.stringify({ ...MADE, drops: [], text: 'Again.', why: 'Again.' }) });
    assert.match(refusal.error, new RegExp(`^ledger replace --replaces names ${old}, which ${here} replaced — the current ones are ${here}, ${there}$`));
  });
});

describe('the product record (5.8.6)', () => {
  it('holds every current entry marked product-wide, from every unit and topic, each with the answers it replaced beneath it', () => {
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    const finding = find(NOTE, 'Notes sync through iCloud.', [], { product_wide: true });
    find(NOTE, 'A spike floated a panel.');
    const old = decide(SPACE, ask(SPACE, 'Is Fumi a menu-bar app?'), 'Fumi lives in the menu bar.', [], { product_wide: true });
    const replaced = change(SPACE, old, 'Fumi lives in the menu bar and the dock.');
    const minted = decide('mint.discussion.mint', ask('mint.discussion.mint', 'Is Mint free?'), 'Mint is free.', [], { product_wide: true });

    const product = read('product');

    assert.deepStrictEqual(product, { ok: true, findings: [current(finding)], decisions: [current(replaced, [old]), current(minted)] });
    assert.strictEqual(line(replaced).product_wide, true, 'the replacement did not keep the mark');
  });
});

describe('a large ledger (5.7.6, 5.7.8)', () => {
  /**
   * `args` run by the engine in a process of its own, its heap held to
   * `HEAP_MB`: what it answered, or how it died.
   * @param {string[]} args
   */
  function underHeap(args) {
    const res = spawnSync(process.execPath, [`--max-old-space-size=${HEAP_MB}`, ...args], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 24 });
    return { status: res.status, signal: res.signal, out: res.status === 0 ? JSON.parse(res.stdout) : null, err: res.stderr.slice(0, 400) };
  }

  it('reads a ledger past the 64 MiB a pipe holds without holding it: each read answers under a heap that a reader holding its lines cannot fit in', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.', [], { product_wide: true });
    const file = statePath(dir, LEDGER);
    const fd = fs.openSync(file, 'a');
    let size = fs.statSync(file).size;
    try {
      while (size <= READ_BUDGET_BYTES) {
        const bulk = `${JSON.stringify(validEvent({
          v: 1, id: newId(), event: 'found', unit: UNIT, topic: 'space-homing', phase: 'discussion', session: SESSION_ID, at: '2026-10-27T09:00:00Z',
          ...MADE, text: 'x'.repeat(2000), how: 'measured', relies_on: [], product_wide: false,
        }))}\n`;
        fs.writeSync(fd, bulk);
        size += Buffer.byteLength(bulk);
      }
    } finally {
      fs.closeSync(fd);
    }
    stateGit(dir, ['add', LEDGER]);
    stateGit(dir, ['commit', '-q', '-m', 'state: a long ledger']);

    const record = underHeap([ENGINE, 'ledger', 'record', UNIT, 'note-window']);
    const map = underHeap([ENGINE, 'ledger', 'map', UNIT, 'note-window']);
    const product = underHeap([ENGINE, 'ledger', 'product']);
    const affected = underHeap([ENGINE, 'ledger', 'affected', UNIT]);
    const since = underHeap([ENGINE, 'ledger', 'since', UNIT, 'note-window']);
    const verdicts = underHeap([ENGINE, 'ledger', 'verdicts']);

    for (const [name, res] of Object.entries({ record, map, product, affected, since, verdicts })) assert.strictEqual(res.status, 0, `${name} did not answer under ${HEAP_MB} MB: ${res.signal} ${res.err}`);
    assert.deepStrictEqual([ids(record.out.questions), ids(record.out.decisions)], [[question], [decided]]);
    assert.deepStrictEqual(ids(map.out.questions), [question]);
    assert.deepStrictEqual([ids(product.out.decisions), product.out.findings], [[decided], []]);
    assert.deepStrictEqual([affected.out.affected, ids(since.out.calls), verdicts.out.departures], [[], [decided], []]);
    const holding = underHeap(['-e', `const lines = []; for (const l of require('fs').readFileSync(${JSON.stringify(file)}, 'utf8').split('\\n')) lines.push(l); console.log('{}')`]);
    assert.notStrictEqual(holding.status, 0, `a reader holding the ledger's lines fit in ${HEAP_MB} MB, so the heap proves nothing`);
  });
});

describe('refusals', () => {
  it('refuses a read naming no unit, a unit there is none of, a topic the unit does not have, or anything but its places', () => {
    assert.match(refuses(dir, ['ledger', 'record']).error, /^Usage: engine ledger record <work-unit> \[<topic>\]$/);
    assert.match(refuses(dir, ['ledger', 'map', UNIT]).error, /^Usage: engine ledger map <work-unit> <topic>$/);
    assert.match(refuses(dir, ['ledger', 'product', UNIT]).error, /^Usage: engine ledger product$/);
    assert.match(refuses(dir, ['ledger', 'record', UNIT, '--topic', 'note-window']).error, /^Usage: engine ledger record /);
    assert.match(refuses(dir, ['ledger', 'record', 'mint']).error, /^ledger record: there is no work unit "mint"$/);
    assert.match(refuses(dir, ['ledger', 'map', UNIT, 'menu-bar']).error, /^ledger map: fumi has no topic "menu-bar"$/);
  });

  it('answers a ledger with no entries yet with nothing current', () => {
    assert.deepStrictEqual(read('record', UNIT, 'note-window'), {
      ok: true, unit: UNIT, topic: 'note-window', live: true, questions: [], findings: [], decisions: [], moved: [], merged: [], other_topics: [],
    });
    assert.deepStrictEqual(read('product'), { ok: true, findings: [], decisions: [] });
  });
});

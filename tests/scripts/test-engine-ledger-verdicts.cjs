'use strict';

// ---------------------------------------------------------------------------
// Departures and the verdict queue
// (workflow-engine/scripts/domain/ledger-verdicts.cjs): `engine ledger
// verdicts`, every departure made in a live place that the trust log holds
// no verdict on — a decision the person made whose answer stood over
// Claude's lean, the lean beside it from the nearest entry down its chain
// that held it — and who moved whom as the write verbs hold it: never over
// the lean on an entry Claude made, and on the person's replacement of a
// decision, what its reason and the entry it replaces allow, the engine
// setting it where that is one value and the writer leaves it out, the
// writer saying it where only the writer can tell.
//
// Real repositories in temp folders, each with its state worktree, the work
// unit's manifest written there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ok, refuses, stateGit, statePath, cleanupFixture } = require('./engine-harness.cjs');
const { UNIT, SESSION, MADE, NOTE, SPACE, row, ledgerWorld, ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { record } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));


/** The person's answer, and who moved whom on it. @param {string} moved */
function persons(moved) {
  return { by: 'person', who_moved_whom: moved };
}

/** @type {string} */
let dir;
/** The question each place's decisions answer, asked once a test. @type {Map<string, string>} */
let asked;

beforeEach(() => {
  dir = ledgerWorld('ledger-verdicts-', {
    discovery: { items: { 'note-window': row(1, 'The note window') } },
    discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
  });
  asked = new Map();
});

afterEach(() => {
  cleanupFixture(dir);
});

const { full } = ledgerHelpers(() => dir);

/** @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function args(verb, address, flags, content) {
  return /** @type {const} */ ([['ledger', verb, address, ...flags], { env: SESSION, stdin: JSON.stringify(content) }]);
}

/** One write that must succeed: its short id. @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function write(verb, address, flags, content) {
  return ok(dir, ...args(verb, address, flags, content)).id;
}

/** The ledger as it stands, and the state branch's tip. */
function written() {
  return [fs.readFileSync(statePath(dir, '.ledger.jsonl'), 'utf8'), stateGit(dir, ['rev-parse', 'HEAD'])];
}

/** One write that must refuse, writing and committing nothing: its error. @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function refused(verb, address, flags, content) {
  const before = written();
  const { error } = refuses(dir, ...args(verb, address, flags, content));
  assert.deepStrictEqual(written(), before, `ledger ${verb} refused, yet wrote or committed`);
  return error;
}

/** A decision answering the place's question, made and moved as `made` says. @param {string} text @param {Record<string, unknown>} made @param {string} [address] */
function decide(text, made, address = NOTE) {
  if (!asked.has(address)) asked.set(address, write('ask', address, [], { ...MADE, text: 'What is a note?' }));
  return write('decide', address, ['--answers', /** @type {string} */ (asked.get(address))], { ...made, text, why: `Why: ${text}` });
}

/** `old` replaced on the note window for `reason`, made and moved as `made` says. @param {string} old @param {string} reason @param {Record<string, unknown>} made @param {string[]} [flags] */
function replacing(old, reason, made, flags = []) {
  return /** @type {const} */ (['replace', NOTE, ['--replaces', old, '--reason', reason, ...flags], { ...made, drops: ['the old answer'], text: `Not ${old}.`, why: 'Because.' }]);
}

/** The departures waiting on a verdict, each by id and with its lean. */
function waiting() {
  return ok(dir, ['ledger', 'verdicts']).departures.map((/** @type {{id: string, lean: string}} */ d) => [d.id, d.lean]);
}

describe('the verdict queue (5.8.10, 16.10)', () => {
  it('waits on nothing where the person took Claude\'s lean or came round to it, and a departure is a decision: never Claude\'s own call, nor a finding', () => {
    decide('A panel.', { ...persons('none'), sealed: 'A panel.' });
    decide('A frameless window.', { ...persons('claude-moved-person'), sealed: 'A frameless window.' });
    decide('Notes snap to the grid.', MADE);
    write('find', NOTE, [], { ...persons('person-moved-claude'), text: 'Panels take no focus.', how: 'the person tried it' });

    assert.deepStrictEqual(ok(dir, ['ledger', 'verdicts']), { ok: true, departures: [] });
  });

  it('holds the person\'s answer that stood over Claude\'s lean — an amendment, an overrule, or a blind answer that differs from the sealed one — with the lean beside it, where it stands (16.10.1, 16.10.10)', () => {
    const departed = decide('A sheet.', { ...persons('person-moved-claude'), sealed: 'A panel.' });

    const [row] = ok(dir, ['ledger', 'verdicts']).departures;
    const shown = ok(dir, ['ledger', 'record', UNIT, 'note-window']).decisions.find((/** @type {{id: string}} */ d) => d.id === departed);
    const { holds: _holds, replaced: _replaced, ...line } = shown;
    assert.deepStrictEqual(row, { ...line, standing: { unit: UNIT, topic: 'note-window' }, lean: 'A panel.' });
  });

  it('holds the person\'s replacement of Claude\'s own call for a changed mind or a mistake — a call overruled when shown — the call it replaced as the lean, the engine setting who moved whom where the writer leaves it out and refusing any other', () => {
    const call = decide('A panel.', MADE);
    assert.strictEqual(refused(...replacing(call, 'was-wrong', persons('none'))),
      'ledger replace: who_moved_whom is none — the person replacing an answer that held Claude\'s lean, for a changed mind or a mistake, stands over it: person-moved-claude');

    const overruled = write(...replacing(call, 'was-wrong', { by: 'person' }));

    const [row] = ok(dir, ['ledger', 'verdicts']).departures;
    assert.deepStrictEqual([row.id, row.who_moved_whom, row.lean], [overruled, 'person-moved-claude', 'A panel.']);
  });

  it('holds a later reversal: the person\'s replacement of their own answer that took Claude\'s lean, or came round to it (16.10.10)', () => {
    const agreed = decide('A panel.', { ...persons('none'), sealed: 'A panel.' });
    const cameRound = decide('A frameless window.', { ...persons('claude-moved-person'), sealed: 'A frameless window.' });

    const reversed = write(...replacing(agreed, 'changed-mind', persons('person-moved-claude')));
    const reversedToo = write(...replacing(cameRound, 'changed-mind', persons('person-moved-claude')));

    assert.deepStrictEqual(waiting(), [[reversed, 'A panel.'], [reversedToo, 'A frameless window.']]);
  });

  it('takes the person\'s replacement of their own departure at their word, a return to Claude\'s lean or a third answer still against it, never the lean from the start: the return leaves the departure waiting alone, and a third answer waits beside it, Claude\'s lean beside it still', () => {
    const returned = decide('A sheet.', { ...persons('person-moved-claude'), sealed: 'A panel.' });
    assert.strictEqual(refused(...replacing(returned, 'changed-mind', persons('none'))),
      'ledger replace: who_moved_whom is none — the person replacing an answer that stood over Claude\'s lean, for a changed mind or a mistake, comes back round to it or stands over it still: claude-moved-person or person-moved-claude');
    assert.strictEqual(refused(...replacing(returned, 'changed-mind', { by: 'person' })), 'ledger replace: the content needs who_moved_whom');
    write(...replacing(returned, 'changed-mind', persons('claude-moved-person')));
    assert.deepStrictEqual(waiting(), [[returned, 'A panel.']]);

    const departed = decide('A frameless window.', { ...persons('person-moved-claude'), sealed: 'A panel.' });
    const third = write(...replacing(departed, 'was-wrong', persons('person-moved-claude')));

    assert.deepStrictEqual(waiting(), [[returned, 'A panel.'], [departed, 'A panel.'], [third, 'A panel.']]);
  });

  it('never takes a replacement for a new fact or another topic\'s decision as a departure: new information, not disagreement', () => {
    const call = decide('A panel.', MADE);
    const fact = write('find', NOTE, [], { ...MADE, text: 'Panels take no focus.', how: 'a spike' });
    const theirs = decide('A note opens on the active Space.', MADE, SPACE);
    assert.strictEqual(refused(...replacing(call, 'new-fact', persons('person-moved-claude'), ['--cause', fact])),
      'ledger replace: who_moved_whom is person-moved-claude — a replacement for a new fact brings new information, never the person standing over Claude\'s lean: none or claude-moved-person');
    assert.strictEqual(refused(...replacing(call, 'other-topic', persons('person-moved-claude'), ['--cause', theirs])),
      'ledger replace: who_moved_whom is person-moved-claude — a replacement for another topic\'s decision brings new information, never the person standing over Claude\'s lean: none or claude-moved-person');

    const changed = write(...replacing(call, 'new-fact', persons('none'), ['--cause', fact]));
    write(...replacing(changed, 'other-topic', persons('claude-moved-person'), ['--cause', theirs]));

    assert.deepStrictEqual(waiting(), []);
  });

  it('refuses an entry Claude made standing over its own lean', () => {
    const question = write('ask', NOTE, [], { ...MADE, text: 'Is a note a window?' });
    assert.strictEqual(refused('decide', NOTE, ['--answers', question], { by: 'claude', who_moved_whom: 'person-moved-claude', text: 'A panel.', why: 'It floats.' }),
      'ledger decide: who_moved_whom is person-moved-claude — an entry Claude made never stands over its own lean: none or claude-moved-person');
  });

  it('measures the person\'s replacement carrying Claude\'s sealed answer against it, as any answer is: the writer\'s who moved whom stands, any of the three, whatever the reason, and a departure waits with its own sealed answer as the lean; Claude\'s still never stands over its own (5.3.10, 16.10.10)', () => {
    const fact = write('find', NOTE, [], { ...MADE, text: 'Panels take no focus.', how: 'a spike' });
    const blind = (/** @type {string} */ moved) => ({ ...persons(moved), sealed: 'A sheet.' });
    const agreed = decide('A panel.', MADE);
    const departedFor = decide('A frameless window.', MADE);
    const returned = decide('A floating note.', { ...persons('person-moved-claude'), sealed: 'A panel.' });
    assert.strictEqual(refused(...replacing(agreed, 'was-wrong', { by: 'person', sealed: 'A sheet.' })), 'ledger replace: the content needs who_moved_whom');
    assert.strictEqual(refused(...replacing(agreed, 'was-wrong', { by: 'claude', who_moved_whom: 'person-moved-claude', sealed: 'A sheet.' })),
      'ledger replace: who_moved_whom is person-moved-claude — an entry Claude made never stands over its own lean: none or claude-moved-person');

    write(...replacing(agreed, 'was-wrong', blind('none')));
    const departed = write(...replacing(departedFor, 'new-fact', blind('person-moved-claude'), ['--cause', fact]));
    write(...replacing(returned, 'changed-mind', blind('none')));

    assert.deepStrictEqual(waiting(), [[returned, 'A panel.'], [departed, 'A sheet.']]);
  });

  it('leaves out a departure the trust log holds a verdict on, and one made where it is set aside until it comes back', () => {
    const judged = decide('A sheet.', { ...persons('person-moved-claude'), sealed: 'A panel.' });
    const unjudged = decide('A frameless window.', { ...persons('person-moved-claude'), sealed: 'A panel.' });
    assert.deepStrictEqual(waiting(), [[judged, 'A panel.'], [unjudged, 'A panel.']]);

    const pinned = process.env.WORKFLOWS_CONFIG_DIR;
    process.env.WORKFLOWS_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-verdicts-config-'));
    try {
      record('verdict', { entry: full(judged), verdict: 'loss', point: 'decided' }, { cwd: dir, warnings: [] });
      assert.deepStrictEqual(waiting(), [[unjudged, 'A panel.']]);

      ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
      assert.deepStrictEqual(waiting(), []);
      ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
      assert.deepStrictEqual(waiting(), [[unjudged, 'A panel.']]);
    } finally {
      cleanupFixture(process.env.WORKFLOWS_CONFIG_DIR);
      process.env.WORKFLOWS_CONFIG_DIR = pinned;
    }
  });

  it('refuses a read naming a place', () => {
    assert.match(refuses(dir, ['ledger', 'verdicts', UNIT]).error, /^Usage: engine ledger verdicts$/);
  });
});

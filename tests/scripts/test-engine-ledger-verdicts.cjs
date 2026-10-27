'use strict';

// ---------------------------------------------------------------------------
// Departures and the verdict queue
// (workflow-engine/scripts/domain/ledger-verdicts.cjs): `engine ledger
// verdicts`, every departure made in a live place that the trust log holds
// no verdict on — a decision the person made whose answer stood over
// Claude's lean, its lean beside it — and who moved whom as the write verbs
// hold it: never over the lean on an entry Claude made, and on the person's
// replacement of a decision, what its reason and the entry it replaces make
// it, never the writer's word.
//
// Real repositories in temp folders, each with its state worktree, the work
// unit's manifest written there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, refuses, statePath, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { trustLog } = require(path.join(SCRIPTS, 'domain/ledger-verdicts.cjs'));

const UNIT = 'fumi';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'session-1' });
const NOTE = `${UNIT}.discussion.note-window`;
const SPACE = `${UNIT}.discussion.space-homing`;
const CLAUDES = Object.freeze({ by: 'claude', who_moved_whom: 'none' });

/** The person's answer, and who moved whom on it. @param {string} moved */
function persons(moved) {
  return { by: 'person', who_moved_whom: moved };
}

/** @type {string} */
let dir;

beforeEach(() => {
  dir = setupGitFixture('ledger-verdicts-');
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: { 'note-window': { order: 1, summary: 'The note window', routing: 'discussion', source: 'discovery' } } },
      discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
    },
  });
});

afterEach(() => {
  cleanupFixture(dir);
});

/** @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function args(verb, address, flags, content) {
  return /** @type {const} */ ([['ledger', verb, address, ...flags], { env: SESSION, stdin: JSON.stringify(content) }]);
}

/** One write that must succeed: its short id. @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function write(verb, address, flags, content) {
  return ok(dir, ...args(verb, address, flags, content)).id;
}

/** One write that must refuse: its error. @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function refused(verb, address, flags, content) {
  return refuses(dir, ...args(verb, address, flags, content)).error;
}

/** A decision answering a question asked with it, made and moved as `made` says. @param {string} text @param {Record<string, unknown>} made @param {string} [address] */
function decide(text, made, address = NOTE) {
  const question = write('ask', address, [], { ...CLAUDES, text: `${text}?` });
  return write('decide', address, ['--answers', question], { ...made, text, why: `Why: ${text}` });
}

/** `old` replaced on the note window for `reason`, made and moved as `made` says. @param {string} old @param {string} reason @param {Record<string, unknown>} made @param {string[]} [flags] */
function replacing(old, reason, made, flags = []) {
  return /** @type {const} */ (['replace', NOTE, ['--replaces', old, '--reason', reason, ...flags], { ...made, drops: ['the old answer'], text: `Not ${old}.`, why: 'Because.' }]);
}

/** The departures waiting on a verdict, by id. */
function waiting() {
  return ok(dir, ['ledger', 'verdicts']).departures.map((/** @type {{id: string}} */ d) => d.id);
}

/** The full id a short id shows. @param {string} short */
function full(short) {
  return /** @type {string} */ (fs.readFileSync(statePath(dir, '.ledger.jsonl'), 'utf8').split('\n').slice(0, -1).map((l) => JSON.parse(l).id).find((id) => id.startsWith(short)));
}

describe('the verdict queue (5.8.10, 16.10)', () => {
  it('waits on nothing where the person took Claude\'s lean or came round to it, and a departure is a decision: never Claude\'s own call, nor a finding', () => {
    decide('A panel.', { ...persons('none'), sealed: 'A panel.' });
    decide('A frameless window.', { ...persons('claude-moved-person'), sealed: 'A frameless window.' });
    decide('Notes snap to the grid.', CLAUDES);
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

  it('holds the person\'s replacement of Claude\'s own call for a changed mind or a mistake — a call overruled when shown — the call it replaced as the lean, the engine taking no other word on who moved whom', () => {
    const call = decide('A panel.', CLAUDES);
    assert.strictEqual(refused(...replacing(call, 'was-wrong', persons('none'))),
      'ledger replace: who_moved_whom is none — the person replacing an answer that held Claude\'s lean, for a changed mind or a mistake, stands over it: person-moved-claude');

    const overruled = write(...replacing(call, 'was-wrong', persons('person-moved-claude')));

    const [row] = ok(dir, ['ledger', 'verdicts']).departures;
    assert.deepStrictEqual([row.id, row.lean], [overruled, 'A panel.']);
  });

  it('holds a later reversal: the person\'s replacement of their own answer that took Claude\'s lean, or came round to it (16.10.10)', () => {
    const agreed = decide('A panel.', { ...persons('none'), sealed: 'A panel.' });
    const cameRound = decide('A frameless window.', { ...persons('claude-moved-person'), sealed: 'A frameless window.' });

    const reversed = write(...replacing(agreed, 'changed-mind', persons('person-moved-claude')));
    const reversedToo = write(...replacing(cameRound, 'changed-mind', persons('person-moved-claude')));

    assert.deepStrictEqual(waiting(), [reversed, reversedToo]);
  });

  it('takes a reversal back to Claude\'s lean as the person coming round, the departure it reverses still waiting', () => {
    const departed = decide('A sheet.', { ...persons('person-moved-claude'), sealed: 'A panel.' });
    assert.strictEqual(refused(...replacing(departed, 'changed-mind', persons('person-moved-claude'))),
      'ledger replace: who_moved_whom is person-moved-claude — the person replacing an answer that stood over Claude\'s lean, for a changed mind or a mistake, comes back round to it: claude-moved-person');

    write(...replacing(departed, 'changed-mind', persons('claude-moved-person')));

    assert.deepStrictEqual(waiting(), [departed]);
  });

  it('never takes a replacement for a new fact or another topic\'s decision as a departure: new information, not disagreement', () => {
    const call = decide('A panel.', CLAUDES);
    const fact = write('find', NOTE, [], { ...CLAUDES, text: 'Panels take no focus.', how: 'a spike' });
    const theirs = decide('A note opens on the active Space.', CLAUDES, SPACE);
    assert.strictEqual(refused(...replacing(call, 'new-fact', persons('person-moved-claude'), ['--cause', fact])),
      'ledger replace: who_moved_whom is person-moved-claude — a replacement for a new fact brings new information, never the person standing over Claude\'s lean');
    assert.strictEqual(refused(...replacing(call, 'other-topic', persons('person-moved-claude'), ['--cause', theirs])),
      'ledger replace: who_moved_whom is person-moved-claude — a replacement for another topic\'s decision brings new information, never the person standing over Claude\'s lean');

    const changed = write(...replacing(call, 'new-fact', persons('none'), ['--cause', fact]));
    write(...replacing(changed, 'other-topic', persons('claude-moved-person'), ['--cause', theirs]));

    assert.deepStrictEqual(waiting(), []);
  });

  it('refuses an entry Claude made standing over its own lean', () => {
    const question = write('ask', NOTE, [], { ...CLAUDES, text: 'Is a note a window?' });
    assert.strictEqual(refused('decide', NOTE, ['--answers', question], { by: 'claude', who_moved_whom: 'person-moved-claude', text: 'A panel.', why: 'It floats.' }),
      'ledger decide: who_moved_whom is person-moved-claude — an entry Claude made never stands over its own lean');
  });

  it('leaves out a departure the trust log holds a verdict on, and one made where it is set aside until it comes back', (t) => {
    const judged = decide('A sheet.', { ...persons('person-moved-claude'), sealed: 'A panel.' });
    const unjudged = decide('A frameless window.', { ...persons('person-moved-claude'), sealed: 'A panel.' });
    assert.deepStrictEqual(waiting(), [judged, unjudged]);

    t.mock.method(trustLog, 'verdicts', () => new Set([full(judged)]));
    assert.deepStrictEqual(waiting(), [unjudged]);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(waiting(), []);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(waiting(), [unjudged]);
  });

  it('refuses a read naming a place', () => {
    assert.match(refuses(dir, ['ledger', 'verdicts', UNIT]).error, /^Usage: engine ledger verdicts$/);
  });
});

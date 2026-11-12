'use strict';

// ---------------------------------------------------------------------------
// The evidence this machine logged on a project (leeway-engine/scripts/
// domain/trust-evidence.cjs, over trust-log.cjs's read): each answer the
// trust log holds and where it stands — a raise answered with Claude's
// sealed answer, or in the person's own words read as it, an agreement, with
// another row or the person's own words read as another or as none a
// departure, one not followed no weight, a call Claude's call, a reversal a
// departure cancelling the answer whose entry it reverses, that answer's
// event as written — each answer's question, its kind and Claude's sort, a
// reversal's those of the answer it reverses, the kind as last corrected;
// the departures, each entry's verdicts in the order given, a correction of
// one among them and never a correction of a kind, and the entries given a
// verdict, each one's latest by its time and not a skip; read in one pass,
// once by id,
// from the log, a conversation's waiting events and an event kept ahead of
// an entry this state's ledger holds, never one kept ahead of an entry it
// lacks, and never another project's.
//
// Layer: unit. World: a project is a plain folder whose state root is
// pinned, its ledger a line for each entry it holds, and each test keeps
// its log in a config folder of its own (trust-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { statePath, layout, failingTrustAppends } = require('./engine-harness.cjs');
const { idOf, PROJECT_ID, lines, from, waitingPath, inConversation, useTrustWorld } = require('./trust-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { trustEvent } = require(path.join(SCRIPTS, 'domain/trust-events.cjs'));
const { newEvent, keepEvent, record } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { evidenceOf } = require(path.join(SCRIPTS, 'domain/trust-evidence.cjs'));

const { logPath, logText, project } = useTrustWorld('trust-evidence-');

// A raise's fields, Claude's sealed answer row 1: answered with it, with
// another row, in the person's own words — read as no row, as row 1 or as
// row 2 — or not followed.
const RAISE = Object.freeze({ kind: null, label: null, sort: 'several', sealed: '1', via: 'pressed', with_text: false, reading: null, didnt_follow: false, dont_care: false, blocks_build: false, replaced_by: null, always: null });
const AGREES = Object.freeze({ ...RAISE, answer: '1' });
const DEPARTS = Object.freeze({ ...RAISE, answer: '2' });
const OWN_WORDS = Object.freeze({ ...RAISE, answer: null, via: 'typed', with_text: true });
const OWN_WORDS_AGREEING = Object.freeze({ ...OWN_WORDS, reading: '1' });
const OWN_WORDS_DEPARTING = Object.freeze({ ...OWN_WORDS, reading: '2' });
const NOT_FOLLOWED = Object.freeze({ ...RAISE, entry: null, answer: null, didnt_follow: true });

/** The ledger of the project at `dir` holding `entries`, a line each. @param {string} dir @param {...string} entries */
function ledgerHolding(dir, ...entries) {
  fs.writeFileSync(statePath(dir, layout.ledger), entries.map((id) => `${JSON.stringify({ id })}\n`).join(''));
}

/** The evidence of the project at `dir`. @param {string} dir */
const evidence = (dir) => evidenceOf(statePath(dir));

/** Each answer by its event's id, where it stands, and the reversal cancelling it. @param {string} dir */
function standings(dir) {
  return evidence(dir).answers.map(({ event, standing, cancelled_by: cancelledBy }) => [event.id, standing, cancelledBy]);
}

/** A raise logged from `dir` naming `entry`, as `fields` answer it. @param {string} dir @param {string} entry @param {Record<string, unknown>} fields */
const raised = (dir, entry, fields) => record('raise', { ...fields, entry }, from(dir));

/** A reversal logged from `dir`: `entry` reversing `reverses`. @param {string} dir @param {string} entry @param {string} reverses */
const reversal = (dir, entry, reverses) => record('reversal', { entry, reverses }, from(dir));

describe('where each answer stands (16.12.1, 16.10.1)', () => {
  it('stands a raise answered with Claude\'s sealed answer, in the person\'s own words read as it, or with their "don\'t care", as an agreement, with another row or in the person\'s own words read as another or as none as a departure, one not followed as no weight, and a call as Claude\'s call; the departures their entries; a gate, a verdict and a blind draw no answer', () => {
    const dir = project('fumi');
    const [agreed, departed, own, ownAgreed, ownDeparted, called, careless] = ['Agreed', 'Departed', 'Own', 'OwnAgreed', 'OwnDeparted', 'Called', 'Careless'].map(idOf);
    const answers = [
      raised(dir, agreed, AGREES), raised(dir, departed, DEPARTS), raised(dir, own, OWN_WORDS), raised(dir, ownAgreed, OWN_WORDS_AGREEING), raised(dir, ownDeparted, OWN_WORDS_DEPARTING),
      record('raise', NOT_FOLLOWED, from(dir)), record('call', { entry: called, kind: null, label: null, sort: 'one' }, from(dir)),
      raised(dir, careless, { ...AGREES, via: 'typed', dont_care: true }),
    ];
    record('gate', { gate: 'state lost gate', recommended: 'y', picked: 'n', via: 'pressed', with_text: false, reading: null }, from(dir));
    record('verdict', { entry: departed, verdict: 'skip', point: 'decided' }, from(dir));
    record('blind-draw', { entry: called, kind: null }, from(dir));

    const read = evidence(dir);

    assert.deepStrictEqual(read.answers, answers.map((event, i) => ({
      event, standing: ['agreement', 'departure', 'departure', 'agreement', 'departure', 'no-weight', 'call', 'agreement'][i], cancelled_by: null, kind: null, sort: i === 6 ? 'one' : 'several', model: null,
    })));
    assert.deepStrictEqual(read.departures, new Set([departed, own, ownDeparted]));
  });

  it('gives each answer its question\'s kind and Claude\'s sort as its event holds them, a reversal those of the answer it reverses wherever each was read, and the kind as the person last corrected that of either entry (16.15.4)', (t) => {
    const dir = project('fumi');
    const [agreed, called, relabelled, unknown] = ['Agreed', 'Called', 'Relabelled', 'Unknown'].map(idOf);
    const failing = failingTrustAppends(t);
    inConversation(dir, () => raised(dir, agreed, { ...AGREES, kind: 'look', sort: 'one' }));
    failing.mock.restore();
    record('call', { entry: called, kind: 'scope', label: null, sort: 'several' }, from(dir));
    raised(dir, relabelled, { ...AGREES, kind: 'look' });
    const reversals = [reversal(dir, idOf('RevAgreed'), agreed), reversal(dir, idOf('RevCalled'), called), reversal(dir, idOf('RevUnknown'), unknown)];
    /** @param {string} entry @param {string} kind */
    const correct = (entry, kind) => record('correction', { entry, kind, verdict: null }, from(dir));
    correct(relabelled, 'contract');
    correct(relabelled, 'words');
    correct(reversals[1].entry, 'internals');

    const questions = evidence(dir).answers.map(({ event, kind, sort }) => [event.entry, kind, sort]);
    assert.deepStrictEqual(questions, [
      [called, 'scope', 'several'], [relabelled, 'words', 'several'],
      [reversals[0].entry, 'look', 'one'], [reversals[1].entry, 'internals', 'several'], [reversals[2].entry, null, null],
      [agreed, 'look', 'one'],
    ]);
  });

  it('stands a reversal as a departure that cancels the agreement or the call whose entry it reverses, wherever each was read, and rewrites nothing: the answers it reverses stay as written, and one it never named stands (16.S41, 16.12.2)', (t) => {
    const dir = project('fumi');
    const [agreed, called, untouched, reversedAgreement, reversedCall] = ['Agreed', 'Called', 'Untouched', 'RevAgreed', 'RevCalled'].map(idOf);
    const failing = failingTrustAppends(t);
    const waited = inConversation(dir, () => raised(dir, agreed, AGREES));
    failing.mock.restore();
    const call = record('call', { entry: called, kind: null, label: null, sort: 'one' }, from(dir));
    const kept = raised(dir, untouched, AGREES);
    const [first, second] = [reversal(dir, reversedAgreement, agreed), reversal(dir, reversedCall, called)];
    const written = [logText(), fs.readFileSync(waitingPath(), 'utf8')];

    assert.deepStrictEqual(standings(dir), [
      [call.id, 'call', second.id], [kept.id, 'agreement', null], [first.id, 'departure', null], [second.id, 'departure', null], [waited.id, 'agreement', first.id],
    ]);
    assert.deepStrictEqual(evidence(dir).departures, new Set([reversedAgreement, reversedCall]));
    assert.deepStrictEqual([logText(), fs.readFileSync(waitingPath(), 'utf8')], written);
  });
});

describe('the read (16.13.1, 16.13.3, 16.13.5)', () => {
  it('reads the log, the events a conversation keeps waiting after an append that failed, and an event kept ahead of an entry this state\'s ledger holds — never one kept ahead of an entry it lacks', (t) => {
    const dir = project('fumi');
    const root = statePath(dir);
    const [landed, waited, appended, never] = ['Landed', 'Waited', 'Appended', 'Never'].map(idOf);
    ledgerHolding(dir, landed, waited, appended);
    raised(dir, landed, DEPARTS);
    const failing = failingTrustAppends(t);
    inConversation(dir, () => raised(dir, waited, DEPARTS));
    failing.mock.restore();
    inConversation(dir, () => {
      for (const entry of [appended, never]) keepEvent(newEvent('raise', { ...DEPARTS, entry }, dir), root, entry);
    });

    assert.deepStrictEqual(evidence(dir).departures, new Set([landed, waited, appended]));
  });

  it('reads an event once by its id, however often it landed and wherever it still waits', () => {
    const dir = project('fumi');
    const once = raised(dir, idOf('Once'), DEPARTS);
    fs.appendFileSync(logPath(), lines(once));
    fs.mkdirSync(path.dirname(waitingPath()), { recursive: true });
    fs.writeFileSync(waitingPath(), lines(once));

    assert.deepStrictEqual(standings(dir), [[once.id, 'departure', null]]);
  });

  it('holds an event under another project\'s id, logged or waiting in a conversation, as none of this project\'s, though it names an entry this project\'s ledger holds: neither its answer, its reversal nor its verdict', (t) => {
    const dir = project('fumi');
    const elsewhere = project('aircon', { project_id: idOf('Aircon') });
    const [agreed, departed, reversed] = ['Agreed', 'Departed', 'Reversed'].map(idOf);
    ledgerHolding(dir, agreed, departed, reversed);
    const ours = raised(dir, agreed, AGREES);
    raised(elsewhere, departed, DEPARTS);
    reversal(elsewhere, reversed, agreed);
    record('verdict', { entry: departed, verdict: 'loss', point: 'queue' }, from(elsewhere));
    const failing = failingTrustAppends(t);
    inConversation(elsewhere, () => record('verdict', { entry: reversed, verdict: 'fix', point: 'queue' }, from(elsewhere)));
    failing.mock.restore();

    assert.deepStrictEqual([standings(dir), evidence(dir).departures, evidence(dir).judged], [[[ours.id, 'agreement', null]], new Set(), new Set()]);
    assert.deepStrictEqual([evidence(elsewhere).departures, evidence(elsewhere).judged], [new Set([departed, reversed]), new Set([departed, reversed])]);
  });
});

describe('the verdicts given (16.10.9, 16.10.6)', () => {
  it('judges the entries whose latest verdict is not a skip: a skip waits, a verdict after a skip stands', () => {
    const dir = project('fumi');
    const [skipped, judged, later] = ['Skipped', 'Judged', 'Later'].map(idOf);
    /** @param {string} entry @param {string} verdict @param {string} point */
    const give = (entry, verdict, point) => record('verdict', { entry, verdict, point }, from(dir));
    give(skipped, 'skip', 'decided');
    give(judged, 'loss', 'finish');
    give(later, 'skip', 'decided');
    give(later, 'fix', 'queue');

    assert.deepStrictEqual(evidence(dir).judged, new Set([judged, later]));
  });

  it('takes an entry\'s latest verdict by when it was given, the log\'s order breaking a tie: a skip given after a fix stands, and a skip that waited, landing after a later fix, does not', () => {
    const dir = project('fumi');
    const [overruled, kept, tied] = ['Overruled', 'Kept', 'Tied'].map(idOf);
    /** @param {string} entry @param {string} verdict @param {string} second */
    const given = (entry, verdict, second) => trustEvent('verdict', { id: newId(), at: `2026-10-28T10:00:0${second}Z`, project: PROJECT_ID, project_name: 'fumi', model: null, session: null }, { entry, verdict, point: 'queue' });
    fs.mkdirSync(path.dirname(logPath()), { recursive: true });
    fs.writeFileSync(logPath(), lines(
      given(overruled, 'fix', '0'), given(overruled, 'skip', '1'),
      given(kept, 'fix', '5'), given(kept, 'skip', '2'),
      given(tied, 'skip', '3'), given(tied, 'fix', '3'),
    ));

    assert.deepStrictEqual(evidence(dir).judged, new Set([kept, tied]));
  });

  it('breaks a tie between the log and what a conversation keeps waiting by the order read, the waiting read after: a skip waiting after a logged loss leaves the departure waiting, a fix waiting after a logged skip judges it', () => {
    const dir = project('fumi');
    const [skipWaits, fixWaits] = ['SkipWaits', 'FixWaits'].map(idOf);
    /** @param {string} entry @param {string} verdict */
    const given = (entry, verdict) => trustEvent('verdict', { id: newId(), at: '2026-10-28T10:00:03Z', project: PROJECT_ID, project_name: 'fumi', model: null, session: null }, { entry, verdict, point: 'queue' });
    fs.mkdirSync(path.dirname(waitingPath()), { recursive: true });
    fs.writeFileSync(logPath(), lines(given(skipWaits, 'loss'), given(fixWaits, 'skip')));
    fs.writeFileSync(waitingPath(), lines(given(skipWaits, 'skip'), given(fixWaits, 'fix')));

    assert.deepStrictEqual(evidence(dir).judged, new Set([fixWaits]));
  });

  it('holds each entry\'s verdicts in the order given, each with its point, a correction of one among them at its own time and at no point (16.15.4): a skip corrected judges the departure, a loss corrected to a fix later stands as the fix', () => {
    const dir = project('fumi');
    const [skipped, lost] = ['Skipped', 'Lost'].map(idOf);
    /** @param {string} type @param {string} entry @param {string} verdict @param {string} second */
    const given = (type, entry, verdict, second) => trustEvent(type, { id: newId(), at: `2026-10-28T10:00:0${second}Z`, project: PROJECT_ID, project_name: 'fumi', model: null, session: null },
      type === 'verdict' ? { entry, verdict, point: 'queue' } : { entry, kind: null, verdict });
    fs.mkdirSync(path.dirname(logPath()), { recursive: true });
    fs.writeFileSync(logPath(), lines(given('correction', lost, 'fix', '4'), given('verdict', skipped, 'skip', '1'), given('verdict', lost, 'loss', '2'), given('correction', skipped, 'nothing', '3')));

    const read = evidence(dir);
    assert.deepStrictEqual([read.verdicts, read.judged], [
      new Map([[skipped, [{ at: Date.parse('2026-10-28T10:00:01Z'), verdict: 'skip', point: 'queue' }, { at: Date.parse('2026-10-28T10:00:03Z'), verdict: 'nothing', point: null }]],
        [lost, [{ at: Date.parse('2026-10-28T10:00:02Z'), verdict: 'loss', point: 'queue' }, { at: Date.parse('2026-10-28T10:00:04Z'), verdict: 'fix', point: null }]]]),
      new Set([skipped, lost]),
    ]);
  });

  it('never takes a correction of a kind for a verdict: a departure waiting stays unasked, and one judged a fix later keeps that verdict alone', () => {
    const dir = project('fumi');
    const [waiting, fixed] = ['Waiting', 'Fixed'].map(idOf);
    raised(dir, waiting, DEPARTS);
    raised(dir, fixed, DEPARTS);
    record('verdict', { entry: fixed, verdict: 'fix', point: 'queue' }, from(dir));
    for (const entry of [waiting, fixed]) record('correction', { entry, kind: 'look', verdict: null }, from(dir));

    const read = evidence(dir);
    assert.deepStrictEqual([[...read.verdicts.keys()], read.verdicts.get(fixed)?.map(({ verdict }) => verdict), read.judged, [...read.asked.keys()]], [[fixed], ['fix'], new Set([fixed]), [fixed]]);
  });
});

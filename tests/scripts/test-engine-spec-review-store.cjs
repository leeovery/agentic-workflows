'use strict';

// ---------------------------------------------------------------------------
// A pass of the spec's review in the unit's agent store (leeway-engine/
// scripts/domain/agent-state.cjs, its `spec-review` rows; domain/
// spec-passes.cjs, what they hold the review on): a pass's report is taken in
// only as it reads (spec-report.cjs), once, the findings it read kept on its
// row and every later read taking them, never the report again — so a
// report deleted, rewritten to no longer read, or rewritten with fewer
// findings after it was taken in changes nothing. One that does not read is
// refused where it would be taken in — at the scan, or at an incorporation
// of its pass in flight — never reported, and each pass's brief carries the
// refusal until a pass's report is taken in. A pass is read before any of
// its findings is declined: never incorporated between its report and its
// acknowledgement, which names exactly the findings its report was taken in
// with; each `gap` or `fact` finding then waits to be surfaced until raised
// or declined — a gap raised as the replacement of a decision surfaced
// alone, with the decision, a replacement's reason and the ledger's mark,
// which the writer is held on (test-engine-spec-review-settled.cjs). A pass
// closes by the prose's one sequence, its incorporation last whatever closed
// it first, its rewrite findings the writer's and never waiting on the
// person. A pass in flight
// holds the review — running, waited for, the way on naming its way out
// where its agent returned without its report; lost with the process that
// dispatched it, abandoned; its report on disk, taken in by a scan — and a
// pass abandoned in flight is ignored whole, whenever it reports. A pass
// running on the spec as it stands is named at the entry, and another
// pass's brief is refused while it runs. A reviewer's brief refused closes
// its dispatch where it is bound to no land, so no reader of the store
// lists it in flight.
//
// Layer: verb. World: spec-review-world.cjs's.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, output } = require('./engine-harness.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const {
  UNIT, SESSION, MADE, AT_SPEC, FOUND, LANED, OWNER, made, useSpecReviewWorld, specReviewHelpers, section, unchangedSince,
} = require('./spec-review-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { reportedPasses, runningAgents, agentsLeft } = require(path.join(SCRIPTS, 'domain/agent-state.cjs'));

const dir = useSpecReviewWorld();
const { write } = ledgerHelpers(dir);
const {
  spec, writeSpec, land, issued, refusedUnissued, dispatchReview, reportIn, scan, acked, cleanPass, reviewSettled, unread, storeRefusal, nothingToRead,
} = specReviewHelpers(dir);

/** What the way on names of a pass's two findings, LANED's, waiting to be surfaced. @param {{id: string}} pass */
const laned = ({ id }) => `the gap F1 of ${id} raised, the fact F2 of ${id} replaced`;

/** What the way on names of a pass whose agent runs, its way out among it. @param {{id: string}} pass */
const stillRunning = ({ id }) => `${id} is still running, and the review waits for its report — if its agent has returned without writing its report, agent incorporate abandons it, and another pass is dispatched`;

describe('a pass of the spec\'s review in the store (11.7.1, 11.7.2, 11.7.6)', () => {
  it('a pass is read before any finding is declined — its incorporation refused once its report is in, scanned or not, until it is acknowledged, with exactly its report\'s findings, --clean refused while it holds any; the way on naming the acknowledgement first', () => {
    writeSpec(spec());
    land();
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    reportIn(pass, LANED);
    const unscanned = storeRefusal('incorporate', pass.id);
    scan();
    const refusals = [storeRefusal('incorporate', pass.id), storeRefusal('ack', pass.id, '--clean'), storeRefusal('ack', pass.id, '--findings', 'F1')];
    const waiting = [reviewSettled(), nothingToRead()];
    ok(dir(), ['agent', 'ack', UNIT, 'specification', UNIT, pass.id, '--findings', 'F2,F1']);
    const unacknowledged = `Agent "${pass.id}" is a spec review whose report is in, not yet acknowledged — agent ack records its findings first (agent scan takes the report in)`;
    const exactly = `Agent "${pass.id}" is a spec review whose report holds F1, F2 — it is acknowledged with exactly its report's findings`;

    assert.deepStrictEqual([unscanned, ...refusals], [unacknowledged, unacknowledged, exactly, exactly]);
    assert.deepStrictEqual(waiting, ['open', unchangedSince(pass, `the review's findings wait to be surfaced: ${pass.id} acknowledged, then ${laned(pass)}`)]);
    assert.strictEqual(nothingToRead(), unchangedSince(pass, `the review's findings wait to be surfaced: ${laned(pass)}`));
  });

  it('a pass closes by the prose\'s one sequence — its ack, each raised finding surfaced, then its incorporation — whatever it held: a clean pass closed at its ack and a gap pass at its last surfacing, each incorporation answering the row as that close left it; a rewrite pass closed by its incorporation, its rewrite handed to the writer and never among the findings left to surface', () => {
    const passOn = (/** @type {string} */ instant, /** @type {string} */ report) => {
      writeSpec(spec({ instant }));
      land();
      const pass = dispatchReview();
      issued(['spec-reviewer', UNIT, '--agent', pass.id]);
      reportIn(pass, report);
      scan();
      return pass.id;
    };
    const agent = (/** @type {string[]} */ args) => {
      const { status, remaining, for_writer: writer } = ok(dir(), ['agent', ...args]);
      return { status, remaining, writer };
    };
    /** The prose's sequence over a pass: every answer, in order. @param {string} pass @param {string[]} findings @param {string[]} raised */
    const closed = (pass, findings, raised) => [
      agent(['ack', UNIT, 'specification', UNIT, pass, ...(findings.length === 0 ? ['--clean'] : ['--findings', findings.join(',')])]),
      ...raised.map((finding) => agent(['surface', UNIT, 'specification', UNIT, pass, finding])),
      agent(['incorporate', UNIT, 'specification', UNIT, pass]),
    ];
    const clean = closed(passOn('2.1.2 Refunds are instant.', '# Spec Review\n\n## Findings\n\nNone identified.'), [], []);
    const gap = closed(passOn('2.1.2 Refunds are instant, always.', '# Spec Review\n\n## Findings\n\n### F1: is a refund split?\n\n**Lane:** gap\n\nNo entry decides it.'), ['F1'], ['F1']);
    const rewrite = closed(passOn('2.1.2 Refunds are instant, and whole.', FOUND), ['F1'], []);

    const done = { status: 'incorporated', remaining: [], writer: undefined };
    assert.deepStrictEqual(clean, [done, done]);
    assert.deepStrictEqual(gap, [{ status: 'acknowledged', remaining: ['F1'], writer: undefined }, done, done]);
    assert.deepStrictEqual(rewrite, [{ status: 'acknowledged', remaining: [], writer: ['F1'] }, { status: 'incorporated', remaining: [], writer: ['F1'] }]);
  });

  it('a pass is read once, as its report is taken in: a report deleted, rewritten to no longer read, or rewritten with fewer findings since changes nothing — each still reported with the findings it was taken in with, acknowledged with exactly those, and each waiting to be surfaced', () => {
    writeSpec(spec());
    land();
    const passes = [dispatchReview(), dispatchReview(), dispatchReview()];
    for (const pass of passes) {
      issued(['spec-reviewer', UNIT, '--agent', pass.id]);
      reportIn(pass, LANED);
    }
    scan();
    const [deleted, unreadable, fewer] = passes;
    fs.rmSync(deleted.file);
    reportIn(unreadable, '# Spec Review\n\nRewritten.');
    reportIn(fewer, LANED.slice(0, LANED.indexOf('\n\n### F2')));
    const read = reportedPasses(dir(), UNIT).map(({ id, findings }) => ({ id, findings }));
    const short = storeRefusal('ack', fewer.id, '--findings', 'F1');
    for (const { id } of passes) ok(dir(), ['agent', 'ack', UNIT, 'specification', UNIT, id, '--findings', 'F1,F2']);

    assert.deepStrictEqual(read, passes.map(({ id }) => ({ id, findings: [{ id: 'F1', lane: 'gap' }, { id: 'F2', lane: 'fact' }] })));
    assert.strictEqual(short, `Agent "${fewer.id}" is a spec review whose report holds F1, F2 — it is acknowledged with exactly its report's findings`);
    assert.deepStrictEqual([reviewSettled(), nothingToRead()], ['open', unchangedSince(fewer, `the review's findings wait to be surfaced: ${passes.map(laned).join(', ')}`)]);
  });

  it('a pass abandoned in flight is ignored whole when its report lands after — never taken in, never the pass that reviewed the spec, its findings neither waiting nor carried', () => {
    writeSpec(spec());
    land();
    cleanPass();
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();
    const late = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', late.id]);
    unread(late);
    reportIn(late, `${LANED}\n\n### F3: refunds are not instant\n\n**Lane:** rewrite\n\n2.1.2 cites nothing.`);
    const scanned = scan();
    const ignored = [reviewSettled(), section(issued(['spec-writer', UNIT]).brief, 'The review\'s findings')];
    land();
    cleanPass();

    assert.deepStrictEqual([scanned.pending, scanned.refused], [[], undefined]);
    assert.deepStrictEqual(ignored, ['open', 'None recorded.']);
    assert.strictEqual(reviewSettled(), 'done');
  });

  it('a report that does not read is refused where it would be taken in — at the scan, and at its pass\'s incorporation in flight — with what does not read and the way on, never reported, and each pass\'s brief carries the refusals until a pass\'s report is taken in', () => {
    writeSpec(spec());
    land();
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    reportIn(pass, LANED.replace('**Lane:** gap', '**Lane:** `gap`'));
    const { refused } = scan();
    const states = [reviewSettled(), reportedPasses(dir(), UNIT)];
    const closed = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', closed.id]);
    reportIn(closed, LANED.replace('The bench gives 450 ms.', '```sh\n# count the tables'));
    const { refusal } = ok(dir(), ['agent', 'incorporate', UNIT, 'specification', UNIT, closed.id]);
    const next = dispatchReview();
    const carried = section(issued(['spec-reviewer', UNIT, '--agent', next.id]).brief, 'Reports refused');
    reportIn(next);
    scan();
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();
    const after = section(issued(['spec-reviewer', UNIT, '--agent', dispatchReview().id]).brief, 'Reports refused');
    const faults = ['line 5: F1\'s next line is its lane, `**Lane:** rewrite`, `gap` or `fact`, the bare word', 'line 15 opens a fenced block that is never closed'];
    const way = (/** @type {string} */ id, /** @type {string} */ fault) => `${id}'s report does not read as a spec review: ${fault} — it is set aside unread; dispatch another pass, and its brief carries this refusal`;

    assert.deepStrictEqual([refused, refusal], [[{ id: pass.id, refusal: way(pass.id, faults[0]) }], way(closed.id, faults[1])]);
    assert.deepStrictEqual(states, ['open', []]);
    assert.deepStrictEqual([carried, after], [`- ${pass.id}: ${faults[0]}\n- ${closed.id}: ${faults[1]}`, 'None recorded.']);
  });

  it('a gap or a fact finding waits to be surfaced, never for the writer, its brief and the land after it leaving it, until the store raises it or the pass\'s incorporation declines it', () => {
    writeSpec(spec());
    land();
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    reportIn(pass, LANED);
    acked(pass, ['F1', 'F2']);
    const brief = section(issued(['spec-writer', UNIT]).brief, 'The review\'s findings');
    land();
    const surfacing = [reviewSettled(), nothingToRead()];
    ok(dir(), ['agent', 'surface', UNIT, 'specification', UNIT, pass.id, 'F1']);
    const raised = [reviewSettled(), nothingToRead()];
    unread(pass);

    assert.strictEqual(brief, 'None recorded.');
    assert.deepStrictEqual(surfacing, ['open', unchangedSince(pass, `the review's findings wait to be surfaced: the gap F1 of ${pass.id} raised, the fact F2 of ${pass.id} replaced`)]);
    assert.deepStrictEqual(raised, ['open', unchangedSince(pass, `the review's findings wait to be surfaced: the fact F2 of ${pass.id} replaced`)]);
    assert.strictEqual(reviewSettled(), 'done');
  });

  it('a gap raised as the replacement of a decision is surfaced with it, one finding at a time, its reason one a replacement gives and the decision one the ledger holds — kept on the pass with the ledger\'s mark', () => {
    writeSpec(spec());
    land();
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    reportIn(pass, LANED);
    acked(pass, ['F1', 'F2']);
    const replacing = ['--replaces', made.where, '--reason', 'changed-mind'];

    assert.deepStrictEqual([
      storeRefusal('surface', pass.id, 'F1,F2', ...replacing),
      storeRefusal('surface', pass.id, 'F1', '--replaces', made.where, '--reason', 'second-thoughts'),
      storeRefusal('surface', pass.id, 'F1', '--replaces', 'zzzzzzzz', '--reason', 'changed-mind'),
    ], [
      '--replaces surfaces one finding, raised as the replacement of that decision',
      'Invalid reason: "second-thoughts" — a replacement\'s reason is one of new-fact, other-topic, changed-mind, was-wrong',
      'no ledger entry\'s id begins "zzzzzzzz"',
    ]);
    assert.match(storeRefusal('surface', pass.id, 'F1', '--replaces', made.where), /^Usage: engine agent surface /);
    ok(dir(), ['agent', 'surface', UNIT, 'specification', UNIT, pass.id, 'F1', ...replacing]);
    const [{ raised }] = reportedPasses(dir(), UNIT);
    assert.deepStrictEqual(raised.map(({ finding, replaces, reason }) => [finding, replaces.startsWith(made.where), reason]), [['F1', true, 'changed-mind']]);
    assert.match(String(raised[0].mark), /^[0-9A-Za-z]+$/);
  });

  it('a pass in flight holds the review though a later pass reviewed the spec as it stands and reported clean — one running, waited for; one lost with the process that dispatched it, abandoned; one whose report is on disk, taken in by a scan — and a dispatch whose brief was refused holds nothing', () => {
    writeSpec(spec());
    land();
    const lost = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', lost.id]);
    const running = dispatchReview(OWNER.running);
    issued(['spec-reviewer', UNIT, '--agent', running.id]);
    write('find', AT_SPEC, [], { ...MADE, text: 'A refund posts within a day.', how: 'read in the code', known: 'read' });
    issued(['spec-writer', UNIT]);
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();
    const later = cleanPass();
    const flying = [reviewSettled(), nothingToRead()];
    unread(lost);
    const runs = [reviewSettled(), nothingToRead()];
    reportIn(running);
    const landed = [reviewSettled(), nothingToRead()];
    acked(running);

    assert.deepStrictEqual(flying, ['open', unchangedSince(later, `${lost.id} was lost with the process that dispatched it, and agent incorporate abandons it; ${stillRunning(running)}`)]);
    assert.deepStrictEqual(runs, ['open', unchangedSince(later, stillRunning(running))]);
    assert.deepStrictEqual(landed, ['open', unchangedSince(later, `${running.id}'s report is in, and agent scan takes it in`)]);
    assert.strictEqual(reviewSettled(), 'done');
  });

  it('a pass whose agent returned without writing its report reads as running while the process that dispatched it lives, and the refusal of another pass\'s brief names the way out — agent incorporate abandons it; followed, another pass goes and the review settles', () => {
    writeSpec(spec());
    land();
    const returned = dispatchReview(OWNER.running);
    issued(['spec-reviewer', UNIT, '--agent', returned.id]);
    const held = [reviewSettled(), refusedUnissued(['spec-reviewer', UNIT, '--agent', dispatchReview().id])];
    unread(returned);
    cleanPass();

    assert.deepStrictEqual(held, ['open', `brief: ${UNIT}'s spec as it stands is under review already — ${stillRunning(returned)}`]);
    assert.strictEqual(reviewSettled(), 'done');
  });

  it('a reviewer\'s brief refused closes its dispatch where it is bound to no land, so no reader of the store lists it in flight — its owner running or lost; one bound to a land, its brief again refused on another, stays in flight', () => {
    writeSpec(spec());
    land();
    cleanPass();
    const running = dispatchReview(OWNER.running);
    refusedUnissued(['spec-reviewer', UNIT, '--agent', running.id]);
    const lost = dispatchReview();
    refusedUnissued(['spec-reviewer', UNIT, '--agent', lost.id]);
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();
    const bound = dispatchReview(OWNER.running);
    issued(['spec-reviewer', UNIT, '--agent', bound.id]);
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, and whole.' }));
    land();
    const elsewhere = refusedUnissued(['spec-reviewer', UNIT, '--agent', bound.id]);

    assert.match(elsewhere, /was briefed on another landing of the spec/);
    assert.deepStrictEqual(
      [scan().in_flight.map((/** @type {{id: string}} */ { id }) => id), runningAgents(dir(), UNIT, 'specification', UNIT), agentsLeft(dir(), UNIT, 'specification', UNIT)],
      [[bound.id], [{ id: bound.id, kind: 'spec-review' }], { landed: [], lost: [] }],
    );
  });

  it('a resume with a pass running on the spec as it stands: the entry names it, and a second pass\'s brief is refused naming it — accepted once its report is on disk; a pass lost with the process that dispatched it holds nothing', () => {
    writeSpec(spec());
    land();
    const lost = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', lost.id]);
    const first = dispatchReview(OWNER.running);
    issued(['spec-reviewer', UNIT, '--agent', first.id]);
    const entered = output(dir(), ['enter', 'specification', UNIT, '--take'], { env: SESSION }).split('\n');
    const held = refusedUnissued(['spec-reviewer', UNIT, '--agent', dispatchReview().id]);
    reportIn(first);
    const after = issued(['spec-reviewer', UNIT, '--agent', dispatchReview().id]).res.role;

    assert.deepStrictEqual([entered.includes(`running: ${first.id}`), entered.includes(`running: ${lost.id}`), entered.includes(`lost: ${lost.id}`)], [true, false, true]);
    assert.strictEqual(held, `brief: ${UNIT}'s spec as it stands is under review already — ${stillRunning(first)}`);
    assert.strictEqual(after, 'spec-reviewer');
  });
});

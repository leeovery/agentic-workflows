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
// or declined. A pass in flight holds the review — running, waited for, the
// way on naming its way out where its agent returned without its report;
// lost with the process that dispatched it, abandoned; its report on disk,
// taken in by a scan — and a pass abandoned in flight is ignored whole,
// whenever it reports. A reviewer's brief refused closes its dispatch where
// it is bound to no land, so no reader of the store lists it in flight.
//
// Layer: verb. World: spec-review-world.cjs's.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok } = require('./engine-harness.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const {
  UNIT, MADE, AT_SPEC, LANED, OWNER, useSpecReviewWorld, specReviewHelpers, section, unchangedSince,
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

  it('a pass in flight holds the review though a later pass reviewed the spec as it stands and reported clean — one running, waited for; one lost with the process that dispatched it, abandoned; one whose report is on disk, taken in by a scan — and a dispatch whose brief was refused holds nothing', () => {
    writeSpec(spec());
    land();
    const running = dispatchReview(OWNER.running);
    issued(['spec-reviewer', UNIT, '--agent', running.id]);
    const lost = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', lost.id]);
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

    assert.deepStrictEqual(flying, ['open', unchangedSince(later, `${stillRunning(running)}; ${lost.id} was lost with the process that dispatched it, and agent incorporate abandons it`)]);
    assert.deepStrictEqual(runs, ['open', unchangedSince(later, stillRunning(running))]);
    assert.deepStrictEqual(landed, ['open', unchangedSince(later, `${running.id}'s report is in, and agent scan takes it in`)]);
    assert.strictEqual(reviewSettled(), 'done');
  });

  it('a pass whose agent returned without writing its report reads as running while the process that dispatched it lives, and the way on, the refusal of a pass with nothing to read among it, names the way out — agent incorporate abandons it; followed, the review settles', () => {
    writeSpec(spec());
    land();
    const returned = dispatchReview(OWNER.running);
    issued(['spec-reviewer', UNIT, '--agent', returned.id]);
    const later = cleanPass();
    const held = [reviewSettled(), nothingToRead()];
    unread(returned);

    assert.deepStrictEqual(held, ['open', unchangedSince(later, stillRunning(returned))]);
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
});

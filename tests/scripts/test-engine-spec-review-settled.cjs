'use strict';

// ---------------------------------------------------------------------------
// The spec's review settled (leeway-engine/scripts/domain/spec-passes.cjs;
// ready to build's `review-settled`, domain/checklist.cjs): the review
// settles (a) once the latest reported pass reviewed the spec as it stands —
// blank lines between sections, or a section moved, changing nothing (E4) —
// (c) with no gap waiting — a question asked at the spec still open, or a
// review's gap raised as the replacement of a decision still current and
// unkept, the writer held on it naming the raise that asks again from a new
// conversation — and (d) nothing waiting for the writer: the
// entries made at the spec and the `rewrite` findings since the last take a
// land committed, a brief again before a land carrying all of it; an entry
// at another unit's spec, on a topic or replaced since, or an asset linked
// at the spec, waits for no one. The reviewer's brief on a spec unchanged
// since a pass reported is refused, naming what waits. What a pass holds the
// review on in the store — in flight, or its findings to be surfaced — is
// test-engine-spec-review-store.cjs's.
//
// Layer: verb. World: spec-review-world.cjs's.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { ok, okSectionsAsync, statePath, writeState, layout } = require('./engine-harness.cjs');
const { ledgerHelpers, leaningCall } = require('./ledger-world.cjs');
const {
  UNIT, SPEC, SESSION, PERSON, MADE, AT_SPEC, FOUND, LANED, WRITER, made, useSpecReviewWorld, specReviewHelpers, section, spaced, unchangedSince,
} = require('./spec-review-world.cjs');

const dir = useSpecReviewWorld();
const { write } = ledgerHelpers(dir);
const {
  spec, writeSpec, land, issued, refusedUnissued, dispatchReview, reportIn, acked, cleanPass, reviewSettled, unread, nothingToRead,
} = specReviewHelpers(dir);

/** `text` with the section `first` opens moved after the one `second` opens, to the next heading at its level or above. @param {string} text @param {string} first @param {string} second @param {string} end */
function moved(text, first, second, end) {
  const [a, b, c] = [text.indexOf(first), text.indexOf(second), end === '' ? text.length : text.indexOf(end)];
  return `${text.slice(0, a)}${text.slice(b, c).trimEnd()}\n\n${text.slice(a, b).trimEnd()}\n\n${text.slice(c)}`.trimEnd();
}

describe('review-settled (6.4.7, 11.7.6, 11.S11, E3)', () => {
  it('(a): holds once the latest reported pass reviewed the spec as it stands — open before any pass, while the first runs, once a section changes, landed or not, and while the pass on it was abandoned unreported; blank lines, and areas and parts moved, change nothing, a pass refused as having nothing to read; an entry made at another unit\'s spec, though it stands on this one, leaves it so', () => {
    const states = [reviewSettled()];
    writeSpec(spec());
    land();
    const first = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', first.id]);
    states.push(reviewSettled());
    reportIn(first);
    acked(first);
    states.push(reviewSettled());
    writeSpec(spaced(moved(spec(), '## 1. Cards', '## 2. Refunds', '')));
    states.push(reviewSettled());
    writeSpec(moved(spec(), '### 1.1 The form', '### 1.2 The charge', '## 1-S.'));
    const reordered = land().changed;
    states.push(reviewSettled());
    const refused = nothingToRead();
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    states.push(reviewSettled());
    land();
    states.push(reviewSettled());
    const abandoned = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', abandoned.id]);
    unread(abandoned);
    states.push(reviewSettled());
    cleanPass();
    write('replace', 'billing.specification', ['--replaces', made.posted, '--reason', 'was-wrong'], { ...MADE, drops: ['a day'], text: 'A refund posts within two days.', how: 'read in the code', known: 'read' });
    states.push(reviewSettled());

    assert.deepStrictEqual([reordered, refused], [[], unchangedSince(first, 'its review has settled')]);
    assert.deepStrictEqual(states, ['open', 'open', 'done', 'done', 'done', 'open', 'open', 'open', 'done']);
  });

  it('(a): an edit of the title or the introduction sends the spec to another pass, which reviews it alone', () => {
    writeSpec(spec());
    land();
    const first = cleanPass();
    writeSpec(spec().replace('# Payments\n', '# Payments\n\nThe card payments of the shop.\n'));
    const edited = reviewSettled();
    land();
    const second = dispatchReview();
    const { brief } = issued(['spec-reviewer', UNIT, '--agent', second.id]);
    reportIn(second);
    acked(second);

    assert.strictEqual(section(brief, 'The sections to review', 'Lines that do not trace'), [
      `The spec: \`${statePath(dir(), SPEC)}\``,
      `The sections changed since ${first.id}, the last pass reported:`,
      '# Payments\n\nThe card payments of the shop.',
    ].join('\n\n'));
    assert.deepStrictEqual([edited, reviewSettled()], ['open', 'done']);
  });

  it('(c) and (d): a gap waiting holds it open though nothing waits for the writer, and its answer waits for the writer\'s brief and the land after it, a brief again before the land carrying it again; an entry made while the writer writes waits for its next brief, past the land and a clean pass', () => {
    const gap = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever split?' }).id;
    writeSpec(spec());
    land();
    const first = cleanPass();
    const waiting = [reviewSettled(), nothingToRead()];
    const answer = write('decide', AT_SPEC, ['--answers', gap], { ...PERSON, text: 'Never.', why: 'The bank matches one refund to one charge.' }).id;
    const answered = [reviewSettled(), nothingToRead()];
    const taken = section(issued(['spec-writer', UNIT]).brief, 'Written since your last brief');
    const pending = [reviewSettled(), section(issued(['spec-writer', UNIT]).brief, 'Written since your last brief')];
    land();
    const settled = reviewSettled();
    issued(['spec-writer', UNIT]);
    const asked = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever partial?' }).id;
    const own = write('decide', AT_SPEC, ['--answers', asked], { ...MADE, given: 'own', text: 'Never.', why: 'A refund returns the whole charge.' }).id;
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, and whole.' }));
    land();
    cleanPass();
    const writing = reviewSettled();
    const next = section(issued(['spec-writer', UNIT]).brief, 'Written since your last brief');
    land();

    assert.deepStrictEqual(waiting, ['open', unchangedSince(first, `the gap ${gap}, asked at the spec, waits on the person — engine raise ${UNIT}.specification --answers ${gap} puts it to them again, in this conversation or a new one; the writer's brief follows the answer`)]);
    assert.deepStrictEqual(answered, ['open', unchangedSince(first, `${WRITER}1 entry made at the spec`)]);
    assert.strictEqual(taken, `- ${answer} decision, the unit's own: Never.`);
    assert.deepStrictEqual([pending, settled], [['open', taken], 'done']);
    assert.deepStrictEqual([writing, next, reviewSettled()], ['open', [`- ${asked} question, the unit's own: Is a refund ever partial?`, `- ${own} decision, the unit's own: Never.`].join('\n'), 'done']);
  });

  describe('(c): a review\'s gap raised as the replacement of a decision, surfaced with it, holds the writer, naming the raise that asks again, until the person\'s call lands from a new conversation', () => {
    const resumed = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'spec-review-settled-resumed' });

    /** The gap raised as the replacement of `made.where` and surfaced with it: the writer's refusal. */
    function raisedReplacement() {
      writeSpec(spec());
      land();
      const pass = dispatchReview();
      issued(['spec-reviewer', UNIT, '--agent', pass.id]);
      reportIn(pass, LANED);
      acked(pass, ['F1', 'F2']);
      ok(dir(), ['agent', 'surface', UNIT, 'specification', UNIT, pass.id, 'F1', '--replaces', made.where, '--reason', 'changed-mind']);
      return refusedUnissued(['spec-writer', UNIT]);
    }

    /** The replacement raised again in a new conversation, the person picking `key`. @param {string} key */
    async function answeredAgain(key) {
      const { res } = await okSectionsAsync(dir(), ['raise', AT_SPEC, '--replaces', made.where, '--reason', 'changed-mind'], { env: resumed, stdin: JSON.stringify(leaningCall('To the bank account.', 'As a voucher.')) });
      ok(dir(), ['raise', 'answer', res.raise, '--pick', key], { env: resumed, stdin: JSON.stringify({ why: 'The person said why.' }) });
    }

    const held = () => `brief: ${UNIT}'s rewrite waits for the answer — the replacement of ${made.where}, raised at the spec, waits on the person — engine raise ${UNIT}.specification --replaces ${made.where} --reason changed-mind puts it to them again, in this conversation or a new one`;

    it('released by the replacement landed', async () => {
      const refused = raisedReplacement();
      await answeredAgain('1');

      assert.strictEqual(refused, held());
      assert.strictEqual(issued(['spec-writer', UNIT]).res.role, 'spec-writer');
    });

    it('released by the person keeping the decision', async () => {
      const refused = raisedReplacement();
      await answeredAgain('keep');

      assert.strictEqual(refused, held());
      assert.strictEqual(issued(['spec-writer', UNIT]).res.role, 'spec-writer');
    });
  });

  it('(d): only a current entry made at the spec waits — the writer shown what the way on counts, each with where it stands, never an entry replaced since or an asset linked', () => {
    writeSpec(spec());
    land();
    const first = cleanPass();
    const found = write('find', AT_SPEC, [], { ...MADE, text: 'A refund posts within a day.', how: 'read in the code', known: 'read' }).id;
    const later = write('replace', AT_SPEC, ['--replaces', found, '--reason', 'was-wrong'], { ...MADE, drops: ['a day'], text: 'A refund posts within two days.', how: 'read in the code', known: 'read' }).id;
    const tax = write('replace', AT_SPEC, ['--replaces', made.tax, '--reason', 'was-wrong'], { ...PERSON, drops: ['line'], text: 'Per invoice.', why: 'The invoice is taxed whole.' }).id;
    const waiting = nothingToRead();
    const drawn = section(issued(['spec-writer', UNIT]).brief, 'Written since your last brief');
    land();
    const taken = reviewSettled();
    writeState(dir(), layout.assets(UNIT, 'posting.md'), '# Posting\n');
    ok(dir(), ['asset', 'add', UNIT, layout.assets(UNIT, 'posting.md'), '--entry', later, '--status', 'canonical'], { env: SESSION });

    assert.strictEqual(waiting, unchangedSince(first, `${WRITER}2 entries made at the spec`));
    assert.strictEqual(drawn, [
      `- ${later} finding, the unit's own, replacing ${found}: A refund posts within two days.`,
      `- ${tax} decision, made here, standing on billing/invoices, replacing ${made.tax}: Per invoice.`,
    ].join('\n'));
    assert.deepStrictEqual([taken, reviewSettled()], ['done', 'done']);
  });

  it('(d): every reported pass with a rewrite finding the last committed take did not carry waits for the writer — one acknowledged and incorporated beside a later clean one; the writer\'s brief carries each verbatim with the lines that do not trace, a brief again before a land settling nothing and carrying it again, a writer landing the spec unchanged settling it and one changing a section sending it to another pass', () => {
    writeSpec(spec());
    land();
    const [found, clean] = [dispatchReview(), dispatchReview()];
    issued(['spec-reviewer', UNIT, '--agent', found.id]);
    issued(['spec-reviewer', UNIT, '--agent', clean.id]);
    reportIn(found, FOUND);
    acked(found, ['F1']);
    unread(found);
    reportIn(clean);
    acked(clean);
    const beside = [reviewSettled(), nothingToRead()];
    const { brief } = issued(['spec-writer', UNIT]);
    const unlanded = [reviewSettled(), section(issued(['spec-writer', UNIT]).brief, 'The review\'s findings')];
    land();
    const taken = reviewSettled();
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();

    assert.deepStrictEqual(beside, ['open', unchangedSince(clean, `${WRITER}the report of ${found.id}`)]);
    assert.deepStrictEqual([section(brief, 'The review\'s findings'), section(brief, 'Lines that do not trace')], [FOUND, '- 2.1.2: cites no entry']);
    assert.deepStrictEqual(unlanded, ['open', FOUND]);
    assert.deepStrictEqual([taken, reviewSettled()], ['done', 'open']);
  });

});

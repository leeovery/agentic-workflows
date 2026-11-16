'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a unit's cancel (18.3.9; leeway-engine/
// scripts/domain/landing.cjs, `cancelClose`, over drivers/landing/github/),
// past what every driver does (test-engine-landing-conformance-cancel.cjs):
// the pull requests it closes recorded on the unit by their numbers, by
// repository (`closed_by_cancel`), on one read of the pull requests; and a
// unit holding no branch of its own — one cancelled in its discussion —
// asking GitHub nothing. Git layer: the landing world on a fake GitHub
// (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { readManifest } = require('../../scripts/engine-harness.cjs');
const { createManifest } = require('../../scripts/discovery-test-utils.cjs');
const { UNIT, TASKS, openArgs, mergeBack, useLandingWorld } = require('../../scripts/landing-world.cjs');
const side = require('./landing.cjs');
const { calls, ok } = require('./world.cjs');

const { card, total } = TASKS;

const project = useLandingWorld('github-landing-cancel-', side.prepare);

/** The gh calls made since `before` of them, each by its first two words. @param {string} dir @param {number} before */
const madeSince = (dir, before) => calls(dir).slice(before).map((call) => call.split(' ').slice(0, 2).join(' '));

describe('GitHub\'s landing driver and a unit\'s cancel (18.3.9)', () => {
  it('the pull requests the cancel closes are recorded on the unit by their numbers, by repository, on one read of the pull requests', () => {
    const dir = project();
    ok(dir, openArgs(total));
    mergeBack(dir, card.branch, total.branch);
    ok(dir, openArgs(card));
    const before = calls(dir).length;

    ok(dir, ['workunit', 'cancel', UNIT]);

    const record = readManifest(dir, UNIT).closed_by_cancel;
    assert.deepStrictEqual([Object.keys(record), [...record['.']].sort(), madeSince(dir, before)], [['.'], ['1', '2'], ['pr list', 'pr close', 'pr close']]);
  });

  it('a unit holding no branch of its own, as one cancelled in its discussion, asks GitHub nothing and closes nothing', () => {
    const dir = project();
    createManifest(dir, 'other', {});
    const before = calls(dir).length;

    const cancelled = ok(dir, ['workunit', 'cancel', 'other']);

    assert.deepStrictEqual([cancelled.pull_requests_closed, madeSince(dir, before), readManifest(dir, 'other').closed_by_cancel], [false, [], undefined]);
  });
});

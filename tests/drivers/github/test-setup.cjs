'use strict';

// ---------------------------------------------------------------------------
// What setup sets on GitHub through GitHub's landing driver
// (leeway-engine/scripts/domain/github-setup.cjs), each offer answered by
// its own verb, alike in shape and refusals: the GitHub rule on the state
// branch (`github-rule`, 4.4.6, 4.S10, 4.S30) and the squash default the
// landing needs (`github-squash`, 7.2.18). Each is offered until answered,
// and set on a yes alone, through gh — signed in first, then GitHub's API —
// recorded, `set`, `declined` or `failed` with why, and never offered
// again; a setting gh could not make is said, with where to make it by hand,
// and setup carries on. The rule's answer is recorded once. The squash
// default is offered only where the project lands through GitHub, read
// first and left as it is where it is set, and a yes to it is taken again
// once answered; across nested repositories, it is
// test-landing-nested.cjs's. That boot makes the offers, and offers nothing
// beyond GitHub, is test-engine-boot-state-github.cjs's. Git layer:
// the landing world on a fake GitHub (world.cjs), built once and copied for
// each test, every gh call made under the stand-in gh.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const harness = require('../../scripts/engine-harness.cjs');
const { useLandingWorld, setLandingDriver } = require('../../scripts/landing-world.cjs');
const { githubRuleOffered, githubSquashOffered } = require('../../../skills/leeway-engine/scripts/domain/github-setup.cjs');
const { GITHUB_SQUASH } = require('./gh-stub.cjs');
const { githubWorld, github, calls, ok, refused } = require('./world.cjs');

const { git, layout } = harness;
const project = useLandingWorld('github-setup-', (dir) => {
  setLandingDriver(dir, 'github');
  githubWorld(dir);
});

/** The project manifest as the state branch holds it. @param {string} dir */
const committedManifest = (dir) => JSON.parse(git(dir, ['show', `leeway-state:${layout.projectManifest}`]));

const AUTH = 'auth status --hostname github.com';
const SET_SQUASH = 'api --method PATCH repos/acme/portal -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY';

/**
 * Each offer: its verb and field; whether it is offered; the API calls that
 * set it, and what GitHub holds of it before and once set; the commit's
 * subject on a yes; the warning where it is not set; and the answer refused
 * once one is recorded, and why.
 */
const OFFERS = [
  {
    verb: 'github-rule', field: 'github_rule', offered: githubRuleOffered,
    calls: ['api --method POST repos/acme/portal/rulesets --input -'],
    held: (/** @type {string} */ dir) => github(dir).rulesets,
    before: [],
    set: [{
      name: 'leeway-state', target: 'branch', enforcement: 'active',
      conditions: { ref_name: { include: ['refs/heads/leeway-state'], exclude: [] } },
      rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }],
    }],
    subject: 'chore: the GitHub rule on leeway-state set',
    unset: (/** @type {string} */ why) => `the rule against deleting or force-pushing leeway-state was not set on acme/portal: ${why} — set it by hand under the repository's Settings → Rules`,
    answered: { refused: 'yes', why: 'an answer is recorded once' },
  },
  {
    verb: 'github-squash', field: 'github_squash', offered: githubSquashOffered,
    calls: ['api repos/acme/portal', SET_SQUASH],
    held: (/** @type {string} */ dir) => github(dir).squash,
    before: GITHUB_SQUASH,
    set: { squash_merge_commit_title: 'PR_TITLE', squash_merge_commit_message: 'PR_BODY' },
    subject: 'chore: the GitHub squash default set',
    unset: (/** @type {string} */ why) => `the squash default was not set on acme/portal: ${why} — set it by hand in the repository's Settings, under Pull Requests, as the default commit message "Pull request title and description"`,
    answered: { refused: 'no', why: 'only a yes is taken again, setting it wherever it is not' },
  },
];

for (const offer of OFFERS) {
  describe(`${offer.verb}: setup's offer, answered`, () => {
    it('offered, and set by a yes alone, through gh signed in, recorded so it is never offered again', () => {
      const dir = project();
      assert.deepStrictEqual([offer.offered(dir), offer.held(dir)], [true, offer.before]);

      const out = ok(dir, [offer.verb, 'yes']);

      assert.deepStrictEqual(calls(dir), [AUTH, ...offer.calls]);
      assert.deepStrictEqual(offer.held(dir), offer.set);
      assert.deepStrictEqual([out[offer.field], out.reason, out.warnings], ['set', undefined, undefined]);
      assert.strictEqual(out.committed, git(dir, ['rev-parse', '--short', 'leeway-state']).trim());
      assert.strictEqual(git(dir, ['log', '-1', '--format=%s', 'leeway-state']).trim(), offer.subject);
      assert.deepStrictEqual(committedManifest(dir)[offer.field], { status: 'set' });
      assert.strictEqual(offer.offered(dir), false);
    });

    it('a no sets nothing, is recorded, and is never offered again', () => {
      const dir = project();

      assert.deepStrictEqual([ok(dir, [offer.verb, 'no'])[offer.field], calls(dir), offer.held(dir)], ['declined', [], offer.before]);
      assert.deepStrictEqual(committedManifest(dir)[offer.field], { status: 'declined' });
      assert.strictEqual(offer.offered(dir), false);
    });

    for (const [why, fault, reason] of [
      ['gh is missing', null, 'gh is not installed'],
      ['gh is not signed in', 'signed-out', 'gh is not signed in to github.com'],
      ['GitHub refuses it', 'refused@api', 'gh refused it: HTTP 403: Resource not accessible by integration'],
    ]) {
      it(`a yes where ${why} says so and carries on, recorded as failed with why, never offered again`, () => {
        const dir = project();
        const bin = fs.mkdtempSync(path.join(dir, '..', 'bin-'));
        fs.symlinkSync(execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim(), path.join(bin, 'git'));
        try {
          const out = ok(dir, [offer.verb, 'yes'], fault === null ? { PATH: bin } : { GH_STUB_FAULT: fault });

          assert.deepStrictEqual([out[offer.field], out.reason, out.warnings], ['failed', reason, [offer.unset(reason)]]);
          assert.deepStrictEqual(offer.held(dir), offer.before);
          assert.deepStrictEqual(committedManifest(dir)[offer.field], { status: 'failed', reason });
          assert.strictEqual(offer.offered(dir), false);
        } finally {
          fs.rmSync(bin, { recursive: true, force: true });
        }
      });
    }

    it(`an answer is yes or no, and once one is recorded, ${offer.answered.why}`, () => {
      const dir = project();
      ok(dir, [offer.verb, 'no']);

      assert.strictEqual(refused(dir, [offer.verb, offer.answered.refused]), `${offer.verb}: the offer is answered — "declined" is recorded, and ${offer.answered.why}`);
      assert.strictEqual(refused(project(), [offer.verb, 'maybe']), `${offer.verb}: the answer is yes or no — got "maybe"`);
      assert.deepStrictEqual(calls(dir), []);
    });
  });
}

describe('github-squash: a yes taken again', () => {
  it('sets it after a no, and once set, reads it and leaves it as it is, recorded set', () => {
    const dir = project();
    ok(dir, ['github-squash', 'no']);

    assert.strictEqual(ok(dir, ['github-squash', 'yes']).github_squash, 'set');
    const out = ok(dir, ['github-squash', 'yes']);

    assert.deepStrictEqual(calls(dir), [AUTH, 'api repos/acme/portal', SET_SQUASH, AUTH, 'api repos/acme/portal']);
    assert.deepStrictEqual([out.github_squash, out.committed, github(dir).squash], ['set', null, OFFERS[1].set]);
    assert.deepStrictEqual(committedManifest(dir).github_squash, { status: 'set' });
  });
});

describe('github-squash: only where the project lands through GitHub', () => {
  it('a project on GitHub that lands locally is offered the rule and not the squash default, and a yes to that is refused, nothing set', () => {
    const dir = project();
    setLandingDriver(dir, 'local');

    assert.deepStrictEqual([githubRuleOffered(dir), githubSquashOffered(dir)], [true, false]);
    assert.strictEqual(refused(dir, ['github-squash', 'yes']), 'github-squash: the project does not land through GitHub — there is no repository to set the squash default on');
    assert.deepStrictEqual([calls(dir), github(dir).squash], [[], GITHUB_SQUASH]);
  });
});

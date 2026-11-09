'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's review, asked for at its close (19.5.7, 19.5.13, 19.5.14):
// `engine review ask <qf>` (leeway-engine/scripts/domain/review-verbs.cjs),
// the close's `r/review` row — the request recorded and committed, the
// review phase's skill invoked in place its `next`, asked again `already` —
// refused for a unit that is no quick-fix and while the close does not
// stand; `engine enter review <qf>` (domain/review-entry.cjs), refused
// until it is asked for, then one area, the change, its record and its
// change-set from the base (domain/review-phase.cjs, domain/review-change.cjs),
// drawn on the board as any unit's review (domain/projections/board-review.cjs);
// and the area pair's and the test surface's briefs held against the
// quick-fix's record and its fixes' acceptance in their own words, never a
// spec (domain/brief-records.cjs, domain/fix-acceptance.cjs, 19.5.24). Its
// rounds and its close: test-engine-quick-fix-review-rounds.cjs.
//
// Layer: git. World: quick-fix-review-world.cjs, the close reached, built
// once and copied. Each test's conversation keeps its records in a config
// folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const {
  ok, holdLock, lockAttempts, git, statePath, layout, writeState, readManifest, cleanupFixture, head, lastMessage, FROZEN_AT,
} = require('./engine-harness.cjs');
const { UNIT, BRANCH, DESCRIPTION, createFix } = require('./quick-fix-world.cjs');
const { filledTemplate, scratchCalls, ENGINE_DRAWN } = require('./brief-build-world.cjs');
const { AREA, closeReached: world, quickFixReview } = require('./quick-fix-review-world.cjs');

let dir = ''; // the project
const { as, run, refused, entered, issued, closeMenu } = quickFixReview(() => dir);

afterEach(() => {
  cleanupFixture(dir);
});

describe('review ask <quick-fix>: a review asked for at its close (19.5.13)', () => {
  it('is the close\'s r/review row: the request recorded on the manifest and committed, the review phase\'s skill next, invoked in this conversation (24.1.3); asked again, already, writing nothing', () => {
    dir = world();
    closeMenu();
    const row = run(['gate', 'finish', '--pick', 'r']).next;
    const asked = run(['review', 'ask', UNIT]);
    const [state, message] = [head(dir), lastMessage(dir)];
    const again = run(['review', 'ask', UNIT]);
    const next = { kind: 'invoke', skill: 'leeway-review-process', args: ['quick-fix', UNIT] };

    assert.deepStrictEqual(row, { kind: 'engine', argv: ['review', 'ask', UNIT] });
    assert.deepStrictEqual(asked, { ok: true, unit: UNIT, review_asked: readManifest(dir, UNIT).fixes.review_asked, next, committed: asked.committed });
    assert.match(asked.review_asked, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.deepStrictEqual([message, again, head(dir)], [`review(${UNIT}): asked for at its close`, { ok: true, unit: UNIT, review_asked: asked.review_asked, already: true, next }, state]);
  });

  it('refuses a unit that is no quick-fix, and a quick-fix whose close does not stand, as its screen refuses it, writing nothing', () => {
    dir = world();
    createFix(dir, 3, 'Spell the docs --colour', as());

    assert.deepStrictEqual([refused(['review', 'ask', 'other']), refused(['review', 'ask', UNIT])], [
      'review ask: other is no quick-fix built as one — a review is asked for at a quick-fix\'s close; any other unit\'s review phase follows its build',
      `review ask: ${UNIT} closes once each of its fixes has ended — 1.3 is not started: each is done once it is committed, in ${UNIT}'s pull request and passed by its pair, or closed with its reason`,
    ]);
  });
});

describe('enter review <quick-fix>: one area, the change (19.5.14, F3)', () => {
  it('reads the quick-fix\'s record and its change-set from the base as its one area, with the test surface, its record in the spec\'s place', () => {
    dir = world();
    run(['review', 'ask', UNIT]);

    assert.deepStrictEqual(entered().slice(0, 7), [
      'round: round 1',
      `area: ${AREA} — the change: ${UNIT}'s record and its change-set from the base`,
      `reads: ${AREA}, the test surface (tests)`,
      'fix phase: phase 2, where round 1\'s fix tasks are written',
      'base: main — the branch the unit\'s work lands on, the --base of each reader\'s brief',
      `summary: ${statePath(dir, layout.unit(UNIT, 'summary.md'))}`,
      `record: \`node .claude/skills/leeway-engine/scripts/engine.cjs ledger record ${UNIT}\``,
    ]);
  });

  it('draws on the board as any unit\'s review: its one area and the tests held against its fixes\' acceptance, each check not proven at the change\'s tip worded as its fix words it, and so its page (20.10) — drawn while a peer holds the writer lock, never trying it', (t) => {
    dir = world();
    run(['review', 'ask', UNIT]);
    entered();
    writeState(dir, layout.unit(UNIT, 'build', 'runs', '1.S1', 'run-001.json'), JSON.stringify({
      verdict: 'pass', unfixed: false, at: FROZEN_AT, checkout: dir, commits: [{ repo: '.', commit: git(dir, ['rev-parse', BRANCH]).trim() }], task: null, evidence: [], recordings: [],
    }));
    const lock = holdLock(statePath(dir, layout.lock));
    const attempts = lockAttempts(t, lock, () => { throw new Error('the board waited on the writer lock'); });
    const { view } = run(['board', 'sess-1']);
    const page = run(['board', 'sess-1', '--page', 'check:1:2.S1', '--page-unit', UNIT]).view.text;
    const words = 'Given the help, when it is read, then it names --colour.';

    assert.deepStrictEqual({ kind: view.kind, areas: view.areas.map(({ area, title, state }) => ({ area, title, state })), notProven: view.not_proven, page, attempts }, {
      kind: 'review',
      areas: [{ area: '1', title: 'The change', state: 'waiting' }, { area: 'tests', title: 'Tests held against the fixes\' acceptance', state: 'waiting' }],
      notProven: [{ round: 1, scenario: '2.S1', standing: 'not proven', text: words }],
      page: words,
      attempts: [],
    });
  });
});

describe('the review\'s briefs for a quick-fix: its record and its fixes\' acceptance, never a spec (19.5.14, 19.5.24)', () => {
  const noSpec = `${UNIT} is a quick-fix, which has no spec: its fixes' acceptance, in their own words, stands for one.`;
  /** The linters, the project having no environment setup (22.5.10). */
  const NO_SETUP = 'None recorded: the project has no environment setup, so run the tests and linters you find in the repository, asking nothing.';
  const criteria = [
    '- 1.S1, of fix 1.1 Spell the flag --colour: Given the help, when it is read, then it names --colour.',
    '- 2.S1, of fix 1.2 Spell the help --colour: Given the help, when it is read, then it names --colour.',
  ].join('\n');
  /** The change's commits, as both briefs draw them: the quick-fix's branch from where it leaves main. */
  const commits = () => [
    '## In the project\'s repository',
    `### Not landed yet: \`${git(dir, ['merge-base', 'main', BRANCH]).trim().slice(0, 12)}..${BRANCH}\``,
    '```\n src/flag.js | 2 +-\n src/help.js | 1 +\n 2 files changed, 2 insertions(+), 1 deletion(-)\n```',
  ].join('\n\n');
  /** The scratch worktree's layout, at the quick-fix's branch. @param {string} name */
  const layoutOf = (name) => `- the project's repository: \`${BRANCH}\` — the change's tip there\n\n${scratchCalls(name, git(dir, ['rev-parse', BRANCH]).trim())}`;

  it('the area review\'s: what was asked, the record whole and the fixes\' acceptance; it meets no other area; the branch\'s change, and each fix\'s scenario\'s runs', () => {
    dir = world();
    run(['review', 'ask', UNIT]);
    const summary = fs.readFileSync(statePath(dir, layout.unit(UNIT, 'summary.md')), 'utf8').trimEnd();
    const { res, brief } = issued(['review-area', UNIT, '--area', '1', '--base', 'main', '--letter', 'a']);

    assert.strictEqual(fs.existsSync(statePath(dir, layout.unit(UNIT, 'spec.md'))), false);
    assert.strictEqual(brief, `Brief ${res.id} — the area review's, for ${UNIT}\n\n${filledTemplate('review-area', {
      engine: ENGINE_DRAWN,
      'area-sections': [noSpec, `The change asked for: ${DESCRIPTION}`, `Its record, \`${statePath(dir, layout.unit(UNIT, 'summary.md'))}\`:`, summary, 'Its fixes\' acceptance:', criteria].join('\n\n'),
      'area-meets': `The change is ${UNIT}'s one area: there is no other for it to meet.`,
      'unit-calls': 'None recorded.',
      'change-commits': commits(),
      'change-scratch-layout': layoutOf(`${UNIT}-area-1-a`),
      'area-runs': ['- 1.S1: not proven', '  Given the help, when it is read, then it names --colour.', '- 2.S1: not proven', '  Given the help, when it is read, then it names --colour.'].join('\n'),
      linters: NO_SETUP,
      'area-report-to': `\`${statePath(dir, layout.unit(UNIT, 'review', 'round-1', `${AREA}-a.md`))}\``,
      'area-authority': 'Every fix of the change has passed its own review. Hold the whole change against what was asked of it, as one piece. Its fixes\' acceptance, in their own words and read as one, and the product they describe, are your authority:',
    })}`);
  });

  it('the test surface\'s: the fixes\' acceptance in their own words in the spec\'s scenarios\' place, a fix closed holding nothing', () => {
    dir = world();
    createFix(dir, 3, 'Spell the docs --colour', as());
    run(['task', 'close', UNIT, '1.3', '--reason', 'The docs spell it already.']);
    run(['review', 'ask', UNIT]);
    const { res, brief } = issued(['test-surface', UNIT, '--base', 'main']);

    assert.strictEqual(brief, `Brief ${res.id} — the test surface's, for ${UNIT}\n\n${filledTemplate('test-surface', {
      'spec-scenarios': `${noSpec}\n\n${criteria}`,
      'change-commits': commits(),
      'change-scratch-layout': layoutOf(`${UNIT}-tests`),
      linters: NO_SETUP,
      'tests-report-to': `\`${statePath(dir, layout.unit(UNIT, 'review', 'round-1', 'tests-a.md'))}\``,
    })}`);
  });
});

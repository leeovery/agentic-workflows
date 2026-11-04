'use strict';

// ---------------------------------------------------------------------------
// The phase review's brief (leeway-engine/scripts/domain/brief.cjs, its
// records domain/brief-records.cjs, content/briefs/), the reviewer's second
// template — the phase, its sections, its tasks' criteria, what it relies
// on, the decided calls, its range — from where its chain leaves the
// branch the project lands on where no base is named, as a task's is from
// where it was laid out, each holding only its own phase's work (12.7.10)
// — its scenarios' runs read at the phase's tip in every repository
// holding its work, a clone's among them (15.S5, 15.S18, 12.7.10), what
// `verify mutants` left of the tool's survivors run at those tips, refused
// where a commit has landed in the clone since (15.S9), the linters
// (12.11.2), a setup with no tool said so (15.S10). A task's review rounds
// are test-engine-brief-build-rounds.cjs's, -changes.cjs's and -ways.cjs's;
// the builder's branch and its chain test-engine-brief-build-chain.cjs's.
//
// Layer: verb. World: brief-build-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  UNIT,
  NESTED,
  AREA_2,
  TASKS,
  branchOf,
  commitFile,
  tipOf,
  surviving,
  withoutMutationTool,
  RUNS,
  runFiles,
  useWorld,
  issued,
  filledTemplate,
  scratchCalls,
  refusedUnissued,
  pathDrawn,
  rangeDrawn,
  decidedDrawn,
  ok,
  statePath,
  layout,
  writeState,
  git,
  SPEC_FILE,
} = require('./brief-build-world.cjs');

/** @type {string} */
let dir;

describe('the phase review\'s brief, the reviewer\'s second template (12.11.2, 6.5.2)', () => {
  useWorld((at) => { dir = at; });

  /** The project's checkout, and the clone nested in it, each at the branch given. @param {string} project @param {string} [nested] */
  function checkedOut(project, nested = 'main') {
    git(dir, ['checkout', '-q', project]);
    git(path.join(dir, NESTED), ['checkout', '-q', nested]);
  }

  /** Each repository holding phase `phase`'s work checked out at its tip there. @param {number} phase */
  const atTips = (phase) => (phase === 1 ? checkedOut(branchOf(1, 4), branchOf(1, 1)) : checkedOut(branchOf(2, 1)));

  /** The phase review's brief for phase `phase` by reviewer `letter`. @param {number} phase @param {string} [letter] */
  const phaseReview = (phase, letter = 'a') => issued(['phase-review', UNIT, String(phase), '--base', 'main', '--letter', letter]);

  /**
   * The phase review's brief for phase `phase` by reviewer `letter`, the mutation tool run over the phase from a checkout at its tips first.
   * @param {number} phase @param {string} [letter]
   */
  function reviewedAtTips(phase, letter = 'a') {
    atTips(phase);
    ok(dir, ['verify', 'mutants', UNIT, String(phase)]);
    return phaseReview(phase, letter);
  }

  /** A run of RUNS drawn as a brief draws it. @param {number} at its place in RUNS */
  const runDrawn = (at) => `  - ${RUNS[at][1]}, recorded ${RUNS[at][3]}: ${pathDrawn(runFiles[at])}`;

  it('the phase, its sections, each of its tasks\' criteria but a closed one\'s, what it relies on, the decided calls, its range, its scenarios\' runs at its tips, what survived the mutation tool and the linters — dispatched as the reviewer', () => {
    const { res, brief, whose } = reviewedAtTips(2);

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'phase-review', agent: 'leeway-reviewer', pointer: `brief:${res.id}` });
    assert.deepStrictEqual(whose, { role: 'phase-review', agent: 'leeway-reviewer', unit: UNIT, task: null, topic: null });
    assert.strictEqual(brief, `Brief ${res.id} — the phase review's, for pay phase 2\n\n${filledTemplate('phase-review', {
      'cut-phase': 'Phase 2 of pay: Refunds\n\nA customer is refunded.\n\nIt relies on phase 1, the work unit ledger.',
      'phase-sections': [`\`${statePath(dir, layout.unit(UNIT, SPEC_FILE))}\``, '- §2, first built in this phase\n- §2.1, first built in this phase', AREA_2].join('\n\n'),
      'phase-criteria': '## 2.1 Refund a charge\n\n- Given a card, when refund a charge runs, then it answers.',
      'relied-on': [
        '## Phase 1: Cards', '', 'A customer pays by card.', '', 'Its sections: §1', '', 'Its tasks:', '',
        '- 1.1 Take a card, done\n- 1.2 Show a receipt, in progress\n- 1.3 Store a card, closed\n- 1.4 Check the number, not started', '',
        '## The work unit ledger', '', 'This phase relies on its delivery.',
      ].join('\n'),
      'decided-calls': decidedDrawn(),
      'phase-diff-range': rangeDrawn('the project\'s repository', branchOf(2, 1), ['src/check.js', 'src/card.js', 'src/receipt.js', 'src/refund.js'].sort()),
      'phase-scratch-layout': `- the project's repository: \`${branchOf(2, 1)}\` — the range's tip there\n- \`${NESTED}\`: \`main\` — the branch it lands on\n\n${
        scratchCalls(`${UNIT}-phase-2-a`, tipOf(dir, branchOf(2, 1)), [`${NESTED}=${tipOf(path.join(dir, NESTED), 'main')}`])}`,
      'recorded-runs': ['- 2.S1: proven', runDrawn(1), runDrawn(2)].join('\n'),
      mutants: 'None survived.',
      linters: '- eslint: npx eslint .',
      'phase-report-to': pathDrawn('pay/build/phases/phase-2/review-a.md'),
    })}`);
  });

  it('12.7.10: with no base named, each range holds its own phase\'s work alone — a phase relying on nothing unfinished, laid out beside one still open, read from where its chain leaves the branch the project lands on, as is the open one, and a task of it with nothing of its phase chained below it from there', () => {
    withoutMutationTool();
    git(dir, ['branch', '-D', branchOf(2, 1)]);
    git(dir, ['checkout', '-q', '-b', branchOf(2, 1), 'main']);
    commitFile(dir, 'src/refund.js', `${UNIT}-2-1`);
    git(dir, ['checkout', '-q', 'main']);
    /** The phase's range its review's brief draws. @param {string[]} args */
    const phaseRange = (args) => /# The phase's range\n\n([\s\S]*?)\n\n# /.exec(issued(['phase-review', UNIT, ...args]).brief)?.[1];
    const own = rangeDrawn('the project\'s repository', branchOf(2, 1), ['src/refund.js']);

    assert.strictEqual(phaseRange(['2', '--letter', 'a']), own);
    assert.strictEqual(phaseRange(['1', '--letter', 'a']), phaseRange(['1', '--base', 'main', '--letter', 'b']));
    assert.doesNotMatch(String(phaseRange(['1', '--letter', 'a'])), /refund/);
    assert.ok(issued(['reviewer', UNIT, '2.1', '--letter', 'a']).brief.includes(`# The diff's range\n\n${own}\n\n# `));
  });

  it('15.S5, 15.S18, 12.7.10: the runs are read at the phase\'s tip in every repository holding its work — a run beyond the project\'s tip never counts, nor 1.2\'s builder\'s later pass at the clone\'s code from before 1.1 landed there, the project\'s commit the tip\'s; so a scenario whose only run there failed reads not proven, and one only skipped named, not run', () => {
    withoutMutationTool();
    const lib = path.join(dir, NESTED);
    const tips = { '.': tipOf(dir, branchOf(1, 4)), [NESTED]: tipOf(lib, branchOf(1, 1)) };
    const before = git(lib, ['commit-tree', 'main^{tree}', '-p', 'main', '-m', '1.2, branched before 1.1 landed']).trim();
    const runs = /** @type {Array<[string, Record<string, string>, string]>} */ ([
      ['fail', tips, '2026-11-02T10:00:00.000Z'],
      ['pass', { ...tips, '.': tipOf(dir, branchOf(2, 1)) }, '2026-11-02T11:00:00.000Z'],
      ['pass', { ...tips, [NESTED]: before }, '2026-11-02T12:00:00.000Z'],
    ]);
    runs.forEach(([verdict, commits, at], i) => writeState(dir, layout.run(UNIT, '1.S1', `00${i + 1}`), JSON.stringify({
      verdict, unfixed: false, at, checkout: dir, commits: Object.entries(commits).map(([repo, commit]) => ({ repo, commit })), task: '1.2', evidence: [], recordings: [],
    })));

    const { brief } = phaseReview(1);

    const failed = `  - fail, recorded ${runs[0][2]}: ${pathDrawn(layout.run(UNIT, '1.S1', '001'))}`;
    assert.ok(brief.includes(`# Its scenarios' runs, at the phase's tips\n\n- 1.S1: not proven\n${failed}\n- 1.S2: named, not run\n${runDrawn(0)}\n\n#`), brief);
  });

  it('15.S9: what `verify mutants` left alive on the lines the phase changed, run at the phase\'s tip in every repository, reaches the pair wherever the checkout stands — none of what it left on lines the phase never changed, nor what it left at other code, the clone behind its tip among it — and the brief never runs the tool', () => {
    checkedOut(branchOf(1, 2), branchOf(1, 1));
    surviving([{ path: 'src/card.js', line: 1, mutant: 'left at another HEAD' }]);
    ok(dir, ['verify', 'mutants', UNIT, '1']);
    checkedOut(branchOf(1, 4));
    surviving([{ path: 'src/check.js', line: 1, mutant: 'left with the clone behind its tip' }]);
    ok(dir, ['verify', 'mutants', UNIT, '1']);
    atTips(1);
    surviving([{ path: 'src/check.js', line: 1, mutant: '1 → 0' }, { path: 'src/card.js', line: 2, mutant: 'a line the phase never wrote' }]);
    ok(dir, ['verify', 'mutants', UNIT, '1']);
    checkedOut('main');
    surviving([{ path: 'src/check.js', line: 1, mutant: 'the brief ran the tool' }]);

    const { brief } = phaseReview(1);

    assert.ok(brief.includes('# What survived the mutation tool\n\n- src/check.js:1 — 1 → 0\n\n#'), brief);
  });

  it('12.7.10: a commit landing only in the clone after `verify mutants` ran — a nit fixed on 1.1\'s branch there, the project\'s commit unmoved — leaves nothing run at the phase\'s tips: the brief refuses, naming `verify mutants` run at them', () => {
    atTips(1);
    ok(dir, ['verify', 'mutants', UNIT, '1']);
    const lib = path.join(dir, NESTED);
    commitFile(lib, 'card/nit.js', `${UNIT}-1-1`);

    refusedUnissued(['phase-review', UNIT, '1', '--base', 'main', '--letter', 'a'], new RegExp(`^the mutation tool has not run over phase 1 of pay at its tips — the project's repository at ${tipOf(dir, branchOf(1, 4))}, ${NESTED} at ${tipOf(lib, branchOf(1, 1))} — engine verify mutants pay 1 runs it$`));
  });

  it('15.S10: a setup naming no mutation tool says so, and the template has each reviewer break the riskiest line instead', () => {
    withoutMutationTool();

    const { brief } = phaseReview(2);

    assert.ok(brief.includes('# What survived the mutation tool\n\nThe verify setup names no mutation tool.\n\n#'), brief);
  });

  it('the criteria leave a closed task out and carry each addition', () => {
    const { brief } = reviewedAtTips(1);
    const criteria = (/** @type {number} */ n) => `## 1.${n} ${TASKS[1][n - 1][0]}\n\n- Given a card, when ${TASKS[1][n - 1][0].toLowerCase()} runs, then it answers.`;

    assert.ok(brief.includes(`# Its tasks' criteria\n\n${criteria(1)}\n\n${criteria(2)}\n\n### Added by the person\n\nThe receipt is emailed.\n\n${criteria(4)}\n\n# What it relies on\n\nNone recorded.\n`), brief);
  });
});

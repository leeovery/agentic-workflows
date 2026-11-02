'use strict';

// ---------------------------------------------------------------------------
// The build's review briefs (leeway-engine/scripts/domain/brief.cjs, its
// records domain/brief-records.cjs, content/briefs/): the phase review's,
// the reviewer's second template — the phase, its sections, its tasks'
// criteria, what it relies on, the decided calls, its range, its scenarios'
// runs read at the phase's HEAD (15.S5, 15.S18), what `verify mutants` left
// of the tool's survivors for that HEAD (15.S9), the linters (12.11.2), a
// setup with no tool said so (15.S10); where each reviewer's report goes
// (13.5.9) — a task's reviewer's file of the round under review, read from
// the reports on disk so it holds across a `/clear`, refused once written
// or once the review passed or was settled, a phase's reviewer's beside its
// consolidation, each by the reviewer's letter; and the builder's own call
// among the decided calls its reviewers read (13.S17).
//
// Layer: verb. World: brief-build-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { initRepo, commitCode, addSubmodule } = require('./engine-harness.cjs');
const {
  UNIT,
  NESTED,
  VERIFY,
  SESSION_ID,
  AREA_2,
  TASKS,
  branchOf,
  surviving,
  withoutMutationTool,
  RUNS,
  runFiles,
  calls,
  useWorld,
  issued,
  template,
  filledTemplate,
  refusedUnissued,
  pathDrawn,
  rangeDrawn,
  decidedDrawn,
  ok,
  statePath,
  layout,
  writeState,
  git,
  briefPath,
  conversationDir,
  SPEC_FILE,
} = require('./brief-build-world.cjs');

/** @type {string} */
let dir;

/** Why a report holding neither its findings' heading nor a verdict does not read, as round-report.cjs says it. */
const NOT_READ = 'its last heading at level one or two is not `## Findings`; its last line is not `Verdict: pass` or `Verdict: fail`';

describe('the phase review\'s brief, the reviewer\'s second template (12.11.2, 6.5.2)', () => {
  useWorld((at) => { dir = at; });

  /**
   * The phase review's brief for phase `phase` by reviewer `letter`, its runs read at `tip` and the mutation tool run over the phase from the checkout there first.
   * @param {number} phase @param {string} tip @param {string} [letter]
   */
  function reviewedAt(phase, tip, letter = 'a') {
    git(dir, ['checkout', '-q', tip]);
    ok(dir, ['verify', 'mutants', UNIT, String(phase)]);
    return issued(['phase-review', UNIT, String(phase), '--base', 'main', '--head', tip, '--letter', letter]);
  }

  /** A run of RUNS drawn as a brief draws it. @param {number} at its place in RUNS */
  const runDrawn = (at) => `  - ${RUNS[at][1]}, recorded ${RUNS[at][3]}: ${pathDrawn(runFiles[at])}`;

  it('the phase, its sections, each of its tasks\' criteria but a closed one\'s, what it relies on, the decided calls, its range, its scenarios\' runs at its HEAD, what survived the mutation tool and the linters — dispatched as the reviewer', () => {
    const { res, brief, whose } = reviewedAt(2, branchOf(2, 1));

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
      'phase-scratch-layout': `- the project's repository: \`${branchOf(2, 1)}\` — the range's tip there\n- \`${NESTED}\`: \`main\` — the branch it lands on`,
      'recorded-runs': ['- 2.S1: proven', runDrawn(1), runDrawn(2)].join('\n'),
      mutants: 'None survived.',
      linters: '- eslint: npx eslint .',
      'phase-report-to': pathDrawn('pay/build/phases/phase-2/review-a.md'),
    })}`);
  });

  it('15.S5, 15.S18: the runs are read at the phase\'s HEAD — a run at a commit beyond it never counts, so a scenario whose only run there failed reads not proven, one with none not proven, and one only skipped named, not run', () => {
    withoutMutationTool();
    const second = issued(['phase-review', UNIT, '2', '--base', 'main', '--head', branchOf(1, 4), '--letter', 'a']);
    const first = issued(['phase-review', UNIT, '1', '--base', 'main', '--head', branchOf(1, 4), '--letter', 'a']);

    assert.ok(second.brief.includes(`# Its scenarios' runs, at the phase's HEAD\n\n- 2.S1: not proven\n${runDrawn(1)}\n\n#`), second.brief);
    assert.ok(first.brief.includes(`# Its scenarios' runs, at the phase's HEAD\n\n- 1.S1: not proven\n- 1.S2: named, not run\n${runDrawn(0)}\n\n#`), first.brief);
  });

  it('15.S9: what `verify mutants` left alive on the lines the phase changed, at the phase\'s HEAD, reaches the pair — none of what it left on lines the phase never changed, nor what it left at another HEAD — and the brief never runs the tool', () => {
    git(dir, ['checkout', '-q', branchOf(1, 2)]);
    surviving([{ path: 'src/card.js', line: 1, mutant: 'left at another HEAD' }]);
    ok(dir, ['verify', 'mutants', UNIT, '1']);
    surviving([{ path: 'src/check.js', line: 1, mutant: '1 → 0' }, { path: 'src/card.js', line: 2, mutant: 'a line the phase never wrote' }]);
    git(dir, ['checkout', '-q', branchOf(1, 4)]);
    ok(dir, ['verify', 'mutants', UNIT, '1']);
    surviving([{ path: 'src/check.js', line: 1, mutant: 'the brief ran the tool' }]);

    const { brief } = issued(['phase-review', UNIT, '1', '--base', 'main', '--head', branchOf(1, 4), '--letter', 'a']);

    assert.ok(brief.includes('# What survived the mutation tool\n\n- src/check.js:1 — 1 → 0\n\n#'), brief);
  });

  it('15.S10: a setup naming no mutation tool says so, and the template has each reviewer break the riskiest line instead', () => {
    withoutMutationTool();

    const { brief } = issued(['phase-review', UNIT, '2', '--base', 'main', '--head', branchOf(2, 1), '--letter', 'a']);

    assert.ok(brief.includes('# What survived the mutation tool\n\nThe verify setup names no mutation tool.\n\n#'), brief);
  });

  it('the criteria leave a closed task out and carry each addition', () => {
    const { brief } = reviewedAt(1, branchOf(1, 4));
    const criteria = (/** @type {number} */ n) => `## 1.${n} ${TASKS[1][n - 1][0]}\n\n- Given a card, when ${TASKS[1][n - 1][0].toLowerCase()} runs, then it answers.`;

    assert.ok(brief.includes(`# Its tasks' criteria\n\n${criteria(1)}\n\n${criteria(2)}\n\n### Added by the person\n\nThe receipt is emailed.\n\n${criteria(4)}\n\n# What it relies on\n\nNone recorded.\n`), brief);
  });
});

describe('where a reviewer\'s report goes (13.5.9)', () => {
  useWorld((at) => { dir = at; });

  const REPORT = '## Findings\n\n- bug: The receipt is never sent.\n  Scenario: A customer pays and waits for a receipt.\n\nVerdict: fail\n';
  const PASSED = '## Findings\n\nNone.\n\nVerdict: pass\n';

  /** The reviewer's brief for task 1.2 by reviewer `letter`, in the conversation `session` names. @param {string} letter @param {string} [session] */
  const reviewing = (letter, session = SESSION_ID) => ok(dir, ['brief', 'reviewer', UNIT, '1.2', '--base', 'main', '--letter', letter], { env: { CLAUDE_CODE_SESSION_ID: session } });

  /** The report place a brief draws. @param {{id: string}} res @param {string} [session] */
  const placeIn = (res, session = SESSION_ID) => /# Where your report goes\n\n(.*)\n/.exec(fs.readFileSync(briefPath(session, res.id), 'utf8'))?.[1];

  /** A round's report written by reviewer `letter`. @param {number} round @param {string} letter @param {string} [text] */
  const reported = (round, letter, text = REPORT) => writeState(dir, `pay/build/tasks/1.2/round-${round}-${letter}.md`, text);

  it('each reviewer of a task\'s first round writes to its own file of round 1', () => {
    assert.strictEqual(placeIn(reviewing('a')), pathDrawn('pay/build/tasks/1.2/round-1-a.md'));
    assert.strictEqual(placeIn(reviewing('b')), pathDrawn('pay/build/tasks/1.2/round-1-b.md'));
  });

  it('the round is read from the reports on disk: the round one reviewer has reported holds for the other after a /clear, and a round both reported is followed by the next', () => {
    reported(1, 'a');
    const cleared = 'brief-build-after-clear';
    try {
      assert.strictEqual(placeIn(reviewing('b', cleared), cleared), pathDrawn('pay/build/tasks/1.2/round-1-b.md'));
    } finally {
      fs.rmSync(conversationDir(cleared), { recursive: true, force: true });
    }
    reported(1, 'b');
    assert.strictEqual(placeIn(reviewing('a')), pathDrawn('pay/build/tasks/1.2/round-2-a.md'));
  });

  it('13.4.6: a round the orchestrator settled is followed by another, its direction reviewed again', () => {
    reported(1, 'a');
    reported(1, 'b');
    writeState(dir, 'pay/build/tasks/1.2/round-1-settled.md', 'Settled.\n');

    assert.strictEqual(placeIn(reviewing('a')), pathDrawn('pay/build/tasks/1.2/round-2-a.md'));
  });

  it('a report that does not read is replaced: its reviewer is briefed again for its round, the brief naming the file it replaces, and the other reviewer\'s round stands', () => {
    reported(1, 'a', 'Looks fine to me.\n');
    reported(1, 'b');

    refusedUnissued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'b'], /^pay\/build\/tasks\/1\.2\/round-1-b\.md is written already — that reviewer's report of the round is in$/);
    assert.strictEqual(placeIn(reviewing('a')), `${pathDrawn('pay/build/tasks/1.2/round-1-a.md')} — the report there does not read as a reviewer's report — ${NOT_READ}; yours replaces it`);
  });

  it('refused: a letter none of the reviewers\', a report already written for its round that reads, and a task whose last round passed', () => {
    refusedUnissued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'c'], /^c is no reviewer's letter — the reviewers are a and b$/);
    reported(1, 'a');
    refusedUnissued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'a'], /^pay\/build\/tasks\/1\.2\/round-1-a\.md is written already — that reviewer's report of the round is in$/);
    reported(1, 'b', PASSED);
    reported(1, 'a', PASSED);
    refusedUnissued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'a'], /^round 1 of task 1\.2 of pay passed — its review is over$/);
  });

  it('a phase\'s reviewer writes to its letter\'s file beside the consolidation, a report there that does not read named as the one it replaces, refused once one that reads is written', () => {
    withoutMutationTool();
    const phaseReview = ['phase-review', UNIT, '1', '--base', 'main', '--head', branchOf(1, 4), '--letter', 'b'];
    const first = 'brief-build-phase-review';
    const elsewhere = () => placeIn(ok(dir, ['brief', ...phaseReview], { env: { CLAUDE_CODE_SESSION_ID: first } }), first);
    try {
      assert.strictEqual(elsewhere(), pathDrawn('pay/build/phases/phase-1/review-b.md'));
      writeState(dir, 'pay/build/phases/phase-1/review-b.md', 'Half a report.\n');
      assert.strictEqual(elsewhere(), `${pathDrawn('pay/build/phases/phase-1/review-b.md')} — the report there does not read as a reviewer's report — ${NOT_READ}; yours replaces it`);
    } finally {
      fs.rmSync(conversationDir(first), { recursive: true, force: true });
    }
    writeState(dir, 'pay/build/phases/phase-1/review-b.md', REPORT);
    refusedUnissued(phaseReview, /^pay\/build\/phases\/phase-1\/review-b\.md is written already — that reviewer's report of the round is in$/);
  });
});

describe('the reviewer\'s scratch worktree (13.2.2)', () => {
  useWorld((at) => { dir = at; });

  /** The scratch worktree's layout task 1.2's reviewer is briefed with. */
  const laidOut = () => /# Laying out your scratch worktree\n\n([^#]*)\n\n#/.exec(issued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'a']).brief)?.[1];

  it('a task touching the project\'s repository alone lays out every repository, as the builder\'s worktree held them: the project\'s at the range\'s tip, a submodule at the commit that tip points it at, a clone on the task\'s branch, or the branch it lands on where that is not made there', () => {
    const source = initRepo(path.join(dir, '..', 'ext-source'));
    fs.writeFileSync(path.join(source, 'one.txt'), 'one\n');
    commitCode(source, 'one');
    const first = git(source, ['rev-parse', 'HEAD']).trim();
    fs.writeFileSync(path.join(source, 'two.txt'), 'two\n');
    commitCode(source, 'two');
    addSubmodule(dir, 'ext', source);
    const pinning = path.join(dir, '..', 'pinning');
    git(dir, ['worktree', 'add', '-q', pinning, branchOf(1, 2)]);
    git(pinning, ['update-index', '--add', '--cacheinfo', `160000,${first},ext`]);
    git(pinning, ['commit', '-q', '-m', 'ext pinned']);
    git(dir, ['worktree', 'remove', '--force', pinning]);
    const nested = path.join(dir, NESTED);
    git(nested, ['branch', branchOf(1, 2), 'main']);

    const own = `- the project's repository: \`${branchOf(1, 2)}\` — the range's tip there`;
    const ext = `- \`ext\`: \`${first}\` — a submodule, at the commit the project's repository points it at as laid out`;
    assert.strictEqual(laidOut(), [own, ext, `- \`${NESTED}\`: \`${branchOf(1, 2)}\` — the task's branch`].join('\n'));
    git(nested, ['branch', '-D', branchOf(1, 2)]);
    assert.strictEqual(laidOut(), [own, ext, `- \`${NESTED}\`: \`main\` — the branch it lands on, the task's branch not made there`].join('\n'));
  });
});

describe('where the verify setup goes (15.2.11)', () => {
  useWorld((at) => { dir = at; });

  it('the builder\'s file starts from the setup recorded now, drawn whole but for its run, so a builder changing it never undoes a change recorded since', () => {
    const { ran: _ran, ...parts } = VERIFY;
    const { brief } = issued(['builder', UNIT, '1.2']);

    assert.ok(brief.includes(`# Where the verify setup goes\n\n${pathDrawn('.cache/pay/build/verify-setup.json')}\n\nThe verify setup recorded now, which the file starts from:\n\n\`\`\`json\n${JSON.stringify(parts, null, 2)}\n\`\`\`\n\n#`), brief);
  });
});

describe('the builder\'s calls (13.11.10)', () => {
  useWorld((at) => { dir = at; });

  it('13.S17: a call the builder took, recorded in the build, is among the decided calls the builder\'s brief and its reviewers\' carry', () => {
    const builder = issued(['builder', UNIT, '1.2']).brief;
    const reviewer = issued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'a']).brief;

    for (const brief of [builder, reviewer]) assert.ok(brief.includes(`# The decided calls\n\n${decidedDrawn()}\n`), brief);
  });
});

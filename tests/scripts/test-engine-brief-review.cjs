'use strict';

// ---------------------------------------------------------------------------
// The review phase's briefs (leeway-engine/scripts/domain/brief.cjs, its
// records domain/brief-records.cjs, the change domain/review-change.cjs,
// content/briefs/review-area.md and test-surface.md): an area review's, the
// reviewer's third template, `brief review-area <unit> --area N --base
// <branch> --letter <a|b>` — the area of the spec verbatim, the other areas
// and where they meet it, the unit's calls whole, read for calls wrong in
// combination (16.17.8, 16.S61), the change's commits in each repository —
// the unit's own work alone: each of its landings against its first
// parent, never another unit's between or after them nor a commit naming
// no task, then its work not landed from where it leaves the base — the
// scratch worktree's layout, the area's scenarios' runs at the change's
// tips, the linters, and where the reviewer's report goes; the test
// surface's, `brief test-surface <unit> --base <branch>` — every scenario
// of the spec, the commits, the layout, the linters and its one report
// (14.2.4); each area its pair's two reports and the tests one, in the
// round's folder (14.S2); a later round's briefs reading the fix phase's
// tip and only the reads named for it (14.3.3); a report that does not read
// named as the one a fresh brief's replaces; what they refuse; and the
// templates: the floor as guidance (14.3.1), the product run through the
// verify setup, the call, the report and its rules the phase review's, its
// notes for later beyond the work unit's change.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const { template, filledTemplate, scratchCalls, ENGINE_DRAWN } = require('./brief-build-world.cjs');
const {
  UNIT, OTHER, AREAS, EVERY, RECEIPT, calls, useWorld, env, enter, reported, named, recorded, firstRoundReady, fixBranch, fixBuilt, commitFile, stateText, issued, storedBriefs, areaText,
  refusedPristine, statePath, writeState, reportText, git, initRepo, assert,
} = require('./review-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { runsRel } = require(path.join(SCRIPTS, 'domain/runs.cjs'));

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

/** An area review's brief by reviewer `letter`. @param {string} area @param {string} [letter] */
const areaReview = (area, letter = 'a') => issued(['review-area', UNIT, '--area', area, '--base', 'main', '--letter', letter]);

/** A brief refused, nothing written and no brief stored: its error. @param {string[]} args */
function refusedBrief(args) {
  const before = storedBriefs();
  const { error } = refusedPristine(dir, ['brief', ...args], { env: env() });
  assert.deepStrictEqual(storedBriefs(), before);
  return error;
}

/** The commit the project's `main` is at. */
const mainCommit = () => git(dir, ['rev-parse', 'main']).trim();

/** A path drawn as a brief draws it. @param {string} rel the path from the state root */
const pathDrawn = (rel) => `\`${statePath(dir, rel)}\``;

/** A part's stat, one file of one line added. @param {string} file */
const statOf = (file) => `\`\`\`\n ${file} | 1 +\n 1 file changed, 1 insertion(+)\n\`\`\``;
/** A commit's first twelve characters. @param {string} repo @param {string} ref */
const short = (repo, ref) => git(repo, ['rev-parse', ref]).trim().slice(0, 12);
/** A landing of the unit's as drawn, the one file it added. @param {string} repo @param {string} ref @param {string} file */
const landingDrawn = (repo, ref, file) => `### Landed: \`${short(repo, ref)}\` feat(${UNIT}): add ${file}\n\n${statOf(file)}`;
/** The unit's work not landed as drawn, branched from main, the one file it added. @param {string} repo @param {string} branch @param {string} file */
const unlandedDrawn = (repo, branch, file) => `### Not landed yet: \`${short(repo, 'main')}..${branch}\`\n\n${statOf(file)}`;

/** The unit's landings on main, by where they stand on it — another unit's between them and after them, and a commit naming no task, left out. */
const LANDINGS = Object.freeze([['main~5', 'src/card.js'], ['main~3', 'src/receipt.js'], ['main~1', 'src/refund.js']]);

/** The change's commits in the project's repository: its landings, then `unlanded`. @param {string[]} [unlanded] */
const projectCommits = (unlanded = []) => [`## In the project's repository`, ...LANDINGS.map(([ref, file]) => landingDrawn(dir, ref, file)), ...unlanded].join('\n\n');

/** A brief's section, by its heading, to the next. @param {string} brief @param {string} heading */
const sectionIn = (brief, heading) => brief.slice(brief.indexOf(`# ${heading}\n\n`) + heading.length + 4, brief.indexOf('\n\n# ', brief.indexOf(`# ${heading}\n\n`)));

/** Round 1 recorded failing on area 1, its fix task 3.1 built on main in the repository at `repo`, round 2 entered and area 1 named its read. @param {string} [repo] */
function secondRound(repo = dir) {
  firstRoundReady();
  recorded({ can_now: [], findings: [RECEIPT] });
  fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js', repo);
  enter();
  named(['1-cards']);
}

describe('the area review\'s brief, the reviewer\'s third template (14.1, 14.2)', () => {
  it('16.S61: the area verbatim, where the others meet it, the unit\'s calls whole, the change\'s commits — each of its landings, never another unit\'s or a commit naming no task — the layout, the area\'s runs at the change\'s tips, the linters and its report — dispatched as the reviewer', () => {
    const { res, brief, whose } = areaReview('1', 'b');
    const spec = stateText(`${UNIT}/spec.md`);
    const run = (/** @type {string} */ scenario, /** @type {string} */ verdict, /** @type {number} */ hour) => `  - ${verdict}, recorded 2026-11-01T1${hour}:00:00.000Z: ${pathDrawn(`${runsRel(UNIT, scenario)}/run-001.json`)}`;

    assert.deepStrictEqual([res, whose], [
      { ok: true, id: res.id, role: 'review-area', agent: 'leeway-reviewer', pointer: `brief:${res.id}` },
      { role: 'review-area', agent: 'leeway-reviewer', unit: UNIT, task: null, topic: null, area: '1', round: 1 },
    ]);
    assert.strictEqual(brief, `Brief ${res.id} — the area review's, for ${UNIT}\n\n${filledTemplate('review-area', {
      engine: ENGINE_DRAWN,
      'area-sections': [pathDrawn(`${UNIT}/spec.md`), areaText(spec, 1)].join('\n\n'),
      'area-meets': `The other areas:\n\n- §2 Refunds\n\nWhere they meet it:\n\n- §2.1 relies on §1.2: 2.1.1 cites ${calls.refund}, which relies on ${calls.copy}, cited by 1.2.1`,
      'unit-calls': [
        `- ${calls.token}, Claude's, at ${UNIT}.specification: A card is tokenised.\n  It answers: How is a card kept?\n  Why: No number is kept.`,
        `- ${calls.copy}, Claude's, at ${UNIT}.specification: The receipt names the shop.\n  It answers: What does the receipt say?\n  Why: Customers know it.`,
        `- ${calls.pdf}, Claude's, handed over as your call, at ${UNIT}.implementation: The receipt is a PDF.\n  It answers: What form is the receipt?\n  Why: Customers print it.`,
        `- ${calls.retry}, Claude's, at ${UNIT}.implementation: A charge is retried twice.\n  It answers: How often is a charge retried?\n  Why: The gateway drops one in a hundred.`,
        `- ${calls.api}, the person's, at ${UNIT}.specification: Refunds through the API.\n  It answers: How are refunds made?\n  Why: They come weekly now.`,
        `- ${calls.refund}, the person's, at ${UNIT}.specification: A refund's receipt names the shop.\n  It answers: What does a refund's receipt say?\n  Why: As its charge's did.`,
      ].join('\n'),
      'change-commits': projectCommits(),
      'change-scratch-layout': `- the project's repository: \`main\` — the change's tip there\n\n${scratchCalls(`${UNIT}-area-1-b`, mainCommit())}`,
      'area-runs': [
        '- 1.S1: proven', '  Given a card form, when the number is typed, then it is checked. (1.1.1)', run('1.S1', 'pass', 0),
        '- 1.S2: not proven', '  Given a charge, when it lands, then a receipt follows. (1.2.1)', run('1.S2', 'fail', 1),
      ].join('\n'),
      linters: '- eslint: npx eslint .',
      'area-report-to': pathDrawn(`${UNIT}/review/round-1/1-cards-b.md`),
      'area-authority': 'Every task and every phase of the build has passed its own review. Hold the whole change against this area of the spec, as one piece. The spec\'s intent for the area, and the product it describes, are your authority, never a task\'s criteria:',
    })}`);
  });

  it('14.S2: each area\'s pair writes two reports of its own in the round\'s folder, and the test surface one beside them', () => {
    const placed = AREAS.flatMap((area, at) => ['a', 'b'].map((letter) => /# Where your report goes\n\n(.*)\n/.exec(areaReview(String(at + 1), letter).brief)?.[1]));
    const tests = /# Where your report goes\n\n(.*)\n/.exec(issued(['test-surface', UNIT, '--base', 'main']).brief)?.[1];

    assert.deepStrictEqual([...placed, tests], ['1-cards-a', '1-cards-b', '2-refunds-a', '2-refunds-b', 'tests-a'].map((name) => pathDrawn(`${UNIT}/review/round-1/${name}.md`)));
  });

  it('a report that does not read is replaced: its reader briefed again, the brief naming the file it replaces and why; one that reads refuses its reader\'s brief', () => {
    const notRead = 'its last heading at level one or two is not `## Findings`; its last line is not `Verdict: pass` or `Verdict: fail`';
    const placeOf = (/** @type {string} */ brief) => /# Where your report goes\n\n(.*)\n/.exec(brief)?.[1];
    for (const name of ['1-cards-a', 'tests-a']) writeState(dir, `${UNIT}/review/round-1/${name}.md`, '# Review\n\nHalf written.\n');
    writeState(dir, `${UNIT}/review/round-1/1-cards-b.md`, reportText([]));

    assert.deepStrictEqual([placeOf(areaReview('1').brief), placeOf(issued(['test-surface', UNIT, '--base', 'main']).brief)], ['1-cards-a', 'tests-a'].map((name) => (
      `${pathDrawn(`${UNIT}/review/round-1/${name}.md`)} — the report there does not read as a reviewer's report — ${notRead}; yours replaces it`
    )));
    assert.strictEqual(refusedBrief(['review-area', UNIT, '--area', '1', '--base', 'main', '--letter', 'b']), `${UNIT}/review/round-1/1-cards-b.md is written already — that reviewer's report of the round is in`);
  });

  it('14.S3: a later round reads the change to its fix phase\'s tip, the work not landed from where it leaves the base, and only the reads named for it', () => {
    secondRound();
    const tip = fixBranch(3, 1, 'Send the receipt');
    const { brief } = areaReview('1');

    assert.strictEqual(sectionIn(brief, 'The change\'s commits'), projectCommits([unlandedDrawn(dir, tip, 'src/send.js')]));
    assert.ok(brief.includes(`# Laying out your scratch worktree\n\n- the project's repository: \`${tip}\` — the change's tip there\n`), brief);
    assert.ok(brief.includes(`# Where your report goes\n\n${pathDrawn(`${UNIT}/review/round-2/1-cards-a.md`)}\n`), brief);
    assert.deepStrictEqual([
      refusedBrief(['review-area', UNIT, '--area', '2', '--base', 'main', '--letter', 'a']), refusedBrief(['test-surface', UNIT, '--base', 'main']),
    ], ['area 2 is not read in round 2, which reads 1-cards', 'the test surface is not read in round 2, which reads 1-cards']);
  });

  it('the change across repositories: a child repository holding part of its landings, another unit\'s beside them left out, and one holding only its work not landed', () => {
    fs.mkdirSync(path.join(dir, '.git/info'), { recursive: true });
    fs.appendFileSync(path.join(dir, '.git/info/exclude'), 'lib/cards/\nlib/refunds/\n');
    const cards = initRepo(path.join(dir, 'lib/cards'));
    commitFile(cards, 'index.js');
    commitFile(cards, 'card/token.js', `${UNIT}-1-1`);
    commitFile(cards, 'card/coupon.js', `${OTHER}-1-1`);
    const refunds = initRepo(path.join(dir, 'lib/refunds'));
    commitFile(refunds, 'index.js');
    secondRound(refunds);

    assert.strictEqual(sectionIn(areaReview('1').brief, 'The change\'s commits'), [
      projectCommits(), '## In `lib/cards`', landingDrawn(cards, 'main~1', 'card/token.js'), '## In `lib/refunds`', unlandedDrawn(refunds, fixBranch(3, 1, 'Send the receipt'), 'src/send.js'),
    ].join('\n\n'));
  });
});

describe('the test surface\'s brief (14.2.4)', () => {
  it('every scenario of the spec with its area, the change\'s range, the layout, the linters and its one report — dispatched as the test reader', () => {
    const { res, brief, whose } = issued(['test-surface', UNIT, '--base', 'main']);

    assert.deepStrictEqual(whose, { role: 'test-surface', agent: 'leeway-test-surface', unit: UNIT, task: null, topic: null, round: 1 });
    assert.strictEqual(brief, `Brief ${res.id} — the test surface's, for ${UNIT}\n\n${filledTemplate('test-surface', {
      'spec-scenarios': [
        '- 1.S1, of §1 Cards: Given a card form, when the number is typed, then it is checked. (1.1.1)',
        '- 1.S2, of §1 Cards: Given a charge, when it lands, then a receipt follows. (1.2.1)',
        '- 2.S1, of §2 Refunds: Given a charge, when it is refunded whole, then the card is credited. (2.1.1)',
      ].join('\n'),
      'change-commits': projectCommits(),
      'change-scratch-layout': `- the project's repository: \`main\` — the change's tip there\n\n${scratchCalls(`${UNIT}-tests`, mainCommit())}`,
      linters: '- eslint: npx eslint .',
      'tests-report-to': pathDrawn(`${UNIT}/review/round-1/tests-a.md`),
    })}`);
  });
});

describe('the review phase\'s briefs refused, nothing stored or written', () => {
  it('an area the spec lacks, a base no repository has, a unit whose review phase cannot be entered, a round waiting on its fix tasks, and one whose reads are not named', () => {
    const lacking = refusedBrief(['review-area', UNIT, '--area', '3', '--base', 'main', '--letter', 'a']);
    const trunk = refusedBrief(['test-surface', UNIT, '--base', 'trunk']);
    const half = refusedBrief(['test-surface', 'half', '--base', 'main']);
    firstRoundReady();
    recorded({ can_now: [], findings: [RECEIPT] });
    const waiting = refusedBrief(['test-surface', UNIT, '--base', 'main']);
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');

    assert.deepStrictEqual([lacking, trunk, half, waiting, refusedBrief(['review-area', UNIT, '--area', '1', '--base', 'main', '--letter', 'a'])], [
      'the spec has no area 3 — its areas are §1, §2',
      'the base trunk is no local branch in any repository of the project',
      'half\'s review phase starts once every phase of its cut has closed — phase 2 of 2 has not: enter implementation half',
      'round 2 is read once every fix task of round 1 is done — task 3.1 not started',
      `round 2's areas are not yet named — review reads ${UNIT} <area> …, from what round 1's fix tasks changed, among them 1-cards`,
    ]);
  });

  it('a review over, and a unit none of whose change any repository holds', () => {
    enter();
    reported(1, EVERY);
    recorded({ can_now: [], findings: [] });

    assert.deepStrictEqual([refusedBrief(['test-surface', UNIT, '--base', 'main']), refusedBrief(['test-surface', 'solo', '--base', 'main'])], [
      `${UNIT}'s review phase passed in round 1 — finish is next`,
      'no repository of the project holds solo\'s change — nothing of it has landed, and no task of it is done',
    ]);
  });
});

describe('the templates', () => {
  it('14.3.1: the area review\'s floor is guidance in its template — a finding names the failure it prevents — its product run through the verify setup, and the call, the report and its rules the phase review\'s, as are the test surface\'s, its notes for later beyond the work unit\'s change', () => {
    const tail = (/** @type {string} */ text) => text.slice(text.indexOf('# Each finding\'s call'));
    const area = template('review-area');
    const phaseTail = tail(template('phase-review')).replaceAll('beyond the task', 'beyond the work unit\'s change');

    for (const rule of [
      'A finding names the failure it prevents: what goes wrong, for whom, and how it would be noticed. One that cannot is not written.',
      'the unit\'s calls read whole: a call fine alone and wrong in combination with another is a finding;',
      'A scenario its runs leave "not proven", or "named, not run", at the change\'s tips is a finding, and reads so in your report, in those words.',
      'each scenario of the area\'s above through the project\'s verify setup, one at a time: the engine\'s `verify run {unit} {scenario}`, the unit this brief is for.',
      '# The engine\n\n{{engine}}\n',
      'Where the project has no verify setup recorded, say so in your report instead of running.',
    ]) assert.ok(area.includes(rule), rule);
    assert.notStrictEqual(phaseTail, tail(template('phase-review')));
    assert.deepStrictEqual([tail(area), tail(template('test-surface'))], [phaseTail, phaseTail]);
  });
});

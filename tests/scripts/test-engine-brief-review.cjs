'use strict';

// ---------------------------------------------------------------------------
// The review phase's briefs (leeway-engine/scripts/domain/brief.cjs, its
// records domain/brief-records.cjs, the change domain/review-change.cjs,
// content/briefs/review-area.md and test-surface.md): an area review's, the
// reviewer's third template, `brief review-area <unit> --area N --base
// <branch> --letter <a|b>` — the area of the spec verbatim, the other areas
// and where they meet it, the unit's calls whole, read for calls wrong in
// combination (16.17.8, 16.S61), the whole change's range from the unit's
// earliest landing to the tip of its work not landed, else its base,
// across repositories, the scratch worktree's layout, the area's scenarios'
// runs at the change's tips, the linters, and where the reviewer's report
// goes; the test surface's, `brief test-surface <unit> --base <branch>` —
// every scenario of the spec, the range, the layout, the linters and its
// one report (14.2.4); each area its pair's two reports and the tests one,
// in the round's folder (14.S2); a later round's briefs reading the fix
// phase's tip and only the areas its fix tasks changed (14.3.3); what they
// refuse; and the templates: the floor as guidance (14.3.1), the call, the
// report and its rules word for word the phase review's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const path = require('path');
const { template, filledTemplate } = require('./brief-build-world.cjs');
const {
  UNIT, AREAS, RECEIPT, calls, useWorld, env, enter, reported, recorded, firstRoundReady, fixBranch, fixBuilt, stateText, issued, storedBriefs, areaText,
  refusedPristine, statePath, git, assert,
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

/** A path drawn as a brief draws it. @param {string} rel the path from the state root */
const pathDrawn = (rel) => `\`${statePath(dir, rel)}\``;

/** The change's range as drawn in the project's repository, from the parent of the unit's first landing to `tip`. @param {string} tip @param {string[]} files */
function rangeDrawn(tip, files) {
  const from = git(dir, ['rev-parse', 'main~4']).trim().slice(0, 12);
  const width = Math.max(...files.map((file) => file.length));
  const lines = files.map((file) => ` ${file.padEnd(width)} | 1 +`);
  return `## In the project's repository: \`${from}..${tip}\`\n\n\`\`\`\n${lines.join('\n')}\n ${files.length} files changed, ${files.length} insertions(+)\n\`\`\``;
}

const LANDED = Object.freeze(['docs/readme.js', 'src/card.js', 'src/receipt.js', 'src/refund.js']);

/** Round 1 recorded failing on area 1, its fix task 3.1 built on main, and round 2 entered. */
function secondRound() {
  firstRoundReady();
  recorded({ can_now: [], findings: [RECEIPT] });
  fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
  enter();
}

describe('the area review\'s brief, the reviewer\'s third template (14.1, 14.2)', () => {
  it('16.S61: the area verbatim, where the others meet it, the unit\'s calls whole, the change\'s range from its first landing, the layout, the area\'s runs at the change\'s tips, the linters and its report — dispatched as the reviewer', () => {
    const { res, brief, whose } = areaReview('1', 'b');
    const spec = stateText(`${UNIT}/spec.md`);
    const run = (/** @type {string} */ scenario, /** @type {string} */ verdict, /** @type {number} */ hour) => `  - ${verdict}, recorded 2026-11-01T1${hour}:00:00.000Z: ${pathDrawn(`${runsRel(UNIT, scenario)}/run-001.json`)}`;

    assert.deepStrictEqual([res, whose], [
      { ok: true, id: res.id, role: 'review-area', agent: 'leeway-reviewer', pointer: `brief:${res.id}` },
      { role: 'review-area', agent: 'leeway-reviewer', unit: UNIT, task: null, topic: null },
    ]);
    assert.strictEqual(brief, `Brief ${res.id} — the area review's, for ${UNIT}\n\n${filledTemplate('review-area', {
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
      'change-range': rangeDrawn('main', LANDED),
      'change-scratch-layout': '- the project\'s repository: `main` — the range\'s tip there',
      'area-runs': [
        '- 1.S1: proven', '  Given a card form, when the number is typed, then it is checked. (1.1.1)', run('1.S1', 'pass', 0),
        '- 1.S2: not proven', '  Given a charge, when it lands, then a receipt follows. (1.2.1)', run('1.S2', 'fail', 1),
      ].join('\n'),
      linters: '- eslint: npx eslint .',
      'area-report-to': pathDrawn(`${UNIT}/review/round-1/1-cards-b.md`),
    })}`);
  });

  it('14.S2: each area\'s pair writes two reports of its own in the round\'s folder, and the test surface one beside them', () => {
    const placed = AREAS.flatMap((area, at) => ['a', 'b'].map((letter) => /# Where your report goes\n\n(.*)\n/.exec(areaReview(String(at + 1), letter).brief)?.[1]));
    const tests = /# Where your report goes\n\n(.*)\n/.exec(issued(['test-surface', UNIT, '--base', 'main']).brief)?.[1];

    assert.deepStrictEqual([...placed, tests], ['1-cards-a', '1-cards-b', '2-refunds-a', '2-refunds-b', 'tests-a'].map((name) => pathDrawn(`${UNIT}/review/round-1/${name}.md`)));
  });

  it('14.S3: a later round reads the change at its fix phase\'s tip, and only the areas its fix tasks changed', () => {
    secondRound();
    const tip = fixBranch(3, 1, 'Send the receipt');
    const { brief } = areaReview('1');

    assert.ok(brief.includes(`# The change's range\n\n${rangeDrawn(tip, [...LANDED, 'src/send.js'])}\n`), brief);
    assert.ok(brief.includes(`# Laying out your scratch worktree\n\n- the project's repository: \`${tip}\` — the range's tip there\n`), brief);
    assert.ok(brief.includes(`# Where your report goes\n\n${pathDrawn(`${UNIT}/review/round-2/1-cards-a.md`)}\n`), brief);
    assert.strictEqual(refusedBrief(['review-area', UNIT, '--area', '2', '--base', 'main', '--letter', 'a']), 'area 2 is not read in round 2 — an area is read again only where a fix task of the round before changed it, and round 2 reads 1-cards');
  });
});

describe('the test surface\'s brief (14.2.4)', () => {
  it('every scenario of the spec with its area, the change\'s range, the layout, the linters and its one report — dispatched as the test reader', () => {
    const { res, brief, whose } = issued(['test-surface', UNIT, '--base', 'main']);

    assert.deepStrictEqual(whose, { role: 'test-surface', agent: 'leeway-test-surface', unit: UNIT, task: null, topic: null });
    assert.strictEqual(brief, `Brief ${res.id} — the test surface's, for ${UNIT}\n\n${filledTemplate('test-surface', {
      'spec-scenarios': [
        '- 1.S1, of §1 Cards: Given a card form, when the number is typed, then it is checked. (1.1.1)',
        '- 1.S2, of §1 Cards: Given a charge, when it lands, then a receipt follows. (1.2.1)',
        '- 2.S1, of §2 Refunds: Given a charge, when it is refunded whole, then the card is credited. (2.1.1)',
      ].join('\n'),
      'change-range': rangeDrawn('main', LANDED),
      'change-scratch-layout': '- the project\'s repository: `main` — the range\'s tip there',
      linters: '- eslint: npx eslint .',
      'tests-report-to': pathDrawn(`${UNIT}/review/round-1/tests-a.md`),
    })}`);
  });
});

describe('the review phase\'s briefs refused, nothing stored or written', () => {
  it('an area the spec lacks, a base no repository has, a unit whose review phase cannot be entered, and a round waiting on its fix tasks', () => {
    const lacking = refusedBrief(['review-area', UNIT, '--area', '3', '--base', 'main', '--letter', 'a']);
    const trunk = refusedBrief(['test-surface', UNIT, '--base', 'trunk']);
    const half = refusedBrief(['test-surface', 'half', '--base', 'main']);
    firstRoundReady();
    recorded({ can_now: [], findings: [RECEIPT] });

    assert.deepStrictEqual([lacking, trunk, half, refusedBrief(['test-surface', UNIT, '--base', 'main'])], [
      'the spec has no area 3 — its areas are §1, §2',
      'the base trunk is no local branch in any repository of the project',
      'half\'s review phase starts once every phase of its cut has closed — phase 2 of 2 has not: enter implementation half',
      'round 2 reads the areas round 1\'s fix tasks changed once every one is done — task 3.1 not started',
    ]);
  });

  it('a review over, and a unit none of whose change any repository holds', () => {
    enter();
    reported(1, AREAS);
    recorded({ can_now: [], findings: [] });

    assert.deepStrictEqual([refusedBrief(['test-surface', UNIT, '--base', 'main']), refusedBrief(['test-surface', 'solo', '--base', 'main'])], [
      `${UNIT}'s review phase passed in round 1 — finish is next`,
      'no repository of the project holds solo\'s change — nothing of it has landed, and no task of it is done',
    ]);
  });
});

describe('the templates', () => {
  it('14.3.1: the area review\'s floor is guidance in its template — a finding names the failure it prevents — and the call, the report and its rules are the phase review\'s word for word, as are the test surface\'s', () => {
    const tail = (/** @type {string} */ text) => text.slice(text.indexOf('# Each finding\'s call'));
    const area = template('review-area');

    for (const rule of [
      'A finding names the failure it prevents: what goes wrong, for whom, and how it would be noticed. One that cannot is not written.',
      'the unit\'s calls read whole: a call fine alone and wrong in combination with another is a finding;',
      'A scenario its runs leave "not proven", or "named, not run", at the change\'s tips is a finding, and reads so in your report, in those words.',
    ]) assert.ok(area.includes(rule), rule);
    assert.deepStrictEqual([tail(area), tail(template('test-surface'))], [tail(template('phase-review')), tail(template('phase-review'))]);
  });
});

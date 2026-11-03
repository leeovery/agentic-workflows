'use strict';

// ---------------------------------------------------------------------------
// The review phase's entry (leeway-engine/scripts/domain/review-entry.cjs,
// its records review-phase.cjs): `engine enter review <unit>`. What it
// refuses, naming the way on and writing nothing — what the build's entry
// refuses, and a build whose cut has a phase not closed, each such phase
// named (14.6.1); another session holding the checkout's code stopped at the
// build's code gate, nothing written, `--take` entering (12.7.8, 12.S50);
// the snapshot of the working tree outside `.leeway/` taken at every entry
// (14.1.5); and the answer: the round under review, the spec's areas, never
// merged, a one-area spec's one (14.2.1, 14.2.3), the areas the round reads
// and the test surface — every area at round 1, then those whose findings
// made fix tasks (14.3.3) — the fix tasks the round waits on, each round's
// report, the spec, the record and the build's log; and, once a round ends
// the review phase, that it is over.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const {
  UNIT, ENGINE, AREAS, RECEIPT, useWorld, env, enter, reported, recorded, firstRoundReady, fixBuilt, data,
  ok, okSections, refusedPristine, statePath, git, stateGit, assert,
} = require('./review-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

// A process that runs and is not this suite's.
const PEER = String(process.ppid);

/** An entry that must refuse, writing nothing: its error. @param {string[]} args */
const refused = (args) => refusedPristine(dir, ['enter', 'review', ...args], { env: env() }).error;

/** The snapshot of the working tree, as the entry wrote it, or null. */
function snapshot() {
  const file = statePath(dir, '.cache', UNIT, 'review', 'tree.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** The lines every answer while the review goes on ends with: the spec, the record and the build's log. */
const readsAfter = () => [
  `spec: ${statePath(dir, `${UNIT}/spec.md`)}`,
  `record: \`${ENGINE} ledger record ${UNIT}\``,
  `build log: ${statePath(dir, `${UNIT}/build/log.md`)}`,
];

/** The areas' lines, each by its name and its title. */
const AREA_LINES = ['area: 1-cards — §1 Cards', 'area: 2-refunds — §2 Refunds'];

/** Round 1 recorded failing, area 1's finding fixed by task 3.1, not yet built. */
function firstRoundFailed() {
  firstRoundReady();
  recorded({ can_now: ['Pay by card.'], findings: [RECEIPT] });
}

describe('enter review: what cannot be entered is refused, naming the way on, and nothing is written', () => {
  it('a build whose cut has a phase not closed, naming it or each of them, and what the build\'s entry refuses — a quick-fix, a unit built under the old plan, a build not begun — and a topic named (14.6.1)', () => {
    assert.deepStrictEqual([refused(['half']), refused(['open']), refused(['tweak']), refused(['old']), refused(['fresh']), refused([UNIT, 'cards'])], [
      'half\'s review phase starts once every phase of its cut has closed — phase 2 of 2 has not: enter implementation half',
      'open\'s review phase starts once every phase of its cut has closed — phases 1, 2 of 2 have not: enter implementation open',
      'tweak is a quick-fix, whose delivery is built with the reshape\'s 29.15 — until then a quick-fix stops at its scoping',
      'old was built under the old plan, and its build is entered once the reshape\'s 29.17 migration has cut it',
      'fresh\'s build has not begun — ready to build\'s yes begins it: render ready-to-build fresh',
      `review is entered at the work unit — name no topic: engine enter review ${UNIT}`,
    ]);
  });
});

describe('another session holding the checkout\'s code (12.7.8)', () => {
  it('12.S50: stops at the code gate alone, naming the session building another unit and when it was last active, writing nothing and taking no snapshot; yes is the entry again with --take, which enters', () => {
    okSections(dir, ['presence', 'beat', 'half', 'implementation', 'half'], { env: { ...env('peer'), CLAUDE_PID: PEER } });
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const { res, sections } = enter();

    assert.deepStrictEqual(res, { ok: true, phase: 'review', unit: UNIT, entered: false });
    assert.match(sections, /^=== DISPLAY: code gate .*\n⚑ Another session is implementing "Half" \(half\) — last active \d+s ago\.\n/);
    assert.match(sections, /=== MENU: code gate /);
    assert.doesNotMatch(sections, /=== DATA/);
    assert.deepStrictEqual([stateGit(dir, ['rev-parse', 'HEAD']).trim(), snapshot()], [head, null]);
    const { next } = ok(dir, ['gate', 'code gate', '--pick', 'y'], { env: env() });
    assert.deepStrictEqual(next, { kind: 'engine', argv: ['enter', 'review', UNIT, '--take'] });
    assert.strictEqual(enter(next.argv.slice(2)).res.entered, true);
    assert.notStrictEqual(snapshot(), null);
  });
});

describe('the snapshot of the working tree outside .leeway/ (14.1.5)', () => {
  it('holds each repository\'s HEAD and each path its status lists, with the fingerprint of what it holds, taken afresh at every entry', () => {
    enter();
    const clean = snapshot();
    fs.writeFileSync(`${dir}/src/card.js`, 'export const card = 2;\n');
    enter();

    assert.deepStrictEqual(clean, { heads: { '.': git(dir, ['rev-parse', 'HEAD']).trim() }, paths: {} });
    assert.deepStrictEqual(Object.keys(snapshot().paths), ['src/card.js']);
    assert.match(snapshot().paths['src/card.js'], /^ M [0-9a-f]{12}$/);
  });
});

describe('the answer: the round under review, the spec\'s areas, and what the round reads', () => {
  it('14.S2: round 1 answers each of the spec\'s areas, never merged, and reads every one of them beside the test surface — committing nothing', () => {
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const { res, sections } = enter();

    assert.deepStrictEqual(res, { ok: true, phase: 'review', unit: UNIT, entered: true, started: false });
    assert.strictEqual(sections, data(['round: round 1', ...AREA_LINES, 'reads: 1-cards, 2-refunds, the test surface (tests)', ...readsAfter()]));
    assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']).trim(), head);
  });

  it('a one-area spec answers its one area', () => {
    const { sections } = okSections(dir, ['enter', 'review', 'solo'], { env: env() });

    assert.deepStrictEqual(sections.split('\n').filter((line) => /^(area|reads): /.test(line)), ['area: 1-cards — §1 Cards', 'reads: 1-cards, the test surface (tests)']);
  });

  it('14.S3: after a round whose findings made fix tasks, the next reads only the areas those findings are of, and waits on each fix task until it is done', () => {
    firstRoundFailed();
    const waiting = enter().sections;
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    const report = `round report: ${statePath(dir, `${UNIT}/review/round-1.md`)}`;

    assert.strictEqual(waiting, data(['round: round 2', ...AREA_LINES, 'reads: 1-cards, the test surface (tests)', 'fix task waiting: 3.1 not started', report, ...readsAfter()]));
    assert.strictEqual(enter().sections, data(['round: round 2', ...AREA_LINES, 'reads: 1-cards, the test surface (tests)', report, ...readsAfter()]));
  });

  it('once a round passes with no fix task, the review phase is over, finish next, and nothing is read', () => {
    enter();
    reported(1, AREAS);
    recorded({ can_now: ['Pay by card.'], findings: [] });

    assert.strictEqual(enter().sections, data([
      'round: the review phase passed in round 1 — finish is next', ...AREA_LINES, `round report: ${statePath(dir, `${UNIT}/review/round-1.md`)}`, ...readsAfter(),
    ]));
  });
});

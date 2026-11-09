'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's review, asked for at its close (19.5.7, 19.5.13, 19.5.14,
// 19.S23): `engine review ask <qf>` (leeway-engine/scripts/domain/
// review-verbs.cjs), the close's `r/review` row — the request recorded and
// committed, the review phase's entry its `next`, asked again `already` —
// refused for a unit that is no quick-fix and while the close does not
// stand; `engine enter review <qf>` (domain/review-entry.cjs), refused
// until it is asked for, then one area, the change, its record and its
// change-set from the base (domain/review-phase.cjs, domain/review-change.cjs);
// the area pair's and the test surface's briefs held against the quick-fix's
// record and its fixes' acceptance in their own words, never a spec
// (domain/brief-records.cjs, domain/fix-acceptance.cjs, 19.5.24); the review
// run — a fix task of its round built on the quick-fix's one branch through
// the door, a later round passing and handing back to the close, whose
// checklist then carries the review passed and whose yes lands the fixes
// and the fix task in one commit (19.5.15); `land finish` refused while the
// review asked for has not passed; and a merge by hand of the fixes leaving
// the review's fix task still to land, the close's yes saying it merges.
//
// Layer: git. World: quick-fix-world.cjs's `twoFixesBuilt`, the fixes then
// recorded and finish's checklist closed — the close reached — built once
// and copied. Each test's conversation keeps its records in a config
// folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, okSections, output, refusedPristine, sectionOf, git, statePath, layout, writeState, readManifest, fixtureFrom, cleanupFixture, createFile, head, lastMessage,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const {
  UNIT, BRANCH, DESCRIPTION, twoFixesBuilt, fixesRecorded, createFix, fixFile, asGone,
} = require('./quick-fix-world.cjs');
const { reportText } = require('./review-world.cjs');
const { filledTemplate, scratchCalls, ENGINE_DRAWN } = require('./brief-build-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { briefPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));

/** The quick-fix's one area, by its name in the layout. */
const AREA = '1-the-change';
/** The finding round 1's first reader of the change makes, and the fix task 2.1 that fixes it. */
const FOUND = Object.freeze({ area: AREA, scope: 'in', call: 'bug', text: 'The docs still say --color.', from: [`${AREA}-a#1`], fix: '2.1' });

const world = fixtureFrom('quick-fix-review-', (dir) => {
  twoFixesBuilt(dir);
  asGone((as) => fixesRecorded(dir, 2, as));
});

let dir = ''; // the project
const config = useTempFolder('quick-fix-review-config-');

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options. */
const as = () => ({ env: { LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

/** A call that must succeed, in this test's conversation. @param {string[]} args */
const run = (args) => ok(dir, args, as());

/** A call's refusal, nothing written or committed. @param {string[]} args */
const refused = (args) => refusedPristine(dir, args, as()).error;

/** A payload file beside the project, outside its working tree. @param {string} name @param {unknown} content */
function payload(name, content) {
  const file = path.join(path.dirname(dir), name);
  fs.writeFileSync(file, JSON.stringify(content));
  return file;
}

/** The DATA lines `enter review` answers, each by its key. */
const entered = () => sectionOf(okSections(dir, ['enter', 'review', UNIT], as()).sections, 'DATA').split('\n').filter(Boolean);

/** Every report a round's reads ask for written, each passing but those `found` gives findings. @param {number} round @param {string[]} reads @param {Record<string, string[]>} [found] */
function reported(round, reads, found = {}) {
  for (const name of reads.flatMap((read) => (read === 'tests' ? ['tests-a'] : [`${read}-a`, `${read}-b`]))) {
    writeState(dir, layout.unit(UNIT, 'review', `round-${round}`, `${name}.md`), reportText(found[name] ?? []));
  }
}

/** A brief issued in this conversation: its answer and its text. @param {string[]} args */
function issued(args) {
  const res = run(['brief', ...args]);
  return { res, brief: fs.readFileSync(path.join(config(), 'conversations', 'sess-1', 'briefs', path.basename(briefPath('sess-1', res.id))), 'utf8') };
}

/** Round 1 recorded failing on the docs, its fix task 2.1 written in the review's first fix phase. */
function firstRoundFailed() {
  run(['review', 'ask', UNIT]);
  entered();
  reported(1, [AREA, 'tests'], { [`${AREA}-a`]: [`bug: ${FOUND.text}`] });
  run(['task', 'phase', UNIT, '2', '--title', 'The review\'s fixes, round 1']);
  run(['task', 'create', UNIT, '2', '--file', writeState(dir, layout.cache('review-fix.md'), fixFile(1, 'Name the flag in the docs').replace('- 1.S1 ', '- '))]);
  run(['review', 'round', UNIT, '--file', payload('round-1.json', { can_now: ['Pass --colour.'], findings: [FOUND] })]);
}

/** Fix task 2.1 built as a fix is: started, its change committed through the door, pushed to the quick-fix's pull request and done. */
function fixTaskBuilt() {
  run(['task', 'start', UNIT, '2.1']);
  createFile(dir, 'docs/flag.md', '--colour\n');
  run(['commit', '--paths', 'docs/flag.md', '--task', UNIT, '2.1', '-m', `fix(${UNIT}): name the flag in the docs`]);
  run(['land', 'open', UNIT, '2.1']);
  run(['task', 'done', UNIT, '2.1']);
}

/** Round 2 entered, its reads named, every report passing, and recorded: its answer. */
function secondRoundPassed() {
  entered();
  run(['review', 'reads', UNIT, AREA, 'tests']);
  reported(2, [AREA, 'tests']);
  return run(['review', 'round', UNIT, '--file', payload('round-2.json', { can_now: ['Pass --colour, and read it in the docs.'], findings: [] })]);
}

/** The close's gate as drawn. */
const closeMenu = () => sectionOf(output(dir, ['render', 'finish', UNIT], as()), 'MENU: finish');

describe('review ask <quick-fix>: a review asked for at its close (19.5.13)', () => {
  it('is the close\'s r/review row: the request recorded on the manifest and committed, the review phase\'s entry next; asked again, already, writing nothing', () => {
    dir = world();
    closeMenu();
    const row = run(['gate', 'finish', '--pick', 'r']).next;
    const asked = run(['review', 'ask', UNIT]);
    const [state, message] = [head(dir), lastMessage(dir)];
    const again = run(['review', 'ask', UNIT]);
    const next = { kind: 'engine', argv: ['enter', 'review', UNIT] };

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
      `review ask: ${UNIT} closes once each of its fixes has ended — 1.3 is not started: each is done once it is committed and in ${UNIT}'s pull request, or closed with its reason`,
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
});

describe('the review\'s briefs for a quick-fix: its record and its fixes\' acceptance, never a spec (19.5.14, 19.5.24)', () => {
  const noSpec = `${UNIT} is a quick-fix, which has no spec: its fixes' acceptance, in their own words, stands for one.`;
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
      linters: 'None recorded.',
      'area-report-to': `\`${statePath(dir, layout.unit(UNIT, 'review', 'round-1', `${AREA}-a.md`))}\``,
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
      linters: 'None recorded.',
      'tests-report-to': `\`${statePath(dir, layout.unit(UNIT, 'review', 'round-1', 'tests-a.md'))}\``,
    })}`);
  });
});

describe('19.S23: the review asked for runs over the quick-fix\'s record and its change-set, and the close is still its finish gate', () => {
  it('a round\'s fix task built on the quick-fix\'s branch through the door; the round that passes hands back to the close, its checklist carrying the review passed, its yes landing the fixes and the fix task in one commit', () => {
    dir = world();
    firstRoundFailed();
    const reviewing = refused(['render', 'finish', UNIT]);
    const landing = refused(['land', 'finish', UNIT]);
    fixTaskBuilt();
    const passed = secondRoundPassed();
    const review = run(['checklist', 'show', 'finish', UNIT]).items.find((/** @type {{key: string}} */ { key }) => key === 'review-passed');
    const menu = closeMenu();
    const main = git(dir, ['rev-parse', 'main']).trim();
    const closed = run(['finish', 'yes', UNIT]);

    assert.deepStrictEqual([reviewing, landing], [
      `render finish: finish has items open since its close: review-passed — they are worked, and it is closed again`,
      `land: ${UNIT} lands at finish once its review phase is over — ${UNIT}'s review phase is in round 2 — enter review ${UNIT}`,
    ]);
    assert.deepStrictEqual([passed.ends, passed.next, review.state], [true, { kind: 'engine', argv: ['render', 'finish', UNIT] }, 'done']);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(statePath(dir, layout.unit(UNIT, 'review', 'round-1.json')), 'utf8')).scenarios.map((/** @type {{scenario: string}} */ { scenario }) => scenario), ['1.S1', '2.S1']);
    assert.deepStrictEqual(menu.split('\n').filter((line) => line.startsWith('**')).slice(1), [
      '**`y/yes`** → Close it — merge its pull request and mark it complete',
      '**Ask**   → Ask about the change before it closes',
    ]);
    assert.deepStrictEqual([closed.landed.map((/** @type {{merged: string[]}} */ { merged }) => merged), git(dir, ['log', '-1', '--format=%B', 'main']).match(/^Task: .*$/gm), git(dir, ['rev-list', '--count', `${main}..main`]).trim()], [
      [['1.1', '1.2', '2.1']], [`Task: ${UNIT}-1-1`, `Task: ${UNIT}-1-2`, `Task: ${UNIT}-2-1`], '1',
    ]);
  });

  it('a round that passes with a nit to fix hands back to nothing while its fix task waits', () => {
    dir = world();
    firstRoundFailed();
    fixTaskBuilt();
    entered();
    run(['review', 'reads', UNIT, AREA, 'tests']);
    reported(2, [AREA, 'tests'], { [`${AREA}-a`]: ['nit: The help could name the flag twice.'] });
    run(['task', 'phase', UNIT, '3', '--title', 'The review\'s fixes, round 2']);
    run(['task', 'create', UNIT, '3', '--file', writeState(dir, layout.cache('review-nit.md'), fixFile(1, 'Name the flag twice').replace('- 1.S1 ', '- '))]);
    const nit = { area: AREA, scope: 'in', call: 'nit', text: 'The help could name the flag twice.', from: [`${AREA}-a#1`], fix: '3.1' };
    const passed = run(['review', 'round', UNIT, '--file', payload('round-2.json', { can_now: ['Pass --colour.'], findings: [nit] })]);

    assert.deepStrictEqual([passed.passed, passed.ends, passed.next], [true, true, undefined]);
  });

  it('a merge by hand of the fixes before the review\'s fix task lands leaves the close\'s yes merging its pull request, the fix task still to land', () => {
    dir = world();
    git(dir, ['switch', '-q', 'main']);
    git(dir, ['merge', '-q', '--squash', BRANCH]);
    git(dir, ['commit', '-q', '-m', 'Spell it the British way']);
    git(dir, ['switch', '-q', BRANCH]);
    firstRoundFailed();
    fixTaskBuilt();
    secondRoundPassed();

    assert.strictEqual(closeMenu().split('\n').find((line) => line.startsWith('**`y/yes`**')), '**`y/yes`** → Close it — merge its pull request and mark it complete');
  });
});

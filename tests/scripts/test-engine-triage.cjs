'use strict';

// ---------------------------------------------------------------------------
// Triage and the archived items (leeway-engine/scripts/domain/projections/
// triage.cjs, read through inbox-set.cjs; 18.7): `render triage`, the inbox
// by kind, each item numbered with its age, asking which items before a
// pick (18.7.3, 18.7.12) and, over Claude's pick, what is picked and what
// fits with it, with the rows that act on it (18.7.4, 18.7.10); `render
// archived`, each item with how it left the inbox (18.7.11, 18.6.10);
// `render archived-item` and the delete's confirm, a pick standing in triage
// carried down them; the restore, taking its closer's claim out of the
// build's log, and the restore's and the delete's receipts; and where each
// row leads, followed through the inbox verb it names, with no confirm on an
// archive (18.7.13). Triage's help (23.S5). The frame and the help screen are test-engine-menus.cjs's; the
// inbox verbs' own transactions their suites'.
//
// Layer: verb, each render run as the start skill runs it, in a conversation
// of the test's own, the clock frozen where an age is read, and the
// transactions its rows lead to. World: this file's own, built once and
// copied for each test — an inbox of each kind dated from the frozen clock,
// and an archive whose items left it each way, committed on the state
// branch on days of their own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { ok, output, refuses, screenOf, sectionOf, commitAll, stateGit, cleanupFixture, fixtureFrom } = require('./engine-harness.cjs');
const { createManifest, writeState, readState, statePath, layout } = require('./discovery-test-utils.cjs');
const { withFrozenClock } = require('./frozen-clock.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { SHOWN } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const { projectName } = require(path.join(SCRIPTS, 'domain/state-checks.cjs'));

const SESSION = 'triage-session';
const ENV = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION });

// The inbox, dated from the frozen clock's day, 2026-01-01.
const IDEA_NEW = layout.inbox('ideas', '2025-12-29--session-previews.md');
const IDEA_OLDER = layout.inbox('ideas', '2025-12-20--group-sessions.md');
const IDEA_OLDEST = layout.inbox('ideas', '2025-11-27--rename-from-picker.md');
const BUG_NEW = layout.inbox('bugs', '2025-12-30--preview-flickers.md');
const BUG_OLDER = layout.inbox('bugs', '2025-12-23--window-names-lost.md');
const QUICK_FIX = layout.inbox('quickfixes', '2025-12-25--border-off-by-one.md');

// The archive, each item leaving it a way of its own, in an order its file
// names' dates do not keep — two closed on one day, the later file first.
// The unit's build log claims three of them.
const UNIT = 'enter-attaches-from-preview';
const ARCHIVED_OCT = layout.archived('ideas', '2025-09-06--tab-completion.md');
const CLOSED_BY_UNIT = layout.archived('ideas', '2025-09-02--enter-should-attach.md');
const CLOSED_BY_NONE = layout.archived('quickfixes', '2025-09-03--prefs-reset.md');
const CLOSED_BY_GONE = layout.archived('bugs', '2025-09-04--resize-jitter.md');
const ARCHIVED_SEP = layout.archived('bugs', '2025-08-01--hidden-sessions-flash.md');
const BUILD_LOG = layout.unit(UNIT, 'build', 'log.md');
const LOG_TEXT = [
  '# The build',
  '',
  'Resolved: .leeway/.inbox/ideas/2025-09-02--enter-should-attach.md',
  'Resolved: .leeway/.inbox/quickfixes/2025-09-03--prefs-reset.md',
  'Resolved: .leeway/.inbox/ideas/2025-09-06--tab-completion.md',
  'Enter in the preview attaches.',
  '',
].join('\n');

/** Commit the state's changes on a day of their own. @param {string} dir @param {string} day `YYYY-MM-DD` */
function committedOn(dir, day) {
  const at = `${day}T12:00:00Z`;
  const git = (/** @type {string[]} */ args) => {
    const res = spawnSync('git', args, { cwd: statePath(dir), encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: at, GIT_COMMITTER_DATE: at } });
    assert.strictEqual(res.status, 0, res.stderr);
  };
  git(['add', '-A']);
  git(['commit', '-q', '-m', `archive on ${day}`]);
}

const world = fixtureFrom('leeway-triage-', (dir) => {
  writeState(dir, IDEA_NEW, '# Session Previews Show The Last Command\n');
  writeState(dir, IDEA_OLDER, '# Group Sessions By Project In The Picker\n');
  writeState(dir, IDEA_OLDEST, '# Rename A Session From The Picker\n');
  writeState(dir, BUG_NEW, '# Preview Flickers When A Session Closes\n');
  writeState(dir, BUG_OLDER, '# Window Names Lost On Restore\n');
  writeState(dir, QUICK_FIX, '# Preview Border Off By One At 80 Columns\n');
  createManifest(dir, UNIT, { status: 'completed' });
  writeState(dir, BUILD_LOG, LOG_TEXT);
  commitAll(dir, 'the inbox');
  writeState(dir, ARCHIVED_SEP, '# Hidden Sessions Flash On Startup\n');
  committedOn(dir, '2025-09-18');
  writeState(dir, ARCHIVED_OCT, '# Tab Completion For Session Names\n');
  committedOn(dir, '2025-10-03');
  writeState(dir, CLOSED_BY_UNIT, '# Enter In The Preview Should Attach\n');
  writeState(dir, CLOSED_BY_NONE, '# Preferences Reset On Upgrade\n');
  writeState(dir, CLOSED_BY_GONE, '# Resize *Jitters* [twice]\n');
  const project = JSON.parse(readState(dir, 'manifest.json'));
  writeState(dir, 'manifest.json', JSON.stringify({
    ...project,
    inbox_closed: {
      'ideas/2025-09-02--enter-should-attach.md': { unit: UNIT, at: '2025-09-25T10:00:00Z' },
      'quickfixes/2025-09-03--prefs-reset.md': { unit: null, at: '2025-09-20T10:00:00Z' },
      'bugs/2025-09-04--resize-jitter.md': { unit: 'split-panes', at: '2025-09-20T15:00:00Z' },
    },
  }, null, 2));
  committedOn(dir, '2025-10-04');
});

/** An inbox path as the engine answers it, absolute. @param {string} dir @param {string} rel */
const at = (dir, rel) => statePath(dir, rel);

/**
 * A render drawn in the test's conversation, the clock frozen: its output,
 * its MENU under the rule as it reads, and each row of the gate it states
 * with where it leads.
 * @param {string} dir @param {string[]} args @param {string} gate
 */
function drawn(dir, args, gate) {
  const out = withFrozenClock(() => output(dir, ['render', ...args], { env: ENV }));
  const shown = JSON.parse(fs.readFileSync(path.join(/** @type {string} */ (process.env.LEEWAY_CONFIG_DIR), 'conversations', SESSION, SHOWN), 'utf8'));
  return {
    out,
    screen: screenOf(out, `MENU: ${gate}`),
    rows: /** @type {Record<string, any>} */ (Object.fromEntries([...shown.options, ...shown.typed].map((/** @type {{key: string, next: unknown}} */ { key, next }) => [key, next]))),
  };
}

/** Claude's pick, written where the render reads it. @param {string} dir @param {string[]} picked @param {string[]} fits */
function pickFile(dir, picked, fits) {
  return writeState(dir, '.cache/triage.json', JSON.stringify({ picked: picked.map((rel) => at(dir, rel)), fits: fits.map((rel) => at(dir, rel)) }));
}

/** Triage over a pick. @param {string} dir @param {string[]} picked @param {string[]} [fits] */
const triagePicked = (dir, picked, fits = []) => drawn(dir, ['triage', '--file', pickFile(dir, picked, fits)], 'triage');

const INBOX_TREE = [
  'IDEAS (3)',
  '  ├─ 1. Session Previews Show The Last Command      [3 days]',
  '  ├─ 2. Group Sessions By Project In The Picker    [12 days]',
  '  └─ 3. Rename A Session From The Picker           [5 weeks]',
  '',
  'BUGS (2)',
  '  ├─ 4. Preview Flickers When A Session Closes      [2 days]',
  '  └─ 5. Window Names Lost On Restore                [9 days]',
  '',
  'QUICK-FIXES (1)',
  '  └─ 6. Preview Border Off By One At 80 Columns     [7 days]',
];

describe('triage (18.7)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(dir));

  it('18.S26, 18.7.3, 18.7.12: triage opens on the inbox by kind, numbered across the kinds, the newest first, each with its age from its file name\'s date; it asks which items, with Pick, view while the archive holds items, help and back', () => {
    const { out, screen, rows } = drawn(dir, ['triage'], 'triage');

    assert.deepStrictEqual([sectionOf(out, 'TITLE'), sectionOf(out, 'DISPLAY: triage').trimEnd().split('\n')], [`# **\`■ Triage · ${projectName(dir)}\`**\n`, INBOX_TREE]);
    assert.deepStrictEqual(sectionOf(out, 'DATA').trimEnd().split('\n'), [IDEA_NEW, IDEA_OLDER, IDEA_OLDEST, BUG_NEW, BUG_OLDER, QUICK_FIX].map((rel, i) => `item ${i + 1}: ${at(dir, rel)}`));
    assert.deepStrictEqual(screen, [
      '· · · · · · · · · · · ·',
      '◆ Which items?',
      '',
      'v/view → View the archived items, to restore or delete one',
      'h/help → What this menu is for, row by row',
      'b/back → Back to the start menu, nothing changed',
      'Pick   → Name the items by number',
    ]);
    assert.deepStrictEqual([rows.v, rows.b, rows.pick], [
      { kind: 'engine', argv: ['render', 'archived'] },
      { kind: 'engine', argv: ['render', 'start-menu'] },
      { kind: 'continue' },
    ]);
  });

  it('18.S27, 18.7.4, 18.7.10: one bug picked — the inbox, then PICKED and what fits with it, by Claude\'s read; then work, roadmap, archive, change, view, help and back, each saying "it"', () => {
    const { out, screen, rows } = triagePicked(dir, [BUG_NEW], [QUICK_FIX, IDEA_NEW]);

    assert.deepStrictEqual(sectionOf(out, 'DISPLAY: triage').trimEnd().split('\n'), [
      ...INBOX_TREE,
      '',
      'PICKED (1)',
      '  └─ 4. Preview Flickers When A Session Closes',
      '',
      'FITS WITH IT, BY MY READ (2)',
      '  ├─ 1. Session Previews Show The Last Command',
      '  └─ 6. Preview Border Off By One At 80 Columns',
    ]);
    assert.deepStrictEqual(screen, [
      '· · · · · · · · · · · ·',
      '◆ What would you like to do with what\'s picked?',
      '',
      'w/work    → Work on it now — discovery finds what kind of work it',
      '            is',
      'r/roadmap → Put it on the roadmap, on a horizon you name',
      'a/archive → Archive it',
      'c/change  → Change what\'s picked — I\'ll ask which items',
      'v/view    → View the archived items, to restore or delete one',
      'h/help    → What this menu is for, row by row',
      'b/back    → Back to the start menu, nothing changed',
    ]);
    assert.deepStrictEqual([rows.r, rows.c, rows.h], [
      { kind: 'continue' },
      { kind: 'continue' },
      { kind: 'engine', argv: ['render', 'help', 'triage', '--file', pickFile(dir, [BUG_NEW], [QUICK_FIX, IDEA_NEW])] },
    ]);
  });

  it('18.S28, 18.S49, 18.7.6: several picked are worked as one — w hands them to discovery as its seeds, with no type, which discovery finds — and the rows say "them"', () => {
    const { out, screen, rows } = triagePicked(dir, [BUG_OLDER, IDEA_OLDER]);

    assert.doesNotMatch(sectionOf(out, 'DISPLAY: triage'), /FITS WITH/, 'nothing fits where Claude names nothing');
    assert.deepStrictEqual(screen.slice(3, 7), [
      'w/work    → Work on them now, as one piece of work — discovery',
      '            finds what kind of work it is',
      'r/roadmap → Put them on the roadmap, on a horizon you name',
      'a/archive → Archive them',
    ]);
    assert.deepStrictEqual(rows.w, { kind: 'handoff', skill: 'leeway-discovery', args: ['start', 'none', `${at(dir, IDEA_OLDER)},${at(dir, BUG_OLDER)}`] });
    assert.match(output(dir, ['handoff', `/${rows.w.skill}`, ...rows.w.args]), new RegExp(`^args: start none "${at(dir, IDEA_OLDER)},`, 'm'), 'the handoff takes the seeds as the row gives them');
    assert.match(sectionOf(triagePicked(dir, [BUG_OLDER, IDEA_OLDER], [QUICK_FIX]).out, 'DISPLAY: triage'), /^FITS WITH THEM, BY MY READ \(1\)$/m);
  });

  it('18.S30, 18.S79, 18.7.13: a archives what is picked with no confirm, and triage drawn again lists it no more; b leaves triage with nothing changed', () => {
    const { rows } = triagePicked(dir, [IDEA_NEW, BUG_NEW]);
    const head = stateGit(dir, ['rev-parse', 'HEAD']);

    assert.deepStrictEqual(ok(dir, ['gate', 'triage', '--pick', 'b'], { env: ENV }).next, { kind: 'engine', argv: ['render', 'start-menu'] });
    assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']), head, 'back changes nothing');
    assert.deepStrictEqual(rows.a, { kind: 'engine', argv: ['inbox', 'archive', at(dir, IDEA_NEW), at(dir, BUG_NEW)] });
    assert.deepStrictEqual(ok(dir, rows.a.argv).archived, [at(dir, layout.archived('ideas', '2025-12-29--session-previews.md')), at(dir, layout.archived('bugs', '2025-12-30--preview-flickers.md'))]);
    assert.deepStrictEqual(sectionOf(drawn(dir, ['triage'], 'triage').out, 'DISPLAY: triage').trimEnd().split('\n').filter((line) => line.includes('─')), [
      '  ├─ 1. Group Sessions By Project In The Picker    [12 days]',
      '  └─ 2. Rename A Session From The Picker           [5 weeks]',
      '  └─ 3. Window Names Lost On Restore                [9 days]',
      '  └─ 4. Preview Border Off By One At 80 Columns     [7 days]',
    ]);
  });

  it('the view row shows only while the archive holds an item; an empty inbox says so, with no pick to make', () => {
    for (const rel of [ARCHIVED_OCT, CLOSED_BY_UNIT, CLOSED_BY_NONE, CLOSED_BY_GONE, ARCHIVED_SEP]) fs.rmSync(at(dir, rel));
    assert.ok(!('v' in drawn(dir, ['triage'], 'triage').rows));
    for (const rel of [IDEA_NEW, IDEA_OLDER, IDEA_OLDEST, BUG_NEW, BUG_OLDER, QUICK_FIX]) fs.rmSync(at(dir, rel));
    const { out, screen } = drawn(dir, ['triage'], 'triage');

    assert.deepStrictEqual([out.includes('=== DATA'), out.includes('=== DISPLAY'), screen], [false, false, [
      '· · · · · · · · · · · ·',
      'Nothing is in the inbox.',
      '',
      '◆ What would you like to do?',
      '',
      'h/help → What this menu is for, row by row',
      'b/back → Back to the start menu, nothing changed',
    ]]);
  });

  it('18.7.3: an age reads today, then days under two weeks, weeks under nine, months — eleven at most — under a year, then years', () => {
    for (const rel of [IDEA_NEW, IDEA_OLDER, IDEA_OLDEST, BUG_NEW, BUG_OLDER, QUICK_FIX]) fs.rmSync(at(dir, rel));
    const AGES = [
      ['2026-01-01', 'today'], ['2025-12-19', '13 days'], ['2025-12-18', '2 weeks'], ['2025-10-31', '8 weeks'], ['2025-10-30', '2 months'],
      ['2025-10-03', '3 months'], ['2025-01-02', '11 months'], ['2025-01-01', '1 year'], ['2024-01-01', '2 years'],
    ];
    for (const [day] of AGES) writeState(dir, layout.inbox('ideas', `${day}--aged.md`), '# Aged\n');

    const tags = sectionOf(drawn(dir, ['triage'], 'triage').out, 'DISPLAY: triage').split('\n').flatMap((line) => /\[(.+)\]$/.exec(line)?.slice(1) ?? []);
    assert.deepStrictEqual(tags, AGES.map(([, age]) => age));
  });

  it('an item is a file named {date}--{slug}.md, titled by its first heading, its slug where it has none', () => {
    writeState(dir, layout.inbox('ideas', 'notes.md'), '# Not An Item\n');
    writeState(dir, IDEA_NEW, 'no heading here\n');

    const display = sectionOf(drawn(dir, ['triage'], 'triage').out, 'DISPLAY: triage');
    assert.match(display, /^ {2}├─ 1\. session-previews +\[3 days\]$/m);
    assert.doesNotMatch(display, /Not An Item/);
  });

  it('refuses a pick of another shape, nothing picked, a path not live in the inbox, and an item named twice', () => {
    /** @param {unknown} pick */
    const refused = (pick) => refuses(dir, ['render', 'triage', '--file', writeState(dir, '.cache/triage.json', JSON.stringify(pick))], { env: ENV }).error;

    assert.deepStrictEqual([
      refused({ picked: [at(dir, BUG_NEW)] }),
      refused({ picked: [], fits: [] }),
      refused({ picked: [at(dir, ARCHIVED_OCT)], fits: [] }),
      refused({ picked: [at(dir, layout.inbox('bugs', '2025-12-31--ghost.md'))], fits: [] }),
      refused({ picked: [at(dir, BUG_NEW)], fits: [at(dir, BUG_NEW)] }),
    ], [
      'render triage: the pick must be {picked, fits}',
      'render triage: nothing is picked — picked names an item at least',
      `render triage: not a live inbox path (expected ${at(dir, '.inbox/{ideas|bugs|quickfixes}/{file}.md')}): "${at(dir, ARCHIVED_OCT)}"`,
      `render triage: not in the live inbox: "${at(dir, layout.inbox('bugs', '2025-12-31--ghost.md'))}"`,
      'render triage: item 4 is named twice — each item is picked, fits with what is, or neither',
    ]);
  });

  it('23.S5: triage\'s help says what triage is, and what each row does', () => {
    const help = sectionOf(output(dir, ['render', 'help', 'triage'], { env: ENV }), 'DISPLAY: help');

    assert.match(help, /^Triage works through the inbox: the ideas, bugs and quick-fixes\s+noted down to come back to\./);
    assert.match(help, /· Roadmap puts what's picked on the roadmap, on a horizon you\s+name; I never pick one\./);
  });
});

describe('the archived items (18.7.11)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(dir));

  it('18.S80, 18.6.10: each item with how it left, the latest to leave first, by the time it left within a day — archived on the day the state branch took it in, closed by a unit by its title, its name where the unit is gone, closed with no unit on its day — each opening the item', () => {
    const { out, screen, rows } = drawn(dir, ['archived'], 'archived items');

    assert.strictEqual(sectionOf(out, 'TITLE'), '# **`■ Triage · Archived`**\n');
    assert.deepStrictEqual(screen, [
      '· · · · · · · · · · · ·',
      '◆ Which item?',
      '',
      '1      → Tab Completion For Session Names — idea, archived 3 Oct',
      '2      → Enter In The Preview Should Attach — idea, closed by',
      '         Enter Attaches From Preview',
      '3      → Resize \\Jitters\\ \\[twice\\] — bug, closed by Split Panes',
      '4      → Preferences Reset On Upgrade — quick-fix, closed 20 Sep',
      '5      → Hidden Sessions Flash On Startup — bug, archived 18 Sep',
      'h/help → What this menu is for, row by row',
      'b/back → Back to triage',
    ]);
    assert.deepStrictEqual([rows['2'], rows.b, sectionOf(out, 'DATA').split('\n')[1]], [
      { kind: 'engine', argv: ['render', 'archived-item', '--path', at(dir, CLOSED_BY_UNIT)] },
      { kind: 'engine', argv: ['render', 'triage'] },
      `item 2: ${at(dir, CLOSED_BY_UNIT)}`,
    ]);
  });

  it('18.7.11: an item picked — how it left, then unarchive and delete, and back to the archived items', () => {
    const { screen, rows } = drawn(dir, ['archived-item', '--path', at(dir, CLOSED_BY_UNIT)], 'archived item');

    assert.deepStrictEqual(screen, [
      '· · · · · · · · · · · ·',
      'Selected: Enter In The Preview Should Attach (idea, closed by',
      'Enter Attaches From Preview)',
      '',
      '◆ What would you like to do with it?',
      '',
      'u/unarchive → Restore it to the inbox',
      'd/delete    → Delete it for good — it can\'t be brought back',
      'h/help      → What this menu is for, row by row',
      'b/back      → Back to the archived items',
    ]);
    assert.deepStrictEqual([rows.u, rows.d, rows.b, rows.h], [
      { kind: 'engine', argv: ['inbox', 'restore', at(dir, CLOSED_BY_UNIT)] },
      { kind: 'engine', argv: ['render', 'archived-delete-gate', '--path', at(dir, CLOSED_BY_UNIT)] },
      { kind: 'engine', argv: ['render', 'archived'] },
      { kind: 'engine', argv: ['render', 'help', 'archived-item', '--path', at(dir, CLOSED_BY_UNIT)] },
    ]);
  });

  it('18.S48: a wrong closure restored through unarchive is live again, its record of the close gone and its claim out of the closing unit\'s build log in the same commit, and its receipt says both', () => {
    const { rows } = drawn(dir, ['archived-item', '--path', at(dir, CLOSED_BY_UNIT)], 'archived item');
    const { restored, unclaimed } = ok(dir, rows.u.argv);
    const live = at(dir, layout.inbox('ideas', '2025-09-02--enter-should-attach.md'));

    assert.deepStrictEqual([restored, unclaimed, Object.keys(JSON.parse(readState(dir, 'manifest.json')).inbox_closed)], [
      [live],
      [{ path: live, unit: UNIT }],
      ['quickfixes/2025-09-03--prefs-reset.md', 'bugs/2025-09-04--resize-jitter.md'],
    ]);
    assert.strictEqual(readState(dir, BUILD_LOG), LOG_TEXT.replace('Resolved: .leeway/.inbox/ideas/2025-09-02--enter-should-attach.md\n', ''), 'its claim alone comes out');
    assert.ok(stateGit(dir, ['show', '--name-only', '--format=', 'HEAD']).split('\n').includes(BUILD_LOG), 'the restore commits the log with the move');
    assert.strictEqual(sectionOf(output(dir, ['render', 'inbox-restore-receipt', '--path', live, '--unclaimed', UNIT]), 'DISPLAY: confirmation'),
      'Restored "Enter In The Preview Should Attach" to the inbox, its Resolved: line taken out of Enter Attaches From Preview\'s build log.\n');
  });

  it('a restore of an item no unit closed — closed by none, or archived from triage — touches no build log, and the receipt refuses a unit whose log claims the item still', () => {
    const { restored, unclaimed } = ok(dir, ['inbox', 'restore', at(dir, CLOSED_BY_NONE), at(dir, ARCHIVED_OCT)]);

    assert.deepStrictEqual([restored.length, unclaimed, readState(dir, BUILD_LOG)], [2, undefined, LOG_TEXT]);
    assert.strictEqual(refuses(dir, ['render', 'inbox-restore-receipt', '--path', restored[0], '--unclaimed', UNIT]).error,
      `render inbox-restore-receipt: ${UNIT}'s build log claims it still — the restore has not taken its Resolved: line out`);
  });

  it('18.S48: the delete is confirmed first — its no the item again, its yes the item gone from the archive for good, and its receipt names it', () => {
    const { rows } = drawn(dir, ['archived-item', '--path', at(dir, ARCHIVED_OCT)], 'archived item');
    const { screen, rows: gate } = drawn(dir, rows.d.argv.slice(1), 'archived delete gate');

    assert.deepStrictEqual(screen, [
      '· · · · · · · · · · · ·',
      'Deleting "Tab Completion For Session Names" takes it out of the archive for good.',
      '',
      '◆ Delete it?',
      '',
      'y/yes → Delete it for good',
      'n/no  → Keep it in the archive',
    ]);
    assert.deepStrictEqual(gate.n, { kind: 'engine', argv: ['render', 'archived-item', '--path', at(dir, ARCHIVED_OCT)] });
    assert.deepStrictEqual(ok(dir, gate.y.argv).deleted, [at(dir, ARCHIVED_OCT)]);
    assert.ok(!fs.existsSync(at(dir, ARCHIVED_OCT)));
    assert.strictEqual(sectionOf(output(dir, ['render', 'inbox-delete-receipt', '--path', at(dir, ARCHIVED_OCT)]), 'DISPLAY: confirmation'), 'Deleted "Tab Completion For Session Names".\n');
  });

  it('an archive with nothing in it says so, under the frame\'s own question', () => {
    for (const rel of [ARCHIVED_OCT, CLOSED_BY_UNIT, CLOSED_BY_NONE, CLOSED_BY_GONE, ARCHIVED_SEP]) fs.rmSync(at(dir, rel));

    assert.deepStrictEqual(drawn(dir, ['archived'], 'archived items').screen.slice(0, 4), ['· · · · · · · · · · · ·', 'Nothing is archived.', '', '◆ What would you like to do?']);
  });

  it('the day an item was archived is the day the state branch last took it in — restored, then archived again later, it reads the later day', () => {
    const live = at(dir, layout.inbox('bugs', '2025-08-01--hidden-sessions-flash.md'));
    fs.renameSync(at(dir, ARCHIVED_SEP), live);
    committedOn(dir, '2025-10-20');
    fs.renameSync(live, at(dir, ARCHIVED_SEP));
    committedOn(dir, '2025-11-20');

    assert.strictEqual(drawn(dir, ['archived'], 'archived items').screen[3], '1      → Hidden Sessions Flash On Startup — bug, archived 20 Nov');
  });

  it('a pick standing in triage is carried down the archived items\' screens, so each back draws the screen before it as it was', () => {
    const file = pickFile(dir, [BUG_NEW], []);
    const view = triagePicked(dir, [BUG_NEW]).rows.v;
    const list = drawn(dir, view.argv.slice(1), 'archived items').rows;
    const item = drawn(dir, list['1'].argv.slice(1), 'archived item').rows;
    const gate = drawn(dir, item.d.argv.slice(1), 'archived delete gate').rows;

    assert.deepStrictEqual([view, list.b, item.b, gate.n], [
      { kind: 'engine', argv: ['render', 'archived', '--file', file] },
      { kind: 'engine', argv: ['render', 'triage', '--file', file] },
      { kind: 'engine', argv: ['render', 'archived', '--file', file] },
      { kind: 'engine', argv: ['render', 'archived-item', '--path', at(dir, ARCHIVED_OCT), '--file', file] },
    ]);
  });

  it('the item\'s screen and the delete\'s confirm refuse no path, a live path, and one the archive does not hold', () => {
    const ghost = at(dir, layout.archived('ideas', '2025-09-09--ghost.md'));
    for (const surface of ['archived-item', 'archived-delete-gate']) {
      assert.deepStrictEqual([
        refuses(dir, ['render', surface], { env: ENV }).error,
        refuses(dir, ['render', surface, '--path', at(dir, IDEA_NEW)], { env: ENV }).error,
        refuses(dir, ['render', surface, '--path', ghost], { env: ENV }).error,
      ], [
        `render ${surface}: --path is required — the archived item`,
        `render ${surface}: not an archived inbox path (expected ${at(dir, '.inbox/.archived/{ideas|bugs|quickfixes}/{file}.md')}): "${at(dir, IDEA_NEW)}"`,
        `render ${surface}: not in the archived store: "${ghost}"`,
      ]);
    }
  });
});

describe('the receipts after a restore or a delete', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(dir));

  /** @param {string} rel @param {string} text */
  const write = (rel, text) => writeState(dir, rel, text);
  const RECEIPT = '=== DISPLAY: confirmation (emit verbatim as a text code block (```text fence) after the response) ===';

  it('inbox-restore-receipt names the item back in the inbox by its own title — its slug where it has none', () => {
    write(IDEA_NEW, '---\nsource: chat\n---\n\n# Smart Retry\n');
    assert.strictEqual(output(dir, ['render', 'inbox-restore-receipt', '--path', at(dir, IDEA_NEW)]), `${RECEIPT}\nRestored "Smart Retry" to the inbox.\n`);
    write(IDEA_NEW, 'no heading here\n');
    assert.strictEqual(output(dir, ['render', 'inbox-restore-receipt', '--path', at(dir, IDEA_NEW)]), `${RECEIPT}\nRestored "session-previews" to the inbox.\n`);
  });

  it('inbox-restore-receipt refuses no path, an archived path, and a live path nothing sits at — the inbox is the state it receipts', () => {
    const ghost = at(dir, layout.inbox('ideas', '2025-12-31--ghost.md'));
    assert.deepStrictEqual([
      refuses(dir, ['render', 'inbox-restore-receipt']).error,
      refuses(dir, ['render', 'inbox-restore-receipt', '--path', at(dir, ARCHIVED_OCT)]).error,
      refuses(dir, ['render', 'inbox-restore-receipt', '--path', ghost]).error,
    ], [
      'render inbox-restore-receipt: --path is required — the live path `inbox restore` answered',
      `render inbox-restore-receipt: not a live inbox path (expected ${at(dir, '.inbox/{ideas|bugs|quickfixes}/{file}.md')}): "${at(dir, ARCHIVED_OCT)}"`,
      `render inbox-restore-receipt: not in the live inbox: "${ghost}"`,
    ]);
  });

  it('inbox-delete-receipt names the deleted item by the title git last held — the deleting commit\'s parent, however many commits sit above it', () => {
    stateGit(dir, ['rm', '-q', '--', at(dir, ARCHIVED_OCT)]);
    stateGit(dir, ['commit', '-q', '-m', 'delete']);
    write('notes.md', 'later work\n');
    commitAll(dir, 'later work');
    assert.strictEqual(output(dir, ['render', 'inbox-delete-receipt', '--path', at(dir, ARCHIVED_OCT)]), `${RECEIPT}\nDeleted "Tab Completion For Session Names".\n`);
  });

  it('inbox-delete-receipt reads HEAD while the deletion is only staged — a commit the delete could not land', () => {
    write(ARCHIVED_SEP, 'no heading here\n');
    commitAll(dir, 'reworded');
    stateGit(dir, ['rm', '-q', '--', at(dir, ARCHIVED_SEP)]);
    assert.strictEqual(output(dir, ['render', 'inbox-delete-receipt', '--path', at(dir, ARCHIVED_SEP)]), `${RECEIPT}\nDeleted "hidden-sessions-flash".\n`);
  });

  it('inbox-delete-receipt refuses no path, a live path, a path the archive still holds, and one git holds no copy of', () => {
    const ghost = at(dir, layout.archived('ideas', '2025-09-09--ghost.md'));
    assert.deepStrictEqual([
      refuses(dir, ['render', 'inbox-delete-receipt']).error,
      refuses(dir, ['render', 'inbox-delete-receipt', '--path', at(dir, IDEA_NEW)]).error,
      refuses(dir, ['render', 'inbox-delete-receipt', '--path', at(dir, ARCHIVED_OCT)]).error,
      refuses(dir, ['render', 'inbox-delete-receipt', '--path', ghost]).error,
    ], [
      'render inbox-delete-receipt: --path is required — the archived path `inbox delete` answered',
      `render inbox-delete-receipt: not an archived inbox path (expected ${at(dir, '.inbox/.archived/{ideas|bugs|quickfixes}/{file}.md')}): "${at(dir, IDEA_NEW)}"`,
      `render inbox-delete-receipt: still in the archived store, so nothing was deleted: "${at(dir, ARCHIVED_OCT)}"`,
      `render inbox-delete-receipt: git holds no deleted file at "${ghost}"`,
    ]);
  });
});

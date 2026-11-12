'use strict';

// ---------------------------------------------------------------------------
// Manage and the closed units (leeway-engine/scripts/domain/projections/
// manage.cjs; 18.3): `render manage`, every unit the project holds in the
// order it lists them, each opening its own; `render manage-unit`, the rows
// a unit's standing offers — pivot and absorb only to a feature before its
// spec, absorb only into an epic before its spec, cancel to any unit in
// progress through its confirm, reactivate to a cancelled one, nothing to a
// completed one (18.3.4–18.3.6, 8.8.8); `render closed`, the completed then
// the cancelled; the absorb's pick of an epic and its confirm; and where
// each row leads, followed through the verbs it names: a whole epic's
// cancel ending its experiments abandoned for good (18.4.22), and a cancel
// putting a roadmap item back on no horizon, which the person names
// (18.8.20, 18.8.2). The frame and the help screen are
// test-engine-menus.cjs's; pivot's and absorb's own transactions their
// suites'.
//
// Layer: verb, each render run as the start skill runs it, in a
// conversation of the test's own, and the transactions its rows lead to.
// World: this file's own, built once and copied for each test — a unit in
// each standing manage tells apart, written as the verbs leave them.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, output, refusedPristine, screenOf, sectionOf, commitAll, keywordOnlyKnowledge, cleanupFixture, fixtureFrom } = require('./engine-harness.cjs');
const { createManifest, writeState, readState, readManifest, layout } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { SHOWN } = require(path.join(SCRIPTS, 'domain/gate.cjs'));

const SESSION = 'manage-session';
const ENV = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION });

/** A cut of one phase, the build begun on it. */
const BUILT = Object.freeze({ build: { position: 'auto' }, cut: { phases: [{ name: 'Phase 1', goal: 'It resumes.', scenarios: [], sections: ['1'], relies_on: [] }] } });

const FEATURE = 'saved-session-layouts';
const BUILDING = 'lazy-resume-on-attach';
const SPEC_WRITTEN = 'quiet-hours';
const CANCELLED = 'split-oversized-go-files';
const COMPLETE = 'enter-attaches-from-preview';
const EPIC = 'agent-first-portal';
const EPIC_SPEC_WRITTEN = 'atlas';
const EPIC_COMPLETE = 'shipped';
const BUG = 'killing-all-sessions-wipes-restore-state';
const BUG_CANCELLED = 'dropped-save';

/** A unit's discussion, its one topic's item and log. @param {string} dir @param {string} unit @param {string} status */
function discussing(dir, unit, status) {
  writeState(dir, `${unit}/topics/${unit}/log.md`, `# Discussion — ${unit}\n`);
  return { discussion: { items: { [unit]: { status } } } };
}

const world = fixtureFrom('leeway-manage-', (dir) => {
  keywordOnlyKnowledge(dir);
  createManifest(dir, FEATURE, { phases: discussing(dir, FEATURE, 'in-progress') });
  createManifest(dir, BUILDING, { phases: discussing(dir, BUILDING, 'completed'), ...BUILT });
  createManifest(dir, SPEC_WRITTEN, { phases: discussing(dir, SPEC_WRITTEN, 'completed') });
  writeState(dir, `${SPEC_WRITTEN}/spec.md`, '# Quiet Hours\n');
  createManifest(dir, CANCELLED, { status: 'cancelled', phases: discussing(dir, CANCELLED, 'in-progress') });
  createManifest(dir, COMPLETE, { status: 'completed', phases: discussing(dir, COMPLETE, 'completed'), ...BUILT });
  createManifest(dir, EPIC, { work_type: 'epic', phases: { discovery: { items: { 'agent-mode': { source: 'discovery', summary: 'Agents run in panes', order: 1 } } } } });
  createManifest(dir, EPIC_SPEC_WRITTEN, { work_type: 'epic', phases: { discovery: { items: { atlas: { source: 'discovery', summary: 'The map', order: 1 } } } } });
  writeState(dir, `${EPIC_SPEC_WRITTEN}/spec.md`, '# Atlas\n');
  createManifest(dir, EPIC_COMPLETE, { work_type: 'epic', status: 'completed' });
  createManifest(dir, BUG, { work_type: 'bugfix', phases: { investigation: { items: { [BUG]: { status: 'in-progress' } } } } });
  createManifest(dir, BUG_CANCELLED, { work_type: 'bugfix', status: 'cancelled' });
  commitAll(dir, 'the units manage tells apart');
});

/**
 * A menu drawn in the test's conversation: its screen under the rule as it
 * reads, and each row of the gate it states with where it leads.
 * @param {string} dir @param {string[]} args @param {string} gate
 */
function drawn(dir, args, gate) {
  const out = output(dir, ['render', ...args], { env: ENV });
  const shown = JSON.parse(fs.readFileSync(path.join(/** @type {string} */ (process.env.LEEWAY_CONFIG_DIR), 'conversations', SESSION, SHOWN), 'utf8'));
  return {
    out,
    screen: screenOf(out, `MENU: ${gate}`),
    rows: /** @type {Record<string, any>} */ (Object.fromEntries(shown.options.map((/** @type {{key: string, next: unknown}} */ { key, next }) => [key, next]))),
  };
}

/** A unit drawn in manage. @param {string} dir @param {string} unit */
const managing = (dir, unit) => drawn(dir, ['manage-unit', unit], 'manage unit');

/** The keys a unit's screen offers, the frame's h and b among them. @param {string} dir @param {string} unit */
const keysOf = (dir, unit) => Object.keys(managing(dir, unit).rows);

/** Where a row leads, followed: its engine call answered. @param {string} dir @param {{argv: string[]}} next */
const followed = (dir, next) => ok(dir, next.argv, { env: ENV });

describe('manage and the closed units (18.3)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(dir));

  it('18.3.4: manage lists every unit — in progress, then complete, then cancelled, by type within each — each opening its own, and back to the start menu', () => {
    const { screen, rows } = drawn(dir, ['manage'], 'manage');

    assert.deepStrictEqual(screen, [
      '· · · · · · · · · · · ·',
      '◆ What would you like to manage?',
      '',
      '1      → Lazy Resume On Attach — feature',
      '2      → Quiet Hours — feature',
      '3      → Saved Session Layouts — feature',
      '4      → Killing All Sessions Wipes Restore State — bugfix',
      '5      → Agent First Portal — epic',
      '6      → Atlas — epic',
      '7      → Enter Attaches From Preview — feature, complete',
      '8      → Shipped — epic, complete',
      '9      → Split Oversized Go Files — feature, cancelled',
      '10     → Dropped Save — bugfix, cancelled',
      'h/help → What this menu is for, row by row',
      'b/back → Back to the start menu',
    ]);
    assert.deepStrictEqual([rows['1'], rows['10'], rows.b], [
      { kind: 'engine', argv: ['render', 'manage-unit', BUILDING] },
      { kind: 'engine', argv: ['render', 'manage-unit', BUG_CANCELLED] },
      { kind: 'engine', argv: ['render', 'start-menu'] },
    ]);
  });

  it('18.S7, 12.15.4: a feature whose build is under way offers cancel alone; a cancelled bugfix offers to bring it back', () => {
    const building = managing(dir, BUILDING);
    assert.deepStrictEqual(building.screen, [
      '· · · · · · · · · · · ·',
      'Lazy Resume On Attach (feature)',
      '',
      '◆ What would you like to do?',
      '',
      'c/cancel → Mark as cancelled',
      'h/help   → What this menu is for, row by row',
      'b/back   → Back to manage',
      'Ask      → Ask a question about this work unit',
    ]);
    assert.deepStrictEqual(building.rows.b, { kind: 'engine', argv: ['render', 'manage'] });

    const bug = managing(dir, BUG_CANCELLED);
    assert.deepStrictEqual(bug.screen.slice(1, 6), ['Dropped Save (bugfix, cancelled)', '', '◆ What would you like to do?', '', 'r/reactivate → Bring it back — in progress again']);
    assert.deepStrictEqual(Object.keys(bug.rows), ['r', 'h', 'b']);
  });

  it('18.S53, 18.3.5: a feature before its spec offers pivot and absorb beside cancel; once its spec is written, cancel alone', () => {
    const before = managing(dir, FEATURE);
    assert.deepStrictEqual(before.screen.slice(1, 9), [
      'Saved Session Layouts (feature)',
      '',
      '◆ What would you like to do?',
      '',
      'p/pivot  → Make it an epic — before its spec',
      'o/absorb → Join an epic as one of its topics',
      'c/cancel → Mark as cancelled',
      'h/help   → What this menu is for, row by row',
    ]);
    assert.deepStrictEqual([before.rows.p, before.rows.o, before.rows.c], [
      { kind: 'continue' },
      { kind: 'engine', argv: ['render', 'absorb-target', FEATURE] },
      { kind: 'engine', argv: ['render', 'cancel-gate', FEATURE] },
    ]);
    assert.deepStrictEqual(keysOf(dir, SPEC_WRITTEN), ['c', 'h', 'b']);
  });

  it('18.S53: absorb offers only the epics before their spec, read off the spec\'s standing — never one with its spec written, nor one complete — and a feature no epic can take offers none', () => {
    const target = output(dir, ['render', 'absorb-target', FEATURE], { env: ENV });
    assert.deepStrictEqual(sectionOf(target, 'DATA').trim(), `epic 1: ${EPIC}`);
    assert.deepStrictEqual(screenOf(target, 'MENU: absorb target'), [
      '· · · · · · · · · · · ·',
      'Absorbing Saved Session Layouts moves its discussion, experiments, seeds, assets and spikes into the epic as a new topic, and removes it as a feature.',
      '',
      '◆ Which epic should take it in?',
      '',
      '1      → Agent First Portal',
      'b/back → Back to Saved Session Layouts',
    ]);

    writeState(dir, `${EPIC}/spec.md`, '# Agent First Portal\n');
    commitAll(dir, 'the epic\'s spec written');
    assert.deepStrictEqual(keysOf(dir, FEATURE), ['p', 'c', 'h', 'b']);
    assert.strictEqual(refusedPristine(dir, ['render', 'absorb-target', FEATURE]).error, `no epic can take ${FEATURE} in — absorb goes into an epic in progress, before its spec`);
  });

  it('18.S54, 18.3.6: a completed epic offers nothing to do to it — no reopen — and neither does a completed feature yet', () => {
    assert.deepStrictEqual(managing(dir, EPIC_COMPLETE).screen.slice(1, 7), ['Shipped (epic, complete)', '', '◆ What would you like to do?', '', 'h/help → What this menu is for, row by row', 'b/back → Back to manage']);
    assert.deepStrictEqual(keysOf(dir, COMPLETE), ['h', 'b']);
  });

  it('18.3.4: each type in progress — a bugfix, a quick-fix and an epic are offered their cancel alone; a feature with no discussion its pivot, never its absorb', () => {
    createManifest(dir, 'tidy-logs', { work_type: 'quick-fix', fixes: { began: '2026-06-03T09:00:00Z' } });
    createManifest(dir, 'pane-titles', {});
    commitAll(dir, 'a quick-fix and a feature with no discussion');
    assert.deepStrictEqual([BUG, 'tidy-logs', EPIC, 'pane-titles'].map((unit) => keysOf(dir, unit)), [['c', 'h', 'b'], ['c', 'h', 'b'], ['c', 'h', 'b'], ['p', 'c', 'h', 'b']]);
  });

  it('8.S44, 8.12.1: the brownfield offer\'s answer changes nothing manage offers', () => {
    const unanswered = drawn(dir, ['manage'], 'manage');
    const project = JSON.parse(readState(dir, layout.projectManifest));
    for (const answer of ['native', 'skipped', 'accepted', 'completed']) {
      writeState(dir, layout.projectManifest, JSON.stringify({ ...project, brownfield_offer: answer }, null, 2));
      const { screen, rows } = drawn(dir, ['manage'], 'manage');
      assert.deepStrictEqual([screen, rows], [unanswered.screen, unanswered.rows], answer);
    }
  });

  it('refuses a unit the project lacks, naming the way on', () => {
    assert.strictEqual(refusedPristine(dir, ['render', 'manage-unit', 'ghost']).error, 'there is no work unit "ghost" — the start menu lists the work in progress');
  });

  it('18.2.10: the closed units — the complete, then the cancelled — each opening its own in manage, and back to the start menu', () => {
    const { screen, rows } = drawn(dir, ['closed'], 'closed units');
    assert.deepStrictEqual(screen.slice(1), [
      '◆ Which work unit?',
      '',
      '1      → Enter Attaches From Preview — feature, complete',
      '2      → Shipped — epic, complete',
      '3      → Split Oversized Go Files — feature, cancelled',
      '4      → Dropped Save — bugfix, cancelled',
      'h/help → What this menu is for, row by row',
      'b/back → Back to the start menu',
    ]);
    assert.deepStrictEqual([rows['3'], rows.b], [{ kind: 'engine', argv: ['render', 'manage-unit', CANCELLED, '--from', 'closed'] }, { kind: 'engine', argv: ['render', 'start-menu'] }]);
  });

  it('a unit opened among the closed units goes back to them, and its help back to it as it was opened', () => {
    const unit = drawn(dir, ['manage-unit', CANCELLED, '--from', 'closed'], 'manage unit');
    assert.deepStrictEqual([unit.screen.at(-2), unit.rows.b, unit.rows.h], [
      'b/back       → Back to the closed units',
      { kind: 'engine', argv: ['render', 'closed'] },
      { kind: 'engine', argv: ['render', 'help', 'manage-unit', CANCELLED, '--from', 'closed'] },
    ]);
    assert.match(refusedPristine(dir, ['render', 'manage-unit', CANCELLED, '--from', 'start']).error, /^Usage: engine render manage-unit <work-unit> \[--from closed\]$/);
  });
});

describe('manage\'s rows followed (8.8.8, 18.3.4)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(dir));

  it('8.8.8: cancel goes through its confirm, whose yes cancels the unit, which then offers to bring it back — and reactivate brings it back in progress', () => {
    const confirm = drawn(dir, managing(dir, BUILDING).rows.c.argv.slice(1), 'cancel gate');
    assert.strictEqual(confirm.screen[1], 'Cancelling Lazy Resume On Attach calls off the whole feature — it stops where it stands, and can be reactivated later.');
    assert.deepStrictEqual(Object.keys(confirm.rows), ['y', 'n']);

    assert.strictEqual(followed(dir, confirm.rows.y).status, 'cancelled');
    const cancelled = managing(dir, BUILDING);
    assert.deepStrictEqual(Object.keys(cancelled.rows), ['r', 'h', 'b']);
    assert.strictEqual(followed(dir, cancelled.rows.r).status, 'in-progress');
    assert.deepStrictEqual(keysOf(dir, BUILDING), ['c', 'h', 'b']);
    assert.strictEqual(refusedPristine(dir, ['render', 'cancel-gate', CANCELLED]).error, `render cancel-gate: "${CANCELLED}" is cancelled — only work in progress is cancelled`);
  });

  it('18.4.22, 8.8.8: a whole epic cancelled through its confirm ends the open experiments of every topic abandoned, a split\'s with its parent, their waits released — the confirm naming them as a topic\'s cancel does — and its reactivate leaves them abandoned', () => {
    const manifest = readManifest(dir, EPIC);
    manifest.phases.discovery.items.layouts = { source: 'discovery', summary: 'Layouts per pane', order: 2 };
    manifest.phases.discussion = { items: { 'agent-mode': { status: 'in-progress', awaiting_experiments: ['E1'] }, layouts: { status: 'in-progress' } } };
    manifest.phases.experiment = { items: {
      'agent-mode': { status: 'in-progress', experiments: { E1: { slug: 'pane-cost', status: 'conceived' }, E2: { slug: 'done', status: 'concluded', verdict: 'It holds.' } } },
      layouts: { status: 'in-progress', experiments: { E1: { slug: 'grid', status: 'conceived' }, 'E1.1': { slug: 'grid-wide', status: 'conceived' } } },
    } };
    writeState(dir, `${EPIC}/manifest.json`, JSON.stringify(manifest, null, 2));
    commitAll(dir, 'experiments open under two topics');

    const confirm = drawn(dir, managing(dir, EPIC).rows.c.argv.slice(1), 'cancel gate');
    assert.deepStrictEqual(confirm.screen.slice(1, 4), [
      'Cancelling Agent First Portal calls off the whole epic — it stops where it stands, and can be reactivated later. 2 open experiments (Agent Mode: E1; Layouts: E1, with E1.1) end abandoned on the register.',
      '',
      '◆ Cancel it?',
    ]);
    assert.deepStrictEqual(followed(dir, confirm.rows.y).abandoned, [{ topic: 'agent-mode', ids: ['E1'] }, { topic: 'layouts', ids: ['E1', 'E1.1'] }]);
    followed(dir, managing(dir, EPIC).rows.r);

    const back = readManifest(dir, EPIC).phases;
    const ENDED = { status: 'abandoned', reason: 'work unit cancelled' };
    assert.deepStrictEqual([back.experiment.items, back.discussion.items['agent-mode']], [
      {
        'agent-mode': { status: 'completed', experiments: { E1: { slug: 'pane-cost', ...ENDED }, E2: { slug: 'done', status: 'concluded', verdict: 'It holds.' } } },
        layouts: { status: 'completed', experiments: { E1: { slug: 'grid', ...ENDED }, 'E1.1': { slug: 'grid-wide', ...ENDED } } },
      },
      { status: 'in-progress' },
    ]);
  });

  it('18.8.20, 18.8.2: a cancel putting roadmap items back on horizons removed meanwhile leads through the horizon pick for each, one at a time, then on in manage; a horizon named in words moves it the same way', () => {
    ok(dir, ['roadmap', 'add', 'pane-layouts', '--horizon', 'launch', '--summary', 'Layouts per pane']);
    ok(dir, ['roadmap', 'add', 'pane-themes', '--horizon', 'launch', '--summary', 'Themes per pane']);
    ok(dir, ['roadmap', 'add', 'themes', '--horizon', 'someday', '--summary', 'Themes']);
    for (const item of ['pane-layouts', 'pane-themes']) ok(dir, ['roadmap', 'pull-forward', item, '--into', EPIC]);
    ok(dir, ['roadmap', 'horizon', 'remove', 'launch']);

    const confirm = drawn(dir, managing(dir, EPIC).rows.c.argv.slice(1), 'cancel gate');
    const cancelled = followed(dir, confirm.rows.y);
    assert.deepStrictEqual(cancelled.next, { kind: 'engine', argv: ['render', 'horizon-pick', '--back', 'pane-layouts', '--from', EPIC] });

    const first = drawn(dir, cancelled.next.argv.slice(1), 'horizon pick');
    assert.deepStrictEqual(first.screen.slice(1, 7), ['"Pane Layouts" is back on the roadmap, and the horizon it came from has been removed.', '', '◆ Which horizon?', '', '1     → someday — 1 waiting', 'n/new → A new horizon — name it']);
    assert.strictEqual(sectionOf(first.out, 'DATA').trim(), `a horizon named in words: engine roadmap move pane-layouts --horizon "<the horizon>" --from ${EPIC}, then follow its next`);
    assert.deepStrictEqual(first.rows.n, { kind: 'continue' });
    const moved = followed(dir, first.rows['1']);
    assert.deepStrictEqual(moved.next, { kind: 'engine', argv: ['render', 'horizon-pick', '--back', 'pane-themes', '--from', EPIC] });

    drawn(dir, moved.next.argv.slice(1), 'horizon pick');
    assert.deepStrictEqual(ok(dir, ['roadmap', 'move', 'pane-themes', '--horizon', 'later', '--from', EPIC]).next, { kind: 'continue' }, 'past the last, on in the calling flow');
    const items = ok(dir, ['roadmap', 'state']).items.filter((/** @type {{name: string}} */ { name }) => name.startsWith('pane-'));
    assert.deepStrictEqual(items.map((/** @type {{name: string, horizon: string, state: string}} */ { name, horizon, state }) => [name, horizon, state]), [['pane-layouts', 'someday', 'waiting'], ['pane-themes', 'later', 'waiting']]);
    assert.match(refusedPristine(dir, ['render', 'horizon-pick', '--back', 'pane-themes', '--from', EPIC]).error, /"pane-themes" is no roadmap item waiting on no horizon$/);
  });

  it('18.3.7: absorb — an epic picked, the confirm over what moves, its yes absorbing the feature as a topic whose map row carries the summary and description drafted; its no back to the feature', () => {
    const args = ['absorb-confirm-gate', FEATURE, '--into', EPIC, '--topic', FEATURE, '--summary', 'Layouts saved per session', '--description', 'A session keeps its pane layout across restarts.'];
    const confirm = drawn(dir, args, 'absorb confirm gate');
    assert.match(sectionOf(confirm.out, 'DISPLAY: absorb summary'), /Target: {6}Agent First Portal\n {2}Topic: {7}saved-session-layouts/);
    assert.deepStrictEqual(confirm.screen.slice(1), ['◆ Absorb it?', '', 'y/yes', 'n/no']);
    assert.deepStrictEqual(confirm.rows.n, { kind: 'engine', argv: ['render', 'manage-unit', FEATURE] });
    assert.deepStrictEqual(drawn(dir, ['absorb-target', FEATURE], 'absorb target').rows.b, { kind: 'engine', argv: ['render', 'manage-unit', FEATURE] }, 'the pick\'s back is the feature\'s own');

    assert.strictEqual(followed(dir, confirm.rows.y).topic, FEATURE);
    assert.deepStrictEqual(readManifest(dir, EPIC).phases.discovery.items[FEATURE], { source: 'discovery', summary: 'Layouts saved per session', description: 'A session keeps its pane layout across restarts.' });
  });

  it('the absorb\'s confirm refuses whatever the absorb refuses, in its words — a name the epic holds or another topic goes by, an epic past its spec, a blank summary, an empty description', () => {
    const manifest = readManifest(dir, EPIC);
    manifest.phases.discovery.items['agent-mode'].title = 'agents';
    writeState(dir, `${EPIC}/manifest.json`, JSON.stringify(manifest, null, 2));
    commitAll(dir, 'a topic renamed');
    /** @param {string} into @param {string} topic @param {string[]} words */
    const both = (into, topic, words) => {
      const rest = [FEATURE, '--into', into, '--topic', topic, ...words];
      const confirm = refusedPristine(dir, ['render', 'absorb-confirm-gate', ...rest]).error;
      assert.strictEqual(refusedPristine(dir, ['workunit', 'absorb', ...rest], { env: ENV }).error, confirm, 'the absorb refuses in the same words');
      return confirm;
    };
    assert.deepStrictEqual([
      both(EPIC, 'agent-mode', ['--summary', 'S']),
      both(EPIC, 'agents', ['--summary', 'S']),
      both(EPIC_SPEC_WRITTEN, FEATURE, ['--summary', 'S']),
      both(EPIC, FEATURE, ['--summary', '  ']),
      both(EPIC, FEATURE, ['--summary', 'S', '--description', '']),
    ], [
      '"agent-mode" is already on agent-first-portal\'s discovery map — pick a different name',
      '"agent-mode" on agent-first-portal\'s discovery map goes by "agents" — pick a different name',
      'atlas has its spec, so its map is closed — absorb the feature into an epic still before its spec, or keep it as work of its own',
      'workunit absorb: the topic needs its summary — --summary, its one line drafted from its record and its log',
      'workunit absorb: --description is empty — give the topic\'s description, or leave the flag out',
    ]);
    assert.match(refusedPristine(dir, ['render', 'absorb-confirm-gate', FEATURE, '--into', EPIC, '--topic', FEATURE]).error, /^Usage: engine render absorb-confirm-gate/);
  });
});

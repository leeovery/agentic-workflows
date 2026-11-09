'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's move to another type (leeway-engine/scripts/domain/
// workunit-move.cjs; 19.5.9, 19.5.16, P7): `workunit move` staging Claude's
// payload where start this work stages a start and drawing its screen, the
// name a quick-fix's branch is kept under in one line, nothing moved; the
// yes, `start-this-work yes`, moving the unit in place — re-typed in both
// manifests in one save, its brief written, its open fixes closed, a fix
// recorded having its record taken out as it closes, its checkout taken
// back to the branch it lands on, its commits kept unlanded on its one
// branch renamed under moved/ and a branch with none of its own deleted,
// the fixes' phase taken out of the tracker, every line but discovery's
// carried to the new topic at its first phase, the old type's files set
// aside in the topic's earlier material with each line citing one following
// it, the knowledge base re-indexed, the move in the board's history — and
// handing off into the new type's first phase (19.S24, 24.1.2); the topic's
// first opening reading what the move carried, and a second none of it, for
// a feature and a bugfix (enter.cjs); its lines read at the epic's topic
// once the feature it became is absorbed (ledger-rehomed.cjs), the epic's
// other topic reading none of them; one whose pull request is open moving,
// the yes closing it unmerged and keeping its commits on its branch under
// moved/; one holding a fix done and recorded moving, its summary.md set
// aside, which the first opening names; and the yes refusing a checkout
// holding changes, lines with no conversation to carry them in, and a fix
// landed. What the move refuses at its stage and its yes run again, a
// bugfix moved and what the new type's build meets are
// test-engine-workunit-move-after.cjs's.
//
// Layer: git. World: workunit-move-world.cjs, built once and copied. Each
// test's conversation keeps its records in a config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, okSections, output, refuses, refusedPristine, git, stateGit, statePath, layout, writeState,
  readState, readManifest, createFile, head, sectionOf, accountTaken, cleanupFixture,
} = require('./engine-harness.cjs');
const {
  QF, SHIPPED, BEGUN, EPIC, ENGINE, BRANCH, KEPT, SHOT, RECORD, STAGED, BUILD_LOG, EARLIER, made,
  world, moveHelpers,
} = require('./workunit-move-world.cjs');
const { recordFile } = require('./quick-fix-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { quickFixBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { callsOf } = require(path.join(SCRIPTS, 'domain/build-screens.cjs'));
const { quickFixLanding } = require(path.join(SCRIPTS, 'domain/landing.cjs'));
const { RECORDS } = require(path.join(SCRIPTS, 'domain/brief-records.cjs'));
const { unitHistory } = require(path.join(SCRIPTS, 'domain/state-history.cjs'));

let dir = ''; // the project
const {
  env, staged, moved, refusedStage, branchOut, fixes, chunkTypes, ledgerLines, earlierReads,
} = moveHelpers(() => dir);

afterEach(() => {
  cleanupFixture(dir);
});

describe('workunit move, the stage (19.5.9, P7)', () => {
  it('stages the move where start this work stages a start and draws its screen, the quick-fix\'s branch named in one line — nothing moved, and the gate\'s yes is start this work\'s', () => {
    dir = world();
    const before = { head: head(dir), manifest: readState(dir, layout.manifest(QF)) };
    const { res, sections } = staged(QF, 'feature');

    assert.deepStrictEqual(res, { ok: true, work_unit: QF, from: 'quick-fix', to: 'feature' });
    assert.strictEqual(sectionOf(sections, 'DISPLAY: start this work'), [
      'Typo (feature)',
      'The typo work, as feature work.',
      '↳ It needs a decision from you beyond a quick call.',
      `⚑ Its commits stay unlanded on ${KEPT}`,
      '',
    ].join('\n'));
    assert.strictEqual(sectionOf(sections, 'MENU: start this work'), [
      '· · · · · · · · · · · ·',
      'Your yes makes the quick-fix a feature. Its discussion opens next.',
      '',
      '**`◆ Start this work?`**',
      '',
      '**`y/yes`**        → Move it — the quick-fix becomes a feature',
      '**Keep shaping** → Tell me what I\'m missing',
      '',
    ].join('\n'));
    assert.deepStrictEqual([head(dir), readState(dir, layout.manifest(QF)), JSON.parse(readState(dir, STAGED)).moves], [before.head, before.manifest, { from: 'quick-fix', branches: [KEPT], aside: [] }]);
    assert.deepStrictEqual(ok(dir, ['gate', 'start this work', '--pick', 'y'], { env: env() }).next, { kind: 'engine', argv: ['start-this-work', 'yes'] });
    assert.match(sectionOf(output(dir, ['render', 'start-this-work'], { env: env() }), 'MENU: start this work'), /Move it — the quick-fix becomes a feature/, 'read again, the screen draws the staged move');
  });
});

describe('the yes: a quick-fix moved (19.S24, 19.5.16)', () => {
  it('re-types it in place in both manifests, writes its brief, closes its open fix, taking its record out, takes the checkout back to main, keeps the fix\'s commit unlanded on the quick-fix\'s branch renamed under moved/, takes its phase out of the tracker, carries its lines to the topic at the discussion and sets its build aside there, the call following its log, re-indexes it, commits after the close, and hands off into the feature\'s discussion', () => {
    dir = world();
    assert.deepStrictEqual(chunkTypes(QF), ['quick-fix']);
    const fixCommit = git(dir, ['rev-parse', BRANCH]).trim();
    const res = moved(QF, 'feature');
    const idOf = (/** @type {string} */ short) => ledgerLines().find((l) => l.id.startsWith(short)).id;
    const link = ledgerLines().find((l) => l.event === 'asset').id;

    assert.deepStrictEqual(res, {
      ok: true,
      work_unit: QF,
      work_type: 'feature',
      from: 'quick-fix',
      brief: statePath(dir, layout.brief(QF, QF)),
      fixes_closed: ['1.1'],
      branches: [KEPT],
      pull_request_closed: false,
      checkout: 'main',
      committed: head(dir).slice(0, res.committed.length),
      next: { kind: 'handoff', skill: 'leeway-discussion-process', args: ['feature', QF] },
    });
    const manifest = readManifest(dir, QF);
    assert.deepStrictEqual([manifest.work_type, manifest.description, manifest.fixes, manifest.phases, manifest.seeds.length],
      ['feature', 'The typo work, as feature work.', undefined, { discussion: { items: { [QF]: { status: 'unstarted' } } } }, 1]);
    assert.deepStrictEqual(readManifest(dir, '.').work_units[QF], { work_type: 'feature' });
    assert.strictEqual(readState(dir, layout.brief(QF, QF)), '# typo\n\nWhat the work showed.\n');
    assert.strictEqual(refuses(dir, ['task', 'list', QF, '1']).error, `phase 1 of ${QF} is not written`);
    assert.deepStrictEqual([branchOut(), git(dir, ['branch', '--list', BRANCH]), git(dir, ['rev-parse', KEPT]).trim(), git(dir, ['rev-list', '--count', `main..${KEPT}`]).trim()], ['main', '', fixCommit, '1']);
    const { v: _v, id: _id, at: _at, ...carry } = ledgerLines().at(-1);
    assert.deepStrictEqual(carry, {
      event: 'rehomed', unit: QF, topic: QF, phase: 'discussion', session: 'sess-1',
      lines: [idOf(made.asked), link, idOf(made.settled), idOf(made.call)], files: [[BUILD_LOG, EARLIER(QF, 'build/log.md')]],
    });
    const record = ok(dir, ['ledger', 'record', QF, QF]);
    assert.deepStrictEqual([
      record.questions.map((q) => [q.text, q.unit, q.topic, q.phase]),
      record.questions[0].assets.map((a) => a.path),
      record.decisions.map((d) => [d.text, d.phase, d.cites.map((c) => c.path)]),
    ], [
      [['Should --color still work?', QF, QF, 'discussion'], ['Which spelling does the help use?', QF, QF, 'discussion']],
      [SHOT],
      [['The help says colour.', 'discussion', [EARLIER(QF, 'build/log.md')]]],
    ]);
    assert.deepStrictEqual(callsOf(dir, { unit: QF, phase: 1, n: 1 }), [], 'the call its fix made is no call of the build\'s');
    assert.deepStrictEqual(
      [fs.existsSync(statePath(dir, QF, 'build')), readState(dir, EARLIER(QF, 'build/log.md')), fs.existsSync(statePath(dir, QF, 'summary.md')), fs.existsSync(statePath(dir, EARLIER(QF, 'summary.md')))],
      [false, '# Build log\n\n## Fix 1.1\n\nThe help reads colour.\n', false, false],
      'the fix\'s record goes with its close, so no summary is left to set aside',
    );
    assert.deepStrictEqual(chunkTypes(QF), ['feature']);
    assert.deepStrictEqual(stateGit(dir, ['log', '-2', '--format=%s']).trim().split('\n'), [`workflow(${QF}): move quick-fix to feature`, `task(${QF}): close 1.1`]);
    assert.deepStrictEqual([fs.existsSync(statePath(dir, STAGED)), stateGit(dir, ['status', '--porcelain'])], [false, '']);
    assert.deepStrictEqual(unitHistory(dir, QF).slice(0, 1).map(({ kind, detail }) => [kind, detail]), [['moved', 'feature']]);
    assert.deepStrictEqual(ok(dir, ['ledger', 'product', QF, QF], { env: env() }).discovery.map((e) => [e.text, e.unit, e.topic, e.phase]), [['The flag is spelt three ways.', QF, null, 'discovery']],
      'what discovery found stays at the unit\'s own level, read as any unit\'s');
  });

  it('to a bugfix, carries its lines to the investigation and hands off into it, whose first opening reads what the move carried and a second none of it — no call of its build, nor of its task writer\'s brief, the quick-fix\'s', () => {
    dir = world();
    const res = moved(QF, 'bugfix');
    const first = okSections(dir, ['enter', 'investigation', QF], { env: env() }).sections;
    const again = okSections(dir, ['enter', 'investigation', QF], { env: { ...env(), CLAUDE_CODE_SESSION_ID: 'sess-2' } }).sections;
    const buildCalls = RECORDS['build-calls'].draw({ cwd: dir, role: 'task-writer', ref: null, task: null, place: null, unit: QF, given: {}, session: 'sess-1' }, []);

    assert.deepStrictEqual([res.work_type, res.next], ['bugfix', { kind: 'handoff', skill: 'leeway-investigation-process', args: ['bugfix', QF] }]);
    assert.deepStrictEqual([ledgerLines().at(-1).event, ledgerLines().at(-1).phase], ['rehomed', 'investigation']);
    assert.deepStrictEqual(readManifest(dir, '.').work_units[QF], { work_type: 'bugfix' });
    assert.deepStrictEqual(ok(dir, ['ledger', 'record', QF, QF]).questions.map((q) => q.phase), ['investigation', 'investigation']);
    assert.deepStrictEqual([earlierReads(first), earlierReads(again)], [[
      `earlier record: \`${ENGINE} ledger record ${QF} ${QF}\``,
      `earlier build log: ${statePath(dir, EARLIER(QF, 'build/log.md'))}`,
      `kept branch: ${KEPT}`,
    ], []]);
    assert.deepStrictEqual([callsOf(dir, { unit: QF, phase: 1, n: 1 }), buildCalls], [[], 'None recorded.']);
  });

  it('refuses while the checkout holds changes not committed, naming each, nothing moved — the fix still in progress, the checkout on its branch', () => {
    dir = world();
    staged(QF, 'feature');
    createFile(dir, 'src/help.js', 'const help = 1;\n');
    const { next } = ok(dir, ['gate', 'start this work', '--pick', 'y'], { env: env() });
    const { error } = refusedPristine(dir, next.argv, { env: env() });

    assert.strictEqual(error, `start-this-work yes: ${QF}'s tasks leave the project's checkout, which holds changes not committed — src/help.js — so it was not taken back to main: commit them on ${BRANCH} or set them aside, then say yes again`);
    assert.deepStrictEqual([readManifest(dir, QF).work_type, fixes(), branchOut()], ['quick-fix', [{ task: '1.1', status: 'in-progress' }], BRANCH]);
  });

  it('refuses a quick-fix holding lines where no conversation names the session the carry is made in, nothing moved', () => {
    dir = world();
    staged(QF, 'feature');
    const { error } = refusedPristine(dir, ['start-this-work', 'yes'], { env: { ...env(), CLAUDE_CODE_SESSION_ID: undefined } });

    assert.strictEqual(error, `start-this-work yes: ${QF} holds ledger entries, which the move carries to its topic in this conversation — Claude Code hands every command it runs a session id, and this one has none`);
    assert.deepStrictEqual([fixes(), branchOut()], [[{ task: '1.1', status: 'in-progress' }], BRANCH]);
  });

  it('refuses a quick-fix a fix of which has landed — its branch merged by hand onto main, never opened — as the landing reads it, however the tracker holds its fixes: it is finished first', () => {
    dir = world();
    git(dir, ['branch', '-f', 'main', BRANCH]);

    assert.strictEqual(refusedStage(QF, 'feature'), `${QF}'s fix 1.1 has landed — finish the quick-fix, then start the feature as work of its own`);
    assert.strictEqual(ok(dir, ['task', 'list', QF, '1']).tasks[0].status, 'in-progress');
  });

  it('a quick-fix whose pull request is open moves, the yes closing the pull request unmerged and keeping its fix\'s commit on its branch renamed under moved/', () => {
    dir = world();
    const at = git(dir, ['rev-parse', quickFixBranch(SHIPPED)]).trim();
    const res = moved(SHIPPED, 'feature');

    assert.deepStrictEqual([res.fixes_closed, res.pull_request_closed, res.branches, git(dir, ['rev-parse', `moved/${quickFixBranch(SHIPPED)}`]).trim(), quickFixLanding(dir, SHIPPED).own.pull().open], [
      ['1.1'], true, [`moved/${quickFixBranch(SHIPPED)}`], at, null,
    ]);
  });

  it('a quick-fix holding a fix done and recorded moves, closing none, its summary.md set aside under its topic\'s earlier material, which the first opening names', () => {
    dir = world();
    accountTaken(dir, SHIPPED, '1.1');
    ok(dir, ['task', 'done', SHIPPED, '1.1'], { env: env() });
    ok(dir, ['quick-fix', 'record', SHIPPED, '1.1', '--file', recordFile(dir, 1, RECORD)], { env: env() });
    const res = moved(SHIPPED, 'feature');
    const first = okSections(dir, ['enter', 'discussion', SHIPPED], { env: env() }).sections;

    assert.deepStrictEqual([res.fixes_closed, fs.existsSync(statePath(dir, layout.unit(SHIPPED, 'summary.md'))), readState(dir, EARLIER(SHIPPED, 'summary.md')).split('\n')[0]], [[], false, '## Ship the flag']);
    assert.deepStrictEqual(earlierReads(first), [`earlier summary: ${statePath(dir, EARLIER(SHIPPED, 'summary.md'))}`, `kept branch: moved/${quickFixBranch(SHIPPED)}`]);
  });

  it('a quick-fix whose fixes have not begun moves leaving the checkout where it is, on another unit\'s branch, closing nothing and carrying nothing, so its topic\'s first opening reads nothing earlier', () => {
    dir = world();
    const res = moved('small', 'feature');

    assert.deepStrictEqual([res.fixes_closed, res.branches, res.checkout, branchOut()], [[], [], null, BRANCH]);
    assert.deepStrictEqual(readManifest(dir, 'small').phases, { discussion: { items: { small: { status: 'unstarted' } } } });
    assert.deepStrictEqual(earlierReads(okSections(dir, ['enter', 'discussion', 'small'], { env: env() }).sections), []);
  });

  it('closes only the fix not yet ended, deletes the quick-fix\'s branch holding no commit of its own, keeping nothing, and leaves the checkout on another unit\'s branch', () => {
    dir = world();
    const res = moved(BEGUN, 'feature');

    assert.deepStrictEqual([res.fixes_closed, res.branches, res.checkout, branchOut()], [['1.2'], [], null, BRANCH]);
    assert.strictEqual(git(dir, ['branch', '--list', quickFixBranch(BEGUN), `moved/${quickFixBranch(BEGUN)}`]), '');
  });

  it('its topic\'s first opening reads what the move carried — the record holding the question that moved it, still open, the build\'s log and the branch kept — and a second opening none of it', () => {
    dir = world();
    moved(QF, 'feature');
    const first = okSections(dir, ['enter', 'discussion', QF], { env: env() }).sections;
    const again = okSections(dir, ['enter', 'discussion', QF], { env: { ...env(), CLAUDE_CODE_SESSION_ID: 'sess-2' } }).sections;

    assert.deepStrictEqual([earlierReads(first), earlierReads(again)], [[
      `earlier record: \`${ENGINE} ledger record ${QF} ${QF}\``,
      `earlier build log: ${statePath(dir, EARLIER(QF, 'build/log.md'))}`,
      `kept branch: ${KEPT}`,
    ], []]);
    assert.deepStrictEqual(ok(dir, ['ledger', 'map', QF, QF]).questions.map((q) => [q.text, q.answers.length]), [['Should --color still work?', 0], ['Which spelling does the help use?', 1]]);
  });

  it('a feature it became, absorbed into an epic, has its lines read at the epic\'s topic at the discussion, each file they name where the absorb moved it — its build\'s log with the topic — the later carry winning; the epic\'s other topic reading none of it at its first opening', () => {
    dir = world();
    moved(QF, 'feature');
    ok(dir, ['enter', 'discussion', QF], { env: env() });
    writeState(dir, layout.unit(QF, 'topics', QF, 'log.md'), '# Typo\n');
    ok(dir, ['workunit', 'absorb', QF, '--into', EPIC, '--topic', 'colour'], { env: env() });
    const other = okSections(dir, ['enter', 'discussion', EPIC, 'fee-model'], { env: env() }).sections;

    assert.deepStrictEqual(earlierReads(other), []);
    const record = ok(dir, ['ledger', 'record', EPIC, 'colour']);
    const earlierLog = layout.unit(EPIC, 'topics', 'colour', 'earlier', 'build', 'log.md');
    assert.deepStrictEqual([
      record.questions.map((q) => [q.text, q.unit, q.topic, q.phase, q.assets.map((a) => a.path)]),
      record.decisions.map((d) => d.cites.map((c) => c.path)),
      fs.existsSync(statePath(dir, earlierLog)),
    ], [
      [['Should --color still work?', EPIC, 'colour', 'discussion', [`${EPIC}/assets/shot.png`]], ['Which spelling does the help use?', EPIC, 'colour', 'discussion', []]],
      [[earlierLog]],
      true,
    ]);
  });
});

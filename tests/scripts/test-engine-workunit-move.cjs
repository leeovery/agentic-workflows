'use strict';

// ---------------------------------------------------------------------------
// A unit's move to another type (leeway-engine/scripts/domain/
// workunit-move.cjs; 19.4.22, 19.5.9, 19.5.16, P7): `workunit move` staging
// Claude's payload where start this work stages a start and drawing its
// screen, the name a quick-fix's branch is kept under in one line, nothing
// moved; the yes, `start-this-work yes`, moving the unit in place —
// re-typed in both manifests in one save, its brief written, a quick-fix's
// open fixes closed, a fix recorded having its record taken out as it
// closes, its checkout taken back to the branch the quick-fix lands on, its
// commits kept unlanded on its one branch renamed under moved/ and a branch
// with none of its own deleted, the fixes' phase taken out of the tracker,
// every line but discovery's carried to the new topic at its first phase,
// the old type's files set aside in the topic's earlier material with each
// line citing one following it, the knowledge base re-indexed, the move in
// the board's history — and handing off into the new type's first phase
// (19.S24, 19.S30, 24.1.2); the yes's checks made again, and the yes
// stopped before its save run again whole, answering what the second call
// did; the new type's build meeting nothing of the fixes — a feature's
// phase 1 written and task 1.1's branch laid, a bugfix's reproducing task
// 1.1 created, on the local landing driver, and no call of a bugfix's build
// or its task writer's brief the quick-fix's; the topic's first opening
// reading what the move carried, and a second none of it, for a feature and
// a bugfix (enter.cjs); a moved quick-fix's lines read at the epic's topic
// once the feature it became is absorbed (ledger-rehomed.cjs), the epic's
// other topic reading none of them; a quick-fix whose pull request is open
// moving, the yes closing it unmerged and keeping its commits on its branch
// under moved/; and every refusal, writing nothing: a fix of a quick-fix
// landed, a checkout holding changes, a unit past its spec, a type that does
// not move, a bugfix away from its investigation.
//
// Layer: git. World: one project built once through the verbs and copied —
// the quick-fix typo, entered, its fix 1.1 started, committed on its branch
// and recorded, the project's checkout left there, a finding discovery made
// for it, a question asked at its place linking an asset, its build's log,
// and a call for 1.1 citing it; the quick-fix shipped, its pull request
// opened; the quick-fix begun, its fix 1.1 closed before its commit and 1.2
// started with none; the bugfix hunt in its investigation, its log written
// and a finding citing it; and beside them an epic, a feature, a quick-fix
// today's scoping made, and bugfixes past their spec, concluded and not
// begun. The knowledge base is keyword-only.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, okSections, output, refuses, refusedPristine, git, stateGit, statePath, layout, writeState, readState, readManifest, createFile, commitAll, fixtureFrom, cleanupFixture,
  head, sectionOf, keywordOnlyKnowledge, killedAt, STATE_DIR_NAME,
} = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');
const { recordFile } = require('./quick-fix-world.cjs');
const store = require('../../skills/leeway-engine/scripts/kernel/knowledge/store.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { taskBranch, quickFixBranch, isUnitBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { callsOf } = require(path.join(SCRIPTS, 'domain/build-screens.cjs'));
const { quickFixLanding } = require(path.join(SCRIPTS, 'domain/landing.cjs'));
const { RECORDS } = require(path.join(SCRIPTS, 'domain/brief-records.cjs'));
const { unitHistory } = require(path.join(SCRIPTS, 'domain/state-history.cjs'));

const QF = 'typo';
const SHIPPED = 'shipped';
const BEGUN = 'begun';
const BUG = 'hunt';
const EPIC = 'payments';
const ENGINE = 'node .claude/skills/leeway-engine/scripts/engine.cjs';
const NOTE = layout.inbox('quickfixes', '2026-06-03--colour-flag.md');
const TITLE = 'Spell the flag --colour';
const BRANCH = quickFixBranch(QF);
const KEPT = `moved/${BRANCH}`;
const SHOT = `${QF}/assets/shot.png`;
const KEEP = 'Keep the flag short';
const RECORD = Object.freeze({ changed: 'The flag reads --colour.', why: 'It was spelt the American way.', leaves: 'Nothing.' });
const STAGED = layout.cache('product', 'discovery', 'product', 'start-this-work.json');
const INVESTIGATION_LOG = layout.unit(BUG, 'topics', BUG, 'log.md');
const BUILD_LOG = layout.unit(QF, 'build', 'log.md');
const EARLIER = (unit, name) => layout.unit(unit, 'topics', unit, 'earlier', name);

/** A task file, its one scenario `{n}.S1`. @param {number} n @param {string} title @param {string} [type] */
const fixFile = (n, title, type = 'fix') => [
  `# ${title}`, '', '## Type', type, '', '## Problem', 'It is spelt wrong.', '', '## Solution', 'Spell it right.', '',
  '## Outcome', 'It is spelt right.', '', '## Acceptance scenarios', `- ${n}.S1 Given the help, when it is read, then it is spelt right.`, '', '## Spec reference', 'none',
].join('\n');

/** The ids the world's lines were made under, filled as it is first built. */
const made = { discovered: '', asked: '', settled: '', call: '', found: '' };

/**
 * A quick-fix made from `seed`, entered by a conversation gone since, its
 * fix 1.1 created and started there — putting the checkout on its branch —
 * and its change to `file` committed through the door, where one is named;
 * then `then`, run as that conversation.
 * @param {string} dir @param {string} unit @param {string} title @param {string|null} file
 * @param {(as: {env: Record<string, string|undefined>}) => void} [then]
 */
function startedFix(dir, unit, title, file, then = () => {}) {
  const gone = fs.mkdtempSync(path.join(os.tmpdir(), 'workunit-move-world-'));
  const as = { env: { LEEWAY_CONFIG_DIR: gone, CLAUDE_CODE_SESSION_ID: 'gone', TMUX: undefined, TMUX_PANE: undefined } };
  try {
    const log = writeState(dir, layout.cache(unit, 'session-001.md'), '# Discovery Session 001\n');
    ok(dir, ['workunit', 'create', unit, 'quick-fix', '--description', `The ${unit} change`, '--session-log-file', log, ...(unit === QF ? ['--seed', `.leeway/${NOTE}`] : [])]);
    okSections(dir, ['enter', 'implementation', unit], as);
    ok(dir, ['presence', 'clear', unit, 'implementation', unit], as);
    ok(dir, ['task', 'create', unit, '1', '--file', writeState(dir, layout.cache(`${unit}-fix.md`), fixFile(1, title))]);
    ok(dir, ['task', 'start', unit, '1.1'], as);
    if (file !== null) {
      createFile(dir, file, `// ${title}\n`);
      ok(dir, ['commit', '--paths', file, '--task', unit, '1.1', '-m', `fix(${unit}): ${title.toLowerCase()}`], as);
    }
    then(as);
  } finally {
    fs.rmSync(gone, { recursive: true, force: true });
  }
}

const world = fixtureFrom('workunit-move-', (dir) => {
  keywordOnlyKnowledge(dir);
  createFile(dir, 'src/flag.js', 'const flag = \'color\';\n');
  for (const phase of ['implementation', 'discussion', 'investigation']) createFile(dir, `.claude/skills/leeway-${phase}-process/SKILL.md`, `# ${phase}\n`);
  writeState(dir, NOTE, '# The colour flag\n');
  createManifest(dir, BUG, { work_type: 'bugfix' });
  writeState(dir, layout.brief(BUG, BUG), '# Hunt\n\nThe bug as discovery heard it.\n');
  createManifest(dir, EPIC, { work_type: 'epic', phases: { discovery: { items: { 'fee-model': { source: 'discovery', summary: 'Fees' } } } } });
  createManifest(dir, 'notes', {});
  createManifest(dir, 'scoped', { work_type: 'quick-fix', phases: { scoping: { items: { scoped: { status: 'in-progress' } } } } });
  createManifest(dir, 'specced', { work_type: 'bugfix', phases: { investigation: { items: { specced: { status: 'completed' } } } } });
  writeState(dir, layout.unit('specced', 'spec.md'), '# Spec\n');
  createManifest(dir, 'fixed', { work_type: 'bugfix', phases: { investigation: { items: { fixed: { status: 'completed' } } } } });
  createManifest(dir, 'fresh', { work_type: 'bugfix' });
  createManifest(dir, 'small', { work_type: 'quick-fix' });
  createManifest(dir, 'concern', { work_type: 'cross-cutting' });
  createManifest(dir, 'parked', { work_type: 'quick-fix', status: 'cancelled' });
  commitAll(dir, 'the world');

  startedFix(dir, SHIPPED, 'Ship the flag', 'src/ship.js');
  ok(dir, ['land', 'open', SHIPPED, '1.1']);
  startedFix(dir, BEGUN, 'Trim the flag', null, (as) => {
    ok(dir, ['task', 'close', BEGUN, '1.1', '--reason', 'Not needed.'], as);
    ok(dir, ['task', 'create', BEGUN, '1', '--file', writeState(dir, layout.cache(`${BEGUN}-fix-2.md`), fixFile(2, KEEP))]);
    ok(dir, ['task', 'start', BEGUN, '1.2'], as);
  });
  startedFix(dir, QF, TITLE, 'src/flag.js', () => ok(dir, ['quick-fix', 'record', QF, '1.1', '--file', recordFile(dir, 1, RECORD)]));

  const { write } = ledgerHelpers(() => dir);
  made.discovered = write('find', `${QF}.discovery`, [], { ...MADE, text: 'The flag is spelt three ways.', how: 'Grep.', known: 'read' }).id;
  made.asked = write('ask', `${QF}.implementation`, [], { ...MADE, text: 'Should --color still work?' }).id;
  writeState(dir, SHOT, 'the help, spelt\n');
  ok(dir, ['asset', 'add', QF, SHOT, '--entry', made.asked, '--status', 'canonical'], { env: { CLAUDE_CODE_SESSION_ID: 'gone' } });
  writeState(dir, BUILD_LOG, '# Build log\n\n## Fix 1.1\n\nThe help reads colour.\n');
  made.settled = write('ask', `${QF}.implementation`, [], { ...MADE, text: 'Which spelling does the help use?' }).id;
  made.call = write('decide', `${QF}.implementation`, ['--answers', made.settled, '--task', '1.1'], {
    ...MADE, text: 'The help says colour.', why: 'The flag is colour.', cites: [{ path: BUILD_LOG, section: 'Fix 1.1' }],
  }).id;
  ok(dir, ['commit', QF, '-m', 'build(typo): the log so far']);

  ok(dir, ['enter', 'investigation', BUG], { env: { CLAUDE_PID: undefined } });
  ok(dir, ['investigation-log', 'symptom', BUG, '--text', 'Restore brings nothing back after a kill']);
  made.found = write('find', `${BUG}.investigation.${BUG}`, [], {
    ...MADE, text: 'Every save takes the session list as the whole truth.', how: 'Read the capture.', known: 'read', cites: [{ path: INVESTIGATION_LOG, section: 'Symptoms' }],
  }).id;
  ok(dir, ['commit', BUG, '-m', 'investigation(hunt): the hunt so far']);
});

let dir = ''; // the project
const config = useTempFolder('workunit-move-config-');

afterEach(() => {
  cleanupFixture(dir);
});

/** The engine as this test's conversation runs it. */
const env = () => ({ LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

/** Claude's payload for a move, its brief drafted in the cache: the payload's path. @param {string} unit @param {string} to */
function payload(unit, to) {
  const brief = writeState(dir, layout.cache('scratch', `${unit}-brief.md`), `# ${unit}\n\nWhat the work showed.\n`);
  return writeState(dir, layout.cache('scratch', `${unit}-move.json`), JSON.stringify({
    description: `The ${unit} work, as ${to} work.`, reason: 'It needs a decision from you beyond a quick call.', brief,
  }));
}

/** The move staged and its screen drawn: the response and the sections. @param {string} unit @param {string} to */
const staged = (unit, to) => okSections(dir, ['workunit', 'move', unit, '--to', to, '--file', payload(unit, to)], { env: env() });

/** The move staged, and the yes its screen's gate leads to run. @param {string} unit @param {string} to */
function moved(unit, to) {
  staged(unit, to);
  const { next } = ok(dir, ['gate', 'start this work', '--pick', 'y'], { env: env() });
  return ok(dir, next.argv, { env: env() });
}

/** The move's stage refused, nothing written: its error. @param {string} unit @param {string} to */
function refusedStage(unit, to) {
  const file = payload(unit, to);
  return refusedPristine(dir, ['workunit', 'move', unit, '--to', to, '--file', file], { env: env() }).error;
}

/** The branch the project's checkout has out. */
const branchOut = () => git(dir, ['symbolic-ref', '--short', 'HEAD']).trim();

/** The quick-fix's fixes as the tracker lists them. */
const fixes = () => ok(dir, ['task', 'list', QF, '1']).tasks.map(({ task, status }) => ({ task, status }));

/** The distinct work types the knowledge base's chunks of `unit` carry. @param {string} unit */
function chunkTypes(unit) {
  const chunks = store.allChunks(store.loadStore(statePath(dir, '.knowledge/store.bin')));
  return [...new Set(chunks.filter((chunk) => chunk.work_unit === unit).map((chunk) => chunk.work_type))];
}

/** The ledger's lines, parsed. */
const ledgerLines = () => readState(dir, layout.ledger).trim().split('\n').map((line) => JSON.parse(line));

/** The DATA lines an entry's sections give of what a topic holds from before it. @param {string} sections */
const earlierReads = (sections) => sections.split('\n').filter((line) => /^(earlier [a-z ]+|kept branch): /.test(line));

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
    assert.deepStrictEqual([head(dir), readState(dir, layout.manifest(QF)), JSON.parse(readState(dir, STAGED)).moves], [before.head, before.manifest, { from: 'quick-fix', branches: [KEPT] }]);
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

    assert.deepStrictEqual([res.fixes_closed, res.pull_request_closed, res.branches, git(dir, ['rev-parse', `moved/${quickFixBranch(SHIPPED)}`]).trim(), quickFixLanding(dir, SHIPPED).pull().open], [
      ['1.1'], true, [`moved/${quickFixBranch(SHIPPED)}`], at, null,
    ]);
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

describe('what the new type\'s build meets: nothing of the fixes (19.5.16)', () => {
  /** Task 1.1 of the moved quick-fix created from a task file of `type`: its answer. @param {string} type @param {string} title */
  function firstTask(type, title) {
    ok(dir, ['task', 'phase', QF, '1', '--title', 'The flag']);
    return ok(dir, ['task', 'create', QF, '1', '--file', writeState(dir, layout.cache(`${QF}-task.md`), fixFile(1, title, type))]);
  }

  it('a quick-fix moved mid-fix to a feature: its build writes phase 1 and lays task 1.1\'s branch, the fix\'s kept branch untouched and read by no landing as the unit\'s', () => {
    dir = world();
    const fixCommit = git(dir, ['rev-parse', BRANCH]).trim();
    moved(QF, 'feature');
    const title = 'Take both spellings';
    assert.strictEqual(firstTask('feat', title).task, '1.1');
    ok(dir, ['task', 'start', QF, '1.1'], { env: env() });
    const tree = path.join(fs.realpathSync(config()), 'builder');
    git(dir, ['worktree', 'add', '-q', '-b', 'worktree-agent-builder', tree, 'HEAD']);
    const laid = ok(tree, ['task', 'worktree', QF, '1.1'], { env: env() });

    assert.deepStrictEqual([laid.branch, git(dir, ['rev-parse', KEPT]).trim(), isUnitBranch(QF, KEPT)], [taskBranch({ unit: QF, phase: 1, n: 1 }, 'feat', title), fixCommit, false]);
  });

  it('a quick-fix moved to a bugfix: its reproducing task, 1.1, created', () => {
    dir = world();
    moved(QF, 'bugfix');

    const created = firstTask('test', 'Prove the flag is misspelt');

    assert.deepStrictEqual([created.task, ok(dir, ['task', 'list', QF, '1']).tasks.map(({ task, title, status }) => [task, title, status])], ['1.1', [['1.1', 'Prove the flag is misspelt', 'open']]]);
  });
});

describe('the yes: a bugfix moved to a feature (19.S30, 19.4.22)', () => {
  it('re-types it in place, its investigation item dropped and its brief rewritten, its lines carried to the discussion and its log set aside, the finding citing it following, and hands off into the discussion — whose first opening reads the investigation\'s log and the topic\'s record as its earlier ones, keeping a log of its own', () => {
    dir = world();
    const investigated = readState(dir, INVESTIGATION_LOG);
    const res = moved(BUG, 'feature');

    assert.deepStrictEqual([res.fixes_closed, res.branches, res.checkout, res.next], [[], [], null, { kind: 'handoff', skill: 'leeway-discussion-process', args: ['feature', BUG] }]);
    const manifest = readManifest(dir, BUG);
    assert.deepStrictEqual([manifest.work_type, manifest.phases], ['feature', { discussion: { items: { [BUG]: { status: 'unstarted' } } } }]);
    assert.deepStrictEqual(readManifest(dir, '.').work_units[BUG], { work_type: 'feature' });
    assert.strictEqual(readState(dir, layout.brief(BUG, BUG)), '# hunt\n\nWhat the work showed.\n');
    const { v: _v, id: _id, at: _at, ...carry } = ledgerLines().at(-1);
    assert.deepStrictEqual(carry, {
      event: 'rehomed', unit: BUG, topic: BUG, phase: 'discussion', session: 'sess-1',
      lines: [ledgerLines().find((l) => l.id.startsWith(made.found)).id], files: [[INVESTIGATION_LOG, EARLIER(BUG, 'investigation-log.md')]],
    });
    assert.deepStrictEqual([fs.existsSync(statePath(dir, INVESTIGATION_LOG)), readState(dir, EARLIER(BUG, 'investigation-log.md'))], [false, investigated]);

    const { sections } = okSections(dir, ['enter', 'discussion', BUG], { env: env() });
    assert.deepStrictEqual(earlierReads(sections), [`earlier record: \`${ENGINE} ledger record ${BUG} ${BUG}\``, `earlier log: ${statePath(dir, EARLIER(BUG, 'investigation-log.md'))}`]);
    assert.deepStrictEqual(ok(dir, ['ledger', 'record', BUG, BUG]).findings.map((f) => [f.text, f.phase, f.cites.map((c) => c.path)]), [
      ['Every save takes the session list as the whole truth.', 'discussion', [EARLIER(BUG, 'investigation-log.md')]],
    ]);
    assert.ok(sections.includes(`\nlog: ${statePath(dir, INVESTIGATION_LOG)}\n`), 'the discussion keeps a log of its own, where the investigation\'s was');
  });
});

describe('what the move refuses (19.5.9, 19.4.22, P7)', () => {
  it('refuses a type that does not move, a move its type does not take, a unit not in progress or of a type the reshape retires, a quick-fix its old scoping made, a unit past its spec, and a bugfix away from its investigation — each at the stage, nothing written', () => {
    dir = world();
    assert.deepStrictEqual([
      refusedStage(EPIC, 'feature'),
      refusedStage('notes', 'bugfix'),
      refusedStage(BUG, 'bugfix'),
      refusedStage(QF, 'epic'),
      refusedStage('parked', 'feature'),
      refusedStage('concern', 'feature'),
      refusedStage('scoped', 'feature'),
      refusedStage('specced', 'feature'),
      refusedStage('fixed', 'feature'),
      refusedStage('fresh', 'feature'),
    ], [
      `${EPIC} is an epic, which moves nowhere — a quick-fix moves to a feature or a bugfix, and a bugfix to a feature`,
      'notes is a feature, which moves nowhere — a quick-fix moves to a feature or a bugfix, and a bugfix to a feature',
      `${BUG} is a bugfix, which moves to a feature — not to "bugfix"`,
      `${QF} is a quick-fix, which moves to a feature or a bugfix — not to "epic"`,
      'parked is cancelled — only work in progress moves',
      'concern is a cross-cutting unit, a type the reshape retires — it waits on the reshape\'s 29.17 migration, and nothing is done in it until then',
      'scoped was scoped under the old plan, and moves once the reshape\'s 29.17 migration has cut it',
      'specced has its spec — it carries on as work of its own',
      'a bugfix moves to a feature from its investigation, and fixed\'s has concluded — the work carries on in its spec',
      'a bugfix moves to a feature from its investigation, and fresh\'s has not begun',
    ]);
  });

  it('checks the move again at the yes, against the unit as it stands, nothing moved: a fix of the quick-fix landed since the stage, the unit cancelled since, its spec written since, its investigation concluded since', () => {
    /** The yes refused after `change`, made between the stage and it: its error. @param {string} unit @param {() => void} change */
    function refusedYes(unit, change) {
      cleanupFixture(dir);
      dir = world();
      staged(unit, 'feature');
      change();
      return refusedPristine(dir, ['start-this-work', 'yes'], { env: env() }).error;
    }

    assert.deepStrictEqual([
      refusedYes(QF, () => git(dir, ['branch', '-f', 'main', BRANCH])),
      refusedYes(QF, () => ok(dir, ['workunit', 'cancel', QF])),
      refusedYes(BUG, () => writeState(dir, layout.unit(BUG, 'spec.md'), '# Spec\n')),
      refusedYes(BUG, () => ok(dir, ['manifest', 'set', `${BUG}.investigation.${BUG}`, 'status=completed'])),
    ], [
      `start-this-work yes: ${QF}'s fix 1.1 has landed — finish the quick-fix, then start the feature as work of its own`,
      `start-this-work yes: ${QF} is cancelled — only work in progress moves`,
      `start-this-work yes: ${BUG} has its spec — it carries on as work of its own`,
      `start-this-work yes: a bugfix moves to a feature from its investigation, and ${BUG}'s has concluded — the work carries on in its spec`,
    ]);
  });
});

describe('the yes run again (19.5.16)', () => {
  it('stopped before the manifests\' save, every step before it done, a second yes completes the move whole, its commit taking every path, and answers what it did itself — no fix closed, no branch kept, the checkout where the first left it', () => {
    dir = world();
    staged(QF, 'feature');
    killedAt({ method: 'renameSync', file: `${STATE_DIR_NAME}/manifest.json`, when: 'before' }, dir, ['start-this-work', 'yes'], { env: env() });
    const stopped = [readManifest(dir, QF).work_type, git(dir, ['branch', '--list', BRANCH]), fs.existsSync(statePath(dir, QF, 'build')), ledgerLines().at(-1).event];
    const res = ok(dir, ['start-this-work', 'yes'], { env: env() });

    assert.deepStrictEqual(stopped, ['quick-fix', '', false, 'rehomed']);
    const [first, again] = ledgerLines().filter((line) => line.event === 'rehomed');
    assert.deepStrictEqual(again.lines, first.lines, 'the second carry lists the same lines, never the first carry');
    assert.deepStrictEqual([res.work_type, res.fixes_closed, res.branches, res.checkout, readManifest(dir, '.').work_units[QF]], ['feature', [], [], null, { work_type: 'feature' }]);
    assert.deepStrictEqual([git(dir, ['branch', '--list', KEPT]).trim(), branchOut()], [KEPT, 'main']);
    assert.strictEqual(refuses(dir, ['task', 'list', QF, '1']).error, `phase 1 of ${QF} is not written`);
    const record = ok(dir, ['ledger', 'record', QF, QF]);
    assert.deepStrictEqual([record.questions.map((q) => [q.text, q.phase]), record.decisions.map((d) => d.cites.map((c) => c.path))], [
      [['Should --color still work?', 'discussion'], ['Which spelling does the help use?', 'discussion']],
      [[EARLIER(QF, 'build/log.md')]],
    ]);
    assert.deepStrictEqual([fs.existsSync(statePath(dir, STAGED)), stateGit(dir, ['status', '--porcelain'])], [false, '']);
  });
});

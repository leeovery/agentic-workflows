'use strict';

// ---------------------------------------------------------------------------
// A unit's move to another type (leeway-engine/scripts/domain/
// workunit-move.cjs; 19.4.22, 19.5.9, 19.5.16, P7): `workunit move` staging
// Claude's payload where start this work stages a start and drawing its
// screen, the names a quick-fix's fixes' branches are kept under in one
// line, nothing moved; the yes, `start-this-work yes`, moving the unit in
// place — re-typed in both manifests in one save, its brief written, a
// quick-fix's open fixes closed, its checkout taken back to the branch the
// fixes land on, its fixes' commits kept unlanded on their branches renamed
// under moved/ and a branch holding none deleted, the fixes' phase taken
// out of the tracker, its lines carried to the new topic, the knowledge
// base re-indexed, one commit — and handing off into the new type's first
// phase (19.S24, 19.S30, 24.1.2); the new type's build meeting nothing of
// the fixes — a feature's phase 1 written and task 1.1's branch laid, a
// bugfix's reproducing task 1.1 created, on the local landing driver; a
// bugfix's investigation log read at the feature's first opening as the
// topic's earlier log (enter.cjs); a moved quick-fix's lines read at the epic's
// topic once the feature it became is absorbed (ledger-rehomed.cjs); and
// every refusal, writing nothing: a fix's pull request opened, a checkout
// holding changes, a unit past its spec, a type that does not move, a
// bugfix away from its investigation.
//
// Layer: git. World: one project built once through the verbs and copied —
// the quick-fix typo, entered, its fix 1.1 started and committed on its
// branch, the project's checkout left there, a question asked at its place
// linking an asset; the quick-fix shipped, its fix's pull request opened;
// the quick-fix begun, its fix 1.1 started with nothing committed; the
// bugfix hunt in its investigation, its log written and a finding on it;
// and beside them an epic, a feature, a quick-fix today's scoping made,
// and bugfixes past their spec, concluded and not begun. The knowledge base
// is keyword-only.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, okSections, output, refuses, refusedPristine, git, stateGit, statePath, layout, writeState, readState, readManifest, createFile, commitAll, fixtureFrom, cleanupFixture,
  head, sectionOf, keywordOnlyKnowledge,
} = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');
const store = require('../../skills/leeway-engine/scripts/kernel/knowledge/store.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { taskBranch, isUnitBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));

const QF = 'typo';
const SHIPPED = 'shipped';
const BEGUN = 'begun';
const BUG = 'hunt';
const EPIC = 'payments';
const ENGINE = 'node .claude/skills/leeway-engine/scripts/engine.cjs';
const NOTE = layout.inbox('quickfixes', '2026-06-03--colour-flag.md');
const TITLE = 'Spell the flag --colour';
const BRANCH = taskBranch({ unit: QF, phase: 1, n: 1 }, 'fix', TITLE);
const KEPT = `moved/${BRANCH}`;
const SHOT = `${QF}/assets/shot.png`;
const STAGED = layout.cache('product', 'discovery', 'product', 'start-this-work.json');
const INVESTIGATION_LOG = layout.unit(BUG, 'topics', BUG, 'log.md');

/** A task file, its one scenario `{n}.S1`. @param {number} n @param {string} title @param {string} [type] */
const fixFile = (n, title, type = 'fix') => [
  `# ${title}`, '', '## Type', type, '', '## Problem', 'It is spelt wrong.', '', '## Solution', 'Spell it right.', '',
  '## Outcome', 'It is spelt right.', '', '## Acceptance scenarios', `- ${n}.S1 Given the help, when it is read, then it is spelt right.`, '', '## Spec reference', 'none',
].join('\n');

/** The ids the world's lines were made under, filled as it is first built. */
const made = { asked: '', link: '', found: '' };

/**
 * A quick-fix made from `seed`, entered by a conversation gone since, its
 * fix 1.1 created and started there — putting the checkout on its branch —
 * and, given the code file it changes, its change committed through the door.
 * @param {string} dir @param {string} unit @param {string} title @param {string} [file]
 */
function startedFix(dir, unit, title, file) {
  const gone = fs.mkdtempSync(path.join(os.tmpdir(), 'workunit-move-world-'));
  const as = { env: { LEEWAY_CONFIG_DIR: gone, CLAUDE_CODE_SESSION_ID: 'gone', TMUX: undefined, TMUX_PANE: undefined } };
  try {
    const log = writeState(dir, layout.cache(unit, 'session-001.md'), '# Discovery Session 001\n');
    ok(dir, ['workunit', 'create', unit, 'quick-fix', '--description', `The ${unit} change`, '--session-log-file', log, ...(unit === QF ? ['--seed', `.leeway/${NOTE}`] : [])]);
    okSections(dir, ['enter', 'implementation', unit], as);
    ok(dir, ['presence', 'clear', unit, 'implementation', unit], as);
    ok(dir, ['task', 'create', unit, '1', '--file', writeState(dir, layout.cache(`${unit}-fix.md`), fixFile(1, title))]);
    ok(dir, ['task', 'start', unit, '1.1'], as);
    if (file === undefined) return;
    createFile(dir, file, `// ${title}\n`);
    ok(dir, ['commit', '--paths', file, '--task', unit, '1.1', '-m', `fix(${unit}): ${title.toLowerCase()}`], as);
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
  startedFix(dir, BEGUN, 'Trim the flag');
  startedFix(dir, QF, TITLE, 'src/flag.js');

  const { write } = ledgerHelpers(() => dir);
  made.asked = write('ask', `${QF}.implementation`, [], { ...MADE, text: 'Should --color still work?' }).id;
  writeState(dir, SHOT, 'the help, spelt\n');
  made.link = ok(dir, ['asset', 'add', QF, SHOT, '--entry', made.asked, '--status', 'canonical'], { env: { CLAUDE_CODE_SESSION_ID: 'gone' } }).id;

  ok(dir, ['enter', 'investigation', BUG], { env: { CLAUDE_PID: undefined } });
  ok(dir, ['investigation-log', 'symptom', BUG, '--text', 'Restore brings nothing back after a kill']);
  made.found = write('find', `${BUG}.investigation.${BUG}`, [], { ...MADE, text: 'Every save takes the session list as the whole truth.', how: 'Read the capture.', known: 'read' }).id;
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

describe('workunit move, the stage (19.5.9, P7)', () => {
  it('stages the move where start this work stages a start and draws its screen, the quick-fix\'s fix\'s branch named in one line — nothing moved, and the gate\'s yes is start this work\'s', () => {
    dir = world();
    const before = { head: head(dir), manifest: readState(dir, layout.manifest(QF)) };
    const { res, sections } = staged(QF, 'feature');

    assert.deepStrictEqual(res, { ok: true, work_unit: QF, from: 'quick-fix', to: 'feature' });
    assert.strictEqual(sectionOf(sections, 'DISPLAY: start this work'), [
      'Typo (feature)',
      'The typo work, as feature work.',
      '↳ It needs a decision from you beyond a quick call.',
      '⚑ Its fix\'s commits stay unlanded on',
      `  ${KEPT}`,
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
  it('re-types it in place in both manifests, writes its brief, closes its open fix, takes the checkout back to main, keeps the fix\'s commit unlanded on its branch renamed under moved/, takes its phase out of the tracker, carries its lines to the topic, re-indexes it, commits once, and hands off into the feature\'s discussion', () => {
    dir = world();
    assert.deepStrictEqual(chunkTypes(QF), ['quick-fix']);
    const fixCommit = git(dir, ['rev-parse', BRANCH]).trim();
    const res = moved(QF, 'feature');

    assert.deepStrictEqual(res, {
      ok: true,
      work_unit: QF,
      work_type: 'feature',
      from: 'quick-fix',
      brief: statePath(dir, layout.brief(QF, QF)),
      fixes_closed: ['1.1'],
      branches: [KEPT],
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
    assert.deepStrictEqual(carry, { event: 'rehomed', unit: QF, topic: QF, phase: 'discussion', session: 'sess-1', lines: [ledgerLines().find((l) => l.id.startsWith(made.asked)).id, ledgerLines().find((l) => l.event === 'asset').id], files: [] });
    const record = ok(dir, ['ledger', 'record', QF, QF]);
    assert.deepStrictEqual([record.questions.map((q) => [q.unit, q.topic, q.phase]), record.questions[0].assets.map((a) => a.path)], [[[QF, QF, 'implementation']], [SHOT]]);
    assert.deepStrictEqual(chunkTypes(QF), ['feature']);
    assert.deepStrictEqual(stateGit(dir, ['log', '-2', '--format=%s']).trim().split('\n'), [`workflow(${QF}): move quick-fix to feature`, `task(${QF}): close 1.1`]);
    assert.deepStrictEqual([fs.existsSync(statePath(dir, STAGED)), stateGit(dir, ['status', '--porcelain'])], [false, '']);
  });

  it('to a bugfix, carries its lines to the investigation and hands off into it', () => {
    dir = world();
    const res = moved(QF, 'bugfix');

    assert.deepStrictEqual([res.work_type, res.next], ['bugfix', { kind: 'handoff', skill: 'leeway-investigation-process', args: ['bugfix', QF] }]);
    assert.deepStrictEqual([ledgerLines().at(-1).event, ledgerLines().at(-1).phase], ['rehomed', 'investigation']);
    assert.deepStrictEqual(readManifest(dir, '.').work_units[QF], { work_type: 'bugfix' });
  });

  it('refuses while the checkout holds changes not committed, naming each, nothing moved — the fix still in progress, the checkout on its branch', () => {
    dir = world();
    staged(QF, 'feature');
    createFile(dir, 'src/help.js', 'const help = 1;\n');
    const { next } = ok(dir, ['gate', 'start this work', '--pick', 'y'], { env: env() });
    const { error } = refusedPristine(dir, next.argv, { env: env() });

    assert.strictEqual(error, `start-this-work yes: ${QF}'s fixes leave the project's checkout, which holds changes not committed — src/help.js — so it was not taken back to main: commit them on the fix's branch or set them aside, then say yes again`);
    assert.deepStrictEqual([readManifest(dir, QF).work_type, fixes(), branchOut()], ['quick-fix', [{ task: '1.1', status: 'in-progress' }], BRANCH]);
  });

  it('refuses a quick-fix holding lines where no conversation names the session the carry is made in, nothing moved', () => {
    dir = world();
    staged(QF, 'feature');
    const { error } = refusedPristine(dir, ['start-this-work', 'yes'], { env: { ...env(), CLAUDE_CODE_SESSION_ID: undefined } });

    assert.strictEqual(error, `start-this-work yes: ${QF} holds ledger entries, which the move carries to its topic in this conversation — Claude Code hands every command it runs a session id, and this one has none`);
    assert.deepStrictEqual([fixes(), branchOut()], [[{ task: '1.1', status: 'in-progress' }], BRANCH]);
  });

  it('refuses a quick-fix whose fix has its pull request opened, or landed, as the landing driver reads it — however the tracker holds the fix: it is finished first', () => {
    dir = world();
    const refusal = `${SHIPPED}'s fix 1.1 has its pull request opened — finish the quick-fix, then start the feature as work of its own`;
    const opened = refusedStage(SHIPPED, 'feature');
    ok(dir, ['land', 'phase', SHIPPED, '1']);

    assert.deepStrictEqual([opened, refusedStage(SHIPPED, 'feature')], [refusal, refusal]);
    assert.strictEqual(ok(dir, ['task', 'list', SHIPPED, '1']).tasks[0].status, 'in-progress');
  });

  it('a quick-fix whose fixes have not begun moves leaving the checkout where it is, on another unit\'s branch, and closes nothing', () => {
    dir = world();
    const res = moved('small', 'feature');

    assert.deepStrictEqual([res.fixes_closed, res.branches, res.checkout, branchOut()], [[], [], null, BRANCH]);
    assert.deepStrictEqual(readManifest(dir, 'small').phases, { discussion: { items: { small: { status: 'unstarted' } } } });
  });

  it('deletes a fix\'s branch holding nothing the branch the fixes land on lacks, keeping none, and leaves the checkout on another unit\'s branch', () => {
    dir = world();
    const res = moved(BEGUN, 'feature');

    assert.deepStrictEqual([res.fixes_closed, res.branches, res.checkout, branchOut()], [['1.1'], [], null, BRANCH]);
    assert.deepStrictEqual([git(dir, ['branch', '--list', `*/${BEGUN}-*`]), git(dir, ['branch', '--list', `moved/*/${BEGUN}-*`])], ['', '']);
  });

  it('a feature it became, absorbed into an epic, has its lines read at the epic\'s topic, the file they link where the absorb moved it — the later carry winning', () => {
    dir = world();
    moved(QF, 'feature');
    ok(dir, ['enter', 'discussion', QF], { env: env() });
    writeState(dir, layout.unit(QF, 'topics', QF, 'log.md'), '# Typo\n');
    ok(dir, ['workunit', 'absorb', QF, '--into', EPIC, '--topic', 'colour'], { env: env() });

    const record = ok(dir, ['ledger', 'record', EPIC, 'colour']);
    assert.deepStrictEqual(record.questions.map((q) => [q.text, q.unit, q.topic, q.assets.map((a) => a.path)]), [['Should --color still work?', EPIC, 'colour', [`${EPIC}/assets/shot.png`]]]);
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
  it('re-types it in place, its investigation item dropped and its brief rewritten, carrying nothing, and hands off into the discussion — whose first opening reads the investigation\'s log and the topic\'s record as the topic\'s earlier ones', () => {
    dir = world();
    const lines = readState(dir, layout.ledger);
    const res = moved(BUG, 'feature');

    assert.deepStrictEqual([res.fixes_closed, res.branches, res.checkout, res.next], [[], [], null, { kind: 'handoff', skill: 'leeway-discussion-process', args: ['feature', BUG] }]);
    const manifest = readManifest(dir, BUG);
    assert.deepStrictEqual([manifest.work_type, manifest.phases], ['feature', { discussion: { items: { [BUG]: { status: 'unstarted' } } } }]);
    assert.deepStrictEqual(readManifest(dir, '.').work_units[BUG], { work_type: 'feature' });
    assert.strictEqual(readState(dir, layout.brief(BUG, BUG)), '# hunt\n\nWhat the work showed.\n');
    assert.strictEqual(readState(dir, layout.ledger), lines, 'its lines are its topic\'s already');

    const { sections } = okSections(dir, ['enter', 'discussion', BUG], { env: env() });
    assert.ok(sections.includes(`earlier record: \`${ENGINE} ledger record ${BUG} ${BUG}\`\nearlier log: ${statePath(dir, INVESTIGATION_LOG)}\n`), sections);
    assert.deepStrictEqual(ok(dir, ['ledger', 'record', BUG, BUG]).findings.map((f) => f.text), ['Every save takes the session list as the whole truth.']);
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
});

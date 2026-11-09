'use strict';

// ---------------------------------------------------------------------------
// The world the workunit move suites share (test-engine-workunit-move and
// -move-after): one project built once through the verbs and copied — the
// quick-fix typo, entered, its fix 1.1 started, committed on its branch and
// recorded, the project's checkout left there, a finding discovery made for
// it, a question asked at its place linking an asset, its build's log, and
// a call for 1.1 citing it; the quick-fix shipped, its pull request opened;
// the quick-fix begun, its fix 1.1 closed before its commit and 1.2 started
// with none; the bugfix hunt in its investigation, its log written and a
// finding citing it; and beside them an epic, a feature, a quick-fix
// today's scoping made, and bugfixes past their spec, concluded and not
// begun. The knowledge base is keyword-only. And the calls a test makes in
// its conversation, whose records it keeps in a config folder of its own.
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, okSections, refusedPristine, git, statePath, layout, writeState, readState, createFile,
  commitAll, fixtureFrom, keywordOnlyKnowledge,
} = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');
const { recordFile } = require('./quick-fix-world.cjs');
const store = require('../../skills/leeway-engine/scripts/kernel/knowledge/store.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { quickFixBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));

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

/**
 * The calls a suite's tests make in their conversation, in the project
 * `at` names.
 * @param {() => string} at
 */
function moveHelpers(at) {
  const config = useTempFolder('workunit-move-config-');

  /** The engine as this test's conversation runs it. */
  const env = () => ({ LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

  /** Claude's payload for a move, its brief drafted in the cache: the payload's path. @param {string} unit @param {string} to */
  function payload(unit, to) {
    const brief = writeState(at(), layout.cache('scratch', `${unit}-brief.md`), `# ${unit}\n\nWhat the work showed.\n`);
    return writeState(at(), layout.cache('scratch', `${unit}-move.json`), JSON.stringify({
      description: `The ${unit} work, as ${to} work.`, reason: 'It needs a decision from you beyond a quick call.', brief,
    }));
  }

  /** The move staged and its screen drawn: the response and the sections. @param {string} unit @param {string} to */
  const staged = (unit, to) => okSections(at(), ['workunit', 'move', unit, '--to', to, '--file', payload(unit, to)], { env: env() });

  /** The move staged, and the yes its screen's gate leads to run. @param {string} unit @param {string} to */
  function moved(unit, to) {
    staged(unit, to);
    const { next } = ok(at(), ['gate', 'start this work', '--pick', 'y'], { env: env() });
    return ok(at(), next.argv, { env: env() });
  }

  /** The move's stage refused, nothing written: its error. @param {string} unit @param {string} to */
  function refusedStage(unit, to) {
    const file = payload(unit, to);
    return refusedPristine(at(), ['workunit', 'move', unit, '--to', to, '--file', file], { env: env() }).error;
  }

  /** The branch the project's checkout has out. */
  const branchOut = () => git(at(), ['symbolic-ref', '--short', 'HEAD']).trim();

  /** The quick-fix's fixes as the tracker lists them. */
  const fixes = () => ok(at(), ['task', 'list', QF, '1']).tasks.map(({ task, status }) => ({ task, status }));

  /** The distinct work types the knowledge base's chunks of `unit` carry. @param {string} unit */
  function chunkTypes(unit) {
    const chunks = store.allChunks(store.loadStore(statePath(at(), '.knowledge/store.bin')));
    return [...new Set(chunks.filter((chunk) => chunk.work_unit === unit).map((chunk) => chunk.work_type))];
  }

  /** The ledger's lines, parsed. */
  const ledgerLines = () => readState(at(), layout.ledger).trim().split('\n').map((line) => JSON.parse(line));

  /** The DATA lines an entry's sections give of what a topic holds from before it. @param {string} sections */
  const earlierReads = (sections) => sections.split('\n').filter((line) => /^(earlier [a-z ]+|kept branch): /.test(line));

  return { config, env, payload, staged, moved, refusedStage, branchOut, fixes, chunkTypes, ledgerLines, earlierReads };
}

module.exports = {
  QF, SHIPPED, BEGUN, BUG, EPIC, ENGINE, NOTE, TITLE, BRANCH, KEPT, SHOT, KEEP, RECORD, STAGED, INVESTIGATION_LOG, BUILD_LOG, EARLIER, fixFile, made, world, moveHelpers,
};

'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's one checkout, held by one fix at a time (19.5.23;
// leeway-engine/scripts/domain/fix-aside.cjs, task-verbs.cjs's `stepTurn`):
// a builder's question parking the fix that holds it setting aside what it
// had not committed, its untracked files among it, at a ref of the unit's
// own, the checkout left clean at the branch's tip for the next fix; the
// fix freed while another holds the checkout waiting on it — its answer's
// receipt, `task ready`, its start and its briefs each naming the fix in
// flight; then started again, what it set aside put back onto the tip as it
// stands, and its pair reading its own commits alone, the other fix's
// between them left out (task-base.cjs, `ownWork`); a put back that
// conflicts refused, nothing moved; a raise parking a fix that waits behind
// another setting nothing aside; and a fix closed dropping what it set
// aside. Its figures and its account, read through the task loop's own
// calls: test-pipeline-simulation-quick-fix-parked.cjs.
//
// Layer: git. World: quick-fix-world.cjs's quick-fix, entered by a
// conversation gone since, its fix 1.1 created and started there, and a
// question asked at its place — built once and copied. Each test's
// conversation keeps its records in a config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, okSections, okSectionsAsync, refusedPristine, git, createFile, fixtureFrom, cleanupFixture, withEnv,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');
const { UNIT, PLACE, FLAG, HELP, BRANCH, quickFix, createFix, fixDone, asGone, entered: enteredBy } = require('./quick-fix-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { briefPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));

/** Where fix 1.1's work is set aside. */
const ASIDE = `refs/leeway/aside/${UNIT}/${UNIT}-1-1`;

/** The builder's question, as a raise puts it. */
const CALL = Object.freeze({
  question: 'Should --color still work?',
  rows: [
    { key: '1', name: 'Alias', text: 'Keep --color as an alias', notice: 'old scripts keep working' },
    { key: '2', name: 'Gone', text: 'Drop --color', notice: 'old scripts fail on the flag' },
  ],
  lean: '1',
  why: 'Scripts in the wild pass --color.',
  sort: 'several',
  mechanism: 'The flag parser maps --color onto --colour.',
  product_wide: false,
});

/** The questions the world asks at the quick-fix's place: their short ids. */
const asked = { first: '', second: '' };

const world = fixtureFrom('quick-fix-checkout-', (dir) => {
  quickFix(dir);
  asGone((as) => {
    enteredBy(dir, as);
    createFix(dir, 1, FLAG);
    ok(dir, ['task', 'start', UNIT, '1.1'], as);
  });
  const { write } = ledgerHelpers(() => dir);
  asked.first = write('ask', PLACE, [], { ...MADE, text: 'Does --color still work?' }).id;
  asked.second = write('ask', PLACE, [], { ...MADE, text: 'Does the man page name it?' }).id;
});

let dir = ''; // the project, fix 1.1 taken into this test's conversation
const config = useTempFolder('quick-fix-checkout-config-');

afterEach(() => {
  cleanupFixture(dir);
});

/** The engine as this test's conversation runs it. */
const env = () => ({ LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

/** A call that must succeed, in this test's conversation. @param {string[]} args */
const run = (args) => ok(dir, args, { env: env() });

/** A call's refusal, nothing written or committed. @param {string[]} args */
const refused = (args) => refusedPristine(dir, args, { env: env() }).error;

/** A file of the project, written. @param {string} file @param {string} text */
const written = (file, text) => createFile(dir, file, text);

/** `files` committed through the door for `task`: the commit, short. @param {string} task @param {string[]} files @param {string} subject */
function committed(task, files, subject) {
  run(['commit', '--paths', ...files, '--task', UNIT, task, '-m', `fix(${UNIT}): ${subject}`]);
  return git(dir, ['rev-parse', '--short=7', 'HEAD']).trim();
}

/** The builder's question `question` parking `task`: the raise's answer. @param {string} question @param {string} task */
const parked = async (question, task) => (await okSectionsAsync(dir, ['raise', PLACE, '--answers', question, '--parks', task], { env: env(), stdin: JSON.stringify(CALL) })).res;

/** The person's answer to `Q{n}`, its first row: the answer's receipt. @param {string} name */
function answered(name) {
  const { raise } = okSections(dir, ['raise', 'draw', UNIT, name], { env: env() }).res;
  return ok(dir, ['raise', 'answer', raise, '--pick', '1'], { env: env(), stdin: JSON.stringify({ why: 'Old scripts pass it.' }) }).receipt;
}

/** What the checkout holds not committed, as git lists it. */
const status = () => git(dir, ['status', '--porcelain', '--untracked-files=all', '--', 'src']).trim();

/** The commit a ref names, null where it names none. @param {string} ref */
const at = (ref) => git(dir, ['for-each-ref', '--format=%(objectname)', ref]).trim() || null;

/** The brief `args` issue in this test's conversation, as stored. @param {string[]} args */
function briefText(args) {
  const { id } = run(['brief', ...args]);
  return withEnv({ LEEWAY_CONFIG_DIR: config() }, () => fs.readFileSync(briefPath('sess-1', id), 'utf8'));
}

/** Fix 1.1 parked on Q1 holding a commit of its own and work not committed — a change and a new file — and fix 1.2 started: 1.1's commit. */
async function parkedHolding() {
  written('src/flag.js', 'const flag = \'colour\';\n');
  const own = committed('1.1', ['src/flag.js'], 'spell the flag --colour');
  written('src/flag.js', 'const flag = \'colour\';\nconst alias = \'color\';\n');
  written('src/alias.js', 'module.exports = \'color\';\n');
  const raised = await parked(asked.first, '1.1');
  createFix(dir, 2, HELP);
  run(['task', 'start', UNIT, '1.2']);
  return { own, raised };
}

describe('a quick-fix\'s one checkout, held by one fix at a time (19.5.23)', () => {
  it('a builder\'s question parking the fix in flight sets aside what it had not committed, its untracked files among it, at a ref of the unit\'s own, never the stash, the checkout left clean at the branch\'s tip; its brief refused until its start puts it back', async () => {
    dir = world();
    run(['task', 'start', UNIT, '1.1']);
    const { raised } = await parkedHolding();

    assert.deepStrictEqual([raised.parked, raised.set_aside], ['Q1', ['src/alias.js', 'src/flag.js']]);
    assert.deepStrictEqual([status(), git(dir, ['rev-parse', 'HEAD']).trim(), git(dir, ['stash', 'list']).trim()], ['', git(dir, ['rev-parse', BRANCH]).trim(), '']);
    assert.strictEqual(git(dir, ['show', `${ASIDE}:src/alias.js`]), 'module.exports = \'color\';\n');
    assert.strictEqual(refused(['brief', 'builder', UNIT, '1.1']), `brief: task 1.1 of ${UNIT}'s work, set aside when a question parked it, is not back in the checkout — start it again first, engine task start ${UNIT} 1.1, which puts it back`);
  });

  it('a fix freed while another holds the checkout waits on it — the receipt, task ready, its start and its briefs each naming that one; once it is done, task ready names it back, and its start puts its work back onto the tip as it stands', async () => {
    dir = world();
    run(['task', 'start', UNIT, '1.1']);
    await parkedHolding();
    written('src/help.js', 'const help = \'--colour\';\n');
    committed('1.2', ['src/help.js'], 'spell the help --colour');
    const receipt = answered('Q1');
    const waits = [refused(['task', 'start', UNIT, '1.1']), refused(['brief', 'builder', UNIT, '1.1']), run(['task', 'ready', UNIT, '1']).back];
    run(['land', 'open', UNIT, '1.2']);
    fixDone(dir, '1.2', { env: env() });
    const back = run(['task', 'ready', UNIT, '1']).back;
    const started = run(['task', 'start', UNIT, '1.1']);

    assert.match(receipt, /^Q1 answered · task 1\.1 builds again once task 1\.2 is done or closed, or a question parks it · /);
    assert.deepStrictEqual(waits, [
      `task start: ${UNIT} builds one task at a time, in the project's one checkout on its one branch — task 1.2 is in flight, and task 1.1 starts once it is done or closed, or a question parks it`,
      `brief: ${UNIT} builds in its one checkout, one task at a time — task 1.2 is in flight, and task 1.1 goes on once task 1.2 is done or closed, or a question parks it`,
      undefined,
    ]);
    assert.deepStrictEqual([back, started.put_back, status(), at(ASIDE)], ['1.1', ['src/alias.js', 'src/flag.js'], 'M src/flag.js\n?? src/alias.js', null]);
    assert.strictEqual(fs.readFileSync(path.join(dir, 'src/flag.js'), 'utf8'), 'const flag = \'colour\';\nconst alias = \'color\';\n');
  });

  it('R20: a fix built again once another fix\'s commits stand between its own — its pair reads its own commits alone, in each repository, the other fix\'s left out', async () => {
    dir = world();
    run(['task', 'start', UNIT, '1.1']);
    const { own } = await parkedHolding();
    written('src/help.js', 'const help = \'--colour\';\n');
    committed('1.2', ['src/help.js'], 'spell the help --colour');
    answered('Q1');
    run(['land', 'open', UNIT, '1.2']);
    fixDone(dir, '1.2', { env: env() });
    run(['task', 'start', UNIT, '1.1']);
    const last = committed('1.1', ['src/flag.js', 'src/alias.js'], 'keep --color as an alias');
    const brief = briefText(['reviewer', UNIT, '1.1', '--letter', 'a']);
    const range = brief.slice(brief.indexOf('# The diff\'s range'), brief.indexOf('# Laying out'));

    assert.ok(range.includes(`- \`${own}\` fix(${UNIT}): spell the flag --colour\n- \`${last}\` fix(${UNIT}): keep --color as an alias\n`), range);
    assert.ok(!range.includes('help'), range);
  });

  it('its start refuses a put back that conflicts with what the tip now holds, naming each path, the ref and the way on, nothing moved and its work kept', async () => {
    dir = world();
    run(['task', 'start', UNIT, '1.1']);
    written('src/flag.js', 'const flag = \'colour\';\n');
    await parked(asked.first, '1.1');
    createFix(dir, 2, HELP);
    run(['task', 'start', UNIT, '1.2']);
    written('src/flag.js', 'const flag = \'colours\';\n');
    committed('1.2', ['src/flag.js'], 'spell the flag in the help');
    run(['land', 'open', UNIT, '1.2']);
    fixDone(dir, '1.2', { env: env() });
    answered('Q1');
    const kept = at(ASIDE);

    assert.strictEqual(refused(['task', 'start', UNIT, '1.1']), `task start: task 1.1 of ${UNIT}'s work, set aside when a question parked it, does not go back onto ${BRANCH} as it stands — it conflicts at src/flag.js — so nothing moved: it is kept at ${ASIDE}; make its change again by hand, \`git diff ${ASIDE}^ ${ASIDE}\` showing it, then drop it, \`git update-ref -d ${ASIDE}\`, and start the task again`);
    assert.deepStrictEqual([status(), at(ASIDE)], ['', kept]);
  });

  it('a raise parking a fix that waits behind the one in flight sets nothing aside, the checkout left to that one', async () => {
    dir = world();
    run(['task', 'start', UNIT, '1.1']);
    await parked(asked.first, '1.1');
    createFix(dir, 2, HELP);
    run(['task', 'start', UNIT, '1.2']);
    written('src/help.js', 'const help = \'--colour\';\n');
    answered('Q1');
    const again = await parked(asked.second, '1.1');

    assert.deepStrictEqual([again.parked, again.set_aside, status()], ['Q2', undefined, '?? src/help.js']);
  });

  it('a fix closed drops what its park set aside, its work given up with it', async () => {
    dir = world();
    run(['task', 'start', UNIT, '1.1']);
    written('src/flag.js', 'const flag = \'colour\';\n');
    await parked(asked.first, '1.1');
    const held = at(ASIDE);
    run(['task', 'close', UNIT, '1.1', '--reason', 'The flag stays as it is.']);

    assert.deepStrictEqual([held === null, at(ASIDE)], [false, null]);
  });
});

'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's one checkout, held by one fix at a time (19.5.23;
// leeway-engine/scripts/domain/fix-aside.cjs, task-verbs.cjs's `stepTurn`):
// a builder's question parking the fix that holds it setting aside what it
// had not committed, its untracked files among it, at a ref of the unit's
// own, the checkout left clean at the branch's tip for the next fix; the
// fix freed while another holds the checkout waiting on it — its answer's
// receipt, `task ready`, its start, its briefs and the commit door each
// naming the fix in flight, the door refusing it while parked as well
// (commit-task.cjs, `refuseOutOfTurn`); the entry naming its start, its
// builder's brief waiting on it, which puts what it set aside back onto the
// tip as it stands, a second start
// taking that work as its own; and its pair reading its own commits alone,
// the other fix's between them left out (task-base.cjs, `ownWork`); a put
// back that conflicts refused, nothing moved, and its way on taken, in
// either order, to the commit, its figures then counting each file once,
// renamed or not, where its commits do not replay (task-account.cjs); a raise parking a fix that waits behind
// another setting nothing aside; and a fix closed dropping what it set
// aside. The set-aside in a project that is a folder of a larger
// repository, and one that fails undone: test-engine-quick-fix-aside.cjs;
// in nested repositories, and a move keeping it, on every driver:
// test-engine-landing-conformance-quick-fix-nested-aside.cjs. Its figures
// and its account, read through the task loop's own calls:
// test-pipeline-simulation-quick-fix-parked.cjs.
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
  ok, okSections, okSectionsAsync, refusedPristine, sectionOf, git, createFile, fixtureFrom, cleanupFixture, withEnv,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');
const {
  UNIT, PLACE, FLAG, HELP, BRANCH, CALL, quickFix, createFix, fixDone, accountFigures, asGone, entered: enteredBy,
} = require('./quick-fix-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { briefPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));

/** Where fix 1.1's work is set aside. */
const ASIDE = `refs/leeway/aside/${UNIT}/${UNIT}-1-1`;

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
  it('a builder\'s question parking the fix in flight sets aside what it had not committed, its untracked files among it, at a ref of the unit\'s own, never the stash, the checkout left clean at the branch\'s tip', async () => {
    dir = world();
    run(['task', 'start', UNIT, '1.1']);
    const { raised } = await parkedHolding();

    assert.deepStrictEqual([raised.parked, raised.set_aside], ['Q1', ['src/alias.js', 'src/flag.js']]);
    assert.deepStrictEqual([status(), git(dir, ['rev-parse', 'HEAD']).trim(), git(dir, ['stash', 'list']).trim()], ['', git(dir, ['rev-parse', BRANCH]).trim(), '']);
    assert.strictEqual(git(dir, ['show', `${ASIDE}:src/alias.js`]), 'module.exports = \'color\';\n');
  });

  it('a fix freed while another holds the checkout waits on it — the receipt, task ready, its start, its briefs and the door each naming that one, the door refusing it parked as well; once that one is done, task ready names it back, the entry names its start and its builder\'s brief waits on it, which puts its work back onto the tip as it stands, a second start taking that work as its own; its pair then reads its own commits alone, the other fix\'s between them left out', async () => {
    dir = world();
    run(['task', 'start', UNIT, '1.1']);
    const { own } = await parkedHolding();
    written('src/help.js', 'const help = \'--colour\';\n');
    const commit = ['commit', '--paths', 'src/help.js', '--task', UNIT, '1.1', '-m', `fix(${UNIT}): spell the help --colour`];
    const parkedCommit = refused(commit);
    committed('1.2', ['src/help.js'], 'spell the help --colour');
    const receipt = answered('Q1');
    written('src/help.js', 'const help = \'--colour, --color\';\n');
    const waits = [refused(['task', 'start', UNIT, '1.1']), refused(['brief', 'builder', UNIT, '1.1']), refused(commit), run(['task', 'ready', UNIT, '1']).back];
    git(dir, ['checkout', '--', 'src/help.js']);
    run(['land', 'open', UNIT, '1.2']);
    fixDone(dir, '1.2', { env: env() });
    const back = run(['task', 'ready', UNIT, '1']).back;
    const line = sectionOf(okSections(dir, ['enter', 'implementation', UNIT], { env: env() }).sections, 'DATA').split('\n').find((held) => held.startsWith('in flight: task 1.1'));
    const unstarted = refused(['brief', 'builder', UNIT, '1.1']);
    const started = run(['task', 'start', UNIT, '1.1']);
    const again = run(['task', 'start', UNIT, '1.1']);
    const last = committed('1.1', ['src/flag.js', 'src/alias.js'], 'keep --color as an alias');
    const brief = briefText(['reviewer', UNIT, '1.1', '--letter', 'a']);
    const range = brief.slice(brief.indexOf('# The diff\'s range'), brief.indexOf('# Laying out'));

    assert.match(receipt, /^Q1 answered · task 1\.1 builds again once task 1\.2 is done or closed, or a question parks it · /);
    assert.deepStrictEqual([parkedCommit, ...waits], [
      `commit --task: a question parks task 1.1 of ${UNIT}, so it holds no part of ${UNIT}'s one checkout — task 1.2 holds it, and a commit now would carry its work under task 1.1 of ${UNIT}'s stamp; task 1.1 of ${UNIT}'s change is committed once it holds the checkout again, started again with \`engine task start ${UNIT} 1.1\`, once the answer frees it`,
      `task start: ${UNIT} builds one task at a time, in the project's one checkout on its one branch — task 1.2 is in flight, and task 1.1 starts once it is done or closed, or a question parks it`,
      `brief: ${UNIT} builds in its one checkout, one task at a time — task 1.2 is in flight, and task 1.1 goes on once task 1.2 is done or closed, or a question parks it`,
      `commit --task: task 1.2 holds ${UNIT}'s one checkout, and task 1.1 of ${UNIT} waits behind it, so a commit now would carry task 1.2's work under task 1.1 of ${UNIT}'s stamp — task 1.1 of ${UNIT}'s change is committed once it holds the checkout again, started again with \`engine task start ${UNIT} 1.1\`, once task 1.2 is done or closed, or a question parks it`,
      undefined,
    ]);
    assert.strictEqual(line, `in flight: task 1.1, no builder dispatched here — its work, set aside when a question parked it, is not back in the checkout — start it again, engine task start ${UNIT} 1.1, which puts it back, then its builder and pair go afresh on its branch`);
    assert.strictEqual(unstarted, `brief: task 1.1 of ${UNIT}'s work, set aside when a question parked it, is not back in the checkout — start it again first, engine task start ${UNIT} 1.1, which puts it back`);
    assert.deepStrictEqual([back, started.put_back, again.put_back, at(ASIDE)], ['1.1', ['src/alias.js', 'src/flag.js'], undefined, null]);
    assert.ok(range.includes(`- \`${own}\` fix(${UNIT}): spell the flag --colour\n- \`${last}\` fix(${UNIT}): keep --color as an alias\n`), range);
    assert.ok(!range.includes('help'), range);
  });

  it('its start refuses a put back that conflicts with what the tip now holds, naming each path, the ref and the way on, nothing moved and its work kept; the way on taken — its change made again before the start, even — the start takes the work as its own and the door commits it; its figures, its own commits not replaying past the other fix\'s, count each file once, a rename of it among them, and every line each commit changed', async () => {
    dir = world();
    run(['task', 'start', UNIT, '1.1']);
    written('src/flag.js', 'const flag = \'colour\';\n');
    committed('1.1', ['src/flag.js'], 'spell the flag --colour');
    written('src/flag.js', 'const flag = \'colour\';\nconst alias = \'color\';\n');
    await parked(asked.first, '1.1');
    createFix(dir, 2, HELP);
    run(['task', 'start', UNIT, '1.2']);
    written('src/flag.js', 'const flag = \'colours\';\n');
    committed('1.2', ['src/flag.js'], 'spell the flag in the help');
    run(['land', 'open', UNIT, '1.2']);
    fixDone(dir, '1.2', { env: env() });
    answered('Q1');
    const kept = at(ASIDE);

    const conflict = refused(['task', 'start', UNIT, '1.1']);
    const held = status();
    written('src/flag.js', 'const flag = \'colours\';\nconst alias = \'color\';\n');
    git(dir, ['update-ref', '-d', ASIDE]);
    run(['task', 'start', UNIT, '1.1']);
    committed('1.1', ['src/flag.js'], 'keep --color as an alias');
    fs.renameSync(path.join(dir, 'src/flag.js'), path.join(dir, 'src/flags.js'));
    committed('1.1', ['src/flag.js', 'src/flags.js'], 'name the flags file');
    const figures = accountFigures(dir, '1.1', { env: env() });

    assert.strictEqual(conflict, `task start: task 1.1 of ${UNIT}'s work, set aside when a question parked it, does not go back onto ${BRANCH} as it stands — it conflicts at src/flag.js — so nothing moved: it is kept at ${ASIDE}; see it, \`git diff ${ASIDE}^ ${ASIDE}\`, drop it, \`git update-ref -d ${ASIDE}\`, start the task again, engine task start ${UNIT} 1.1, then make its change again by hand and commit it through the door`);
    assert.deepStrictEqual([held, kept === null, status()], ['', false, '']);
    assert.deepStrictEqual(figures, { files: 1, added: 2, removed: 1 }, 'flag.js once, renamed flags.js: color to colour, then the alias line on 1.2\'s colours, then the rename');
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

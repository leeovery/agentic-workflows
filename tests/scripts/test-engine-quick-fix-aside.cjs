'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's set-aside at its edges (leeway-engine/scripts/domain/
// fix-aside.cjs, 19.5.23): in a project that is a folder of a larger
// repository (7.2.17), a park setting aside the fix's change to a file and
// a file it added, read from the folder — the file of the same path at the
// repository's top never touched — and its next start putting both back;
// and a set-aside that fails part-way undone, all or nothing: the raise
// refused, saying so, no question parked, no ref left, and the checkout
// holding the work as before. The set-aside's own rules:
// test-engine-quick-fix-checkout.cjs.
//
// Layer: git. World: a repository holding the project in its folder `app`,
// beside the quick-fix world's own `src/flag.js` at its top, a path the
// project's own shares; the quick-fix entered there by a
// conversation gone since, its fix 1.1 started there, its change committed,
// and a question asked at its place — built once and copied. Each test's
// conversation keeps its records in a config folder of its own, and every
// call is made from the folder.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, okSections, okSectionsAsync, refusesAsync, git, createFile, commitAll, fixtureFrom, cleanupFixture,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');
const { UNIT, PLACE, FLAG, quickFix, createFix, asGone, entered } = require('./quick-fix-world.cjs');

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

/** The question the world asks at the quick-fix's place: its short id. */
const asked = { id: '' };

const world = fixtureFrom('quick-fix-aside-', (dir) => {
  quickFix(dir);
  createFile(dir, 'app/src/flag.js', 'const flag = \'color\';\n');
  commitAll(dir, 'the project, a folder of the repository');
  const app = path.join(dir, 'app');
  asGone((as) => {
    entered(app, as);
    createFix(app, 1, FLAG, as);
    ok(app, ['task', 'start', UNIT, '1.1'], as);
    createFile(app, 'src/flag.js', 'const flag = \'colour\';\n');
    ok(app, ['commit', '--paths', 'src/flag.js', '--task', UNIT, '1.1', '-m', `fix(${UNIT}): spell the flag --colour`], as);
  });
  asked.id = ledgerHelpers(() => dir).write('ask', PLACE, [], { ...MADE, text: 'Does --color still work?' }).id;
});

let dir = ''; // the larger repository
const config = useTempFolder('quick-fix-aside-config-');

afterEach(() => {
  cleanupFixture(dir);
});

/** The project, the repository's folder `app`. */
const app = () => path.join(dir, 'app');

/** This test's conversation, as a call's options. */
const as = () => ({ env: { LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined } });

/** A call that must succeed, made from the project. @param {string[]} args */
const run = (args) => ok(app(), args, as());

/** The raise parking fix 1.1 on the world's question, from the project. */
const raise = ['raise', PLACE, '--answers', () => asked.id, '--parks', '1.1'];

/** The raise's arguments, the question's id read now. */
const raiseArgs = () => raise.map((arg) => (typeof arg === 'function' ? arg() : arg));

/** What the whole repository holds not committed, as git lists it. */
const status = () => git(dir, ['status', '--porcelain', '--untracked-files=all']).trim();

/** The commit a ref names, null where it names none. @param {string} ref */
const at = (ref) => git(dir, ['for-each-ref', '--format=%(objectname)', ref]).trim() || null;

/** The fix's change to its file and the file it added, written in the project. */
function changed() {
  createFile(app(), 'src/flag.js', 'const flag = \'colour\';\nconst alias = \'color\';\n');
  createFile(app(), 'src/alias.js', 'module.exports = \'color\';\n');
}

describe('a quick-fix\'s set-aside at its edges (19.5.23)', () => {
  it('in a project that is a folder of a larger repository, a park sets aside the fix\'s change and the file it added, read from the folder, the file of the same path at the top untouched; its next start puts both back', async () => {
    dir = world();
    run(['task', 'start', UNIT, '1.1']);
    const top = fs.readFileSync(path.join(dir, 'src/flag.js'), 'utf8');
    changed();
    const parked = (await okSectionsAsync(app(), raiseArgs(), { ...as(), stdin: JSON.stringify(CALL) })).res;
    const clean = status();
    const { raise: drawn } = okSections(app(), ['raise', 'draw', UNIT, 'Q1'], as()).res;
    ok(app(), ['raise', 'answer', drawn, '--pick', '1'], { ...as(), stdin: JSON.stringify({ why: 'Old scripts pass it.' }) });
    const started = run(['task', 'start', UNIT, '1.1']);

    assert.deepStrictEqual([parked.set_aside, clean, fs.readFileSync(path.join(dir, 'src/flag.js'), 'utf8')], [['src/alias.js', 'src/flag.js'], '', top]);
    assert.deepStrictEqual([started.put_back, status(), at(ASIDE)], [['src/alias.js', 'src/flag.js'], 'M app/src/flag.js\n?? app/src/alias.js', null]);
    assert.strictEqual(fs.readFileSync(path.join(app(), 'src/flag.js'), 'utf8'), 'const flag = \'colour\';\nconst alias = \'color\';\n');
  });

  it('a set-aside that fails part-way is undone, all or nothing: the raise refused, saying so, no question parked, no ref left, and the checkout holding the work as before', async () => {
    dir = world();
    run(['task', 'start', UNIT, '1.1']);
    changed();
    const locked = path.join(app(), 'src/locked');
    createFile(app(), 'src/locked/new.js', 'module.exports = \'new\';\n');
    fs.chmodSync(locked, 0o555);
    const before = status();
    let error = '';
    try {
      error = (await refusesAsync(app(), raiseArgs(), { ...as(), stdin: JSON.stringify(CALL) })).error;
    } finally {
      fs.chmodSync(locked, 0o755);
    }

    assert.match(error, new RegExp(`^raise: task 1\\.1 of ${UNIT}'s work could not be set aside, so nothing was: the checkout holds it as before, none of it staged, and no question parked the fix — `));
    assert.deepStrictEqual([at(ASIDE), status(), run(['raise', 'waiting', UNIT]).waiting], [null, before, []]);
    assert.strictEqual(fs.readFileSync(path.join(app(), 'src/flag.js'), 'utf8'), 'const flag = \'colour\';\nconst alias = \'color\';\n');
  });
});

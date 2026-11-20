'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's close's yes (ledger-engine/scripts/domain/finish.cjs):
// `engine finish yes <qf>` — refused while a question Claude raised in its
// conversation stands open in its ledger, after a /clear as before it
// (19.5.25), and while the checkout holds changes not committed, landing
// nothing — landing the pull request through the local landing driver as one
// commit, its fixes in the order they were done (19.5.17), reading no ref the
// local driver kept of an earlier quick-fix of its name, putting the checkout
// back on the branch it lands on, letting go of every ref the local driver
// kept of it — its opening and the head it merged — completing the unit and
// carrying on in the conversation, its folder then holding `build/` and `summary.md`
// alone of the work (4.S23), its record found once it is closed (22.S22), its
// questions and notes read once, as its checklist alone reads them. Its
// screen is test-engine-quick-fix-close.cjs's; the landing as one pull
// request, on every driver, GitHub's among them (19.S38),
// test-engine-landing-conformance-quick-fix.cjs's.
//
// Layer: git. World: quick-fix-close-world.cjs — fixes 1.1 and 1.2 on the
// quick-fix's branch, each built through the local driver and done — built
// once and copied. Each test's conversation keeps its records in a config
// folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, callAsync, okSectionsAsync, refusedPristine, git, stateGit, statePath, readManifest, cleanupFixture, keywordOnlyKnowledge, traced, layout,
} = require('./engine-harness.cjs');
const { datedAt } = require('./discovery-test-utils.cjs');
const { ledgerReadHelpers } = require('./ledger-world.cjs');
const { UNIT, PLACE, DESCRIPTION, checklistClosed } = require('./quick-fix-world.cjs');
const { RAISED, world, closeHelpers } = require('./quick-fix-close-world.cjs');

let dir = ''; // the project
const {
  as, run, refused, record, closeable, yesRow, branchOut,
} = closeHelpers(() => dir);

afterEach(() => {
  cleanupFixture(dir);
});

/**
 * A call that must succeed, and what it read: the ledger, a git call each
 * time, and the notes answered at the close, a look each time.
 * @param {import('node:test').TestContext} t @param {string[]} args
 */
function reading(t, args) {
  const looks = t.mock.method(fs, 'existsSync');
  try {
    const { result, commands } = traced(() => run(args));
    const notes = looks.mock.calls.filter(({ arguments: [file] }) => file === statePath(dir, layout.unit(UNIT, 'build', 'notes-answered.json'))).length;
    return { result, ledger: commands.filter((command) => command === "cat-file '--batch-check=%(objectname) %(objecttype) %(objectsize)'").length, notes };
  } finally {
    looks.mock.restore();
  }
}

describe('finish yes <quick-fix> (19.5.15, 24.1.2)', () => {
  it('refuses while the checkout holds changes not committed, landing nothing — land finish and land phase as it does; then lands the fixes, puts the checkout back on the branch it lands on, lets go of every ref the local driver kept of it, completes the unit and carries on in the conversation — its folder holding build/ and summary.md, no topics/ and no spec.md (4.S23) — reading its questions and notes once, as its checklist alone does, the ledger once more, after the landing has written', (t) => {
    dir = world();
    closeable();
    fs.writeFileSync(path.join(dir, 'src', 'stray.js'), 'stray\n');
    const main = git(dir, ['rev-parse', 'main']).trim();
    const dirty = [refused(['finish', 'yes', UNIT]), refused(['land', 'finish', UNIT]), refused(['land', 'phase', UNIT, '1']), git(dir, ['rev-parse', 'main']).trim()];
    fs.rmSync(path.join(dir, 'src', 'stray.js'));
    const kept = () => git(dir, ['for-each-ref', '--format=%(refname)', 'refs/ledger/']).trim();
    const opened = kept();
    const checked = reading(t, ['checklist', 'show', 'finish', UNIT]);
    const { result: done, ledger, notes } = reading(t, ['finish', 'yes', UNIT]);

    const stray = `${UNIT}'s tasks were built in the project's own checkout, which holds changes not committed — src/stray.js — so nothing was landed: commit them or set them aside, then close it again`;
    assert.deepStrictEqual([dirty, opened, kept()], [[`finish yes: ${stray}`, `land: ${stray}`, `land: ${stray}`, main], `refs/ledger/quick-fix/${UNIT}/open`, '']);
    assert.deepStrictEqual([checked.notes > 0, notes, ledger - checked.ledger], [true, checked.notes, 1]);
    assert.deepStrictEqual({ ...done, landed: done.landed.map((/** @type {any} */ { repo, into, merged }) => ({ repo, into, merged })) }, {
      ok: true, unit: UNIT, landed: [{ repo: '.', into: 'main', merged: ['1.1', '1.2'] }], checkout: 'main', completed_at: readManifest(dir, UNIT).completed_at,
      committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), next: { kind: 'continue' },
    });
    assert.deepStrictEqual([branchOut(), git(dir, ['log', '--format=%s', `${main}..main`]).trim(), fs.readFileSync(path.join(dir, 'src', 'help.js'), 'utf8')], [
      'main', `fix(${UNIT}): ${DESCRIPTION}`, 'const help = \'--colour\';\n',
    ]);
    assert.deepStrictEqual([readManifest(dir, UNIT).status, fs.readdirSync(statePath(dir, UNIT)).sort()], ['completed', ['build', 'discovery', 'manifest.json', 'seeds', 'summary.md']]);
  });

  it('19.5.25: never lands over a question Claude raised in its conversation still open in its ledger, after a /clear as before it — land finish and land phase as it does — naming it and the raise that asks it again; raised again and answered, it lands', async () => {
    dir = world();
    closeable();
    const asked = ledgerReadHelpers(() => dir).ask(PLACE, RAISED.question);
    await okSectionsAsync(dir, ['raise', PLACE, '--answers', asked], { env: as().env, stdin: JSON.stringify(RAISED) });
    const fresh = { env: { ...as().env, CLAUDE_CODE_SESSION_ID: 'sess-cleared' } };
    const main = git(dir, ['rev-parse', 'main']).trim();
    const open = [
      refusedPristine(dir, ['finish', 'yes', UNIT], fresh).error, refusedPristine(dir, ['land', 'finish', UNIT], fresh).error,
      refusedPristine(dir, ['land', 'phase', UNIT, '1'], fresh).error, git(dir, ['rev-parse', 'main']).trim(),
    ];
    const { res } = await okSectionsAsync(dir, ['raise', PLACE, '--answers', asked], { env: fresh.env, stdin: JSON.stringify(RAISED) });
    ok(dir, ['raise', 'answer', res.raise, '--pick', '1'], { ...fresh, stdin: JSON.stringify({ why: 'Old scripts keep working.' }) });
    const done = ok(dir, ['finish', 'yes', UNIT], fresh);

    const said = `${UNIT} closes once each question asked in it is answered — ${asked} ${RAISED.question}: raise it again for the person to answer, raise ${PLACE} --answers ${asked}`;
    assert.deepStrictEqual(open, [`finish yes: ${said}`, `land: ${said}`, `land: ${said}`, main]);
    assert.deepStrictEqual([done.landed.map(({ merged }) => merged), readManifest(dir, UNIT).status], [[['1.1', '1.2']], 'completed']);
  });

  it('reads no ref the local driver kept of an earlier quick-fix of the same name, its opening at a commit made before this one was — never this one\'s, so never a stranger\'s branch refused: the yes lands the fixes and lets go of every ref of the name', () => {
    dir = world();
    closeable();
    const earlier = datedAt('2020-01-01T00:00:00Z', () => git(dir, ['commit-tree', 'main^{tree}', '-m', 'An earlier typo fixed']).trim());
    for (const name of ['open', `merged/${earlier}`]) git(dir, ['update-ref', `refs/ledger/quick-fix/${UNIT}/${name}`, earlier]);
    const done = run(['finish', 'yes', UNIT]);

    assert.deepStrictEqual([done.landed.map((/** @type {any} */ { repo, merged }) => [repo, merged]), git(dir, ['for-each-ref', '--format=%(refname)', 'refs/ledger/']).trim()], [[['.', ['1.1', '1.2']]], '']);
  });

  it('19.5.17: squashes the fixes in the order they were done, as their records were written, never by their numbers', () => {
    dir = world();
    record(2);
    record(1);
    checklistClosed(dir, as());
    const landed = run(['land', 'finish', UNIT]);

    assert.deepStrictEqual([landed.repos.map((/** @type {any} */ { merged }) => merged), git(dir, ['log', '-1', '--format=%B', 'main']).match(/^Task: .*$/gm)], [
      [['1.2', '1.1']], [`Task: ${UNIT}-1-2`, `Task: ${UNIT}-1-1`],
    ]);
  });

  it('draws the close and completes the unit where its fixes landed already, as a yes stopped after its landing leaves them, its yes saying they have landed', () => {
    dir = world();
    closeable();
    run(['land', 'finish', UNIT]);
    const row = yesRow();
    run(['finish', 'yes', UNIT]);

    assert.deepStrictEqual([row, readManifest(dir, UNIT).status], ['**`y/yes`**    → Close it — its fixes have landed, so mark it complete', 'completed']);
  });

  it('22.S22: a closed quick-fix\'s short record is returned when the knowledge base is queried for what it changed, a bulk index after its close keeping it', async () => {
    dir = world();
    keywordOnlyKnowledge(dir);
    closeable();
    run(['finish', 'yes', UNIT]);
    const reindexed = await callAsync(dir, ['knowledge', 'index'], as());
    const res = await callAsync(dir, ['knowledge', 'query', 'flag', 'parser'], as());

    assert.deepStrictEqual([reindexed.code, res.code], [0, 0], reindexed.stderr + res.stderr);
    assert.match(res.stdout, /The flag parser reads --colour\./);
  });
});

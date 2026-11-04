'use strict';

// ---------------------------------------------------------------------------
// The gate over a working tree changed under a round (leeway-engine/scripts/
// domain/review-tree.cjs, its screen projections/review-phase.cjs, the
// snapshot review-phase.cjs): `engine render review-tree <unit>`, listing
// every change outside `.leeway/` since the round's snapshot, a rename as
// its two paths, each the engine does not put back marked with why — a path
// changed already when the round began, one holding what such a path held
// then, one ignored then or in a folder ignored whole, a folder git lists
// whole, one of a repository the round did not see, a HEAD moved, a
// repository new or holding no commit — and the person's rows: put it back,
// `engine review restore-tree <unit> --listed <print>`, where no HEAD moved
// and something can be, saying what it changes is set aside and nothing
// deleted; keep it as it is; their own word. Put back restores exactly what
// the snapshot proves — a path clean then to its repository's HEAD, a child
// repository's at its own, one absent then removed — each copied first into
// the round's set-aside folder, byte for byte, a copy that fails putting
// nothing back; and names the rest, the gate returning with them and the
// folder. A lost snapshot draws keep alone. Every refusal leaves the tree as
// it stands (12.7.8, 14.1.5, 14.S13).
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const { refuses } = require('./engine-harness.cjs');
const {
  UNIT, useWorld, env, recorded, refusedRound, firstRoundReady, RECEIPT, commitFile, ok, statePath, git, initRepo, assert,
} = require('./review-world.cjs');
const {
  SNAPSHOT, ASIDE, flat, wrote, excluded, treeKit,
} = require('./review-tree-world.cjs');

/** @type {string} */
let dir;
useWorld((folder) => { dir = folder; });
const {
  at, held, status, gate, refusedRestore, listedNow, putBack,
} = treeKit(() => dir);

/** Where put back `put-{k}` of round 1 sets aside what it changes. @param {number} [k] */
const putFolder = (k = 1) => statePath(dir, `${ASIDE}/round-1/put-${k}`);

describe('render review-tree and review restore-tree: put it back, or keep it as it is (12.7.8, 14.S13)', () => {
  it('lists every path changed since the snapshot, a rename as its two; put it back, saying what it changes is set aside, restores exactly those in one pass — a file changed back to the HEAD, a rename undone, one added and one untracked removed — each set aside first, leaving what was changed when the round began, and the round records', () => {
    fs.writeFileSync(at('src/banner.js'), 'export const banner = \'kept\';\n');
    firstRoundReady();
    const before = status();
    const card = held('src/card.js');
    fs.writeFileSync(at('src/card.js'), 'export const card = 999;\n');
    git(dir, ['mv', 'src/receipt.js', 'src/paid.js']);
    fs.writeFileSync(at('src/added.js'), 'export const added = 1;\n');
    git(dir, ['add', 'src/added.js']);
    fs.writeFileSync(at('src/stray.js'), 'export const stray = 1;\n');
    const { display, menu, nexts: [put, keep] } = gate(['p', 'k']);
    const res = putBack();
    const changed = ['src/added.js', 'src/card.js', 'src/paid.js', 'src/receipt.js', 'src/stray.js'];

    assert.ok(display.includes(`CHANGED OUTSIDE .leeway/ (${changed.length})`), display);
    for (const file of changed) assert.ok(display.includes(file), file);
    assert.ok(flat(menu.replaceAll('*', '')).includes('Put it back as the round found it — what it changes is set aside under .leeway/, nothing deleted'), menu);
    assert.ok(menu.includes('**Comment**'), menu);
    assert.deepStrictEqual([put.argv.slice(0, 4), keep], [['review', 'restore-tree', UNIT, '--listed'], { kind: 'engine', argv: ['review', 'accept-tree', UNIT] }]);
    assert.deepStrictEqual(res, {
      ok: true, round: 1, restored: changed, kept: [], set_aside: { folder: putFolder(), paths: ['src/added.js', 'src/card.js', 'src/paid.js', 'src/stray.js'] },
    });
    assert.deepStrictEqual([status(), held('src/card.js'), held('src/added.js'), held('src/stray.js'), held('src/paid.js'), held('src/receipt.js') !== null], [before, card, null, null, null, true]);
    assert.strictEqual(recorded({ can_now: [], findings: [RECEIPT] }).round, 1);
  });

  it('in a child repository, put it back restores at its own HEAD: a file changed back, one added and one untracked removed', () => {
    fs.mkdirSync(at('.git/info'), { recursive: true });
    fs.appendFileSync(at('.git/info/exclude'), 'lib/cards/\n');
    const cards = initRepo(at('lib/cards'));
    commitFile(cards, 'index.js');
    firstRoundReady();
    const before = status(cards);
    const index = held('lib/cards/index.js');
    fs.writeFileSync(at('lib/cards/index.js'), 'export const index = 2;\n');
    fs.writeFileSync(at('lib/cards/new.js'), 'export const added = 1;\n');
    git(cards, ['add', 'new.js']);
    fs.writeFileSync(at('lib/cards/stray.js'), 'export const stray = 1;\n');
    assert.deepStrictEqual(putBack().restored, ['lib/cards/index.js', 'lib/cards/new.js', 'lib/cards/stray.js']);
    assert.deepStrictEqual([status(cards), held('lib/cards/index.js'), held('lib/cards/new.js'), held('lib/cards/stray.js')], [before, index, null, null]);
  });

  it('puts back what can be and names the rest — a path changed already when the round began, one ignored then, a folder git lists whole — the round refusing again and the gate returning with them and where put back set aside what it changed, keep alone', () => {
    fs.writeFileSync(at('src/banner.js'), 'export const banner = \'kept\';\n');
    fs.writeFileSync(at('local.json'), '{"secret": 1}\n');
    fs.mkdirSync(at('.git/info'), { recursive: true });
    fs.writeFileSync(at('.git/info/exclude'), 'local.json\n');
    firstRoundReady();
    fs.writeFileSync(at('src/banner.js'), 'export const banner = \'again\';\n');
    fs.writeFileSync(at('.git/info/exclude'), '');
    git(dir, ['worktree', 'add', '-q', 'trees/side']);
    fs.writeFileSync(at('coverage.json'), '{}\n');
    const { display } = gate([]);
    const res = putBack();
    const again = refusedRound({ can_now: [], findings: [RECEIPT] });
    const after = gate([]);

    for (const line of [
      'src/banner.js — not put back here: changed already when the round began', 'local.json — not put back here: ignored when the round began', 'trees/side/ — not put back here: a folder git lists whole',
    ]) assert.ok(display.includes(line), line);
    assert.deepStrictEqual([res.restored, res.kept], [['coverage.json'], ['local.json', 'src/banner.js', 'trees/side/']]);
    assert.deepStrictEqual([held('coverage.json'), held('local.json'), held('src/banner.js'), fs.existsSync(at('trees/side'))], [null, '{"secret": 1}\n', 'export const banner = \'again\';\n', true]);
    assert.match(again, /^review round: the working tree outside \.leeway\/ changed since the snapshot the round is held to: local\.json, src\/banner\.js, trees\/side\/ — /);
    assert.ok(!after.menu.includes('`p/put`') && after.menu.includes('`k/keep`'), after.menu);
    assert.ok(after.display.includes(`SET ASIDE BY PUT BACK (1) — kept there until you remove them ${statePath(dir, ASIDE)} round-1/put-1/coverage.json`), after.display);
    assert.ok(!display.includes('SET ASIDE'), display);
  });

  it('a path holding what one changed already held when the round began is marked, not put back — a dirty file renamed by hand or by git mv, an untracked draft moved into a folder — and nothing is lost', () => {
    fs.writeFileSync(at('src/banner.js'), 'export const banner = \'dirty\';\n');
    fs.writeFileSync(at('src/card.js'), 'export const card = \'dirty\';\n');
    fs.writeFileSync(at('draft.md'), '# A draft\n');
    firstRoundReady();
    fs.renameSync(at('src/banner.js'), at('src/flag.js'));
    git(dir, ['mv', 'src/card.js', 'src/pay.js']);
    wrote(at('notes/draft.md'), '# A draft\n');
    fs.rmSync(at('draft.md'));
    const { display, menu } = gate([]);

    for (const line of [
      'src/flag.js — not put back here: it holds what src/banner.js held when the round began',
      'src/pay.js — not put back here: it holds what src/card.js held when the round began',
      'notes/draft.md — not put back here: it holds what draft.md held when the round began',
      'src/banner.js — not put back here: changed already when the round began',
    ]) assert.ok(display.includes(line), line);
    assert.ok(!menu.includes('`p/put`'), menu);
    refusedRestore(listedNow(), []);
    assert.deepStrictEqual([held('src/flag.js'), held('src/pay.js'), held('notes/draft.md')], ['export const banner = \'dirty\';\n', 'export const card = \'dirty\';\n', '# A draft\n']);
  });

  it('an empty file holds nothing moved: one written during the round, as empty as one changed already, is put back', () => {
    fs.writeFileSync(at('draft.md'), '');
    firstRoundReady();
    fs.writeFileSync(at('src/blank.js'), '');
    const { display } = gate([]);

    assert.ok(display.includes('src/blank.js ') && !display.includes('src/blank.js — '), display);
    assert.deepStrictEqual(putBack().restored, ['src/blank.js']);
  });

  it('a dirty file renamed and edited is put back, removed, what it held set aside byte for byte', () => {
    fs.writeFileSync(at('src/banner.js'), 'export const banner = \'dirty\';\n');
    firstRoundReady();
    fs.renameSync(at('src/banner.js'), at('src/flag.js'));
    fs.appendFileSync(at('src/flag.js'), 'export const more = 1;\n');
    const res = putBack();

    assert.deepStrictEqual([res.restored, res.kept, res.set_aside.paths, held('src/flag.js')], [['src/flag.js'], ['src/banner.js'], ['src/flag.js'], null]);
  });

  it('a copy that cannot be set aside puts nothing back — the tree as it stood, every path, and keep named as the way on — and the gate says nothing was set aside', () => {
    firstRoundReady();
    fs.writeFileSync(at('coverage.json'), '{}\n');
    fs.writeFileSync(at('src/card.js'), 'export const card = 999;\n');
    const { nexts: [put] } = gate(['p']);
    wrote(statePath(dir, `${ASIDE}/round-1/.put-1/src`), 'in the way\n');
    const before = [status(), held('coverage.json'), held('src/card.js')];
    const { error } = refuses(dir, put.argv, { env: env() });

    assert.ok(error.startsWith(`review restore-tree: src/card.js could not be set aside in ${putFolder()} — `), error);
    assert.ok(error.endsWith(`; nothing is put back — keep the tree as it is, review accept-tree ${UNIT}, or put it back by hand`), error);
    assert.deepStrictEqual([status(), held('coverage.json'), held('src/card.js')], before);
    assert.ok(!gate([]).display.includes('SET ASIDE'), 'nothing was put back, so nothing is said to be set aside');
  });

  it('keeps, each with why, what the round found there unseen or changed: a child repository\'s own ignored file made visible, files under a folder ignored whole, a new file in a folder that held only ignored ones, an untracked file edited', () => {
    excluded(dir, ['lib/cards/', 'build/', '*.log']);
    const cards = initRepo(at('lib/cards'));
    commitFile(cards, 'index.js');
    excluded(cards, ['.env']);
    wrote(at('lib/cards/.env'), 'TOKEN=1\n');
    wrote(at('build/out.js'), 'built\n');
    wrote(at('logs/a.log'), 'logged\n');
    wrote(at('draft.md'), '# A draft\n');
    firstRoundReady();
    excluded(dir, ['lib/cards/', '*.log']);
    excluded(cards, []);
    wrote(at('logs/new.txt'), 'new\n');
    fs.appendFileSync(at('draft.md'), 'more\n');
    const { display, menu } = gate([]);

    for (const line of [
      'lib/cards/.env — not put back here: ignored when the round began',
      'build/out.js — not put back here: in a folder ignored whole when the round began',
      'logs/new.txt — not put back here: in a folder ignored whole when the round began',
      'draft.md — not put back here: changed already when the round began',
    ]) assert.ok(display.includes(line), line);
    assert.ok(!menu.includes('`p/put`'), menu);
    refusedRestore(listedNow(), ['lib/cards/.env', 'build/out.js', 'logs/new.txt', 'draft.md']);
  });

  it('names a repository new since the round began, one holding no commit now, and a path in a repository the round did not see, putting nothing back', () => {
    excluded(dir, ['lib/cards/', 'lib/fresh/']);
    const cards = initRepo(at('lib/cards'));
    commitFile(cards, 'index.js');
    firstRoundReady();
    const was = git(cards, ['rev-parse', 'HEAD']).trim().slice(0, 7);
    git(cards, ['update-ref', '-d', 'refs/heads/main']);
    const fresh = initRepo(at('lib/fresh'));
    commitFile(fresh, 'index.js');
    wrote(at('lib/fresh/stray.js'), 'stray\n');
    const { display, menu } = gate([]);

    for (const line of [
      `\`lib/cards\` holds no commit now, at ${was} when the round began — so nothing is put back here`,
      '`lib/fresh` is a repository new since the round began — so nothing is put back here',
      'lib/fresh/stray.js — not put back here: in a repository the round did not see',
    ]) assert.ok(display.includes(line), line);
    assert.ok(!menu.includes('`p/put`'), menu);
  });

  it('a HEAD moved since the round began puts nothing back: it is said so, and the gate offers only to keep it', () => {
    firstRoundReady();
    const from = git(dir, ['rev-parse', 'HEAD']).trim().slice(0, 7);
    git(dir, ['commit', '-q', '--allow-empty', '-m', 'a stray commit']);
    const to = git(dir, ['rev-parse', 'HEAD']).trim().slice(0, 7);
    fs.writeFileSync(at('coverage.json'), '{}\n');
    const { display, menu } = gate([]);

    assert.ok(display.includes(`the project's repository's HEAD moved, from ${from} to ${to} — so nothing is put back here`), display);
    assert.ok(!menu.includes('`p/put`') && menu.includes('`k/keep`'), menu);
    assert.strictEqual(refusedRestore(listedNow(), ['coverage.json']), `review restore-tree: the project's repository's HEAD moved, from ${from} to ${to} — so nothing is put back here — the person puts it back by hand, or keeps the tree as it is: review accept-tree ${UNIT}`);
  });

  it('with no snapshot of the round\'s held, the gate says so and offers keep alone, which records the round', () => {
    firstRoundReady();
    fs.writeFileSync(at('src/card.js'), 'export const card = 999;\n');
    fs.rmSync(statePath(dir, SNAPSHOT));
    const { display, menu, nexts: [keep] } = gate(['k']);

    assert.ok(display.includes('no snapshot of round 1\'s working tree is held — its cache is gone: nothing can be put back here.'), display);
    assert.ok(menu.includes('Nothing can be put back here: keep the tree as it is, or tell me what to do with it.'), menu);
    assert.ok(!menu.includes('`p/put`') && menu.includes('`k/keep`'), menu);
    assert.deepStrictEqual(ok(dir, keep.argv, { env: env() }), { ok: true, round: 1, snapshot: 'taken' });
    assert.strictEqual(recorded({ can_now: [], findings: [RECEIPT] }).round, 1);
  });

  it('keep it as it is takes the tree as it stands, and the round records', () => {
    firstRoundReady();
    fs.writeFileSync(at('src/card.js'), 'export const card = 999;\n');
    const { nexts: [keep] } = gate(['k']);

    assert.deepStrictEqual(ok(dir, keep.argv, { env: env() }), { ok: true, round: 1, snapshot: 'taken' });
    assert.strictEqual(recorded({ can_now: [], findings: [RECEIPT] }).round, 1);
    assert.match(status(), /^ M src\/card\.js$/m);
  });

  it('restore-tree refused, the tree left as it stands: a tree changed since the gate listed it, nothing listed that can be put back, a tree as the snapshot holds it, and no snapshot held', () => {
    fs.writeFileSync(at('src/banner.js'), 'export const banner = \'kept\';\n');
    firstRoundReady();
    fs.writeFileSync(at('src/card.js'), 'export const card = 999;\n');
    const { nexts: [put] } = gate(['p']);
    fs.writeFileSync(at('src/card.js'), 'export const card = 1000;\n');
    const moved = refusedRestore(put.argv[4], ['src/card.js']);
    git(dir, ['checkout', '-q', '--', 'src/card.js']);
    fs.writeFileSync(at('src/banner.js'), 'export const banner = \'again\';\n');
    const kept = refusedRestore(listedNow(), ['src/banner.js']);
    fs.writeFileSync(at('src/banner.js'), 'export const banner = \'kept\';\n');
    const clean = refusedRestore(put.argv[4], []);
    fs.writeFileSync(at('src/card.js'), 'export const card = 999;\n');
    fs.rmSync(statePath(dir, SNAPSHOT));

    assert.deepStrictEqual([moved, kept, clean, refusedRestore(put.argv[4], ['src/card.js'])], [
      `review restore-tree: the working tree changed since the gate listed it — render review-tree ${UNIT} lists it as it stands`,
      `review restore-tree: src/banner.js — not put back here: changed already when the round began — the person puts it back by hand, or keeps the tree as it is: review accept-tree ${UNIT}`,
      `review restore-tree: the working tree outside .leeway/ is as round 1's snapshot holds it — record the round: review round ${UNIT} --file <round.json>`,
      `review restore-tree: no snapshot of round 1's working tree is held — its cache is gone, so nothing can be put back: render review-tree ${UNIT} asks the person whether the tree stands as it is`,
    ]);
  });
});

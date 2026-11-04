'use strict';

// ---------------------------------------------------------------------------
// What put back sets aside (leeway-engine/scripts/domain/review-tree.cjs,
// its place review-phase.cjs): `engine review restore-tree` copies what
// each path it touches holds into a folder of its own, `.cache/.set-aside/
// {unit}/round-{N}/put-{k}/{path}` — a link as a link, to a folder or to
// nothing; a version the index holds apart beside it, `{path}.staged` — a
// second put back in its own folder, a later round in its own; the round's
// report as drawn, the entry, the recovery note and finish's screen name it
// while it holds anything, the report's file never; and it outlives the
// unit, finish's yes and a cancel leaving it whole (12.7.8, 14.S13).
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const { output, sectionOf } = require('./engine-harness.cjs');
const {
  UNIT, SESSION_ID, EVERY, useWorld, env, enter, reported, recorded, firstRoundReady, fixBuilt, named, RECEIPT, stateText, commitFile, ok, statePath, git, initRepo, assert,
} = require('./review-world.cjs');
const {
  ASIDE, flat, excluded, treeKit,
} = require('./review-tree-world.cjs');

const { workUnitNameRefusal } = require('../../skills/leeway-engine/scripts/kernel/manifest-schema.cjs');

/** @type {string} */
let dir;
useWorld((folder) => { dir = folder; });
const { at, held, putBack } = treeKit(() => dir);

/** What the unit's set-aside holds, each copy from its folder, a link by its target. */
function asideHeld() {
  const folder = statePath(dir, ASIDE);
  if (!fs.existsSync(folder)) return {};
  return Object.fromEntries(fs.readdirSync(folder, { recursive: true, withFileTypes: true }).filter((entry) => !entry.isDirectory()).map((entry) => {
    const file = path.join(entry.parentPath, entry.name);
    return [path.relative(folder, file), entry.isSymbolicLink() ? `-> ${fs.readlinkSync(file)}` : fs.readFileSync(file, 'utf8')];
  }));
}

/** A stray file left in the checkout during the round, and put back at the gate. @param {string} rel @param {string} text @param {{round?: number, k?: number}} [expect] */
function strayPutBack(rel, text, expect) {
  fs.writeFileSync(at(rel), text);
  return putBack(expect);
}

/** The set-aside's block as a screen draws it, flattened, holding `copy`. @param {string} copy */
const asideBlock = (copy) => `SET ASIDE BY PUT BACK (1) — kept there until you remove them ${statePath(dir, ASIDE)} ${copy}`;

/** The entry's line naming the set-aside, holding `copy`. @param {string} copy */
const asideLine = (copy) => `set aside: ${statePath(dir, ASIDE)} — ${copy}, kept there until the person removes them`;

/** The last round's report as `render review-report` draws it, flattened. */
const reportDrawn = () => flat(sectionOf(output(dir, ['render', 'review-report', UNIT], { env: env() }), 'DISPLAY: review report'));

/** The checklist verbs finish closes on, worked. */
function finishClosed() {
  ok(dir, ['checklist', 'skip', 'phase-start', UNIT, '1', 'design-settled', '--reason', 'One task alone.'], { env: env() });
  ok(dir, ['checklist', 'skip', 'finish', UNIT, 'inbox-closed', '--reason', 'No inbox item was resolved.'], { env: env() });
  ok(dir, ['checklist', 'done', 'finish', UNIT, 'build-log-closed'], { env: env() });
  ok(dir, ['checklist', 'close', 'finish', UNIT], { env: env() });
}

describe('what put back sets aside (12.7.8, 14.S13)', () => {
  it('a link is set aside as a link — to a folder, or to nothing — and put back removes it', () => {
    firstRoundReady();
    fs.symlinkSync('src', at('src-link'));
    fs.symlinkSync('nowhere', at('gone-link'));
    const res = putBack();

    assert.deepStrictEqual([res.restored, fs.existsSync(at('src')), fs.lstatSync(at('src-link'), { throwIfNoEntry: false })], [['gone-link', 'src-link'], true, undefined]);
    assert.deepStrictEqual(asideHeld(), { 'round-1/put-1/gone-link': '-> nowhere', 'round-1/put-1/src-link': '-> src' });
  });

  it('a version the index holds apart from its HEAD and its working tree is set aside beside the working one, as {path}.staged', () => {
    firstRoundReady();
    fs.writeFileSync(at('src/card.js'), 'export const card = \'staged\';\n');
    git(dir, ['add', 'src/card.js']);
    fs.writeFileSync(at('src/card.js'), 'export const card = \'worked on\';\n');
    fs.writeFileSync(at('src/receipt.js'), 'export const receipt = \'unstaged\';\n');
    putBack({ staged: { 'src/card.js': 'export const card = \'staged\';\n' } });

    assert.deepStrictEqual(Object.keys(asideHeld()), ['round-1/put-1/src/card.js', 'round-1/put-1/src/card.js.staged', 'round-1/put-1/src/receipt.js']);
  });

  it('in a child repository, the version its own index holds apart is set aside beside the working one', () => {
    excluded(dir, ['lib/cards/']);
    const cards = initRepo(at('lib/cards'));
    commitFile(cards, 'index.js');
    firstRoundReady();
    fs.writeFileSync(at('lib/cards/index.js'), 'export const index = \'staged\';\n');
    git(cards, ['add', 'index.js']);
    fs.writeFileSync(at('lib/cards/index.js'), 'export const index = \'worked on\';\n');
    putBack({ staged: { 'lib/cards/index.js': 'export const index = \'staged\';\n' } });

    assert.deepStrictEqual(Object.keys(asideHeld()), ['round-1/put-1/lib/cards/index.js', 'round-1/put-1/lib/cards/index.js.staged']);
  });

  it('a second put back keeps its own folder, put-2, the first\'s copies as they were; a later round\'s is its own folder', () => {
    firstRoundReady();
    strayPutBack('stray.txt', 'first\n');
    strayPutBack('stray.txt', 'second\n', { k: 2 });
    recorded({ can_now: [], findings: [RECEIPT] });
    fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
    enter();
    named(['1-cards']);
    reported(2, ['1-cards']);
    strayPutBack('stray.txt', 'third\n', { round: 2 });

    assert.deepStrictEqual(asideHeld(), { 'round-1/put-1/stray.txt': 'first\n', 'round-1/put-2/stray.txt': 'second\n', 'round-2/put-1/stray.txt': 'third\n' });
  });

  it('a failing round\'s put back is named in its report as drawn and in the recovery note, kept until the person removes it — the report\'s file naming no folder of this machine\'s', () => {
    firstRoundReady();
    strayPutBack('stray.txt', 'left in the checkout\n');
    recorded({ can_now: ['Pay by card.'], findings: [RECEIPT] });
    fs.mkdirSync(path.join(dir, '.claude/skills/leeway-review-process'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude/skills/leeway-review-process/SKILL.md'), '# The review\n');
    const note = output(dir, ['conversation', 'position', SESSION_ID], { env: { ...env(), CLAUDE_CODE_SESSION_ID: '' } });

    assert.ok(reportDrawn().includes(asideBlock('round-1/put-1/stray.txt')), reportDrawn());
    assert.ok(note.split('\n').includes(asideLine('round-1/put-1/stray.txt')), note);
    assert.ok(!stateText(`${UNIT}/review/round-1.md`).includes(statePath(dir, ASIDE)), stateText(`${UNIT}/review/round-1.md`));
  });

  it('is named while it holds anything — in the closing report as drawn, the entry and finish\'s screen, kept until the person removes it, the report\'s file naming none — and outlives finish\'s yes', () => {
    enter();
    reported(1, EVERY);
    strayPutBack('stray.txt', 'left in the checkout\n');
    recorded({ can_now: ['Pay by card.'], findings: [] });
    finishClosed();
    const block = asideBlock('round-1/put-1/stray.txt');

    assert.ok(reportDrawn().includes(block), reportDrawn());
    assert.ok(!stateText(`${UNIT}/review/round-1.md`).includes(statePath(dir, ASIDE)), stateText(`${UNIT}/review/round-1.md`));
    assert.ok(enter().sections.split('\n').includes(asideLine('round-1/put-1/stray.txt')), enter().sections);
    assert.ok(flat(sectionOf(output(dir, ['render', 'finish', UNIT], { env: env() }), 'DISPLAY: finish')).includes(block));
    ok(dir, ['finish', 'yes', UNIT], { env: env() });
    assert.deepStrictEqual([fs.existsSync(statePath(dir, `.cache/${UNIT}`)), asideHeld()], [false, { 'round-1/put-1/stray.txt': 'left in the checkout\n' }]);
  });

  it('outlives a cancel, which takes the unit\'s cache — no unit\'s name opening on a dot, none\'s cache is it', () => {
    firstRoundReady();
    strayPutBack('stray.txt', 'left in the checkout\n');
    ok(dir, ['workunit', 'cancel', UNIT], { env: env() });

    assert.notStrictEqual(workUnitNameRefusal('.set-aside'), null);

    assert.deepStrictEqual([fs.existsSync(statePath(dir, `.cache/${UNIT}`)), held('stray.txt'), asideHeld()], [false, null, { 'round-1/put-1/stray.txt': 'left in the checkout\n' }]);
  });
});

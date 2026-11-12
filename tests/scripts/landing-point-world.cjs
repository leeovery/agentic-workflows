'use strict';

// ---------------------------------------------------------------------------
// What the landing point's table shares (test-engine-landing-point.cjs and
// -kinds.cjs): task 1.1's landing point (task-landed.cjs, `pointOf`, L), the
// one source of every read of its landing and every merge of its work,
// against each shipped driver in turn (`landingPoints`). Each row lands 1.1
// — its card, then a file it adds, then another — one way: the engine's own
// landing; by hand, a squash, a merge commit, a fast-forward or a rebase
// merge's copies; or on GitHub's site, a squash of its pull request. Its
// branch then changes one way, before or after a verb read that landing: a
// file added, the file it added deleted, that file deleted and added back,
// the branch rewritten (F1), or rebased onto the default branch, its
// commits dropped there as applied. The verbs run as the person runs them,
// every way on followed as the engine words it, and each row holds the
// default branch's tree, the task's record — who landed it last, its first
// landing, its tip — and the verb run again answering already. A conflict's
// row follows its way on: another task rewriting the card lands, then 1.1's
// card changes and its file is deleted; the way on rebases its commits since
// its landing onto the default branch, the conflict settled the branch's
// way, and its change lands, the file it took back staying gone. Each
// suite runs it through its own `describe`, `it` and `afterEach`.
// Conformance layer: the landing world (landing-world.cjs), built once per
// driver and copied for each row.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { tip, git, fixtureFrom, cleanupFixture, readManifest } = harness;
const { UNIT, BASE, TASKS, openArgs, cutTask, commitFiles, buildLanding, followedOn, short } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { card } = TASKS;
const PHASE = ['land', 'phase', UNIT, '1'];
const WORK = ['card.txt', 'extra.txt', 'more.txt'];

/**
 * Each change of 1.1's branch after its landing: made on the branch; the
 * paths of 1.1's the default branch then holds, and its card; and whether it
 * is a change to land, else 1.1 stands landed.
 * @type {Record<string, {change: (at: string) => void, paths: string[], card: string, lands: boolean}>}
 */
const CHANGES = {
  'a file added': { change: (at) => commitFiles(at, card.branch, card.branch, { 'added.txt': 'added\n' }), paths: ['added.txt', ...WORK], card: 'card\n', lands: true },
  'the file it added deleted': { change: (at) => commitFiles(at, card.branch, card.branch, {}, { removed: ['extra.txt'] }), paths: ['card.txt', 'more.txt'], card: 'card\n', lands: true },
  'that file deleted, then added back': {
    change: (at) => {
      commitFiles(at, card.branch, card.branch, {}, { removed: ['extra.txt'] });
      commitFiles(at, card.branch, card.branch, { 'extra.txt': 'extra\n' });
    },
    paths: WORK, card: 'card\n', lands: false,
  },
  'its branch rewritten': { change: (at) => commitFiles(at, card.branch, BASE, { 'card.txt': 'card, rewritten\n', 'more.txt': 'more\n' }), paths: ['card.txt', 'more.txt'], card: 'card, rewritten\n', lands: true },
  'its branch rebased onto the default branch, its commits dropped there as applied': {
    change: (at) => {
      const back = git(at, ['symbolic-ref', '--short', 'HEAD']).trim();
      git(at, ['rebase', '-q', 'main', card.branch]);
      git(at, ['switch', '-q', back]);
    },
    paths: WORK, card: 'card\n', lands: false,
  },
};

/** A row: how 1.1 lands, how its branch then changes, and whether a verb read its landing first. @typedef {[string, string, boolean]} Row */

/**
 * The table's rows, against each shipped driver, under `title`, through the
 * calling suite's own `describe`, `it` and `afterEach`: `rows`, but those
 * landing on GitHub's site where the driver lands on none; and, for each
 * landing of `conflicts`, its conflict's row.
 * @param {string} title @param {Row[]} rows @param {string[]} conflicts
 * @param {{describe: typeof import('node:test').describe, it: typeof import('node:test').it, afterEach: typeof import('node:test').afterEach}} test
 */
function landingPoints(title, rows, conflicts, { describe, it, afterEach }) {
  for (const { name } of listDrivers('landing')) {
    /**
     * @type {{
     *   env: Record<string, string|undefined>, prepare: (dir: string) => void, holds: (dir: string) => string[], on: (dir: string) => string, defaultTip: (dir: string) => string,
     *   squashedHere: (dir: string, branch: string) => void, mergedHere: (dir: string, branch: string) => void, forwardedHere: (dir: string, branch: string) => void,
     *   rebasedHere: (dir: string, branch: string) => void, mergedOnGithub?: (dir: string, branch: string, method: string, pulled: boolean) => void,
     * }}
     */
    const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
    const as = { env: side.env };
    const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, as);
    const world = fixtureFrom(`engine-landing-point-${name}-`, (dir) => {
      buildLanding(dir);
      commitFiles(dir, card.branch, card.branch, { 'extra.txt': 'extra\n' });
      commitFiles(dir, card.branch, card.branch, { 'more.txt': 'more\n' });
      side.prepare(dir);
    });
    /** @type {string|null} */
    let dir = null;
    afterEach(() => {
      if (dir !== null) cleanupFixture(dir);
      dir = null;
    });
    const { mergedOnGithub } = side;
    /**
     * Each way 1.1 lands; whether a verb then took it — the engine, or a
     * pull request opened — so its change is landed by `land phase` alone;
     * and who its record names as landing it, where no change lands since.
     * @type {Record<string, {land: (at: string) => void, taken: boolean, by: 'engine'|'read'}>}
     */
    const LANDINGS = {
      'the engine\'s own landing': { land: (at) => [openArgs(card), PHASE].forEach((args) => ok(at, args)), taken: true, by: 'engine' },
      'a squash by hand': { land: (at) => side.squashedHere(at, card.branch), taken: false, by: 'read' },
      'a merge commit by hand': { land: (at) => side.mergedHere(at, card.branch), taken: false, by: 'read' },
      'a fast-forward by hand': { land: (at) => side.forwardedHere(at, card.branch), taken: false, by: 'read' },
      'a rebase merge by hand': { land: (at) => side.rebasedHere(at, card.branch), taken: false, by: 'read' },
      ...(mergedOnGithub === undefined ? {} : {
        'a squash on GitHub\'s site': {
          land: (/** @type {string} */ at) => {
            ok(at, openArgs(card));
            mergedOnGithub(at, card.branch, 'squash', true);
          },
          taken: true,
          by: /** @type {const} */ ('read'),
        },
      }),
    };
    /**
     * The verb's answer — where it refuses, its way on followed and the verb
     * run again — with the refusal, null where it answered.
     * @param {string} at @param {string[]} args
     */
    const landing = (at, args) => {
      const res = harness.call(at, args, as);
      if (res.code === 0) return { answer: JSON.parse(res.stdout.split('\n')[0]), refusal: null };
      const { error } = JSON.parse(res.stderr.trim());
      followedOn(at, card.branch, error, side.env);
      return { answer: ok(at, args), refusal: /** @type {string} */ (error) };
    };
    /** What the default branch holds of 1.1's work, of the world's paths aside, and its card. @param {string} at @param {string[]} before */
    const landedWork = (at, before) => [side.holds(at).filter((file) => !before.includes(file)).sort(), git(side.on(at), ['show', 'main:card.txt'])];
    /** 1.1's record: who landed it last, its first landing and its tip. @param {string} at */
    const recordOf = (at) => {
      const { by, first, tip: recorded } = readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'];
      return { by, first, tip: recorded };
    };

    describe(`the ${name} landing driver: ${title}`, () => {
      for (const [how, what, read] of rows.filter(([landed]) => landed in LANDINGS)) {
        const { land, taken, by } = LANDINGS[how];
        const { change, paths, card: text, lands } = CHANGES[what];
        it(`1.1 landed by ${how}, then ${what}${read ? ', a verb having read its landing first' : ''}: the default branch holds its work as its branch does, its first landing ${how}, and the verb again answers already`, () => {
          const at = (dir = world());
          const before = side.holds(at);
          land(at);
          const landed = side.defaultTip(at);
          if (read) ok(at, openArgs(card));
          const stood = tip(at, card.branch);
          change(at);
          const verbs = taken || lands ? [...(taken ? [] : [openArgs(card)]), PHASE] : [openArgs(card)];
          const answers = verbs.map((args) => landing(at, args));
          const kept = taken && !lands;

          assert.deepStrictEqual([landedWork(at, before), recordOf(at), ok(at, verbs[verbs.length - 1]).already], [
            [paths, text], { by: lands ? 'engine' : by, first: landed, tip: kept ? stood : tip(at, card.branch) }, true,
          ], answers.map(({ refusal }) => refusal).filter(Boolean).join('\n'));
        });
      }

      for (const how of conflicts) {
        const { land, taken } = LANDINGS[how];
        it(`1.1 landed by ${how}, 4.1 then rewriting its card and landing, then 1.1's card changed and its file deleted: land phase refuses the conflict, naming 1.1's commits since its landing rebased onto the default branch; that followed, the conflict settled the branch's way, its change lands, the file staying gone`, () => {
          const at = (dir = world());
          const before = side.holds(at);
          land(at);
          const landed = side.defaultTip(at);
          const stood = tip(at, card.branch);
          ok(at, openArgs(cutTask(at, '4.1', 'fix', 'Word the card', 'main', { 'card.txt': 'a card\n' })));
          ok(at, ['land', 'phase', UNIT, '4']);
          commitFiles(at, card.branch, card.branch, { 'card.txt': 'card v2\n' }, { removed: ['extra.txt'] });
          const answers = [...(taken ? [] : [openArgs(card)]), PHASE].map((args) => landing(at, args));
          const into = mergedOnGithub === undefined ? 'main' : 'origin/main';

          assert.deepStrictEqual([
            answers.map(({ refusal }) => refusal?.includes(`\`git rebase --onto ${into} ${short(stood)} ${card.branch}\``) ?? null),
            landedWork(at, before), recordOf(at), ok(at, PHASE).already,
          ], [
            [...(taken ? [] : [null]), true],
            [['card.txt', 'more.txt'], 'card v2\n'], { by: 'engine', first: landed, tip: tip(at, card.branch) }, true,
          ]);
        });
      }
    });
  }
}

module.exports = { landingPoints };

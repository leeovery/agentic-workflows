'use strict';

// ---------------------------------------------------------------------------
// What the landing point's table shares (test-engine-landing-point.cjs and
// -kinds.cjs): task 1.1's landing point (task-landed.cjs, `pointOf`, L), the
// one source of every read of its landing and every merge of its work,
// against each shipped driver in turn (`landingPoints`). Each row lands 1.1
// — its card, then a file it adds, then another — one way: by hand, a
// squash, a merge commit, a fast-forward or a rebase
// merge's copies, or a squash carrying a change of the person's own beside
// its work, or 1.2's work, as one commit (`squashedTogether`); or on
// GitHub's site, a squash of its pull request. Its
// branch then changes one way, before or after a verb read that landing:
// the file it added deleted, that file deleted and added back, the branch
// rewritten (F1, where a verb read the landing), or rebased onto the
// default branch, its commits dropped there as applied; or that file taken
// back in its own commits, its last commit amended (`amended`), or every
// commit folded into one under its own stamp; or its last commit's message
// amended alone, nothing of its work changed; or its last commit dropped,
// its branch then behind its landing, nothing new, its record kept. The
// verbs run as the person runs them, every way on followed as the engine
// words it, and each row holds the
// default branch's tree, the task's record — who landed it last, its first
// landing, its tip — and the verb run again answering already. A conflict's
// row follows its way on: another task rewriting the card and 1.1's last
// file lands, then 1.1's card changes and its file is deleted; the conflict
// is read over 1.1's landing, at the card alone, by the first verb to lay
// its change — `land open` where no verb took it, its change laid onto the
// chain's tip there, else `land phase`, as for a fast-forward by hand of
// a task opened first, its branch holding its landing; the way on rebases
// its commits since its landing onto the default branch, the conflict
// settled the branch's way, and its change lands, the file it took back
// staying gone. Each
// suite runs it through its own `describe`, `it` and `afterEach`.
// Conformance layer: the landing world (landing-world.cjs), built once per
// driver and copied for each row.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const assert = require('node:assert');
const path = require('path');

const fs = require('fs');
const harness = require('./engine-harness.cjs');

const { tip, git, fixtureFrom, cleanupFixture, readManifest } = harness;
const { UNIT, BASE, TASKS, openArgs, cutTask, commitFiles, buildLanding, followedOn, short } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { card, total } = TASKS;
const PHASE = ['land', 'phase', UNIT, '1'];
const WORK = ['card.txt', 'extra.txt', 'more.txt'];

/** Git calls made on `branch` checked out, the checkout then put back on the branch it was on. @param {string} at @param {string} branch @param {string[][]} calls */
function onBranch(at, branch, calls) {
  const back = git(at, ['symbolic-ref', '--short', 'HEAD']).trim();
  git(at, ['switch', '-q', branch]);
  for (const args of calls) git(at, args);
  git(at, ['switch', '-q', back]);
}

/** `file` taken back on `branch` in its last commit, amended under its own message. @param {string} at @param {string} branch @param {string} file */
const amended = (at, branch, file) => onBranch(at, branch, [['rm', '-q', file], ['commit', '-q', '--amend', '--no-edit']]);

/**
 * `branches` squashed by hand onto the default branch in the person's
 * checkout as one commit — app.txt reworded with them where `own` gives its
 * words — then pushed, as the driver's side brings and sends it.
 * @param {string} at @param {{pulled: (dir: string) => void, pushed: (dir: string) => void}} side @param {string[]} branches @param {string} [own]
 */
function squashedTogether(at, side, branches, own) {
  side.pulled(at);
  const back = git(at, ['symbolic-ref', '--short', 'HEAD']).trim();
  git(at, ['switch', '-q', '-c', 'together', 'main']);
  for (const branch of branches) git(at, ['merge', '-q', '--no-ff', '--no-edit', branch]);
  git(at, ['switch', '-q', 'main']);
  git(at, ['merge', '-q', '--squash', 'together']);
  git(at, ['branch', '-q', '-D', 'together']);
  if (own !== undefined) {
    fs.writeFileSync(path.join(at, 'app.txt'), own);
    git(at, ['add', 'app.txt']);
  }
  git(at, ['commit', '-q', '-m', 'Landed by hand']);
  git(at, ['switch', '-q', back]);
  side.pushed(at);
}

/**
 * Each change of 1.1's branch after its landing, made on the branch: the
 * paths of 1.1's the default branch then holds, and its
 * card; whether it is a change to land, else 1.1 stands landed; and
 * whether its record then keeps the tip it had, its branch behind it.
 * @type {Record<string, {change: (at: string) => void, paths: string[], card: string, lands: boolean, behind?: boolean}>}
 */
const CHANGES = {
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
  'its last commit amended, taking back the file it added': { change: (at) => amended(at, card.branch, 'extra.txt'), paths: ['card.txt', 'more.txt'], card: 'card\n', lands: true },
  'its last commit\'s message amended alone': { change: (at) => onBranch(at, card.branch, [['commit', '-q', '--amend', '-m', 'more, reworded']]), paths: WORK, card: 'card\n', lands: false },
  'its last commit dropped, its branch behind its landing': {
    change: (at) => onBranch(at, card.branch, [['reset', '-q', '--hard', 'HEAD~1']]),
    paths: WORK, card: 'card\n', lands: false, behind: true,
  },
  'its commits folded into one under its own stamp, taking back the file it added': {
    change: (at) => onBranch(at, card.branch, [['reset', '-q', '--soft', BASE], ['rm', '-q', '-f', 'extra.txt'], ['commit', '-q', '-C', 'ORIG_HEAD']]),
    paths: ['card.txt', 'more.txt'], card: 'card\n', lands: true,
  },
};

/** A row: how 1.1 lands, how its branch then changes, and whether a verb read its landing first. @typedef {[string, string, boolean]} Row */

/**
 * The table's rows, against each shipped driver, under `title`, through the
 * calling suite's own `describe`, `it` and `afterEach`: `rows`, and for each
 * landing of `conflicts` its conflict's row, but those landing on GitHub's
 * site where the driver lands on none.
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
     *   pulled: (dir: string) => void, pushed: (dir: string) => void,
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
     * Each way 1.1 lands, whether a verb then took it — a pull request
     * opened — so its change is landed by `land phase` alone, and the paths
     * it lands beside 1.1's work.
     * @type {Record<string, {land: (at: string) => void, taken: boolean, beside?: string[]}>}
     */
    const LANDINGS = {
      'a squash by hand': { land: (at) => side.squashedHere(at, card.branch), taken: false },
      'a squash by hand carrying a change of my own': { land: (at) => squashedTogether(at, side, [card.branch], 'app, as I landed it\n'), taken: false },
      'a squash by hand of it and 1.2 as one commit': { land: (at) => squashedTogether(at, side, [card.branch, total.branch]), taken: false, beside: ['total.txt'] },
      'a merge commit by hand': { land: (at) => side.mergedHere(at, card.branch), taken: false },
      'a fast-forward by hand': { land: (at) => side.forwardedHere(at, card.branch), taken: false },
      'a fast-forward by hand, opened first': {
        land: (at) => {
          ok(at, openArgs(card));
          side.forwardedHere(at, card.branch);
        },
        taken: true,
      },
      'a rebase merge by hand': { land: (at) => side.rebasedHere(at, card.branch), taken: false },
      ...(mergedOnGithub === undefined ? {} : {
        'a squash on GitHub\'s site': {
          land: (/** @type {string} */ at) => {
            ok(at, openArgs(card));
            mergedOnGithub(at, card.branch, 'squash', true);
          },
          taken: true,
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
        const { land, taken, beside = [] } = LANDINGS[how];
        const { change, paths, card: text, lands, behind = false } = CHANGES[what];
        it(`1.1 landed by ${how}, then ${what}${read ? ', a verb having read its landing first' : ''}: the default branch holds its work as its branch does, its first landing ${how}, and the verb again answers already`, () => {
          const at = (dir = world());
          const before = [...side.holds(at), ...beside];
          land(at);
          const landed = side.defaultTip(at);
          if (read) ok(at, openArgs(card));
          const stood = tip(at, card.branch);
          change(at);
          const verbs = taken || lands ? [...(taken ? [] : [openArgs(card)]), PHASE] : [openArgs(card)];
          const answers = verbs.map((args) => landing(at, args));
          const kept = (taken && !lands) || behind;

          assert.deepStrictEqual([landedWork(at, before), recordOf(at), ok(at, verbs[verbs.length - 1]).already], [
            [paths, text], { by: lands ? 'engine' : 'read', first: landed, tip: kept ? stood : tip(at, card.branch) }, true,
          ], answers.map(({ refusal }) => refusal).filter(Boolean).join('\n'));
        });
      }

      for (const how of conflicts.filter((landed) => landed in LANDINGS)) {
        const { land, taken } = LANDINGS[how];
        it(`1.1 landed by ${how}, 4.1 then rewriting its card and its last file and landing, then 1.1's card changed and its file deleted: ${taken ? 'land phase' : 'land open'} refuses the conflict at the card alone, read over 1.1's landing, naming its commits since its landing rebased onto the default branch; that followed, the conflict settled the branch's way, its change lands, the file staying gone`, () => {
          const at = (dir = world());
          const before = side.holds(at);
          land(at);
          const landed = side.defaultTip(at);
          const stood = tip(at, card.branch);
          ok(at, openArgs(cutTask(at, '4.1', 'fix', 'Word the card', 'main', { 'card.txt': 'a card\n', 'more.txt': 'more, worded\n' })));
          ok(at, ['land', 'phase', UNIT, '4']);
          commitFiles(at, card.branch, card.branch, { 'card.txt': 'card v2\n' }, { removed: ['extra.txt'] });
          const answers = [...(taken ? [] : [openArgs(card)]), PHASE].map((args) => landing(at, args));
          const into = mergedOnGithub === undefined ? 'main' : 'origin/main';
          const wayOn = `\`git rebase --onto ${into} ${short(stood)} ${card.branch}\``;

          assert.deepStrictEqual([
            answers.map(({ refusal }) => (refusal === null ? null : refusal.includes(' at card.txt, so ') && refusal.includes(wayOn))),
            landedWork(at, before), recordOf(at), ok(at, PHASE).already,
          ], [
            [true, ...(taken ? [] : [null])],
            [['card.txt', 'more.txt'], 'card v2\n'], { by: 'engine', first: landed, tip: tip(at, card.branch) }, true,
          ]);
        });
      }
    });
  }
}

module.exports = { landingPoints };

'use strict';

//
// Migration 081: The reshape's finish — the code side's drops staged for the migration's commit
//
// Step 6 of the reshape's sequence (21.2, 21.9): once the records and the
// cut are done, the migration's commit is all that is left, made on the
// person's yes at the migration gate. Two commits (21.9.2): the state
// branch's first, which takes the whole state, and the default branch's,
// which drops the project's old state and the tracker's old store and takes
// the project's own files to the new names, as the move staged them.
//
// What goes, in the project's folder in the main checkout, the runner's
// (the drops): `.workflows/` whole, and each tracker store a task driver
// declares a project from before Leeway kept there (reshape/shared.cjs,
// `preLeewayStores`), which the move carried into the state (21.5.18) — the
// store's files, and the ones its tool keeps local: each file in the folder
// a local pattern names that the pattern matches.
//
// What it stages: the removal of each drop the code branch holds, from the
// index alone, every file left on disk, since a session in another
// checkout may still read it until the commit lands.
//
// What it journals, for the engine's commit door, so the engine names
// neither (E9): `.leeway/.cache/migrate/finish.json`, `{staged, drops}`,
// each named from the project's folder — `staged`, the drops whose removal
// it staged, which the code commit takes as the index records them;
// `drops`, every path removed from disk once it lands, the files git
// ignores in `.workflows/` with it. What is staged is read from the code
// branch, which nothing changes before the commit, so a run again finds
// the same; the journal is written whole or not at all, after the staging.
//
// Nothing is committed (21.9.3). Run again — after a kill at either write —
// it stages what is staged already and writes the journal whole again.
//
// Where the migration is not under way — no `.workflows/` in the project's
// folder, a folder in no repository, or `leeway-state` with a commit — it
// has nothing to stage.
//
// Known edges, not built:
//   - a rebase, merge, cherry-pick, revert or bisect stopped in the main
//     checkout takes the staged removal into the commit that ends it;
//   - a tracker's local pattern with a wildcard in a folder's name matches
//     nothing.
//

const fs = require('fs');
const path = require('path');
const { OLD_STATE, STATE_DIR, git, mustGit, mainCheckout, projectInMain, stateBorn, writeWhole, preLeewayStores } = require('./reshape/shared.cjs');

const CACHE = '.cache';
const JOURNAL = path.join(CACHE, 'migrate', 'finish.json');

/** A path taken literally by git. @param {string} rel */
const literal = (rel) => `:(literal)${rel}`;

/** A local pattern as a test of a path from the project's folder. @param {string} pattern */
function matcherOf(pattern) {
  const escape = (/** @type {string} */ part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${pattern.replace(/^\//, '').split('*').map(escape).join('[^/]*')}$`);
}

/** The files in the project's folder a store's local patterns match, each by its path there. @param {string} project @param {string[]} patterns */
function localFilesOf(project, patterns) {
  return patterns.flatMap((pattern) => {
    const folder = path.posix.dirname(pattern.replace(/^\//, ''));
    let names;
    try {
      names = fs.readdirSync(path.join(project, folder), { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
    } catch {
      return [];
    }
    const matches = matcherOf(pattern);
    return names.map((name) => path.posix.join(folder, name)).filter((rel) => matches.test(rel));
  });
}

/** What goes from the project's folder: `.workflows/`, and each store it holds with its local files. @param {string} project @returns {string[]} */
function dropsOf(project) {
  const stores = preLeewayStores().flatMap(({ files, localFiles }) => {
    const held = files.filter((rel) => fs.existsSync(path.join(project, rel)));
    return held.length === 0 ? [] : [...held, ...localFilesOf(project, localFiles)];
  });
  return [...new Set([OLD_STATE, ...stores])];
}

/** The drops the code branch holds. @param {string} project @param {string[]} drops @returns {string[]} */
function heldOn(project, drops) {
  const listed = git(project, ['ls-tree', '--name-only', 'HEAD', '--', ...drops.map(literal)]);
  if (!listed.ok) throw new Error(`git ls-tree failed in ${project}: ${listed.stderr.trim()}`);
  const held = new Set(listed.stdout.split('\n'));
  return drops.filter((rel) => held.has(rel));
}

module.exports = {
  id: '081',
  description: 'finish the reshape: stage .workflows/ and the tracker\'s old store out of the default branch, left on disk, and journal what the migration\'s commit takes and what goes once it lands',
  info: 'The reshape\'s last step stages the removal of .workflows/ and the tracker\'s old store from the default branch, leaving both on disk, and journals what it staged for the migration\'s commit: the state branch\'s first commit, then the default branch\'s, which takes the staged removals with the project\'s settings, .gitignore and .worktreeinclude. Once both land, .workflows/ and the old store go from disk. Nothing is committed until the person says yes.',
  /** @param {{projectDir: string, reportUpdate: () => void, reportSkip: () => void}} ctx */
  run({ projectDir, reportUpdate, reportSkip }) {
    const here = path.resolve(projectDir);
    const main = mainCheckout(here);
    const project = main === null ? here : projectInMain(here, main);
    if (main === null || !fs.existsSync(path.join(project, OLD_STATE)) || stateBorn(main)) {
      reportSkip();
      return;
    }
    const drops = dropsOf(project);
    const staged = heldOn(project, drops);
    if (staged.length > 0) mustGit(project, ['rm', '-r', '-q', '--cached', '--ignore-unmatch', '--', ...staged.map(literal)]);
    const state = path.join(main, STATE_DIR);
    writeWhole(path.join(state, CACHE), path.join(state, JOURNAL), `${JSON.stringify({ staged, drops }, null, 2)}\n`);
    reportUpdate();
  },
};

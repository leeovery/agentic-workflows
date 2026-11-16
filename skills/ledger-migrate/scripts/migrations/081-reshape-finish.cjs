'use strict';

//
// Migration 081: The reshape's finish — what goes from the code side, journaled for the migration's commit
//
// Step 6 of the reshape's sequence (21.2, 21.9): once the records and the
// cut are done, the migration's commit is all that is left, made on the
// person's yes at the migration gate. Two commits (21.9.2): the state
// branch's first, which takes the whole state, and the default branch's,
// which drops the project's old state and the tracker's old store and takes
// the project's own files to the new names, as the move wrote them.
//
// What goes, in the project's folder in the main checkout, the runner's
// (the drops): `.workflows/` whole, and each tracker store a task driver's
// folder declares a project from before Ledger kept there (reshape/
// shared.cjs, `preLedgerStores`), which the move carried into the state
// (21.5.18) — the store's files, and the ones its tool keeps local: each
// file in the folder a local pattern names that the pattern matches. A task
// driver's folder whose declaration is missing or does not read is named
// in the notice it hands back.
//
// What it journals, for the engine's commit door, so the engine names
// neither (E9): `.ledger/.cache/migrate/finish.json`, `{drops}`, each named
// from the project's folder. The commit takes the drops out of the default
// branch through its own index, and only once it lands do they go from
// disk, the files git ignores in `.workflows/` with them, since a session
// in another checkout may still read them until then. Nothing is staged:
// the person's index and any commit of their own before the yes carry
// none of the migration's changes. The journal is written whole or not at
// all.
//
// What it drops in the state: each unit's `imports`, the list the move kept
// on its manifest of what came in from where (21.5.7), which the records
// directive's check read (079) and nothing reads once it has passed — each
// file is in the unit's assets, linked from the entries that cite it. Each
// manifest holding one is written whole without it; a retired unit's,
// reference in the product's assets, is as it was kept.
//
// Nothing is committed (21.9.3). Run again — after a kill at the journal,
// or at a manifest — it writes the journal whole again, read from disk as
// before, and finds the manifests already written dropped.
//
// Where the migration is not under way — no `.workflows/` in the project's
// folder, a folder in no repository, or `ledger-state` with a commit — it
// has nothing to journal.
//
// Known edge, not built: a tracker's local pattern with a wildcard in a
// folder's name matches nothing.
//

const fs = require('fs');
const path = require('path');
const { OLD_STATE, STATE_DIR, mainCheckout, projectInMain, stateBorn, writeWhole, preLedgerStores, unreadStores } = require('./reshape/shared.cjs');

const CACHE = '.cache';
const JOURNAL = path.join(CACHE, 'migrate', 'finish.json');

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

/**
 * What goes from the project's folder: `.workflows/`, and each store it
 * holds with its local files.
 * @param {string} project @param {{files: string[], localFiles: string[]}[]} stores
 * @returns {string[]}
 */
function dropsOf(project, stores) {
  const held = stores.flatMap(({ files, localFiles }) => {
    const there = files.filter((rel) => fs.existsSync(path.join(project, rel)));
    return there.length === 0 ? [] : [...there, ...localFilesOf(project, localFiles)];
  });
  return [...new Set([OLD_STATE, ...held])];
}

/**
 * Each unit's manifest in the state written whole without its `imports`,
 * where it holds one.
 * @param {string} state
 */
function dropImports(state) {
  for (const entry of fs.existsSync(state) ? fs.readdirSync(state, { withFileTypes: true }) : []) {
    const file = path.join(state, entry.name, 'manifest.json');
    if (!entry.isDirectory() || entry.name.startsWith('.') || !fs.existsSync(file)) continue;
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Object.hasOwn(manifest, 'imports')) continue;
    delete manifest.imports;
    writeWhole(path.join(state, CACHE), file, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

module.exports = {
  id: '081',
  description: 'finish the reshape: each unit\'s imports list dropped, and .workflows/ and the tracker\'s old store journaled for the migration\'s commit to drop from the default branch, and from disk once it lands',
  info: 'The reshape\'s last step drops the imports list each unit\'s manifest kept for the records directive\'s check, its files in the unit\'s assets, and journals what the migration\'s commit drops: .workflows/ and the tracker\'s old store. The commit is two: the state branch\'s first, then the default branch\'s, which takes .workflows/ and the old store out with the project\'s settings, .gitignore and .worktreeinclude. Once both land, .workflows/ and the old store go from disk. Nothing is staged or committed until the person says yes.',
  /** @param {{projectDir: string, reportUpdate: () => void, reportSkip: () => void}} ctx */
  run({ projectDir, reportUpdate, reportSkip }) {
    const here = path.resolve(projectDir);
    const main = mainCheckout(here);
    const project = main === null ? here : projectInMain(here, main);
    if (main === null || !fs.existsSync(path.join(project, OLD_STATE)) || stateBorn(main)) {
      reportSkip();
      return undefined;
    }
    const { stores, unread } = preLedgerStores();
    const state = path.join(main, STATE_DIR);
    dropImports(state);
    writeWhole(path.join(state, CACHE), path.join(state, JOURNAL), `${JSON.stringify({ drops: dropsOf(project, stores) }, null, 2)}\n`);
    reportUpdate();
    const notice = unreadStores(unread, 'the migration\'s commit drops no store declared there: a store this project kept for such a tracker stays on the default branch and on disk');
    return notice === null ? undefined : { notice };
  },
};

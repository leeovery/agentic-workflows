'use strict';

// ---------------------------------------------------------------------------
// The steps the suites of the gate over a working tree changed under a
// review round take, over review-world.cjs's world (12.7.8, 14.S13): the
// gate drawn and answered, put back with every copy it sets aside held to
// what stood there, a refusal held to the tree as it stood, and the tree's
// own reads and writes.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { output, sectionOf } = require('./engine-harness.cjs');
const {
  UNIT, env, ok, refusedPristine, statePath, git, assert,
} = require('./review-world.cjs');

const DOMAIN = path.join(__dirname, '../../skills/leeway-engine/scripts/domain');
const { treeDrift } = require(path.join(DOMAIN, 'review-phase.cjs'));
const { driftPrint } = require(path.join(DOMAIN, 'review-tree.cjs'));
const { projectRepos } = require(path.join(DOMAIN, '../kernel/repos.cjs'));
const { codeRoot } = require(path.join(DOMAIN, '../kernel/code-root.cjs'));

/** The snapshot's file, from the state root. */
const SNAPSHOT = `.cache/${UNIT}/review/tree.json`;

/** The unit's set-aside, from the state root. */
const ASIDE = `.cache/.set-aside/${UNIT}`;

/** A drawn section flattened to its words, the tree's rules taken out. @param {string} text */
const flat = (text) => text.replace(/[│├└─]/g, ' ').replace(/\s+/g, ' ');

/** What stands at a path, a link by its target: what a copy of it holds, null where nothing stands, a folder said so. @param {string} file */
function standing(file) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (stat === undefined) return null;
  if (stat.isSymbolicLink()) return `-> ${fs.readlinkSync(file)}`;
  return stat.isDirectory() ? 'a folder' : fs.readFileSync(file).toString('base64');
}

/** A file written, its folder made. @param {string} file absolute @param {string} text */
function wrote(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/** The files a repository ignores by its own exclude file, written over. @param {string} repo @param {string[]} patterns */
function excluded(repo, patterns) {
  wrote(path.join(repo, '.git/info/exclude'), patterns.map((line) => `${line}\n`).join(''));
}

/**
 * The gate's steps over the world whose folder `dirOf` answers.
 * @param {() => string} dirOf
 */
function treeKit(dirOf) {
  /** A file of the project's, by its path from it. @param {string} rel */
  const at = (rel) => path.join(dirOf(), rel);

  /** What a file of the project's holds, null where it is gone. @param {string} rel */
  const held = (rel) => (fs.existsSync(at(rel)) ? fs.readFileSync(at(rel), 'utf8') : null);

  /** The repository at `repo`'s working tree, as git's status lists it. @param {string} [repo] */
  const status = (repo = dirOf()) => git(repo, ['status', '--porcelain', '--untracked-files=all']);

  /**
   * The gate drawn: its display and menu, and each row's next, by its key,
   * as `gate` answers it, the gate drawn again for each.
   * @param {string[]} keys
   */
  function gate(keys) {
    const drawn = output(dirOf(), ['render', 'review-tree', UNIT], { env: env() });
    const nexts = keys.map((key) => {
      output(dirOf(), ['render', 'review-tree', UNIT], { env: env() });
      return ok(dirOf(), ['gate', 'review tree', '--pick', key], { env: env() }).next;
    });
    return { display: flat(sectionOf(drawn, 'DISPLAY: review tree')), menu: sectionOf(drawn, 'MENU: review tree'), nexts };
  }

  /** `review restore-tree` refused, writing nothing and the tree as it stood: its error. @param {string} listed @param {string[]} files those to hold as they stood */
  function refusedRestore(listed, files) {
    const before = [status(), ...files.map(held)];
    const { error } = refusedPristine(dirOf(), ['review', 'restore-tree', UNIT, '--listed', listed], { env: env() });
    assert.deepStrictEqual([status(), ...files.map(held)], before, 'a refusal puts nothing back');
    return error;
  }

  /** The tree's drift from the round's snapshot, as it stands now. */
  const driftNow = () => treeDrift(dirOf(), UNIT, projectRepos(codeRoot(dirOf())));

  /** The fingerprint of the tree's drift as the gate would list it now. */
  const listedNow = () => driftPrint(driftNow());

  /**
   * Put back as the gate offers it: its answer, its folder `put-{k}` of
   * round `round`'s set-aside, each path it restores that stood there set
   * aside as it stood — a link as a link — and each named in `staged` with
   * its index's version beside it.
   * @param {{round?: number, k?: number, staged?: Record<string, string>}} [expect]
   */
  function putBack({ round = 1, k = 1, staged = {} } = {}) {
    const { nexts: [put] } = gate(['p']);
    const before = new Map(driftNow().paths.map(({ of }) => [of, standing(at(of))]));
    const res = ok(dirOf(), put.argv, { env: env() });
    const folder = statePath(dirOf(), `${ASIDE}/round-${round}/put-${k}`);
    const copies = [...res.restored.filter((/** @type {string} */ rel) => before.get(rel) !== null), ...Object.keys(staged).map((rel) => `${rel}.staged`)].sort();
    assert.deepStrictEqual(res.set_aside, copies.length === 0 ? null : { folder, paths: copies });
    for (const rel of res.restored) if (before.get(rel) !== null) assert.strictEqual(standing(path.join(folder, rel)), before.get(rel), `${rel} is set aside as it stood`);
    for (const [rel, text] of Object.entries(staged)) assert.strictEqual(fs.readFileSync(path.join(folder, `${rel}.staged`), 'utf8'), text, `${rel}'s staged version is set aside`);
    return res;
  }

  return {
    at, held, status, gate, refusedRestore, listedNow, putBack,
  };
}

module.exports = {
  SNAPSHOT, ASIDE, flat, wrote, excluded, treeKit,
};

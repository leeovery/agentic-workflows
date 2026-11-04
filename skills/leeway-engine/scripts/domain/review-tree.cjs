'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the working tree changed under a round of the review phase
// (12.7.8, 14.1.5, 14.S13) — `render review-tree <unit>`, the gate where the
// person decides what stands once `review round` has refused the tree, and
// `review restore-tree <unit> --listed <print>`, its row putting it back.
//
// The gate lists what changed outside `.leeway/` since the round's snapshot
// (review-phase.cjs, `treeDrift`): each repository whose HEAD moved, then
// each path whose status or what it holds changed. The engine puts a path
// back only where the snapshot proves how the round found it: a path clean
// then, restored to its repository's HEAD then, or removed where that HEAD
// lacks it, the snapshot proving it absent — untracked and not ignored when
// the round began. Each other change is named on the gate as not put back
// here, for the person to put back by hand or keep: a path changed already
// when the round began, whose state then the snapshot holds only by its
// fingerprint; one holding now what such a path held then, moved there; one
// ignored then, or in a folder ignored whole, which the round found there
// unseen; a folder git lists whole, whose content nobody saw listed; and a
// path of a repository the snapshot did not see. A HEAD moved since — a
// commit, a checkout, a reset — puts nothing back, every path's state then
// being its HEAD's.
//
// Put back never destroys: before it touches any path it copies what the
// path holds now into a folder of its own, `put-{k}`, numbered after the
// round's last, under the unit's set-aside (review-phase.cjs, `.cache/
// .set-aside/{unit}/round-{N}/put-{k}/{path}`), which outlives the unit — a
// link copied as a link — and where a path's index holds a version neither
// its HEAD's nor its working tree's, that version beside it, `{path}.staged`.
// Every copy is made before any path is touched, in a folder the put back
// names only once all are; a copy that fails puts nothing back, the copies
// made for it gone with the folder, and names keep as the way on. Its
// answer names its folder and each copy as it landed there; the gate,
// drawn again, the round's report as drawn, the entry and finish's screen
// say where they are while the set-aside holds anything.
//
// Its rows: put it back, `review restore-tree`, offered where no HEAD moved
// and at least one change can be put back, its label saying what it changes
// is set aside and nothing deleted; keep it as it is, `review accept-tree`;
// and the person's own word. Where no snapshot of the round's is held — its
// cache gone, or another clone's round — the gate says so and offers keep
// alone. It refuses a round `review round` cannot read, and a tree as the
// snapshot holds it.
//
// `review restore-tree` puts back exactly the changes the gate listed that
// can be, under the writer lock (engine.cjs), and names the rest; the round
// refuses again while any stands, and the gate returns with what remains.
// `--listed` is the fingerprint of the changes as the gate listed them, so
// it refuses, putting nothing back, where the tree no longer matches what
// the gate listed; where a HEAD moved, or nothing listed can be put back;
// where a copy cannot be set aside; and where no snapshot is held, or
// nothing changed. The round's snapshot stands, and the round is recorded
// again.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { codeRoot } = require('../kernel/code-root.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { git, literally } = require('../kernel/git.cjs');
const { repoOf, repoPath, repoName, topPath } = require('../kernel/repos.cjs');
const { fingerprint } = require('../kernel/fingerprint.cjs');
const { refusing } = require('./staged-payload.cjs');
const { refuserFor } = require('./task-account.cjs');
const { unitInProgress } = require('./topic-standing.cjs');
const { itemTitle, topicTitles } = require('./derivations.cjs');
const { reviewHeld } = require('./review-entry.cjs');
const { reading, reposOf } = require('./phase-checks.cjs');
const {
  roundRefusal, snapshotRound, treeDrift, movedWords, setAsideFolder, setAsideHeld, EMPTY_PRINT,
} = require('./review-phase.cjs');
const { reviewTreeScreen } = require('./projections/review-phase.cjs');

/** @typedef {import('./review-phase.cjs').TreeChange} TreeChange */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {ReturnType<typeof treeDrift>} Drift */
/** A change as the gate lists it: its line, and why the engine does not put it back, null where it does. @typedef {{line: string, kept: string|null}} ListedChange */

/** An untracked path's status. */
const UNTRACKED = '??';

/** The fingerprint of the tree's drift from the snapshot, as the gate lists it. @param {{moved: TreeChange[], paths: TreeChange[]}} drift */
const driftPrint = ({ moved, paths }) => fingerprint(JSON.stringify([moved, paths]));

/** The round under review, the unit and the project's repos, refused where the round cannot be read. @param {string} cwd @param {string} unit @param {string} said */
function roundHeld(cwd, unit, said) {
  const at = reading(cwd, unit, refusing(said, () => unitInProgress(cwd, unit)));
  const { round } = refusing(said, () => reviewHeld(at, roundRefusal));
  return { manifest: at.manifest, round, repos: reposOf(at) };
}

/** Why no snapshot of the round's is held. @param {number} round @param {number|null} held */
const lostWords = (round, held) => `no snapshot of round ${round}'s working tree is held — ${held === null ? 'its cache is gone' : `the one held is round ${held}'s`}`;

/**
 * The tree as it drifted from the round's snapshot, with the fingerprint of
 * the drift; refused where no snapshot of the round's is held, or nothing
 * changed.
 * @param {string} cwd @param {string} unit @param {number} round @param {Repo[]} repos @param {(reason: string) => never} refuse
 */
function driftOf(cwd, unit, round, repos, refuse) {
  const held = snapshotRound(cwd, unit);
  if (held !== round) refuse(`${lostWords(round, held)}, so nothing can be put back: render review-tree ${unit} asks the person whether the tree stands as it is`);
  const drift = treeDrift(cwd, unit, repos);
  if (drift.moved.length + drift.paths.length === 0) refuse(`the working tree outside .leeway/ is as round ${round}'s snapshot holds it — record the round: review round ${unit} --file <round.json>`);
  return { ...drift, print: driftPrint(drift) };
}

/** Why a path, from its repository's top, was unseen when the round began — ignored, or in a folder ignored whole — or null where it was seen. @param {string[]} ignored @param {string} rel */
function unseenWhy(ignored, rel) {
  if (ignored.includes(rel)) return 'ignored when the round began';
  return ignored.some((entry) => entry.endsWith('/') && rel.startsWith(entry)) ? 'in a folder ignored whole when the round began' : null;
}

/** The fingerprint a path's status line holds, after its status; `-` where it held no file. @param {string} value */
const printOf = (value) => value.slice(3);

/** The path changed already when the round began whose content then a path holds now, or null; never an empty file's, which holds nothing moved. @param {Record<string, string>} held the snapshot's @param {TreeChange} change */
function movedFrom(held, { now }) {
  const print = now === null ? '-' : printOf(now);
  if (print === '-' || print === EMPTY_PRINT) return null;
  return Object.keys(held).find((at) => printOf(held[at]) === print) ?? null;
}

/**
 * Why the engine does not put a changed path back, or null where the
 * snapshot proves how the round found it (the header's).
 * @param {Repo[]} repos @param {Drift} drift @param {TreeChange} change
 */
function keptWhy(repos, drift, change) {
  if (change.then !== null) return 'changed already when the round began';
  if (change.of.endsWith('/')) return 'a folder git lists whole';
  const repo = repoOf(repos, change.of);
  const seen = drift.ignored[repoName(repo)];
  if (seen === undefined) return 'in a repository the round did not see';
  const from = movedFrom(drift.held, change);
  if (from !== null) return `it holds what ${from} held when the round began`;
  return unseenWhy(seen, repoPath(repo, change.of));
}

/**
 * Each change as the gate lists it (the header's): a HEAD moved, putting
 * nothing back; each path with why it is not put back, where it is not.
 * @param {Repo[]} repos @param {Drift} drift @returns {ListedChange[]}
 */
const listedChanges = (repos, drift) => [
  ...drift.moved.map((change) => ({ line: movedWords(change), kept: 'so nothing is put back here' })),
  ...drift.paths.map((change) => {
    const why = keptWhy(repos, drift, change);
    return { line: change.of, kept: why === null ? null : `not put back here: ${why}` };
  }),
];

/** The paths the engine puts back: none where a HEAD moved, else each the snapshot proves. @param {Repo[]} repos @param {Drift} drift */
const restorable = (repos, drift) => (drift.moved.length > 0 ? [] : drift.paths.filter((change) => keptWhy(repos, drift, change) === null));

/** A put back's set-aside folder, numbered after the round's last, and the folder its copies are made in until all are. @param {string} cwd @param {string} unit @param {number} round */
function putFolders(cwd, unit, round) {
  const at = path.join(setAsideFolder(cwd, unit), `round-${round}`);
  const taken = (fs.existsSync(at) ? fs.readdirSync(at) : []).map((name) => Number(/^put-([1-9][0-9]*)$/.exec(name)?.[1] ?? 0));
  const k = Math.max(0, ...taken) + 1;
  return { folder: path.join(at, `put-${k}`), making: path.join(at, `.put-${k}`) };
}

/** What stands at `from` copied to `place` as it stands: a link as a link, a file byte for byte, a folder whole. @param {string} from @param {string} place */
function copyAside(from, place) {
  fs.mkdirSync(path.dirname(place), { recursive: true });
  const stat = fs.lstatSync(from);
  if (stat.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(from), place);
  else if (stat.isDirectory()) fs.cpSync(from, place, { recursive: true, verbatimSymlinks: true, errorOnExist: true, force: false });
  else fs.copyFileSync(from, place, fs.constants.COPYFILE_EXCL);
}

/** Git's names, NUL-separated, as a set. @param {string} cwd @param {string[]} args */
const namesOf = (cwd, args) => new Set(git(cwd, args).split('\0').filter(Boolean));

/**
 * Each path put back whose index holds a version neither its HEAD's nor
 * its working tree's, with its repository and its name there.
 * @param {Repo[]} repos @param {TreeChange[]} back
 */
function stagedApart(repos, back) {
  /** @type {Map<Repo, string[]>} */
  const byRepo = new Map();
  for (const { of } of back) byRepo.set(repoOf(repos, of), [...(byRepo.get(repoOf(repos, of)) ?? []), of]);
  return [...byRepo].flatMap(([repo, paths]) => {
    const names = new Map(paths.map((of) => [repoPath(repo, of), of]));
    const pathspec = ['--', ...literally([...names.keys()])];
    const staged = namesOf(repo.path, ['diff', '--cached', '--name-only', '--relative', '--no-renames', '-z', ...pathspec]);
    const apart = namesOf(repo.path, ['diff', '--name-only', '--relative', '--no-renames', '-z', ...pathspec]);
    return [...names].filter(([rel]) => staged.has(rel) && apart.has(rel)).map(([rel, of]) => ({ repo, rel, of }));
  });
}

/**
 * Every path put back that holds anything now, and each version its index
 * holds apart, copied into the put back's own folder before any path is
 * touched (the header's): the folder and each copy as it landed there, null
 * where there was nothing to copy. Refused, nothing put back, where a copy
 * fails.
 * @param {string} cwd @param {string} unit @param {number} round @param {Repo[]} repos @param {TreeChange[]} back @param {(reason: string) => never} refuse
 * @returns {import('./review-phase.cjs').SetAside|null}
 */
function setAside(cwd, unit, round, repos, back, refuse) {
  const root = codeRoot(cwd);
  const { folder, making } = putFolders(cwd, unit, round);
  /** @type {string[]} */
  const paths = [];
  let copying = '';
  try {
    for (const { of } of back) {
      copying = of;
      if (fs.lstatSync(path.join(root, of), { throwIfNoEntry: false }) === undefined) continue;
      copyAside(path.join(root, of), path.join(making, of));
      paths.push(of);
    }
    copying = 'the index\'s versions of what is put back';
    for (const { repo, rel, of } of stagedApart(repos, back)) {
      copying = `${of}'s staged version`;
      const index = path.join(making, '.index');
      // checkout-index writes the file at its path from the repository's top, whatever the cwd.
      git(repo.path, ['checkout-index', `--prefix=${index}${path.sep}`, '--', rel]);
      fs.mkdirSync(path.dirname(path.join(making, of)), { recursive: true });
      fs.renameSync(path.join(index, topPath(repo, rel)), path.join(making, `${of}.staged`));
      fs.rmSync(index, { recursive: true, force: true });
      paths.push(`${of}.staged`);
    }
    copying = `the copies of ${paths.join(', ')}`;
    if (paths.length > 0) fs.renameSync(making, folder);
  } catch (err) {
    fs.rmSync(making, { recursive: true, force: true });
    return refuse(`${copying} could not be set aside in ${folder} — ${messageOf(err)}; nothing is put back — keep the tree as it is, review accept-tree ${unit}, or put it back by hand`);
  }
  fs.rmSync(making, { recursive: true, force: true });
  return paths.length === 0 ? null : { folder, paths: paths.sort() };
}

/** `render review-tree <unit>`: the gate over the tree changed (the header's). @param {string} cwd @param {{dotpath: string}} args */
function reviewTreeSurface(cwd, { dotpath: unit = '' }) {
  const said = 'render review-tree';
  const { manifest, round, repos } = roundHeld(cwd, unit, said);
  const title = itemTitle(topicTitles(manifest), 'review', unit);
  const held = snapshotRound(cwd, unit);
  const aside = setAsideHeld(cwd, unit);
  if (held !== round) return reviewTreeScreen(unit, title, round, { lost: lostWords(round, held), changes: [], print: null, aside });
  const drift = driftOf(cwd, unit, round, repos, refuserFor(said));
  return reviewTreeScreen(unit, title, round, {
    lost: null, changes: listedChanges(repos, drift), print: restorable(repos, drift).length > 0 ? drift.print : null, aside,
  });
}

/**
 * `review restore-tree`: the changes the gate listed that the snapshot
 * proves, put back as the round found them, and the rest named (the
 * header's).
 * @param {string} cwd @param {string} unit @param {string} listed the gate's fingerprint of what it listed
 */
function restoreTree(cwd, unit, listed) {
  const said = 'review restore-tree';
  const refuse = refuserFor(said);
  const { round, repos } = roundHeld(cwd, unit, said);
  const root = codeRoot(cwd);
  const drift = driftOf(cwd, unit, round, repos, refuse);
  if (listed !== drift.print) refuse(`the working tree changed since the gate listed it — render review-tree ${unit} lists it as it stands`);
  const kept = listedChanges(repos, drift).filter(({ kept: why }) => why !== null);
  const back = restorable(repos, drift);
  if (back.length === 0) refuse(`${kept.map(({ line, kept: why }) => `${line} — ${why}`).join('; ')} — the person puts it back by hand, or keeps the tree as it is: review accept-tree ${unit}`);
  const aside = setAside(cwd, unit, round, repos, back, refuse);
  for (const { of, now } of back) {
    if (now?.startsWith(UNTRACKED)) {
      fs.rmSync(path.join(root, of), { force: true });
      continue;
    }
    const repo = repoOf(repos, of);
    git(repo.path, ['restore', `--source=${drift.heads[repoName(repo)]}`, '--staged', '--worktree', '--', ...literally([repoPath(repo, of)])]);
  }
  return {
    round, restored: back.map(({ of }) => of), kept: kept.map(({ line }) => line), set_aside: aside,
  };
}

module.exports = { reviewTreeSurface, restoreTree, driftPrint };

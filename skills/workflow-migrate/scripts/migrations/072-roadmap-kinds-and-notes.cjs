'use strict';

//
// Migration 072: Every roadmap item has a kind, and its note lives on the roadmap
//
// The roadmap holds ideas, bugs and quick-fixes, each item carrying its kind,
// and an item moved off the inbox keeps its note in the roadmap's own notes —
// the inbox archive holds declined items only. On the project manifest's
// `roadmap.items`:
//   - every item without a `kind` gains `kind: "idea"` — every item to date
//     is an idea, the roadmap having refused the others;
//   - every source under `.inbox/.archived/{folder}/{file}.md` — a note the
//     roadmap session archived, then pointed the item at — has its file moved
//     to `.workflows/.roadmap/notes/{folder}/{file}` and the source rewritten
//     `.roadmap/notes/{folder}/{file}`, whatever the item's state: a source is
//     a pointer. The file moves on disk; inside a git work tree both places
//     are staged, a tracked note already gone from the archive staged as
//     removed (a migration stages and never commits — the reviewed migration
//     commit records it). A source whose file is already at its new home is
//     rewritten and staged the same way; one whose file is at neither place,
//     or at both, is left as it is.
//
// Idempotent: an item with a kind and a source off the archive carry nothing
// left to change.
//

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ARCHIVED_NOTE = /^\.inbox\/\.archived\/(ideas|bugs|quickfixes)\/([^/]+\.md)$/;

/** @param {unknown} v @returns {v is Record<string, any>} */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * @param {string} projectDir @param {string[]} args
 * @returns {{ok: boolean, stdout: string, stderr: string}}
 */
function git(projectDir, args) {
  const res = spawnSync('git', args, { cwd: projectDir, encoding: 'utf8' });
  return { ok: !res.error && res.status === 0, stdout: res.stdout || '', stderr: res.stderr || '' };
}

/** The stdout of a git call that must succeed. @param {string} projectDir @param {string[]} args */
function mustGit(projectDir, args) {
  const res = git(projectDir, args);
  if (!res.ok) throw new Error(`git ${args[0]} failed: ${res.stderr.trim()}`);
  return res.stdout;
}

/** @param {string} projectDir */
function insideWorkTree(projectDir) {
  const res = git(projectDir, ['rev-parse', '--is-inside-work-tree']);
  return res.ok && res.stdout.trim() === 'true';
}

/**
 * Stage everything under the paths — additions, edits and removals. A path
 * neither on disk nor tracked is passed over: git refuses a pathspec that
 * matches nothing.
 * @param {string} projectDir @param {string[]} paths
 */
function stage(projectDir, paths) {
  const matched = paths.filter((p) => fs.existsSync(path.join(projectDir, p))
    || mustGit(projectDir, ['ls-files', '--', p]).trim() !== '');
  if (matched.length > 0) mustGit(projectDir, ['add', '-A', '--', ...matched]);
}

/**
 * The source's new pointer, moving its file where it still sits in the
 * archive and staging both places inside a work tree — or null where the
 * source stays as it is.
 * @param {string} projectDir @param {string} source @param {boolean} withGit
 * @returns {string|null}
 */
function relocate(projectDir, source, withGit) {
  const match = ARCHIVED_NOTE.exec(source);
  if (!match) return null;
  const to = `.roadmap/notes/${match[1]}/${match[2]}`;
  const fromAbs = path.join(projectDir, '.workflows', source);
  const toAbs = path.join(projectDir, '.workflows', to);
  const atFrom = fs.existsSync(fromAbs);
  if (atFrom === fs.existsSync(toAbs)) return null;
  if (atFrom) {
    fs.mkdirSync(path.dirname(toAbs), { recursive: true });
    fs.renameSync(fromAbs, toAbs);
  }
  if (withGit) stage(projectDir, [`.workflows/${source}`, `.workflows/${to}`]);
  return to;
}

module.exports = {
  id: '072',
  description: 'every roadmap item gains a kind; notes the roadmap pointed into the inbox archive move to the roadmap\'s own notes',
  info: 'The roadmap now holds ideas, bugs and quick-fixes, each item carrying its kind, and an item\'s note lives in the roadmap\'s own notes rather than the inbox archive. On the project manifest\'s roadmap, this migration gives every item without a kind the kind "idea", and moves every markdown note an item\'s sources name under .workflows/.inbox/.archived/{folder}/ to .workflows/.roadmap/notes/{folder}/ (the move staged in git), rewriting the source to match.',
  run({ projectDir, reportUpdate, reportSkip }) {
    const manifestPath = path.join(projectDir, '.workflows', 'manifest.json');
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      reportSkip();
      return;
    }
    const items = isObject(manifest) && isObject(manifest.roadmap) ? manifest.roadmap.items : undefined;
    if (!isObject(items)) {
      reportSkip();
      return;
    }

    const withGit = insideWorkTree(projectDir);
    let changed = false;
    for (const item of Object.values(items)) {
      if (!isObject(item)) continue;
      if (item.kind === undefined) {
        item.kind = 'idea';
        changed = true;
      }
      if (!Array.isArray(item.sources)) continue;
      item.sources = item.sources.map((/** @type {unknown} */ source) => {
        const to = typeof source === 'string' ? relocate(projectDir, source, withGit) : null;
        if (to === null) return source;
        changed = true;
        return to;
      });
    }

    if (!changed) {
      reportSkip();
      return;
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    reportUpdate();
  },
};

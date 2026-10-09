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
//     a pointer. The file moves with `git mv` where git tracks it, so the
//     move is staged (a migration stages and never commits — the reviewed
//     migration commit records it), renamed on disk otherwise. A source whose
//     file is already at its new home is rewritten; one whose file is at
//     neither place, or at both, is left as it is.
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

/** Whether git tracks the project-relative file. @param {string} projectDir @param {string} rel */
function tracked(projectDir, rel) {
  const res = git(projectDir, ['ls-files', '--', rel]);
  return res.ok && res.stdout.trim() !== '';
}

/**
 * Move one note to the roadmap's notes, `git mv` where tracked.
 * @param {string} projectDir @param {string} from @param {string} to  project-relative
 */
function moveNote(projectDir, from, to) {
  fs.mkdirSync(path.dirname(path.join(projectDir, to)), { recursive: true });
  if (tracked(projectDir, from)) {
    const res = git(projectDir, ['mv', '--', from, to]);
    if (!res.ok) throw new Error(`git mv failed: ${res.stderr.trim()}`);
  } else {
    fs.renameSync(path.join(projectDir, from), path.join(projectDir, to));
  }
}

/**
 * The source's new pointer, moving its file where it still sits in the
 * archive — or null where the source stays as it is.
 * @param {string} projectDir @param {string} source
 * @returns {string|null}
 */
function relocate(projectDir, source) {
  const match = ARCHIVED_NOTE.exec(source);
  if (!match) return null;
  const to = `.roadmap/notes/${match[1]}/${match[2]}`;
  const fromAbs = path.join(projectDir, '.workflows', source);
  const toAbs = path.join(projectDir, '.workflows', to);
  const atFrom = fs.existsSync(fromAbs);
  const atTo = fs.existsSync(toAbs);
  if (atFrom === atTo) return null;
  if (atFrom) moveNote(projectDir, `.workflows/${source}`, `.workflows/${to}`);
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

    let changed = false;
    for (const item of Object.values(items)) {
      if (!isObject(item)) continue;
      if (item.kind === undefined) {
        item.kind = 'idea';
        changed = true;
      }
      if (!Array.isArray(item.sources)) continue;
      item.sources = item.sources.map((/** @type {unknown} */ source) => {
        const to = typeof source === 'string' ? relocate(projectDir, source) : null;
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

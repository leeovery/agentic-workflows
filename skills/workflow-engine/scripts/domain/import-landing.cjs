'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the landing discipline every import lander shares — the
// work-type commit (`workunit create`), the mid-session verb (`workunit
// import`), and the roadmap's project-level import. One planner, one copy,
// one entry shape, so a shared file lands the same way whatever door it came
// through, and absorb dedupes moved files against the same rule.
//
// The name helpers are the same discipline: create's seeds take them too,
// their inbox files landing under the normalisation imports live by.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isoNow } = require('./dates.cjs');

// Sources the knowledge base can read as prose: they land as `{stem}.md` and
// are indexed. Every other extension is kept, lowercased, and tracked on the
// manifest alone.
const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'txt', 'text'];

/**
 * Split a filename at its last dot. A dotfile (`.env`) yields an empty stem,
 * which never lands; a name with no dot yields an empty extension.
 * @param {string} basename
 * @returns {{stem: string, ext: string}}
 */
function splitName(basename) {
  const dot = basename.lastIndexOf('.');
  return dot === -1
    ? { stem: basename, ext: '' }
    : { stem: basename.slice(0, dot), ext: basename.slice(dot + 1) };
}

/**
 * Normalise a source basename into a landing filename: the stem lowercased
 * with runs of non-alphanumerics collapsed to `-` and trimmed; a markdown-ish
 * extension (or none) yielding `.md`, any other kept and lowercased. Returns
 * null when the stem normalises away (a dotfile, a name of punctuation) —
 * the caller decides whether that skips the file or falls back to a safe
 * name.
 * @param {string} basename
 * @returns {string|null}
 */
function normaliseBasename(basename) {
  const { stem, ext } = splitName(basename);
  const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (slug === '') return null;
  const extension = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${slug}.${extension === '' || MARKDOWN_EXTENSIONS.includes(extension) ? 'md' : extension}`;
}

/**
 * A collision-free destination name: suffix the stem with `-2`, `-3`, … —
 * never the extension — until unique against both the destination directory
 * and the batch so far. The batch check keeps a source path given twice from
 * silently overwriting.
 * @param {string} name normalised filename
 * @param {string} destDir absolute destination directory
 * @param {Set<string>} taken names already chosen in this batch
 * @returns {string}
 */
function dedupe(name, destDir, taken) {
  /** @param {string} n */
  const clashes = (n) => taken.has(n) || fs.existsSync(path.join(destDir, n));
  if (!clashes(name)) return name;
  const { stem, ext } = splitName(name);
  const suffix = ext === '' ? '' : `.${ext}`;
  for (let i = 2; ; i++) {
    const candidate = `${stem}-${i}${suffix}`;
    if (!clashes(candidate)) return candidate;
  }
}

/**
 * Plan a batch of sources into landing names, deduped against the
 * destination directory and the batch. Reads the directory, writes nothing —
 * the copy is a separate step, so a caller can refuse before anything lands.
 * @param {string[]} sources source paths
 * @param {string} destDir absolute destination directory
 * @returns {{planned: {src: string, dest: string}[], skipped: string[]}}
 */
function planImports(sources, destDir) {
  /** @type {Set<string>} */
  const taken = new Set();
  /** @type {{src: string, dest: string}[]} */
  const planned = [];
  /** @type {string[]} */
  const skipped = [];
  for (const src of sources) {
    const name = normaliseBasename(path.basename(src));
    if (name === null) {
      skipped.push(src);
      continue;
    }
    const dest = dedupe(name, destDir, taken);
    taken.add(dest);
    planned.push({ src, dest });
  }
  return { planned, skipped };
}

/**
 * Copy each planned landing into place. The mode is pinned rather than
 * inherited: a file dropped from a camera, a download, or another checkout
 * arrives with whatever bits that tool set, and the tree it joins is
 * readable.
 * @param {string} cwd project root
 * @param {string} destDir absolute destination directory
 * @param {{src: string, dest: string}[]} planned
 */
function copyImports(cwd, destDir, planned) {
  if (planned.length === 0) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const move of planned) {
    const landed = path.join(destDir, move.dest);
    fs.copyFileSync(path.resolve(cwd, move.src), landed);
    fs.chmodSync(landed, 0o644);
  }
}

/**
 * The manifest entry one landing records — `origin` is required, so every
 * lander names where its file came from.
 * @param {string} dest landing filename
 * @param {string} origin `discovery` | `roadmap` | `{phase}/{topic}`
 * @returns {{path: string, imported_at: string, origin: string}}
 */
function importEntry(dest, origin) {
  return { path: `imports/${dest}`, imported_at: isoNow(), origin };
}

/**
 * Whether a landing is knowledge-base material: markdown alone. Anything
 * else is tracked on the manifest and never embedded — the store reads utf8
 * prose, and a binary would either refuse or embed garbage.
 * @param {string} dest landing filename
 */
function isIndexableImport(dest) {
  return dest.endsWith('.md');
}

module.exports = {
  normaliseBasename,
  dedupe,
  planImports,
  copyImports,
  importEntry,
  isIndexableImport,
  MARKDOWN_EXTENSIONS,
};

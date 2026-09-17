'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the landing discipline every import lander shares — one
// planner, one copy, one entry shape, so a shared file lands the same way
// whatever door it came through.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isoNow } = require('./dates.cjs');

// Sources the knowledge base can read as prose: they land as `{stem}.md` and
// are indexed. Every other extension is kept, lowercased, and tracked on the
// manifest alone.
const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'txt', 'text'];

/**
 * Split a filename at its last dot. A name with no dot yields an empty
 * extension.
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
 * null for a dotfile and for a name that normalises away (all punctuation) —
 * the caller decides whether that skips the file or falls back to a safe
 * name.
 * @param {string} basename
 * @returns {string|null}
 */
function normaliseBasename(basename) {
  // A leading dot marks tooling state — an editor's config, a credentials
  // file, a lockfile — never material a person means to share, whatever
  // follows the dot.
  if (basename.startsWith('.')) return null;
  const { stem, ext } = splitName(basename);
  const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (slug === '') return null;
  const extension = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${slug}.${extension === '' || MARKDOWN_EXTENSIONS.includes(extension) ? 'md' : extension}`;
}

// The grammar a document writes an import link in: the relative hop out of
// the document's own directory (`../imports/{name}` from a phase file,
// `../../imports/{name}` from a specification) and the basename. Anchoring on
// the hops is what keeps a project path that merely ends in `imports/` — a
// source tree's own `src/imports/foo` — out of the match.
const IMPORT_LINK_HOPS = '(?:\\.\\./)+';
const IMPORT_NAME_CHARS = '[A-Za-z0-9._-]';

/**
 * The regex over a document's import links: group 1 is the relative hops,
 * group 2 the linked basename. Given names it matches those alone — a rename
 * substitutes only what it broke, and the right-hand bound stops a name from
 * matching the head of a longer one; given none it captures every link.
 * @param {string[]} [names] basenames to bound the match to
 * @returns {RegExp}
 */
function importLinkPattern(names) {
  const body = names === undefined
    ? `${IMPORT_NAME_CHARS}+`
    : names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`(${IMPORT_LINK_HOPS})imports/(${body})(?!${IMPORT_NAME_CHARS})`, 'g');
}

/**
 * Refuse the whole batch unless every source is an existing regular file. A
 * directory passes an existence check and then throws mid-copy, inside the
 * lock, with the files before it already on disk and unrecorded — so the
 * refusal comes here, before anything is copied. The offending paths ride
 * the error as `payload.missing_imports`, which is what the caller re-prompts
 * over.
 * @param {string} cwd project root
 * @param {string[]} paths source paths
 * @throws {Error & {payload: {missing_imports: string[]}}}
 */
function assertLandableSources(cwd, paths) {
  const missing = paths.filter((p) => {
    try {
      return !fs.statSync(path.resolve(cwd, p)).isFile();
    } catch {
      return true;
    }
  });
  if (missing.length === 0) return;
  const err = /** @type {Error & {payload: {missing_imports: string[]}}} */ (
    new Error(`import path(s) not found, not a file, or unreadable: ${missing.join(', ')}`)
  );
  err.payload = { missing_imports: missing };
  throw err;
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
 * @typedef {{path: string, imported_at?: string, origin?: string}} ImportEntry
 *   a manifest `imports[]` entry as read back: the field surface can write one
 *   without an origin
 */

/**
 * The manifest entry one landing records — `origin` is required, so every
 * lander names where its file came from.
 * @param {string} dest landing filename
 * @param {string} origin `discovery` | `roadmap` | `{phase}/{topic}`
 * @returns {ImportEntry}
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

/**
 * A landed work-unit import's project-relative path — what the knowledge base
 * is handed and what the manifest entry's `path` hangs off. The roadmap's
 * imports live at the product altitude and have a root of their own.
 * @param {string} workUnit
 * @param {string} dest landing filename
 * @returns {string}
 */
function importArtifact(workUnit, dest) {
  return `.workflows/${workUnit}/imports/${dest}`;
}

module.exports = {
  normaliseBasename,
  dedupe,
  planImports,
  copyImports,
  importEntry,
  isIndexableImport,
  importArtifact,
  importLinkPattern,
  assertLandableSources,
};

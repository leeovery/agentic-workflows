'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the landing discipline every import lander shares — one
// planner, one copy, one entry shape, so a shared file lands the same way
// whatever door it came through.
//
// A shared folder lands whole: its own name by the rules a file's stem
// takes, deduped as a file is and never the migration's `legacy`, and its
// tree beneath it with every name kept, so the links its files make to each
// other still resolve. A dotted entry in it is tooling state, passed over
// and named as a dotfile is, and a folder landing no file, shared or
// within one, is skipped and named. A shared folder's name the landing
// changes is named. A name a filesystem the state may live on refuses is
// slugged by the file rules and named, deduped against its folder's names
// in any case, as a filesystem that ignores case would read them. A file Claude Code loads as instructions once
// a file beside it is read — `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, in
// any case — lands under a name it never loads, named, whether shared alone
// or in a folder. A name holding a control character, an entry that is
// neither a file nor a folder, a file that cannot be read and a folder that
// cannot be listed refuse the whole call, by name, before anything lands —
// a path shared that cannot be read or listed among the paths named
// missing.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

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

/**
 * Normalise a shared folder's own name as a file's stem is: lowercased, runs
 * of non-alphanumerics collapsed to `-` and trimmed. Null for a dotted
 * folder and for a name that normalises away.
 * @param {string} basename
 * @returns {string|null}
 */
function normaliseFolderName(basename) {
  if (basename.startsWith('.')) return null;
  const slug = basename.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug === '' ? null : slug;
}

/** A name holding a control character, which no landing carries. */
const UNHOLDABLE = /[\x00-\x1f\x7f]/;

/** A name a filesystem the state may live on refuses, which lands slugged. */
const UNPORTABLE = /[<>:"\\|?*]/;

/** The files Claude Code loads as instructions, by their names lowercased, and the names they land under. */
const INSTRUCTIONS = Object.freeze({ 'claude.md': 'claude-md.md', 'claude.local.md': 'claude-local-md.md', 'agents.md': 'agents-md.md' });

/** The name a file lands under where Claude Code would load it as instructions; null for any other. @param {string} name */
const unloaded = (name) => INSTRUCTIONS[/** @type {keyof typeof INSTRUCTIONS} */ (name.toLowerCase())] ?? null;

/** The assets folder the migration's legacy files live in, which no shared folder takes. */
const MIGRATION_FOLDER = 'legacy';

/** Whether the file at `at` can be read, or the folder listed. @param {string} at absolute @param {boolean} folder */
function readable(at, folder) {
  try {
    fs.accessSync(at, folder ? fs.constants.R_OK | fs.constants.X_OK : fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Why an entry of a shared folder cannot land, or null where it can.
 * @param {string} at absolute @param {fs.Dirent} entry
 * @returns {string|null}
 */
function cannotLand(at, entry) {
  if (UNHOLDABLE.test(entry.name)) return 'a control character in its name — rename it, or share the folder without it';
  if (entry.isSymbolicLink()) return 'a link — share the folder without it';
  if (!entry.isFile() && !entry.isDirectory()) return 'neither a file nor a folder — share the folder without it';
  if (readable(at, entry.isDirectory())) return null;
  return `${entry.isDirectory() ? 'a folder that cannot be listed' : 'a file that cannot be read'} — make it readable, or share the folder without it`;
}

/**
 * A shared folder's tree as it lands, in name order: each file, by its path
 * below the folder and the path it lands at; its dotted entries and each
 * folder within it landing no file, passed over; each name the landing
 * changes; and what cannot land, with why.
 * @typedef {{files: {from: string, to: string}[], skipped: string[], renamed: {from: string, to: string}[], refused: string[]}} Tree
 * @param {string} folder absolute @returns {Tree}
 */
function folderTree(folder) {
  /** @type {Tree} */
  const tree = { files: [], skipped: [], renamed: [], refused: [] };
  /** The files landed below `from`, at `to`. @param {string} from @param {string} to @returns {number} */
  const walk = (from, to) => {
    const before = tree.files.length;
    const entries = fs.readdirSync(path.join(folder, from), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
    /** @type {Set<string>} */
    const taken = new Set(entries.map((entry) => entry.name));
    for (const entry of entries) {
      const at = from === '' ? entry.name : `${from}/${entry.name}`;
      const why = entry.name.startsWith('.') ? null : cannotLand(path.join(folder, at), entry);
      if (entry.name.startsWith('.')) tree.skipped.push(at);
      else if (why !== null) tree.refused.push(`${at} (${why})`);
      else {
        const named = landedName(entry, taken);
        if (named === null) {
          tree.skipped.push(at);
          continue;
        }
        const landed = to === '' ? named : `${to}/${named}`;
        const rename = named === entry.name ? [] : [{ from: at, to: landed }];
        if (entry.isFile()) {
          tree.renamed.push(...rename);
          tree.files.push({ from: at, to: landed });
          continue;
        }
        const mark = tree.renamed.length;
        if (walk(at, landed) === 0) {
          tree.renamed.length = mark;
          tree.skipped.push(at);
        } else {
          tree.renamed.splice(mark, 0, ...rename);
        }
      }
    }
    return tree.files.length - before;
  };
  walk('', '');
  return tree;
}

/**
 * The name an entry of a shared folder lands under: its own, but slugged
 * where a filesystem the state may live on refuses it and moved off a name
 * Claude Code loads as instructions, either deduped against its folder's
 * other names in any case; null where the rules slug it away.
 * @param {fs.Dirent} entry @param {Set<string>} taken its folder's names, each kept or landed
 * @returns {string|null}
 */
function landedName(entry, taken) {
  const portable = UNPORTABLE.test(entry.name);
  const name = portable ? (entry.isDirectory() ? normaliseFolderName(entry.name) : normaliseBasename(entry.name)) : entry.name;
  if (name === null) return null;
  const moved = entry.isFile() ? unloaded(name) : null;
  if (!portable && moved === null) return name;
  taken.delete(entry.name);
  const free = dedupe(moved ?? name, null, taken);
  taken.add(free);
  return free;
}

/** A source path with any trailing slash taken off. @param {string} src */
const unslashed = (src) => src.replace(/\/+$/, '');

// The grammar a document writes a link to a file of its unit's in: the
// relative hop out of the document's own directory (`../../assets/{name}`
// or `../../seeds/{name}` from a topic's log), the home's folder and the
// basename. Anchoring on the hops is what keeps a project path that merely
// ends in the home's name — a source tree's own `src/assets/foo` — out of
// the match. A name ends where no name character follows it, or a dot no
// name character follows: a sentence's full stop.
const HOME_LINK_HOPS = '(?:\\.\\./)+';
const HOME_NAME_END = '(?![A-Za-z0-9_-]|\\.[A-Za-z0-9._-])';

/**
 * The regex over a document's links into `home`, a folder of its unit's —
 * `seeds`, `assets` or `spikes` — to one of `names`: group 1 is
 * the relative hops, group 2 the linked name. A rename substitutes only
 * what it broke, and the right-hand bound stops a name from matching the
 * head of a longer one.
 * @param {string} home @param {string[]} names basenames to bound the match to
 * @returns {RegExp}
 */
function homeLinkPattern(home, names) {
  const body = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`(${HOME_LINK_HOPS})${home}/(${body})${HOME_NAME_END}`, 'g');
}

/** Whether a source is a folder. @param {string} cwd @param {string} src */
const isFolder = (cwd, src) => fs.statSync(path.resolve(cwd, src)).isDirectory();

/**
 * Refuse the whole batch unless every source is an existing file or folder,
 * and everything in each folder can land — checked before anything is
 * copied, so nothing lands half. A path naming neither rides the error as
 * `payload.missing_imports`, which is what the caller re-prompts over; a
 * folder holding what cannot land is refused naming each such path, with
 * why.
 * @param {string} cwd project root
 * @param {string[]} paths source paths
 * @throws {Error & {payload?: {missing_imports: string[]}}}
 */
function assertLandableSources(cwd, paths) {
  const missing = paths.filter((p) => {
    try {
      const stat = fs.statSync(path.resolve(cwd, p));
      return !(stat.isFile() || stat.isDirectory()) || !readable(path.resolve(cwd, p), stat.isDirectory());
    } catch {
      return true;
    }
  });
  if (missing.length > 0) {
    const err = /** @type {Error & {payload: {missing_imports: string[]}}} */ (
      new Error(`import path(s) not found, not a file or a folder, or unreadable: ${missing.join(', ')}`)
    );
    err.payload = { missing_imports: missing };
    throw err;
  }
  const cannot = paths.filter((p) => isFolder(cwd, p)).flatMap((p) => folderTree(path.resolve(cwd, p)).refused.map((rel) => `${unslashed(p)}/${rel}`));
  if (cannot.length > 0) throw new Error(`import: a shared folder holds what cannot land, so nothing landed — ${cannot.join('; ')}`);
}

/**
 * A collision-free destination name: suffix the stem with `-2`, `-3`, … —
 * never the extension — until unique against both the destination directory
 * and the batch so far, in any case. The batch check keeps a source path
 * given twice from silently overwriting.
 * @param {string} name normalised filename
 * @param {string|null} destDir absolute destination directory, or null for a folder not on disk yet
 * @param {Set<string>} taken names already chosen in this batch
 * @returns {string}
 */
function dedupe(name, destDir, taken) {
  const folded = new Set([...taken].map((n) => n.toLowerCase()));
  /** @param {string} n */
  const clashes = (n) => folded.has(n.toLowerCase()) || (destDir !== null && fs.existsSync(path.join(destDir, n)));
  if (!clashes(name)) return name;
  const { stem, ext } = splitName(name);
  const suffix = ext === '' ? '' : `.${ext}`;
  for (let i = 2; ; i++) {
    const candidate = `${stem}-${i}${suffix}`;
    if (!clashes(candidate)) return candidate;
  }
}

/**
 * A planned landing: its source, its name in the destination, and for a
 * folder the files of its tree, each by its path below the source and the
 * path it lands at below the destination.
 * @typedef {{src: string, dest: string, files?: {from: string, to: string}[]}} Landing
 */

/**
 * Plan a batch of sources into landing names, deduped against the
 * destination directory and the batch: a file by the filename rules, moved
 * off a name Claude Code loads as instructions, a folder by its own name's,
 * never the migration's legacy folder, its tree beneath it as it lands.
 * Reads the directory, writes nothing — the copy is a separate step, so a
 * caller can refuse before anything lands. A dotfile, a folder's dotted
 * entries and a folder landing no file are skipped and named; each name the
 * landing changes beyond the file rules — a shared folder's own among them
 * — is named, from its source to where it lands below the destination.
 * @param {string} cwd project root
 * @param {string[]} sources source paths
 * @param {string} destDir absolute destination directory
 * @returns {{planned: Landing[], skipped: string[], renamed: {from: string, to: string}[]}}
 */
function planImports(cwd, sources, destDir) {
  /** @type {Set<string>} */
  const taken = new Set();
  /** @type {Landing[]} */
  const planned = [];
  /** @type {string[]} */
  const skipped = [];
  /** @type {{from: string, to: string}[]} */
  const renamed = [];
  for (const src of sources) {
    const folder = isFolder(cwd, src);
    const base = path.basename(unslashed(src));
    const normal = folder ? normaliseFolderName(base) : normaliseBasename(base);
    const tree = folder ? folderTree(path.resolve(cwd, src)) : null;
    if (normal === null || tree?.files.length === 0) {
      skipped.push(src, ...(tree?.skipped ?? []).map((rel) => `${unslashed(src)}/${rel}`));
      continue;
    }
    const name = unloaded(normal) ?? normal;
    const dest = dedupe(name, destDir, folder ? new Set([...taken, MIGRATION_FOLDER]) : taken);
    taken.add(dest);
    if (tree === null) {
      if (name !== normal) renamed.push({ from: src, to: dest });
      planned.push({ src, dest });
      continue;
    }
    if (dest !== base) renamed.push({ from: unslashed(src), to: dest });
    skipped.push(...tree.skipped.map((rel) => `${unslashed(src)}/${rel}`));
    renamed.push(...tree.renamed.map(({ from, to }) => ({ from: `${unslashed(src)}/${from}`, to: `${dest}/${to}` })));
    planned.push({ src, dest, files: tree.files });
  }
  return { planned, skipped, renamed };
}

/** One file copied into place, at a readable mode. @param {string} from absolute @param {string} to absolute */
function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  fs.chmodSync(to, 0o644);
}

/**
 * Copy each planned landing into place, a folder's tree file by file. The
 * mode is pinned rather than inherited: a file dropped from a camera, a
 * download, or another checkout arrives with whatever bits that tool set,
 * and the tree it joins is readable.
 * @param {string} cwd project root
 * @param {string} destDir absolute destination directory
 * @param {Landing[]} planned
 */
function copyImports(cwd, destDir, planned) {
  for (const move of planned) {
    const from = path.resolve(cwd, move.src);
    const landed = path.join(destDir, move.dest);
    if (move.files === undefined) copyFile(from, landed);
    else for (const file of move.files) copyFile(path.join(from, file.from), path.join(landed, file.to));
  }
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
  isIndexableImport,
  homeLinkPattern,
  assertLandableSources,
};

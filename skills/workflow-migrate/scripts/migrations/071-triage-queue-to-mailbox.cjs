'use strict';

//
// Migration 071: The triage queue becomes the mailbox
//
// What one topic sends another is a message, and the place it waits is the
// receiving topic's mailbox. Over every work unit, whatever its status:
//   - every file under each `{phase}/.triage/` moves to the same place under
//     `{phase}/.mailbox/`, taken in name order. A mailbox can already hold
//     messages — a session on the updated engine can send one before any
//     start-up has run this migration — so a message whose number is taken
//     there takes the number the engine's send would give, keeping its slug.
//     The directories the move empties are removed. Inside a git work tree
//     both sides are staged, a tracked file already gone from disk staged as
//     removed (a migration stages and never commits — the reviewed migration
//     commit records it);
//   - every phase item's `status` and `previous_status` reading `triaged`
//     reads `unstarted`;
//   - every discovery map item's `source`, split on commas, has each
//     `reroute:{origin}` segment rewritten `message:{origin}`;
//   - in every research and discussion document, each record a document
//     review left where it sent a note on, `Rerouted to {topic} triage
//     ({date})`, reads `Sent to {topic}'s mailbox ({date})` wherever it sits
//     in its line — the record the review now recognises. Written on disk and left unstaged, as 054, 055
//     and 068 leave their document edits, for the migration commit to take.
// A directory whose manifest is absent or does not parse is not a work unit,
// and is left alone.
//
// Where a research or discussion document still holds a straggler — a triage
// section whose body carries anything but whitespace and a lone "(none)" —
// this migration hands back an addendum stating the recovery into the
// mailbox. Migration 054's addendum, which fires on an install that runs 054
// in this same boot, names `.triage/`, and the check runs after every
// migration — after this move — so 071's, read after it, also says nothing
// goes there. An emptied section, which 054's addendum leaves on a completed
// topic's document, never fires it.
//
// Idempotent: an emptied `.triage/` is gone, and a rewritten status, segment
// and record no longer carry the old words.
//

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const STATUS_FIELDS = ['status', 'previous_status'];

// The heading 054's addendum hunts, malformed forms ("## Triage:", "##Triage") included.
const TRIAGE_HEADING = /^##\s*triage\b/i;

// What closes a section: the next `#` or `##` heading — entries sit under `###`.
const SECTION_END = /^#{1,2}(?!#)/;

// The documents a straggler and a send record sit in.
const DOCUMENT_PHASES = ['research', 'discussion'];

// A message file, as the engine's send reads a mailbox when it numbers one.
const MESSAGE = /^(\d{3})-(.+)\.md$/;

// A record wherever it sits in a line, the punctuation after it left as written.
const OLD_RECORD = /Rerouted to ([^\s()]+) triage \((\d{4}-\d{2}-\d{2})\)/g;

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

/** @param {string} p */
function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** The numbers the messages in a mailbox directory carry, none where it is absent. @param {string} dirAbs @returns {number[]} */
function messageNumbers(dirAbs) {
  let names;
  try {
    names = fs.readdirSync(dirAbs);
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    const message = name.match(MESSAGE);
    return message ? [Number(message[1])] : [];
  });
}

/**
 * The name a file takes arriving in a mailbox directory: its own, unless it
 * is taken there. A message whose number is taken takes the next number —
 * one above the highest there — keeping its slug; any other file whose name
 * is taken stays where it is (null).
 * @param {string} toAbs @param {string} name
 * @returns {string|null}
 */
function arrivalName(toAbs, name) {
  const message = name.match(MESSAGE);
  if (!message) return fs.existsSync(path.join(toAbs, name)) ? null : name;
  const numbers = messageNumbers(toAbs);
  if (!numbers.includes(Number(message[1]))) return name;
  return `${String(Math.max(...numbers) + 1).padStart(3, '0')}-${message[2]}.md`;
}

/**
 * Move everything under `fromAbs` to the same place under `toAbs`, each
 * directory's entries in name order, and remove each directory the move
 * empties.
 * @param {string} fromAbs @param {string} toAbs
 * @returns {boolean} whether anything moved or was removed
 */
function merge(fromAbs, toAbs) {
  let changed = false;
  const entries = fs.readdirSync(fromAbs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const entry of entries) {
    const from = path.join(fromAbs, entry.name);
    if (entry.isDirectory()) {
      changed = merge(from, path.join(toAbs, entry.name)) || changed;
      continue;
    }
    const name = arrivalName(toAbs, entry.name);
    if (name === null) continue;
    fs.mkdirSync(toAbs, { recursive: true });
    fs.renameSync(from, path.join(toAbs, name));
    changed = true;
  }
  if (fs.readdirSync(fromAbs).length > 0) return changed;
  fs.rmdirSync(fromAbs);
  return true;
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
 * Move each phase's `.triage/` in one work unit into its `.mailbox/`.
 * @param {string} projectDir @param {string} workUnit @param {boolean} withGit
 * @returns {boolean} whether anything moved
 */
function moveMailboxes(projectDir, workUnit, withGit) {
  let moved = false;
  for (const entry of fs.readdirSync(path.join(projectDir, '.workflows', workUnit), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const from = `.workflows/${workUnit}/${entry.name}/.triage`;
    const to = `.workflows/${workUnit}/${entry.name}/.mailbox`;
    if (!isDirectory(path.join(projectDir, from))) continue;
    moved = merge(path.join(projectDir, from), path.join(projectDir, to)) || moved;
    if (withGit) stage(projectDir, [from, to]);
  }
  return moved;
}

/** @param {Record<string, any>} manifest @returns {boolean} whether anything changed */
function rewriteStatuses(manifest) {
  let changed = false;
  for (const phase of Object.values(isObject(manifest.phases) ? manifest.phases : {})) {
    if (!isObject(phase) || !isObject(phase.items)) continue;
    for (const item of Object.values(phase.items)) {
      if (!isObject(item)) continue;
      for (const field of STATUS_FIELDS) {
        if (item[field] === 'triaged') {
          item[field] = 'unstarted';
          changed = true;
        }
      }
    }
  }
  return changed;
}

/** @param {Record<string, any>} manifest @returns {boolean} whether anything changed */
function rewriteSources(manifest) {
  const discovery = isObject(manifest.phases) ? manifest.phases.discovery : undefined;
  if (!isObject(discovery) || !isObject(discovery.items)) return false;
  let changed = false;
  for (const item of Object.values(discovery.items)) {
    if (!isObject(item) || typeof item.source !== 'string') continue;
    const source = item.source.split(',').map((segment) => segment.replace(/^(\s*)reroute:/, '$1message:')).join(',');
    if (source !== item.source) {
      item.source = source;
      changed = true;
    }
  }
  return changed;
}

/** The markdown documents directly in a directory, none where it is absent. @param {string} dir @returns {string[]} */
function markdownFiles(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name.endsWith('.md'))
      .map((f) => path.join(dir, f.name));
  } catch {
    return [];
  }
}

/**
 * Rewrite the old send records in one work unit's research and discussion documents.
 * @param {string} unitDir
 * @returns {boolean} whether any document changed
 */
function rewriteRecords(unitDir) {
  let changed = false;
  for (const file of DOCUMENT_PHASES.flatMap((phase) => markdownFiles(path.join(unitDir, phase)))) {
    const text = fs.readFileSync(file, 'utf8');
    const rewritten = text.replace(OLD_RECORD, "Sent to $1's mailbox ($2)");
    if (rewritten === text) continue;
    fs.writeFileSync(file, rewritten);
    changed = true;
  }
  return changed;
}

/**
 * Whether a document holds a triage section still carrying content — any
 * line in its body other than whitespace and a lone `(none)`.
 * @param {string} text
 * @returns {boolean}
 */
function holdsStraggler(text) {
  let inSection = false;
  for (const line of text.split('\n')) {
    if (TRIAGE_HEADING.test(line)) {
      inSection = true;
      continue;
    }
    if (SECTION_END.test(line)) {
      inSection = false;
      continue;
    }
    const body = line.trim();
    if (inSection && body !== '' && body !== '(none)') return true;
  }
  return false;
}

/**
 * Whether any research or discussion document still holds a straggler.
 * @param {string} workflowsDir @param {fs.Dirent[]} entries
 * @returns {boolean}
 */
function holdsTriageSections(workflowsDir, entries) {
  return entries.some((entry) => entry.isDirectory() && !entry.name.startsWith('.')
    && DOCUMENT_PHASES.some((phase) => markdownFiles(path.join(workflowsDir, entry.name, phase))
      .some((file) => holdsStraggler(fs.readFileSync(file, 'utf8')))));
}

module.exports = {
  id: '071',
  description: 'the triage queue becomes the mailbox — messages moved in, the unstarted status, message: map sources, and send records',
  info: 'The per-topic triage queue is renamed the mailbox. Over every work unit, whatever its status, this migration moves every file under each {phase}/.triage/ directory to the same place under {phase}/.mailbox/ — a message whose number the mailbox already holds takes the next free number there, its slug kept — removes the emptied .triage/ directories, and stages the move in git; rewrites every phase item\'s status and previous_status from "triaged" to "unstarted"; rewrites each reroute: segment of a discovery map item\'s source to message:; and rewrites each "Rerouted to {topic} triage ({date})" record a document review left in a research or discussion document to "Sent to {topic}\'s mailbox ({date})", the record the review now recognises.',
  run({ projectDir, reportUpdate, reportSkip }) {
    const workflowsDir = path.join(projectDir, '.workflows');
    let entries;
    try {
      entries = fs.readdirSync(workflowsDir, { withFileTypes: true });
    } catch {
      reportSkip();
      return;
    }

    const withGit = insideWorkTree(projectDir);
    let touched = false;
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const manifestPath = path.join(workflowsDir, entry.name, 'manifest.json');
      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {
        continue;
      }
      if (!isObject(manifest)) continue;

      const moved = moveMailboxes(projectDir, entry.name, withGit);
      const statuses = rewriteStatuses(manifest);
      const sources = rewriteSources(manifest);
      if (statuses || sources) fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      const records = rewriteRecords(path.join(workflowsDir, entry.name));
      if (moved || statuses || sources || records) {
        reportUpdate();
        touched = true;
      }
    }
    if (!touched) reportSkip();
    if (!holdsTriageSections(workflowsDir, entries)) return;
    return {
      verify: 'Some research or discussion documents still hold content in a "## Triage" section, a malformed heading such as "## Triage:" or "##Triage" included. That content is concerns other topics sent, parked in the document in a shape nothing reads any more: a topic\'s incoming messages now wait in its mailbox, one file per message. In every research and discussion document (.workflows/*/research/*.md, .workflows/*/discussion/*.md) whose triage section holds anything but "(none)", move each concern into that document\'s mailbox — .workflows/{wu}/{phase}/.mailbox/{topic}/ for the document .workflows/{wu}/{phase}/{topic}.md — as NNN-{slug}.md, NNN the next free number there (one above the highest, 001 in an empty mailbox) and the slug the concern\'s title in kebab case, one file per concern, keeping its full text; then reset the section body to "(none)". Nothing goes into a .triage/ directory, whatever an earlier check in this start-up says: nothing reads one any more.',
    };
  },
};

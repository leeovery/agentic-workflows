'use strict';

//
// Migration 071: The triage queue becomes the mailbox
//
// What one topic sends another is a message, and the place it waits is the
// receiving topic's mailbox. Over every work unit, whatever its status:
//   - each `{phase}/.triage/` is renamed `{phase}/.mailbox/`, moved with
//     `git mv` where git tracks anything under it so the move is staged (a
//     migration stages and never commits — the reviewed migration commit
//     records it), renamed on disk otherwise;
//   - every phase item's `status` and `previous_status` reading `triaged`
//     reads `unstarted`;
//   - every discovery map item's `source`, split on commas, has each
//     `reroute:{origin}` segment rewritten `message:{origin}`.
// A directory whose manifest is absent or does not parse is not a work unit,
// and is left alone.
//
// Migration 054's verification addendum, which still fires on an install
// that runs 054 in this same boot, tells the check to move a "## Triage"
// straggler into `.triage/` — performed after every migration has run, so
// after this rename. Where a research or discussion document still holds a
// straggler — a triage section whose body carries anything but whitespace
// and a lone "(none)" — this migration hands back an addendum of its own,
// read after 054's, that points the move at the mailbox instead. An emptied
// section, which 054's addendum leaves on a completed topic's document,
// never fires it.
//
// Idempotent: a renamed directory, a rewritten status and a rewritten
// segment no longer carry the old words.
//

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const STATUS_FIELDS = ['status', 'previous_status'];

// The heading 054's addendum hunts, malformed forms ("## Triage:", "##Triage") included.
const TRIAGE_HEADING = /^##\s*triage\b/i;

// What closes a section: the next `#` or `##` heading — entries sit under `###`.
const SECTION_END = /^#{1,2}(?!#)/;

// The documents 054's addendum hunts in.
const SECTION_PHASES = ['research', 'discussion'];

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

/**
 * Rename each phase's `.triage/` in one work unit to `.mailbox/`.
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
    if (withGit && mustGit(projectDir, ['ls-files', '--', from]).trim() !== '') {
      mustGit(projectDir, ['mv', '--', from, to]);
    } else {
      fs.renameSync(path.join(projectDir, from), path.join(projectDir, to));
    }
    moved = true;
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
    && SECTION_PHASES.some((phase) => {
      const dir = path.join(workflowsDir, entry.name, phase);
      let files;
      try {
        files = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return false;
      }
      return files.some((f) => f.isFile() && f.name.endsWith('.md')
        && holdsStraggler(fs.readFileSync(path.join(dir, f.name), 'utf8')));
    }));
}

module.exports = {
  id: '071',
  description: 'the triage queue becomes the mailbox — directories, the unstarted status, and message: map sources',
  info: 'The per-topic triage queue is renamed the mailbox. Over every work unit, whatever its status, this migration renames each {phase}/.triage/ directory to {phase}/.mailbox/ (the move staged in git), rewrites every phase item\'s status and previous_status from "triaged" to "unstarted", and rewrites each reroute: segment of a discovery map item\'s source to message:.',
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
      if (moved || statuses || sources) {
        reportUpdate();
        touched = true;
      }
    }
    if (!touched) reportSkip();
    if (!holdsTriageSections(workflowsDir, entries)) return;
    return {
      verify: 'Some research or discussion documents still have content in a "## Triage" section. A topic\'s triage queue is now its mailbox: .workflows/{wu}/{phase}/.mailbox/{topic}/. So wherever an earlier check in this start-up says to move a straggler from a Triage section into .workflows/{wu}/{phase}/.triage/{topic}/, put it in that topic\'s mailbox instead, as NNN-{slug}.md with the next free number there — never into a .triage/ directory, which nothing reads any more.',
    };
  },
};

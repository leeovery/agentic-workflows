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
// Idempotent: a renamed directory, a rewritten status and a rewritten
// segment no longer carry the old words.
//

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const STATUS_FIELDS = ['status', 'previous_status'];

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

module.exports = {
  id: '071',
  description: 'the triage queue becomes the mailbox — directories, the unstarted status, and message: map sources',
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
  },
};

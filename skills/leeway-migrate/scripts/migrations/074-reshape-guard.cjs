'use strict';

//
// Migration 074: The reshape's guard
//
// Step 1 of the reshape's sequence (21.2, 21.3): a major upgrade never runs
// under a live session, nor over uncommitted changes the migration's commit
// would sweep in. The runner runs it ahead of every other migration while
// the project owes the reshape (reshape.cjs, `owed`), the chain that brings
// an older project up to today's shape included, so the changes it reads
// are only the person's. Where the reshape is not owed — a project set up
// on Leeway, or one whose state is born — it has nothing to guard.
//
// It refuses, writing nothing, while:
//   - another session holds one of the old skills' presence rows,
//     `.workflows/.cache/{unit}/{phase}/{topic}/presence`, in the project's
//     folder in any checkout of the repository — each session kept its rows
//     in the checkout it ran in. A row is held while the process it names
//     still runs, read as the old skills read it: its pid and that process's
//     start time, or the pid alone where the row records no start time; a
//     row naming no pid is never held. The calling session's own row — its
//     session id, or its process — is no other session's. Of several, the
//     one written last is named, with how long ago, in whole seconds;
//   - `.workflows/` has uncommitted changes, tracked or untracked, in the
//     project's folder in the main checkout: the copy the migration's commit
//     drops from the default branch.
// A refusal throws an error carrying `refused`, the facts its screen states
// — `{cause: 'live'|'dirty', unit, phase, topic, active}`, the last four
// null for uncommitted changes — which the runner prints, recording nothing.
//
// On a pass it puts the state worktree in place on the unborn
// `leeway-state` (reshape.cjs, `placeStateWorktree`), its `.gitignore`
// with it, so every step after it — the legacy split's directive before the
// move among them — runs while the migration runs: commits held, the trust
// log silent. Run again over a placement cut short, it finishes it.
//
// The liveness reading is its own, frozen with it, as the old skills' was.
//

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { OLD_STATE, git, mainCheckout, projectInMain, owed, placeStateWorktree } = require('../reshape.cjs');

const PRESENCE = 'presence';

/** @param {unknown} v @returns {v is Record<string, any>} */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** The folders directly in `dir`, by name, sorted; none where it cannot be read. @param {string} dir */
function foldersIn(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

/** A process's start time as `ps` gives it, in UTC and the C locale, or null. @param {number} pid @returns {string|null} */
function startTime(pid) {
  try {
    const out = execFileSync('ps', ['-p', String(pid), '-o', 'lstart='], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' }, timeout: 10000,
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}

/** @param {number} pid */
function running(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return isObject(err) && err.code === 'EPERM';
  }
}

/** Whether the row's process still runs. @param {Record<string, any>} row */
function held(row) {
  if (!Number.isInteger(row.pid) || row.pid <= 0) return false;
  return typeof row.pid_start === 'string' && row.pid_start !== '' ? startTime(row.pid) === row.pid_start : running(row.pid);
}

/** Whether the row is the calling session's own. @param {Record<string, any>} row */
function own(row) {
  const session = process.env.CLAUDE_CODE_SESSION_ID || null;
  const pid = Number(process.env.CLAUDE_PID) || null;
  return (session !== null && row.session_id === session) || (pid !== null && row.pid === pid);
}

/** A presence row's record, or null where it does not read as one. @param {string} file */
function rowAt(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** The project's folder in each checkout of the repository. @param {string} main @param {string} project */
function projectCheckouts(main, project) {
  const prefix = path.relative(main, project);
  return git(main, ['worktree', 'list', '--porcelain']).stdout.split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => path.join(line.slice('worktree '.length), prefix));
}

/**
 * Every row another session holds, where it sits and when it was last written.
 * @param {string[]} folders
 * @returns {{unit: string, phase: string, topic: string, written: number}[]}
 */
function liveRows(folders) {
  return folders.flatMap((folder) => {
    const cache = path.join(folder, OLD_STATE, '.cache');
    return foldersIn(cache).flatMap((unit) => foldersIn(path.join(cache, unit)).flatMap((phase) => foldersIn(path.join(cache, unit, phase)).flatMap((topic) => {
      const file = path.join(cache, unit, phase, topic, PRESENCE);
      const row = rowAt(file);
      return row !== null && !own(row) && held(row) ? [{ unit, phase, topic, written: fs.statSync(file).mtimeMs }] : [];
    })));
  });
}

/**
 * The guard's refusal, or null where the project may migrate.
 * @param {string} main @param {string} project
 * @returns {{cause: 'live'|'dirty', unit: string|null, phase: string|null, topic: string|null, active: number|null}|null}
 */
function refusal(main, project) {
  const [last] = liveRows(projectCheckouts(main, project)).sort((a, b) => b.written - a.written);
  if (last !== undefined) {
    const { unit, phase, topic, written } = last;
    return { cause: 'live', unit, phase, topic, active: Math.max(0, Math.floor((Date.now() - written) / 1000)) };
  }
  const status = git(project, ['status', '--porcelain', '--', OLD_STATE]);
  if (!status.ok) throw new Error(`git status failed in ${project}: ${status.stderr.trim()}`);
  return status.stdout.trim() === '' ? null : { cause: 'dirty', unit: null, phase: null, topic: null, active: null };
}

module.exports = {
  id: '074',
  description: 'guard the reshape: refuse while another session is live in the project or .workflows/ has uncommitted changes, then put the state worktree in place on an unborn leeway-state',
  /** @param {{projectDir: string, reportUpdate: () => void, reportSkip: () => void}} ctx */
  run({ projectDir, reportUpdate, reportSkip }) {
    if (!owed(projectDir)) {
      reportSkip();
      return;
    }
    const main = /** @type {string} */ (mainCheckout(projectDir));
    const refused = refusal(main, projectInMain(projectDir, main));
    if (refused !== null) {
      throw Object.assign(new Error(`the reshape's guard refused: ${refused.cause === 'live' ? 'another session is live in the project' : `${OLD_STATE}/ has uncommitted changes`}`), { refused });
    }
    placeStateWorktree(main);
    reportUpdate();
  },
};

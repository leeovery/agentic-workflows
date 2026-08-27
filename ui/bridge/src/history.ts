// The History lens (phase-4 §2). A file's timeline from git, and "what moved
// since your sign-off" as a diff from the newest recorded read-ref to HEAD.
// The read-ref is the Phase 3 artifact_read_refs (HEAD-at-render per human per
// artifact); if the ref's sha is unreachable (epoch break), the diff base is
// lost — a visible degradation, never a wrong diff.
import { execFileSync } from 'node:child_process';

export type HistoryEntry = { sha: string; date: string; subject: string; author: string };
export type WhatMoved =
  | { state: 'none' }
  | { state: 'unread'; base: string; diff: string }
  | { state: 'lost' };

function git(projectRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', projectRoot, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

/** Commit timeline for one artifact (newest first). */
export function fileTimeline(projectRoot: string, relPath: string): HistoryEntry[] {
  let out: string;
  try {
    out = git(projectRoot, ['log', '--format=%H%x00%aI%x00%an%x00%s', '--', relPath]);
  } catch {
    return [];
  }
  return out
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [sha, date, author, subject] = l.split('\0');
      return { sha: sha!, date: date!, author: author!, subject: subject ?? '' };
    });
}

function reachable(projectRoot: string, sha: string): boolean {
  try {
    git(projectRoot, ['cat-file', '-e', sha]);
    return true;
  } catch {
    return false;
  }
}

/**
 * The diff from a recorded read-ref to HEAD for one artifact. `refSha` is the
 * newest recorded ref (null → never read). An unreachable ref → lost.
 */
export function whatMoved(
  projectRoot: string,
  relPath: string,
  refSha: string | null,
  refState: string,
): WhatMoved {
  if (!refSha) return { state: 'none' };
  if (refState === 'history-rewritten' || !reachable(projectRoot, refSha)) return { state: 'lost' };
  let head: string;
  try {
    head = git(projectRoot, ['rev-parse', 'HEAD']).trim();
  } catch {
    return { state: 'none' };
  }
  if (head === refSha) return { state: 'none' };
  let diff: string;
  try {
    diff = git(projectRoot, ['diff', `${refSha}..HEAD`, '--', relPath]);
  } catch {
    return { state: 'lost' };
  }
  if (diff.trim() === '') return { state: 'none' };
  return { state: 'unread', base: refSha, diff };
}

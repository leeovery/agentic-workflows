// The per-project bridge lease (spec 2) — single driving instance.
// `.workflows/.cache/.bridge-lease` (gitignored cache), O_EXCL create with
// {pid, pid_start, host, bridge_id}, the engine's own stale-break discipline:
// a dead pid+start is broken, a live one is honoured. A bridge that cannot
// take the lease runs as a read-only mirror with a banner.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { logger } from './log.js';

export type Lease = { pid: number; pid_start: string; host: string; bridge_id: string };

function pidStart(pid: number): string | null {
  try {
    return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

/**
 * The lease lives OUT of the project tree (the "zero new workflow state"
 * rule — round 8; the earlier `.workflows/.cache/.bridge-lease` was both a
 * write into the tree and leakable into fixture overlays). The path is
 * deterministic from the project root, so a second bridge — whatever its
 * --state-dir — computes the same location and coordinates on it.
 */
export function leasePath(projectRoot: string): string {
  const abs = path.resolve(projectRoot);
  const slug = path.basename(abs).replace(/[^a-zA-Z0-9-]/g, '_');
  const hash = crypto.createHash('sha256').update(abs).digest('hex').slice(0, 8);
  return path.join(os.homedir(), '.cache', 'workflow-bridge', `${slug}-${hash}`, 'lease');
}

export function acquireLease(projectRoot: string, bridgeId: string): { held: boolean; holder?: Lease } {
  const p = leasePath(projectRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const mine: Lease = {
    pid: process.pid,
    pid_start: pidStart(process.pid) ?? 'unknown',
    host: os.hostname(),
    bridge_id: bridgeId,
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(p, 'wx');
      fs.writeSync(fd, JSON.stringify(mine));
      fs.closeSync(fd);
      return { held: true };
    } catch {
      let holder: Lease | null = null;
      try {
        holder = JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch {
        // Corrupt lease: break it.
        try {
          fs.unlinkSync(p);
        } catch { /* raced */ }
        continue;
      }
      if (holder && holder.host === mine.host) {
        const start = pidStart(holder.pid);
        const alive = start !== null && start === holder.pid_start;
        if (!alive) {
          logger.warn('breaking stale bridge lease', { pid: holder.pid });
          try {
            fs.unlinkSync(p);
          } catch { /* raced */ }
          continue;
        }
      }
      return { held: false, holder: holder ?? undefined };
    }
  }
  return { held: false };
}

export function releaseLease(projectRoot: string, bridgeId: string): void {
  const p = leasePath(projectRoot);
  try {
    const holder: Lease = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (holder.bridge_id === bridgeId) fs.unlinkSync(p);
  } catch {
    /* absent or unreadable — nothing to release */
  }
}

// The per-project bridge lease (spec 2) — single driving instance.
// `.workflows/.cache/.bridge-lease` (gitignored cache), O_EXCL create with
// {pid, pid_start, host, bridge_id}, the engine's own stale-break discipline:
// a dead pid+start is broken, a live one is honoured. A bridge that cannot
// take the lease runs as a read-only mirror with a banner.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

export function leasePath(projectRoot: string): string {
  return path.join(projectRoot, '.workflows', '.cache', '.bridge-lease');
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

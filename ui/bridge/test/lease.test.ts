import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { acquireLease, releaseLease, leasePath } from '../src/lease.js';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lease-test-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('bridge lease', () => {
  it('first bridge takes the lease; a second is refused with the holder named', () => {
    expect(acquireLease(dir, 'b1').held).toBe(true);
    const second = acquireLease(dir, 'b2');
    expect(second.held).toBe(false);
    expect(second.holder?.bridge_id).toBe('b1');
  });

  it('a dead holder is broken; release removes only our own lease', () => {
    fs.mkdirSync(path.dirname(leasePath(dir)), { recursive: true });
    fs.writeFileSync(
      leasePath(dir),
      JSON.stringify({ pid: 999999, pid_start: 'long ago', host: os.hostname(), bridge_id: 'dead' }),
    );
    expect(acquireLease(dir, 'b3').held).toBe(true);
    releaseLease(dir, 'other'); // not ours — must not remove
    expect(fs.existsSync(leasePath(dir))).toBe(true);
    releaseLease(dir, 'b3');
    expect(fs.existsSync(leasePath(dir))).toBe(false);
  });

  it('a corrupt lease file is broken rather than wedging the bridge', () => {
    fs.mkdirSync(path.dirname(leasePath(dir)), { recursive: true });
    fs.writeFileSync(leasePath(dir), 'not json');
    expect(acquireLease(dir, 'b4').held).toBe(true);
  });
});

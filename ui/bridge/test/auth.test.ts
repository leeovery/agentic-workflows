import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadOrMintToken, checkRequestOrigin, checkToken } from '../src/auth.js';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const req = (headers: Record<string, string>) => ({ headers }) as any;

describe('trust boundary', () => {
  it('mints a stable per-install token with owner-only mode', () => {
    const t1 = loadOrMintToken(dir);
    expect(t1).toMatch(/^[0-9a-f]{48}$/);
    expect(loadOrMintToken(dir)).toBe(t1);
    const mode = fs.statSync(path.join(dir, 'token')).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('refuses non-local Host (DNS rebinding) and cross-site Origin', () => {
    expect(checkRequestOrigin(req({ host: '127.0.0.1:4870' })).ok).toBe(true);
    expect(checkRequestOrigin(req({ host: 'localhost:4870', origin: 'http://localhost:5173' })).ok).toBe(true);
    expect(checkRequestOrigin(req({ host: 'evil.example:4870' })).ok).toBe(false);
    expect(checkRequestOrigin(req({ host: '127.0.0.1:4870', origin: 'https://evil.example' })).ok).toBe(false);
  });

  it('accepts the token via bearer header or query param, refuses otherwise', () => {
    const url = (q = '') => new URL(`http://127.0.0.1/x${q}`);
    expect(checkToken(req({ authorization: 'Bearer tok' }), url(), 'tok')).toBe(true);
    expect(checkToken(req({}), url('?token=tok'), 'tok')).toBe(true);
    expect(checkToken(req({ authorization: 'Bearer wrong' }), url(), 'tok')).toBe(false);
    expect(checkToken(req({}), url(), 'tok')).toBe(false);
  });
});

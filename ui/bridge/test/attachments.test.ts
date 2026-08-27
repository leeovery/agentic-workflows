// The attachment upload sink — a file-upload endpoint is a classic security
// sink, so this pins the hardening: no path traversal, size cap, name
// sanitization, cache containment, and correct project-relative paths.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writeAttachment } from '../src/api.js';

let root: string;
const b64 = (s: string) => Buffer.from(s).toString('base64');

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'attach-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('writeAttachment', () => {
  it('writes a file under .cache/{wu}/attachments and returns its project-relative path', () => {
    const r = writeAttachment(root, { name: 'diagram.png', dataBase64: b64('PNGDATA'), workUnit: 'auth' }) as { path: string };
    expect(r.path).toMatch(/^\.workflows\/\.cache\/auth\/attachments\/[0-9a-f]{8}-diagram\.png$/);
    const full = path.join(root, r.path);
    expect(fs.existsSync(full)).toBe(true);
    expect(fs.readFileSync(full, 'utf8')).toBe('PNGDATA');
  });

  it('lobby (no work unit) lands under .cache/.uploads/{session}', () => {
    const r = writeAttachment(root, { name: 'note.txt', dataBase64: b64('hi'), bridgeSessionId: 'bs-abc123' }) as { path: string };
    expect(r.path).toMatch(/^\.workflows\/\.cache\/\.uploads\/bs-abc123\/[0-9a-f]{8}-note\.txt$/);
  });

  it('sanitizes a traversal filename to a safe basename (no escape)', () => {
    const r = writeAttachment(root, { name: '../../etc/passwd', dataBase64: b64('x'), workUnit: 'auth' }) as { path: string };
    // basename → 'passwd', charset-filtered, random-prefixed, INSIDE the cache.
    expect(r.path).toMatch(/^\.workflows\/\.cache\/auth\/attachments\/[0-9a-f]{8}-passwd$/);
    expect(r.path).not.toContain('..');
    expect(path.join(root, r.path).startsWith(path.join(root, '.workflows', '.cache'))).toBe(true);
  });

  it('strips a leading dot and odd characters from the name', () => {
    const r = writeAttachment(root, { name: '...hidden$;rm -rf.txt', dataBase64: b64('x'), workUnit: 'w' }) as { path: string };
    expect(r.path).toMatch(/[0-9a-f]{8}-hidden__rm_-rf\.txt$/); // no leading dot, safe chars
  });

  it('refuses an oversize attachment (413)', () => {
    const big = 'A'.repeat(11 * 1024 * 1024);
    const r = writeAttachment(root, { name: 'big.bin', dataBase64: b64(big), workUnit: 'w' });
    expect(r).toEqual({ error: 'attachment too large (max 10MB)', status: 413 });
  });

  it('refuses an empty attachment (400)', () => {
    expect(writeAttachment(root, { name: 'e', dataBase64: '', workUnit: 'w' })).toMatchObject({ status: 400 });
  });

  it('refuses a bad work-unit or session id (400)', () => {
    expect(writeAttachment(root, { name: 'a', dataBase64: b64('x'), workUnit: '../evil' })).toMatchObject({ status: 400 });
    expect(writeAttachment(root, { name: 'a', dataBase64: b64('x'), bridgeSessionId: 'not-a-session/..' })).toMatchObject({ status: 400 });
  });

  it('never clobbers — two uploads of the same name get distinct random-prefixed paths', () => {
    const a = writeAttachment(root, { name: 'x.txt', dataBase64: b64('1'), workUnit: 'w' }) as { path: string };
    const b = writeAttachment(root, { name: 'x.txt', dataBase64: b64('2'), workUnit: 'w' }) as { path: string };
    expect(a.path).not.toBe(b.path);
    expect(fs.readFileSync(path.join(root, a.path), 'utf8')).toBe('1');
    expect(fs.readFileSync(path.join(root, b.path), 'utf8')).toBe('2');
  });
});

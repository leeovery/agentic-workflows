// The local trust boundary (phase-2 §7) — opens the moment browser input can
// become session turns. Bind 127.0.0.1 (server.ts already does); Host-header
// allowlist (kills DNS rebinding); Origin allowlist when present (CSRF);
// per-install bearer token on every mutating route. Phase 6 swaps token →
// OAuth; the boundary exists from day one.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type http from 'node:http';

export function loadOrMintToken(stateDir: string): string {
  const p = path.join(stateDir, 'token');
  try {
    const t = fs.readFileSync(p, 'utf8').trim();
    if (t.length >= 32) return t;
  } catch {
    /* mint below */
  }
  const token = crypto.randomBytes(24).toString('hex');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(p, token, { mode: 0o600 });
  return token;
}

const LOCAL_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;
const LOCAL_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

/** Every request: the Host must be local (DNS-rebinding defence) and any
 *  Origin must be local (cross-site defence). */
export function checkRequestOrigin(req: http.IncomingMessage): { ok: boolean; reason?: string } {
  const host = req.headers.host ?? '';
  if (!LOCAL_HOST.test(host)) return { ok: false, reason: `non-local host: ${host}` };
  const origin = req.headers.origin;
  if (origin && !LOCAL_ORIGIN.test(origin)) return { ok: false, reason: `cross-origin: ${origin}` };
  return { ok: true };
}

/** Mutating routes: bearer token (header) or ?token= (EventSource can't set headers). */
export function checkToken(req: http.IncomingMessage, url: URL, token: string): boolean {
  const auth = req.headers.authorization;
  if (auth === `Bearer ${token}`) return true;
  if (url.searchParams.get('token') === token) return true;
  return false;
}

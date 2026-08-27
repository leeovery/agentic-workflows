// Phase 6 §1 — identity. Two modes, both honest about what they know:
//
//   single  — zero-config. Every request is the Phase 0 sentinel human ("You"),
//             always a member. The bearer token is the whole trust boundary.
//   github  — a human authenticates as a GitHub login; MEMBERSHIP = push access
//             to the origin repo, checked via the GitHub API AT LOGIN and cached
//             on the auth session (never re-hit per request). No cookie / expired
//             session → anonymous, not a member.
//
// This is a server-side session store (an opaque random cookie keys a row),
// not better-auth's OAuth redirect dance — see REVIEW.md round 12 for the
// deviation rationale. The IDENTITY + MEMBER-CHECK contract the spec names is
// implemented and tested; the redirect flow is deployment wiring.
import crypto from 'node:crypto';
import type { Db } from './db.js';
import { HUMAN_SENTINEL } from './db.js';
import type { AuthConfig } from '@workflow-ui/shared';

export type Human = { id: string; name: string; githubLogin: string | null; member: boolean; sentinel: boolean };

export const SENTINEL_HUMAN: Human = {
  id: HUMAN_SENTINEL,
  name: 'You',
  githubLogin: null,
  member: true,
  sentinel: true,
};

export const AUTH_COOKIE = 'wf_bridge_auth';

/** Parse a Cookie header into a map. Tolerant of missing/malformed headers. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

/**
 * Does `login` have push access to `repo` (owner/name)? True iff the
 * repository permission is write/maintain/admin. Uses `token` (a caller with
 * read access to the repo's collaborator permissions) — a provided PAT or the
 * server's `GITHUB_TOKEN`. A network/API failure is a hard NO (fail closed),
 * never a silent member.
 */
export async function githubPushAccess(
  cfg: Pick<AuthConfig, 'apiBase'>,
  repo: string,
  login: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  // repo, login are user-influenced → path-segment safe (no traversal, no query
  // injection). GitHub logins are [A-Za-z0-9-]; repos owner/name of the same.
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo)) return false;
  if (!/^[A-Za-z0-9-]+$/.test(login)) return false;
  const url = `${cfg.apiBase.replace(/\/$/, '')}/repos/${repo}/collaborators/${login}/permission`;
  try {
    const res = await fetchImpl(url, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
      },
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { permission?: string; user?: { permissions?: Record<string, boolean> } };
    // The documented field is `permission` (admin|write|read|none); newer
    // responses also carry a `user.permissions` bag — accept either.
    const perm = body.permission;
    if (perm === 'admin' || perm === 'write' || perm === 'maintain') return true;
    const bag = body.user?.permissions;
    return Boolean(bag && (bag.admin || bag.maintain || bag.push));
  } catch {
    return false;
  }
}

export class Identity {
  constructor(
    private db: Db,
    private cfg: AuthConfig,
    private opts: { serverToken?: string; fetchImpl?: typeof fetch } = {},
  ) {}

  get mode(): AuthConfig['mode'] {
    return this.cfg.mode;
  }

  /** The human a request belongs to. Single mode is always the sentinel. */
  resolve(cookieHeader: string | undefined): Human {
    if (this.cfg.mode === 'single') return SENTINEL_HUMAN;
    const cookie = parseCookies(cookieHeader)[AUTH_COOKIE];
    if (!cookie) return anonymous();
    const row = this.db.sqlite
      .prepare(
        'SELECT human_id as humanId, github_login as githubLogin, member FROM auth_sessions WHERE id = ?',
      )
      .get(cookie) as { humanId: string; githubLogin: string | null; member: number } | undefined;
    if (!row) return anonymous();
    // Touch last-seen (best-effort; a read path staying a read at the domain
    // level — this is the bridge's own session bookkeeping, not workflow state).
    this.db.sqlite
      .prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?')
      .run(new Date().toISOString(), cookie);
    const human = this.db.sqlite
      .prepare('SELECT name FROM humans WHERE id = ?')
      .get(row.humanId) as { name: string } | undefined;
    return {
      id: row.humanId,
      name: human?.name ?? row.githubLogin ?? row.humanId,
      githubLogin: row.githubLogin,
      member: row.member === 1,
      sentinel: false,
    };
  }

  /**
   * Authenticate a GitHub login. Verifies push access to the configured repo,
   * upserts the human, mints an auth session, returns its cookie value. A
   * non-member is still recorded (so the UI can say "not a member of {repo}"),
   * never silently rejected — the caller decides what a non-member may see.
   */
  async login(githubLogin: string, providedToken?: string): Promise<{ cookie: string; human: Human } | { error: string }> {
    if (this.cfg.mode !== 'github') return { error: 'auth is in single-user mode' };
    if (!this.cfg.repo) return { error: 'no origin repo configured for membership' };
    if (!/^[A-Za-z0-9-]+$/.test(githubLogin)) return { error: 'invalid github login' };
    const token = providedToken || this.opts.serverToken;
    if (!token) return { error: 'no GitHub token available to verify membership' };
    const member = await githubPushAccess(this.cfg, this.cfg.repo, githubLogin, token, this.opts.fetchImpl);
    const humanId = `gh:${githubLogin}`;
    const now = new Date().toISOString();
    this.db.sqlite
      .prepare(
        `INSERT INTO humans (id, name, sentinel, github_login) VALUES (?, ?, 0, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, github_login = excluded.github_login`,
      )
      .run(humanId, githubLogin, githubLogin);
    const cookie = crypto.randomBytes(24).toString('hex');
    this.db.sqlite
      .prepare(
        `INSERT INTO auth_sessions (id, human_id, github_login, member, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(cookie, humanId, githubLogin, member ? 1 : 0, now, now);
    return { cookie, human: { id: humanId, name: githubLogin, githubLogin, member, sentinel: false } };
  }

  logout(cookieHeader: string | undefined): void {
    const cookie = parseCookies(cookieHeader)[AUTH_COOKIE];
    if (cookie) this.db.sqlite.prepare('DELETE FROM auth_sessions WHERE id = ?').run(cookie);
  }
}

function anonymous(): Human {
  return { id: 'anonymous', name: 'anonymous', githubLogin: null, member: false, sentinel: false };
}

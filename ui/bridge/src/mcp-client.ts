// Phase 7 — the HTTP BridgeClient. The MCP server talks to a running bridge over
// its own API, authenticated as a NAMED HUMAN: the install bearer token (the
// trust boundary) plus a per-user Phase-6 auth cookie minted in the SPA. Every
// call carries both, so the bridge resolves the same human, applies the same
// owner routing, writes the same ledger — no separate answer path exists.
import type { BridgeClient, QueueRow, GateComment } from './mcp.js';
import { AUTH_COOKIE } from './identity.js';
import type { GateCard } from '@workflow-ui/shared';

export type BridgeClientConfig = {
  baseUrl: string; // e.g. http://127.0.0.1:4870
  bearerToken: string; // the install token (GET /api/token in the SPA)
  authCookie?: string; // the per-user Phase-6 auth-session cookie (github mode)
  fetchImpl?: typeof fetch;
};

export class HttpBridgeClient implements BridgeClient {
  private fetch: typeof fetch;
  constructor(private cfg: BridgeClientConfig) {
    this.fetch = cfg.fetchImpl ?? fetch;
  }

  private headers(json = false): Record<string, string> {
    const h: Record<string, string> = { authorization: `Bearer ${this.cfg.bearerToken}` };
    if (this.cfg.authCookie) h.cookie = `${AUTH_COOKIE}=${this.cfg.authCookie}`;
    if (json) h['content-type'] = 'application/json';
    return h;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetch(`${this.cfg.baseUrl}${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return (await res.json()) as T;
  }

  async state(): Promise<{ project: string; queueDepth: number; openGates: number }> {
    const [health, queue, sessions] = await Promise.all([
      this.get<{ project: string }>('/health'),
      this.get<{ rows: QueueRow[] }>('/api/queue'),
      this.get<{ sessions: { openGate: GateCard | null }[] }>('/api/sessions'),
    ]);
    return {
      project: health.project,
      queueDepth: queue.rows.length,
      openGates: sessions.sessions.filter((s) => s.openGate).length,
    };
  }

  async queue(): Promise<QueueRow[]> {
    return (await this.get<{ rows: QueueRow[] }>('/api/queue')).rows;
  }

  async openGate(gateId: string): Promise<{ card: GateCard; comments: GateComment[] } | null> {
    const { sessions } = await this.get<{ sessions: { openGate: (GateCard & { state: string }) | null }[] }>('/api/sessions');
    const card = sessions.map((s) => s.openGate).find((g) => g && g.id === gateId && g.state === 'open');
    if (!card) return null;
    // Defense-in-depth: encode the id even though every caller regex-validates
    // it (this client is exported and carries no validation of its own).
    const { comments } = await this.get<{ comments: GateComment[] }>(`/api/comments?gateId=${encodeURIComponent(gateId)}`);
    return { card, comments: comments.map((c) => ({ author: c.author, body: c.body })) };
  }

  async answer(
    gateId: string,
    text: string,
    attestation?: 'ui-gesture',
  ): Promise<{ ok: boolean; state?: string; error?: string; deepLink?: string; needsAttestation?: boolean }> {
    const res = await this.fetch(`${this.cfg.baseUrl}/api/gate/${encodeURIComponent(gateId)}/answer`, {
      method: 'POST',
      headers: this.headers(true),
      // `via: 'mcp'` marks the answer's provenance in the durable ledger (an
      // MCP-host answer is distinguishable from an in-app one, round-13).
      body: JSON.stringify({ text, via: 'mcp', ...(attestation ? { attestation } : {}) }),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    return { ok: res.ok && json.ok !== false, state: json.state, error: json.error, deepLink: json.deepLink, needsAttestation: json.needsAttestation };
  }
}

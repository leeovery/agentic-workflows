// Phase 7 — the MCP server. Unit tests against a fake bridge (tools, resources,
// attestation gating, read-only typed-confirm), then a REAL-server parity test:
// the same fixture gate answered via the SPA path and the MCP path resolves to
// byte-identical answers into the session AND identical ledger rows — including
// the negative (a plain model tool call answering a typed-confirm gate is
// rejected).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDb, type Db } from '../src/db.js';
import { SessionManager, type SessionDriver, type DriverEvent, type TurnOptions } from '../src/sessions.js';
import { BridgeServer } from '../src/server.js';
import { Identity } from '../src/identity.js';
import { loadOrMintToken } from '../src/auth.js';
import { createMcpServer, type BridgeClient, GATE_CARD_RESOURCE, QUEUE_RESOURCE } from '../src/mcp.js';
import { HttpBridgeClient } from '../src/mcp-client.js';
import type { GateCard } from '@workflow-ui/shared';

const STOP = "emit verbatim as markdown, then STOP for the user's response";
const menuSection = (name: string, question: string, options: string[]) =>
  `=== ${name} (${STOP}) ===\n· · · · · · · · · · · ·\n**\`◆ ${question}\`**\n\n${options.join('\n')}\n`;

class FakeDriver implements SessionDriver {
  turns: DriverEvent[][] = [];
  seen: TurnOptions[] = [];
  async *runTurn(opts: TurnOptions): AsyncIterable<DriverEvent> {
    this.seen.push(opts);
    for (const e of this.turns.shift() ?? [{ type: 'result', outcome: 'completed' as const }]) yield e;
  }
}
const askTurn = (surface: string, q: string, opts: string[]): DriverEvent[] => [
  { type: 'init', sdkSessionId: `sdk-${Math.floor(opts.length)}` },
  { type: 'assistant', text: 'Booting.' },
  { type: 'tool-use', tool: 'Bash', id: 't1', input: { command: 'engine x' } },
  { type: 'tool-result', tool: 'Bash', id: 't1', text: menuSection(surface, q, opts) },
  { type: 'assistant', text: 'Relay.' },
];
const TAP = ['**`c/continue`** → Proceed (recommended)', '**`w/wrap`** → Wrap up'];

// --- a fake bridge for the unit tests --------------------------------------
const fakeCard = (over: Partial<GateCard> = {}): GateCard => ({
  id: 'a'.repeat(16),
  kind: 'menu',
  source: 'tool-result',
  surface: 'MENU: check-in gate',
  session: { bridgeSessionId: 'bs-1', askOrdinal: 0 },
  address: { workUnit: 'auth' },
  context: 'Pick one.',
  question: 'Keep going?',
  options: [
    { key: 'c', word: 'continue', label: 'Proceed', recommended: true, form: 'cmd' },
    { key: 'w', word: 'wrap', label: 'Wrap up', recommended: false, form: 'cmd' },
  ],
  freeText: true,
  confirm: 'tap',
  openedAt: '2026-08-27T10:00:00.000Z',
  state: 'open',
  ...over,
});

class FakeBridge implements BridgeClient {
  lastAnswer: { gateId: string; text: string; attestation?: string } | null = null;
  constructor(private card: GateCard, private comments: { author: string; body: string }[] = []) {}
  async state() {
    return { project: 'demo', queueDepth: 1, openGates: 1 };
  }
  async queue() {
    return [{ tier: 'live' as const, kind: 'menu', address: { workUnit: 'auth' }, since: 't', gateId: this.card.id, askPreview: 'Keep going?' }];
  }
  async openGate(gateId: string) {
    return gateId === this.card.id ? { card: this.card, comments: this.comments } : null;
  }
  async answer(gateId: string, text: string, attestation?: 'ui-gesture') {
    this.lastAnswer = { gateId, text, attestation };
    // Mirror the bridge: a typed-confirm without attestation is rejected.
    if (this.card.confirm === 'typed' && attestation !== 'ui-gesture') {
      return { ok: false, error: 'needs a typed confirmation from a UI gesture', deepLink: '/s/bs-1', needsAttestation: true };
    }
    return { ok: true, state: 'resolved' };
  }
}

describe('MCP server — protocol + tools', () => {
  it('initialize, tools/list, resources/list answer the MCP handshake', async () => {
    const srv = createMcpServer(new FakeBridge(fakeCard()));
    const init = await srv.handle({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    expect((init!.result as any).protocolVersion).toBeTruthy();
    const tools = await srv.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect((tools!.result as any).tools.map((t: any) => t.name)).toEqual([
      'workflow_state',
      'workflow_queue',
      'workflow_open_gate',
      'workflow_answer',
    ]);
    const resources = await srv.handle({ jsonrpc: '2.0', id: 3, method: 'resources/list' });
    expect((resources!.result as any).resources.map((r: any) => r.uri)).toContain(GATE_CARD_RESOURCE);
    // A notification (no id) yields no response.
    expect(await srv.handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
  });

  it('open_gate renders the card + a ui:// resource + read-only comments', async () => {
    const srv = createMcpServer(new FakeBridge(fakeCard(), [{ author: 'alice', body: 'blocks this' }]));
    const out = await srv.callTool('workflow_open_gate', { gateId: 'a'.repeat(16) }, {});
    const text = out.content.find((c) => c.type === 'text')!.text;
    expect(text).toContain('Keep going?');
    expect(text).toContain('alice: blocks this'); // comment surfaced, read-only
    const resource = out.content.find((c) => c.type === 'resource')!.resource;
    expect(resource.uri).toBe(GATE_CARD_RESOURCE);
    expect(resource.mimeType).toBe('text/html');
    expect(resource.text).toContain('◆ Keep going?');
  });

  it('a typed-confirm card renders read-only with a deep link, and disables options', async () => {
    const srv = createMcpServer(new FakeBridge(fakeCard({ confirm: 'typed', surface: 'MENU: spec signoff gate' })), {
      spaBaseUrl: 'http://127.0.0.1:4870',
    });
    const out = await srv.callTool('workflow_open_gate', { gateId: 'a'.repeat(16) }, {});
    const html = out.content.find((c) => c.type === 'resource')!.resource.text;
    expect(html).toContain('needs a typed confirmation');
    expect(html).toContain('Answer it in the app');
    expect(html).toContain('disabled'); // option buttons disabled in MCP
  });

  it('answer passes ui-gesture attestation ONLY when the host sets it (SEP-1865)', async () => {
    const bridge = new FakeBridge(fakeCard({ confirm: 'typed' }));
    const srv = createMcpServer(bridge);
    // A plain model tool call — no _meta gesture → no attestation → rejected.
    const modelCall = await srv.callTool('workflow_answer', { gateId: 'a'.repeat(16), text: 'delete-it' }, {});
    expect(modelCall.isError).toBe(true);
    expect(bridge.lastAnswer!.attestation).toBeUndefined();
    // A host-attested gesture → attestation passed → accepted.
    const gesture = await srv.callTool('workflow_answer', { gateId: 'a'.repeat(16), text: 'delete-it' }, { 'ui-gesture': true });
    expect(gesture.isError).toBeUndefined();
    expect(bridge.lastAnswer!.attestation).toBe('ui-gesture');
  });

  it('resources/read serves the queue widget html', async () => {
    const srv = createMcpServer(new FakeBridge(fakeCard()));
    const out = await srv.handle({ jsonrpc: '2.0', id: 9, method: 'resources/read', params: { uri: QUEUE_RESOURCE } });
    const contents = (out!.result as any).contents[0];
    expect(contents.mimeType).toBe('text/html');
    expect(contents.text).toContain('#auth');
  });

  // --- round-13 folds -------------------------------------------------------

  it('resources/read serves the gate-card template (list/read consistent)', async () => {
    const srv = createMcpServer(new FakeBridge(fakeCard()));
    const out = await srv.handle({ jsonrpc: '2.0', id: 10, method: 'resources/read', params: { uri: GATE_CARD_RESOURCE } });
    expect((out!.result as any).contents[0].mimeType).toBe('text/html');
    expect((out!.result as any).contents[0].text).toContain('Open a gate');
  });

  it('the widgets ship an interactivity producer: a host-bridge script + data-gate hooks', async () => {
    const srv = createMcpServer(new FakeBridge(fakeCard()));
    const gate = await srv.callTool('workflow_open_gate', { gateId: 'a'.repeat(16) }, {});
    const html = gate.content.find((c) => c.type === 'resource')!.resource.text;
    expect(html).toContain('callTool'); // the producer exists
    expect(html).toContain(`data-gate="${'a'.repeat(16)}"`); // options carry the gate id
    const q = await srv.callTool('workflow_queue', {}, {});
    expect(q.content.find((c) => c.type === 'resource')!.resource.text).toContain('callTool');
  });

  it('initialize echoes the client-requested protocol version', async () => {
    const srv = createMcpServer(new FakeBridge(fakeCard()));
    const out = await srv.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    expect((out!.result as any).protocolVersion).toBe('2025-06-18');
  });

  it('an unknown-method NOTIFICATION (no id) gets no response', async () => {
    const srv = createMcpServer(new FakeBridge(fakeCard()));
    expect(await srv.handle({ jsonrpc: '2.0', method: 'some/notification' } as any)).toBeNull();
    // but an unknown-method REQUEST (with id) does get an error
    const withId = await srv.handle({ jsonrpc: '2.0', id: 5, method: 'nope' });
    expect((withId!.error as any).code).toBe(-32601);
  });
});

// --- real-server parity -----------------------------------------------------

// A fresh port per test — undici keeps sockets alive, so reusing one port
// across the per-test server restarts races a dead pooled socket (ECONNRESET).
let PORT = 4893;
let tmp: string;
let db: Db;
let driver: FakeDriver;
let sessions: SessionManager;
let server: BridgeServer;
let token: string;

async function makeGate(surface: string, opts = TAP): Promise<GateCard> {
  driver.turns.push(askTurn(surface, 'Decide?', opts));
  const row = await sessions.start({ workUnit: `wu-${Math.random().toString(36).slice(2, 7)}` }, '/workflow-start');
  return row.openGate!;
}

beforeEach(async () => {
  PORT += 1;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-parity-'));
  db = openDb(path.join(tmp, 'state'));
  driver = new FakeDriver();
  sessions = new SessionManager(db, driver, {
    projectRoot: tmp,
    project: 'demo',
    bridgeId: 'b1',
    journalsDir: path.join(tmp, 'journals'),
    displayWidth: 65,
  });
  token = loadOrMintToken(path.join(tmp, 'state'));
  server = new BridgeServer({
    port: PORT,
    store: null,
    db,
    health: () => ({}) as any,
    api: {
      projectRoot: tmp,
      engine: null,
      store: null,
      knowledgePath: null,
      sessions,
      token,
      db,
      project: 'demo',
      identity: new Identity(db, { mode: 'single', apiBase: 'https://api.github.com' }),
      stuckMs: 24 * 3600 * 1000,
    },
  });
  await server.listen();
});

afterEach(() => {
  server?.close();
  db.sqlite.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function spaAnswer(gateId: string, text: string, attest = true) {
  return fetch(`http://127.0.0.1:${PORT}/api/gate/${gateId}/answer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ text, ...(attest ? { attestation: 'ui-gesture' } : {}) }),
  });
}
const mcp = () => createMcpServer(new HttpBridgeClient({ baseUrl: `http://127.0.0.1:${PORT}`, bearerToken: token }), { spaBaseUrl: `http://127.0.0.1:${PORT}` });

function ledgerAnswer(gateId: string): string {
  const row = db.sqlite.prepare('SELECT resolution FROM gate_ledger WHERE gate_id = ?').get(gateId) as any;
  return JSON.parse(row.resolution).answer;
}
function journalUserText(bridgeSessionId: string): string {
  const j = fs.readFileSync(path.join(tmp, 'journals', `${bridgeSessionId}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  return j.filter((r) => r.record === 'user' && r.gateId).map((r) => r.text).join('|');
}

describe('MCP parity with the SPA (real bridge)', () => {
  it('the SAME gate answered via SPA and via MCP injects byte-identical answers + identical ledger rows', async () => {
    const a = await makeGate('MENU: check-in gate');
    const b = await makeGate('MENU: check-in gate');
    // SPA path.
    driver.turns.push([{ type: 'assistant', text: 'ok' }, { type: 'result', outcome: 'completed' }]);
    const spa = await spaAnswer(a.id, 'c');
    expect(spa.status).toBe(200);
    // MCP path — same text, through the answer tool.
    driver.turns.push([{ type: 'assistant', text: 'ok' }, { type: 'result', outcome: 'completed' }]);
    const out = await mcp().callTool('workflow_answer', { gateId: b.id, text: 'c' }, { 'ui-gesture': true });
    expect(out.isError).toBeUndefined();
    // Byte-identical answer into the session, and identical ledger resolution.
    expect(journalUserText(b.session.bridgeSessionId)).toBe(journalUserText(a.session.bridgeSessionId));
    expect(ledgerAnswer(b.id)).toBe(ledgerAnswer(a.id));
    expect(ledgerAnswer(b.id)).toBe('c');
    // ...but the PROVENANCE differs: the audit trail can tell MCP from SPA even
    // though the answer is identical (round-13 — provenance ≠ parity).
    const via = (id: string) => JSON.parse((db.sqlite.prepare('SELECT resolution FROM gate_ledger WHERE gate_id = ?').get(id) as any).resolution).via;
    expect(via(a.id)).toBe('ui');
    expect(via(b.id)).toBe('mcp');
  });

  it('a plain model tool call answering a typed-confirm gate is REJECTED; a UI gesture is accepted', async () => {
    const typed = await makeGate('MENU: spec signoff gate');
    expect(typed.confirm).toBe('typed'); // never-auto → typed confirm
    // Model call (no host gesture) → no attestation → bridge rejects.
    const modelCall = await mcp().callTool('workflow_answer', { gateId: typed.id, text: 'signoff' }, {});
    expect(modelCall.isError).toBe(true);
    expect(modelCall.content[0].text).toMatch(/typed confirmation|app/i);
    // The gate is still open (nothing was injected).
    const stillOpen = db.sqlite.prepare('SELECT state FROM gate_ledger WHERE gate_id = ?').get(typed.id) as any;
    expect(stillOpen.state).toBe('open');
    // A host-attested gesture → accepted.
    driver.turns.push([{ type: 'assistant', text: 'ok' }, { type: 'result', outcome: 'completed' }]);
    const gesture = await mcp().callTool('workflow_answer', { gateId: typed.id, text: 'signoff' }, { 'ui-gesture': true });
    expect(gesture.isError).toBeUndefined();
    expect(ledgerAnswer(typed.id)).toBe('signoff');
  });

  it('the raw SPA endpoint also rejects a typed-confirm without attestation (single enforcement point)', async () => {
    const typed = await makeGate('MENU: spec signoff gate');
    const res = await spaAnswer(typed.id, 'signoff', false); // no attestation
    expect(res.status).toBe(403);
    expect(((await res.json()) as any).needsAttestation).toBe(true);
  });

  it("a gate owned by A refuses B's MCP submit — routing, not authority (done-means)", async () => {
    // github mode, both members; A owns the gate, B answers via MCP with B's
    // cookie and is refused exactly as the SPA would refuse them.
    server.close();
    const gh = new Identity(db, { mode: 'github', repo: 'acme/app', apiBase: 'https://api.github.com' }, {
      serverToken: 't',
      fetchImpl: (async () => ({ ok: true, json: async () => ({ permission: 'write' }) })) as any,
    });
    const A = await gh.login('alice');
    const B = await gh.login('bob');
    if (!('cookie' in A) || !('cookie' in B)) throw new Error('login failed');
    PORT += 1;
    server = new BridgeServer({
      port: PORT,
      store: null,
      db,
      health: () => ({}) as any,
      api: { projectRoot: tmp, engine: null, store: null, knowledgePath: null, sessions, token, db, project: 'demo', identity: gh, stuckMs: 24 * 3600 * 1000 },
    });
    await server.listen();
    const gate = await makeGate('MENU: check-in gate');
    // A owns it.
    db.sqlite.prepare("UPDATE gate_ledger SET owner_id = 'gh:alice' WHERE gate_id = ?").run(gate.id);
    db.sqlite.prepare("INSERT OR REPLACE INTO gate_owner_activity (gate_id, owner_id, last_activity_at) VALUES (?, 'gh:alice', ?)").run(gate.id, new Date().toISOString());
    // B answers via MCP (B's cookie) → refused (watching).
    const bClient = new HttpBridgeClient({ baseUrl: `http://127.0.0.1:${PORT}`, bearerToken: token, authCookie: (B as any).cookie });
    const out = await createMcpServer(bClient, { spaBaseUrl: `http://127.0.0.1:${PORT}` }).callTool(
      'workflow_answer',
      { gateId: gate.id, text: 'c' },
      { 'ui-gesture': true },
    );
    expect(out.isError).toBe(true);
    expect((out.content[0] as any).text).toMatch(/watching|owner/i);
    // The gate is untouched.
    expect((db.sqlite.prepare('SELECT state FROM gate_ledger WHERE gate_id = ?').get(gate.id) as any).state).toBe('open');
  });
});

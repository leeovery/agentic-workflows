// Phase 7 — the workflow MCP server. A THIRD client of the bridge (after the SPA
// and the debug console), putting the gate card where teammates already live —
// inside Claude (MCP Apps / SEP-1865). It is a packaging exercise: NO second
// implementation of card logic. The card is the frozen `shared/` schema; the
// answer round-trip is the Phase 2 bridge path; ownership, the ledger, and
// typed-confirm all apply exactly as in the SPA because the server calls the
// same bridge answer endpoint AS a named human.
//
// Security spine (Phase 7 §1):
//   · Authenticated as a named human — a per-user token (Phase 6 auth cookie) +
//     the install bearer token, held in config, passed on every bridge call. No
//     unauthenticated answer path exists.
//   · Typed-confirm gates require UI-ORIGIN ATTESTATION. In an MCP host tool
//     args are MODEL-produced unless a UI gesture originates the call, so the
//     server passes `attestation: ui-gesture` to the bridge ONLY when the host
//     attests a gesture (a `_meta['ui-gesture']` the HOST sets, never the model).
//     A plain model tool call carries no attestation → the bridge rejects it
//     (the negative parity test). The card renders read-only with a deep link.
//   · Open-gate comments render on the card (read-only) so an MCP answer is
//     never blind to a teammate's concern.
import type { GateCard } from '@workflow-ui/shared';

export const MCP_PROTOCOL_VERSION = '2024-11-05';

export type QueueRow = {
  tier: 'live' | 'durable';
  kind: string;
  address: { workUnit?: string; topic?: string; phase?: string };
  since: string;
  gateId?: string;
  askPreview?: string;
  detail?: string;
  owner?: { name: string | null; isYou: boolean } | null;
  watching?: boolean;
  stuck?: boolean;
  unreadComments?: number;
};

export type GateComment = { author: string; body: string };

// The bridge, behind an interface — the real client is HTTP (mcp-client.ts); a
// test injects an in-process fake so parity is provable against one SessionManager.
export interface BridgeClient {
  state(): Promise<{ project: string; queueDepth: number; openGates: number }>;
  queue(): Promise<QueueRow[]>;
  openGate(gateId: string): Promise<{ card: GateCard; comments: GateComment[] } | null>;
  answer(
    gateId: string,
    text: string,
    attestation?: 'ui-gesture',
  ): Promise<{ ok: boolean; state?: string; error?: string; deepLink?: string; needsAttestation?: boolean }>;
}

type JsonRpcRequest = { jsonrpc: '2.0'; id?: number | string | null; method: string; params?: any };
type JsonRpcResponse = { jsonrpc: '2.0'; id: number | string | null; result?: unknown; error?: { code: number; message: string } };

export const GATE_CARD_RESOURCE = 'ui://workflow/gate-card';
export const QUEUE_RESOURCE = 'ui://workflow/queue';

const TOOLS = [
  {
    name: 'workflow_state',
    description: 'A snapshot of the workflow bridge: project, how many items are waiting on you, how many gates are open.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'workflow_queue',
    description: 'The needs-you queue — the two-tier list of what is waiting on you, most urgent first. Each live row carries a gateId you can open.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'workflow_open_gate',
    description: 'Open one gate by id: the decision, its options, any teammate comments (read-only), and whether it needs a typed confirmation you can only give in the app.',
    inputSchema: {
      type: 'object',
      properties: { gateId: { type: 'string', description: 'the 16-hex gate id from the queue' } },
      required: ['gateId'],
      additionalProperties: false,
    },
  },
  {
    name: 'workflow_answer',
    description: 'Answer an open gate — a plain-word reply or an option key. Ownership and the comment ceremony apply exactly as in the app. A typed-confirmation (never-auto) gate can only be answered from a real UI gesture in the app, never a model tool call.',
    inputSchema: {
      type: 'object',
      properties: {
        gateId: { type: 'string' },
        text: { type: 'string', description: 'the answer — your own words, or an option key' },
      },
      required: ['gateId', 'text'],
      additionalProperties: false,
    },
  },
];

export function createMcpServer(client: BridgeClient, opts: { spaBaseUrl?: string } = {}) {
  const spa = opts.spaBaseUrl ?? 'http://127.0.0.1:4870';

  async function callTool(name: string, args: any, meta: any): Promise<{ content: any[]; isError?: boolean; _meta?: any }> {
    switch (name) {
      case 'workflow_state': {
        const s = await client.state();
        return {
          content: [{ type: 'text', text: `${s.project}: ${s.queueDepth} waiting on you, ${s.openGates} gate(s) open.` }],
        };
      }
      case 'workflow_queue': {
        const rows = await client.queue();
        return {
          content: [
            { type: 'text', text: renderQueueText(rows) },
            // The MCP Apps UI resource (SEP-1865) — hosts that render it show the
            // widget; hosts that don't fall back to the text above (the risk's
            // "degrades to the terminal rendering").
            { type: 'resource', resource: { uri: QUEUE_RESOURCE, mimeType: 'text/html', text: renderQueueHtml(rows, spa) } },
          ],
        };
      }
      case 'workflow_open_gate': {
        const gateId = String(args?.gateId ?? '');
        if (!/^[0-9a-f]{16}$/.test(gateId)) return errorContent('a valid 16-hex gateId is required');
        const g = await client.openGate(gateId);
        if (!g) return errorContent('no such open gate — it may have been answered already');
        return {
          content: [
            { type: 'text', text: renderGateText(g.card, g.comments, spa) },
            { type: 'resource', resource: { uri: GATE_CARD_RESOURCE, mimeType: 'text/html', text: renderGateHtml(g.card, g.comments, spa) } },
          ],
        };
      }
      case 'workflow_answer': {
        const gateId = String(args?.gateId ?? '');
        const text = String(args?.text ?? '').trim();
        if (!/^[0-9a-f]{16}$/.test(gateId)) return errorContent('a valid 16-hex gateId is required');
        if (text === '') return errorContent('an answer is required');
        // UI-origin attestation: ONLY the host sets `_meta['ui-gesture']` on a
        // real gesture (SEP-1865). The model cannot forge it into args. We pass
        // the attestation to the bridge only when present — a plain model call
        // therefore carries none, and the bridge rejects a typed-confirm.
        const attested = meta?.['ui-gesture'] === true ? ('ui-gesture' as const) : undefined;
        const res = await client.answer(gateId, text, attested);
        if (!res.ok) {
          const link = res.deepLink ? ` Open it in the app: ${spa}${res.deepLink}` : '';
          return errorContent(`${res.error ?? 'could not answer'}.${link}`);
        }
        return { content: [{ type: 'text', text: 'Answered — the session is resuming.' }] };
      }
      default:
        return errorContent(`unknown tool: ${name}`);
    }
  }

  async function handle(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    const id = req.id ?? null;
    const ok = (result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result });
    const err = (code: number, message: string): JsonRpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } });
    try {
      switch (req.method) {
        case 'initialize':
          return ok({
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: { tools: {}, resources: {} },
            serverInfo: { name: 'workflow-bridge', version: '0.7.0' },
          });
        case 'notifications/initialized':
          return null; // notification — no response
        case 'tools/list':
          return ok({ tools: TOOLS });
        case 'tools/call': {
          const out = await callTool(req.params?.name, req.params?.arguments ?? {}, req.params?._meta ?? {});
          return ok(out);
        }
        case 'resources/list':
          return ok({
            resources: [
              { uri: GATE_CARD_RESOURCE, name: 'Gate card', mimeType: 'text/html' },
              { uri: QUEUE_RESOURCE, name: 'Needs-you queue', mimeType: 'text/html' },
            ],
          });
        case 'resources/read': {
          const uri = req.params?.uri;
          if (uri === QUEUE_RESOURCE) {
            const rows = await client.queue();
            return ok({ contents: [{ uri, mimeType: 'text/html', text: renderQueueHtml(rows, spa) }] });
          }
          return err(-32602, `unknown resource: ${uri}`);
        }
        default:
          return err(-32601, `method not found: ${req.method}`);
      }
    } catch (e) {
      return err(-32603, String((e as Error).message ?? e));
    }
  }

  return { handle, callTool, tools: TOOLS };
}

function errorContent(message: string): { content: any[]; isError: true } {
  return { content: [{ type: 'text', text: message }], isError: true };
}

// --- rendering: the card + queue as text (fallback) and HTML (UI resource) ---
// These consume the shared GateCard SCHEMA — presentation only; every decision
// path lives in the bridge, never re-implemented here.

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function renderQueueText(rows: QueueRow[]): string {
  if (rows.length === 0) return 'Nothing is waiting on you.';
  return rows
    .map((r) => {
      const addr = r.address.workUnit ? `#${r.address.workUnit}${r.address.topic && r.address.topic !== r.address.workUnit ? `/${r.address.topic}` : ''}` : 'lobby';
      const mark = r.tier === 'live' ? '◆' : '⚑';
      const own = r.watching ? ' (watching)' : r.stuck ? ' (stuck — claim?)' : '';
      const id = r.gateId ? ` [${r.gateId}]` : '';
      return `${mark} ${addr} — ${r.tier === 'live' ? r.askPreview ?? '' : r.detail ?? ''}${own}${id}`;
    })
    .join('\n');
}

export function renderGateText(card: GateCard, comments: GateComment[], spa: string): string {
  const lines = [`◆ ${card.question ?? 'Decision'}`, '', card.context];
  for (const o of card.options) lines.push(`  ${o.key}${o.word ? `/${o.word}` : ''} — ${o.label}${o.recommended ? ' (recommended)' : ''}`);
  if (card.confirm === 'typed') {
    lines.push('', `⚠ This decision needs a typed confirmation from a real gesture — answer it in the app: ${spa}/s/${card.session.bridgeSessionId}`);
  }
  if (comments.length > 0) {
    lines.push('', 'Comments (read-only):');
    for (const c of comments) lines.push(`  · ${c.author}: ${c.body}`);
  }
  return lines.join('\n');
}

export function renderGateHtml(card: GateCard, comments: GateComment[], spa: string): string {
  const typed = card.confirm === 'typed';
  const opts = card.options
    .map(
      (o) =>
        `<button class="opt"${typed ? ' disabled' : ''} data-key="${esc(o.key)}">` +
        `<code>${esc(o.key)}${o.word ? '/' + esc(o.word) : ''}</code> ${esc(o.label)}` +
        `${o.recommended ? ' <span class="rec">recommended</span>' : ''}</button>`,
    )
    .join('');
  const commentHtml = comments.length
    ? `<div class="comments"><b>Comments</b>${comments.map((c) => `<div>· <b>${esc(c.author)}</b>: ${esc(c.body)}</div>`).join('')}</div>`
    : '';
  const typedNote = typed
    ? `<p class="warn">This decision needs a typed confirmation from a real gesture. <a href="${esc(spa)}/s/${esc(card.session.bridgeSessionId)}" target="_blank">Answer it in the app →</a></p>`
    : '';
  // The button/answer wiring is intentionally the HOST's job (SEP-1865): a real
  // gesture posts the answer tool with the host's `_meta['ui-gesture']`. This
  // resource is presentation of the schema; it never re-implements the round-trip.
  return `<!doctype html><meta charset="utf-8"><style>
    body{font:14px system-ui;margin:0;padding:12px;color:#1c1917}
    .q{font-weight:600;font-size:15px;margin-bottom:6px}
    .ctx{white-space:pre-wrap;color:#44403c;margin-bottom:8px}
    .opt{display:block;width:100%;text-align:left;margin:3px 0;padding:6px 8px;border:1px solid #d6d3d1;border-radius:4px;background:#fff}
    .opt[disabled]{opacity:.5}
    code{color:#78716c}.rec{font-size:10px;color:#a8a29e;text-transform:uppercase}
    .warn{color:#b45309}.comments{margin-top:10px;border-top:1px solid #e7e5e4;padding-top:8px;font-size:13px}
  </style><div class="q">◆ ${esc(card.question ?? 'Decision')}</div>
  <div class="ctx">${esc(card.context)}</div>
  <div class="opts">${opts}</div>${typedNote}${commentHtml}`;
}

export function renderQueueHtml(rows: QueueRow[], spa: string): string {
  const items = rows
    .map((r) => {
      const addr = r.address.workUnit ? `#${esc(r.address.workUnit)}` : 'lobby';
      const mark = r.tier === 'live' ? '◆' : '⚑';
      const badge = r.watching ? '<span class="w">watching</span>' : r.stuck ? '<span class="s">stuck — claim?</span>' : '';
      const body = esc(r.tier === 'live' ? r.askPreview ?? '' : r.detail ?? '');
      const link = r.gateId ? ` data-gate="${esc(r.gateId)}"` : '';
      return `<div class="row"${link}><span class="m">${mark}</span> <span class="a">${addr}</span> <span class="b">${body}</span> ${badge}</div>`;
    })
    .join('');
  return `<!doctype html><meta charset="utf-8"><style>
    body{font:13px system-ui;margin:0;padding:8px;color:#1c1917}
    .row{padding:5px 4px;border-bottom:1px solid #f5f5f4;display:flex;gap:6px;align-items:baseline}
    .m{color:#a16207}.a{color:#57534e}.b{flex:1;color:#292524}
    .w{font-size:10px;color:#a8a29e}.s{font-size:10px;color:#b45309}
  </style>${rows.length ? items : '<div>Nothing is waiting on you.</div>'}
  <div style="margin-top:6px;font-size:11px"><a href="${esc(spa)}/queue" target="_blank">Open the full queue →</a></div>`;
}

// --- stdio transport (production) -------------------------------------------
// Line-delimited JSON-RPC over stdin/stdout — the standard MCP stdio transport.
export function runStdio(server: { handle: (req: JsonRpcRequest) => Promise<JsonRpcResponse | null> }): void {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let req: JsonRpcRequest;
      try {
        req = JSON.parse(line);
      } catch {
        continue;
      }
      const resp = await server.handle(req);
      if (resp) process.stdout.write(JSON.stringify(resp) + '\n');
    }
  });
}

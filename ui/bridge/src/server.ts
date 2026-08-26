// Observability floor + transport — phase-0 §7. The debug console is a
// keeper, not scaffolding: structured log stream, /health, per-session
// token/cost counters, and the event stream over SSE. Named surfaces later
// phases extend.
import http from 'node:http';
import { logger, onLog, recentLogs } from './log.js';
import type { EventStore, StoredEvent } from './store.js';
import type { RawEvent } from './derive.js';
import type { Handshake } from './version.js';
import type { Db } from './db.js';

export type HealthState = {
  ok: boolean;
  mode: 'live' | 'replay';
  bridgeMode: Handshake['mode'];
  project: string;
  epoch: string | null;
  version: Pick<Handshake, 'productVersion' | 'versionSource' | 'supported' | 'pendingMigrations' | 'shallow'>;
  bannerReasons: string[];
  replay?: { state: 'streaming' | 'paused' | 'ended'; atTurn?: number; fixture?: string };
  startedAt: string;
  eventsStored: number;
};

type SseClient = { res: http.ServerResponse };

export class BridgeServer {
  private server: http.Server;
  private clients = new Set<SseClient>();
  private startedAt = new Date().toISOString();

  constructor(
    private opts: {
      port: number;
      health: () => HealthState;
      store: EventStore | null;
      db: Db | null;
      onReplayStep?: () => void;
    },
  ) {
    this.server = http.createServer((req, res) => this.route(req, res));
  }

  listen(): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(this.opts.port, '127.0.0.1', () => {
        const addr = this.server.address();
        const port = typeof addr === 'object' && addr ? addr.port : this.opts.port;
        logger.info('server listening', { port });
        resolve(port);
      });
    });
  }

  broadcast(events: (RawEvent | StoredEvent)[]): void {
    const data = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
    for (const c of this.clients) c.res.write(data);
  }

  control(msg: Record<string, unknown>): void {
    const data = `event: control\ndata: ${JSON.stringify(msg)}\n\n`;
    for (const c of this.clients) c.res.write(data);
  }

  private route(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://localhost');
    switch (url.pathname) {
      case '/health': {
        const h = { ...this.opts.health(), startedAt: this.startedAt };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(h, null, 2));
        return;
      }
      case '/events': {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        const client: SseClient = { res };
        this.clients.add(client);
        // Durable backlog from ?since=<seq> (default: full stream), then live tail.
        if (this.opts.store) {
          const since = Number(url.searchParams.get('since') ?? '0');
          for (const e of this.opts.store.readFrom(Number.isFinite(since) ? since : 0)) {
            res.write(`data: ${JSON.stringify(e)}\n\n`);
          }
        }
        res.write(`event: control\ndata: ${JSON.stringify({ control: 'backlog-complete' })}\n\n`);
        req.on('close', () => this.clients.delete(client));
        return;
      }
      case '/logs': {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(recentLogs()));
        return;
      }
      case '/logs/stream': {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
        const off = onLog((e) => res.write(`data: ${JSON.stringify(e)}\n\n`));
        req.on('close', off);
        return;
      }
      case '/costs': {
        // Per-session token/cost counters (phase-0 §7). Sessions arrive in
        // Phase 2; the surface exists and answers now.
        const rows = this.opts.db
          ? this.opts.db.sqlite
              .prepare(
                'SELECT bridge_session_id as bridgeSessionId, project, state, input_tokens as inputTokens, output_tokens as outputTokens, cost_usd as costUsd FROM sessions',
              )
              .all()
          : [];
        const total = (rows as any[]).reduce((s, r) => s + (r.costUsd ?? 0), 0);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ sessions: rows, totalCostUsd: total }));
        return;
      }
      case '/replay/step': {
        if (req.method !== 'POST' || !this.opts.onReplayStep) {
          res.writeHead(this.opts.onReplayStep ? 405 : 404).end();
          return;
        }
        this.opts.onReplayStep();
        res.writeHead(204).end();
        return;
      }
      case '/':
      case '/debug': {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(DEBUG_CONSOLE_HTML);
        return;
      }
      default:
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    }
  }

  close(): void {
    for (const c of this.clients) c.res.end();
    this.server.close();
  }
}

const DEBUG_CONSOLE_HTML = `<!doctype html>
<meta charset="utf-8">
<title>bridge debug</title>
<style>
  body { font-family: ui-monospace, monospace; margin: 0; display: grid; grid-template-columns: 1fr 1fr; height: 100vh; }
  section { overflow: auto; padding: 12px; border-right: 1px solid #ccc; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #666; }
  pre { font-size: 11px; white-space: pre-wrap; margin: 2px 0; }
  .banner { background: #fff3cd; border: 1px solid #ffe08a; padding: 8px; margin-bottom: 8px; font-size: 12px; }
  .live { color: #a06000 } .durable { color: #0a5 }
</style>
<section>
  <h2>health / banner</h2><div id="banner"></div><pre id="health"></pre>
  <h2>costs</h2><pre id="costs"></pre>
</section>
<section>
  <h2>events</h2><div id="events"></div>
  <h2>logs</h2><div id="logs"></div>
</section>
<script>
  async function refresh() {
    const h = await (await fetch('/health')).json();
    document.getElementById('health').textContent = JSON.stringify(h, null, 2);
    document.getElementById('banner').innerHTML = (h.bannerReasons || []).map(r => '<div class="banner">' + r + '</div>').join('');
    const c = await (await fetch('/costs')).json();
    document.getElementById('costs').textContent = JSON.stringify(c, null, 2);
  }
  refresh(); setInterval(refresh, 5000);
  const ev = new EventSource('/events');
  ev.onmessage = (m) => {
    const e = JSON.parse(m.data);
    const el = document.createElement('pre');
    el.className = e.live ? 'live' : 'durable';
    el.textContent = (e.seq ?? 'live') + ' ' + e.type + ' ' + JSON.stringify(e.address) + ' ' + JSON.stringify(e.payload);
    const box = document.getElementById('events');
    box.prepend(el);
    while (box.children.length > 300) box.lastChild.remove();
  };
  const lg = new EventSource('/logs/stream');
  lg.onmessage = (m) => {
    const e = JSON.parse(m.data);
    const el = document.createElement('pre');
    el.textContent = e.level + ' ' + e.msg + ' ' + JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !['ts','level','msg'].includes(k))));
    const box = document.getElementById('logs');
    box.prepend(el);
    while (box.children.length > 200) box.lastChild.remove();
  };
</script>`;

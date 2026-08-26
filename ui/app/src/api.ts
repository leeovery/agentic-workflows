// Data layer: fetch + the bridge's SSE stream. Live-follow works by
// event-driven refetch — the SSE stream signals change, the API answers with
// engine-sourced state; the app never derives workflow state itself.
import { useEffect, useState, useCallback, useRef } from 'react';

export type Health = {
  ok: boolean;
  mode: 'live' | 'replay';
  bridgeMode: 'full' | 'read-only' | 'live-only';
  project: string;
  epoch: string | null;
  bannerReasons: string[];
  version: { productVersion: string | null; supported: boolean; pendingMigrations: string[]; shallow: boolean };
  replay?: { state: string; atTurn: number; fixture: string };
};

export type LobbyData =
  | { empty: true; reason: string }
  | {
      empty: false;
      detail: any;
      overviewRender: string | null;
      knowledge: { state: 'ready' | 'not-ready' | 'unknown' };
      durable: { counts: Record<string, number>; rows: any[] };
      roadmap: { horizons: any[]; totals: Record<string, number>; itemCount: number } | null;
      baseline: { status: string } | null;
    };

export type ChannelData = {
  name: string;
  workType: string;
  status: string;
  spine: any[];
  drawer: any[];
  threads: { name: string; lifecycle: string; phase: string | null; cues: any }[];
  embed: string | null;
  artifacts: { path: string; phase: string }[];
};

export type ArtifactData = { workUnit: string; path: string; phase: string; content: string };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

// The bearer token for mutating calls and the event stream (trust boundary).
let tokenPromise: Promise<string | null> | null = null;
export function bridgeToken(): Promise<string | null> {
  if (!tokenPromise) {
    tokenPromise = fetch('/api/token')
      .then((r) => r.json())
      .then((b) => b.token ?? null)
      .catch(() => null);
  }
  return tokenPromise;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const token = await bridgeToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 409) throw new Error(json.error ?? `${url}: ${res.status}`);
  return json;
}

export type GateCardData = {
  id: string;
  kind: string;
  source: string;
  surface?: string;
  question?: string;
  context: string;
  options: { key: string; word?: string; label: string; recommended: boolean; form: string }[];
  confirm: 'tap' | 'typed';
  state: string;
  address: { workUnit?: string; topic?: string; phase?: string };
  session: { bridgeSessionId: string; askOrdinal: number };
  openedAt: string;
  relayDiverged?: boolean;
};

export type QueueRowData = {
  tier: 'live' | 'durable';
  kind: string;
  address: { workUnit?: string; topic?: string; phase?: string };
  stage: 0 | 1 | 2;
  since: string;
  detail: string;
  gateId?: string;
  bridgeSessionId?: string;
  askPreview?: string;
};

export type SessionData = {
  bridgeSessionId: string;
  address: { workUnit?: string; topic?: string; phase?: string };
  state: string;
  openGate: GateCardData | null;
  lastError?: string;
};

export type ThreadData = {
  state: string;
  openGate: GateCardData | null;
  lastError?: string;
  records: Record<string, any>[];
  asks: { ordinal: number; gateId: string; answered: boolean; kind: string }[];
};

export const api = {
  health: () => getJson<Health>('/health'),
  lobby: () => getJson<LobbyData>('/api/lobby'),
  channel: (wu: string) => getJson<ChannelData>(`/api/channel/${encodeURIComponent(wu)}`),
  artifact: (wu: string, path: string) =>
    getJson<ArtifactData>(`/api/artifact/${encodeURIComponent(wu)}?path=${encodeURIComponent(path)}`),
  queue: () => getJson<{ rows: QueueRowData[] }>('/api/queue'),
  sessions: () => getJson<{ sessions: SessionData[] }>('/api/sessions'),
  thread: (id: string) => getJson<ThreadData>(`/api/session/${encodeURIComponent(id)}/thread`),
  startSession: (address: Record<string, unknown>, entryPrompt?: string) =>
    postJson<{ bridgeSessionId: string; state: string }>(`/api/session/start`, { address, entryPrompt }),
  answerGate: (gateId: string, text: string, bridgeSessionId?: string) =>
    postJson<{ ok: boolean; state: string; reason?: string }>(`/api/gate/${gateId}/answer`, { text, bridgeSessionId }),
  endSession: (id: string) => postJson<{ ok: boolean }>(`/api/session/${encodeURIComponent(id)}/end`, {}),
};

// One shared SSE subscription; consumers register a refetch callback that
// fires (debounced) on any domain event, and a hard-reset on epoch change.
type Listener = () => void;
const listeners = new Set<Listener>();
let source: EventSource | null = null;

async function openStream(): Promise<void> {
  const token = await bridgeToken();
  source = new EventSource(token ? `/events?token=${token}` : '/events');
  let timer: ReturnType<typeof setTimeout> | null = null;
  const poke = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      for (const l of listeners) l();
    }, 250);
  };
  source.onmessage = poke;
  source.addEventListener('control', (ev) => {
    try {
      const msg = JSON.parse((ev as MessageEvent).data);
      if (msg.control === 'epoch-changed') window.location.reload();
      else poke();
    } catch {
      poke();
    }
  });
  source.onerror = () => {
    // EventSource auto-reconnects; nothing to do but wait.
  };
}

let streamStarted = false;
function ensureStream(): void {
  if (streamStarted) return;
  streamStarted = true;
  void openStream();
}

export function useLive<T>(fetcher: () => Promise<T>, deps: unknown[] = []): {
  data: T | null;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(() => {
    fetcherRef
      .current()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(String(e.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    ensureStream();
    reload();
    listeners.add(reload);
    return () => {
      listeners.delete(reload);
    };
  }, [reload]);

  return { data, error, reload };
}

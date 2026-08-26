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
      roadmap: { horizons: any[]; itemCount: number } | null;
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

export const api = {
  health: () => getJson<Health>('/health'),
  lobby: () => getJson<LobbyData>('/api/lobby'),
  channel: (wu: string) => getJson<ChannelData>(`/api/channel/${encodeURIComponent(wu)}`),
  artifact: (wu: string, path: string) =>
    getJson<ArtifactData>(`/api/artifact/${encodeURIComponent(wu)}?path=${encodeURIComponent(path)}`),
};

// One shared SSE subscription; consumers register a refetch callback that
// fires (debounced) on any domain event, and a hard-reset on epoch change.
type Listener = () => void;
const listeners = new Set<Listener>();
let source: EventSource | null = null;

function ensureStream(): void {
  if (source) return;
  source = new EventSource('/events');
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

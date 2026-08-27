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
      failedCaptures?: FailedCapture[];
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
  presence?: { phase?: string; topic?: string; held?: boolean; live?: boolean; session_id?: string }[];
  humansViewing?: { humanId: string; name: string; lastSeenAt: string }[];
  inferredSessions?: { phase: string; topic: string; mtime: string; inferred: true }[];
  telemetry?: TopicTelemetry[];
  planFormat?: string;
  agentsReading?: number;
};

// Phase 6: who the request is (single-user is always the sentinel "You").
export type WhoamiData = {
  mode: 'single' | 'github';
  human: { id: string; name: string; member: boolean; sentinel: boolean; githubLogin: string | null };
};

// Phase 6: the ownership + comment overlay the bridge joins onto a gate card.
export type GateOwnership = {
  owner?: { id: string | null; name: string | null; stuck?: boolean; isYou: boolean };
  canAnswer?: boolean;
  watching?: boolean;
  unreadComments?: number;
  commentCount?: number;
  resolvedExternallyAt?: string;
};

export type CommentData = { id: number; humanId: string; author: string; body: string; createdAt: string; read: boolean };

export type FailedCapture = {
  id: string;
  kind: string;
  payload: string;
  provenance: { source: string; author?: string } | null;
  error: string | null;
  failedAt: string;
};

export type TopicTelemetry = {
  topic: string;
  status: string;
  currentPhase: string | null;
  currentTask: string | null;
  completedPhases: string[];
  completedTasks: string[];
  fixAttempts: number;
  analysisCycles: number;
  depBlocked: { topic: string; reason?: string }[];
  consolidation: {
    gated: boolean;
    bank: any[];
    staging: Record<string, any[]>;
    consolidatedPhases: string[];
  };
  commitsLanded: { sha: string; subject: string }[];
  agentsActive: number;
};

export type PlanTask = { id: string; title: string; phase: string | null; status: string; priority: number; dependsOn: string[] };
export type PlanDagData =
  | { format: 'local-markdown' | 'tick'; tasks: PlanTask[] }
  | { format: 'linear'; linkOut: string | null }
  | { format: 'unknown'; tasks: [] };

export type StructureNode = { label: string; status?: string; anchor?: string; detail?: string };
export type ClaimChipData = { command: string; result?: string; anchor?: string; verified?: boolean };
export type ArtifactStructure = {
  kind: string;
  sections: StructureNode[];
  sources?: StructureNode[];
  consultReferences?: StructureNode[];
  claims: ClaimChipData[];
  available: boolean;
};
export type WhatMovedData =
  | { state: 'none' }
  | { state: 'unread'; base: string; diff: string }
  | { state: 'lost' };

export type ArtifactData = {
  workUnit: string;
  path: string;
  phase: string;
  content: string;
  structure: ArtifactStructure;
  whatMoved: WhatMovedData;
};

export type HistoryEntry = { sha: string; date: string; subject: string; author: string };
export type RoadmapData =
  | { exists: false }
  | {
      exists: true;
      horizons: any[];
      items: any[];
      totals: Record<string, number>;
      sessions: any[];
      activeSession: any;
    };

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
} & GateOwnership;

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
  escalated?: boolean;
  stuck?: boolean;
  buildOrderPos?: number;
  owner?: { id: string | null; name: string | null; isYou: boolean };
  watching?: boolean;
  unreadComments?: number;
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
  asks: { ordinal: number; gateId: string; answered: boolean; kind: string; turn: number }[];
};

export type DigestStripEntry = {
  channel: string;
  landed: { commits: { sha: string; subject: string }[]; artifacts: string[] };
  next: string | null;
  emittedAt: string;
};

export const api = {
  health: () => getJson<Health>('/health'),
  lobby: () => getJson<LobbyData>('/api/lobby'),
  digests: () => getJson<{ strip: DigestStripEntry[] }>('/api/digests'),
  reportActivity: (focusedThread: string | null, interaction = false) =>
    postJson('/api/activity', { appConnected: true, focusedThread, interaction }).catch(() => ({})),
  channel: (wu: string) => getJson<ChannelData>(`/api/channel/${encodeURIComponent(wu)}`),
  artifact: (wu: string, path: string) =>
    getJson<ArtifactData>(`/api/artifact/${encodeURIComponent(wu)}?path=${encodeURIComponent(path)}`),
  history: (wu: string, path: string) =>
    getJson<{ timeline: HistoryEntry[] }>(`/api/history/${encodeURIComponent(wu)}?path=${encodeURIComponent(path)}`),
  roadmap: () => getJson<RoadmapData>('/api/roadmap'),
  plan: (wu: string, topic: string) =>
    getJson<{ dag: PlanDagData }>(`/api/plan/${encodeURIComponent(wu)}/${encodeURIComponent(topic)}`),
  // Advance the read-ref for the what-moved diff base — a deliberate view.
  markArtifactRead: (wu: string, path: string) =>
    postJson(`/api/artifact/${encodeURIComponent(wu)}/read`, { path }).catch(() => ({})),
  queue: () => getJson<{ rows: QueueRowData[] }>('/api/queue'),
  sessions: () => getJson<{ sessions: SessionData[] }>('/api/sessions'),
  thread: (id: string) => getJson<ThreadData>(`/api/session/${encodeURIComponent(id)}/thread`),
  startSession: (address: Record<string, unknown>, entryPrompt?: string) =>
    postJson<{ bridgeSessionId: string; state: string }>(`/api/session/start`, { address, entryPrompt }),
  // Every SPA answer IS a real user gesture (a click / Enter), so it attests
  // UI-origin — the typed-confirm attestation the bridge requires (Phase 7).
  answerGate: (gateId: string, text: string, bridgeSessionId?: string) =>
    postJson<{ ok: boolean; state: string; reason?: string; error?: string; unreadComments?: number; deepLink?: string }>(
      `/api/gate/${gateId}/answer`,
      { text, bridgeSessionId, attestation: 'ui-gesture' },
    ),
  endSession: (id: string) => postJson<{ ok: boolean }>(`/api/session/${encodeURIComponent(id)}/end`, {}),
  // Phase 6 — identity.
  whoami: () => getJson<WhoamiData>('/api/whoami'),
  login: (githubLogin: string, token?: string) =>
    postJson<{ human?: { id: string; name: string; member: boolean }; warning?: string; error?: string }>('/api/login', { githubLogin, token }),
  logout: () => postJson<{ ok: boolean }>('/api/logout', {}),
  // Phase 6 — gate ownership (routing).
  claimGate: (gateId: string) => postJson<{ ok: boolean; ownerId: string }>(`/api/gate/${gateId}/claim`, {}),
  claimChannel: (wu: string) => postJson<{ ok: boolean }>(`/api/channel/${encodeURIComponent(wu)}/claim`, {}),
  // Phase 6 — comments (never push).
  comments: (target: { gateId?: string; artifact?: string }) => {
    const q = target.gateId ? `gateId=${target.gateId}` : `artifact=${encodeURIComponent(target.artifact ?? '')}`;
    return getJson<{ comments: CommentData[] }>(`/api/comments?${q}`);
  },
  addComment: (target: { gateId?: string; artifact?: string }, body: string) =>
    postJson<{ id: number }>('/api/comments', { ...target, body }),
  markCommentsRead: (target: { gateId?: string; artifact?: string }) =>
    postJson<{ ok: boolean }>('/api/comments/read', target).catch(() => ({ ok: false })),
  // Phase 6 — the capture gesture.
  capture: (kind: string, payload: string, provenance: Record<string, unknown>) =>
    postJson<{ ok: boolean; captureId?: string; error?: string }>('/api/capture', { kind, payload, provenance }),
  captures: () => getJson<{ failed: FailedCapture[] }>('/api/captures'),
  retryCapture: (id: string) => postJson<{ ok: boolean }>(`/api/capture/${encodeURIComponent(id)}/retry`, {}),
  discardCapture: (id: string) => postJson<{ ok: boolean }>(`/api/capture/${encodeURIComponent(id)}/discard`, {}),
  // Attachments — materialize a file into the gitignored cache and get back its
  // project-relative path; the caller references it in the turn so the session's
  // Read tool picks it up.
  uploadAttachment: async (
    file: File,
    ctx: { workUnit?: string; bridgeSessionId?: string },
  ): Promise<{ path?: string; error?: string }> => {
    const dataBase64 = await fileToBase64(file);
    return postJson<{ path?: string; error?: string }>('/api/attachments', { name: file.name, dataBase64, ...ctx });
  },
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(file);
  });
}

// One shared SSE subscription; consumers register a refetch callback that
// fires (debounced) on any domain event, and a hard-reset on epoch change.
type Listener = () => void;
const listeners = new Set<Listener>();
let source: EventSource | null = null;

async function openStream(): Promise<void> {
  // EventSource is absent in some environments (jsdom tests, older embeds) —
  // degrade to fetch-on-mount without live-follow rather than crashing.
  if (typeof EventSource === 'undefined') return;
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

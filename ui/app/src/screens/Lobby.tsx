// S1 · Lobby — the morning answer (intent 3), Phase 1 regions: header
// (project · bridge health · knowledge state), WORK cards, START (inbox count,
// roadmap horizons, baseline), plus the designed empty and knowledge-not-ready
// states. NEEDS YOU and TODAY arrive with Phases 2–3.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useLive, type Health, type LobbyData, type SessionData, type QueueRowData } from '../api';
import { EngineEmbed } from '../components/EngineEmbed';
import { SessionHealthBadge } from '../components/SessionHealthBadge';
import { DigestCard } from '../components/DigestCard';
import { FailedCaptures } from '../components/FailedCaptures';
import type { DigestStripEntry } from '../api';

const GROUPS: [string, string][] = [
  ['epics', 'epic'],
  ['features', 'feature'],
  ['bugfixes', 'bugfix'],
  ['quick_fixes', 'quick-fix'],
  ['cross_cutting', 'cross-cutting'],
];

export function Lobby() {
  const { data: lobby, error, reload } = useLive<LobbyData>(() => api.lobby());
  const { data: health } = useLive<Health>(() => api.health());
  const { data: sessionsData } = useLive<{ sessions: SessionData[] }>(() => api.sessions());
  const { data: queueData } = useLive<{ rows: QueueRowData[] }>(() => api.queue());
  const { data: digestData } = useLive<{ strip: DigestStripEntry[] }>(() => api.digests());
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();

  // The lobby holds at most one shaping session per human (spec 2): reuse a
  // live lobby-addressed session rather than starting a second.
  const lobbySessions = (sessionsData?.sessions ?? []).filter(
    (s) => !s.address.workUnit && s.state !== 'ended',
  );
  const startShaping = async () => {
    if (lobbySessions.length > 0) {
      navigate(`/s/${lobbySessions[0]!.bridgeSessionId}`);
      return;
    }
    setStarting(true);
    try {
      const res = await api.startSession({}, '/workflow-start');
      navigate(`/s/${res.bridgeSessionId}`);
    } finally {
      setStarting(false);
    }
  };

  if (error) return <div className="p-8 font-sans text-sm text-blocked">bridge unreachable: {error}</div>;
  if (!lobby) return <div className="p-8 font-sans text-sm text-stone-400">…</div>;

  if (lobby.empty) {
    return (
      <div className="p-12 max-w-measure font-sans">
        <h1 className="text-xl font-semibold mb-3">No workflow state yet</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 leading-6">
          This project has no <code className="font-mono">.workflows/</code> directory. Start work from a
          terminal session with <code className="font-mono">/workflow-start</code> — the bridge will mirror
          it here the moment it exists.
        </p>
      </div>
    );
  }

  const knowledgeNotReady = lobby.knowledge.state !== 'ready';

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      {/* Header: project · bridge health · knowledge state */}
      <header className="flex items-baseline gap-4">
        <h1 className="text-xl font-sans font-semibold">{health?.project}</h1>
        <span className="text-xs font-mono text-stone-400">
          bridge {health?.bridgeMode ?? '…'} · {health?.mode}
        </span>
        <span className={`text-xs font-sans ${knowledgeNotReady ? 'text-warn' : 'text-stone-400'}`}>
          memory {lobby.knowledge.state}
        </span>
      </header>

      {knowledgeNotReady && (
        <div className="banner-degraded">
          Memory not initialised — finish knowledge setup in a terminal session (
          <span className="font-mono">/workflow-start</span> walks you through it).
        </div>
      )}

      {/* Failed captures — durable, payload retained, never a lost toast. */}
      {!lobby.empty && (lobby.failedCaptures?.length ?? 0) > 0 && (
        <FailedCaptures rows={lobby.failedCaptures ?? []} onChange={reload} />
      )}

      {/* NEEDS YOU — top cross-unit queue rows (the morning answer, intent 3).
          A reference strip only; /queue is the interactive surface. */}
      {(queueData?.rows.length ?? 0) > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <div className="region-label">Needs you</div>
            <Link to="/queue" className="text-xs font-sans text-nav hover:underline">
              all {queueData!.rows.length} →
            </Link>
          </div>
          <div className="space-y-1">
            {queueData!.rows.slice(0, 4).map((r, i) => (
              <Link
                key={`${r.tier}-${r.gateId ?? `${r.kind}-${r.address.workUnit}-${i}`}`}
                to="/queue"
                className="flex items-baseline gap-3 text-sm hover:bg-stone-100/60 dark:hover:bg-stone-900/60 rounded px-1 py-0.5"
              >
                <span className={`font-mono text-xs shrink-0 w-20 truncate ${r.tier === 'live' ? 'text-gate' : 'text-stone-500'}`}>
                  {r.tier === 'live' ? `◆ ${r.kind}` : `⚑ ${r.kind}`}
                </span>
                <span className="font-sans text-stone-600 dark:text-stone-400 shrink-0">
                  {r.address.workUnit ?? 'lobby'}
                </span>
                <span className="font-serif truncate flex-1 text-stone-800 dark:text-stone-200">
                  {r.tier === 'live' ? r.askPreview : r.detail}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* TODAY — the digest strip (waiting-suppressed; NEEDS YOU carries it). */}
      {(digestData?.strip ?? []).some((d) => d.landed.commits.length || d.landed.artifacts.length || d.next) && (
        <section>
          <div className="region-label mb-2">Today</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(digestData?.strip ?? []).map((d) => (
              <DigestCard key={d.channel} digest={d} />
            ))}
          </div>
        </section>
      )}

      {/* WORK — feature and epic cards */}
      <section>
        <div className="region-label mb-2">Work</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GROUPS.flatMap(([group, type]) =>
            (lobby.detail?.[group]?.work_units ?? []).map((u: any) => (
              <Link
                key={u.name}
                to={`/c/${u.name}`}
                className="settle block rounded-lg border border-stone-200 dark:border-stone-800 p-4 hover:border-nav"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-sans font-medium">#{u.name}</span>
                  <span className="text-[11px] font-sans text-stone-400">{type}</span>
                </div>
                <div className="mt-1 font-mono text-xs text-stone-500">{u.phase_label ?? u.next_phase}</div>
                <div className="mt-2 text-xs font-sans text-stone-500">
                  {(lobby.durable.counts[u.name] ?? 0) > 0 ? (
                    <>
                      {lobby.durable.counts[u.name]} waiting on you
                      <span className="text-stone-400"> (durable)</span>
                    </>
                  ) : (
                    <span className="text-stone-400">nothing waiting (durable tier)</span>
                  )}
                  <span className="block text-stone-400/70">live asks arrive with bridge sessions (Phase 2)</span>
                </div>
              </Link>
            )),
          )}
          {GROUPS.every(([g]) => (lobby.detail?.[g]?.work_units ?? []).length === 0) && (
            <div className="text-sm font-sans text-stone-400 col-span-2">
              No active work units. Start one from a terminal session.
            </div>
          )}
        </div>
      </section>

      {/* Engine's own overview — the reference rendering. */}
      {lobby.overviewRender && <EngineEmbed text={lobby.overviewRender} label="engine · overview" />}

      {/* Sessions this bridge is driving. */}
      {(sessionsData?.sessions ?? []).filter((s) => s.state !== 'ended').length > 0 && (
        <section>
          <div className="region-label mb-2">Sessions</div>
          <div className="space-y-1.5">
            {(sessionsData?.sessions ?? [])
              .filter((s) => s.state !== 'ended')
              .map((s) => (
                <Link key={s.bridgeSessionId} to={`/s/${s.bridgeSessionId}`} className="flex items-center gap-2 text-sm font-sans text-nav hover:underline">
                  {s.address.workUnit ? `#${s.address.workUnit}` : 'shaping thread'}
                  <SessionHealthBadge state={s.state} error={s.lastError} />
                </Link>
              ))}
          </div>
        </section>
      )}

      {/* START — project-level tier: the shaping thread lives here */}
      <section>
        <div className="region-label mb-2">Start</div>
        <button
          onClick={startShaping}
          disabled={starting}
          className="mb-2 rounded px-3 py-1.5 text-sm font-sans bg-nav text-white disabled:opacity-40"
        >
          {starting
            ? 'starting…'
            : lobbySessions.length > 0
              ? 'continue the shaping thread'
              : 'start something — a session begins here'}
        </button>
        <div className="space-y-1.5 text-sm font-sans text-stone-600 dark:text-stone-400">
          <div>
            Inbox: <span className="font-mono">{lobby.detail?.inbox?.total_count ?? 0}</span> item(s)
          </div>
          {lobby.roadmap && (
            <div>
              <div>
                Roadmap: <span className="font-mono">{lobby.roadmap.itemCount}</span> item(s)
                {typeof lobby.roadmap.totals?.waiting === 'number' && (
                  <span className="text-stone-400"> · {lobby.roadmap.totals.waiting} waiting</span>
                )}
              </div>
              {/* Horizons as rows (deliverable 1: "roadmap horizons (rows only)"). */}
              {lobby.roadmap.horizons.map((h: any) => (
                <div key={h.name ?? String(h)} className="pl-4 text-stone-500">
                  {h.name ?? String(h)}
                </div>
              ))}
            </div>
          )}
          <div>
            Baseline:{' '}
            <span className="font-mono">{lobby.baseline?.status ?? 'none'}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

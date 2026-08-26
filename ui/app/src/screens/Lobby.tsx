// S1 · Lobby — the morning answer (intent 3), Phase 1 regions: header
// (project · bridge health · knowledge state), WORK cards, START (inbox count,
// roadmap horizons, baseline), plus the designed empty and knowledge-not-ready
// states. NEEDS YOU and TODAY arrive with Phases 2–3.
import { Link } from 'react-router-dom';
import { api, useLive, type Health, type LobbyData } from '../api';
import { EngineEmbed } from '../components/EngineEmbed';

const GROUPS: [string, string][] = [
  ['epics', 'epic'],
  ['features', 'feature'],
  ['bugfixes', 'bugfix'],
  ['quick_fixes', 'quick-fix'],
  ['cross_cutting', 'cross-cutting'],
];

export function Lobby() {
  const { data: lobby, error } = useLive<LobbyData>(() => api.lobby());
  const { data: health } = useLive<Health>(() => api.health());

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

      {/* START — project-level tier (read-only rows; actions arrive P2/P6) */}
      <section>
        <div className="region-label mb-2">Start</div>
        <div className="space-y-1.5 text-sm font-sans text-stone-600 dark:text-stone-400">
          <div>
            Inbox: <span className="font-mono">{lobby.detail?.inbox?.total_count ?? 0}</span> item(s)
          </div>
          {lobby.roadmap && (
            <div>
              Roadmap: <span className="font-mono">{lobby.roadmap.itemCount}</span> item(s)
              {lobby.roadmap.horizons.length > 0 && (
                <span className="text-stone-400">
                  {' '}
                  across {lobby.roadmap.horizons.map((h: any) => h.name ?? h).join(' · ')}
                </span>
              )}
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

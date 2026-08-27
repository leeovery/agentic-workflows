// S3 · Channel (read-only) — spine + thread previews on the left, context
// panel (engine embed, artifacts, activity drawer) on the right. Threads
// never expand inline; commits live in the drawer, never on the spine.
import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, useLive, type ChannelData, type SessionData } from '../api';
import { EngineEmbed } from '../components/EngineEmbed';
import { SpineItem } from '../components/SpineItem';
import { SessionHealthBadge } from '../components/SessionHealthBadge';
import { PresenceStrip } from '../components/PresenceStrip';

export function Channel() {
  const { wu = '' } = useParams();
  const { data, error } = useLive<ChannelData>(() => api.channel(wu), [wu]);
  const { data: sessionsData } = useLive<{ sessions: SessionData[] }>(() => api.sessions());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();

  const channelSessions = (sessionsData?.sessions ?? []).filter(
    (s) => s.address.workUnit === wu && s.state !== 'ended',
  );
  const drive = async () => {
    if (channelSessions.length > 0) {
      navigate(`/s/${channelSessions[0]!.bridgeSessionId}`);
      return;
    }
    setStarting(true);
    try {
      // The session's own start overview carries the continue routes — the
      // human navigates by answering its card (no second routing source).
      const res = await api.startSession({ workUnit: wu }, '/workflow-start');
      navigate(`/s/${res.bridgeSessionId}`);
    } finally {
      setStarting(false);
    }
  };

  if (error) return <div className="p-8 font-sans text-sm text-blocked">{error}</div>;
  if (!data) return <div className="p-8 font-sans text-sm text-stone-400">…</div>;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        <header className="flex items-baseline gap-3">
          <h1 className="text-lg font-sans font-semibold">#{data.name}</h1>
          <span className="text-[11px] font-sans text-stone-400 border border-stone-300 dark:border-stone-700 rounded px-1.5">
            {data.workType}
          </span>
          <span className="font-mono text-xs text-stone-500">{data.status}</span>
          {channelSessions.map((s) => (
            <Link key={s.bridgeSessionId} to={`/s/${s.bridgeSessionId}`}>
              <SessionHealthBadge state={s.state} error={s.lastError} />
            </Link>
          ))}
          <button
            onClick={drive}
            disabled={starting}
            className="ml-auto rounded px-2.5 py-1 text-xs font-sans bg-nav text-white disabled:opacity-40"
          >
            {starting ? 'starting…' : channelSessions.length > 0 ? 'open session' : 'drive from here'}
          </button>
        </header>
        {data.presence && <PresenceStrip rows={data.presence} />}

        <section>
          <div className="region-label mb-1">Spine</div>
          {data.spine.length === 0 ? (
            <p className="text-sm font-sans text-stone-400 py-2">
              Nothing has completed yet — the spine carries gates and phase completions only. Activity
              lives in the drawer.
            </p>
          ) : (
            data.spine.map((e: any) => <SpineItem key={e.id} event={e} />)
          )}
        </section>

        <section>
          <div className="region-label mb-1">Threads</div>
          {data.threads.map((t) => {
            // The epic view's own discipline mirrored: a topic HELD by another
            // session strikes through and is not offered.
            const held = (data.presence ?? []).some((p) => p.topic === t.name && p.held);
            return (
            <div
              key={t.name}
              className="flex items-baseline gap-3 py-2 border-b border-stone-200/70 dark:border-stone-800/70"
            >
              <span className={`font-sans text-sm font-medium ${held ? 'line-through text-stone-400' : ''}`}>
                {t.name}
              </span>
              {held && <span className="text-xs font-sans text-stone-400">held by another session</span>}
              <span className="font-mono text-xs text-stone-500">
                {/* The header already states the unit's status — never print
                    the same fact twice on one screen (intent 5). */}
                {t.phase ? `${t.phase} · ` : ''}
                {t.lifecycle !== data.status ? t.lifecycle : ''}
              </span>
              <span className="ml-auto text-xs font-sans text-stone-400">
                {t.cues?.reconcilePending && <span className="text-warn mr-2">⚑ input moved</span>}
                {t.cues?.triageParked && <span className="text-warn mr-2">triage waiting</span>}
                {(() => {
                  // Link to an existing session addressed to this topic, if any.
                  const s = channelSessions.find((cs) => cs.address.topic === t.name);
                  return s ? (
                    <Link to={`/s/${s.bridgeSessionId}`} className="text-nav hover:underline">
                      open session
                    </Link>
                  ) : null;
                })()}
              </span>
            </div>
            );
          })}
        </section>
      </div>

      {/* Context panel */}
      <aside className="w-80 shrink-0 border-l border-stone-200 dark:border-stone-800 overflow-y-auto p-4 space-y-6">
        {data.embed && <EngineEmbed text={data.embed} label="engine · state" />}

        <section>
          <div className="region-label mb-2">Artifacts</div>
          <div className="space-y-1">
            {data.artifacts.map((a) => (
              <Link
                key={a.path}
                to={`/c/${data.name}/a/${a.path}`}
                className="block text-sm font-sans text-nav hover:underline truncate"
              >
                {a.path}
              </Link>
            ))}
            {data.artifacts.length === 0 && (
              <div className="text-xs font-sans text-stone-400">no artifacts yet</div>
            )}
          </div>
        </section>

        <section>
          <button
            onClick={() => setDrawerOpen((o) => !o)}
            className="region-label hover:text-stone-600 dark:hover:text-stone-300"
          >
            Activity drawer {drawerOpen ? '▾' : '▸'} ({data.drawer.length})
          </button>
          {drawerOpen && (
            <div className="mt-2 space-y-2">
              {[...data.drawer].reverse().map((e: any) => (
                <div key={e.id} className="text-xs font-mono text-stone-500 leading-5">
                  {e.type === 'commit.landed' ? (
                    <>
                      <span className="text-stone-400">{String(e.payload.sha).slice(0, 8)}</span>{' '}
                      {e.payload.subject}
                    </>
                  ) : (
                    <>
                      <span className="text-stone-400">artifact</span> {e.payload.path}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

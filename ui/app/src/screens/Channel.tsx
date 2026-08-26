// S3 · Channel (read-only) — spine + thread previews on the left, context
// panel (engine embed, artifacts, activity drawer) on the right. Threads
// never expand inline; commits live in the drawer, never on the spine.
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, useLive, type ChannelData } from '../api';
import { EngineEmbed } from '../components/EngineEmbed';
import { SpineItem } from '../components/SpineItem';

export function Channel() {
  const { wu = '' } = useParams();
  const { data, error } = useLive<ChannelData>(() => api.channel(wu), [wu]);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        </header>

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
          {data.threads.map((t) => (
            <div
              key={t.name}
              className="flex items-baseline gap-3 py-2 border-b border-stone-200/70 dark:border-stone-800/70"
            >
              <span className="font-sans text-sm font-medium">{t.name}</span>
              <span className="font-mono text-xs text-stone-500">
                {t.phase ? `${t.phase} · ` : ''}
                {t.lifecycle}
              </span>
              <span className="ml-auto text-xs font-sans text-stone-400">
                {t.cues?.reconcilePending && <span className="text-warn mr-2">⚑ input moved</span>}
                {t.cues?.triageParked && <span className="text-warn mr-2">triage waiting</span>}
                thread opens in Phase 2
              </span>
            </div>
          ))}
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

// S5 · Artifact viewer — Read / Structure / History lenses (phase-4). Read is
// the typeset body with the firmness gradient; Structure is the per-type rail
// (absent, never an error, on degradation); History is the file timeline. The
// what-moved ribbon and claim chips overlay the Read lens.
import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { api, useLive, type ArtifactData, type HistoryEntry } from '../api';
import { Markdown } from '../components/Markdown';
import {
  LensTabs,
  structureRail,
  ClaimChip,
  WhatMovedRibbon,
  HistoryTimeline,
  type Lens,
} from '../components/lenses';
import { VerdictBanner, BriefCard } from '../components/VerdictBrief';

const FIRMNESS: Record<string, { cls: string; label: string }> = {
  research: { cls: 'firmness-research', label: 'research — exploratory' },
  discussion: { cls: 'firmness-discussion', label: 'discussion — working record' },
  investigation: { cls: 'firmness-discussion', label: 'investigation — working record' },
  specification: { cls: 'firmness-specification', label: 'specification — the record' },
};

function scrollToAnchor(a: string) {
  document.getElementById(a)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function Artifact() {
  const { wu = '', '*': rest = '' } = useParams();
  const { data, error } = useLive<ArtifactData>(() => api.artifact(wu, rest), [wu, rest]);
  const [lens, setLens] = useState<Lens>('read');
  const { data: history } = useLive<{ timeline: HistoryEntry[] }>(() => api.history(wu, rest), [wu, rest]);
  const location = useLocation();

  // A gate deep-link (#anchor) scrolls to and highlights the section it
  // concerns (S5). The docked card and the what-moved panel are mutually
  // exclusive — a deep-link collapses the ribbon.
  // Advance the read-ref once, on a genuine focused view (mount / becomes
  // visible) — never on a background SSE refetch.
  useEffect(() => {
    const mark = () => {
      if (document.visibilityState === 'visible') api.markArtifactRead(wu, rest);
    };
    mark();
    document.addEventListener('visibilitychange', mark);
    return () => document.removeEventListener('visibilitychange', mark);
  }, [wu, rest]);

  const deepAnchor = location.hash.replace(/^#/, '');
  useEffect(() => {
    if (!deepAnchor || !data) return;
    const el = document.getElementById(deepAnchor);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('deep-linked');
    const t = setTimeout(() => el.classList.remove('deep-linked'), 2000);
    return () => clearTimeout(t);
  }, [deepAnchor, data]);

  if (error) return <div className="p-8 font-sans text-sm text-blocked">{error}</div>;
  if (!data) return <div className="p-8 font-sans text-sm text-stone-400">…</div>;

  const firmness = FIRMNESS[data.phase] ?? { cls: 'firmness-discussion', label: data.phase };
  const hasStructure = data.structure.available;
  const effectiveLens: Lens = lens === 'structure' && !hasStructure ? 'read' : lens;

  return (
    <div className="flex h-full">
      {/* S5 rail — replaces the context panel. It collapses first: hidden
          below the breakpoint so the Read lens keeps its minimum measure. */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-stone-200 dark:border-stone-800 p-4 space-y-3 overflow-y-auto">
        <Link to={`/c/${wu}`} className="text-sm font-sans text-nav hover:underline block">
          ← #{wu}
        </Link>
        <div className="region-label">{firmness.label}</div>
        {hasStructure && effectiveLens === 'structure' && structureRail(data.structure, scrollToAnchor)}
        {effectiveLens === 'read' && hasStructure && structureRail(data.structure, scrollToAnchor)}
        {!hasStructure && (
          <div className="text-[11px] font-sans text-stone-400 leading-5">
            Read lens. This type carries no manifest-owned structure (or its headings changed shape).
          </div>
        )}
      </aside>

      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="px-10 py-6">
          <header className="mb-4 flex items-baseline gap-3">
            <h1 className="font-sans font-semibold text-lg">{data.path.split('/').pop()?.replace(/\.md$/, '')}</h1>
            <span className="text-[11px] font-sans text-stone-400 border border-stone-300 dark:border-stone-700 rounded px-1.5">
              {data.phase}
            </span>
            <div className="ml-auto">
              <LensTabs lens={effectiveLens} onLens={setLens} hasStructure={hasStructure} />
            </div>
          </header>

          {effectiveLens === 'history' ? (
            <div className="max-w-measure-wide">
              <HistoryTimeline timeline={history?.timeline ?? []} />
            </div>
          ) : (
            <>
              <div className="mb-3 space-y-2">
                {data.structure.kind === 'review' && (
                  <VerdictBanner content={data.content} sections={data.structure.sections} />
                )}
                {data.structure.kind === 'brief' && (
                  <BriefCard
                    sections={data.structure.sections}
                    workUnit={wu}
                    sessionLogHref={`/c/${wu}/a/discovery/sessions/session-001.md`}
                  />
                )}
                <WhatMovedRibbon moved={data.whatMoved} />
                {data.structure.claims.length > 0 && (
                  <div className="space-y-1">
                    <div className="region-label">Measured claims — copy to verify in a terminal</div>
                    {data.structure.claims.map((c, i) => (
                      <ClaimChip key={i} chip={c} verified={c.verified} />
                    ))}
                  </div>
                )}
              </div>
              {/* The Read lens is never squeezed below its 60ch minimum
                  measure (round-5); the rail collapses before the body does. */}
              <article className={`read-lens max-w-measure-wide min-w-measure ${firmness.cls}`}>
                <Markdown content={data.content} />
              </article>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

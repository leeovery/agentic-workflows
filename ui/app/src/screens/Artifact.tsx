// S5 · Artifact viewer — Phase 1 ships the Read lens only: typeset markdown
// with the firmness gradient as chrome, section anchors, minimum measure
// 60ch. Structure and History arrive with Phase 4.
import { useParams, Link } from 'react-router-dom';
import { api, useLive, type ArtifactData } from '../api';
import { Markdown } from '../components/Markdown';

const FIRMNESS: Record<string, { cls: string; label: string }> = {
  research: { cls: 'firmness-research', label: 'research — exploratory' },
  discussion: { cls: 'firmness-discussion', label: 'discussion — working record' },
  investigation: { cls: 'firmness-discussion', label: 'investigation — working record' },
  specification: { cls: 'firmness-specification', label: 'specification — the record' },
};

export function Artifact() {
  const { wu = '', '*': rest = '' } = useParams();
  const { data, error } = useLive<ArtifactData>(() => api.artifact(wu, rest), [wu, rest]);

  if (error) return <div className="p-8 font-sans text-sm text-blocked">{error}</div>;
  if (!data) return <div className="p-8 font-sans text-sm text-stone-400">…</div>;

  const firmness = FIRMNESS[data.phase] ?? { cls: 'firmness-discussion', label: data.phase };

  return (
    <div className="flex h-full">
      {/* S5 rail (replaces the context panel; typed content arrives P4). */}
      <aside className="w-56 shrink-0 border-r border-stone-200 dark:border-stone-800 p-4 space-y-3">
        <Link to={`/c/${wu}`} className="text-sm font-sans text-nav hover:underline block">
          ← #{wu}
        </Link>
        <div className="region-label">{firmness.label}</div>
        <div className="text-[11px] font-sans text-stone-400 leading-5">
          Read lens. Structure and history arrive with Phase 4.
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto">
        <div className="px-10 py-8">
          <header className="mb-6 flex items-baseline gap-3">
            <h1 className="font-sans font-semibold text-lg">{data.path.split('/').pop()?.replace(/\.md$/, '')}</h1>
            <span className="text-[11px] font-sans text-stone-400 border border-stone-300 dark:border-stone-700 rounded px-1.5">
              {data.phase}
            </span>
          </header>
          <article className={`read-lens max-w-measure-wide min-w-0 ${firmness.cls}`}>
            <Markdown content={data.content} />
          </article>
        </div>
      </div>
    </div>
  );
}

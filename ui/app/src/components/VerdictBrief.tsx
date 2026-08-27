// VerdictBanner + BriefCard (catalog: P4, intent 2) — review reports render
// verdict-first; briefs render three-panel, badged "regenerable — not a
// record". Both are derived from the artifact's own structure/content; nothing
// here executes anything.
import type { ArtifactStructure, StructureNode } from '../api';

// A review report's verdict comes from the template's stable `**Verdict**:
// Pass | Fail` line; the finding buckets are the report's own headings
// (structure.sections). Sourced from the report artifact only, never re-run.
export function VerdictBanner({ content, sections }: { content: string; sections?: StructureNode[] }) {
  const m = content.match(/\*\*Verdict\*\*:?\s*(Pass|Fail)/i);
  const verdict = m ? m[1]!.toLowerCase() : null;
  if (!verdict) return null;
  const fail = verdict === 'fail';
  const buckets = (sections ?? []).filter((s) =>
    /needs planning|corrected|out of scope|discarded|findings/i.test(s.label),
  );
  return (
    <div
      className={`rounded-md px-3 py-2 border-l-4 ${
        fail ? 'border-blocked bg-stone-100 dark:bg-stone-900' : 'border-ok bg-stone-100 dark:bg-stone-900'
      }`}
    >
      <div className={`text-sm font-sans font-medium ${fail ? 'text-blocked' : 'text-ok'}`}>
        Review: {fail ? 'fail — findings need action' : 'pass'}
      </div>
      {buckets.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-sans text-stone-500">
          {buckets.map((b) => (
            <a key={b.anchor} href={`#${b.anchor}`} className="hover:underline">
              {b.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// BriefCard (catalog: P4) — three panels (soft decisions / rejected paths /
// open questions), badged "regenerable — not a record", linking to the
// session log that IS the record.
// The brief's three panels are label-matched (soft decisions / rejected paths
// / open questions), not positional — a leading title heading won't misalign
// them. Falls back to the first three headings only if none match.
function briefPanels(sections: StructureNode[]): StructureNode[] {
  const want = [/soft decision|decision/i, /rejected|discarded|path/i, /open question|question|unknown/i];
  const matched = want.map((re) => sections.find((s) => re.test(s.label))).filter((s): s is StructureNode => !!s);
  return matched.length > 0 ? matched : sections.slice(0, 3);
}

export function BriefCard({
  sections,
  workUnit,
  sessionLogHref,
}: {
  sections: StructureNode[];
  workUnit: string;
  // The route to the session log that IS the record.
  sessionLogHref: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 dark:border-stone-800 p-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <BriefBadge />
        {/* The session log is the record — a brief is regenerated from it. */}
        <a href={sessionLogHref} className="text-[11px] text-nav hover:underline">
          the session log is the record →
        </a>
        <span className="text-[10px] text-stone-400">#{workUnit}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {briefPanels(sections).map((s) => (
          <a
            key={s.anchor}
            href={`#${s.anchor}`}
            className="block text-xs font-sans border border-stone-200 dark:border-stone-800 rounded px-2 py-1.5 hover:border-nav"
          >
            {s.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function BriefBadge() {
  return (
    <span className="font-sans text-[10px] rounded px-1.5 py-0.5 border border-stone-300 dark:border-stone-700 text-stone-400">
      regenerable — not a record
    </span>
  );
}

// Baseline docs render their observed / stated / open layers distinctly — the
// structure's heading sections carry the layer names.
export function isBaselineLayer(node: { label: string }): 'observed' | 'stated' | 'open' | null {
  const l = node.label.toLowerCase();
  if (l.includes('observed')) return 'observed';
  if (l.includes('stated')) return 'stated';
  if (l.includes('open')) return 'open';
  return null;
}

export function structureIsReview(s: ArtifactStructure): boolean {
  return s.kind === 'review';
}

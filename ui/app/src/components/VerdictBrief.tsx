// VerdictBanner + BriefCard (catalog: P4, intent 2) — review reports render
// verdict-first; briefs render three-panel, badged "regenerable — not a
// record". Both are derived from the artifact's own structure/content; nothing
// here executes anything.
import type { ArtifactStructure } from '../api';

// A review report's verdict is derived from its own heading structure (pass /
// fail) — best-effort, sourced from the report artifact only.
export function VerdictBanner({ content }: { content: string }) {
  const fail = /\b(fail|replan|spreading|blocked)\b/i.test(content.split('\n').slice(0, 8).join('\n'));
  const pass = /\b(pass|clean|no findings|nothing wrong)\b/i.test(content.split('\n').slice(0, 8).join('\n'));
  if (!fail && !pass) return null;
  return (
    <div
      className={`rounded-md px-3 py-2 text-sm font-sans border-l-4 ${
        fail ? 'border-blocked bg-stone-100 dark:bg-stone-900 text-blocked' : 'border-ok bg-stone-100 dark:bg-stone-900 text-ok'
      }`}
    >
      {fail ? 'Review: fail — findings need action' : 'Review: pass'}
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

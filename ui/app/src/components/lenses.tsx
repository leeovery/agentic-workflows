// The artifact lenses (S5, phase-4) — LensTabs, SourcesPanel, ClaimChip,
// MapRail, WhatMovedRibbon, plus the per-type rails. Nothing here executes
// anything found in an artifact; a claim chip copies its command, never runs it.
import { useState } from 'react';
import { clsx } from 'clsx';
import type { ArtifactStructure, StructureNode, ClaimChipData, WhatMovedData, HistoryEntry } from '../api';

export type Lens = 'read' | 'structure' | 'history';

// LensTabs (catalog: P4, intent 2) — Read/Structure/History. Structure is
// ABSENT on degradation, never an error tab.
export function LensTabs({
  lens,
  onLens,
  hasStructure,
}: {
  lens: Lens;
  onLens: (l: Lens) => void;
  hasStructure: boolean;
}) {
  const tab = (l: Lens, label: string) => (
    <button
      onClick={() => onLens(l)}
      className={clsx(
        'px-2.5 py-1 text-xs font-sans rounded',
        lens === l ? 'bg-stone-200 dark:bg-stone-800 text-nav font-medium' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300',
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-1" role="tablist">
      {tab('read', 'Read')}
      {hasStructure && tab('structure', 'Structure')}
      {tab('history', 'History')}
    </div>
  );
}

const STATUS_CLS: Record<string, string> = {
  incorporated: 'text-ok',
  decided: 'text-ok',
  pending: 'text-warn',
  stale: 'text-blocked',
  addressed: 'text-ok',
  exploring: 'text-stone-500',
  converging: 'text-nav',
  deferred: 'text-stone-400',
};

function StatusChip({ status }: { status?: string }) {
  if (!status) return null;
  return <span className={clsx('font-mono text-[10px]', STATUS_CLS[status] ?? 'text-stone-400')}>{status}</span>;
}

// SourcesPanel (catalog: P4, intent 2) — manifest-joined sources + consult
// references. A sign-off can't read "ready" while a consult reference is
// pending (the engine would refuse), so both are shown with equal weight.
export function SourcesPanel({
  sources,
  consult,
}: {
  sources?: StructureNode[];
  consult?: StructureNode[];
}) {
  if ((sources?.length ?? 0) === 0 && (consult?.length ?? 0) === 0) return null;
  return (
    <div className="space-y-3">
      {sources && sources.length > 0 && (
        <div>
          <div className="region-label mb-1">Sources</div>
          {sources.map((s) => (
            <div key={s.label} className="flex items-baseline justify-between text-sm font-sans">
              <span className="truncate">{s.label}</span>
              <StatusChip status={s.status} />
            </div>
          ))}
        </div>
      )}
      {consult && consult.length > 0 && (
        <div>
          <div className="region-label mb-1">Consult references</div>
          {consult.map((s) => (
            <div key={s.label} className="flex items-baseline justify-between text-sm font-sans">
              <span className="truncate">{s.label}</span>
              <StatusChip status={s.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ClaimChip (catalog: P4, intent 2, N5) — the recorded command and result,
// with a copy button. NO re-run: executing recorded shell from a browser is
// unsound; re-measurement lives in the product's own claims pass, in a session.
export function ClaimChip({ chip, verified }: { chip: ClaimChipData; verified?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(chip.command).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );
  };
  return (
    <div className="flex items-center gap-2 text-xs font-mono border border-stone-200 dark:border-stone-800 rounded px-2 py-1">
      <code className="text-stone-700 dark:text-stone-300">{chip.command}</code>
      {chip.result && <span className="text-stone-400">→ {chip.result}</span>}
      {verified !== undefined && (
        <span className={verified ? 'text-ok' : 'text-warn'} title="from the review report's claims pass">
          {verified ? '✓' : '?'}
        </span>
      )}
      <button onClick={copy} className="ml-auto text-nav hover:underline" title="copy to verify in a terminal">
        {copied ? 'copied' : 'copy'}
      </button>
    </div>
  );
}

// MapRail (catalog: P4, intent 2) — discussion subtopics from the manifest,
// pending → decided chips.
export function MapRail({ sections, onAnchor }: { sections: StructureNode[]; onAnchor: (a: string) => void }) {
  return (
    <div className="space-y-1">
      <div className="region-label mb-1">Subtopics</div>
      {sections.map((n) => (
        <button
          key={n.label}
          onClick={() => n.anchor && onAnchor(n.anchor)}
          disabled={!n.anchor}
          className="w-full flex items-baseline justify-between text-sm font-sans text-left hover:text-nav disabled:hover:text-inherit"
        >
          <span className="truncate">{n.label}</span>
          <StatusChip status={n.status} />
        </button>
      ))}
    </div>
  );
}

// A generic heading rail (investigation / review / spec body / brief).
export function HeadingRail({ sections, onAnchor }: { sections: StructureNode[]; onAnchor: (a: string) => void }) {
  return (
    <div className="space-y-0.5">
      {sections.map((n, i) => (
        <button
          key={`${n.anchor}-${i}`}
          onClick={() => n.anchor && onAnchor(n.anchor)}
          className={clsx(
            'block w-full text-left text-sm font-sans hover:text-nav truncate',
            n.detail === 'sub' ? 'pl-3 text-stone-500' : '',
          )}
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}

// WhatMovedRibbon (catalog: P4, intent 2) — an overlay chip that expands to the
// diff since the last read; epoch break renders "history rewritten — diff base
// lost". Never a fourth column.
export function WhatMovedRibbon({ moved }: { moved: WhatMovedData }) {
  const [open, setOpen] = useState(false);
  if (moved.state === 'none') return null;
  if (moved.state === 'lost') {
    return (
      <div className="banner-degraded text-xs">
        History rewritten — the diff base you last read is gone. Read again to reset it.
      </div>
    );
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-sans text-gate border border-gate/40 rounded px-2 py-0.5"
      >
        ▸ what moved since you last read this
      </button>
      {open && (
        <pre className="mt-1 engine-embed text-[11px] max-h-96 overflow-auto whitespace-pre">{renderDiff(moved.diff)}</pre>
      )}
    </div>
  );
}

function renderDiff(diff: string): string {
  // Trim the git header noise; keep the hunks.
  const idx = diff.indexOf('@@');
  return idx >= 0 ? diff.slice(diff.lastIndexOf('\n', idx) + 1) : diff;
}

// HistoryTimeline — the file's commit timeline (History lens).
export function HistoryTimeline({ timeline }: { timeline: HistoryEntry[] }) {
  if (timeline.length === 0) return <div className="text-sm font-sans text-stone-400">no committed history for this file yet</div>;
  return (
    <ol className="space-y-2">
      {timeline.map((e) => (
        <li key={e.sha} className="text-sm font-sans flex items-baseline gap-3">
          <code className="font-mono text-xs text-stone-400 shrink-0">{e.sha.slice(0, 8)}</code>
          <span className="truncate">{e.subject}</span>
          <time className="ml-auto text-xs text-stone-400 shrink-0">
            {new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </time>
        </li>
      ))}
    </ol>
  );
}

export function structureRail(structure: ArtifactStructure, onAnchor: (a: string) => void) {
  if (structure.kind === 'discussion') return <MapRail sections={structure.sections} onAnchor={onAnchor} />;
  if (structure.kind === 'specification')
    return (
      <div className="space-y-4">
        <SourcesPanel sources={structure.sources} consult={structure.consultReferences} />
        {structure.sections.length > 0 && (
          <div>
            <div className="region-label mb-1">Contents</div>
            <HeadingRail sections={structure.sections} onAnchor={onAnchor} />
          </div>
        )}
      </div>
    );
  return <HeadingRail sections={structure.sections} onAnchor={onAnchor} />;
}

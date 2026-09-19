// The lane mini-extractor (phase-3 §1) — reads the lane of each finding from a
// background-agent report's markdown in the gitignored cache. The engine's own
// vocabulary: apply / decide / route are the fixed batched lanes; ANY other
// name — a caller-specific walked-lane name like "ask", or no lane at all — is
// walk (the product's safe direction). A parse failure on a PRESENT file is
// walk too; ENOENT is not a parse failure (spec 5).
import fs from 'node:fs';

export type Lane = 'apply' | 'decide' | 'route' | 'walk';
export const BATCHED_LANES = ['apply', 'decide', 'route'] as const;

export type LaneExtract = {
  present: boolean;
  parsed: boolean;
  counts: Record<Lane, number>;
  /** True when any finding lands in the walk lane (drives push ceremony). */
  hasWalk: boolean;
};

const EMPTY: LaneExtract = {
  present: false,
  parsed: false,
  counts: { apply: 0, decide: 0, route: 0, walk: 0 },
  hasWalk: false,
};

export function normalizeLane(raw: string): Lane {
  const l = raw.trim().toLowerCase();
  return (BATCHED_LANES as readonly string[]).includes(l) ? (l as Lane) : 'walk';
}

/** Parse a report's markdown text into per-lane finding counts. */
export function extractLanes(markdown: string): LaneExtract {
  const counts: Record<Lane, number> = { apply: 0, decide: 0, route: 0, walk: 0 };
  // Findings are `### F1: …` (or `#### …`) sections each carrying a
  // `**Lane:** {name}` line. Count a finding per Lane line; a finding heading
  // with no Lane line following it before the next heading is walk.
  const lines = markdown.split('\n');
  let inFinding = false;
  let laneForCurrent: Lane | null = null;
  let sawAnyFinding = false;

  const closeFinding = () => {
    if (inFinding) {
      counts[laneForCurrent ?? 'walk'] += 1;
    }
    inFinding = false;
    laneForCurrent = null;
  };

  for (const line of lines) {
    // Individual findings are level-3+ headings (`### F1: …`); level-2
    // headings are section containers (`## Gaps Identified`), never findings.
    if (/^#{3,4}\s+\S/.test(line)) {
      closeFinding();
      inFinding = true;
      sawAnyFinding = true;
      continue;
    }
    // A new level-2 container closes any open finding.
    if (/^#{1,2}\s+\S/.test(line)) closeFinding();
    const lane = line.match(/^\*\*Lane:\*\*\s*(.+)$/i);
    if (lane && inFinding) laneForCurrent = normalizeLane(lane[1]!);
    // A findings-summary "None identified." with no finding headings parses
    // cleanly to zero.
  }
  closeFinding();

  const hasWalk = counts.walk > 0;
  return { present: true, parsed: sawAnyFinding || /none identified|no findings/i.test(markdown), counts, hasWalk };
}

/** Read a report file; ENOENT → not present (not a parse failure). */
export function readReportLanes(path: string): LaneExtract {
  let text: string;
  try {
    text = fs.readFileSync(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { ...EMPTY };
    // A present-but-unreadable file degrades toward the human (walk).
    return { present: true, parsed: false, counts: { apply: 0, decide: 0, route: 0, walk: 1 }, hasWalk: true };
  }
  try {
    return extractLanes(text);
  } catch {
    return { present: true, parsed: false, counts: { apply: 0, decide: 0, route: 0, walk: 1 }, hasWalk: true };
  }
}

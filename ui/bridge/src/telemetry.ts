// Loop telemetry (phase-5 §1) — one manifest-sourced progress surface per
// implementation topic. Every datum traces to specs/telemetry-source-inventory.md;
// nothing is scraped from a transcript. Updates replace, never append to the
// spine (the anti-firehose rule). `engine task` is format-blind and manifest-
// side, so this needs no format adapter (corrected premise G10).
import type { StoredEvent } from './store.js';

export type Consolidation = {
  gated: boolean; // consolidation_gate_mode present and not 'auto'
  bank: unknown[]; // banked cross-scope opportunities
  staging: Record<string, unknown[]>; // staging.p{N} — gated tasks per phase
  consolidatedPhases: string[];
};

export type TopicTelemetry = {
  topic: string;
  status: string;
  currentPhase: string | null;
  currentTask: string | null;
  completedPhases: string[];
  completedTasks: string[];
  fixAttempts: number;
  analysisCycles: number;
  depBlocked: { topic: string; reason?: string }[];
  consolidation: Consolidation;
  commitsLanded: { sha: string; subject: string }[];
  agentsActive: number;
};

type Manifest = Record<string, any>;

/** Build the telemetry for one implementation topic from the manifest + store. */
export function buildTelemetry(
  workUnit: string,
  topic: string,
  manifest: Manifest | null,
  depBlocked: { topic: string; reason?: string }[],
  events: StoredEvent[],
  agentsActive: number,
): TopicTelemetry | null {
  const item = manifest?.phases?.implementation?.items?.[topic];
  if (!item) return null;

  const gateMode = item.consolidation_gate_mode;
  // The real staging shape is `staging.{cycle}.tasks.{n} = <decision>`
  // (fields.cjs) — NOT an array. Flatten each cycle's task decisions to a
  // list the surface can render.
  const staging: Record<string, unknown[]> = {};
  for (const [cycle, v] of Object.entries<any>(item.staging ?? {})) {
    if (Array.isArray(v)) {
      staging[cycle] = v; // tolerate the array form CLAUDE.md documents too
    } else if (v && typeof v.tasks === 'object') {
      staging[cycle] = Object.entries<any>(v.tasks).map(([n, decision]) => ({ task: n, decision }));
    }
  }

  const commits = events
    .filter((e) => e.type === 'commit.landed' && ((e.payload as any).scope ?? []).includes(workUnit))
    .map((e) => ({ sha: String((e.payload as any).sha).slice(0, 8), subject: (e.payload as any).subject as string }));

  return {
    topic,
    status: item.status ?? 'in-progress',
    currentPhase: item.current_phase != null && item.current_phase !== '~' ? String(item.current_phase) : null,
    currentTask: typeof item.current_task === 'string' && item.current_task ? item.current_task : null,
    completedPhases: Array.isArray(item.completed_phases) ? item.completed_phases.map(String) : [],
    completedTasks: Array.isArray(item.completed_tasks) ? item.completed_tasks.map(String) : [],
    fixAttempts: Number.isFinite(item.fix_attempts) ? Number(item.fix_attempts) : 0,
    analysisCycles: Number.isFinite(item.analysis_cycle_total) ? Number(item.analysis_cycle_total) : 0,
    depBlocked,
    consolidation: {
      gated: gateMode !== undefined && gateMode !== 'auto',
      bank: Array.isArray(item.bank) ? item.bank : [],
      staging,
      consolidatedPhases: Array.isArray(item.consolidated_phases) ? item.consolidated_phases.map(String) : [],
    },
    commitsLanded: commits,
    agentsActive,
  };
}

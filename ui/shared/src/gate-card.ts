// Gate-card schema — implements ui/plans/specs/gate-card-schema.md.
// Provisional until the end-of-Phase-2 freeze.
import { z } from 'zod';
import { Address } from './events.js';

export const GateKind = z.enum([
  'menu',
  'confirm',
  'batch-screen',
  'walk-raise',
  'stop-notice',
  'pass-through',
]);
export type GateKind = z.infer<typeof GateKind>;

export const GateState = z.enum([
  'detected',
  'open',
  'answering',
  'resolved',
  'resolved-externally',
  'stale',
  'orphaned',
]);
export type GateState = z.infer<typeof GateState>;

export const GateOption = z.object({
  key: z.string(),
  word: z.string().optional(),
  label: z.string(),
  recommended: z.boolean(),
  form: z.enum(['cmd', 'prompt', 'range']),
  range: z.tuple([z.number().int(), z.number().int()]).optional(),
});
export type GateOption = z.infer<typeof GateOption>;

export const GateCard = z
  .object({
    id: z.string().regex(/^[0-9a-f]{16}$/),
    kind: GateKind,
    gateType: z.string().optional(),
    source: z.enum(['tool-result', 'relay', 'prose']),
    session: z.object({
      bridgeSessionId: z.string(),
      askOrdinal: z.number().int().nonnegative(),
    }),
    address: Address,
    surface: z.string().optional(),
    context: z.string(),
    question: z.string().optional(),
    options: z.array(GateOption),
    freeText: z.literal(true),
    confirm: z.enum(['tap', 'typed']),
    relayDiverged: z.boolean().optional(),
    comments: z.object({ unread: z.number().int().nonnegative() }).optional(),
    openedAt: z.string(),
    state: GateState,
    resolution: z
      .object({
        answer: z.string(),
        via: z.enum(['ui', 'mcp', 'external']),
        at: z.string(),
      })
      .optional(),
  })
  .refine((c) => c.options.filter((o) => o.recommended).length <= 1, 'at most one recommended option')
  .refine(
    (c) => c.surface !== undefined || c.source !== 'tool-result' || c.kind === 'pass-through',
    'tool-result sourced structured cards carry the engine section name',
  );
export type GateCard = z.infer<typeof GateCard>;

// Never-auto recognition (spec 1 §never-auto) — single-sourced HERE, nowhere else.
// Replaced by an upstream STAYS_GATED_SURFACES export when/if it lands (UPSTREAM.md #3).
// Surface names provisional until the Phase 2 sweep verifies them against render.cjs.
export const NEVER_AUTO_SURFACES = [
  'MENU: incoherence conflict',
  'MENU: incoherence gap',
  'MENU: incoherence held doc',
  'MENU: resurface gate',
] as const;

export const NEVER_AUTO_LABEL_PATTERNS: readonly RegExp[] = [
  /cancel .*--cascade/,
  /permanently delete/i,
];

// The suspicion heuristic — an unrecognised surface matching this defaults to
// typed confirm, never to one tap. Direction of error is always toward more ceremony.
export const NEVER_AUTO_SUSPICION = /(discard|overwrite|permanently|cascade|delete .* git|sign[- ]off)/i;

// Surface → policy gateType mapping (spec 1) — verified and extended during
// Phase 2's surface sweep; provisional entries only until then.
export const SURFACE_GATE_TYPES: Record<string, string> = {
  'MENU: task approval': 'task-loop',
  'MENU: fix direction': 'task-loop',
  'MENU: incoherence conflict': 'conflict',
};

// Session-journal record shapes — spec 2 (session lifecycle) / spec 4 (fixtures).
// One JSON object per line; fixture transcripts are journals with a world attached.
import { z } from 'zod';

export const JournalMeta = z.object({
  record: z.literal('meta'),
  bridgeSessionId: z.string(),
  productVersion: z.string().optional(),
  width: z.number().int().positive(),
  entryPrompt: z.string(),
  recordedAt: z.string(),
});

export const JournalAssistant = z.object({
  record: z.literal('assistant'),
  text: z.string(),
  ts: z.string().optional(),
});

export const JournalToolUse = z.object({
  record: z.literal('tool-use'),
  tool: z.string(),
  id: z.string().optional(),
  input: z.unknown(),
  ts: z.string().optional(),
});

export const JournalToolResult = z.object({
  record: z.literal('tool-result'),
  tool: z.string().optional(),
  id: z.string().optional(),
  // Demarcated engine sections arrive verbatim in this text.
  text: z.string(),
  ts: z.string().optional(),
});

export const JournalUser = z.object({
  record: z.literal('user'),
  text: z.string(),
  ts: z.string().optional(),
});

export const JournalUsage = z.object({
  record: z.literal('usage'),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  ts: z.string().optional(),
});

export const JournalTurnEnd = z.object({
  record: z.literal('turn-end'),
  turn: z.number().int().nonnegative(),
  // Present when ask detection fired — absent in Phase 0 fixtures until the
  // Phase 2 parser's offline re-parse pass adds it (spec 4).
  ask: z.object({ gateId: z.string(), kind: z.string() }).optional(),
  ts: z.string().optional(),
});

export const JournalResult = z.object({
  record: z.literal('result'),
  outcome: z.enum(['completed', 'error', 'interrupted']),
  error: z.string().optional(),
  ts: z.string().optional(),
});

export const JournalRecord = z.discriminatedUnion('record', [
  JournalMeta,
  JournalAssistant,
  JournalToolUse,
  JournalToolResult,
  JournalUser,
  JournalUsage,
  JournalTurnEnd,
  JournalResult,
]);
export type JournalRecord = z.infer<typeof JournalRecord>;

// fixtures/{name}/meta.json — spec 4 layout.
export const FixtureMeta = z.object({
  productVersion: z.string(),
  recordedAt: z.string(),
  width: z.number().int().positive(),
  entryPrompt: z.string(),
  description: z.string(),
  moments: z.array(z.object({ gateId: z.string(), world: z.string() })),
});
export type FixtureMeta = z.infer<typeof FixtureMeta>;

export const FixtureAnswers = z.record(
  z.object({ answer: z.string(), matchMode: z.enum(['exact', 'key']) }),
);
export type FixtureAnswers = z.infer<typeof FixtureAnswers>;

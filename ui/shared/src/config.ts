// Bridge config file schema — phase-0 §5 (packaging, discovery, config).
import { z } from 'zod';

export const ProjectConfig = z.object({
  // Absolute path to the project root (the directory containing .workflows/).
  root: z.string(),
  // Engine discovery override; default is
  // <root>/.claude/skills/workflow-engine/scripts/ (phase-0 §5).
  enginePath: z.string().optional(),
});
export type ProjectConfig = z.infer<typeof ProjectConfig>;

export const NotificationConfig = z.object({
  enabled: z.boolean().default(true),
  // Quiet hours per spec 5 — pushes accrue and fire as one morning roll-up.
  quietHours: z
    .object({ start: z.string().default('22:00'), end: z.string().default('08:00') })
    .default({ start: '22:00', end: '08:00' }),
  escalationMinutes: z.number().int().positive().default(15),
  rollupMinutes: z.number().int().positive().default(10),
});

export const BridgeConfig = z.object({
  projects: z.array(ProjectConfig).default([]),
  // Every engine invocation pins this width — renders are terminal-width-sensitive.
  displayWidth: z.number().int().positive().default(65),
  notifications: NotificationConfig.default({}),
  port: z.number().int().positive().default(4870),
  // Daily session cost budget warning, USD (spec 2 lifecycle rules).
  dailyBudgetUsd: z.number().positive().optional(),
});
export type BridgeConfig = z.infer<typeof BridgeConfig>;

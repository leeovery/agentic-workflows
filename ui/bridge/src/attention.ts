// The attention policy (phase-3 §1, implementing specs/needs-you-ordering.md).
// Pure decision: given a pending item and the current activity/time context,
// return a ceremony level. spec 5 is authoritative; this is its table in code.
import type { GateKind } from '@workflow-ui/shared';
import type { LaneExtract } from './lanes.js';

export type Ceremony = 'push' | 'alert' | 'badge' | 'digest' | 'none';

export type ActivityContext = {
  appConnected: boolean; // WebSocket up + interaction within 90s
  engagedThread: boolean; // focused on THIS row's topic thread
  inGrace: boolean; // left this row's session within T_grace
  quietHours: boolean; // within the configured quiet window
};

/**
 * app-connected downgrades a would-be push to an alert (an open UI is never
 * OS-pushed). Quiet-hours accrual is NOT applied here — it is the notifier's
 * job, so a batch `digest` (badge + digest, never an OS push) is never
 * confused with a quiet-hours-deferred push (which the morning roll-up fires).
 */
function apply(level: Ceremony, ctx: ActivityContext): Ceremony {
  if (level === 'push' && ctx.appConnected) return 'alert';
  return level;
}

/**
 * Laned findings (background-agent surfacing). A report LANDING is the trigger;
 * a walk-lane (or unlabelled/unknown) finding pushes ONCE, at report-landing —
 * per-finding pushes are banned. apply/decide/route only → badge + digest.
 */
export function findingCeremony(lanes: LaneExtract, ctx: ActivityContext): Ceremony {
  // Parse failure on a present file already resolved to hasWalk in the
  // extractor (safe direction).
  if (lanes.hasWalk) return apply('push', ctx);
  const batched = lanes.counts.apply + lanes.counts.decide + lanes.counts.route;
  if (batched > 0) return 'digest'; // badge is universal; digest carries it
  return 'badge';
}

/**
 * Laneless gates — by card kind + the surface→type mapping (spec 5 table).
 * `escalated` overrides everything to a push (a stopped session is spent
 * attention nothing is buying).
 */
export function gateCeremony(
  kind: GateKind,
  gateType: string | undefined,
  confirm: 'tap' | 'typed',
  ctx: ActivityContext & { escalated: boolean; blocksWithNothingElse: boolean },
): Ceremony {
  if (ctx.escalated) return apply('push', ctx);
  // The always-push kinds fire regardless of engagement (never-auto ceremony).
  if (confirm === 'typed') return apply('push', ctx);
  if (gateType === 'consult' || gateType === 'replan' || gateType === 'signoff') return apply('push', ctx);
  if (gateType === 'conflict' || gateType === 'lifecycle') {
    return ctx.blocksWithNothingElse ? apply('push', ctx) : 'badge';
  }
  // Engaged with this thread → a conversational ask needs no ceremony at all
  // (spec 5: "conversational ask, human engaged with that thread → none").
  if (ctx.engagedThread && (kind === 'pass-through' || kind === 'menu' || kind === 'confirm')) {
    return 'none';
  }
  switch (kind) {
    case 'batch-screen':
      return 'digest'; // badge + digest; never pings on open (escalation applies)
    case 'menu':
    case 'confirm':
    case 'pass-through':
    case 'stop-notice':
    case 'walk-raise':
      // bootstrap / routing / shaping / task-loop asks: badge; push only via
      // escalation. In-drain walk raises are in-card turns, never a push.
      return 'badge';
    default:
      return 'badge';
  }
}

/** Every row badges; this is only the "does it also do more" decision. */
export function isPushLike(c: Ceremony): boolean {
  return c === 'push' || c === 'alert';
}

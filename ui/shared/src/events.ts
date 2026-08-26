// Event vocabulary — implements ui/plans/specs/EVENTS.md.
// Provisional until the end-of-Phase-2 freeze.
import { z } from 'zod';

export const Address = z.object({
  workUnit: z.string().optional(),
  topic: z.string().optional(),
  phase: z.string().optional(),
});
export type Address = z.infer<typeof Address>;

// Envelope per spec 3: durable events carry seq and never `live`;
// live events carry `live: true` and never seq.
const envelopeBase = {
  id: z.string().regex(/^[0-9a-f]{16}$/),
  epoch: z.string(),
  ts: z.string(),
  project: z.string(),
  address: Address,
};

const durable = { seq: z.number().int().nonnegative(), live: z.undefined().optional() };
const layerRefine = (e: { seq?: number; live?: true }) =>
  e.live === true ? e.seq === undefined : e.seq !== undefined;
const LAYER_MSG = 'durable events carry seq and no live flag; live events carry live:true and no seq';

const event = <T extends string, P extends z.ZodTypeAny>(type: T, payload: P) =>
  z
    .object({
      ...envelopeBase,
      seq: z.number().int().nonnegative().optional(),
      live: z.literal(true).optional(),
      type: z.literal(type),
      payload,
    })
    .refine(layerRefine, LAYER_MSG);

export const WorkUnitCreated = event('workunit.created', z.object({ workType: z.string(), name: z.string() }));
export const WorkUnitRemoved = event('workunit.removed', z.object({ successor: z.string().optional() }));
export const WorkUnitStatusChanged = event(
  'workunit.status-changed',
  z.object({ from: z.string(), to: z.string() }),
);
export const PhaseCompleted = event('phase.completed', z.object({ phase: z.string(), topic: z.string() }));
export const PhaseItemChanged = event(
  'phase.item-changed',
  z.object({ phase: z.string(), topic: z.string(), from: z.string(), to: z.string() }),
);
const flagPayload = z.object({
  phase: z.string(),
  topic: z.string(),
  kind: z.string(),
  upstream: z.string().optional(),
});
export const FlagInputMoved = event('flag.input-moved', flagPayload);
export const FlagCleared = event('flag.cleared', flagPayload);
const derivedPayload = z.object({ topic: z.string(), holders: z.array(z.string()) });
export const DerivedSpecBlocked = event('derived.spec-blocked', derivedPayload);
export const DerivedDepBlocked = event('derived.dep-blocked', derivedPayload);
export const SourceStateChanged = event(
  'source.state-changed',
  z.object({ topic: z.string(), source: z.string(), to: z.string() }),
);
export const BuildOrderChanged = event(
  'buildorder.changed',
  z.object({ ordering: z.array(z.object({ topic: z.string(), order: z.number().int() })) }),
);
export const CommitLanded = event(
  'commit.landed',
  z.object({ sha: z.string(), subject: z.string(), scope: z.array(z.string()) }),
);
export const ArtifactUpdated = event('artifact.updated', z.object({ path: z.string(), hash: z.string() }));
export const TriageChanged = event(
  'triage.changed',
  z.object({ phase: z.string(), topic: z.string(), count: z.number().int().nonnegative() }),
);
const agentPayload = z.object({ agentType: z.string(), id: z.string() });
export const AgentDispatched = event('agent.dispatched', agentPayload);
export const AgentReturned = event('agent.returned', agentPayload);
export const CommentAdded = event(
  'comment.added',
  z.object({ gateId: z.string().optional(), artifact: z.string().optional(), author: z.string() }),
);
export const PresenceChanged = event('presence.changed', z.object({ rows: z.array(z.unknown()) }));
export const InboxChanged = event(
  'inbox.changed',
  z.object({ counts: z.record(z.number().int().nonnegative()) }),
);
export const RoadmapChanged = event('roadmap.changed', z.object({ items: z.number().int().nonnegative() }));
export const GateOpened = event('gate.opened', z.object({ card: z.unknown() }));
export const GateAnswered = event('gate.answered', z.object({ gateId: z.string(), via: z.string() }));
export const GateResolved = event('gate.resolved', z.object({ gateId: z.string(), via: z.string() }));
export const SessionStarted = event(
  'session.started',
  z.object({ address: Address, sdkSessionId: z.string().optional() }),
);
export const SessionEnded = event(
  'session.ended',
  z.object({ address: Address, sdkSessionId: z.string().optional() }),
);
export const DigestEmitted = event(
  'digest.emitted',
  z.object({ channel: z.string(), itemCounts: z.record(z.number().int().nonnegative()) }),
);

export const DomainEvent = z.discriminatedUnion('type', [
  // discriminatedUnion needs the inner object; refine wrappers are applied per-event above,
  // so the union re-validates layer discipline itself below.
  WorkUnitCreated.innerType(),
  WorkUnitRemoved.innerType(),
  WorkUnitStatusChanged.innerType(),
  PhaseCompleted.innerType(),
  PhaseItemChanged.innerType(),
  FlagInputMoved.innerType(),
  FlagCleared.innerType(),
  DerivedSpecBlocked.innerType(),
  DerivedDepBlocked.innerType(),
  SourceStateChanged.innerType(),
  BuildOrderChanged.innerType(),
  CommitLanded.innerType(),
  ArtifactUpdated.innerType(),
  TriageChanged.innerType(),
  AgentDispatched.innerType(),
  AgentReturned.innerType(),
  CommentAdded.innerType(),
  PresenceChanged.innerType(),
  InboxChanged.innerType(),
  RoadmapChanged.innerType(),
  GateOpened.innerType(),
  GateAnswered.innerType(),
  GateResolved.innerType(),
  SessionStarted.innerType(),
  SessionEnded.innerType(),
  DigestEmitted.innerType(),
]).refine(layerRefine, LAYER_MSG);

export type DomainEvent = z.infer<typeof DomainEvent>;

// The channel spine renders exactly this set (plus gates); everything else
// feeds threads, the drawer, digests, badges. (EVENTS.md "spine function".)
export const SPINE_EVENT_TYPES = [
  'phase.completed',
  'workunit.status-changed',
  'workunit.removed',
] as const;

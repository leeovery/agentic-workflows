// The manifest-diff → event derivation table (specs/EVENTS.md). Pure: two
// snapshots in, events out. The same function serves both layers — the caller
// supplies the discriminant tail (commit sha for durable, nonce for live) and
// the layer marker; ids are sha256(type, addressKey, discriminant)[0..16].
import crypto from 'node:crypto';
import type { Snapshot, Manifest } from './snapshot.js';

export type Ctx = {
  project: string;
  epoch: string;
  ts: string;
  disc: string; // introducing commit sha (durable) or bridge-local nonce (live)
  live?: true;
};

export type RawEvent = {
  id: string;
  epoch: string;
  live?: true;
  ts: string;
  project: string;
  type: string;
  address: { workUnit?: string; topic?: string; phase?: string };
  payload: Record<string, unknown>;
};

export function eventId(type: string, address: RawEvent['address'], discriminant: string): string {
  const addressKey = `${address.workUnit ?? ''}/${address.topic ?? ''}/${address.phase ?? ''}`;
  return crypto.createHash('sha256').update(`${type}\n${addressKey}\n${discriminant}`).digest('hex').slice(0, 16);
}

function mk(
  ctx: Ctx,
  type: string,
  address: RawEvent['address'],
  payload: Record<string, unknown>,
  discriminant: string,
): RawEvent {
  const e: RawEvent = {
    id: eventId(type, address, discriminant),
    epoch: ctx.epoch,
    ts: ctx.ts,
    project: ctx.project,
    type,
    address,
    payload,
  };
  if (ctx.live) e.live = true;
  return e;
}

type Item = { status?: string; reconcile_needed?: string; order?: number; [k: string]: unknown };

function items(manifest: Manifest, phase: string): Record<string, Item> {
  const p = manifest?.phases?.[phase];
  if (!p?.items || typeof p.items !== 'object') return {};
  return p.items as Record<string, Item>;
}

function phaseNames(...manifests: (Manifest | undefined)[]): string[] {
  const s = new Set<string>();
  for (const m of manifests) for (const k of Object.keys(m?.phases ?? {})) s.add(k);
  return [...s];
}

// sources / consult_references rows, normalised to name → row regardless of
// the manifest's array-or-object storage.
function sourceRows(item: Item): Record<string, { status?: string; kind: string }> {
  const out: Record<string, { status?: string; kind: string }> = {};
  const add = (kind: string, raw: unknown) => {
    if (!raw) return;
    if (Array.isArray(raw)) {
      for (const r of raw as any[]) {
        const name = r?.topic ?? r?.name;
        if (name) out[`${kind}:${name}`] = { status: r?.status ?? r?.incorporated, kind };
      }
    } else if (typeof raw === 'object') {
      for (const [name, r] of Object.entries(raw as Record<string, any>)) {
        out[`${kind}:${name}`] = { status: r?.status ?? r?.incorporated, kind };
      }
    }
  };
  add('source', item.sources);
  add('consult', item.consult_references);
  return out;
}

export function deriveEvents(prev: Snapshot, next: Snapshot, ctx: Ctx): RawEvent[] {
  const events: RawEvent[] = [];
  const unitNames = new Set([...Object.keys(prev.units), ...Object.keys(next.units)]);

  for (const name of unitNames) {
    const p = prev.units[name]?.manifest;
    const n = next.units[name]?.manifest;

    if (!p && n) {
      events.push(
        mk(ctx, 'workunit.created', { workUnit: name }, { workType: n.work_type ?? 'unknown', name }, `${name}+${ctx.disc}`),
      );
    }
    if (p && !n) {
      // Successor inferred from the same diff: absorb → an epic topic bearing
      // the unit's name appears in the same commit; promotion → a unit created
      // in the same commit. Epoch-unchanged is the caller's guard (a branch
      // switch re-baselines instead of diffing).
      const payload: Record<string, unknown> = {};
      for (const [other, snap] of Object.entries(next.units)) {
        if (other === name) continue;
        if (!prev.units[other]) {
          payload.successor = other;
          break;
        }
        for (const phase of ['discovery', 'discussion', 'research']) {
          if (items(snap.manifest, phase)[name] && !items(prev.units[other]!.manifest, phase)[name]) {
            payload.successor = `${other}/${name}`;
            break;
          }
        }
        if (payload.successor) break;
      }
      events.push(mk(ctx, 'workunit.removed', { workUnit: name }, payload, `${name}+${ctx.disc}`));
    }

    if (p && n && p.status !== n.status) {
      events.push(
        mk(
          ctx,
          'workunit.status-changed',
          { workUnit: name },
          { from: p.status ?? 'unknown', to: n.status ?? 'unknown' },
          `${n.status}+${ctx.disc}`,
        ),
      );
    }

    // Per-phase item transitions + flags + sources + build order.
    if (n) diffUnit(events, ctx, name, p, n);

    // Derived views (engine-computed, attached by the snapshot builder).
    const pd = prev.units[name]?.derived;
    const nd = next.units[name]?.derived;
    if (pd || nd) diffDerived(events, ctx, name, pd, nd);
  }

  // Artifacts — discriminant is path.hash per the table (no commit sha).
  for (const [pth, hash] of Object.entries(next.artifacts)) {
    if (prev.artifacts[pth] !== hash) {
      const wu = pth.startsWith('.') ? undefined : pth.split('/')[0];
      events.push(mk(ctx, 'artifact.updated', wu ? { workUnit: wu } : {}, { path: pth, hash }, `${pth}.${hash}`));
    }
  }

  // Triage — both sources (queue listing + triaged stub) are folded into the
  // snapshot's triage map; any count change (including appear/disappear) emits.
  const triageKeys = new Set([...Object.keys(prev.triage), ...Object.keys(next.triage)]);
  for (const key of triageKeys) {
    const before = prev.triage[key];
    const after = next.triage[key];
    if (before === after) continue;
    const [wu, phase, topic] = key.split('/');
    const count = after ?? 0;
    events.push(
      mk(ctx, 'triage.changed', { workUnit: wu, topic, phase }, { phase, topic, count }, `${phase}.${topic}.${count}+${ctx.disc}`),
    );
  }

  // Inbox — content-hashed counts.
  const inboxChanged = JSON.stringify(sortObj(prev.inbox)) !== JSON.stringify(sortObj(next.inbox));
  if (inboxChanged) {
    const hash = crypto.createHash('sha256').update(JSON.stringify(sortObj(next.inbox))).digest('hex').slice(0, 12);
    events.push(mk(ctx, 'inbox.changed', {}, { counts: next.inbox }, `${hash}+${ctx.disc}`));
  }

  // Roadmap — project-manifest node diff.
  const pr = prev.registry?.roadmap;
  const nr = next.registry?.roadmap;
  if (JSON.stringify(pr ?? null) !== JSON.stringify(nr ?? null)) {
    const itemCount = Object.keys(nr?.items ?? {}).length;
    const hash = crypto.createHash('sha256').update(JSON.stringify(nr ?? null)).digest('hex').slice(0, 12);
    events.push(mk(ctx, 'roadmap.changed', {}, { items: itemCount }, `${hash}+${ctx.disc}`));
  }

  return events;
}

function diffUnit(events: RawEvent[], ctx: Ctx, name: string, p: Manifest | undefined, n: Manifest): void {
  for (const phase of phaseNames(p, n)) {
    const before = p ? items(p, phase) : {};
    const after = items(n, phase);
    const topics = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const topic of topics) {
      const b = before[topic];
      const a = after[topic];
      const address = { workUnit: name, topic, phase };

      // Status transitions.
      const from = b?.status ?? 'none';
      const to = a?.status ?? 'removed';
      if (from !== to) {
        if (to === 'completed') {
          events.push(mk(ctx, 'phase.completed', address, { phase, topic }, `${phase}.${topic}+${ctx.disc}`));
        } else {
          events.push(
            mk(ctx, 'phase.item-changed', address, { phase, topic, from, to }, `${phase}.${topic}.${to}+${ctx.disc}`),
          );
        }
      }

      // reconcile_needed appears/disappears.
      const bf = b?.reconcile_needed;
      const af = a?.reconcile_needed;
      if (bf !== af) {
        if (af !== undefined) {
          events.push(
            mk(ctx, 'flag.input-moved', address, { phase, topic, kind: 'reconcile', upstream: af }, `${phase}.${topic}.reconcile+${ctx.disc}`),
          );
        } else {
          events.push(
            mk(ctx, 'flag.cleared', address, { phase, topic, kind: 'reconcile', ...(bf !== undefined ? { upstream: bf } : {}) }, `${phase}.${topic}.reconcile+${ctx.disc}`),
          );
        }
      }

      // Source / consult-reference rows: state changes, plus stale rows as
      // flag events ("stale source rows likewise" — the table's flag row).
      const bs = b ? sourceRows(b) : {};
      const as_ = a ? sourceRows(a) : {};
      const srcKeys = new Set([...Object.keys(bs), ...Object.keys(as_)]);
      for (const sk of srcKeys) {
        const sb = bs[sk]?.status;
        const sa = as_[sk]?.status;
        if (sb === sa) continue;
        const srcName = sk.split(':').slice(1).join(':');
        if (sa !== undefined) {
          events.push(
            mk(ctx, 'source.state-changed', address, { topic, source: srcName, to: sa }, `${topic}.${srcName}.${sa}+${ctx.disc}`),
          );
        }
        if (sa === 'stale') {
          events.push(
            mk(ctx, 'flag.input-moved', address, { phase, topic, kind: 'stale-source', upstream: srcName }, `${phase}.${topic}.stale:${srcName}+${ctx.disc}`),
          );
        } else if (sb === 'stale') {
          events.push(
            mk(ctx, 'flag.cleared', address, { phase, topic, kind: 'stale-source', upstream: srcName }, `${phase}.${topic}.stale:${srcName}+${ctx.disc}`),
          );
        }
      }
    }
  }

  // Build order — the specification items' order fields as one ordering.
  const ordering = (m: Manifest | undefined) =>
    Object.entries(m ? items(m, 'specification') : {})
      .filter(([, it]) => typeof it.order === 'number')
      .map(([topic, it]) => ({ topic, order: it.order as number }))
      .sort((x, y) => x.order - y.order);
  const bo = ordering(p);
  const no = ordering(n);
  if (JSON.stringify(bo) !== JSON.stringify(no) && no.length > 0) {
    const hash = crypto.createHash('sha256').update(JSON.stringify(no)).digest('hex').slice(0, 12);
    events.push(mk(ctx, 'buildorder.changed', { workUnit: name }, { ordering: no }, `${hash}+${ctx.disc}`));
  }
}

function diffDerived(
  events: RawEvent[],
  ctx: Ctx,
  name: string,
  pd: { specBlocked: { name: string; by: string[] }[]; depBlocked: { name: string; holders: string[] }[] } | undefined,
  nd: typeof pd,
): void {
  const key = (rows: { name: string; by?: string[]; holders?: string[] }[] | undefined, topic: string) =>
    rows?.find((r) => r.name === topic);
  for (const [type, get] of [
    ['derived.spec-blocked', (d: NonNullable<typeof pd>) => d.specBlocked.map((r) => ({ name: r.name, holders: r.by }))],
    ['derived.dep-blocked', (d: NonNullable<typeof pd>) => d.depBlocked],
  ] as const) {
    const before = pd ? get(pd) : [];
    const after = nd ? get(nd) : [];
    const topics = new Set([...before.map((r) => r.name), ...after.map((r) => r.name)]);
    for (const topic of topics) {
      const b = key(before, topic);
      const a = key(after, topic);
      if (JSON.stringify(b ?? null) === JSON.stringify(a ?? null)) continue;
      const state = a ? 'blocked' : 'unblocked';
      events.push(
        mk(
          ctx,
          type,
          { workUnit: name, topic },
          { topic, holders: (a as any)?.holders ?? [] },
          `${topic}.${state}+${ctx.disc}`,
        ),
      );
    }
  }
}

function sortObj(o: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

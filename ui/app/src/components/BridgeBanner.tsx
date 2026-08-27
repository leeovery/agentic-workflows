// BridgeBanner (catalog: 0/2, N5) — degraded states, a CLOSED list extended
// whenever any spec adds a degradation. One banner per cause.
export type BannerCause =
  | 'version-skew'
  | 'pending-migrations'
  | 'read-only-mirror'
  | 'bridge-unreachable'
  | 'live-only';

const COPY: Record<BannerCause, (detail?: string) => string> = {
  'version-skew': (d) => `Product version outside the bridge's supported range${d ? ` — ${d}` : ''}. Read-only.`,
  'pending-migrations': (d) =>
    `This project has pending migrations${d ? ` (${d})` : ''} — run /workflow-start in a terminal session to migrate. Read-only until then.`,
  'read-only-mirror': (d) => `Another bridge is driving this project${d ? ` from ${d}` : ''} — this one mirrors, read-only.`,
  'bridge-unreachable': () => 'The bridge is unreachable — showing the last known state.',
  'live-only': () => 'Incomplete git history (shallow/partial clone) — live view only, no durable spine.',
};

export function causesFromHealth(h: {
  bridgeMode: string;
  version: { supported: boolean; pendingMigrations: string[]; shallow: boolean };
  bannerReasons?: string[];
}): { cause: BannerCause; detail?: string }[] {
  const causes: { cause: BannerCause; detail?: string }[] = [];
  if (!h.version.supported) causes.push({ cause: 'version-skew' });
  if (h.version.pendingMigrations.length > 0) {
    causes.push({ cause: 'pending-migrations', detail: `${h.version.pendingMigrations.length} pending` });
  }
  if (h.bridgeMode === 'live-only') causes.push({ cause: 'live-only' });
  // The lease-lost read-only mirror — its reason string names the host.
  const mirror = (h.bannerReasons ?? []).find((r) => /read-only mirror/.test(r));
  if (mirror) {
    const host = mirror.match(/from (\S+)/)?.[1];
    causes.push({ cause: 'read-only-mirror', detail: host });
  }
  return causes;
}

export function BridgeBanner({ cause, detail }: { cause: BannerCause; detail?: string }) {
  return (
    <div className="banner-degraded" role="status" data-cause={cause}>
      {COPY[cause](detail)}
    </div>
  );
}

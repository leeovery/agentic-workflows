// The app frame (spec 6): project rail · active surface · context panel.
// Phase 1 is the read-only mirror — the palette navigates, nothing acts.
import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { api, useLive, type Health, type LobbyData, type QueueRowData } from './api';
import { BridgeBanner, causesFromHealth } from './components/BridgeBanner';
import { Lobby } from './screens/Lobby';
import { Channel } from './screens/Channel';
import { Artifact } from './screens/Artifact';
import { Queue } from './screens/Queue';
import { SessionThread } from './screens/SessionThread';
import { Roadmap } from './screens/Roadmap';
import { Palette } from './Palette';

// Storage and matchMedia can be absent or throwing (privacy modes, test
// environments) — the theme must still resolve.
function safeStorage(op: () => string | null): string | null {
  try {
    return op();
  } catch {
    return null;
  }
}

function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(() => {
    const stored = safeStorage(() => localStorage.getItem('theme'));
    if (stored) return stored === 'dark';
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    safeStorage(() => (localStorage.setItem('theme', dark ? 'dark' : 'light'), null));
  }, [dark]);
  return [dark, () => setDark((d) => !d)];
}

export default function App() {
  const { data: health } = useLive<Health>(() => api.health());
  const { data: lobby } = useLive<LobbyData>(() => api.lobby());
  const { data: queue } = useLive<{ rows: QueueRowData[] }>(() => api.queue());
  const [dark, toggleTheme] = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [bridgeSeenAt, setBridgeSeenAt] = useState(Date.now());

  // Report focus for time-based, thread-scoped suppression (spec 5). The
  // focused thread is derived from the route (/s/:id maps to no topic here;
  // /c/:wu is the channel). Health polling doubles as the watchdog heartbeat.
  useEffect(() => {
    const channel = location.pathname.match(/^\/c\/([^/]+)/)?.[1] ?? null;
    // A genuine interaction (navigating here counts) re-arms escalation and
    // records focus. The heartbeat only keeps app-connected fresh — and only
    // while the tab is VISIBLE, so a backgrounded tab neither suppresses a
    // push nor re-arms a stuck gate (round-9 finding).
    api.reportActivity(channel, true);
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') api.reportActivity(channel, false);
    }, 60_000);
    const onInteract = () => api.reportActivity(channel, true);
    const onVis = () => document.visibilityState === 'visible' && api.reportActivity(channel, true);
    window.addEventListener('pointerdown', onInteract, { passive: true });
    window.addEventListener('keydown', onInteract);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (health) setBridgeSeenAt(Date.now());
  }, [health]);
  // Watchdog: if health hasn't refreshed within 90s, the bridge may be down.
  const [bridgeStale, setBridgeStale] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => setBridgeStale(Date.now() - bridgeSeenAt > 90_000), 15_000);
    return () => clearInterval(iv);
  }, [bridgeSeenAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const units: { name: string; type: string }[] = [];
  if (lobby && !lobby.empty && lobby.detail) {
    for (const [group, type] of Object.entries({
      epics: 'epic',
      features: 'feature',
      bugfixes: 'bugfix',
      quick_fixes: 'quick-fix',
      cross_cutting: 'cross-cutting',
    })) {
      for (const u of lobby.detail[group]?.work_units ?? []) units.push({ name: u.name, type });
    }
  }
  const durableCounts = lobby && !lobby.empty ? lobby.durable.counts : {};

  return (
    <div className="flex h-screen">
      {/* Project rail */}
      <nav className="w-56 shrink-0 border-r border-stone-200 dark:border-stone-800 flex flex-col p-3 gap-1">
        <div className="font-sans font-semibold text-sm px-2 pb-2 text-stone-800 dark:text-stone-200">
          {health?.project ?? 'workflow bridge'}
        </div>
        <NavLink to="/lobby" className={({ isActive }) => `rail-link ${isActive ? 'rail-link-active' : ''}`}>
          Lobby
        </NavLink>
        <NavLink to="/queue" className={({ isActive }) => `rail-link ${isActive ? 'rail-link-active' : ''}`}>
          Queue
          {/* Badges are DERIVED, never counted separately: this is the queue's
              own row count; the gold dot = at least one live-tier gate. */}
          <span className="ml-auto flex items-center gap-1.5">
            {(queue?.rows ?? []).some((r) => r.tier === 'live') && (
              <span className="w-1.5 h-1.5 rounded-full bg-gate" title="a gate is open" />
            )}
            {(queue?.rows.length ?? 0) > 0 && (
              <span className="text-[10px] font-mono rounded-full bg-stone-300 dark:bg-stone-700 px-1.5">
                {queue!.rows.length}
              </span>
            )}
          </span>
        </NavLink>
        <NavLink to="/roadmap" className={({ isActive }) => `rail-link ${isActive ? 'rail-link-active' : ''}`}>
          Roadmap
        </NavLink>
        <div className="region-label px-2 pt-3 pb-1">Channels</div>
        {units.map((u) => (
          <NavLink
            key={u.name}
            to={`/c/${u.name}`}
            className={({ isActive }) => `rail-link ${isActive ? 'rail-link-active' : ''}`}
          >
            <span className="truncate">#{u.name}</span>
            <span className="ml-auto flex items-center gap-1">
              {(() => {
                // A channel badge = that channel's queue-row count (the same
                // derivation as /queue — never a second counter).
                const n = (queue?.rows ?? []).filter((r) => r.address.workUnit === u.name).length;
                const live = (queue?.rows ?? []).some((r) => r.address.workUnit === u.name && r.tier === 'live');
                return (
                  <>
                    {live && <span className="w-1.5 h-1.5 rounded-full bg-gate" />}
                    {n > 0 && (
                      <span className="text-[10px] font-mono rounded-full bg-stone-300 dark:bg-stone-700 px-1.5">
                        {n}
                      </span>
                    )}
                  </>
                );
              })()}
            </span>
          </NavLink>
        ))}
        {units.length === 0 && <div className="px-2 text-xs text-stone-400 font-sans">no active work</div>}
        <div className="mt-auto flex items-center justify-between px-2 pt-3 border-t border-stone-200 dark:border-stone-800">
          <button onClick={toggleTheme} className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">
            {dark ? 'light' : 'dark'}
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
          >
            ⌘K
          </button>
        </div>
      </nav>

      {/* Active surface */}
      <main className="flex-1 overflow-y-auto">
        {bridgeStale && <BridgeBanner cause="bridge-unreachable" />}
        {health &&
          causesFromHealth(health).map((c) => <BridgeBanner key={c.cause} cause={c.cause} detail={c.detail} />)}
        <Routes>
          <Route path="/" element={<Navigate to="/lobby" replace />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/s/:id" element={<SessionThread />} />
          <Route path="/c/:wu" element={<Channel />} />
          <Route path="/c/:wu/a/*" element={<Artifact />} />
        </Routes>
      </main>

      <Palette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        units={units}
        onNavigate={(to) => {
          setPaletteOpen(false);
          navigate(to);
        }}
      />
    </div>
  );
}

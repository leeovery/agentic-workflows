// The app frame (spec 6): project rail · active surface · context panel.
// Phase 1 is the read-only mirror — the palette navigates, nothing acts.
import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { api, useLive, type Health, type LobbyData } from './api';
import { BridgeBanner, causesFromHealth } from './components/BridgeBanner';
import { Lobby } from './screens/Lobby';
import { Channel } from './screens/Channel';
import { Artifact } from './screens/Artifact';
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
  const [dark, toggleTheme] = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();

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
        <div className="region-label px-2 pt-3 pb-1">Channels</div>
        {units.map((u) => (
          <NavLink
            key={u.name}
            to={`/c/${u.name}`}
            className={({ isActive }) => `rail-link ${isActive ? 'rail-link-active' : ''}`}
          >
            <span className="truncate">#{u.name}</span>
            <span className="ml-auto flex items-center gap-1">
              {(durableCounts[u.name] ?? 0) > 0 && (
                <span className="text-[10px] font-mono rounded-full bg-stone-300 dark:bg-stone-700 px-1.5">
                  {durableCounts[u.name]}
                </span>
              )}
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
        {health &&
          causesFromHealth(health).map((c) => <BridgeBanner key={c.cause} cause={c.cause} detail={c.detail} />)}
        <Routes>
          <Route path="/" element={<Navigate to="/lobby" replace />} />
          <Route path="/lobby" element={<Lobby />} />
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

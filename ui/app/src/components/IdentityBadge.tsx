// Phase 6 §1 — who you are, in the rail. Single-user is zero-config: it shows
// "You" and offers nothing to log into. github mode shows your login and
// membership, with a minimal login affordance (the full OAuth redirect flow is
// deployment wiring — see REVIEW.md round 12; this verifies real push access).
import { useState } from 'react';
import { api, useLive } from '../api';

export function IdentityBadge() {
  const { data, reload } = useLive(() => api.whoami());
  const [loggingIn, setLoggingIn] = useState(false);
  const [login, setLogin] = useState('');
  const [note, setNote] = useState<string | null>(null);

  if (!data) return null;
  if (data.mode === 'single') {
    return <span className="text-xs font-sans text-stone-400">You</span>;
  }

  const human = data.human;
  const authed = human.id !== 'anonymous';

  const doLogin = async () => {
    if (login.trim() === '') return;
    const res = await api.login(login.trim());
    setNote(res.error ?? res.warning ?? null);
    if (!res.error) {
      setLoggingIn(false);
      setLogin('');
      reload();
    }
  };

  return (
    <div className="text-xs font-sans">
      {authed ? (
        <div className="flex items-center gap-1.5">
          <span className="text-stone-500">{human.name}</span>
          {human.member ? (
            <span className="text-ok" title="push access to the origin repo">member</span>
          ) : (
            <span className="text-warn" title="no push access to the origin repo">watcher</span>
          )}
          <button
            onClick={() => {
              void api.logout().then(reload);
            }}
            className="text-stone-400 hover:text-stone-600"
          >
            sign out
          </button>
        </div>
      ) : loggingIn ? (
        <div className="flex flex-col gap-1">
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doLogin()}
            placeholder="github login"
            className="rounded border border-stone-300 dark:border-stone-700 bg-transparent px-2 py-0.5 text-xs"
          />
          {note && <span className="text-warn">{note}</span>}
          <div className="flex gap-2">
            <button onClick={doLogin} className="text-nav hover:underline">verify</button>
            <button onClick={() => setLoggingIn(false)} className="text-stone-400">cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setLoggingIn(true)} className="text-nav hover:underline">
          sign in with GitHub
        </button>
      )}
    </div>
  );
}

# Investigation: Session Rename Orphans Resume Hook

## Symptoms

### Problem Description

**Expected behavior:**
After renaming a tmux session with `tmux rename-session`, the session's Portal
resume hook should remain intact so that on the next reboot the session resumes
what was running (not a bare shell).

**Actual behavior:**
Renaming a tmux session silently orphans its Portal resume hook. The session
keeps running fine, but after the next restart it comes back as a bare shell
instead of resuming.

### Manifestation

- No error, no warning at rename time — the failure is silent.
- The session keeps running normally; nothing looks wrong until a reboot.
- On reboot the renamed session resurrects as a bare shell instead of resuming
  the inner process.
- Surfaces as a "didn't resume" case in partial-restore reports (e.g. 28 of 32
  sessions resuming).

### Reproduction Steps

1. Create a Portal session (generated name `{project}-{nanoid}`) with a resume
   hook registered (e.g. `portal hooks set --on-resume "..."`).
2. Rename the session — **either** trigger path orphans the hook identically:
   - external `tmux rename-session <new-name>`, **or**
   - Portal's own in-TUI rename modal (`r` key → `rename_modal.go` →
     `model.go:3222` `renameAndRefresh` → `tmux.RenameSession`), which does a
     bare rename + list refresh with **zero** hook re-keying.
   The inner process keeps running — it is **not** restarted.
3. Wait for the next bootstrap / orphan cleanup pass (or trigger one).
4. Reboot / restart the tmux server.
5. Observe: the renamed session comes back as a bare shell — hook gone.

**Reproducibility:** Always (per the seed's clean correlation).

### Environment

- **Affected environments:** Local (Portal's normal runtime).
- **Browser/platform:** macOS, tmux 3.6b.
- **User conditions:** Any session that has been renamed away from its generated
  nanoid name while carrying a resume hook.

### Impact

- **Severity:** Medium–High (silent data loss of resume config; affects an
  encouraged workflow).
- **Scope:** Any renamed session. Live evidence 2026-06-30: of 24 live sessions,
  exactly the two that had been renamed lost their hooks.
- **Business impact:** Trust — reboot resume silently drops work the user
  expects to come back.

### References

- Seed: `.workflows/session-rename-orphans-resume-hook/seeds/2026-06-30-session-rename-orphans-resume-hook.md`
- Discovery: `.workflows/session-rename-orphans-resume-hook/discovery/session-001.md`

### Live Evidence (captured 2026-06-30, this session)

`hooks.json` entries are `claude --resume <uuid>` commands — they are **not**
hand-registered by `portal hooks set`; they are written by an external Claude
Code SessionStart hook that calls `portal hooks set --on-resume` with the
session's **current** structural key at the moment claude starts. This timing is
load-bearing (see below).

**Confirmed orphans (seed's two):** live sessions `finder-v2` and
`agentic-workflows-refactor-wt` have no matching hook key; the original nanoid
keys (`finder-wlRUOm:1.1`, `agentic-workflows-vAKe79:1.1`) are absent from
`hooks.json` — deleted. History files still present (prune-on-missing-history
not involved). Matches the seed exactly.

**Live reproduction (user renamed several sessions mid-investigation):** four
hook keys became orphaned (no live session) while their renamed sessions live
on. Decoding the resume targets reveals two distinct outcomes — the key
discriminator the seed lacked:

| Old hook key (orphaned) | Worktree / resume uuid | New live session | New session has hook? |
|---|---|---|---|
| `portal-AusNIg:1.1` | portal / c9805093 | `portal-agent-first` | **NO — bug** |
| `portal-LoMivh:1.1` | portal / 015232aa | `portal-restore-terminal-windows` | **NO — bug** |
| `portal-2ohu9r:1.1` | skip-bootstrap / 648eb8f2 | `portal-skip-bootstrap-when-warm` | yes (new uuid 65b8…) |
| `portal-3lDxwH:1.1` | session-rename-… / c5c8bd41 | `portal-session-rename-orphans-resume-hook` (this session) | yes (new uuid 9d5a…) |

**Discriminator:** a rename orphans the hook **only when the inner claude
process does not restart**. Where claude restarted (rows 3–4), the SessionStart
hook re-registered under the new name with a *new* resume uuid, so the session
is safe; the old key is a benign leftover. Where claude kept running (rows 1–2),
nothing re-registers → the new-named session has no hook → bug.

**Deletion is deferred, not immediate:** immediately after the renames all four
orphaned keys were still present in `hooks.json` (no reboot/bootstrap had run).
So the orphaned key is not deleted at rename time — it is removed by a later
cleanup pass (bootstrap clean-stale / `portal clean` / daemon GC). Note this
means the bare-shell symptom does **not** strictly require the deletion: at
restore the session is recreated under its **new** saved name and the hydrate
helper looks up the **new** structural key, which never matched the old-name
hook key. The deletion only makes the loss permanent/unrecoverable.

---

## Analysis

### Initial Hypotheses

Suspected mechanism from discovery (to be **validated**, not assumed):

Resume hooks in `hooks.json` are keyed by the structural key
`session_name:window.pane` (`StructuralKeyFormat` in `internal/tmux/tmux.go`).
After a rename:

1. The session name changes but the inner pane process does not restart.
2. The stored hook key no longer matches the live pane's structural key.
3. Portal's stale-hook cleanup deletes the now-unmatched key (no live pane
   corresponds to it).
4. Because the inner process never restarted, nothing re-registers a hook under
   the new name.

Net: the hook is silently gone. Live correlation (2026-06-30): the only two
sessions of 24 missing hooks were the two renamed away from their generated
nanoid names; underlying history files still exist, so the prune-on-missing-
history path is **not** involved.

### Code Trace

**The hook identity is the mutable tmux session name.** The structural key
`session_name:window_index.pane_index` embeds the live session name. Every stage
that touches the hook computes this key from whatever the session is *currently*
called — and those stages run at different times, so a rename desynchronizes
them.

**Key format** — `internal/tmux/tmux.go:779`:
`StructuralKeyFormat = "#{session_name}:#{window_index}.#{pane_index}"`.
`tmux.PaneTarget(name, w, p)` builds the same `name:w.p` string.

**Stage 1 — Registration** (`cmd/hooks.go:60,103,118`): `portal hooks set
--on-resume` resolves the *current* pane's structural key via
`ResolveStructuralKey($TMUX_PANE)` (→ `display-message`, `tmux.go:323`) and
stores under it: `store.Set(structuralKey, "on-resume", cmd, "cli")`. In
practice these are written by an external Claude Code SessionStart hook, so the
key freezes the session name *at the moment claude starts*.

**Stage 2 — Capture** (`internal/state/capture.go:35` `captureFormat` reads live
`#{session_name}`): the daemon writes `sessions.json` with the session's
*current* (post-rename) name. No hook cleanup happens here — confirmed there is
no `CleanStale`/hooks reference in `cmd/state_daemon.go`.

**Stage 3 — Restore lookup** (`internal/restore/session.go:110`):
`hookKey: tmux.PaneTarget(sess.Name, w.Index, p.Index)` where `sess.Name` is the
saved (post-rename) name. `buildHydrateCommand` (`session.go:477`) bakes it into
`portal state hydrate --hook-key <new-name>:w.p`. The hydrate helper
(`cmd/state_hydrate.go:299` `hooks.LookupOnResume(store, cfg.HookKey)`) looks up
that **new-name** key — but the hook is stored under the **old-name** key →
**miss** → degrades to bare `$SHELL` (`state_hydrate.go:307`). This is the
proximate cause of the bare-shell symptom; it does not depend on the deletion.

**Stage 4 — Deletion** (`internal/hooks/store.go:249` `CleanStale(liveKeys)`):
removes any hook key not in `liveKeys`. `liveKeys` come from live panes
(`ListAllPanes`, structural keys = current/new names). The old-name key is not
among them → deleted. Callers: bootstrap **step 11** (`cmd/bootstrap_production.go`
→ `cmd/run_hook_stale_cleanup.go:120`) and `portal clean` (`cmd/clean.go:50`) —
both run on essentially every Portal bootstrap, so the orphaned old-name key is
removed at the next `portal` command after the rename. (Confirmed live: the four
orphaned keys persisted only because no bootstrap had run since the renames.)

**Why claude-restart sessions are immune:** if claude restarts after the rename
(e.g. bridge-mode context clear fires SessionEnd+SessionStart), the SessionStart
hook re-runs `portal hooks set` and re-registers under the *new* current name —
so registration-time name == capture/restore-time name and the key stays
addressable. The bug bites only when the inner process keeps running across the
rename.

### Root Cause

Portal keys per-pane resume hooks (and resolves them at capture, restore, and
cleanup) by the **mutable tmux session name** via the structural key
`session_name:window.pane`. Renaming a session (via external `tmux
rename-session` **or** Portal's own in-TUI rename modal) changes the name without
restarting the pane process, so the hook — registered under the old name and
never re-registered — becomes unaddressable: restore looks it up under the new
name (miss → bare shell) and stale-cleanup deletes the old-name entry (making the
loss permanent). There is no rename-aware re-keying path and no stable,
rename-immune pane identity.

Independently validated (synthesis-001, high confidence): all four stages verified
against the cited lines; the proximate cause (exact-key lookup miss) does not
depend on the deletion; the daemon does **not** clean hooks; and the
"base-index drift preservation" note in `restore/session.go` rescues only the
window/pane index segments, never the session-name segment.

### Contributing Factors

- **Structural key chosen for tmux-resurrect compatibility, now obsolete.** The
  2026-04-30 spec `resume-hooks-lost-on-server-restart` deliberately replaced
  ephemeral pane IDs with `session_name:window.pane` because that scheme survived
  tmux-resurrect restarts. Portal no longer uses tmux-resurrect — it owns
  save/restore end-to-end (`internal/restore`) — so the resurrect rationale that
  forced a name-based key no longer applies, but the name-based key remains.
- **Registration is external and timing-sensitive.** Hooks are written by a
  Claude Code SessionStart hook keyed to the live name at start; nothing
  re-registers on rename.
- **Cleanup is name-diff based.** `CleanStale` treats "no live pane with this
  key" as "stale", which a rename manufactures synthetically.
- **Silent by design.** Hook lookup miss and stale deletion are both
  intentionally silent (best-effort), so there is no user-visible signal.

### Why It Wasn't Caught

- The structural-key spec's stated assumption was survival across
  *resurrect/restart*; **rename was never in scope or considered.**
- The failure is invisible until a reboot, and only for sessions renamed *while a
  long-lived process keeps running* — a narrow, delayed condition.
- Renaming-then-restarting (the common case during normal claude usage / bridge
  mode) self-heals via re-registration, masking the bug in everyday use.
- No test exercises "rename a session, then restore" — tests cover
  restart-survival, not rename-survival.

### Blast Radius

**Directly affected:**
- Per-pane resume hooks (`hooks.json`) for any session renamed while its process
  keeps running → silent loss of reboot resume (bare shell). Both trigger paths
  affected: external `tmux rename-session` **and** Portal's first-party in-TUI
  rename modal (`model.go:3222`). The in-TUI path is **interceptable** (Portal
  controls it); the external path is not — a fix that only patches the in-TUI
  rename would leave external renames broken.

**Potentially affected (same mutable-name keying — verify in spec/fix):**
- `@portal-skeleton-*` / volatile markers keyed by structural key.
- `@portal-active-{structural_key}` markers (per the 2026-04-30 spec).
- `sessions.json` ↔ live-session matching is by structural identity
  (`capture.go:164` "session name, window index, pane index") — rename changes
  the identity used for delta detection.
- Any other subsystem that addresses panes by `session_name:window.pane` across
  a time gap spanning a possible rename.

---

## Fix Direction

### Chosen Approach

**Anchor resume hooks to a stable, rename-immune Portal session identity** —
stamp an immutable id at session creation as a tmux user-option (analogous to the
existing `@portal-dir`), and key hooks off `<stable-id>:window.pane` instead of
`<session-name>:window.pane`. The id is unaffected by `rename-session` and is
persisted/re-stamped across reboot by Portal's own save/restore (which it now
owns end-to-end).

**Deciding factor:** it is the only direction that closes **both** trigger paths
(external `tmux rename-session` *and* the in-TUI rename modal) at the root —
because nothing has to intercept the rename; the identity simply never changes.
It also requires **no change to the external Claude SessionStart hook** (it keeps
calling `portal hooks set`; Portal resolves the stable key internally) and reuses
a proven existing pattern (`@portal-dir`), so it sits naturally against the
codebase.

### Options Explored

1. **Stable Portal session identity (chosen).** Immutable `@portal-*` user-option
   stamped at creation; hook key uses it in place of the mutable name.
2. **Intercept-and-rekey on rename** — rewrite `hooks.json` keys old→new when a
   rename happens. *Rejected as primary:* only Portal's in-TUI rename is
   interceptable; external `tmux rename-session` is not (a tmux `session-renamed`
   hook is fragile and may not expose the old name), so the documented
   reproduction stays broken. Patches the symptom; leaves identity mutable.
3. **Drop per-pane structural addressing; key purely by session id** — *Rejected:*
   breaks multi-pane support (hooks are per-pane); collapses into option 1 once
   pane addressing is re-added.

### Discussion

- Discovery had already pointed at a "stable, rename-immune identity"; the user
  confirmed they like that direction. Investigation's job was to validate the
  mechanism and pressure-test the direction against the code.
- Synthesis validation widened the picture in two load-bearing ways that shaped
  the choice: (a) Portal's **own in-TUI rename** triggers the identical bug, so a
  fix that only intercepts Portal's rename is insufficient — this is what
  eliminated option 2 as the primary fix; (b) the realisation that Portal no
  longer depends on tmux-resurrect (owns save/restore) means it is free to choose
  any identity scheme — the resurrect compatibility that originally forced a
  name-based key is gone.
- Key constraints carried into spec (not decisions made here): hook-key **format
  is load-bearing** — changing it silently invalidates every existing
  `hooks.json` entry, so a migration or a deliberate "let it re-register" call is
  required; and **legacy sessions** created before the stamp ships need a fallback
  (lazy-derive like the dir fallback, or accept self-heal on next claude restart).

### Testing Recommendations

- New test: **rename a session, then run restore** → assert the resume hook still
  fires (the gap that currently has zero coverage). Cover both triggers (raw
  `tmux rename-session` and the in-TUI rename path).
- Test that the stable id **survives a reboot/restore cycle** (capture → restore
  re-stamps the same id) and that hook lookup keys off it.
- Test **legacy/unstamped** sessions degrade gracefully (no panic; fallback
  behaviour as specced).
- Guard against **multi-pane** regression: per-pane hooks remain independently
  addressable under the new key.
- If a migration ships: test old-format `hooks.json` entries are re-keyed/handled
  without mass-orphaning on upgrade.

### Risk Assessment

- **Fix complexity:** Medium — touches the hook key derivation at every stage
  (registration, capture/restore, cleanup), session creation stamping, and a
  migration/fallback for existing data.
- **Regression risk:** Medium — the hook-key format is shared across releases and
  multiple subsystems; a careless change can orphan all existing hooks (the very
  symptom under investigation) at scale. The stable-id approach is low-risk *to
  the rename case itself* but the format/migration surface needs care.
- **Recommended approach:** Regular release with an explicit migration/fallback
  plan; not a hotfix (architectural keying change, not a one-liner).

---

## Notes

- Distinct from the separate, parked SessionEnd-cleanup question (bare shells
  resurrecting Claude).
- **Assumption (not code-verified):** the "claude-restart self-heals" behaviour
  rests on Claude Code's SessionStart hook (outside this repo) re-running
  `portal hooks set` on restart. The re-registration code path is verified; the
  external trigger firing is observed, not provable from the codebase.
- **Fix constraint — hook-key format is load-bearing across releases**
  (`tmux.go:556-557`: "changing it would silently invalidate every entry in
  `hooks.json`"). Any re-keying / stable-identity scheme must either preserve
  format compatibility or ship a migration, or it will orphan every existing
  hook on upgrade — re-creating this exact symptom at scale.
- **Fix constraint — both trigger paths.** A stable, rename-immune identity must
  cover external `tmux rename-session` too, not only Portal's in-TUI rename
  (which alone is interceptable). This points away from "intercept rename and
  re-key" and toward an identity that does not embed the mutable name.
- Validation artifact: `.workflows/.cache/session-rename-orphans-resume-hook/investigation/session-rename-orphans-resume-hook/synthesis-001.md`

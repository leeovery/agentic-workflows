# Research: Built-in Session Resurrection

Portal should own the full session lifecycle: server start → session restoration → resume hook execution. Currently the middle step depends on tmux-resurrect/continuum, which doesn't work reliably.

## The Problem

Portal's resume hooks feature can restart processes in panes (e.g., `claude --resume <uuid>`), but it depends on the session structure already existing. That structure is supposed to be restored by tmux-resurrect/continuum after a reboot, but those plugins have never worked — not intermittently, but a 100% failure rate. Sessions simply don't come back. This means the resume feature is effectively broken end-to-end despite the code being correct.

The resume system also has an undocumented dependency on these plugins. Portal doesn't mention that you need resurrect/continuum installed for the resume workflow to function across reboots. This was a deliberate choice to avoid coupling to buggy plugins, but the result is a feature that silently doesn't work in the most important scenario (reboot recovery).

## What We Want

Reboot → open Portal → tmux server starts → all previous sessions/windows/panes/layouts are restored → selecting a session fires any registered resume hooks → seamless continuation.

Portal owns the full chain. No external plugin dependencies.

## Design Principles (Established)

**Portal's hook system is generic.** No awareness of what consumers do with it. Portal stores and fires a command string — it's the caller's responsibility to make that command correct. Claude-specific logic lives in the Claude hook script, not in Portal.

**Portal doesn't maintain a separate session registry.** It reads tmux directly via `list-sessions`. Resurrection follows the same pattern: capture everything tmux has, restore everything captured. Non-Portal sessions get structure restoration for free; Portal sessions additionally get resume hooks.

**Portal-only vs native tmux is a non-issue.** Since `list-panes -a` captures all sessions regardless of origin, and Portal's bootstrap starts the server, non-Portal sessions are captured naturally. No extra work to include them, extra work to exclude them. Verified in code: `ListSessions` (`internal/tmux/tmux.go:79`) runs `tmux list-sessions` with no filtering — raw tmux sessions already appear in Portal's session picker. Resurrection capturing everything is consistent with how Portal already works.

**Portal is always the entry point.** The user never starts tmux directly — always via Portal. This makes the bootstrap the natural and reliable place for restoration.

## Research Findings

### tmux State Capture & Restore APIs — FEASIBLE

Deep dive confirmed tmux provides everything needed:

**Capture:** `list-panes -a -F` with format variables gets session names, window indices, pane working directories, layout strings, active/zoom state in one call. Key variables verified against tmux source: `session_name`, `window_index`, `window_layout`, `window_zoomed_flag`, `pane_index`, `pane_current_path`, `pane_active`, `pane_current_command`.

Critical detail: `window_layout` returns the pre-zoom layout (correct for restoration). Use this, not `window_visible_layout`.

**Restore sequence (proven by resurrect):**
1. `new-session -d -s name -c dir` — also starts server if needed, no default "0" session problem
2. `new-window -d -t session:index -c dir`
3. `split-window -d -t session:window -c dir`
4. `select-layout -t session:window "layout_string"` — pane count must match exactly
5. `send-keys -t session:window.pane "command" C-m`
6. `select-pane`, `select-window` — restore focus
7. `resize-pane -Z` — restore zoom (must come after layout)

**Limitations:**
- `pane_current_command` returns short name only (no args). tmux maintainer explicitly rejected adding args. Not a problem for Portal — hooks store explicit commands.
- Layout strings are terminal-size dependent. Different terminal size at restore may shift proportions. Neither resurrect nor tmux solves this cleanly.
- Hooks don't fire on crash/SIGKILL — periodic saves needed as safety net.

### tmux Hooks for Save Triggers — AVAILABLE

tmux provides global hooks: `session-created`, `session-closed`, `window-linked`, `window-layout-changed`, etc. Registered via `set-hook -g`. Portal could register these during bootstrap to trigger saves.

`server-exit` hook exists but only in tmux HEAD (post Oct 2025). Workaround: `session-closed` with `if '[ #{server_sessions} -eq 0 ]'`.

### tmux-resurrect/continuum Failure Analysis

Deep dive into resurrect source confirmed why it fails:

**Continuum's auto-save** piggybacks on `status-right` interpolation. If any theme/plugin overwrites `status-right`, saving silently stops. #1 reported failure.

**Continuum's auto-restore** has a hardcoded 1-second sleep and 10-second server-age window. Plugin load timing causes race conditions.

**Save corruption:** 0-byte files written on save failure, `last` symlink points to empty file, no validation.

**Layout restoration:** `resize-pane -U 999` during creation causes transient broken states. ~20-30% failure rate for complex layouts.

**Process detection:** `ps -ao ppid,args` is fundamentally fragile (macOS issues, forked processes invisible, Node.js wrappers lose args).

Portal's architecture addresses all of these: atomic writes (no corruption), direct tmux Client (no bash parsing), event-driven saves (no status bar dependency), deterministic restore order, hooks instead of process detection.

### tmux-assistant-resurrect Analysis

A TPM plugin that piggybacks on resurrect/continuum, adding AI-assistant-specific session ID capture. Depends entirely on resurrect for structure — the exact dependency Portal eliminates.

**Worth noting:**
- Two-guard restore pattern (check shell running + no existing process before sending commands). Portal doesn't need this — it creates panes fresh during restoration, so nothing else is running. The guard is needed by assistant-resurrect because it piggybacks on resurrect which might have already sent commands via its own process list.
- CLI args preservation (stripping session args, keeping user flags). Not Portal's concern — the hook system is generic, and it's the caller's responsibility to register the correct resume command with all needed flags.

**Confirms Portal's advantages:** generic hook system, full lifecycle ownership, one-shot + re-registration model avoids stale session IDs.

### Shell Readiness After Pane Creation — SOLVABLE

After restoration creates panes, shells need time to initialize before resume commands can be sent via `send-keys`. Shell startup ranges from 5ms (bare bash) to 2-5s (heavy zsh configs with oh-my-zsh, nvm, pyenv).

**No existing tool has solved this well.** tmux-resurrect sends immediately (no delay). tmuxinator has a known bug with lost commands. tmuxp offers configurable fixed sleeps.

**Best available approach: capture-pane polling.** Poll `tmux capture-pane -p` every 50-100ms, looking for prompt characters (`$`, `%`, `>`, `❯`) on the last non-empty line. Timeout after 5s and send anyway (best-effort fallback). This adapts to actual shell speed rather than guessing with a fixed delay.

**Gotcha:** Powerlevel10k's "instant prompt" renders a fake prompt before zsh finishes loading. A 200ms minimum wait before starting to poll mitigates this.

**Future ideal:** tmux 3.5+ supports OSC 133 semantic prompt markers (shells signal "prompt displayed"), but tmux doesn't expose this via its API yet. If tmux ever adds a `#{pane_has_prompt}` format variable, that would be the gold standard.

### Restoration Timing in Bootstrap — CLEAR

Current flow: `PersistentPreRunE` → `EnsureServer()` → `WaitForSessions` (polls for sessions to appear, hoping resurrect/continuum populates them).

New flow: `PersistentPreRunE` → `EnsureServer()` → **Portal restores saved state directly** → sessions exist because Portal created them.

The `WaitForSessions` polling mechanism (`internal/tmux/wait.go`) becomes unnecessary in its current form. Portal doesn't need to poll and hope — it did the restoration itself and knows when it's done. The `bootstrapWait` function would be replaced/reworked to call restoration logic directly. The loading page still makes sense (restoration takes a moment) but the "poll and pray" step goes away.

### Hook Volatile Markers — COMPATIBLE AS-IS

The resume hook system's volatile markers (`@portal-active-<pane>` tmux server options) work correctly with restoration without changes:

1. Reboot → tmux server dies → markers lost (they're in-memory server options)
2. `portal open` → starts fresh server → restores session structure
3. User selects session → `ExecuteHooks` runs → no markers → hooks fire → markers set
4. User detaches/reattaches → markers exist → hooks correctly skip

Restoration only recreates structure. Hooks fire when a user *enters* a session (via `portal open`/`portal attach`), not during structural restoration. The marker design is already compatible.

## Topics for Discussion Phase

The following are design decisions, not open research questions. The technical feasibility is established — what remains is choosing between known options.

### Hook Lifecycle Redesign

Two viable models exist. Both are technically feasible:
- **One-shot:** Fire hook, remove it, rely on the resumed process to re-register. Works when the process has its own hook (e.g., Claude re-registers on resume).
- **Persistent:** Hook survives across reboots without re-registration. Useful for processes that don't self-register (e.g., a static `npm start` command).

Could be configurable per-hook. The current hook store structure (`map[structural_key]map[event]command`) supports both — it's a question of whether Portal removes the entry after firing.

### Save-Side Architecture

The research confirms the building blocks exist:
- **Trigger mechanism:** tmux global hooks (`set-hook -g`) can call `portal save-state` (or similar) on structural events. Periodic saves also needed as crash safety net (hooks don't fire on SIGKILL). Which specific events to hook, debouncing strategy, and whether the save runs in-process or spawns a Portal subprocess are design choices.
- **Format:** JSON, consistent with existing stores (`projects.json`, `hooks.json`). Schema design (fields per session/window/pane, single file vs per-session) is a spec-level detail.
- **Concurrency:** `AtomicWrite` prevents partial-write corruption. Concurrent read-modify-write races from rapid event-driven saves need debouncing or serialization — standard concurrency problem, not a research question.
- **Storage location:** `~/.config/portal/` alongside existing config files, resolved via the same `configFilePath` mechanism.

### Layout Restoration Reliability

Portal uses the same tmux primitives as resurrect (`split-window` then `select-layout`). The improvement comes from Go's deterministic execution and error handling vs bash's fragile string parsing, not a fundamentally different algorithm. Terminal dimension changes between save and restore are a tmux-level constraint that neither Portal nor any other tool can fully solve — `select-layout` does its best to fit the saved layout into the available space.

### Other Design Items for Discussion

- **Session naming / project store interaction:** Restored sessions carry their original names (`{project}-{nanoid}`). How this interacts with `projects.json` timestamps and mappings is a design question.
- **Environment variables / shell state:** tmux cannot capture shell-internal state (env vars, virtualenvs, nvm versions). This is a known limitation — same as resurrect. Portal's hook system could partially compensate (hooks that re-source environments) but that's the hook consumer's responsibility, not Portal's.
- **tmux version compatibility:** Minimum supported tmux version needs to be determined during planning. Core APIs (`list-panes -a -F`, `set-hook -g`, `select-layout`) have been available since tmux 2.6+. Shell readiness polling via `capture-pane -p` is also long-standing.
- **Ephemeral session opt-out:** Whether users should be able to mark sessions as "don't restore." Design decision — trivially implementable if desired.
- **`CleanStale` guard behavior change:** The existing guard skips cleanup when `livePanes` is empty (to avoid deleting hooks before resurrect restores). With Portal owning restoration, panes will always exist before hooks run. The guard's rationale changes — worth noting during implementation.

---

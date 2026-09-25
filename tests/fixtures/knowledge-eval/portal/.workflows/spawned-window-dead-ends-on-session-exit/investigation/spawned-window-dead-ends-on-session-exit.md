# Investigation: Spawned Window Dead-Ends on Session Exit

## Symptoms

### Problem Description

**Expected behavior:**
When a session running inside a burst-spawned host-terminal window exits (e.g. the
user quits Claude / the session detaches), the window should land back at a usable
interactive shell prompt — behaving "as if I opened Ghostty myself" — or close
cleanly. The same clean landing the *trigger* window gets.

**Actual behavior:**
The spawned (N−1 external) windows dead-end on tmux/terminal end-of-command text
when their session exits/detaches:

```
[detached (from session agentic-workflows-codify)]

Process exited. Press any key to close the terminal.
```

Pressing any key then closes the window. An awkward dead-end rather than a prompt.

### Manifestation

- Terminal shows `[detached (from session <name>)]` then `Process exited. Press any
  key to close the terminal.`
- Requires a keypress to dismiss.
- **Asymmetry is the key signal:** only the *spawned* N−1 burst windows show this.
  The trigger window (where the multi-selection happened) lands back at a normal
  shell prompt when its session exits.

### Reproduction Steps

1. In the TUI Sessions page, multi-select 2+ sessions (`m`) and Enter to dispatch a
   burst.
2. Burst opens N−1 external host-terminal (Ghostty) windows + reuses the trigger.
3. In one of the *spawned* windows, exit the process running in the session (quit
   Claude, or detach the session).
4. Observe: spawned window dead-ends on "Process exited. Press any key to close."
   The trigger window, by contrast, drops back to a shell prompt.

**Reproducibility:** Always (for spawned windows), per the report.

### Environment

- **Affected environments:** local (macOS)
- **Browser/platform:** macOS, Ghostty host terminal
- **User conditions:** Multi-select burst spawn (N≥2). Observed after the
  multi-window spawn feature started working (post recent patch).

### Impact

- **Severity:** Low (cosmetic/UX rough edge — no data loss)
- **Scope:** Anyone using multi-select burst spawn on the affected terminal
- **Business impact:** Spawned windows feel broken / half-finished on exit;
  inconsistent with the trigger window's clean landing.

### References

- Seed: `seeds/2026-07-17-spawned-window-dead-ends-on-session-exit.md` (inbox:bug,
  captured 2026-07-17)
- Discovery: `discovery/sessions/session-001.md`

---

## Analysis

### Initial Hypotheses

**Hypothesis carried from discovery/seed (a lead, NOT a confirmed cause):**
Each spawned window runs the burst-composed argv as the window's *sole* command,
with no surrounding interactive shell. The command `syscall.Exec`s (or otherwise
execs) into `tmux attach-session`, making the tmux client the window's one-and-only
process. When the session exits/detaches, the client returns, the window's command
is finished, and the terminal has nothing left to fall back to — hence "Process
exited. Press any key to close." The trigger window avoids this because portal was
launched there from an existing interactive login shell, so exiting attach returns
control to the parent shell and its prompt.

**Caveat to reconcile:** the seed/discovery notes describe the spawned command as
`portal attach <session> --spawn-ack …` and reference `cmd/attach.go` /
`AttachConnector`. Per current project docs, `portal attach` is retired — spawned
burst windows now run `portal open --session <name> --ack <batch>:<token>`. The
investigation must trace the *current* command composition and exec path, not the
historical one.

### Prior Context (knowledge base)

**`ghostty-spawn-zero-windows` (investigation + spec, 2026-07-16) — highly relevant.**
That fix rewrote the Ghostty adapter's AppleScript to the sdef-correct form:

```applescript
tell application "Ghostty"
	new window with configuration {command:"%s", wait after command:true}
end tell
```

The spec explicitly documents `wait after command:true` as intentional — *"keeps the
window up after its command exits, the normal-detach lifecycle for a spawned
session."* This is the strongest candidate for the mechanism producing "Process
exited. Press any key to close the terminal." — that is Ghostty's `wait-after-command`
end-of-command message. It also matches the seed's "observed after the multi-window
spawn feature started working (post recent patch)": this bug is a direct consequence
of that 2026-07-16 fix landing.

**`restore-host-terminal-windows` (spec, 2026-07-11) — adapter contract.** The spawn
layer *composes the command* and hands `{command}` to the adapter verbatim; the
adapter only opens a window running that command (`OpenWindow(command)`). So the fix
lever — if it's in the composed command rather than the terminal config — lives in
`internal/spawn` command composition, not in the adapter.

### Code Trace

**Confirmed:** the seed's `portal attach` references are stale. The current spawned
command is `portal open --session <name> --ack <batch>:<token>`. Everything else in
the seed's hypothesised mechanism holds.

**1. What the spawned window actually runs (command composition).**
`internal/spawn/command.go:47` `composeOpenArgv` builds, for an ATTACH surface, the
env-self-sufficient argv:

```
/usr/bin/env -u TMUX -u TMUX_PANE PATH=<path> <exePath> open --session <name> --ack <batch>:<token>
```

This is a **real argv, never shell syntax** (by design — it's substituted verbatim
into config-`terminals.json` recipes too). `renderCommandString`
(`internal/spawn/recipe.go:110`) POSIX-single-quotes each element and space-joins
them into the `{command}` string.

**2. How Ghostty runs it (the native adapter).**
`internal/spawn/ghostty.go:20-22` — the adapter opens the window via:

```applescript
tell application "Ghostty"
	new window with configuration {command:"<embedded>", wait after command:true}
end tell
```

Per the file's own comment (`ghostty.go:24-40`), Ghostty runs the `command` string via
`bash -c`, which word-splits it. So the window's root process is effectively
`bash -c "/usr/bin/env … <exe> open --session <name> --ack …"` — a **single**
non-interactive command with **no surrounding interactive shell**.

_(Inference, not repo-verified: whether `bash -c` exec-optimises the single command by
replacing itself, or fork/waits it, does not change the outcome — a `bash -c "<single
cmd>"` is non-interactive and terminates when its command terminates either way, so
there is nothing to fall back to. The `bash -c` wrapper itself is sourced from the
`ghostty.go` comment, not the Ghostty source, which is not in this repo.)_

**3. The exec into tmux (why nothing is left behind).**
`bash -c` → `env` → `portal open --session`. In `cmd/open.go`, `openResolved`
(`:360`) hits the `*resolver.SessionResult` arm, writes the ack marker
(`writeAckMarker`, `:369` — the LAST act before handoff), then calls
`openSessionFunc` → `AttachConnector.Connect` (`:107`). Outside tmux this builds
`["tmux","attach-session","-t","=<name>"]` (`:124`) and execs it via `ex.Exec` (`:131`)
→ production `realExecer.Exec` → `syscall.Exec` (`cmd/open.go:544`) — **replacing the
process image with the tmux client**. The tmux client is now the window's one-and-only
process. (Note: the spawned window is *always* outside tmux — `composeOpenArgv` strips
`TMUX`/`TMUX_PANE` — so a spawned `open` always takes this `AttachConnector` branch;
`SwitchConnector` is unreachable for it.)

**4. Session exit / detach → dead-end.**
When `tmux attach-session` returns (session detach — `[detached (from session …)]`,
tmux's own client-detach output — or session end), the exec'd process exits. `bash -c`
is done. Because the adapter set `wait after command:true`, Ghostty does **not** close
the window and does **not** drop to a shell — it holds the window awaiting a keypress:
**"Process exited. Press any key to close the terminal."** A keypress then closes the
window. This is the reported dead-end, verbatim.

_(Inference: attributing the exact "Process exited. Press any key…" string to Ghostty's
`wait after command:true` is unverifiable from this repo — no Ghostty source is present
— but it is unmistakably a wait-after-command end-of-command prompt, and the
`ghostty-spawn-zero-windows` spec describes that flag's purpose in exactly these terms.
The `[detached …]` line above it is confirmed tmux client-detach output.)_

**5. Why the trigger window is exempt (the asymmetry).**
The trigger window is **never spawned via the Ghostty adapter and never runs
`composeOpenArgv`**. It self-connects **in-process** from the already-running portal
process — a child of the user's **existing interactive login shell** (bare-shell →
`AttachConnector`/`syscall.Exec`; inside-tmux → `SwitchConnector`/`switch-client`).
When tmux exits, control returns to that parent interactive shell → prompt. The spawned
windows have no such parent: their root process is a one-shot `bash -c` that gets
replaced by the exec chain, so there is nothing to fall back to.

Confirmed for **both** burst entry points (they share the `AttachConnector` type and
the in-process parent-shell context):
- **`portal open` multi-target burst:** `cmd/open_burst_run.go:267` —
  `deps.Connector.Connect(trigger.Value)`.
- **Picker multi-select burst (the reported repro):** on the all-confirmed
  `spawnCompleteMsg`, `internal/tui/model.go:2525` sets `m.selected = m.burstTrigger`
  and quits → `processTUIResult` (`cmd/open.go:755`) → `connector.Connect`.

**Key files involved:**
- `internal/spawn/command.go` — `composeOpenArgv`, the spawned `open` argv (the
  single command with no shell fallback).
- `internal/spawn/ghostty.go` — `wait after command:true` (holds the dead window
  with the "Press any key" prompt instead of closing/dropping to a shell).
- `internal/spawn/recipe.go` — `renderCommandString`/`shellQuote` (the shared
  `{command}` rendering; also drives config adapters).
- `cmd/open.go` — `AttachConnector.Connect` `syscall.Exec` into tmux; `writeAckMarker`
  ordering (relevant to any fix: the ack must still be written before handoff).
- `cmd/open_burst_run.go` — trigger self-connect (the exempt path).

### Root Cause

The burst-spawned host window runs the spawned session's `portal open --session …`
argv as its **sole, one-shot root process** (via Ghostty's `bash -c "<command>"`),
with **no surrounding interactive shell to fall back to**. `portal open` `syscall.Exec`s
into `tmux attach-session`, so the tmux client *becomes* that root process. When the
session exits/detaches, the process exits and the window's command is finished — and
because the Ghostty adapter opens the window with **`wait after command:true`**, the
terminal holds the dead window and shows "Process exited. Press any key to close the
terminal." instead of returning to a prompt.

The trigger window is exempt purely because it self-attaches from an already-running
portal that is a child of the user's interactive login shell — so exiting the attach
returns to that shell's prompt. The spawned windows lack that parent context.

**Why this happens:** two design choices compose into the bug. (a) The spawned command
is a *single* `open` invocation with no shell wrapper — reasonable for a "run this exact
argv" contract, but it means the exec chain has no parent to return to. (b) The Ghostty
adapter sets `wait after command:true` (added by `ghostty-spawn-zero-windows`,
2026-07-16, described there as "the normal-detach window lifecycle for a spawned
session"), which converts "command finished" into a "Press any key" dead-end rather than
a clean close or a shell. Neither alone is the whole bug; together they produce the
dead-end. This also explains "observed after the multi-window spawn feature started
working (post recent patch)" — the `wait after command:true` fix is that patch.

### Contributing Factors

- **The spawned command is a single, one-shot argv with no shell fallback.** The
  `composeOpenArgv` contract is deliberately "a real argv, run verbatim" (so it drops
  cleanly into config-`terminals.json` recipes). That correctness for composition is
  exactly what leaves the exec chain (`bash -c` → env → portal → tmux) with no parent
  to return to.
- **`portal open` uses `syscall.Exec`, not fork/wait.** The tmux client *replaces* the
  process rather than running as a child, so there is no portal (or shell) frame left
  after tmux exits. Correct and intentional for the trigger/bare-shell case (returns to
  the parent shell); load-bearing only because the spawned window lacks that parent.
- **Ghostty `wait after command:true`.** Turns "command finished" into a keypress
  dead-end instead of a clean close. Introduced deliberately by
  `ghostty-spawn-zero-windows` (2026-07-16) as "the normal-detach window lifecycle."
- **The trigger vs spawned asymmetry is structural, not incidental.** The trigger is a
  child of an interactive login shell; the spawned windows are not. Any fix must add a
  parent/fallback to the spawned path without touching the (correct) trigger path.

### Why It Wasn't Caught

- **The osascript / Ghostty boundary has no automated coverage.** The only test that
  exercises real Ghostty is `//go:build manual` (per `ghostty-spawn-zero-windows`), so
  neither the unit nor integration lane observes what a spawned window does after its
  command exits.
- **The dead-end is a *post-exit lifecycle* behaviour, not a spawn failure.** The burst
  succeeds — windows open, acks land, `spawn: opened N/N`. The defect only appears
  later, when the user exits the session inside a spawned window — outside anything the
  spawn feature tests or logs observe.
- **Newly-composed behaviour.** `wait after command:true` was added days before the
  report; the interaction with the one-shot exec chain was never exercised end-to-end
  on a real Mac before shipping.

### Blast Radius

**Directly affected:**
- Every burst-spawned (N−1 external) window on the **native Ghostty adapter** — both
  the picker multi-select burst and the `portal open` multi-target burst route through
  the same `internal/spawn` composition + adapter.

**Not affected:**
- The **trigger** window (self-connects from the parent interactive shell — clean
  landing).
- **Single-session** `portal open`/attach (run from a shell, same as the trigger).
- Detection, pre-flight, ack channel, selection mutation — all correct; this is purely
  post-exit window lifecycle.

**Potentially affected (verify during fix):**
- **Config-`terminals.json` adapters** share `composeOpenArgv` / `renderCommandString`.
  Whether they dead-end depends on the user's terminal's post-command behaviour. A fix
  placed in composition (or in portal itself) would cover them; a Ghostty-adapter-only
  fix would not. Scope decision needed at findings review.

---

## Fix Direction

**User's desired outcome (from discovery, not yet a mechanism decision):** the spawned
window should behave "as if I opened Ghostty myself" — a standard interactive shell
(zsh) with the session launched into it, so exiting the session lands back at a normal
prompt. Closing cleanly is an acceptable fallback. The user explicitly deferred the
"is this possible / what's the standard approach" mechanism choice to this phase and
wants to weigh in.

### Chosen Approach (from findings-review discussion)

**A Ghostty-adapter-scoped shell fallback: the native Ghostty adapter composes its
window command as `bash -lc '<the composed open argv>; exec "$SHELL" -il'`, and
`wait after command` is dropped (no longer needed once a shell keeps the window
alive).** Custom `terminals.json` terminals are left untouched — how *their* window
ends is the user's own command/recipe's business.

**Deciding factor / model (user's framing):** Portal's job ends at "open a window
running this command." How the window behaves when the command ends is a property of
the command + terminal, not something Portal should centrally control. Under that
model, Portal should only shape end-of-window behaviour for the command it *authors*
(the native Ghostty adapter), and leave custom-terminal users in full control. This
retired Option A (below), which had Portal centrally intercept the process lifecycle
for *all* terminals — overreach under this model, and it would impose a shell fallback
even on custom-terminal users who may have deliberately chosen close-on-exit.

### Options Explored

**Chosen — Ghostty-adapter-scoped shell wrap (Option B, correctly scoped).** Wrap ONLY
in the native Ghostty adapter's command, not in the shared `composeOpenArgv` /
`renderCommandString`. Scoping is the whole point: a wrap in *shared* composition would
re-leak shell syntax into `terminals.json` `{command}` (the very custom-terminal
contract breakage the user rejected). Scoped to the adapter, only Portal's own Ghostty
command changes.
- Native Ghostty is a terminal Portal controls the invocation of, so a shell wrap is
  safe there; it isn't safe as a shared-composition change (see rejected B-shared).
- Validated end-to-end in the sandbox (see below): lands in the user's full zsh /
  Oh My Zsh.

**Rejected — Option A (Portal owns the fallback via a spawned-only flag).** Portal
fork/waits tmux then execs `$SHELL`. Rejected because it has Portal *centrally* control
window-end lifecycle for every terminal — contradicts the chosen model and would
override custom-terminal users' own choices. (Also carried tty/signal-proxy risk, since
fork/wait leaves Portal parenting a full-screen tty app.)

**Rejected — Option B in *shared composition*.** Same shell-wrap idea but placed in
`composeOpenArgv`. Rejected: injects shell metacharacters (`;`, `exec`) into
`{command}`, which only work if the terminal runs `{command}` through a shell — a
guarantee `terminals.json` does NOT make. A direct-exec custom terminal would silently
break. Scoping the wrap to the Ghostty adapter avoids this entirely.

**Rejected — Option C (`wait after command:false`, close cleanly).** The user judged an
abrupt close *worse* than the dead-end: with multiple/scattered Ghostty windows you can
lose track of which one vanished. Keeping the window visible was a property to preserve;
a live shell delivers "visible AND usable," strictly better than both close and the
dead-end. (Note: dropping `wait after command` in the chosen approach is different — the
window still stays visible because the exec'd *shell* keeps it alive.)

### Sandbox Validation (performed during investigation)

Validated the shell-fallback mechanism directly (Ghostty + shell — no Portal), per the
user's request, sandboxed (no live tmux server touched).

**Confirmed — the fallback lands in the user's full shell.** A wrapper running a command
then `exec "$SHELL" -il` lands in `/bin/zsh` as an **interactive login** shell with
**Oh My Zsh sourced** (`$ZSH=/Users/leeovery/.oh-my-zsh`, `$ZSH_VERSION=5.9`,
`login=yes`, `interactive=yes`). `$SHELL` propagates correctly. NOT bash.

**Confirmed — how Ghostty runs the `command` (revealed by a failed implicit-append
attempt).** Ghostty executes the window command as:
```
/usr/bin/login -flp <user> /bin/bash --noprofile --norc -c "exec -l <command>"
```
i.e. it **prepends `exec -l`** so the command *replaces* the bash wrapper and becomes
the window's process. Two consequences:
- **The implicit-append form (`<argv>; exec "$SHELL" -il`) is RULED OUT.** `exec -l`
  applies to the FIRST token (`exec -l <argv-first-word> …`), replacing bash with that
  command — so the `; exec "$SHELL"` fallback is unreachable, and if the first token
  isn't found it fatals (`exec: <cmd>: not found`, window "failed to launch"). Confirmed
  live.
- **The explicit-wrapper form (`bash -lc '<argv>; exec "$SHELL" -il'`) WORKS.** Ghostty's
  `exec -l bash -lc '…'` replaces the outer bash with our inner bash, which runs the
  session command (as a child) then execs the interactive `$SHELL`. Confirmed live: the
  window landed at the user's normal zsh prompt after the session was killed. **This is
  the shape to ship.**

**Test artifact, not a defect:** the implicit-attempt also showed `tmux: not found` —
because the hand-test omitted the `PATH=<picker PATH>` injection that the real
`composeOpenArgv` always includes (`/usr/bin/env … PATH=… -u TMUX …`). Real Portal
windows carry PATH, so tmux resolves. The Ghostty wrapper's `--noprofile --norc` + login
default PATH is why a PATH-less command can't find tmux — reinforcing that the composed
command must keep carrying PATH.

### Close-confirm prompt — ACCEPTED (resolved)

**Decision: accept the close-confirm (option 1 below).** The fix converts the dead-end
into a usable shell — the goal; the residual one-click confirm when closing from the
idle fallback is minor and honest (a live shell really is running). The final Ghostty
command shape is therefore **locked**: `bash -lc '<composed open argv>; exec "$SHELL"
-il'`, with `wait after command` dropped. No shell-integration hack ships.

Detail retained below for the record.

After landing at the fallback zsh prompt, closing the Ghostty window shows Ghostty's
standard confirm: *"Close Window? All terminal sessions in this window will be
terminated."* — normally suppressed at an idle prompt.

**`wait after command` hypothesis DISPROVEN (sandbox).** Re-ran the explicit-wrapper
command with `wait after command` omitted; the close-confirm **still fired**. So it is
not wait-after-command, and not a nested subprocess (the exec chain replaces
bash→bash→zsh in-place, same pid, no children at the prompt).

**Actual cause (strongest inference — Ghostty source not in repo): missing shell
integration.** Ghostty suppresses `confirm-close-surface` at an idle prompt only when it
can see the shell is idle, which it learns via **shell integration** injected when *it*
launches the shell (zsh: a `ZDOTDIR` trick). A surface launched via a custom `command`
does **not** get that injection, so Ghostty has no idle/busy signal and conservatively
confirms. Verifiable by contrast: a normal `Cmd-N` window at idle does not prompt; a
command-launched one does.

**Intrinsic, not approach-specific.** ANY approach that lands the user in a shell
Ghostty did not launch itself hits this — including the rejected Option A (fork/wait →
exec `$SHELL`). It is not switchable per-window (the sdef exposes only `command` +
`wait after command`).

**Resolution options (user to decide):**
1. **Accept it** — the fix still converts a dead-end into a usable shell (the win); the
   prompt is one extra click and is *honest* (a live shell really is running). Zero
   fragility. (Leaning.)
2. **Re-inject Ghostty shell integration into the fallback** (e.g. restore Ghostty's
   `ZDOTDIR`/`GHOSTTY_RESOURCES_DIR` integration before exec) — Ghostty-version-specific,
   fragile, risks double-sourcing/config breakage on updates. Not recommended to ship.
3. **`confirm-close-surface = false`** — user's Ghostty config, global (drops the prompt
   for all their windows incl. ones with real running processes). Not Portal's call.

### Discussion (findings-review journey)

- **Started at "bug or feature / won't-fix?"** The user reflected that the window
  *persisting* after a session ends is arguably good UX (a clean close is worse — with
  multiple/scattered Ghostty windows you lose track of which one vanished). The dead-end
  isn't the persistence; it's that the persisted window is *unusable*. That reframed the
  goal as "persist AND be usable," not "close."
- **The `terminals.json` contract killed Option A.** The user's key insight: Portal's
  job ends at "open a window running this command"; how the window *ends* belongs to the
  command + terminal. That model makes Option A (Portal centrally intercepting the
  lifecycle for all terminals) an overreach, and makes a shared-composition shell-wrap a
  contract breakage for custom terminals (shell metacharacters in `{command}` only work
  if the terminal runs it through a shell — not guaranteed). The clean landing:
  **scope the shell-wrap to the native Ghostty adapter**, leave custom terminals to the
  user's own recipe.
- **Sandbox testing did real work.** The safe half confirmed `exec "$SHELL" -il` lands
  in the user's full zsh/Oh My Zsh (not bash). The real-Ghostty half's *failure* (Plan A)
  was the most valuable result — it exposed Ghostty's `exec -l` command model, ruling out
  the implicit-append form and confirming the explicit `bash -lc` wrapper.
- **Close-confirm: hypothesis tested and revised.** Predicted `wait after command:true`;
  sandbox disproved it; traced the real cause to missing Ghostty shell integration on a
  command-launched surface. User accepted it as a minor, honest trade for a usable
  window.

### Testing Recommendations

- Ship the validated **sandboxed Ghostty test commands** (throwaway `-L` socket) as the
  manual validation for this fix — the implicit-vs-explicit distinction is exactly what
  a future regression could reintroduce.
- The native Ghostty osascript boundary stays `//go:build manual` (no automatable lane),
  so add unit coverage at the **command-composition** seam: assert the Ghostty adapter
  emits the `bash -lc '…; exec "$SHELL" -il'` wrapper (and no `wait after command`),
  around the existing `ghosttyEmbed` / template tests.

### Risk Assessment

- **Fix complexity:** Low — a scoped change to the native Ghostty adapter's command
  composition (+ drop `wait after command`). No Portal core / connector / composition
  changes; `syscall.Exec` attach path untouched, so no tty/signal-proxy risk.
- **Regression risk:** Low — adapter-local; custom `terminals.json` path unchanged; the
  trigger and single-session `open` paths never touch this code.
- **Recommended approach:** Regular release (UX polish on a shipped feature; not a
  hotfix).

---

## Notes

- **Sandbox rule:** any validation commands must run on a throwaway `-L <socket>`
  tmux server, never the live default server (~31 real sessions). Earlier Ghostty
  spawn misfires must not be repeated.

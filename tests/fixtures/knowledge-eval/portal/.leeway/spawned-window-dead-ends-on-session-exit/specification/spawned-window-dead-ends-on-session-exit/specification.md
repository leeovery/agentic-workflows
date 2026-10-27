# Specification: Spawned Window Dead-Ends On Session Exit

## Specification

### Background & Bug Behaviour

#### Background

Portal's multi-window burst spawn — both the picker multi-select burst and the `portal open` multi-target burst — opens N surfaces for N selected targets. The first surface (the *trigger*) reuses the invoking terminal; the other N−1 surfaces are spawned into fresh host-terminal windows via `internal/spawn`. On macOS the native adapter is Ghostty.

#### Observed Bug

When the session running inside a *spawned* (N−1 external) Ghostty window exits or detaches — the user quits the program running in the session, or the session detaches/ends — the window dead-ends on terminal end-of-command text instead of returning to a usable prompt:

```
[detached (from session <name>)]

Process exited. Press any key to close the terminal.
```

A keypress then closes the window — an awkward dead-end rather than a landing.

#### Expected Behaviour

A spawned window whose session exits should behave "as if the user opened Ghostty themselves": land back at a normal interactive shell prompt, with the session having been launched into it. Closing cleanly is an acceptable fallback, but a usable prompt is the goal. The trigger window already behaves this way.

#### Asymmetry (the key signal)

Only the spawned N−1 windows dead-end; the trigger window lands cleanly at a shell prompt. This is **structural, not incidental**: the trigger self-connects in-process from the already-running Portal, which is itself a child of the user's interactive login shell — so exiting the tmux attach returns to that shell's prompt. Each spawned window's root process is instead a single one-shot command that `syscall.Exec`s into `tmux attach-session`, with no parent interactive shell to fall back to.

#### Affected Surface

- **Affected:** every burst-spawned (N−1 external) window on the native Ghostty adapter. Both burst entry points route through the same `internal/spawn` composition + adapter.
- **Not affected:** the trigger window; single-session `portal open`/attach (run from an existing shell); detection, pre-flight, the ack channel, and selection mutation — all correct. This is purely post-exit window lifecycle.

#### Severity & Release

Low — a cosmetic/UX rough edge with no data loss. Ships as a regular release, not a hotfix.

---

### Root Cause

Several composing factors produce the bug; no single one alone is the whole cause.

1. **The spawned command is a single, one-shot argv with no shell fallback.** `internal/spawn` composes the spawned window's command as an env-self-sufficient argv — `/usr/bin/env -u TMUX -u TMUX_PANE PATH=<picker PATH> <exePath> open --session <name> --ack <batch>:<token>` — deliberately a *real argv run verbatim* (so it drops cleanly into config-`terminals.json` recipes). Ghostty runs that command string via `bash -c`, so the window's root process is a single non-interactive command with no surrounding interactive shell.

2. **`portal open` `syscall.Exec`s into tmux.** Outside tmux (the spawned window is always outside tmux — composition strips `TMUX`/`TMUX_PANE`), `portal open --session` writes its ack marker, then `AttachConnector.Connect` `syscall.Exec`s into `tmux attach-session`, *replacing* the process image. The tmux client becomes the window's one-and-only process — no Portal or shell frame is left behind.

3. **The Ghostty adapter opens the window with `wait after command:true`.** When the session exits/detaches and the exec'd tmux client returns, the command is finished. Because of `wait after command:true`, Ghostty holds the dead window awaiting a keypress ("Process exited. Press any key to close the terminal.") instead of closing or dropping to a shell. This flag was introduced by the `ghostty-spawn-zero-windows` fix (2026-07-16) as "the normal-detach window lifecycle for a spawned session" — which also explains why the dead-end appeared only after the multi-window spawn feature started working.

**Net effect:** the spawned window's exec chain (`bash -c` → `env` → `portal open` → `tmux attach-session`) has no parent to return to when tmux exits, and `wait after command:true` converts "command finished" into a keypress dead-end. The trigger window is exempt only because it self-attaches from an already-running Portal that is a child of the user's interactive login shell.

#### Contributing / Why-Not-Caught (context)

- The osascript / Ghostty boundary has no automated coverage — the only real-Ghostty test is `//go:build manual`.
- The dead-end is a *post-exit lifecycle* behaviour, not a spawn failure: the burst succeeds (windows open, acks land, `spawn: opened N/N`), and the defect only appears later when the user exits the session — outside anything the spawn feature tests or logs observe.
- `wait after command:true` was newly composed days before the report; its interaction with the one-shot exec chain was never exercised end-to-end on a real Mac.

_(This section is contextual background for planning; the fix itself is specified in the following sections.)_

---

### The Fix — Ghostty-Adapter-Scoped Shell Fallback

The native Ghostty adapter wraps the command it opens the window with so that, after the session's `portal open` exec chain finishes, the window lands in a full interactive login shell instead of dead-ending. Concretely, the adapter composes its window command as:

```
bash -lc '<composed open argv>; exec "$SHELL" -il'
```

where `<composed open argv>` is the existing env-self-sufficient argv (`/usr/bin/env -u TMUX -u TMUX_PANE PATH=<picker PATH> <exePath> open --session <name> --ack <batch>:<token>`), rendered exactly as it is today. The wrapper runs the session command as a child; when that command finishes (session exit/detach), `exec "$SHELL" -il` replaces the wrapper with the user's interactive login shell, so the window stays visible **and usable** at a normal prompt.

Alongside the wrap, **`wait after command` is dropped** from the Ghostty osascript — it is no longer needed once the exec'd shell keeps the window alive, and it is what produced the "Press any key to close" dead-end.

#### Guiding model (why this scoping)

Portal's job ends at "open a window running this command." How the window behaves when the command ends is a property of the command + terminal, not something Portal should centrally control. Portal therefore only shapes end-of-window behaviour for the command it **authors** — the native Ghostty adapter — and leaves custom-terminal users in full control of their own recipe.

#### Why the explicit `bash -lc` wrapper (not implicit-append)

Ghostty executes a window's `command` by prepending `exec -l`, effectively:

```
/usr/bin/login -flp <user> /bin/bash --noprofile --norc -c "exec -l <command>"
```

`exec -l` replaces the outer bash with the command's **first token**. This rules out the implicit-append form `<argv>; exec "$SHELL" -il` — the `; exec` fallback would be unreachable, and if the first token weren't found Ghostty would fatal ("failed to launch"). The explicit-wrapper form works because Ghostty's `exec -l bash -lc '…'` replaces the outer bash with *our* inner bash, which runs the session command as a child and then execs `$SHELL`. This shape is sandbox-validated live (see Testing).

#### Constraints the implementation must preserve

- **PATH must still be carried.** The composed argv keeps its `/usr/bin/env … PATH=<picker PATH> -u TMUX -u TMUX_PANE …` prefix. Ghostty's inner bash runs `--noprofile --norc` with a login default PATH, so a PATH-less command cannot find `tmux`. This constraint is unchanged from today — the wrap must not strip it.
- **Quoting must nest correctly — the `bash -lc '…'` form is schematic, not a literal byte template.** The composed argv is already POSIX-single-quoted per element by the shared shell-quote helper (`renderCommandString`/`shellQuote`), so it cannot be pasted verbatim inside an outer single-quoted `bash -lc '…'` — the first inner `'` would terminate the outer quote. The implementation must escape the inner single quotes for the outer single-quote layer using the standard POSIX `'\''` (close-escape-reopen) idiom that the shared helper already emits. **Recommended mechanism:** build the wrapper as a real argv `["bash", "-lc", <payload>]`, where `<payload>` is the string `<rendered composed argv>` followed by `; exec "$SHELL" -il`, and render that whole 3-element argv through the existing shell-quote helper — so the helper handles the nesting (inner per-element quotes → the `-lc` payload's single-quote layer) rather than hand-rolled string concatenation. The osascript `command:"…"` double-quote/backslash layer then wraps the result as today. Naive concatenation of the illustrative form would emit a corrupted command that fails at Ghostty launch — the exact failure class this fix removes.
- **The `--ack` marker ordering is unchanged.** `portal open` still writes its `@portal-spawn-<batch>-<token>` marker before the attach handoff; the wrapper does not alter that.
- **The `syscall.Exec` attach path is untouched.** No change to `AttachConnector`, the connector selection, or the exec into tmux — the fix lives entirely in the Ghostty adapter's command composition.

#### Where the change lives

Scoped to the native Ghostty adapter (`internal/spawn/ghostty.go`). Both burst entry points (picker multi-select and `portal open` multi-target) benefit automatically because they share this adapter. The shared `composeOpenArgv` / `renderCommandString` are **not** changed (see Scope & Non-Goals).

The wrap is **argv-agnostic**: it applies identically to mint surfaces (whose composed argv is `open --path <dir> --ack <batch>:<token>`, optionally carrying a `-- <command…>` passthrough) as to attach surfaces, because it lives at the adapter and wraps whatever argv it is handed. Mint windows therefore get the same fallback shell, and any `-- <command…>` passthrough element must survive the same quote nesting as any other argv element (see the quoting constraint above).

#### Resulting shell

The fallback lands in `/bin/zsh` as an **interactive login** shell with the user's full environment sourced (Oh My Zsh in the validated environment); `$SHELL` propagates correctly. It is the user's real shell, not bash.

`$SHELL` is populated by `/usr/bin/login` (which Ghostty uses to launch the window), so `exec "$SHELL" -il` is reliable and **no `$SHELL` fallback is specified**. In the theoretical degenerate case where `exec "$SHELL"` fails, the inner bash exits with nothing left to run and the window closes rather than landing at a shell — an acceptable outcome: a clean close is already an accepted fallback (see Expected Behaviour) and no "Press any key" dead-end reappears.

---

### Scope & Non-Goals

#### In scope

- Wrapping the native Ghostty adapter's window command in `bash -lc '<composed open argv>; exec "$SHELL" -il'`.
- Dropping `wait after command` from the Ghostty osascript.
- Unit coverage at the command-composition seam (see Testing Requirements).

#### Explicitly out of scope (non-goals)

- **No change to shared composition.** `composeOpenArgv` / `renderCommandString` stay as they are. Placing the shell wrap in *shared* composition was considered and rejected: it would inject shell metacharacters (`;`, `exec`) into the `{command}` string handed to config-`terminals.json` adapters, which only work if the terminal runs `{command}` through a shell — a guarantee `terminals.json` does **not** make. A direct-exec custom terminal would silently break. Scoping the wrap to the Ghostty adapter avoids this entirely.
- **No change for custom `terminals.json` terminals — a known, accepted residual.** Custom terminals share `composeOpenArgv` / `renderCommandString`; whether one dead-ends on session exit depends on that terminal's own post-command behaviour. A custom terminal with wait-after-command-style behaviour can therefore still dead-end the same way the Ghostty adapter did pre-fix — unintentionally, not by the user's design. Portal deliberately does not cover that case: how a custom terminal's window ends is the user's own command/recipe's business, and the user retains full control (including a deliberate close-on-exit). This is the accepted consequence of the Ghostty-only scope, and it is also *why* the shared-composition fix was rejected — it would have covered these terminals but broken the `{command}` contract (shell metacharacters only work if the terminal runs `{command}` through a shell, which `terminals.json` does not guarantee).
- **Portal does not centrally own the window lifecycle.** The rejected Option A (Portal fork/waits tmux then execs `$SHELL` behind a spawned-only flag) is not pursued: it contradicts the guiding model, would override custom-terminal users' choices, and carried tty/signal-proxy risk from Portal parenting a full-screen tty app.
- **The window is not closed on exit.** Option C (`wait after command:false`, close cleanly) is not pursued: an abrupt close is worse than the dead-end when multiple/scattered Ghostty windows make it easy to lose track of which one vanished. Keeping the window visible is a property to preserve; a live shell delivers "visible AND usable." (Note: dropping `wait after command` here is different from Option C — the window still stays visible because the exec'd *shell* keeps it alive.)
- **No change to the trigger path.** The trigger window self-connects in-process and already lands cleanly; it must not be touched.
- **No change to single-session `portal open`/attach**, detection, pre-flight, the ack channel, or selection mutation.
- **No new automated real-Ghostty test lane.** The osascript boundary stays `//go:build manual`.

---

### Accepted Trade-off: Close-Confirm Prompt

After the fix lands the window at the fallback zsh prompt, closing that Ghostty window shows Ghostty's standard confirm — *"Close Window? All terminal sessions in this window will be terminated."* — a prompt that is normally suppressed at an idle prompt.

**This is accepted as-is.** The fix converts a dead-end into a usable shell (the goal); the residual one-click confirm when closing from the idle fallback is minor and honest — a live shell really is running. No shell-integration workaround ships.

#### Cause (for the record)

- The `wait after command` flag is **not** the cause — the confirm still fires with the flag omitted (sandbox-disproven), and there is no nested subprocess (the exec chain replaces bash→bash→zsh in place, same pid, no children at the prompt).
- The strongest inference (Ghostty source not in repo) is **missing shell integration**: Ghostty suppresses `confirm-close-surface` at an idle prompt only when it can see the shell is idle, which it learns via shell integration injected when *it* launches the shell. A surface launched via a custom `command` does not get that injection, so Ghostty has no idle/busy signal and conservatively confirms.
- This is **intrinsic to landing in a shell Ghostty did not launch itself** — any approach that does so hits it (including the rejected Option A). It is not switchable per-window (the sdef exposes only `command` + `wait after command`).

#### Rejected mitigations (do not ship)

- Re-injecting Ghostty shell integration into the fallback (e.g. restoring `ZDOTDIR`/`GHOSTTY_RESOURCES_DIR`) — Ghostty-version-specific, fragile, risks double-sourcing/config breakage on updates.
- Setting `confirm-close-surface = false` — that is the user's global Ghostty config and would drop the prompt for all their windows, including ones with real running processes. Not Portal's call.

---

### Testing Requirements

#### Unit coverage (automated)

The native Ghostty osascript boundary has no automatable lane (stays `//go:build manual`), so add coverage at the **command-composition seam**, around the existing `ghosttyEmbed` / template tests:

- Assert the Ghostty adapter emits the `bash -lc '<composed open argv>; exec "$SHELL" -il'` wrapper.
- Assert the adapter no longer emits `wait after command`.
- Assert the composed argv inside the wrapper still carries its `PATH=<…>` / `-u TMUX -u TMUX_PANE` prefix (PATH is not stripped by the wrap).
- Assert quoting nests correctly using a **quote-sensitive fixture** — an argv element containing shell-special characters (a single quote, `;`, `$`, `"`), ideally the mint `-- <command…>` passthrough (e.g. `-- sh -c 'echo hi'`) — so the `'\''` double-escaping path is actually exercised, not merely an attach-only argv that carries no special characters. Assert the embedded argv round-trips uncorrupted through the added `bash -lc '…'` layer.

#### Manual validation — already performed (during investigation)

The fix mechanism has already been validated live, sandboxed on a throwaway `-L` tmux socket, during the investigation: the explicit `bash -lc '<composed open argv>; exec "$SHELL" -il'` wrapper was run end-to-end and, after the session was killed, the window landed at the user's normal interactive login shell (`$SHELL`, login+interactive) — not the "Press any key to close" dead-end. The implicit-append form was ruled out live (Ghostty's `exec -l` command model). **No further manual-validation deliverable is required for this fix** — the functionality is already tested.

On the detach path, tmux's `[detached (from session <name>)]` line prints above the fallback prompt — that is expected tmux output, not a sign the fix failed.

#### Sandbox rule (mandatory for any re-validation)

If the fix is ever re-validated against tmux, those commands must run on a throwaway `-L <socket>` tmux server, **never** the live default server (which hosts the user's real sessions). Earlier Ghostty spawn misfires must not be repeated.

---

### Acceptance Criteria

1. When a session running inside a burst-spawned (N−1 external) native-Ghostty window exits or detaches, the window lands at the user's normal interactive login shell prompt (`$SHELL`, login + interactive) — not the "Process exited. Press any key to close the terminal." dead-end. On the detach path, tmux's own `[detached (from session <name>)]` line may still print above the fallback prompt; this is expected tmux client-detach output, outside the fix's scope, and does not indicate an incomplete fix.
2. The native Ghostty adapter's window command is the explicit wrapper form `bash -lc '<composed open argv>; exec "$SHELL" -il'` (logical form — the on-disk command is this form with the inner argv's single quotes correctly escaped/re-quoted via the shared shell-quote helper, not a naive byte concatenation), and the adapter no longer emits `wait after command`.
3. The composed open argv inside the wrapper is unchanged from today — the same argv for both surface kinds (attach: `open --session <name> --ack <batch>:<token>`; mint: `open --path <dir> --ack <batch>:<token>`, optionally with a `-- <command…>` passthrough), same `/usr/bin/env … PATH=<picker PATH> -u TMUX -u TMUX_PANE` prefix; `tmux` resolves in the fallback shell's environment.
4. The `@portal-spawn-<batch>-<token>` ack marker is still written before the attach handoff; the burst still confirms each window and logs `spawn: opened N/N`.
5. Both burst entry points (picker multi-select and `portal open` multi-target) exhibit the fixed behaviour, via the shared adapter.
6. The trigger window, single-session `portal open`/attach, custom `terminals.json` adapters, shared `composeOpenArgv`/`renderCommandString`, and the `syscall.Exec` attach path are all unchanged in behaviour.
7. Unit tests at the command-composition seam assert the wrapper shape against the correctly-escaped expected string (the `'\''`-escaped nesting, not the schematic form), the absence of `wait after command`, the preserved PATH/`-u TMUX` prefix, and that the embedded argv round-trips uncorrupted through the added `bash -lc` layer. The quote-nesting assertion uses a quote-sensitive fixture (an argv element with shell-special characters, e.g. the mint `-- <command…>` passthrough) so the `'\''` double-escaping path is actually exercised.
8. Known accepted residual: closing the window from the idle fallback prompt shows Ghostty's one-click close confirm. This is expected and not a defect.

_Note: the fix mechanism itself was already validated live during the investigation (see Testing Requirements → Manual validation), so no manual-validation deliverable is gated by these acceptance criteria — only the code change and its unit coverage (criteria 2, 3, 7) remain to be built and verified._

## Working Notes

_Optional - capture in-progress discussion if needed._

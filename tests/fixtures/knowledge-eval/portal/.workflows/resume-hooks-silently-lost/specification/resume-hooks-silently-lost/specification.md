# Specification: Resume Hooks Silently Lost

## Specification

### 1. Defect and Scope

#### 1.1 The defect

A resume hook is stored in `hooks.json` under a key that is half durable identity and half tmux-recomputed position (`internal/tmux/tmux.go:565`):

```
#{?@portal-id,#{@portal-id},#{session_name}}:#{window_index}.#{pane_index}
└──────────── immutable identity ───────────┘ └──── mutable position ────┘
```

The session half was made rename-immune by spec `session-rename-orphans-resume-hook` (2026-07-04). The pane half is a coordinate tmux recomputes from layout, and Portal never verifies that a key it writes down identifies any pane at all. That is one defect, and it surfaces at three moments in a hook's life:

- **At write time.** tmux exits 0 and prints `:.` for a `display-message -p` against a pane that does not exist (`tmux -L <sock> display-message -p -t %999 '#{?@portal-id,#{@portal-id},#{session_name}}:#{window_index}.#{pane_index}'` → `:.`, exit 0; tmux 3.7c). `tmux.ResolveHookKey` returns that verbatim, `cmd/hooks.go` `resolveCurrentPaneKey` passes it through, `hooks.Store.Set` persists it, and `portal hook set` exits 0. No layer validates the key's shape — there is no such validation anywhere in the repo.
- **Over the pane's lifetime.** Any rearrangement — closing a sibling pane, closing a window under `renumber-windows on`, `break-pane`, `move-pane` — changes `window_index.pane_index`. Nothing re-keys the entry, and the daemon's stale sweep removes it. The sweep is correct by its own rule: at the point of comparison a moved pane and a dead pane are indistinguishable. The sweep runs on the daemon's idle branch at `hookCleanupInterval = 10 * time.Second` (`cmd/state_daemon.go:105`) — precisely when a user is rearranging rather than working — so the entry is gone within ~10s of the move.
- **At the reboot boundary.** Restore recreates each extra window with `NewWindow(target, …)` where `target` is `"<session>:"` and no index is passed (`internal/restore/session.go:98`), so tmux assigns the next free index. Where the saved window indices are non-contiguous, the restored ones differ. The baked key still fires — `collectArmInfos` derives it purely from saved state — but no live pane answers to it afterwards and the sweep reaps it. The hook survives exactly one reboot. This is latent on the reporting user's install, whose `renumber-windows on` keeps saved and restored indices contiguous; it is a general defect on tmux's default settings.

The loss is silent because both diagnostics ask the reaper's own question and the reaper does not record its answer: `portal doctor`'s `checkStaleHooks` (`cmd/doctor.go:280`) tests the same live-key rule the daemon acted on within 10s, so it reports `no stale hooks` *because* the deletion completed; and the automatic prune does not name the removed key at the level production runs at (§5.3).

#### 1.2 What this work unit fixes

Four changes, delivered together in one release:

| | Change | Home |
|---|---|---|
| **A** | A durable per-pane identity replaces the positional pane component of the key | §2, §3 |
| **B** | Registration verifies the pane exists and fails loudly when it does not | §4 |
| **C** | The stale sweep becomes shape-aware and names what it deleted | §5 |
| **D** | The unlocked cross-process read-modify-write on `hooks.json` is closed | §6 |

A is the repair for the two moments a positional key creates — lifetime drift and the reboot boundary. B closes the write-time moment, which no key format can close (§4.1). C and D close the path that made the loss silent and the path that can lose an entry independently of the key format. A carries the removal of the superseded `@portal-id` machinery with it (§7).

#### 1.3 Out of scope

- **`~/.claude/hooks/portal-resume-hook.sh`** — the user's own Claude Code integration. It re-implements `HookKeyFormat` verbatim and matches it against `portal hook list` output (`:87-95`), so it needs updating in step with this change, but it is not part of the Portal product and no work item here covers it.
- **The one-time conversion of the existing `hooks.json`** — no migration code ships; see §8.
- **Claude Code transcript retention.** The 2026-06-29 sighting — sessions present after a crash-recovery reboot with resume behaviour absent — is explained by Claude Code garbage-collecting session transcripts on a retention window, after which the stored `claude --resume <id>` fails and the hydrate chain `sh -c '<HOOK>; exec $SHELL'` falls through to a bare shell. Closed at source by raising that retention. Not a Portal defect and no fix work here addresses it.
- **The inverse diagnostic** — "a live pane that should have a hook does not have one". Portal records no notion of which panes are meant to be protected, so an unprotected pane is invisible to every check. A real diagnostic gap, but not part of this causal chain.
- **The positional siblings that share the pattern but are not failing** — `state.SanitizePaneKey` (hydrate FIFO paths, `@portal-skeleton-*` markers) and `internal/tmux`'s `StructuralKeyFormat`. These live for the duration of one bootstrap and are rebuilt from live coordinates each time, so drift has no window in which to occur. They are checked against the change (§9), not changed by it.



### 2. Durable Pane Identity

#### 2.1 The token and its tmux option

Each pane that carries a resume hook is stamped with an opaque token held in the tmux **pane** user-option `@portal-pane-id`.

The option name is declared **once**, as `PortalPaneIDOption` in `internal/state` — beside `RestoringMarkerName`, `SkeletonMarkerPrefix` and `BootstrappedMarkerName`, which already name Portal's other tmux options from that package. Every site that needs the literal composes it from that constant: `captureFormat` in the same package, `HookKeyFormat` and the all-pane enumeration format in `internal/tmux` (which already imports `internal/state`), the re-stamp in `internal/restore`, and the stamp in `cmd` (which imports both). The existence probe names no option at all (§4.1) and the token read is made through `HookKeyFormat`, so neither composes the literal itself. The literal is therefore written in exactly one place, which is what retires the binding guards rather than re-pointing them (§9.4).

A tmux pane user-option was verified in an isolated `-L` socket (tmux 3.7c) to survive every mutation that moves a pane's coordinates, and to survive the one Portal itself performs:

| Operation | Coordinates before → after | Stamp |
|---|---|---|
| initial | `t:1.2` | `STAMP1` |
| `break-pane` | `t:1.2` → `t:3.1` | survives |
| `kill-window` under `renumber-windows on` | `t:3.1` → `t:2.1` | survives |
| `move-pane` back | `t:2.1` → `t:1.2` | survives |
| `respawn-pane -k` | `t:1.2` (unchanged) | survives |
| `rename-session` | `t:1.2` → `newname:1.2` | survives |

(`tmux -L <sock> set-option -p -t <pane> @portal-pane-id STAMP1`, then `tmux -L <sock> display-message -p -t <pane> '#{@portal-pane-id}'` after each operation.)

`respawn-pane -k` surviving is load-bearing: that is exactly what restore's arm phase does to every pane (`internal/restore/session.go` `armPanes`), so a stamp applied before arming is still there afterwards.

There is **no inheritance**: a pane created by `split-window` or `new-window` from a stamped pane reads back empty (`tmux -L <sock> split-window -t t -d`, then `tmux -L <sock> list-panes -t t -F '#{pane_index}=#{@portal-pane-id}'` → `0=STAMP1 1=`). A split therefore cannot duplicate an id.

**Token generation** reuses the in-house nanoid: the shared generator over its 62-alphanumeric alphabet (no `-`), width 6. There is no uniqueness check beyond the generator's width — the same call the `@portal-id` stamp makes today (`internal/session/create.go`), which that code documents as deliberate.

Minting is reached through an exported function in `internal/session` (`NewPaneToken`), which forwards to the shared generator the shape predicate (§3.2) reads. `hook set` calls it and names no width of its own.

**tmux's own `%N` pane id is not the identity.** It is stable only within a server lifetime and tmux is free to recycle it, so it needs the identical carry-and-re-stamp machinery a minted token needs (§2.3) while being less trustworthy than one: a recycled id can name a pane that is not the one the entry was written for, which fires a hook on the wrong pane rather than losing it.

#### 2.2 Stamping is lazy, at `hook set`

Portal does not create panes — the user splits them — so there is no creation point to stamp at, and a pane with no hook needs no token. The stamp is therefore applied by `portal hook set`, immediately before the `hooks.json` write.

- **A pane already carrying a token keeps it.** `hook set` reads `@portal-pane-id` first and mints only when it reads back empty. Re-registering on the same pane must not mint a second token, which would orphan the first entry.
- **`hook set` touches the dirty flag.** After a successful write it resolves the state directory with `state.EnsureDir()` and calls `state.TouchSaveRequested(dir)`, so the next daemon tick captures the new token rather than waiting up to `MaxGap` (30s, `cmd/state_daemon.go:425`) for the gap branch. This narrows the window in which a crash between registration and capture loses the stamp; it does not close it, and that residual is accepted.

  The touch is **best-effort and never affects the exit status.** It is a latency optimisation, and by the time it runs the entry is already durably written — failing the command over it would report a lost registration that was not lost. A failure at either step, resolving/creating the directory or the touch itself, logs one WARN under the `hooks` component on the store's existing failure shape — message and `op` both `touch-save-requested`, alongside `hook_key`, `via=cli` and the existing `error` attr — and `hook set` still exits 0. It is filed under its own `op` rather than under `set` for the same reason it does not fail the command: the registration succeeded, and a `set` WARN would name a loss that did not happen. This is the only path `hook` touches outside the config directory holding `hooks.json` and its sidecar lock (§6.2), and like them it starts no tmux server, so bootstrap-exemption is unaffected: `portal state notify` resolves the state directory exactly this way from an equally exempt command (`cmd/state_notify.go`). The line is emitted from `cmd`, where the touch happens — the store has no path to the state directory — through the `hooks` binding `cmd` already holds (`hooksLogger`, `cmd/state_common.go:11`). No new component binding is introduced. The store's own emissions are unaffected.
- **`hook` stays bootstrap-exempt.** It starts no tmux server. A `$TMUX_PANE` that is set implies a live server, and the `--pane-key` path (§4.3) touches tmux not at all.

#### 2.3 Carrying the token across the reboot gap

A tmux pane option does not survive the server dying — the exact constraint that made spec `resume-hooks-lost-on-server-restart` (2026-04-30) choose positional keys over `%N` pane ids. That gap is closed the same way the session half already closes it:

- **Schema.** `state.Pane` gains `PortalPaneID string \`json:"portal_pane_id"\`` (`internal/state/schema.go`). This is an additive field on a tolerant-decode struct: **no `SchemaVersion` bump, no migration**. An older `sessions.json` decodes with the field empty.
- **Capture.** `captureFormat` (`internal/state/capture.go:26`) has its trailing `#{@portal-id}` column **replaced** by `#{@portal-pane-id}`, and the value is lifted into `Pane.PortalPaneID` rather than `Session.PortalID`. `captureFieldCount` stays `11` — one column swaps for another, and it changes from session-scoped (repeated on every pane row of a session) to genuinely per-pane.
- **Restore.** After the skeleton exists and before each pane is armed, the saved token is re-stamped onto the corresponding live pane with `set-option -p`. **A saved pane whose `PortalPaneID` is empty is skipped entirely** — no option is written and nothing is logged. Under lazy stamping (§2.2) an unstamped pane is the ordinary case rather than an anomaly: it is every pane that has never carried a hook, and every pane on the install during the upgrade window. Writing `@portal-pane-id ""` instead would stamp a value indistinguishable on read-back from absence onto most panes on the machine.

#### 2.4 Restore re-stamp: failures are surfaced, mispairings are not stamped

Two rules distinguish the pane re-stamp from the session re-stamp it is modelled on.

**A failed re-stamp must not be swallowed.** The session stamp discards its error (`_ = r.Client.SetSessionOption(...)`, `internal/restore/session.go:79`) because a missed `@portal-id` costs only rename-immunity. For the pane token the stamp *is* the identity: a swallowed failure permanently orphans that pane's hook with no trace. A failed pane re-stamp logs one WARN under the `restore` component — message `set pane token failed`, carrying the `session`, `pane_key` and `error` attrs. That is the shape and the exact attr set of restore's own `set skeleton marker failed` emission (`internal/restore/session.go:274`), so **no new component and no new attr key** is introduced. `pane_key` carries the live structural key of the pane being stamped, which is what makes the line actionable — the token that failed to land is not a location. It does not abort the restore — an unstamped pane is a lost hook, not a lost session. Because an empty saved token never reaches the stamp, this WARN can only fire for a genuine tmux failure — it is a signal that one pane's identity was lost, not a per-boot report on the unstamped majority.

**An unpaired pane must not be stamped.** `armPanes` (`internal/restore/session.go:125-128`) warns and pairs up to the shorter list when the live and saved pane counts differ. Today a mispairing misplaces a FIFO and a hook key for one boot and self-corrects at the next capture. A durable token written onto the wrong pane does not self-correct — the hook then fires on the wrong pane on every subsequent reboot. Only panes within `pairCount` are stamped; the unpaired remainder is left untouched.


### 3. The Hook Key

#### 3.1 The key is the pane token alone

A hook key is the pane's `@portal-pane-id` token (§2.1) and nothing else. It carries no session component and no coordinates.

The alternative considered and rejected was a composite `<portal-id>:<pane-token>`, which keeps `hooks.json` readable and preserves session grouping. It was rejected because `move-pane -t <other-session>` changes the session half, so drift returns for exactly the operation the user performs deliberately. A token-only key has no component tmux is free to recompute, so no rearrangement — within a window, across windows, or across sessions — can change it.

This closes all three moments in §1.1:

- **Write time** is closed by §4, not by the format.
- **Lifetime drift** cannot occur: the token is stamped once and tmux never recomputes it.
- **The reboot boundary** closes because restore re-establishes the token itself (§2.3). The key on disk and the key the live pane answers to are the same value regardless of how tmux renumbered the windows, so nothing needs re-keying and the post-restore sweep finds the entry live.

#### 3.2 Key shape

A hook key is **token-shaped** iff it is exactly `suffixLen` characters drawn from `NanoIDAlphabet` (§2.1) — currently `^[A-Za-z0-9]{6}$`.

Old-format keys are `<@portal-id or session_name>:<window>.<pane>` and therefore always contain `:` and `.`, neither of which is in the alphabet. No old-format key can ever be token-shaped, which is what makes the reaper's shape test in §5 sound.

The predicate's **home is beside the generator**, exported as a function; the shape it tests is **derived from the generator's own constants, not restated**. It reads the generator's width and alphabet directly, so a change to either moves generation and recognition together and drift is impossible rather than merely guarded against. The alternative — a hardcoded `^[A-Za-z0-9]{6}$` in `internal/hooks` beside a width free to move — is the failure mode: every existing key silently stops being token-shaped and the reaper starts retaining what it should delete, with nothing failing anywhere.

Beside the generator is the only home that permits the derivation, because the width is **unexported**; the alphabet is exported but the width is not. Placing the predicate in `internal/hooks` would require exporting the width as well, adding a second package's claim on a value that has no reader outside name generation.

That home is **`internal/nanoid`** — a stdlib-only leaf holding `Alphabet`, the unexported `width`, `NewGenerator` and `IsTokenShaped`, with `internal/session/panetoken.go` forwarding to it. `internal/hooks` imports the leaf rather than `internal/session`, and its own leaf guard forbids the `internal/session` import outright. The reaper keeps its own judgement — retain or delete — and calls the predicate for the one question it cannot answer about a key's shape. Because the values are derived rather than duplicated, **no guard test is needed**, which is why §9.4 enumerates none for the predicate.

#### 3.3 Key-producing and key-consuming sites

Every site's source of truth is unchanged from today; what each derives is now a token rather than a composite:

| Site | Path | Source of truth |
|---|---|---|
| Registration (`hook set`) | `cmd/hooks.go` `resolveCurrentPaneKey` → a live read of `@portal-pane-id` for `$TMUX_PANE` | live tmux |
| Removal (`hook rm`, `$TMUX_PANE` path) | same | live tmux |
| Stale sweep | `cmd/run_hook_stale_cleanup.go` → the all-pane token enumeration | live tmux |
| `portal doctor` `checkStaleHooks` | `cmd/doctor.go` → the same enumeration | live tmux |
| Restore / firing | `internal/restore/session.go` `collectArmInfos` → `p.PortalPaneID` | saved `sessions.json` |

The July invariant — *every site that produces or consumes a key derives it by the identical rule* — now holds trivially: there is no derivation, only a read of one value.

**`internal/tmux` surface changes:**

- `HookKeyFormat` becomes the pane-token format `#{@portal-pane-id}`.
- `HookKey(portalID, name, window, pane)` is **deleted**. The saved-state bake is a struct field read, not a formatting call.
- `ResolveHookKey(paneID)` becomes the two-call live resolution of §4.1 for one pane target — an existence probe followed by a read of the pane's token. Its doc comment, which warns that a read failure must never fall back to a name-based key, is rewritten with it: §7.2 leaves no name-based key to fall back to, and the failure it guarded against is now a non-zero exit the function genuinely returns rather than one tmux declines to report.
- `ListAllPaneHookKeys()` becomes an all-pane enumeration returning **one row per live pane**, each row carrying the pane's `@portal-pane-id` (empty for an unstamped pane) and its `<session>:<window>.<pane>` location. Both properties are load-bearing — §5.4 has the rule that consumes them. A single `list-panes -a -F` read over a two-field format serves the sweep, `portal doctor` and `hook list` alike — there is no second enumeration and no second tmux read. The location field is **display only** (§4.4): it is never a key, so rendering the same shape as the positional siblings (§1.3) couples nothing to them.

- A **pane-option write is added** — `internal/tmux` exposes no pane-scoped option setter today. It takes the option name from its caller, so `cmd` passes `state.PortalPaneIDOption` when `hook set` stamps at §4.1 step 4, and it is reached through the `hook` command's existing `*Deps` seam like every other tmux call the CLI makes. The existence probe adds no exported surface of its own: it is internal to `ResolveHookKey`, which owns both reads of §4.1 steps 2–3.

- The `cmd`-side seam that mirrors it — `AllPaneLister` (`cmd/run_hook_stale_cleanup.go`) — changes signature with it, and its doc comment, which names the `<@portal-id or session_name>:window.pane` form, describes the two-field rows instead.

The name-based positional siblings are untouched (§1.3).

**`CLAUDE.md`** describes the hook key as `<@portal-id or session_name>:window.pane` and documents the `@portal-id` stamp, `Session.PortalID`, the `#{@portal-id}` capture column and the `HookKey` / `HookKeyFormat` / `ResolveHookKey` / `ListAllPaneHookKeys` surface. Every passage naming those is rewritten to the pane token and the §7.2 removals, so the repository's own architecture description does not go on naming a key scheme that no longer exists.

**`portal state hydrate --hook-key`** keeps its flag and its meaning; its help text, which currently reads `Saved structural identifier (<session>:<window>.<pane>)`, is corrected to describe the token.

**`buildHydrateCommand`** (`internal/restore/session.go`) interpolates the key into `portal state hydrate --hook-key %s` through `internal/shellquote`'s `Single` and bakes it into a `respawn-pane -k` command line. The quoting is **retained** — the new character set contains no shell metacharacters, so this boundary becomes strictly safer than it is today rather than needing new care.

#### 3.4 An empty key is rejected at every boundary

`hooks.LookupOnResume` (`internal/hooks/lookup.go`) does a bare map index on the key, so a single `""` entry in `hooks.json` would fire its command on **every unstamped restored pane on the machine**. §4 stops the CLI writing one, but a hand-edit or a bug in the out-of-band conversion script (§8) still could.

Two independent guards, both required:

- **`collectArmInfos` must not bake an empty key.** A saved pane with an empty `PortalPaneID` is armed with no hook — the pane restores and hydrates as normal, it simply has nothing to resume. Concretely, `buildHydrateCommand` omits the `--hook-key` flag entirely for that pane rather than passing an empty value, and `portal state hydrate` treats an absent flag and an empty one alike as "no hook". Under lazy stamping this is the ordinary pane, not an anomaly, so the flag cannot be required.
- **`LookupOnResume` must not honour an empty key.** An empty `hookKey` argument returns "no hook" before the map is consulted, regardless of what the file holds.


### 4. Registration, Removal and Listing

#### 4.1 Registration verifies the pane exists

`portal hook set --on-resume "<cmd>"` refuses a `$TMUX_PANE` that names no live pane, exits non-zero, and writes nothing to `hooks.json`.

This is the only change that closes the write-time moment, because tmux offers no error to detect on the read path: `display-message -p` against a bogus target exits 0 (§1.1). Verification is instead **tmux-native** — an exit status from a call that genuinely refuses a bogus target — rather than a shape heuristic on a returned string.

It takes two reads, because no single tmux call separates all three cases on exit status alone (tmux 3.7c):

| Call | pane gone | live, no token | live, stamped |
|---|---|---|---|
| `show-options -p -t <target>` (no option named) | exit 1 | exit 0 | exit 0 |
| `display-message -p -t <target> '#{@portal-pane-id}'` | exit 0, empty | exit 0, empty | exit 0, `TOKEN1` |
| `set-option -p -t <target> @portal-pane-id X` | exit 1 | exit 0 | exit 0 |

(`tmux -L <sock> show-options -p -t %999` → `no such pane: %999`, exit 1; `tmux -L <sock> show-options -p -t %0` → exit 0 with empty output on a pane carrying no pane options at all; `tmux -L <sock> set-option -p -t %999 @portal-pane-id X` → `no such pane: %999`, exit 1.)

**Naming the option in the `show-options` read is what collapses the discrimination:** `show-options -p -t <live pane> @portal-pane-id` exits 1 with `invalid option: @portal-pane-id`, indistinguishable on status from `no such pane`. The option name is therefore omitted — that call is asked only whether the pane exists — and the token's value comes from the `display-message` read, where a gone pane and an unstamped pane both read empty but the probe has already told them apart.

Portal never parses tmux's message text: the exit status is the whole signal, and tmux's words are passed through to the user unaltered. The sequence is:

1. `requireTmuxPane` — `$TMUX_PANE` must be non-empty (unchanged).
2. Probe existence with `show-options -p`, no option named. A gone pane fails here, before anything is written.
3. Read the pane's token with `display-message -p '#{@portal-pane-id}'`. A non-empty value is reused (§2.2); empty means a live pane that has never been stamped.
4. An unstamped pane is minted a token and stamped with `set-option -p`, which errors on a bogus target in its own right — a second, redundant guard that costs nothing.
5. Write the entry under the token key.
6. Touch `save.requested` (§2.2).

Steps 4 and 5 must not be reordered, and step 4 failing ends the command: a write that precedes the stamp, or follows one that failed, persists an entry keyed to a token no pane carries. A failed stamp exits non-zero with tmux's words and writes nothing, the same shape as a failed probe at step 2.

The mirror state — a stamp that succeeded followed by a write that failed, leaving a pane carrying a token no entry references — is **left exactly as it is. There is no rollback.** The next registration on that pane reads the token back and reuses it (§2.2), so the orphan costs nothing and resolves itself the moment the user retries. Unstamping on write failure would be worse than the state it cleans up: it races a concurrent registration that may already have read the token, and it turns a benign no-op into a lost identity.

#### 4.2 Removal verifies the same way — on the `$TMUX_PANE` path only

`portal hook rm --on-resume` run from a pane resolves the key with the same two reads as §4.1 steps 2–3, and fails non-zero on the same non-zero exit. This is literally the same guard, not an analogue of it — which is what lets removal carry it without minting anything. It puts both halves of the CLI surface behind one rule rather than only the write side.

Removal does **not** mint, and it does **not** unstamp. A pane with no token has no entry to remove; `hook rm` reports that — in Portal's own words, since the existence probe has already separated it from a gone pane — and exits non-zero rather than silently succeeding, which is the same silent-success shape as the `:.` bug on the write side. A pane whose entry is removed keeps its token, for the reason §4.1 gives for not rolling back a stamp, and for one more: clearing it would add a tmux write that can fail after the entry is already gone.

**Removing nothing is always non-zero**, whichever of the three ways it happens. The third way is a live, stamped pane whose token has no entry in `hooks.json` — the routine outcome of deregistering twice, or of deregistering a pane that never registered. It exits non-zero with its own message alongside the gone-pane and no-token cases. The rule is one line: `hook rm` exits 0 **iff** it removed an entry. The idempotent reading — treating "no entry for this pane" as the requested end state and succeeding — is rejected because it reinstates the property this work unit exists to remove: an exit code that says nothing about whether anything happened.

The words are fixed. A live pane carrying no token exits with `no resume hook registered for this pane`. A key that names no entry exits with `no resume hook registered for <key>` — the resolved token on the `$TMUX_PANE` path, the literal key on the `--pane-key` path (§4.3). A gone pane exits with tmux's own words (§4.1).

Whether anything was removed is reported by the locked removal itself, not by a read taken before it: the store's removal answers from the file it mutated, under the exclusive hold of §6.3, and that answer alone drives the exit status. A check taken before the mutation would decide the exit status from a snapshot the mutation never saw — a concurrent sweep or another pane's `hook set` between the two would make the report wrong in either direction. This is what lets the `--pane-key` path (§4.3) carry the same rule while reading nothing of its own.

**This failure fires routinely, and that is expected.** Deregistration against an already-closed pane is the ordinary case, not an error case: 61 of the 63 `:.` lines in a month of `portal.log` were `op=rm`, near-daily, every one a Claude Code SessionEnd — and SessionEnd commonly fires *because* the pane was closed, so tmux has reclaimed the pane id before the hook runs. Today that sequence exits 0, removes nothing that matters, and the real entry is absorbed by the sweep once the pane is genuinely gone; the end state is benign, which is why it went unnoticed. After this change the same sequence exits non-zero every time.

That is the point — a caller can no longer read `rc == 0` as proof anything happened — but it means a caller treating non-zero as an error will begin seeing one as a matter of course. This is the second reason the external integration needs updating in step (§8.4), alongside the key-scheme change.

#### 4.3 `--pane-key` stays a literal pass-through

`portal hook rm --on-resume --pane-key <key>` performs **no validation of any kind** and touches tmux not at all. The key is used verbatim. The §4.2 rule still governs the exit status here: the pass-through waives validation of the key, not the guarantee that the code reports whether anything happened, so a `--pane-key` that names no entry in `hooks.json` exits non-zero like every other way of removing nothing.

This is deliberate and is not weakened by B. Spec `hooks-rm-pane-key-flag` (2026-05-26) made the flag a pass-through precisely so an entry whose pane no longer exists can be pruned — validating it would defeat its only purpose. The rule that separates the two paths: **a key Portal resolves must identify a live pane; a key the caller hands over explicitly must not be second-guessed.**

`--pane-key` is also the route by which an old-format entry can be removed by hand after this change, since no live pane will ever resolve to one.

#### 4.4 `portal hook list` renders the resolved location

`hook list` gains a fourth tab-separated column carrying the token's resolved `<session>:<window>.<pane>` location:

```
k3Bq7z	on-resume	cd "/x" && claude --resume 9e4d…	agentic-workflows-refactor-wt:1.1
```

The column is **appended**, so the existing `key` / `event` / `command` field positions are undisturbed for any caller parsing the output.

This is what pays back the readability the token-only key costs (§3.1). Without it the file is a list of opaque six-character tokens with no way to answer "which pane is this?" short of a manual `list-panes` diff — the same hand audit this defect already forced once.

Resolution is one `list-panes -a` read over the §3.3 enumeration, whose rows already carry the token alongside its location; the token → location mapping is built once from that read and reused across all rows. The mapping is built from **non-empty** tokens only, so an unstamped pane's row cannot lend its location to an entry that names no pane. A token that resolves to no live pane renders the column **empty** rather than failing the command — including the case where no tmux server is running at all, which `hook` is bootstrap-exempt from starting. An old-format key likewise renders empty, since no live pane can answer to one. The column is always emitted: an empty value is an empty fourth field, never a dropped one, so every line carries the same three separators whatever resolution produced.


### 5. Stale Cleanup

#### 5.1 What the reaper does now

`runHookStaleCleanup` (`cmd/run_hook_stale_cleanup.go`) enumerates live pane keys, loads `hooks.json`, and deletes every persisted key absent from the live set. It runs from two call sites over the same code path: the daemon's idle branch (§1.1, `cmd/state_daemon.go` `maybeRunHookCleanup`), and `portal doctor --fix` (`cmd/doctor.go` `pruneDoctorStaleHooks`), which supplies an `onRemoved` callback printing `Pruned stale hook: <key>`.

`runHookStaleCleanup` reports a stood-down cycle to its caller the way it reports a removal: alongside `onRemoved`, the caller may supply an `onSkipped` callback taking the reason the cycle did not run. The daemon supplies none — its skip is already in the log. `portal doctor --fix` supplies one and prints its line beside the `Pruned stale hook: <key>` lines, one of:

```
Skipped stale hook prune: restore in progress
Skipped stale hook prune: hooks.json is locked
Skipped stale hook prune: could not read live panes
```

covering the restore marker (§5.4), the lock timeout (§6.5) and the empty-live-set guard (§5.4) respectively. None of them affects the exit code, which stays driven by the post-repair diagnosis.

**Whether the reaper deletes is not changed** — it is not converted to full retention. What changes is what it can identify (§5.2), what it records (§5.3), when it declines to run at all (§5.4), and how it takes the file it mutates (§6).

Retention alone would not have repaired the defect in any case. Firing looks up a key baked from saved state (`collectArmInfos`), and a moved pane is captured at its new coordinates — so restore bakes the *new* key while `hooks.json` still holds the old one. Under a positional key the entry would survive the sweep and still not fire: drift breaks the lookup, not only the storage, which is why the key itself has to stop being positional rather than the reaper being made gentler.

#### 5.2 Deletion becomes shape-aware

- A **token-shaped** key (§3.2) whose token is absent from the live set is deleted, exactly as today.
- A key that is **not token-shaped** is **retained**, untouched, on every run.
- An **empty** key is deleted. It is neither token-shaped nor old-format — an old-format key always carries `:` and `.` (§3.2) — so the retention rule has nothing to protect in it. It is the malformed entry §3.4 guards the firing path against, and deletion is its only route out of the file short of a hand edit.

**The rule has one implementation.** The staleness test lives in a single exported function in `internal/hooks` — `StaleKeys` — that judges an already-loaded key set and takes no lock of its own, and every reader of staleness applies the rule through that one function rather than restating it. Both callers reach it directly: `checkStaleHooks` on the read-only diagnosis path, and `CleanStale`'s deletion pass on the key set it loaded under its own exclusive lock (§6.3). Because the function acquires nothing, calling it from inside that hold is not an acquisition and cannot block against the sweep's own lock. The re-entrancy prohibition §6.3 states is unaffected and is enforced against the locking entry points themselves — `Load`, `List`, `Save` and the shared-hold readers — which a mutation path may never call from inside its hold. Three call sites applying the rule from three copies is how the retention protection comes to hold in one of them and not another — the same drift §3.2 removes from the predicate itself by deriving it from the generator's constants.

The justification is that A removes the reaper's false positives: the indistinguishability §1.1 names is what had it acting correctly on false information. Under a token key a moved pane keeps its token, so an absent token now means a genuinely absent pane and the reaper's judgement becomes trustworthy. What remains worth protecting is the one case it still cannot judge: an unconverted old-format key, which is not evidence of a dead pane but of an unconverted entry — and is distinguishable by shape.

Three consequences follow from putting the protection on shape rather than on a call site:

- **`portal doctor --fix` keeps its documented prune unchanged.** The protection travels with the rule, so it holds wherever the rule lives. There is no "guard at the daemon call site versus inside `CleanStale`" split, and no window in which one `doctor --fix` run destroys every unconverted entry.
- **`portal doctor` stays green and keeps its "exit 0 iff all pass" contract.** A closed pane's entry is still deleted, so retained old-format entries are the only thing that persists — and §5.4 settles how the check treats them.
- **Retained entries do not accumulate without bound.** A live pane's entry is never stale, and a closed pane's entry is absorbed as it always has been. The retained set is the old-format residue only, which the out-of-band conversion (§8) clears.

**Accepted cost:** full retention — deleting nothing, ever — would have made a *future* key defect visible instead of silent, because the entries would still be sitting there. Shape-aware deletion does not preserve that property. What survives of it is §5.3, which is the part that was actually missing: the reaper never recorded what it took.

#### 5.3 The reaper names what it deleted

Each removed key is logged at **INFO** under the `hooks` component, **carrying the removed entry's `on-resume` command in the existing `value` attr** alongside `hook_key`. The existing per-key DEBUG line is **promoted, not duplicated** — one line per removed key, at INFO. Keeping both would put two lines per key in the log at exactly the level an operator raises to when investigating a loss, and the DEBUG line carries nothing the INFO line does not.

**The token alone would not answer the question this line exists to answer.** At the moment of deletion the token identifies nothing recoverable: the pane is by definition absent from the live enumeration, so there is no session, window or directory to resolve it against, and the entry holding the command is the thing being removed. `hook list`'s location column (§4.4) does not reach it either — that renders locations for entries that still exist. The command is what was actually lost, the store is holding it at the instant it deletes it, and `value` is already in the component's vocabulary (it rides `op=set` today, `internal/hooks/store.go:103,108`), so recording it adds no attr key and makes a reaped hook recoverable from one line rather than from a correlation hunt.

Today the per-key line is `logger.Debug("clean-stale", "op", "clean-stale", "hook_key", key, "via", "internal")` (`internal/hooks/store.go:220`) and production INFO gets only the batch summary `hooks: clean-stale op=clean-stale entries=N` from `storelog.EmitCleanStaleSummary`. At the production default level the log therefore cannot answer "what did I lose?" after the fact — which is why the two named instances in the investigation had to be reconstructed by correlating a registration breadcrumb against a bare count.

The batch summary is retained alongside. The existing `hooks` component attr vocabulary (`op`, `hook_key`, `value`, `via`, `entries`) is sufficient — no new component and no new attr key.

`portal doctor --fix`'s `Pruned stale hook: <key>` output is unchanged; it already named the key.

#### 5.4 The mass-deletion guard keys off live *panes*, not live *tokens*

`runHookStaleCleanup` carries one guard: an empty live set is treated as a bad tmux read rather than as authority, and the sweep defers to the next run with a WARN (`judgeAgainstLivePanes`, `cmd/run_hook_stale_cleanup.go`). `checkStaleHooks` carries the matching not-evaluable branch (`cmd/doctor.go`), and `pruneDoctorStaleHooks` documents that it deliberately adds no second guard.

Under lazy stamping (§2.2), **zero stamped panes is the ordinary steady state** — every pane before its first `hook set`, and the whole install during the upgrade window. If the guard tested the token set it would fire every 10s with a WARN naming a mass-deletion hazard that does not exist.

The guard's question is *"did the tmux read succeed?"*, which the **pane row count** answers. The token set answers a different question — *"which panes are protected?"* — and the two must not be conflated. This is why the enumeration returns one row per live pane including empties (§3.3): the guard counts rows, the stale comparison uses the non-empty subset.

`checkStaleHooks` is amended in step: its stale count is taken over token-shaped keys only, so retained old-format entries never push a healthy install to a non-zero exit code.

**The sweep is suppressed for the duration of a restore.** The interval between skeleton construction and the §2.3 re-stamp is one in which live panes carry no token, and the row-counting guard above is silent through it by design. A sweep landing there would see a full pane list, no tokens, and delete every token-keyed entry on the machine. This gap is created by the token key — a positional key resolved the moment a pane existed.

The daemon is already immune: `tick` reads `@portal-restoring` and returns before reaching `maybeRunHookCleanup` (`cmd/state_daemon.go`), so the whole idle branch is suppressed for the marker's lifetime — set at bootstrap step 3, cleared at step 8, bracketing restore at step 6. That early return protected only the capture path before this change; it is now load-bearing for hook retention and must not be relaxed or reordered.

`portal doctor --fix` has no such gate, and it is the command a user reaches for when a reboot looks wrong. The check therefore moves **into `runHookStaleCleanup`**, so it travels with the rule the way shape-awareness does (§5.2) rather than sitting at one call site: the sweep reads `@portal-restoring` before it loads the store and skips the cycle when set. **A stood-down cycle is identifiable in the log.** The sweep declines to run for six distinct reasons, and one line shape covers all of them: `op=clean-stale-skipped`, `via=internal`, and the existing `reason` attr naming which — `restoring` for a set marker, `marker-read-failed` when the marker read itself fails, `lock-timeout` for §6.5's bound, `empty-pane-read` for the guard above, plus `store-read-failed` when the `hooks.json` load fails and `pane-read-failed` when the `list-panes` enumeration itself fails. Those last two conditions are not new to the sweep; before this change they exited through paths that recorded nothing, and naming them is what makes every decline identifiable rather than only the three the guard cases cover. `reason` is already in the closed attr vocabulary (`internal/theme/events.go`, `internal/tmux/portal_saver.go`); the `op` value is new. Distinguishing them is the point: an operator raising the level because a hook vanished needs one grep to answer whether the prune stood down and why, rather than reading three indistinguishable lines by eye.

The restore skip is **DEBUG**, and never a WARN — a restore window is an expected state, and warning through every one of them names a hazard that is being avoided rather than encountered. The other two keep the WARN they already warrant: a lock that will not yield and a tmux read that came back empty are both anomalies. When the sweep skips for a set marker, `portal doctor --fix` names the skipped prune in its output the way §6.5 has it name a prune skipped for a lock timeout — the log line stays DEBUG, but a user who asked for a repair is told it did not run. The exit code is unaffected: it stays driven by the post-repair diagnosis, whose `checkStaleHooks` reports not evaluable in the same window. A failed read stands the cycle down exactly as a set marker does — the posture `portal state commit-now` already takes, and the conservative direction, since a deferred prune costs nothing — but under its own reason, so the line does not assert a restore the user is not running. With no server running the read fails and the sweep skips, which is the behaviour the existing empty-live-set guard already produces. The read is a tmux call and sits outside the lock (§6.4), alongside the pane enumeration. The marker read is reached through the same seam as the pane enumeration, so both surfaces are drivable from the unit lane.

`checkStaleHooks` takes the same reading, for the same window and a different reason. Its live set is a full pane list carrying no tokens, so the empty-set branch does not fire and every token-shaped key counts as stale — a read-only `portal doctor` run in that window would report every hook on the machine as lost and exit non-zero, on the command whose whole job is to tell the user whether that happened. It reads `@portal-restoring` by the sweep's rule, a failed read standing it down as a set marker does under its own reason, and reports its existing not-evaluable result rather than counting.


### 6. `hooks.json` Concurrency

#### 6.1 The open window

`internal/hooks` has no locking of any kind (`grep -rn 'sync\.\|Mutex\|flock\|Lock()' internal/hooks internal/fileutil | grep -v _test.go` → no matches). `Store.Set`, `Store.Remove` and `Store.CleanStale` are each `Load()` → mutate in memory → `fileutil.AtomicWrite`. `AtomicWrite` makes each *write* atomic; nothing guards the read-modify-write window, and the writers are in **different processes** — the CLI (`portal hook set`, fired by a Claude Code SessionStart) against the daemon's sweep every 10s, and CLI against CLI (a SessionStart in one pane concurrent with a SessionEnd in another).

```
daemon  CleanStale  t0    Load() → 41 entries
CLI     hook set    t0+e  Load() → 41, add K, AtomicWrite → 42
daemon             t0+d  writes its t0 snapshot minus stale → 40      K is gone
```

The end state is indistinguishable from the drift symptom: an INFO `hooks: set … hook_key=K` breadcrumb, K absent minutes later, and the intervening `clean-stale entries=1` naming a *different* key even at DEBUG.

**This is present but unquantified.** No observed loss is proven to be a race — the two named instances have ~4-minute gaps between registration and prune, which rules a race out for them. It is not ruled out for any other instance. The window is two file reads plus a marshal, so per-event probability is low; the daemon sweeps ~8,640 times a day against a 40+ pane working set.

It is untouched by A: durable identity does not close a lost update. It is included because the cost is small, the pattern is already in the codebase, and the alternative is knowingly leaving a silent-data-loss path open in the one file this work unit exists to protect.

#### 6.2 A sidecar lock file, never `hooks.json` itself

The lock is taken on a dedicated file derived from the resolved `hooks.json` path (`<hooks.json path>.lock`), so it follows a `PORTAL_HOOKS_FILE` override wherever it points.

Locking `hooks.json` itself would provide **no exclusion at all**. `fileutil.AtomicWrite` writes a temp file and `os.Rename`s it over the target (`internal/fileutil/atomic.go:77`), so the target's inode is replaced on every write — a lock held on the pre-rename inode is a lock on an unlinked file. The precedent this copies, `state.AcquireDaemonLock`, is correct precisely *because* it locks a dedicated `daemon.lock`.

The lock file is opened `O_CREAT` and **never unlinked**. `AcquireDaemonLock`'s inode cross-check and bounded retry ladder exist to absorb an unlink-and-recreate race; nothing here unlinks, so that machinery is deliberately not reproduced.

**The directory is created before the lock is acquired.** On a clean install the directory holding `hooks.json` may not exist, and the sidecar cannot be created inside a directory that does not exist — so ordering acquisition first would make the very first `portal hook set` on a fresh machine fail permanently by the rule in §6.5. A writer therefore ensures the config directory exists, then acquires. This is not a hole in the exclusion: directory creation is idempotent and races benignly (`MkdirAll` on an existing directory succeeds), and it mutates nothing the lock protects — `hooks.json` is untouched until the lock is held.

#### 6.3 Readers take a shared lock, writers exclusive

`flock` shared (`LOCK_SH`) for reads, exclusive (`LOCK_EX`) for the whole read-modify-write.

`Store.Load` is on the path of `hook list`, `LookupOnResume`, `checkStaleHooks` and the sweep's own pre-read. During a restore of a 40+ pane working set every hydrate helper calls `LookupOnResume` at once; a blanket-exclusive lock on `Load` would serialise them for no benefit.

The exclusive hold must span the **whole** mutation, not each file operation. `Set`, `Remove` and `CleanStale` each read, mutate and write; taking a shared lock to read and an exclusive lock to write would reopen the identical window. The exported methods acquire once and hold across their internal load and save.

**A lock is acquired once per operation and never nested.** `flock` is held per open file description rather than per process, so a second acquisition from the same process is not re-entrant: it blocks against the caller's own hold and resolves only at the §6.5 bound. Two rules follow. The exported methods reach the file through unexported non-locking load and save helpers, never by calling `Load` back through the front door. And a read's shared lock is released when the read returns, never handed back to its caller, so the sweep's advisory pre-read is no longer held by the time `CleanStale` takes the exclusive one and a sweep never waits on itself — which would put a 2s stall on the daemon's 1s tick loop every ten seconds, the outcome the bound exists to prevent.

**The stale decision is computed under the exclusive lock, never from the pre-read.** The sweep reads `hooks.json` twice: once at its call site (`runHookStaleCleanup`, to decide whether there is anything to do) and once inside `CleanStale`. `CleanStale` takes the **enumeration** as a callback, performs its own `loadSnapshot` before invoking it, and derives the delete set itself under its own lock — so the snapshot-before-enumeration ordering is structural rather than a call-site convention. Handing it a delete list computed by its caller would reopen the exact interleaving §6.1 diagrams — an entry written by `hook set` between the two reads would be deleted on the strength of a snapshot taken before it existed. Neither read feeds the empty-live-set guard, which counts pane rows from the tmux enumeration (§5.4).

**The call-site read is taken before the pane enumeration, and may only narrow the delete set.** The enumeration is a tmux read that sits outside the lock (§6.4), so it is always older than the mutation it feeds — and a `hook set` landing in that gap stamps its pane and writes its entry *after* it. That entry's token is absent from the live set and token-shaped, so the shape rule would delete it: a hook vanishing seconds after the command reported success, which is the loss this work unit exists to remove. Ordering the call-site snapshot **before** the enumeration closes it, because an entry written after the snapshot was necessarily stamped after it too — so a key the snapshot does not hold can never have been judged by that enumeration. The delete set is every key that is in the file under the lock **and** in the call-site snapshot **and** absent from the live set **and** either token-shaped or empty (§5.2). The call-site read may narrow that set; it may never widen it.

The shared lock is an ordering courtesy rather than a correctness requirement. `AtomicWrite` replaces the file by `os.Rename` (§6.2), so a reader observes a complete snapshot whatever a concurrent writer is doing — the pre-state or the post-state, never a torn one. This is what makes the read-side degradation in §6.5 safe.

#### 6.4 The locked region covers the file only

**No tmux call may sit inside the lock.** A lock spanning a tmux enumeration would let one hung tmux read block every `hook set` on the machine behind it.

This falls out of `CleanStale`'s own sequencing: it takes its snapshot first (§6.3) and the shared lock is released when that read returns, before the caller's enumeration callback runs, so the `ListAllPaneHookKeys` read and the guard on it (§5.4) both resolve with no lock held, and the only lock the sweep holds while calling tmux is none.

#### 6.5 Acquisition is bounded, and a timeout degrades rather than wedges

Acquisition waits, but not indefinitely. On timeout:

**A write that cannot take the lock does not write** — an unlocked write is the lost update D exists to close:

- the **daemon sweep** skips this cycle with a WARN and retries on the next 10s cadence — a deferred prune costs nothing, since stale entries are inert;
- `portal doctor --fix`, the sweep's other call site (§5.1), skips the same way and emits the same WARN (`op=clean-stale`, `via=internal`), and additionally prints one line naming the skipped prune alongside its `Pruned stale hook: <key>` output — a repair that silently did not run is the silence this work unit exists to remove. It does not fail the command: the exit code stays driven solely by the post-repair diagnosis, which reports whatever went un-pruned as stale;
- `hook set` and `hook rm` exit non-zero with the reason, rather than hanging a shell the user is sitting in.

**A read that cannot take the lock reads anyway**, unlocked, and logs at DEBUG. Correctness does not depend on the shared lock (§6.3), so failing a read would forfeit a hook for nothing:

- `LookupOnResume` — the hydrate helper, one call per restored pane, under the 40-helper burst that motivated the shared lock in the first place. A pane that came back and then hydrated to a bare shell because a lock file was busy would be this work unit reintroducing its own symptom;
- `checkStaleHooks` and `hook list` — read-only diagnosis and display; a lock problem must not make `portal doctor` report a hook problem.

**What each of those emits.** Two of the three need nothing new from the `hooks` component's vocabulary, because a lock timeout is an operation failing and the component already has a shape for that (`internal/hooks/store.go:73,103,144` — `logger.Warn(<op>, "op", <op>, …, "via", via, "error", err)`):

- the sweep's skip is that WARN under `op=clean-stale-skipped` with `via=internal`, `reason=lock-timeout` and the lock error in `error` (§5.4);
- `hook set` and `hook rm` emit the same WARN under their own `op` and `hook_key`, and the error is returned up through cobra, so the reason reaches the user on stderr by the route every other `hook` failure already takes. The log line and the stderr line are both present; neither stands in for the other.

The degraded read is the one genuinely new emission: DEBUG, `op=load-unlocked`, the lock error in `error`, and `via` naming the caller — `hydrate` for `LookupOnResume`, `doctor` for `checkStaleHooks`, the existing `cli` for `hook list`, and the existing `internal` for the sweep's advisory pre-read (§6.3), which degrades by the same rule and adds no value of its own. That adds **three `op` values** — `load-unlocked` here, `touch-save-requested` for the dirty-flag touch (§2.2) and `clean-stale-skipped` for a stood-down sweep (§5.4) — **two `via` values and no attr key**: the whole of this work unit's amendment to the closed logging vocabulary. `reason` and `value` are existing attr keys newly carried by the `hooks` component, not additions to it. No new component binding is needed — `cmd` already holds one for `hooks` (§2.2).

The same split governs the sidecar lock file failing to open or be created at all (§6.2): writes fail, reads proceed unlocked.

An unbounded `LOCK_EX` is simpler, and `flock` being kernel-released on process death rules out a *leaked* lock. It does not rule out a *held* one: a holder suspended by a signal or stuck on a hung filesystem keeps the lock for as long as it lives, and an unbounded acquire would park the daemon's **1s** tick loop behind it (`TickerPeriod: 1 * time.Second`, `cmd/state_daemon.go:424`) — so what stalls is the capture cycle itself, not the 10s-throttled prune that happens to sit on the same loop's idle branch. That is the blocking path the investigation named as the single riskiest part of this work unit. The project has had a wedged daemon before (the midnight day-roll deadlock), which is the concrete reason simplicity does not win here.

The bound is **2 seconds**. The critical section is one small-file read, a marshal, and a rename — sub-millisecond in practice — so 2s sits roughly three orders of magnitude above the expected hold while staying well inside the sweep's own 10s cadence. A timeout at that bound means something is genuinely wrong, not merely contended, which is what makes the WARN worth emitting. The bound is a package-level value the unit lane can lower, so the §9.2 timeout cases assert which side of the split each surface falls on rather than waiting out the production figure.


### 7. Removing the `@portal-id` Machinery

#### 7.1 Why it goes, and why now

`@portal-id` exists for exactly one reason: so a session rename cannot orphan a resume hook (spec `session-rename-orphans-resume-hook`, 2026-07-04). A token-only key (§3.1) carries no session identity at all, so **renames become irrelevant by construction** — A subsumes that fix's purpose, not merely its machinery.

Every non-test consumer of `@portal-id` exists to build the hook key and nothing else (`grep -rn "PortalIDOption\|@portal-id\|PortalID" internal cmd --include="*.go" | grep -v _test.go` → 21 lines across 7 files, one of them a doc comment in `cmd/run_hook_stale_cleanup.go`). A token-only pane key makes all of it dead at once.

The deciding argument is the supersession, not the dead weight. Retaining it would leave two identity systems, one inert, with source comments cross-referencing a key format that no longer exists — the exact "ship it and remember to delete it later" pattern rejected for the migration (§8).

#### 7.2 What is removed

| Site | What goes |
|---|---|
| `internal/session/create.go` | `PortalIDOption` const; the `SetSessionOption` stamp in `(*SessionCreator).CreateFromDir` (`:92`) |
| `internal/session/quickstart.go` | the `set-option -t <name> @portal-id <token>` link in the chained `ExecArgs` |
| `internal/state/capture.go` | the `#{@portal-id}` `captureFormat` column (replaced per §2.3) and the session-scoped lift into `Session.PortalID` |
| `internal/state/schema.go` | `Session.PortalID` |
| `internal/restore/session.go` | the `@portal-id` re-stamp; the `tmux.HookKey(sess.PortalID, …)` bake (replaced per §3.3) |
| `internal/tmux/tmux.go` | `HookKey`; the `@portal-id` conditional inside `HookKeyFormat` (replaced per §3.3) |
| `cmd/state_migrate_rename.go` | the whole file — see §7.3 |

`Session.PortalID` leaving the schema is a field **removal** from a tolerant-decode struct: an existing `sessions.json` carrying `portal_id` decodes fine and the value is ignored. No `SchemaVersion` bump, no migration — the mirror image of the field addition in §2.3.

`@portal-dir` is **untouched**. It is a separate stamp serving session grouping in the TUI, unrelated to hook identity.

#### 7.3 `portal state migrate-rename` goes; one reference to it stays

`cmd/state_migrate_rename.go` rewrites hook keys by `<oldName>:` prefix (`runMigrateRename`). Under a token key no key can carry a session-name prefix, so it can match nothing. It is already inert in production — registration never installs its hook, and `managedEvents` binds `session-renamed` to `notifyCommand` (`internal/tmux/hooks_register.go:22`) — but it is still registered as a hidden subcommand (`cmd/state_migrate_rename.go:71`). The command and its implementation are deleted.

**`migrateRenameSubstring` is not removable** (`internal/tmux/hooks_register.go:45`, consumed by `teardownFingerprints` at `:64-67`). It exists so `portal uninstall` reaps the inert `session-renamed` hooks that *older binaries* installed on the user's tmux server. That job outlives the command itself and must stay, with its comment intact.

#### 7.4 Replacement and removal ship together

Both halves land in one release.

**Accepted cost:** a misbehaving release cannot be bisected between "the new key works" and "the old machinery is gone". This is deliberate. Splitting them is the pattern rejected in §7.1 and §8, and this is a single-install tool that can be rolled back wholesale.


### 8. Migration

#### 8.1 No migration code ships

Existing `hooks.json` entries are keyed `<@portal-id or session_name>:<window>.<pane>`; the token-only key (§3.1) changes every key on disk. **No migration code is written, and none ships.**

Portal has one install and no evidence of any other, and every entry on that install resolves: `hooks.json` held 42 entries on 2026-08-22 and each one matched a live pane key. The conversion (§8.2) is therefore a complete transformation of the file rather than a partial one — no entry names a pane that is already gone and so could not be re-keyed. The user's call is that a second install, if one exists, is not worth carrying compatibility code for.

Three alternatives were rejected:

- **Using `CleanStale` as the migration** — the precedent from spec `resume-hooks-lost-on-server-restart` (2026-04-30), which accepted a breaking key change and let the sweep absorb the old entries. Repeating it here would silently destroy every existing hook on the first sweep after upgrade.
- **A one-release migration, isolated and deleted in the next release** — ships code whose whole purpose is to become obsolete, and leaves a removal the user has to remember.
- **An adoption rule inside the sweep** — re-keying an entry whose positional key resolves to exactly one live pane onto that pane's token, riding the enumeration the sweep already performs so the conversion needs no script. Rejected: once every key is a token the branch can never fire again, so it is dead code presented as general behaviour. It also cannot make the call §8.3 requires — dropping a superseded old-format entry rather than re-keying it over the newer one — because the sweep has no way to tell the two apart.

#### 8.2 The conversion is a throwaway script, outside this work unit

The re-key is a one-time transformation of one file on one machine: resolve each entry's positional key to its live pane, stamp a token on that pane, rewrite the entry under the token. It is authored as a script **outside Portal, and outside this specification and its plan**. It is not a deliverable here and no work item covers it.

#### 8.3 What makes that safe rather than reckless

§5.2. The reaper retains any key it cannot parse as a token, and an old-format key never can be, so:

- an unconverted entry sits **inert** rather than being deleted;
- a partial conversion costs nothing — the converted entries work, the unconverted ones wait;

The one thing not covered by code is ordering: an entry registered *between* the upgrade and the script's run is already token-keyed and needs no conversion, while one registered before it is old-format and does. Running the script after upgrading is the mitigation, not a code path.

**A pane can hold two entries by the time the script runs.** `hook set` fires on every Claude Code SessionStart, so during the lag below a pane that already has an old-format entry acquires a second, token-keyed one — and §5.2 retains the old one rather than reaping it. Re-keying that old entry would land it on the token the pane already carries and overwrite the newer command, or on a freshly minted token and orphan the newer entry for the reaper; either way the user gets back a resume command they had already replaced. The rule the conversion honours: **a pane that already carries a token has a current entry under it, and its old-format entry is superseded — dropped, not re-keyed.** Running the conversion promptly after the upgrading command keeps the overlap small; it does not remove it.

**Ordering covers the running daemon, not only the binary on disk.** The sweep runs inside `_portal-saver`'s `portal state daemon`, which keeps executing the pre-upgrade binary until a bootstrapping command replaces it (`EnsurePortalSaverVersion`, bootstrap step 5) — and `hook` is bootstrap-exempt (§2.2), so registering a hook will never do it. A pre-upgrade sweep is not shape-aware and does not recognise a token key, so while that lag lasts every token-keyed entry — one written by a post-upgrade `hook set`, or the whole file the moment the conversion completes — is deleted within 10s, by the rule that was correct for the binary running it. That is the outcome §8.1 rejects "using `CleanStale` as the migration" to avoid, arriving through a different door. Running any bootstrapping command (`portal open`) before registering or converting is what closes it. The same lag has a second edge: a pre-upgrade daemon captures the pre-upgrade `captureFormat`, so a server death before it is replaced leaves restore with no saved token for any pane.

**Conversion moves an entry out of the protected class before its token is durable.** An unconverted entry is retained forever because it is not token-shaped; the moment the script re-keys it, it becomes reapable. Between that re-key and the daemon's next capture, the token exists only as a tmux pane option — so a server death in that window leaves restore with no saved token for the pane, no live pane answering to the key, and the reaper deleting the entry under the ordinary rule. The window is the same one `hook set` narrows by touching `save.requested` (§2.2), and the same mitigation is available to the script: touch it after the last conversion, or simply run `portal state commit-now`. The residual is identical in kind to the one §2.2 accepts, and the same acceptance applies — but it belongs stated here, because §8.3's safety argument otherwise reads as covering entries it does not.

#### 8.4 The user's own integration

`~/.claude/hooks/portal-resume-hook.sh` (§1.3) is named here only because the conversion script and the hook script are the same person's job on the same day.

It fails safe in the meantime: the script documents the coupling, an unrecognised key scheme yields an empty key, and its guards then refuse to remove anything. So a key-scheme change degrades it silently rather than erroring — its SessionEnd branch stops deregistering, and those entries are absorbed by the reaper exactly as they always have been.


### 9. Testing

#### 9.1 Lane placement

The project's lane rule is binding: every test that builds a `portal` binary, spawns a `portal state daemon`, or execs a built `portal` binary carries `//go:build integration`; the unit lane holds the rest, including the fast real-tmux **client** tests under `internal/tmux/*_realtmux_test.go` (per-test `-L` sockets, no daemons, no subprocess binaries).

Two consequences for this work:

- The tmux behaviours B rests on are pinned in `internal/tmux` real-tmux client tests, where that pattern already lives. A `cmd`-level test then asserts the CLI propagates the failure, with its `*Deps` seam injected — `cmd`'s `TestMain` poisons `TMUX` package-wide, so a real-tmux `cmd` test would have to supply its own socket and is avoided.
- Anything driving restore's arm phase execs `portal state hydrate` through `respawn-pane -k`, so it is integration-lane and builds its binary via `portalbintest`.

#### 9.2 New tests

**The gap that let this bug live for months** is that no test ever moved a pane. The existing cross-site tests prove every site derives the same key for a pane *at rest* — the case that works.

| Test | What it asserts | Lane |
|---|---|---|
| **A pane that moves keeps its hook** | Register a hook; `break-pane` it out, close an earlier window under `renumber-windows on`, `move-pane` it back, `move-pane` it to another session; the hook still resolves after each. | unit (real-tmux) |
| **Non-contiguous saved window indices** | Restore a session whose saved window indices are non-contiguous, with `renumber-windows off` (tmux's default, not the user's setting); assert the hook fires **and** survives the post-restore sweep. This is the H6 case — it fires correctly once today and then dies. | integration |
| **The existence probe separates the three cases** | Driven through `tmux.ResolveHookKey` against a live server, so what is measured is Portal's own argv: a pane id no pane answers to fails; a live pane carrying no pane options at all resolves with an empty token; a stamped pane resolves to its token. This is what pins §4.1's rule that the `show-options` probe names no option — naming it makes a live unstamped pane indistinguishable from a gone one, which a fake `Commander` modelling the intended semantics cannot catch. The raw tmux facts B rests on are asserted alongside: `set-option -p -t %999 @portal-pane-id X` exits non-zero, unlike `display-message -p` against the same target, which exits 0. | unit (real-tmux) |
| **`hook set` on an unresolvable `$TMUX_PANE`** | Exits non-zero and writes nothing to `hooks.json`. | unit |
| **`hook rm` on an unresolvable `$TMUX_PANE`** | Exits non-zero and writes nothing, while `hook rm --pane-key <a seeded key>` still removes it and exits 0 with no tmux read at all (§4.3). | unit |
| **`hook set` reuses an existing token** | With the seam returning a token for the pane, a second registration writes under that same key and issues no `set-option` (§2.2). | unit |
| **Reaper shape-awareness** | An old-format (non-token) key is retained by both the daemon sweep and `portal doctor --fix`; a token-shaped key whose token is absent is still deleted; the deletion names the key **and the removed entry's command** at INFO rather than only counting it (§5.2, §5.3). | unit |
| **A failed dirty-flag touch does not fail `hook set`** | With the state directory unresolvable, `hook set` still exits 0 with the entry written, and emits the WARN under `op=touch-save-requested` (§2.2). | unit |
| **`portal doctor` exit code stays 0** | With retained old-format entries present (§5.4). | unit |
| **No spurious mass-deletion WARN** | A server with hooks present and zero stamped panes does not emit the guard's WARN (§5.4). | unit |
| **An empty key fires on nothing** | A `""` entry in `hooks.json` fires on no restored pane; `collectArmInfos` bakes no empty key (§3.4). | unit |
| **Lost update** | Interleaved writers across the `Load`→`AtomicWrite` window; no entry disappears. **The assertion must exercise the `AtomicWrite` rename specifically** — two writers will usually serialise by luck and pass against a broken lock, so the test must show exclusion holds across an inode swap, which is what a lock taken on `hooks.json` itself would fail (§6.2). A second case covers the sweep specifically: an entry registered after the sweep's call-site snapshot — and so after the pane enumeration that follows it — survives, which is what pins both the locked derivation and the snapshot-before-enumeration ordering (§6.3). | unit |
| **The sweep and the check stand down during a restore** | With `@portal-restoring` set, `runHookStaleCleanup` deletes nothing and `checkStaleHooks` reports not-evaluable rather than counting every token-shaped key as stale; a failed marker read stands both down the same way, under its own reason and phrase (§5.4). | unit |
| **A lock timeout degrades by side** | With the sidecar lock held elsewhere: `hook set` and `hook rm` exit non-zero and leave `hooks.json` byte-identical, and the sweep deletes nothing and WARNs, while `LookupOnResume`, `checkStaleHooks` and `hook list` return their data anyway and log `op=load-unlocked` at DEBUG (§6.5). | unit |
| **Removing nothing is non-zero every way** | `hook rm` on a live, stamped pane whose token has no entry exits non-zero, and `hook rm --pane-key <key naming no entry>` exits non-zero, both leaving `hooks.json` byte-identical (§4.2, §4.3). | unit |
| **Restore re-stamp failures are surfaced** | A failed pane re-stamp produces a WARN naming the session and pane, and does not abort the restore (§2.4). | unit |
| **`armPanes` short-list stamps nothing** | With live and saved pane counts differing, the unpaired remainder carries no token (§2.4). | unit |
| **`hook list` fourth column** | Over a fixed enumeration: renders the resolved location for a live token, and an empty fourth field for a token no row carries (§4.4). | unit |

#### 9.3 Existing tests to re-point or retire

- **`internal/tmux/resolve_hookkey_realtmux_test.go`** — its comment states the `:.` behaviour outright: *"tmux 3.7's display-message tolerates a bogus -t target (it returns `:.` with exit 0), so killing the server first is the only reliable way to drive the read-failure path."* The knowledge was in the repo the whole time, filed as a testing obstacle rather than a bug. Its premise changes: the bogus-target case is now a real failure, via `set-option -p`.
- **`internal/tmux/hookkey_cross_site_realtmux_test.go`**, `hookkey_format_realtmux_test.go`, `hookkey_realtmux_shared_test.go`, `hookkey_test.go`, `list_all_pane_hookkeys_realtmux_test.go` — re-pointed at the token key and the token enumeration.
- **`cmd/hookkey_no_regression_upgrade_test.go`** — asserts an un-stamped session's name-keyed hook survives, which is precisely the `@portal-id` fallback branch being deleted. Retired.
- **`cmd/rename_restore_cleanup_survival_integration_test.go`**, `internal/restore/rename_reboot_hook_integration_test.go`, `rename_reboot_durability_integration_test.go` — these prove the July rename fix. Renames are now irrelevant by construction (§7.1), so what they should assert is that a rename *still* cannot orphan a hook, now for a different reason. Re-pointed, not retired: the user-visible guarantee is unchanged and is worth keeping under test.
- **The seeded keys in the destructive integration suites** — `internal/transienttest.SeedHooksJSON` (`internal/transienttest/hooks.go:38`) writes whatever `{key: command}` map its caller hands it and carries no key literal of its own, so the helper is unchanged and the shapes are re-pointed at each of the four seeding call sites: `cmd/cleanstale_transient_listpanes_shared_test.go:48-50` (`alpha:0.0` / `beta:0.0` / `gamma:0.0`), `cmd/cleanstale_transient_listpanes_doctorfix_integration_test.go:91-94` (`live:0.0` / `gone:0.0`), `cmd/bootstrap/transient_listpanes_helpers_integration_test.go:104-105` (`smoke:0.0` / `smoke:1.0`), and `cmd/state_daemon_hook_cleanup_integration_test.go:43,89-92`. The last one also reads its *live* key with `tmux.StructuralKeyFormat` (`:80-81`), which is a structural key rather than a hook key after this change: it reads the pane's token instead.
- **The three fakes behind the `cmd`-side enumeration seam** — the seam itself changes with the enumeration (§3.3), and three unit-lane files in `cmd` implement or drive it and do not compile until they follow: `cmd/bootstrap_production_test.go:91` (`stubAllPaneLister`), `cmd/doctor_test.go:802` (`fakeHookLister`), and `cmd/run_hook_stale_cleanup_test.go:19` (`recordingHookKeyLister`, whose `:261-273` subtest asserts the sweep enumerates through this method). The first two also carry old-format key literals — `a:0.0` / `b:0.0` (`cmd/run_hook_stale_cleanup_test.go:35-36,98,140,158-161`) and `sessA:0.0` / `sessB:0.0` (`cmd/doctor_test.go:854,861,903,946`) — re-pointed at tokens alongside the seam, and `cmd/run_hook_stale_cleanup_test.go` additionally covers the row-counting guard of §5.4.
- **`internal/session/create_test.go`**, `quickstart_test.go`, `internal/state/*`, `internal/restore/session_test.go`, `cmd/hooks_test.go`, `cmd/state_hydrate_test.go` — updated in step with §7.2.
- **`internal/restore/multipane_legacy_integration_test.go`** — builds its expected keys with the deleted `tmux.HookKey` (`:54,55,171,204`) and drives `session.PortalIDOption` / `Session.PortalID` directly (`:89-90,103,200`), so the `restore` integration lane does not compile until it is dealt with. Its multipane restore coverage is re-pointed at the pane token; its un-stamped-name-fallback subtests cover the branch §7.2 deletes and retire with `cmd/hookkey_no_regression_upgrade_test.go`.
- **`internal/restore/rename_reboot_shared_test.go`** — the `renamePortalID` scaffolding (`:16`) shared by the two re-pointed rename-reboot tests; amended with them.
- **`cmd/state_daemon_run_test.go`** — its `oneSession()` fixture (`:207-212`) fabricates a `captureFormat` pane row whose trailing column is the `@portal-id` field §2.3 swaps for `@portal-pane-id`; the field count is unchanged at 11, the column's meaning is not.

#### 9.4 Guards

Two literal-binding guards exist for `@portal-id`:

- **`cmd/portal_id_binding_guard_test.go`** asserts `session.PortalIDOption == "@portal-id"` and that `tmux.HookKeyFormat` contains it. `cmd` can import both packages cycle-free, which is what lets the constant and the format string be compared at all.
- **`internal/state/portal_id_literal_guard_test.go`** asserts `captureFormat` contains the literal, spelled out rather than imported because `internal/session` transitively depends on `internal/state` and the import would cycle.

**Both are deleted, not re-pointed.** They exist because the `@portal-id` literal was written in two places that could not import one another. The single home in `internal/state` (§2.1) removes that condition. A guard binding two copies of a literal has nothing left to bind when there is one copy.

The hazard the guards encode is answered by construction instead of by assertion, which is the stronger form: a drift the compiler makes impossible cannot be introduced by someone who never ran the guard.

#### 9.5 The positional siblings are checked, not assumed separate

The positional siblings (§1.3) are not changed, but the addressing assumption is identical, so their existing coverage is run against the change rather than assumed unaffected — specifically that a restore whose window indices are renumbered still pairs FIFOs and markers correctly, which is the §9.2 non-contiguous-index test observing a second surface.


---

## Working Notes

---

## Corrigenda

> **Corrigendum 2026-08-30** (from `implementation/resume-hooks-silently-lost`): "The sweep now declines to run for three distinct reasons … `restoring` for the marker, `lock-timeout` for §6.5's bound, `empty-pane-read` for the guard above" — corrected: the sweep declines for five, the three named plus `store-read-failed` (the `hooks.json` load failed) and `pane-read-failed` (the `list-panes` enumeration itself failed). Both conditions predate this change and previously exited through paths that recorded nothing; naming them is what makes every decline identifiable.

> **Corrigendum 2026-08-30** (from `implementation/resume-hooks-silently-lost`): "The predicate's **home is `internal/session`, beside the generator**" and "`internal/session` is the only home that permits the derivation, because `suffixLen` is **unexported** (`internal/session/naming.go:11`); `NanoIDAlphabet` is exported but the width is not", together with the cycle analysis sanctioning an `internal/hooks` → `internal/session` import — corrected: the generator and the predicate both live in `internal/nanoid`, a stdlib-only leaf holding `Alphabet`, two unexported widths — a general-purpose `width` behind `NewGenerator` and `paneTokenWidth` behind `NewPaneTokenGenerator` — and `IsTokenShaped`, which reads the pane-token width. `cmd/hooks.go` reaches the leaf directly, `internal/hooks` imports it, and `internal/hooks/leaf_guard_test.go` now forbids the `internal/session` import the spec had sanctioned. The invariant the section argued for — recognition derived from the generator's own constants, so generation and recognition cannot drift — is preserved and strengthened by the move.

> **Corrigendum 2026-09-01** (from `implementation/resume-hooks-silently-lost`): §5.1's third signed-off line, "`Skipped stale hook prune: could not read live panes`", covering the empty-live-set guard — **withdrawn**, not reassigned. The guard is a *successful* read that returned no panes, while the words read most naturally as a read that failed, so neither branch keeps them: the guard renders `live pane list came back empty` and the failed enumeration renders `could not enumerate live panes`, which is what the read-only diagnosis already said for that reason. The other two §5.1 lines are unchanged. `notEvaluableDetails` also gains its missing `lock-timeout` entry (`hooks.json is locked (not evaluable)`), so all five reasons render a phrase on both surfaces — vocabulary completeness rather than an observed leak, since `lock-timeout` cannot reach that path today (a lock acquisition failure degrades to an unlocked read).

> **Corrigendum 2026-09-01** (from `implementation/resume-hooks-silently-lost`): §6.5's "The bound is **2 seconds**", read together with the emission paragraph's "the existing `internal` for the sweep's advisory pre-read (§6.3), which degrades by the same rule and adds no value of its own" — corrected: **there are two bounds, not one.** The clean's advisory pre-read is bounded separately at a hundredth of the 2s figure — 20ms in production — **floored at one poll interval**, and it is written as that fraction rather than as a value of its own, so the relationship is visible where the value is. The floor is load-bearing, not a rounding detail: "a hundredth of `lockTimeout`" alone is false below a 500ms bound, which is where every unit-lane figure sits, and the acquire re-tests its deadline only after a poll sleep, so every bound shorter than one interval costs that same one interval. It follows that the derivation does **not** lower the pre-read bound proportionally under test — between a 500ms and a 20ms mutation bound the pre-read stays at one poll interval.
>
> The second bound exists because a clean takes the sidecar twice, shared for the pre-read and exclusive for the deletion (§6.3): at the full bound a writer that is alive but stuck would park the daemon's 1s tick for two bounds every cycle, and the shorter figure caps a contended cycle at one. The pre-read is advisory, so degrading costs a DEBUG breadcrumb and nothing else. The accepted price is that ordinary contention — a concurrent `hook set` holding the exclusive lock for a few milliseconds — routinely falls through to the unlocked read and emits `op=load-unlocked` at DEBUG with `via=internal`, where the 2s bound would almost always have waited it out. That volume is expected and is not a signal of contention worth investigating.

> **Corrigendum 2026-09-01** (from `implementation/resume-hooks-silently-lost`): §1.3's "`internal/tmux`'s `StructuralKeyFormat` / `ResolveStructuralKey` / `ListAllPanes` … are checked against the change (§9), not changed by it" — corrected: `ResolveStructuralKey` and `ListAllPanes` were deleted during this work unit, along with `ListPanes`. Their only callers were the hook paths this change replaced, so the replacement left them with none. `StructuralKeyFormat` survives and the section's argument holds for it: the positional siblings that remain are rebuilt from live coordinates each bootstrap, so drift has no window.

> **Corrigendum 2026-09-01** (from `implementation/resume-hooks-silently-lost`): the 2026-08-30 corrigendum's own text, "a stdlib-only leaf holding `Alphabet`, the unexported `width`, `NewGenerator` and `IsTokenShaped`. `internal/session/panetoken.go` forwards to it" — corrected: the forwarder was deleted and `cmd/hooks.go` reaches the leaf directly, and the leaf now holds **two** unexported widths — a general-purpose `width` behind `NewGenerator` and `paneTokenWidth` behind `NewPaneTokenGenerator`, which is the width `IsTokenShaped` reads. The split decouples `hooks.json`'s on-disk key-recognition contract from the session-name suffix width, so moving the suffix width is no longer a migration event. A source guard pins the mint to the pane-token generator, since both widths are 6 today and the swap would otherwise be invisible.

> **Corrigendum 2026-09-01** (from `implementation/resume-hooks-silently-lost`): §9.1's "The project's lane rule is **unchanged** and binding: every test that spawns a `portal state daemon` or execs a built `portal` binary carries `//go:build integration`" — corrected: the rule has three clauses, not two. A test that **builds** a portal binary also carries the tag. No test placement this specification prescribes is invalidated — every integration test it names still qualifies under the wider rule.

> **Corrigendum 2026-09-01** (from `implementation/resume-hooks-silently-lost`): §5.4's citation of `cmd/run_hook_stale_cleanup.go:41-47` for the empty-live-set guard — corrected: the guard is `judgeAgainstLivePanes` in the same file; the cited lines now hold two entries of the stand-down phrase map. Prose location only; the invariant is unchanged and still shared by the sweep and the diagnosis.

> **Corrigendum 2026-09-01** (from `implementation/resume-hooks-silently-lost`): §6.3's "`CleanStale` receives the **live token set** and the **call-site snapshot's key set**" and §6.4's "`runHookStaleCleanup` takes its call-site snapshot first" — corrected: `CleanStale` takes the *enumeration* as a callback and performs its own `loadSnapshot` before invoking it; the call site hands over no snapshot. The ordering the sections argue for — snapshot strictly before enumeration, narrowing only — is preserved and strengthened, because a caller can no longer get the order wrong.

> **Corrigendum 2026-09-04** (from `implementation/resume-hooks-silently-lost`): "The sweep declines to run for five distinct reasons … `restoring` for the marker" and the requirement-table line "a failed marker read produces the same result as a set marker" — corrected: the sweep declines for **six**, the five named plus `marker-read-failed` when the `@portal-restoring` read itself fails. A failed read takes the same *posture* as a set marker — the cycle stands down and the diagnosis reports not-evaluable — but under its own reason and its own phrase (`could not read the restore marker`, on both the `--fix` line and the read-only diagnosis) rather than the restore wording. The split is load-bearing rather than cosmetic: `hook` and `doctor` are bootstrap-exempt and start no server, so a read-only `portal doctor` on a machine with no tmux server running is the ordinary path into that branch, and the specification's own argument for naming a decline — that an operator greps one value to learn why — is defeated by a phrase asserting a restore the user is not running.

> **Corrigendum 2026-09-04** (from `implementation/resume-hooks-silently-lost`): "through `shellQuoteSingle`" — corrected: `shellQuoteSingle` → `internal/shellquote`'s `Single`, throughout. The quoting rule was extracted into a stdlib-only leaf so `restore`, `session` and `spawn` each reach it without an edge between them; the substitution the sentence records is implemented byte-for-byte through the moved function.

> **Corrigendum 2026-09-06** (from `implementation/resume-hooks-silently-lost`): "The staleness test lives in a single **unexported** function" and "`StaleKeys` … is that function behind the shared lock … `CleanStale` … never through `StaleKeys`: an acquisition from inside the exclusive hold is not re-entrant" — corrected: the rule lives in one **exported** `StaleKeys`, and both callers reach it directly, `CleanStale`'s deletion pass included. The exported/unexported pair the sentence described was a wrapper whose whole body called its twin with an identical signature; it has been collapsed. The re-entrancy reasoning never applied to this call: `StaleKeys` takes an already-loaded snapshot and acquires nothing, in this work unit and before it, so no acquisition occurs inside the exclusive hold. The property §6.3 protects is unchanged and is enforced by a source guard forbidding the mutation paths from calling the locking entry points (`Load`, `List`, `Save`, and the shared-hold readers).

> **Corrigendum 2026-09-10** (from `review/resume-hooks-silently-lost`): the 2026-09-06 corrigendum's own text, "enforced by a source guard forbidding the mutation paths from calling the locking entry points (`Load`, `List`, `Save`, and the shared-hold readers)" — corrected: `Save` is not a locking entry point and no longer exists — the exported `Save` was removed in this work unit, and a mutation reaches the file through the unexported `save`, which locks nothing. The guard names neither side: a mutation is whatever `Store` method takes the mutation lock, and a front door is whatever `Store` method reaches `acquireLock` through any chain of receiver calls, so a rename on either side is judged rather than slipped past.

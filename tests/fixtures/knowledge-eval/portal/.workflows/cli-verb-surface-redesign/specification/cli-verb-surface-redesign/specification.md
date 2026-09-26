# Specification: CLI Verb Surface Redesign

## Specification

## Overview

Portal's CLI is redesigned in one intentional pass. Today's surface grew by accretion into overlapping, blurry session verbs (`open`, `attach`, `spawn`) with illegible input domains — the trigger being that even the author can't cleanly recall the difference between `open` and `attach`. This redesign audits the **full** command list (session verbs, utilities, and internal plumbing) against a single governing principle and two axioms.

### Governing principle: split the public surface by outcome, not by input shape

The public surface names *what happens*, not *what the argument looks like*. Input domains (session name, path, alias, zoxide query) are unified inside `open`'s resolution rather than made legible by choosing a different verb. Exactness (no-guessing) is demoted from a public verb to documented flags and hidden plumbing.

Concretely, this collapses today's three public session verbs into a single public verb, `open`. `open` keeps its name on semantic grounds — the portal metaphor ("you are opening a portal to a session") is the tool's founding play on words; the argument changes only how the destination is derived, not what the verb does. The name was kept explicitly **not** on migration-cost grounds.

### The two axioms

**Axiom 1 — absorb / net-N.** `open` opens N portals to N targets; the invoking terminal is one of those N surfaces. This is continuous in N: at N=1 the terminal is the only surface (open-here); at N>1 the terminal becomes one surface and N−1 host-terminal windows are spawned. There is no behavior cliff between single-target and multi-target — the "stay put while multi-opening" behavior is a deferred future flag, not the default.

**Axiom 2 — attach-vs-mint dichotomy.** A resolved target is one of two kinds:
- **Session-domain hit** (exact session name, session glob) → **attach** to that existing session.
- **Directory-domain hit** (path, alias, zoxide query) → **mint a brand-new session** at that directory, always.

There is no find-or-create. Directory targets always create a fresh `{project}-{nanoid}` session even when sessions already exist for that project (multiple sessions per project is the designed workflow). The precedence chain is therefore semantic — "surface an existing session, or open a new portal to a place" — not mere disambiguation.

### Porcelain / plumbing split

Truly-internal entry points stay invocable but hidden rather than public: the `--ack` receipt flag on `open`, and the entire `state` namespace (argv-invoked by tmux hooks and the saver pane). Everything a human is meant to type is public and documented.

### Scope of the redesign

In scope: the public verb surface and tiering (public / hidden), command names, shapes, and the back-compat posture. Out of scope: internal package/component/marker names (`internal/spawn`, the `spawn` log component, `@portal-spawn-*` markers) — these are unaffected by the redesign.

---

## `portal open` — Grammar & Target Resolution

`portal open` is the single public session verb. `x` (the shell function emitted by `portal init`, `x() { portal open "$@" }`) maps to it unchanged.

### Invocation grammar

| Invocation | Behavior |
|---|---|
| `portal open` (no args) | Launch the TUI picker — this is how you choose a destination |
| `portal open <target>` | Resolve the single target and connect this terminal to it |
| `portal open <t1> <t2> … <tN>` | Open N surfaces (absorb/net-N); this terminal becomes one, N−1 host windows spawn |

### Target resolution precedence

A bare positional target is resolved in three steps:

1. **Search-sigil pre-check.** If the target begins with `/` and contains no further `/`, it is a **session-search sigil**: the text after the `/` is forced into a session search and the target never enters the chain below. The path test in step 3 is narrowed by exactly this shape — `/tmp` is a sigil, while `/tmp/` and `/Users/leeovery/Code/portal` remain path targets. See the `open-with-forced-filter` specification, which owns the form, its outcomes, and the `-p` escape for minting at a single-segment absolute directory.
2. **Glob pre-check.** If the target contains glob metacharacters (`*`, `?`, `[…]`), it is **session-domain by construction**: expand it against live session names and skip the chain below entirely (see Glob Targets). Zero matches ⇒ unresolvable ⇒ hard fail.
3. **Otherwise, the precedence chain**, first match wins: **exact session name → path → alias → zoxide query**.

Each domain maps to an outcome per Axiom 2:
- **exact session name** → attach existing session
- **path** (existing directory) → mint new session there
- **alias** (known alias key) → mint at aliased dir
- **zoxide query** → mint at zoxide's best-match dir

**Session set — user-visible only.** All session-domain resolution — exact-name match, session-glob expansion, and the `-s/--session` pin — matches only against the **user-visible session set** (the same leading-underscore-filtered `ListSessions` view used by the picker and tab completion). Portal's internal `_portal-saver` / `_portal-bootstrap` (and any future `_`-prefixed) sessions are therefore **never matchable as `open` targets** — a name or glob that would resolve only to a filtered internal session is treated as a miss (falls through / hard-fails), exactly as if it did not exist. This keeps the internal sessions' "invisible / never a user surface" contract intact and prevents `open _portal-saver` from attaching a user to Portal's own plumbing.

Session-name vs directory-name collisions are rare (`{project}-{nanoid}` names don't look like paths) and resolved by precedence.

### Bare project shorthand does not reattach (accepted consequence)

Because directory hits always mint (Axiom 2, no find-or-create), a bare project name like `open api` never exactly-matches a running `api-x7Kd9a` session — it falls through to zoxide/path and mints a **new** session, even while an `api-*` session runs. Reaching an existing session is done via the picker, a session glob (`'api-*'`), or the `-s` pin. Project-prefix session matching (`api` → the sole `api-*` session) is explicitly **rejected** — it reintroduces attach-vs-create guessing with an ambiguity cliff the moment a second `api-*` session exists.

### Miss handling — total miss is a hard fail

**A target that resolves to nothing is a hard failure, at every arity and every form.** Today's terminal step of the resolution chain — a TUI-picker-with-filter fallback — is **removed**. The error message points at the escape hatch, e.g.:

```
nothing resolved for 'blog' — try -f blog
```

The `-f/--filter` flag (see the flags topic) is what makes the filtered-picker mechanic reliable and explicit, replacing the removed implicit fallback.

### Wrong-guess feedback — tmux is the receipt

There is **no dedicated confirmation surface** when resolution guesses wrong (e.g. a wrong zoxide guess silently mints a session). A receipt line has nowhere reliable to live: outside tmux, `open` exec-replaces itself and pre-exec output is swallowed by the alternate screen; inside tmux it lands in the pane you switched away from. What the user reliably sees is tmux itself — the status bar shows the `{project}-{nanoid}` session name (which encodes the resolver's choice) plus the pane cwd. A wrong guess is self-announcing at the destination; recovery is `kill` + retry with a domain-pinning flag.

One observability addition is locked: **`open` logs its resolution decision**, e.g. `resolve: 'blog' → zoxide → ~/Code/blog`, so a confusing guess is reconstructable from `portal.log`. The line is emitted from the `open` command body (`cmd/open.go`), where resolution is driven — `internal/resolver` stays a pure, log-free library.

This requires a **governed amendment to Portal's closed log taxonomy**: this feature adds **one new component, `resolve`**, to the closed component set. `open` owns no log component today (it logs only exec markers under `process` and the spawn burst under `spawn`, neither of which fits a resolution decision), so resolution has no existing home. The `resolve` component carries the decision line with attr keys `target` (raw input), `domain` (session / path / alias / zoxide, or `miss` on a total miss), and `resolved_path` (resolved directory, or resolved session name for a session hit; empty on a miss). This is a spec-recorded amendment, **not** a call-site invention (which the log spec prohibits); planning wires the single `log.For("resolve")` binding in `cmd/open.go`.

The line's behavior:
- **Level: INFO** — a guess must be reconstructable *after the fact*, which DEBUG (silent by default) could not guarantee; INFO is consistent with the existing per-`open` `process: exec` INFO line.
- **Guessing-chain targets only** — a `resolve` line is emitted only for a bare positional resolved *through the chain* (session → path → alias → zoxide). Explicit pins (`-s`/`-p`/`-z`/`-a`) **and glob targets** are deterministic — no guessing — so they emit no `resolve` line; the component stays focused on guesses. (A glob's expansion to K session targets is still visible via the burst's own `portal.log` records.)
- **Emitted on a miss too** — a total miss uses `domain = miss` with an empty `resolved_path`; the user-facing hard-fail error (stderr) is separate.
- **One line per resolved guessing-chain target** — a multi-target burst emits one per such target.

---

## `portal open` — Flags & Command Passthrough

### Domain-pinning flags

The domain-pinning flags name a target's domain explicitly, skipping the guessing chain. They exist primarily for scriptability and for reaching a domain shadowed by a higher-precedence match; humans typically use bare targets.

| Flag | Pins to | Semantics on that domain |
|---|---|---|
| `-s/--session <name-or-glob>` | exact session / session glob | attach; hard fail on miss; never mints |
| `-p/--path <dir>` | directory path | mint new session; dir must exist |
| `-z/--zoxide <query>` | zoxide best match | mint at matched dir; hard fail on no match; **explicit error if zoxide not installed** |
| `-a/--alias <key-or-glob>` | alias key / key glob | mint at aliased dir; hard fail on unknown key |
| `-f/--filter <text>` | (none — picker redirect) | opens the picker pre-filled with `<text>`; skips resolution entirely |

Notes:
- `-z` differs from the guessing chain on zoxide-absence: pinned `-z` **errors** when zoxide is not installed (`ErrZoxideNotInstalled`), whereas the bare-target chain treats any zoxide error as "continue to next domain" (falls through silently).
- `-a` is the only way to reach an alias key shadowed by a same-named session, and rounds out the four resolution domains.
- `-e` is already `open`'s run-command flag (see Command Passthrough) — it is not available as a pin letter.

### Pinned-domain contract — never falls back to the picker

**Every domain pin (`-s`, `-p`, `-z`, `-a`) hard-fails on unresolvable and never falls back to the TUI picker** — a spawned window or script must never pop a TUI. `--session` never mints (a bare name has no directory to mint from); `--path` / `--zoxide` / `--alias` mint per Axiom 2 on a hit and hard-fail on a miss. Only bare positionals run the guessing chain; only `-f` opens the picker.

### `-f/--filter` is the sole non-composing flag

`-f` is not a target — it is a "skip resolution, open the picker pre-filtered" redirect. It is **mutually exclusive** with positional targets and with every other pin flag (usage error otherwise).

Plain `-f <text>` (no command) opens the picker on the default **Sessions** page with the text pre-filled — matching the removed implicit picker-with-filter fallback it replaces; the user can toggle to Projects from there. The command variant `-f <text> -e <cmd>` is the stated exception: a filtered **Projects** (mint-only) picker (see the multi-target topic).

### Command passthrough (`-e` / `--`) — mint-scoped

`open -e <cmd>` and `open <target> -- <cmd> args…` run a command in newly-created sessions (the "open this project with claude running" mechanism), fed to `CreateFromDir` / `QuickStart` as the pane's initial process.

- **`-e` and `--` are two spellings of the same single command — specifying both is a usage error.** There is exactly one command per invocation; `-e` and `--` cannot coexist. This keeps the "one command per mint surface" and command-parity guarantees resting on an unambiguous source.
- **The command targets mint surfaces only.** A freshly-minted session has a clean pane to *be* the command's process. An existing (attach) session has no safe injection channel (see the safety note), so a command can never run in an attach target.
- **Mixed sets are allowed; the command is scoped to the mint targets.** Mint-vs-attach is known per-target at resolve time, so the command is baked only into mint targets' invocations; attach targets get their `--session` with no command. `open api ~/new -e claude` → attach `api` as-is **and** mint `~/new` running claude, in two surfaces.
- **Zero mint targets + a command ⇒ usage error.** `open api web -e claude` (all existing sessions) → error: the command has no new session to run in. (Erroring beats silently dropping the command.)
- **The command runs in every minted target.** `x ~/Code/skill* -- claude` (shell-expanded to N paths) = N new sessions each running claude, in N windows.
- A command with **no target** is not this case — it opens the picker in mint-only (Projects) mode; see the multi-target/picker topic.

**Command-injection-safety note (why attach targets can never take a command).** There is no tmux primitive for "run a command in an existing session only if safe":
1. **mint** — the command *is* the pane's initial process; clean.
2. **existing session at a shell prompt** — only `send-keys` (type the text in); works only if the pane is genuinely idle, which Portal can't guarantee (half-typed input would get the command appended) — a fragile heuristic.
3. **existing session with a process running** (`npm run dev`, `claude`) — no safe option: `send-keys` injects keystrokes into the running process's stdin (garbage), and `respawn-pane -k` *kills* the running process and replaces it (destroys work).

This absence is the deeper reason commands are mint-only — a safety floor, not a chosen restriction. Detecting case 2 via `pane_current_command` + conditional `send-keys` is **rejected** (fragile; makes `open` mutate live sessions — a surprising new power; thin payoff).

### Hidden `--ack` flag

`open --ack <batch>:<token>` is an internal receipt flag used by spawned host windows, **marked hidden via Cobra `MarkHidden`** (gone from `--help` and completion). It remains visible in `ps` when a spawned window runs — acceptable (internal, not secret). Its behavior: the spawned Portal process, as its last act before exec'ing into tmux, writes `@portal-spawn-<batch>-<token>` as a tmux server option — a delivery receipt the parent burst polls for. **The write is best-effort: the process still execs into tmux even if the write fails**, so the window attaches regardless. A failed write therefore produces a *false negative* — the window is up but the parent's poll sees no receipt within its timeout and classifies it failed (leave-what-opened applies; no orphan is created). Full burst mechanics are in the multi-target topic. Rejected spellings: `--on-open` (reads as a hook trigger, collides with `--on-resume` vocabulary), `--open-ack` (redundant on `open`), `--receipt` (unusual CLI vocabulary). Today's equivalent flag `--spawn-ack` is only *labelled* "internal:" in help text, not actually hidden — the redesign hides it properly and renames it `--ack`.

---

## `portal open` — Multi-Target Burst Mechanics

### Target-set composition

**The target set is the union of (all positionals + every `-s`/`-p`/`-z`/`-a` occurrence).** Each element resolves by its own rule — bare positionals run the precedence chain, pins skip the chain and pin their domain — then the whole union goes through atomic pre-flight + absorb/net-N.

- Pins **repeat freely** (`open -s a -s b` = two attach targets).
- Pins **mix across domains and with positionals** (`open -s api -p ~/Code/new blog` = attach `api` + mint at `~/Code/new` + resolve `blog` = three surfaces).
- Pins are the explicit-domain way to name a target, fully interchangeable with positionals in a burst.
- `-f` is the sole non-composing flag (picker redirect; exclusive with all targets and pins).

### Glob targets

- **A bare target containing glob metacharacters (`*`, `?`, `[…]`) is session-domain by construction** — patterns match against the finite set of live session names and skip path/alias/zoxide entirely. Expansion produces K targets that join the target list (`open 'agentic-workflows-*' blog` → K+1 surfaces; absorb rule unchanged). Glob, not regex.
- **Zero matches ⇒ unresolvable ⇒ atomic hard fail** — no special case.
- **Shell-quoting caveat (accepted, documented):** unquoted `*` is expanded by the shell against cwd files first, so session globs are typed quoted (`x 'api-*'`). Same wart as git/docker pattern args.
- **Path globs are already free via the shell:** *unquoted* `x ~/Code/skill*` is expanded by the shell into N path args before Portal sees them → N minted sessions in N windows, zero Portal code. The quote is the domain switch.
- **`-a` accepts key globs** (alias keys are a finite Portal-owned namespace: `-a 'workflow-*'`).
- **A directory path whose name contains glob metacharacters** (e.g. `~/tmp/foo[1]`) is **unreachable as a bare positional** — the glob pre-check treats it as a session glob, it matches zero sessions, and it hard-fails. Reach it with **`-p <dir>`**, which pins the path domain and bypasses glob detection.
- **Zoxide has no glob support** (subsequence/frecency scoring). Multi-match zoxide (mint sessions for everything frecency-matching a term) is **deferred** — shotgun risk; not designed now.

### The trigger absorbs the first target, unconditionally; no dedup

**The trigger (invoking terminal) takes the first target in command-line order** (left-to-right as typed — positionals and pins interleaved; the implementation reads `os.Args` rather than cobra's split positional/flag buckets to preserve true order), and every remaining target opens a window.

- If the current session happens to be the first target → a no-op switch (you stay put).
- If the current session is **elsewhere in the set** (a non-first target) → the terminal moves to the first target, and the current session gets its own window *because it is a target*, like any other.
- If the current session is **absent from the set** (not requested) → the terminal moves to the first target, and the current session is simply left as a detached session with no surface. It is **not** given a window (it was never a target).
- **No current-session detection, no special-casing** — the current session is never treated specially; it gets a window only when it appears in the target set. The trigger's landing spot is immaterial: "it doesn't matter where the terminal ends up, as long as they all open." All requested surfaces open.
- The inside/outside-tmux split only selects the connector for the first-target surface (`switch-client` inside, `exec attach` outside); the rest run the spawned `portal open …`.
- **Execution order — the trigger connects *last*.** "Absorbs the first *target*" (which session the terminal lands on) is distinct from *when* the trigger connects. The N−1 non-trigger surfaces are spawned first; the trigger self-connects (`switch-client` inside / `exec attach` outside) **last**, after all spawns are issued. This ordering is load-bearing outside tmux: `exec attach` replaces the Portal process, so connecting the trigger before the spawns would destroy the burster and open only one surface.

**No dedup — duplicates are honored as intent.** The target set is taken literally; repeated targets are *not* collapsed.
- **Duplicate attach targets** → tmux natively supports multiple clients attached to one session (they mirror), so `open api api api` = three host windows all showing `api` (same session across three Spaces/monitors).
- **Duplicate mint targets** → each mints a *distinct* new session anyway (fresh `{project}-{nanoid}`), so `open ~/a ~/a` = two new sessions at `~/a`.
- **Accepted consequence:** overlapping globs (`open 'api-*' 'api-1'`) can produce a duplicate surface; honored, not deduped (low-harm, killable).

### Argv parsing contract (target ordering)

Cobra remains the source of truth for flag validation, value binding, `-f` mutual exclusion, and rejecting unknown flags. Target *ordering* is recovered by a raw `os.Args` scan layered on top, under a fixed contract:

- Both value forms are recognized for each pin — `-s api` (space) and `-s=api` / `--session=api` (equals) — and the value token is attributed to that pin, never counted as a positional target.
- `-e <cmd>` and its value are not targets and are excluded from the ordered target list (`open -e claude ~/new` → sole target `~/new`; `claude` is the command).
- `--` terminates flag/target parsing; every token after `--` is command-passthrough args, never a target.
- Value-taking pins are written separately, each with its own value — no bundled `-sf`-style combining for value pins.
- The ordered target list is the sequence of positionals and pin-values in the exact left-to-right order they appear in `os.Args`; the trigger absorbs the first element of that list.

The raw scan only recovers order — it classifies each token by the same flag set cobra knows, so the two never disagree.

### Burst exec-argv & mint responsibility

Each spawned window runs the **same `open` grammar a human would** — one pinned target + the hidden `--ack` — no bespoke burst-only path.

1. **Window argv, per surface:**
   - Attach target (session / glob / `-s`) → `portal open --session <name> --ack <batch>:<token>`.
   - Mint target (path / alias / zoxide / `-p` / `-z` / `-a`) → the parent **reduces it to a literal existing directory at resolve time**, then bakes `portal open --path <literal-dir> --ack <batch>:<token>`. Alias/zoxide queries never travel to the window (they could re-resolve differently mid-burst); only the resolved literal dir does, and `--path` cannot diverge. This is why "resolution must not re-run inside the window" holds without a session existing yet.
2. **Minting happens in each window, not the parent — no pre-minting.** The atomic guarantee is precisely the **read-only resolve**: any target unresolvable ⇒ nothing opens, nothing created. Once resolve passes, each surface opens/mints itself at exec time under **leave-what-opened**; a window that never comes up never mints, so there are no orphaned detached sessions.
3. **Command passthrough rides mint windows only.** When a command is present (`-e`/`--`), it is appended to each **mint** window's argv in the multi-token passthrough form, after `--ack`: `portal open --path <literal-dir> --ack <batch>:<token> -- <cmd> args…`. Attach windows never carry the command. When the **trigger** surface is itself a mint target carrying the command, the trigger mints locally (no spawned window) and feeds the command to `CreateFromDir` / `QuickStart` as the pane's initial process — the same path a spawned mint window takes.
   - **Command parity — no word-splitting.** The command is carried to every mint surface *as authored*: a single `-e "npm run dev"` string is preserved as **one unit**, never split into separate tokens. The trigger's local mint and every spawned mint window therefore run byte-identical commands (both feed `CreateFromDir` / `QuickStart` the same way), so the same command behaves identically regardless of which surface a mint target lands on.
4. **No dedup** — duplicate targets each get their own window (mirrored attach, or distinct mint); the burst never collapses them.

### Atomic pre-flight & partial failure

- **Pre-flight is a read-only resolve of the whole target set.** Any target unresolvable ⇒ atomic abort: nothing opens, nothing is created. The abort **reports every unresolvable target** (not just the first), so one re-run can fix them all. The `-f <text>` suggestion in the miss message appears only in the single-target case — `-f` is mutually exclusive with targets, so it cannot carry a multi-target intent.
- **Past the resolve, per-window failure is leave-what-opened.** Opened windows stay (Portal doesn't own/tear-down host windows) and failed/un-acked surfaces don't retry automatically. The trigger connects to its own first-target surface whenever that surface is viable — **independent of other windows' ack failures** (its target is unrelated to theirs); those failures don't cost the trigger its landing. The trigger's self-connect is skipped **only if its own target fails at connect** (e.g. an attach session that vanished between pre-flight and connect); when that happens, outside tmux Portal returns to the shell without attaching. (The picker's "stay marked for retry" is a picker-only affordance with no CLI equivalent.)
  - **Where failures are reported — `portal.log` is the durable surface.** The burst records each window's outcome in `portal.log`; that is the reliable record. When the trigger attaches, any stderr the burster prints just before connecting is swallowed by the attach (the alternate screen outside tmux; the switched-away pane inside), reappearing only on detach — the same "tmux is the receipt" constraint the spec applies to resolution feedback. A best-effort stderr summary is still emitted, directly visible only in the skip case (the trigger's own target failed, so Portal returns to the shell without attaching).
- **Per-window ack timeout (~8s).** The parent polls for each window's `@portal-spawn-<batch>-<token>` receipt with a per-window timeout of ~8s, the timer starting at *that window's own spawn* so cumulative sequential delay never eats a later window's budget. A window whose receipt has not appeared by its timeout is the "un-acked / failed" case above.

### Mint-only command with no target → picker in Projects mode

**`open -e <cmd>` / `open -- <cmd>` with no target opens the picker restricted to Projects (mint-only) mode**, with a `Pick a project to run <cmd>` banner. This is preserved exactly from today's behavior — **not** a usage error.

- A pending command switches the picker into Projects mode, and Projects only ever mint a fresh session — so the command always lands in a clean session. No incoherence.
- The command doesn't suppress the picker; it **specializes** it to exactly the surfaces where a command is meaningful (mint), and the banner tells the user what's pending.
- `-f <text> -e <cmd>` likewise coheres (filtered Projects picker running the command). The command's only *error* case is zero mint targets (all-attach explicit set, e.g. `open api web -e cmd`).

---

## Tab Completion

Principle: **complete every Portal-owned enumerable namespace; leave the rest to the shell.** Session names and alias keys are finite sets only Portal knows; zoxide has its own `cd`-style completion, and path completion is the shell's job. This keeps completion pointed at Portal's own namespaces without cramming multiple into one noisy list.

| Slot | Completes |
|---|---|
| `open` bare positional | session names |
| `open -s` | session names |
| `open -a` | alias keys |
| `open -p` | (shell — paths) |
| `open -z` | (shell / zoxide's own) |
| `kill` positional | session names |

Rejected: sessions+directories merged into one slot (noisy); nothing at all (loses the genuinely useful session-name / alias-key completion).

---

## `attach` — Retired

`portal attach` is **deleted outright** — not aliased, not deprecated-with-warning. Every current `attach` invocation has an `open` equivalent (`open` accepts session names; the exact/no-guessing path is `open --session`).

- `attach`'s two former jobs are absorbed: (1) exact/no-guessing attach for scripts → `open --session <name>`; (2) the exec target of every spawned host window → `portal open --session <name> --ack <batch>:<token>`.
- **Both `open` and the former `attach` already call the same internal Go functions in-process** (`connect()` = exec `tmux attach-session` outside tmux / `switch-client` inside); the command form existed only for cross-process callers. Nothing is lost by deleting the public command.
- **The bootstrap fast-path is command-agnostic** — `BootstrappedLatchSatisfied` is consulted once in `PersistentPreRunE` for any bootstrap-needing command (`open` included), gated on the `@portal-bootstrapped` version-stamped latch. So `open` takes the same abridged fast-path `attach` did; there is no bootstrap reason to keep `attach`.

### Spawned-window contract (pinned `open`)

- Spawned host windows exec `portal open --session <name> --ack <batch>:<token>`.
- **Pinned-domain hard-fail:** `--session`/`--path` never fall back to the TUI picker (a spawned window or script must not pop a TUI). `--session` never mints; `--path` mints per Axiom 2.
- **Burst determinism preserved:** a session that vanished mid-burst ⇒ pinned `open` hard-fails ⇒ no ack written ⇒ the burst classifies that window failed, exactly as today.

---

## `kill` — Single + Exact (unchanged)

`portal kill <name>` stays **single + exact** — no globs, no resolution chain, unchanged from today. Instant kill of one named session. Destruction is kept maximally explicit.

- **Universal resolution does not apply to `kill`** — it takes session names only (its natural domain). A guessing chain on a destructive verb is backwards.
- Rejected: session globs on `kill` (`kill 'agentic-workflows-*'`); a terminal `[y/N]` confirm guard.
- **The CLI has no interactive-prompt machinery** — verified: no stdin reads anywhere (`bufio`/`Scanln`/`ReadString`/`[y/N]`/`confirm` are absent outside the TUI). Every CLI command is do-or-error, non-interactive. A `[y/N]` glob-kill guard would mean building a brand-new interaction pattern the CLI does not have; not worth it for a marginal feature.
- Bulk kill's natural future home, if ever wanted, is the picker's multi-select with the existing destructive-confirm modal — not the CLI. Noted as a possibility, not committed.

---

## `uninstall` — Runtime-Only Teardown (replaces `state cleanup`)

`portal state cleanup` is replaced by a public **`portal uninstall`** that is **runtime-only and fully recoverable**. The command *is* the teardown — nothing hidden behind a flag — and it touches **no files at all**.

- **Removes only Portal's tmux-server footprint:** kills the `_portal-saver` daemon and unregisters the global tmux hooks. This is precisely the part that is hard to do by hand (locating the daemon, unregistering the exact hook entries) — the reason the command earns its place.
- **Touches no filesystem** — the state dir (`sessions.json`, logs) *and* config (`projects.json`, `aliases`, `hooks.json`, `prefs.json`, `terminals.json`, and the user-authored `themes/` drop-in directory) are both left untouched. Nothing irreversible happens.
- **Prints the completion path**, e.g.:
  ```
  Portal's tmux runtime removed. Your saved sessions and config are untouched at ~/.config/portal/.
  To remove Portal completely, uninstall the binary and delete that directory.
  ```
  Because `state/` lives *inside* `~/.config/portal/`, one `rm -rf ~/.config/portal` wipes both — a single deliberate act by the user. Portal never silently deletes data.
- **Fully recoverable:** the self-heal is the feature — `portal open` re-bootstraps from the retained state (daemon + hooks return, sessions restore). `uninstall` means "deactivate Portal's machinery now," not "destroy my data."
- **Idempotent / nothing-to-remove.** If there is no running tmux server, no `_portal-saver` daemon, or no registered hooks, `uninstall` is a graceful no-op — it removes whatever is present and still prints the completion message; it never errors on already-clean state.
- **Leaves all sessions in place.** `uninstall` touches no sessions: user sessions **and** the load-bearing `_portal-bootstrap` anchor session are left running. "Removes Portal's tmux-server footprint" means the daemon + global hooks only — not sessions.

### Why runtime-only (context)

- The old `state cleanup` hid its meaningful action (`--purge`, which deleted the state dir) behind a flag — the exact inconsistency this redesign removes.
- The non-purge teardown already **self-heals**: bootstrap re-registers hooks and respawns the daemon on the next tmux-touching command. Even the old `--purge` was transient while the tmux server ran (the daemon recaptures every live session into a fresh `sessions.json` on its next tick). Purge only permanently lost data when the server was *also* gone (post-reboot / `kill-server`).
- Because `uninstall` deletes nothing, there is **no `--yes` gate, no prompt, and no confrontation with the "CLI never prompts" observation** — the earlier destructive-delete design (which needed `--yes` + symlink-safe removal) is dropped entirely. Leaving files behind is standard uninstaller behavior, made honest by the printed message.

Name kept (`uninstall`).

---

## `doctor` — Diagnostics & Repair (replaces `clean` and `state status`)

`portal clean` is **deleted** and `state status` is subsumed. A new public **`portal doctor`** consolidates diagnosis and low-stakes repair.

- **`portal doctor`** — a read-only health report across all of Portal. The authoritative catalog of **Portal-health checks** — the class the exit code is drawn from, its informational host-terminal line excepted (planning implements the concrete probe per check):
  - daemon alive;
  - global tmux hooks registered without duplicates (exactly one Portal entry per managed event);
  - `_portal-saver` session up;
  - state dir sane;
  - `sessions.json` valid;
  - no stale entries (dead-pane hooks, gone-dir projects);
  - host terminal detected + supported (see "Host-terminal detection folded in" below).

  **Subsumes `state status`.**

  The catalog is not the whole report: `doctor` also reads user-authored content it does not own — the themes directory and the persisted theme name — and renders those findings as a second class of line that is `⚠`-marked and outside the exit code, followed by a closing summary. See the Exit-code contract.
- **`portal doctor --fix`** — performs the low-stakes, reversible-by-reconstruction repairs it diagnoses: prune stale hooks, prune stale projects, sweep logs. One coherent surface (diagnose, optionally repair the diagnosis) instead of a grab-bag verb plus scattered prune commands.
  - `--fix` is an action-behind-a-flag but is explicitly *not* the hidden-destructive pattern rejected on `uninstall`: it is the obvious paired verb to a diagnosis, and everything it does is low-stakes and reconstructable.
  - **Log-sweep is outside the diagnose→repair loop.** The catalog has no "logs" check (logs auto-rotate and retention-sweep in the log handler, so there is no stale-logs *health state* to report). `--fix`'s log-sweep is therefore a deliberate unconditional maintenance side-action — not the repair of a diagnosed condition — and does **not** participate in the exit-code contract (a stale-log state can never make `doctor` non-zero). The other two `--fix` repairs (prune stale hooks, prune stale projects) *do* pair with the "no stale entries" catalog check.
  - **Down-server guard on the stale-hook prune (data-loss safety).** Detecting a dead-pane (stale) hook requires enumerating live panes on a *running* server; with the server **down**, that enumeration is empty and *every* hook would falsely look orphaned. So when the server is down, the "no stale entries" check reports dead-pane-hook staleness as **not-evaluable** (never "all stale"), and `--fix` performs **no hook pruning** in that state. This protects the "reversible-by-reconstruction" guarantee — a user-authored on-resume command is *not* reconstructable by Portal, so `--fix` must never wipe `hooks.json` on a down/rebooted server. The stale-**project** prune is filesystem-only (directory existence) and may still run.

### Exit-code contract

The report carries **two classes of line**, and only one of them is the health gate:

| Class | Marker | Drives the exit code |
|---|---|---|
| **Portal-health checks** — the catalog above, bar its informational host-terminal line | the existing pass/fail markers | **Yes** |
| **User-content diagnostics** — a finding about content the *user* authored, which Portal reads but does not own | **`⚠`**, Portal's established warning glyph (glyph-backed, so it survives a colourless terminal) | **No** |

- `portal doctor` exits **0 iff every Portal-health check passes; non-zero (1) if any Portal-health check reports a problem** — a scriptable health gate (`portal doctor && …`). User-content diagnostics sit outside that gate: a report may carry any number of `⚠` lines and still exit 0.
- **Why the second class is exempt.** There is deliberately **no repair path** for user content — `--fix` prunes a stale hook entry because Portal can reconstruct one; it cannot repair someone's colours — so a `⚠` line would hold a scriptable exit **permanently** non-zero until the user hand-edits a file, unlike every Portal-health check, which is either `--fix`-repairable or reports genuine runtime breakage. The exit code exists as a signal about the **resurrection machinery** — daemon alive, hooks registered, state sane — and a stray junk file in a directory Portal merely reads is not that: Portal is working, it simply did not use one file. Letting it hold the diagnostic red means an automated health check fires about the daemon because someone left a half-written config lying around. The user still gets a loud, persistent signal — the `⚠` line, on every run — without conscripting a signal that means something else.
- **The class is open-ended.** Theme diagnostics (an invalid drop-in `.theme` file, an unreadable themes directory, a persisted theme name that no longer resolves) are its **first** member, not its definition: a later finding about user-authored content joins by carrying `⚠`, with no further amendment here. The class is also **distinct from** the informational host-terminal line below — that reports an environmental state Portal detected, this reports content Portal read; the two share only the property of not driving the exit code, and are not merged.
- **Advisories render as a trailing block** — after the whole check catalog (including the informational host-terminal line, which stays a check) and before the closing summary. They never interleave: the catalog is one line per check in a fixed order and a fixed length, whereas the advisory block is 0..N lines whose cardinality depends on what a user happens to have in a directory, so interleaving would move a given check's position with someone's file collection.
- A **down server** counts as **unhealthy → non-zero** (because `doctor` is bootstrap-exempt and starts nothing, so daemon / saver / hooks checks fail). It is reported honestly and distinctly — "Portal runtime not running — run `portal open` to start" vs. actual corruption — not a crash, just an unhealthy report.
- `portal doctor --fix` **re-runs the diagnosis after applying repairs** and exits **0 iff every Portal-health check passes post-repair, non-zero if any Portal-health check remains unhealthy or unfixable**. The user-content scan is read-only, so it runs on the `--fix` path too: its `⚠` lines and the summary's advisory suffix appear in **both** renders (the initial diagnosis and the post-repair re-diagnosis), each collected freshly for the render it accompanies rather than carried down, so both halves of a report describe the same moment. There is no repair to perform, so `--fix` gains no step for this class — and suppressing the lines would make `--fix` a *less* informative diagnosis than a plain run.
- The **host-terminal check is informational only** — it is *outside* the pass/fail set. An unsupported/remote terminal is an environmental state, not a Portal-health defect (single-target `open` still works; only the multi-window burst is unavailable), so it is reported honestly but never makes `doctor` (or `doctor --fix`) non-zero. Only genuine runtime-health failures (daemon / hooks / saver / state dir / `sessions.json` / stale entries) drive the exit code.
- **A closing summary distinguishes the two counts**, so the exit code's meaning is legible without reading this contract. It is the report's last line on **every run**, written once per render — `doctor --fix` therefore prints two — and it is a line the report **gains**, not one it changes: the header and the one-line-per-check catalog keep their shape, with the advisory block and the summary trailing them. Two forms for the checks: `<N> checks passed` when every counted check passed, `<N> of <T> checks passed` otherwise (the failing form is the one the summary exists for, since that is when the exit code needs explaining). When advisories are present, either form takes the suffix ` · <M> advisory` at M=1 / ` · <M> advisories` above; at **M=0 the suffix is suppressed entirely**, so a clean install never reads " · 0 advisories".
  - `<N>` and `<T>` count **Portal-health checks only** — the pass/fail class that drives the exit code. The informational host-terminal line and any check that could not be evaluated count toward **neither**: both are documented as never driving the exit code, and counting a not-evaluable check in the total alone would render "6 of 7 checks passed" beside exit 0, which is precisely the illegibility the summary exists to remove.
  - `<M>` counts advisory **lines**, so it counts problems rather than detections — one user-content problem is one line, and a finding already reported by a line carrying strictly more is not counted twice.

### Host-terminal detection folded in (`--detect` retired)

`spawn --detect` (a dry-run that printed the detected host terminal's identity, e.g. `Ghostty · com.mitchellh.ghostty`) is retired with `spawn`. Its job folds into `doctor`: the picker keeps calling `Detect()` in-process; `doctor` calls the same function and prints a line such as `host terminal: Ghostty (supported)` / `unsupported (remote session)`.

### `clean` deleted

- `portal clean` and its `--logs` flag are **removed**. Logs auto-rotate and retention-sweep in the log handler; `rm` covers the rest.
- No `logs`/`hooks` maintenance namespaces are created — those actions don't earn standing commands.
- **Stale-project pruning folds into the daemon's automation** on a slow cadence (hourly-ish; hooks already prune on the idle tick). Mechanism/cadence is an implementation detail. Net effect: `doctor` reads *healthy* almost always because the automation keeps it that way; `--fix` is the manual trigger of the same repairs.

### Rationale (context)

`clean` bundled three unrelated jobs (prune stale projects, prune stale hooks, force log sweep) behind one verb + a flag — a grab-bag. Value audit: stale-hook prune is redundant (daemon does it), the log sweep is redundant (handler retention-sweeps per day), stale-project prune was the only unique action (harmless cruft). The reorg separates *diagnosis* ("is Portal healthy?" — recurring, valuable) from *action* ("clean X" — mostly automated), which dissolves `clean`. `doctor`/`--fix` follows the `brew doctor` / `flutter doctor` idiom (a doctor diagnoses **and** treats). **Nothing internal calls `clean` or `state cleanup`** — both were purely manual backstops to already-automated work.

---

## `state` Namespace — Fully Hidden

The `state` namespace becomes **fully hidden** but cannot stop being a command. Every remaining `state` subcommand is a **separate-process entry point** invoked by an argv, not an in-process Go call, so each must stay invocable:

- `state daemon` — the process the `_portal-saver` pane runs.
- `state hydrate` — exec'd into each restored pane via `respawn-pane -k`.
- `state signal-hydrate` / `state notify` / `state commit-now` / `state migrate-rename` — all fired by tmux hooks as `run-shell "portal state …"`.

A separate process can only be handed a command line, never a Go function (the same constraint that made `open --session` the spawn exec target). Once `status` → `doctor` and `cleanup` → `uninstall`, `state` has **zero user-facing children**, so the whole namespace is marked **hidden** (gone from `--help` and completion). To the user `state` disappears; to tmux it remains plumbing.

- **Keep the `state` prefix** — the hook definitions match those command strings by substring for idempotency (`notifyCommand`, `commitNowSubstring`, `migrateRenameSubstring`, `PortalDaemonArgvPattern`, …); renaming would churn internal matching for zero user benefit.
- `state` **cannot be removed entirely** (it is real plumbing), only hidden.

---

## Remaining Verbs — Keep As-Is, except `hooks` → `hook`

`list`, `alias`, `init`, `version`, `completion` **keep as-is** (right name, shape, and tier). One grammar change:

- **`hooks` → `hook`** (canonical), following the dominant modern convention of a **singular** namespace noun for a collection (`docker container`, `gh pr`, `git remote`). `alias` was already singular and stays; `hooks` was the odd one out.
- **`hooks` is retained as a cobra alias of `hook`** — the one deliberate exception to the no-back-compat rule (see Back-Compat). `portal hook …` is canonical/documented; `portal hooks …` keeps working.

---

## Bootstrap Exemption — `doctor` & `uninstall`

`PersistentPreRunE` runs the full bootstrap (EnsureServer → RegisterHooks → EnsureSaver → Restore → …) before most commands, but `skipTmuxCheck` (`cmd/root.go`) exempts a set (including `state`). As the renamed successors to `state status`/`state cleanup`, **`doctor` and `uninstall` join `skipTmuxCheck` (bootstrap-exempt).**

- **`doctor` must be exempt** — otherwise bootstrap re-registers hooks and respawns the daemon one step *before* `doctor` reads health, so a read-only check would heal its own subject and always report green (self-defeating). Exempt, it observes raw state, starts nothing (a down server is reported honestly, not silently started), and heals nothing.
- **`uninstall` must be exempt** — otherwise it would EnsureServer / RegisterHooks / EnsureSaver / Restore and then immediately tear all of it down (circular, wasteful, racy).
- `clean` **leaves** the exempt set (deleted); `state` **stays**; the `hooks` → `hook` rename keeps the exemption (`skipTmuxCheck` keys on `c.Name()`, cobra's canonical name, so the `hooks` alias is covered).

This applies the existing, code-documented exemption to the renamed successors — no new pattern.

---

## Bare `portal` (no subcommand)

**Bare `portal` prints help/usage — it does NOT launch the picker.** The picker already has two doors (`portal open`, `x`); bare `portal` is the control-plane root and lists commands.

- Making bare `portal` open the picker would also make bare `xctl` open the picker (since `xctl() { portal "$@" }`), muddying the two-tier split that is deliberately kept: **`x` = launcher (picker / open), `xctl` / `portal` = management plane (help when bare).**

---

## Back-Compat & Deprecation Story

**There is no back-compat story — deliberately.** This is a deliberate reversal of the seed's assumption (which called for compatibility aliases), recorded so specification/planning does not reintroduce aliases.

- `attach` and `spawn` are **removed** — not aliased, not deprecated-with-warning.
- Broken scripts are the owner's to fix (single-digit user base; the author owns the known scripts).
- The `x` / `xctl` shell functions re-emit from `portal init` and keep working untouched (`x` already maps to `portal open`).
- No alias lifecycle exists because no compat aliases exist.

**One deliberate exception: `hooks` → `hook` keeps `hooks` as a permanent, silent cobra alias.** Not a softening of the rule — a targeted carve-out: `portal hooks set …` is auto-generated by the user's external Claude SessionStart skill (machine-written, not author muscle memory), so breaking that specific string has real operational cost that the removed `attach`/`spawn` don't. No deprecation timer. Every *other* renamed/removed verb takes no alias.

---

## Deferred Scope (explicitly out of this design)

These are deferred future scope, not unresolved decisions — recorded so planning does not build them:

- **Stay-put multi-open flag** — an explicit future flag on `open` (open windows for N targets but leave the trigger terminal where it is). The absorb/net-N default takes the trigger to the first target; the exceptional stay-put behavior gets the flag when designed. Not designed here.
- **Multi-match zoxide** — a `-z`/query variant that mints sessions for *every* frecency-match of a term (via `zoxide query --list`). Shotgun risk (mints N sessions for possibly-stale dirs). Not designed here.
- **Bulk kill via the picker's multi-select** — the natural future home for killing many sessions at once (reusing the multi-select mode + the existing destructive-confirm modal). Not built here; `kill` stays single + exact.
- **In-tmux error surface for the multi-open burst** — a way to surface burst failures (and possibly resolution feedback) *inside* tmux so Portal doesn't fully disappear on attach — e.g. attaching "through" Portal rather than a bare `exec attach`, giving errors a visible home despite the alternate-screen swallowing. Noted as a future response to the known "errors are swallowed on attach; `portal.log` is the durable surface" limitation; not designed here.

---

## Command Surface Summary (final shape)

### Public commands

| Command | Shape | Change from today |
|---|---|---|
| `portal open [targets…]` | single public session verb; no-args → picker; flags `-s/-p/-z/-a/-f`, `-e`/`--`; absorb/net-N; hidden `--ack` | **absorbs `attach` + `spawn`**; gains session-name targets, domain pins, multi-target burst; loses TUI-fallback-on-miss |
| `portal kill <name>` | single + exact | unchanged |
| `portal list` | list running sessions | unchanged |
| `portal alias {set,rm,list}` | path aliases | unchanged |
| `portal hook {set,rm,list}` | resume hooks | **renamed from `hooks`** (`hooks` kept as a silent alias) |
| `portal doctor [--fix]` | health report; `--fix` repairs | **new** — subsumes `state status`, replaces `clean`, folds in `spawn --detect` |
| `portal uninstall` | runtime-only teardown | **new** — replaces `state cleanup` |
| `portal theme export <slug>` | writes one theme's file to stdout (built-ins and drop-ins); bootstrap-exempt | **new** — the `theme` group's only member |
| `portal init [shell] [--cmd name]` | shell integration | unchanged |
| `portal version` | version | unchanged |
| `portal completion` | cobra built-in | unchanged |
| bare `portal` | help / usage | unchanged (does not open picker) |

### Removed public commands

| Removed | Replacement |
|---|---|
| `portal attach <session>` | `portal open --session <name>` (or bare `open <name>`) |
| `portal spawn [sessions…]` | `portal open <t1> <t2> …` (multi-target) |
| `portal spawn --detect` | `portal doctor` (host-terminal line) |
| `portal clean [--logs]` | `portal doctor --fix` (repairs) + automatic daemon pruning |
| `portal state status` | `portal doctor` |
| `portal state cleanup [--purge]` | `portal uninstall` |

### Hidden (invocable plumbing, absent from `--help` / completion)

| Hidden | Invoked by |
|---|---|
| `portal open --ack <batch>:<token>` | spawned host windows (burst receipt) |
| `portal state daemon` | the `_portal-saver` pane |
| `portal state hydrate` | `respawn-pane -k` per restored pane |
| `portal state signal-hydrate` / `notify` / `commit-now` / `migrate-rename` | tmux hooks (`run-shell "portal state …"`) |

---

## Working Notes

## Corrigenda

> **Corrigendum 2026-08-07** (from `theming-system`): "`portal doctor` exits **0 iff every check passes; non-zero (1) if any check reports a problem**" — corrected: the report carries **two classes of line** and the exit code is **0 iff every Portal-health check passes**; `⚠`-marked user-content diagnostics never participate (there is deliberately no repair path for user content, so such a line would hold the exit permanently non-zero over something that is not the resurrection machinery the exit code speaks about), and every run now ends with a closing summary distinguishing the two counts.
>
> **Corrigendum 2026-08-07** (from `theming-system`): "`portal doctor --fix` **re-runs the diagnosis after applying repairs** and exits **0 iff everything is healthy post-repair, non-zero if anything remains unhealthy or unfixable**" — corrected: the exit is driven **solely** by the post-repair *Portal-health* checks, and because the user-content scan is read-only it runs on the `--fix` path too, so its `⚠` lines and the summary's advisory suffix appear in **both** renders while `--fix` gains no repair step for them.
>
> **Corrigendum 2026-08-07** (from `theming-system`): "The authoritative check catalog (the set `doctor` inspects — planning implements the concrete probe per check)" — corrected: that catalog is the **Portal-health** class alone; `doctor` also reads user-authored config it does not own (the themes directory and the persisted theme name) and reports those findings as `⚠` advisories outside the catalog and outside the exit code.
>
> **Corrigendum 2026-08-12** (from `theming-system` review): the `--fix` bullet still carried the pre-amendment absolutes "exits **0 iff everything is healthy post-repair, non-zero if anything remains unhealthy or unfixable**", scoped only by a trailing "driven **solely** by the post-repair Portal-health checks" — the exact phrase the second corrigendum above quotes as corrected. Corrected in the body: the absolutes now name Portal-health checks directly, and the redundant trailing clause is dropped.
>
> **Corrigendum 2026-08-07** (from `theming-system`): the Command Surface Summary's public table omitted **`portal theme export <slug>`** — corrected: it is a public, bootstrap-exempt verb (the `theme` group's only member) that writes one theme's file to stdout.
>
> **Corrigendum 2026-08-07** (from `theming-system`): `uninstall`'s "config (`projects.json`, `aliases`, `hooks.json`, `prefs.json`, `terminals.json`)" — corrected: the user-authored `themes/` drop-in directory sits alongside those files under `~/.config/portal/` and is likewise untouched.
>
> **Corrigendum 2026-09-11** (from `open-with-forced-filter`): "**Otherwise, the precedence chain**, first match wins: **exact session name → path → alias → zoxide query**", applied to every bare positional — corrected: a positional beginning with `/` and containing no further `/` is a session-search sigil and never enters the chain, so the chain gains a pre-check ahead of the glob one. Multi-segment and trailing-slash paths are unaffected.

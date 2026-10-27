# Discussion: CLI Verb Surface Redesign

## Context

Portal's CLI grew by accretion — commands were added as they were needed, without a holistic design pass. The symptom that surfaced this: even the author is now fuzzy on the difference between `open` and `attach`. When the person who built it can't cleanly recall which verb does what, the surface has drifted past coherent.

The current shape (verified against the codebase at discussion start — the seed's inventory was incomplete):

**Session verbs:**
- `portal open [-e cmd] [destination] [-- cmd args...]` — no args launches the TUI picker; one arg resolves a path/query through path → alias → zoxide → session, then attaches in place; can carry a command to run in the new session
- `portal attach <session>` — attaches in place to a named session (also carries the internal `--spawn-ack` flag used by spawned windows)
- `portal spawn [sessions...]` — provisionally named; opens each session in its own host-terminal window (`--detect` dry-run)
- `portal kill [name]` — kill a tmux session
- `portal list` — list running tmux sessions

**Utility commands:**
- `portal alias {set,rm,list}` — path aliases
- `portal hooks {set,rm,list}` — resume hooks
- `portal clean [--logs]` — remove stale projects / sweep logs
- `portal state {status,cleanup}` — user-facing; plus six **hidden** internal subcommands (`daemon`, `hydrate`, `signal-hydrate`, `notify`, `commit-now`, `migrate-rename`)
- `portal init [shell] [--cmd name]` — shell integration
- `portal version`, `portal completion` (cobra built-in)

**Shell layer (from `portal init`):** `x` is not a cobra alias — it's a shell function `x() { portal open "$@" }`, paired with `xctl() { portal "$@" }`. So a two-tier surface already exists: `x` = the launcher (hardwired to `open`), `xctl` = the full control plane. `--cmd` renames the pair.

The core problem: overlapping, blurry verbs with illegible input domains (path/query vs single session name vs multi-session). Bolting `spawn` on in isolation just lengthens an organically-grown list without fixing the underlying incoherence.

The goal is one intentional, coherent design pass over the **full** command list (the user explicitly chose a full audit — `hooks`, `clean`, `state`, `alias`, `init` and friends included, not just the three overlapping verbs). The output is a ship-able design: rename/restructure commands plus a back-compat/deprecation story, since existing commands live in user muscle memory and scripts.

A live design question carried from the seed: should the window-spawn operation stay a distinct `spawn`, or fold into a variadic `attach foo bar baz` where argument count decides attach-in-place vs spawn-new-windows? The author likes variadic-attach (it matches the session-name input domain) but notes the count-dependent behaviour split.

### References

- Seed: `.workflows/cli-verb-surface-redesign/seeds/2026-07-09-cli-verb-surface-redesign.md`
- Discovery log: `.workflows/cli-verb-surface-redesign/discovery/sessions/session-001.md`
- Origin discussion: `restore-host-terminal-windows` (named `spawn` provisionally; CLI verb is a secondary surface, cheap to rename)

## Discussion Map

A living index of subtopics tracked during the discussion. This is the structural backbone — it grows as the conversation branches, and converges as decisions land.

### States

- **pending** (`○`) — identified but not yet explored
- **exploring** (`◐`) — actively being discussed
- **converging** (`→`) — narrowing toward a decision
- **decided** (`✓`) — decision reached with rationale documented

### Map

  Discussion Map — CLI Verb Surface Redesign (30 subtopics — 30 decided)

  ┌─ ✓ Mental model & verb taxonomy [decided]
  │  ├─ ✓ open vs attach reconciliation [decided]
  │  ├─ ✓ spawn: distinct verb vs variadic attach [decided → superseded by the fold]
  │  ├─ ✓ Where the picker sits (open, no args) [decided]
  │  └─ ✓ Bare portal → help, not picker (x=launcher, portal=mgmt) [decided]
  ├─ ✓ Input domain legibility (universal target resolution) [decided]
  ├─ ✓ Verb naming (open stays — portal metaphor; verb B name dissolved) [decided]
  ├─ ✓ The open fold (spawn absorbed; absorb/net-N as rule) [decided]
  │  ├─ ✓ Arg resolution (universal, atomic pre-flight) [decided]
  │  ├─ ✓ Attach-vs-mint dichotomy (session=attach, dir=always new) [decided]
  │  ├─ ✓ Miss handling (fallback stripped — hard fail; -f explicit) [decided]
  │  ├─ ✓ Domain-pinning flags (-s/-p/-z/-a/-f) [decided]
  │  ├─ ✓ Glob targets (session-domain; shell globs paths; -a globs) [decided]
  │  ├─ ✓ Command passthrough -e/-- (mint-scoped; mixed ok; zero-mint errors) [decided]
  │  └─ ✓ --detect home (folded into doctor) [decided]
  ├─ ✓ attach disposition (retired — open --session + hidden --ack) [decided]
  ├─ ✓ Resolution scope (universal resolution is open's grammar, not the CLI's) [decided]
  ├─ ✓ Kill shape (single + exact — no globs, no CLI prompt) [decided]
  ├─ ✓ Open invocation grammar (flag/target cross-products, review 002) [decided]
  │  ├─ ✓ Target-set composition (union of positionals + pins) [decided]
  │  ├─ ✓ Absorb: trigger takes first target (cmd-line order); no dedup, no current-session detection [decided]
  │  ├─ ✓ Burst exec-argv & mint responsibility (window = open --path/--session --ack) [decided]
  │  └─ ✓ Mint-only command, no target → picker in Projects mode (preserve) [decided]
  ├─ ✓ Completion UX (session names: positional/-s/kill; alias keys: -a; rest to shell) [decided]
  ├─ ✓ Utility command audit [decided]
  │  ├─ ✓ uninstall (runtime-only, touches no files, fully recoverable) [decided]
  │  ├─ ✓ Maintenance/diagnostics reorg (clean deleted → doctor + --fix; project-prune automated) [decided]
  │  ├─ ✓ state namespace fully hidden (entry points, not removable) [decided]
  │  ├─ ✓ Bootstrap exemption for doctor & uninstall (skipTmuxCheck) [decided]
  │  └─ ✓ Remaining verbs (keep as-is; hooks → hook + hooks alias) [decided]
  └─ ✓ Back-compat & deprecation story (none — deliberate reversal of the seed) [decided]

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. Not every subtopic needs its own section — minor items resolved in passing can be folded into their parent.*

---

## Mental Model & Verb Taxonomy

### Context

The parent decision everything else hangs off: what's the sentence a user says to themselves to pick a verb? Today's surface muddles this — `open` and `attach` produce the identical outcome (your terminal ends up in a session) and differ only by what the argument looks like (path/query vs session name), while `spawn` differs by outcome (new host windows).

### Options Considered

Three candidate mental models were put on the table first:

**A. One-verb funnel** — a single primary verb accepts anything (nothing → picker, path, query, session name, maybe several); everything else is management. Maximum muscle-memory simplicity; input domains unified by resolution.
- Cons: quietly re-creates the blur *inside* one verb's resolution chain; can't express "open a window over there without moving me".

**B. Two verbs by input domain** — "where"-shaped input → `open` (resolving, create-or-attach); "which"-shaped input → `attach` (exact, existing-only, variadic — spawn folds in).
- Pros: domains legible by verb.
- Cons: verb choice encodes *how you'll spell the destination*, not intent — both verbs produce the same outcome. (This is the split the user called weird, and it is: no beloved CLI splits verbs by argument type — `cd` has no sibling `cd-by-inode`.)

**C. Three verbs by operation (status quo + docs)** — keep open/attach/spawn, fix with naming/docs only.
- Cons: preserves exactly the blur that motivated the work; even the author can't recall open-vs-attach.

The discussion then reframed the space as **three possible axes to split verbs on** — by input type (B), by action/outcome, by determinism (resolving vs exact) — observing that today's surface muddles all three.

### Journey

- Started from the input-domain framing (the seed's): "open guesses, attach doesn't" — attach's value is precision for callers that must not be guessed at (the spawn burst composes `portal attach <session> --spawn-ack` for every spawned window; scripts want determinism). User confirmed they *never* type `attach` manually (session names are `{project}-{nanoid}` — not hand-typed currency) but felt it has value. That located attach's constituency: machines and deliberate exactness, not fingers.
- User pushed back on the input-domain split itself: "attach is for session names and open is for everything else… feels weird. we need a better split." The reframe landed: split the *human* surface **by action/outcome**, and demote exactness to **plumbing** (porcelain/plumbing precedent already exists — six of `state`'s subcommands are hidden).
- The variadic-attach idea from the seed (fold spawn into `attach foo bar baz`) dissolved rather than being decided against: once attach leaves the public surface, there's nothing public to fold spawn into. Notably, the seed's objection to variadic attach (count-dependent behaviour split) had already been weakened: the picker multi-select's Enter is a *continuous* rule — "net N surfaces, your terminal is one of them" — where N=1 is just the degenerate case with zero external windows. The fold died for a different reason than the seed's worry.
- Why two public verbs and not one count-driven verb: a single count-driven verb cannot express *"open a window for that session but leave my terminal alone"* (N=1 always attaches in place). Two outcome-verbs make every combination typeable.
- Whether window-opening deserves to be public *at all* was challenged (the picker calls the spawn package in-process; the CLI verb is a test seam + provisional). The deciding argument for public: **scriptability** — the morning-after-reboot script that rebuilds a standard window layout without the picker; a hidden verb is one nobody discovers. User confirmed: multi-opening stays public.

### Decision

**Split the public surface by outcome; demote exactness to plumbing; input domains unify inside resolution.**

- **Verb A ("take me there")** — picker at no-args; universal target resolution (exact session match → path → alias → zoxide); connects the current terminal in place; creates when the target is directory-shaped and no session exists.
- **Verb B ("open windows for these")** — variadic, public (scriptability argument), currently `spawn`.
- **`attach` leaves the public surface but cannot be deleted** — it is the exec target of every spawned window (`--spawn-ack`) and the exact/no-guessing command for scripts. It demotes to hidden-but-working plumbing, same trajectory as `state daemon`. Functionally nothing is lost: verb A accepts session names, so every current `attach` invocation has a verb-A equivalent.

Names for both verbs deliberately deferred to the Verb Naming subtopic. Confidence: high on the split; the contracts' fine print (verb B arg resolution, absorb-vs-stay-put) tracked separately.

> **Superseded in part**: the two-public-verbs shape was later revised by **The Open Fold** (below) — verb B was absorbed into `open` once the absorb/net-N rule was recognized as making arity continuous. The underlying decisions survive: outcome-thinking, attach → plumbing, multi-open stays public (now as variadic `open`), universal resolution.

---

## Input Domain Legibility

### Context

The seed framed illegible input domains (path/query vs single session name vs multi-session) as a problem to make *legible by verb*. The mental-model decision inverted this.

### Decision

Input domains are **not** made legible by verb — they are **unified inside resolution**. A target argument accepts a session name, path, alias, or zoxide query, resolved with a precedence order: **exact session match → path → alias → zoxide**. (Scope corrected by review finding F4: universal resolution is **`open`'s grammar, not the CLI's** — every other verb takes its natural domain; see Resolution Scope.) Collisions between a session name and a directory name are rare (`{project}-{nanoid}` names don't look like paths) and precedence-resolvable. Exactness (no-guessing) remains available in plumbing (`attach`) for scripts and the spawn machinery. Folded from the parent decision — no separate debate.

---

## Verb Naming

### Context

With contracts settled (verb A "take me there", verb B "open windows for these"), are the incumbent names right? `open` is the incumbent for A — but in mac/desktop convention `open` connotes *a new window* (verb B's job), and `open` is the name whose contract changes most (gains session names). `spawn` is the incumbent for B — accurate but jargon-y, describes the mechanism (create windows) not the outcome, and was explicitly shipped as provisional. Candidates floated: A — keep `open`, or `go`, `enter`, `jump`; B — keep `spawn`, or `windows`, `launch`, `pop`.

Key facts bearing on the decision:
- `x` is a shell function emitted by `portal init` (`x() { portal open "$@" }`) — it remaps to whatever verb A becomes with zero muscle-memory cost. `xctl() { portal "$@" }` is the control-plane twin.
- `portal open` / `portal attach` / `portal spawn` exist in scripts and muscle memory today → back-compat aliases required either way.

### Journey

User: "i dont know tbh" — genuine fork. Perspective agents dispatched (Formal Systems ↔ Incentive Realist: what the coherent model demands vs how users actually behave). Synthesis surfaced four tensions:

- **T1 (the core split)** — Formal Systems: rename A → `go` (mac `open` connotes new-window; `open` is the verb whose contract changes most — keeping the name while moving behaviour is silent drift). Incentive Realist: keep `open` (`x` absorbs nearly all invocations; the *reported* confusion is cured by demoting attach, so the rename chases an unreported problem; `go` collides with the Go toolchain in this author's world).
- **T2** — verb B replacement: `windows` (guessable noun) vs `launch` (grammar-consistent verb); both lenses converged on retiring `spawn` (mechanism jargon, provisional, no muscle memory — only consumers are author-owned tests).
- **T3** — names are a coupled set: `open`+`launch` is the one forbidden pair (near-synonyms for opposite poles).
- **T4** — alias lifecycle: permanent silent aliases vs deprecated-with-sunset. (Still live; feeds the back-compat subtopic.)

**Resolution of T1**: the user rejected the Realist's *frame* outright — "I don't care about the impacts of the rename; if the rename is the right thing to do, we do it. That's the whole point of this task." Migration cost is not a criterion here. `open` stays **on semantic merits**: "Portal open" is the tool's founding metaphor — you are *opening a portal to a session* (the play on words is why the tool is named Portal). The parameter doesn't change what you're doing, only how the destination is derived. Under the portal metaphor the mac new-window connotation dissolves — `open` never meant "window", it means the portal. `x` is acknowledged as a personal convenience, not the design.

**T2/T3 dissolved** rather than resolved: The Open Fold (below) eliminates verb B entirely — there is no second verb to name. `spawn` the *word* is retired with it.

### Decision

**Verb A is `open`, decided on semantic-fit grounds (portal metaphor), explicitly not on migration-cost grounds.** No second verb exists post-fold, so no other public session-verb name is needed. Confidence: high.

---

## The Open Fold (spawn absorbed into open)

### Context

With naming under discussion, the user pushed the shape further: "It's doing nothing different from the user's perspective as Portal open, except you're opening one or more… I feel like it's all just Portal open." Re-examining the earlier one-verb objection showed it was conditional — and the condition is settleable.

### Journey

- The earlier case for two verbs rested on one inexpressible sentence: "open a window for that session but leave my terminal alone" — a count-driven single verb can't say it. The fold survives this because of the **absorb/net-N rule**: "open portals to these N sessions; this terminal is one of them" is *continuous in N* — at N=1 your terminal is the only surface (plain open-here), at N=3 it's one of three. No behaviour cliff. Today's `spawn` already self-attaches the Nth, so the semantics are proven in production.
- The cliff only appears if multi-open *stays put* while single-open connects — so **choosing the fold is choosing absorb-as-rule**. Stay-put isn't lost: it becomes an explicit future flag on `open` (`--detach`-ish) — the exceptional behaviour gets the flag, the natural behaviour gets the bare verb.
- The user proposed **domain-pinning flags**: `--session` / `--path` on `open` pin the input domain instead of guessing — "wouldn't really be used by humans, but it is something that's scriptable." This relocates the script-determinism role from hidden `attach` to a **public, documented** home on `open`.
- Consequence: the entire verb-B naming debate (T2/T3) evaporates — there is no verb B.

### Decision

**`portal open` is the single public session verb.**

- `portal open` → picker
- `portal open <target>` → resolve (session → path → alias → zoxide), connect this terminal
- `portal open <t1> <t2> … <tN>` → N portals; this terminal becomes one of them (absorb/net-N rule), N−1 host windows spawn
- Domain-pinning flags (see below) → no guessing; script-safe
- Atomic resolution pre-flight for multi-target: any target unresolvable ⇒ nothing opens
- Stay-put multi-open: future explicit flag, deliberately deferred scope (not designed here)
- `spawn` retired as a public verb; `kill`, `list`, utilities unchanged by this decision
- Picker placement (formerly its own open question) is settled by the same sentence: no parameters → the picker is how you choose the destination

Confidence: high on the shape.

### The Attach-vs-Mint Dichotomy (second axiom)

Code verification (`internal/session/quickstart.go:72-76`, `create.go`) corrected an earlier mis-statement in this doc ("creates when the target is directory-shaped and no session exists" — implied find-or-create). The real model, confirmed and **locked as the design's second axiom**:

- **Session-domain hit** (exact name, glob) → **attach to an existing session**
- **Directory-domain hit** (path, alias, zoxide) → **mint a brand-new session there, always**

There is no find-or-create: `GenerateSessionName` guarantees a fresh `{project}-{nanoid}` name and the former `new-session -A` attach-to-existing was deliberately removed as unreachable. Multiple sessions per project is the designed workflow. The precedence chain is therefore semantic, not just disambiguation: "is this an existing session I should surface, or a place I should open a new portal to?"

**Accepted consequence (ruled on explicitly):** bare project shorthand does *not* reattach — `open api` never exactly-matches `api-x7Kd9a`, falls to zoxide → dir → new session, even while an `api-*` session runs. Existing sessions are reached via the picker, a glob (`'api-*'`), or `-s`. **Rejected alternative:** project-prefix session matching (`api` attaches to the sole `api-*` session) — reintroduces attach-vs-create guessing with an ambiguity cliff the moment a second `api-*` session exists.

### Miss Handling & the Filter Flag

**Total miss ⇒ hard fail, every arity, every form.** The TUI-fallback-with-filter (today's terminal step of the chain) is **stripped**. The error message suggests the escape hatch (`nothing resolved for 'blog' — try -f blog`).

Journey: the user's first instinct was fail, but they liked the filter mechanic and floated an alternative — a total-miss target opens a *filtered picker in its surface* (uniform across arities: "every unresolvable target becomes a filtered picker"). Pushback killed it on three grounds: (1) **interactive-vs-scripted** — scripts are the CLI multi-open's constituency, and `open` can't know its context; a picker quietly waiting in window 3 of a scripted burst is the surprise scripts can't tolerate; (2) **the ack machinery breaks** — a picker-window writes no `--ack` receipt (nothing attaches until a human picks), so the burst misclassifies it failed and a retry opens a second picker; (3) **the user's own rarity observation** — with zoxide installed nearly every token resolves to something, so the implicit fallback is "a lottery you occasionally lose into", not a dependable feature (user: seen it a couple of times; the attempts to use it deliberately failed because zoxide ate the word). The explicit flag is what makes the filter mechanic *reliable* for the first time. User reversed with conviction.

- **`-f/--filter <text>`** → skips resolution entirely; opens the picker with the filter pre-filled. Mutually exclusive with positional targets and with other pin flags (usage error).

### Domain-Pinning Flags (locked set)

| Flag | Pins to | Semantics on that domain |
|---|---|---|
| `-s/--session <name-or-glob>` | exact session / session glob | attach; hard fail on miss; never mints |
| `-p/--path <dir>` | directory path | mint new session; dir must exist |
| `-z/--zoxide <query>` | zoxide best match | mint at matched dir; hard fail on no match; **explicit error if zoxide not installed** (pinned ≠ silently skipped — unlike the guessing chain, where zoxide absence just falls through: `resolver/zoxide.go` `ErrZoxideNotInstalled`, `query.go` treats any zoxide error as continue) |
| `-a/--alias <key-or-glob>` | alias key / key glob | mint at aliased dir; hard fail on unknown key |
| `-f/--filter <text>` | (none) | picker, pre-filtered |

`-a` was added for symmetry (the fourth resolution domain; also the only way to reach an alias shadowed by a same-named session). User rationale for the full set: open-source project — flags earn their keep for scripting and other users even where the author won't use them personally. "The fact that portal open is multi-dextrous allows us to keep the same command but focus its intent." Note `-e` is already taken by open's existing run-command flag.

### Glob Targets

- **A bare target containing glob metacharacters (`*`, `?`, `[…]`) is session-domain by construction** — patterns match against the finite set of live session names and skip path/alias/zoxide entirely. Expansion produces K targets that join the target list (`open 'agentic-workflows-*' blog` → K+1 surfaces; absorb rule unchanged). **Zero matches ⇒ unresolvable ⇒ atomic hard fail** — no special case. Glob, not regex.
- **Shell-quoting caveat (accepted, documented):** unquoted `*` is expanded by the shell against cwd files first — so session globs are typed quoted (`x 'api-*'`). Same wart as git/docker pattern args.
- **The quote is the domain switch — path globs are already free:** *unquoted* `x ~/Code/skill*` is expanded by the shell into N path args before Portal sees them → N minted sessions in N windows, zero Portal code. This answers "why couldn't globs work for paths?" — they do, via the shell, today.
- **`-a` accepts key globs** (alias keys are a finite Portal-owned namespace, same shape as session names — `-a 'workflow-*'`).
- **Zoxide has no glob support** (ordered-keyword/subsequence scoring; last term weighted to the final path component). It does have `zoxide query --list` (all matches, ranked) — multi-match zoxide ("mint sessions for everything frecency-matching *skill*") is **deferred**: a shotgun that mints N sessions for possibly-stale dirs; not designed now.

### Wrong-Guess Feedback — tmux is the receipt

Review finding F2 asked what the user sees when resolution guesses wrong — sharpened by the dichotomy, since a wrong zoxide guess silently *mints a session*. Decided: **no dedicated confirmation surface.** A receipt line has nowhere reliable to live (outside tmux, `open` exec-replaces itself and pre-exec output is swallowed by the alternate screen; inside tmux it lands in the pane you switched away from). What the user reliably sees is tmux itself: the status bar shows the `{project}-{nanoid}` session name — which encodes the resolver's choice — plus the pane cwd. User: "no different to how zoxide works now outside of portal — if the user meant something different they will realise the misstep and fix it themselves." Wrong guess = self-announcing at the destination; recovery = `kill` + retry with a pin. Mitigations already in place: pin flags for determinism, hard-fail on total miss, atomic pre-flight on bursts. One cheap addition locked: **the resolver logs its decision** (`resolve: 'blog' → zoxide → ~/Code/blog`) under the existing log taxonomy, so a confusing guess is reconstructable from `portal.log`. (Multi-open per-target echo considered and not pursued.)

### Command Passthrough (`-e` / `--`) — mint-scoped

`open -e cmd` / `open <target> -- cmd args…` runs a command in the newly created session (the "open this project with claude running" mechanism, fed to `CreateFromDir`/`QuickStart` as the pane's shell-command). The attach-vs-mint dichotomy places it (review finding F1):

- **The command targets mint surfaces only** — a freshly-minted session has a clean pane to *be* the command's process (fed to `CreateFromDir`/`QuickStart` as the pane's initial process). An existing (attach) session has **no safe injection channel** — see the Command-Injection-Safety note below — so a command can never run in an attach target.
- **Mixed sets are allowed; the command is scoped to the mint targets (decided Option B).** Mint-vs-attach is known per-target at resolve time, so the command is baked only into mint targets' invocations (`--path <dir> -e <cmd>`); attach targets get `--session <name>` with no command. `open api ~/new -e claude` → attach `api` as-is **and** mint `~/new` running claude, in two surfaces. (Rejected — Option A "any attach target + command ⇒ error": too strict, forbids the real "reattach these and spin up a fresh one with claude" workspace-rebuild case; and Option C "inject into the existing session if possible": no safe mechanism, see below.)
- **Zero mint targets + a command ⇒ usage error.** `open api web -e claude` (all existing sessions) → error: the command has no new session to run in. Erroring beats silently dropping it. A command with **no** target is *not* this case — it opens the picker in Projects/mint mode (F7).
- **The command runs in every minted target.** `x ~/Code/skill* -- claude` (shell-expanded paths) = N new sessions each running claude, in N windows. (Rejected: restricting `-e`/`--` to single-target.)

**Command-Injection-Safety note (why attach targets can never take a command).** There is no tmux primitive for "run a command in an existing session only if safe", verified across three cases: (1) **mint** — the command *is* the pane's initial process; clean. (2) **existing session at a shell prompt** — only `send-keys` (type the text in); works only if the pane is genuinely idle, but Portal can't guarantee that (half-typed input would get the command appended) — a fragile heuristic. (3) **existing session with a process running (`npm run dev`, `claude`)** — no safe option: `send-keys` injects the keystrokes into the *running process's stdin* (garbage/mis-input, not a launch), and `respawn-pane -k` *kills* the running process and replaces it (destroys work). This absence is the deeper reason commands are mint-only — not a chosen restriction but a safety floor. Detecting case 2 via `pane_current_command` + conditional `send-keys` was considered and rejected (fragile detection; makes `open` mutate live sessions — a surprising new power; thin payoff since the user is attaching right there and can type it).

Fine print still open: `--detect`'s new home.

---

## Attach Disposition

### Context

Post-fold, `attach`'s remaining jobs: (1) the exec target of every spawned host window (`portal attach <session> --spawn-ack <batch>:<token>` — a *separate process* in a fresh window must be handed some invocable command line; in-process functions can't serve this), and (2) exact/no-guessing attach for scripts — now covered publicly by `open --session`. Clarified for the user: today `open` is *not* sugar around the `attach` command — both call the same internal Go functions in-process (`connect()` = exec `tmux attach-session` outside tmux / `switch-client` inside); the command form exists only for cross-process callers. Go's `internal/` packages are language-enforced module-private (service class vs artisan command, in Laravel terms).

An architectural constraint independent of spelling: the spawned window must **not** re-run open's guessing chain — the burst resolved all N targets at pre-flight, and re-resolution inside each window could diverge if state changed mid-burst. The exec target keeps exact semantics.

### Options Considered

**A. Keep `attach` as a hidden command** (initially proposed)
- Pros: serves the spawn exec target; **free back-compat** — every existing `portal attach foo` script keeps working with zero alias machinery; exact semantics preserved verbatim.
- Cons: one more (hidden) command in the tree; duplicates what `open --session` now expresses.

**B. Fold into open flags** (`open --session <name> --<ack> …`)
- Pros: smallest command tree; one verb carries the whole session surface, including the machine path.
- Cons: back-compat for `portal attach` then needs a separate alias shim (rerouted to the back-compat subtopic); ack flag rides on open's flag surface (hidden).

### Journey

The initial proposal was A, argued on two grounds: the spawn exec target needs an invocable command, and keeping `attach` gives free back-compat. The user challenged: "why can't we just use Portal Open with a session flag, and pass through an open-acknowledge?" — and specifically recalled that the abridged bootstrap fast-path was deliberately built as a **marker/latch, not tied to certain commands**. Verified against the code: `cmd/root.go:173` — `BootstrappedLatchSatisfied` is consulted once in `PersistentPreRunE`, command-agnostically; any bootstrap-needing command (open included) takes the abridged path when the `@portal-bootstrapped` version-stamped latch is satisfied. So the bootstrap argument for `attach` was void. `attach`'s actual body is tiny (has-session check → best-effort ack write → connect), and every piece has an `open` equivalent. The "free back-compat" argument is real but belongs to the back-compat story (an alias artifact), not the design. Option A's proposer conceded.

### Decision

**`attach` is retired from the design.** Option B:

- Spawned host windows exec `portal open --session <name> --<ack-flag> <batch>:<token>`.
- **Pinned-domain contract:** `--session` (and `--path`) invocations hard-fail on unresolvable, **never** fall back to the TUI picker — a spawned window or script must not pop a TUI. `--session` never mints (a bare name has no directory to mint from); `--path` mints per the attach-vs-mint dichotomy.
- **Burst determinism preserved:** session vanished mid-burst ⇒ pinned open hard-fails ⇒ no ack written ⇒ the burst classifies that window failed, exactly as today.
- **The ack flag is `--ack <batch>:<token>`, marked hidden via Cobra `MarkHidden`** (decided; the user asked about private-flag conventions — there is no `---`/underscore convention; hiding is the mechanism, spelling stays plain. Today's `--spawn-ack` is only *labelled* "internal:" in help text, not actually hidden — the redesign hides it properly. It remains visible in `ps` when a spawned window runs; acceptable — internal, not secret.) Rejected: `--on-open` (reads as a hook trigger, collides with `--on-resume` hooks vocabulary); `--open-ack` (redundant on `open`); `--receipt` (unusual CLI vocabulary). What it does: the burst generates a `<batch>:<token>` per window and bakes it into the spawned command; the spawned Portal process, as its last act before exec'ing into tmux, writes `@portal-spawn-<batch>-<token>` as a tmux server option — a delivery receipt the parent polls for (~8s/window); no receipt ⇒ window classified failed. Internal names (`internal/spawn` package, `spawn` log component, `@portal-spawn-*` marker prefix) are out of this redesign's scope.
- `portal attach` is **deleted outright** — see Back-Compat & Deprecation Story: the user explicitly wants no compat surface.

Confidence: high.

---

## Resolution Scope

### Context

Review finding F4: the input-domain decision's original phrasing ("any target argument to a *public verb* accepts session/path/alias/zoxide") swept in `kill` and `list` unreconciled — and a guessing chain on a destructive verb is exactly backwards.

### Decision

**Universal resolution is `open`'s grammar, not the CLI's.** Every other verb takes its natural domain — `kill`: session names; `list`: nothing. The original phrasing corrected in place. Confidence: high.

---

## Kill Shape

### Context

Whether `kill` gains session globs (`kill 'agentic-workflows-*'` for bulk cleanup) or stays single + exact. Raised alongside a possible terminal `[y/N]` confirm guard for destructive globs.

### Facts established

- **The CLI has zero interactive-prompt machinery today.** Verified against the code: no stdin reads anywhere (`bufio`/`Scanln`/`ReadString`/`[y/N]`/`confirm` all absent outside the TUI). Every CLI command is do-or-error, non-interactive. The one interactive surface in Portal is the picker (the Bubble Tea TUI), where the destructive-confirm modal already lives (`k`-to-kill).
- A `[y/N]` glob-kill guard would therefore mean building a brand-new interaction pattern the CLI does not have.

### Decision

**`kill` stays single + exact — no globs, no resolution, unchanged from today.** Instant kill of one named session. Decided by the user directly: keep destruction maximally explicit; glob-kill was judged marginal and not worth inventing a CLI prompt pattern the codebase doesn't have.

- Rejected: session globs on `kill`; a terminal `[y/N]` confirm guard.
- Bulk kill's natural future home, if ever wanted, is the picker's multi-select (a general selection mode built for reuse) with the existing confirm modal — not the CLI. Noted as a possibility, not committed.
- The "CLI never prompts" idea is left as an observation, not adopted as a governing principle (it wasn't needed once glob-kill was dropped).

Confidence: high.

---

## Open Invocation Grammar (flag/target cross-products)

Consolidates the interaction cells the final review (set 002) found undefined — each `open` flag/target was decided in isolation; this walks their cross-products so the spec author has one grammar table.

### Target-set composition (F1)

**The target set is the union of (all positionals + every `-s`/`-p`/`-z`/`-a` occurrence).** Each element resolves by its own rule — bare positionals run the precedence chain (session → path → alias → zoxide); pins skip the chain and pin their domain — then the whole union goes through atomic pre-flight + absorb/net-N.

- Pins **repeat freely** (`open -s a -s b` = two attach targets).
- Pins **mix across domains and with positionals** (`open -s api -p ~/Code/new blog` = attach `api` + mint at `~/Code/new` + resolve `blog` = three surfaces).
- Pins are simply *the explicit-domain way to name a target*, fully interchangeable with positionals in a burst.
- **`-f` is the sole non-composing flag** — it is not a target but a "skip resolution, open the picker (pre-filtered)" redirect, so it is exclusive with all targets and all other pins.

This retro-justifies the Command Passthrough section's enumeration (which already treated `-p`/`-z`/`-a` as directory-domain target contributors). Confidence: high.

### Self-target absorb & no dedup (F2)

**No dedup — duplicates are honored as intent.** The target set is taken literally (all positionals + every pin, in command-line order); repeated targets are *not* collapsed. Rationale (user, decided hard): if someone asks for three windows of the same thing, Portal shouldn't stop them.

- **Duplicate attach targets** → tmux natively supports multiple clients attached to one session (they mirror), so `open api api api` = three host windows all showing `api` — a legitimate want (same session across three Spaces/monitors).
- **Duplicate mint targets** → each mints a *distinct* new session anyway (fresh `{project}-{nanoid}`), so `open ~/a ~/a` = two new sessions at `~/a` (e.g. server + editor in one project). This is the "multiple sessions per project" the second axiom celebrates — **removing dedup resolves the F2 contradiction the final review flagged** (the earlier "mint-dedupe-by-directory" clause contradicted the always-mint axiom; it is deleted, not exceptioned).
- **Accepted consequence:** overlapping globs (`open 'api-*' 'api-1'`) can produce a duplicate surface; honored, not deduped (low-harm, killable; the user can write non-overlapping globs).

**The trigger absorbs the first target, unconditionally (resolves review-003 F1).** No current-session detection, no special-casing: the terminal takes the **first target in command-line order** (left-to-right as typed — positionals and pins interleaved; the implementation reads `os.Args` rather than cobra's split positional/flag buckets to preserve true order), and every remaining target opens a window.

- If the current session happens to be the first target → a no-op switch (you stay put).
- If it's elsewhere in the set, or absent → the terminal moves to the first target, and the current session (if named) simply gets its own window like any other target.

Rationale (user, decided): *"it doesn't matter where the terminal ends up, as long as they all open"* — so skip the current-session detection entirely. All requested surfaces open; the trigger's landing spot is immaterial and need not be optimized. The inside/outside-tmux split only selects the connector for the first-target surface (`switch-client` inside, `exec attach` outside); the rest run the spawned `portal open …`. Confidence: high.

### Burst exec-argv & mint responsibility (F4)

Each spawned window runs the **same `open` grammar a human would** — one pinned target + the hidden `--ack` — no bespoke burst-only path:

1. **Window argv, per surface:**
   - Attach target (session / glob / `-s`) → `portal open --session <name> --ack <batch>:<token>`.
   - Mint target (path / alias / zoxide / `-p` / `-z` / `-a`) → the parent **reduces it to a literal existing directory at resolve time**, then bakes `portal open --path <literal-dir> --ack <batch>:<token>`. Alias/zoxide queries never travel to the window (they could re-resolve differently mid-burst); only the resolved literal dir does, and `--path` cannot diverge. This is why "resolution must not re-run inside the window" holds without a session existing yet.
2. **Minting happens in each window, not the parent — no pre-minting.** So the atomic guarantee is precisely the **read-only resolve** ("any target unresolvable ⇒ nothing opens, nothing created"). Once resolve passes, each surface opens/mints itself at exec time under **leave-what-opened**; a window that never comes up never mints, so there are no orphaned detached sessions. This is the exact strain the review flagged — resolved by scoping atomicity to the resolve phase and writes to per-surface.
3. **No dedup** — see "Self-target absorb & no dedup (F2)". Duplicate targets each get their own window (mirrored attach, or distinct mint); the burst never collapses them.

The payoff: a spawned window is just `portal open` with a pinned single target + `--ack`, running the identical grammar as an interactive invocation — no special code path. Confidence: high.

### Mint-only command with no target (F7) — preserve today's picker-restricts-to-Projects behavior

**`open -e <cmd>` / `open -- <cmd>` with no target opens the picker restricted to Projects (mint-only) mode**, with a `Pick a project to run <cmd>` banner. Preserved exactly from today's behavior — **not** a usage error.

- **False path corrected mid-review:** the orchestrator initially argued for a usage error, on the assumption that a command + picker was incoherent because the picker can attach to existing sessions (where a run-command is void). The user ran it and disproved this: code-verified (`internal/tui/model.go:755-759`, `WithCommand` → `commandPending = true` → `activePage = PageProjects`), a pending command **switches the picker into Projects mode**, and Projects only ever mint a fresh session — so the command always lands in a clean session. No incoherence, no footgun.
- This is fully consistent with "no target → picker": the command doesn't suppress the picker, it **specializes** it to exactly the surfaces where a command is meaningful (mint), and the banner tells the user what's pending.
- Interaction with Command Passthrough: a command **coexists** with attach targets in a mixed set (scoped to the mints; see Command Passthrough — decided Option B). The command's only *error* case is **zero mint targets** (all-attach set, `open api web -e cmd`). A command with **no** target is neither — it is the specialize-the-picker case above. `-f <text> -e <cmd>` likewise coheres (filtered Projects picker running the command) rather than erroring.

Confidence: high (behavior observed live + code-verified).

---

## Tab-Completion (merged `open` domain)

### Context

Review finding F5: today's verb split gives each verb a clean completion domain (`attach` completes session names, `open` completes paths). The merged `open` accepts session name / path / alias / zoxide / glob in one positional — so what should `<Tab>` after `portal open ` offer?

### Decision

**The principle: complete every Portal-owned enumerable namespace; leave the rest to the shell.** Session names and alias keys are finite sets only Portal knows; zoxide has its own `cd`-style completion and path completion is the shell's job (it does it better than we can). This keeps completion pointed at Portal's own namespaces without cramming multiple into one noisy list.

Applied consistently across every slot (F6 extended the original `-s`/positional-only decision):

| Slot | Completes |
|---|---|
| `open` bare positional | session names |
| `open -s` | session names |
| `open -a` | alias keys |
| `open -p` | (shell — paths) |
| `open -z` | (shell / zoxide's own) |
| `kill` positional | session names |

Rejected: sessions+directories merged into one slot (noisy); nothing at all (loses the genuinely useful session-name / alias-key completion). Confidence: high.

---

## Bare `portal` (no subcommand)

### Context

Review finding F7. Picker placement is decided (`portal open` with no args; `x` = `portal open`, so bare `x` → picker). One corner left: what does bare **`portal`** (no subcommand) do? Today it prints Cobra help — and since `xctl() { portal "$@" }`, bare `xctl` = bare `portal`.

### Decision

**Bare `portal` stays help/usage — it does NOT launch the picker.** The picker already has two doors (`portal open`, `x`); bare `portal` is the control-plane root and should list commands. Making it open the picker would also make bare `xctl` open the picker, muddying the two-tier split we keep: **`x` = launcher (picker/open), `xctl`/`portal` = management plane (help when bare).** Confidence: high.

---

## Utility Command Audit

Framing: per command, is it the right **name**, **shape**, and **tier** (public / hidden)? The `state`/`clean` cleanup pair drove the discussion; the rest (`list`, `alias`, `hooks`, `init`, `version`, `completion`) provisionally keep as-is — one parked grammar nit (`alias` singular vs `hooks` plural).

A load-bearing fact established up front: **nothing internal calls `clean` or `state cleanup`.** The daemon does its own stale-hook cleanup in-process on an idle cadence, and bootstrap self-heals the daemon (orphan sweep + `EnsureSaver`). So neither is plumbing the machinery invokes — both are purely manual backstops to work already done automatically. "Internal only" would just mean *hidden*, not *wired in*.

### `uninstall` (replaces `state cleanup`)

#### Context

`state cleanup` tore down Portal's machinery: kill `_portal-saver` (daemon SIGHUP flush), unregister global hooks, and `--purge` to delete the state dir. Two problems: (1) the meaningful action (purge) was hidden behind a flag — the exact inconsistency this redesign kills; (2) code-verified, the non-purge teardown **self-heals** — bootstrap re-registers hooks and respawns the daemon on the next tmux-touching command, so the teardown lasts only until the next `x`. Even `--purge` is transient while the tmux server runs: the daemon recaptures every live session into a fresh `sessions.json` on its next tick (the live server is the source of truth; the file is its mirror). Purge only permanently loses data when the server is *also* gone (post-reboot / `kill-server`).

#### Decision

Replace `state cleanup` with a public **`portal uninstall`** that is **runtime-only and fully recoverable** — the command *is* the teardown, nothing hidden behind a flag, and it touches **no files at all**.

- **Removes only Portal's tmux-server footprint:** kills the `_portal-saver` daemon and unregisters the global tmux hooks. This is precisely the part that is *hard to do by hand* (locating the daemon, unregistering the exact hook entries) — which is the real reason the command earns its place.
- **Touches no filesystem** — the state dir (`sessions.json`, logs) *and* config (`projects.json`, `aliases`, `hooks.json`, `prefs.json`, `terminals.json`) are both left untouched. Nothing irreversible happens.
- **Prints the completion path:** "Portal's tmux runtime removed. Your saved sessions and config are untouched at `~/.config/portal/`. To remove Portal completely, uninstall the binary and delete that directory." Because `state/` lives *inside* `~/.config/portal/`, one `rm -rf ~/.config/portal` wipes both — a single deliberate act by the user, with full agency; Portal never silently deletes data.
- **Fully recoverable:** the self-heal is now the *feature* — `portal open` re-bootstraps from the retained state (daemon + hooks return, sessions restore). `uninstall` means "deactivate Portal's machinery now," not "destroy my data."

#### Journey — the destructive-delete design was replaced

An earlier draft had `uninstall` delete the state dir (keeping config), which forced the F8 tension (silent irreversible deletion of `sessions.json` vs the no-prompt stance) and needed a `--yes` gate + symlink-safe removal logic. The user proposed the better shape above: **don't delete anything — remove only the tmux runtime, and tell the user to `rm ~/.config/portal` themselves for a full wipe.** This **dissolves F8 entirely** (no irreversible action ⇒ no `--yes`, no prompt, no confrontation with "CLI never prompts"), drops the symlink-safe state-dir deletion logic (nothing deletes the state dir now), and keeps Portal from ever silently nuking data. The only cost — "uninstall" leaves files behind — is standard uninstaller behavior ("app removed; delete preferences manually to finish") and is made honest by the printed message. Name kept (`uninstall`) per the user.

Confidence: high.

### Maintenance & Diagnostics Reorg (`clean` deleted → `doctor`; `state` hidden)

#### Context

`portal clean` bundled three unrelated jobs behind one global verb + a `--logs` flag: prune stale projects (projects.json dirs gone), prune stale hooks (hooks.json dead panes), force the log retention sweep. The **smell is the grab-bag**, not the functionality — one verb doing three things with a flag toggling a fourth. Value audit: stale-hook prune is redundant (daemon does it), the log sweep is redundant (handler retention-sweeps per day; manual `rm` covers the rest), stale-project prune is the only unique action — harmless cruft. So `clean`'s unique value is near-nil as it stood.

#### Journey

The reorg exposed that `clean` conflated **two needs wanting opposite treatments**: *diagnosis* ("is Portal healthy?" — recurring, valuable, today split awkwardly under `state status`) and *action* ("clean X" — mostly already automated). Separating them dissolves `clean`. The distinction the user endorsed: a doctor diagnoses **and** treats (real-life framing) — a well-worn CLI idiom (`brew doctor`, `flutter doctor`), many of which also fix.

`doctor --fix` is itself an action-behind-a-flag — the pattern just killed on `uninstall`. Distinguished and accepted: `--fix` is not a *hidden destructive* action (uninstall's purge was), it is the obvious paired verb to a diagnosis, and everything it does is low-stakes and reversible-by-reconstruction.

#### Decision

- **`portal doctor`** (new, public) — read-only health report across all of Portal: daemon alive, hooks registered without duplicates, saver session up, state dir sane, `sessions.json` valid, any stale entries. **Subsumes `state status`.** The exact check catalog is a spec-level detail.
- **`portal doctor --fix`** — performs the low-stakes repairs it diagnoses: prune stale hooks, prune stale projects, sweep logs. One coherent surface (diagnose, optionally repair the diagnosis) instead of a grab-bag verb plus scattered prune commands.
- **`clean` deleted.** `--logs` gone (logs auto-rotate + retention-sweep; `rm` for the rest). No `logs`/`hooks` maintenance namespaces created — the actions don't earn standing commands.
- **Stale-project pruning folded into the daemon's automation** — a slow cadence (hourly-ish; today only `clean` pruned projects, whereas hooks already prune on the idle tick). Mechanism/cadence is an implementation detail. Net effect: `doctor` reads *healthy* almost always, because the automation keeps it that way; `--fix` is the manual trigger of the same repairs.

Confidence: high.

### `--detect` — folded into `doctor`

#### Context / Decision

`--detect` was a dry-run diagnostic on `spawn`: walk from the current process/tmux-client to the host terminal's macOS app and print its identity (`Ghostty · com.mitchellh.ghostty`) or `no host-local terminal detected`, without spawning. Code-verified: **the flag is user-only** — only its own `cmd/spawn_test.go` tests exercise it; nothing in production invokes `spawn --detect`. The underlying `Detect()` function *is* production (the multi-select picker calls it once per session, cached), so the flag is a hand-crank on the same engine. It exists as a troubleshooting surface (detection fails silently on remote/mosh, unrecognized terminals, or TCC/AppleEvent permission walls → multi-open quietly opens fewer windows).

**Decision: fold `--detect`'s job into `doctor`.** The picker keeps calling `Detect()` in-process; `doctor` calls the same function and prints a `host terminal: Ghostty (supported)` / `unsupported (remote session)` line. The standalone flag retires with `spawn`. Confidence: high.

### Remaining Verbs — keep as-is, except `hooks` → `hook`

#### Decision

`list`, `alias`, `init`, `version`, `completion` **keep as-is** (right name/shape/tier). One grammar change:

- **`hooks` → `hook`** (canonical), following the dominant modern convention of a **singular** namespace noun for a collection (`docker container`, `gh pr`, `git remote`). `alias` was already singular and stays; `hooks` was the odd one out.
- **`hooks` retained as a cobra alias** of `hook` — the **one deliberate exception to the no-back-compat rule** (see Back-Compat). Reason: the user's external Claude skill auto-generates `portal hooks set …` invocations via a SessionStart hook; silently breaking that string is a real operational hassle, unlike the author-owned `attach`/`spawn` scripts. `portal hook …` is canonical/documented; `portal hooks …` keeps working.

Confidence: high.

### `state` Namespace — fully hidden (not removable)

#### Context

User asked whether `state` could be **removed entirely** and become "a totally internal function." Answered precisely against the code.

#### Decision

**`state` becomes fully hidden but cannot stop being a command.** Every remaining `state` subcommand is a **separate-process entry point** invoked by an argv, not an in-process call:

- `state daemon` — the process the `_portal-saver` pane runs.
- `state hydrate` — exec'd into each restored pane via `respawn-pane -k`.
- `state signal-hydrate` / `state notify` / `state commit-now` / `state migrate-rename` — all fired by tmux hooks as `run-shell "portal state …"` (verified in `internal/tmux/hooks_register.go`).

A separate process can only be handed a command line, never a Go function (same constraint that kept `attach` alive as the spawn exec target). So these **must** stay invocable — but the whole namespace is marked **hidden** (gone from `--help` / completion). Once `status` → `doctor` and `cleanup` → `uninstall`, `state` has zero user-facing children, so hiding it entirely is exact: to the user `state` disappears; to tmux it remains plumbing.

**Keep the `state` prefix** — the hook definitions match those command strings by substring for idempotency (`notifyCommand`, `commitNowSubstring`, `migrateRenameSubstring`, `PortalDaemonArgvPattern`, …), so renaming churns internal matching for zero user benefit.

Confidence: high.

### Bootstrap Exemption (`doctor` & `uninstall`) — review F3

#### Context

`PersistentPreRunE` runs the full bootstrap (EnsureServer → RegisterHooks → EnsureSaver → Restore → …) before most commands, but `skipTmuxCheck` (`cmd/root.go:38`) exempts a set including `state`, whose comment already documents the exact hazard: "status/cleanup inspect or tear down machinery the bootstrap sets up — running bootstrap first would be circular." The final review (F3) caught that `doctor`/`uninstall`, as the renamed successors to `state status`/`state cleanup`, inherit this and it was never stated.

#### Decision

**`doctor` and `uninstall` join `skipTmuxCheck` (bootstrap-exempt).**

- **`doctor` must be exempt** — otherwise bootstrap re-registers hooks and respawns the daemon one step *before* `doctor` reads health, so a read-only health check would heal its own subject and always report green (self-defeating). Exempt, it observes raw state, starts nothing (a down server is reported honestly, not silently started), heals nothing.
- **`uninstall` must be exempt** — otherwise it would EnsureServer / RegisterHooks / EnsureSaver / Restore and then immediately tear all of it down (circular, wasteful, racy).
- `clean` **leaves** the exempt set (deleted); `state` stays; the `hooks` → `hook` rename keeps the exemption (`skipTmuxCheck` keys on `c.Name()`, cobra's canonical name, so the `hooks` alias is covered).

This applies the existing, code-documented exemption to the renamed successors — no new pattern. Confidence: high.

---

## Back-Compat & Deprecation Story

### Context

The seed called for a compatibility/deprecation story (back-compat aliases) because `open`/`attach`/`spawn` live in muscle memory and scripts. The synthesis's T4 tension (permanent silent aliases vs deprecated-with-sunset) sat here.

### Decision

**There is no back-compat story — deliberately.** User, verbatim intent: "I'm not interested in backwards compatibility here." Consistent with their earlier frame: "I don't care about the impacts of the rename; if the rename is the right thing to do, we do it — that's the whole point of this task."

- `attach` and `spawn` are **removed**, not aliased, not deprecated-with-warning.
- Broken scripts are the owner's to fix (single-digit user base; the author owns the known scripts).
- The `x`/`xctl` shell functions re-emit from `portal init` and keep working untouched (`x` already maps to `portal open`).
- This is a **deliberate reversal of the seed's assumption**, not an omission — recorded so specification doesn't reintroduce aliases.
- Synthesis T4 (alias lifecycle) is moot: no aliases exist to have a lifecycle.

**One deliberate exception: `hooks` → `hook` keeps `hooks` as a cobra alias** (see Remaining Verbs). Not a softening of the rule — a targeted carve-out because `portal hooks set` is auto-generated by the user's external Claude SessionStart skill (machine-written, not author muscle memory), so breaking that specific string has real operational cost the removed `attach`/`spawn` don't. The alias is permanent and silent (no deprecation timer). Every *other* renamed/removed verb takes no alias.

Confidence: high.

---

## Verb B Contract (superseded by The Open Fold)

*This section originally tracked a distinct "verb B" (`spawn`). The Open Fold dissolved verb B into `open`, so its live content migrated: **arg resolution** → The Open Fold → Arg Resolution + the Attach-vs-Mint Dichotomy; **absorb vs stay-put** → settled by the absorb/net-N rule (stay-put is a deferred future flag); **`--detect` home** → folded into `doctor`. Retained only as a pointer so the migration is traceable — no open items remain here.*

---

## Summary

### Key Insights

1. Verb splits feel right when they split by *what happens*, not by what the argument looks like — the open/attach blur was an input-type split masquerading as a verb pair.
2. The porcelain/plumbing distinction Portal already uses for `state` internals generalizes — but the resolution landed one level cleaner than "hide the exact command": `attach` was *retired*, its exactness surfaced publicly as `open --session`/`--path` (documented, script-friendly), and only the truly-internal pieces stayed hidden (the `--ack` receipt flag + the argv-invoked `state` namespace). Exactness didn't need to be hidden — it needed to be a flag.
3. The picker multi-select's "net N surfaces, your terminal is one of them" rule is continuous in N — the seed's count-dependent-split worry about variadic verbs was a framing artifact. (It later simplified even further: no dedup, and the trigger just takes the first target — "it doesn't matter where the terminal lands, as long as they all open.")
4. A late-review discipline paid off twice: live-running the current `open -e` behavior overturned a wrong "usage error" lean (the picker restricts to Projects/mint mode — coherent), and re-reading `cmd/root.go` proved the bootstrap-latch argument command-agnostic. Verify against the running tool and the code, not against assumptions.

### Open Threads

- **Stay-put multi-open flag** — deliberately deferred future scope (open windows but leave the trigger terminal put); not designed here.
- **Multi-match zoxide** (`doctor`-style "mint sessions for everything matching X") — deferred; shotgun risk.
- **Bulk kill via the picker's multi-select** — noted as the natural future home if ever wanted; not built here.
- (All Discussion Map subtopics are decided; the above are explicitly deferred scope, not unresolved decisions.)

### Current State

- Decided: `open` is the single public session verb (fold, absorb/net-N rule with no dedup, universal resolution, domain-pinning flags `-s`/`-p`/`-z`/`-a`/`-f`, mint-scoped `-e`/`--`, hidden `--ack`, picker at no-args); `open` name kept on portal-metaphor grounds; `attach`/`spawn` deleted outright — no back-compat surface (deliberate seed reversal, bar the one `hooks`→`hook` alias).
- Decided: kill stays single + exact; `uninstall` replaces `state cleanup` — **runtime-only** (kills daemon + unregisters hooks, touches NO files: both config *and* state dir retained), fully recoverable, prints the manual `rm ~/.config/portal` path for a full wipe.
- Decided: `clean` deleted → `doctor` (+ `--fix`); project-prune automated; `state` namespace fully hidden.
- Decided: remaining verbs keep as-is (`hooks` → `hook`, `hooks` kept as the one back-compat alias); `--detect` folded into `doctor`.
- All Discussion Map subtopics now decided.

## Triage

(none)

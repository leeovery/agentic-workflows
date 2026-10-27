---
topic: x-xctl-split
status: concluded
work_type: greenfield
date: 2026-02-11
---

# Discussion: Rename & Binary Split (mux → x / xctl)

## Context

Current tool is specced as `mux` — single binary with subcommands (`mux`, `mux .`, `mux <path>`, `mux list`, `mux attach`, `mux clean`, etc.). Not yet implemented.

Proposal: rename to Portal and restructure the CLI surface. Separate interactive launcher UX from scripting/management commands. The tool manages tmux sessions/workspaces — `x` is the "portal" into them.

Source material from external AI conversation proposed two separate binaries. Discussion evolved into a single-binary + shell-integration approach.

### References

- [Current Portal spec](../specification/portal.md)
- [tmux-session-managers-analysis](../research/tmux-session-managers-analysis.md)
- [zellij-to-tmux-migration discussion](zellij-to-tmux-migration.md)

## Questions

- [x] Architecture: two binaries or single binary + shell integration?
- [x] Naming: project name, binary name, shell commands?
- [x] What behaviour belongs in `x` (interactive launcher)?
- [x] Query resolution: aliases + zoxide + fallback
- [x] What behaviour belongs in `xctl` (control plane)?
- [x] Under-the-hood routing: how x and xctl map to portal subcommands
- [x] Output conventions for xctl
- [x] How does this affect the existing mux spec?

---

*Each question above gets its own section below. Check off as concluded.*

---

## Architecture: two binaries or single binary + shell integration?

### Context

Source material proposed two separate binaries (`x` and `xctl`). But distributing, installing, and versioning two binaries adds friction. And user wanted configurable command names.

### Options Considered

**Option A: Two separate binaries**
- Pros: clean separation at OS level, no shell integration needed
- Cons: two binaries to distribute/install/update, names not configurable without user-maintained aliases

**Option B: Single binary + shell integration (zoxide pattern)**
- Pros: one binary to ship, configurable names via `--cmd`, completions emitted by same `init`, proven pattern (zoxide, starship)
- Cons: requires `eval "$(portal init zsh)"` in shell rc — but this is already standard practice

### Journey

Initially discussed as two binaries per source material. User raised: "do we need two binaries?" — noted the alternative of a single binary with a subcommand (`portal ctl`). Then connected this to zoxide's pattern: one binary (`zoxide`), shell integration creates the UX aliases (`z`, `zi`), configurable via `--cmd`.

Key insight: the `x` vs `xctl` conceptual split still exists — it's just `portal` vs `portal ctl` under the hood. Shell functions are the ergonomic layer.

### Decision

**Single binary `portal` with shell integration.** User adds one line to `.zshrc`:
```
eval "$(portal init zsh)"
```
This emits shell functions/aliases for `x` and `xctl`. Configurable via `--cmd`:
```
eval "$(portal init zsh --cmd p)"  # creates p() and pctl()
```
Whether the init emits functions or aliases is an implementation detail — whatever works. User doesn't define anything manually.

Confidence: High. Matches proven patterns, solves distribution, enables configurability.

---

## Naming: project name, binary name, shell commands?

### Decision

- **Project/engine name**: Portal
- **Binary**: `portal`
- **Default shell commands**: `x` (launcher), `xctl` (control plane)
- **Configurable**: `--cmd` flag on `portal init` changes both (e.g., `--cmd p` → `p` + `pctl`)

The `ctl` suffix convention is well-understood (kubectl, systemctl, sysctl). Immediately signals "control/management tool."

Confidence: High.

---

## What behaviour belongs in `x` (interactive launcher)?

### Decision

`x` is the portal into workspaces. It does one thing: get you into a tmux session.

| Input | Behaviour |
|-------|-----------|
| `x` | Opens TUI picker |
| `x .` | New session in cwd, attach |
| `x <path>` | New session at resolved path, attach |
| `x <query>` | Resolve via alias → zoxide → TUI fallback, attach |

No subcommands. No verbs. Just a destination (or no args for TUI). This is the muscle-memory daily driver.

Confidence: High.

---

## Query resolution: aliases + zoxide + fallback

### Context

Current mux spec uses explicit project aliases. Source material suggested zoxide integration. User wanted both — aliases for deterministic shortcuts (warp-drive style), zoxide for the long tail.

### Options Considered

**Option A: Aliases only** (current mux spec)
- Pros: deterministic, simple
- Cons: must register everything, no discovery

**Option B: Zoxide only**
- Pros: zero config, leverages existing data
- Cons: ambiguous for common dir names (`api`, `app`), no custom shortcuts

**Option C: Aliases + zoxide + fallback**
- Pros: deterministic shortcuts where needed, fuzzy matching everywhere else, graceful degradation
- Cons: slightly more complex resolution — but the order is clear

### Journey

User cited warp-drive as the mental model for aliases — short muscle-memory shortcuts like `m2api` → `~/Code/mac2/api`, `aa` → `~/Code/aerobid/api`. These solve the problem zoxide can't: when multiple directories share the same name (`api` appears in 10 projects).

For everything else, zoxide already has rich frecency data from normal shell usage. Building Portal's own frecency tracker would be over-engineering — cold-start problem, limited data from Portal usage alone.

### Decision

**Resolution order for `x <query>`:**
1. **Existing path** (absolute, relative, `~`) → use directly
2. **Alias match** → resolve to configured path
3. **Zoxide query** (`zoxide query <terms>`) → best frecency match
4. **No match** → fall back to TUI with query pre-filled as filter

Zoxide is an optional soft dependency. If not installed, step 3 is skipped. Aliases and TUI fallback still work.

**Alias management via `xctl`:**
```
xctl alias set m2api ~/Code/mac2/api
xctl alias rm m2api
xctl alias list
```

Storage: flat key-value in a config file. Either a dedicated aliases file or a section in the main config — keep it simple, don't over-engineer.

Confidence: High.

---

## What behaviour belongs in `xctl` (control plane)?

### Context

Source material proposed: list, attach, kill, clean, new, rename. Need to decide what earns a place vs. staying TUI-only. Also need to clarify how xctl relates to portal under the hood.

### Options Considered

**Source material set**: list, attach, kill, clean, new, rename, alias
**Reduced set**: list, attach, kill, clean, alias (drop new and rename)

### Journey

`new` was rejected — creating sessions is what `x` does (`x .`, `x <path>`, `x <query>`). Having `xctl new` duplicates that. `rename` was rejected — low scripting value, TUI action. Who's scripting session renames?

Then debated whether `xctl` needs to exist at all. Since `portal` has explicit subcommands (`portal list`, `portal kill`, etc.), `xctl` is just a passthrough: `xctl list` → `portal list`. But: zero implementation cost (shell function wrapper), nice shared-letter pairing with `x`, and configurable via `--cmd` (user picks `q` → gets `q` + `qctl`). Kept for ergonomics.

### Decision

**xctl subcommands:**

| Command | Purpose |
|---------|---------|
| `xctl list` | List sessions (machine-friendly, one per line) |
| `xctl attach <session>` | Attach to session by exact name |
| `xctl kill <session>` | Kill a session |
| `xctl clean` | Remove stale data, prune dead entries |
| `xctl alias set <name> <path>` | Set an alias |
| `xctl alias rm <name>` | Remove an alias |
| `xctl alias list` | List all aliases |

**Excluded:** `new` (use `x`), `rename` (TUI-only).

**Under the hood:** `xctl` is a shell function that passes through to `portal`:
```bash
function xctl() { portal "$@" }
```

This means `xctl list` = `portal list`. The function exists purely for ergonomics and configurability.

Confidence: High.

---

## Under-the-hood routing: how x and xctl map to portal subcommands

### Decision

The `portal` binary has explicit subcommands. Shell functions provide the ergonomic layer:

```bash
# emitted by: eval "$(portal init zsh)"
function x() { portal open "$@" }
function xctl() { portal "$@" }
```

**Portal subcommand map:**

| User types | Resolves to | Purpose |
|------------|-------------|---------|
| `x` | `portal open` | TUI picker |
| `x .` | `portal open .` | New session in cwd |
| `x <query>` | `portal open <query>` | Resolve + attach |
| `xctl list` | `portal list` | List sessions |
| `xctl attach <s>` | `portal attach <s>` | Attach by name |
| `xctl kill <s>` | `portal kill <s>` | Kill session |
| `xctl clean` | `portal clean` | Housekeeping |
| `xctl alias ...` | `portal alias ...` | Alias management |

`portal open` is the launcher subcommand — handles TUI, path resolution, query resolution. All other subcommands are management verbs. No ambiguity because `open` is explicit.

`portal init <shell>` and `portal version` are accessed directly via the `portal` binary (or via `xctl init`/`xctl version` since xctl passes through).

Confidence: High.

---

## Output conventions for xctl

### Context

Source material proposed machine-friendly defaults, `--json`, `--quiet`, consistent exit codes. Current mux spec just has names-only output for `mux list`. Needed to decide what the default output looks like and how to handle interactive vs piped contexts.

### Options Considered

**Option A: Names only always** (current mux spec)
- Pros: dead simple piping
- Cons: useless for interactive terminal use — no status, path, etc.

**Option B: Rich output always** (source material)
- Pros: informative
- Cons: requires `awk` to extract names for piping

**Option C: TTY detection** (ls/git pattern)
- Pros: right output for the context automatically, no flags needed for common cases
- Cons: none meaningful — well-established Unix pattern

### Journey

Source material proposed `--json` and `--quiet` flags. Dropped `--json` and `--quiet` — over-engineering for current needs. The real question was whether to default to names-only or rich output.

Drew analogy to `ls`: simple by default but configurable. Then identified TTY detection as the clean solution — interactive terminal gets rich output, piped context gets names only. No flags needed for the 95% case.

### Decision

**TTY detection for `xctl list`:**

Interactive (stdout is TTY):
```
flowx-dev    attached    3 panes    ~/work/flowx
claude-lab   detached    1 pane     ~/work/claude
```

Piped (stdout is not TTY):
```
flowx-dev
claude-lab
```

Override flags for edge cases:
- `xctl list --short` — names only even in terminal
- `xctl list --long` — full details even in pipe

**Exit codes** (standard Unix):
- 0: success
- 1: not found / no match
- 2: invalid usage

**No `--json` or `--quiet`** — YAGNI. Can add later if scripting needs evolve.

Confidence: High.

---

## How does this affect the existing mux spec?

### Decision

The mux spec (concluded) carries forward almost entirely. What changes:

| Aspect | mux spec | Portal |
|--------|----------|--------|
| Binary name | `mux` | `portal` |
| CLI entry | `mux` (single command) | `portal open` via `x` shell function |
| Management | `mux list`, `mux clean`, etc. | `portal list`, `portal clean` via `xctl` |
| Aliases | project aliases in projects.json | warp-drive style aliases + zoxide resolution |
| Shell integration | `mux completion <shell>` | `portal init <shell>` (completions + functions) |
| List output | names only | TTY-aware (rich interactive, names piped) |

**Unchanged**: TUI design, Bubble Tea, session model, session naming, git root resolution, inside-tmux behaviour, project memory concept, file browser, storage location, distribution, tmux integration, dependencies.

The mux spec should be superseded by a new Portal spec that weaves in these decisions. That's the next workflow phase (specification).

Confidence: High.

---

## Summary

### Key Insights

1. Single-binary + shell-integration (zoxide pattern) is cleaner than two separate binaries — solves distribution, enables configurable command names, proven pattern
2. The `x` / `xctl` conceptual split maps cleanly to `portal open` / `portal <verb>` under the hood
3. Aliases and zoxide serve different needs and complement each other — aliases for deterministic muscle-memory shortcuts, zoxide for long-tail frecency matching
4. TTY detection for output formatting is the "do the right thing" approach — no flags needed for common cases

### Current State

- All questions resolved
- Ready for specification phase — new Portal spec superseding mux spec

### Next Steps

- [ ] Create Portal specification (supersedes mux spec), weaving in all decisions from this discussion
- [ ] Determine if mux spec needs formal "superseded by portal" marker

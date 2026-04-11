---
topic: core-architecture
status: concluded
work_type: greenfield
date: 2026-02-09
---

# Discussion: Core Architecture — Repo Modes, Asset Discovery, and Manifest

## Context

agntc is a standalone npx-based tool that installs AI skills, agents, scripts, and hooks from git repos into projects. Replaces current Claude Manager (npm dependency + postinstall). Three tightly coupled decisions need resolution: how assets are discovered in plugin repos, how unit vs collection modes work, and how the manifest tracks everything.

Research explored convention-based discovery, two repo modes (unit/collection), and a flat `.agntc/manifest.json`. These are interdependent — manifest shape depends on mode semantics, which depends on discovery rules.

### References

- [Research: exploration.md](../research/exploration.md) (lines 72-181)

## Questions

- [x] What's the installable unit, and how is it detected?
- [x] What's the manifest shape that supports both modes cleanly?
- [x] How should convention-based asset discovery handle edge cases?

---

## What's the installable unit, and how is it detected?

### Context

Need to distinguish between a repo that IS a plugin (install everything) vs a repo that CONTAINS plugins (user picks). Research proposed convention-based detection (scan for `skills/`, `agents/` dirs) with unit/collection modes. But edge cases emerged around single skills, mixed structures, and interdependent assets.

### Options Considered

**Option A: Pure convention — scan for asset dirs at specific depths**
- Depth 1 asset dirs → plugin. Depth 2 → collection. Both → ask user.
- Pros: zero config for plugin authors
- Cons: ambiguous edge cases (what if a subdir just happens to have a `skills/` dir?), can't distinguish "install all together" from "pick individually", can't express agent compatibility

**Option B: Marker file (`agntc.json`) at each plugin boundary**
- Every selectable plugin gets its own `agntc.json`
- Pros: explicit, no ambiguity, also carries agent compatibility
- Cons: repetitive for simple collections (every skill dir needs its own file)

**Option C: Root-level `agntc.json` with type declaration + optional per-plugin overrides**
- Root `agntc.json` declares `"type": "plugin"` or `"type": "collection"`
- In collection mode, each subdir is a selectable plugin
- Subdirs can optionally have their own `agntc.json` to override (e.g., agent compatibility)
- Convention fallback for repos with no `agntc.json` at all

### Journey

Started with pure convention (research position). Looked at how Vercel's skills CLI handles it — they scan for all `SKILL.md` files and let users pick individually. That works for skills-only, but we handle interdependent asset types (skills + agents + scripts that must install together, like claude-technical-workflows with 17 skills, 12 agents, 5 scripts).

This surfaced the real question: **what's the atomic boundary?** A plugin is always atomic — you install it whole or not at all. You never cherry-pick skills from within claude-technical-workflows.

Explored what happens with a "collection of skills" — e.g., language-specific skills (Go, PHP, Python) where you want to pick. With option B, every skill dir needs its own `agntc.json` — repetitive when they all target the same agents.

Option C resolved this: root `agntc.json` declares the type, agent compatibility at root applies to all unless a subdir overrides. One config file covers a simple collection; complex cases still handled.

Also settled the terminology: **plugin** (not "unit") for the atomic installable thing. **Collection** for a repo containing multiple plugins.

Considered bare skills (`SKILL.md` at repo root with no wrapping). Decided not to support this as a special case — if you're publishing through agntc, add an `agntc.json`. Keeps detection uniform.

### Decision

**Option C — root-level `agntc.json` with type declaration.**

Detection rules:
1. Root `agntc.json` with `"type": "collection"` → collection. Each subdir is a selectable plugin.
2. Root `agntc.json` with `"type": "plugin"` (or no type field — plugin is default) → single plugin. Install everything.
3. No `agntc.json` at root → convention fallback: scan for asset dirs at root.

Plugin internals use convention-based asset discovery (`skills/`, `agents/`, `scripts/`, `hooks/`). `agntc.json` marks boundaries and carries metadata; convention discovers assets within those boundaries.

Agent compatibility declared at root applies to all plugins in a collection unless a specific subdir has its own `agntc.json` override.

Confidence: High. Covers all identified use cases cleanly.

---

## What's the manifest shape that supports both modes cleanly?

### Context

The manifest (`.agntc/manifest.json` in user's project) tracks what's installed so `remove`, `update`, and `list` can work. Needs to handle both standalone plugin installs and individual plugins from collections. Research proposed a flat structure keyed by repo, but collections complicate that — one repo can produce multiple independent installs.

### Options Considered

**Option A: Key by repo, nest plugins inside**
- Standalone plugins: flat entry with files list
- Collections: entry with `"type": "collection"` and nested `"plugins"` object
- Pros: grouped by source repo, easy to find all installs from one repo
- Cons: two different shapes depending on type, more complex iteration

**Option B: Key by install path — `repo` for plugins, `repo/plugin` for collection items**
- Every entry is a plugin regardless of source
- Collection plugins keyed as `owner/repo/plugin-name`
- Pros: uniform shape, every entry is a plugin, simple iteration
- Cons: collection relationship is implicit (derived from key prefix)

### Journey

Initially considered option A for its grouping — seemed natural for `update` (one repo = one check). But realized the collection is just a convenience wrapper for the source repo. What you're actually installing is the plugin. The collection doesn't have independent identity in the user's project.

Option B aligns with this: every manifest entry is a plugin. Whether it came from a standalone repo or a collection doesn't change how it's tracked. For `update`, you derive the repo from the key prefix and deduplicate — trivial. For `remove`, you can offer "remove all from this repo" or individual plugins using the same prefix grouping.

Also discussed what each entry needs:
- **`ref`**: what the user asked for — tag, branch, or `null` (default HEAD). Drives update semantics: pinned tag = don't auto-update, branch/null = check for newer.
- **`commit`**: resolved SHA at install time. For comparison against remote.
- **`installedAt`**: timestamp. Informational.
- **`agents`**: which agents this was installed for.
- **`files`**: exact paths of copied files/dirs. Critical for clean removal and update (nuke-and-reinstall approach — delete everything listed, copy fresh from new version).

Discussed update strategy: nuke-and-reinstall is simpler than diffing. Handles all edge cases (removed files, renamed dirs, moved assets) without complexity. The manifest's file list tells you exactly what to delete before re-copying.

### Decision

**Option B — key by install path, uniform plugin entries.**

```json
{
  "leeovery/claude-technical-workflows": {
    "ref": "v2.1.6",
    "commit": "abc123f",
    "installedAt": "2026-02-09T14:30:00Z",
    "agents": ["claude"],
    "files": [
      ".claude/skills/technical-planning/",
      ".claude/skills/technical-review/",
      ".claude/agents/task-executor.md",
      ".claude/scripts/migrate.sh"
    ]
  },
  "leeovery/agent-skills/go": {
    "ref": null,
    "commit": "def456a",
    "installedAt": "2026-02-09T14:30:00Z",
    "agents": ["claude", "codex"],
    "files": [
      ".claude/skills/go-development/",
      ".agents/skills/go-development/"
    ]
  }
}
```

- Every entry is a plugin. Uniform shape.
- Collection membership implicit from key (e.g., `leeovery/agent-skills/go` → repo is `leeovery/agent-skills`).
- `ref` + `commit` together answer "what did you ask for?" and "what did you get?"
- `files` lists destination paths — what was actually copied into the project. Enables clean nuke-and-reinstall on update.
- Update approach: delete all `files`, re-clone, re-copy, update manifest entry.

Confidence: High.

---

## How should convention-based asset discovery handle edge cases?

### Context

Once a plugin boundary is identified, the tool scans inside it for assets to copy. Need to define: what gets copied, what gets ignored, and how to handle structural variations (bare skills, non-asset files, etc.).

### Options Considered

**Option A: Strict convention only — asset dirs or nothing**
- Only copy contents of recognized asset dirs (`skills/`, `agents/`, etc.)
- Anything not in an asset dir is ignored
- Pros: simple, predictable
- Cons: bare single-skill plugins need a `skills/` wrapper — feels over-structured

**Option B: Convention + bare skill detection**
- Primary: scan for asset dirs and copy their contents
- Fallback: if no asset dirs found, check for `SKILL.md` at plugin root — treat the plugin dir itself as a skill
- Pros: reduces ceremony for single-skill plugins
- Cons: two discovery paths

### Journey

Initially proposed strict convention only. But this meant a single-skill plugin in a collection needed:
```
go/
└── skills/
    └── go-development/
        └── SKILL.md
```

This felt unnecessarily nested — the `go/` directory name is redundant with `go-development/`, and the `skills/` dir is boilerplate for a single skill. Questioned whether this was too ceremonial.

Realized that `SKILL.md` is already a well-defined marker from the Agent Skills standard. If a plugin directory contains `SKILL.md` at its root (and no asset dirs), the plugin IS a skill. The tool can detect this and install the whole directory as a skill — e.g., copy `go-development/` to `.claude/skills/go-development/`.

This only applies to skills — `SKILL.md` is a unique, standard marker. Agents, hooks, scripts have no equivalent marker, so they always need convention dirs. But skills are the overwhelmingly common single-asset case.

Also resolved what gets ignored: everything not in a recognized asset dir and not a bare `SKILL.md`. So `README.md`, `CLAUDE.md`, `package.json`, `agntc.json` itself — all ignored during copy. These are plugin authoring artifacts, not installation targets.

Recognized asset directories: `skills/`, `agents/`, `scripts/`, `hooks/`, `rules/`.

### Decision

**Option B — convention + bare skill detection.**

Asset discovery within a plugin:
1. Scan for recognized asset dirs: `skills/`, `agents/`, `scripts/`, `hooks/`, `rules/`
2. If found → copy contents of each to the appropriate target dir per agent
3. If no asset dirs found → check for `SKILL.md` at plugin root
4. If `SKILL.md` found → bare skill — copy the entire plugin directory as a skill
5. If neither → nothing to install, warn

Everything else in the plugin (README, CLAUDE.md, package.json, agntc.json, etc.) is ignored. Only recognized asset dirs and bare skills get copied.

**The author controls granularity**: plugin vs collection is determined by `agntc.json` `"type"` field. A plugin is always atomic — all its assets install together with no choices offered within. If the author wants individual selection, they structure the repo as a collection.

### Permutations validated

All seven permutations walked through and confirmed working:

**Case 1 — Standalone plugin**: root `agntc.json` (no collection type) + asset dirs → install everything atomically.

**Case 2 — Collection of complex plugins**: root `agntc.json` with `"type": "collection"`, subdirs with asset dirs → user picks plugins, each installs atomically.

**Case 3 — Collection of bare skills**: root `agntc.json` with `"type": "collection"`, subdirs with `SKILL.md` → user picks, each installs as a single skill.

**Case 4 — Mixed collection**: collection containing both complex plugins (with asset dirs) and bare skills → user picks, each installs per its structure.

**Case 5 — Plugin with multiple skills**: root `agntc.json` (no collection type) + `skills/` dir with multiple skills → install ALL skills, no choice. Author bundled them intentionally.

**Case 6 — Plugin vs collection is author's choice**: same directory structure, different `agntc.json` `"type"` value → different behaviour. `{}` = plugin (install all). `{ "type": "collection" }` = user picks.

**Case 7 — No `agntc.json` (convention fallback)**: scan root for asset dirs → treat as plugin. Backwards compatible with repos that haven't adopted agntc config.

Confidence: High.

---

## Summary

### Key Insights
1. The plugin is the atomic boundary — always installs whole, never cherry-picked. Author controls granularity via `agntc.json` type.
2. `agntc.json` serves dual purpose: boundary marker (plugin vs collection) and metadata carrier (agent compatibility).
3. Convention-based asset discovery works within plugin boundaries with one enhancement: bare skill detection via `SKILL.md`.
4. The manifest is plugin-centric — every entry is a plugin regardless of whether it came from a standalone repo or a collection.
5. Nuke-and-reinstall is the update strategy — simple, handles all edge cases, enabled by manifest's file tracking.

### Current State
- Resolved: plugin/collection model with `agntc.json` as boundary marker and type declaration
- Resolved: manifest shape — flat, keyed by install path, uniform plugin entries
- Resolved: asset discovery — convention dirs + bare skill fallback, all permutations validated

### Next Steps
- [ ] Discuss remaining research topics (multi-agent support, CLI commands/UX, naming, deferred items)

# Tick

*Output format adapter for **[workflow-planning-process](../../../SKILL.md)***

---

Use this format when you want structured task tracking with native dependency resolution, priority ordering, and token-efficient output designed for AI agents.

## Benefits

- Native dependency graph with cycle detection and blocking resolution
- `tick ready` returns the next available task in one command
- Token-efficient TOON output format (30-60% fewer tokens than JSON)
- Git-friendly JSONL storage — append-only, human-readable
- Parent/child hierarchy maps naturally to topic/phase/task structure
- SQLite cache for fast queries over large task sets

## Setup

Install Tick:

```bash
# macOS
brew install leeovery/tools/tick

# Linux
curl -fsSL https://raw.githubusercontent.com/leeovery/tick/main/scripts/install.sh | bash

# Go
go install github.com/leeovery/tick/cmd/tick@latest
```

Initialize in the project root:

```bash
tick init
```

Add to `.gitignore`:

```
.tick/cache.db
.tick/lock
.tick/.tasks-*.jsonl.tmp
```

## Structure Mapping

| Concept | Tick Entity |
|---------|:---|
| Topic | Top-level parent task |
| Phase | Subtask of the topic task |
| Task | Subtask of a phase task |
| Dependency | Blocking relationship (`tick dep add`) |

The 3-level hierarchy (topic → phase → task) uses Tick's parent/child system. Parent tasks are implicitly blocked by their children — a parent is not "ready" until all children are complete. Explicit dependencies (`tick dep add`) handle cross-phase and cross-topic blocking.

## Usage Notes

- **Help**: `tick help --all` displays all available commands and flags in a single view.
- **Output format**: The `--toon` flag is **not needed** — TOON is the default for non-interactive shells, which is what this harness runs in. Omit it from all commands.

## Output Location

Tasks are stored in a `.tick/` directory at the project root:

```
.tick/
├── tasks.jsonl     # Append-only source of truth (git-friendly)
├── cache.db        # SQLite query cache (auto-rebuilt, do not commit)
└── lock            # File lock for concurrent access
```

All task data lives in `tasks.jsonl`. The hierarchy is encoded via parent references — no subdirectories needed.

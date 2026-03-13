# Output Formats

*Reference for **[workflow-planning-process](../SKILL.md)***

---

Plans can be stored in different formats. Each format is a directory of 5 files split by concern (about, authoring, reading, updating, graph).

**IMPORTANT**: Only offer formats listed below. Do not invent or suggest formats that don't have corresponding directories in the [output-formats/](output-formats/) directory.

## Available Formats

### Local Markdown
format: `local-markdown`

adapter: [local-markdown/](output-formats/local-markdown/)


Plan Index File with task detail stored as individual markdown files in a `{work_unit}/` subdirectory. No external tools or setup required.

- **Pros**: Zero setup, works offline, human-readable, easy to edit in any text editor
- **Cons**: No visual board, everything in markdown can get long for complex features, no dependency graph
- **Best for**: Simple features, small plans, quick iterations

### Linear
format: `linear`

adapter: [linear/](output-formats/linear/)


Tasks managed as Linear issues within a Linear project. A thin Plan Index File points to the Linear project; Linear is the source of truth.

- **Pros**: Visual tracking, team collaboration, real-time updates, integrates with existing Linear workflows
- **Cons**: Requires Linear account and MCP server, external dependency, not fully local
- **Best for**: Teams already using Linear, collaborative projects needing shared visibility

### Tick
format: `tick`

adapter: [tick/](output-formats/tick/)

CLI task management with native dependencies, priority, and token-efficient output designed for AI agents. Tasks stored in git-friendly JSONL with a SQLite cache.

- **Pros**: Native dependency graph with cycle detection, `tick ready` for next-task resolution, token-efficient TOON output, git-friendly, works offline
- **Cons**: Requires Tick CLI installation, no visual board or web UI
- **Best for**: AI-driven workflows needing structured task tracking with dependency resolution

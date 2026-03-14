# Output Formats

*Reference for **[workflow-planning-process](../SKILL.md)***

---

**IMPORTANT**: Only offer formats listed below. Do not invent or suggest formats that don't have corresponding directories in the [output-formats/](output-formats/) directory.

> *Output the next fenced block as a code block:*

```
Available output formats:

  1. Tick
     CLI task management with native dependency graph and priority.
     Requires Tick CLI installation.
     Best for: AI-driven workflows needing structured task tracking

  2. Local Markdown
     Task files stored as markdown in the planning directory.
     No external tools required.
     Best for: simple features, small plans, quick iterations

  3. Linear
     Tasks managed as Linear issues within a Linear project.
     Requires Linear account and MCP server.
     Best for: teams already using Linear, collaborative projects
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Select a format:

- **`1`** — Tick
- **`2`** — Local Markdown
- **`3`** — Linear
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `1`

Set `chosen-format` = `tick`.

#### If `2`

Set `chosen-format` = `local-markdown`.

#### If `3`

Set `chosen-format` = `linear`.

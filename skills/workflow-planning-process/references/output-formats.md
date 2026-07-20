# Output Formats

*Reference for **[workflow-planning-process](../SKILL.md)***

---

**IMPORTANT**: Only offer formats listed below. Do not invent or suggest formats that don't have corresponding directories in the [output-formats/](output-formats/) directory.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Select an output format:

- **`1`** — Tick — CLI task management with a native dependency graph and priority; requires the Tick CLI. Best for AI-driven workflows needing structured task tracking.
- **`2`** — Local Markdown — task files stored as markdown in the planning directory; no external tools. Best for simple features, small plans, quick iterations.
- **`3`** — Linear — tasks managed as Linear issues in a Linear project; requires a Linear account and MCP server. Best for teams already using Linear.
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `1`

Set `chosen-format` = `tick`.

→ Return to caller.

#### If `2`

Set `chosen-format` = `local-markdown`.

→ Return to caller.

#### If `3`

Set `chosen-format` = `linear`.

→ Return to caller.

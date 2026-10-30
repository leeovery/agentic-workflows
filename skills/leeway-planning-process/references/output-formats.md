# Output Formats

*Reference for **[workflow-planning-process](../SKILL.md)***

---

**IMPORTANT**: Only offer the formats below. Do not invent or suggest formats that don't have corresponding directories in the [output-formats/](output-formats/) directory.

Write the offer to `.workflows/.cache/{work_unit}/{phase}/{topic}/format-offer.json` with the Write tool, exactly as written here:

```json
{"formats": [
  {"name": "tick", "label": "Tick — CLI task management with a native dependency graph and priority; requires the Tick CLI. Best for AI-driven workflows needing structured task tracking."},
  {"name": "local-markdown", "label": "Local Markdown — task files stored as markdown in the planning directory; no external tools. Best for simple features, small plans, quick iterations."},
  {"name": "linear", "label": "Linear — tasks managed as Linear issues in a Linear project; requires a Linear account and MCP server. Best for teams already using Linear."}
]}
```

Render the offer:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render plan-format-gate --variant select --file .workflows/.cache/{work_unit}/{phase}/{topic}/format-offer.json
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

The surface numbers the rows in payload order — set `chosen-format` to the picked row's `name`.

→ Return to caller.

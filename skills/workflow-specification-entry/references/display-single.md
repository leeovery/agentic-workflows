# Display: Single Discussion

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Auto-proceed path — only one completed discussion exists, so no selection menu is needed. The DATA section carries the spec-coverage outcome: `single_variant` (`no-spec` | `has-spec` | `grouped`), `verb`, and `proceed_name`.

## Display

Render the scoped snapshot:

```bash
node .claude/skills/workflow-specification-entry/scripts/gateway.cjs view {work_unit}
```

Emit the TITLE section, then the DISPLAY section, each verbatim per its marker.

## After Display

> *Output the next fenced block as a text code block (```text fence):*

```text
Automatically proceeding with "{proceed_name:(titlecase)}".
```

Auto-proceed with the DATA `verb`.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

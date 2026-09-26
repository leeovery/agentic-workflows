# Completed Specifications

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Loaded from the primary spec menu when the user picks `c/completed`. Render the concluded-specs sub-view:

```bash
node .claude/skills/workflow-specification-entry/scripts/gateway.cjs completed-menu {work_unit}
```

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker.

**STOP.** Wait for user response.

Match the user's input to its `ACTIONS` entry by `key`.

#### If `action` is `refine_spec`

The entry's `topic` and `verb`, plus that spec's DATA detail (sources, consult references), become the context for confirmation.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

→ On return, return to caller.

#### If `action` is `back`

→ Return to caller.

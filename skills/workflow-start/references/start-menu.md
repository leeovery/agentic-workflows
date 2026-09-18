# Start Menu

*Reference for **[workflow-start](../SKILL.md)** — loaded by the roadmap's and the baseline's back.*

---

Render the start menu from inside another place: the label restored, the state re-read, the menu served by the references the skill's own Step 1 serves it from.

## A. Restore the Label

Put the original tmux session name back — a no-op unless the user opted in and this session runs inside tmux:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session repair
```

→ Proceed to **B. Display and Route**.

## B. Display and Route

Read the current workflow state — this dump is the index, not the display surface; the display and the menu derive from the `view` snapshot the loaded reference renders:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs
```

#### If `state.has_any_work` is false

Load **[empty-state.md](empty-state.md)** and follow its instructions as written.

→ On return, return to **B. Display and Route**.

#### Otherwise

Load **[active-work.md](active-work.md)** and follow its instructions as written.

→ On return, proceed as the reference directed.

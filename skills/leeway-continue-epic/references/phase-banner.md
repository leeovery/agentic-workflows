# Phase Banner

*Reference for **[leeway-continue-epic](../SKILL.md)***

---

What the menu leads with: the banner for a phase that just concluded or paused.

#### If `outcome` is `completed`

Render and emit the section verbatim per its marker:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render phase-completed {work_unit} --phase {completed_phase}
```

→ Return to caller.

#### If `outcome` is `paused`

The phase left on a wait — the banner names what it awaits, never a completion. Render and emit the section verbatim per its marker:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render phase-paused {work_unit} --phase {completed_phase}
```

→ Return to caller.

#### Otherwise

No banner: the epic arrived from no phase, or from a session that cancelled or postponed its topic and rendered its own receipt.

→ Return to caller.

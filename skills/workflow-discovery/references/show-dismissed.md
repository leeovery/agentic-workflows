# Show Dismissed

*Reference for **[workflow-discovery](../SKILL.md)***

---

Surfaces topic names previously removed from the map and offers re-add. Loaded by [session-loop.md](session-loop.md) when the user asks to see dismissed items.

Fetch the dismissed list:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render dismissed-topics {work_unit}
```

Emit the response's sections verbatim per their markers.

#### If the response carried `MENU: dismissed topics`

**STOP.** Wait for user response.

**If `back`:**

→ Return to caller.

**If name them:**

Bring those names back into the exploration. Pick up the conversation around them — what was the shape, what's changed since they were dropped. They become exploration surfaces like any other; if they hold up through synthesis, they end up in the proposed topic set — the synthesis render flags them `matches_dismissed`, and Step 12 confirm-and-persist passes `--force-dismissed` on the write, which clears the dismissed entry.

→ Return to caller.

#### Otherwise

→ Return to caller.

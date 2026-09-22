# Show Dismissed

*Reference for **[workflow-discovery](../SKILL.md)***

---

Surfaces topic names previously removed from the map and offers re-add. Loaded by [session-loop.md](session-loop.md) when the user asks to see dismissed items.

State comes from `skills/workflow-discovery/scripts/gateway.cjs` — invoke it via Bash and read the structured output. Never invoke the underlying Node helpers inline.

## A. Read Dismissed List

Re-run discovery to pick up any state changes since the parent's initial discovery (a Remove earlier in the session may have added a new entry):

```bash
node .claude/skills/workflow-discovery/scripts/gateway.cjs {work_unit}
```

Read the `dismissed` array from the output.

#### If `dismissed` is empty

> *Output the next fenced block as a code block:*

```
Dismissed Topics

  (none)
```

→ Return to caller.

#### Otherwise

→ Proceed to **B. Render and Prompt**.

## B. Render and Prompt

Fetch the dismissed list and its re-add offer:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render dismissed-topics {work_unit}
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

#### If `back`

→ Return to caller.

#### If name them

Bring those names back into the exploration. Pick up the conversation around them — what was the shape, what's changed since they were dropped. They become exploration surfaces like any other; if they hold up through synthesis, they end up in the proposed topic set — the synthesis render flags them `matches_dismissed`, and Step 12 confirm-and-persist passes `--force-dismissed` on the write, which clears the dismissed entry.

→ Return to caller.

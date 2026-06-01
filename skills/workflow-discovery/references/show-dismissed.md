# Show Dismissed

*Reference for **[workflow-discovery](../SKILL.md)***

---

Surfaces topic names previously removed from the map and offers re-add. Loaded by [session-loop.md](session-loop.md) when the user asks to see dismissed items.

State comes from `skills/workflow-discovery/scripts/discovery.cjs` — invoke it via Bash and read the structured output. Never invoke the underlying Node helpers inline.

## A. Read Dismissed List

Re-run discovery to pick up any state changes since the parent's initial discovery (a Remove earlier in the session may have added a new entry):

```bash
node .claude/skills/workflow-discovery/scripts/discovery.cjs {work_unit}
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

> *Output the next fenced block as a code block:*

```
Dismissed Topics

@foreach(name in dismissed)
  • {name}
@endforeach
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Re-add any of these to the map?

- **`b`/`back`** — Return to the session
- **Name them** — Tell me which to re-add (and routing if known)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `back`

→ Return to caller.

#### If name them

Bring those names back into the exploration. Pick up the conversation around them — what was the shape, what's changed since they were dropped. They become exploration surfaces like any other; if they hold up through synthesis, they end up in the proposed topic set.

The dismissed-list `pull` happens at Step 12 confirm-and-persist (the per-topic write loop runs `pull` before `init-phase`, which is a no-op if the name isn't dismissed and harmless if it is).

→ Return to caller.

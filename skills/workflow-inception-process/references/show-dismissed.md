# Show Dismissed

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Surfaces topic names previously removed from the map and offers re-add. Loaded by [session-loop.md](session-loop.md) when the user asks to see dismissed items.

State comes from `skills/workflow-inception-process/scripts/discovery.cjs` — invoke it via Bash and read the structured output. Never invoke the underlying Node helpers inline.

## A. Read Dismissed List

Re-run discovery to pick up any state changes since the parent's initial discovery (a Remove earlier in the session may have added a new entry):

```bash
node .claude/skills/workflow-inception-process/scripts/discovery.cjs {work_unit}
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

- **Name them** — Tell me which to re-add (and routing if known)
- **`b`/`back`** — Return to the session
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `back`

→ Return to caller.

#### If the user names one or more dismissed items to re-add

Treat each as a new-topic surface in the session conversation. Reflect each back with proposed routing (using framing cues if the user gave any, otherwise the previously-dismissed item's history if known), confirm inline, and add to the in-conversation working list — same flow as any other new-topic surface from session-loop's *New-topic moves*.

The dismissed-list `pull` happens at Step 5 confirm-and-persist (the per-topic write loop runs `pull` before `init-phase`, which is a no-op if the name isn't dismissed and harmless if it is).

→ Return to caller.

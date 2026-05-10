# Show Dismissed

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Recovery flow for the refinement session. Surfaces topic names previously removed from the map and offers re-add. Loaded by **[refinement-session.md](refinement-session.md)** when the user asks to see dismissed items.

## A. Read Dismissed List

Read `phases.inception.dismissed` from the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception dismissed
```

The result is either an array of topic names or empty (returns `2` exit code if the field is missing — treat that as empty).

#### If empty

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
- **`b`/`back`** — Return to the refinement session
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `back`

→ Return to caller.

#### If the user names one or more dismissed items to re-add

Treat the response as an Add intent and dispatch to the Add flow:

→ Load **[map-operations.md](map-operations.md)** and follow its instructions as written.

`map-operations.md` validates each name (collision check is satisfied — dismissed-list match is allowed for Add and triggers a `pull` from the dismissed list before `init-phase`), STOP-gates on the batch, applies the writes, appends a Changes entry to the session log, and commits.

When `map-operations.md` returns:

→ Return to caller.

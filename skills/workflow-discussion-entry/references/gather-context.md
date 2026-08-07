# Gather Context

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Gather Context`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Collecting the context needed before starting the discussion.
```

Route based on the `source` variable set in earlier steps.

#### If source is `continue`

→ Load **[gather-context-continue.md](gather-context-continue.md)** and follow its instructions as written.

→ Return to caller.

#### Otherwise

→ Load **[gather-context-fresh.md](gather-context-fresh.md)** and follow its instructions as written.

→ Return to caller.

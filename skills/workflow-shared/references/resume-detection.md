# Resume Detection

*Shared reference for processing skills.*

---

Read `{file}`.

**If the file has a `## Triage` section that is not `(none)`:** it holds concerns rerouted here from other topics — their origin sessions recorded them as landed, and restart destroys them. Render this warning before the menu ({N} = the count of `### {title}` entries):

> *Output the next fenced block as a code block:*

```
  ⚑ {N} rerouted concern(s) from other topics sit undrained in this
    file's Triage section. Restarting deletes them permanently.
```

> *Output the next fenced block as markdown (not a code block):*

```
Found existing {artifact} for **{topic:(titlecase)}**.

· · · · · · · · · · · ·
- **`c`/`continue`** — Pick up where you left off
- **`r`/`restart`** — Delete the {artifact} and start fresh
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

→ Return to caller for **{continue_step}**.

#### If `restart`

1. Delete {restart_targets}
2. Commit: `{commit}`

→ Return to caller for **Step 1**.

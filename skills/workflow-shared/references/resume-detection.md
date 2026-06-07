# Resume Detection

*Shared reference for processing skills.*

---

Read `{file}`.

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

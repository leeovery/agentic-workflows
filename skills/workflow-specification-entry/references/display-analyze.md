# Display: Analyze Prompt

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Prompted when multiple completed discussions exist, no specifications exist, and cache is none or stale.

## Display

> *Output the next fenced block as a code block:*

```
Specification Overview

{N} completed discussions found. No specifications exist yet.

Completed discussions:
  • {discussion-name}
  • {discussion-name}
  • {discussion-name}
```

List all completed discussions from discovery output.

#### If in-progress discussions exist

> *Output the next fenced block as a code block:*

```
Discussions not ready for specification:
These discussions are still in progress and must be completed
before they can be included in a specification.

  • {discussion-name}
```

### Cache-Aware Message

No `---` separator before these messages.

#### If cache status is `none`

> *Output the next fenced block as a code block:*

```
These discussions will be analyzed for natural groupings to determine
how they should be organized into specifications. Results are cached
and reused until discussions change.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Proceed with analysis?
- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

#### If cache status is `stale`

> *Output the next fenced block as a code block:*

```
A previous grouping analysis exists but is outdated — discussions
have changed since it was created.

These discussions will be re-analyzed for natural groupings. Results
are cached and reused until discussions change.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Proceed with analysis?
- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user confirms (y)

If cache is stale, delete it first:
```bash
rm .workflows/{work_unit}/.state/discussion-consolidation-analysis.md
```

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.

#### If user declines (n)

> *Output the next fenced block as a code block:*

```
Understood. Continue working on discussions, or re-run this
command when ready.
```

**STOP.** Do not proceed — terminal condition.

# Display: Analyze Prompt

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Prompted when multiple completed discussions exist, no specifications or proposed groupings exist, and the cache is none or stale.

## A. Display

Emit the DISPLAY section from the Step 1 snapshot verbatim as a code block.

**Cache-Aware Message**

#### If `cache_status` is `none`

> *Output the next fenced block as markdown (not a code block):*

```
> What happens next. Your discussions will be analyzed for natural
> groupings. Each grouping becomes a proposed specification you can
> start when ready. Results are cached and reused until discussions change.

· · · · · · · · · · · ·
Proceed with analysis?
- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Proceed to **B. Handle Response**.

#### If `cache_status` is `stale`

> *Output the next fenced block as markdown (not a code block):*

```
> Analysis outdated. A previous grouping analysis exists but
> discussions have changed since it was created. Your discussions will
> be re-analyzed for natural groupings. Results are cached and reused
> until discussions change.

· · · · · · · · · · · ·
Proceed with analysis?
- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Proceed to **B. Handle Response**.

---

## B. Handle Response

#### If `yes`

If `cache_status` is `stale`, delete the cache first:
```bash
rm .workflows/{work_unit}/.state/discussion-consolidation-analysis.md
```

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.

#### If `no`

> *Output the next fenced block as a code block:*

```
Understood. Continue working on discussions, or re-run this
command when ready.
```

**STOP.** Do not proceed — terminal condition.

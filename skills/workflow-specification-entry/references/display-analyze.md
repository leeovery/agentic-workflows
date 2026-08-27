# Display: Analyze Prompt

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Prompted when multiple completed discussions exist and none are in progress, no specifications or proposed groupings exist, and the cache is none or stale.

## A. Display

Re-run the scoped snapshot — the emission draws from this response, never a carried one:

```bash
node .claude/skills/workflow-specification-entry/scripts/gateway.cjs view {work_unit}
```

Emit the TITLE section (markdown), then the DISPLAY section verbatim as a code block.

**Cache-Aware Message**

#### If `cache_status` is `none`

> *Output the next fenced block as markdown (not a code block):*

```
> What happens next. Your discussions will be analyzed for natural groupings. Each grouping becomes a proposed specification you can start when ready. Results are cached and reused until discussions change.
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render analysis-proceed-gate {work_unit}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Response**.

#### If `cache_status` is `stale`

> *Output the next fenced block as markdown (not a code block):*

```
> Analysis outdated. A previous grouping analysis exists but discussions have changed since it was created. Your discussions will be re-analyzed for natural groupings. Results are cached and reused until discussions change.
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render analysis-proceed-gate {work_unit}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Response**.

---

## B. Handle Response

#### If `yes`

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.

#### If `no`

> *Output the next fenced block as markdown (not a code block):*

```
Understood. Continue working on discussions, or re-run this command when ready.
```

**STOP.** Do not proceed — terminal condition.

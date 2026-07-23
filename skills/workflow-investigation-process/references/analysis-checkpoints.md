# Analysis Checkpoints

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

The collaboration protocol that governs code analysis. The agreed investigation plan sets the checkpoint depth; this file defines what happens as findings land.

## Hypothesis Ledger

The Hypotheses section of the investigation file is live state, not a record of first guesses. Statuses: `suspected`, `tracing`, `confirmed`, `ruled-out`.

- Update a hypothesis the moment its status changes, with the evidence that changed it, and commit alongside the finding
- New suspects discovered mid-trace join the ledger as `[suspected]`
- After compaction the ledger is how the analysis position is recovered — keep it current enough that a fresh read shows exactly where the investigation stands

## Progress Notes

When a hypothesis flips or a significant finding lands, note it in a line or two of chat — what changed and why it matters — and keep working. These notes never end the turn. The full story belongs in the investigation file and the findings sign-off, not the stream.

## Check-in Gate

Only at `check-ins` depth. When a hypothesis resolves — `confirmed` or `ruled-out` — pause and let the user steer. Open with one markdown sentence above the board — what just got established and what it means, in product terms:

> *Output the next fenced block as a code block:*

```
Hypothesis resolved: {hypothesis} [{status:[confirmed|ruled-out]}]
  {one-line evidence}

Board:
  • {hypothesis} [{status}]
  • ...

Next: {what will be traced next}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Continue as planned?

- **`y`/`yes`** — Continue with the next trace line
- **Steer** — Tell me what to look at instead, or what this changes
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:** continue the analysis.

**If the user steers:** fold the direction in — update the ledger and trace lines in the investigation file, commit, and continue the analysis from there.

## Pivot Gate

Any depth. When a finding invalidates the agreed plan — the root cause is clearly elsewhere, a new dominant suspect emerges, the remaining trace lines are moot — never silently re-plan. Update the ledger, then open with one markdown sentence above the block — what changed, in product terms:

> *Output the next fenced block as a code block:*

```
Plan pivot: {work_unit}

What changed:
  {finding that invalidated the plan}

Proposed direction:
  {new hypotheses / trace lines}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Proceed on the new direction?

- **`y`/`yes`** — Proceed as proposed
- **Adjust** — Tell me what to change
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:** record the new direction in the investigation file, commit, and continue the analysis.

**If the user adjusts:** incorporate, record, commit, and continue the analysis on the adjusted direction.

## Asking the User

Any depth. When blocked on something only the user knows — reproduction fails, expected behaviour is ambiguous, environment context is missing — ask directly rather than guessing or working around the gap:

> *Output the next fenced block as a code block:*

```
{the specific question, with what was tried and why it blocks the trace}
```

**STOP.** Wait for user response.

Once answered, fold the answer into the trace and continue the analysis.

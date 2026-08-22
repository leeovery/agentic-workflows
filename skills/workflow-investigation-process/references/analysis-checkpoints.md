# Analysis Checkpoints

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

The collaboration protocol that governs code analysis. The agreed investigation plan sets the checkpoint depth; this file defines what happens as findings land.

## Hypothesis Ledger

The Hypotheses section of the investigation file is live state, not a record of first guesses. Statuses: `suspected`, `tracing`, `confirmed`, `ruled-out`.

- Update a hypothesis the moment its status changes, with the evidence that changed it, and commit alongside the finding
- New suspects discovered mid-trace join the ledger as `[suspected]` under the next free id — ids are never reused, so a reference made in an earlier session still names the same claim
- After compaction the ledger is how the analysis position is recovered — keep it current enough that a fresh read shows exactly where the investigation stands

## Progress Notes

When a hypothesis flips or a significant finding lands, note it in a line or two of chat — what changed and why it matters — and keep working. These notes never end the turn. The full story belongs in the investigation file and the findings sign-off, not the stream.

## Check-in Gate

Only at `check-ins` depth. When a hypothesis resolves — `confirmed` or `ruled-out` — pause and let the user steer. Open with one markdown sentence above the board — what just got established and what it means, in product terms.

Write the payload to `.workflows/.cache/{work_unit}/investigation/{topic}/board.json` with the Write tool — every hypothesis in the ledger at its current status, `resolved_now` naming the ones that resolved at this check-in, and one row per thing the ledger holds about it. Row labels are yours to choose and name what the row carries (`Evidence`, `Measured`, `Gap`, `Ruled out by`); a hypothesis with more to say takes more rows, each one line. Detail too long for a row stays in the investigation file — the board cites it, never reproduces it: `{"hypotheses": [{"id": "H1", "claim": "{hypothesis}", "status": "{status:[suspected|tracing|confirmed|ruled-out]}", "rows": [["{label}", "{value}"]]}], "resolved_now": ["{id}"], "next": "{what will be traced next}"}` — then fetch the board, emitting each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render hypothesis-board {work_unit}.investigation.{topic} --file .workflows/.cache/{work_unit}/investigation/{topic}/board.json --variant check-in
```

**STOP.** Wait for user response.

**If `yes`:** continue the analysis.

**If the user steers:** fold the direction in — update the ledger and trace lines in the investigation file, commit, and continue the analysis from there.

## Pivot Gate

Any depth. When a finding invalidates the agreed plan — the root cause is clearly elsewhere, a new dominant suspect emerges, the remaining trace lines are moot — never silently re-plan. Update the ledger, then open with one markdown sentence above the display — what changed, in product terms.

Write the payload to `.workflows/.cache/{work_unit}/investigation/{topic}/board.json` with the Write tool — the hypotheses the new direction rests on, each under its ledger id: `{"changed": "{finding that invalidated the plan}", "hypotheses": [{"id": "H1", "claim": "{hypothesis}", "status": "{status:[suspected|tracing|confirmed|ruled-out]}", "rows": [["{label}", "{value}"]]}], "trace_lines": ["{code path or area to trace, in intended order}"]}` — then fetch the pivot, emitting each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render hypothesis-board {work_unit}.investigation.{topic} --file .workflows/.cache/{work_unit}/investigation/{topic}/board.json --variant pivot
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

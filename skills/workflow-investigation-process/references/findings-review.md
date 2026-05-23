# Findings Review & Fix Discussion

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

Present your analysis to the user for validation, then collaboratively agree on fix direction. Simple bugs flow fast (2 STOP gates). Complex bugs expand naturally through discussion.

## A. Confirm Findings

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Do these findings match your understanding?

- **`y`/`yes`** — Findings are correct, discuss fix direction
- **Provide feedback** — Tell me what's off or unclear
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **C. Fix Direction Discussion**.

#### If the user provides feedback

→ Proceed to **B. Findings Updated — Re-Present**.

---

## B. Findings Updated — Re-Present

Address the user's concerns directly. Re-trace code paths if needed. Provide supporting evidence from the code trace. Update the investigation file with corrections or new information, and commit.

Re-render the updated findings so the user is gating against the new content, not the old. Pull current values from the investigation file.

> *Output the next fenced block as a code block:*

```
Investigation Findings: {work_unit}

Root Cause:
  {clear, precise root cause statement}

Contributing Factors:
  {factor 1}
  {factor 2}

Blast Radius:
  Directly affected:  {components}
  Potentially affected: {components sharing code/patterns}

Why It Wasn't Caught:
  {testing gap, edge case, recent change}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Do these findings match your understanding?

- **`y`/`yes`** — Findings are correct, discuss fix direction
- **Provide feedback** — Tell me what's off or unclear
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **C. Fix Direction Discussion**.

#### If the user provides feedback

→ Return to **B. Findings Updated — Re-Present**.

---

## C. Fix Direction Discussion

Present what the analysis surfaced about how to fix this. Let the findings guide the shape — there's no required number of approaches:

- **One obvious fix?** Present it clearly with trade-offs and any risks.
- **Multiple viable approaches?** Present each with trade-offs so the user can compare.
- **Unclear?** Say so — this is a discussion, not a presentation.

> *Output the next fenced block as a code block:*

```
Fix Direction: {work_unit}

{fix direction content — format naturally based on what there is
to present. A single approach doesn't need numbered alternatives;
multiple approaches benefit from comparison structure.}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What are your thoughts?

- **`y`/`yes`** — Agree with this direction
- **Provide feedback** — Discuss, challenge, or suggest alternatives
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If the user provides feedback

Engage collaboratively. Stay bounded — focus on:
- Challenging assumptions about approaches
- Surfacing edge cases and risks
- Exploring how fixes interact with existing code
- Understanding user priorities (speed, safety, maintainability)

Do not go into implementation detail — that belongs in the specification.

→ Return to **C. Fix Direction Discussion**.

#### If `yes`

Document the Fix Direction section in the investigation file:

1. **Chosen Approach**: The selected approach with deciding factor
2. **Options Explored**: All approaches presented (including unchosen ones with brief "why not")
3. **Discussion**: Journey notes — user priorities, concerns raised, edge cases surfaced, what shifted thinking. Brief for simple bugs, detailed for complex.
4. **Testing Recommendations**: Informed by the discussion
5. **Risk Assessment**: Informed by the discussion

Commit the updated investigation file.

→ Return to caller.

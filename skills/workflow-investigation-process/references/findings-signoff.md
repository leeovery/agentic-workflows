# Findings Sign-off

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

The single canonical presentation of the investigation findings, gated for the user's sign-off. The render and the gate are one moment — never gate against findings that are not directly above the gate.

## A. Present & Confirm

Pull current values from the investigation file — the file is authoritative, not conversation memory.

> *Output the next fenced block as markdown (not a code block):*

```
> This is the sign-off on the investigation record — everything
> below is read from the investigation file. Fix exploration
> comes next.
```

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

- **`y`/`yes`** — Findings are correct, move to fix exploration
- **Provide feedback** — Tell me what's off or unclear
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Return to caller.

#### If the user provides feedback

→ Proceed to **B. Address Feedback**.

---

## B. Address Feedback

Address the user's concerns directly. Re-trace code paths if needed. Provide supporting evidence from the code trace. Update the investigation file with corrections or new information, and commit.

→ Return to **A. Present & Confirm** — the re-render guarantees the gate always sits beneath current content.

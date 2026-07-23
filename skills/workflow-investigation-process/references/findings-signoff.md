# Findings Sign-off

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

The single canonical presentation of the investigation findings, gated for the user's sign-off. The render and the gate are one moment — never gate against findings that are not directly above the gate.

## A. Present & Confirm

→ Load **[product-lens.md](../../workflow-shared/references/product-lens.md)** and follow its instructions as written.

Pull current values from the investigation file — the file is authoritative, not conversation memory.

> *Output the next fenced block as markdown (not a code block):*

```
> This is the sign-off on the investigation record — everything
> below is read from the investigation file. Fix exploration
> comes next.
```

Retell the investigation file's findings as a markdown narrative (not a code block, no structured template) in four beats:

1. **What you'd see happen** — the bug as it manifests: what goes wrong, where in the product, when. Open here, before any code.
2. **Why it happens** — the Root Cause and Contributing Factors as behaviour: what the code does versus what it should do.
3. **What else it touches** — the Blast Radius: which parts of the product share the broken path.
4. **Why nobody caught it** — the testing gap, edge case, or recent change, plainly.

Every substantive point in those sections appears in the retelling — nothing softened, nothing dropped. The full technical record is one `t` away.

→ On return, proceed to **B. Sign-off Gate**.

---

## B. Sign-off Gate

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Do these findings match your understanding?

- **`y`/`yes`** — Findings are correct, move to fix exploration
- **`t`/`technical`** — Show the full technical record
- **Provide feedback** — Tell me what's off or unclear
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Return to caller.

#### If `technical`

→ Proceed to **C. Technical Record**.

#### If the user provides feedback

→ Proceed to **D. Address Feedback**.

---

## C. Technical Record

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

→ Return to **B. Sign-off Gate**.

---

## D. Address Feedback

Address the user's concerns directly. Re-trace code paths if needed. Provide supporting evidence from the code trace. Update the investigation file with corrections or new information, and commit.

→ Return to **A. Present & Confirm**.

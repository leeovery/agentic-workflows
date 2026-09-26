# Findings Sign-off

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

The single canonical presentation of the investigation findings, gated for the user's sign-off. The render and the gate are one moment — never gate against findings that are not directly above the gate.

## A. Present & Confirm

→ Load **[product-lens.md](../../workflow-shared/references/product-lens.md)** and follow its instructions as written.

Pull current values from the investigation file — the file is authoritative, not conversation memory.

> *Output the next fenced block as markdown (not a code block):*

```
> This is the sign-off on the investigation record — everything below is read from the investigation file. Fix exploration comes next.
```

Retell the investigation file's findings as markdown (not a code block) — a narrative, no structured template — in four beats:

1. **What you'd see happen** — the bug as it manifests: what goes wrong, where in the product, when. Open here, before any code.
2. **Why it happens** — the Root Cause and Contributing Factors as behaviour: what the code does versus what it should do.
3. **What else it touches** — the Blast Radius: which parts of the product share the broken path.
4. **Why nobody caught it** — the testing gap, edge case, or recent change, plainly.

Each beat lands in a paragraph the user takes in at a glance — complete in coverage, compact in telling. The code-perspective retelling is one `t` away; the record file itself one `v` away.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render findings-signoff-gate {work_unit}.investigation.{topic}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Response**.

---

## B. Handle Response

#### If `yes`

→ Return to caller.

#### If `technical`

→ Load **[technical-lens.md](../../workflow-shared/references/technical-lens.md)** and follow its instructions as written.

Retell the same findings through the technical lens — the same four sections from the investigation file, mechanism-first — a narrative, as markdown (not a code block). Then put the gate back beneath it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render findings-signoff-gate {work_unit}.investigation.{topic}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

→ Return to **B. Handle Response**.

#### If `view`

Render the full content of `.workflows/{work_unit}/investigation/{topic}.md` as markdown (not a code block). Then put the gate back beneath it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render findings-signoff-gate {work_unit}.investigation.{topic}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

→ Return to **B. Handle Response**.

#### If the user provides feedback

Address the user's concerns directly. Re-trace code paths if needed. Provide supporting evidence from the code trace. Update the investigation file with corrections or new information, and commit. The feedback sets the gate aside until the person is ready to move on; to put it back:

→ Return to **A. Present & Confirm**.

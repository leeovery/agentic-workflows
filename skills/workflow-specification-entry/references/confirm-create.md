# Confirm: Create Specification

*Reference for **[confirm-and-handoff.md](confirm-and-handoff.md)***

---

## A. Display Confirmation

When the DATA lists `consult:` lines under the selected grouping, write them to `.workflows/.cache/{work_unit}/specification/{topic}/consult.json` with the Write tool — `{"consult": [{"name": "…", "hint": "…"}]}`, one entry per line, `hint` the slice hint the line carries (left out when it carries none) — and pass the bracketed `--file`; otherwise leave it off.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render spec-confirm-gate {work_unit}.specification.{topic} --variant create [--file .workflows/.cache/{work_unit}/specification/{topic}/consult.json]
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Response**.

---

## B. Handle Response

#### If `yes`

**If any source discussions have individual specs:**

The DATA `discussions:` lines mark this (`individual spec: {status}`). It is computed proposed-blind — a discussion that appears only in a proposed grouping does not count as having an individual spec, so a proposed item never lands here for supersession.

→ Load **[create-with-incorporation.md](handoffs/create-with-incorporation.md)** and follow its instructions as written.

**Otherwise:**

→ Load **[create.md](handoffs/create.md)** and follow its instructions as written.

#### If `no`

**If single discussion (no menu to return to):**

> *Output the next fenced block as markdown (not a code block):*

```
Understood. Continue working on discussions, or re-run this command when ready.
```

**STOP.** Do not proceed — terminal condition.

**If groupings or specs menu:**

→ Return to caller.

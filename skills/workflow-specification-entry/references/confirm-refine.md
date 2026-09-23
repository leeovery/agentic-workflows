# Confirm: Refine Specification

*Reference for **[confirm-and-handoff.md](confirm-and-handoff.md)***

---

When the DATA lists `consult:` lines under the selected spec, write them to `.workflows/.cache/{work_unit}/specification/{topic}/consult.json` with the Write tool — `{"consult": [{"name": "…", "hint": "…"}]}`, one entry per line, `hint` the slice hint the line carries (left out when it carries none) — and pass the bracketed `--file`; otherwise leave it off.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render spec-confirm-gate {work_unit}.specification.{topic} --variant refine [--file .workflows/.cache/{work_unit}/specification/{topic}/consult.json]
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

#### If `yes`

→ Load **[continue.md](handoffs/continue.md)** and follow its instructions as written.

#### If `no`

**If single discussion (no menu to return to):**

> *Output the next fenced block as markdown (not a code block):*

```
Understood. Continue working on discussions, or re-run this command when ready.
```

**STOP.** Do not proceed — terminal condition.

**If groupings or specs menu:**

→ Return to caller.

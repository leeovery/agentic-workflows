# Shape and Confirm the Work Type

*Reference for **[workflow-discovery](../SKILL.md)***

---

Run the shaping conversation governed by the detection core (loaded at Step 2), then commit the work type. Loop in **A** until convergence; commit in **B**.

## A. Shape

Gather all signal flavours simultaneously (work-type cues and topic seeds co-emerge); resolve in dependency order. Surface tentative reads mid-loop (soft, easy to redirect). Watch for pivots, and offer scope-down-to-inbox for tangential concerns. One question at a time — keep exploring until confident-enough-to-commit per the confidence clock.

→ Proceed to **B. Commit** when convergence holds (detection core **I**); otherwise keep looping in **A**.

## B. Commit

Make the commit move. State the read as plain prose first — bucket name folded in, plus the signals that drove it — held above the gate, never inside it. Then fetch the gate and emit its section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render shape-gate
```

**STOP.** Wait for user response.

#### If `yes`

**If the committed read is the product road:**

Product-altitude work creates no work unit — the roadmap owns the conversation from here. Hold any import paths surfaced during shaping as `import_paths` (the roadmap lands them).

Invoke `/workflow-roadmap genesis` via the Skill tool.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.

**If the read is a work type:**

The work type is committed. Set `work_type`; compile a one-line `description` from the user's framing (captured from the conversation, never silently invented). Hold any topic seeds and imports surfaced during shaping.

→ Return to caller.

#### If `other`

Take the user's call as authoritative — adjust the read without re-litigating (if they describe rather than name a shape, map it via the detection core and reflect back for a quick confirm).

**If the settled read is the product road:**

Hold any import paths surfaced during shaping as `import_paths`.

Invoke `/workflow-roadmap genesis` via the Skill tool.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.

**If the settled read is a work type:**

Set `work_type` and compile the `description`.

→ Return to caller.

#### If keep shaping

The read isn't ready.

→ Return to **A. Shape**.

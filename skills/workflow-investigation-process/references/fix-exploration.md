# Fix Exploration & Discussion

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

With the root cause signed off, explore how to fix it — collaboratively. Options draft to cache so nothing is lost mid-discussion; the investigation file's Fix Direction section is written only once the direction is agreed.

## A. Explore & Draft

From the confirmed root cause and blast radius, work out the candidate approaches. For each: what it changes, trade-offs and risks, and which blast-radius surfaces it covers. One obvious fix is a valid outcome — don't manufacture alternatives. A recommendation is welcome; a decision is not.

The draft is the payload the next section renders — one file, so what is discussed and what is displayed can never diverge. Its shape is in **B. Present & Discuss**; write it there and overwrite any prior draft, which is working scratch rather than a record.

→ Proceed to **B. Present & Discuss**.

---

## B. Present & Discuss

Present what the exploration surfaced. The findings decide how much there is, never how it is laid out — the display gives every option the same rows so the user can compare them, letters them only when there is more than one, and counts them itself.

- **One obvious fix?** One option. Don't manufacture alternatives to fill a comparison.
- **Multiple viable approaches?** One option each, and mark the recommendation — its deciding factor rides in `recommendation`.
- **Unclear?** Say so in `open_question` rather than presenting false confidence — this is a discussion, not a presentation.

Write the payload to `.workflows/.cache/{work_unit}/investigation/{topic}/fix-direction.json` with the Write tool — one row per thing the option needs the user to weigh, labelled for what it carries (`Changes`, `Trade-off`, `Risk`, `Covers` are the ones the exploration asks for) and one line apiece:

`{"options": [{"name": "{approach}", "recommended": true, "rows": [["{label}", "{value}"]]}], "recommendation": "{deciding factor}", "open_question": "{what is still unresolved}"}`

`recommended` and `recommendation` travel together and only where options are compared; omit `open_question` when nothing is open. Then fetch the display, emitting each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render fix-direction {work_unit}.investigation.{topic} --file .workflows/.cache/{work_unit}/investigation/{topic}/fix-direction.json
```

**STOP.** Wait for user response.

#### If the user provides feedback

→ Proceed to **C. Discussion Loop**.

#### If `yes`

→ Proceed to **D. Record Agreement**.

---

## C. Discussion Loop

Engage collaboratively. Stay bounded — focus on:
- Challenging assumptions about approaches
- Surfacing edge cases and risks
- Exploring how fixes interact with existing code
- Understanding user priorities (speed, safety, maintainability)

Do not go into implementation detail — that belongs in the specification.

Rewrite the payload as the option space shifts — new options, killed options, changed trade-offs — so a crash never loses the discussion and the next render shows where it actually stands.

→ Return to **B. Present & Discuss**.

---

## D. Record Agreement

Write the Fix Direction section in the investigation file:

1. **Chosen Approach**: The selected approach with deciding factor
2. **Options Explored**: All approaches presented (including unchosen ones with brief "why not")
3. **Discussion**: Journey notes — user priorities, concerns raised, edge cases surfaced, what shifted thinking. Brief for simple bugs, detailed for complex.
4. **Testing Recommendations**: Informed by the discussion
5. **Risk Assessment**: Informed by the discussion

Commit the updated investigation file — it now carries the chosen option.

→ Return to caller.

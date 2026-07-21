# Fix Exploration & Discussion

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

With the root cause signed off, explore how to fix it — collaboratively. Options draft to cache so nothing is lost mid-discussion; the investigation file's Fix Direction section is written only once the direction is agreed.

## A. Explore & Draft

From the confirmed root cause and blast radius, work out the candidate approaches. For each: what it changes, trade-offs and risks, and which blast-radius surfaces it covers. One obvious fix is a valid outcome — don't manufacture alternatives. A recommendation is welcome; a decision is not.

Ensure the cache directory exists:

```bash
mkdir -p .workflows/.cache/{work_unit}/investigation/{topic}
```

Determine the next set number by checking existing files:

```bash
ls .workflows/.cache/{work_unit}/investigation/{topic}/ 2>/dev/null
```

Use the next available `{NNN}` for `fix-options-*` files (zero-padded, e.g., `001`, `002`).

Write the draft to `.workflows/.cache/{work_unit}/investigation/{topic}/fix-options-{NNN}.md` — this frontmatter, then the options, trade-offs, and any recommendation as the body:

```yaml
---
type: fix-options
status: pending
created: {date}
---
```

→ Proceed to **B. Present & Discuss**.

---

## B. Present & Discuss

Present what the exploration surfaced. Let the findings guide the shape — there's no required number of approaches:

- **One obvious fix?** Present it clearly with trade-offs and any risks.
- **Multiple viable approaches?** Present each with trade-offs so the user can compare, and name the recommendation as a recommendation.
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
- **Provide feedback** — Tell me your thoughts: discuss, challenge, or suggest alternatives
· · · · · · · · · · · ·
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

Update the cache draft as the option space shifts — new options, killed options, changed trade-offs — so a crash never loses the discussion.

→ Return to **B. Present & Discuss**.

---

## D. Record Agreement

Write the Fix Direction section in the investigation file:

1. **Chosen Approach**: The selected approach with deciding factor
2. **Options Explored**: All approaches presented (including unchosen ones with brief "why not")
3. **Discussion**: Journey notes — user priorities, concerns raised, edge cases surfaced, what shifted thinking. Brief for simple bugs, detailed for complex.
4. **Testing Recommendations**: Informed by the discussion
5. **Risk Assessment**: Informed by the discussion

Commit the updated investigation file. Flip the cache draft's frontmatter to `status: read`.

→ Return to caller.

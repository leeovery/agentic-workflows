# Starting This Work

*Reference for **[leeway-discovery](../SKILL.md)***

---

The talk has settled on a piece of work. Settling its type is the last step of shaping it, never a reason to cut the shaping short; the person's yes at start this work creates the unit, and nothing is created before it.

## The Type Call

The work is a feature, an epic, a bugfix or a quick-fix:
- **A feature** is one piece of work. Lean to it: a feature that grows pivots later.
- **An epic** has parts that each need decisions of their own. The feature-or-epic boundary needs no more confidence than any other call.
- **A bugfix** is something that worked and now fails, its cause still to find.
- **A quick-fix** is a small, known, mechanical change: a known cause with a mechanical fix is a quick-fix, not a bugfix.

A pattern or principle for the whole project is never a type here: it is the product's conversation, decided in the first topic it bears on.

- **The hint** from the way in is trusted: confirm it lightly once the description fits, and reconsider only on a clear, strong signal.
- **Seeds** take the largest shape among them, ideas deciding it; a bug or a quick-fix rides along as material, never enlarging the type. An inbox item that already names its cause and fix is confirmed in one line, not shaped again.
- **A bug among the seeds** of a feature or an epic is named in the read: it skips the investigation it would get as a bugfix.
- **Plain words** until the read: "several connected things", "something broken we're fixing", never the type's name.
- **A pivot**: when the signals turn to another shape, say it as a tentative read the person can push back on.

## The Read

Once the signals agree and have held, and the next question would only go deeper, say the read in plain terms with the type's name folded in, and the signals that drove it, concretely enough that the person can challenge one. Re-read the log against the conversation first.

Then write the payload to `.leeway/.cache/product/discovery/product/start-this-work-payload.json`:
- `type` and `name` — the name derived, never asked: the name the person offered, else a single seed's, else the description's; a lowercase slug of letters, digits and hyphens; a name taken derived again more specifically, never numbered.
- `description` — one line in the person's framing; `reason` — one line on why it is this type.
- `shaped_by` — each part of the product's logs that shaped the work, `.product/sessions/session-NNN.md#{anchor}`: one session's log can shape several pieces of work, each pointing at its own parts.
- `seeds` — the inbox paths it starts from, `$2`'s and any taken in; `roadmap` — the waiting roadmap items it takes in.
- `brief` — for a feature or a bugfix, the path of its one topic's brief, drafted under `.leeway/.cache/product/discovery/product/` as the skill's **A Brief** says.

Stage it and draw the screen, emitting its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render start-this-work --file .leeway/.cache/product/discovery/product/start-this-work-payload.json
```

A refusal names what to fix: fix the payload and stage it again. The answer goes to `gate`; follow its `next`, and then the `next` of what it ran. For an epic that carries the conversation into the epic's own discovery: read its DATA as on entering, and shape the epic's topics there. Keep shaping takes the person's word back into the conversation.

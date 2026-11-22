# Starting This Work

*Reference for **[ledger-discovery](../SKILL.md)***

---

The talk has settled on a piece of work. Settling its type is the last step of shaping it, never a reason to cut the shaping short; the person's yes at start this work creates the unit, and nothing is created before it.

## The Type Call

The work is a feature, an epic, a bugfix or a quick-fix:
- **A feature** is one piece of work that needs real discussion, planning or exploration. Lean to it over an epic: a feature that grows pivots later.
- **An epic** has parts that each need decisions of their own. The feature-or-epic boundary needs no more confidence than any other call.
- **A bugfix** is a bug whose cause is not known: something that worked and now fails, its cause still to find.
- **A quick-fix** is settled work of any size, logic changes included: a tweak, an amendment, a quick update to an existing feature, a very small new feature needing no decision. Nothing in it waits on the person beyond a quick call, and a known cause with a settled fix is a quick-fix, not a bugfix. One that turns out to need a decision beyond a quick call moves to a feature or a bugfix.

A pattern or principle for the whole project is never a type here: it is the product's conversation, decided in the first topic it bears on.

- **Seeds** take the largest shape among them, ideas deciding it; a bug or a quick-fix rides along as material, never enlarging the type.
- **A bug among the seeds** of a feature or an epic is named in the read: it skips the investigation it would get as a bugfix.
- **A pivot**: when the signals turn to another shape, say it as a tentative read the person can push back on.

## The Read

For a quick-fix, search earlier work in the area it touches first, one `knowledge query`, and fold what it finds into the read, with each point from before that bears on it put to the person: the description carries what they say.

Once the signals agree and have held, and the next question would only go deeper, say the read in plain terms with the type's name folded in, and the signals that drove it, concretely enough that the person can challenge one. Re-read the log against the conversation first and bring the picture up to date, where the conversation keeps them: a type call keeps no log and only reads the picture.

Then write the payload to the DATA's `payload`, this conversation's own:
- `type` and `name` — the name derived, never asked: the name the person offered, else a single seed's, else the description's; a lowercase slug of letters, digits and hyphens; a name taken derived again more specifically, never numbered.
- `description` — one line in the person's framing; `reason` — one line on why it is this type.
- `shaped_by` — each part of the product's logs that shaped the work, `.product/sessions/session-NNN.md#{anchor}`: one session's log can shape several pieces of work, each pointing at its own parts. A type call, which keeps no log, names the parts its roadmap seeds' `source` lines point at and those the picture's points on the work link to, and none where there are none.
- `seeds` — the inbox paths it starts from, `$2`'s and any taken in; `roadmap` — the waiting roadmap items it starts from, `$2`'s `roadmap:{item}` seeds and any taken in.
- `from_before` and `shared_files` — for an epic, each point from before that bears on it, `{"id", "point", "file"}`: the record's own id, the point in one line, and the file it is in by its path from the state root; and each shared file that bears on it, `{"path", "holds", "kind"}`: its path from the state root, a line on what it holds, and `reference` or `to read`. The yes keeps them in the epic, where its discovery reads them.
- `picture` — in the product's conversation, where it has a picture, the picture thinned, drafted beside the DATA's `payload` as `picture-{session}.md`, `{session}` the one the `payload`'s name carries, from the picture re-read: the work's own detail leaves it, carried on by the brief, or an epic's by its points from before and its discovery, and the picture points to the work by its name for it; a quick-fix's points from before, once put to the person, point at the unit. The list of shared files stays whole. The yes lands it.
- `brief` — for a feature or a bugfix, the path of its one topic's brief, drafted beside the `payload` as `brief-{session}.md`: load **[writing-a-brief.md](writing-a-brief.md)** and follow its instructions as written.

Stage it and draw the screen:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render start-this-work --file {payload}
```

A refusal names what to fix: fix the payload and stage it again. At the gate, follow the `next` of what the answer ran.

For an epic, the `next` carries the conversation into the epic's own discovery: read its DATA as on entering — `{home}` is now the epic — and shape its topics there. Keep shaping takes the person's word back into the conversation.

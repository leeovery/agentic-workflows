# Starting This Work

*Reference for **[ledger-discovery](../SKILL.md)***

---

## The Types

- **A feature** — one piece of work that needs discussion, planning or exploration. One that grows pivots to an epic later.
- **An epic** — parts that each need decisions of their own.
- **A bugfix** — a bug whose cause is not known.
- **A quick-fix** — settled work of any size, a known cause with a settled fix among it, needing no decision beyond a quick call.

Seeds take the largest shape among them; a bug or a quick-fix among them rides along as material.

## The Payload

Write it to the DATA's `payload`, this conversation's own:
- `type` and `name` — a lowercase slug of letters, digits and hyphens; a name taken is derived again more specifically, never numbered.
- `description` — one line in the person's framing; `reason` — one line on why it is this type.
- `shaped_by` — each part of the product's logs that shaped the work, `.product/sessions/session-NNN.md#{anchor}`; at least one in the product's conversation.
- `seeds` — the inbox paths it starts from; `roadmap` — the waiting roadmap items it starts from.
- `from_before` and `shared_files` — for an epic, each point from before that bears on it, `{"id", "point", "file"}`, and each shared file, `{"path", "holds", "kind": "reference|to read"}`, each path from the state root.
- `picture` — in the product's conversation, where it has a picture: the picture with the work's own detail thinned out of it, pointing at the work by its name, drafted beside the `payload` as `picture-{session}.md`, `{session}` the one the `payload`'s name carries.
- `brief` — for a feature or a bugfix, its one topic's brief, drafted beside the `payload` as `brief-{session}.md`.

Stage it and draw the screen:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render start-this-work --file {payload}
```

For an epic, the yes's `next` carries the conversation into the epic's own discovery: its DATA reads as on entering, and `{home}` is now the epic.

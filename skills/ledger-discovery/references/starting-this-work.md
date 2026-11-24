# Starting This Work

*Reference for **[ledger-discovery](../SKILL.md)***

---

## The Types

- **A feature** — one piece of work that needs discussion, planning or exploration. One that grows pivots to an epic later.
- **An epic** — parts that each need decisions of their own.
- **A bugfix** — a bug whose cause is not known.
- **A quick-fix** — settled work of any size, a known cause with a settled fix among it, needing no decision beyond a quick call.

Seeds take the largest shape among them; a bug or a quick-fix among them rides along as material. A bug riding along in a feature or an epic gets no investigation of its own: tell the person.

## The Payload

Write it to the DATA's `payload`, this conversation's own:
- `type` and `name` — a kebab-case name, never asked: the one the person offered, else a single seed's, else derived from the description.
- `description` — one line in the person's framing; `reason` — one line on why it is this type. For a quick-fix, one `knowledge query` on the area it touches, what it found of earlier work folded into the `reason`, said nowhere first; each point from before that bears on the quick-fix is put to the person, and the `description` carries what they say.
- `shaped_by` — each part of the product's logs that shaped the work, `.product/sessions/session-NNN.md#{anchor}`; at least one in the product's conversation. A type call, which keeps no log, names the parts its roadmap seeds' `source` lines point at and those the picture's points on the work link to, and none where there are none.
- `seeds` — the inbox paths it starts from; `roadmap` — the waiting roadmap items it starts from.
- `from_before` and `shared_files` — for an epic, each point from before that bears on it, `{"id", "point", "file"}`, and each shared file, `{"path", "holds", "kind": "reference|to read"}`, each path from the state root.
- `picture` — in the product's conversation, where it has a picture: the picture with the work's own detail thinned out of it, pointing at the work by its name, its list of shared files kept whole, drafted beside the `payload` as `picture-{session}.md`, `{session}` the one the `payload`'s name carries.
- `brief` — for a feature or a bugfix, its one topic's brief (Writing a Brief), drafted beside the `payload` as `brief-{session}.md`.

Stage it and draw the screen:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render start-this-work --file '{payload}'
```

Keep shaping takes the person's word back into the conversation; anything changed is staged again. For an epic, the yes's `next` carries the conversation into the epic's own discovery: its DATA reads as on entering, and `{home}` is now the epic.

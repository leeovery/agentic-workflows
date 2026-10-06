The prose should have taken this path:

1. resolves the topic to the work unit
2. the source-material gate renders empty: for a bugfix the completed
   investigation is what satisfies it, in place of a discussion
3. the specification status reads empty, so this is a first start — no
   phase note, nothing reopened, no resume choice, and the user is asked
   nothing
4. initialisation writes the specification file from the format
   template before any manifest change, starts the item through the
   engine — it is genuinely new — and records the investigation as its
   one source, named after the topic: `sources.crash-fix.status
   pending`; then review state and both gate modes in one batched write,
   and commits
5. session setup resets the gate modes and holds
   `.workflows/crash-fix/investigation/crash-fix.md` as the source — no
   discussion file is named — and the walk stops there

Further claims:

- the same prose serves both work types; only the source arm differs —
  the investigation, never a discussion
- the world gains the specification file — the body template, no
  content extracted — and the in-progress specification item with its
  one pending source, review cycle 0 and both gate modes gated,
  committed once; nothing else changes

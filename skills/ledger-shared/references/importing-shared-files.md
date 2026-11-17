# Importing Shared Files

*Shared reference. Loaded by `ledger-discovery`'s `spikes-and-shared-files.md` and by `ledger-investigation-process`.*

---

`{home}` is the unit, or `product`, and `{phase}` the caller's phase. Land every path the person shared in one call, each single-quoted — a shared filename carries spaces and capitals — a `~` path written out in full, since the quotes stop the shell expanding it, and a single quote inside a path written `'\''`:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs asset import {home} '{path}' ['{path}' …]
```

A refusal carrying `missing_imports` landed nothing. Write `{"missing": ["{path}", …]}`, the paths it names in its order, to `.ledger/.cache/{home}/{phase}/{home}/import-reprompt.json`, then fetch the prompt:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render import-reprompt --file .ledger/.cache/{home}/{phase}/{home}/import-reprompt.json
```

Corrected paths land with the ones the refusal did not name; `skip` lands only those. Read what landed — markdown as prose, an image by looking at it, anything else named to the person rather than opened — and link each path the import answered where the caller says. A design living in an outside tool is kept as its exported image and its live link.

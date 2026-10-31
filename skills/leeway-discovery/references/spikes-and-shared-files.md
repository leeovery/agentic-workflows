# Spikes and Shared Files

*Reference for **[leeway-discovery](../SKILL.md)***

---

Nothing in discovery is decided, so a spike's files and the files the person shares are linked from the log, never from an entry: a markdown link in the log, `[{name}]({path})`, is what takes a file into the state.

## A Spike

A spike goes as far as it needs to show the shape — a design board, draft code, a full code example, a prototype to scroll and feel. Start it:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs asset spike {home} {slug}
```

It answers the spike's folder and the folder's twin under the cache. The source goes in the folder as it is written, a design spike's rounds in `round-N/` inside it; dependencies, builds and run output go in the cache twin. What it showed is input, logged with a link to each file, and carried by the briefs of the topics it bears on. In an epic, its result lands as a new topic whose brief points at the spike, as messages to the topics it affects, or as a direction not taken, kept in the log with its reason.

## A Shared File

Land every path the person shared in one call, each single-quoted — a shared filename carries spaces and capitals — a `~` path written out in full, since the quotes stop the shell expanding it, and a single quote inside a path written `'\''`:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs asset import {home} '{path}' ['{path}' …]
```

A refusal carrying `missing_imports` landed nothing. Write `{"missing": ["{path}", …]}`, the paths it names in its order, to `.leeway/.cache/{home}/discovery/{home}/import-reprompt.json`, then fetch the prompt and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render import-reprompt --file .leeway/.cache/{home}/discovery/{home}/import-reprompt.json
```

The answer goes to `gate`. Corrected paths land with the ones the refusal did not name; `skip` lands only those. Read what landed — markdown as prose, an image by looking at it, anything else named to the person rather than opened — and link each path the import answered from the log. A design living in an outside tool is kept as its exported image and its live link.

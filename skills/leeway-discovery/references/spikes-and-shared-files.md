# Spikes and Shared Files

*Reference for **[leeway-discovery](../SKILL.md)***

---

Nothing in discovery is decided, so a spike's files and the files the person shares are linked from the log, never from an entry: a markdown link in the log, `[{name}]({path})`, is what takes a file into the state.

## A Spike

A spike goes as far as it needs to show the shape — a design board, draft code, a full code example, a prototype to scroll and feel. Start it:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs asset spike {home} {slug}
```

It answers the spike's folder and the folder's twin under the cache. The source goes in the folder as it is written, a design spike's rounds in `round-N/` inside it; dependencies, builds and run output go in the cache twin. What it showed is input, logged with a link to each file in a section of the log's own, never under `## Spikes`, and carried by the briefs of the topics it bears on. In an epic, record it — `{spike}` the folder's name as the call answered it, the tool it was made in, and its live link where it lives in an outside tool — each value single-quoted, a single quote inside one written `'\''`:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs discovery-log spike {home} {spike} --tool '{tool}' --showed '{what it showed}' [--link {live link}]
```

Its result lands as a new topic whose brief points at the spike, as messages to the topics it affects, or as a direction not taken, recorded with its reason:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs discovery-log not-taken {home} --direction '{direction}' --why '{why}'
```

## A Shared File

Load **[importing-shared-files.md](../../leeway-shared/references/importing-shared-files.md)** with home = `{home}`, phase = `discovery`, and follow its instructions as written. Link each file it landed from the log.

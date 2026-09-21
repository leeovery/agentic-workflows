# {Format Name}

<!-- Replace {Format Name} with the display name of this format -->

*Output format adapter for **[workflow-planning-process](../../../SKILL.md)***

---

<!-- One-line description of when to use this format -->
Use this format when {describe the ideal use case}.

## Benefits

<!-- Why choose this format? Bullet list of advantages -->
- {Benefit 1}
- {Benefit 2}
- {Benefit 3}

## Setup

<!-- Prerequisites, installation, configuration. "No external tools required." if none -->
{Setup instructions or "No external tools required."}

## Version

<!-- The check consumers run before their first command: the tool version this adapter is written against, the command that reads the installed version, and the stop on a mismatch. "No external tool — nothing to check." if none -->
{Version check or "No external tool — nothing to check."}

## Structure Mapping

<!-- How workflow concepts map to this format's entities -->

| Concept | {Format} Entity |
|---------|-----------------|
| Topic | {what represents a topic — project, directory, etc.} |
| Phase | {what represents a phase — label, subdirectory, etc.} |
| Task | {what represents a task — issue, file, ticket, etc.} |
| Dependency | {what represents a blocking relationship} |

## Output Location

<!-- Where tasks are stored. Use a tree diagram -->
```
{path/structure/diagram}
```

<!-- Brief explanation of the storage layout -->
{Description of what lives where}

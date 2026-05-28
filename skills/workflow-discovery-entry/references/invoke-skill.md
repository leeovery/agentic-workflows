# Invoke the Skill

*Reference for **[workflow-discovery-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

---

## Handoff

```
Discovery session for: {work_unit}

Output: .workflows/{work_unit}/discovery/

Description (from manifest):
{description}

Imports:
@if(imports is non-empty)
  • {path_1}
  • {path_2}
  • ...
@else
  (none)
@endif

Invoke the workflow-discovery-process skill.
```

Invoke the [workflow-discovery-process](../../workflow-discovery-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

# Invoke the Skill

*Reference for **[workflow-inception-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

---

## Handoff

```
Inception session for: {work_unit}

Source: first-session
Output: .workflows/{work_unit}/inception/

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

Invoke the workflow-inception-process skill.
```

Invoke the [workflow-inception-process](../../workflow-inception-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

# Invoke the Skill

*Reference for **[workflow-inception-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

The `Source:` line in the handoff carries the value of `source` set earlier in the entry flow:

- `first-session` — set in **Step 2** when no inception items exist for this work unit.
- `refinement` — set in **Step 3** when inception items already exist.

The processing skill reads this field at Step 0 to decide whether to run the initial-session flow or open a refinement session.

---

## Handoff

```
Inception session for: {work_unit}

Source: {source:[first-session|refinement]}
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

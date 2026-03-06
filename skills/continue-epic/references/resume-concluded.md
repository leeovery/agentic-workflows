# Resume Concluded Topic

*Reference for **[continue-epic](../SKILL.md)***

---

Display all concluded items across all phases and let the user select one to resume.

## Display

Using the `concluded` items from discovery output, group by phase:

> *Output the next fenced block as a code block:*

```
Concluded Topics

@foreach(phase in phases where phase has concluded items)
  {phase:(titlecase)}
@foreach(item in concluded where item.phase == phase)
    └─ {item.name:(titlecase)} (concluded)
@endforeach

@endforeach
```

Only show phases with concluded items. Blank line between phase sections.

## Menu

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which topic would you like to resume?

1. Resume "{item.name:(titlecase)}" — {item.phase}
2. ...
{N}. Back to main menu

Select an option (enter number):
· · · · · · · · · · · ·
```

List all concluded items across all phases. "Back to main menu" returns to the continue-epic main display and menu (re-run from **Step 4**).

**STOP.** Wait for user response.

#### If user chose Back to main menu

→ Return to **[the skill](../SKILL.md)** for **Step 4**.

#### If user chose a topic

Route to the appropriate phase skill with the topic. The phase entry skill handles setting the status back to `in-progress` — continue-epic does not modify the manifest status.

| Phase | Invoke |
|-------|--------|
| research | `/start-research epic {work_unit} {topic}` |
| discussion | `/start-discussion epic {work_unit} {topic}` |
| specification | `/start-specification epic {work_unit} {topic}` |
| planning | `/start-planning epic {work_unit} {topic}` |
| implementation | `/start-implementation epic {work_unit} {topic}` |
| review | `/start-review epic {work_unit} {topic}` |

Invoke the selected skill. This is terminal — do not return to the backbone.

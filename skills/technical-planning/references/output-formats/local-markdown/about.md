# Local Markdown

*Output format adapter for **[technical-planning](../../../SKILL.md)***

---

Use this format for simple features or when you want everything in version-controlled markdown files.

## Benefits

- No external tools or dependencies required
- Human-readable and easy to edit
- Works offline with any text editor
- Simplest setup — just create markdown files

## Setup

No external tools required. This format uses plain markdown files stored in the repository.

## Structure Mapping

| Concept | Local Markdown Entity |
|---------|-----------------------|
| Topic | Directory (`.workflows/{work_unit}/planning/`) |
| Phase | Encoded in task ID (`{topic}-{phase}-{seq}`) |
| Task | Markdown file (`{task-id}.md`) |
| Dependency | Task ID reference in frontmatter (no native blocking) |

## Output Location

Tasks are stored as individual markdown files in a `tasks/` subdirectory under the topic directory:

```
.workflows/{work_unit}/planning/
├── planning.md                 # Plan Index File (not a task)
└── tasks/                      # Task files
    ├── {topic}-1-1.md          # Phase 1, task 1
    ├── {topic}-1-2.md          # Phase 1, task 2
    └── {topic}-2-1.md          # Phase 2, task 1
```

Task filename = task ID for easy lookup.

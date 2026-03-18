# Local Markdown

*Output format adapter for **[workflow-planning-process](../../../SKILL.md)***

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
| Topic | Directory (`.workflows/{work_unit}/planning/{topic}/`) |
| Phase | Encoded in internal ID (`{topic}-{phase_id}-{task_id}`) |
| Task | Markdown file (`{internal_id}.md`) |
| Dependency | Task ID reference in frontmatter (no native blocking) |

## Output Location

Tasks are stored as individual markdown files in a `tasks/` subdirectory under the topic directory:

```
.workflows/{work_unit}/planning/{topic}/
├── planning.md                 # Planning file (phases, task tables)
└── tasks/                      # Task files
    ├── {topic}-1-1.md              # Phase 1, task 1
    ├── {topic}-1-2.md              # Phase 1, task 2
    └── {topic}-2-1.md              # Phase 2, task 1
```

Task filename = internal ID for easy lookup.

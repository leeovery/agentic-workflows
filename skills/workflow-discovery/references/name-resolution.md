# Name Resolution

*Reference for **[workflow-discovery](../SKILL.md)***

---

Resolve the work-unit name and clear any collision before the confirm-trigger creates the manifest. Loaded by [confirm-trigger.md](confirm-trigger.md). On return, `work_unit` is a confirmed, collision-free kebab-case name.

Inputs held from earlier steps: `work_type` (for phrasing), `inbox_seed` filename (if the work came from the inbox), and the shaped one-line `description`.

## A. Suggest a Name

#### If an inbox seed was the origin

Derive the suggested name from the inbox **filename slug**: strip the `YYYY-MM-DD--` date prefix and the `.md` extension. This carry-over keeps the inbox item and the work unit recognisably linked.

→ Proceed to **rendering the suggestion** below.

#### Otherwise

Derive a kebab-case suggestion from the shaped `description`.

→ Proceed to **rendering the suggestion** below.

Render the suggestion (for bugfix / feature / quick-fix the name becomes both `{work_unit}` and `{topic}` — they're the same value; for epic / cross-cutting it's the work unit):

> *Output the next fenced block as a code block:*

```
Suggested {work-type} name: {work_unit}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Is this name okay?

- **`y`/`yes`** — Use this name
- **something else** — Suggest a different name
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Once the user confirms a name (the suggestion or their own), kebab-case it and hold it as `work_unit`.

→ Proceed to **B. Conflict Check**.

## B. Conflict Check

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}
```

#### If a work unit with the same name exists

A name collision is most often the user re-entering work that already exists — signpost the resume path rather than silently re-prompting.

> *Output the next fenced block as a code block:*

```
A work unit named "{work_unit}" already exists.

To pick that work back up, run /workflow-start and select it. Or
choose a different name to start fresh.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`n`/`new`** — Choose a different name
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Return to **A. Suggest a Name**.

#### If no conflict

The name is clean.

→ Return to caller.

# Name and Conflict Check

*Reference for **[workflow-bootstrap](../SKILL.md)***

---

Parameterised name + conflict check. Replaces the five per-work-type `start-*/references/name-check.md` files. Called only when the manifest does not yet exist (see [ensure-manifest.md](ensure-manifest.md)).

## Parameters

The caller provides:

- `work_unit` — kebab-case name resolved by Discovery
- `work_type` — one of `epic`, `feature`, `bugfix`, `quick-fix`, `cross-cutting`
- `description` — concise one-line summary from Discovery's session log

## A. Conflict Check

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}
```

#### If a work unit with the same name exists

A name collision was not caught upstream — surface it and ask Discovery to resolve.

> *Output the next fenced block as a code block:*

```
A work unit named "{work_unit}" already exists.

Re-enter Discovery to choose a different name, or run /workflow-start
to resume the existing work unit.
```

**STOP.** Do not proceed — terminal condition. The user re-enters via `/workflow-start`.

#### Otherwise

→ Proceed to **B. Create Manifest**.

## B. Create Manifest

Initialise the work unit:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init {work_unit} --work-type {work_type} --description "{description}"
```

Quote `{description}` with single quotes if it contains `[]`, `{}`, `~`, or backticks.

→ Proceed to **C. Archive Inbox Source (if applicable)**.

## C. Archive Inbox Source (if applicable)

If Discovery seeded the work unit from an inbox file, archive the original so it does not re-surface in the inbox menu:

```bash
mkdir -p .workflows/.inbox/.archived/{ideas,bugs,quickfixes}
mv .workflows/.inbox/{folder}/{file} .workflows/.inbox/.archived/{folder}/{file}
```

Where `{folder}` is one of `ideas`, `bugs`, `quickfixes` — matched to where the inbox file originated. Skip this section if the work unit was not seeded from an inbox file.

→ Return to caller.

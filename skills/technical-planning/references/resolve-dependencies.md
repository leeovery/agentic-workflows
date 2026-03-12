# Resolve External Dependencies

*Reference for **[technical-planning](../SKILL.md)***

---

> *Output the next fenced block as a code block:*

```
All phases and tasks are written. Now I'll check for external
dependencies — things this plan needs from other topics or systems.
```

Handle external dependencies — things this plan needs from other topics or systems.

Dependencies are stored in the **manifest** as `external_dependencies` (under `--phase planning --topic {topic}`). See [dependencies.md](dependencies.md) for the format and states.

#### If the specification has a Dependencies section

The specification's Dependencies section lists what this feature needs from outside its own scope. These must be documented in the plan so implementation knows what is blocked and what is available.

1. **Document each dependency** in the manifest's `external_dependencies` field (under `--phase planning --topic {topic}`) using the format described in [dependencies.md](dependencies.md). Initially, record each as `state: unresolved`.

2. **Resolve where possible** — For each dependency, check whether a plan already exists for that topic:
   - If a plan exists, identify the specific task(s) that satisfy the dependency. Query the output format to find relevant tasks. If ambiguous, ask the user which tasks apply. Update the dependency entry from `state: unresolved` → `state: resolved` with the `task_id`.
   - If no plan exists, leave the dependency as `state: unresolved`. It will be linked later via `/link-dependencies` or when that topic is planned.
   - If no other plans exist at all, skip resolution — there is nothing to resolve against. All dependencies remain unresolved.

3. **Reverse check** — If other plans exist, check whether any have unresolved dependencies in their manifest `external_dependencies` that reference *this* topic. Now that this plan exists with specific tasks:
   - Scan other work units' manifest `external_dependencies` for entries that mention this topic
   - For each match, identify which task(s) in the current plan satisfy that dependency
   - Update the other work unit's manifest `external_dependencies` entry with the task reference (`state: resolved`, `task_id`)

#### If the specification has no Dependencies section

Set the manifest field to an empty object:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase planning --topic {topic} external_dependencies '{}'
```

This makes it clear that dependencies were considered and none exist — not that they were overlooked.

---

Present a summary of the dependency state: what was documented, what was resolved, what remains unresolved, and any reverse resolutions made.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Approve the dependency resolution?

- **`y`/`yes`** — Proceed
- **Tell me what to change** — Adjust resolutions or add missing links
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If the user provides feedback

Incorporate feedback, re-present the updated dependency state, and ask again. Repeat until approved.

#### If `approved`

Commit: `planning({work_unit}): resolve external dependencies`

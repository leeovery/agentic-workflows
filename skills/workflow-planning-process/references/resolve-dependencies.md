# Resolve External Dependencies

*Reference for **[workflow-planning-process](../SKILL.md)***

---

> *Output the next fenced block as a code block:*

```
All phases and tasks are written. Now I'll check for external
dependencies — things this plan needs from other topics or systems.
```

Handle external dependencies — things this plan needs from other topics or systems.

Dependencies are stored in the **manifest** as `external_dependencies` (under `planning.{topic}`). See [dependencies.md](dependencies.md) for the format and states.

#### If the specification has a Dependencies section

→ Proceed to **A. Read Existing State**.

#### If the specification has no Dependencies section

This topic has no external dependencies. Other topics may still have unresolved dependencies pointing at this plan's tasks.

→ Proceed to **E. Reverse Check**.

---

## A. Read Existing State

Check for existing `external_dependencies` in the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.planning.{topic} external_dependencies
```

**If `true`:**

Read the current values and note which topics have `state: satisfied_externally` — these must be preserved.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} external_dependencies
```

→ Proceed to **B. Write Spec Dependencies**.

**If `false`:**

No existing entries to preserve.

→ Proceed to **B. Write Spec Dependencies**.

---

## B. Write Spec Dependencies

Read the specification's Dependencies section. For each dependency, derive the manifest key from the dependency name as `{dep_topic:(kebabcase)}` and use the "Why Blocked" column as `{description}`. Write each to the manifest.

**If an existing entry for this topic has `state: satisfied_externally`:**

Preserve the existing state — only update the description:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.description "{description}"
```

→ Proceed to **C. Remove Stale Entries**.

**Otherwise:**

Set as unresolved:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.description "{description}"
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.state unresolved
```

→ Proceed to **C. Remove Stale Entries**.

---

## C. Remove Stale Entries

Compare the manifest's dependency topics against the specification's Dependencies section. Any manifest entry whose topic does not appear in the specification is stale — left over from a previous planning session.

#### If stale entries exist

Delete each one:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js delete {work_unit}.planning.{topic} external_dependencies.{dep_topic}
```

→ Proceed to **D. Resolve Current Plan's Dependencies**.

#### Otherwise

Nothing to remove.

→ Proceed to **D. Resolve Current Plan's Dependencies**.

---

## D. Resolve Current Plan's Dependencies

For each unresolved dependency, check if `.workflows/{work_unit}/planning/{dep_topic}/planning.md` exists.

#### If the plan does not exist

Leave the dependency as `state: unresolved`. It will be resolved when that topic is planned.

→ Proceed to **E. Reverse Check**.

#### Otherwise

Read the plan's task table and find the task that best satisfies the dependency by matching the task name against the dependency description. Use the matched task's Internal ID from the plan table.

Update the dependency:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.state resolved
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.internal_id {internal_id}
```

→ Proceed to **E. Reverse Check**.

---

## E. Reverse Check

For each other topic with a planning phase in the same work unit, check if they have external dependencies:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.planning.{other_topic} external_dependencies
```

**If `false`:**

Skip this topic.

**If `true`:**

Read them:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{other_topic} external_dependencies
```

For each dependency in the other topic's `external_dependencies`, route on state:

- **`state: unresolved` matching current topic** — find the best matching task in the current plan by name against the dependency description. Resolve using the task's Internal ID:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{other_topic} external_dependencies.{topic}.state resolved
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{other_topic} external_dependencies.{topic}.internal_id {internal_id}
```

- **`state: resolved` pointing at current plan's tasks** — validate that the `internal_id` still refers to a task that semantically matches the dependency description. If the task name no longer matches (stale reference), re-resolve by finding the correct task and updating the `internal_id`.
- **`state: satisfied_externally`** — skip.

→ Proceed to **F. Summary and Commit**.

---

## F. Summary and Commit

Present a summary of the dependency state: what was documented, what was resolved, what remains unresolved, and any reverse resolutions made.

#### If no changes were made (no deps to write, no reverse resolutions)

> *Output the next fenced block as a code block:*

```
No external dependencies for this topic. No reverse resolutions needed.
```

→ Return to **[the skill](../SKILL.md)**.

#### If changes were made

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Approve the dependency resolution?

- **`y`/`yes`** — Proceed
- **Tell me what to change** — Adjust resolutions or add missing links
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If the user provides feedback:**

Incorporate feedback, re-present the updated dependency state, and ask again. Repeat until approved.

**If approved:**

Commit: `planning({work_unit}): resolve external dependencies`

→ Return to **[the skill](../SKILL.md)**.

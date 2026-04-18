# Epic State Display and Menu

*Reference for **[continue-epic](../SKILL.md)***

---

Display the full phase-by-phase breakdown for the selected epic, then present an interactive menu of actionable items. The caller is responsible for providing:
- Discovery output from `continue-epic/scripts/discovery.cjs` (the `detail` object for the selected epic)
- `work_unit` — the epic's work unit name

This reference collects the user's selection and returns control to the caller. The caller decides what to do with the selection (invoke a skill directly, enter plan mode, etc.).

---

## A. State Display

#### If no phases have items (brand-new epic)

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  {work_unit:(titlecase)}
●───────────────────────────────────────────────●

No work started yet.
```

→ Proceed to **C. Menu**.

#### If phases have items

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  {work_unit:(titlecase)}
●───────────────────────────────────────────────●

@foreach(phase in phases)
@if(phase.items or (phase == discussion and gating.has_pending_discussions))
  {phase:(titlecase)} ({phase.count_summary})
@foreach(item in phase.items)
    @if(last_item_in_phase and not (phase == discussion and gating.has_pending_discussions)) └─ @else ├─ @endif {item.name:(titlecase)} [{item.status}]@if(phase == planning and item.format) · {item.format}@endif
@if(phase == specification and item.sources)
       └─ {source.topic:(titlecase)} [{source.status}]
@endif
@if(phase == implementation and item.current_phase)
       └─ Phase {item.current_phase}, {item.completed_tasks.length} task(s) completed
@else
@if(phase == implementation and item.completed_tasks)
       └─ {item.completed_tasks.length} task(s) completed
@endif
@endif
@endforeach
@if(phase == discussion and pending_from_research.length > 0)
@foreach(topic in pending_from_research)
    @if(last_pending_topic and not gating.has_pending_gaps) └─ @else ├─ @endif {topic.name:(titlecase)} [pending from research]
@endforeach
@endif
@if(phase == discussion and gating.has_pending_gaps)
@foreach(topic in pending_from_gaps)
    @if(last_pending_topic) └─ @else ├─ @endif {topic.name:(titlecase)} [pending from gap analysis]
@endforeach
@endif
@endif

@endforeach
@if(gating.has_pending_discussions and not phases.discussion)
  Discussion ({pending_from_research.length + pending_from_gaps.length} pending)
@foreach(topic in pending_from_research)
    @if(last_pending_topic and not gating.has_pending_gaps) └─ @else ├─ @endif {topic.name:(titlecase)} [pending from research]
@endforeach
@foreach(topic in pending_from_gaps)
    @if(last_pending_topic) └─ @else ├─ @endif {topic.name:(titlecase)} [pending from gap analysis]
@endforeach

@endif
@if(recommendation)
  ⚑ {recommendation text}
@endif
```

**Display rules:**

- Phase headers as section labels (titlecased) with a parenthetical count summary — e.g., `Discussion (3 completed, 1 cancelled)`, `Research (1 completed)`, `Specification (2 in-progress)`. Combine statuses present in that phase; omit zero counts
- Items under each phase use proper tree grammar: `├─` for non-final siblings, `└─` for the final item. Pending discussion topics from research count as siblings when determining the final item
- Planning items show format after status, separated by a middle dot: `[in-progress] · linear`
- Specification items show their source discussions as a sub-tree beneath, one `└─` per source
- Source status: `[incorporated]` or `[pending]` from manifest
- Implementation items show progress: `Phase {N}, {M} task(s) completed` if in-progress with current_phase; `{M} task(s) completed` otherwise
- Pending discussion topics from research appear under the Discussion phase heading with `[pending from research]` status, after any existing discussion items. If no discussion items exist yet, render a Discussion section with only the pending topics
- Phases with no items don't appear (except Discussion, which appears if pending topics from research exist)
- Blank line between phase sections
- No trailing blank line after the last phase section (the code block ends immediately after the last item or recommendation)

**Recommendations:** Check the following conditions in order. Show the first that applies as a `⚑`-prefixed line within the state display code block, 2-space indented and separated by a blank line from the last phase section. If the recommendation text is long, wrap it across two lines (both 2-space indented, only the first has `⚑`). If none apply, no recommendation.

| Condition | Recommendation |
|-----------|---------------|
| In-progress items across multiple phases | No recommendation |
| Some research in-progress, some completed | "Consider completing remaining research before starting discussion. Topic analysis works best with all research available." |
| Some discussions in-progress, some completed | "Consider completing remaining discussions before starting specification. The grouping analysis works best with all discussions available." |
| All discussions completed, specs not started, `gating.has_pending_discussions` is false | "All discussions are completed. Specification will analyze and group them." |
| All discussions completed, specs not started, `gating.has_pending_discussions` is true | "Pending discussion topic(s) from research remain. Consider starting these before specification." |
| Some specs completed, some in-progress | "Completing all specifications before planning helps identify cross-cutting dependencies." |
| Some plans completed, some in-progress | "Completing all plans before implementation helps surface task dependencies across plans." |
| Reopened discussion that's a source in a spec | "{Spec} specification sources the reopened {Discussion} discussion. Once that discussion concludes, the specification will need revisiting to extract new content." |

**Not-ready block:** After the main state display, check for plans with `deps_blocking` entries. If any exist, show in a separate code block:

> *Output the next fenced block as a code block:*

```
⚑ Plans not ready for implementation:
  These plans have unresolved dependencies that must be
  addressed first.

@foreach(plan in plans_with_deps_blocking)
  {topic:(titlecase)}
@foreach(dep in plan.deps_blocking)
  └─ Blocked by @if(dep.internal_id) {dep_topic}:{internal_id} @else {dep_topic} @endif
@endforeach

@endforeach
```

Use the `deps_blocking` array from the planning phase items. Show each blocking dependency with its cross-plan task reference using colon notation (`{plan}:{internal_id}`) when an `internal_id` is present. Omit this block entirely if no plans are blocked.

→ Proceed to **B. Key**.

---

## B. Key

Show only statuses and categories that appear in the current display. No `---` separator before this section.

> *Output the next fenced block as a code block:*

```
  Key:
    Status:
      in-progress — work is ongoing
      completed            — phase or implementation done
      cancelled            — topic removed from active work
      pending from research — identified by research, not yet discussed
      pending from gap analysis — identified by discussion gap analysis
      promoted             — moved to its own cross-cutting work unit

    Blocking reason:
      blocked by {plan}:{task} — depends on another plan's task
      blocked by {plan}        — dependency unresolved
```

→ Proceed to **C. Menu**.

---

## C. Menu

Build a menu with two types of options:

**Numbered items** — topic-targeting actions where you're selecting a specific topic. Use sequential numbers. These include:
- Continue items: any item with status `in-progress` in any phase
  - Planning in-progress: `Continue "{topic:(titlecase)}" — planning [in-progress]`
  - Implementation in-progress with progress: `Continue "{topic:(titlecase)}" — implementation (Phase {N}, Task {M})`
  - Implementation in-progress without progress: `Continue "{topic:(titlecase)}" — implementation [in-progress]`
  - Other phases: `Continue "{topic:(titlecase)}" — {phase} [in-progress]`
- Next-phase-ready items from `next_phase_ready` in discovery output:
  - Completed spec with no plan: `Start planning for "{topic:(titlecase)}" — spec completed`
  - Completed plan with no implementation:
    - If `blocked`: show but mark as not selectable: `Start implementation of "{topic:(titlecase)}" — blocked by {dep_topic}:{internal_id}`
    - Otherwise: `Start implementation of "{topic:(titlecase)}" — plan completed`
  - Completed implementation with no review: `Start review for "{topic:(titlecase)}" — implementation completed`

**Command options** — entry-point actions that launch a flow handling its own selection. Use letter shortcuts (first letter of command; second letter if disambiguation needed):
- **`s`/`spec`** — Start specification — {N} discussion(s) not yet in a spec (only shown if `gating.can_start_specification` is true and `unaccounted_discussions` has items)
- **`d`/`discuss`** — Start new discussion (always present). When `gating.has_pending_discussions` is true, append pending counts: ` — {N} pending from research` and/or `{M} from gap analysis` (only show each count if > 0)
- **`p`/`pending`** — Manage pending discussion topics (only shown when `gating.has_pending_discussions` is true)
- **`r`/`research`** — Start new research (always present)
- **`c`/`completed`** — Resume a completed topic (only shown when `completed` items exist)
- **`a`/`cancel`** — Cancel a topic (only shown when non-cancelled, non-promoted items exist in any phase)
- **`e`/`reactivate`** — Reactivate a cancelled topic (only shown when `cancelled` items exist in discovery output)
- **`m`/`map`** — View epic dependency map (always present when at least one phase has items)

**Phase-forward gating:**
- No "Start planning" unless `gating.can_start_planning` is true
- No "Start implementation" unless `gating.can_start_implementation` is true
- No "Start review" unless `gating.can_start_review` is true
- No "Start specification" unless `gating.can_start_specification` is true

**Ordering:** The recommended item always appears first. Mark one item as `(recommended)` based on phase completion state:
- All discussions completed, no specifications exist, `gating.has_pending_discussions` is false → `s`/`spec` (recommended)
- All discussions completed, no specifications exist, `gating.has_pending_discussions` is true → `d`/`discuss` (recommended)
- All plannable specifications completed, some without plans → first plannable spec "(recommended)"
- All plans completed (and deps satisfied), some without implementations → first implementable plan "(recommended)"
- All implementations completed, some without reviews → first reviewable implementation "(recommended)"
- Otherwise → no recommendation (complete in-progress work first)

After the recommended item, list remaining numbered items, then command options.

**Promoted items:** Items with `[promoted]` status are shown in the state display but are **not listed in the menu** — they've been moved to their own cross-cutting work unit and are no longer actionable in this epic.

**Blocked items:** Items marked `blocked` in `next_phase_ready` are shown in the menu but are **not selectable**. If the user picks a blocked item, explain why it's blocked and re-present the menu.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to do?

- **`1`** — Start implementation of "Notifications" — plan completed (recommended)
- **`2`** — Continue "Auth Flow" — discussion [in-progress]
- **`3`** — Continue "Caching" — planning [in-progress]
- **`4`** — Start planning for "User Profiles" — spec completed
- **`5`** — Start implementation of "Reporting" — blocked by core-features:core-2-3
- **`s`/`spec`** — Start specification — 3 discussion(s) not yet in a spec
- **`d`/`discuss`** — Start new discussion
- **`r`/`research`** — Start new research
- **`c`/`completed`** — Resume a completed topic
- **`a`/`cancel`** — Cancel a topic
- **`e`/`reactivate`** — Reactivate a cancelled topic
- **`m`/`map`** — View epic dependency map

Select an option:
· · · · · · · · · · · ·
```

Recreate with actual items from discovery.

**STOP.** Wait for user response.

→ Proceed to **D. Handle Selection**.

---

## D. Handle Selection

#### If user chose a blocked item

Explain which dependencies are blocking and how to resolve them:

> *Output the next fenced block as a code block:*

```
"{topic:(titlecase)}" cannot start implementation yet.

Blocking dependencies:
  • {dep_topic}:{internal_id} — {reason}
  • {dep_topic} — {reason}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`u`/`unblock`** — Mark a dependency as satisfied externally
- **`b`/`back`** — Return to menu
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `unblock`:**

Ask which dependency to mark as satisfied. Update via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.state satisfied_externally
```

Commit the change.

→ Return to **C. Menu**.

**If user chose `back`:**

→ Return to **C. Menu**.

#### If user chose `m`/`map`

Load **[display-epic-map.md](display-epic-map.md)** and follow its instructions as written.

→ Return to **C. Menu**.

#### If user chose `p`/`pending`

→ Proceed to **G. Manage Pending**.

#### If user chose `c`/`completed`

→ Proceed to **F. Resume Completed**.

#### If user chose `a`/`cancel`

→ Proceed to **H. Cancel Topic**.

#### If user chose `e`/`reactivate`

→ Proceed to **I. Reactivate Topic**.

#### Otherwise

**Soft gate check** — before routing, check if the user's selection conflicts with a phase-completion recommendation. These are advisory, not blocking. The conditions use the `phases` data from discovery to count in-progress vs total items.

| User selected phase | Condition | Gate message |
|---------------------|-----------|--------------|
| discussion (new or continue) | `gating.has_research` is true and some research items are in-progress | "{N} of {M} research topics still in-progress. Topic analysis works best with all research available." |
| specification (new or continue) | discussion items exist with some in-progress | "{N} of {M} discussions still in-progress. Grouping analysis works best with all discussions available." |
| specification (new or continue) | `gating.has_pending_discussions` is true | "{N} pending discussion topic(s) from research/gap analysis have not been started. Starting these first ensures the specification covers all identified topics." |
| planning | specification items exist with some in-progress | "{N} of {M} specifications still in-progress. Cross-cutting dependencies are easier to identify with all completed." |
| implementation | planning items exist with some in-progress | "{N} of {M} plans still in-progress. Task dependencies across plans may be missed." |

**If a soft gate condition matches:**

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
{Gate message}

The system will re-analyse if you revisit later — proceeding
now is safe, but may require rework.

- **`y`/`yes`** — Proceed anyway
- **`b`/`back`** — Return to menu
· · · · · · · · · · · ·
```

Gate messages are self-contained first lines. For "N of M in-progress" conditions, compose the count prefix into the message (e.g., "3 of 5 research topics still in-progress. Discussion topic analysis works best with all research available.").

**STOP.** Wait for user response.

**If user chose `back`:**

→ Return to **C. Menu**.

**If user chose `yes`:**

→ Proceed to **E. Route Selection**.

**If no soft gate condition matches:**

→ Proceed to **E. Route Selection**.

---

## E. Route Selection

Store the selected action, phase, and topic (if applicable). Map to a routing entry:

| Selection | Phase | Topic |
|-----------|-------|-------|
| Continue {topic} — discussion | discussion | {topic} |
| Continue {topic} — research | research | {topic} |
| Continue {topic} — specification | specification | {topic} |
| Continue {topic} — planning | planning | {topic} |
| Continue {topic} — implementation | implementation | {topic} |
| Start planning for {topic} | planning | {topic} |
| Start implementation of {topic} | implementation | {topic} |
| Start review for {topic} | review | {topic} |
| Start specification | specification | — |
| Start new discussion | discussion | — |
| Discuss pending topic {topic} | discussion | {topic} |
| Start new research | research | — |

→ Return to caller.

---

## F. Resume Completed

Display all completed items across all phases and let the user select one to resume.

Using the `completed` items from discovery output, group by phase:

> *Output the next fenced block as a code block:*

```
Completed Topics

@foreach(phase in phases)
@if(phase.completed_items)
  {phase:(titlecase)}
@foreach(item in completed where item.phase == phase)
    └─ {item.name:(titlecase)} [completed]
@endforeach
@endif

@endforeach
```

Only show phases with completed items. Blank line between phase sections.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which topic would you like to resume?

- **`1`** — Resume "{item.name:(titlecase)}" — {item.phase}
- **`2`** — ...
- **`{N}`** — Back to main menu

Select an option:
· · · · · · · · · · · ·
```

List all completed items across all phases.

**STOP.** Wait for user response.

#### If user chose `Back to main menu`

→ Return to **C. Menu**.

#### If user chose a topic

Store the selected phase and topic.

→ Return to caller.

---

## G. Manage Pending

Display pending discussion topics from both research analysis and discussion gap analysis. Uses `pending_from_research` and `pending_from_gaps` from discovery output.

> *Output the next fenced block as a code block:*

```
Pending Discussion Topics

Topics identified by research analysis and discussion
gap analysis that have not yet been discussed.

@foreach(topic in pending_from_research)
  {N}. {topic.name:(titlecase)} [from research]
@endforeach
@foreach(topic in pending_from_gaps)
  {N}. {topic.name:(titlecase)} [from gap analysis]
@endforeach
```

Number all topics sequentially across both lists. Track the source of each item for routing the skip action.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Start a discussion for a pending topic, or skip one:

- **`1`** — Start discussion for "{topic_1.name:(titlecase)}"
- **`2`** — Start discussion for "{topic_2.name:(titlecase)}"
- **`s`/`skip`** — Remove a topic from pending list
- **`b`/`back`** — Return to menu
· · · · · · · · · · · ·
```

Numbered items correspond to the list above. Recreate with actual topics from discovery.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **C. Menu**.

#### If user chose a numbered topic

Set selection to "Discuss pending topic {topic}" with the selected topic name.

→ Return to **E. Route Selection**.

#### If user chose `skip`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which topic would you like to skip? Pick from the list above:
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Remove the topic from the appropriate manifest array based on its source:

**If topic is from research:**
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs pull {work_unit}.research surfaced_topics "{topic}"
```

**If topic is from gap analysis:**
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs pull {work_unit}.discussion gap_topics "{topic}"
```

> *Output the next fenced block as a code block:*

```
Removed "{topic:(titlecase)}" from pending topics.
```

**If no more pending topics remain (from either source):**

→ Return to **C. Menu**.

**If pending topics still remain:**

→ Return to **G. Manage Pending**.

---

## H. Cancel Topic

Display all non-cancelled, non-promoted items across all phases, grouped by phase.

> *Output the next fenced block as a code block:*

```
Cancellable Topics

@foreach(phase in phases)
@if(phase has non-cancelled, non-promoted items)
  {phase:(titlecase)}
@foreach(item in phase.items where status != cancelled and status != promoted)
    {N}. {item.name:(titlecase)} [{item.status}]
@endforeach
@endif

@endforeach
```

Number all items sequentially across all phases. Only show phases with cancellable items. Blank line between phase sections.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which topic would you like to cancel?

- **`1`** — Cancel "{item_1.name:(titlecase)}" — {item_1.phase} [{item_1.status}]
- **`2`** — ...
- **`b`/`back`** — Return to menu

Select an option:
· · · · · · · · · · · ·
```

Recreate with actual items from discovery.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **C. Menu**.

#### If user chose a numbered topic

Confirm with the user:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Cancel "{topic:(titlecase)}" in {phase}? This will mark it as
cancelled. You can reactivate it later.

- **`y`/`yes`** — Confirm cancellation
- **`n`/`no`** — Return to menu
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `no`:**

→ Return to **C. Menu**.

**If user chose `yes`:**

Run two manifest CLI calls to set cancelled status and preserve previous status:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.{phase}.{topic} previous_status {current_status}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.{phase}.{topic} status cancelled
```

Remove the cancelled topic's chunks from the knowledge base:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs remove --work-unit {work_unit} --phase {phase} --topic {topic}
```

If the remove command fails, display the error but do not block — the cancellation is already recorded:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge removal warning
  {error details}
  The topic is cancelled. You can run knowledge remove manually later.
```

Commit the change.

> *Output the next fenced block as a code block:*

```
Cancelled "{topic:(titlecase)}" in {phase}.
```

→ Return to **C. Menu**.

---

## I. Reactivate Topic

Display all cancelled items across all phases, grouped by phase.

> *Output the next fenced block as a code block:*

```
Cancelled Topics

@foreach(phase in phases)
@if(phase has cancelled items)
  {phase:(titlecase)}
@foreach(item in phase.items where status == cancelled)
    {N}. {item.name:(titlecase)} [cancelled] (was: {item.previous_status})
@endforeach
@endif

@endforeach
```

Number all items sequentially across all phases. Only show phases with cancelled items. Blank line between phase sections.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which topic would you like to reactivate?

- **`1`** — Reactivate "{item_1.name:(titlecase)}" — {item_1.phase} (was: {item_1.previous_status})
- **`2`** — ...
- **`b`/`back`** — Return to menu

Select an option:
· · · · · · · · · · · ·
```

Recreate with actual items from discovery.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **C. Menu**.

#### If user chose a numbered topic

Read the `previous_status` via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.{phase}.{topic} previous_status
```

Use the returned value as `{previous_status}` in the next two commands to restore the original status and remove the `previous_status` field:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.{phase}.{topic} status {previous_status}
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.{phase}.{topic} previous_status
```

**If `previous_status` is `completed` and `phase` is one of the indexed phases (research / discussion / investigation / specification):**

Re-index the reactivated topic's artifact into the knowledge base. Resolve the artifact path by phase:
- research: `.workflows/{work_unit}/research/{topic}.md`
- discussion: `.workflows/{work_unit}/discussion/{topic}.md`
- investigation: `.workflows/{work_unit}/investigation/{topic}.md`
- specification: `.workflows/{work_unit}/specification/{topic}/specification.md`

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index {artifact_path}
```

If the index command fails, display the error but do not block — the reactivation is already recorded:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge indexing warning
  {error details}
  The artifact is saved. Indexing can be retried later.
```

Commit the change.

> *Output the next fenced block as a code block:*

```
Reactivated "{topic:(titlecase)}" in {phase}. Status restored to {previous_status}.
```

→ Return to **C. Menu**.

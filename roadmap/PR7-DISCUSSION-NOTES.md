# PR 7: Work Unit Lifecycle — Discussion Notes

*Captured from discussion session on 2026-03-09. Read alongside [PR7-WORK-UNIT-LIFECYCLE.md](PR7-WORK-UNIT-LIFECYCLE.md).*

## Audit Findings

Before discussion began, an audit was performed across the codebase. Key findings:

- **Manifest CLI** already has an `archive` command and `archived` status — but nothing in the workflow uses them. No skill invokes `archive`, no discovery script references `.archive`. It was built speculatively.
- **`loadActiveManifests()`** in discovery-utils.js filters `status === 'active'`. All continue skills and workflow-start use this.
- **"Done" detection** is currently computed, not stored: `computeNextPhase()` returns `next_phase: 'done'` when review is completed. Continue skills for feature/bugfix additionally exclude `next_phase === 'done'` from their lists.
- **workflow-start** is a unified entry point that lists all active work units across all types with continue options, plus start-new options. It delegates to `/continue-*` or `/start-*` skills. User described it as "really a convenience" and "a unified entry point."
- **Continue skills** (feature, bugfix, epic) show work units filtered to one type and route to phase entry skills.

Full audit details are in the codebase; touch points listed at the bottom of this document.

## What Was Discussed and Decided

### State Machine

Three work unit statuses: `in-progress`, `concluded`, `cancelled`.

```
                 ┌─────────────┐
          create │  in-progress │
                 └──────┬───────┘
                        │
              ┌─────────┼──────────┐
              │ pipeline │  cancel  │
              │ completes│         │
              ▼                    ▼
     ┌────────────┐        ┌───────────┐
     │  concluded  │        │ cancelled  │
     └─────┬──────┘        └─────┬─────┘
           │                     │
           │ reactivate          │ reactivate
           └──────────┬──────────┘
                      ▼
              ┌─────────────┐
              │  in-progress │
              └─────────────┘
```

**Transitions:**
- `in-progress` → `concluded`: when the pipeline completes
- `in-progress` → `cancelled`: user cancels
- `concluded` → `in-progress`: user reactivates
- `cancelled` → `in-progress`: user reactivates

**Rules:**
- `concluded` cannot be cancelled — you can only cancel an in-progress work unit
- Reactivation from either terminal state returns to `in-progress`
- When reactivated, you jump into one of the phases. Phase entry already handles setting the phase to in-progress — that part of the feature already exists. We just need to also set the work unit status back to `in-progress`.

### Terminology

- Use `concluded` not `done`/`completed` — consistent with existing phase conventions
- Use `in-progress` not `active` — also consistent with phase conventions
- Implementation and review phases currently use `completed` instead of `concluded` — this will be changed as well (separate from this PR)

### Archive: Deferred

- Remove the existing `archive` command from manifest CLI — unused code, shouldn't sit around doing nothing. Easy to re-add later if needed.
- Archive as a concept is deferred to a future PR.
- User's question that led to deferral: "if a concluded or cancelled work unit is already hidden from view, do we need the archive?"

### Start Skills

- Start skills (`/start-feature`, `/start-bugfix`, `/start-epic`) should NOT show concluded items
- User: "if you call Start New, it's assumed that you are literally starting afresh. So I don't think we should show concluded items in there because it's just brand new."

### Continue Skills and Workflow-Start Must Show Concluded/Cancelled Work Units

- Continue skills need to show concluded/cancelled work units, separately from in-progress ones
- workflow-start also needs to show them (unified view across all types)
- User noted that viewing concluded stages "should include concluded work units, not just concluded phases within a pending work unit or an in progress work unit"

### Concluded/Cancelled Sub-View Design

**Entry point:** Both workflow-start and continue skills show a one-liner summary of non-active work. With a single menu option to view them — unified, not separate "view completed" / "view cancelled." User: "rather than having view completed and view cancelled, we can unify that into one view."

**Display terminology note:** User said "Completed" and "Cancelled" as display headings, but established `concluded` as the status value. Whether user-facing display says "Completed" or "Concluded" was not resolved.

**Sub-view display:** One view with two headings (Completed/Cancelled or Concluded/Cancelled — see note above), numbered continuously across both sections.

**Sub-view interaction — two-step flow:**
1. First: select a work unit by number, or go back
2. After selection: present actions for that specific work unit

**Actions after selecting a work unit:**
- Reactivate (command-based: with shortcut key)
- Back to list (command-based: with shortcut key)
- Questions (prompt-based: no shortcut key)

**Menu convention:** Command-based options (with backtick shortcuts) come first. Prompt-based options (plain text, no shortcuts) come last. This is an established codebase convention — the `Ask`/`Questions` pattern used in task-loop.md and elsewhere.

### Code Sharing Across Continue Skills

User raised concern about duplicated discovery and presentation logic between workflow-start and continue skills. After checking the continue-feature and continue-epic displays, user noted they "look very similar in terms of layout."

The concluded/cancelled sub-view would be needed in workflow-start, continue-feature, continue-bugfix, and continue-epic. Within the continue skills the view would be filtered to one work type. Within workflow-start it would show a unified view across all types.

User acknowledged the overlap might warrant a shared reference file for the continue skills but wasn't certain: "I don't know if they're shared, though, that's the problem, because I don't know if the overlap is sufficient to deduplicate the code."

## Open Questions (Not Yet Resolved)

### Who Sets `concluded` on Pipeline Completion?

Not discussed in detail. The state machine says in-progress → concluded when the pipeline completes, but which skill/mechanism sets this was not agreed.

### Epic Concluded — When and How?

Epics have multiple topics across phases. Auto-detecting "everything is done" is tricky. User discussed several possibilities:
- Could prompt when everything is done
- Could be a manual action via continue-epic — user can explicitly mark it as concluded
- User: "it might be that you want to set it to concluded before it's fully finished because maybe you've decided that it's good enough as it is and you're going to draw a line"

### Early Conclusion Applies to All Work Types

User said the ability to conclude before the pipeline is fully done also applies to features and bugfixes: "maybe that also applies to features and bug fixes, because sometimes you might get to the end of implementation and decide that you're done."

User mentioned this could happen at the continue phase level, and "maybe in the bridge phase possibly."

### Overlap with PR8 (Skip Review)

User noted PR8 (skip review) touches on the same subject of concluding early. Said: "we could always work that PR into this one." Not decided whether to fold PR8 in or keep separate.

### Cancel UX — Where Does It Live?

User wasn't sure. Said "both perhaps" (continue skills and workflow-start) but also said it "might change based on the analysis" of how workflow-start and continue skills relate.

## Codebase Touch Points (from audit)

These were identified during the audit phase. Not all were discussed in detail:

1. **Manifest CLI** (`skills/workflow-manifest/scripts/manifest.js`): Update valid statuses, remove archive command, change init default from `active` to `in-progress`
2. **Manifest SKILL.md** (`skills/workflow-manifest/SKILL.md`): Update docs to match
3. **discovery-utils.js** (`skills/workflow-shared/scripts/discovery-utils.js`): `loadActiveManifests()` filter from `active` to `in-progress`
4. **Continue skills** (`continue-feature/`, `continue-bugfix/`, `continue-epic/`): Add concluded/cancelled visibility + reactivation UX
5. **workflow-start** (`workflow-start/`): Add concluded/cancelled summary + sub-view
6. **workflow-bridge**: Mechanism for setting `status: concluded` on pipeline completion
7. **link-dependencies SKILL.md**: Update `--status active` to `--status in-progress`
8. **Tests**: Update all references to `active`/`archived` status values

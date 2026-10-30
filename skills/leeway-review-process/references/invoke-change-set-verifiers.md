# Invoke Change-Set Verifiers

*Reference for **[leeway-review-process](../SKILL.md)***

---

This step dispatches `leeway-review-change-set-verifier` agents once per review cycle, after every verifier batch, over the whole delivered change-set — split by the specification's sections, one agent per section plus one over the test surface. Each holds its section's intent against the product, executing what the project's own conventions let it execute, takes the criteria the task verifiers could not settle as items to measure, and writes its findings and coverage map to one file per section.

---

## A. Derive Sections

The cycle number `{N}` is the one **[invoke-review-synthesizer.md](invoke-review-synthesizer.md)** → Determine Cycle Number derives — the count of `review-report-c*.md` files in the implementation directory plus one, the count reading zero when the directory does not exist yet:

```bash
ls .workflows/{work_unit}/implementation/{topic}/review-report-c*.md 2>/dev/null | wc -l
```

Every file this step writes or reads carries it, so a later cycle measures the change-set as it then stands rather than reading the previous cycle's files.

Read the specification at `.workflows/{work_unit}/specification/{topic}/specification.md`. The split keys on the work type read in **[invoke-task-verifiers.md](invoke-task-verifiers.md)** → B. Extract All Tasks, never on the document's headings:

- **Quick-fix** — one section over the whole document, slug `specification`, and no test surface: the document carries its own verification.
- **Every other work type** — the document's numbered sections, each `### N.` heading beneath `## Specification` with everything under it, plus one section named `test surface`, over the change-set's test files held against everything the specification asks them to guard. A document with no numbered sections is one section named for the document, slug `specification`, plus the test surface.

When the numbered sections exceed four, merge adjacent sections from the lowest numbers up — the first with the second, then the next two — until four remain, so that with the test surface there are at most five. A merged section carries both names and both bodies.

Slug each section for its file name — the heading lowercased, every run of characters other than letters and digits collapsed to one hyphen, leading and trailing hyphens dropped: `### 2. Capture Webhooks` → `2-capture-webhooks`; a merged section joins its members' slugs with a hyphen; the test surface is `test-surface`.

Skip any section whose `.workflows/{work_unit}/review/{topic}/change-set-c{N}-{slug}.md` already exists — a crash resumes by dispatching only this cycle's missing sections.

#### If no section is missing

→ Proceed to **D. Check the Tree**.

#### Otherwise

→ Proceed to **B. Gather the Brief**.

---

## B. Gather the Brief

Every agent receives the same project conventions, and reads the change-set itself through the engine, from the work unit and topic.

1. **The linters** — the names the implementation declared (empty stdout or `[]` means none); each is run the way the project's own conventions say it is run:
   ```bash
   node .claude/skills/leeway-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} linters
   ```
2. **The project conventions** — the project's `CLAUDE.md` when one exists at the project root, and the project skill paths from Step 3
3. **The finding floor** — the path `.claude/skills/leeway-implementation-process/references/finding-floor.md`, handed on unread; the agents load it
4. **The unsettled criteria** — `.workflows/.cache/{work_unit}/review/{topic}/unsettled.txt`; absent means the task verifiers settled every criterion by reading, and the agents are told so

→ Proceed to **C. Dispatch**.

---

## C. Dispatch

Dispatch one agent per missing section, all in parallel via the Task tool.

- **Agent path**: `.claude/agents/leeway-review-change-set-verifier.md`

Each agent receives:

1. **Section** — its name and its content
2. **Specification path** — `.workflows/{work_unit}/specification/{topic}/specification.md`
3. **Plan path** — the plan read in Step 2
4. **Project conventions** — the `CLAUDE.md` path, the project skill paths, and the linter names from **B**
5. **Finding floor path** — from **B**
6. **Unsettled criteria path** — from **B**, or the statement that there are none
7. **Work unit** — the work unit name
8. **Topic** — the plan topic name
9. **Work type** — from the manifest
10. **Output path** — `.workflows/{work_unit}/review/{topic}/change-set-c{N}-{slug}.md`

Record each agent's status. If an agent fails (error, timeout), record the failure and continue — its section is named as not covered in the report, never silently absent.

Each agent returns a brief status:

```
STATUS: complete | failed
FINDINGS_COUNT: {N}
NOT_MEASURED: {N}
SUMMARY: {1 sentence}
```

The dispatch runs in the background (`run_in_background: true`) and ends the turn on exactly `The change-set verifier agents have been dispatched for the specification's sections.`

> **CHECKPOINT**: Do not proceed until every dispatched agent has returned.

→ Proceed to **D. Check the Tree**.

---

## D. Check the Tree

The agents measure inside the working tree and must leave it as they found it. The review's own artifacts — the reports, this cycle's section files, the manifest — sit uncommitted under `.workflows/` until prep commits them, so the check reads everything else:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render change-set-tree {work_unit}.review.{topic}
```

#### If the output is empty

Nothing outside `.workflows/` is modified or untracked.

→ Proceed to **E. Reconcile**.

#### Otherwise

A path outside `.workflows/` is modified or untracked. Never revert it blind — the paths are named and the review stops here. Emit both sections verbatim per their markers.

**STOP.** Do not proceed — terminal condition.

---

## E. Reconcile

Read every `.workflows/{work_unit}/review/{topic}/change-set-c{N}-*.md` file from disk — the reconciliation draws from the files as they stand, never from memory of the dispatches that produced them. Make each Read before reconciling.

Reconcile the unsettled criteria across the sections. A criterion under any section's `MEASURED` is measured — settled by that section, and a `fails` outcome is a finding that section carries. A criterion under `NOT MEASURED` in every section, or absent from every file, is not measured.

Write the not-measured list to `.workflows/.cache/{work_unit}/review/{topic}/not-measured.txt` with the Write tool — one block per criterion, opening with `[{task suffix}]` and quoting it. When nothing is unmeasured, delete any `not-measured.txt` an earlier run left there and write nothing. The report's Plan Completion and the presentation's count read that file; the report's Specification Compliance reads this cycle's section files directly, and names any section whose agent failed as not covered.

→ Return to caller.

# Invoke Change-Set Verifiers

*Reference for **[workflow-review-process](../SKILL.md)***

---

This step dispatches `workflow-review-change-set-verifier` agents once per review cycle, after every verifier batch, over the whole delivered change-set — split by the specification's sections, one agent per section plus one over the test surface. Each holds its section's intent against the product, executing what the project's own conventions let it execute, takes the criteria the task verifiers could not settle as items to measure, and writes its findings and coverage map to one file per section.

---

## A. Derive Sections

The cycle number `{N}` is the one **[invoke-review-synthesizer.md](invoke-review-synthesizer.md)** → Determine Cycle Number derives — the count of `review-report-c*.md` files in `.workflows/{work_unit}/implementation/{topic}/` plus one. Every file this step writes or reads carries it, so a later cycle measures the change-set as it then stands rather than reading the previous cycle's files.

Read the specification at `.workflows/{work_unit}/specification/{topic}/specification.md`. The split is its numbered sections — each `### N.` heading beneath `## Specification` with everything under it — plus one section named `test surface`, over the change-set's test files held against everything the specification asks them to guard. A document with no numbered sections is one section named for the document, slug `specification`; for a quick-fix that section is the whole split, with no test surface — its scoping document carries its own verification.

When the numbered sections exceed four, merge adjacent sections from the lowest numbers up — the first with the second, then the next two — until four remain, so that with the test surface there are at most five. A merged section carries both names and both bodies.

Slug each section for its file name — the heading lowercased, every run of characters other than letters and digits collapsed to one hyphen, leading and trailing hyphens dropped: `### 2. Capture Webhooks` → `2-capture-webhooks`; a merged section joins its members' slugs with a hyphen; the test surface is `test-surface`.

Skip any section whose `.workflows/{work_unit}/review/{topic}/change-set-c{N}-{slug}.md` already exists — a crash resumes by dispatching only this cycle's missing sections.

#### If no section is missing

→ Proceed to **D. Check the Tree**.

#### Otherwise

→ Proceed to **B. Gather the Brief**.

---

## B. Gather the Brief

Every agent receives the same change-set and the same project conventions.

1. **The change-set** — the file list built in **A. Identify Scope** of **[invoke-task-verifiers.md](invoke-task-verifiers.md)**, and the range from the parent of the first task commit to `HEAD`; the first task commit is:
   ```bash
   git log --reverse --format=%H --grep="impl({work_unit}): T{topic}-" | head -1
   ```
2. **The linters** — the names the implementation declared (empty stdout or `[]` means none); each is run the way the project's own conventions say it is run:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} linters
   ```
3. **The project conventions** — the project's `CLAUDE.md` when one exists at the project root, and the project skill paths from Step 3
4. **The finding floor** — `.claude/skills/workflow-implementation-process/references/finding-floor.md`
5. **The unsettled criteria** — `.workflows/.cache/{work_unit}/review/{topic}/unsettled.txt`; absent means the task verifiers settled every criterion by reading, and the agents are told so

→ Proceed to **C. Dispatch**.

---

## C. Dispatch

Dispatch one agent per missing section, all in parallel via the Task tool.

- **Agent path**: `../../../agents/workflow-review-change-set-verifier.md`

Each agent receives:

1. **Section** — its name and its content
2. **Specification path** — `.workflows/{work_unit}/specification/{topic}/specification.md`
3. **Plan path** — the plan read in Step 2
4. **Change-set** — the file list and the commit range from **B**
5. **Project conventions** — the `CLAUDE.md` path, the project skill paths, and the linter names from **B**
6. **Finding floor path** — from **B**
7. **Unsettled criteria path** — from **B**, or the statement that there are none
8. **Work unit** — the work unit name
9. **Topic** — the plan topic name
10. **Work type** — from the manifest
11. **Output path** — `.workflows/{work_unit}/review/{topic}/change-set-c{N}-{slug}.md`

Record each agent's status. If an agent fails (error, timeout), record the failure and continue — its section is named as not covered in the report, never silently absent.

Each agent returns a brief status:

```
STATUS: complete | failed
FINDINGS_COUNT: {N}
NOT_MEASURED: {N}
SUMMARY: {1 sentence}
```

> **CHECKPOINT**: Do not proceed until every dispatched agent has returned.

→ Proceed to **D. Check the Tree**.

---

## D. Check the Tree

The agents measure inside the working tree and must leave it as they found it. The review's own artifacts — the reports, this cycle's section files, the manifest — sit uncommitted under `.workflows/` until prep commits them, so the check reads everything else:

```bash
git status
```

#### If nothing outside `.workflows/` is modified or untracked

→ Proceed to **E. Reconcile**.

#### Otherwise

A path outside `.workflows/` is modified or untracked. Never revert it blind — the paths are named and the review stops here.

> *Output the next fenced block as a properties code block (```properties fence):*

```
⚑ The change-set verification left the working tree dirty outside .workflows/
```

> *Output the next fenced block as markdown (not a code block):*

```
> The pass must leave the tree as it found it — these paths are modified or untracked: {paths}. Once the tree is clean, re-enter the review; it resumes at this step, keeping the section files already written.
```

**STOP.** Do not proceed — terminal condition.

---

## E. Reconcile

Read every `.workflows/{work_unit}/review/{topic}/change-set-c{N}-*.md` file from disk — the reconciliation draws from the files as they stand, never from memory of the dispatches that produced them. Make each Read before reconciling.

Reconcile the unsettled criteria across the sections. A criterion under any section's `MEASURED` is measured — settled by that section, and a `fails` outcome is a finding that section carries. A criterion under `NOT MEASURED` in every section, or absent from every file, is not measured.

Write the not-measured list to `.workflows/.cache/{work_unit}/review/{topic}/not-measured.txt` with the Write tool — one block per criterion, opening with `[{task suffix}]` and quoting it. When nothing is unmeasured, delete any `not-measured.txt` an earlier run left there and write nothing. The report's Plan Completion and the presentation's count read that file; the report's Specification Compliance reads this cycle's section files directly, and names any section whose agent failed as not covered.

→ Return to caller.

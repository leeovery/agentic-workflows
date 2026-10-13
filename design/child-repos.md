# Child Repos — code that lives in repos of its own inside the project

A project can keep its code in repos of its own inside the project's folder. Folio's root is a repo holding `.workflows/` and the plan store; `api/`, `app/` and `sdk/` are separate clones its `.gitignore` lists. Every git operation the workflows run against code runs in the root repo, so code in a child repo cannot be committed through the engine, and every step that reads the change sees nothing of it. Opened 2026-10-13.

## Motivation

- **The task commit fails.** `engine commit --paths api/…` stages in the root, which ignores `api/`: `git add failed: The following paths are ignored by one of your .gitignore files: api`. A live Folio session commits by hand with `git -C api commit`, outside the engine's commit lock and its `left_dirty` backstop.
- **Every read of the committed change comes back empty.** A topic's task commits are found with `git log --grep="impl({wu}): T{topic}-"` in the root (`invoke-analysis.md`, `invoke-consolidation-finder.md`, `invoke-task-verifiers.md`, `invoke-change-set-verifiers.md`). The root holds only the `record T…` state commits, which the grep does not match, so the analysis agents, the consolidation finder, the task verifiers and the change-set verifier get an empty scope — and nothing fails.
- **Uncommitted work is invisible.** The task reviewer and the fix verifier find the work with `git diff` / `git status` in the root, and the orchestrator picks a task's files the same way. The pre-analysis checkpoint (`render checkpoint-files-gate`) and review's clean-tree gate (`render change-set-tree`) read the root's dirt alone: the clean-tree gate passes over a dirty `api/`.
- **The baseline reads an empty project.** `baselineSignal` counts the root's history and files. Folio's root holds none of its code, so the one-time brownfield judgment sees a near-empty project.

## Rulings

- **R1 — A child repo is found, never configured.** A child repo is a folder inside the project that holds its own `.git` and that its parent repo's git reports as a whole: an untracked nested repo (git names it at any depth), a submodule (its gitlink), or an ignored folder that holds `.git` itself. The engine finds them every time it needs them and looks inside each child for its own children. Nothing is recorded and nothing is configured. A repo inside an ignored folder that is not itself a repo is not found — git never descends into an ignored folder, and walking one (`node_modules/`) costs more than the case is worth.
- **R2 — The root keeps what the workflows own.** `.workflows/`, the paths in `OWNED_PATHS` and a plan's declared storage stay the root's, committed through the root's door exactly as today. Child repos hold code.
- **R3 — Paths are the project's.** Every path into and out of the engine is relative to the project root (`api/src/billing.ts`). The engine translates to each repo's own paths and back. No prose and no agent ever learns which repo holds a file.
- **R4 — One code commit, every repo it touches.** `commit --paths` groups the named files by the repo that owns each — the deepest found repo containing it, else the root — and commits each group under that repo's own commit lock, with the same message, root first and then child repos in path order. `committed` answers `[{repo, sha}]`, `.` naming the root; nothing to commit answers `[]` with the note. A repo whose commit fails fails the call, naming the repos already committed; re-running the same call is the retry, since those repos have nothing left in the named paths. The engine never commits a submodule pointer in a parent.
- **R5 — Dirt is every repo's.** `left_dirty`, the checkpoint gate and the clean-tree gate read every repo's uncommitted change, project-relative, minus `.workflows/`. A parent's view of a child repo — an untracked `api/`, a modified gitlink — is never dirt.
- **R6 — Code reads go through the engine.** The `code` noun answers what the prose and the agents read today with raw git, across every repo:
  - `engine code log --grep <token>` — the commits whose subject carries the token (fixed string), the files they touched, and each repo's base: the parent of its earliest matching commit.
  - `engine code diff --grep <token>` — the change from each repo's base to its `HEAD`, confined to the matching commits' files, as one unified diff.
  - `engine code diff` — the uncommitted change, untracked files shown as added.
  - `engine code status` — the uncommitted files.

  Every prose site and agent that reads the code change swaps its raw git for these. For a project with one repo each answers what git answers today.
- **R7 — Investigation keeps its own git.** Its history work — `log -p --follow`, `blame`, `bisect` — follows one file. `analysis-patterns.md` says to run it in the repo that holds the file (`git -C {folder}`).
- **R8 — The baseline counts every repo.** `baselineSignal` totals history and files across the repos; the arrival commit (the first touching `.workflows`) stays the root's.

Out of scope: a Claude Code worktree of the root carries no ignored child clone, so an implementation run in one sees no child repos; the code slot stays one code session per project.

## The settled shape

### Finding the repos

`kernel/repos.cjs` — `projectRepos(root)` answers `[{dir, path}]`, `dir` project-relative (`''` for the root) and `path` absolute, root first, then by `dir`. Per repo, the candidates are the entries of `git ls-files --others --exclude-standard -z` that end in `/` (git's mark for a nested repo), the entries of `git ls-files --others --ignored --exclude-standard --directory -z` that hold `.git`, and the paths of `git ls-files --stage -z` entries with mode `160000`; each found repo is searched the same way. `repoOf(repos, relPath)` answers the deepest repo whose `dir` contains the path. One call per engine invocation; nothing is cached across calls.

### The commit

`commitCodePaths` validates every path first (R3 — `codePathSpec` reads the owning repo for "on disk or tracked" and the staged-deletion case), groups by `repoOf`, and runs `commitPathspecScoped` per repo with the repo-relative specs; the commit lock is the owning repo's (`gitPath` resolves its git dir). `beatQuietly` runs once. `left_dirty` is the R5 dirt.

### Dirt

`dirtyEntries` gains a project-wide sibling over `projectRepos`: each repo's `status --porcelain -z`, its entries prefixed with the repo's `dir`, the parent's entries for a child repo's own folder dropped, `.workflows/` dropped. `pathsTouchedBySubject` gains the same. The checkpoint gate and the clean-tree gate read the project-wide forms.

### The `code` noun

Each verb runs per repo and answers project-relative. `code log --grep` answers `{commits: [{repo, sha, subject}], files: [...], repos: [{repo, base}]}` — `base` the parent of the repo's earliest matching commit, the empty tree where that commit is the repo's root. `code diff --grep` emits `git diff {base}..HEAD -- {files}` per repo with `--src-prefix`/`--dst-prefix` carrying the repo's `dir`, concatenated. `code diff` emits each repo's `git diff HEAD` the same way, then each untracked file as an addition. `code status` answers `{files: [...]}`.

### The prose

- **Implementation** — the task commit's file list comes from `code status`; `invoke-analysis.md` and `invoke-consolidation-finder.md` take their file lists from `code log --grep`; the report register's product summary draws on `code diff`.
- **Review** — `invoke-task-verifiers.md` and `invoke-change-set-verifiers.md` take files and bases from `code log --grep`; `apply-do-now.md` checks the tree with `code status` and confirms the work with `code diff`; `produce-review.md` reads the apply commit through `code diff --grep "review({wu}): apply do-now findings"`.
- **Agents** — the task reviewer and the fix verifier read `code diff` and `code status`; the change-set verifier and the consolidation finder read `code log --grep` and `code diff --grep`.
- **Investigation** — the one-line R7 note.

## Build order

1. **Commit and dirt** — `kernel/repos.cjs`, the commit across repos, the project-wide dirt behind `left_dirty` and the two gates; commit-door, render-surface and pipeline-simulation coverage with a child repo.
2. **The `code` noun and the baseline** — the four verbs, `baselineSignal` across repos, `commands.md`; engine coverage.
3. **The prose and the agents** — every site above, the investigation note, `docs/`, the pipeline simulation's reads, the prose snapshots the engine change moves.

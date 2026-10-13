# Child Repos — code that lives in repos of its own inside the project

A project can keep its code in repos of its own inside the project's folder. Folio's root is a repo holding `.workflows/` and the plan store; `api/`, `app/` and `sdk/` are separate clones its `.gitignore` lists. Every git operation the workflows run against code runs in the root repo, so code in a child repo cannot be committed through the engine, and every step that reads the change sees nothing of it. Opened 2026-10-13.

## Motivation

- **The task commit fails.** `engine commit --paths api/…` stages in the root, which ignores `api/`: `git add failed: The following paths are ignored by one of your .gitignore files: api`. A live Folio session commits by hand with `git -C api commit`, outside the engine's commit lock and its `left_dirty` backstop.
- **Every read of the committed change comes back empty.** A topic's task commits are found with `git log --grep="impl({wu}): T{topic}-"` in the root (`invoke-analysis.md`, `invoke-consolidation-finder.md`, `invoke-task-verifiers.md`, `invoke-change-set-verifiers.md`). The root holds only the `record T…` state commits, which the grep does not match, so the analysis agents, the consolidation finder, the task verifiers and the change-set verifier get an empty scope — and nothing fails.
- **Uncommitted work is invisible.** The task reviewer and the fix verifier find the work with `git diff` / `git status` in the root, and the orchestrator picks a task's files the same way. The pre-analysis checkpoint (`render checkpoint-files-gate`) and review's clean-tree gate (`render change-set-tree`) read the root's dirt alone: the clean-tree gate passes over a dirty `api/`.
- **The baseline reads an empty project.** `baselineSignal` counts the root's history and files. Folio's root holds none of its code, so the one-time brownfield judgment sees a near-empty project.

## Rulings

- **R1 — A child repo is found, never configured.** A child repo is a folder inside the project that holds its own `.git` and that its parent repo's git reports as a whole: an untracked nested repo (git names it at any depth), a submodule (its gitlink), or an ignored folder that holds `.git` itself. The engine finds them every time it needs them and looks inside each child for its own children. Nothing is recorded and nothing is configured. A repo inside an ignored folder that is not itself a repo is not found — git never descends into an ignored folder, and walking one (`node_modules/`) costs more than the case is worth. A linked worktree of the parent's own repository holds a `.git` too but is that repository checked out again, never a child; a `.git` git cannot read is no repo; and nothing inside the project's `.workflows/` is ever a child, whatever checkout it holds.
- **R2 — The root keeps what the workflows own.** `.workflows/`, the paths in `OWNED_PATHS` and a plan's declared storage stay the root's, committed through the root's door exactly as today. Child repos hold code.
- **R3 — Paths are the project's.** Every path into and out of the engine is relative to the project root (`api/src/billing.ts`). The engine translates to each repo's own paths and back. No prose and no agent ever learns which repo holds a file. A project that sits in a folder of a larger repository reads its root confined to that folder and named from it — never the larger repository's other folders, never its paths.
- **R4 — One code commit, every repo it touches.** `commit --paths` groups the named files by the repo that owns each — the deepest found repo containing it, else the root. Every path is taken literally — `app/[id]/page.tsx` is that file, never a pattern — and the prose single-quotes each one. Every path is checked in its owning repo before any repo commits: on disk, tracked, a staged deletion, or a deletion that repo's HEAD commit made (the retry's case), and stageable — a path a repo's ignore rules refuse fails the call with nothing committed. Every repo the call commits in must be on a branch with no merge, cherry-pick, revert or rebase in progress, or the call refuses, naming it: a commit on a detached HEAD — a submodule after `git submodule update` — is orphaned by the next checkout. Then each group commits under its repo's own commit lock, with the same message, deepest repo first, so a child commits before its parent; a submodule owning one of the call's paths has its moved pointer committed in its parent's commit. `committed` answers `[{repo, sha}]`, `.` naming the root; nothing to commit answers `[]` with the note. A repo whose commit fails fails the call, naming it and the commits already made; re-running the same call is the retry, since those repos have nothing left in the named paths and a moved pointer is still picked up.
- **R5 — Dirt is every repo's.** `left_dirty`, the checkpoint gate and the clean-tree gate read every repo's uncommitted change, project-relative, minus `.workflows/`, each untracked file named on its own — never its folder, so a task that creates a folder names its own files from the dirt and a stranger's file beside them stays dirt by name. A parent's view of a child repo — an untracked `api/`, a modified gitlink — is never dirt.
- **R6 — Code reads go through the engine.** The `code` noun answers what the prose and the agents read today with raw git, across every repo:
  - `engine code log <wu> <topic> [--phase <N>]` — the topic's task commits (`impl({wu}): T{internal_id}`, the id bounded so a sibling topic whose name extends this one's never matches), the files they touched, and each repo's base: the parent of its earliest task commit. `--subject <prefix>` selects by any subject prefix instead.
  - `engine code diff <wu> <topic> [--phase <N>]` / `--subject <prefix>` — the change from each repo's base to its `HEAD`, confined to the selected commits' files, as one unified diff.
  - `engine code diff` — the uncommitted change, untracked files shown as added.
  - `engine code status` — the uncommitted files, each untracked file on its own.

  Every prose site and agent that reads the code change swaps its raw git for these. For a project with one repo each answers what git answers today.
- **R7 — Investigation keeps its own git.** Its history work — `log -p --follow`, `blame`, `bisect` — follows one file. `analysis-patterns.md` says to run it in the repo that holds the file (`git -C {folder}`). No allow rule can pre-approve those reads without approving every git command run with `-C`, so they prompt where the user's permissions do not cover them.
- **R8 — The baseline counts every repo.** `baselineSignal` totals history and files across the repos; the arrival commit (the first touching `.workflows`) stays the root's.

Out of scope: a Claude Code worktree of the root carries no ignored child clone, so an implementation run in one sees no child repos; the code slot stays one code session per project.

## The settled shape

### Finding the repos

`kernel/repos.cjs` — `projectRepos(root)` answers `[{dir, path, heldOut}]`, `dir` project-relative (`''` for the root), `path` absolute, `heldOut` the untracked repos and submodules directly inside it (the folders its git would otherwise take in); root first, then by `dir`. Per repo, the candidates are the entries of `git ls-files --others --exclude-standard -z` that end in `/` (git's mark for a nested repo), the entries of `git ls-files --others --ignored --exclude-standard --directory -z` that hold `.git`, and the paths of `git ls-files --stage -z` entries with mode `160000`; a candidate whose git common dir is the parent's (a linked worktree) or that git cannot read is dropped; each found repo is searched the same way. `repoOf(repos, relPath)` answers the deepest repo whose `dir` contains the path. One call per engine invocation; nothing is cached across calls.

### The commit

`commitCodePaths` validates every path first in its owning repo (R4 — on disk, tracked, a staged deletion or a deletion HEAD made, and accepted by a dry-run add under the commit's own hold-outs), groups by `repoOf`, and commits deepest repo first, each under its own lock (`gitPath` resolves its git dir), a submodule's folder riding its parent's group whenever the submodule owns a path of the call. A parent holds out only the held-out folders a named path reaches, since `add` refuses an ignored folder named in an exclude. `beatQuietly` runs once. `left_dirty` is the R5 dirt.

### Dirt

`dirtyEntries` gains a project-wide sibling over `projectRepos`: each repo's `status --porcelain -z --untracked-files=all`, its entries prefixed with the repo's `dir`, the parent's child-repo folders held out, `.workflows/` dropped; the root's confined to the project folder and stripped of its prefix (R3). `pathsTouchedBySubject` gains the same. The checkpoint gate and the clean-tree gate read the project-wide forms.

### The `code` noun

Each verb runs per repo and answers project-relative. `code log` answers `{commits: [{repo, sha, subject}], files: [...], repos: [{repo, base}]}` — `base` the parent of the repo's earliest selected commit, the empty tree where that commit is the repo's root. The topic form selects by the engine's internal-id grammar; `--subject` by a fixed-string subject prefix. `code diff` with a selection emits `git diff {base} HEAD -- {files}` per repo with `--src-prefix`/`--dst-prefix` carrying the repo's `dir`, concatenated; without one it emits each repo's change against `HEAD` the same way, its untracked files read as additions in the same patch from a scratch copy of the index. A move reads as a deletion and an addition, so both paths carry the repo's `dir`; a submodule's pointer is never its parent's change, and a commit that recorded only the pointer drops out. `code status` answers `{files: [{path, status}]}`. The diffs print raw, with no JSON envelope.

### The prose

- **Implementation** — the task commit's file list comes from `code status`, and a forgotten file's second commit carries the task's message; `invoke-analysis.md` takes its file list from `code log {wu} {topic}` and `invoke-consolidation-finder.md` from `code log {wu} {topic} --phase {N}`; the report register's product summary draws on `code diff`; compaction recovery reads `code status`.
- **Review** — `invoke-task-verifiers.md` takes its files from `code log {wu} {topic}`; `invoke-change-set-verifiers.md` hands each agent the work unit and topic, and the agent reads the change-set itself; `apply-do-now.md` checks the tree with `code status`, confirms the work with `code diff`, and commits as `review({wu}): {topic} cycle {N} — apply do-now findings` — the topic and cycle before fixed text, so one cycle's subject never opens another's; `produce-review.md` reads the apply commit through `code diff --subject` with that subject; compaction recovery reads `code status`.
- **Agents** — the task reviewer and the fix verifier read `code diff` and `code status`, the fix verifier reverting by editing, never through git; the change-set verifier reads `code log {wu} {topic}` and `code diff {wu} {topic}`, the consolidation finder the same with `--phase {N}`; the task verifier and the finding synthesis judge scope through `code log` and `code diff`. Findings name paths from the project.
- **Investigation** — the one-line R7 note.

## Build order

1. **Commit and dirt** — `kernel/repos.cjs`, the commit across repos, the project-wide dirt behind `left_dirty` and the two gates; commit-door, render-surface and pipeline-simulation coverage with a child repo.
2. **The `code` noun and the baseline** — the four verbs, `baselineSignal` across repos, `commands.md`; engine coverage.
3. **The prose and the agents** — every site above, the investigation note, `docs/`, the pipeline simulation's reads, the prose snapshots the engine change moves.

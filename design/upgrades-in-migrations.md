# Upgrades live in migrations

An install is brought from an older version's shape to the current one by
its migrations, and by nothing else. Migrations run at every start, each
once, in number order, whatever version the install comes from. They are
frozen once released and fixed forward, so a project last updated at
migration 10 reaches today's shape in one start. Runtime code that
recognises what an older version left behind is the opposite: nobody can
know when the last install that needs it has updated, so it can never be
deleted. This programme moves every such upgrade into a migration, makes
the commit that lands migrations carry everything they change, and writes
the rule down. Opened 2026-09-28.

## Motivation

### How it was found

Step 2 of the knowledge-base programme retired `store.msp` for `store.bin`.
The retirement was written as runtime code, not as a migration:
- the KB deletes `store.msp` the first time it writes `store.bin`;
- boot renames the `store.msp` line in `.worktreeinclude`.

It went in that way because the knowledge folder belongs to each copy of
a project, while the migration ledger is committed. Step 4 of that
programme moves the KB into the engine, and would have to carry that code
into the engine or delete it. Deleting it strands any install that skips
v0.8.2, and carrying it keeps code that can never go.

### What an audit found

Runtime code in the engine and the KB, read for anything that handles a
shape an older version left behind:

- **Committed project data with no migration behind it.**
  - Epics without discovery-map rows: migration 038 gave the map to
    in-progress epics alone. The engine keeps fallbacks for topics
    missing from the map, among them the per-item reading of "cancelled"
    and "postponed" from before the map carried its markers.
  - Experiment series closed by the old per-series cancel
    (`status: cancelled` on the series item).
  - Planning items without `storage_paths`, from before v0.6.6.
    `commit --plan` refuses with a manual fix, and the prose carries the
    same backfill.
  - The knowledge folder still tracked in git. Boot untracks it at every
    start.
- **Fallbacks an existing migration already made redundant.**
  - The project manifest without a work-unit registry (migration 031).
  - A specification's `sources` in its old list form.
  - Two comments naming shapes migration 058 retired.
- **Checkout-local caches** (agent review files from before the state
  store, review rows from before arming, old heartbeat files). A
  committed ledger cannot reach every copy of a project.
- **Judgment calls**: the legacy research-split skill (a conversion of
  migration 038's data that needs the user), a fallback for bugfix
  specifications that do not name their investigation, and a check for
  a migration runner older than the engine it ships with.
- **Acceptable as it is**:
  - the store's own format and tokenizer handling, since the store is a
    regenerable cache;
  - the migration runner reading its own old ledger formats;
  - boot committing a ledger an earlier boot left dirty.

### What the migration commit misses

After the migration gate, `/workflow-start` commits `.workflows/` alone.
Boot separately commits `.claude/settings.json` and the root `.gitignore`
itself, before the gate and unreviewed, taking the whole of each file
along with any of the user's own edits in them. A deleted root
`.gitignore` (migration 049) is never committed, and a future migration
writing `.worktreeinclude` would leave it dirty: boot's own sync of that
file commits only a change it made itself.

## Standing rulings

- **Upgrades live in migrations, never in code.** Converting, renaming,
  deleting or tolerating a shape an older version left behind is a
  migration. Code may keep the current version's own requirements in
  place (boot ensuring the hooks and lines the current version needs),
  but it never names or recognises what an earlier version did.
- **A released migration is never touched.** Not edited, not deleted.
  Every correction is a new migration.
- **The workflows own a short, declared list of paths:**
  - `.workflows/`, with its git-ignored parts left to git;
  - `.claude/settings.json`;
  - `.worktreeinclude`;
  - the root `.gitignore`.

  The list is held once, in the engine. Anything new a migration or the
  engine writes joins the list in the same change.
- **The migration commit covers the list.** After the user's yes at the
  migration gate, it stages every path on the list: edits, new files and
  deletions. The user's own uncommitted edits in a listed file ride along
  with it. A user who leaves the gate unanswered keeps the migrated files
  in the working tree to commit themselves; discarding them discards the
  ledger with them, so the migrations run again.
- **A migration may stage in git, and never commits.** A change to what
  git tracks (`git rm --cached`) is staged by the migration and recorded
  by the migration commit.
- **Old migrations are left as they are.** What they wrote outside the
  list, such as migration 011's move out of `docs/workflow/`, stays the
  user's to commit. No code names an old layout to catch it.

## The order

1. **The foundation — merged (#1424).** The rule written down, the
   migration commit, and the two upgrades the knowledge base's next step
   depends on, in one PR.
2. **Step 4 of the knowledge-base programme**
   (`design/knowledge-base-programme.md`). It moves the KB into the
   engine, on the foundation.
3. **The rest of the audit.** Each finding becomes a migration, then its
   runtime code is deleted.

Each step ships as its own stack and release.

## Step 1 — the foundation

### The rule

`CLAUDE.md`'s Migrations section gains the standing rulings above:
- upgrades live in migrations;
- the owned-path list, and that it grows in the same change as anything
  new the workflows write;
- a migration may stage and never commits.

### The migration commit

- **`engine commit --migrations -m <message>`** stages and commits the
  owned-path list: edits, new files and deletions, confined to those
  paths. It commits the paths as the index records them, from a scratch
  index holding HEAD, so a removal a migration staged lands (a pathspec
  commit would read the file back from disk), and anything else staged
  stays staged and out. It works in a project nested in a larger
  repository, refuses rather than build on an empty tree when a git read
  fails, and skips a path git refuses to stage. `commit --workflows`
  stays as it is, the whole `.workflows/` tree for its other callers.
- **workflow-start's migration step reviews and commits with it** after
  the gate, its review reading the four owned paths. The migration
  ledger rides in with the rest, as it does today.
- **Boot's own commit of `.claude/settings.json` and `.gitignore` after a
  migration run is deleted.** Boot's other commits stay as they are — the
  ledger when no document changed, the session hooks and the
  function-hooks flag, `.worktreeinclude`'s knowledge lines — and one of
  them may carry a migration's edit to the same file.

### Migration 063 — the retired store file

- Deletes `.workflows/.knowledge/store.msp` where it exists.
- In `.worktreeinclude`, renames a `.workflows/.knowledge/store.msp` line
  to the current store file, or drops it where that file is already
  listed. Every other line stays.
- Idempotent: an install already on v0.8.2 has neither, and the
  migration records itself having done nothing.

Deleted with it:
- the KB's deletion of `store.msp` (`legacyStorePath`);
- boot's `retireStoreLine`;
- their tests and their doc lines.

The file belongs to one copy of the project, so a second clone that sees
063 already recorded keeps its own `store.msp`. It is dead and harmless.

### Migration 064 — the knowledge folder untracked

- Where the project is a git repository and git tracks anything under
  `.workflows/.knowledge/`, it stages the removal
  (`git rm -r --cached -f`). The files stay on disk; the force covers a
  store whose staged content differs from both HEAD and the disk.
- The migration commit records the removal. Migration 060's ignore rule
  keeps the files from being staged again.
- Idempotent: nothing tracked, nothing staged.

Deleted with it:
- boot's `untrackStore`;
- the untracking commit it uses (`commitUntrackScoped`);
- their tests;
- the boot and knowledge-base docs describing boot untracking the folder.

Staging is safe during a merge or rebase, so the migration needs no guard
of its own; the commit lands at the gate as every migration commit does.

## Step 3 — the rest of the audit

Designed in full when it is reached. Known now:
- **New migrations for committed data:**
  - a discovery map for every epic, and the map's cancelled and
    postponed markers for topics that carry them per item;
  - a per-series experiment cancel recorded the current way;
  - `storage_paths` on every plan, from each output format's declared
    pathspecs as they stand when the migration is written.

  Each runtime fallback and the prose backfill go with its migration.
- **The fallbacks existing migrations already cover** are deleted, once
  a read of the corpus of shapes confirms none survives: the work-unit
  registry fallback, and the old `sources` list form.

Open:
- The checkout-local caches: accept losing old cache files and delete the
  tolerance, or keep it.
- The legacy research split: a conversion that needs the user's
  judgment, and so cannot be a mechanical migration.
- The bugfix-investigation fallback in the staleness hop: first confirm
  whether every current bugfix specification names its investigation.

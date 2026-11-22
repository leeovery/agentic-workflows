'use strict';

//
// Migration 078: The reshape's move — the project into the layout in `.ledger/`
//
// Step 3 of the reshape's sequence (21.2, 21.5): the project's state leaves
// `.workflows/` for the state worktree, `.ledger/`, in the repository's main
// checkout, on its own branch, `ledger-state`. Written against today's
// shape: the shape the chain up to 072 leaves.
//
// What it reads: `.workflows/` in the project's folder — the runner's,
// nested in its repository or at the top — as the main checkout holds it,
// the copy `.workflows/` leaves the default branch from (21.5.11). A
// rebase, merge, cherry-pick, revert or bisect stopped in the main checkout
// aborts the run, unrecorded and with nothing written, until it is finished
// or aborted, as boot waits these out: the files it would read may hold the
// operation's conflicts.
//
// Where it writes: the state worktree on an unborn `ledger-state`, which
// the guard (074) put in place, found there or put in place again as the
// guard does it (reshape/shared.cjs, `placeStateWorktree`); every git call
// here runs with hooks off and the caller's repository environment cleared. A
// `.ledger/` already on `ledger-state` is written again: a move cut short is
// run again from the start, each file it reads back — the project manifest,
// an idea it sent to the inbox, the project's own files below — written
// whole or not at all.
//
// The project's own files, in its folder in the main checkout, are taken to
// the new names for the migration's commit (21.5.19, 21.9.2): `.gitignore`,
// where boot keeps the line, gains `.ledger/` at once — an unignored
// worktree with no commit checked out refuses `git add -A`; in
// `.claude/settings.json`, each hook naming the engine at
// `.claude/skills/workflow-engine/` names it at `.claude/skills/ledger-
// engine/`, and each permission rule naming `.workflows/` names `.ledger/`,
// every other key as it was; and `.worktreeinclude` loses the lines naming
// `.workflows/`, the file going where it holds nothing else. Nothing is
// staged or committed (21.9.3): the migration's commit, made at finish,
// takes these files as they stand and the whole state, so the person's
// index, and any commit of their own before it, carries none of the
// migration's changes. `.workflows/` and the tracker's store stay where
// they are, read as they stand, and are never changed; finish has the
// migration's commit drop them from the default branch.
//
// The project: its manifest is carried, with the project's id minted on it
// (21.5.20) — kept where a move cut short already minted one — and the
// checklists a directive closed before the move (the split's, 076) kept on
// it, less the baseline's status fields, a recorded `native`, `skipped` or
// `completed` kept as `brownfield_offer`, the brownfield offer's remembered
// answer, in today's words — the offer is made once per project, and a
// completed assessment was offered it — and one still under way kept as
// nothing, so the offer is made again (21.11.1, 21.11.2, 8.12.11); where
// none is kept, `arrived`, when the old state first entered the project's
// history — the author time of the first commit adding a file under
// `.workflows/`, or `docs/workflow/`, its name before 011 — so the offer's
// judgment reads the history before then, not the migration's own commit,
// and none where it never entered git (8.12.10); the
// defaults first use no longer asks for go, the plan's format and the
// project skills (22.3.1, 22.3.2), and no driver's setting is written, so a
// migrated project's drivers are the defaults, resolved at first need
// (22.4.3, 7.1.11); each roadmap item's sources follow their files, once
// each, the roadmap's `imports` index is dropped — its files are the
// product's assets, which nothing indexes — and its open session is marked
// as the product's conversation's (`product_session`); a registry
// entry naming no unit — `.workflows/` holding no folder of its name with a
// manifest — is dropped, the verification addendum naming it; and a
// registry entry typed otherwise than its unit's manifest types it — a
// change of type rewrites the manifest alone — takes the manifest's type,
// each so corrected journaled in the state's cache, `.cache/migrate/
// move.json`, `{corrections: [{unit, was, found, changed}]}`, which the
// migration's review lists among its corrections. The inbox and the
// checkout's knowledge config are carried as they are, but for an inbox file
// whose name is no item's (`{ideas,bugs,quickfixes}/{YYYY-MM-DD}--{slug}.md`,
// archived or not), kept as legacy (below); the knowledge store is not, and
// the next boot builds it from the config, with no setup question (21.9.6).
// The old `.state/` holds the old engine's record, `migrations`, rebuilt,
// and the environment setup file, whose words are a note among the steps
// that prepare the project's environment, unconfirmed, for the first ready
// to build to draw on the setup's screen (reshape/old-system.cjs), the file
// kept nowhere; any other file there is kept as legacy. `.roadmap/` is
// `.product/` (21.5.7): its sessions as they are but for their headings,
// demoted as a log's documents are, each note out of its kind's folder under
// its inbox name, and `imports/` as `assets/`, the documents' links to an
// import rewritten as a unit's are, and an import a session names in words
// from the product's folder, `imports/{name}`, named `assets/{name}`.
// `.baseline/`'s docs are reference in `.product/assets/baseline/`, names
// kept, and so is each interview agenda in `.baseline/.state/`, beside them:
// it holds the person's answers, which an area under way has woven into no
// doc yet. Only the status fields go (21.11.1); the research dossiers there
// are kept as legacy.
//
// The tracker's store (21.5.18): the move names no tracker, and loads no
// driver, whose code changes with the engine's. Each task driver's folder
// declares, once and for good, where a project from before Ledger keeps its
// store (reshape/shared.cjs, `preLedgerStores`); each declared store found
// in the project folder is carried into the state as it is, the files its
// tool keeps local ignored in the state's own `.gitignore`, written
// otherwise as the engine writes it (7.5.4). A task driver's folder whose
// declaration is missing or does not read, and whose tracker a plan of the
// project used — an old planning item's format names the folder — is named
// in the notice the move hands back, its store left where it is; one no
// plan used left nothing behind, and is named nowhere.
//
// The user-level folder (21.5.19, P7): its settings and credentials are
// copied into the engine's (reshape/user-files.cjs), the old folder left
// exactly as it was. The old cache, the knowledge store and the old
// migrations record are left where they are (21.5.10).
//
// Each unit, a folder under `.workflows/` holding a manifest:
//   - every old document a log takes — a topic's, a discovery session's, the
//     product's — keeps its words, each of its headings outside a fenced
//     block one level deeper, a sixth-level one as it is, so none of them is
//     read as a heading of the log, a fixed list's among them
//     (log-lists.cjs);
//   - a topic's log, `topics/{topic}/log.md`, is its research, its discussion
//     and its investigation, each under a heading of its own, its words
//     kept and its headings demoted, in that order (21.5.2, 21.5.3). A
//     topic is a name the unit's map, discussions or investigations hold,
//     or, for a feature, bugfix or cross-cutting unit, the unit's own name;
//     research under any other name in a feature or a bugfix fed its one
//     topic, and joins that topic's log under `Research: {name}`; in any
//     other unit it fed the topics it was split into or spawned, and goes
//     to a discovery session of its own, numbered after
//     the unit's last and headed as the migration's, until the cut and the
//     merges place it (21.5.4) — but for a legacy split's copy of the
//     research it superseded, `{source}-superseded-{at}.md`, its research
//     item `superseded` (077), which is reference, in `assets/research/`,
//     its name kept: the split's topics hold what it held. A topic promoted to a
//     cross-cutting unit took only its discussion there, so its research
//     joins that unit's log for it, ahead of the discussion;
//   - each review the old agent store holds of a topic — in
//     `.workflows/.cache/{unit}/{phase}/{topic}/`, a promoted topic's in the
//     unit it came from too — that landed and was never folded in, its
//     report not in the log already, is appended to the topic's log, the
//     report demoted under `## Review {id}, never folded in` (21.5.12); a
//     report the store holds no row for, a legacy `review-*.md`, is not;
//   - its mail, from every box it had, is one sequence in `topics/{topic}/
//     mail/`, renumbered where it had more than one box (21.5.5); the mail of
//     a cancelled topic, or of a name no topic holds, goes to the inbox
//     instead, each message an idea, its first line the title (21.5.6,
//     10.1.6); either way a message's line naming its sender, today's
//     `*From: {origin} · {phase} · {date}*` under its title or under a
//     blank line after it, becomes the line the waiting mail heads it with,
//     its second, `From {sender} · {16 Oct}` (10.4.2): the sender the topic
//     it surfaced in, which every send of today's names within its unit,
//     titled, and no phase;
//   - its brief is `topics/{topic}/brief.md`, and its experiment records sit
//     in `topics/{topic}/experiments/` as they stood (21.5.13), but for a
//     record's files other than its problem, design, report and `data/` —
//     its instruments — which go under its `data/`, at their path from the
//     record's folder (4.11.15), a sub-experiment's the same;
//   - a topic on the map that no brief came to has its map row's
//     description written as its brief, under its name titled, whatever
//     its items after it — never started, a discussion a message opened
//     and no one began, research cancelled before a line of it — so what
//     discovery knew of it reaches the records and its next opening;
//   - nothing lands in a topic's folder no topic owns: a brief, experiment
//     records, a discussion or an investigation under any other name is kept
//     as legacy, and the experiments' manifest items go;
//   - discovery's sessions are `discovery/session-NNN.md`, numbers kept,
//     their headings demoted;
//   - `imports/` is `assets/`, and every moved document's links to a file
//     there (`../imports/{name}`, the name one `imports/` holds) are
//     rewritten to the asset's place from the document's own; each
//     `imports[]` entry's path follows its file (21.5.7);
//   - every file the old system's own agents and trackers wrote in a
//     topic's folder of the old plan's phases — the plan, its phases' and
//     tasks' files and its reviews' tracking, the spec reviews' tracking,
//     the build's tracking, analysis, staging, consolidation and fix
//     tracking, and the review's reports and change-set checks, each
//     matched by its whole path below the folder as they write it, never by
//     a fragment a topic's or a section's slug can hold
//     (reshape/old-system.cjs) — is copied, as
//     the old cache's reports are, byte for byte into the unit's `earlier/`
//     in the state's ignored cache, at its path below the unit's old
//     folder, never committed and never legacy, the migration's cut reading
//     a building unit's plans there (080); any other file of those folders
//     but a spec is kept as legacy;
//   - a spec goes to
//     `assets/specs/{topic}.md` where the unit's building has not started —
//     an implementation item in progress or completed; where it has, every
//     spec past its gate — its item completed, or in progress where its topic
//     has a planning or implementation item, reopened during the build to
//     correct it — is joined into `spec.md`,
//     read from the working tree (21.8.5, E5): each
//     one area, `## N. {title}`, in build order, by the old order and then,
//     for a spec with none, in the order its manifest lists them, each after
//     the specs its plan depends on, as the cut orders the plans; its title
//     its first line's after `Specification:`, or its topic's name where it
//     opens with no title; its words kept but for each heading outside a
//     fenced block, as the spec's reader reads one — opened by a line
//     holding, at any indent, three backticks or tildes at least, and closed
//     by one holding as many of that mark at least and nothing else
//     (spec-sections.cjs, `fences`) — demoted below the parts' level, all
//     by the one step its shallowest needs to reach level 4, so they keep
//     their nesting, none deeper than 6, a fenced block it leaves open
//     closed by its own mark, so the next area reads, and its
//     links to the imports pointed from `spec.md`; the spec titled with the
//     unit's name, and its manifest naming the topics joined, area by area,
//     `spec: {joined: [topic, …]}`, which every reader of it reads
//     (spec-sections.cjs), an old task's citation of its topic's spec read
//     through its area (brief-records.cjs) — the
//     migration's cut adds its scenarios (cut-migrating.cjs) — and the
//     unit's other specs going to `assets/specs/`, one not past its gate,
//     its item in progress or proposed, among them, its item going so its
//     topics are decided topics in no spec, which leave the unit (21.8.9);
//     a quick-fix's spec goes to `assets/specs/` whatever its building, and
//     once the quick-fix is completed — its status says so, or every phase
//     of its old pipeline, scoping, implementation and review, completed,
//     whatever its status reads — its spec is its `summary.md`, its spec,
//     plan, implementation and review items going (21.5.15, 21.5.16),
//     its status completed but where it was cancelled (21.5.14);
//   - the unit's `.state/` goes whole, holding the old engine's analysis
//     caches only (21.5.17); seeds stay as they are;
//   - the files the person's tools leave beside theirs (`.DS_Store` and the
//     rest of the engine's list) are neither carried nor named;
//   - a cancelled unit moves as any other (21.5.14).
//
// A unit whose name breaks the kebab-case rule by its case alone, as one
// of portal's quick-fixes did before the engine refused such a name, is
// carried under its lowercase name, the one every verb takes: each file the
// move wrote at its renamed path — the unit's folder, a topic's folder, a
// file named for it — and its name in the words of each document and
// manifest the move wrote following it, the registry's entry, a cite, a
// seed, a roadmap item's source and origin, an inbox idea and a mail's
// origin among them; a legacy file keeps its words byte for byte, and the
// tracker's store is carried as it is. The verification addendum names the
// rename. A name breaking the rule otherwise is carried as it stands.
//
// The unit's manifest is today's shape, less research and the retired state
// (21.5.8): the research phase goes, a topic whose research joined its log
// and that has no discussion yet taking a discussion item of the research's
// standing, and its discussion taking the research's wait on its
// experiments; scoping goes; and so do the map's routing, brief path (a
// topic's brief has one place) and brief-incorporated mark, a discussion's
// subtopics, staging, the spec's build order (a cancelled spec's stashed
// one too), its review cycles and baseline and its gate modes, the plan's
// review tracking and
// dependencies, the caches of the discovery gap analysis and the
// discussion analysis, whose files go with them (21.5.17), and the topic
// names the discussion's gap analysis left (`gap_topics`, which 038 left
// behind), and every item's reconcile flag, whatever
// it holds. The dead end goes too (21.5.22): a topic marked
// `handled` whose work had concluded — its discussion decided, or, with no
// discussion of its own, its research done, as 043's umbrellas were — keeps
// its conclusion, its discussion decided and its record carried by 079 as
// any decided topic's; any other is cancelled, as the cancel leaves one, no
// decision written, its mail going to the inbox with a cancelled topic's.
// A unit whose building has not started keeps no spec or planning items:
// its specs are reference assets now, and its one spec is written
// fresh once its topics are decided (21.8.2, 21.8.3); a unit completed or
// cancelled keeps no spec, planning, implementation or review items either,
// history that waits on no cut (21.8.11), nor does a completed quick-fix,
// whose standing today's engine reads off its own record (derivations.cjs,
// `fixesStatus`); a unit whose building started keeps them
// for the cut and the merges, but the item of a spec still being written,
// and a quick-fix's scoping keeps its own. An epic's topics are on its map — one that was not in
// progress when 038 seeded the maps gains them from its discussions — each
// holding its place in the order: a topic with no order, as 038 left every
// one, takes the next after the highest the map uses, in the order its old
// record lists them. An epic with topics is past its map, its approval
// recorded (`phases.discovery.approved_at`) at the earliest moment
// its old record shows: the unit's creation, the old manifest stamping
// neither its discovery's close nor a discussion's start.
// Everything else carries as it stood, the fields 21.5.9 names among them.
// Each later reshape of a manifest updates this move until it is released
// (E4): the linters' carry onto the project's environment, written for
// `.ledger/` (reshape/linters.cjs), runs over what this move wrote, and
// what it left out is named in the verification addendum.
//
// Nothing that may hold knowledge is lost: the move drops only what is
// rebuilt — the old cache's session state, data and scratch, the knowledge
// store, the old engine's record and a unit's `.state/` — and the tools'
// sidecars. Every other file it has no place for is kept, byte for byte, as
// legacy: a unit's under its `assets/legacy/`, its path from the unit's old
// folder kept, and one of no unit's — a folder under `.workflows/` holding
// no manifest, an entry the move does not read, a roadmap, baseline or inbox
// file of no place — under `.product/assets/legacy/`, its path from
// `.workflows/` kept. The verification addendum names each place holding
// any, with how many, never each file, and a roadmap source naming one
// follows it; the addendum names each experiment instrument moved under its
// record's `data/`, which a roadmap source follows too. The old cache's
// documents, its agents' reports, which nothing rebuilds, are copied byte
// for byte into the state's ignored cache, never committed and never
// legacy: a unit's into `.cache/{unit}/earlier/` at its path below the
// unit's folder in the old cache, each unit's name in it as it is carried, where
// the unit's ending purges them as it purges the rest of its cache; any
// other into `.cache/earlier/` at its path below the old cache. The files
// the old system wrote in a unit's own folder join them in the unit's
// `earlier/`, at their paths below that folder.
//
// Every moved document's links and embeds, resolved from where the document
// was, follow what they name — a file the move places or keeps, a folder
// whose files all go to one folder, a document folded into a log at the
// heading it sits under there, a spec joined into `spec.md` at its area's,
// unless the link names its own anchor — and point at its place from where
// the document now sits. Mail sent to the inbox is not followed.
//
// A project with no `.workflows/`, or in no repository, has nothing to move,
// and a state branch with a commit already is never written over.
//
// Known edges, not built:
//   - a second clone holding `origin/ledger-state` but no local branch is
//     moved into a state of its own (only the local branch is read);
//   - a research item and its topic's discussion both waiting on
//     experiments keep only the discussion's wait;
//   - a branch's `.workflows/` work not on the main checkout is not moved;
//   - two Ledger projects nested in one repository share the one state; while
//     the branch is unborn, the second move overwrites the first's registry;
//   - the same message sent to two cancelled topics becomes one inbox idea;
//   - a bare repository, with no main checkout to hold the state, is skipped;
//   - a symlinked folder under `.workflows/` aborts the run, unrecorded;
//   - research left unstarted with mail under a discussion already decided
//     folds into a decided topic holding mail, as reopened research does;
//   - the tracker's store is read from the project folder, never from a
//     folder above it a walk up would find;
//   - two notes of one name under different kinds keep the first, the second
//     kept as legacy;
//   - a roadmap source naming a file the move dropped keeps its old path;
//   - a dead-ended topic the move cancels keeps any experiment still running
//     on it, and the wait its discussion holds on one;
//   - a unit renamed to its lowercase name where another unit holds that
//     name already is moved onto it — a folder a case-insensitive disk, as
//     a Mac's is, never holds beside the other;
//   - a file the old system wrote in a unit's folder and a report of the
//     old cache at the same path below the unit's folder there are one
//     file in its `earlier/`, the cache's report.
//

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { carryLinters } = require('./reshape/linters.cjs');
const { copyUserFiles } = require('./reshape/user-files.cjs');
const { OLD_PLAN_PHASES, oldSystemFile, ENVIRONMENT_SETUP, withSetupNote } = require('./reshape/old-system.cjs');
const {
  OLD_STATE: CODE_TREE_STATE, STATE_DIR, STATE_GITIGNORE, SIDECAR_NAME, git, mainCheckout, projectInMain, stateBorn, placeStateWorktree, writeWhole, preLedgerStores, unreadStores,
} = require('./reshape/shared.cjs');

const CODE_GITIGNORE = '.gitignore';
const STATE_IGNORE_LINE = `${STATE_DIR}/`;
const SETTINGS = '.claude/settings.json';
const WORKTREE_INCLUDE = '.worktreeinclude';
const WORKFLOWS_LINE = /^\/?\.workflows(?:\/|$)/;
const OLD_ENGINE = '.claude/skills/workflow-engine/scripts/engine.cjs';
const NEW_ENGINE = '.claude/skills/ledger-engine/scripts/engine.cjs';
const PERMISSION_LISTS = ['allow', 'deny', 'ask'];
const OLD_RULE_PATH = `${CODE_TREE_STATE}/`;
const NEW_RULE_PATH = `${STATE_DIR}/`;

// The project's files carried into the state as they are: the checkout's
// knowledge config, from which the next boot builds the store the move never
// carries (21.9.6).
const CARRIED_AS_IS = ['.knowledge/config.json'];

const ROADMAP = '.roadmap';
const PRODUCT = '.product';
const BASELINE = '.baseline';
const BASELINE_AGENDA = /^\.state\/(agenda-[^/]+\.md)$/;
const ROADMAP_SESSION = /^sessions\/session-[0-9]{3,}\.md$/;
const ROADMAP_NOTE = /^notes\/(?:ideas|bugs|quickfixes)\/([0-9]{4}-[0-9]{2}-[0-9]{2}--[a-z0-9]+(?:-[a-z0-9]+)*\.md)$/;
// The baseline's answers the brownfield offer remembers (21.11.2).
const BROWNFIELD_ANSWERS = ['native', 'skipped', 'completed'];
// The old state's folder, under each name it had (011 renamed it).
const OLD_STATE_NAMES = [CODE_TREE_STATE, 'docs/workflow'];
// The project's defaults first use no longer asks for (22.3.1, 22.3.2).
const RETIRED_DEFAULTS = ['plan_format', 'project_skills'];
// The session-label opt-in, under the name it keeps now that tmux is not
// the only multiplexer labelling a session.
const RENAMED_DEFAULTS = [['tmux_labels', 'session_labels']];

// The marker each stopped operation leaves in the git directory, as the engine reads them.
const OPERATION_MARKERS = [
  ['MERGE_HEAD', 'a merge'], ['CHERRY_PICK_HEAD', 'a cherry-pick'], ['REVERT_HEAD', 'a revert'],
  ['rebase-merge', 'a rebase'], ['rebase-apply', 'a rebase'], ['BISECT_START', 'a bisect'],
];

const SINGLE_TOPIC_TYPES = ['feature', 'bugfix', 'cross-cutting'];
// The types whose one topic is the unit, so all their research fed it: a
// cross-cutting unit also holds the topics promoted to it.
const ONE_TOPIC_TYPES = ['feature', 'bugfix'];
const LOG_PHASES = ['research', 'discussion', 'investigation'];
const LOG_HEADINGS = { research: 'Research', discussion: 'Discussion', investigation: 'Investigation' };
const STAGING = ['staging', 'analysis_staging'];
// What no item of any phase keeps.
const RETIRED_ON_EVERY_ITEM = ['reconcile_needed'];
const RETIRED_PHASES = ['research', 'scoping'];
const RETIRED_PHASE_FIELDS = {
  discovery: ['gap_analysis_cache'],
  discussion: ['analysis_cache', 'gap_topics'],
  specification: ['build_order_stale'],
};
const RETIRED_ITEM_FIELDS = {
  discovery: ['routing', 'brief_path', 'brief_incorporated'],
  discussion: ['subtopics'],
  specification: ['order', 'previous_order', 'review_cycle', 'review_baseline_words', 'tracking', 'construction_gate_mode', 'finding_gate_mode'],
  planning: ['review_cycle', 'review_baseline_words', 'approvals', 'tracking', 'external_dependencies'],
};
const RESEARCH_STANDING = { unstarted: 'unstarted', cancelled: 'cancelled', postponed: 'postponed' };
// A research item's wait on its experiments, carried to its topic's discussion.
const RESEARCH_WAITS = ['awaiting_experiments'];

// The phases past the topics', the old plan's and its review's, which a unit
// that is history, or a completed quick-fix, keeps no items of.
const PAST_THE_TOPICS = ['specification', 'planning', 'implementation', 'review'];
// A quick-fix's pipeline as today's engine runs it.
const QUICK_FIX_PIPELINE = ['scoping', 'implementation', 'review'];

// Folders carried whole under a name of the layout's, their files as they are.
const CARRIED = { imports: 'assets', seeds: 'seeds' };
const DROP = Symbol('drop');
// A building unit's specs, joined (21.8.5).
const JOINED_SPEC = 'spec.md';
// A spec past its gate.
const CONCLUDED_SPEC = 'completed';
// A spec still being written: past its gate where the old product reopened
// it during the build, its topic planned or built.
const WRITTEN_SPEC = 'in-progress';
// The specs not past their gate whose items a building unit drops: one still
// being written, and one grouped and never begun.
const UNCONCLUDED_SPECS = [WRITTEN_SPEC, 'proposed'];
// The old phases whose item for a topic says its spec was past its gate.
const PLANNED = ['planning', 'implementation'];
const SPEC_TITLE = /^# (?:Specification: )?(.*\S)\s*$/;
// A heading as the spec's reader reads one, at the line's start; a fence's
// mark, at any indent, which closes the fence it opens on a line of as many
// at least and nothing else.
const SPEC_HEADING = /^(#{1,6})(?= |$)/;
const SPEC_FENCE = /^[ \t]*(`{3,}|~{3,})/;
// The shallowest heading a joined spec's area holds as its text, below the
// parts' level (spec-sections.cjs).
const AREA_TEXT_LEVEL = 4;
// Where a file the layout has no other place for is kept, byte for byte, its
// path from its old folder kept: under its unit, or under the product.
const LEGACY = 'assets/legacy';
// The old cache; the state's ignored cache; and the folder in a unit's
// cache, or in the cache itself, the old cache's documents are copied into.
const OLD_CACHE = '.cache';
const CACHE = '.cache';
const EARLIER = 'earlier';
// The old engine's record, which the new one rebuilds.
const OLD_RECORD = '.state/migrations';
// The entries of `.workflows/` the move reads, or which hold only what is
// rebuilt — the cache, the knowledge store, the engine's own ignore file —
// beside the units; any other is kept as legacy.
const READ_OR_REBUILT = ['.cache', '.state', '.knowledge', '.gitignore', '.inbox', '.roadmap', '.baseline', 'manifest.json'];
// A building unit's spec joined into its `spec.md`, the place a link to it follows.
const JOINED = Symbol('joined');
// A legacy split's copy of the research it superseded (077), by its research
// item's status, and where it is kept as reference.
const SUPERSEDED = 'superseded';
const SUPERSEDED_PLACE = 'assets/research';
// The migration's journal of the corrections the move made, which the
// migration's review lists (directives.cjs).
const CORRECTIONS_JOURNAL = path.join(CACHE, 'migrate', 'move.json');

const IMPORT_LINK = /(?:\.\.\/)+imports\/([A-Za-z0-9._-]+)/g;
// An import as the roadmap's session template named one in words, from the
// roadmap's folder: never a link's target, which resolves from the session's.
const SESSION_IMPORT = /(?<![\w./-]|\]\()imports\/([A-Za-z0-9._-]+)/g;
// An experiment record's folder, a sub-experiment's within it, and the files
// a record holds beside its data (4.11.15).
const EXPERIMENT_RECORD = /^E[1-9][0-9]*-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXPERIMENT_SUB_RECORD = /^E[1-9][0-9]*\.[1-9][0-9]*-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXPERIMENT_FILES = ['problem.md', 'design.md', 'report.md'];
const MAILBOX_MESSAGE = /^(research|discussion|investigation)\/\.mailbox\/([^/]+)\/([^/]+\.md)$/;
const SESSION = /^discovery\/sessions\/(session-([0-9]{3,})\.md)$/;
const INBOX_ITEM = /^(?:\.archived\/)?(?:ideas|bugs|quickfixes)\/[0-9]{4}-[0-9]{2}-[0-9]{2}--[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
// A file the old system wrote, copied into its unit's cache.
const OLD_SYSTEMS = Symbol('the old system\'s');

const ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 21;

/** @param {unknown} v @returns {v is Record<string, any>} */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** @param {unknown} data */
function jsonText(data) {
  return JSON.stringify(data, null, 2) + '\n';
}

/** A project id, as the engine mints one: 21 of the 62 letters and digits, drawn without bias. */
function newId() {
  const below = 256 - (256 % ID_ALPHABET.length);
  let id = '';
  while (id.length < ID_LENGTH) {
    for (const byte of crypto.randomBytes(ID_LENGTH * 2)) {
      if (byte >= below) continue;
      id += ID_ALPHABET[byte % ID_ALPHABET.length];
      if (id.length === ID_LENGTH) break;
    }
  }
  return id;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * The operation git has stopped in the middle of at `cwd`, or null: the
 * markers boot waits out before it stages a file there.
 * @param {string} cwd @returns {string|null}
 */
function stoppedOperation(cwd) {
  const res = git(cwd, ['rev-parse', ...OPERATION_MARKERS.flatMap(([marker]) => ['--git-path', marker])]);
  const paths = res.stdout.trim().split('\n');
  const open = OPERATION_MARKERS.find((_, i) => res.ok && fs.existsSync(path.resolve(cwd, paths[i])));
  return open === undefined ? null : `${open[1]} (${open[0]})`;
}

/** Every file under `dir`, the tools' sidecars aside, as posix paths relative to it. @param {string} dir @param {string} [at] @returns {string[]} */
function filesUnder(dir, at = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(path.join(dir, at), { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => {
      const rel = at === '' ? entry.name : `${at}/${entry.name}`;
      if (entry.isDirectory()) return filesUnder(dir, rel);
      return SIDECAR_NAME.test(entry.name) ? [] : [rel];
    });
}

/** @param {string} file @param {string|Buffer} content @param {number} [mode] */
function writeFile(file, content, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  if (mode !== undefined) fs.chmodSync(file, mode);
}

/** The state's ignored cache, where a file a move run again reads back is written before it is renamed into place. @param {string} state */
const scratchOf = (state) => path.join(state, CACHE);

/** @param {string} file */
const modeOf = (file) => fs.statSync(file).mode & 0o7777;

/** @param {string} file @returns {any} */
function readManifest(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`the move cannot read ${file} — fix it, then run again: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * A document's links to its unit's imports, each naming a file `imported`
 * holds, pointed at the assets from the place it now sits, state-relative;
 * a link to any other name is left as written.
 * @param {string} text @param {string} at @param {string} unit @param {Set<string>} imported
 */
function relinked(text, at, unit, imported) {
  const hops = path.posix.relative(path.posix.dirname(at), `${unit}/assets`);
  return text.replace(IMPORT_LINK, (link, named) => {
    const name = named.replace(/\.+$/, '');
    return imported.has(name) ? `${hops}/${name}${named.slice(name.length)}` : link;
  });
}

/**
 * A product session's imports named in words from the product's folder,
 * each naming a file `imported` holds, named as the asset it is; any other
 * name, and a link, as written.
 * @param {string} text @param {Set<string>} imported
 */
function sessionImports(text, imported) {
  return text.replace(SESSION_IMPORT, (named, file) => {
    const name = file.replace(/\.+$/, '');
    return imported.has(name) ? `assets/${name}${file.slice(name.length)}` : named;
  });
}

/** A markdown link's or embed's target, up to the space before a title. */
const LINK_TARGET = /\]\(([^)\s]+)/g;

/** A target that is a URL, from the root, or an anchor alone: never a file's link. */
const NO_FILE = /^(?:[a-z][a-z0-9+.-]*:|[/#])/i;

/** @param {string} text */
function decoded(text) {
  try {
    return decodeURI(text);
  } catch {
    return text;
  }
}

/** The anchor a heading is linked by, as markdown's renderers slug it. @param {string} heading */
const anchorOf = (heading) => `#${heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-')}`;

/**
 * A document's links and embeds to a file or folder the move places, each
 * resolved from where the document was, `old`, and pointed at its place from
 * where the document now sits, `at`: its own anchor kept, else the heading
 * its place gives; any other as written.
 * @param {string} text @param {string} old `.workflows/`-relative @param {string} at state-relative @param {Places} places
 */
function placedLinked(text, old, at, places) {
  return text.replace(LINK_TARGET, (link, target) => {
    if (NO_FILE.test(target)) return link;
    const hash = target.indexOf('#');
    const [file, anchor] = hash === -1 ? [target, ''] : [target.slice(0, hash), target.slice(hash)];
    const place = places.get(path.posix.join(path.posix.dirname(old), decoded(file)).replace(/\/$/, ''));
    if (place === undefined) return link;
    const to = path.posix.relative(path.posix.dirname(at), place.to) || '.';
    return `](${encodeURI(to)}${file.endsWith('/') ? '/' : ''}${anchor || place.anchor}`;
  });
}

/**
 * A document's links pointed from `at`: to a file or folder the move places,
 * and to an import of `unit`'s.
 * @param {string} text @param {string} old `.workflows/`-relative @param {string} at state-relative @param {string} unit @param {Set<string>} imported @param {Places} places
 */
function linked(text, old, at, unit, imported, places) {
  return relinked(placedLinked(text, old, at, places), at, unit, imported);
}

/** @param {Record<string, any>} manifest @param {string} phase @returns {Record<string, any>} */
function itemsOf(manifest, phase) {
  const entry = isObject(manifest.phases) ? manifest.phases[phase] : null;
  return isObject(entry) && isObject(entry.items) ? entry.items : {};
}

/** @param {Record<string, any>} manifest @param {string} unit @returns {Set<string>} */
function topicNames(manifest, unit) {
  const names = new Set(['discovery', 'discussion', 'investigation'].flatMap((phase) => Object.keys(itemsOf(manifest, phase))));
  if (SINGLE_TOPIC_TYPES.includes(manifest.work_type)) names.add(unit);
  return names;
}

/** @param {Record<string, any>} manifest */
function buildingStarted(manifest) {
  return Object.values(itemsOf(manifest, 'implementation'))
    .some((item) => isObject(item) && (item.status === 'in-progress' || item.status === 'completed'));
}

/** A topic's standing in discussion, from its research's. @param {unknown} status @returns {string} */
const standingOf = (status) => RESEARCH_STANDING[String(status)] ?? 'in-progress';

/**
 * A discussion item, of its research's standing, for each topic whose
 * research joined its log and that has no discussion yet, and the research's
 * wait on its experiments carried onto its topic's discussion, where the
 * discussion has none of its own.
 * @param {Record<string, any>} manifest @param {Set<string>} topics
 */
function foldResearch(manifest, topics) {
  const discussion = itemsOf(manifest, 'discussion');
  for (const [topic, item] of Object.entries(itemsOf(manifest, 'research'))) {
    if (!topics.has(topic) || !isObject(item)) continue;
    if (!Object.hasOwn(discussion, topic)) {
      discussion[topic] = { status: standingOf(item.status), ...('previous_status' in item ? { previous_status: standingOf(item.previous_status) } : {}) };
    }
    const target = discussion[topic];
    if (!isObject(target)) continue;
    for (const field of RESEARCH_WAITS) if (field in item && !(field in target)) target[field] = item[field];
  }
  if (Object.keys(discussion).length > 0) manifest.phases.discussion = { ...manifest.phases.discussion, items: discussion };
}

/** Each phase's retired fields and its items'. @param {Record<string, any>} phases */
function dropRetired(phases) {
  for (const phase of RETIRED_PHASES) delete phases[phase];
  for (const [phase, entry] of Object.entries(phases)) {
    if (!isObject(entry)) continue;
    for (const field of [...STAGING, ...(RETIRED_PHASE_FIELDS[phase] ?? [])]) delete entry[field];
    const retired = [...STAGING, ...RETIRED_ON_EVERY_ITEM, ...(RETIRED_ITEM_FIELDS[phase] ?? [])];
    for (const item of Object.values(isObject(entry.items) ? entry.items : {})) {
      if (!isObject(item)) continue;
      for (const field of retired) delete item[field];
    }
  }
}

/** The discussion statuses a topic concluded under. */
const CONCLUDED = ['completed', 'promoted'];

/**
 * Whether a topic's work had concluded, as `manifest`, the unit's before the
 * move, says it: its discussion decided, or, with no discussion of its own,
 * its research done.
 * @param {Record<string, any>} manifest @param {string} topic
 */
function concluded(manifest, topic) {
  const discussion = itemsOf(manifest, 'discussion')[topic];
  if (isObject(discussion)) return CONCLUDED.includes(discussion.status);
  return itemsOf(manifest, 'research')[topic]?.status === 'completed';
}

/**
 * Each topic on the reshaped map marked dead-ended (`handled`) unmarked: one
 * whose work had concluded keeps it, its discussion decided; any other not
 * cancelled or postponed already is cancelled, as the cancel leaves a topic
 * — its row marked and its order stashed, its discussion's status stashed.
 * @param {Record<string, any>} manifest the unit's before the move @param {Record<string, any>} reshaped
 */
function settleDeadEnds(manifest, reshaped) {
  const discussion = itemsOf(reshaped, 'discussion');
  for (const [topic, row] of Object.entries(itemsOf(reshaped, 'discovery'))) {
    if (!isObject(row) || row.handled !== true) continue;
    delete row.handled;
    if (row.cancelled === true || row.postponed === true) continue;
    const item = discussion[topic];
    if (concluded(manifest, topic)) {
      if (isObject(item)) item.status = CONCLUDED.includes(item.status) ? item.status : 'completed';
      continue;
    }
    row.cancelled = true;
    if (row.order != null) row.previous_order = row.order;
    delete row.order;
    if (isObject(item) && typeof item.status === 'string' && !['cancelled', 'postponed'].includes(item.status)) {
      item.previous_status = item.status;
      item.status = 'cancelled';
    }
  }
}

/**
 * An epic's topics off its map put on it, and every topic on it holding its
 * place in the order, as approve-map's yes leaves them: a row holding an
 * order or a stashed one keeps it; every other takes the next number after
 * the highest the map uses, in the order of its old record — the map's rows
 * as listed, then the topics its discussions add, as an epic that was not in
 * progress when 038 seeded the maps has discussions and no map, and 038
 * wrote no order. A live row takes the number as its order, a closed one
 * stashes it, as the cancel and the postpone leave one.
 * @param {Record<string, any>} reshaped
 */
function mapTopics(reshaped) {
  const discovery = isObject(reshaped.phases.discovery) ? reshaped.phases.discovery : {};
  const items = isObject(discovery.items) ? discovery.items : {};
  const discussion = itemsOf(reshaped, 'discussion');
  for (const topic of Object.keys(discussion)) {
    if (Object.hasOwn(items, topic)) continue;
    items[topic] = { source: 'migration-seeded', ...(discussion[topic]?.status === 'cancelled' ? { cancelled: true } : {}) };
  }
  if (Object.keys(items).length === 0) return;
  const rows = Object.values(items).filter(isObject);
  let last = Math.max(0, ...rows.flatMap((row) => [row.order, row.previous_order]).filter(Number.isInteger));
  for (const row of rows) {
    if (Number.isInteger(row.order) || Number.isInteger(row.previous_order)) continue;
    last += 1;
    if (row.cancelled === true || row.postponed === true) row.previous_order = last;
    else row.order = last;
  }
  reshaped.phases.discovery = { ...discovery, items };
}

/** @param {Record<string, any>} manifest */
const isQuickFix = (manifest) => manifest.work_type === 'quick-fix';

/** Whether every phase of a quick-fix's old pipeline completed, as today's engine reads a phase. @param {Record<string, any>} manifest */
const pipelineDone = (manifest) => QUICK_FIX_PIPELINE.every((phase) => {
  const items = Object.values(itemsOf(manifest, phase));
  return items.length > 0 && items.every((item) => isObject(item) && item.status === 'completed');
});

/** Whether a quick-fix is moved as a completed one: its status says so, or every phase of its old pipeline does. @param {Record<string, any>} manifest */
const quickFixDone = (manifest) => isQuickFix(manifest) && (manifest.status === 'completed' || pipelineDone(manifest));

/** Whether the unit keeps no spec or planning items: nothing built, and not a quick-fix. @param {Record<string, any>} manifest */
const writtenFresh = (manifest) => !isQuickFix(manifest) && !buildingStarted(manifest);

/** Whether the unit is history, keeping no item past the topics': completed or cancelled, and not a quick-fix (21.8.11). @param {Record<string, any>} manifest */
const history = (manifest) => !isQuickFix(manifest) && ['completed', 'cancelled'].includes(manifest.status);

/** When the unit was made, in full. @param {Record<string, any>} manifest */
const createdAt = ({ created }) => new Date(created).toISOString();

/**
 * The unit's manifest less research and the retired state: the experiments
 * of names no topic holds going with their records' place, the spec and
 * planning items of a unit that writes its spec fresh, and every item past
 * the topics' of a unit that is history or a completed quick-fix, its spec
 * and plan going with their files; an epic's topics on its map,
 * every one in the order, and an epic with topics past its map, approved
 * when it was made; each import's path following its file; and a quick-fix
 * whose old pipeline completed, completed, unless it was cancelled.
 * @param {Record<string, any>} manifest @param {Set<string>} topics
 * @returns {Record<string, any>}
 */
function reshapedManifest(manifest, topics) {
  const out = structuredClone(manifest);
  if (isObject(out.phases)) {
    foldResearch(out, topics);
    settleDeadEnds(manifest, out);
    dropRetired(out.phases);
    const experiments = itemsOf(out, 'experiment');
    for (const name of Object.keys(experiments)) if (!topics.has(name)) delete experiments[name];
    if (writtenFresh(manifest)) for (const phase of ['specification', 'planning']) delete out.phases[phase];
    else if (!isQuickFix(manifest)) dropWrittenSpecs(out);
    if (history(manifest) || quickFixDone(manifest)) for (const phase of PAST_THE_TOPICS) delete out.phases[phase];
    if (out.work_type === 'epic') mapTopics(out);
    if (out.work_type === 'epic' && Object.keys(itemsOf(out, 'discovery')).length > 0) out.phases.discovery.approved_at = createdAt(manifest);
  }
  if (Array.isArray(out.imports)) out.imports = out.imports.map(asAsset);
  if (quickFixDone(manifest) && manifest.status !== 'cancelled') out.status = 'completed';
  return out;
}

/**
 * Whether a building unit's spec item is past its gate (21.8.5): concluded,
 * or still being written where its topic was planned or built — reopened
 * during the build to correct it.
 * @param {Record<string, any>} manifest @param {string} topic @param {unknown} item
 */
function pastGate(manifest, topic, item) {
  if (!isObject(item)) return false;
  return item.status === CONCLUDED_SPEC || (item.status === WRITTEN_SPEC && PLANNED.some((phase) => Object.hasOwn(itemsOf(manifest, phase), topic)));
}

/** A unit's spec items not past their gate taken off, its topics decided in no spec (21.8.9). @param {Record<string, any>} out */
function dropWrittenSpecs(out) {
  const specs = itemsOf(out, 'specification');
  for (const [topic, item] of Object.entries(specs)) if (isObject(item) && UNCONCLUDED_SPECS.includes(item.status) && !pastGate(out, topic, item)) delete specs[topic];
}

/** An `imports[]` entry, its path following its file into `assets/`. @param {unknown} entry */
function asAsset(entry) {
  return isObject(entry) && typeof entry.path === 'string' && entry.path.startsWith('imports/')
    ? { ...entry, path: `assets/${entry.path.slice('imports/'.length)}` }
    : entry;
}

/** @param {Record<string, any>} manifest @returns {Set<string>} */
function cancelledTopics(manifest) {
  const cancelled = new Set(Object.entries(itemsOf(manifest, 'discovery')).filter(([, item]) => isObject(item) && item.cancelled === true).map(([topic]) => topic));
  for (const phase of ['discussion', 'investigation']) {
    for (const [topic, item] of Object.entries(itemsOf(manifest, phase))) if (isObject(item) && item.status === 'cancelled') cancelled.add(topic);
  }
  return cancelled;
}

/** @param {string} text @returns {string} */
function slugOf(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** @param {string} text */
const endLine = (text) => (text.endsWith('\n') ? text : `${text}\n`);

/**
 * Where each moved file went, `.workflows/`-relative to state-relative: what
 * a roadmap item's sources follow (21.5.7).
 * @typedef {Map<string, string>} Relocations
 */

/**
 * Each file kept as legacy, `.workflows/`-relative to state-relative.
 * @typedef {Map<string, string>} Legacy
 */

/**
 * Where each file the move places goes, and each folder whose files all go
 * to one folder: `.workflows/`-relative to state-relative, with the anchor
 * of the heading a document folded into a log sits under there, else empty;
 * known before any document is written, so a document's links follow them.
 * @typedef {Map<string, {to: string, anchor: string}>} Places
 */

/**
 * One unit's move: where its files come from and go, which of them are
 * accounted for, where each went, and what decides each one's place; a
 * topic whose research went with it, to the unit it went to.
 * @typedef {{
 *   unit: string,
 *   from: string,
 *   state: string,
 *   manifest: Record<string, any>,
 *   files: string[],
 *   imported: Set<string>,
 *   accounted: Set<string>,
 *   relocations: Relocations,
 *   topics: Set<string>,
 *   oneTopic: string|null,
 *   superseded: Set<string>,
 *   cancelled: Set<string>,
 *   quickFix: boolean,
 *   quickFixDone: boolean,
 *   joined: string[],
 *   incoming: Promoted[],
 *   outgoing: Map<string, string>,
 *   promotedFrom: Map<string, string>,
 *   places: Places,
 * }} UnitMove
 */

/**
 * A topic promoted to a cross-cutting unit, which took only its discussion:
 * the unit it came from, whose research for it joins the log the topic has
 * in the unit it went to.
 * @typedef {{source: string, target: string, topic: string}} Promoted
 */

/** A file of the unit's, accounted for. @param {UnitMove} move @param {string} rel @returns {Buffer} */
function take(move, rel) {
  move.accounted.add(rel);
  return fs.readFileSync(path.join(move.from, rel));
}

/** A document of the unit's, accounted for, its links pointed from `at`, state-relative. @param {UnitMove} move @param {string} rel @param {string} at */
function takeDocument(move, rel, at) {
  return linked(take(move, rel).toString('utf8'), `${move.unit}/${rel}`, at, move.unit, move.imported, move.places);
}

/** @param {UnitMove} move @param {string} at unit-relative @param {string|Buffer} content @param {number} [mode] */
function put(move, at, content, mode) {
  writeFile(path.join(move.state, move.unit, at), content, mode);
}

/** A file of the unit's gone to `to`, state-relative. @param {UnitMove} move @param {string} rel @param {string} to */
function relocate(move, rel, to) {
  move.relocations.set(`${move.unit}/${rel}`, to);
}

/** A heading markdown reads, the deepest aside, its marks after the indent. */
const DEMOTABLE = /^( {0,3})(#{1,5})(?=[ \t]|$)/;

/** A line opening or closing a fenced block. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * An old document as a log holds it: each heading outside a fenced block one
 * level deeper, so none of its own is read as one of the log's.
 * @param {string} text
 */
function demoted(text) {
  /** @type {{mark: string, length: number}|null} */
  let fence = null;
  return text.split('\n').map((line) => {
    const opens = FENCE.exec(line);
    if (fence !== null) {
      if (opens !== null && opens[1][0] === fence.mark && opens[1].length >= fence.length && line.trim() === opens[1]) fence = null;
      return line;
    }
    if (opens !== null) {
      fence = { mark: opens[1][0], length: opens[1].length };
      return line;
    }
    return line.replace(DEMOTABLE, '$1#$2');
  }).join('\n');
}

/** @param {string} heading @param {string} text */
const logPart = (heading, text) => `## ${heading}\n\n${endLine(demoted(text))}`;

/**
 * The reviews of a topic's old agent store, its own unit's and the one it
 * was promoted from, that landed and were never folded in, each its report
 * under a heading of its own, demoted; a report the topic's documents,
 * `log`, hold already is not. A topic promoted away has its reviews folded
 * where it went.
 * @param {UnitMove} move @param {string} topic @param {string} log @returns {string[]}
 */
function unfoldedReviews(move, topic, log) {
  const homes = [move.unit, ...(move.promotedFrom.has(topic) ? [move.promotedFrom.get(topic)] : [])];
  return homes.flatMap((home) => LOG_PHASES.flatMap((phase) => {
    const dir = path.join(path.dirname(move.from), '.cache', home, phase, topic);
    const file = path.join(dir, 'state.json');
    const store = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    const rows = isObject(store) && isObject(store.agents) ? Object.values(store.agents) : [];
    return rows.filter((row) => isObject(row) && row.kind === 'review' && row.status !== 'incorporated' && typeof row.id === 'string').flatMap((row) => {
      const report = path.join(dir, `${row.id}.md`);
      const text = fs.existsSync(report) ? fs.readFileSync(report, 'utf8').trim() : '';
      return text === '' || log.includes(text) ? [] : [`## Review ${row.id}, never folded in\n\n${demoted(text)}\n`];
    });
  }));
}

/**
 * Whether a file of the unit's is a document a log takes: research under any
 * name but a split's superseded copy, a discussion or an investigation
 * under a topic's.
 * @param {UnitMove} move @param {string} rel
 */
function logDocument(move, rel) {
  const phase = path.posix.dirname(rel);
  if (!LOG_PHASES.includes(phase) || !rel.endsWith('.md')) return false;
  const name = path.posix.basename(rel, '.md');
  return phase === 'research' ? !move.superseded.has(name) : move.topics.has(name);
}

/** The number of the migration's discovery session for research no topic holds: the next after the unit's last. @param {UnitMove} move */
function spreadNumber(move) {
  const last = Math.max(0, ...move.files.map((f) => SESSION.exec(f)).filter((m) => m !== null).map((m) => Number(m[2])));
  return String(last + 1).padStart(3, '0');
}

/**
 * Where a document a log takes goes, state-relative, under which heading,
 * and by which rule: promoted research to its topic's log in the unit it
 * went to; research no topic holds to its unit's one topic's log, under its
 * own name, or, in a unit of several topics, to the migration's discovery
 * session; any other to its topic's log.
 * @param {UnitMove} move @param {string} rel
 * @returns {{to: string, heading: string, kind: 'promoted'|'spread'|'topic', topic: string}}
 */
function logPlace(move, rel) {
  const phase = path.posix.dirname(rel);
  const name = path.posix.basename(rel, '.md');
  const promotedTo = phase === 'research' ? move.outgoing.get(name) : undefined;
  if (promotedTo !== undefined) return { to: `${promotedTo}/topics/${name}/log.md`, heading: LOG_HEADINGS.research, kind: 'promoted', topic: name };
  const topic = move.topics.has(name) ? name : move.oneTopic;
  const heading = topic === name ? LOG_HEADINGS[phase] : `Research: ${name}`;
  if (topic === null) return { to: `${move.unit}/discovery/session-${spreadNumber(move)}.md`, heading, kind: 'spread', topic: name };
  return { to: `${move.unit}/topics/${topic}/log.md`, heading, kind: 'topic', topic };
}

/**
 * Each topic's log, its research, discussion and investigation each under
 * its own heading, a promoted topic's research coming from the unit it was
 * promoted from, then each of its reviews never folded in; and research no
 * topic of its name holds, in its unit's one topic's log, or, in a unit of
 * several topics, in a discovery session of the migration's, numbered after
 * the unit's last. A discussion or an investigation no topic
 * holds is kept as legacy.
 * @param {UnitMove} move
 */
function moveLogs(move) {
  /** @type {Map<string, {heading: string, text: string}[]>} */
  const logs = new Map(move.incoming.map((entry) => [entry.topic, [{ heading: LOG_HEADINGS.research, text: promotedText(path.dirname(move.from), entry, move.places) }]]));
  /** @type {string[]} */
  const spread = [];
  for (const phase of LOG_PHASES) {
    for (const rel of move.files.filter((f) => path.posix.dirname(f) === phase && logDocument(move, f))) {
      const { to, heading, kind, topic } = logPlace(move, rel);
      relocate(move, rel, to);
      if (kind === 'promoted') take(move, rel);
      else if (kind === 'spread') spread.push(logPart(heading, takeDocument(move, rel, to)));
      else logs.set(topic, [...(logs.get(topic) ?? []), { heading, text: takeDocument(move, rel, to) }]);
    }
  }
  for (const topic of move.topics) {
    const documents = logs.get(topic) ?? [];
    const parts = documents.map(({ heading, text }) => logPart(heading, text));
    const folded = move.outgoing.has(topic) ? parts : [...parts, ...unfoldedReviews(move, topic, documents.map(({ text }) => text).join('\n'))];
    if (folded.length > 0) put(move, `topics/${topic}/log.md`, folded.join('\n'));
  }
  if (spread.length === 0) return;
  const number = spreadNumber(move);
  const head = [
    `# Discovery Session ${number}`, '', `Date: ${today()}`, `Work unit: ${move.unit}`, '',
    'Written by the migration: the research below fed several topics, so it is kept here, on the unit\'s discovery log, until the cut and the merges place it where it bears.',
  ];
  put(move, `discovery/session-${number}.md`, [...head, '', ...spread].join('\n'));
}

/** A message's line naming its sender as today's send writes it: its origin, phase and date. */
const OLD_SENDER_LINE = /^\*From: (.+) · [a-z-]+ · \d{4}-(\d{2})-(\d{2})\*$/;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A name as the screen titles it: `first-run` as `First Run`. @param {string} name */
const titled = (name) => name.split(/[-_\s]+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

/**
 * A message with the line where today's send wrote who sent it — under its
 * title, or under a blank line after it — as the waiting mail heads it
 * (10.4.2), its second line: `From {sender} · {16 Oct}`, the sender the
 * topic it surfaced in, titled, and the phase gone; one without that line
 * as it is.
 * @param {string} text
 */
function senderLined(text) {
  const [title, ...rest] = text.split('\n');
  const at = rest[0] === '' ? 1 : 0;
  const match = OLD_SENDER_LINE.exec(rest[at] ?? '');
  if (match === null) return text;
  const [, origin, month, day] = match;
  return [title, `From ${titled(origin)} · ${Number(day)} ${MONTHS[Number(month) - 1]}`, ...rest.slice(at + 1)].join('\n');
}

/**
 * A message for a topic cancelled or none holds, as an idea in the inbox,
 * its first line the title — written once, a move run again finding it there.
 * @param {UnitMove} move @param {string} rel @param {string} name
 */
function messageToInbox(move, rel, name) {
  const [first, ...rest] = senderLined(takeDocument(move, rel, '.inbox/ideas/idea.md')).split('\n');
  const named = name.replace(/^[0-9]+-/, '').replace(/\.md$/, '');
  const title = first.replace(/^#+\s*/, '').trim() || named;
  const content = [`# ${title}`, ...rest].join('\n');
  const base = path.join(move.state, '.inbox', 'ideas', `${today()}--${slugOf(title) || slugOf(named)}`);
  for (let n = 1; ; n += 1) {
    const file = `${base}${n === 1 ? '' : `-${n}`}.md`;
    if (!fs.existsSync(file)) return writeWhole(scratchOf(move.state), file, content);
    if (fs.readFileSync(file, 'utf8') === content) return undefined;
  }
}

/**
 * Each message of the unit's, in the order its topic's one sequence takes
 * them from every box the topic had, and where it goes, unit-relative: its
 * topic's mail folder, renumbered where the topic had more than one box, or
 * null for a topic cancelled or none holds, whose mail goes to the inbox.
 * @param {UnitMove} move @returns {{rel: string, name: string, at: string|null}[]}
 */
function mailPlaces(move) {
  /** @type {Map<string, Map<string, {rel: string, name: string}[]>>} */
  const boxes = new Map();
  for (const rel of move.files) {
    const match = MAILBOX_MESSAGE.exec(rel);
    if (match === null) continue;
    const [, phase, topic, name] = match;
    const box = boxes.get(topic) ?? new Map();
    box.set(phase, [...(box.get(phase) ?? []), { rel, name }]);
    boxes.set(topic, box);
  }
  return [...boxes].flatMap(([topic, box]) => LOG_PHASES.flatMap((phase) => box.get(phase) ?? []).map(({ rel, name }, i) => {
    if (move.cancelled.has(topic) || !move.topics.has(topic)) return { rel, name, at: null };
    const renamed = box.size > 1 ? `${String(i + 1).padStart(3, '0')}${name.replace(/^[0-9]+/, '')}` : name;
    return { rel, name, at: `topics/${topic}/mail/${renamed}` };
  }));
}

/**
 * Each topic's mail, from every box it had, as one sequence in its own
 * folder — renumbered where it had more than one box — or, for a topic
 * cancelled or none holds, ideas in the inbox.
 * @param {UnitMove} move
 */
function moveMail(move) {
  for (const { rel, name, at } of mailPlaces(move)) {
    if (at === null) {
      messageToInbox(move, rel, name);
      continue;
    }
    relocate(move, rel, `${move.unit}/${at}`);
    put(move, at, senderLined(takeDocument(move, rel, `${move.unit}/${at}`)));
  }
}

/**
 * Where a file of a topic's folder of the old plan's phases goes,
 * unit-relative: OLD_SYSTEMS for one the old system wrote; a spec as a
 * reference asset, a completed quick-fix's as its summary, or JOINED for
 * one joined into `spec.md`; and null for any other, which the layout has
 * no place for.
 * @param {UnitMove} move @param {string} top @param {string} topic @param {string} below
 * @returns {string|symbol|null}
 */
function deliveryPlace(move, top, topic, below) {
  if (oldSystemFile(`${top}/${topic}/${below}`)) return OLD_SYSTEMS;
  if (top !== 'specification' || below !== 'specification.md') return null;
  if (move.joined.includes(topic)) return JOINED;
  return move.quickFixDone ? 'summary.md' : `assets/specs/${topic}.md`;
}

/**
 * Topics in build order: each, taken in `ranked` order, once every topic
 * its plan depends on among them is placed — a cycle broken at the first
 * left, as the cut orders its plans (cut-merges.cjs, `cutOrder`).
 * @param {string[]} ranked @param {Record<string, any>} manifest
 * @returns {string[]}
 */
function buildOrder(ranked, manifest) {
  const plans = itemsOf(manifest, 'planning');
  const after = (/** @type {string} */ topic) => Object.keys(isObject(plans[topic]) && isObject(plans[topic].external_dependencies) ? plans[topic].external_dependencies : {})
    .filter((on) => on !== topic && ranked.includes(on));
  /** @type {string[]} */
  const ordered = [];
  while (ordered.length < ranked.length) {
    const left = ranked.filter((topic) => !ordered.includes(topic));
    ordered.push(left.find((topic) => after(topic).every((on) => ordered.includes(on))) ?? left[0]);
  }
  return ordered;
}

/**
 * The topics whose specs a unit whose building started joins, in build
 * order: its spec items past their gate with a spec, by their order, then
 * those with none in the order the manifest lists them, each after the
 * specs its plan depends on; none for any other unit, a quick-fix among
 * them.
 * @param {Record<string, any>} manifest @param {string[]} files unit-relative
 * @returns {string[]}
 */
function joinedTopics(manifest, files) {
  if (isQuickFix(manifest) || !buildingStarted(manifest)) return [];
  const orderOf = (/** @type {Record<string, any>} */ item) => (Number.isInteger(item.order) ? item.order : Infinity);
  const ranked = Object.entries(itemsOf(manifest, 'specification'))
    .filter(([topic, item]) => pastGate(manifest, topic, item) && files.includes(`specification/${topic}/specification.md`))
    .map(([topic, item], at) => ({ topic, order: orderOf(item), at }))
    .sort((a, b) => a.order - b.order || a.at - b.at)
    .map(({ topic }) => topic);
  return buildOrder(ranked, manifest);
}

/**
 * An old spec's lines below its title, each heading outside a fenced block
 * demoted below the parts' level, and a fenced block left open closed by
 * its own mark (the header's).
 * @param {string[]} rows
 */
function belowParts(rows) {
  /** @type {string|null} */
  let fence = null;
  const read = rows.map((row) => {
    const mark = SPEC_FENCE.exec(row)?.[1];
    if (fence === null && mark !== undefined) fence = mark;
    else if (fence !== null && mark !== undefined && mark[0] === fence[0] && mark.length >= fence.length && row.trim() === mark) {
      fence = null;
      return { row, level: 0 };
    }
    return { row, level: fence === null ? (SPEC_HEADING.exec(row)?.[1].length ?? 0) : 0 };
  });
  const step = Math.max(0, AREA_TEXT_LEVEL - Math.min(AREA_TEXT_LEVEL, ...read.map(({ level }) => level).filter((level) => level > 0)));
  const demotedRows = read.map(({ row, level }) => (level === 0 ? row : `${'#'.repeat(Math.min(6, level + step))}${row.slice(level)}`));
  return fence === null ? demotedRows : [...demotedRows, fence];
}

/** An old spec's area heading in `spec.md`, numbered `number`: its title, or its topic's name where it opens with none. @param {string} text @param {number} number @param {string} topic */
const areaHeading = (text, number, topic) => `${number}. ${SPEC_TITLE.exec(text.split(/\r\n?|\n/)[0])?.[1] ?? titled(topic)}`;

/** An old spec as an area of `spec.md`, numbered `number` (the header's). @param {string} text @param {number} number @param {string} topic */
function asArea(text, number, topic) {
  const rows = text.split(/\r\n?|\n/);
  const words = (SPEC_TITLE.test(rows[0]) ? rows.slice(1) : rows).join('\n').replace(/^(?:[ \t]*\n)+/, '').trimEnd();
  const body = belowParts(words.split('\n')).join('\n');
  return `## ${areaHeading(text, number, topic)}${body === '' ? '' : `\n\n${body}`}`;
}

/**
 * The unit's specs joined into `spec.md`, each relocated there and its links
 * pointed from it; nothing where it joins none.
 * @param {UnitMove} move
 */
function joinSpecs(move) {
  if (move.joined.length === 0) return;
  const at = `${move.unit}/${JOINED_SPEC}`;
  const areas = move.joined.map((topic, i) => {
    const rel = `specification/${topic}/specification.md`;
    relocate(move, rel, at);
    return asArea(takeDocument(move, rel, at), i + 1, topic);
  });
  put(move, JOINED_SPEC, `# ${titled(move.unit)}\n\n${areas.join('\n\n')}\n`);
}

/**
 * Where a brief goes, unit-relative: its topic's folder, or null where no
 * topic holds its name.
 * @param {UnitMove} move @param {string} folder @param {string[]} inside
 * @returns {string|null}
 */
function briefPlace(move, folder, inside) {
  const topic = inside.length === 1 && inside[0].endsWith('.md') ? inside[0].slice(0, -3) : null;
  return folder === 'briefs' && topic !== null && move.topics.has(topic) ? `topics/${topic}/brief.md` : null;
}

/**
 * Where a file of an experiment record goes, below `at`, unit-relative: a
 * record's problem, design and report as they are, its `data/` as it is, a
 * sub-experiment's the same within it, and any other of its files — its
 * instruments — under its `data/`, at its path from the record's folder
 * (4.11.15); null for a file in no record's folder.
 * @param {string} at @param {string[]} inside the path below the topic's experiments, or below a record's folder
 * @param {RegExp} [named] what the record's folder is named
 * @returns {string|null}
 */
function experimentPlace(at, inside, named = EXPERIMENT_RECORD) {
  const [record, ...below] = inside;
  if (below.length === 0 || !named.test(record)) return null;
  const [sub, ...within] = below;
  if (named === EXPERIMENT_RECORD && within.length > 0 && EXPERIMENT_SUB_RECORD.test(sub)) return experimentPlace(`${at}/${record}`, below, EXPERIMENT_SUB_RECORD);
  const kept = (below.length === 1 && EXPERIMENT_FILES.includes(sub)) || sub === 'data';
  return `${at}/${record}/${kept ? '' : 'data/'}${below.join('/')}`;
}

/**
 * Where a file of the unit's goes, unit-relative, by its place today: DROP,
 * or OLD_SYSTEMS or null as `deliveryPlace` says; a split's superseded copy
 * of research kept as reference.
 * @param {UnitMove} move @param {string} rel
 * @returns {string|symbol|null}
 */
function placeOf(move, rel) {
  const [top, ...below] = rel.split('/');
  const session = SESSION.exec(rel);
  if (session !== null) return `discovery/${session[1]}`;
  if (below.length === 0) return null;
  if (top === 'research' && below.length === 1 && move.superseded.has(path.posix.basename(below[0], '.md'))) return `${SUPERSEDED_PLACE}/${below[0]}`;
  if (top === '.state') return DROP;
  if (Object.hasOwn(CARRIED, top)) return `${CARRIED[top]}/${below.join('/')}`;
  const [topic, ...inside] = below;
  if (inside.length === 0) return null;
  if (top === 'experiment') return move.topics.has(topic) ? experimentPlace(`topics/${topic}/experiments`, inside) : null;
  if (top === 'discovery') return briefPlace(move, topic, inside);
  return OLD_PLAN_PHASES.includes(top) ? deliveryPlace(move, top, topic, inside.join('/')) : null;
}

/** The names of the files a unit's `imports/` holds. @param {string} unitDir @returns {Set<string>} */
const importedNames = (unitDir) => new Set(filesUnder(path.join(unitDir, 'imports')).filter((f) => !f.includes('/')));

/**
 * Each topic promoted to a cross-cutting unit that holds it, whose research
 * and agent store stayed behind in the unit it came from.
 * @param {Map<string, Record<string, any>>} manifests @returns {Promoted[]}
 */
function promotions(manifests) {
  return [...manifests].flatMap(([source, manifest]) => Object.entries(itemsOf(manifest, 'discussion')).flatMap(([topic, item]) => {
    const target = isObject(item) ? item.promoted_to : undefined;
    const holder = typeof target === 'string' ? manifests.get(target) : undefined;
    return holder !== undefined && topicNames(holder, target).has(topic) ? [{ source, target, topic }] : [];
  }));
}

/**
 * A promoted topic's research, its links to the imports of the unit it came
 * from, and to the files and folders the move places, pointed from the log
 * it joins.
 * @param {string} workflows @param {Promoted} promoted @param {Places} places @returns {string}
 */
function promotedText(workflows, { source, target: unit, topic }, places) {
  const old = `${source}/research/${topic}.md`;
  return linked(fs.readFileSync(path.join(workflows, old), 'utf8'), old, `${unit}/topics/${topic}/log.md`, source, importedNames(path.join(workflows, source)), places);
}

/**
 * One unit's move, nothing written yet: where its files come from and what
 * decides where each goes, its places filled in once every unit's is known.
 * @param {string} workflows @param {string} state @param {string} unit @param {Record<string, any>} manifest @param {Promoted[]} promoted
 * @param {Relocations} relocations
 * @returns {UnitMove}
 */
function unitMove(workflows, state, unit, manifest, promoted, relocations) {
  const from = path.join(workflows, unit);
  const topics = topicNames(manifest, unit);
  const reshaped = reshapedManifest(manifest, topics);
  const files = filesUnder(from);
  return {
    unit,
    from,
    state,
    manifest: reshaped,
    files,
    imported: importedNames(from),
    accounted: new Set(['manifest.json']),
    relocations,
    topics,
    oneTopic: ONE_TOPIC_TYPES.includes(manifest.work_type) ? unit : null,
    superseded: new Set(Object.entries(itemsOf(manifest, 'research')).filter(([, item]) => isObject(item) && item.status === SUPERSEDED).map(([name]) => name)),
    cancelled: cancelledTopics(reshaped),
    quickFix: isQuickFix(manifest),
    quickFixDone: quickFixDone(manifest),
    joined: joinedTopics(manifest, files),
    incoming: promoted.filter(({ source, target, topic }) => target === unit && fs.existsSync(path.join(workflows, source, 'research', `${topic}.md`))),
    outgoing: new Map(promoted.filter(({ source }) => source === unit).map(({ topic, target }) => [topic, target])),
    promotedFrom: new Map(promoted.filter(({ target }) => target === unit).map(({ topic, source }) => [topic, source])),
    places: new Map(),
  };
}

/**
 * The unit's files whose place `placeOf` says, unit-relative: each but its
 * manifest and the documents a log or a mailbox takes.
 * @param {UnitMove} move @returns {string[]}
 */
const filesByPlace = (move) => move.files.filter((rel) => rel !== 'manifest.json' && !MAILBOX_MESSAGE.test(rel) && !logDocument(move, rel));

/**
 * The unit's files kept as legacy, unit-relative: each given no place,
 * dropped or joined.
 * @param {UnitMove} move @returns {string[]}
 */
const legacyFiles = (move) => filesByPlace(move).filter((rel) => placeOf(move, rel) === null);

/**
 * The unit's files the old system wrote, unit-relative, each copied into
 * the unit's cache.
 * @param {UnitMove} move @returns {string[]}
 */
const oldSystemFiles = (move) => filesByPlace(move).filter((rel) => placeOf(move, rel) === OLD_SYSTEMS);

/** @typedef {[string, {to: string, anchor: string}]} PlaceEntry */

/**
 * Where each file of the unit's the move places goes, but those kept as
 * legacy, `.workflows/`-relative to state-relative: its manifest where it
 * was, a document a log takes at the heading it sits under there, and a spec
 * joined into `spec.md` at its area's.
 * @param {UnitMove} move @returns {PlaceEntry[]}
 */
function unitPlaces(move) {
  /** @type {[string, string, string][]} */
  const places = [
    ['manifest.json', `${move.unit}/manifest.json`, ''],
    ...move.files.filter((rel) => logDocument(move, rel)).map((rel) => {
      const { to, heading } = logPlace(move, rel);
      return /** @type {[string, string, string]} */ ([rel, to, anchorOf(heading)]);
    }),
    ...mailPlaces(move).flatMap(({ rel, at }) => (at === null ? [] : [/** @type {[string, string, string]} */ ([rel, `${move.unit}/${at}`, ''])])),
    ...filesByPlace(move).flatMap((rel) => {
      const at = placeOf(move, rel);
      return typeof at === 'string' ? [/** @type {[string, string, string]} */ ([rel, `${move.unit}/${at}`, ''])] : [];
    }),
    ...move.joined.map((topic, i) => {
      const rel = `specification/${topic}/specification.md`;
      const heading = areaHeading(fs.readFileSync(path.join(move.from, rel), 'utf8'), i + 1, topic);
      return /** @type {[string, string, string]} */ ([rel, `${move.unit}/${JOINED_SPEC}`, anchorOf(heading)]);
    }),
  ];
  return places.map(([rel, to, anchor]) => [`${move.unit}/${rel}`, { to, anchor }]);
}

/**
 * The unit's files the move keeps but gives no place a link can follow,
 * `.workflows/`-relative: the mail it sends to the inbox.
 * @param {UnitMove} move @returns {string[]}
 */
const unplaced = (move) => mailPlaces(move).filter(({ at }) => at === null).map(({ rel }) => `${move.unit}/${rel}`);

/**
 * `places` with each folder whose files all go, at their paths below it, to
 * one folder, at that folder; a folder holding a file that goes elsewhere,
 * into a log, or, as `held` says, nowhere a link can follow, has none.
 * @param {Places} places @param {string[]} held `.workflows/`-relative
 * @returns {Places}
 */
function withFolders(places, held) {
  /** @type {Map<string, string|null>} */
  const folders = new Map();
  const note = (/** @type {string} */ rel, /** @type {string|null} */ to) => {
    for (let folder = path.posix.dirname(rel); folder !== '.'; folder = path.posix.dirname(folder)) {
      const below = rel.slice(folder.length);
      const place = to !== null && to.endsWith(below) ? to.slice(0, -below.length) : null;
      folders.set(folder, folders.has(folder) && folders.get(folder) !== place ? null : place);
    }
  };
  for (const [rel, { to, anchor }] of places) note(rel, anchor === '' ? to : null);
  for (const rel of held) note(rel, null);
  for (const [folder, to] of folders) if (to !== null) places.set(folder, { to, anchor: '' });
  return places;
}

/**
 * Whether a file of an experiment record went under its record's `data/`:
 * its path below the topic's experiments changed.
 * @param {string} rel unit-relative @param {string} at unit-relative
 */
const intoData = (rel, at) => rel.startsWith('experiment/') && !at.endsWith(rel.split('/').slice(2).join('/'));

/**
 * Each topic on the map that no brief came to given its map row's
 * description as its brief.
 * @param {UnitMove} move
 */
function describedBriefs(move) {
  for (const [topic, row] of Object.entries(itemsOf(move.manifest, 'discovery'))) {
    if (!isObject(row) || typeof row.description !== 'string' || row.description.trim() === '') continue;
    const brief = `topics/${topic}/brief.md`;
    if (!fs.existsSync(path.join(move.state, move.unit, brief))) put(move, brief, `# ${titled(topic)}\n\n${row.description.trim()}\n`);
  }
}

/**
 * Move one unit into the layout — every file placed, its place recorded in
 * `relocations`, or dropped, its legacy kept by `keepAsItWas` — then its
 * manifest.
 * @param {UnitMove} move
 */
function moveUnit(move) {
  moveLogs(move);
  moveMail(move);
  joinSpecs(move);
  for (const rel of move.files.filter((f) => !move.accounted.has(f))) {
    const at = placeOf(move, rel);
    move.accounted.add(rel);
    if (at === null || typeof at === 'symbol') continue;
    const mode = modeOf(path.join(move.from, rel));
    if (!rel.endsWith('.md') || Object.hasOwn(CARRIED, rel.split('/')[0])) put(move, at, take(move, rel), mode);
    else if (SESSION.test(rel)) put(move, at, demoted(takeDocument(move, rel, `${move.unit}/${at}`)), mode);
    else put(move, at, takeDocument(move, rel, `${move.unit}/${at}`), mode);
    relocate(move, rel, `${move.unit}/${at}`);
  }
  describedBriefs(move);
  put(move, 'manifest.json', jsonText(move.joined.length === 0 ? move.manifest : { ...move.manifest, spec: { joined: move.joined } }));
}

/**
 * The project folder's `.gitignore` ignoring the state folder, as boot keeps
 * it — the line added where none ignores it whole: a worktree with no
 * commit checked out, unignored, refuses `git add -A`.
 * @param {string} project @param {string} state
 */
function ignoreState(project, state) {
  const file = path.join(project, CODE_GITIGNORE);
  const exists = fs.existsSync(file);
  const held = exists ? fs.readFileSync(file, 'utf8') : '';
  const ignored = held.split('\n').some((line) => !line.trim().startsWith('!') && [STATE_DIR, STATE_IGNORE_LINE].includes(line.trim().replace(/^\//, '')));
  if (!ignored) writeWhole(scratchOf(state), file, `${held}${held === '' || held.endsWith('\n') ? '' : '\n'}${STATE_IGNORE_LINE}\n`, exists ? modeOf(file) : undefined);
}

/** Each hook a settings document holds. @param {unknown} settings @returns {Record<string, any>[]} */
function hooksIn(settings) {
  return Object.values(isObject(settings) && isObject(settings.hooks) ? settings.hooks : {})
    .flatMap((groups) => (Array.isArray(groups) ? groups : []))
    .flatMap((group) => (isObject(group) && Array.isArray(group.hooks) ? group.hooks : []))
    .filter(isObject);
}

/** Each hook naming the engine at its old path named at its new one; whether any was. @param {unknown} settings */
function renameHooks(settings) {
  const named = hooksIn(settings).filter((hook) => typeof hook.command === 'string' && hook.command.includes(OLD_ENGINE));
  for (const hook of named) hook.command = hook.command.split(OLD_ENGINE).join(NEW_ENGINE);
  return named.length > 0;
}

/** Each permission rule naming `.workflows/` naming `.ledger/`; whether any was. @param {unknown} settings */
function renameRules(settings) {
  const permissions = isObject(settings) && isObject(settings.permissions) ? settings.permissions : {};
  let renamed = false;
  for (const list of PERMISSION_LISTS.filter((name) => Array.isArray(permissions[name]))) {
    permissions[list] = permissions[list].map((/** @type {unknown} */ rule) => {
      if (typeof rule !== 'string' || !rule.includes(OLD_RULE_PATH)) return rule;
      renamed = true;
      return rule.split(OLD_RULE_PATH).join(NEW_RULE_PATH);
    });
  }
  return renamed;
}

/**
 * The project's settings taken to the new names — its hooks naming the
 * engine's new path, its permission rules `.ledger/` (21.5.19); or, where
 * the file does not parse, the sentence saying it was left as it was.
 * @param {string} project @param {string} state
 * @returns {string|null}
 */
function renameInSettings(project, state) {
  const file = path.join(project, SETTINGS);
  if (!fs.existsSync(file)) return null;
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return `${file} does not parse, so it was left naming the engine at ${OLD_ENGINE} and the state at ${OLD_RULE_PATH}: `
      + `once it parses, name ${NEW_ENGINE} in each hook and ${NEW_RULE_PATH} in each permission rule.`;
  }
  const hooks = renameHooks(settings);
  const rules = renameRules(settings);
  if (!hooks && !rules) return null;
  writeWhole(scratchOf(state), file, jsonText(settings), modeOf(file));
  return null;
}

/**
 * The `.workflows/` lines gone from the project's `.worktreeinclude`, the file
 * with them where it holds nothing else: every worktree reads the one
 * state, so nothing is copied into a worktree (21.5.19, 4.1.4).
 * @param {string} project @param {string} state
 */
function dropIncludeLines(project, state) {
  const file = path.join(project, WORKTREE_INCLUDE);
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const kept = lines.filter((line) => !WORKFLOWS_LINE.test(line.trim()));
  if (kept.length === lines.length) return;
  if (kept.every((line) => line.trim() === '')) fs.unlinkSync(file);
  else writeWhole(scratchOf(state), file, kept.join('\n'), modeOf(file));
}

/**
 * Each declared store the project folder holds carried into the state as it
 * is (21.5.18), the move naming no tracker (7.1.10); finish drops it from
 * the default branch.
 * @param {string} project @param {string} state @param {{files: string[], localFiles: string[]}[]} stores
 * @returns {string[]} the files their tools keep local, for the state to ignore beside the stores (7.5.4); none where there is no store
 */
function moveStores(project, state, stores) {
  return [...new Set(stores.flatMap(({ files, localFiles }) => {
    const held = files.filter((rel) => fs.existsSync(path.join(project, rel)));
    for (const rel of held) {
      const file = path.join(project, rel);
      writeFile(path.join(state, rel), fs.readFileSync(file), modeOf(file));
    }
    return held.length === 0 ? [] : localFiles;
  }))];
}

/** Whether an inbox file is named as an item is, by the name it is carried under. @param {string} rel @param {Map<string, string>} renames */
const isInboxItem = (rel, renames) => INBOX_ITEM.test(renamedPath(rel, renames));

/** The inbox's files named as no item is, `.workflows/`-relative. @param {string} from @param {Map<string, string>} renames @returns {string[]} */
const strayInbox = (from, renames) => filesUnder(path.join(from, '.inbox')).filter((f) => !isInboxItem(f, renames)).map((f) => `.inbox/${f}`);

/**
 * The project's files carried into the state at their own paths,
 * `.workflows/`-relative: the inbox's items and the checkout's knowledge
 * config.
 * @param {string} from @param {Map<string, string>} renames @returns {string[]}
 */
const carriedFiles = (from, renames) => [
  ...filesUnder(path.join(from, '.inbox')).filter((f) => isInboxItem(f, renames)).map((f) => `.inbox/${f}`),
  ...CARRIED_AS_IS.filter((rel) => fs.existsSync(path.join(from, rel))),
];

/**
 * The project's carried files, and the state's own ignore file, with
 * `ignored` added to it.
 * @param {string} from @param {string} state @param {string[]} ignored @param {Map<string, string>} renames
 */
function moveProjectFiles(from, state, ignored, renames) {
  for (const rel of carriedFiles(from, renames)) {
    const file = path.join(from, rel);
    writeFile(path.join(state, rel), fs.readFileSync(file), modeOf(file));
  }
  writeFile(path.join(state, '.gitignore'), ignored.length === 0 ? STATE_GITIGNORE : `${STATE_GITIGNORE}${ignored.join('\n')}\n`);
}

/**
 * Where a file of `.roadmap/` goes, `.product/`-relative: a session as it
 * is, a note out of its kind's folder, its inbox name kept, an import into
 * the assets; or null where the layout has no place for it.
 * @param {string} rel
 * @returns {string|null}
 */
function productPlace(rel) {
  if (ROADMAP_SESSION.test(rel)) return rel;
  const note = ROADMAP_NOTE.exec(rel);
  if (note !== null) return `notes/${note[1]}`;
  return rel.startsWith('imports/') ? `assets/${rel.slice('imports/'.length)}` : null;
}

/**
 * Where a file of `.baseline/` goes, `.product/`-relative: a doc as it is,
 * an interview agenda beside the docs; or null for any other of its working
 * files, the research dossiers among them, which the layout has no place
 * for.
 * @param {string} rel
 * @returns {string|null}
 */
function baselinePlace(rel) {
  const agenda = BASELINE_AGENDA.exec(rel);
  if (agenda !== null) return `assets/baseline/${agenda[1]}`;
  return rel.startsWith('.state/') ? null : `assets/baseline/${rel}`;
}

/**
 * A file of `.roadmap/` or `.baseline/` and where it goes, `.product/`-
 * relative, null where the layout has no place for it; whether its links
 * are pointed from there, and whether its headings are demoted as a log's.
 * @typedef {{source: string, at: string|null, relink: boolean, log: boolean}} ProductFile
 */

/**
 * Where each file of `.roadmap/` and `.baseline/` goes: `.roadmap/` as
 * `.product/`, and `.baseline/`'s docs and its interview agendas, which hold
 * the person's answers, in `.product/assets/baseline/` as reference, only
 * its status fields gone (21.11.1); a note whose name another kind's note
 * took has no place.
 * @param {string} from @returns {ProductFile[]}
 */
function productPlan(from) {
  /** @type {Set<string>} */
  const taken = new Set();
  return [
    ...filesUnder(path.join(from, ROADMAP)).map((rel) => ({ source: `${ROADMAP}/${rel}`, at: productPlace(rel), relink: rel.endsWith('.md') && !rel.startsWith('imports/'), log: ROADMAP_SESSION.test(rel) })),
    ...filesUnder(path.join(from, BASELINE)).map((rel) => ({ source: `${BASELINE}/${rel}`, at: baselinePlace(rel), relink: false, log: false })),
  ].map((file) => {
    if (file.at === null || taken.has(file.at)) return { ...file, at: null };
    taken.add(file.at);
    return file;
  });
}

/**
 * The product's files written where `plan` puts them, its documents' links
 * to its imports pointed at the assets (21.5.7), and to the files and
 * folders the move places, its sessions' headings demoted and the imports
 * they name from the product's folder named as its assets: each file's
 * place recorded in `relocations`.
 * @param {string} from @param {string} state @param {ProductFile[]} plan @param {Relocations} relocations @param {Places} places
 */
function moveProduct(from, state, plan, relocations, places) {
  const imported = importedNames(path.join(from, ROADMAP));
  for (const { source, at, relink, log } of plan) {
    if (at === null) continue;
    const file = path.join(from, source);
    const to = `${PRODUCT}/${at}`;
    const text = relink ? linked(fs.readFileSync(file, 'utf8'), source, to, PRODUCT, imported, places) : fs.readFileSync(file);
    writeFile(path.join(state, to), log ? demoted(sessionImports(text.toString(), imported)) : text, modeOf(file));
    relocations.set(source, to);
  }
}

/**
 * The project manifest less the baseline's status fields, a recorded
 * `native`, `skipped` or `completed` kept as the brownfield offer's answer
 * (21.11.1, 21.11.2), and where none is, when the old state arrived, where
 * it did; less the defaults first use no longer asks for, the
 * plan's format and the project skills (22.3.1, 22.3.2), the `defaults`
 * object with them once empty; the session-label opt-in as
 * `session_labels`; and no driver's setting written, so each
 * resolves to its default at first need (22.4.3, 7.1.11); each roadmap
 * item's sources following their files, once each; the roadmap's `imports`
 * index dropped, its files the product's assets (21.5.7); the roadmap's open
 * session the product's conversation's, `product_session`; each registry
 * entry naming no unit's folder dropped; and each mistyped entry typed as
 * its unit's manifest types it.
 * @param {Record<string, any>} project @param {Relocations} relocations @param {string[]} unfoldered @param {Mistyped[]} mistyped @param {string|null} arrived
 * @returns {Record<string, any>}
 */
function reshapedProject(project, relocations, unfoldered, mistyped, arrived) {
  const { baseline, ...out } = structuredClone(project);
  if (isObject(out.work_units)) for (const name of unfoldered) delete out.work_units[name];
  for (const { name, is } of mistyped) out.work_units[name].work_type = is;
  const answer = isObject(baseline) ? baseline.status : undefined;
  if (BROWNFIELD_ANSWERS.includes(answer)) out.brownfield_offer = answer;
  else if (arrived !== null) out.arrived = arrived;
  if (isObject(out.defaults)) {
    for (const field of RETIRED_DEFAULTS) delete out.defaults[field];
    for (const [was, is] of RENAMED_DEFAULTS) {
      if (!Object.hasOwn(out.defaults, was)) continue;
      out.defaults[is] = out.defaults[was];
      delete out.defaults[was];
    }
    if (Object.keys(out.defaults).length === 0) delete out.defaults;
  }
  const roadmap = isObject(out.roadmap) ? out.roadmap : {};
  for (const item of Object.values(isObject(roadmap.items) ? roadmap.items : {})) {
    if (isObject(item) && Array.isArray(item.sources)) item.sources = [...new Set(item.sources.map((source) => relocations.get(source) ?? source))];
  }
  delete roadmap.imports;
  if (Object.hasOwn(roadmap, 'active_session')) {
    out.product_session = roadmap.active_session;
    delete roadmap.active_session;
  }
  return out;
}

/** The files under `name` in `.workflows/`, the tools' sidecars aside, `.workflows/`-relative; `name` itself where it is a file. @param {string} from @param {string} name @returns {string[]} */
function filesOf(from, name) {
  return fs.statSync(path.join(from, name)).isDirectory() ? filesUnder(path.join(from, name)).map((rel) => `${name}/${rel}`) : [name];
}

/**
 * The old cache's documents, its agents' reports, which nothing rebuilds,
 * each to its place in the state's cache: a unit's in the unit's
 * `earlier/`, at its path below the unit's folder there, every name of a
 * unit in either as it is carried, and one of no unit's in the cache's own,
 * at its path below the old cache.
 * @param {string} from @param {Set<string>} units @param {Map<string, string>} renames @returns {[string, string][]}
 */
function cacheReports(from, units, renames) {
  return filesUnder(path.join(from, OLD_CACHE)).filter((rel) => rel.endsWith('.md')).map((rel) => {
    const [unit, ...below] = rel.split('/');
    return [`${OLD_CACHE}/${rel}`, units.has(unit) ? earlierOf(unit, below.join('/'), renames) : `${CACHE}/${EARLIER}/${rel}`];
  });
}

/**
 * The files the old system wrote in each unit's folder, each to the unit's
 * `earlier/` in the state's cache, beside the old cache's reports, at its
 * path below the unit's old folder, every name of a unit in either as it is
 * carried.
 * @param {UnitMove[]} moves @param {Map<string, string>} renames @returns {[string, string][]}
 */
const oldSystemsKept = (moves, renames) => moves.flatMap((unit) => oldSystemFiles(unit)
  .map((rel) => /** @type {[string, string]} */ ([`${unit.unit}/${rel}`, earlierOf(unit.unit, rel, renames)])));

/** A unit's file's place in the unit's `earlier/`, state-relative, by its path below the unit's old folder. @param {string} unit @param {string} below @param {Map<string, string>} renames */
const earlierOf = (unit, below, renames) => `${CACHE}/${renamedPath(unit, renames)}/${EARLIER}/${renamedPath(below, renames)}`;

/**
 * Every file kept as it was written byte for byte at its place, its place
 * recorded in `relocations`.
 * @param {string} from @param {string} state @param {Iterable<[string, string]>} kept @param {Relocations} relocations
 */
function keepAsItWas(from, state, kept, relocations) {
  for (const [rel, to] of kept) {
    const file = path.join(from, rel);
    writeFile(path.join(state, to), fs.readFileSync(file), modeOf(file));
    relocations.set(rel, to);
  }
}

/**
 * A registry entry typed otherwise than its unit's manifest types it — a
 * change of type rewrote the manifest and left the registry: the unit's
 * name, the registry's type and the manifest's.
 * @typedef {{name: string, was: unknown, is: string}} Mistyped
 */

/**
 * Each mistyped registry entry, the manifest being the unit's own record of
 * its type.
 * @param {Record<string, any>} project @param {Map<string, Record<string, any>>} manifests @returns {Mistyped[]}
 */
function mistypedEntries(project, manifests) {
  return Object.entries(isObject(project.work_units) ? project.work_units : {}).flatMap(([name, entry]) => {
    const is = manifests.get(name)?.work_type;
    return isObject(entry) && typeof is === 'string' && entry.work_type !== is ? [{ name, was: entry.work_type, is }] : [];
  });
}

/**
 * The corrections the move made, for the migration's review, each by its
 * unit as carried: what disagreed, what was found and what was changed; the
 * journal gone where it made none.
 * @param {string} state @param {Mistyped[]} mistyped @param {Map<string, string>} renames
 */
function journalCorrections(state, mistyped, renames) {
  const file = path.join(state, CORRECTIONS_JOURNAL);
  if (mistyped.length === 0) {
    fs.rmSync(file, { force: true });
    return;
  }
  writeWhole(scratchOf(state), file, jsonText({
    corrections: mistyped.map(({ name, was, is }) => ({
      unit: renamedPath(name, renames),
      was: `The registry typed it ${JSON.stringify(was)}, and its manifest ${JSON.stringify(is)}.`,
      found: 'Its manifest is its own record of its type, which a change of type rewrote and the registry missed.',
      changed: `The registry types it ${JSON.stringify(is)}.`,
    })),
  }));
}

/**
 * When the old state first entered the project's history: the author time
 * of the first commit adding a file under its folder, by either name; null
 * where none did.
 * @param {string} project @returns {string|null}
 */
function oldStateArrived(project) {
  const { stdout } = git(project, ['log', '--no-show-signature', '--reverse', '--diff-filter=A', '--format=%aI', 'HEAD', '--', ...OLD_STATE_NAMES]);
  return stdout.split('\n').find(Boolean) ?? null;
}

/**
 * The project's manifest reshaped, with its id minted first — kept where a
 * move cut short already minted one — and the checklists a directive closed
 * before the move kept.
 * @param {string} state @param {Record<string, any>} project @param {Relocations} relocations @param {string[]} unfoldered @param {Mistyped[]} mistyped @param {string|null} arrived
 */
function writeProjectManifest(state, project, relocations, unfoldered, mistyped, arrived) {
  const moved = path.join(state, 'manifest.json');
  const { project_id: minted, checklists } = fs.existsSync(moved) ? readManifest(moved) : {};
  writeWhole(scratchOf(state), moved, jsonText({
    project_id: typeof minted === 'string' ? minted : newId(),
    ...reshapedProject(project, relocations, unfoldered, mistyped, arrived),
    ...(isObject(checklists) ? { checklists } : {}),
  }));
}

/** A file the rename's words follow in: a document or a manifest. */
const RENAMED_TEXT = /\.(?:md|json)$/;

/** A path under a legacy folder, whose files are kept byte for byte. */
const UNDER_LEGACY = new RegExp(`(?:^|/)${LEGACY}/`);

/** A name every verb takes: lowercase letters and digits, joined by single hyphens. */
const KEBAB_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Each unit whose name breaks the kebab-case rule by its case alone, to its
 * lowercase name.
 * @param {Iterable<string>} names @returns {Map<string, string>}
 */
const caseRenames = (names) => new Map([...names].filter((name) => !KEBAB_SLUG.test(name) && KEBAB_SLUG.test(name.toLowerCase()))
  .map((name) => [name, name.toLowerCase()]));

// An inbox item's name: its day, then the name it was captured under.
const DATED = /^([0-9]{4}-[0-9]{2}-[0-9]{2}--)(.*)$/;

/**
 * A path with each part named for a renamed unit — its folder, a topic's,
 * a file named for it, an inbox item captured under its name — under the
 * new name.
 * @param {string} rel @param {Map<string, string>} renames
 */
const renamedPath = (rel, renames) => rel.split('/').map((part) => {
  const [, day = '', named = part] = DATED.exec(part) ?? [];
  const [stem] = named.split('.');
  const name = renames.get(stem);
  return name === undefined ? part : `${day}${name}${named.slice(stem.length)}`;
}).join('/');

/**
 * Each entry under `folder` named for a renamed unit given its new name in
 * place, its own entries first: a rename of the entry, not of its files, so
 * a case-insensitive disk, as a Mac's is, takes a change of case alone.
 * @param {string} folder @param {Map<string, string>} renames @param {string[]} [skipped] the entries left as they are
 */
function renameEntries(folder, renames, skipped = []) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true }).filter(({ name }) => !skipped.includes(name))) {
    const at = path.join(folder, entry.name);
    if (entry.isDirectory()) renameEntries(at, renames);
    const name = renamedPath(entry.name, renames);
    if (name !== entry.name) fs.renameSync(at, path.join(folder, name));
  }
}

/**
 * Each unit `renames` names carried under its new name: the words of each
 * document and manifest the move wrote but a legacy one, kept byte for
 * byte, naming it by the new, and every entry of the state named for it
 * renamed; the tracker's store, carried as it is, and the state's cache
 * untouched. A run again over one cut short renames what it wrote again.
 * @param {string} state @param {Map<string, string>} renames @param {Set<string>} stores the store's files, state-relative
 */
function renameUnits(state, renames, stores) {
  if (renames.size === 0) return;
  const documents = filesUnder(state).filter((rel) => RENAMED_TEXT.test(rel) && !UNDER_LEGACY.test(rel) && !rel.startsWith(`${OLD_CACHE}/`) && !stores.has(rel));
  for (const rel of documents) {
    const file = path.join(state, rel);
    const held = fs.readFileSync(file, 'utf8');
    const text = [...renames].reduce((words, [from, to]) => words.split(from).join(to), held);
    if (text !== held) writeWhole(scratchOf(state), file, text, modeOf(file));
  }
  renameEntries(state, renames, ['.git', OLD_CACHE]);
}

/** The user-level folder today's skills read. */
const oldUserFolder = () => process.env.WORKFLOWS_CONFIG_DIR || path.join(os.homedir(), '.config', 'workflows');

/** The user-level folder the engine reads. */
const userFolder = () => process.env.LEDGER_CONFIG_DIR || path.join(os.homedir(), '.config', 'ledger');

/**
 * The addendum's line naming each place the move kept legacy files in, with
 * how many, never the files: a project can keep thousands, and the folders
 * hold them for the person to look at. Null where it kept none.
 * @param {Legacy} legacy @param {(rel: string) => string} placed
 * @returns {string|null}
 */
function legacyNote(legacy, placed) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const to of legacy.values()) {
    const place = `${STATE_DIR}/${placed(to.slice(0, to.indexOf(`/${LEGACY}/`)))}/${LEGACY}/`;
    counts.set(place, (counts.get(place) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const listed = [...counts].map(([place, n], i) => `${n} ${i === 0 ? `file${n === 1 ? '' : 's'} ` : ''}in ${place}`);
  return `These had no place of their own in ${STATE_DIR}/, so each is kept, as it was, as legacy, at its path from its old folder: ${listed.join(', ')}.`;
}

/**
 * Whether a plan of the project used the tracker of the task driver's
 * folder `name`: an old planning item's format names it.
 * @param {Map<string, Record<string, any>>} manifests @param {string} name
 */
const plannedIn = (manifests, name) => [...manifests.values()].some((manifest) => Object.values(itemsOf(manifest, 'planning')).some((item) => isObject(item) && item.format === name));

/**
 * The move of the project at `projectDir` — its own folder, nested in its
 * repository or at the top, as the main checkout holds it — into the state
 * worktree at the repository's main checkout.
 * @param {string} projectDir @param {() => void} reportUpdate @param {() => void} reportSkip
 * @returns {{verify?: string, notice?: string}|undefined}
 */
function move(projectDir, reportUpdate, reportSkip) {
  const here = path.resolve(projectDir);
  const main = mainCheckout(here);
  const project = main === null ? here : projectInMain(here, main);
  const from = path.join(project, CODE_TREE_STATE);
  if (main === null || !fs.existsSync(from) || stateBorn(main)) {
    reportSkip();
    return undefined;
  }
  const stopped = stoppedOperation(project);
  if (stopped !== null) {
    throw new Error(`${stopped} is stopped in ${project}, whose ${CODE_TREE_STATE}/ the move reads — finish or abort it, then start again`);
  }
  const state = placeStateWorktree(main);
  ignoreState(project, state);
  const settingsNote = renameInSettings(project, state);
  dropIncludeLines(project, state);
  const manifestFile = path.join(from, 'manifest.json');
  const projectManifest = fs.existsSync(manifestFile) ? readManifest(manifestFile) : {};
  /** @type {Relocations} */
  const relocations = new Map();
  const { stores, unread } = preLedgerStores();
  const entries = fs.readdirSync(from, { withFileTypes: true })
    .filter((entry) => !SIDECAR_NAME.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const folders = entries.filter((name) => !name.startsWith('.') && name !== 'manifest.json');
  const manifests = new Map(folders.filter((name) => fs.existsSync(path.join(from, name, 'manifest.json')))
    .map((name) => [name, readManifest(path.join(from, name, 'manifest.json'))]));
  const renames = caseRenames(manifests.keys());
  const unfoldered = Object.keys(isObject(projectManifest.work_units) ? projectManifest.work_units : {}).filter((name) => !manifests.has(name));
  const mistyped = mistypedEntries(projectManifest, manifests);
  const promoted = promotions(manifests);
  const moves = [...manifests].map(([name, manifest]) => unitMove(from, state, name, manifest, promoted, relocations));
  const product = productPlan(from);
  const reports = [...oldSystemsKept(moves, renames), ...cacheReports(from, new Set(manifests.keys()), renames)];
  /** @type {Legacy} */
  const legacy = new Map([
    ...[
      ...strayInbox(from, renames),
      ...product.filter(({ at }) => at === null).map(({ source }) => source),
      ...entries.filter((name) => !READ_OR_REBUILT.includes(name) && !manifests.has(name)).flatMap((name) => filesOf(from, name)),
      ...filesUnder(path.join(from, '.state')).map((rel) => `.state/${rel}`).filter((rel) => rel !== OLD_RECORD && rel !== ENVIRONMENT_SETUP),
    ].map((rel) => /** @type {[string, string]} */ ([rel, `${PRODUCT}/${LEGACY}/${rel}`])),
    ...moves.flatMap((unit) => legacyFiles(unit).map((rel) => /** @type {[string, string]} */ ([`${unit.unit}/${rel}`, `${unit.unit}/${LEGACY}/${rel}`]))),
  ]);
  /** @type {[string, string][]} */
  const whole = [
    ...legacy,
    ...reports,
    ...carriedFiles(from, renames).map((rel) => /** @type {[string, string]} */ ([rel, rel])),
    ...product.flatMap(({ source, at }) => (at === null ? [] : [/** @type {[string, string]} */ ([source, `${PRODUCT}/${at}`])])),
  ];
  const places = withFolders(new Map([
    ...whole.map(([rel, to]) => /** @type {PlaceEntry} */ ([rel, { to, anchor: '' }])),
    ...moves.flatMap(unitPlaces),
  ]), moves.flatMap(unplaced));
  const instruments = moves.flatMap((unit) => filesByPlace(unit).flatMap((rel) => {
    const at = placeOf(unit, rel);
    return typeof at === 'string' && intoData(rel, at) ? [`${STATE_DIR}/${unit.unit}/${at}`] : [];
  }));
  moveProjectFiles(from, state, moveStores(project, state, stores), renames);
  moveProduct(from, state, product, relocations, places);
  reportUpdate();
  for (const unit of moves) {
    unit.places = places;
    moveUnit(unit);
    reportUpdate();
  }
  keepAsItWas(from, state, [...legacy, ...reports], relocations);
  const setup = path.join(from, ENVIRONMENT_SETUP);
  const carried = withSetupNote(projectManifest, fs.existsSync(setup) ? fs.readFileSync(setup, 'utf8') : null);
  writeProjectManifest(state, carried, relocations, unfoldered, mistyped, oldStateArrived(project));
  renameUnits(state, renames, new Set(stores.flatMap(({ files }) => files)));
  journalCorrections(state, mistyped, renames);
  const placed = (/** @type {string} */ rel) => renamedPath(rel, renames);
  copyUserFiles(oldUserFolder(), userFolder());
  const lintersNote = carryLinters(state);
  const notes = [
    renames.size === 0 ? null : `${renames.size === 1 ? 'This unit\'s name' : 'These units\' names'} broke the rule a unit's name keeps — lowercase letters and digits, joined by single hyphens — by case alone, so ${renames.size === 1 ? 'it is' : 'each is'} carried under its lowercase name, its folder, its registry entry and every reference the move wrote to it following, its legacy files' words kept as they were: ${[...renames].map(([from, to]) => `${from} is ${to}`).join(', ')}.`,
    unfoldered.length === 0 ? null : `The registry named ${unfoldered.length === 1 ? 'this unit' : 'these units'}, and ${CODE_TREE_STATE}/ held no folder of ${unfoldered.length === 1 ? 'it' : 'theirs'} with a manifest, so the registry drops ${unfoldered.length === 1 ? 'its entry' : 'their entries'}: ${unfoldered.join(', ')}.`,
    legacyNote(legacy, placed),
    instruments.length === 0 ? null : `These files of experiment records, neither a record's problem, design or report nor in its data/, were moved under its data/, at their paths from the record's folder: ${instruments.map(placed).join(', ')}. A path a record's text or script spells out is left as written.`,
    settingsNote,
    lintersNote,
  ].filter((note) => note !== null);
  const notice = unreadStores(unread.filter((name) => plannedIn(manifests, name)), 'the store this project\'s plans kept for its tracker stays where it is, outside the state');
  if (notes.length === 0 && notice === null) return undefined;
  return { ...(notes.length === 0 ? {} : { verify: notes.join(' ') }), ...(notice === null ? {} : { notice }) };
}

module.exports = {
  id: '078',
  description: 'move the project from .workflows/ into the layout in .ledger/, the state worktree on an unborn ledger-state — each topic\'s log, mail, brief and experiments in its own folder, imports as assets, specs as reference, the old system\'s own files in the unit\'s cache, the retired state dropped; the roadmap as the product, the baseline docs as its assets, the tracker\'s store and the knowledge config in the state, the user-level settings and credentials copied to ~/.config/ledger/, and the project\'s files to the new names',
  info: 'The reshape moves the project\'s state out of .workflows/ into .ledger/, a worktree of its own unborn branch, ledger-state, committing nothing. Each topic\'s research, discussion and investigation become its log, its mail one sequence in its own folder, a cancelled topic\'s mail ideas in the inbox; research feeding several topics goes to a discovery session of the migration\'s, and a legacy split\'s superseded copies to the unit\'s assets as reference; imports become assets; every moved document\'s links follow the files they name; specs not yet built become reference assets, a completed quick-fix\'s spec its summary, a quick-fix whose scoping, implementation and review all completed counting as completed; a unit whose name breaks the kebab-case rule by its case alone is carried under its lowercase name, every reference the move writes following; the old engine\'s caches and the retired manifest state go; every file the old system\'s own agents and trackers wrote — the plans, the build\'s tracking and analysis, the reviews\' tracking and reports — is copied, as the old cache\'s reports are, into its unit\'s earlier/ in the state\'s ignored cache; and every other file with no place of its own is kept as it was under its unit\'s assets/legacy/, or the product\'s. A registry entry typed otherwise than its unit\'s manifest takes the manifest\'s type, listed among the review\'s corrections. The roadmap becomes .product/, its imports its assets, its sessions naming them there, and its items\' sources following their files; the baseline docs become reference in .product/assets/baseline/, a native, skipped or completed baseline remembered as the brownfield offer\'s answer, and with none, when the old state first entered git recorded, so the offer\'s judgment reads the history before then; the plan format and project skills defaults go, the session-label opt-in is renamed session_labels, and no driver is set, so the defaults serve; the old environment setup file\'s words become a note among the steps that prepare the environment, unconfirmed, for the first ready to build to show; the tracker\'s store and the checkout\'s knowledge config are carried into the state, the knowledge store left for the next boot to build. The user-level settings and credentials are copied into ~/.config/ledger/ where it lacks them, the engine\'s own kept, and the old folder is left as it was for projects still on today\'s skills. The code tree\'s .gitignore gains .ledger/, the settings hooks name the engine\'s new path, and .worktreeinclude loses its .workflows/ lines, none of it staged. .workflows/ and the tracker\'s store are left as they are until the migration\'s commit.',
  run({ projectDir, reportUpdate, reportSkip }) {
    return move(projectDir, reportUpdate, reportSkip);
  },
};

'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the records a brief is filled from (6.5.4, 13.11.2), each
// drawn in one fixed form, so what an agent is told is what the records
// say and nothing else (6.5.6):
//
//   task           the task's text whole, as the tracker holds it, each of
//                  its headings a level down, under the template's own; then
//                  each addition, in order, under a heading of its own saying
//                  whether the orchestrator or the person added it (13.11.3)
//   spec-sections  each section the task's spec reference cites, verbatim
//                  from the unit's spec (spec-sections.cjs)
//   decided-calls  the unit's current decisions at its own level, the
//                  person's and Claude's alike — the builder's own calls
//                  among them (13.11.10) — in the ledger's order, each one
//                  list item: its id, whose it is, its answer and why,
//                  every line after its first indented; a unit's record,
//                  drawn for a task's brief and a phase's alike
//   linters        the project's linters, each its name and its command,
//                  from the environment on the project manifest (22.5.12,
//                  environment.cjs)
//   diff-range     in each repository holding the task's branch, by the
//                  landing's rule (landing-git.cjs), under a heading naming
//                  the repository, the range from its base to the branch,
//                  `{base}...{branch}`, and its `git diff --stat` — never
//                  the diff's text, which can run to thousands of lines and
//                  is read in the range. The base is the engine's: where
//                  the task was laid out, the commit `task worktree`
//                  recorded there (task-worktree.cjs), or the tip of the
//                  work below it that its branch holds since, its own
//                  phase's chain for a task of the cut, whichever is
//                  later — else the branch the repository lands on; or,
//                  where `--base` names one, that branch where the
//                  repository has it, else the repository's default branch:
//                  a nested repository's may be named otherwise, and a
//                  stack's base branch be in some only
//   scratch-layout where the reviewer's scratch worktree lays out every
//                  repository of the project, each before those nested in
//                  it, as the builder's worktree held them all
//                  (task-worktree.cjs): one holding work on the task's
//                  branch at that branch, a submodule otherwise at the
//                  commit its holder as laid out points it at, a clone
//                  otherwise at the task's branch, or the branch it lands
//                  on where the task's branch is not made there; then the
//                  calls, by the engine's absolute path, that lay it out
//                  so at those commits, prepared as a builder's worktree
//                  is, and take it apart (scratch.cjs) — named for the
//                  reviewer, so its brief again lays out the same one
//   reports        the task's last review round's reports, one per
//                  reviewer of the count (13.3.4), each verbatim under a
//                  heading naming its reviewer (round-report.cjs), and
//                  nothing else; refused where the task changed since a
//                  brief to its builder last went past it, its brief going
//                  first, carrying the task and its calls as they stand;
//                  issued, it records what the builder's brief records
//   account-to     where the builder writes the task's account as it
//                  lands: the task's `build/tasks/{task}.md` (task-account.cjs,
//                  12.14), as `task account` reads it; then, once the task's
//                  review has ended — its last round passed, or settled, the
//                  settlement's text beneath — and no account written there
//                  covers it, that it has landed and its account is owed
//                  now, and where an account written there does not read,
//                  every fault, so a refused account goes back to its
//                  builder in its brief; but while the task changed under
//                  that round (round-report.cjs), that it changed, and its
//                  builder builds what changed for its pair to read again;
//                  and while a question parks it, that it waits, owing no
//                  account. Refused while a round its pair was briefed
//                  for is not reported whole, naming each reviewer's way
//                  on (round-report.cjs, `readRefusal`); issued, it
//                  records the freeing and the changes it went past
//   engine         the engine the builder runs, by the absolute path of the
//                  one filling the brief, in the checkout the orchestrator
//                  runs in, so a builder's worktree started at the remote's
//                  default branch never runs one older or missing there
//   chain          whether the task's branch holds its phase's chain as it
//                  stands: where the work below it (review-change.cjs) has
//                  moved past it in a repository holding the branch, the
//                  merge of that tip back onto it there, children first,
//                  each committed through the door before the next, a
//                  child's pointer staged at its merged tip; then the
//                  account where one is owed, reported accounted, else
//                  reported merged
//   setup-to       where the builder writes the verify setup its task
//                  builds or changes, for `verify setup --file`: the
//                  unit's `.cache/{unit}/build/verify-setup.json`, outside
//                  the checkout, as the setup's trial needs; then the setup
//                  recorded now, fenced as JSON without its run, which the
//                  file starts from, or that none is recorded yet
//   round-report-to where the reviewer `--letter` names writes its report
//                  of the round under review (13.5.9): the task's
//                  `round-{N}-{letter}.md`, N read from the task's reports
//                  on disk (round-report.cjs), so it holds across a
//                  `/clear` and for both reviewers of a round — a passed
//                  round read again in the round after where the task
//                  changed under it (round-report.cjs); a report there that
//                  does not read named as the one it replaces. Issued, it
//                  records the round its pair was briefed for, which a
//                  change marks itself against (round-report.cjs)
//
// A discussion topic's records, each read from the ledger as its read verb
// answers it (ledger-read.cjs) or from the topic's agent store
// (agent-state.cjs) — never a word of the conversation (26.1.5):
//
//   topic-record   the topic's record as `ledger record` answers it, its
//                  current entries each with what it replaced (9.2.5),
//                  fenced as JSON
//   topic-log      the path of the topic's log, `topics/{topic}/log.md`
//                  (9.2.10), for the agent to read
//   other-records  the record of each other live topic of the unit that
//                  shows anything, under a heading naming the topic — never
//                  its log, and none of a topic set aside (5.8.17, 9.3.4)
//   product-record the product record, and what discovery found of the
//                  product, the unit and the topic, as `ledger product`
//                  answers it for the topic — for a unit's brief, the
//                  unit's — fenced as JSON
//   question       the question `--question` names, by any wording, in its
//                  current wording: its short id and its text. It is an
//                  open question standing on the topic, and the dispatch
//                  `--agent` names is bound to it (agent-state.cjs)
//   pair-question  the question the perspectives of that synthesis
//                  dispatch's set were each briefed on, in its current
//                  wording — one question, so a synthesis reconciles what
//                  its pair argued
//   dive-kind      the kind of dive `--kind` names (survey, read,
//                  feasibility, landscape, verify), and for a read the path
//                  of the file `--path` names, which only a read takes
//   gap-review     whether a gap review has run since the topic's last
//                  decision, naming it where one has (9.9.6, agent-state.cjs)
//   dismissed      the names the person struck as candidates or removed
//                  from the map, the unit's answer that nothing proposes
//                  them again (8.10.11), one a line — a unit's record,
//                  drawn for a topic's brief and a unit's alike
//   report-to      where the agent writes its report: the file of the
//                  dispatch `--agent` names, of the kind its role is briefed
//                  for and still in flight
//   lens           the lens that perspective dispatch was labelled with
//   perspectives   the report of each perspective in that synthesis
//                  dispatch's set, verbatim, in the order they were
//                  dispatched
//
// The phase cut's records, each of the unit the brief is for, read from its
// `spec.md` by the spec's one grammar (spec-sections.cjs) and from the
// unit's entries (unit-entries.cjs):
//
//   spec-outline   the spec's path, then its areas, each with its parts, by
//                  address and title, in the spec's order
//   spec-scenarios each scenario by id, with the area it proves and its
//                  wording, the statements it draws on closing it
//   relies-on-graph each pair of the spec's parts where one relies on the
//                  other (11.5.6): a statement or a screen of part A cites
//                  an entry relying on one — in its current form, or
//                  through the unit's entries no line cites — that a line
//                  of part B cites, with each line and chain of entries
//                  that links them. A part citing nothing has no edges; nor
//                  has a cite naming none of the unit's entries, which the
//                  trace lists (spec-trace.cjs), so a link to another
//                  unit's entry is left out
//   cut-refusal    what `cut` refuses of the cut staged for the unit, as it
//                  says it, read without writing (cut.cjs); none recorded
//                  where nothing is staged or the cut would land
//   cut-to         where the agent writes the cut: the unit's staged cut
//   cut-requests   the unit's current decisions made at its own level at
//                  the spec since the last cut's brief that a land took —
//                  every one before any cut (spec-passes.cjs) — verbatim,
//                  each with where it stands and what it replaced: what
//                  the person asked of the cut among them; the brief keeps
//                  its own mark, a take the cut's land commits
//
// The sweep's records, each of the unit the brief is for (11.2.2), with the
// product record and the names struck, above:
//
//   unit-records   the unit's current entries (unit-entries.cjs), under a
//                  heading for each live topic by its title, its key in
//                  brackets after it, then the unit's own — those at its
//                  level — then any made there standing on another unit's
//                  place; each one list item, `{short id} {kind}: {text}`,
//                  a "don't care" decision's kind `decision, don't care`
//                  (P2), every line after its first indented; none
//                  recorded under a heading with none
//   sweep-refusal  what `sweep take` refuses of the unit's sweep report, as
//                  it says it, read without writing (sweep-take.cjs); none
//                  recorded where no report is written or it would be taken
//   sweep-to       where the agent writes its report: the unit's sweep
//                  report (sweep.cjs); refused once the sweep is taken, one
//                  sweep for the spec, naming approve the map where its
//                  candidates wait on the person
//
// The spec's records, each of the unit the brief is for, with its records,
// above, from its entries (unit-entries.cjs), its `spec.md` read by the
// spec's one grammar (spec-sections.cjs) and its loop (spec-passes.cjs):
//
//   topic-logs     the path of each live topic's log, a bugfix's its
//                  investigation, as the spec's entry reads them
//                  (spec-entry.cjs)
//   canonical-assets the path of each file the unit's current entries link
//                  as canonical (11.6.3)
//   builder-calls  the calls the sweep left to the builder (sweep.cjs),
//                  each with why
//   changed-entries the unit's current entries waiting for the writer —
//                  made at its own level at the spec since the last take a
//                  land committed (spec-passes.cjs) — each with where it
//                  stands and what it replaced
//   land-refusal   what `spec land` refuses of `spec.md` as written, as it
//                  says it (spec-land.cjs); none recorded where none is
//                  written or it would land
//   review-findings the report of each pass waiting for the writer,
//                  verbatim; the writer's brief keeps what it took, the
//                  wording file it carried among it, a take the next land
//                  commits (spec-passes.cjs)
//   wording-changes the wording the person agreed on the review page, the
//                  file `--wording` names verbatim, one change a line, each
//                  naming its line (11.11); none recorded where no file is
//                  named
//   spec-to        where the writer writes: the unit's `spec.md`
//   changed-sections the spec's path, then the sections the review's pass
//                  reads, each verbatim, the title and introduction one of
//                  them, an area's own text without its parts: every one at
//                  the first pass, then those changed since the last pass
//                  reported, and those gone; the dispatch `--agent` names is
//                  bound to the land it reviews, and closed where the brief
//                  is refused before it is bound
//   invented-lines each statement and screen of `spec.md` that does not
//                  trace, with why (spec-trace.cjs); none recorded where
//                  none is written or its grammar refuses it
//   measured-findings each of the unit's current findings recording the
//                  command that measured it, with its result
//   product-cites  each product-wide entry of the unit the spec cites, with
//                  the lines citing it
//   report-refusal each pass refused since the last whose report was taken
//                  in, with what of its report did not read (agent-state.cjs)
//   unit-report-to where the agent writes its report: the file of the
//                  dispatch `--agent` names in the unit's agent store — a
//                  validation's, its investigation's — of the kind its role
//                  is briefed for and still in flight
//   investigation  for a bugfix, what its spec is assembled from (19.4.15):
//                  the root cause and the fix its investigation rests on,
//                  each where it rests on one (investigation-log.cjs), and
//                  the rules it keeps — the investigation's other current
//                  decisions at its topic, never a permission for the
//                  hunt asked at its own level, `{unit}.investigation`
//                  (19.4.20) — each by its short id and its text; none
//                  recorded for any other type
//
// A bugfix's validations' records, each of the unit the brief is for, its
// investigation open (investigation-log.cjs, 19.4.7):
//
//   hunt-log       the path of its investigation's log, the topic's
//                  (19.4.3), for the agent to read
//   hunt-record    its topic's record as `ledger record` answers it, fenced
//                  as JSON
//   hunt-root-cause the root cause its investigation rests on, by its short
//                  id with its text; refused where it rests on none
//   hunt-fix       the fix it rests on, the current answer of the fix
//                  direction's question, by its short id with its text,
//                  then that question; refused likewise
//   code           each repository of the project, by its absolute path,
//                  where the code is read as it stands
//
// A build phase's records, each of the phase of the unit's cut the brief is
// for (11.5), its tasks read from the tracker — each phase to it as its
// list, its own phase's tasks whole, once (task-verbs.cjs) — its sections
// and scenarios from the unit's `spec.md`, never the whole spec (12.5.6,
// 11.3.6):
//
//   cut-phase      the phase as the cut holds it: its number, the unit and
//                  its name, its goal, and what it relies on, an earlier
//                  phase by its number or another unit by its name
//   phase-sections the spec's path; each section the phase names, and
//                  whether it is first built in this phase or an earlier
//                  one — the phase that builds a section being the first
//                  naming it, a part of it or the area holding it (11.5.2),
//                  so an invariant in one first built here is this phase's
//                  to check (15.8.2); then each verbatim, in the cut's
//                  order, a part whose own area the phase names left to the
//                  area
//   phase-scenarios each scenario the phase holds, by id with its wording
//   held-notes     the notes for later held for this phase (12.9.10,
//                  notes.cjs), each verbatim under its heading
//   written-tasks  the phase's tasks the tracker holds so far, each by its
//                  number with its title and where it stands; or that the
//                  phase is not written in the tracker yet
//   earlier-tasks  every task of an earlier phase not yet ended, likewise,
//                  which a task of this phase may wait on (12.6.4)
//   build-calls    the unit's current decisions made in the build — at
//                  `{unit}.implementation` or `{unit}.review` — the
//                  person's and Claude's, in the ledger's order, each with
//                  the task it was made for and what it replaced
//   affected-entries the entries waiting in the unit for a replacement they
//                  rely on (11.9.1), as `ledger affected` answers them
//                  (ledger-affected.cjs), fenced as JSON
//   task-files-to  the folder in the unit's cache the agent writes each
//                  task's file in, for `task create --file`: the phase's,
//                  `.cache/{unit}/build/phase-{N}/{role}`, the task writer's
//                  apart from the consolidation agent's
//   reproducing-test for a bugfix's phase 1, that its first task, 1.1,
//                  writes the test that reproduces the bug and nothing else,
//                  of type `test`, holding the phase's scenario the bug
//                  breaks, and names the command that runs that test alone
//                  (bug-proven.cjs, 15.5.1), the fix linked after it and
//                  every other task of the phase after the fix; for any
//                  other phase, that it has none
//   phase-notes    the notes the phase has to take at its end (notes.cjs),
//                  each verbatim under its heading
//   phase-tasks    each task of the phase, whole, as `task` draws it, under
//                  a heading naming its number, with where it stands
//   phase-criteria each task of the phase not closed: its acceptance
//                  scenarios, then each addition, under a heading naming the
//                  task
//   relied-on      each phase the phase relies on (12.11.2): its name, goal
//                  and sections, and its tasks with where each stands; and
//                  each other unit it relies on, by its name
//   phase-diff-range in each repository holding work on the branch of a task
//                  of the phase not closed, under a heading naming it, the
//                  range from its base — the branch the repository lands
//                  on, where the phase's chain leaves it, where none is
//                  named, else as diff-range picks it — to the stack's tip
//                  there — the branch every other the phase's
//                  tasks hold there descends from — `{base}...{tip}`, and its
//                  `git diff --stat`, never the diff's text
//   phase-scratch-layout the phase review's scratch worktree, laid out as
//                  scratch-layout lays it out, one holding work at the
//                  stack's tip there, a clone holding none at the branch
//                  it lands on
//   recorded-runs  each scenario the phase holds, by id with what its runs
//                  of the change prove read at the phase's tips — the
//                  stack's tip in each repository holding its work, as
//                  phase-diff-range picks it — so the runs nearest them
//                  decide (runs.cjs, 15.3.5); then each run counted, its
//                  verdict, when it was recorded and its file
//   mutants        what survived the verify setup's mutation tool on the
//                  lines the phase changed, each by its path and line with
//                  its mutant, as `verify mutants` left it in the unit's
//                  cache run at the phase's tips (verify.cjs, 15.6.3); that
//                  none survived; or that the setup names no mutation tool.
//                  The brief never runs the tool
//   phase-report-to where the reviewer `--letter` names writes its report
//                  of the phase review: the phase's `review-{letter}.md`,
//                  likewise
//   consolidation-to where the consolidation agent writes its report: the
//                  phase's `consolidation.md` (notes.cjs)
//
// The review phase's records, each of the unit the brief is for, in the
// round under review (review-phase.cjs): an area's, the area `--area`
// names by its number, never merged with another (14.2.3); the change's,
// the whole change across every repository (review-change.cjs):
//
//   area-sections  the spec's path, then the area verbatim, its parts in it
//   area-meets     the spec's other areas, by number and title; then each
//                  pair of parts, one in the area and one outside it, where
//                  one relies on the other, as relies-on-graph draws them
//   unit-calls     every current decision of the unit's, at any of its
//                  places, in the ledger's order, each with whose it is,
//                  how the person handed it over where they did, where it
//                  was made, the question it answers and why — the ledger
//                  whole, for calls fine alone and wrong in combination
//                  (16.17.8, P18)
//   change-commits in each repository holding the change, under a heading
//                  naming it, the unit's own work, never what others
//                  landed beside it: each landing, `{commit}` and its
//                  subject, read against its first parent, then the work
//                  not landed, `{from}..{tip}`, read from where its stack
//                  leaves the base — each with its `git diff --stat`, the
//                  base the branch `--base` names where the repository has
//                  it
//   change-scratch-layout the reviewer's scratch worktree, laid out as
//                  scratch-layout lays it out, one holding the change at
//                  its tip there, a clone holding none at the branch it
//                  lands on
//   area-runs      each scenario of the area, by id with what its runs
//                  prove at the change's tips, and its wording; then each
//                  run counted, as recorded-runs draws it (15.3.3)
//   area-report-to where the reviewer `--letter` names writes its report
//                  of the area in the round under review:
//                  `review/round-{N}/{area}-{letter}.md`; refused for an
//                  area the round does not read (14.3.3)
//   tests-report-to where the test surface's one reader writes its report
//                  of the round: `review/round-{N}/tests-a.md` (14.2.4);
//                  refused where the round does not read it
//
// Each is refused where the round cannot be read: the review phase cannot
// be entered, a round ended it, the round before's fix tasks wait, or a
// later round's areas are not named (review-phase.cjs, `roundRefusal`).
//
// The plain-search helper's one record is the conversation's (22.6.10):
//
//   knowledge-query the conversation's last `knowledge query`, as it kept
//                  it (knowledge/last-query.cjs): its terms, its filters,
//                  and what it returned, or that it failed and why, or that
//                  it never finished
//
// The migration's records, for the agents of its records directive, each of
// a topic `--topic` names, `<unit>.<phase>.<topic>`, as the migration moved
// it — a topic of a unit cancelled among them (21.6.2):
//
//   directive      the migration's directive `--directive` names, verbatim,
//                  each of its headings a level down (21.10.2)
//   migrated-topic the topic: the unit, its work type and status, the
//                  phases the records directive carries a topic of that
//                  the topic is in, the state's place and the project's in
//                  the main checkout, each file of the topic's folder but
//                  its mail, and as the records directive's check reads
//                  them its specs — each where it is read and how it is
//                  cited — its old map and its research's threads still
//                  open; the unit's assets with where each came in from,
//                  the topic's to link, or its file gone and linked by
//                  none; and where the topic's record is composed, the
//                  verifier's findings on it written and a carry's refusal
//                  of it kept (21.10.5)
//   composed-record that topic's record as composed, fenced as JSON (21.10.7)
//   verifier-findings the verifier's findings on that record, verbatim
//   carry-refusal  what `ledger carry` refused that record for, verbatim
//
// The brief takes the findings and the refusal: drawn, each file is cleared,
// so neither reaches a later brief.
//
// A record taking a flag names it, and its role takes every flag its records
// name, once, and no other — every one but a flag a record holds optional;
// a flag carries a name, an id or a path, never text that reaches the brief
// (6.5.6). A record the project holds none of
// yet is drawn as none recorded. One that cannot be read refuses the brief:
// a task with no spec reference, a section the spec lacks, linters of
// another shape, a task's branch no repository holds work on, a base no
// repository holding it has as a local branch, a phase's sections or
// scenarios the spec lacks, a phase not yet written whose tasks or range a
// record draws, a task of it with no type, its tasks held as no one stack in
// a repository, no repository holding work on them, no verify setup
// recorded, a tool that has not run over the phase at its tips, a letter
// none of the reviewers',
// a report already written for its round that reads, a task whose review
// passed — a task with no review
// round's reports, a round missing a reviewer's report or holding one
// that does not read, a last round that passed; a review phase that cannot
// be entered or is over, a round waiting on the round before's fix tasks,
// an area the spec lacks or the round does not read, a change no
// repository holds; a question that is none, no longer current,
// stands elsewhere or is not open, or one its dispatch was not first briefed
// on; a dispatch the topic's store lacks, of another kind, no longer in
// flight; a perspective of the set with no report, or briefed on no question
// or another than its pair; a dive of no kind, a read naming no file, another
// kind naming one; a conversation that has run no knowledge query; a
// directive the migrations lack, a migrated topic its unit lacks, a composed
// record missing or empty; a unit with no spec, or one its grammar refuses;
// a unit the land refuses, or whose spec waits on a gap put to the person,
// for its writer; and for its reviewer, a spec that has not landed as
// written, one unchanged since a pass reported, and a dispatch bound to
// another landing. Nothing else of the project reaches a brief — its
// CLAUDE.md and its skills reach the agent without it (6.5.5).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { git } = require('../kernel/git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { projectRepos } = require('../kernel/repos.cjs');
const { linters, verifySetup } = require('./environment.cjs');
const { readShown, readLedgerVerb } = require('./ledger-read.cjs');
const {
  recordOf, standingOf, factsOf, wordingOf, inPlace, questionStands, currentsOf,
} = require('./ledger-fold.cjs');
const { resolveId } = require('./ledger-ids.cjs');
const { manifestOf, liveTopics } = require('./ledger-units.cjs');
const { topicLog } = require('./topic-log.cjs');
const { dismissedNames, topicTitle, cutPhases } = require('./derivations.cjs');
const {
  UNIT_PHASE, dispatchedRows, gapReviewSince, bindQuestion, bindSpec, closeUnbriefed, refusedReports,
} = require('./agent-state.cjs');
const { lastQuery } = require('./knowledge/last-query.cjs');
const { ROLES } = require('./brief-names.cjs');
const {
  SPEC_FILE, readCitedSections, headingLevels, readSpec, specPath, specSections, specStatements,
} = require('./spec-sections.cjs');
const { withUnitEntries, unitEntries } = require('./unit-entries.cjs');
const { huntOf, huntLog, huntEntries, openInvestigation } = require('./investigation-log.cjs');
const { specTopics } = require('./spec-standing.cjs');
const { sweepPath, builderCalls, sweepTaken, sweepWait } = require('./sweep.cjs');
const { sweepRefusal } = require('./sweep-take.cjs');
const { stagedCutPath, stagedCutRefusal } = require('./cut.cjs');
const { inventedLines } = require('./spec-trace.cjs');
const { specSources } = require('./spec-entry.cjs');
const { landRefusal, unitRefusal } = require('./spec-land.cjs');
const { heldPlaces } = require('./spec-review.cjs');
const {
  ownTexts, recordTaking, recordCutTaking, outstanding, cutRequests, reviewedSpec, sectionsToReview, waitingGaps, gapsWaiting, passesRunningOn, waitingOn,
} = require('./spec-passes.cjs');
const { messageOf, ENGINE_RUN } = require('../kernel/call.cjs');
const { specReferenceOf, scenariosOf } = require('./task-file.cjs');
const {
  taskFolder, taskRounds, roundReportPath, roundUnderReview, phaseReviewPath, reportFaults, roundStanding, readRefusal, recordReviewer, recordBuilder, pendingChange, briefedOf,
} = require('./round-report.cjs');
const { builtOnBases } = require('./task-base.cjs');
const { freedAt } = require('./task-parks.cjs');
const { reviewReportFaults } = require('./review-report.cjs');
const { REVIEWER_LETTERS } = require('../kernel/reviewers.cjs');
const { taskName, shownTask, phaseName } = require('./task-id.cjs');
const { taskBranch } = require('./landing-names.cjs');
const { branches, branchesHeldBy, holdingBranch, landsOn, latestOf, quoted } = require('./landing-git.cjs');
const { childrenFirst } = require('../kernel/repos.cjs');
const { heldIn, pointedAt } = require('./project-layout.cjs');
const { repoNamed, phaseStack, tipCommits } = require('./phase-stack.cjs');
const { readWorkUnitManifest } = require('../kernel/manifest-io.cjs');
const { BUILD_PHASES } = require('../kernel/manifest-schema.cjs');
const { ENDED, STATUS_WORDS } = require('./task-verbs.cjs');
const { notesToTake, notesHeldFor, consolidationPath } = require('./notes.cjs');
const { runsOf } = require('./runs.cjs');
const { cachedSurvivors } = require('./verify.cjs');
const { REPRODUCING, isBugfix } = require('./bug-proven.cjs');
const { scratchName } = require('./scratch.cjs');
const { accountPath, accountOwed, landingStage, reviewOverWay } = require('./task-account.cjs');
const { directiveOf } = require('./directives.cjs');
const {
  TESTS, TESTS_LETTER, roundRefusal, readsWords, areaReportPath, unitCalls, fixPhase, filesUnder,
} = require('./review-phase.cjs');
const { reviewHeld } = require('./review-entry.cjs');
const { reading, reposOf } = require('./phase-checks.cjs');
const { changeOf, changeTips, workBelow } = require('./review-change.cjs');
const { topicPlace, recordsRules, composedPath, findingsPath, refusedPath } = require('./ledger-carry.cjs');

/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./drivers.cjs').TaskRow} TaskRow */
/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */
/** @typedef {import('./runs.cjs').RepoCommit} RepoCommit */

/** A discussion topic of a unit. @typedef {{unit: string, topic: string}} TopicPlace */

/**
 * What a brief is filled for: the project; its role; the task where its
 * role takes one, as the tracker holds it, the phase where it takes one,
 * with every task of each phase to it as the tracker holds them — null for
 * a phase not written — or the topic where it takes one; the unit of any,
 * or the unit alone where its role takes that; each flag given, by its
 * name; and the conversation it is issued in.
 * @typedef {{
 *   cwd: string, role: string, ref: TaskRef|null, task: TaskDetail|null, phase: number|null, phases: (TaskRow[]|null)[]|null, written: TaskDetail[]|null, place: TopicPlace|null, unit: string|null,
 *   given: Readonly<Record<string, string>>, session: string,
 * }} Filling
 */

/**
 * A flag a record takes: its name, its value as a usage line shows it, and
 * whether a brief may go without it.
 * @typedef {{name: string, value: string, optional?: boolean}} BriefFlag
 */

/**
 * A record: whether it is a task's, a phase's, a topic's, a unit's or none's, the
 * flags it takes, its drawn form, what it binds once every record of the
 * brief is drawn, and what it closes where the brief is refused; what a
 * read said on the way pushed to `warnings`.
 * @typedef {{
 *   of: 'task'|'phase'|'topic'|'unit'|null, flags?: BriefFlag[], draw: (filling: Filling, warnings: string[]) => string, bind?: (filling: Filling, warnings: string[]) => void,
 *   refused?: (filling: Filling) => void,
 * }} BriefRecord
 */

const NONE = 'None recorded.';

/** Whose an entry is, as a brief says it. @type {Readonly<Record<string, string>>} */
const WHOSE = Object.freeze({ person: 'the person\'s', claude: 'Claude\'s' });

/** A drawn list, a line an item, or none recorded. @param {string[]} items */
function listed(items) {
  return items.length === 0 ? NONE : items.join('\n');
}

/** Drawn blocks, a blank line between each, or none recorded. @param {string[]} items */
function blocks(items) {
  return items.length === 0 ? NONE : items.join('\n\n');
}

/** The task, and the ref it was read by, for a record that is a task's. @param {Filling} filling */
function taskOf({ ref, task }) {
  if (ref === null || task === null) throw new Error('brief-records: a task\'s record is drawn for a task');
  return { ref, task };
}

/** Markdown with each heading a level down, a fenced block's lines aside. @param {string} text */
function headingsDown(text) {
  const lines = text.split('\n');
  const levels = headingLevels(lines);
  return lines.map((line, at) => (levels[at] > 0 ? `#${line}` : line)).join('\n');
}

/** Text whose every line after its first is indented, to stay in a list item. @param {string} text */
const indented = (text) => text.split('\n').join('\n  ');

/** @param {Filling} filling */
function drawTask(filling) {
  const { task } = taskOf(filling);
  return [headingsDown(task.text), ...task.additions.map(({ by, text }) => `## Added by the ${by}\n\n${text}`)].join('\n\n');
}

/** @param {Filling} filling */
function drawSpecSections(filling) {
  const { ref, task } = taskOf(filling);
  const reference = specReferenceOf(task.text);
  if (reference === null) throw new Error(`${taskName(ref)} holds no spec reference`);
  return readCitedSections(filling.cwd, ref.unit, reference).map((section) => section.text).join('\n\n');
}

/** @param {Filling} filling @param {string[]} warnings */
function drawDecidedCalls(filling, warnings) {
  const unit = unitOf(filling);
  return readShown(stateRoot(filling.cwd), warnings, ({ folded, show }) => listed(
    recordOf(folded, unit, null).decisions
      .filter((id) => standingOf(folded, id).topic === null)
      .map((id) => {
        const { id: short, by, text, why } = show(id);
        return `- ${short}, ${WHOSE[/** @type {string} */ (by)]}: ${indented(String(text))}\n  Why: ${indented(String(why))}`;
      }),
  ));
}

/** @param {Filling} filling */
function drawLinters({ cwd }) {
  return listed(linters(cwd).map(({ name, command }) => `- ${name}: ${command}`));
}

// Named from the repo's folder, a root inside a larger repository reading
// only its own. Off a terminal git fits a stat to 80 columns, cutting a long
// path from its front; a width past any path keeps each whole, and the graph
// is held to git's own 40 columns, which the width would otherwise stretch.
const STAT = ['--relative', '--stat=1000', '--stat-graph-width=40'];

/**
 * The range in one repository, under a heading naming it, and its stat.
 * @param {Repo} repo @param {string} base @param {string} branch
 */
function rangeIn(repo, base, branch) {
  const where = repoNamed(repo);
  const commit = /^[0-9a-f]{40}$/.test(base);
  const stat = git(repo.path, ['diff', '--no-color', ...STAT, `${commit ? base : `refs/heads/${base}`}...refs/heads/${branch}`, '--']);
  return `## In ${where}: \`${commit ? base.slice(0, 7) : base}...${branch}\`\n\n${stat === '' ? 'Nothing changed in the range.' : `\`\`\`\n${stat}\`\`\``}`;
}

/**
 * Each repository's base for the range: the one given where it is a local
 * branch there, else the repository's default branch, as the landing picks
 * it; refused where no repository has the one given, so a misnamed base
 * never passes as the default.
 * @param {string} cwd @param {Repo[]} holding @param {string} given @param {string} what the branch, as a refusal names it
 */
function basesOf(cwd, holding, given, what) {
  const has = holding.map((repo) => branches(repo.path).has(given));
  if (!has.includes(true)) throw new Error(`the base ${given} is no local branch in any repository holding ${what}`);
  return holding.map((repo, at) => (has[at] ? given : landsOn(cwd, repo)));
}

/** Where a repository is laid out: what the brief names, its commit, and why there. @typedef {{named: string, commit: string, why: string}} Laid */
/** Why a repository holding a task's or a phase's work is laid out at its tip. */
const RANGE_TIP = 'the range\'s tip there';

/** A repository laid out on a branch. @param {Repo} repo @param {string} branch @param {string} why @returns {Laid} */
const onBranch = (repo, branch, why) => ({ named: branch, commit: git(repo.path, ['rev-parse', '--verify', `refs/heads/${branch}^{commit}`]).trim(), why });

/**
 * Where the reviewer's scratch worktree lays out every repository of the
 * project, each before those nested in it, as the builder's worktree held
 * them all (task-worktree.cjs): one holding work at its tip there, as
 * `tipped` says it; a submodule otherwise at the commit its holder, as laid
 * out, points it at; any other as `otherwise` lays it out. Then the calls
 * that lay the scratch worktree `name` out so, prepared, and take it apart
 * (scratch.cjs).
 * @param {Repo[]} repos @param {Map<Repo, string>} tips each repository holding work's tip branch @param {string} tipped why one is laid out at its tip
 * @param {(repo: Repo) => Laid} otherwise @param {string} name
 */
function layoutOf(repos, tips, tipped, otherwise, name) {
  /** @type {Map<string, string>} */
  const laid = new Map();
  const lines = repos.map((repo) => {
    const place = laidOut(repos, repo, { tips, tipped }, laid, otherwise);
    laid.set(repo.dir, place.commit);
    return `- ${repoNamed(repo)}: \`${place.named}\` — ${place.why}`;
  });
  const children = repos.slice(1).map((repo) => ` ${quoted(`${repo.dir}=${laid.get(repo.dir)}`)}`).join('');
  return [
    lines.join('\n'),
    '',
    'Lay it out from the project\'s checkout with the first call below, which prepares it as the project\'s own checkout is, its ignored files and linked folders among it; its answer\'s `path` is the project\'s folder there. Take it apart with the second once your report is written.',
    '',
    '```bash',
    `${ENGINE_RUN} scratch lay ${name} ${laid.get('')}${children}`,
    `${ENGINE_RUN} scratch remove ${name}`,
    '```',
  ].join('\n');
}

/**
 * @param {Repo[]} repos @param {Repo} repo @param {{tips: Map<Repo, string>, tipped: string}} held @param {Map<string, string>} laid each laid out before it, its commit by folder
 * @param {(repo: Repo) => Laid} otherwise
 * @returns {Laid}
 */
function laidOut(repos, repo, { tips, tipped }, laid, otherwise) {
  const tip = tips.get(repo);
  if (tip !== undefined) return onBranch(repo, tip, tipped);
  if (repo.dir === '' || !heldIn(repos, repo).submodule) return otherwise(repo);
  const { holder } = heldIn(repos, repo);
  const commit = pointedAt(repos, repo, /** @type {string} */ (laid.get(holder.dir)));
  return { named: commit, commit, why: `a submodule, at the commit ${repoNamed(holder)} points it at as laid out` };
}

/**
 * The project's repositories, the task's branch, and those of them holding
 * work on it; refused where none does.
 * @param {Filling} filling @returns {{repos: Repo[], branch: string, holding: Repo[], what: string}}
 */
function taskHolding(filling) {
  const { ref, task } = taskOf(filling);
  if (task.type === null) throw new Error(`${taskName(ref)} has no type in the tracker, and its branch is named from it`);
  const branch = taskBranch(ref, task.type, task.title);
  const what = `${taskName(ref)}'s branch, ${branch}`;
  const repos = projectRepos(codeRoot(filling.cwd));
  const { holding } = holdingBranch(ref.unit, repos, branch);
  if (holding.length === 0) throw new Error(`no repository of the project holds work on ${what}`);
  return { repos, branch, holding, what };
}

/** @param {Filling} filling */
function drawDiffRange(filling) {
  const { ref } = taskOf(filling);
  const { branch, holding, what } = taskHolding(filling);
  const { base } = filling.given;
  const bases = base === undefined ? builtOnBases(filling.cwd, ref, holding, branch) : basesOf(filling.cwd, holding, base, what);
  return holding.map((repo, at) => rangeIn(repo, bases[at], branch)).join('\n\n');
}

/** @param {Filling} filling */
function drawScratchLayout(filling) {
  const { ref } = taskOf(filling);
  const { repos, branch, holding } = taskHolding(filling);
  return layoutOf(repos, new Map(holding.map((repo) => [repo, branch])), RANGE_TIP, (repo) => (
    branches(repo.path).has(branch) ? onBranch(repo, branch, 'the task\'s branch') : onBranch(repo, landsOn(filling.cwd, repo), 'the branch it lands on, the task\'s branch not made there')
  ), scratchName.task(ref.unit, shownTask(ref), letterOf(filling)));
}

/**
 * The task's last round's reports, refused where it has none, or the round
 * passed: a round with nothing serious and no bug sends nothing back to the
 * builder, its nits the orchestrator's to fix (13.4.4, 13.4.5); where no
 * builder of the task was sent its own brief in this conversation, a new
 * one sent it first (24.2.4); and where the task changed since its
 * builder's last brief, which carries the task and its calls as they stand
 * and goes first (round-report.cjs).
 * @param {Filling} filling
 */
function drawReports(filling) {
  const { ref } = taskOf(filling);
  const rounds = taskRounds(filling.cwd, ref);
  const last = rounds.at(-1);
  if (last === undefined) throw new Error(`${taskName(ref)} has no review round's reports — its reviewers write them in ${taskFolder(ref)}/`);
  if (last.passes) throw new Error(`round ${last.round} of ${taskName(ref)} passed — a round with nothing serious and no bug sends nothing back to the builder; its nits are the orchestrator's to fix`);
  if (briefedOf(filling.cwd, ref).session !== filling.session) {
    throw new Error(`${taskName(ref)} has no builder briefed in this conversation, so none to send the round back to: send a new builder its brief first, engine brief builder ${ref.unit} ${shownTask(ref)}, which carries the task, the engine and where it builds, then this fix brief`);
  }
  if (pendingChange(filling.cwd, ref)) {
    throw new Error(`${taskName(ref)} changed since its builder's last brief — something was added to it, or one of its calls decided against its lean: send its builder its brief again first, engine brief builder ${ref.unit} ${shownTask(ref)}, which carries the task and its calls as they stand, then this fix brief`);
  }
  return last.reports.map(({ reviewer, text }) => `# Reviewer ${reviewer.toUpperCase()}'s report\n\n${text}`).join('\n\n');
}

/** The topic a topic's record is drawn for. @param {Filling} filling @returns {TopicPlace} */
function placeOf({ place }) {
  if (place === null) throw new Error('brief-records: a topic\'s record is drawn for a topic');
  return place;
}

/** Text fenced, the fence longer than any run of backticks the text holds. @param {string} lang @param {string} text */
function fenced(lang, text) {
  const fence = '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map(([run]) => run.length + 1)));
  return `${fence}${lang}\n${text}\n${fence}`;
}

/**
 * A ledger read's answer, what the read warned of pushed to `warnings`.
 * @param {string} cwd @param {string} verb @param {string[]} args @param {string[]} warnings
 * @returns {Record<string, any>}
 */
function ledgerRead(cwd, verb, args, warnings) {
  const { warnings: read = [], ...answer } = readLedgerVerb(cwd, verb, args);
  warnings.push(.../** @type {string[]} */ (read));
  return answer;
}

/** What a record or the product record shows, by the lists it shows them in. */
const SHOWN = ['questions', 'findings', 'decisions', 'moved', 'merged', 'other_topics', 'discovery'];

/** A read record fenced as JSON, or none recorded where it shows nothing. @param {Record<string, any>} record */
function recordJson(record) {
  return SHOWN.some((list) => Array.isArray(record[list]) && record[list].length > 0) ? fenced('json', JSON.stringify(record, null, 2)) : NONE;
}

/** @param {Filling} filling @param {string[]} warnings */
function drawTopicRecord(filling, warnings) {
  const { unit, topic } = placeOf(filling);
  return recordJson(ledgerRead(filling.cwd, 'record', [unit, topic], warnings));
}

/** @param {Filling} filling */
function drawTopicLog(filling) {
  const { unit, topic } = placeOf(filling);
  const file = statePath(filling.cwd, topicLog(unit, topic));
  return fs.existsSync(file) ? `\`${file}\`` : NONE;
}

/** @param {Filling} filling @param {string[]} warnings */
function drawOtherRecords(filling, warnings) {
  const { unit, topic } = placeOf(filling);
  const others = liveTopics(unit, /** @type {Record<string, any>} */ (manifestOf(stateRoot(filling.cwd), unit))).filter((other) => other !== topic);
  const drawn = others.map((other) => ({ other, json: recordJson(ledgerRead(filling.cwd, 'record', [unit, other], warnings)) })).filter(({ json }) => json !== NONE);
  return drawn.length === 0 ? NONE : drawn.map(({ other, json }) => `## ${other}\n\n${json}`).join('\n\n');
}

/** @param {Filling} filling @param {string[]} warnings */
function drawProductRecord(filling, warnings) {
  const scope = filling.place === null ? [unitOf(filling)] : [filling.place.unit, filling.place.topic];
  return recordJson(ledgerRead(filling.cwd, 'product', scope, warnings));
}

/** A question as a brief draws it: its short id and its text. @param {(id: string) => Record<string, unknown>} show @param {string} wording */
function questionLine(show, wording) {
  const { id: short, text } = show(wording);
  return `${short}: ${indented(String(text))}`;
}

/**
 * The question each fill asked for: its first wording, and its line.
 * @type {WeakMap<Filling, {root: string, line: string}>}
 */
const ASKED = new WeakMap();

/**
 * The open question `--question` names on the topic, read once a fill:
 * its first wording, and its current wording's line.
 * @param {Filling} filling @param {string[]} warnings
 */
function askedQuestion(filling, warnings) {
  const known = ASKED.get(filling);
  if (known !== undefined) return known;
  const { unit, topic } = placeOf(filling);
  const given = filling.given.question;
  const asked = readShown(stateRoot(filling.cwd), warnings, ({ folded, show }) => {
    const id = resolveId(given, folded.facts.keys());
    if (factsOf(folded, id).kind !== 'question') throw new Error(`brief: ${given} names no question — --question takes a question on ${unit}/${topic}'s map`);
    const wording = wordingOf(folded, id);
    if (wording === null) throw new Error(`brief: question ${given} is no longer current`);
    const standing = standingOf(folded, wording);
    if (!inPlace(standing, unit, topic)) throw new Error(`brief: question ${given} stands on ${standing.unit}/${standing.topic ?? '(the unit\'s level)'}, not ${unit}/${topic}`);
    const stands = questionStands(folded, wording);
    if (stands !== 'open') throw new Error(`brief: question ${given} is ${stands} — a deep dive or a perspective is briefed on an open question`);
    return { root: factsOf(folded, wording).root, line: questionLine(show, wording) };
  });
  ASKED.set(filling, asked);
  return asked;
}

/** @param {Filling} filling @param {string[]} warnings */
function drawQuestion(filling, warnings) {
  return askedQuestion(filling, warnings).line;
}

/** The dispatch `--agent` names bound to the question its brief draws. @param {Filling} filling @param {string[]} warnings */
function bindAsked(filling, warnings) {
  const { unit, topic } = placeOf(filling);
  bindQuestion(filling.cwd, unit, topic, filling.given.agent, askedQuestion(filling, warnings).root);
}

/** @param {Filling} filling */
function drawGapReview(filling) {
  const { unit, topic } = placeOf(filling);
  const run = gapReviewSince(filling.cwd, unit, topic);
  return run === null ? 'No gap review has run since this topic\'s last decision.' : `A gap review has run since this topic's last decision: ${run}.`;
}

/** @param {Filling} filling */
function drawDismissed(filling) {
  return listed(dismissedNames(readWorkUnitManifest(stateRoot(filling.cwd), unitOf(filling))).map((name) => `- ${name}`));
}

/**
 * The agent store a brief's dispatch is in, and how a refusal names it: the
 * topic's discussion store, or for a unit's role the unit's own — at its
 * spec, or at the phase its role names.
 * @param {Filling} filling @returns {{unit: string, phase: string, topic: string, where: string}}
 */
function storeOf(filling) {
  if (filling.place !== null) return { ...filling.place, phase: 'discussion', where: `${filling.place.unit}/${filling.place.topic}` };
  const unit = unitOf(filling);
  const phase = ROLES[filling.role].phase ?? UNIT_PHASE;
  return { unit, phase, topic: unit, where: phase === UNIT_PHASE ? `${unit}'s spec` : `${unit}'s ${phase}` };
}

/**
 * The dispatch `--agent` names in its agent store, refused where the store
 * lacks it, it is of another kind than its role is briefed for, or it is no
 * longer in flight; and every row of the store.
 * @param {Filling} filling
 */
function dispatchOf(filling) {
  const {
    unit, phase, topic, where,
  } = storeOf(filling);
  const { kind } = ROLES[filling.role];
  const id = filling.given.agent;
  const rows = dispatchedRows(filling.cwd, unit, phase, topic);
  const row = rows.find((dispatched) => dispatched.id === id);
  if (row === undefined) throw new Error(`brief: ${where} has no agent ${id} — \`engine agent dispatch\` records one, and --agent names the id it answers`);
  if (row.kind !== kind) throw new Error(`brief: ${id} is a ${row.kind} dispatch, and the ${filling.role}'s brief is for a ${kind}`);
  if (row.status !== 'in-flight') throw new Error(`brief: ${id} is ${row.status} — a brief is issued for a dispatch still in flight`);
  return { row, rows };
}

/** @param {Filling} filling */
function drawReportTo(filling) {
  return `\`${dispatchOf(filling).row.file}\``;
}

/** @param {Filling} filling */
function drawLens(filling) {
  return `\`${dispatchOf(filling).row.label}\``;
}

/** The perspectives of the set a synthesis dispatch joins. @param {Filling} filling */
function setOf(filling) {
  const { row, rows } = dispatchOf(filling);
  return rows.filter((dispatched) => dispatched.kind === 'perspective' && dispatched.set === row.set);
}

/** @param {Filling} filling @param {string[]} warnings */
function drawPairQuestion(filling, warnings) {
  const set = setOf(filling);
  const unbriefed = set.find((perspective) => perspective.question === undefined);
  if (unbriefed !== undefined) throw new Error(`brief: ${unbriefed.id} was briefed on no question — each perspective of a set is briefed before its synthesis`);
  const questions = [...new Set(set.map((perspective) => perspective.question))];
  if (questions.length > 1) throw new Error(`brief: the perspectives of set ${set[0].set} were briefed on different questions — a synthesis reconciles a pair argued on one`);
  return readShown(stateRoot(filling.cwd), warnings, ({ folded, show }) => {
    const wording = wordingOf(folded, String(questions[0]));
    if (wording === null) throw new Error(`brief: the question set ${set[0].set} argued is no longer current`);
    return questionLine(show, wording);
  });
}

/** @param {Filling} filling */
function drawPerspectives(filling) {
  return setOf(filling).map(({ id, file }) => {
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (text.trim() === '') throw new Error(`brief: ${id}'s report, ${file}, is not written — a synthesis reads every perspective of its set`);
    return text.replace(/\n+$/, '');
  }).join('\n\n');
}

/** The flag naming a ledger question. @type {BriefFlag} */
const QUESTION = Object.freeze({ name: 'question', value: 'id' });

/** The flag naming a dispatch in the topic's agent store. @type {BriefFlag} */
const AGENT = Object.freeze({ name: 'agent', value: 'id' });

/** The kinds of deep dive (9.1.5), each named as the agent's definition names it. */
const DIVE_KINDS = Object.freeze(['survey', 'read', 'feasibility', 'landscape', 'verify']);

/** The kind of dive, and the file a read reads. @param {Filling} filling */
function drawDiveKind({ cwd, given }) {
  const kind = given.kind;
  if (!DIVE_KINDS.includes(kind)) throw new Error(`brief: ${JSON.stringify(kind)} is no kind of dive — --kind takes ${DIVE_KINDS.join(', ')}`);
  if (kind !== 'read') {
    if (given.path !== undefined) throw new Error(`brief: --path names the file a read dive reads, and a ${kind} dive reads none`);
    return kind;
  }
  if (given.path === undefined) throw new Error('brief: a read dive names the file it reads — --path <file>');
  const file = path.resolve(cwd, given.path);
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error(`brief: --path names no file — ${file}`);
  return `read — \`${file}\``;
}

/** The conversation's last knowledge query, drawn for the search that follows it. @param {Filling} filling */
function drawKnowledgeQuery({ session }) {
  const query = lastQuery(session);
  if (query === null) throw new Error('brief: this conversation has run no knowledge query — a plain search follows the `engine knowledge query` it carries on from');
  const filters = query.filters.length === 0 ? 'none' : query.filters.map((filter) => `\`${filter}\``).join(', ');
  const head = `Terms: ${query.terms.map((term) => `\`${term}\``).join(' ')}\nFilters: ${filters}`;
  if (query.outcome === null) return `${head}\n\nIt never finished.`;
  if ('failed' in query.outcome) return `${head}\n\nIt failed: ${query.outcome.failed}`;
  return `${head}\n\nIt returned:\n\n${fenced('', query.outcome.returned.replace(/\n+$/, ''))}`;
}

/** The flag naming a migrated topic, by its place. @type {BriefFlag} */
const MIGRATED = Object.freeze({ name: 'topic', value: 'unit.phase.topic' });

/** @param {Filling} filling */
function drawDirective({ given }) {
  return headingsDown(fs.readFileSync(directiveOf(given.directive).file, 'utf8').trimEnd());
}

/** @param {Filling} filling */
const migratedTopic = ({ cwd, given }) => topicPlace(cwd, given.topic, 'brief');

/** @param {Filling} filling */
function drawMigratedTopic(filling) {
  const { root, unit, topic } = migratedTopic(filling);
  const manifest = readWorkUnitManifest(root, unit);
  const rules = recordsRules();
  const phases = rules.phases.filter((phase) => rules.holds(manifest, phase, topic)).map((phase) => {
    const { status } = manifest.phases[phase].items[topic];
    return typeof status === 'string' ? `${phase}, ${status}` : phase;
  });
  const folder = path.join(root, unit, 'topics', topic);
  const files = (fs.existsSync(folder) ? filesUnder(folder) : []).filter((file) => !file.startsWith('mail/')).map((file) => `${unit}/topics/${topic}/${file}`).sort();
  const sources = rules.sourcesOf({ projectDir: codeRoot(filling.cwd), stateDir: root, unit, topic });
  const assets = sources.imports.map(({ path: at, origin, owner, held }) => {
    const owed = !held ? ' — its file is gone, so no entry links it' : owner === topic ? ' — this topic\'s to link' : '';
    return `- ${at}${origin === null ? '' : `, which came in from ${origin}`}${owed}`;
  });
  return [
    `- **Unit:** ${unit}, ${manifest.work_type}, ${manifest.status}`,
    `- **Topic:** ${topic}, in ${phases.join('; ')}`,
    `- **The state:** ${root} — each path below is from there, as an entry cites it, but one under \`.workflows/\``,
    `- **The project:** ${sources.project} — each path under \`.workflows/\` is from there`,
    '',
    '## Its files',
    '',
    listed(files.map((file) => `- ${file}`)),
    '',
    '## Its specs',
    '',
    listed(sources.specs.map((spec) => (spec.read === spec.cite ? `- ${spec.read}` : `- ${spec.read}, cited as ${spec.cite}`))),
    '',
    '## Its old map, as the code branch\'s HEAD holds it',
    '',
    listed(sources.map.map(({ item, status }) => `- ${item}: ${status}`)),
    '',
    '## Its research\'s threads still open',
    '',
    listed(sources.threads.map(({ thread, status, question }) => `- ${thread}, ${status}: ${question}`)),
    '',
    '## The unit\'s assets',
    '',
    listed(assets),
    '',
    '## Where the record goes',
    '',
    `- The record composed: ${composedPath(unit, topic)}`,
    `- The verifier's findings on it: ${findingsPath(unit, topic)}`,
    `- A carry's refusal of it: ${refusedPath(unit, topic)}`,
  ].join('\n');
}

/** @param {Filling} filling */
function drawComposedRecord(filling) {
  const { root, unit, topic } = migratedTopic(filling);
  const file = path.join(root, composedPath(unit, topic));
  const text = fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file, 'utf8') : null;
  if (text === null) throw new Error(`${unit}'s ${topic} has no record composed — ${file} is no file`);
  if (text.trim() === '') throw new Error(`${unit}'s ${topic} has no record composed — ${file} is empty`);
  return fenced('json', text.trimEnd());
}

/** What the topic's record has beside it at `rel`, verbatim, or none recorded. @param {Filling} filling @param {(unit: string, topic: string) => string} rel */
function besideRecord(filling, rel) {
  const { root, unit, topic } = migratedTopic(filling);
  const file = path.join(root, rel(unit, topic));
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
  return text === '' ? NONE : text;
}

/** What the topic's record has beside it at `rel` cleared, the brief having taken it. @param {Filling} filling @param {(unit: string, topic: string) => string} rel */
function clearBeside(filling, rel) {
  const { root, unit, topic } = migratedTopic(filling);
  fs.rmSync(path.join(root, rel(unit, topic)), { force: true });
}

/** The unit a unit's record is drawn for. @param {Filling} filling @returns {string} */
function unitOf({ unit }) {
  if (unit === null) throw new Error('brief-records: a unit\'s record is drawn for a unit');
  return unit;
}

/** @typedef {import('./spec-sections.cjs').Line} Line */
/** @typedef {import('./spec-sections.cjs').Section} Section */

/** A unit's spec as read: its path, its sections by address, and its lines. @typedef {{file: string, sections: Map<string, Section>, lines: Line[]}} ReadSpec */

/** The spec each fill read. @type {WeakMap<Filling, ReadSpec>} */
const READ_SPECS = new WeakMap();

/**
 * The unit's spec, read once a fill; refused where the unit has none or its
 * grammar refuses it.
 * @param {Filling} filling @returns {ReadSpec}
 */
function unitSpec(filling) {
  const known = READ_SPECS.get(filling);
  if (known !== undefined) return known;
  const unit = unitOf(filling);
  const text = readSpec(filling.cwd, unit);
  /** @type {Line[]} */
  let lines;
  try {
    lines = specStatements(text);
  } catch (err) {
    throw new Error(`brief: ${unit}'s ${SPEC_FILE} does not read —\n${messageOf(err)}`);
  }
  const spec = { file: specPath(filling.cwd, unit), sections: specSections(text), lines };
  READ_SPECS.set(filling, spec);
  return spec;
}

/** A section's title, its heading's marks and number aside. @param {Section} section */
const titleOf = ({ text }) => text.split('\n')[0].replace(/^#+ +[0-9.]+ +/, '');

/** @param {Filling} filling */
function drawSpecOutline(filling) {
  const { file, sections } = unitSpec(filling);
  const outline = [...sections.values()].map((section) => `${section.level === 2 ? '' : '  '}- §${section.address} ${titleOf(section)}`);
  return [`\`${file}\``, '', ...outline].join('\n');
}

/** @param {Filling} filling */
function drawSpecScenarios(filling) {
  const { sections, lines } = unitSpec(filling);
  return listed(lines.filter(({ kind }) => kind === 'scenario').map(({ number, wording }) => {
    const area = /** @type {Section} */ (sections.get(number.split('.')[0]));
    return `- ${number}, of §${area.address} ${titleOf(area)}: ${indented(wording)}`;
  }));
}

/** The part a statement or its screen is in, `N.M`. @param {string} number */
const partOf = (number) => number.split('.').slice(0, 2).join('.');

/** @typedef {import('./unit-entries.cjs').UnitView} UnitView */

/**
 * Each chain of reliance from the entry `id`, in current forms, through the
 * unit's entries no line cites, to the next ones a line does: its entries in
 * order, the cited one last. An entry met twice adds nothing.
 * @param {UnitView} view @param {Map<string, string[]>} citedBy each cited entry's lines @param {string} id
 * @returns {string[][]}
 */
function chainsFrom({ folded, entries }, citedBy, id) {
  /** @type {string[][]} */
  const chains = [];
  const seen = new Set([id]);
  const walk = (/** @type {string} */ from, /** @type {string[]} */ chain) => {
    for (const next of factsOf(folded, from).relies_on.flatMap((on) => currentsOf(folded, on))) {
      if (seen.has(next) || !entries.has(next)) continue;
      seen.add(next);
      if (citedBy.has(next)) chains.push([...chain, next]);
      else walk(next, [...chain, next]);
    }
  };
  walk(id, []);
  return chains;
}

/**
 * The spec's parts each relying on another, in the spec's order, each with
 * the links between them.
 * @param {UnitView} view @param {ReadSpec} spec
 * @returns {Array<{from: string, to: string, links: string[]}>}
 */
function reliesOnEdges(view, { sections, lines }) {
  const { folded, entries, short } = view;
  const cited = lines.filter(({ kind }) => kind === 'statement' || kind === 'screen').flatMap(({ number, cites }) => cites.flatMap((cite) => {
    try {
      const id = resolveId(cite, folded.facts.keys());
      return entries.has(id) ? [{ number, id }] : [];
    } catch {
      return [];
    }
  }));
  /** @type {Map<string, string[]>} */
  const citedBy = new Map();
  for (const { number, id } of cited) citedBy.set(id, [...(citedBy.get(id) ?? []), number]);
  /** @type {Map<string, Map<string, Set<string>>>} */
  const edges = new Map();
  for (const { number, id } of cited) {
    for (const chain of chainsFrom(view, citedBy, id)) {
      const reached = chain[chain.length - 1];
      for (const other of /** @type {string[]} */ (citedBy.get(reached)).filter((line) => partOf(line) !== partOf(number))) {
        const from = edges.get(partOf(number)) ?? new Map();
        edges.set(partOf(number), from);
        const links = from.get(partOf(other)) ?? new Set();
        from.set(partOf(other), links);
        links.add(`${number} cites ${short(id)}, which relies on ${chain.map(short).join(', which relies on ')}, cited by ${other}`);
      }
    }
  }
  const order = [...sections.keys()];
  const inOrder = (/** @type {Iterable<string>} */ parts) => [...parts].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return inOrder(edges.keys()).flatMap((from) => {
    const to = /** @type {Map<string, Set<string>>} */ (edges.get(from));
    return inOrder(to.keys()).map((part) => ({ from, to: part, links: [.../** @type {Set<string>} */ (to.get(part))] }));
  });
}

/** @param {Filling} filling @param {string[]} warnings */
function drawReliesOnGraph(filling, warnings) {
  const spec = unitSpec(filling);
  const edges = withUnitEntries(filling.cwd, unitOf(filling), warnings, (view) => reliesOnEdges(view, spec));
  return listed(edges.map(({ from, to, links }) => `- §${from} relies on §${to}: ${links.join('; ')}`));
}

/** @param {Filling} filling */
function drawCutRefusal(filling) {
  return stagedCutRefusal(filling.cwd, unitOf(filling)) ?? NONE;
}

/** @param {Filling} filling */
function drawCutTo(filling) {
  return `\`${stagedCutPath(filling.cwd, unitOf(filling))}\``;
}

/** The heading the unit's entries at its own level are drawn under. */
const UNIT_OWN = 'The unit\'s own';

/**
 * Where an entry of the unit's is drawn: under its topic, the unit's own
 * level, or the other unit's place it stands on, made here.
 * @param {string} unit @param {import('./ledger-fold.cjs').Standing} stands
 */
function placeKey(unit, { unit: on, topic }) {
  if (on !== unit) return `Made here, standing on ${on}${topic === null ? '' : `/${topic}`}`;
  return topic === null ? UNIT_OWN : topic;
}

/** A topic's heading among the unit's records: its title, its key in brackets. @param {Record<string, any>} manifest @param {string} topic */
const headed = (manifest, topic) => `${topicTitle(manifest, topic)} (${topic})`;

/**
 * The heading an entry of the unit's is drawn under: its topic's, the unit's
 * own level, or the other unit's place it stands on, made here.
 * @param {Record<string, any>} manifest @param {import('./ledger-fold.cjs').Standing} stands
 */
function placeHeading(manifest, stands) {
  const key = placeKey(manifest.name, stands);
  return key === UNIT_OWN || stands.unit !== manifest.name ? key : headed(manifest, key);
}

/**
 * Where an entry of the unit's stands, said within a line: its topic's
 * heading as it reads, any other place's begun in lower case.
 * @param {Record<string, any>} manifest @param {import('./ledger-fold.cjs').Standing} stands
 */
function placeInLine(manifest, stands) {
  const heading = placeHeading(manifest, stands);
  return stands.unit === manifest.name && stands.topic !== null ? heading : `${heading[0].toLowerCase()}${heading.slice(1)}`;
}

/**
 * An entry as a unit's records draw it, `- {short id} {kind}: {text}`, a
 * "don't care" decision's kind marked so, the builder's to make (P2), and
 * what `about` says of it after its kind.
 * @param {import('./unit-entries.cjs').UnitEntry} entry @param {string} [about]
 */
function entryLine({ short, kind, line }, about = '') {
  const marked = kind === 'decision' && line.given === 'dont-care' ? 'decision, don\'t care' : kind;
  return `- ${short} ${marked}${about}: ${indented(String(line.text))}`;
}

/** @param {Filling} filling @param {string[]} warnings */
function drawUnitRecords(filling, warnings) {
  const unit = unitOf(filling);
  const manifest = readWorkUnitManifest(stateRoot(filling.cwd), unit);
  /** @type {Map<string, {heading: string, lines: string[]}>} */
  const places = new Map([...specTopics(manifest), UNIT_OWN].map((key) => [key, { heading: key === UNIT_OWN ? key : headed(manifest, key), lines: [] }]));
  for (const entry of unitEntries(filling.cwd, unit, warnings).values()) {
    const key = placeKey(unit, entry.stands);
    if (!places.has(key)) places.set(key, { heading: placeHeading(manifest, entry.stands), lines: [] });
    /** @type {{heading: string, lines: string[]}} */ (places.get(key)).lines.push(entryLine(entry));
  }
  return [...places.values()].map(({ heading, lines }) => `## ${heading}\n\n${listed(lines)}`).join('\n\n');
}

/** @param {Filling} filling */
function drawSweepTo(filling) {
  const unit = unitOf(filling);
  if (sweepTaken(filling.cwd, unit)) {
    const wait = sweepWait(filling.cwd, unitManifest(filling));
    throw new Error(`brief: ${unit}'s sweep is taken already — one sweep for the spec (8.10.3)${wait === null ? '' : `; ${wait}`}`);
  }
  return `\`${sweepPath(filling.cwd, unit)}\``;
}

/** @param {Filling} filling */
function drawSweepRefusal(filling) {
  return sweepRefusal(filling.cwd, unitOf(filling)) ?? NONE;
}

/** @typedef {import('./unit-entries.cjs').UnitEntry} UnitEntry */

/**
 * `read`, read once a fill, every record drawing on it after the first
 * taking what it read.
 * @template T @param {(filling: Filling, warnings: string[]) => T} read @returns {(filling: Filling, warnings: string[]) => T}
 */
function oncePerFill(read) {
  /** @type {WeakMap<Filling, T>} */
  const known = new WeakMap();
  return (filling, warnings) => {
    if (!known.has(filling)) known.set(filling, read(filling, warnings));
    return /** @type {T} */ (known.get(filling));
  };
}

/** The unit's entries and the folded ledger. */
const unitView = oncePerFill((filling, warnings) => withUnitEntries(filling.cwd, unitOf(filling), warnings, (read) => read));

/** The unit's manifest, for a unit's record. @param {Filling} filling @returns {Record<string, any>} */
const unitManifest = (filling) => /** @type {Record<string, any>} */ (manifestOf(stateRoot(filling.cwd), unitOf(filling)));

/** What carries the spec on, as its entry reads it (spec-entry.cjs). */
const sourcesOf = oncePerFill((filling, warnings) => specSources(filling.cwd, unitManifest(filling), warnings));

/** @param {Filling} filling @param {string[]} warnings */
const drawTopicLogs = (filling, warnings) => listed(sourcesOf(filling, warnings).logs.map((log) => `- \`${log}\``));

/** @param {Filling} filling @param {string[]} warnings */
const drawCanonicalAssets = (filling, warnings) => listed(sourcesOf(filling, warnings).assets.map((asset) => `- \`${asset}\``));

/** @typedef {import('./investigation-log.cjs').Rested} Rested */

/** What a bugfix's hunt rests on, as its log holds it against its entries: read once a fill. */
const huntRead = oncePerFill((filling, warnings) => {
  const unit = unitOf(filling);
  return huntEntries(unit, unitView(filling, warnings), huntOf(filling.cwd, unit, warnings));
});

/**
 * What the hunt rests on for a validation's brief, its investigation open,
 * refused where it rests on none.
 * @template {Rested} T @param {Filling} filling @param {string[]} warnings @param {(read: ReturnType<typeof huntEntries>) => T|{fault: string}} pick
 * @returns {T}
 */
function restedOn(filling, warnings, pick) {
  openInvestigation(filling.cwd, unitOf(filling), 'brief');
  const entry = pick(huntRead(filling, warnings));
  if ('fault' in entry) throw new Error(`brief: ${entry.fault}`);
  return entry;
}

/** An entry the hunt rests on, as a brief draws it. @param {Rested} entry */
const restedLine = ({ short, text }) => `${short}: ${indented(text)}`;

/** @param {Filling} filling */
const drawHuntLog = (filling) => `\`${statePath(filling.cwd, huntLog(unitOf(filling)))}\``;

/** @param {Filling} filling @param {string[]} warnings */
const drawHuntRecord = (filling, warnings) => recordJson(ledgerRead(filling.cwd, 'record', [unitOf(filling), unitOf(filling)], warnings));

/** @param {Filling} filling @param {string[]} warnings */
const drawRootCause = (filling, warnings) => restedLine(restedOn(filling, warnings, ({ rootCause }) => rootCause));

/** @param {Filling} filling @param {string[]} warnings */
function drawFix(filling, warnings) {
  const fix = restedOn(filling, warnings, (read) => read.fix);
  return `${restedLine(fix)}\n\nIt answers ${restedLine(fix.question)}`;
}

/** @param {Filling} filling */
const drawCode = (filling) => listed(projectRepos(codeRoot(filling.cwd)).map((repo) => `- \`${repo.path}\``));

/** @param {Filling} filling @param {string[]} warnings */
function drawInvestigation(filling, warnings) {
  const unit = unitOf(filling);
  if (unitManifest(filling).work_type !== 'bugfix') return NONE;
  const { rootCause, fix } = huntRead(filling, warnings);
  const rests = [rootCause, fix].flatMap((entry) => ('fault' in entry ? [] : [entry.id]));
  const kept = [...unitView(filling, warnings).entries].filter(([id, { kind, stands }]) => kind === 'decision' && stands.unit === unit && stands.topic === unit && !rests.includes(id));
  return listed([
    ...('fault' in rootCause ? [] : [`- The root cause, ${restedLine(rootCause)}`]),
    ...('fault' in fix ? [] : [`- The fix, ${restedLine(fix)}`]),
    ...kept.map(([, { short, line }]) => `- A rule it keeps, ${short}: ${indented(String(line.text))}`),
  ]);
}

/** @param {Filling} filling */
const drawBuilderCalls = (filling) => listed(builderCalls(filling.cwd, unitOf(filling)).map(({ id, call, why }) => `- ${id}: ${indented(call)}\n  Why: ${indented(why)}`));

/**
 * The unit's entries `ids` names, in the ledger's order, each with where it
 * stands and what it replaced.
 * @param {Filling} filling @param {string[]} warnings @param {string[]} ids
 */
function entriesStanding(filling, warnings, ids) {
  const named = new Set(ids);
  const manifest = unitManifest(filling);
  const { entries, short } = unitView(filling, warnings);
  return listed([...entries].filter(([id]) => named.has(id)).map(([, entry]) => {
    const replaced = typeof entry.line.replaces === 'string' ? `, replacing ${short(entry.line.replaces)}` : '';
    return entryLine(entry, `, ${placeInLine(manifest, entry.stands)}${replaced}`);
  }));
}

/** @param {Filling} filling @param {string[]} warnings */
const drawChangedEntries = (filling, warnings) => entriesStanding(filling, warnings, outstanding(filling.cwd, unitOf(filling), warnings).entries);

/** @param {Filling} filling @param {string[]} warnings */
const drawCutRequests = (filling, warnings) => entriesStanding(filling, warnings, cutRequests(filling.cwd, unitOf(filling), warnings));

/** @param {Filling} filling @param {string[]} warnings */
function drawReviewFindings(filling, warnings) {
  const { passes } = outstanding(filling.cwd, unitOf(filling), warnings);
  return passes.length === 0 ? NONE : passes.map(({ file }) => fs.readFileSync(file, 'utf8').trim()).join('\n\n');
}

/** @param {Filling} filling */
function drawWordingChanges({ cwd, given }) {
  if (given.wording === undefined) return NONE;
  const file = path.resolve(cwd, given.wording);
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error(`brief: --wording names no file — ${file}`);
  const text = fs.readFileSync(file, 'utf8').trim();
  if (text === '') throw new Error(`brief: --wording names an empty file — ${file}`);
  return text;
}

/** What the writer's brief carried, pending until the spec's land takes it. @param {Filling} filling @param {string[]} warnings */
const takeFindings = (filling, warnings) => recordTaking(filling.cwd, unitOf(filling), warnings, filling.given.wording === undefined ? undefined : path.resolve(filling.cwd, filling.given.wording));

/** @param {Filling} filling */
const drawLandRefusal = (filling) => landRefusal(filling.cwd, unitOf(filling)) ?? NONE;

/** The rule the numbers the open review page holds keep, which `spec land` holds a land to (11.11.3). */
const HELD_RULE = 'The person\'s review page is open, so these numbers are held: every line keeps its number; a line added takes the next free number at the end of its part — and a scenario or a screen added, at the end of its area\'s scenarios or its line\'s screens — and a number removed is never given to another line.';

/** @param {Filling} filling */
function drawHeldNumbers(filling) {
  const places = heldPlaces(filling.cwd, unitOf(filling));
  return places === null ? NONE : [HELD_RULE, '', ...places.map(({ held, next }) => `- ${held.join(', ')} · next free ${next}`)].join('\n');
}

/** @param {Filling} filling @param {string[]} warnings */
function drawSpecTo(filling, warnings) {
  const unit = unitOf(filling);
  const refused = unitRefusal(filling.cwd, unit);
  if (refused !== null) throw new Error(`brief: ${refused}`);
  const waiting = waitingGaps(filling.cwd, unit, warnings);
  if (waiting.length > 0) throw new Error(`brief: ${unit}'s rewrite waits for the answer — ${gapsWaiting(waiting)}`);
  return `\`${specPath(filling.cwd, unit)}\``;
}

/** @param {Filling} filling @param {string[]} warnings */
function drawChangedSections(filling, warnings) {
  const unit = unitOf(filling);
  const { land, text } = reviewedSpec(filling.cwd, unit);
  const running = passesRunningOn(filling.cwd, unit, land, filling.given.agent);
  if (running !== null) throw new Error(`brief: ${unit}'s spec as it stands is under review already — ${running}`);
  const { changed, removed, since } = sectionsToReview(filling.cwd, unit, text);
  if (since !== null && changed.length === 0 && removed.length === 0) {
    throw new Error(`brief: ${unit}'s spec has not changed since pass ${since}, whose report is in, so a pass has nothing to read — ${waitingOn(filling.cwd, unit, warnings) ?? 'its review has settled'}`);
  }
  const own = ownTexts(text);
  return [
    `The spec: \`${specPath(filling.cwd, unit)}\``,
    since === null ? 'Every section — the review\'s first pass:' : `The sections changed since ${since}, the last pass reported:`,
    ...changed.map((address) => own.get(address)),
    ...removed.map((address) => `§${address} is no longer in the spec.`),
  ].join('\n\n');
}

/** The dispatch `--agent` names bound to the spec its pass reviews. @param {Filling} filling */
function bindPass(filling) {
  const unit = unitOf(filling);
  bindSpec(filling.cwd, unit, filling.given.agent, reviewedSpec(filling.cwd, unit).land);
}

/** The dispatch `--agent` names closed where its brief is refused before it is bound: no agent is sent on it. @param {Filling} filling */
const closePass = (filling) => closeUnbriefed(filling.cwd, unitOf(filling), filling.given.agent);

/** @param {Filling} filling @param {string[]} warnings */
function drawInventedLines(filling, warnings) {
  const unit = unitOf(filling);
  /** @type {Line[]} */
  let lines;
  try {
    lines = specStatements(readSpec(filling.cwd, unit));
  } catch {
    return NONE;
  }
  const invented = inventedLines(filling.cwd, unit, lines, warnings);
  return listed(invented.map(({ number, why }) => `- ${number}: ${indented(why)}`));
}

/** @param {Filling} filling @param {string[]} warnings */
function drawMeasuredFindings(filling, warnings) {
  const measured = [...unitView(filling, warnings).entries.values()].filter(({ kind, line }) => kind === 'finding' && typeof line.command === 'string');
  return listed(measured.map(({ short, line }) => [
    `- ${short}: ${indented(String(line.text))}`,
    `  Its result: ${indented(String(line.result))}`,
    '  Its command:',
    '',
    `  ${indented(fenced('', String(line.command)))}`,
  ].join('\n')));
}

/** @param {Filling} filling */
const drawReportRefusal = (filling) => listed(refusedReports(filling.cwd, unitOf(filling)).map((refusal) => `- ${refusal}`));

/** @param {Filling} filling @param {string[]} warnings */
function drawProductCites(filling, warnings) {
  const { folded, entries } = unitView(filling, warnings);
  /** @type {Map<string, string[]>} */
  const cited = new Map();
  for (const { kind, number, cites } of unitSpec(filling).lines) {
    if (kind !== 'statement' && kind !== 'screen') continue;
    for (const cite of cites) {
      let id;
      try {
        id = resolveId(cite, folded.facts.keys());
      } catch {
        continue;
      }
      if (entries.get(id)?.line.product_wide === true) cited.set(id, [...(cited.get(id) ?? []), number]);
    }
  }
  return listed([...cited].map(([id, numbers]) => `${entryLine(/** @type {UnitEntry} */ (entries.get(id)))}\n  Cited by ${numbers.join(', ')}`));
}

/** A phase of a unit's cut. @typedef {import('./cut.cjs').Phase} CutPhase */

/**
 * The phase a phase's record is drawn for: its unit, its number, and every
 * task of each phase to it as the tracker holds them.
 * @param {Filling} filling
 */
function phaseOf({ unit, phase, phases }) {
  if (unit === null || phase === null || phases === null) throw new Error('brief-records: a phase\'s record is drawn for a phase');
  return { unit, phase, phases };
}

/** The unit's cut, its phases in build order. @param {Filling} filling @returns {CutPhase[]} */
const cutOf = (filling) => /** @type {CutPhase[]} */ (cutPhases(unitManifest(filling)));

/** A task as a list draws it: its number, its title and where it stands. @param {TaskDetail} task */
const taskLine = ({ ref, title, status }) => `- ${shownTask(ref)} ${title}, ${STATUS_WORDS[status]}`;

/** What a phase relies on, as a sentence names it. @param {number|string} on */
const reliedName = (on) => (typeof on === 'number' ? `phase ${on}` : `the work unit ${on}`);

/** The area a section is in: an area its own. @param {string} address */
const areaOf = (address) => address.split('.')[0];

/** Whether a phase naming `named` builds some of the section at `address`: it, a part of it, or the area holding it. @param {string} address */
const builds = (address) => (/** @type {string} */ named) => named === address || named === areaOf(address) || named.startsWith(`${address}.`);

/** @param {Filling} filling */
function drawCutPhase(filling) {
  const { unit, phase } = phaseOf(filling);
  const { name, goal, relies_on: reliesOn } = cutOf(filling)[phase - 1];
  const relies = reliesOn.length === 0 ? 'It relies on nothing.' : `It relies on ${reliesOn.map(reliedName).join(', ')}.`;
  return [`Phase ${phase} of ${unit}: ${name}`, goal, relies].join('\n\n');
}

/** @param {Filling} filling */
function drawPhaseSections(filling) {
  const { phase } = phaseOf(filling);
  const cut = cutOf(filling);
  const named = cut[phase - 1].sections;
  const { file, sections } = unitSpec(filling);
  const built = named.map((address) => {
    const first = cut.findIndex((each) => each.sections.some(builds(address))) + 1;
    return `- §${address}, first built in ${first === phase ? 'this phase' : `phase ${first}`}`;
  });
  const texts = named.filter((address) => areaOf(address) === address || !named.includes(areaOf(address))).map((address) => {
    const section = sections.get(address);
    if (section === undefined) throw new Error(`phase ${phase} of the cut names §${address}, which the spec lacks`);
    return section.text;
  });
  return [`\`${file}\``, built.join('\n'), ...texts].join('\n\n');
}

/** @param {Filling} filling */
function drawPhaseScenarios(filling) {
  const { phase } = phaseOf(filling);
  const wordings = new Map(unitSpec(filling).lines.filter(({ kind }) => kind === 'scenario').map(({ number, wording }) => [number, wording]));
  return listed(cutOf(filling)[phase - 1].scenarios.map((id) => {
    const wording = wordings.get(id);
    if (wording === undefined) throw new Error(`phase ${phase} of the cut holds ${id}, which the spec lacks`);
    return `- ${id}: ${indented(wording)}`;
  }));
}

/** Notes for later, each verbatim under its heading. @param {import('./notes.cjs').Note[]} notes */
const notesDrawn = (notes) => (notes.length === 0 ? NONE : notes.map(({ note, text }) => `## Note ${note}\n\n${text}`).join('\n\n'));

/** @param {Filling} filling */
function drawHeldNotes(filling) {
  const { unit, phase } = phaseOf(filling);
  return notesDrawn(notesHeldFor(filling.cwd, unit, phase));
}

/** @param {Filling} filling */
function drawPhaseNotes(filling) {
  const { unit, phase } = phaseOf(filling);
  return notesDrawn(notesToTake(filling.cwd, unit, phase));
}

/** @param {Filling} filling */
function drawWrittenTasks(filling) {
  const { phase, phases } = phaseOf(filling);
  const tasks = phases[phase - 1];
  return tasks === null ? 'The phase is not written in the tracker yet.' : listed(tasks.map(taskLine));
}

/** @param {Filling} filling */
function drawEarlierTasks(filling) {
  const { phase, phases } = phaseOf(filling);
  return listed(phases.slice(0, phase - 1).flatMap((tasks) => tasks ?? []).filter(({ status }) => !ENDED.includes(status)).map(taskLine));
}

/** @param {Filling} filling @param {string[]} warnings */
function drawBuildCalls(filling, warnings) {
  const { entries, short } = unitView(filling, warnings);
  const made = [...entries.values()].filter(({ kind, line }) => kind === 'decision' && BUILD_PHASES.includes(String(line.phase)));
  return listed(made.map(({ short: id, line }) => {
    const task = typeof line.task === 'string' ? `, for task ${line.task}` : '';
    const replaced = typeof line.replaces === 'string' ? `, replacing ${short(line.replaces)}` : '';
    return `- ${id}, ${WHOSE[String(line.by)]}${task}${replaced}: ${indented(String(line.text))}\n  Why: ${indented(String(line.why))}`;
  }));
}

/** @param {Filling} filling @param {string[]} warnings */
function drawAffectedEntries(filling, warnings) {
  const { affected } = ledgerRead(filling.cwd, 'affected', [unitOf(filling)], warnings);
  return affected.length === 0 ? NONE : fenced('json', JSON.stringify(affected, null, 2));
}

/** @param {Filling} filling */
function drawTaskFilesTo(filling) {
  const { unit, phase } = phaseOf(filling);
  return `\`${statePath(filling.cwd, '.cache', unit, 'build', `phase-${phase}`, filling.role)}\``;
}

/** The reproducing task, as a bugfix's phase 1's task writer is told of it. */
const REPRODUCING_TEST = [
  'This phase opens on the test that reproduces the bug. Record that task first, so it is task 1.1. It writes the test and nothing else, its type `test` and its acceptance scenario the scenario of this phase the bug breaks; '
    + 'its solution names the command that runs that test alone, as `npx vitest run test/checkout.test.ts`. The test is run by that command on the unfixed code, and no other task\'s code lands until it fails there five times out of five.',
  'The task that fixes the bug is linked after 1.1, and every other task of this phase after the fix, so none is built beside it. The fix\'s acceptance scenarios say in its own words what it makes true, since the scenario is 1.1\'s.',
].join('\n\n');

/** @param {Filling} filling */
function drawReproducingTest(filling) {
  const { phase } = phaseOf(filling);
  return phase === REPRODUCING.phase && isBugfix(unitManifest(filling)) ? REPRODUCING_TEST : 'None: only a bugfix\'s first phase opens on a test that reproduces its bug.';
}

/** The phase's tasks, refused where it is not written. @param {Filling} filling @returns {TaskDetail[]} */
function writtenPhase(filling) {
  const { unit, phase } = phaseOf(filling);
  const tasks = filling.written;
  if (tasks === null) throw new Error(`${phaseName(unit, phase)} is not written — its tasks are written as it starts`);
  return tasks;
}

/** Each addition to a task, under a heading a level below the task's own. @param {TaskDetail} task */
const additionsOf = ({ additions }) => additions.flatMap(({ by, text }) => ['', `### Added by the ${by}`, '', text]);

/** @param {Filling} filling */
function drawPhaseTasks(filling) {
  return blocks(writtenPhase(filling).map((task) => {
    const [title, ...body] = headingsDown(task.text).split('\n');
    const stands = task.status === 'closed' ? `It was closed: ${task.reason}` : `It is ${STATUS_WORDS[task.status]}.`;
    return [title.replace(/^## /, `## ${shownTask(task.ref)} `), '', stands, '', body.join('\n').replace(/^\n+/, ''), ...additionsOf(task)].join('\n');
  }));
}

/** @param {Filling} filling */
function drawPhaseCriteria(filling) {
  return blocks(writtenPhase(filling).filter(({ status }) => status !== 'closed').map((task) => (
    [`## ${shownTask(task.ref)} ${task.title}`, '', scenariosOf(task.text), ...additionsOf(task)].join('\n')
  )));
}

/** @param {Filling} filling */
function drawReliedOn(filling) {
  const { phase, phases } = phaseOf(filling);
  const cut = cutOf(filling);
  return blocks(cut[phase - 1].relies_on.map((on) => {
    if (typeof on === 'string') return `## The work unit ${on}\n\nThis phase relies on its delivery.`;
    const { name, goal, sections } = cut[on - 1];
    return [
      `## Phase ${on}: ${name}`, '', goal, '', `Its sections: ${sections.map((address) => `§${address}`).join(', ')}`, '', 'Its tasks:', '', listed((phases[on - 1] ?? []).map(taskLine)),
    ].join('\n');
  }));
}

/**
 * The project's repositories and the stack's tip in each holding work on the
 * branch of a task of the phase not closed (phase-stack.cjs), read once a
 * fill.
 */
const phaseHolding = oncePerFill(/** @param {Filling} filling @returns {import('./phase-stack.cjs').PhaseStack} */ (filling) => {
  const { unit, phase } = phaseOf(filling);
  return phaseStack(filling.cwd, unit, phase, writtenPhase(filling));
});

/** @param {Filling} filling @param {string[]} warnings */
function drawPhaseDiffRange(filling, warnings) {
  const { tips, what } = phaseHolding(filling, warnings);
  const holding = [...tips.keys()];
  const tipped = holding.map((repo) => /** @type {string} */ (tips.get(repo)));
  const { base } = filling.given;
  const bases = base === undefined ? holding.map((repo) => landsOn(filling.cwd, repo)) : basesOf(filling.cwd, holding, base, `${what}'s tasks`);
  return holding.map((repo, at) => rangeIn(repo, bases[at], tipped[at])).join('\n\n');
}

/** @param {Filling} filling @param {string[]} warnings */
function drawPhaseScratchLayout(filling, warnings) {
  const { repos, tips } = phaseHolding(filling, warnings);
  const { unit, phase } = phaseOf(filling);
  return layoutOf(repos, tips, RANGE_TIP, (repo) => onBranch(repo, landsOn(filling.cwd, repo), 'the branch it lands on'), scratchName.phase(unit, phase, letterOf(filling)));
}

/**
 * The phase's tip in each repository holding its work, each by the commit
 * its stack's tip is at, as a run names its commits.
 * @param {Filling} filling @param {string[]} warnings @returns {RepoCommit[]}
 */
function phaseTips(filling, warnings) {
  return tipCommits(phaseHolding(filling, warnings));
}

/** @param {Filling} filling @param {string[]} warnings */
function drawRecordedRuns(filling, warnings) {
  const { unit, phase } = phaseOf(filling);
  const tips = phaseTips(filling, warnings);
  return cutOf(filling)[phase - 1].scenarios.map((scenario) => {
    const { standing, runs } = runsOf(filling.cwd, unit, scenario, tips);
    return [`- ${scenario}: ${standing}`, ...runs.map((run) => `  - ${run.verdict}, recorded ${run.at}: \`${statePath(filling.cwd, run.file)}\``)].join('\n');
  }).join('\n');
}

/** @param {Filling} filling @param {string[]} warnings */
function drawMutants(filling, warnings) {
  const { unit, phase } = phaseOf(filling);
  const survivors = cachedSurvivors(filling.cwd, unit, phase, phaseTips(filling, warnings));
  if (survivors === null) return 'The verify setup names no mutation tool.';
  return survivors.length === 0 ? 'None survived.' : survivors.map(({ path: at, line, mutant }) => `- ${at}:${line} — ${mutant}`).join('\n');
}

/** The reviewer's letter `--letter` names; refused where it names none of the count's. @param {Filling} filling */
function letterOf(filling) {
  const { letter } = filling.given;
  if (!REVIEWER_LETTERS.includes(letter)) throw new Error(`${letter} is no reviewer's letter — the reviewers are ${REVIEWER_LETTERS.join(' and ')}`);
  return letter;
}

/**
 * Where a reviewer writes its report, drawn; a report there that does not
 * read, by `faultsOf` — the reviewers' grammar, or a review round's — is
 * named as the one this replaces, with why it does not, and one that reads
 * refuses it.
 * @param {Filling} filling @param {string} rel state-relative @param {(file: string) => string|null} [faultsOf]
 */
function reportPlace(filling, rel, faultsOf = reportFaults) {
  const file = statePath(filling.cwd, rel);
  if (!fs.existsSync(file)) return `\`${file}\``;
  const faults = faultsOf(file);
  if (faults === null) throw new Error(`${rel} is written already — that reviewer's report of the round is in`);
  return `\`${file}\` — the report there does not read as a reviewer's report — ${faults}; yours replaces it`;
}

/**
 * The file the builder writes the verify setup in, and the setup recorded
 * now, which it starts from: the cache's copy is never refreshed, so a
 * builder reading it would undo a change recorded since.
 * @param {Filling} filling
 */
function drawSetupTo(filling) {
  const file = `\`${statePath(filling.cwd, '.cache', taskOf(filling).ref.unit, 'build', 'verify-setup.json')}\``;
  const setup = verifySetup(filling.cwd);
  if (setup === null) return `${file}\n\nNo verify setup is recorded yet.`;
  const { ran, ...parts } = setup;
  return `${file}\n\nThe verify setup recorded now, which the file starts from:\n\n${fenced('json', JSON.stringify(parts, null, 2))}`;
}

/** @param {Filling} filling */
function drawAccountTo(filling) {
  const { ref } = taskOf(filling);
  const standing = roundStanding(filling.cwd, ref, filling.session);
  if (standing !== null) throw new Error(readRefusal(ref, standing));
  const {
    owed, faults, changed, waiting,
  } = accountOwed(filling.cwd, ref);
  const lines = [`\`${statePath(filling.cwd, accountPath(ref))}\``];
  if (waiting !== null) lines.push(`Your reviewers passed the task, and it waits on ${waiting.join(', ')}, a question for the person: write no account while it waits — the answer decides whether the task lands as they passed it, or changes.`);
  if (changed !== null) lines.push(`The task changed after your reviewers passed it in round ${changed} — something was added to it, or one of its calls decided against its lean: build what changed, and your reviewers read the task again before its account is written.`);
  if (owed !== null && owed.settlement === null) lines.push(`Your reviewers passed the task in round ${owed.round}: it has landed, so write its account now.`);
  if (owed !== null && owed.settlement !== null) {
    lines.push(
      `The orchestrator settled the task's review in round ${owed.round}: it has landed, so write its account now, \`### Settled\` after that round saying what was done about it. Its settlement:`,
      owed.settlement.split('\n').map((line) => `> ${line}`.trimEnd()).join('\n'),
    );
  }
  if (faults !== null) lines.push(`The account there does not read — ${faults}; yours replaces it.`);
  if (owed === null && waiting === null && landingStage(filling.cwd, ref).stage === 'owed') lines.push('Your account of the task is written there and not yet taken: leave it as it stands, and report **accounted**.');
  return lines.join('\n\n');
}

/** A brief to the task's builder issued: the freeing and the changes it went past recorded (round-report.cjs). @param {Filling} filling @param {string|null} session the conversation issuing the builder's own brief */
function briefedPast(filling, session) {
  const { ref } = taskOf(filling);
  recordBuilder(filling.cwd, ref, freedAt(filling.cwd, ref.unit).get(shownTask(ref)) ?? 0, session);
}

/** The builder's own brief issued, in the calling conversation. @param {Filling} filling */
const bindBuilder = (filling) => briefedPast(filling, filling.session);

/** A fix round's brief to the builder issued. @param {Filling} filling */
const bindFix = (filling) => briefedPast(filling, null);

/** A reviewer's brief issued: the round its pair is briefed for, and the conversation briefing this reviewer, recorded (round-report.cjs). @param {Filling} filling */
function bindReviewer(filling) {
  const { ref } = taskOf(filling);
  recordReviewer(filling.cwd, ref, roundUnderReview(filling.cwd, ref), letterOf(filling), filling.session);
}

/** @returns {string} */
function drawEngine() {
  return `\`${ENGINE_RUN}\` — the engine of the checkout the orchestrator runs in. Run every engine command this brief and your instructions name as that, from wherever you run it.`;
}

/**
 * Where the task's branch stands against its chain, in each repository
 * holding it, children first: the tip of the work below it that has moved
 * past the branch there — one stack's, so its tip holds the rest — or none.
 * @param {Filling} filling @param {Repo[]} repos the project's @returns {{repo: Repo, tip: string}[]}
 */
function chainPast(filling, repos) {
  const { ref, task } = taskOf(filling);
  if (task.type === null) throw new Error(`${taskName(ref)} has no type in the tracker, and its branch is named from it`);
  const own = taskBranch(ref, task.type, task.title);
  const below = workBelow(filling.cwd, ref.unit, ref.phase, repos).flatMap((other) => (other.type === null ? [] : [taskBranch(other.ref, other.type, other.title)]));
  return childrenFirst(repos).flatMap((repo) => {
    const held = branches(repo.path);
    if (!held.has(own)) return [];
    const merged = branchesHeldBy(repo.path, `refs/heads/${own}`);
    const past = below.filter((other) => other !== own && held.has(other) && !merged.has(other));
    const tip = past[latestOf(repo.path, past.map((other) => /** @type {string} */ (held.get(other))))];
    return tip === undefined ? [] : [{ repo, tip }];
  });
}

/** What the builder does once its merge is committed, by how far the task stands towards landing (`landingStage`). */
const CHAIN_THEN = Object.freeze({
  building: 'Then go on with the task as the rest of this brief says.',
  owed: 'Then write the task\'s account, as **Where your account goes** says, and report **accounted**.',
  taken: 'Then report **merged**.',
});

/**
 * Whether the task's branch holds its chain as it stands, and where it does
 * not, the merge of the chain's tip back onto it in each repository, a
 * child before its holder — the holder's pointer then resolved to that
 * child's merged tip — each committed through the door; then the task, while
 * its review is not over, the account where one is owed, or else the report
 * that it merged (`CHAIN_THEN`).
 * @param {Filling} filling
 */
function drawChain(filling) {
  const { ref } = taskOf(filling);
  const repos = projectRepos(codeRoot(filling.cwd));
  const past = chainPast(filling, repos);
  if (past.length === 0) return 'Your branch holds its phase\'s chain as it stands.';
  const pointers = past.filter(({ repo }) => repo.dir !== '' && heldIn(repos, repo).submodule).map(({ repo }) => {
    const { holder, folder } = heldIn(repos, repo);
    return `\`git${holder.dir === '' ? '' : ` -C ${quoted(holder.dir)}`} add ${quoted(folder)}\``;
  });
  const { stage } = landingStage(filling.cwd, ref);
  return [
    'Your phase\'s chain has moved on past your branch. Merge its tip back before anything else, from your task\'s worktree, one repository at a time in this order, each merge committed before the next starts:',
    past.map(({ repo, tip }) => `- \`git${repo.dir === '' ? '' : ` -C ${quoted(repo.dir)}`} merge --no-ff --no-commit ${tip}\``).join('\n'),
    [
      'Resolve what conflicts as your task and the chained work both need',
      pointers.length === 0 ? '' : ` — a child repository's pointer at that repository's merged tip, ${pointers.join(', ')}`,
      `, then commit the merge through the door, naming each file you resolved — or, where nothing conflicted, any file the merge changed: the engine's \`commit --paths {file}… --task ${ref.unit} ${shownTask(ref)} -m "{message}"\`, which finishes it.`,
    ].join(''),
    CHAIN_THEN[stage],
  ].join('\n\n');
}

/**
 * Where the reviewer's report of the round under review goes; refused
 * where the last round passed, naming the way on by how far the task
 * stands towards landing (task-account.cjs, `reviewOverWay`).
 * @param {Filling} filling
 */
function drawRoundReportTo(filling) {
  const { ref } = taskOf(filling);
  const over = reviewOverWay(filling.cwd, ref);
  if (over !== null) throw new Error(`round ${over.round} of ${taskName(ref)} passed — its review is over: ${over.way}`);
  return reportPlace(filling, roundReportPath(ref, roundUnderReview(filling.cwd, ref), letterOf(filling)));
}

/** @param {Filling} filling */
function drawPhaseReportTo(filling) {
  const { unit, phase } = phaseOf(filling);
  return reportPlace(filling, phaseReviewPath(unit, phase, letterOf(filling)));
}

/** @param {Filling} filling */
function drawConsolidationTo(filling) {
  const { unit, phase } = phaseOf(filling);
  return `\`${statePath(filling.cwd, consolidationPath(unit, phase))}\``;
}

/** The unit as its review phase reads it, once a fill. */
const reviewReading = oncePerFill(/** @param {Filling} filling */ (filling) => reading(filling.cwd, unitOf(filling), unitManifest(filling)));

/**
 * The unit's review phase as its round's reports are written for, read
 * once a fill, the round's reads known; refused where it cannot be entered
 * (review-entry.cjs) or the round cannot be read (review-phase.cjs).
 */
const reviewOf = oncePerFill(/** @param {Filling} filling @param {string[]} warnings */ (filling, warnings) => {
  const standing = reviewHeld(reviewReading(filling, warnings), roundRefusal);
  return { ...standing, reads: /** @type {string[]} */ (standing.reads) };
});

/** The area `--area` names, refused where the spec has none so numbered. @param {Filling} filling @param {string[]} warnings */
function areaNamed(filling, warnings) {
  const { areas } = reviewOf(filling, warnings);
  const area = areas.find(({ number }) => number === filling.given.area);
  if (area === undefined) throw new Error(`the spec has no area ${filling.given.area} — its areas are ${areas.map(({ number }) => `§${number}`).join(', ')}`);
  return area;
}

/** The whole change, read once a fill (review-change.cjs). */
const changeHeld = oncePerFill(/** @param {Filling} filling @param {string[]} warnings */ (filling, warnings) => {
  const { rounds } = reviewOf(filling, warnings);
  return changeOf(filling.cwd, unitOf(filling), fixPhase(unitManifest(filling), rounds.length), filling.given.base ?? null, reposOf(reviewReading(filling, warnings)));
});

/** @param {Filling} filling @param {string[]} warnings */
function drawAreaSections(filling, warnings) {
  const { number } = areaNamed(filling, warnings);
  const { file, sections } = unitSpec(filling);
  return [`\`${file}\``, /** @type {Section} */ (sections.get(number)).text].join('\n\n');
}

/** @param {Filling} filling @param {string[]} warnings */
function drawAreaMeets(filling, warnings) {
  const { number } = areaNamed(filling, warnings);
  const others = reviewOf(filling, warnings).areas.filter((area) => area.number !== number);
  const spec = unitSpec(filling);
  const edges = withUnitEntries(filling.cwd, unitOf(filling), warnings, (view) => reliesOnEdges(view, spec))
    .filter(({ from, to }) => (areaOf(from) === number) !== (areaOf(to) === number));
  return [
    'The other areas:', listed(others.map(({ number: at, title }) => `- §${at} ${title}`)),
    'Where they meet it:', listed(edges.map(({ from, to, links }) => `- §${from} relies on §${to}: ${links.join('; ')}`)),
  ].join('\n\n');
}

/** @param {Filling} filling @param {string[]} warnings */
function drawUnitCalls(filling, warnings) {
  const unit = unitOf(filling);
  return listed(readShown(stateRoot(filling.cwd), warnings, (shower) => unitCalls(shower, unit)).map(({
    short, by, handed, phase, topic, question, answer, why,
  }) => [
    `- ${short}, ${WHOSE[by]}${handed === null ? '' : `, handed over as ${handed}`}, at ${unit}.${phase}${topic === null ? '' : `.${topic}`}: ${indented(answer)}`,
    ...(question === null ? [] : [`  It answers: ${indented(question)}`]),
    `  Why: ${indented(why)}`,
  ].join('\n')));
}

/** @param {Filling} filling @param {string[]} warnings */
function drawChangeCommits(filling, warnings) {
  return changeHeld(filling, warnings).holding.map(({ repo, parts }) => [`## In ${repoNamed(repo)}`, ...parts.map((part) => partDrawn(repo, part))].join('\n\n')).join('\n\n');
}

/** A part of the change in a repository: a landing by its commit and subject, or the work not landed by where it is read from, with its stat. @param {Repo} repo @param {import('./review-change.cjs').ChangePart} part */
function partDrawn(repo, { from, to, landed, branch }) {
  const stat = git(repo.path, ['diff', '--no-color', ...STAT, from, to, '--']);
  const heading = landed === null ? `### Not landed yet: \`${from.slice(0, 12)}..${branch}\`` : `### Landed: \`${landed.commit.slice(0, 12)}\` ${landed.subject}`;
  return `${heading}\n\n${stat === '' ? 'Nothing changed in it.' : `\`\`\`\n${stat}\`\`\``}`;
}

/** @param {Filling} filling @param {string[]} warnings */
function drawChangeScratchLayout(filling, warnings) {
  const { repos, holding } = changeHeld(filling, warnings);
  const unit = unitOf(filling);
  const named = filling.given.area === undefined ? scratchName.tests(unit) : scratchName.area(unit, filling.given.area, letterOf(filling));
  return layoutOf(repos, new Map(holding.map(({ repo, tip }) => [repo, tip])), 'the change\'s tip there', (repo) => onBranch(repo, landsOn(filling.cwd, repo), 'the branch it lands on'), named);
}

/** @param {Filling} filling @param {string[]} warnings */
function drawAreaRuns(filling, warnings) {
  const { number } = areaNamed(filling, warnings);
  const tips = changeTips(changeHeld(filling, warnings));
  const scenarios = unitSpec(filling).lines.filter(({ kind, number: id }) => kind === 'scenario' && id.startsWith(`${number}.S`));
  return listed(scenarios.map(({ number: scenario, wording }) => {
    const { standing, runs } = runsOf(filling.cwd, unitOf(filling), scenario, tips);
    return [`- ${scenario}: ${standing}`, `  ${indented(wording)}`, ...runs.map((run) => `  - ${run.verdict}, recorded ${run.at}: \`${statePath(filling.cwd, run.file)}\``)].join('\n');
  }));
}

/** @param {Filling} filling @param {string[]} warnings */
function drawAreaReportTo(filling, warnings) {
  const { name, number } = areaNamed(filling, warnings);
  const { round, reads } = reviewOf(filling, warnings);
  if (!reads.includes(name)) throw new Error(`area ${number} is not read in round ${round}, which reads ${readsWords(reads)}`);
  return reportPlace(filling, areaReportPath(unitOf(filling), round, name, letterOf(filling)), reviewReportFaults);
}

/** @param {Filling} filling @param {string[]} warnings */
function drawTestsReportTo(filling, warnings) {
  const { round, reads } = reviewOf(filling, warnings);
  if (!reads.includes(TESTS)) throw new Error(`the test surface is not read in round ${round}, which reads ${readsWords(reads)}`);
  return reportPlace(filling, areaReportPath(unitOf(filling), round, TESTS, TESTS_LETTER), reviewReportFaults);
}

/** The flag naming the branch a range is read from. @type {BriefFlag} */
const BASE = Object.freeze({ name: 'base', value: 'branch' });

/** The flag naming the reviewer a report is written by. @type {BriefFlag} */
const LETTER = Object.freeze({ name: 'letter', value: REVIEWER_LETTERS.join('|') });

/** The flag naming the spec's area a review phase's pair reads, by its number. @type {BriefFlag} */
const AREA = Object.freeze({ name: 'area', value: 'N' });

/** Every record, by the slot that draws it. @type {Readonly<Record<string, BriefRecord>>} */
const RECORDS = Object.freeze({
  task: { of: 'task', draw: drawTask },
  'spec-sections': { of: 'task', draw: drawSpecSections },
  'decided-calls': { of: 'unit', draw: drawDecidedCalls },
  linters: { of: null, draw: drawLinters },
  'diff-range': { of: 'task', flags: [{ ...BASE, optional: true }], draw: drawDiffRange },
  'scratch-layout': { of: 'task', draw: drawScratchLayout },
  reports: { of: 'task', draw: drawReports, bind: bindFix },
  'round-report-to': { of: 'task', flags: [LETTER], draw: drawRoundReportTo, bind: bindReviewer },
  'account-to': { of: 'task', draw: drawAccountTo, bind: bindBuilder },
  engine: { of: null, draw: drawEngine },
  chain: { of: 'task', draw: drawChain },
  'setup-to': { of: 'task', draw: drawSetupTo },
  'topic-record': { of: 'topic', draw: drawTopicRecord },
  'topic-log': { of: 'topic', draw: drawTopicLog },
  'other-records': { of: 'topic', draw: drawOtherRecords },
  'product-record': { of: 'unit', draw: drawProductRecord },
  question: { of: 'topic', flags: [QUESTION, AGENT], draw: drawQuestion, bind: bindAsked },
  'pair-question': { of: 'topic', flags: [AGENT], draw: drawPairQuestion },
  'dive-kind': { of: null, flags: [{ name: 'kind', value: DIVE_KINDS.join('|') }, { name: 'path', value: 'file', optional: true }], draw: drawDiveKind },
  'gap-review': { of: 'topic', draw: drawGapReview },
  dismissed: { of: 'unit', draw: drawDismissed },
  'report-to': { of: 'topic', flags: [AGENT], draw: drawReportTo },
  lens: { of: 'topic', flags: [AGENT], draw: drawLens },
  perspectives: { of: 'topic', flags: [AGENT], draw: drawPerspectives },
  'knowledge-query': { of: null, draw: drawKnowledgeQuery },
  directive: { of: null, flags: [{ name: 'directive', value: 'id' }], draw: drawDirective },
  'migrated-topic': { of: null, flags: [MIGRATED], draw: drawMigratedTopic },
  'composed-record': { of: null, flags: [MIGRATED], draw: drawComposedRecord },
  'verifier-findings': { of: null, flags: [MIGRATED], draw: (filling) => besideRecord(filling, findingsPath), bind: (filling) => clearBeside(filling, findingsPath) },
  'carry-refusal': { of: null, flags: [MIGRATED], draw: (filling) => besideRecord(filling, refusedPath), bind: (filling) => clearBeside(filling, refusedPath) },
  'spec-outline': { of: 'unit', draw: drawSpecOutline },
  'spec-scenarios': { of: 'unit', draw: drawSpecScenarios },
  'relies-on-graph': { of: 'unit', draw: drawReliesOnGraph },
  'cut-refusal': { of: 'unit', draw: drawCutRefusal },
  'cut-to': { of: 'unit', draw: drawCutTo },
  'cut-requests': { of: 'unit', draw: drawCutRequests, bind: (filling, warnings) => recordCutTaking(filling.cwd, unitOf(filling), warnings) },
  'unit-records': { of: 'unit', draw: drawUnitRecords },
  'sweep-refusal': { of: 'unit', draw: drawSweepRefusal },
  'sweep-to': { of: 'unit', draw: drawSweepTo },
  'topic-logs': { of: 'unit', draw: drawTopicLogs },
  'canonical-assets': { of: 'unit', draw: drawCanonicalAssets },
  'builder-calls': { of: 'unit', draw: drawBuilderCalls },
  'changed-entries': { of: 'unit', draw: drawChangedEntries },
  'wording-changes': { of: 'unit', flags: [{ name: 'wording', value: 'file', optional: true }], draw: drawWordingChanges },
  'review-findings': { of: 'unit', draw: drawReviewFindings, bind: takeFindings },
  'land-refusal': { of: 'unit', draw: drawLandRefusal },
  'held-numbers': { of: 'unit', draw: drawHeldNumbers },
  'spec-to': { of: 'unit', draw: drawSpecTo },
  'changed-sections': { of: 'unit', flags: [AGENT], draw: drawChangedSections, bind: bindPass, refused: closePass },
  'invented-lines': { of: 'unit', draw: drawInventedLines },
  'measured-findings': { of: 'unit', draw: drawMeasuredFindings },
  'product-cites': { of: 'unit', draw: drawProductCites },
  'report-refusal': { of: 'unit', draw: drawReportRefusal },
  'unit-report-to': { of: 'unit', flags: [AGENT], draw: drawReportTo },
  'cut-phase': { of: 'phase', draw: drawCutPhase },
  'phase-sections': { of: 'phase', draw: drawPhaseSections },
  'phase-scenarios': { of: 'phase', draw: drawPhaseScenarios },
  'held-notes': { of: 'phase', draw: drawHeldNotes },
  'written-tasks': { of: 'phase', draw: drawWrittenTasks },
  'earlier-tasks': { of: 'phase', draw: drawEarlierTasks },
  'build-calls': { of: 'unit', draw: drawBuildCalls },
  'affected-entries': { of: 'unit', draw: drawAffectedEntries },
  'task-files-to': { of: 'phase', draw: drawTaskFilesTo },
  'reproducing-test': { of: 'phase', draw: drawReproducingTest },
  'phase-notes': { of: 'phase', draw: drawPhaseNotes },
  'phase-tasks': { of: 'phase', draw: drawPhaseTasks },
  'phase-criteria': { of: 'phase', draw: drawPhaseCriteria },
  'relied-on': { of: 'phase', draw: drawReliedOn },
  'phase-diff-range': { of: 'phase', flags: [{ ...BASE, optional: true }], draw: drawPhaseDiffRange },
  'phase-scratch-layout': { of: 'phase', draw: drawPhaseScratchLayout },
  'recorded-runs': { of: 'phase', draw: drawRecordedRuns },
  mutants: { of: 'phase', draw: drawMutants },
  'phase-report-to': { of: 'phase', flags: [LETTER], draw: drawPhaseReportTo },
  'consolidation-to': { of: 'phase', draw: drawConsolidationTo },
  'area-sections': { of: 'unit', flags: [AREA], draw: drawAreaSections },
  'area-meets': { of: 'unit', flags: [AREA], draw: drawAreaMeets },
  'unit-calls': { of: 'unit', draw: drawUnitCalls },
  'change-commits': { of: 'unit', flags: [BASE], draw: drawChangeCommits },
  'change-scratch-layout': { of: 'unit', flags: [BASE], draw: drawChangeScratchLayout },
  'area-runs': { of: 'unit', flags: [AREA, BASE], draw: drawAreaRuns },
  'area-report-to': { of: 'unit', flags: [AREA, LETTER], draw: drawAreaReportTo },
  'tests-report-to': { of: 'unit', draw: drawTestsReportTo },
  investigation: { of: 'unit', draw: drawInvestigation },
  'hunt-log': { of: 'unit', draw: drawHuntLog },
  'hunt-record': { of: 'unit', draw: drawHuntRecord },
  'hunt-root-cause': { of: 'unit', draw: drawRootCause },
  'hunt-fix': { of: 'unit', draw: drawFix },
  code: { of: null, draw: drawCode },
});

/** The records that place a read of the review phase's round. */
const ROUND_REPORTS = Object.freeze(['area-report-to', 'tests-report-to']);

/**
 * What the record of whose a brief is keeps beside its role for a read of
 * the review phase's round: the area `--area` names, where it names one,
 * and the round it reads (the board's clock reads both); nothing for any
 * other brief.
 * @param {Filling} filling @param {readonly string[]} records @param {string[]} warnings @returns {{area?: string, round?: number}}
 */
function readFacts(filling, records, warnings) {
  if (!records.some((record) => ROUND_REPORTS.includes(record))) return {};
  return { ...(filling.given.area === undefined ? {} : { area: filling.given.area }), round: reviewOf(filling, warnings).round };
}

module.exports = { RECORDS, DIVE_KINDS, readFacts };

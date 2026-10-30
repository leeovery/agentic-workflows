#!/usr/bin/env node
'use strict';

// ---------------------------------------------------------------------------
// Engine CLI — the shell door into the engine.
//
// Skills' .md files call this at prescribed points; scripts should prefer the
// in-process library (lib.cjs). Domain commands (transitions, queries) land
// here as they're built.
//
// The `render` command group serves two audiences: the surface catalogue
// (domain/render.cjs) — named runtime surfaces skill flows call at prescribed
// points, returning demarcated sections emitted verbatim — and the dev/debug
// primitives (signpost, wrap, tree), which remain authoring aids only.
// Static chrome stays literal in prose; anything parameterised or
// state-branching renders here.
//
// Two doors, one dispatch: `main` binds the process (argv, cwd, the real
// streams) and the exported in-process entry binds a caller's, for a test
// harness that wants the CLI's answers without the CLI's start-up — `run`,
// or `runAsync` for the commands that answer later — the knowledge verbs that
// wait on the embedding provider, and a raise's draw, on its rows' checks —
// which `run` refuses before running.
// Nothing below either door reads process state: the directory, the output
// streams and the stdin text all arrive on the call.
//
// A guard — a hook Claude Code runs before every call of a tool — is
// answered at the shell door before anything below loads, loading its own
// module alone (guards.cjs).
// ---------------------------------------------------------------------------

const { GUARD_VERBS, runGuard, guardDoor } = require('./guards.cjs');
// @ts-expect-error TS1108: a return ends a CommonJS module, which tsc allows only in a function
if (require.main === module && guardDoor(process.argv.slice(2))) return;

const fs = require('fs');
const path = require('path');
const { signpost, wrapWithPrefix, renderTree, WIDTH } = require('./kernel/render.cjs');
const { resetDisplayWidth } = require('./kernel/terminal.cjs');
const { commitPathspecScoped, commitAcrossRepos, commitStagedScoped, commitStateScoped, discoveryScope, onStateBranch, STATE_BRANCH_HELD, OWNED_PATHS } = require('./domain/commit.cjs');
const { inFlightTask, runChecks, workMessage } = require('./domain/commit-task.cjs');
const { taskId } = require('./domain/task-id.cjs');
const { stageableSpecs, hasStagedDeletions, deletedAtHead, onBranch, operationInProgress, addRefused } = require('./kernel/git.cjs');
const { projectRepos, repoOf, repoPath, repoName, commitGroups, projectDirtyEntries } = require('./kernel/repos.cjs');
const { recordSubtopicAdd, recordSubtopicState, recordSubtopicStates, SUBTOPIC_STATES } = require('./domain/discussion-map.cjs');
const { recordThreadAdd, recordThreadState, recordThreadStates, recordThreadReframe, recordThreadRemove } = require('./domain/research-threads.cjs');
const { VALID_ROUTINGS, VALID_THREAD_STATUSES, TERMINAL_STATUSES, isParentExperimentId } = require('./kernel/manifest-schema.cjs');
const { sequenceMap, addItem, addItemsBatch, editItem, removeItem, renameItem, rerouteItem, handleItem, unhandleItem } = require('./domain/discovery-map.cjs');
const { sequenceBuildOrder } = require('./domain/build-order.cjs');
const { startTopic, completeTopic, reopenTopic, staleSources, supersedeTopic, cancelTopic, reactivateTopic, postponeTopic } = require('./domain/transitions.cjs');
const { incorporations } = require('./domain/specification.cjs');
const { mailboxDir, mailPhase } = require('./domain/derivations.cjs');
const { SEND_USAGE, MAILBOX_USAGE, ANSWERED_USAGE, sendMessage, mailboxOf, answerMessage } = require('./domain/mail.cjs');
const { loadWorkUnitManifest } = require('./kernel/manifest.cjs');
const { createExperiment, advanceExperiment, approveExperiment, concludeExperiment, abandonExperiment } = require('./domain/experiment.cjs');
const { seriesDir } = require('./domain/experiment-paths.cjs');
const { initTasks, startTask, fixAttempt, completeTask, analysisCycle } = require('./domain/tasks.cjs');
const { TASK_VERBS, runTaskVerb } = require('./domain/task-verbs.cjs');
const { archiveItems, restoreItems, deleteItems } = require('./domain/inbox.cjs');
const { stampAnalysisCache } = require('./domain/cache.cjs');
const agentState = require('./domain/agent-state.cjs');
const { boot } = require('./domain/boot.cjs');
const { stateMergeCommand } = require('./domain/state-merge.cjs');
const { LEDGER_USAGE, WRITE_VERBS, writeLedger } = require('./domain/ledger-write.cjs');
const { LEDGER_READ_USAGE, READ_VERBS, readLedgerVerb } = require('./domain/ledger-read.cjs');
const { LATE_CHECK_VERB, LATE_CHECK_USAGE, lateCheck } = require('./domain/ledger-late-check.cjs');
const { ASSET_USAGE, runAssetVerb } = require('./domain/asset.cjs');
const { CARRY_VERB, CARRY_USAGE, carryRecord } = require('./domain/ledger-carry.cjs');
const { VERDICT_USAGE, runVerdictVerb } = require('./domain/verdict.cjs');
const { followingLiveness } = require('./domain/ledger-copies.cjs');
const { answerGithubRule, answerGithubSquash } = require('./domain/github-setup.cjs');
const { answerGate, recordGateShown } = require('./domain/gate.cjs');
const { RAISE_USAGE, drawRaise, showRaise, answerRaise, raiseWaits } = require('./domain/raise.cjs');
const { raiseScreen } = require('./domain/projections/raise.cjs');
const { openGate } = require('./domain/projections/surfaces.cjs');
const { LAND_USAGE, landOpen, landChain, landPhase, landFinish } = require('./domain/landing.cjs');
const { BRIEF_USAGE, issueBrief } = require('./domain/brief.cjs');
const { CUT_USAGE, writeCut } = require('./domain/cut.cjs');
const { CHECKLIST_USAGE, runChecklistVerb } = require('./domain/checklist.cjs');
const { DECIDED_USAGE, runDecidedVerb } = require('./domain/decided.cjs');
const { MIGRATE_USAGE, runMigrateVerb } = require('./domain/directives.cjs');
const { beatPresence, clearPresence, beatQuietly, refreshQuietly, clearQuietly, scanPresence, scanProject, cleanupPresence, deferralSection, CODE_PHASES } = require('./domain/presence.cjs');
const { arriveAt, restoreSessionLabel, repairSessionLabels, resumeSessionLabel, recordLabelChoice } = require('./domain/session-label.cjs');
const { markConversation, endConversation } = require('./domain/conversation.cjs');
const { recordTask, recordExecutor, clearTask, isAgentId, positionReads, positionSections } = require('./domain/position.cjs');
const { ENTER_USAGE, enter } = require('./domain/enter.cjs');
const { createWorkUnit } = require('./domain/workunit-create.cjs');
const { importWorkUnitFiles } = require('./domain/workunit-import.cjs');
const { completeWorkUnit, cancelWorkUnit, reactivateWorkUnit, pivotWorkUnit } = require('./domain/workunit-lifecycle.cjs');
const { absorbWorkUnit } = require('./domain/workunit-absorb.cjs');
const { promoteWorkUnit } = require('./domain/workunit-promote.cjs');
const { openDiscoverySession, closeDiscoverySession } = require('./domain/discovery-session.cjs');
const { runFieldCommand, isRead } = require('./domain/fields.cjs');
const { renderSurface, SURFACES } = require('./domain/render.cjs');
const { resolveHandoff, topicHandoff, handoffSections, TOPIC_HANDOFF_USAGE } = require('./domain/handoff.cjs');
const roadmap = require('./domain/roadmap.cjs');
const baseline = require('./domain/baseline.cjs');
const { subjectSelector, taskSelector, codeLog, selectedDiff, uncommittedDiff, codeStatus } = require('./domain/code.cjs');
const walkthrough = require('./domain/walkthrough.cjs');
const roadmapSession = require('./domain/roadmap-session.cjs');
const { runKnowledge, knowledgeWaits } = require('./domain/knowledge/commands.cjs');
const { ExitSignal, messageOf, exitCodeOf, hookInput, hookProjectDir, processCall } = require('./kernel/call.cjs');
const { stateRoot, statePath, insideState } = require('./kernel/state-root.cjs');
const { codeRoot } = require('./kernel/code-root.cjs');
const { handedSession } = require('./kernel/process.cjs');

/** @typedef {import('./kernel/call.cjs').Call} Call */

/** @param {Call} call @param {string} msg @returns {never} */
function die(call, msg) {
  call.err(msg + '\n');
  throw new ExitSignal(1);
}

/** One decision-ready JSON line on stdout. @param {Call} call @param {object} obj */
function respond(call, obj) {
  call.out(JSON.stringify({ ok: true, ...obj }) + '\n');
}

/**
 * The same line on stderr — for a SessionStart hook target, whose stdout
 * Claude Code injects into the conversation as context.
 * @param {Call} call @param {object} obj
 */
function respondOnStderr(call, obj) {
  call.err(JSON.stringify({ ok: true, ...obj }) + '\n');
}

/**
 * Rendered gate sections after a response's JSON line (domain/projections).
 * Empty when the state renders nothing.
 * @param {Call} call @param {string} rendered
 */
function respondSections(call, rendered) {
  if (rendered !== '') call.out(rendered);
}

/**
 * `{ok:false}` JSON on stderr, exit 1. Extra decision-ready fields ride on
 * the error's `payload` (e.g. `missing_imports`).
 * @param {Call} call @param {unknown} err @returns {never}
 */
function failJson(call, err) {
  const payload =
    err && typeof err === 'object' && 'payload' in err && err.payload && typeof err.payload === 'object'
      ? err.payload
      : {};
  call.err(JSON.stringify({ ok: false, error: messageOf(err), ...payload }) + '\n');
  throw new ExitSignal(1);
}

// Minimal flag parser: collects `--key value` pairs, value-less flags named
// in `booleans`, repeatable `--key value` flags named in `repeatable`
// (gathered into `lists` arrays), and bare positionals.
/** @param {string[]} argv @param {string[]} [booleans] @param {string[]} [repeatable] */
function parseArgs(argv, booleans = [], repeatable = []) {
  /** @type {Record<string, string>} */
  const opts = {};
  /** @type {Set<string>} */
  const flags = new Set();
  /** @type {Record<string, string[]>} */
  const lists = {};
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      if (booleans.includes(name)) flags.add(name);
      else if (repeatable.includes(name)) (lists[name] = lists[name] || []).push(argv[++i]);
      else opts[name] = argv[++i];
    } else {
      positional.push(a);
    }
  }
  return { opts, flags, lists, positional };
}

const USAGE = `Usage: engine <command> [args]

Commands:
  boot [--start-again]
  state-merge pick <1|2> <choice>
  github-rule <yes|no>
  github-squash <yes|no>
  gate <name> (--pick <key> | --typed [<key>])
${RAISE_USAGE.replace(/^/gm, '  ')}
  knowledge <index|query|check|status|remove|compact|rebuild|fill|setup> … (engine knowledge --help)
  manifest get    <dotpath> [<field.path>]
  manifest set    <dotpath> <field> <value>
  manifest set    <dotpath> <field>=<value> [<field>=<value> …]
  manifest push   <dotpath> <field> <value>
  manifest pull   <dotpath> <field> <value>
  manifest delete <dotpath> <field.path>
  manifest apply  <work-unit> --file <ops.json>
  manifest exists <dotpath> [<field.path>]
  manifest list   [--status <s>] [--work-type <t>]
  manifest key-of <dotpath> <field.path> <value>
  manifest resolve <work-unit>.<phase>[.<topic>]
${LEDGER_USAGE.replace(/^/gm, '  ')}
${LEDGER_READ_USAGE.replace(/^/gm, '  ')}
  ${LATE_CHECK_USAGE}
${ASSET_USAGE.replace(/^/gm, '  ')}
${VERDICT_USAGE.replace(/^/gm, '  ')}
  workunit create <work-unit> <work-type> --description <text> --session-log-file <path>
                  [--import <path> …] [--seed <path> …]
  workunit import <work-unit> <path> [<path> …] --from <origin>
  workunit complete <work-unit> -m <message>
  workunit cancel <work-unit>
  workunit reactivate <work-unit>
  workunit pivot <work-unit>
  workunit absorb <feature> --into <epic> --topic <name>
  workunit promote <work-unit> <topic> --to <cc-work-unit> --description <text>
  discussion-map add <work-unit> <topic> <subtopic> [--parent <subtopic>]
  discussion-map set <work-unit> <topic> <subtopic> <state>
  discussion-map set <work-unit> <topic> <subtopic>=<state> [<subtopic>=<state> …]
  research-threads add <work-unit> <topic> <slug> --question <text> --origin <origin> [--parent <slug>]
  research-threads set <work-unit> <topic> <slug> <state> [--note <text>]
  research-threads set <work-unit> <topic> <slug>=<state> [<slug>=<state> …]
  research-threads reframe <work-unit> <topic> <slug> --question <text>
  research-threads remove <work-unit> <topic> <slug> [--into <slug>]
  build-order sequence <work-unit> <topic>=<order> [<topic>=<order> …]
  discovery-map sequence <work-unit> <topic>=<order> [<topic>=<order> …]
  discovery-map add <work-unit> <name> <research|discussion>
                (--summary <text> [--description <text>] [--brief-path <path>] | --backfill)
                [--source <tag>] [--force-dismissed]
  discovery-map add-batch <work-unit> --file <topics.json>
  discovery-map edit <work-unit> <name> [--summary <text>] [--description <text>]
  discovery-map remove <work-unit> <name>
  discovery-map rename <work-unit> <old> <new>
  discovery-map reroute <work-unit> <name> <research|discussion>
  discovery-map handle <work-unit> <name>
  discovery-map unhandle <work-unit> <name>
  discovery-session open  <work-unit> --session-log-file <path>
  discovery-session close <work-unit> -m <message>
  topic start <work-unit> <phase> <topic>
  ${SEND_USAGE}
  ${MAILBOX_USAGE}
  topic incorporations <work-unit> <topic>
  ${ANSWERED_USAGE}
  presence beat <work-unit> <phase> <topic>
  presence clear <work-unit> <phase> <topic>
  presence scan [work-unit]
  presence cleanup [session-id]
  session label <name> [<phase> <topic>]
  session label-config <true|false>
  session repair
  session cleanup [session-id]
  session resume [session-id]
  conversation end
  conversation position [session-id]
  conversation executor <session-id> <agent-id>
  ${ENTER_USAGE}
  layout guard                       (hook before Write, Edit and NotebookEdit; its JSON on stdin)
  shell guard                        (hook before Bash; its JSON on stdin)
  topic complete <work-unit> <phase> <topic>
  topic reopen <work-unit> <phase> <topic>
  topic supersede <work-unit> <phase> <topic> --by <topic>
  topic cancel <work-unit> <discovery|specification> <topic>
  topic reactivate <work-unit> <discovery|specification> <topic>
  topic postpone <work-unit> <topic> --horizon "<horizon>"
  experiment create <work-unit> <topic> --slug <kebab> (--from discussion --problem <file> [--question <id>] | --parent <E{n}>)
  experiment advance <work-unit> <topic> <id>
  experiment approve <work-unit> <topic> <id>
  experiment conclude <work-unit> <topic> <id> --verdict <one line>
  experiment abandon <work-unit> <topic> <id> --reason <one line>
  sources stale <work-unit> <discussion> [--except <spec-topic>]
  task phase <work-unit> <N> --title <title>
  task create <work-unit> <N> --file <path>
  task add <work-unit> <task> --file <path> --by <orchestrator|person>
  task type <work-unit> <task> <type>
  task link <work-unit> <task> --after <task>
  task ready <work-unit> [<N>]
  task start <work-unit> <task>
  task done <work-unit> <task>
  task close <work-unit> <task> --reason <reason>
  task list <work-unit> <N>
  task show <work-unit> <task>
  task init <work-unit> <topic>
  task start <work-unit> <topic> <internal-id>
  task fix-attempt <work-unit> <topic> <internal-id> --findings-file <path>
  task complete <work-unit> <topic> (<internal-id> | --external <id>) [--skipped]
                [--next-task <id|~>] [--phase <N>] [--phase-complete]
  task analysis-cycle <work-unit> <topic>
${LAND_USAGE.replace(/^/gm, '  ')}
${BRIEF_USAGE.replace(/^/gm, '  ')}
  brief guard                        (hook before Agent and SendMessage; its JSON on stdin)
  ${CUT_USAGE}
${CHECKLIST_USAGE.replace(/^/gm, '  ')}
${DECIDED_USAGE.replace(/^/gm, '  ')}
  ${MIGRATE_USAGE}
  inbox archive <path> [<path> …]
  inbox restore <path> [<path> …]
  inbox delete <path> [<path> …]
  baseline record <native|skipped>
  walkthrough record <walked|skipped>
  handoff <skill|/skill> [args …]
  ${TOPIC_HANDOFF_USAGE}
  roadmap state
  roadmap add <name> --horizon <h> --summary <text> [--kind <idea|bug|quick-fix>] [--origin <tag>] [--source <path> …]
  roadmap add-batch --file <items.json>
  roadmap edit <name> --summary <text>
  roadmap rename <old> <new>
  roadmap move <name> --horizon <h>
  roadmap remove <name>
  roadmap pull <name> [<name> …] --into <work-unit>
  roadmap bind <name> --topic <topic>
  roadmap pull-forward <name> --into <epic> --routing <research|discussion> [--force-dismissed]   (--routing names nothing on the return of a postponed topic)
  roadmap flag <name>
  roadmap session open --session-log-file <path>
  roadmap session close -m <message>
  roadmap import <path> [<path> …]
  roadmap horizon add <name> [--position <n>]
  roadmap horizon rename <old> <new>
  roadmap horizon reorder <name> [<name> …]   (the complete order)
  roadmap horizon merge <from> --into <to>
  roadmap horizon split <name> --new <name> --items <a,b,…> [--position <n>]
  roadmap horizon remove <name>
  cache stamp <work-unit> gap-analysis
  agent dispatch <work-unit> <phase> <topic> --kind <kind> [--label <slug> …] [--set <NNN>] [--final]
  agent scan     <work-unit> <phase> <topic>
  agent ack      <work-unit> <phase> <topic> <id> (--findings <F1,F2,…> | --clean)
  agent announce <work-unit> <phase> <topic> <id>
  agent surface  <work-unit> <phase> <topic> <id> <finding>[,<finding>…]
  agent incorporate <work-unit> <phase> <topic> <id>
  commit <work-unit> -m <message> [--plan <topic> | --discovery | --imports | --state | --topic <phase>/<topic> [--sweep]]
  commit --paths <file> … -m <message> --task <work-unit> <N.M>
  commit --paths <file> … -m <message> --for <work-unit> <implementation|review>/<topic>
  commit --state -m <message>
  commit --inbox -m <message>
  commit --roadmap -m <message>
  commit --workflows -m <message>
  commit --migrations -m <message>
  code log    <work-unit> <topic> [--phase <N>]
  code log    --subject <prefix>
  code diff   [<work-unit> <topic> [--phase <N>] | --subject <prefix>]
  code status
  render resume-gate <wu.phase.topic> [--mail N] [--variant plan|review|scoping|session]  (session: bare <wu>)
  render task-list   <wu.planning.topic> --file <payload.json>
  render plan-progress <wu.planning.topic> --variant construction-complete|concluded
  render findings-summary <wu.phase.topic> --file <payload.json>
  render finding          <wu.phase.topic> --file <payload.json> [--view full]
  render finding-announce <wu.phase.topic> --id <agent id> --file <payload.json>
  render finding-batch    <wu.phase.topic> --file <payload.json> [--first]
  render review-presentation <wu.review.topic> --file <payload.json>
  render review-gate      <wu.review.topic> --verdict pass|fail [--replan N]
  render spec-review-gate <wu.specification.topic> --variant continue|reloop
  render spec-completion-gate <wu.specification.topic> --variant assessment --file <payload.json> | --variant signoff
  render carry-note-gate  <wu.research.topic> --file <payload.json>
  render hypothesis-board <wu.investigation.topic> --file <payload.json> --variant plan|resume|check-in|pivot
  render findings-signoff-gate <wu.investigation.topic>
  render fix-direction     <wu.investigation.topic> --file <payload.json>
  render validation-gate   <wu.investigation.topic> --variant root-cause
  render validation-report <wu.investigation.topic> --file <payload.json> --variant root-cause|fix
  render project-skills   <wu.implementation.topic> --variant confirm|discovery|skipped [--file <payload.json>]
  render linters          <wu.implementation.topic> --variant confirm|discovery|skipped [--file <payload.json>]
  render convergence-diagnostic <wu.phase.topic> --file <payload.json>
  render mail-announce    <wu.phase.topic>
  render mail-offer       <wu.phase.topic> --file <payload.json>
  render mail-block       <wu.phase.topic>
  render send-offer       <wu.phase.topic> --file <payload.json>
  render research-threads <wu.research.topic>
  render research-conclude-gate <wu.research.topic> [--dead-end]
  render deep-dive-offer  <wu.research.topic> --file <payload.json>
  render perspective-offer <wu.discussion.topic> --file <payload.json>
  render in-flight-agents-gate <wu.research|discussion.topic> --count N [--pause]
  render review-findings-gate <wu.discussion.topic>
  render send-candidates  <wu.phase.topic> --file <payload.json>
  render off-topic-offer  <wu.phase.topic> --file <payload.json> [--variant discussion]
  render backlog-gate     <wu.phase.topic> --file <payload.json>
  render map-op-gate      <wu> --op edit-summary|edit-description|remove|rename|reroute|close|reopen --file <payload.json>
  render candidate-gate   <wu> --file <payload.json> | <wu> --variant announce
  render dismissed-topics <wu>
  render send-closed-target <wu.discovery.target>
  render conclude-gate    <wu.phase.topic>   (investigation|implementation|planning)
  render experiment-register <wu.experiment.topic>
  render experiment-approval-gate <wu.experiment.topic> --id <E{n}>
  render experiment-pick <wu.experiment.topic>
  render experiment-next-gate <wu.experiment.topic>
  render experiment-spawn-gate <wu.discussion.topic> --id <E{n}>
  render wait-gate        <wu.planning.topic>  (empty when the item holds no wait)
  render summary-backfill-gate <wu> --variant batch|proposed|unsourced [--file <payload.json>]
  render external-dependency-gate <wu.planning.topic> --variant blocking|pick|exit --blocking <topic,topic,…>
  render checkpoint-files-gate <wu.implementation.topic>  (DATA alone when no file is unexpected)
  render change-set-tree  <wu.review.topic>  (empty when the tree is clean)
  render executor-block-gate <wu.implementation.topic> --result blocked --file <sides.json> | --result failed
  render dependency-approval-gate <wu.planning.topic> --variant graph|updated-graph --file <payload.json> | --variant resolution
  render task-count-gate  <wu.planning.topic> --file <payload.json>
  render plan-context-gate <wu.planning.topic>
  render cross-cutting-gate --file <payload.json>
  render cross-cutting-references --file <payload.json>
  render plan-format-gate [--variant select --file <payload.json>]
  render plan-review-gate <wu.planning.topic> --variant continue|reloop
  render scoping-questions <wu> --open <what,where,why,exclusions>
  render complexity-gate  <wu> --file <payload.json>
  render first-phase-gate <wu> --file <payload.json>
  render correction-gate  <wu.specification.topic>
  render analysis-proceed-gate <wu>
  render spec-confirm-gate <wu.specification.topic> [--single|--unify]  (bare: empty unless the start incorporates a specification)
  render proposed-task    <wu.phase.topic> --file <payload.json> --gate gated|auto [--comment-hint STR]
  render incoherence-gate <wu.phase.topic> --file <payload.json> --variant conflict|gap-route|held-doc
  render resurface-gate   <wu.phase.topic> --file <payload.json> [--view full]
  render construction-gate <wu.phase.topic>
  render tasks-overview   <wu.phase.topic> --file <payload.json>
  render author-task-gate <wu.planning.topic> --m N --total N --title STR --file <payload.json> | --phase N  (--phase: empty while gated)
  render phase-tree       <wu.planning.topic> --file <payload.json> [--approve] | --menu-only
  render phase-completed   <wu> --phase <phase> [--paths]
  render phase-paused      <wu> --phase <discussion|planning|specification>
  render phase-note        <wu.phase.topic> --verb <Word> [--noun <word>]
  render step-opening      <wu.phase.topic> --step session|conclude|consolidation|do-now [--resumed]
  render format-version-check --file <payload.json>
  render entry-gate        <wu.phase.topic> [--own]  (discussion|planning|implementation|review|specification)
  render direct-entry-gate <wu.phase.topic>          (research|discussion — empty when the name is not on the map)
  render code-gate         <wu.phase.topic>          (implementation|review — empty when the code slot is free)
  render next-phase-gate   <wu> --prev <phase> --next <phase>  (empty when continuing is the only way forward)
  render cancel-gate       <wu.discovery|specification.name>
  render postpone-gate     <wu.discovery.topic> --horizon "<horizon>"
  render epic-all-done-gate <wu>
  render epic-soft-gate <wu> --action <action> [--topic <topic>]
  render task-brief        <wu.implementation.topic> --file <payload.json>
  render task-result       <wu.implementation.topic> --file <payload.json> --result approved|needs-changes|blocked|failed
  render task-gate         <wu.implementation.topic>
  render fix-gate          <wu.implementation.topic>
  render blocked-tasks     <wu.implementation.topic> --file <payload.json>
  render cycle-limit       <wu.implementation.topic>
  render cycle-gate
  render workunit-receipt  <wu> --verb complete|cancel|reactivate|pivot [--pipeline [--skipped-review]] [--warn]
  render topic-receipt     <wu.phase.topic> --verb complete [--warn]
  render topic-receipt     <wu.specification.spec> --verb supersede [--warn]
  render topic-receipt     <wu.discovery|specification.name> --verb cancel|reactivate [--warn]
  render topic-receipt     <wu.discovery.topic> --verb postpone|restore [--warn]
  render absorb-summary    <feature> --into <epic> --topic <name>
  render absorb-receipt    <epic> --topic <name> [--moved research,seeds,imports] [--experiments <N>] [--renamed <from>:<to>[,…]] [--warn]
  render absorb-continuation <epic> --feature <name>
  render promote-receipt   <wu.specification.topic> --to <cc-work-unit> [--imports <N>] [--warn]
  render import-reprompt   --file <payload.json>   # {"missing": ["path", …]} — the re-prompt after a landing refused
  render pivot-continuation <wu>
  render session-receipt   <wu> [--warn]
  render absorb-target     <feature>
  render absorb-confirm-gate <feature>
  render plan-topics       <wu>
  render plan-summary      <wu.planning.topic> --file <payload.json>
  render archived-actions  --path <archived path>
  render archived-delete-gate --path <archived path>
  render inbox-content     --path <inbox path>[,<inbox path>…]
  render inbox-restore-receipt --path <live path>
  render inbox-delete-receipt --path <archived path>
  render completed-actions <wu>
  render revisit-phases    <wu>
  render roadmap-view
  render roadmap-add-gate --horizon <name>
  render horizon-pick
  render park-gate --name <kebab> --horizon <h> --summary <text> [--kind <idea|bug|quick-fix>] [--source <path>]
  render inbox-roadmap-gate --file <entries.json>
  render roadmap-session-receipt [--warn]
  render roadmap-harvest-gate
  render roadmap-parks-gate
  render roadmap-shape-gate
  render shape-gate
  render opener --variant inbox --path <inbox path>[,…] --file <payload.json> | <wu> --variant seeded --file <payload.json> | <wu.discussion.topic> --variant discussion
  render synthesis-gate
  render query-failure-gate --file <payload.json>
  render baseline-progress
  render baseline-area-gate --area <name>
  render baseline-paused
  render baseline-receipt
  render baseline-scope-gate --file <payload.json>
  render baseline-area --file <payload.json>
  render baseline-round --file <payload.json>
  render baseline-doc-gate
  render baseline-manage-gate
  render baseline-doc-pick
  render baseline-offer-gate
  render walkthrough-offer [--menu-only]
  render walkthrough-screen --screen <1..8> --from <first-run|help> [--menu-only]
  render walkthrough-home
  render walkthrough-topics
  render walkthrough-topic --name <slug> [--menu-only]
  render send-report <work-unit>.<topic> --sent <path>
  render map <work-unit>.<topic>
  render decided <work-unit>.<topic> [--file <payload.json>] [--calls]
  render decided-strike <work-unit>.<topic>
  render wait-agents <work-unit>.<topic>   (empty when no agent of the topic is running)
  render migrations-applied --file <payload.json>
  render migration-gate
  render state-lost-gate
  render git-floor-stop
  render github-rule-gate
  render github-squash-gate
  render label-gate
  render knowledge-gate --variant reuse|deviate|mode|retry|wizard [--provider <name> --model <name>]
  render knowledge-ready
  render legacy-split-gate --variant themes|plan | --variant remove --theme <name>
  render state-merge-gate
  render ledger-stop
  render directive-stop --directive <id>
  render legacy-split-display --variant candidates|plan|errors|apply --file <payload.json> | <wu> --variant sources | <wu> --variant processing --source <name> | --variant complete --applied N --abandoned N --errored N
  render signpost <label> [--style step|substep] [--width N]     (dev aid)
  render wrap <text> [--width N] [--prefix STR]                  (dev aid)
  render tree [--width N]            (dev aid; JSON TreeNode array on stdin)`;

// ---------------------------------------------------------------------------
// manifest — the field surface (domain/fields.cjs): dot-path addressing over
// manifest fields with schema validation and the shared lock. Output contract
// split on purpose: reads (get/exists/list/key-of/resolve) keep the absorbed
// CLI's bare stdout byte-for-byte — prose substitution surfaces, including
// their exit-code convention (2 = expected miss) — while mutations
// (set/push/pull/delete) answer with the engine's one-line JSON response.
//
// No field write heartbeats. A three-segment `set` looks self-referential and
// frequently is not: review's `updated` stamp and the epic menu's unblock
// both write one phase's item from another phase's session, and a beat there
// manufactures a hold on a topic nobody is in (P8).
// The session's cadence commit is its heartbeat; `apply`, the cross-topic
// batch door, never beat either.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runManifest(call, argv) {
  const [command, ...rest] = argv;
  if (command !== undefined && isRead(command)) {
    try {
      runFieldCommand(call.cwd, command, rest, call.out);
    } catch (err) {
      const code = err && typeof err === 'object' && 'exitCode' in err && typeof err.exitCode === 'number' ? err.exitCode : 1;
      call.err(`Error: ${messageOf(err)}\n`);
      throw new ExitSignal(code);
    }
    return;
  }
  try {
    const result = runFieldCommand(call.cwd, command ?? '', rest, call.out);
    respond(call, /** @type {object} */ (result));
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// ledger — the project's stream of questions, findings and decisions. Each
// write verb (domain/ledger-write.cjs) appends one event and commits the
// ledger to the state branch: its content as JSON on stdin, its links as
// flags naming entries by short id. A write holds the writer lock itself,
// never runCli's: around its fold of the ledger, the append and the commit
// alone, so what its request alone refuses never waits on a peer. Each read
// verb (domain/ledger-read.cjs) answers a projection of the ledger as JSON,
// holding no lock but `shown`, which holds the last-looked mark's, in the
// cache. The late one-decision check (domain/ledger-late-check.cjs) is
// boot's detached job, taking the lock for each result it records. `carry`
// (domain/ledger-carry.cjs) is the migration's, a topic's whole record
// appended in one write under the lock it takes itself.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runLedger(call, argv) {
  const [verb = '', ...rest] = argv;
  try {
    if (READ_VERBS.includes(verb)) respond(call, readLedgerVerb(call.cwd, verb, rest));
    else if (WRITE_VERBS.includes(verb)) respond(call, writeLedger(call.cwd, verb, rest, call.stdin));
    else if (verb === LATE_CHECK_VERB) respond(call, lateCheck(call.cwd, rest));
    else if (verb === CARRY_VERB) respond(call, carryRecord(call.cwd, rest));
    else throw new Error(`Usage: engine ledger <${[...WRITE_VERBS, ...READ_VERBS, LATE_CHECK_VERB, CARRY_VERB].join('|')}> …\n${LEDGER_USAGE}\n${LEDGER_READ_USAGE}\n${LATE_CHECK_USAGE}\n${CARRY_USAGE}`);
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// asset — a spike's folder, and the links from the ledger's entries to the
// files that inform them (domain/asset.cjs): a link holds the writer lock
// around its read of the ledger, the append and the commit, as a ledger
// write does, and a spike around taking its number.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runAsset(call, argv) {
  const [verb = '', ...rest] = argv;
  try {
    respond(call, runAssetVerb(call.cwd, verb, rest));
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// verdict — the verdicts on departures (domain/verdict.cjs): `queue` answers
// the departures this machine logged waiting on one, the ledger read as the
// ledger's reads are through the trust log, holding no lock; `give` logs one
// in the trust log, under the writer lock runCli takes, writing nothing the
// state holds.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runVerdict(call, argv) {
  const [verb = '', ...rest] = argv;
  try {
    respond(call, runVerdictVerb(call.cwd, verb, rest));
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// workunit — work-unit lifecycle. create is the work-type commit: one
// transaction covering the manifest, imports, seeds, the model-authored
// session log (installed verbatim — the engine never writes prose), and the
// scoped commit. A missing import fails the whole call with
// `missing_imports` in the response so the calling flow can re-prompt.
// complete/cancel/reactivate are the lifecycle transactions: manifest write,
// knowledge-base sync (warn-don't-block), scoped git commit. complete takes
// -m because its message varies by caller (manual vs pipeline-terminal vs
// review-skipped); cancel/reactivate messages are engine-owned. pivot flips
// a feature to an epic — both manifests, the map registration, the
// re-index — as one transaction with an engine-owned message. absorb merges
// a feature into an epic as a new topic and deletes the feature — validated
// completely before anything moves, one multi-pathspec commit at the end.
// promote moves a completed epic specification (and its source discussions)
// to a new, already-completed cross-cutting work unit — same shape: validated
// completely before anything moves, one multi-pathspec commit at the end.
// import is create's landing after the opener: files into the same
// `imports/` home, stamped with the origin that took them, one confined
// commit — and a beat on that origin's topic when a phase session landed it.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runWorkunit(call, argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'create') {
      const { opts, lists, positional } = parseArgs(rest, [], ['import', 'seed']);
      const [workUnit, workType] = positional;
      if (!workUnit || !workType || !opts.description || !opts['session-log-file']) {
        throw new Error('Usage: engine workunit create <work-unit> <work-type> --description <text> --session-log-file <path> [--import <path> …] [--seed <path> …]');
      }
      respond(call, createWorkUnit(call.cwd, workUnit, workType, {
        description: opts.description,
        sessionLogFile: opts['session-log-file'],
        imports: lists.import || [],
        seeds: lists.seed || [],
      }));
    } else if (command === 'import') {
      const { opts, positional } = parseArgs(rest);
      const [workUnit, ...paths] = positional;
      if (!workUnit || paths.length === 0 || !opts.from) {
        throw new Error('Usage: engine workunit import <work-unit> <path> [<path> …] --from <origin>');
      }
      const landed = importWorkUnitFiles(call.cwd, workUnit, paths, { origin: opts.from });
      // A phase session's landing is its own topic's work — the beat is the
      // same act as claiming the slot. A bare `discovery` origin names no
      // topic and beats nothing (discovery is serialised by its marker), and
      // a terminal item is finished: material filed against a closed topic is
      // not a session sitting in one.
      const [phase, topic] = opts.from.split('/');
      if (topic) {
        const status = topicStatus(call.cwd, workUnit, phase, topic);
        if (status !== null && !TERMINAL_TOPIC_STATUSES.includes(status)) {
          beatQuietly(call.cwd, workUnit, phase, topic);
        }
      }
      respond(call, landed);
    } else if (command === 'complete') {
      /** @type {string|null} */ let workUnit = null;
      /** @type {string|null} */ let message = null;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '-m' || a === '--message') message = rest[++i];
        else if (workUnit === null) workUnit = a;
        else throw new Error(`unexpected argument "${a}"`);
      }
      if (!workUnit || !message) {
        throw new Error('Usage: engine workunit complete <work-unit> -m <message>');
      }
      respond(call, completeWorkUnit(call.cwd, workUnit, { message }));
    } else if (command === 'cancel' || command === 'reactivate' || command === 'pivot') {
      const [workUnit, ...extra] = rest;
      if (!workUnit || extra.length > 0) {
        throw new Error(`Usage: engine workunit ${command} <work-unit>`);
      }
      const fn = command === 'cancel' ? cancelWorkUnit : command === 'reactivate' ? reactivateWorkUnit : pivotWorkUnit;
      respond(call, fn(call.cwd, workUnit));
    } else if (command === 'absorb') {
      const { opts, positional } = parseArgs(rest);
      const [feature] = positional;
      if (!feature || positional.length !== 1 || !opts.into || !opts.topic) {
        throw new Error('Usage: engine workunit absorb <feature> --into <epic> --topic <name>');
      }
      respond(call, absorbWorkUnit(call.cwd, feature, { into: opts.into, topic: opts.topic }));
    } else if (command === 'promote') {
      const { opts, positional } = parseArgs(rest);
      const [workUnit, topic] = positional;
      if (!workUnit || !topic || positional.length !== 2 || !opts.to || !opts.description) {
        throw new Error('Usage: engine workunit promote <work-unit> <topic> --to <cc-work-unit> --description <text>');
      }
      respond(call, promoteWorkUnit(call.cwd, workUnit, topic, { to: opts.to, description: opts.description }));
    } else {
      throw new Error('Usage: engine workunit <create|import|complete|cancel|reactivate|pivot|absorb|promote> …');
    }
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// discussion-map — Discussion Map subtopic writes. add/set are domain
// transactions (domain/discussion-map.cjs): load → apply → save under the
// work unit's manifest lock → one decision-ready JSON line, no git commit
// (the session's commit cadence picks the manifest change up).
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runDiscussionMap(call, argv) {
  const [command, ...rest] = argv;
  const { opts, positional } = parseArgs(rest);
  const { cwd } = call;

  try {
    const [workUnit, topic, subtopic, state] = positional;
    if (command === 'add') {
      if (!workUnit || !topic || !subtopic) {
        throw new Error('Usage: engine discussion-map add <work-unit> <topic> <subtopic> [--parent <subtopic>]');
      }
      respond(call, recordSubtopicAdd(cwd, workUnit, topic, subtopic, { parent: opts.parent ?? null }));
    } else if (command === 'set') {
      const pairs = positional.slice(2);
      if (pairs.some((p) => p.includes('='))) {
        // Uniform batch — every argument a <subtopic>=<state> pair, never
        // mixed with the positional form (the manifest set grammar).
        if (!workUnit || !topic || !pairs.length || !pairs.every((p) => /^[^=]+=[^=]+$/.test(p))) {
          throw new Error(`Usage: engine discussion-map set <work-unit> <topic> <subtopic>=<state> [<subtopic>=<state> …] — uniform pairs, never mixed with the positional form`);
        }
        respond(call, recordSubtopicStates(cwd, workUnit, topic, pairs.map((p) => {
          const i = p.indexOf('=');
          return [p.slice(0, i), p.slice(i + 1)];
        })));
      } else {
        if (!workUnit || !topic || !subtopic || !state) {
          throw new Error(`Usage: engine discussion-map set <work-unit> <topic> <subtopic> <${SUBTOPIC_STATES.join('|')}> — or a uniform <subtopic>=<state> batch`);
        }
        respond(call, recordSubtopicState(cwd, workUnit, topic, subtopic, state));
      }
    } else {
      throw new Error('Usage: engine discussion-map <add|set> …');
    }
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// research-threads — the thread register's writes. Every verb is a domain
// transaction (domain/research-threads.cjs): load → apply → save under the
// work unit's manifest lock → one decision-ready JSON line, no git commit
// (the session's commit cadence picks the manifest change up).
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runResearchThreads(call, argv) {
  const [command, ...rest] = argv;
  const { opts, positional } = parseArgs(rest);
  const { cwd } = call;

  try {
    const [workUnit, topic, slug, state] = positional;
    if (command === 'add') {
      if (!workUnit || !topic || !slug || !opts.question || !opts.origin) {
        throw new Error('Usage: engine research-threads add <work-unit> <topic> <slug> --question <text> --origin <origin> [--parent <slug>]');
      }
      respond(call, recordThreadAdd(cwd, workUnit, topic, slug, { question: opts.question, origin: opts.origin, parent: opts.parent ?? null }));
    } else if (command === 'set') {
      const pairs = positional.slice(2);
      if (pairs.some((p) => p.includes('='))) {
        // Uniform batch — every argument a <slug>=<state> pair, never mixed
        // with the positional form (the manifest set grammar); a note names
        // one parked thread's reason, so it rides the positional form alone.
        if (!workUnit || !topic || !pairs.length || !pairs.every((p) => /^[^=]+=[^=]+$/.test(p))) {
          throw new Error('Usage: engine research-threads set <work-unit> <topic> <slug>=<state> [<slug>=<state> …] — uniform pairs, never mixed with the positional form');
        }
        if (opts.note !== undefined) {
          throw new Error('--note is legal with parked alone and takes the positional form: engine research-threads set <work-unit> <topic> <slug> parked --note <text>');
        }
        respond(call, recordThreadStates(cwd, workUnit, topic, pairs.map((p) => {
          const i = p.indexOf('=');
          return [p.slice(0, i), p.slice(i + 1)];
        })));
      } else {
        if (!workUnit || !topic || !slug || !state) {
          throw new Error(`Usage: engine research-threads set <work-unit> <topic> <slug> <${VALID_THREAD_STATUSES.join('|')}> [--note <text>] — or a uniform <slug>=<state> batch`);
        }
        respond(call, recordThreadState(cwd, workUnit, topic, slug, state, { note: opts.note }));
      }
    } else if (command === 'reframe') {
      if (!workUnit || !topic || !slug || !opts.question) {
        throw new Error('Usage: engine research-threads reframe <work-unit> <topic> <slug> --question <text>');
      }
      respond(call, recordThreadReframe(cwd, workUnit, topic, slug, opts.question));
    } else if (command === 'remove') {
      if (!workUnit || !topic || !slug || ('into' in opts && !opts.into)) {
        throw new Error('Usage: engine research-threads remove <work-unit> <topic> <slug> [--into <slug>] — --into names the survivor');
      }
      respond(call, recordThreadRemove(cwd, workUnit, topic, slug, { into: opts.into ?? null }));
    } else {
      throw new Error('Usage: engine research-threads <add|set|reframe|remove> …');
    }
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// discovery-map — the Discovery Map's writes. sequence records the suggested
// execution order as one transaction with its own scoped commit; the per-item
// map operations (add/edit/remove/rename/reroute/handle/unhandle) write the
// manifest with no git commit — the calling session's commit cadence picks
// the change up. Judgment (what to change) stays with the caller; lifecycle
// gates are enforced in the domain op.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runDiscoveryMap(call, argv) {
  const [command, ...rest] = argv;
  const { cwd } = call;

  try {
    const { opts, flags, positional } = parseArgs(rest, ['force-dismissed', 'backfill']);
    const [workUnit] = positional;
    if (command === 'add-batch') {
      if (!workUnit) throw new Error('Usage: engine discovery-map add-batch <work-unit> --file <topics.json>');
      if (!opts.file) throw new Error('discovery-map add-batch: --file <topics.json> is required');
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(path.resolve(cwd, opts.file), 'utf8'));
      } catch (err) {
        throw new Error(`discovery-map add-batch: cannot read payload: ${err instanceof Error ? err.message : String(err)}`);
      }
      respond(call, addItemsBatch(cwd, workUnit, parsed));
      return;
    }
    if (command === 'sequence') {
      if (!workUnit || positional.length < 2) {
        throw new Error('Usage: engine discovery-map sequence <work-unit> <topic>=<order> [<topic>=<order> …]');
      }
      const orders = parseOrderPairs(positional.slice(1));
      respond(call, sequenceMap(cwd, workUnit, orders));
    } else if (command === 'add') {
      // Strict positional count: an unquoted payload would spill into
      // positionals and silently truncate the text — refuse instead.
      if (!workUnit || positional.length !== 3 || (opts.summary === undefined && !flags.has('backfill'))) {
        throw new Error(`Usage: engine discovery-map add <work-unit> <name> <${VALID_ROUTINGS.join('|')}> (--summary <text> [--description <text>] [--brief-path <path>] | --backfill) [--source <tag>] [--force-dismissed]`);
      }
      respond(call, addItem(cwd, workUnit, positional[1], {
        routing: positional[2],
        source: opts.source,
        summary: opts.summary,
        description: opts.description,
        briefPath: opts['brief-path'],
        forceDismissed: flags.has('force-dismissed'),
        backfill: flags.has('backfill'),
      }));
    } else if (command === 'edit') {
      // Strict positional count: an unquoted payload would spill into
      // positionals and silently truncate the text — refuse instead.
      const summary = typeof opts.summary === 'string' ? opts.summary : undefined;
      const description = typeof opts.description === 'string' ? opts.description : undefined;
      if (!workUnit || positional.length !== 2 || (summary === undefined && description === undefined)) {
        throw new Error('Usage: engine discovery-map edit <work-unit> <name> [--summary <text>] [--description <text>] (at least one flag required)');
      }
      respond(call, editItem(cwd, workUnit, positional[1], { summary, description }));
    } else if (command === 'remove' || command === 'handle' || command === 'unhandle') {
      if (!workUnit || positional.length !== 2) {
        throw new Error(`Usage: engine discovery-map ${command} <work-unit> <name>`);
      }
      const fn = command === 'remove' ? removeItem : command === 'handle' ? handleItem : unhandleItem;
      respond(call, fn(cwd, workUnit, positional[1]));
    } else if (command === 'rename') {
      if (!workUnit || positional.length !== 3) {
        throw new Error('Usage: engine discovery-map rename <work-unit> <old> <new>');
      }
      respond(call, renameItem(cwd, workUnit, positional[1], positional[2]));
    } else if (command === 'reroute') {
      if (!workUnit || positional.length !== 3) {
        throw new Error(`Usage: engine discovery-map reroute <work-unit> <name> <${VALID_ROUTINGS.join('|')}>`);
      }
      respond(call, rerouteItem(cwd, workUnit, positional[1], positional[2]));
    } else {
      throw new Error('Usage: engine discovery-map <sequence|add|edit|remove|rename|reroute|handle|unhandle> …');
    }
  } catch (err) {
    failJson(call, err);
  }
}


/**
 * Parse `{topic}={order}` pairs shared by the two sequencing verbs. Callers
 * guard for at least one pair before calling.
 * @param {string[]} pairs @returns {Record<string, number>}
 */
function parseOrderPairs(pairs) {
  /** @type {Record<string, number>} */
  const orders = {};
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    const name = eq > 0 ? pair.slice(0, eq) : '';
    const value = eq > 0 ? pair.slice(eq + 1) : '';
    if (!name || !/^[1-9][0-9]*$/.test(value)) {
      throw new Error(`bad assignment "${pair}" (expected {topic}={order}, order a positive integer)`);
    }
    if (name in orders) {
      throw new Error(`topic "${name}" assigned twice`);
    }
    orders[name] = Number(value);
  }
  return orders;
}

// ---------------------------------------------------------------------------
// build-order — the spec-side twin of discovery-map sequencing. One verb:
// `sequence` records the whole live set's order in one transaction and
// clears `build_order_stale`. Validation (full coverage, contiguous 1..N)
// lives in the domain op.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runBuildOrder(call, argv) {
  const [command, ...rest] = argv;
  const { cwd } = call;

  try {
    if (command !== 'sequence') {
      throw new Error('Usage: engine build-order sequence <work-unit> <topic>=<order> [<topic>=<order> …]');
    }
    const { positional } = parseArgs(rest, []);
    const [workUnit] = positional;
    if (!workUnit || positional.length < 2) {
      throw new Error('Usage: engine build-order sequence <work-unit> <topic>=<order> [<topic>=<order> …]');
    }
    const orders = parseOrderPairs(positional.slice(1));
    respond(call, sequenceBuildOrder(cwd, workUnit, orders));
  } catch (err) {
    failJson(call, err);
  }
}


// ---------------------------------------------------------------------------
// discovery-session — the epic discovery-session lifecycle. open installs
// the model-drafted log under the next session number and sets the
// active-session marker — no commit (the session is live; the calling
// flow's commit cadence picks the change up). close is one transaction:
// clear the marker, index the finalised log (warn-don't-block), commit
// scoped to the work unit with the caller's message. The log's content is
// model-authored — the engine never writes prose.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runDiscoverySession(call, argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'open') {
      /** @type {string|null} */ let workUnit = null;
      /** @type {string|null} */ let sessionLogFile = null;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--session-log-file') sessionLogFile = rest[++i];
        else if (workUnit === null) workUnit = a;
        else throw new Error(`unexpected argument "${a}"`);
      }
      if (!workUnit || !sessionLogFile) {
        throw new Error('Usage: engine discovery-session open <work-unit> --session-log-file <path>');
      }
      respond(call, openDiscoverySession(call.cwd, workUnit, { sessionLogFile }));
    } else if (command === 'close') {
      /** @type {string|null} */ let workUnit = null;
      /** @type {string|null} */ let message = null;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '-m' || a === '--message') message = rest[++i];
        else if (workUnit === null) workUnit = a;
        else throw new Error(`unexpected argument "${a}"`);
      }
      if (!workUnit || !message) {
        throw new Error('Usage: engine discovery-session close <work-unit> -m <message>');
      }
      respond(call, closeDiscoverySession(call.cwd, workUnit, { message }));
    } else {
      throw new Error('Usage: engine discovery-session <open|close> …');
    }
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// topic — phase-item transitions. start/send/complete/reopen/supersede are
// manifest-side lifecycle bookkeeping (KB sync where the phase is indexed:
// index on complete, remove on supersede; reopen syncs nothing —
// warn-don't-block) with no git commit — the calling session's commit
// cadence picks the change up. cancel/reactivate act on a stage's unit —
// `discovery` (the map row with its research, discussion, and experiments)
// or `specification` (with its planning) — one transaction per call:
// manifest write, knowledge-base sync (warn-don't-block), scoped git commit.
// The JSON response reports what happened — no follow-up read needed.
//
// Heartbeats ride the self-referential verbs — the session acting on its own
// topic: `start` (opening it), `answered` (taking a message out of its own
// mailbox), and `mailbox` (the loop checks it every turn, so a turn with no
// writes still registers). `complete` is the release: the topic is closed,
// so the slot it held opens at that moment rather than at some later commit.
// `send` never beats — delivery acts on the TARGET topic from the origin's
// session, and a beat there would stamp the origin process onto a topic it
// does not hold. Nor do `cancel`, `reactivate`, `supersede` or `reopen`:
// those are analysis and navigation actors reaching across topics.
// ---------------------------------------------------------------------------

const TOPIC_COMMANDS = { start: startTopic, complete: completeTopic, reopen: reopenTopic, cancel: cancelTopic, reactivate: reactivateTopic };

// The self-referential verbs among those dispatched through TOPIC_COMMANDS;
// `mailbox` and `answered` beat at their own branches.
const TOPIC_BEATS = ['start'];

// The verbs whose phase argument names a stage's unit, not a phase item.
const UNIT_VERBS = ['cancel', 'reactivate'];

/**
 * A session hook target's session id: the argument when given, else the
 * hook's stdin JSON.
 * @param {Call} call @param {string[]} rest @param {string} usage @returns {string|null}
 */
function hookSessionId(call, rest, usage) {
  if (rest.length > 1) throw new Error(usage);
  const sessionId = rest[0] || hookInput(call).session_id;
  return typeof sessionId === 'string' && sessionId ? sessionId : null;
}

/** @param {Call} call @param {string[]} argv */
function runPresence(call, argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'beat' || command === 'clear') {
      const [workUnit, phase, topic] = rest;
      if (!workUnit || !phase || !topic || rest.length !== 3) {
        throw new Error(`Usage: engine presence ${command} <work-unit> <phase> <topic>`);
      }
      respond(call, (command === 'beat' ? beatPresence : clearPresence)(call.cwd, workUnit, phase, topic));
      return;
    }
    if (command === 'scan') {
      const [workUnit] = rest;
      if (rest.length > 1) throw new Error('Usage: engine presence scan [work-unit]');
      // An empty argument is an unset shell variable (`scan "$wu"`), not a
      // request for the project read — refuse it loudly rather than silently
      // widening the scope. Only a genuinely absent argument takes that path.
      if (rest.length === 1 && !workUnit) {
        throw new Error('Usage: engine presence scan [work-unit] — an empty work unit is refused; omit the argument for the project-wide read');
      }
      // Work-unit-less: the project-wide read the code gate takes. The
      // deferral section is the analysis dispatch's, which always scans one
      // work unit — a project scan renders nothing.
      if (!workUnit) {
        respond(call, scanProject(call.cwd));
        return;
      }
      const res = scanPresence(call.cwd, workUnit);
      respond(call, res);
      respondSections(call, deferralSection(res));
      return;
    }
    if (command === 'cleanup') {
      // The SessionEnd hook's target.
      respond(call, cleanupPresence(hookProjectDir(call.cwd), hookSessionId(call, rest, 'Usage: engine presence cleanup [session-id]')));
      return;
    }
    throw new Error('Usage: engine presence <beat|clear|scan|cleanup> …');
  } catch (err) {
    failJson(call, err);
  }
}

/** @param {Call} call @param {string[]} argv */
function runSession(call, argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'label') {
      // A place labels itself: the name alone on arrival, name + phase +
      // topic inside a phase — never a phase without its topic.
      const [name, phase, topic] = rest;
      if (![1, 3].includes(rest.length) || rest.some((a) => !a)) {
        throw new Error('Usage: engine session label <name> [<phase> <topic>]');
      }
      respond(call, arriveAt(call.cwd, name, phase, topic));
      return;
    }
    if (command === 'label-config') {
      const [value] = rest;
      if (rest.length !== 1 || (value !== 'true' && value !== 'false')) {
        throw new Error('Usage: engine session label-config <true|false>');
      }
      respond(call, recordLabelChoice(call.cwd, value === 'true'));
      return;
    }
    if (command === 'repair') {
      if (rest.length !== 0) throw new Error('Usage: engine session repair');
      respond(call, repairSessionLabels(call.cwd));
      return;
    }
    if (command === 'cleanup') {
      // The SessionEnd hook's target.
      respond(call, restoreSessionLabel(hookProjectDir(call.cwd), hookSessionId(call, rest, 'Usage: engine session cleanup [session-id]')));
      return;
    }
    if (command === 'resume') {
      // The SessionStart hook's target.
      respondOnStderr(call, resumeSessionLabel(hookProjectDir(call.cwd), hookSessionId(call, rest, 'Usage: engine session resume [session-id]')));
      return;
    }
    throw new Error('Usage: engine session <label|label-config|repair|cleanup|resume> …');
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// enter — the one call a phase is entered by (domain/enter.cjs): its
// response line, then any question and the DATA naming what to read.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runEnter(call, argv) {
  try {
    const { response, sections } = enter(call.cwd, argv);
    respond(call, response);
    respondSections(call, sections);
  } catch (err) {
    failJson(call, err);
  }
}

/**
 * A family whose one verb is its guard, `{family} guard` — a hook's target
 * before a tool call (guards.cjs).
 * @param {string} family @returns {(call: Call, argv: string[]) => void}
 */
function guardFamily(family) {
  return (call, argv) => {
    if (argv[0] !== 'guard') die(call, `Usage: engine ${family} guard`);
    runGuard(call, `${family} guard`, argv.slice(1));
  };
}

/** @param {Call} call @param {string[]} argv */
function runConversation(call, argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'end') {
      // The SessionEnd hook's target.
      if (rest.length !== 0) throw new Error('Usage: engine conversation end');
      const input = hookInput(call);
      respond(call, endConversation(input.session_id, input.transcript_path));
      return;
    }
    if (command === 'position') {
      const sessionId = rest[0] || handedSession();
      if (rest.length > 1 || !sessionId) {
        throw new Error('Usage: engine conversation position [session-id] — the calling conversation\'s CLAUDE_CODE_SESSION_ID when no id is given');
      }
      respondSections(call, positionSections(positionReads(call.cwd, sessionId)));
      return;
    }
    if (command === 'executor') {
      // The gate mod's target, as an executor is dispatched.
      const [sessionId, agentId] = rest;
      if (rest.length !== 2 || !sessionId || !isAgentId(agentId)) {
        throw new Error('Usage: engine conversation executor <session-id> <agent-id> — the agent id letters, digits, - and _ alone');
      }
      respond(call, recordExecutor(sessionId, agentId));
      return;
    }
    throw new Error('Usage: engine conversation <end|position|executor> …');
  } catch (err) {
    failJson(call, err);
  }
}

/** @param {Call} call @param {string[]} argv */
function runSources(call, argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'stale') {
      const { opts, positional } = parseArgs(rest);
      const [workUnit, discussion] = positional;
      if (!workUnit || !discussion || positional.length !== 2 || ('except' in opts && typeof opts.except !== 'string')) {
        throw new Error('Usage: engine sources stale <work-unit> <discussion> [--except <spec-topic>]');
      }
      respond(call, staleSources(call.cwd, workUnit, discussion, { except: opts.except }));
      return;
    }
    throw new Error('Usage: engine sources <stale> …');
  } catch (err) {
    failJson(call, err);
  }
}

/**
 * The phase a unit's topics are talked through, where a topic's presence is
 * kept beside its mail; null for a unit that talks through none.
 * @param {string} cwd @param {string} unit
 */
function mailPhaseOf(cwd, unit) {
  return mailPhase(loadWorkUnitManifest(cwd, unit).work_type);
}

/** @param {Call} call @param {string[]} argv */
function runTopic(call, argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'supersede') {
      const { opts, positional } = parseArgs(rest);
      const [workUnit, phase, topic] = positional;
      if (!workUnit || !phase || !topic || positional.length !== 3 || !opts.by) {
        throw new Error('Usage: engine topic supersede <work-unit> <phase> <topic> --by <topic>');
      }
      respond(call, supersedeTopic(call.cwd, workUnit, phase, topic, { by: opts.by }));
      return;
    }
    if (command === 'mailbox') {
      const [workUnit, topic] = rest;
      if (!workUnit || !topic || rest.length !== 2) throw new Error(`Usage: engine ${MAILBOX_USAGE}`);
      const mailbox = mailboxOf(call.cwd, workUnit, topic);
      // A read is reachable for any topic — a foreign mailbox is legitimately
      // checked from another session — so it refreshes an owned hold only,
      // never creates one.
      const phase = mailPhaseOf(call.cwd, workUnit);
      if (phase !== null) refreshQuietly(call.cwd, workUnit, phase, topic);
      respond(call, mailbox);
      return;
    }
    if (command === 'incorporations') {
      const [workUnit, topic] = rest;
      if (!workUnit || !topic || rest.length !== 2) {
        throw new Error('Usage: engine topic incorporations <work-unit> <topic>');
      }
      const manifest = loadWorkUnitManifest(call.cwd, workUnit);
      respond(call, { work_unit: workUnit, topic, incorporations: incorporations(call.cwd, manifest, workUnit, topic) });
      return;
    }
    if (command === 'send') {
      const { opts, positional } = parseArgs(rest);
      const [workUnit, topic] = positional;
      if (!workUnit || !topic || positional.length !== 2) throw new Error(`Usage: engine ${SEND_USAGE}`);
      respond(call, sendMessage(call.cwd, workUnit, topic, { from: opts.from, contentFile: opts.content, slug: opts.slug }));
      return;
    }
    if (command === 'answered') {
      const { opts, positional } = parseArgs(rest);
      const [workUnit, topic, message] = positional;
      if (!workUnit || !topic || positional.length !== 3) throw new Error(`Usage: engine ${ANSWERED_USAGE}`);
      const answered = answerMessage(call.cwd, workUnit, topic, message, { entry: opts.entry });
      const phase = mailPhaseOf(call.cwd, workUnit);
      if (phase !== null) beatQuietly(call.cwd, workUnit, phase, topic);
      respond(call, answered);
      return;
    }
    if (command === 'postpone') {
      const { opts, positional } = parseArgs(rest);
      const [workUnit, topic] = positional;
      if (!workUnit || !topic || positional.length !== 2) {
        throw new Error('Usage: engine topic postpone <work-unit> <topic> --horizon "<horizon>"');
      }
      respond(call, postponeTopic(call.cwd, workUnit, topic, { horizon: opts.horizon }));
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(TOPIC_COMMANDS, command)) {
      throw new Error('Usage: engine topic <start|send|complete|reopen|supersede|cancel|reactivate|postpone|mailbox|incorporations|answered> <work-unit> …');
    }
    const fn = TOPIC_COMMANDS[/** @type {keyof typeof TOPIC_COMMANDS} */ (command)];
    const [workUnit, phase, topic] = rest;
    if (!workUnit || !phase || !topic || rest.length !== 3) {
      const phaseArg = UNIT_VERBS.includes(command) ? '<discovery|specification>' : '<phase>';
      throw new Error(`Usage: engine topic ${command} <work-unit> ${phaseArg} <topic>`);
    }
    const result = fn(call.cwd, workUnit, phase, topic);
    if (TOPIC_BEATS.includes(command)) beatQuietly(call.cwd, workUnit, phase, topic);
    // The close releases the slot. Everything after it — the conclusion
    // commit, a plan or implementation wrap-up — is a session tidying a topic
    // it has finished, and none of it should re-take the hold.
    if (command === 'complete') clearQuietly(call.cwd, workUnit, phase, topic);
    respond(call, result);
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// experiment — the series lifecycle on a topic's experiment item
// (domain/experiment.cjs): create is the spawn (id + item + the spawning
// item's evidence lock — or a sub-experiment under a running parent);
// advance/approve/conclude/abandon record one experiment's design-before-data
// walk. Manifest writes with no git commit — the session's commit cadence
// picks the change up.
//
// Beats follow the acting session: `create --from` is the spawning
// discussion session recording the spawn on its own item, so it beats
// that phase; every other verb (splits included) is the laboratory session
// working its own topic, so it beats the experiment slot — and a top-level
// conclude or abandon clears it: the record's close is the session's release.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runExperiment(call, argv) {
  const [command, ...rest] = argv;
  const { cwd } = call;
  try {
    const { opts, positional } = parseArgs(rest);
    const [workUnit, topic, id] = positional;
    if (command === 'create') {
      if (!workUnit || !topic || positional.length !== 2 || !opts.slug) {
        throw new Error('Usage: engine experiment create <work-unit> <topic> --slug <kebab> (--from discussion --problem <file> [--question <id>] | --parent <E{n}>)');
      }
      const created = createExperiment(cwd, workUnit, topic, { slug: opts.slug, from: opts.from, parent: opts.parent, problem: opts.problem, question: opts.question });
      beatQuietly(cwd, workUnit, opts.from ?? 'experiment', topic);
      respond(call, created);
      return;
    }
    if (command === 'conclude' || command === 'abandon') {
      const payload = command === 'conclude' ? opts.verdict : opts.reason;
      if (!workUnit || !topic || !id || positional.length !== 3 || payload === undefined) {
        throw new Error(`Usage: engine experiment ${command} <work-unit> <topic> <id> --${command === 'conclude' ? 'verdict' : 'reason'} <one line>`);
      }
      const result = command === 'conclude'
        ? concludeExperiment(cwd, workUnit, topic, id, { verdict: payload })
        : abandonExperiment(cwd, workUnit, topic, id, { reason: payload });
      (isParentExperimentId(id) ? clearQuietly : beatQuietly)(cwd, workUnit, 'experiment', topic);
      respond(call, result);
      return;
    }
    if (command === 'advance' || command === 'approve') {
      if (!workUnit || !topic || !id || positional.length !== 3) {
        throw new Error(`Usage: engine experiment ${command} <work-unit> <topic> <id>`);
      }
      const result = (command === 'advance' ? advanceExperiment : approveExperiment)(cwd, workUnit, topic, id);
      beatQuietly(cwd, workUnit, 'experiment', topic);
      respond(call, result);
      return;
    }
    throw new Error('Usage: engine experiment <create|advance|approve|conclude|abandon> <work-unit> <topic> …');
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// task — the tracker's verbs through the project's task driver
// (domain/task-verbs.cjs): phase, create, add, type, link, ready, start,
// done, close, list and show, each committing what it wrote to the state
// branch.
//
// Beside them, until the plan's loops go, the implementation-task
// bookkeeping: format-blind, manifest-side only — init, the three-argument
// start, fix-attempt, complete and analysis-cycle. The session does the plan
// surgery and these record it, with no git commit — the per-task commit is
// the session's. Each verb answers with its one-line JSON only; the loop's
// brief, result header, and gate sections are fetched by their own `render`
// calls (task-brief, task-result, task-gate, fix-gate, blocked-tasks,
// cycle-limit, cycle-gate) at the stage that displays them.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runTask(call, argv) {
  const [command, ...rest] = argv;
  const { cwd } = call;
  try {
    const { opts, flags, positional } = parseArgs(rest, ['skipped', 'phase-complete']);
    const [workUnit, topic, internalId] = positional;
    if (Object.hasOwn(TASK_VERBS, command) && !(command === 'start' && positional.length === 3)) {
      respond(call, runTaskVerb(cwd, command, positional, opts));
    } else if (command === 'init' || command === 'analysis-cycle') {
      if (!workUnit || !topic) throw new Error(`Usage: engine task ${command} <work-unit> <topic>`);
      if (command === 'init') {
        respond(call, initTasks(cwd, workUnit, topic));
      } else {
        respond(call, analysisCycle(cwd, workUnit, topic));
      }
    } else if (command === 'start') {
      const started = startTask(cwd, workUnit, topic, internalId);
      recordTask(cwd, workUnit, topic, internalId);
      respond(call, started);
    } else if (command === 'fix-attempt') {
      if (!workUnit || !topic || !internalId || !opts['findings-file']) {
        throw new Error('Usage: engine task fix-attempt <work-unit> <topic> <internal-id> --findings-file <path>');
      }
      respond(call, fixAttempt(cwd, workUnit, topic, internalId, opts['findings-file']));
    } else if (command === 'complete') {
      if (!workUnit || !topic) {
        throw new Error('Usage: engine task complete <work-unit> <topic> (<internal-id> | --external <id>) [--skipped] [--next-task <id|~>] [--phase <N>] [--phase-complete]');
      }
      /** @type {number|undefined} */
      let phase;
      if (opts.phase !== undefined) {
        phase = parseInt(opts.phase, 10);
        if (!Number.isInteger(phase)) throw new Error(`--phase must be a number (got "${opts.phase}")`);
      }
      const next = opts['next-task'];
      const result = completeTask(cwd, workUnit, topic, {
        internalId: internalId ?? null,
        externalId: opts.external ?? null,
        skipped: flags.has('skipped'),
        nextTask: next === undefined ? undefined : next === '~' ? null : next,
        phase,
        phaseComplete: flags.has('phase-complete'),
      });
      clearTask(workUnit, topic, result.internal_id);
      respond(call, result);
    } else {
      throw new Error(`Usage: engine task <${[...Object.keys(TASK_VERBS), 'init', 'fix-attempt', 'complete', 'analysis-cycle'].join('|')}> …`);
    }
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// land — a task's change landed through the project's landing driver
// (domain/landing.cjs): a task's pull request opened and chained into its
// phase's stack, a phase merged whole, and the phases still standing merged
// at finish.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runLand(call, argv) {
  const [command, ...rest] = argv;
  const { cwd } = call;
  try {
    const { opts, positional } = parseArgs(rest);
    const flagless = Object.keys(opts).length === 0;
    const [unit, which] = positional;
    if (command === 'open' && positional.length === 2 && flagless) {
      respond(call, landOpen(cwd, unit, which));
    } else if (command === 'chain' && positional.length === 2 && flagless) {
      respond(call, landChain(cwd, unit, which));
    } else if (command === 'phase' && positional.length === 2 && flagless) {
      respond(call, landPhase(cwd, unit, which));
    } else if (command === 'finish' && positional.length === 1 && flagless) {
      respond(call, landFinish(cwd, unit));
    } else {
      throw new Error(`Usage: ${LAND_USAGE.split('\n').map((line) => `engine ${line}`).join(' | ')}`);
    }
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// brief — a role's brief filled from its records and stored in the calling
// conversation's folder, for the dispatch to carry by its pointer
// (domain/brief.cjs).
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runBrief(call, argv) {
  if (argv[0] === 'guard') {
    runGuard(call, 'brief guard', argv.slice(1));
    return;
  }
  try {
    respond(call, issueBrief(call.cwd, argv));
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// cut — the phase cut written onto a unit's manifest from a file, checked
// against its spec first (domain/cut.cjs).
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runCut(call, argv) {
  const { opts, positional } = parseArgs(argv);
  try {
    if (positional.length !== 1 || Object.keys(opts).join() !== 'file' || !opts.file) throw new Error(`Usage: engine ${CUT_USAGE}`);
    respond(call, writeCut(call.cwd, positional[0], opts.file));
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// checklist — a closing point's checklist shown, an item marked done or
// skipped with its reason, and the checklist closed (domain/checklist.cjs).
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runChecklist(call, argv) {
  const [verb, ...rest] = argv;
  const { opts, positional } = parseArgs(rest);
  try {
    respond(call, runChecklistVerb(call.cwd, verb, positional, opts));
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// decided — the person's yes at a topic's decided gate, and a candidate
// struck from its screen or its strike undone (domain/decided.cjs).
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runDecided(call, argv) {
  try {
    const answer = runDecidedVerb(call.cwd, argv);
    // The yes releases the topic's slot, as a conclusion does.
    if (argv[0] === 'yes') clearQuietly(call.cwd, argv[1], 'discussion', argv[2]);
    respond(call, answer);
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// migrate — a directive of the migration checked (domain/directives.cjs).
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runMigrate(call, argv) {
  try {
    respond(call, runMigrateVerb(call.cwd, argv));
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// inbox — archive / restore / delete one or more inbox items as a single
// transaction: strict path validation, file moves (or git rm), one scoped
// commit for the whole set.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runInbox(call, argv) {
  const [command, ...paths] = argv;
  try {
    if (!['archive', 'restore', 'delete'].includes(command) || paths.length === 0) {
      throw new Error('Usage: engine inbox <archive|restore|delete> <path> [<path> …]');
    }
    const { cwd } = call;
    if (command === 'archive') respond(call, archiveItems(cwd, paths));
    else if (command === 'restore') respond(call, restoreItems(cwd, paths));
    else respond(call, deleteItems(cwd, paths));
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// baseline, walkthrough — the project's two one-time records
// (domain/baseline.cjs, domain/walkthrough.cjs). Each answers a question
// leeway asks once, writes one field on the project manifest, and
// commits it confined in the same call.
// ---------------------------------------------------------------------------

/**
 * `baseline record <native|skipped>` — leeway's one-time verdict,
 * written and committed in one confined transaction.
 * @param {Call} call @param {string[]} argv
 */
function runBaseline(call, argv) {
  const [command, ...rest] = argv;
  const { cwd } = call;
  try {
    if (command === 'record') {
      if (rest.length !== 1) throw new Error('Usage: engine baseline record <native|skipped>');
      respond(call, baseline.recordBaselineVerdict(cwd, rest[0]));
      return;
    }
    throw new Error(`Unknown baseline command: ${command}. Usage: engine baseline record <native|skipped>`);
  } catch (err) {
    failJson(call, err);
  }
}

/**
 * `walkthrough record <walked|skipped>` — the answer to leeway's
 * one-time offer, written and committed in one confined transaction.
 * @param {Call} call @param {string[]} argv
 */
function runWalkthrough(call, argv) {
  const [command, ...rest] = argv;
  const { cwd } = call;
  try {
    if (command === 'record') {
      if (rest.length !== 1) throw new Error('Usage: engine walkthrough record <walked|skipped>');
      respond(call, walkthrough.recordWalkthrough(cwd, rest[0]));
      return;
    }
    throw new Error(`Unknown walkthrough command: ${command}. Usage: engine walkthrough record <walked|skipped>`);
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// roadmap — the product-roadmap layer on the project manifest
// (domain/roadmap.cjs): horizons + items — ideas at capability grain, a bug
// or a quick-fix one fix each — lifecycle by join. Every mutation is one
// transaction under the project lock with its own pathspec commit of the
// project manifest — no work-unit cadence covers it, and a park fired
// mid-session must be durable immediately. `state` is the derived read every
// consumer shares.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runRoadmap(call, argv) {
  const [command, ...rest] = argv;
  const { cwd } = call;
  try {
    if (command === 'state') {
      if (rest.length !== 0) throw new Error('Usage: engine roadmap state');
      respond(call, roadmap.roadmapState(cwd));
      return;
    }
    if (command === 'session') {
      const [sub, ...srest] = rest;
      if (sub === 'open') {
        /** @type {string|null} */ let sessionLogFile = null;
        for (let i = 0; i < srest.length; i++) {
          if (srest[i] === '--session-log-file') sessionLogFile = srest[++i];
          else throw new Error(`unexpected argument "${srest[i]}"`);
        }
        if (!sessionLogFile) throw new Error('Usage: engine roadmap session open --session-log-file <path>');
        respond(call, roadmapSession.openRoadmapSession(cwd, { sessionLogFile }));
        return;
      }
      if (sub === 'close') {
        /** @type {string|null} */ let message = null;
        for (let i = 0; i < srest.length; i++) {
          if (srest[i] === '-m' || srest[i] === '--message') message = srest[++i];
          else throw new Error(`unexpected argument "${srest[i]}"`);
        }
        if (!message) throw new Error('Usage: engine roadmap session close -m <message>');
        respond(call, roadmapSession.closeRoadmapSession(cwd, { message }));
        return;
      }
      throw new Error('Usage: engine roadmap session <open|close> …');
    }
    if (command === 'import') {
      if (rest.length === 0 || rest.some((a) => a.startsWith('--'))) {
        throw new Error('Usage: engine roadmap import <path> [<path> …]');
      }
      respond(call, roadmapSession.importRoadmapFiles(cwd, rest));
      return;
    }
    if (command === 'horizon') {
      const [sub, ...hrest] = rest;
      const { opts, positional } = parseArgs(hrest);
      /** @type {number|undefined} */
      let position;
      if (opts.position !== undefined) {
        position = parseInt(opts.position, 10);
        if (!Number.isInteger(position)) throw new Error(`--position must be a number (got "${opts.position}")`);
      }
      if (sub === 'add') {
        if (positional.length !== 1) throw new Error('Usage: engine roadmap horizon add <name> [--position <n>]');
        respond(call, roadmap.addHorizon(cwd, positional[0], { position }));
      } else if (sub === 'rename') {
        if (positional.length !== 2) throw new Error('Usage: engine roadmap horizon rename <old> <new>');
        respond(call, roadmap.renameHorizon(cwd, positional[0], positional[1]));
      } else if (sub === 'reorder') {
        if (positional.length === 0) throw new Error('Usage: engine roadmap horizon reorder <name> [<name> …] (the complete order)');
        respond(call, roadmap.reorderHorizons(cwd, positional));
      } else if (sub === 'merge') {
        if (positional.length !== 1 || !opts.into) throw new Error('Usage: engine roadmap horizon merge <from> --into <to>');
        respond(call, roadmap.mergeHorizons(cwd, positional[0], opts.into));
      } else if (sub === 'split') {
        if (positional.length !== 1 || !opts.new || !opts.items) {
          throw new Error('Usage: engine roadmap horizon split <name> --new <name> --items <a,b,…> [--position <n>]');
        }
        const items = opts.items.split(',').map((s) => s.trim()).filter((s) => s !== '');
        respond(call, roadmap.splitHorizon(cwd, positional[0], { newName: opts.new, items, position }));
      } else if (sub === 'remove') {
        if (positional.length !== 1) throw new Error('Usage: engine roadmap horizon remove <name>');
        respond(call, roadmap.removeHorizon(cwd, positional[0]));
      } else {
        throw new Error('Usage: engine roadmap horizon <add|rename|reorder|merge|split|remove> …');
      }
      return;
    }
    const { opts, flags, lists, positional } = parseArgs(rest, ['force-dismissed'], ['source']);
    if (command === 'add') {
      // Strict positional count: an unquoted summary would spill into
      // positionals and silently truncate the text — refuse instead.
      if (positional.length !== 1) {
        throw new Error('Usage: engine roadmap add <name> --horizon <h> --summary <text> [--kind <idea|bug|quick-fix>] [--origin <tag>] [--source <path> …]');
      }
      respond(call, roadmap.addRoadmapItem(cwd, positional[0], {
        horizon: opts.horizon,
        summary: opts.summary,
        kind: opts.kind,
        origin: opts.origin,
        sources: lists.source || [],
      }));
    } else if (command === 'add-batch') {
      if (positional.length !== 0 || !opts.file) throw new Error('Usage: engine roadmap add-batch --file <items.json>');
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(path.resolve(cwd, opts.file), 'utf8'));
      } catch (err) {
        throw new Error(`roadmap add-batch: cannot read payload: ${err instanceof Error ? err.message : String(err)}`);
      }
      respond(call, roadmap.addRoadmapItemsBatch(cwd, parsed));
    } else if (command === 'edit') {
      if (positional.length !== 1 || opts.summary === undefined) {
        throw new Error('Usage: engine roadmap edit <name> --summary <text>');
      }
      respond(call, roadmap.editRoadmapItem(cwd, positional[0], { summary: opts.summary }));
    } else if (command === 'rename') {
      if (positional.length !== 2) throw new Error('Usage: engine roadmap rename <old> <new>');
      respond(call, roadmap.renameRoadmapItem(cwd, positional[0], positional[1]));
    } else if (command === 'move') {
      if (positional.length !== 1 || !opts.horizon) throw new Error('Usage: engine roadmap move <name> --horizon <h>');
      respond(call, roadmap.moveRoadmapItem(cwd, positional[0], opts.horizon));
    } else if (command === 'remove') {
      if (positional.length !== 1) throw new Error('Usage: engine roadmap remove <name>');
      respond(call, roadmap.removeRoadmapItem(cwd, positional[0]));
    } else if (command === 'pull') {
      if (positional.length === 0 || !opts.into) {
        throw new Error('Usage: engine roadmap pull <name> [<name> …] --into <work-unit>');
      }
      respond(call, roadmap.pullItems(cwd, positional, { into: opts.into }));
    } else if (command === 'bind') {
      if (positional.length !== 1 || !opts.topic) {
        throw new Error('Usage: engine roadmap bind <name> --topic <topic>');
      }
      respond(call, roadmap.bindItem(cwd, positional[0], { topic: opts.topic }));
    } else if (command === 'pull-forward') {
      // `--routing` belongs to the creating branch: the return of a topic
      // this epic postponed restores the row it already has, routing and all.
      if (positional.length !== 1 || !opts.into) {
        throw new Error('Usage: engine roadmap pull-forward <name> --into <epic> --routing <research|discussion> [--force-dismissed]   (--routing names nothing on the return of a postponed topic)');
      }
      respond(call, roadmap.pullForwardItem(cwd, positional[0], {
        into: opts.into,
        routing: opts.routing,
        forceDismissed: flags.has('force-dismissed'),
      }));
    } else if (command === 'flag') {
      if (positional.length !== 1) throw new Error('Usage: engine roadmap flag <name>');
      respond(call, roadmap.flagJoined(cwd, positional[0]));
    } else {
      throw new Error('Usage: engine roadmap <state|add|add-batch|edit|rename|move|remove|pull|bind|pull-forward|flag|horizon> …');
    }
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// cache — analysis-cache stamping. Checksums the current completed inputs
// exactly as the read side does and writes the cache object. No git commit —
// the calling flow's commit cadence picks the manifest change up.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runCache(call, argv) {
  const [command, workUnit, kind] = argv;
  try {
    if (command !== 'stamp' || !workUnit || !kind) {
      throw new Error('Usage: engine cache stamp <work-unit> gap-analysis');
    }
    respond(call, stampAnalysisCache(call.cwd, workUnit, kind));
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// agent — the background-agent lifecycle store (domain/agent-state.cjs).
// The write verbs address the session's own topic — dispatching and walking
// its own agents' findings — so every one heartbeats. `scan` is a read,
// reachable for any topic, so it refreshes an owned hold only.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runAgent(call, argv) {
  const [command, ...rest] = argv;
  try {
    const { opts, flags, lists, positional } = parseArgs(rest, ['clean', 'final'], ['label']);
    const [workUnit, phase, topic, id, finding] = positional;
    const { cwd } = call;
    /** @param {object} result */
    const answer = (result) => {
      beatQuietly(cwd, workUnit, phase, topic);
      respond(call, result);
    };
    if (command === 'dispatch') {
      if (!workUnit || !phase || !topic || positional.length !== 3 || !opts.kind) {
        throw new Error('Usage: engine agent dispatch <work-unit> <phase> <topic> --kind <kind> [--label <slug> …] [--set <NNN>] [--final]');
      }
      answer(agentState.dispatchAgent(cwd, workUnit, phase, topic, { kind: opts.kind, labels: lists.label || [], set: opts.set, final: flags.has('final') }));
      return;
    }
    if (command === 'scan') {
      if (!workUnit || !phase || !topic || positional.length !== 3) {
        throw new Error('Usage: engine agent scan <work-unit> <phase> <topic>');
      }
      const scanned = agentState.scanAgents(cwd, workUnit, phase, topic);
      refreshQuietly(cwd, workUnit, phase, topic);
      respond(call, scanned);
      return;
    }
    if (command === 'ack') {
      const hasFindings = opts.findings !== undefined;
      if (!workUnit || !phase || !topic || !id || positional.length !== 4 || hasFindings === flags.has('clean')) {
        throw new Error('Usage: engine agent ack <work-unit> <phase> <topic> <id> (--findings <F1,F2,…> | --clean)');
      }
      const findings = hasFindings ? opts.findings.split(',').map((f) => f.trim()) : [];
      answer(agentState.ackAgent(cwd, workUnit, phase, topic, id, { findings }));
      return;
    }
    if (command === 'announce' || command === 'incorporate') {
      if (!workUnit || !phase || !topic || !id || positional.length !== 4) {
        throw new Error(`Usage: engine agent ${command} <work-unit> <phase> <topic> <id>`);
      }
      const fn = command === 'announce' ? agentState.announceAgent : agentState.incorporateAgent;
      answer(fn(cwd, workUnit, phase, topic, id));
      return;
    }
    if (command === 'surface') {
      if (!workUnit || !phase || !topic || !id || !finding || positional.length !== 5) {
        throw new Error('Usage: engine agent surface <work-unit> <phase> <topic> <id> <finding>[,<finding>…]');
      }
      answer(agentState.surfaceFinding(cwd, workUnit, phase, topic, id, finding));
      return;
    }
    throw new Error('Usage: engine agent <dispatch|scan|ack|announce|surface|incorporate> <work-unit> <phase> <topic> …');
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// boot — the entry pipeline: a git below the engine's floor, or none, stops
// it first; the state put in place and caught up (a lost state or a merge
// waiting on a pick stops it), migrations (hard error on failure),
// knowledge check (failure reports not-ready), and when ready the keyword
// side brought in line, compacted and the vector fill launched
// (warn-don't-block). `--start-again` is the person's yes at the lost-state
// stop.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runBoot(call, argv) {
  try {
    if (argv.length > 1 || (argv.length === 1 && argv[0] !== '--start-again')) throw new Error('Usage: engine boot [--start-again]');
    respond(call, boot(call.cwd, { startAgain: argv.length === 1 }));
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// github-rule, github-squash — the person's answer to setup's offer of the
// rule on GitHub against deleting or force-pushing the state branch, and of
// the squash default the landing needs (domain/github-setup.cjs).
// ---------------------------------------------------------------------------

/**
 * A verb answering one of setup's offers on GitHub.
 * @param {string} verb @param {(cwd: string, answer: string) => Record<string, unknown>} answer
 * @returns {(call: Call, argv: string[]) => void}
 */
const answeringGithub = (verb, answer) => (call, argv) => {
  try {
    if (argv.length !== 1) throw new Error(`Usage: engine ${verb} <yes|no>`);
    respond(call, answer(call.cwd, argv[0]));
  } catch (err) {
    failJson(call, err);
  }
};

const runGithubRule = answeringGithub('github-rule', answerGithubRule);
const runGithubSquash = answeringGithub('github-squash', answerGithubSquash);

// ---------------------------------------------------------------------------
// gate — the person's answer at a gate, logged to the trust log by the
// gate's name and answered with what the row leads to (domain/gate.cjs).
// ---------------------------------------------------------------------------

const GATE_USAGE = 'Usage: engine gate <name> (--pick <key> | --typed [<key>])';

/** @param {Call} call @param {string[]} argv */
function runGate(call, argv) {
  try {
    const { opts, positional } = parseArgs(argv);
    const name = positional.join(' ');
    const [answer, ...others] = Object.keys(opts);
    if (name === '' || others.length > 0 || (answer !== 'pick' && answer !== 'typed') || (answer === 'pick' && !opts.pick)) throw new Error(GATE_USAGE);
    respond(call, answerGate(call.cwd, name, answer === 'pick' ? { pick: opts.pick } : { typed: opts.typed ?? null }));
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// raise — a call Claude has a lean on, answering a question or replacing a
// decision, put through the decision point and, where it asks, sealed in the
// conversation and drawn (domain/raise.cjs, its screen
// domain/projections/raise.cjs), or, where it proceeds, landed as Claude's —
// answering once its rows' one-decision checks have; with --fact, a fact
// only the person holds, always sealed and drawn; `show` draws a sealed
// raise again; `answer` records the person's answer to it, a keep of the
// decision among them.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
async function runRaiseDraw(call, argv) {
  try {
    const drawn = await drawRaise(call.cwd, argv, call.stdin);
    if (drawn.decision === 'proceed') {
      respond(call, { decision: drawn.decision, reason: drawn.reason, ...drawn.landed });
      return;
    }
    const { decision, reason, seal, redrawn, warnings } = drawn;
    const screen = raiseScreen(seal);
    respond(call, { decision, reason, raise: seal.id, redrawn, ...(warnings.length > 0 ? { warnings } : {}) });
    respondSections(call, screen);
  } catch (err) {
    failJson(call, err);
  }
}

/** @param {Call} call @param {string[]} argv */
function runRaiseShow(call, argv) {
  const { seal, technical } = showRaise(argv);
  const screen = raiseScreen(seal, { technical });
  respond(call, { raise: seal.id });
  respondSections(call, screen);
}

/** @param {Call} call @param {string[]} argv @returns {void|Promise<void>} */
function runRaise(call, argv) {
  if (raiseWaits(argv)) return runRaiseDraw(call, argv);
  try {
    if (argv[0] === 'answer') respond(call, answerRaise(call.cwd, argv.slice(1), call.stdin));
    else runRaiseShow(call, argv.slice(1));
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// state-merge — the person's pick at the state merge's stop, which boot's
// catch-up leaves where both clones changed a manifest field
// (domain/state-merge.cjs).
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runStateMerge(call, argv) {
  try {
    respond(call, stateMergeCommand(call.cwd, argv));
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// commit — the scoped commit helper. Every form computes a pathspec and
// commits confined to it. The state's forms commit on the state branch: the
// work unit, the inbox, the roadmap, the whole state, one topic's artifacts
// (`--topic`), the discovery session's paths (`--discovery`), the imports
// home and the manifest that records its entries (`--imports`). The code
// tree's commit on the branch checked out: declared code paths (`--paths`),
// for the task in flight (`--task`) or a code topic (`--for`).
// Two forms make one commit on each side: a plan (`--plan`), its state and
// its declared storage, and the migration review (`--migrations`), the state
// and the files the workflows own in the code tree. A clean scope is fine:
// {committed: null}, and for `--paths`, whose commits are listed per repo,
// {committed: []}.
// ---------------------------------------------------------------------------

// Per-phase artifact pathspecs for `commit --topic` — the paths a topic's
// session writes, joined with the work-unit manifest at the call site. The
// phases a topic is talked through carry its mailbox, so a message it
// answered rides the same commit.
const TOPIC_COMMIT_ARTIFACTS = /** @type {Record<string, (wu: string, topic: string) => string[]>} */ ({
  research: (wu, t) => [`${wu}/research/${t}.md`, mailboxDir(wu, t)],
  experiment: (wu, t) => [seriesDir(wu, t)],
  discussion: (wu, t) => [`${wu}/discussion/${t}.md`, mailboxDir(wu, t)],
  investigation: (wu, t) => [`${wu}/investigation/${t}.md`, mailboxDir(wu, t)],
  specification: (wu, t) => [`${wu}/specification/${t}`],
  planning: (wu, t) => [`${wu}/planning/${t}`],
  implementation: (wu, t) => [`${wu}/implementation/${t}`],
  review: (wu, t) => [`${wu}/review/${t}`],
});

// A topic whose item reads one of these is finished: nothing further a
// session does to it is work on a live topic, so its commits release the slot
// rather than hold it. The schema's terminal set plus the conclusion — derived
// so a status added there can never be missed here.
const TERMINAL_TOPIC_STATUSES = ['completed', ...TERMINAL_STATUSES];

/**
 * A phase item straight off disk, or null when there is none — a direct read,
 * because the beat/clear decision must cost nothing and must never fail a
 * commit that has already landed.
 * @param {string} cwd @param {string} wu @param {string} phase @param {string} topic
 * @returns {Record<string, unknown>|null}
 */
function topicItem(cwd, wu, phase, topic) {
  try {
    const manifest = JSON.parse(fs.readFileSync(statePath(cwd, wu, 'manifest.json'), 'utf8'));
    const item = manifest?.phases?.[phase]?.items?.[topic];
    return item && typeof item === 'object' ? item : null;
  } catch {
    return null;
  }
}

/**
 * The phase item's recorded status, or null when the item or the field is
 * absent.
 * @param {string} cwd @param {string} wu @param {string} phase @param {string} topic
 * @returns {string|null}
 */
function topicStatus(cwd, wu, phase, topic) {
  const status = topicItem(cwd, wu, phase, topic)?.status;
  return typeof status === 'string' ? status : null;
}

/**
 * Validate one declared code path. Code has no layout to derive a pathspec
 * from, so the paths are Claude's to name — each taken literally, so a
 * routing file (`app/[id]/page.tsx`) is that file and never a pattern — and
 * every one is checked before anything is staged: never a workflow artifact,
 * which has a derived scope of its own, inside the code root, and
 * committable in the repo that owns it.
 * @param {string} cwd @param {import('./kernel/repos.cjs').Repo[]} repos @param {string} given
 * @returns {string} the path as the code root names it
 */
function codePathSpec(cwd, repos, given) {
  if (given === '' || given === '-') throw new Error(`commit --paths: "${given}" is not a path`);
  const abs = path.resolve(cwd, given);
  if (insideState(cwd, abs)) {
    throw new Error(`commit --paths: "${given}" is in the workflows' state — it commits by its own scope (--topic/--discovery/--plan)`);
  }
  const rel = path.relative(codeRoot(cwd), abs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`commit --paths: "${given}" resolves outside the project`);
  }
  const spec = rel.split(path.sep).join('/');
  assertCommittable(repos, spec, given);
  return spec;
}

/**
 * Check a code path in the repo that owns it, so no repo commits while
 * another's path was always going to fail. On disk or in the index, git
 * there must stage it. Otherwise its deletion must be staged — what a
 * `git mv` or `git rm` leaves behind, which the commit door accepts, or the
 * vanished side of a rename cannot be named and the commit lands half a
 * move — or be the repo's HEAD commit's own: an earlier run of the same call
 * landed it before another repo failed, so re-running the call is its retry,
 * with nothing left to commit there.
 * @param {import('./kernel/repos.cjs').Repo[]} repos @param {string} spec @param {string} given
 */
function assertCommittable(repos, spec, given) {
  const repo = repoOf(repos, spec);
  const own = repoPath(repo, spec);
  if (stageableSpecs(repo.path, [own]).length > 0) {
    if (addRefused(repo.path, own, repo.heldOut)) {
      throw new Error(`commit --paths: git in ${repoName(repo)} refuses to stage "${given}" (an ignore rule, or a path beyond a symbolic link)`);
    }
  } else if (!hasStagedDeletions(repo.path, own) && !deletedAtHead(repo.path, own)) {
    throw new Error(`commit --paths: "${given}" is neither on disk nor tracked`);
  }
}

/**
 * Check a repo the code commit would commit in — a reached submodule's
 * parent among them, for its pointer. No merge, cherry-pick, revert or
 * rebase may be in progress there: the commit would take on its state. And
 * it must be on a branch: a commit on a detached HEAD (a submodule after
 * `git submodule update`) is orphaned by the next checkout there. The
 * operation is asked first, as a rebase detaches HEAD while it runs. Nor
 * may it have the state branch checked out (4.9.3).
 * @param {import('./kernel/repos.cjs').Repo} repo
 */
function assertCommitsHere(repo) {
  const open = operationInProgress(repo.path);
  if (open !== null) {
    throw new Error(`commit --paths: ${open.operation} is in progress in ${repoName(repo)} (${open.marker}) — finish or abort it there, then run the commit again`);
  }
  if (!onBranch(repo.path)) {
    throw new Error(`commit --paths: ${repoName(repo)} is on a detached HEAD — check out a branch there, then run the commit again`);
  }
  if (onStateBranch(repo.path)) throw new Error(`commit --paths: ${repoName(repo)} ${STATE_BRANCH_HELD}`);
}

/**
 * The `--for` target must be real. It is what the commit beats, and a beat on
 * a mistyped topic mints a hold no session owns and nothing clears — the code
 * slot then reads taken until the machine reboots. Every prose site that
 * commits code does so from inside a live code phase, so the item always
 * exists by then; a miss is a typo, and it fails loudly.
 * @param {string} cwd @param {{workUnit: string, phase: string, topic: string}} target
 */
function assertCodeTarget(cwd, target) {
  const { workUnit, phase, topic } = target;
  if (workUnit.includes('/') || workUnit.includes('..')) throw new Error(`invalid work unit name "${workUnit}"`);
  if (topic.includes('..')) throw new Error(`invalid topic name "${topic}"`);
  if (!fs.existsSync(statePath(cwd, workUnit))) {
    throw new Error(`commit --paths: no work unit directory: ${statePath(cwd, workUnit)}`);
  }
  if (topicItem(cwd, workUnit, phase, topic) === null) {
    throw new Error(`commit --paths: no ${phase} item "${topic}" in "${workUnit}" — check the --for target`);
  }
}

/**
 * @typedef {{task?: string, checks?: import('./domain/commit-task.cjs').CheckRun[]}} CodeCommitTask
 * @typedef {{committed: {repo: string, sha: string}[], left_dirty: string[], note?: string} & CodeCommitTask} CodeCommitted
 */

/**
 * The project's repos and the code commit's share of the declared paths in
 * each, every path and every repo checked before any repo commits.
 * @param {string} cwd @param {string[]} paths
 */
function checkedGroups(cwd, paths) {
  const repos = projectRepos(cwd);
  const groups = commitGroups(repos, paths.map((p) => codePathSpec(cwd, repos, p)));
  groups.forEach(({ repo }) => assertCommitsHere(repo));
  return { repos, groups };
}

/**
 * The code commit's answer: the commits made, with what the project's repos
 * still hold. `left_dirty` is the backstop for a forgotten path — every
 * tracked modification and untracked file left in the code (the state is
 * never code dirt).
 * @param {import('./kernel/repos.cjs').Repo[]} repos @param {{repo: string, sha: string}[]} committed @param {CodeCommitTask} [more]
 * @returns {CodeCommitted}
 */
function codeCommitted(repos, committed, more = {}) {
  /** @type {CodeCommitted} */
  const result = { committed, left_dirty: projectDirtyEntries(repos).map((e) => e.path), ...more };
  if (committed.length === 0) result.note = 'nothing to commit';
  return result;
}

/**
 * The code commit for a code topic: the declared paths, each committed
 * confined in the repo that owns it under that repo's commit lock, and the
 * topic beaten.
 * @param {string} cwd @param {string[]} paths @param {string} message
 * @param {{workUnit: string, phase: string, topic: string}} target
 * @returns {CodeCommitted}
 */
function commitCodePaths(cwd, paths, message, target) {
  assertCodeTarget(cwd, target);
  const { repos, groups } = checkedGroups(cwd, paths);
  const committed = commitAcrossRepos(groups, message);
  beatQuietly(cwd, target.workUnit, target.phase, target.topic);
  return codeCommitted(repos, committed);
}

/**
 * The code commit for a task in flight in the calling conversation
 * (domain/commit-task.cjs): the task and the paths checked, then the
 * project's checks run — before any lock is taken — then the paths
 * committed as `commitCodePaths` commits them, under a message naming the
 * task. Answers the task's id and each check run.
 * @param {string} cwd @param {string[]} paths @param {string} message @param {string} unit @param {string} given
 */
function commitTaskPaths(cwd, paths, message, unit, given) {
  const ref = inFlightTask(cwd, unit, given);
  const { repos, groups } = checkedGroups(cwd, paths);
  const checks = runChecks(cwd);
  const committed = commitAcrossRepos(groups, workMessage(message, ref));
  return codeCommitted(repos, committed, { task: taskId(ref), checks });
}

/**
 * The code commit its target names: `--task <unit> <N.M>`, or today's
 * `--for <work-unit> <implementation|review>/<topic>`.
 * @param {string} cwd @param {string[]} paths @param {string} message @param {string[]} forSpec @param {string[]} taskSpec
 */
function commitCode(cwd, paths, message, forSpec, taskSpec) {
  if (taskSpec.length > 0) {
    const [unit, given] = taskSpec;
    if (forSpec.length > 0 || taskSpec.length !== 2 || !unit || !given) throw new Error(COMMIT_USAGE);
    return commitTaskPaths(cwd, paths, message, unit, given);
  }
  const [workUnit, topicSpec] = forSpec;
  const [phase, topic, ...more] = (topicSpec || '').split('/');
  if (forSpec.length !== 2 || !workUnit || more.length > 0 || !CODE_PHASES.includes(phase) || !topic) throw new Error(COMMIT_USAGE);
  return commitCodePaths(cwd, paths, message, { workUnit, phase, topic });
}

const COMMIT_USAGE = 'Usage: engine commit <work-unit> -m <message> [--plan <topic> | --discovery | --imports | --state | --topic <phase>/<topic> [--sweep]] | engine commit --paths <file> … -m <message> --task <work-unit> <N.M> | engine commit --paths <file> … -m <message> --for <work-unit> <implementation|review>/<topic> | engine commit --state -m <message> | engine commit --inbox -m <message> | engine commit --roadmap -m <message> | engine commit --workflows -m <message> | engine commit --migrations -m <message>';

/** @param {Call} call @param {string[]} argv */
function runCommit(call, argv) {
  try {
    /** @type {string|null} */ let workUnit = null;
    /** @type {string|null} */ let message = null;
    /** @type {string|null} */ let plan = null;
    /** @type {string|null} */ let topicSpec = null;
    /** @type {string[]} */ const files = [];
    /** @type {string[]} */ const forSpec = [];
    /** @type {string[]} */ const taskSpec = [];
    let paths = false;
    let discovery = false;
    let stateScope = false;
    let inbox = false;
    let workflows = false;
    let migrationsScope = false;
    let roadmapScope = false;
    let importsScope = false;
    let sweep = false;
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === '-m' || a === '--message') message = argv[++i];
      else if (a === '--plan') plan = argv[++i];
      else if (a === '--topic') topicSpec = argv[++i];
      else if (a === '--paths') paths = true;
      // The code commit's target, each in containment order: the work unit
      // and phase/topic, for the beat and nothing else, or the unit and the
      // task in flight.
      else if (a === '--for') forSpec.push(argv[++i], argv[++i]);
      else if (a === '--task') taskSpec.push(argv[++i], argv[++i]);
      else if (a === '--sweep') sweep = true;
      else if (a === '--discovery') discovery = true;
      else if (a === '--imports') importsScope = true;
      else if (a === '--state') stateScope = true;
      else if (a === '--inbox') inbox = true;
      else if (a === '--workflows') workflows = true;
      else if (a === '--migrations') migrationsScope = true;
      else if (a === '--roadmap') roadmapScope = true;
      else if (paths) files.push(a);
      else if (workUnit === null) workUnit = a;
      else throw new Error(`unexpected argument "${a}"`);
    }
    const { cwd } = call;

    if (paths) {
      // Code commits are the one scope no layout derives (P7): declared,
      // validated, confined, and answered with the residual dirt.
      if (!message || files.length === 0 || plan !== null || topicSpec !== null
          || discovery || importsScope || stateScope || inbox || workflows || migrationsScope || roadmapScope || sweep || workUnit !== null) {
        throw new Error(COMMIT_USAGE);
      }
      respond(call, commitCode(cwd, files, message, forSpec, taskSpec));
      return;
    }

    // `--state` names two scopes by whether a work unit rides with it: the
    // unit's own analysis dir, or the global one.
    const globalState = stateScope && workUnit === null;
    const scopeCount = [inbox, workflows, migrationsScope, roadmapScope, globalState, workUnit !== null].filter(Boolean).length;
    const workUnitFlags = [plan !== null, topicSpec !== null, discovery, importsScope, stateScope && workUnit !== null].filter(Boolean).length;
    if (!message || scopeCount !== 1 || forSpec.length > 0 || taskSpec.length > 0 || (workUnitFlags > 0 && workUnit === null) ||
        workUnitFlags > 1 || plan === '' || plan === undefined ||
        topicSpec === '' || topicSpec === undefined ||
        (sweep && topicSpec === null)) {
      throw new Error(COMMIT_USAGE);
    }
    /** @type {string|string[]} */ let scope;
    if (globalState) {
      // `.state` — migrations, environment setup: project-level bookkeeping
      // written from inside whatever session happened to need it.
      scope = '.state';
    } else if (workflows) {
      scope = '.';
    } else if (migrationsScope) {
      // The reviewed migration commit: the whole state, and every path the
      // workflows own in the code tree taken as the index records it — a
      // migration may stage a removal there that the working tree cannot
      // show. One commit on each side that changed.
      respond(call, bothSides(commitStateScoped(cwd, '.', message), commitStagedScoped(cwd, OWNED_PATHS, message)));
      return;
    } else if (inbox) {
      scope = '.inbox';
    } else if (roadmapScope) {
      // The product session's cadence commit: the roadmap dir (sessions,
      // imports) plus the project manifest (the roadmap node lives there).
      scope = [roadmap.ROADMAP_DIR, 'manifest.json'];
    } else {
      const wu = /** @type {string} */ (workUnit);
      if (wu === '' || wu.includes('/') || wu.includes('..')) throw new Error(`invalid work unit name "${wu}"`);
      if (!fs.existsSync(statePath(cwd, wu))) {
        throw new Error(`no work unit directory: ${statePath(cwd, wu)}`);
      }
      scope = wu;
      if (topicSpec !== null) {
        // --topic: the action-scoped pathspec commit. `git commit -- <paths>`
        // confines the commit to the topic's artifact paths plus the
        // work-unit manifest — a concurrent session's dirty or staged files
        // are never swept up.
        const parts = topicSpec.split('/');
        const phase = parts[0];
        const topic = parts[1];
        const artifact = Object.hasOwn(TOPIC_COMMIT_ARTIFACTS, phase) ? TOPIC_COMMIT_ARTIFACTS[phase] : undefined;
        if (parts.length !== 2 || !artifact) {
          throw new Error(`commit --topic: expected <phase>/<topic> with phase one of ${Object.keys(TOPIC_COMMIT_ARTIFACTS).join(', ')} — got "${topicSpec}"`);
        }
        if (topic === '' || topic.includes('..')) throw new Error(`invalid topic name "${topic}"`);
        const committed = commitStateScoped(cwd, [`${wu}/manifest.json`, ...artifact(wu, topic)], message);
        // `--sweep` outranks everything. It marks a commit on a topic this
        // session is not working — the conclude sweep's leavings, a
        // foreign-topic delivery's retry, a correction landed in another
        // phase's document — and presence there is somebody else's. Stamping
        // it would manufacture a hold; clearing it would destroy a live
        // peer's.
        //
        // Otherwise the item's own status decides. A terminal item is
        // finished, so every commit that follows its close — the conclusion,
        // the plan wrap-up, review's complete-then-commit — releases the slot
        // rather than re-taking it until the process dies. Anything else is
        // the session's own cadence commit, and that is its heartbeat.
        if (!sweep) {
          const status = topicStatus(cwd, wu, phase, topic);
          if (status !== null) {
            if (TERMINAL_TOPIC_STATUSES.includes(status)) clearQuietly(cwd, wu, phase, topic);
            else beatQuietly(cwd, wu, phase, topic);
          }
        }
        respond(call, stateCommitted(committed));
        return;
      }
      if (stateScope) {
        // --state: the work unit's analysis dir plus its manifest — the scope
        // the epic-wide analyses write (grouping, consolidation, the gap
        // analysis, build-order sequencing). Every one of them runs beside
        // live topic sessions whose half-written documents sit in the same
        // work unit, so the analysis slices its own paths and never theirs.
        respond(call, stateCommitted(commitStateScoped(cwd, [`${wu}/.state`, `${wu}/manifest.json`], message)));
        return;
      }
      if (importsScope) {
        // --imports: the retry the import landing's pending note prescribes —
        // the unit's one imports home and the manifest its entries live on,
        // the same scope the landing's own tail took, so a peer session's
        // dirt elsewhere in the unit never rides. No presence beat: running
        // an owed commit is not a session's work on a topic.
        scope = [`${wu}/imports`, `${wu}/manifest.json`];
      }
      if (discovery) {
        // --discovery: the discovery session's cadence commit. Discovery runs
        // beside live research and discussion sessions, so it slices its own
        // paths — session logs, briefs, the manifest the map lives in.
        respond(call, stateCommitted(commitStateScoped(cwd, discoveryScope(wu), message)));
        return;
      }
      if (plan !== null) {
        // --plan: the planning topic's own directory and the work-unit
        // manifest — the action scope, like --topic — and the project
        // manifest (plan init writes project defaults), committed in the
        // state; and the plan's declared storage pathspecs (recorded at plan
        // init from the format's authoring doc), committed in the code tree.
        // A storage pathspec that neither exists on disk nor has index
        // entries is skipped, while a deleted-but-tracked path still commits
        // its deletions (the restart-cleanup commits depend on that).
        if (plan.includes('/') || plan.includes('..')) throw new Error(`invalid planning topic name "${plan}"`);
        const manifestFile = statePath(cwd, wu, 'manifest.json');
        /** @type {any} */ let planItem;
        try {
          planItem = JSON.parse(fs.readFileSync(manifestFile, 'utf8')).phases?.planning?.items?.[plan];
        } catch {
          throw new Error(`commit --plan: cannot read ${manifestFile}`);
        }
        if (!planItem) throw new Error(`commit --plan: no planning item "${plan}" in "${wu}"`);
        const declared = planItem.storage_paths;
        if (declared === undefined) {
          throw new Error(`commit --plan: planning item "${plan}" has no storage_paths — record the format's declared pathspecs once: engine manifest set ${wu}.planning.${plan} storage_paths '[…]' (the format's authoring.md names them; '[]' when it stores inside the work unit)`);
        }
        if (!Array.isArray(declared) || declared.some((p) => typeof p !== 'string')) {
          throw new Error(`commit --plan: planning item "${plan}" has a malformed storage_paths (${JSON.stringify(declared)}) — must be an array of relative pathspec strings`);
        }
        for (const p of declared) {
          if (p === '' || p === '.' || p.startsWith('/') || p.split('/').includes('..')) {
            throw new Error(`commit --plan: illegal storage_paths entry ${JSON.stringify(p)} — pathspecs are relative, never ".", "..", or absolute`);
          }
        }
        const state = commitStateScoped(cwd, [`${wu}/planning/${plan}`, `${wu}/manifest.json`, 'manifest.json'], message);
        const storage = stageableSpecs(codeRoot(cwd), declared);
        respond(call, bothSides(state, storage.length === 0 ? null : commitPathspecScoped(cwd, storage, message)));
        return;
      }
    }
    respond(call, stateCommitted(commitStateScoped(cwd, scope, message)));
  } catch (err) {
    failJson(call, err);
  }
}

/**
 * A state commit's answer: its sha, or nothing to commit, with any push
 * warning.
 * @param {{committed: string|null, warnings: string[]}} state
 * @returns {Record<string, unknown>}
 */
function stateCommitted({ committed, warnings }) {
  /** @type {Record<string, unknown>} */
  const result = committed === null ? { committed: null, note: 'nothing to commit' } : { committed };
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}

/**
 * The answer of a commit made on each side: the state's sha, the code
 * tree's beside it.
 * @param {{committed: string|null, warnings: string[]}} state @param {string|null} code
 * @returns {Record<string, unknown>}
 */
function bothSides(state, code) {
  /** @type {Record<string, unknown>} */
  const result = { ...stateCommitted(state), code_committed: code };
  if (code !== null) delete result.note;
  return result;
}

// ---------------------------------------------------------------------------
// code — the code change, read across every repo in the project
// (domain/code.cjs). `log` and the selecting `diff` take a topic's task
// commits by identity, or any commits by subject prefix. `log` and `status`
// answer the engine's JSON line; the two `diff` forms answer the unified diff
// itself, empty when there is none, read as `git diff` is read. Nothing is
// written.
// ---------------------------------------------------------------------------

const CODE_USAGE = 'Usage: engine code log (<work-unit> <topic> [--phase <N>] | --subject <prefix>) | engine code diff [<work-unit> <topic> [--phase <N>] | --subject <prefix>] | engine code status';

/**
 * The commits a `code` call selects, or null where it names none.
 * @param {string[]} args
 * @returns {import('./domain/code.cjs').Selector|null}
 */
function codeSelector(args) {
  const { opts, lists, positional } = parseArgs(args, [], ['subject', 'phase']);
  const subjects = lists.subject || [];
  const phases = lists.phase || [];
  if (Object.keys(opts).length > 0 || subjects.length > 1 || phases.length > 1
      || [...subjects, ...phases, ...positional].some((value) => !value)) {
    throw new Error(CODE_USAGE);
  }
  const [subject] = subjects;
  const [phase] = phases;
  if (subject !== undefined) {
    if (positional.length > 0 || phase !== undefined) throw new Error(CODE_USAGE);
    return subjectSelector(subject);
  }
  if (positional.length === 0 && phase === undefined) return null;
  if (positional.length !== 2 || (phase !== undefined && !/^[1-9][0-9]*$/.test(phase))) throw new Error(CODE_USAGE);
  return taskSelector(positional[0], positional[1], phase === undefined ? undefined : Number(phase));
}

/** @param {Call} call @param {string[]} argv */
function runCode(call, argv) {
  const [command, ...rest] = argv;
  try {
    const selector = codeSelector(rest);
    const { cwd } = call;
    if (command === 'log' && selector !== null) respond(call, codeLog(cwd, selector));
    else if (command === 'diff') call.out(selector === null ? uncommittedDiff(cwd) : selectedDiff(cwd, selector));
    else if (command === 'status' && selector === null) respond(call, codeStatus(cwd));
    else throw new Error(CODE_USAGE);
  } catch (err) {
    failJson(call, err);
  }
}

// ---------------------------------------------------------------------------
// handoff — a move into work (domain/handoff.cjs): the skill and its
// arguments checked against the table, answered in sections like a render
// surface's. Nothing is written.
// ---------------------------------------------------------------------------

/** @param {Call} call @param {string[]} argv */
function runHandoff(call, argv) {
  const [skill, ...args] = argv;
  try {
    if (skill === undefined) throw new Error(`Usage: engine handoff <skill|/skill> [args …], or engine ${TOPIC_HANDOFF_USAGE}`);
    respondSections(call, handoffSections(skill === 'topic' ? topicHandoff(call.cwd, args) : resolveHandoff(call.cwd, skill, args)));
  } catch (err) {
    failJson(call, err);
  }
}

const RENDER_FLAGS = ['approve', 'skipped-review', 'own', 'paths', 'warn', 'pipeline', 'donow', 'recommendations', 'dead-end', 'menu-only', 'pause', 'single', 'unify', 'resumed', 'first', 'calls'];

/** @param {Call} call @param {string[]} argv */
function runRender(call, argv) {
  const [command, ...rest] = argv;
  const { opts, flags, positional } = parseArgs(rest, RENDER_FLAGS);
  const width = opts.width !== undefined ? parseInt(opts.width, 10) : WIDTH;

  if (Object.hasOwn(SURFACES, command)) {
    try {
      /** @type {{dotpath: string} & Record<string, string|undefined>} */
      const args = { dotpath: positional[0], ...opts };
      for (const flag of RENDER_FLAGS) if (flags.has(flag)) args[flag] = '1';
      respondSections(call, renderSurface(call.cwd, command, args));
    } catch (err) {
      failJson(call, err);
    }
    return;
  }

  switch (command) {
    case 'signpost':
      if (!positional.length) die(call, 'Usage: engine render signpost <label> [--style step|substep] [--width N]');
      call.out(signpost(positional.join(' '), { style: /** @type {'step'|'substep'} */ (opts.style) || 'step', width }) + '\n');
      break;
    case 'wrap': {
      if (!positional.length) die(call, 'Usage: engine render wrap <text> [--width N] [--prefix STR]');
      const lines = wrapWithPrefix(positional.join(' '), { width, prefix: opts.prefix || '' });
      call.out(lines.join('\n') + '\n');
      break;
    }
    case 'tree': {
      // Reads a JSON node array from stdin (the data-owner builds it).
      const input = call.stdin();
      call.out(renderTree(JSON.parse(input), opts.width !== undefined ? { width } : {}));
      break;
    }
    default:
      die(call, USAGE);
  }
}

/**
 * Every command the engine dispatches, by name.
 * @type {Readonly<Record<string, (call: Call, argv: string[]) => void|Promise<void>>>}
 */
const COMMANDS = Object.freeze({
  knowledge: runKnowledge,
  boot: runBoot,
  'state-merge': runStateMerge,
  'github-rule': runGithubRule,
  'github-squash': runGithubSquash,
  manifest: runManifest,
  ledger: runLedger,
  asset: runAsset,
  verdict: runVerdict,
  workunit: runWorkunit,
  'discussion-map': runDiscussionMap,
  'research-threads': runResearchThreads,
  'discovery-map': runDiscoveryMap,
  'build-order': runBuildOrder,
  'discovery-session': runDiscoverySession,
  topic: runTopic,
  experiment: runExperiment,
  sources: runSources,
  presence: runPresence,
  session: runSession,
  conversation: runConversation,
  enter: runEnter,
  layout: guardFamily('layout'),
  shell: guardFamily('shell'),
  task: runTask,
  land: runLand,
  brief: runBrief,
  inbox: runInbox,
  roadmap: runRoadmap,
  baseline: runBaseline,
  walkthrough: runWalkthrough,
  cache: runCache,
  agent: runAgent,
  commit: runCommit,
  code: runCode,
  render: runRender,
  handoff: runHandoff,
  gate: runGate,
  raise: runRaise,
  cut: runCut,
  checklist: runChecklist,
  migrate: runMigrate,
  decided: runDecided,
});

// Every command dispatched runs whole under the writer lock, its writes and
// its commit one hold, so no peer's write lands between them — a command
// added later included — but the ones named here, `*` for every sub-verb or
// the sub-verbs alone. None of them writes what a state commit takes but
// `boot`, `ledger`, `asset`, `raise` and `enter`, and none but they waits on
// the lock: `knowledge` writes the store the state ignores, under a lock of
// its own;
// `boot` holds the writer lock around each state write it makes and no
// longer, so its knowledge pass never holds a peer up; a `ledger` write
// holds it around its read of the ledger, the append and the commit alone,
// so what it does before and after holds no peer up — its Claude call among
// it — the late check holds it around each result it records, and a
// `ledger` read takes none; a `raise` draw or `show` writes the
// conversation's folder alone — its seal, and the gate shown it clears —
// and its answer, or a draw that proceeds, holds it around its ledger write
// as a `ledger` write does; `enter` holds it around a start and its commit
// alone, its question and reads taking none; an `asset` link holds it as a
// `ledger` write does, and a spike around taking its number; `presence`,
// `session label`, `repair`, `cleanup` and `resume`, and the hold
// `topic mailbox` refreshes write only the session files the state ignores,
// as `enter` does beside its start; a conversation's folder is outside the
// project; `gate` writes the trust log, under its own lock, and the
// conversation's folder; and the rest read: `layout guard` among them, run
// before every file Claude writes, `brief guard`, before every dispatch of
// an agent, `shell guard`, before every shell command, `checklist show`,
// and `migrate check`.
// `manifest` takes it to write alone, `commit` but for a code commit
// (`--paths`), and a brief's fill whole, since its read of the task may
// commit the tracker's set-up.
const WRITER_LOCK_EXEMPT = /** @type {Readonly<Record<string, '*'|string[]>>} */ (Object.freeze({
  knowledge: '*',
  boot: '*',
  ledger: '*',
  asset: '*',
  verdict: ['queue'],
  presence: '*',
  conversation: '*',
  enter: '*',
  layout: '*',
  shell: '*',
  code: '*',
  render: '*',
  handoff: '*',
  topic: ['mailbox', 'incorporations'],
  roadmap: ['state'],
  session: ['label', 'repair', 'cleanup', 'resume'],
  gate: '*',
  raise: '*',
  brief: ['guard'],
  checklist: ['show'],
  migrate: ['check'],
}));

/** @param {string[]} argv @returns {boolean} */
function takesWriterLock([command, sub, ...rest]) {
  if (command === 'manifest') return !isRead(sub);
  if (command === 'commit') return ![sub, ...rest].includes('--paths');
  const exempt = Object.hasOwn(WRITER_LOCK_EXEMPT, command) ? WRITER_LOCK_EXEMPT[command] : [];
  return exempt !== '*' && !exempt.includes(sub);
}

/**
 * The command argv names — answering later only for the argv
 * `ANSWERS_LATER` says waits. One the engine does not dispatch answers the
 * usage at once, with no state to find and no lock to wait on.
 * @param {Call} call @param {string[]} argv @returns {void|Promise<void>}
 */
function runCli(call, argv) {
  const [command, ...rest] = argv;
  if (!Object.hasOwn(COMMANDS, command)) die(call, USAGE);
  const handler = COMMANDS[command];
  if (!takesWriterLock(argv)) return handler(call, rest);
  /** @type {string} */
  let root;
  try {
    root = stateRoot(call.cwd);
  } catch (err) {
    failJson(call, err);
  }
  return followingLiveness(call, root, (held) => handler(held, rest));
}

// The commands Claude Code's own hooks run as any conversation in the project
// ends or resumes, or before it writes a file, dispatches an agent or runs a
// shell command, whether it ran the workflows or not.
const HOOK_TARGETS = ['presence cleanup', 'session cleanup', 'session resume', 'conversation end', ...GUARD_VERBS];

/**
 * One command against a bound call, answering its exit code — later, for
 * the argv `ANSWERS_LATER` says waits. Whatever the exit, a command
 * the conversation ran marks it as one that runs the workflows; one that
 * answered records the gate its MENU stated as the gate the conversation was
 * shown, where a failed one showed none. Both after the command, which may
 * take the folder both live in: boot's tidy-up deletes one whose transcript
 * is gone.
 * @param {Call} call @param {string[]} argv @returns {number|Promise<number>}
 */
function dispatch(call, argv) {
  openGate();
  const settle = (/** @type {number} */ code) => {
    if (!HOOK_TARGETS.includes(argv.slice(0, 2).join(' '))) markConversation(call.cwd);
    if (code === 0) recordGateShown();
    return code;
  };
  let answer;
  try {
    answer = runCli(call, argv);
  } catch (err) {
    return settle(exitCodeOf(call, err));
  }
  return answer ? answer.then(() => 0, (err) => exitCodeOf(call, err)).then(settle) : settle(0);
}

/**
 * Environment keys held for the duration of `fn` — until its promise
 * settles, where it answers with one — and restored exactly: a key that was
 * absent is absent again afterwards. `undefined` takes a key away for the
 * call, which is how a caller hands over an environment a spawned process
 * would have had by replacement rather than overlay. Inside a worker thread
 * `process.env` is that thread's own copy, so this is thread-local.
 *
 * The display width is a memo over the environment, resolved once per process
 * because a CLI process is one command: scoping the environment scopes the
 * memo with it, on the way in and on the way out.
 * @template T
 * @param {Record<string, string|undefined>} overlay @param {() => T} fn @returns {T}
 */
function withEnv(overlay, fn) {
  /** @type {Map<string, string|undefined>} */
  const saved = new Map();
  /** @param {string} key @param {string|undefined} value */
  const apply = (key, value) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  for (const [key, value] of Object.entries(overlay)) {
    saved.set(key, Object.hasOwn(process.env, key) ? process.env[key] : undefined);
    apply(key, value);
  }
  resetDisplayWidth();
  const restore = () => {
    for (const [key, value] of saved) apply(key, value);
    resetDisplayWidth();
  };
  let result;
  try {
    result = fn();
  } catch (err) {
    restore();
    throw err;
  }
  if (result instanceof Promise) return /** @type {T} */ (result.finally(restore));
  restore();
  return result;
}

/**
 * @typedef {object} InProcessOptions
 * @property {string} [cwd]
 * @property {Record<string, string|undefined>} [env]
 * @property {string} [stdin]
 */

/** @typedef {{stdout: string, stderr: string, code: number}} Answer */

/**
 * A call bound to buffers, and the answer they hold once the command exits.
 * @param {string} cwd @param {string} stdin
 * @returns {{call: Call, answer: (code: number) => Answer}}
 */
function bufferedCall(cwd, stdin) {
  /** @type {string[]} */ const stdout = [];
  /** @type {string[]} */ const stderr = [];
  return {
    call: { cwd, out: (text) => stdout.push(text), err: (text) => stderr.push(text), stdin: () => stdin },
    answer: (code) => ({ stdout: stdout.join(''), stderr: stderr.join(''), code }),
  };
}

// The commands that answer later, each by whether its argv waits: a knowledge
// verb on the embedding provider, a raise's draw on its rows' checks.
/** @type {Readonly<Record<string, (args: string[]) => boolean>>} */
const ANSWERS_LATER = Object.freeze({ knowledge: knowledgeWaits, raise: raiseWaits });

/** @param {string[]} argv */
function answersLater([command, ...rest]) {
  return Object.hasOwn(ANSWERS_LATER, command) && ANSWERS_LATER[command](rest);
}

/**
 * The in-process entry: the CLI's argv contract with the invocation supplied
 * rather than taken from the process. Answers what the spawned CLI answered —
 * the same bytes on the same two streams, the same exit code — and never
 * exits, chdirs, or leaves the environment moved. Callers are test harnesses
 * that want the engine's answers without a process per answer; skills' own
 * scripts take the library (lib.cjs). A command that answers later is
 * runAsync's, refused here before it runs.
 *
 * The cwd is a parameter rather than a chdir because `process.chdir` is
 * refused inside a worker thread, and the prose world builder runs in one.
 *
 * @param {string[]} argv @param {InProcessOptions} [options]
 * @returns {Answer}
 */
function run(argv, { cwd = process.cwd(), env = {}, stdin = '' } = {}) {
  if (answersLater(argv)) {
    throw new TypeError(`engine ${argv.slice(0, 2).join(' ')} answers asynchronously — call runAsync`);
  }
  const { call, answer } = bufferedCall(cwd, stdin);
  return answer(/** @type {number} */ (withEnv(env, () => dispatch(call, argv))));
}

/** @type {Promise<void>|null} the last runAsync call still to settle */
let held = null;

/**
 * The in-process entry for any command, awaited — the one a command that
 * answers later needs. The environment is held until it
 * answers, so overlapping calls take turns: each starts once the one before
 * it has answered and put the environment back.
 * @param {string[]} argv @param {InProcessOptions} [options]
 * @returns {Promise<Answer>}
 */
function runAsync(argv, { cwd = process.cwd(), env = {}, stdin = '' } = {}) {
  const start = async () => {
    const { call, answer } = bufferedCall(cwd, stdin);
    return answer(await withEnv(env, () => dispatch(call, argv)));
  };
  const turn = held ? held.then(start) : start();
  const settled = turn.then(() => {}, () => {});
  held = settled;
  settled.then(() => {
    if (held === settled) held = null;
  });
  return turn;
}

/** The shell door: the process's own argv, directory, streams and stdin. */
function main() {
  // A downstream reader closing early (`engine … | head -1`) makes the next
  // stdout write raise EPIPE; without a handler Node prints an unhandled-error
  // stack. Treat the closed pipe as a clean stop.
  process.stdout.on('error', (err) => {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EPIPE') process.exit(0);
    throw err;
  });
  const code = dispatch(processCall(), process.argv.slice(2));
  // Only a failure exits explicitly: falling off the end lets Node flush a
  // long render to a pipe before the process goes.
  const exit = (/** @type {number} */ answered) => {
    if (answered !== 0) process.exit(answered);
  };
  if (typeof code === 'number') exit(code);
  else code.then(exit);
}

if (require.main === module) main();

module.exports = { parseArgs, run, runAsync, COMMANDS, WRITER_LOCK_EXEMPT };

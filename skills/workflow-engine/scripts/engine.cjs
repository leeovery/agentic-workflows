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
// primitives (signpost, box, wrap, tree), which remain authoring aids only.
// Static chrome stays literal in prose; anything parameterised or
// state-branching renders here.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { signpost, box, wrapWithPrefix, renderTree, WIDTH } = require('./kernel/render.cjs');
const { commitPathspecScoped, commitPathspecWithKb, discoveryScope, KB_DIR } = require('./domain/commit.cjs');
const { dirtyPaths, stageableSpecs, hasStagedDeletions } = require('./kernel/git.cjs');
const { recordSubtopicAdd, recordSubtopicState, recordSubtopicStates, SUBTOPIC_STATES } = require('./domain/discussion-map.cjs');
const { VALID_ROUTINGS, isParentExperimentId } = require('./kernel/manifest-schema.cjs');
const { sequenceMap, addItem, addItemsBatch, editItem, removeItem, renameItem, rerouteItem, handleItem, unhandleItem } = require('./domain/discovery-map.cjs');
const { sequenceBuildOrder } = require('./domain/build-order.cjs');
const { startTopic, triageTopic, queueStatus, absorbConcern, requeueConcern, completeTopic, reopenTopic, staleSources, supersedeTopic, cancelTopic, reactivateTopic } = require('./domain/transitions.cjs');
const { createExperiment, advanceExperiment, approveExperiment, concludeExperiment, abandonExperiment } = require('./domain/experiment.cjs');
const { initTasks, startTask, fixAttempt, completeTask, analysisCycle } = require('./domain/tasks.cjs');
const { archiveItems, restoreItems, deleteItems } = require('./domain/inbox.cjs');
const { stampAnalysisCache } = require('./domain/cache.cjs');
const agentState = require('./domain/agent-state.cjs');
const { boot } = require('./domain/boot.cjs');
const { beatPresence, clearPresence, beatQuietly, refreshQuietly, clearQuietly, scanPresence, scanProject, cleanupPresence, deferralSection, CODE_PHASES } = require('./domain/presence.cjs');
const { applySessionLabel, restoreSessionLabel, repairSessionLabels, setLabelConfig } = require('./domain/session-label.cjs');
const { createWorkUnit } = require('./domain/workunit-create.cjs');
const { completeWorkUnit, cancelWorkUnit, reactivateWorkUnit, pivotWorkUnit } = require('./domain/workunit-lifecycle.cjs');
const { absorbWorkUnit } = require('./domain/workunit-absorb.cjs');
const { promoteWorkUnit } = require('./domain/workunit-promote.cjs');
const { openDiscoverySession, closeDiscoverySession } = require('./domain/discovery-session.cjs');
const { runFieldCommand, isRead } = require('./domain/fields.cjs');
const { renderSurface, SURFACES } = require('./domain/render.cjs');
const roadmap = require('./domain/roadmap.cjs');
const roadmapSession = require('./domain/roadmap-session.cjs');

/** @param {string} msg @returns {never} */
function die(msg) {
  process.stderr.write(msg + '\n');
  process.exit(1);
}

/** One decision-ready JSON line on stdout. @param {object} obj */
function respond(obj) {
  process.stdout.write(JSON.stringify({ ok: true, ...obj }) + '\n');
}

/**
 * Rendered gate sections after a response's JSON line (domain/projections).
 * Empty when the state renders nothing.
 * @param {string} rendered
 */
function respondSections(rendered) {
  if (rendered !== '') process.stdout.write(rendered);
}

/**
 * `{ok:false}` JSON on stderr, exit 1. Extra decision-ready fields ride on
 * the error's `payload` (e.g. `missing_imports`).
 * @param {unknown} err @returns {never}
 */
function failJson(err) {
  const payload =
    err && typeof err === 'object' && 'payload' in err && err.payload && typeof err.payload === 'object'
      ? err.payload
      : {};
  process.stderr.write(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err), ...payload }) + '\n');
  process.exit(1);
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
  boot
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
  workunit create <work-unit> <work-type> --description <text> --session-log-file <path>|--no-session-log
                  [--import <path> …] [--seed <path> …]
  workunit complete <work-unit> -m <message>
  workunit cancel <work-unit>
  workunit reactivate <work-unit>
  workunit pivot <work-unit>
  workunit absorb <feature> --into <epic> --topic <name>
  workunit promote <work-unit> <topic> --to <cc-work-unit> --description <text>
  discussion-map add <work-unit> <topic> <subtopic> [--parent <subtopic>]
  discussion-map set <work-unit> <topic> <subtopic> <state>
  discussion-map set <work-unit> <topic> <subtopic>=<state> [<subtopic>=<state> …]
  build-order sequence <work-unit> <topic>=<order> [<topic>=<order> …]
  discovery-map sequence <work-unit> <topic>=<order> [<topic>=<order> …]
  discovery-map add <work-unit> <name> <research|discussion>
                (--summary <text> [--description <text>] | --backfill)
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
  topic triage <work-unit> <phase> <topic> [--concern <file> --slug <kebab> -m <message>]
  topic queue <work-unit> <phase> <topic>
  topic absorb <work-unit> <phase> <topic> --file <NNN-slug.md> [--subtopic <name>] -m <message>
  topic requeue <work-unit> <from-phase> <to-phase> <topic> --file <NNN-slug.md> -m <message>
  presence beat <work-unit> <phase> <topic>
  presence clear <work-unit> <phase> <topic>
  presence scan [work-unit]
  presence cleanup [session-id]
  session label <work-unit> <phase> <topic>
  session label-config <true|false>
  session cleanup [session-id]
  topic complete <work-unit> <phase> <topic>
  topic reopen <work-unit> <phase> <topic>
  topic supersede <work-unit> <phase> <topic> --by <topic>
  topic cancel <work-unit> <phase> <topic> [--cascade]
  topic reactivate <work-unit> <phase> <topic>
  experiment create <work-unit> <topic> --slug <kebab> (--from <research|discussion> --problem <file> | --parent <E{n}>)
  experiment advance <work-unit> <topic> <id>
  experiment approve <work-unit> <topic> <id>
  experiment conclude <work-unit> <topic> <id> --verdict <one line>
  experiment abandon <work-unit> <topic> <id> --reason <one line>
  sources stale <work-unit> <discussion> [--except <spec-topic>]
  task init <work-unit> <topic>
  task start <work-unit> <topic> <internal-id>
  task fix-attempt <work-unit> <topic> <internal-id> --findings-file <path>
  task complete <work-unit> <topic> (<internal-id> | --external <id>) [--skipped]
                [--next-task <id|~>] [--phase <N>] [--phase-complete]
  task analysis-cycle <work-unit> <topic>
  inbox archive <path> [<path> …]
  inbox restore <path> [<path> …]
  inbox delete <path> [<path> …]
  roadmap state
  roadmap add <name> --horizon <h> --summary <text> [--origin <tag>] [--source <path> …]
  roadmap add-batch --file <items.json>
  roadmap edit <name> --summary <text>
  roadmap rename <old> <new>
  roadmap move <name> --horizon <h>
  roadmap remove <name>
  roadmap pull <name> [<name> …] --into <work-unit>
  roadmap bind <name> --topic <topic>
  roadmap pull-forward <name> --into <epic> --routing <research|discussion> [--force-dismissed]
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
  commit <work-unit> -m <message> [--plan <topic> | --discovery | --topic <phase>/<topic> [--kb] [--sweep]]
  commit --paths <file> … -m <message> --for <work-unit> <implementation|review>/<topic>
  commit --inbox -m <message>
  commit --roadmap -m <message>
  commit --workflows -m <message>
  render resume-gate <wu.phase.topic> [--triage N] [--variant plan|review|scoping|session]  (session: bare <wu>)
  render task-list   <wu.planning.topic> --file <payload.json>
  render findings-summary <wu.phase.topic> --file <payload.json>
  render finding          <wu.phase.topic> --file <payload.json> [--view full]
  render finding-announce <wu.phase.topic> --file <payload.json>
  render finding-batch    <wu.phase.topic> --file <payload.json>
  render review-presentation <wu.review.topic> --file <payload.json>
  render review-gate      <wu.review.topic> --verdict pass|fail [--replan N] [--out-of-scope N]
  render spec-review-gate <wu.specification.topic> --variant continue|reloop
  render spec-completion-gate <wu.specification.topic> --variant assessment|signoff
  render carry-note-gate  <wu.research.topic> --file <payload.json>
  render hypothesis-board <wu.investigation.topic> --file <payload.json> --variant plan|resume|check-in|pivot
  render fix-direction     <wu.investigation.topic> --file <payload.json>
  render validation-gate   <wu.investigation.topic> --variant root-cause
  render validation-report <wu.investigation.topic> --file <payload.json> --variant root-cause|fix
  render project-skills   <wu.implementation.topic> --variant confirm|discovery|skipped [--file <payload.json>]
  render linters          <wu.implementation.topic> --variant confirm|discovery|skipped [--file <payload.json>]
  render convergence-diagnostic <wu.phase.topic> --file <payload.json>
  render triage-announce  <wu.phase.topic>
  render triage-offer     <wu.phase.topic> --file <payload.json>
  render triage-block     <wu.phase.topic>
  render requeue-offer    <wu.phase.topic> --file <payload.json>
  render reroute-offer    <wu.phase.topic> --file <payload.json>
  render research-conclude-gate <wu.research.topic> [--dead-end]
  render deep-dive-offer  <wu.research.topic> --file <payload.json>
  render in-flight-agents-gate <wu.research.topic> --count N
  render reroute-candidates <wu.phase.topic> --file <payload.json>
  render off-topic-offer  <wu.phase.topic> --file <payload.json> [--variant discussion]
  render map-op-gate      <wu> --op edit-summary|edit-description|remove|rename|reroute|close|reopen --file <payload.json>
  render candidate-gate   <wu> --file <payload.json>
  render topic-collision-gate
  render triage-closed-target <wu.discovery.target>
  render conclude-gate    <wu.phase.topic>   (discussion|investigation|implementation|planning)
  render closing-gate     <wu.discussion.topic> --variant re-review|findings-owed|final-review|wrap-up [--reason <text>]
  render experiment-register <wu.experiment.topic>
  render experiment-approval-gate <wu.experiment.topic> --id <E{n}>
  render experiment-pick <wu.experiment.topic>
  render experiment-next-gate <wu.experiment.topic>
  render experiment-spawn-gate <wu.research|discussion.topic> --id <E{n}>
  render experiment-wait-gate <wu.research|discussion.topic>
  render summary-backfill-gate <wu> --variant batch|unsourced [--file <payload.json>]
  render external-dependency-gate <wu.planning.topic> --variant blocking|pick [--blocking <topic,topic,…>]
  render checkpoint-files-gate <wu.implementation.topic>
  render executor-block-gate <wu.implementation.topic>
  render dependency-approval-gate <wu.planning.topic> --variant graph|updated-graph|resolution
  render task-count-gate  <wu.planning.topic>
  render plan-format-gate
  render plan-review-gate <wu.planning.topic> --variant continue|reloop
  render correction-gate  <wu.specification.topic>
  render analysis-proceed-gate <wu>
  render proposed-task    <wu.phase.topic> --file <payload.json> --gate gated|auto [--comment-hint STR]
  render incoherence-gate <wu.phase.topic> --file <payload.json> --variant conflict|gap-route|held-doc
  render cancel-cascade-gate <wu.phase.topic>
  render resurface-gate   <wu.phase.topic> --file <payload.json> [--view full]
  render construction-gate <wu.phase.topic>
  render tasks-overview   <wu.phase.topic> --file <payload.json>
  render author-task-gate <wu.planning.topic> --m N --total N --title STR
  render phase-tree       <wu.planning.topic> --file <payload.json> [--approve]
  render phase-completed   <wu> --phase <phase> [--paths]
  render phase-note        <wu.phase.topic> --verb <Word> [--noun <word>]
  render entry-gate        <wu.phase.topic> [--own]  (planning|implementation|review|specification)
  render code-gate         <wu.phase.topic>          (implementation|review — empty when the code slot is free)
  render early-completion-gate <wu>
  render revisit-gate      <wu> --prev <phase> --next <phase>
  render cancel-gate <wu.phase.topic>
  render epic-all-done-gate <wu>
  render epic-soft-gate <wu> --action <action> [--topic <topic>]
  render task-brief        <wu.implementation.topic> --file <payload.json>
  render task-result       <wu.implementation.topic> --file <payload.json> --result approved|needs-changes|blocked|failed
  render task-gate         <wu.implementation.topic>
  render fix-gate          <wu.implementation.topic>
  render blocked-tasks
  render cycle-limit       <wu.implementation.topic>
  render cycle-gate
  render workunit-receipt  <wu> --verb complete|cancel|reactivate|pivot [--pipeline [--skipped-review]] [--warn]
  render topic-receipt     <wu.phase.topic> --verb complete|cancel|reactivate [--warn]
  render absorb-summary    <feature> --into <epic> --topic <name>
  render absorb-receipt    <epic> --topic <name> [--moved research,seeds,imports] [--experiments <N>] [--warn]
  render absorb-continuation <epic> --feature <name>
  render promote-receipt   <wu.specification.topic> --to <cc-work-unit> [--warn]
  render pivot-continuation <wu>
  render session-receipt   <wu> [--warn]
  render absorb-target     <feature>
  render absorb-name-gate  <feature> --into <epic>
  render absorb-confirm-gate <feature>
  render plan-topics       <wu>
  render revisit-phases    <wu>
  render roadmap-view
  render roadmap-add-gate --horizon <name>
  render roadmap-session-receipt [--warn]
  render roadmap-harvest-gate
  render roadmap-parks-gate
  render roadmap-shape-gate
  render roadmap-conclude-gate
  render name-gate [--variant collision]
  render shape-gate
  render synthesis-gate
  render query-failure-gate
  render baseline-progress
  render baseline-area-gate --area <name>
  render baseline-paused
  render baseline-receipt
  render baseline-scope-gate --file <payload.json>
  render baseline-round --file <payload.json>
  render baseline-doc-gate
  render baseline-manage-gate
  render baseline-doc-pick
  render baseline-offer-gate
  render signpost <label> [--style step|substep] [--width N]     (dev aid)
  render box <title> [--width N]                                 (dev aid)
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
// frequently is not: the storage-path backfills, review's `updated` stamp and
// the epic menu's unblock all write one phase's item from another phase's
// session, and a beat there manufactures a hold on a topic nobody is in (P8).
// The session's cadence commit is its heartbeat; `apply`, the cross-topic
// batch door, never beat either.
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runManifest(argv) {
  const [command, ...rest] = argv;
  if (command !== undefined && isRead(command)) {
    try {
      runFieldCommand(process.cwd(), command, rest);
    } catch (err) {
      const code = err && typeof err === 'object' && 'exitCode' in err && typeof err.exitCode === 'number' ? err.exitCode : 1;
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(code);
    }
    return;
  }
  try {
    const result = runFieldCommand(process.cwd(), command ?? '', rest);
    respond(/** @type {object} */ (result));
  } catch (err) {
    failJson(err);
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
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runWorkunit(argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'create') {
      const { opts, flags, lists, positional } = parseArgs(rest, ['no-session-log'], ['import', 'seed']);
      const [workUnit, workType] = positional;
      if (!workUnit || !workType || !opts.description) {
        throw new Error('Usage: engine workunit create <work-unit> <work-type> --description <text> --session-log-file <path>|--no-session-log [--import <path> …] [--seed <path> …]');
      }
      // Log-less creation must be explicit — accidental omission is an error.
      if (flags.has('no-session-log') ? opts['session-log-file'] !== undefined : opts['session-log-file'] === undefined) {
        throw new Error('exactly one of --session-log-file <path> or --no-session-log is required');
      }
      respond(createWorkUnit(process.cwd(), workUnit, workType, {
        description: opts.description,
        sessionLogFile: opts['session-log-file'],
        imports: lists.import || [],
        seeds: lists.seed || [],
      }));
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
      respond(completeWorkUnit(process.cwd(), workUnit, { message }));
    } else if (command === 'cancel' || command === 'reactivate' || command === 'pivot') {
      const [workUnit, ...extra] = rest;
      if (!workUnit || extra.length > 0) {
        throw new Error(`Usage: engine workunit ${command} <work-unit>`);
      }
      const fn = command === 'cancel' ? cancelWorkUnit : command === 'reactivate' ? reactivateWorkUnit : pivotWorkUnit;
      respond(fn(process.cwd(), workUnit));
    } else if (command === 'absorb') {
      const { opts, positional } = parseArgs(rest);
      const [feature] = positional;
      if (!feature || positional.length !== 1 || !opts.into || !opts.topic) {
        throw new Error('Usage: engine workunit absorb <feature> --into <epic> --topic <name>');
      }
      respond(absorbWorkUnit(process.cwd(), feature, { into: opts.into, topic: opts.topic }));
    } else if (command === 'promote') {
      const { opts, positional } = parseArgs(rest);
      const [workUnit, topic] = positional;
      if (!workUnit || !topic || positional.length !== 2 || !opts.to || !opts.description) {
        throw new Error('Usage: engine workunit promote <work-unit> <topic> --to <cc-work-unit> --description <text>');
      }
      respond(promoteWorkUnit(process.cwd(), workUnit, topic, { to: opts.to, description: opts.description }));
    } else {
      throw new Error('Usage: engine workunit <create|complete|cancel|reactivate|pivot|absorb|promote> …');
    }
  } catch (err) {
    failJson(err);
  }
}

// ---------------------------------------------------------------------------
// discussion-map — Discussion Map subtopic writes. add/set are domain
// transactions (domain/discussion-map.cjs): load → apply → save under the
// work unit's manifest lock → one decision-ready JSON line, no git commit
// (the session's commit cadence picks the manifest change up).
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runDiscussionMap(argv) {
  const [command, ...rest] = argv;
  const { opts, positional } = parseArgs(rest);
  const cwd = process.cwd();

  try {
    const [workUnit, topic, subtopic, state] = positional;
    if (command === 'add') {
      if (!workUnit || !topic || !subtopic) {
        throw new Error('Usage: engine discussion-map add <work-unit> <topic> <subtopic> [--parent <subtopic>]');
      }
      respond(recordSubtopicAdd(cwd, workUnit, topic, subtopic, { parent: opts.parent ?? null }));
    } else if (command === 'set') {
      const pairs = positional.slice(2);
      if (pairs.some((p) => p.includes('='))) {
        // Uniform batch — every argument a <subtopic>=<state> pair, never
        // mixed with the positional form (the manifest set grammar).
        if (!workUnit || !topic || !pairs.length || !pairs.every((p) => /^[^=]+=[^=]+$/.test(p))) {
          throw new Error(`Usage: engine discussion-map set <work-unit> <topic> <subtopic>=<state> [<subtopic>=<state> …] — uniform pairs, never mixed with the positional form`);
        }
        respond(recordSubtopicStates(cwd, workUnit, topic, pairs.map((p) => {
          const i = p.indexOf('=');
          return [p.slice(0, i), p.slice(i + 1)];
        })));
      } else {
        if (!workUnit || !topic || !subtopic || !state) {
          throw new Error(`Usage: engine discussion-map set <work-unit> <topic> <subtopic> <${SUBTOPIC_STATES.join('|')}> — or a uniform <subtopic>=<state> batch`);
        }
        respond(recordSubtopicState(cwd, workUnit, topic, subtopic, state));
      }
    } else {
      throw new Error('Usage: engine discussion-map <add|set> …');
    }
  } catch (err) {
    failJson(err);
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

/** @param {string[]} argv */
function runDiscoveryMap(argv) {
  const [command, ...rest] = argv;
  const cwd = process.cwd();

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
      respond(addItemsBatch(cwd, workUnit, parsed));
      return;
    }
    if (command === 'sequence') {
      if (!workUnit || positional.length < 2) {
        throw new Error('Usage: engine discovery-map sequence <work-unit> <topic>=<order> [<topic>=<order> …]');
      }
      const orders = parseOrderPairs(positional.slice(1));
      respond(sequenceMap(cwd, workUnit, orders));
    } else if (command === 'add') {
      // Strict positional count: an unquoted payload would spill into
      // positionals and silently truncate the text — refuse instead.
      if (!workUnit || positional.length !== 3 || (opts.summary === undefined && !flags.has('backfill'))) {
        throw new Error(`Usage: engine discovery-map add <work-unit> <name> <${VALID_ROUTINGS.join('|')}> (--summary <text> [--description <text>] | --backfill) [--source <tag>] [--force-dismissed]`);
      }
      respond(addItem(cwd, workUnit, positional[1], {
        routing: positional[2],
        source: opts.source,
        summary: opts.summary,
        description: opts.description,
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
      respond(editItem(cwd, workUnit, positional[1], { summary, description }));
    } else if (command === 'remove' || command === 'handle' || command === 'unhandle') {
      if (!workUnit || positional.length !== 2) {
        throw new Error(`Usage: engine discovery-map ${command} <work-unit> <name>`);
      }
      const fn = command === 'remove' ? removeItem : command === 'handle' ? handleItem : unhandleItem;
      respond(fn(cwd, workUnit, positional[1]));
    } else if (command === 'rename') {
      if (!workUnit || positional.length !== 3) {
        throw new Error('Usage: engine discovery-map rename <work-unit> <old> <new>');
      }
      respond(renameItem(cwd, workUnit, positional[1], positional[2]));
    } else if (command === 'reroute') {
      if (!workUnit || positional.length !== 3) {
        throw new Error(`Usage: engine discovery-map reroute <work-unit> <name> <${VALID_ROUTINGS.join('|')}>`);
      }
      respond(rerouteItem(cwd, workUnit, positional[1], positional[2]));
    } else {
      throw new Error('Usage: engine discovery-map <sequence|add|edit|remove|rename|reroute|handle|unhandle> …');
    }
  } catch (err) {
    failJson(err);
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

/** @param {string[]} argv */
function runBuildOrder(argv) {
  const [command, ...rest] = argv;
  const cwd = process.cwd();

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
    respond(sequenceBuildOrder(cwd, workUnit, orders));
  } catch (err) {
    failJson(err);
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

/** @param {string[]} argv */
function runDiscoverySession(argv) {
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
      respond(openDiscoverySession(process.cwd(), workUnit, { sessionLogFile }));
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
      respond(closeDiscoverySession(process.cwd(), workUnit, { message }));
    } else {
      throw new Error('Usage: engine discovery-session <open|close> …');
    }
  } catch (err) {
    failJson(err);
  }
}

// ---------------------------------------------------------------------------
// topic — phase-item transitions. start/triage/complete/reopen/supersede are
// manifest-side lifecycle bookkeeping (KB sync where the phase is indexed:
// index on complete, remove on supersede; reopen syncs nothing —
// warn-don't-block) with no git commit — the calling session's commit
// cadence picks the change up. cancel/reactivate are
// one transaction per call: manifest write, knowledge-base sync
// (warn-don't-block), scoped git commit. The JSON response reports what
// happened — no follow-up read needed.
//
// Heartbeats ride the self-referential verbs — the session acting on its own
// topic: `start` (opening it), `absorb` (folding a concern into its own
// document), and `queue` (the findings check polls it every turn, so a turn
// with no writes still registers). `complete` is the release: the topic is
// closed, so the slot it held opens at that moment rather than at some later
// commit. `triage` never beats — delivery acts on the TARGET topic from the
// origin's session, and a beat there would stamp the origin process onto a
// topic it does not hold. Nor do `requeue`, `cancel`, `reactivate`,
// `supersede` or `reopen`: those are analysis and navigation actors reaching
// across topics.
// ---------------------------------------------------------------------------

const TOPIC_COMMANDS = { start: startTopic, triage: triageTopic, complete: completeTopic, reopen: reopenTopic, cancel: cancelTopic, reactivate: reactivateTopic };

// The self-referential verbs among those dispatched through TOPIC_COMMANDS;
// `queue` and `absorb` beat at their own branches.
const TOPIC_BEATS = ['start'];

/**
 * A SessionEnd hook target's session id: the argument when given, else the
 * hook's stdin JSON.
 * @param {string[]} rest @param {string} usage @returns {string|null}
 */
function hookSessionId(rest, usage) {
  if (rest.length > 1) throw new Error(usage);
  let sessionId = rest[0] || null;
  if (!sessionId && !process.stdin.isTTY) {
    try { sessionId = (JSON.parse(fs.readFileSync(0, 'utf8')) || {}).session_id || null; } catch { sessionId = null; }
  }
  return sessionId;
}

/** @param {string[]} argv */
function runPresence(argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'beat' || command === 'clear') {
      const [workUnit, phase, topic] = rest;
      if (!workUnit || !phase || !topic || rest.length !== 3) {
        throw new Error(`Usage: engine presence ${command} <work-unit> <phase> <topic>`);
      }
      respond((command === 'beat' ? beatPresence : clearPresence)(process.cwd(), workUnit, phase, topic));
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
        respond(scanProject(process.cwd()));
        return;
      }
      const res = scanPresence(process.cwd(), workUnit);
      respond(res);
      respondSections(deferralSection(res));
      return;
    }
    if (command === 'cleanup') {
      // The SessionEnd hook's target. Root resolution favours the
      // invocation cwd (a project root has `.workflows`), falling back to
      // CLAUDE_PROJECT_DIR for hooks fired from a drifted cwd.
      const sessionId = hookSessionId(rest, 'Usage: engine presence cleanup [session-id]');
      const cwd = fs.existsSync(path.join(process.cwd(), '.workflows'))
        ? process.cwd()
        : (process.env.CLAUDE_PROJECT_DIR || process.cwd());
      respond(cleanupPresence(cwd, sessionId));
      return;
    }
    throw new Error('Usage: engine presence <beat|clear|scan|cleanup> …');
  } catch (err) {
    failJson(err);
  }
}

/** @param {string[]} argv */
function runSession(argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'label') {
      const [workUnit, phase, topic] = rest;
      if (!workUnit || !phase || !topic || rest.length !== 3) {
        throw new Error('Usage: engine session label <work-unit> <phase> <topic>');
      }
      respond(applySessionLabel(process.cwd(), workUnit, phase, topic));
      return;
    }
    if (command === 'label-config') {
      const [value] = rest;
      if (rest.length !== 1 || (value !== 'true' && value !== 'false')) {
        throw new Error('Usage: engine session label-config <true|false>');
      }
      respond(setLabelConfig(value === 'true'));
      return;
    }
    if (command === 'repair') {
      if (rest.length !== 0) throw new Error('Usage: engine session repair');
      respond(repairSessionLabels(process.cwd()));
      return;
    }
    if (command === 'cleanup') {
      // The SessionEnd hook's target. The stash store is machine-global, so
      // no project root is needed.
      respond(restoreSessionLabel(hookSessionId(rest, 'Usage: engine session cleanup [session-id]')));
      return;
    }
    throw new Error('Usage: engine session <label|label-config|repair|cleanup> …');
  } catch (err) {
    failJson(err);
  }
}

/** @param {string[]} argv */
function runSources(argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'stale') {
      const { opts, positional } = parseArgs(rest);
      const [workUnit, discussion] = positional;
      if (!workUnit || !discussion || positional.length !== 2 || ('except' in opts && typeof opts.except !== 'string')) {
        throw new Error('Usage: engine sources stale <work-unit> <discussion> [--except <spec-topic>]');
      }
      respond(staleSources(process.cwd(), workUnit, discussion, { except: opts.except }));
      return;
    }
    throw new Error('Usage: engine sources <stale> …');
  } catch (err) {
    failJson(err);
  }
}

/** @param {string[]} argv */
function runTopic(argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'supersede') {
      const { opts, positional } = parseArgs(rest);
      const [workUnit, phase, topic] = positional;
      if (!workUnit || !phase || !topic || positional.length !== 3 || !opts.by) {
        throw new Error('Usage: engine topic supersede <work-unit> <phase> <topic> --by <topic>');
      }
      respond(supersedeTopic(process.cwd(), workUnit, phase, topic, { by: opts.by }));
      return;
    }
    if (command === 'queue') {
      const [workUnit, phase, topic] = rest;
      if (!workUnit || !phase || !topic || rest.length !== 3) {
        throw new Error('Usage: engine topic queue <work-unit> <phase> <topic>');
      }
      const status = queueStatus(process.cwd(), workUnit, phase, topic);
      // A read is reachable for any topic — a foreign queue is legitimately
      // checked from another session — so it refreshes an owned hold only,
      // never creates one.
      refreshQuietly(process.cwd(), workUnit, phase, topic);
      respond(status);
      return;
    }
    if (command === 'absorb') {
      /** @type {string[]} */ const pos = [];
      /** @type {string|undefined} */ let file;
      /** @type {string|undefined} */ let message;
      /** @type {string|undefined} */ let subtopic;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--file') file = rest[++i];
        else if (a === '--subtopic') subtopic = rest[++i];
        else if (a === '-m' || a === '--message') message = rest[++i];
        else pos.push(a);
      }
      const [workUnit, phase, topic] = pos;
      if (!workUnit || !phase || !topic || pos.length !== 3 || !file || !message) {
        throw new Error('Usage: engine topic absorb <work-unit> <phase> <topic> --file <NNN-slug.md> [--subtopic <name>] -m <message>');
      }
      const absorbed = absorbConcern(process.cwd(), workUnit, phase, topic, { file, message, subtopic });
      beatQuietly(process.cwd(), workUnit, phase, topic);
      respond(absorbed);
      return;
    }
    if (command === 'requeue') {
      /** @type {string[]} */ const pos = [];
      /** @type {string|undefined} */ let file;
      /** @type {string|undefined} */ let message;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--file') file = rest[++i];
        else if (a === '-m' || a === '--message') message = rest[++i];
        else pos.push(a);
      }
      const [workUnit, fromPhase, toPhase, topic] = pos;
      if (!workUnit || !fromPhase || !toPhase || !topic || pos.length !== 4 || !file || !message) {
        throw new Error('Usage: engine topic requeue <work-unit> <from-phase> <to-phase> <topic> --file <NNN-slug.md> -m <message>');
      }
      respond(requeueConcern(process.cwd(), workUnit, fromPhase, toPhase, topic, { file, message }));
      return;
    }
    if (command === 'triage') {
      /** @type {string[]} */ const pos = [];
      /** @type {string|undefined} */ let concern;
      /** @type {string|undefined} */ let slug;
      /** @type {string|undefined} */ let message;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--concern') concern = rest[++i];
        else if (a === '--slug') slug = rest[++i];
        else if (a === '-m' || a === '--message') message = rest[++i];
        else pos.push(a);
      }
      const [workUnit, phase, topic] = pos;
      const delivering = concern !== undefined || slug !== undefined || message !== undefined;
      if (!workUnit || !phase || !topic || pos.length !== 3 || (delivering && !(concern && slug && message))) {
        throw new Error('Usage: engine topic triage <work-unit> <phase> <topic> [--concern <file> --slug <kebab> -m <message>]');
      }
      respond(triageTopic(process.cwd(), workUnit, phase, topic, delivering ? { concernFile: concern, slug, message } : {}));
      return;
    }
    if (command === 'cancel') {
      const { flags, positional } = parseArgs(rest, ['cascade']);
      const [workUnit, phase, topic] = positional;
      if (!workUnit || !phase || !topic || positional.length !== 3) {
        throw new Error('Usage: engine topic cancel <work-unit> <phase> <topic> [--cascade]');
      }
      respond(cancelTopic(process.cwd(), workUnit, phase, topic, { cascade: flags.has('cascade') }));
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(TOPIC_COMMANDS, command)) {
      throw new Error('Usage: engine topic <start|triage|complete|reopen|supersede|cancel|reactivate|queue|absorb|requeue> <work-unit> <phase> <topic>');
    }
    const fn = TOPIC_COMMANDS[/** @type {keyof typeof TOPIC_COMMANDS} */ (command)];
    const [workUnit, phase, topic] = rest;
    if (!workUnit || !phase || !topic) {
      throw new Error(`Usage: engine topic ${command} <work-unit> <phase> <topic>`);
    }
    const result = fn(process.cwd(), workUnit, phase, topic);
    if (TOPIC_BEATS.includes(command)) beatQuietly(process.cwd(), workUnit, phase, topic);
    // The close releases the slot. Everything after it — the conclusion
    // commit, a plan or implementation wrap-up — is a session tidying a topic
    // it has finished, and none of it should re-take the hold.
    if (command === 'complete') clearQuietly(process.cwd(), workUnit, phase, topic);
    respond(result);
  } catch (err) {
    failJson(err);
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
// Beats follow the acting session: `create --from` is the spawning research
// or discussion session recording the spawn on its own item, so it beats
// that phase; every other verb (splits included) is the laboratory session
// working its own topic, so it beats the experiment slot — and a top-level
// conclude or abandon clears it: the record's close is the session's release.
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runExperiment(argv) {
  const [command, ...rest] = argv;
  const cwd = process.cwd();
  try {
    const { opts, positional } = parseArgs(rest);
    const [workUnit, topic, id] = positional;
    if (command === 'create') {
      if (!workUnit || !topic || positional.length !== 2 || !opts.slug) {
        throw new Error('Usage: engine experiment create <work-unit> <topic> --slug <kebab> (--from <research|discussion> --problem <file> | --parent <E{n}>)');
      }
      const created = createExperiment(cwd, workUnit, topic, { slug: opts.slug, from: opts.from, parent: opts.parent, problem: opts.problem });
      beatQuietly(cwd, workUnit, opts.from ?? 'experiment', topic);
      respond(created);
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
      respond(result);
      return;
    }
    if (command === 'advance' || command === 'approve') {
      if (!workUnit || !topic || !id || positional.length !== 3) {
        throw new Error(`Usage: engine experiment ${command} <work-unit> <topic> <id>`);
      }
      const result = (command === 'advance' ? advanceExperiment : approveExperiment)(cwd, workUnit, topic, id);
      beatQuietly(cwd, workUnit, 'experiment', topic);
      respond(result);
      return;
    }
    throw new Error('Usage: engine experiment <create|advance|approve|conclude|abandon> <work-unit> <topic> …');
  } catch (err) {
    failJson(err);
  }
}

// ---------------------------------------------------------------------------
// task — implementation-task bookkeeping: format-blind, manifest-side only.
// The engine never touches a task backend; the session does the plan surgery,
// these commands record it. No git commit — the per-task commit is the
// session's. Each verb answers with its one-line JSON only; the loop's
// brief, result header, and gate sections are fetched by their own `render`
// calls (task-brief, task-result, task-gate, fix-gate, blocked-tasks,
// cycle-limit, cycle-gate) at the stage that displays them.
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runTask(argv) {
  const [command, ...rest] = argv;
  const cwd = process.cwd();
  try {
    const { opts, flags, positional } = parseArgs(rest, ['skipped', 'phase-complete']);
    const [workUnit, topic, internalId] = positional;
    if (command === 'init' || command === 'analysis-cycle') {
      if (!workUnit || !topic) throw new Error(`Usage: engine task ${command} <work-unit> <topic>`);
      if (command === 'init') {
        respond(initTasks(cwd, workUnit, topic));
      } else {
        respond(analysisCycle(cwd, workUnit, topic));
      }
    } else if (command === 'start') {
      if (!workUnit || !topic || !internalId) {
        throw new Error('Usage: engine task start <work-unit> <topic> <internal-id>');
      }
      respond(startTask(cwd, workUnit, topic, internalId));
    } else if (command === 'fix-attempt') {
      if (!workUnit || !topic || !internalId || !opts['findings-file']) {
        throw new Error('Usage: engine task fix-attempt <work-unit> <topic> <internal-id> --findings-file <path>');
      }
      respond(fixAttempt(cwd, workUnit, topic, internalId, opts['findings-file']));
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
      respond(result);
    } else {
      throw new Error('Usage: engine task <init|start|fix-attempt|complete|analysis-cycle> …');
    }
  } catch (err) {
    failJson(err);
  }
}

// ---------------------------------------------------------------------------
// inbox — archive / restore / delete one or more inbox items as a single
// transaction: strict path validation, file moves (or git rm), one scoped
// commit for the whole set.
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runInbox(argv) {
  const [command, ...paths] = argv;
  try {
    if (!['archive', 'restore', 'delete'].includes(command) || paths.length === 0) {
      throw new Error('Usage: engine inbox <archive|restore|delete> <path> [<path> …]');
    }
    const cwd = process.cwd();
    if (command === 'archive') respond(archiveItems(cwd, paths));
    else if (command === 'restore') respond(restoreItems(cwd, paths));
    else respond(deleteItems(cwd, paths));
  } catch (err) {
    failJson(err);
  }
}

// ---------------------------------------------------------------------------
// roadmap — the product-roadmap layer on the project manifest
// (domain/roadmap.cjs): horizons + capability-grain items, lifecycle by
// join. Every mutation is one transaction under the project lock with its
// own pathspec commit of the project manifest — no work-unit cadence covers
// it, and a park fired mid-session must be durable immediately. `state` is
// the derived read every consumer shares.
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runRoadmap(argv) {
  const [command, ...rest] = argv;
  const cwd = process.cwd();
  try {
    if (command === 'state') {
      if (rest.length !== 0) throw new Error('Usage: engine roadmap state');
      respond(roadmap.roadmapState(cwd));
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
        respond(roadmapSession.openRoadmapSession(cwd, { sessionLogFile }));
        return;
      }
      if (sub === 'close') {
        /** @type {string|null} */ let message = null;
        for (let i = 0; i < srest.length; i++) {
          if (srest[i] === '-m' || srest[i] === '--message') message = srest[++i];
          else throw new Error(`unexpected argument "${srest[i]}"`);
        }
        if (!message) throw new Error('Usage: engine roadmap session close -m <message>');
        respond(roadmapSession.closeRoadmapSession(cwd, { message }));
        return;
      }
      throw new Error('Usage: engine roadmap session <open|close> …');
    }
    if (command === 'import') {
      if (rest.length === 0 || rest.some((a) => a.startsWith('--'))) {
        throw new Error('Usage: engine roadmap import <path> [<path> …]');
      }
      respond(roadmapSession.importRoadmapFiles(cwd, rest));
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
        respond(roadmap.addHorizon(cwd, positional[0], { position }));
      } else if (sub === 'rename') {
        if (positional.length !== 2) throw new Error('Usage: engine roadmap horizon rename <old> <new>');
        respond(roadmap.renameHorizon(cwd, positional[0], positional[1]));
      } else if (sub === 'reorder') {
        if (positional.length === 0) throw new Error('Usage: engine roadmap horizon reorder <name> [<name> …] (the complete order)');
        respond(roadmap.reorderHorizons(cwd, positional));
      } else if (sub === 'merge') {
        if (positional.length !== 1 || !opts.into) throw new Error('Usage: engine roadmap horizon merge <from> --into <to>');
        respond(roadmap.mergeHorizons(cwd, positional[0], opts.into));
      } else if (sub === 'split') {
        if (positional.length !== 1 || !opts.new || !opts.items) {
          throw new Error('Usage: engine roadmap horizon split <name> --new <name> --items <a,b,…> [--position <n>]');
        }
        const items = opts.items.split(',').map((s) => s.trim()).filter((s) => s !== '');
        respond(roadmap.splitHorizon(cwd, positional[0], { newName: opts.new, items, position }));
      } else if (sub === 'remove') {
        if (positional.length !== 1) throw new Error('Usage: engine roadmap horizon remove <name>');
        respond(roadmap.removeHorizon(cwd, positional[0]));
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
        throw new Error('Usage: engine roadmap add <name> --horizon <h> --summary <text> [--origin <tag>] [--source <path> …]');
      }
      respond(roadmap.addRoadmapItem(cwd, positional[0], {
        horizon: opts.horizon,
        summary: opts.summary,
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
      respond(roadmap.addRoadmapItemsBatch(cwd, parsed));
    } else if (command === 'edit') {
      if (positional.length !== 1 || opts.summary === undefined) {
        throw new Error('Usage: engine roadmap edit <name> --summary <text>');
      }
      respond(roadmap.editRoadmapItem(cwd, positional[0], { summary: opts.summary }));
    } else if (command === 'rename') {
      if (positional.length !== 2) throw new Error('Usage: engine roadmap rename <old> <new>');
      respond(roadmap.renameRoadmapItem(cwd, positional[0], positional[1]));
    } else if (command === 'move') {
      if (positional.length !== 1 || !opts.horizon) throw new Error('Usage: engine roadmap move <name> --horizon <h>');
      respond(roadmap.moveRoadmapItem(cwd, positional[0], opts.horizon));
    } else if (command === 'remove') {
      if (positional.length !== 1) throw new Error('Usage: engine roadmap remove <name>');
      respond(roadmap.removeRoadmapItem(cwd, positional[0]));
    } else if (command === 'pull') {
      if (positional.length === 0 || !opts.into) {
        throw new Error('Usage: engine roadmap pull <name> [<name> …] --into <work-unit>');
      }
      respond(roadmap.pullItems(cwd, positional, { into: opts.into }));
    } else if (command === 'bind') {
      if (positional.length !== 1 || !opts.topic) {
        throw new Error('Usage: engine roadmap bind <name> --topic <topic>');
      }
      respond(roadmap.bindItem(cwd, positional[0], { topic: opts.topic }));
    } else if (command === 'pull-forward') {
      if (positional.length !== 1 || !opts.into || !opts.routing) {
        throw new Error('Usage: engine roadmap pull-forward <name> --into <epic> --routing <research|discussion> [--force-dismissed]');
      }
      respond(roadmap.pullForwardItem(cwd, positional[0], {
        into: opts.into,
        routing: opts.routing,
        forceDismissed: flags.has('force-dismissed'),
      }));
    } else if (command === 'flag') {
      if (positional.length !== 1) throw new Error('Usage: engine roadmap flag <name>');
      respond(roadmap.flagJoined(cwd, positional[0]));
    } else {
      throw new Error('Usage: engine roadmap <state|add|add-batch|edit|rename|move|remove|pull|bind|pull-forward|flag|horizon> …');
    }
  } catch (err) {
    failJson(err);
  }
}

// ---------------------------------------------------------------------------
// cache — analysis-cache stamping. Checksums the current completed inputs
// exactly as the read side does and writes the cache object. No git commit —
// the calling flow's commit cadence picks the manifest change up.
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runCache(argv) {
  const [command, workUnit, kind] = argv;
  try {
    if (command !== 'stamp' || !workUnit || !kind) {
      throw new Error('Usage: engine cache stamp <work-unit> gap-analysis');
    }
    respond(stampAnalysisCache(process.cwd(), workUnit, kind));
  } catch (err) {
    failJson(err);
  }
}

// ---------------------------------------------------------------------------
// agent — the background-agent lifecycle store (domain/agent-state.cjs).
// The write verbs address the session's own topic — dispatching and walking
// its own agents' findings — so every one heartbeats. `scan` is a read,
// reachable for any topic, so it refreshes an owned hold only.
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runAgent(argv) {
  const [command, ...rest] = argv;
  try {
    const { opts, flags, lists, positional } = parseArgs(rest, ['clean', 'final'], ['label']);
    const [workUnit, phase, topic, id, finding] = positional;
    const cwd = process.cwd();
    /** @param {object} result */
    const answer = (result) => {
      beatQuietly(cwd, workUnit, phase, topic);
      respond(result);
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
      respond(scanned);
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
    failJson(err);
  }
}

// ---------------------------------------------------------------------------
// boot — the entry pipeline: migrations (hard error on failure), knowledge
// check (failure reports not-ready), compact when ready (warn-don't-block).
// ---------------------------------------------------------------------------

function runBoot() {
  try {
    respond(boot(process.cwd()));
  } catch (err) {
    failJson(err);
  }
}

// ---------------------------------------------------------------------------
// commit — the scoped commit helper. Every form computes a pathspec and
// commits confined to it: the work unit (`.workflows/{wu}`), the inbox, the
// roadmap, the whole `.workflows` tree, one topic's artifacts (`--topic`),
// the discovery session's paths (`--discovery`), a plan's declared storage
// (`--plan`), or declared code paths (`--paths`). The knowledge store rides
// the work-unit forms whenever it exists (domain/commit.cjs). A clean scope
// is fine: {committed: null}.
// ---------------------------------------------------------------------------

// Per-phase artifact pathspecs for `commit --topic` — the paths a topic's
// session writes, joined with the work-unit manifest at the call site. The
// triage-legal phases carry their sidecar directory so a drain's deletions
// ride the same commit.
const TOPIC_COMMIT_ARTIFACTS = /** @type {Record<string, (wu: string, topic: string) => string[]>} */ ({
  research: (wu, t) => [`.workflows/${wu}/research/${t}.md`, `.workflows/${wu}/research/.triage/${t}`],
  experiment: (wu, t) => [`.workflows/${wu}/experiment/${t}`],
  discussion: (wu, t) => [`.workflows/${wu}/discussion/${t}.md`, `.workflows/${wu}/discussion/.triage/${t}`],
  investigation: (wu, t) => [`.workflows/${wu}/investigation/${t}.md`, `.workflows/${wu}/investigation/.triage/${t}`],
  specification: (wu, t) => [`.workflows/${wu}/specification/${t}`],
  planning: (wu, t) => [`.workflows/${wu}/planning/${t}`],
  implementation: (wu, t) => [`.workflows/${wu}/implementation/${t}`],
  review: (wu, t) => [`.workflows/${wu}/review/${t}`],
});

// A topic whose item reads one of these is finished: nothing further a
// session does to it is work on a live topic, so its commits release the slot
// rather than hold it.
const TERMINAL_TOPIC_STATUSES = ['completed', 'cancelled', 'superseded', 'promoted'];

/**
 * A phase item straight off disk, or null when there is none — a direct read,
 * because the beat/clear decision must cost nothing and must never fail a
 * commit that has already landed.
 * @param {string} cwd @param {string} wu @param {string} phase @param {string} topic
 * @returns {Record<string, unknown>|null}
 */
function topicItem(cwd, wu, phase, topic) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(cwd, '.workflows', wu, 'manifest.json'), 'utf8'));
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
 * from, so the paths are Claude's to name — and every one is checked before
 * anything is staged: inside the project, literal (a glob would commit
 * whatever it happened to match), and never a workflow artifact, which has a
 * derived scope of its own.
 * @param {string} cwd @param {string} given
 * @returns {string} the project-relative path
 */
function codePathSpec(cwd, given) {
  if (given === '' || given === '-') throw new Error(`commit --paths: "${given}" is not a path`);
  if (/[*?\[\]]/.test(given) || given.startsWith(':')) {
    throw new Error(`commit --paths: "${given}" is a pattern — name each file literally`);
  }
  const abs = path.resolve(cwd, given);
  const rel = path.relative(cwd, abs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`commit --paths: "${given}" resolves outside the project`);
  }
  const spec = rel.split(path.sep).join('/');
  if (spec === '.workflows' || spec.startsWith('.workflows/')) {
    throw new Error(`commit --paths: "${given}" is a workflow artifact — those commit by their own scope (--topic/--discovery/--plan)`);
  }
  // On disk, in the index, or — the case `stageableSpecs` cannot see — gone
  // from both with its deletion already staged, which is what a `git mv` or
  // `git rm` leaves behind. The commit door accepts that path; so must the
  // validator in front of it, or the vanished side of a rename cannot be
  // named and the commit lands half a move.
  if (stageableSpecs(cwd, [spec]).length === 0 && !hasStagedDeletions(cwd, spec)) {
    throw new Error(`commit --paths: "${given}" is neither on disk nor tracked`);
  }
  return spec;
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
  if (!fs.existsSync(path.join(cwd, '.workflows', workUnit))) {
    throw new Error(`commit --paths: no work unit directory: .workflows/${workUnit}`);
  }
  if (topicItem(cwd, workUnit, phase, topic) === null) {
    throw new Error(`commit --paths: no ${phase} item "${topic}" in "${workUnit}" — check the --for target`);
  }
}

/**
 * The code commit: the declared paths, committed confined under the commit
 * lock, answering with what the working tree still holds. `left_dirty` is the
 * backstop for a forgotten path — every tracked modification and untracked
 * file left outside `.workflows` (a doc session's dirt is its own, and runs
 * concurrently by design).
 * @param {string} cwd @param {string[]} paths @param {string} message
 * @param {{workUnit: string, phase: string, topic: string}} target
 */
function commitCodePaths(cwd, paths, message, target) {
  assertCodeTarget(cwd, target);
  const specs = paths.map((p) => codePathSpec(cwd, p));
  const committed = commitPathspecScoped(cwd, specs, message);
  beatQuietly(cwd, target.workUnit, target.phase, target.topic);
  const left = dirtyPaths(cwd).filter((p) => p !== '.workflows' && !p.startsWith('.workflows/'));
  /** @type {{committed: string|null, left_dirty: string[], note?: string}} */
  const result = { committed, left_dirty: left };
  if (committed === null) result.note = 'nothing to commit';
  respond(result);
}

const COMMIT_USAGE = 'Usage: engine commit <work-unit> -m <message> [--plan <topic> | --discovery | --state | --topic <phase>/<topic> [--kb] [--sweep]] | engine commit --paths <file> … -m <message> --for <work-unit> <implementation|review>/<topic> | engine commit --state -m <message> | engine commit --inbox -m <message> | engine commit --roadmap -m <message> | engine commit --workflows -m <message>';

/** @param {string[]} argv */
function runCommit(argv) {
  try {
    /** @type {string|null} */ let workUnit = null;
    /** @type {string|null} */ let message = null;
    /** @type {string|null} */ let plan = null;
    /** @type {string|null} */ let topicSpec = null;
    /** @type {string[]} */ const files = [];
    /** @type {string[]} */ const forSpec = [];
    let paths = false;
    let discovery = false;
    let stateScope = false;
    let inbox = false;
    let workflows = false;
    let roadmapScope = false;
    let kb = false;
    let sweep = false;
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === '-m' || a === '--message') message = argv[++i];
      else if (a === '--plan') plan = argv[++i];
      else if (a === '--topic') topicSpec = argv[++i];
      else if (a === '--paths') paths = true;
      // The code commit's target: work unit and phase/topic, in containment
      // order, for the beat and nothing else.
      else if (a === '--for') forSpec.push(argv[++i], argv[++i]);
      else if (a === '--kb') kb = true;
      else if (a === '--sweep') sweep = true;
      else if (a === '--discovery') discovery = true;
      else if (a === '--state') stateScope = true;
      else if (a === '--inbox') inbox = true;
      else if (a === '--workflows') workflows = true;
      else if (a === '--roadmap') roadmapScope = true;
      else if (paths) files.push(a);
      else if (workUnit === null) workUnit = a;
      else throw new Error(`unexpected argument "${a}"`);
    }
    const cwd = process.cwd();

    if (paths) {
      // Code commits are the one scope no layout derives (P7): declared,
      // validated, confined, and answered with the residual dirt.
      const [forWorkUnit, forTopicSpec] = forSpec;
      const parts = (forTopicSpec || '').split('/');
      if (!message || files.length === 0 || forSpec.length !== 2 || !forWorkUnit || parts.length !== 2
          || !CODE_PHASES.includes(parts[0]) || !parts[1] || plan !== null || topicSpec !== null
          || discovery || stateScope || inbox || workflows || roadmapScope || kb || sweep || workUnit !== null) {
        throw new Error(COMMIT_USAGE);
      }
      commitCodePaths(cwd, files, message, { workUnit: forWorkUnit, phase: parts[0], topic: parts[1] });
      return;
    }

    // `--state` names two scopes by whether a work unit rides with it: the
    // unit's own analysis dir, or the global one.
    const globalState = stateScope && workUnit === null;
    const scopeCount = [inbox, workflows, roadmapScope, globalState, workUnit !== null].filter(Boolean).length;
    const workUnitFlags = [plan !== null, topicSpec !== null, discovery, stateScope && workUnit !== null].filter(Boolean).length;
    if (!message || scopeCount !== 1 || forSpec.length > 0 || (workUnitFlags > 0 && workUnit === null) ||
        workUnitFlags > 1 || plan === '' || plan === undefined ||
        topicSpec === '' || topicSpec === undefined ||
        (kb && topicSpec === null) || (sweep && topicSpec === null)) {
      throw new Error(COMMIT_USAGE);
    }
    /** @type {string|string[]} */ let scope;
    // The knowledge store rides only where the form's own action can dirty
    // it: a work unit's cadence commits, the whole-tree migration commit, and
    // the product session's. A plan authoring pass, an inbox transaction and
    // the global state dir never touch the store, so sweeping its dirt in
    // would be the theft the confinement removes.
    let rider = true;
    if (globalState) {
      // `.workflows/.state` — migrations, environment setup: project-level
      // bookkeeping written from inside whatever session happened to need it.
      scope = '.workflows/.state';
      rider = false;
    } else if (workflows) {
      scope = '.workflows';
    } else if (inbox) {
      scope = '.workflows/.inbox';
      rider = false;
    } else if (roadmapScope) {
      // The product session's cadence commit: the roadmap dir (sessions,
      // imports) plus the project manifest (the roadmap node lives there).
      const specs = stageableSpecs(cwd, [roadmapSession.ROADMAP_DIR, '.workflows/manifest.json']);
      if (specs.length === 0) {
        respond({ committed: null, note: 'nothing to commit' });
        return;
      }
      scope = specs;
    } else {
      const wu = /** @type {string} */ (workUnit);
      if (wu === '' || wu.includes('/') || wu.includes('..')) throw new Error(`invalid work unit name "${wu}"`);
      if (!fs.existsSync(path.join(cwd, '.workflows', wu))) {
        throw new Error(`no work unit directory: .workflows/${wu}`);
      }
      scope = `.workflows/${wu}`;
      if (topicSpec !== null) {
        // --topic: the action-scoped pathspec commit. `git commit -- <paths>`
        // confines the commit to the topic's artifact paths plus the
        // work-unit manifest — a concurrent session's dirty or staged files
        // are never swept up. The KB dir does not ride: no KB-touching verb
        // precedes a session-cadence commit, and KB-dirtying transactions
        // commit their own store dirt.
        const parts = topicSpec.split('/');
        const phase = parts[0];
        const topic = parts[1];
        const artifact = Object.hasOwn(TOPIC_COMMIT_ARTIFACTS, phase) ? TOPIC_COMMIT_ARTIFACTS[phase] : undefined;
        if (parts.length !== 2 || !artifact) {
          throw new Error(`commit --topic: expected <phase>/<topic> with phase one of ${Object.keys(TOPIC_COMMIT_ARTIFACTS).join(', ')} — got "${topicSpec}"`);
        }
        if (topic === '' || topic.includes('..')) throw new Error(`invalid topic name "${topic}"`);
        // --kb: the caller's action dirtied the store (a completion's
        // knowledge index) — stage it with the write that produced it.
        const specs = stageableSpecs(cwd, [
          `.workflows/${wu}/manifest.json`,
          ...artifact(wu, topic),
          ...(kb ? [KB_DIR] : []),
        ]);
        const committed = specs.length === 0 ? null : commitPathspecScoped(cwd, specs, message);
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
        // rather than re-taking it until the process dies. `--kb` clears for
        // the same reason at the conclusion moment. Anything else is the
        // session's own cadence commit, and that is its heartbeat.
        if (!sweep) {
          const status = topicStatus(cwd, wu, phase, topic);
          if (status !== null) {
            if (kb || TERMINAL_TOPIC_STATUSES.includes(status)) clearQuietly(cwd, wu, phase, topic);
            else beatQuietly(cwd, wu, phase, topic);
          }
        }
        if (committed === null) respond({ committed: null, note: 'nothing to commit' });
        else respond({ committed });
        return;
      }
      if (stateScope) {
        // --state: the work unit's analysis dir plus its manifest — the scope
        // the epic-wide analyses write (grouping, consolidation, the gap
        // analysis, build-order sequencing). Every one of them runs beside
        // live topic sessions whose half-written documents sit in the same
        // work unit, so the analysis slices its own paths and never theirs.
        // The store rides: an analysis that stamped its cache indexed it.
        const committed = commitPathspecWithKb(cwd, [
          `.workflows/${wu}/.state`,
          `.workflows/${wu}/manifest.json`,
        ], message);
        if (committed === null) respond({ committed: null, note: 'nothing to commit' });
        else respond({ committed });
        return;
      }
      if (discovery) {
        // --discovery: the discovery session's cadence commit. Discovery runs
        // beside live research and discussion sessions, so it slices its own
        // paths — session logs, briefs, the manifest the map lives in.
        const specs = stageableSpecs(cwd, discoveryScope(wu));
        const committed = specs.length === 0 ? null : commitPathspecScoped(cwd, specs, message);
        if (committed === null) respond({ committed: null, note: 'nothing to commit' });
        else respond({ committed });
        return;
      }
      if (plan !== null) {
        // --plan: the planning topic's own directory and the work-unit
        // manifest — the action scope, like --topic — plus the plan's
        // declared storage pathspecs (recorded at plan init from the format's
        // authoring doc, and often outside the work unit) and the project
        // manifest (plan init writes project defaults). A pathspec that
        // neither exists on disk nor has index entries is skipped, while a
        // deleted-but-tracked path still commits its deletions (the
        // restart-cleanup commits depend on that).
        if (plan.includes('/') || plan.includes('..')) throw new Error(`invalid planning topic name "${plan}"`);
        const manifestFile = path.join(cwd, '.workflows', wu, 'manifest.json');
        /** @type {any} */ let planItem;
        try {
          planItem = JSON.parse(fs.readFileSync(manifestFile, 'utf8')).phases?.planning?.items?.[plan];
        } catch {
          throw new Error(`commit --plan: cannot read .workflows/${wu}/manifest.json`);
        }
        if (!planItem) throw new Error(`commit --plan: no planning item "${plan}" in "${wu}"`);
        const declared = planItem.storage_paths;
        if (declared === undefined) {
          throw new Error(`commit --plan: planning item "${plan}" has no storage_paths — a pre-upgrade plan; record the format's declared pathspecs once: engine manifest set ${wu}.planning.${plan} storage_paths '[…]' (the format's authoring.md names them; '[]' when it stores inside the work unit)`);
        }
        if (!Array.isArray(declared) || declared.some((p) => typeof p !== 'string')) {
          throw new Error(`commit --plan: planning item "${plan}" has a malformed storage_paths (${JSON.stringify(declared)}) — must be an array of relative pathspec strings`);
        }
        for (const p of declared) {
          if (p === '' || p === '.' || p.startsWith('/') || p.split('/').includes('..')) {
            throw new Error(`commit --plan: illegal storage_paths entry ${JSON.stringify(p)} — pathspecs are relative, never ".", "..", or absolute`);
          }
        }
        scope = stageableSpecs(cwd, [
          `.workflows/${wu}/planning/${plan}`,
          `.workflows/${wu}/manifest.json`,
          '.workflows/manifest.json',
          ...declared,
        ]);
        rider = false;
      }
    }
    const committed = rider
      ? commitPathspecWithKb(cwd, scope, message)
      : commitPathspecScoped(cwd, scope, message);
    if (committed === null) respond({ committed: null, note: 'nothing to commit' });
    else respond({ committed });
  } catch (err) {
    failJson(err);
  }
}

/** @param {string[]} argv */
function runRender(argv) {
  const [command, ...rest] = argv;
  const { opts, flags, positional } = parseArgs(rest, ['approve', 'skipped-review', 'own', 'paths', 'warn', 'pipeline', 'donow', 'recommendations', 'dead-end']);
  const width = opts.width !== undefined ? parseInt(opts.width, 10) : WIDTH;

  if (Object.hasOwn(SURFACES, command)) {
    try {
      /** @type {{dotpath: string} & Record<string, string|undefined>} */
      const args = { dotpath: positional[0], ...opts };
      if (flags.has('approve')) args.approve = '1';
      if (flags.has('skipped-review')) args['skipped-review'] = '1';
      if (flags.has('own')) args.own = '1';
      if (flags.has('paths')) args.paths = '1';
      if (flags.has('warn')) args.warn = '1';
      if (flags.has('pipeline')) args.pipeline = '1';
      if (flags.has('donow')) args.donow = '1';
      if (flags.has('recommendations')) args.recommendations = '1';
      if (flags.has('dead-end')) args['dead-end'] = '1';
      respondSections(renderSurface(process.cwd(), command, args));
    } catch (err) {
      failJson(err);
    }
    return;
  }

  switch (command) {
    case 'signpost':
      if (!positional.length) die('Usage: engine render signpost <label> [--style step|substep] [--width N]');
      process.stdout.write(signpost(positional.join(' '), { style: /** @type {'step'|'substep'} */ (opts.style) || 'step', width }) + '\n');
      break;
    case 'box':
      if (!positional.length) die('Usage: engine render box <title> [--width N]');
      process.stdout.write(box(positional.join(' '), { width }));
      break;
    case 'wrap': {
      if (!positional.length) die('Usage: engine render wrap <text> [--width N] [--prefix STR]');
      const lines = wrapWithPrefix(positional.join(' '), { width, prefix: opts.prefix || '' });
      process.stdout.write(lines.join('\n') + '\n');
      break;
    }
    case 'tree': {
      // Reads a JSON node array from stdin (the data-owner builds it).
      const input = fs.readFileSync(0, 'utf8');
      process.stdout.write(renderTree(JSON.parse(input), opts.width !== undefined ? { width } : {}));
      break;
    }
    default:
      die(USAGE);
  }
}

/** @param {string[]} argv */
function runCli(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case 'boot':
      runBoot();
      break;
    case 'manifest':
      runManifest(rest);
      break;
    case 'workunit':
      runWorkunit(rest);
      break;
    case 'discussion-map':
      runDiscussionMap(rest);
      break;
    case 'discovery-map':
      runDiscoveryMap(rest);
      break;
    case 'build-order':
      runBuildOrder(rest);
      break;
    case 'discovery-session':
      runDiscoverySession(rest);
      break;
    case 'topic':
      runTopic(rest);
      break;
    case 'experiment':
      runExperiment(rest);
      break;
    case 'sources':
      runSources(rest);
      break;
    case 'presence':
      runPresence(rest);
      break;
    case 'session':
      runSession(rest);
      break;
    case 'task':
      runTask(rest);
      break;
    case 'inbox':
      runInbox(rest);
      break;
    case 'roadmap':
      runRoadmap(rest);
      break;
    case 'cache':
      runCache(rest);
      break;
    case 'agent':
      runAgent(rest);
      break;
    case 'commit':
      runCommit(rest);
      break;
    case 'render':
      runRender(rest);
      break;
    default:
      die(USAGE);
  }
}

if (require.main === module) {
  // A downstream reader closing early (`engine … | head -1`) makes the next
  // stdout write raise EPIPE; without a handler Node prints an unhandled-error
  // stack. Treat the closed pipe as a clean stop.
  process.stdout.on('error', (err) => {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EPIPE') process.exit(0);
    throw err;
  });
  try {
    runCli(process.argv.slice(2));
  } catch (err) {
    die(err instanceof Error ? err.message : String(err));
  }
}

module.exports = { parseArgs };

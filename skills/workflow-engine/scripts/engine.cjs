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
const { commitScopedWithKb, commitPathspecScoped, KB_DIR } = require('./domain/commit.cjs');
const { recordSubtopicAdd, recordSubtopicState, recordSubtopicStates, SUBTOPIC_STATES } = require('./domain/discussion-map.cjs');
const { VALID_ROUTINGS } = require('./kernel/manifest-schema.cjs');
const { sequenceMap, addItem, addItemsBatch, editItem, removeItem, renameItem, rerouteItem, handleItem, unhandleItem } = require('./domain/discovery-map.cjs');
const { startTopic, triageTopic, queueStatus, absorbConcern, completeTopic, reopenTopic, staleSources, supersedeTopic, cancelTopic, reactivateTopic } = require('./domain/transitions.cjs');
const { initTasks, startTask, fixAttempt, completeTask, analysisCycle } = require('./domain/tasks.cjs');
const { archiveItems, restoreItems, deleteItems } = require('./domain/inbox.cjs');
const { stampAnalysisCache } = require('./domain/cache.cjs');
const agentState = require('./domain/agent-state.cjs');
const { boot } = require('./domain/boot.cjs');
const { beatPresence, clearPresence, scanPresence, cleanupPresence, deferralSection } = require('./domain/presence.cjs');
const { applySessionLabel, restoreSessionLabel, setLabelConfig } = require('./domain/session-label.cjs');
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
  topic absorb <work-unit> <phase> <topic> --file <NNN-slug.md> -m <message>
  presence beat <work-unit> <phase> <topic>
  presence clear <work-unit> <phase> <topic>
  presence scan <work-unit>
  presence cleanup [session-id]
  session label <work-unit> <phase> <topic>
  session label-config <true|false>
  session cleanup [session-id]
  topic complete <work-unit> <phase> <topic>
  topic reopen <work-unit> <phase> <topic>
  topic supersede <work-unit> <phase> <topic> --by <topic>
  topic cancel <work-unit> <phase> <topic> [--cascade]
  topic reactivate <work-unit> <phase> <topic>
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
  cache stamp <work-unit> (research-analysis|gap-analysis)
  agent dispatch <work-unit> <phase> <topic> --kind <kind> [--label <slug> …] [--set <NNN>]
  agent scan     <work-unit> <phase> <topic>
  agent ack      <work-unit> <phase> <topic> <id> (--findings <F1,F2,…> | --clean)
  agent announce <work-unit> <phase> <topic> <id>
  agent surface  <work-unit> <phase> <topic> <id> <finding>[,<finding>…]
  agent incorporate <work-unit> <phase> <topic> <id>
  commit <work-unit> -m <message> [--plan <topic>]
  commit --inbox -m <message>
  commit --roadmap -m <message>
  commit --workflows -m <message>
  render resume-gate <wu.phase.topic> [--triage N] [--variant plan|review|scoping|session]  (session: bare <wu>)
  render task-list   <wu.planning.topic> --file <payload.json>
  render findings-summary <wu.phase.topic> --file <payload.json>
  render finding          <wu.phase.topic> --file <payload.json>
  render finding-batch    <wu.phase.topic> --file <payload.json>
  render review-presentation <wu.review.topic> --file <payload.json>
  render review-gate      <wu.review.topic> --verdict pass|fail [--replan N] [--out-of-scope N]
  render triage-announce  <wu.phase.topic>
  render triage-offer     <wu.phase.topic> --file <payload.json>
  render triage-block     <wu.phase.topic>
  render reroute-offer    <wu.phase.topic> --file <payload.json>
  render reroute-candidates <wu.phase.topic> --file <payload.json>
  render off-topic-offer  <wu.phase.topic> --file <payload.json> [--variant discussion]
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
  render early-completion-gate <wu>
  render revisit-gate      <wu> --prev <phase> --next <phase>
  render epic-all-done-gate <wu>
  render task-brief        <wu.implementation.topic> --file <payload.json>
  render task-result       <wu.implementation.topic> --file <payload.json> --result approved|needs-changes|blocked|failed
  render task-gate         <wu.implementation.topic>
  render fix-gate          <wu.implementation.topic>
  render blocked-tasks
  render cycle-limit       <wu.implementation.topic>
  render cycle-gate
  render workunit-receipt  <wu> --verb complete|cancel|reactivate|pivot [--pipeline [--skipped-review]] [--warn]
  render topic-receipt     <wu.phase.topic> --verb complete|cancel|reactivate [--warn]
  render absorb-receipt    <epic> --topic <name> [--moved research,seeds,imports] [--warn]
  render promote-receipt   <wu.specification.topic> --to <cc-work-unit> [--warn]
  render pivot-continuation <wu>
  render session-receipt   <wu> [--warn]
  render absorb-target     <feature>
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
    respond(/** @type {object} */ (runFieldCommand(process.cwd(), command ?? '', rest)));
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
      /** @type {Record<string, number>} */
      const orders = {};
      for (const pair of positional.slice(1)) {
        const eq = pair.indexOf('=');
        const name = eq > 0 ? pair.slice(0, eq) : '';
        const value = eq > 0 ? pair.slice(eq + 1) : '';
        if (!name || !/^[1-9][0-9]*$/.test(value)) {
          throw new Error(`bad assignment "${pair}" (expected {topic}={order}, order a positive integer)`);
        }
        if (name in orders) {
          throw new Error(`topic "${name}" assigned twice`);
        }
        orders[name] = parseInt(value, 10);
      }
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
// ---------------------------------------------------------------------------

const TOPIC_COMMANDS = { start: startTopic, triage: triageTopic, complete: completeTopic, reopen: reopenTopic, cancel: cancelTopic, reactivate: reactivateTopic };

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
      if (!workUnit || rest.length !== 1) throw new Error('Usage: engine presence scan <work-unit>');
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
    if (command === 'cleanup') {
      // The SessionEnd hook's target. The stash store is machine-global, so
      // no project root is needed.
      respond(restoreSessionLabel(hookSessionId(rest, 'Usage: engine session cleanup [session-id]')));
      return;
    }
    throw new Error('Usage: engine session <label|label-config|cleanup> …');
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
      respond(queueStatus(process.cwd(), workUnit, phase, topic));
      return;
    }
    if (command === 'absorb') {
      /** @type {string[]} */ const pos = [];
      /** @type {string|undefined} */ let file;
      /** @type {string|undefined} */ let message;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--file') file = rest[++i];
        else if (a === '-m' || a === '--message') message = rest[++i];
        else pos.push(a);
      }
      const [workUnit, phase, topic] = pos;
      if (!workUnit || !phase || !topic || pos.length !== 3 || !file || !message) {
        throw new Error('Usage: engine topic absorb <work-unit> <phase> <topic> --file <NNN-slug.md> -m <message>');
      }
      respond(absorbConcern(process.cwd(), workUnit, phase, topic, { file, message }));
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
      throw new Error('Usage: engine topic <start|triage|complete|reopen|supersede|cancel|reactivate> <work-unit> <phase> <topic>');
    }
    const fn = TOPIC_COMMANDS[/** @type {keyof typeof TOPIC_COMMANDS} */ (command)];
    const [workUnit, phase, topic] = rest;
    if (!workUnit || !phase || !topic) {
      throw new Error(`Usage: engine topic ${command} <work-unit> <phase> <topic>`);
    }
    respond(fn(process.cwd(), workUnit, phase, topic));
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
      throw new Error('Usage: engine cache stamp <work-unit> <research-analysis|gap-analysis>');
    }
    respond(stampAnalysisCache(process.cwd(), workUnit, kind));
  } catch (err) {
    failJson(err);
  }
}

// ---------------------------------------------------------------------------
// agent — the background-agent lifecycle store (domain/agent-state.cjs).
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runAgent(argv) {
  const [command, ...rest] = argv;
  try {
    const { opts, flags, lists, positional } = parseArgs(rest, ['clean'], ['label']);
    const [workUnit, phase, topic, id, finding] = positional;
    const cwd = process.cwd();
    if (command === 'dispatch') {
      if (!workUnit || !phase || !topic || positional.length !== 3 || !opts.kind) {
        throw new Error('Usage: engine agent dispatch <work-unit> <phase> <topic> --kind <kind> [--label <slug> …] [--set <NNN>]');
      }
      respond(agentState.dispatchAgent(cwd, workUnit, phase, topic, { kind: opts.kind, labels: lists.label || [], set: opts.set }));
      return;
    }
    if (command === 'scan') {
      if (!workUnit || !phase || !topic || positional.length !== 3) {
        throw new Error('Usage: engine agent scan <work-unit> <phase> <topic>');
      }
      respond(agentState.scanAgents(cwd, workUnit, phase, topic));
      return;
    }
    if (command === 'ack') {
      const hasFindings = opts.findings !== undefined;
      if (!workUnit || !phase || !topic || !id || positional.length !== 4 || hasFindings === flags.has('clean')) {
        throw new Error('Usage: engine agent ack <work-unit> <phase> <topic> <id> (--findings <F1,F2,…> | --clean)');
      }
      const findings = hasFindings ? opts.findings.split(',').map((f) => f.trim()) : [];
      respond(agentState.ackAgent(cwd, workUnit, phase, topic, id, { findings }));
      return;
    }
    if (command === 'announce' || command === 'incorporate') {
      if (!workUnit || !phase || !topic || !id || positional.length !== 4) {
        throw new Error(`Usage: engine agent ${command} <work-unit> <phase> <topic> <id>`);
      }
      const fn = command === 'announce' ? agentState.announceAgent : agentState.incorporateAgent;
      respond(fn(cwd, workUnit, phase, topic, id));
      return;
    }
    if (command === 'surface') {
      if (!workUnit || !phase || !topic || !id || !finding || positional.length !== 5) {
        throw new Error('Usage: engine agent surface <work-unit> <phase> <topic> <id> <finding>[,<finding>…]');
      }
      respond(agentState.surfaceFinding(cwd, workUnit, phase, topic, id, finding));
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
// commit — the scoped commit helper: stage `.workflows/{wu}` (the inbox with
// --inbox, or the whole tree with --workflows) and commit. The knowledge
// store rides along whenever it exists (domain/commit.cjs). A clean tree is
// fine: {committed: null}.
// ---------------------------------------------------------------------------

// Per-phase artifact pathspecs for `commit --topic` — the paths a topic's
// session writes, joined with the work-unit manifest at the call site. The
// triage-legal phases carry their sidecar directory so a drain's deletions
// ride the same commit.
const TOPIC_COMMIT_ARTIFACTS = /** @type {Record<string, (wu: string, topic: string) => string[]>} */ ({
  research: (wu, t) => [`.workflows/${wu}/research/${t}.md`, `.workflows/${wu}/research/.triage/${t}`],
  discussion: (wu, t) => [`.workflows/${wu}/discussion/${t}.md`, `.workflows/${wu}/discussion/.triage/${t}`],
  investigation: (wu, t) => [`.workflows/${wu}/investigation/${t}.md`],
  specification: (wu, t) => [`.workflows/${wu}/specification/${t}`],
  planning: (wu, t) => [`.workflows/${wu}/planning/${t}`],
  implementation: (wu, t) => [`.workflows/${wu}/implementation/${t}`],
  review: (wu, t) => [`.workflows/${wu}/review/${t}`],
});

/**
 * Whether the directory holds any file, at any depth. An existing-but-empty
 * directory is a git no-man's-land: `git add` tolerates its pathspec
 * silently while `git commit -- <paths>` refuses it — the state every
 * triage queue reaches once its last concern's deletion is committed.
 * @param {string} dirAbs
 * @returns {boolean}
 */
function dirHasFiles(dirAbs) {
  /** @type {fs.Dirent[]} */
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (dirHasFiles(path.join(dirAbs, e.name))) return true;
    } else {
      return true;
    }
  }
  return false;
}

/**
 * Keep pathspecs the whole add+commit sequence will accept: a file on disk,
 * a directory with content, or a path holding index entries (a
 * deleted-but-tracked path still stages its deletions). An empty directory
 * with no index entries is dropped — see dirHasFiles.
 * @param {string} cwd @param {string[]} specs
 * @returns {string[]}
 */
function stageableSpecs(cwd, specs) {
  const { execFileSync } = require('child_process');
  return specs.filter((p) => {
    const abs = path.join(cwd, p);
    if (fs.existsSync(abs)) {
      if (!fs.statSync(abs).isDirectory()) return true;
      if (dirHasFiles(abs)) return true;
    }
    try {
      return execFileSync('git', ['ls-files', '--', p], { cwd, encoding: 'utf8' }).trim() !== '';
    } catch {
      return false;
    }
  });
}

/** @param {string[]} argv */
function runCommit(argv) {
  try {
    /** @type {string|null} */ let workUnit = null;
    /** @type {string|null} */ let message = null;
    /** @type {string|null} */ let plan = null;
    /** @type {string|null} */ let topicSpec = null;
    let inbox = false;
    let workflows = false;
    let roadmapScope = false;
    let kb = false;
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === '-m' || a === '--message') message = argv[++i];
      else if (a === '--plan') plan = argv[++i];
      else if (a === '--topic') topicSpec = argv[++i];
      else if (a === '--kb') kb = true;
      else if (a === '--inbox') inbox = true;
      else if (a === '--workflows') workflows = true;
      else if (a === '--roadmap') roadmapScope = true;
      else if (workUnit === null) workUnit = a;
      else throw new Error(`unexpected argument "${a}"`);
    }
    const scopeCount = [inbox, workflows, roadmapScope, workUnit !== null].filter(Boolean).length;
    if (!message || scopeCount !== 1 || (plan !== null && workUnit === null) || plan === '' || plan === undefined ||
        (topicSpec !== null && workUnit === null) || topicSpec === '' || topicSpec === undefined ||
        (topicSpec !== null && plan !== null) || (kb && topicSpec === null)) {
      throw new Error('Usage: engine commit <work-unit> -m <message> [--plan <topic> | --topic <phase>/<topic> [--kb]] | engine commit --inbox -m <message> | engine commit --roadmap -m <message> | engine commit --workflows -m <message>');
    }
    const cwd = process.cwd();
    /** @type {string|string[]} */ let scope;
    if (workflows) {
      scope = '.workflows';
    } else if (inbox) {
      scope = '.workflows/.inbox';
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
        if (specs.length === 0) {
          respond({ committed: null, note: 'nothing to commit' });
          return;
        }
        const committed = commitPathspecScoped(cwd, specs, message);
        if (committed === null) respond({ committed: null, note: 'nothing to commit' });
        else respond({ committed });
        return;
      }
      if (plan !== null) {
        // --plan: the plan's declared storage pathspecs (recorded at plan
        // init from the format's authoring doc) plus the project manifest
        // (plan init writes project defaults). A pathspec that neither exists
        // on disk nor has index entries is skipped — `git add` would refuse
        // it — while a deleted-but-tracked path still stages its deletions
        // (the restart-cleanup commits depend on that).
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
        scope = [scope, ...stageableSpecs(cwd, ['.workflows/manifest.json', ...declared])];
      }
    }
    const committed = commitScopedWithKb(cwd, scope, message);
    if (committed === null) respond({ committed: null, note: 'nothing to commit' });
    else respond({ committed });
  } catch (err) {
    failJson(err);
  }
}

/** @param {string[]} argv */
function runRender(argv) {
  const [command, ...rest] = argv;
  const { opts, flags, positional } = parseArgs(rest, ['approve', 'skipped-review', 'own', 'paths', 'warn', 'pipeline', 'donow', 'recommendations']);
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
    case 'discovery-session':
      runDiscoverySession(rest);
      break;
    case 'topic':
      runTopic(rest);
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

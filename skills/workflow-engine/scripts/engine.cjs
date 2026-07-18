#!/usr/bin/env node
'use strict';

// ---------------------------------------------------------------------------
// Engine CLI — the shell door into the engine.
//
// Skills' .md files call this at prescribed points; scripts should prefer the
// in-process library (lib.cjs). Domain commands (transitions, queries) land
// here as they're built.
//
// The `render` command group is a DEV/DEBUG utility only (authoring aid for
// prose literals, layout inspection). Skill flows never call it at runtime:
// static chrome stays literal in prose; parameterised chrome is rendered
// in-process by projections.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { signpost, box, wrapWithPrefix, renderTree, WIDTH } = require('./kernel/render.cjs');
const { commitScopedWithKb } = require('./domain/commit.cjs');
const { recordSubtopicAdd, recordSubtopicState, SUBTOPIC_STATES } = require('./domain/discussion-map.cjs');
const { VALID_ROUTINGS } = require('./kernel/manifest-schema.cjs');
const { sequenceMap, addItem, editItem, removeItem, renameItem, rerouteItem, handleItem, reactivateItem } = require('./domain/discovery-map.cjs');
const { startTopic, completeTopic, supersedeTopic, cancelTopic, reactivateTopic } = require('./domain/transitions.cjs');
const { initTasks, startTask, fixAttempt, completeTask, analysisCycle } = require('./domain/tasks.cjs');
const { archiveItems, restoreItems, deleteItems } = require('./domain/inbox.cjs');
const { stampAnalysisCache } = require('./domain/cache.cjs');
const { boot } = require('./domain/boot.cjs');
const { createWorkUnit } = require('./domain/workunit-create.cjs');
const { completeWorkUnit, cancelWorkUnit, reactivateWorkUnit, pivotWorkUnit } = require('./domain/workunit-lifecycle.cjs');
const { absorbWorkUnit } = require('./domain/workunit-absorb.cjs');
const { promoteWorkUnit } = require('./domain/workunit-promote.cjs');
const { closeDiscoverySession } = require('./domain/discovery-session.cjs');
const { runFieldCommand, isRead } = require('./domain/fields.cjs');

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
  manifest set    <dotpath> <field> <value> [<field>=<value> …]
  manifest push   <dotpath> <field> <value>
  manifest pull   <dotpath> <field> <value>
  manifest delete <dotpath> <field.path>
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
  discovery-map sequence <work-unit> <topic>=<order> [<topic>=<order> …]
  discovery-map add <work-unit> <name> --routing <research|discussion>
                (--summary <text> [--description <text>] | --backfill)
                [--source <tag>] [--force-dismissed]
  discovery-map edit <work-unit> <name> [--summary <text>] [--description <text>]
  discovery-map remove <work-unit> <name>
  discovery-map rename <work-unit> <old> <new>
  discovery-map reroute <work-unit> <name> <research|discussion>
  discovery-map handle <work-unit> <name>
  discovery-map reactivate <work-unit> <name>
  discovery-session close <work-unit> -m <message>
  topic start <work-unit> <phase> <topic>
  topic complete <work-unit> <phase> <topic>
  topic supersede <work-unit> <phase> <topic> --by <topic>
  topic cancel <work-unit> <phase> <topic>
  topic reactivate <work-unit> <phase> <topic>
  task init <work-unit> <topic>
  task start <work-unit> <topic> <internal-id>
  task fix-attempt <work-unit> <topic> <internal-id> --findings-file <path>
  task complete <work-unit> <topic> (<internal-id> | --external <id>) [--skipped]
                [--next-task <id|~>] [--phase <N>] [--phase-complete]
  task analysis-cycle <work-unit> <topic>
  inbox archive <path> [<path> …]
  inbox restore <path> [<path> …]
  inbox delete <path> [<path> …]
  cache stamp <work-unit> (research-analysis|gap-analysis)
  commit <work-unit> -m <message>
  commit --inbox -m <message>
  commit --workflows -m <message>
  render signpost <label> [--style step|substep] [--width N]
  render box <title> [--width N]
  render wrap <text> [--width N] [--prefix STR]
  render tree [--width N]            (reads a JSON TreeNode array on stdin)`;

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
      if (!workUnit || !topic || !subtopic || !state) {
        throw new Error(`Usage: engine discussion-map set <work-unit> <topic> <subtopic> <${SUBTOPIC_STATES.join('|')}>`);
      }
      respond(recordSubtopicState(cwd, workUnit, topic, subtopic, state));
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
// map operations (add/edit/remove/rename/reroute/handle/reactivate) write the
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
      if (!workUnit || positional.length !== 2 || !opts.routing || (opts.summary === undefined && !flags.has('backfill'))) {
        throw new Error('Usage: engine discovery-map add <work-unit> <name> --routing <research|discussion> (--summary <text> [--description <text>] | --backfill) [--source <tag>] [--force-dismissed]');
      }
      respond(addItem(cwd, workUnit, positional[1], {
        routing: opts.routing,
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
    } else if (command === 'remove' || command === 'handle' || command === 'reactivate') {
      if (!workUnit || positional.length !== 2) {
        throw new Error(`Usage: engine discovery-map ${command} <work-unit> <name>`);
      }
      const fn = command === 'remove' ? removeItem : command === 'handle' ? handleItem : reactivateItem;
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
      throw new Error('Usage: engine discovery-map <sequence|add|edit|remove|rename|reroute|handle|reactivate> …');
    }
  } catch (err) {
    failJson(err);
  }
}

// ---------------------------------------------------------------------------
// discovery-session — epic discovery-session finalisation. close is one
// transaction: clear the active-session marker, index the finalised log
// (warn-don't-block), commit scoped to the work unit with the caller's
// message. The log's content is model-authored before the call — the engine
// never writes prose.
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runDiscoverySession(argv) {
  const [command, ...rest] = argv;
  try {
    if (command !== 'close') {
      throw new Error('Usage: engine discovery-session close <work-unit> -m <message>');
    }
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
  } catch (err) {
    failJson(err);
  }
}

// ---------------------------------------------------------------------------
// topic — phase-item transitions. start/complete/supersede are manifest-side
// lifecycle bookkeeping (KB sync where the phase is indexed: index on
// complete, remove on supersede — warn-don't-block) with no git commit — the
// calling session's commit cadence picks the change up. cancel/reactivate are
// one transaction per call: manifest write, knowledge-base sync
// (warn-don't-block), scoped git commit. The JSON response reports what
// happened — no follow-up read needed.
// ---------------------------------------------------------------------------

const TOPIC_COMMANDS = { start: startTopic, complete: completeTopic, cancel: cancelTopic, reactivate: reactivateTopic };

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
    if (!Object.prototype.hasOwnProperty.call(TOPIC_COMMANDS, command)) {
      throw new Error('Usage: engine topic <start|complete|supersede|cancel|reactivate> <work-unit> <phase> <topic>');
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
// session's.
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
      respond(command === 'init' ? initTasks(cwd, workUnit, topic) : analysisCycle(cwd, workUnit, topic));
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
      respond(completeTask(cwd, workUnit, topic, {
        internalId: internalId ?? null,
        externalId: opts.external ?? null,
        skipped: flags.has('skipped'),
        nextTask: next === undefined ? undefined : next === '~' ? null : next,
        phase,
        phaseComplete: flags.has('phase-complete'),
      }));
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

/** @param {string[]} argv */
function runCommit(argv) {
  try {
    /** @type {string|null} */ let workUnit = null;
    /** @type {string|null} */ let message = null;
    let inbox = false;
    let workflows = false;
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === '-m' || a === '--message') message = argv[++i];
      else if (a === '--inbox') inbox = true;
      else if (a === '--workflows') workflows = true;
      else if (workUnit === null) workUnit = a;
      else throw new Error(`unexpected argument "${a}"`);
    }
    const scopeCount = [inbox, workflows, workUnit !== null].filter(Boolean).length;
    if (!message || scopeCount !== 1) {
      throw new Error('Usage: engine commit <work-unit> -m <message> | engine commit --inbox -m <message> | engine commit --workflows -m <message>');
    }
    const cwd = process.cwd();
    let scope;
    if (workflows) {
      scope = '.workflows';
    } else if (inbox) {
      scope = '.workflows/.inbox';
    } else {
      const wu = /** @type {string} */ (workUnit);
      if (wu.includes('/') || wu.includes('..')) throw new Error(`invalid work unit name "${wu}"`);
      if (!fs.existsSync(path.join(cwd, '.workflows', wu))) {
        throw new Error(`no work unit directory: .workflows/${wu}`);
      }
      scope = `.workflows/${wu}`;
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
  const { opts, positional } = parseArgs(rest);
  const width = opts.width !== undefined ? parseInt(opts.width, 10) : WIDTH;

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
    case 'task':
      runTask(rest);
      break;
    case 'inbox':
      runInbox(rest);
      break;
    case 'cache':
      runCache(rest);
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
  try {
    runCli(process.argv.slice(2));
  } catch (err) {
    die(err instanceof Error ? err.message : String(err));
  }
}

module.exports = { parseArgs };

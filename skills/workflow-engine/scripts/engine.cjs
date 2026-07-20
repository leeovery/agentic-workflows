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
const { loadWorkUnitManifest, saveWorkUnitManifest } = require('./kernel/manifest.cjs');
const { commitScoped } = require('./kernel/git.cjs');
const { addSubtopic, setSubtopicState, mapState, SUBTOPIC_STATES } = require('./domain/discussion-map.cjs');
const { sequenceMap } = require('./domain/discovery-map.cjs');
const { cancelTopic, reactivateTopic } = require('./domain/transitions.cjs');
const { initTasks, startTask, fixAttempt, completeTask, analysisCycle } = require('./domain/tasks.cjs');
const { archiveItems, restoreItems, deleteItems } = require('./domain/inbox.cjs');
const { stampAnalysisCache } = require('./domain/cache.cjs');
const { boot } = require('./domain/boot.cjs');

/** @param {string} msg @returns {never} */
function die(msg) {
  process.stderr.write(msg + '\n');
  process.exit(1);
}

/** One decision-ready JSON line on stdout. @param {object} obj */
function respond(obj) {
  process.stdout.write(JSON.stringify({ ok: true, ...obj }) + '\n');
}

/** `{ok:false}` JSON on stderr, exit 1. @param {unknown} err @returns {never} */
function failJson(err) {
  process.stderr.write(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }) + '\n');
  process.exit(1);
}

// Minimal flag parser: collects `--key value` pairs, value-less flags named
// in `booleans`, and bare positionals.
/** @param {string[]} argv @param {string[]} [booleans] */
function parseArgs(argv, booleans = []) {
  /** @type {Record<string, string>} */
  const opts = {};
  /** @type {Set<string>} */
  const flags = new Set();
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      if (booleans.includes(name)) flags.add(name);
      else opts[name] = argv[++i];
    } else {
      positional.push(a);
    }
  }
  return { opts, flags, positional };
}

const USAGE = `Usage: engine <command> [args]

Commands:
  boot
  discussion-map add <work-unit> <topic> <subtopic> [--parent <subtopic>]
  discussion-map set <work-unit> <topic> <subtopic> <state>
  discovery-map sequence <work-unit> <topic>=<order> [<topic>=<order> …]
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
// discussion-map — Discussion Map subtopic writes. add/set: load (kernel) →
// apply (domain) → save → one decision-ready JSON line, no git commit (the
// session's commit cadence picks the manifest change up).
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
      const manifest = loadWorkUnitManifest(cwd, workUnit);
      const sub = addSubtopic(manifest, topic, subtopic, { parent: opts.parent ?? null });
      saveWorkUnitManifest(cwd, workUnit, manifest);
      respondDiscussionMap(manifest, topic, subtopic, sub.status);
    } else if (command === 'set') {
      if (!workUnit || !topic || !subtopic || !state) {
        throw new Error(`Usage: engine discussion-map set <work-unit> <topic> <subtopic> <${SUBTOPIC_STATES.join('|')}>`);
      }
      const manifest = loadWorkUnitManifest(cwd, workUnit);
      const sub = setSubtopicState(manifest, topic, subtopic, state);
      saveWorkUnitManifest(cwd, workUnit, manifest);
      respondDiscussionMap(manifest, topic, subtopic, sub.status);
    } else {
      throw new Error('Usage: engine discussion-map <add|set> …');
    }
  } catch (err) {
    failJson(err);
  }
}

/** @param {object} manifest @param {string} topic @param {string} subtopic @param {string} status */
function respondDiscussionMap(manifest, topic, subtopic, status) {
  const state = mapState(manifest, topic);
  respond({
    subtopic,
    status,
    all_decided: state.all_decided,
    unresolved_count: state.unresolved.length,
  });
}

// ---------------------------------------------------------------------------
// discovery-map — the Discovery Map's ordering. sequence records it as one
// transaction with its own scoped commit — the judgment (choosing the order)
// stays with the caller.
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runDiscoveryMap(argv) {
  const [command, ...rest] = argv;
  const { positional } = parseArgs(rest);
  const cwd = process.cwd();

  try {
    const [workUnit] = positional;
    if (command !== 'sequence' || !workUnit || positional.length < 2) {
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
  } catch (err) {
    failJson(err);
  }
}

// ---------------------------------------------------------------------------
// topic — epic topic cancel / reactivate. One transaction per call: manifest
// write, knowledge-base sync (warn-don't-block), scoped git commit. The JSON
// response reports what happened — no follow-up read needed.
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runTopic(argv) {
  const [command, workUnit, phase, topic] = argv;
  try {
    if (command !== 'cancel' && command !== 'reactivate') {
      throw new Error('Usage: engine topic <cancel|reactivate> <work-unit> <phase> <topic>');
    }
    if (!workUnit || !phase || !topic) {
      throw new Error(`Usage: engine topic ${command} <work-unit> <phase> <topic>`);
    }
    const fn = command === 'cancel' ? cancelTopic : reactivateTopic;
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
// --inbox, or the whole tree with --workflows) and commit. A clean tree is
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
    const committed = commitScoped(cwd, scope, message);
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
    case 'discussion-map':
      runDiscussionMap(rest);
      break;
    case 'discovery-map':
      runDiscoveryMap(rest);
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

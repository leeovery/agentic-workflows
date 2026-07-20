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
const { addSubtopic, setSubtopicState, mapState, SUBTOPIC_STATES } = require('./domain/map.cjs');
const { cancelTopic, reactivateTopic } = require('./domain/transitions.cjs');
const { archiveItems, restoreItems, deleteItems } = require('./domain/inbox.cjs');

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

// Minimal flag parser: collects `--key value` pairs and bare positionals.
/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const opts = {};
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      opts[a.slice(2)] = argv[++i];
    } else {
      positional.push(a);
    }
  }
  return { opts, positional };
}

const USAGE = `Usage: engine <command> [args]

Commands:
  map add <work-unit> <topic> <subtopic> [--parent <subtopic>]
  map set <work-unit> <topic> <subtopic> <state>
  topic cancel <work-unit> <phase> <topic>
  topic reactivate <work-unit> <phase> <topic>
  inbox archive <path> [<path> …]
  inbox restore <path> [<path> …]
  inbox delete <path> [<path> …]
  commit <work-unit> -m <message>
  commit --inbox -m <message>
  render signpost <label> [--style step|substep] [--width N]
  render box <title> [--width N]
  render wrap <text> [--width N] [--prefix STR]
  render tree [--width N]            (reads a JSON TreeNode array on stdin)`;

// ---------------------------------------------------------------------------
// map — discussion-map transitions. Load (kernel) → apply (domain) → save →
// one decision-ready JSON line, so the flow needs no follow-up read. No git
// commit here: the session's commit cadence picks the manifest change up.
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runMap(argv) {
  const [command, ...rest] = argv;
  const { opts, positional } = parseArgs(rest);
  const cwd = process.cwd();

  try {
    const [workUnit, topic, subtopic, state] = positional;
    if (command === 'add') {
      if (!workUnit || !topic || !subtopic) {
        throw new Error('Usage: engine map add <work-unit> <topic> <subtopic> [--parent <subtopic>]');
      }
      const manifest = loadWorkUnitManifest(cwd, workUnit);
      const sub = addSubtopic(manifest, topic, subtopic, { parent: opts.parent ?? null });
      saveWorkUnitManifest(cwd, workUnit, manifest);
      respondMap(manifest, topic, subtopic, sub.status);
    } else if (command === 'set') {
      if (!workUnit || !topic || !subtopic || !state) {
        throw new Error(`Usage: engine map set <work-unit> <topic> <subtopic> <${SUBTOPIC_STATES.join('|')}>`);
      }
      const manifest = loadWorkUnitManifest(cwd, workUnit);
      const sub = setSubtopicState(manifest, topic, subtopic, state);
      saveWorkUnitManifest(cwd, workUnit, manifest);
      respondMap(manifest, topic, subtopic, sub.status);
    } else {
      throw new Error('Usage: engine map <add|set> …');
    }
  } catch (err) {
    failJson(err);
  }
}

/** @param {object} manifest @param {string} topic @param {string} subtopic @param {string} status */
function respondMap(manifest, topic, subtopic, status) {
  const state = mapState(manifest, topic);
  respond({
    subtopic,
    status,
    all_decided: state.all_decided,
    unresolved_count: state.unresolved.length,
  });
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
// commit — the scoped commit helper: stage `.workflows/{wu}` (or the inbox
// with --inbox) and commit. A clean tree is fine: {committed: null}.
// ---------------------------------------------------------------------------

/** @param {string[]} argv */
function runCommit(argv) {
  try {
    /** @type {string|null} */ let workUnit = null;
    /** @type {string|null} */ let message = null;
    let inbox = false;
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === '-m' || a === '--message') message = argv[++i];
      else if (a === '--inbox') inbox = true;
      else if (workUnit === null) workUnit = a;
      else throw new Error(`unexpected argument "${a}"`);
    }
    if (!message || (inbox ? workUnit !== null : workUnit === null)) {
      throw new Error('Usage: engine commit <work-unit> -m <message> | engine commit --inbox -m <message>');
    }
    const cwd = process.cwd();
    let scope;
    if (inbox) {
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
    case 'map':
      runMap(rest);
      break;
    case 'topic':
      runTopic(rest);
      break;
    case 'inbox':
      runInbox(rest);
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

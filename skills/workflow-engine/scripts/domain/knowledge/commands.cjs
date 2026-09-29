'use strict';

// ---------------------------------------------------------------------------
// Domain ring: `engine knowledge <verb>` — the knowledge base's one door.
// Every verb acts on the project the call's directory sits in. The verbs
// that talk to the embedding provider answer asynchronously — a bulk index,
// a query, the vector fill, setup and rebuild; every other verb answers at
// once. A failure is the command's own: said on stderr as `Error: …`, exit 1.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const config = require('../../kernel/knowledge/config.cjs');
const store = require('../../kernel/knowledge/store.cjs');
const { knowledgeFiles } = require('../../kernel/knowledge/files.cjs');
const { readProjectManifest } = require('../../kernel/manifest.cjs');
const { ENGINE_COMMAND, ExitSignal, messageOf } = require('../../kernel/call.cjs');
const { UserError } = require('../../kernel/knowledge/retry.cjs');
const { RESERVED_IDENTITIES, discoverArtifacts, readManifestsOr, workUnitsOr } = require('./artifacts.cjs');
const { loadSettings, newStoreEmbedder, metadataMissing } = require('./embedder.cjs');
const { artifactAt, indexArtifact } = require('./indexing.cjs');
const { launchFillIfAwaiting, fill } = require('./vectors.cjs');
const { indexBulk, indexFailed, reportUnembedded } = require('./bulk.cjs');
const { NO_RESULTS, queryProvider, boostProblem, querySettings, queryStore, renderQuery } = require('./query.cjs');
const { readiness, statusReport } = require('./status.cjs');
const { countChunks, removeChunks, planCompaction, compact } = require('./maintenance.cjs');
const { parseSetupForm, runFromSystem, runKeywordOnly, runProviderForm } = require('./setup-forms.cjs');
const { runWizard, runKeyOnly } = require('./setup-wizard.cjs');

/** @typedef {import('../../kernel/call.cjs').Call} Call */
/** @typedef {import('../../kernel/knowledge/files.cjs').KnowledgeFiles} KnowledgeFiles */

const USAGE = `Usage: engine knowledge <command> [options]

Commands:
  index     Index a file, or with no file bring the store in line with every artifact
  query     Search the knowledge base
  check     Check if the knowledge base is ready
  status    Show knowledge base status
  remove    Remove indexed content
  compact   Compact the knowledge base
  rebuild   Rebuild the knowledge base from scratch
  fill      Embed the chunks awaiting vectors (launched in the background after an index)
  setup     Interactive setup wizard; non-interactive forms:
              setup --from-system
              setup --keyword-only
              setup --provider openai --model <m> [--dimensions <d>]
              setup --provider openai-compatible --base-url <u> --model <m> --dimensions <d>
              setup --key-only [--provider <id>]
            The API key is never a flag — it resolves from the provider env
            var or ~/.config/workflows/credentials.json (see --key-only)

Filter options (hard filters — non-matching chunks excluded):
  --work-type <type>        Filter by work type
  --work-unit <unit>        Filter by work unit
  --phase <phase>           Filter by phase
  --topic <topic>           Filter by topic

Re-ranking (query only, additive; repeat for multiple boosts):
  --boost:<field> <value>   Boost chunks matching <field>:<value> by +0.1
                            Valid fields: work-unit, work-type, phase,
                            topic, confidence

Other options:
  --limit <n>               Limit number of results
  --explain                 Show how each query result ranked
  --dry-run                 Preview without making changes
  --help, -h                Show this usage and exit 0`;

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

const SWITCHES = new Set(['explain', 'dry-run']);

/** @typedef {{field: string, value: string|null}} Boost */

/**
 * Argv as positionals, flags (`--flag value` and `--flag=value`; a switch
 * never takes the next argument) and the repeatable `--boost:<field>
 * <value>`, whose field rides in the flag's name so no template has to
 * escape a separator.
 * @param {string[]} argv
 * @returns {{positional: string[], flags: Record<string, string|boolean>, boosts: Boost[]}}
 */
function parseArgs(argv) {
  /** @type {string[]} */
  const positional = [];
  /** @type {Record<string, string|boolean>} */
  const flags = {};
  /** @type {Boost[]} */
  const boosts = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
    if (arg.startsWith('--boost:')) {
      // A missing value is left null for the command to refuse clearly.
      boosts.push({ field: arg.slice('--boost:'.length), value: next });
      if (next !== null) i++;
    } else if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else if (!SWITCHES.has(arg.slice(2)) && next !== null) {
        flags[arg.slice(2)] = next;
        i++;
      } else {
        flags[arg.slice(2)] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags, boosts };
}

/**
 * @typedef {object} Options  a command's flags by meaning — the filters are
 *   hard filters on every command that takes them
 * @property {string|null} workType
 * @property {string|null} phase
 * @property {string|null} workUnit
 * @property {string|null} topic
 * @property {number|null} limit
 * @property {boolean} dryRun
 * @property {boolean} explain
 * @property {Boost[]} boosts
 */

/**
 * @param {Record<string, any>} flags @param {Boost[]} boosts
 * @returns {Options}
 */
function buildOptions(flags, boosts) {
  const on = (/** @type {string} */ name) => flags[name] === true || flags[name] === 'true';
  return {
    workType: flags['work-type'] || null,
    phase: flags.phase || null,
    workUnit: flags['work-unit'] || null,
    topic: flags.topic || null,
    limit: flags.limit ? parseInt(flags.limit, 10) : null,
    dryRun: on('dry-run'),
    explain: on('explain'),
    boosts,
  };
}

/**
 * @typedef {object} Request
 * @property {string} root  the project the call acts on
 * @property {KnowledgeFiles} files
 * @property {string[]} args  the positionals after the verb
 * @property {Record<string, string|boolean>} flags
 * @property {Options} options
 */

/** @param {Call} call @param {string} text @returns {never} */
function stop(call, text) {
  call.err(text);
  throw new ExitSignal(1);
}

// ---------------------------------------------------------------------------
// index
// ---------------------------------------------------------------------------

/**
 * One file: its keyword side written at once and the vector fill launched;
 * or, with no file, the bulk index, its vectors filled while it waits.
 * @param {Call} call @param {Request} request
 */
function runIndex(call, { root, files, args, options }) {
  const settings = loadSettings(files);
  if (args.length === 0) {
    return indexBulk(call, root, settings, options.workUnit).then((summary) => {
      if (indexFailed(summary)) throw new ExitSignal(1);
    });
  }
  const file = args[0];
  const artifact = artifactAt(root, file);
  if (!artifact) stop(call, `File not found: ${path.resolve(root, file)}\n`);
  let written;
  try {
    written = indexArtifact(root, artifact, settings);
  } catch (err) {
    stop(call, `Failed to index ${file}: ${messageOf(err)}\nThe next start will retry it.\n`);
  }
  call.out(`Indexed ${written.chunks} chunks from ${file}\n`);
  launchFillIfAwaiting(root, written);
}

// ---------------------------------------------------------------------------
// query
// ---------------------------------------------------------------------------

/** @param {Call} call @param {Request} request */
async function runQuery(call, { root, files, args, options }) {
  const cfg = config.loadConfig({ projectPath: files.config });
  const provider = queryProvider(cfg);
  if (args.length === 0) {
    stop(call, 'Usage: engine knowledge query <search_term> [<term2>...] [--work-unit ...] [--work-type ...] [--phase ...] [--topic ...] [--boost:<field> <value>]... [--limit N] [--explain]\n');
  }
  // A blank term is a caller's mistake — an unsubstituted template — never a
  // request for everything.
  if (args.some((t) => t.trim() === '')) {
    throw new UserError(
      'Empty search term. `engine knowledge query` requires at least one non-empty positional term. ' +
        `If you intended to list everything indexed, use \`${ENGINE_COMMAND} knowledge status\` instead.`
    );
  }
  const boostError = options.boosts.map(boostProblem).find(Boolean);
  if (boostError) stop(call, `${boostError}\n`);

  if (!fs.existsSync(files.store)) {
    call.out(renderQuery(NO_RESULTS));
    return;
  }
  const db = store.loadStore(files.store);
  if (metadataMissing(files)) {
    stop(call, `${path.basename(files.metadata)} missing but store exists. Run \`${ENGINE_COMMAND} knowledge rebuild\` to fix.\n`);
  }
  const settings = querySettings(store.readMetadata(files.metadata), cfg, provider);
  const outcome = await queryStore(db, settings, { terms: args, options, workUnits: workUnitsOr(root, call.err, 'query'), root });
  call.out(renderQuery(outcome, { explain: options.explain }));
}

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

/** @param {Options} options */
function removeDescription({ workUnit, phase, topic }) {
  if (topic) return `${workUnit}/${phase}/${topic}`;
  if (phase) return `${workUnit}/${phase}`;
  return `${workUnit} (all phases)`;
}

/**
 * A work unit's chunks removed — narrowed by phase and topic. A name the
 * registry does not hold is refused, so a typo never reads as a clean
 * no-op — unless the store still holds its chunks, which makes it an orphan
 * cleanup. The project-level identities are never registered.
 * @param {Call} call @param {Request} request
 */
function runRemove(call, { root, options }) {
  if (!options.workUnit) stop(call, 'Usage: engine knowledge remove --work-unit <wu> [--phase <p>] [--topic <t>] [--dry-run]\n');
  if (options.topic && !options.phase) stop(call, 'Error: --topic requires --phase\n');
  const scope = { workUnit: options.workUnit, phase: options.phase, topic: options.topic };

  let desc = removeDescription(options);
  const registered = RESERVED_IDENTITIES.has(options.workUnit)
    || Object.hasOwn(readProjectManifest(root).work_units || {}, options.workUnit);
  if (!registered) {
    const stranded = countChunks(root, scope);
    if (stranded === 0) {
      throw new UserError(
        `Work unit "${options.workUnit}" not found in project manifest, ` +
          'and no matching chunks exist in the knowledge base.\n' +
          `  Check the name with \`${ENGINE_COMMAND} knowledge status\`.`
      );
    }
    call.err(
      `Work unit "${options.workUnit}" is not in the project manifest, but ` +
        `${stranded} chunks remain in the store. Removing as an orphan cleanup.\n`
    );
    desc += ' (orphan cleanup)';
  }

  if (options.dryRun) {
    const initialised = fs.existsSync(knowledgeFiles(root).store);
    call.out(initialised
      ? `Would remove ${countChunks(root, scope)} chunks for ${desc}\n`
      : `Would remove 0 chunks for ${desc} (store not initialised)\n`);
    return;
  }
  let removed;
  try {
    removed = removeChunks(root, scope);
  } catch (err) {
    stop(call, `Removal of ${desc} failed: ${messageOf(err)}\nThe next start will remove them.\n`);
  }
  call.out(`Removed ${removed} chunks for ${desc}\n`);
}

// ---------------------------------------------------------------------------
// compact
// ---------------------------------------------------------------------------

/** @param {Call} call @param {Request} request */
function runCompact(call, { root, files, options }) {
  const { cfg } = loadSettings(files);
  const plan = planCompaction(root, cfg, workUnitsOr(root, call.err, 'compact'));
  if (!plan) {
    call.out('Compaction disabled\n');
    return;
  }
  if (plan.removals.length === 0) return;
  if (!options.dryRun) compact(root, plan);
  call.out([
    `${options.dryRun ? '[dry-run] ' : ''}Compacted: removed ${plan.chunks} chunks from ${plan.removals.length} work units (retrievability < ${plan.floor})`,
    ...plan.removals.map((r) => `  • ${r.workUnit}: ${r.count} chunks (${r.phases.join(', ')})`),
  ].join('\n') + '\n');
}

// ---------------------------------------------------------------------------
// rebuild
// ---------------------------------------------------------------------------

/**
 * A line typed at the terminal, gathered until its newline or the input's
 * end — a slow typist's line can arrive in several pieces.
 * @param {NodeJS.ReadStream} input
 * @returns {Promise<string>}
 */
function terminalLine(input) {
  return new Promise((resolve) => {
    let buf = '';
    const finish = () => {
      input.removeListener('data', onData);
      input.removeListener('end', finish);
      // Paused, so an unused stdin does not hold the process open.
      input.pause();
      resolve(buf);
    };
    const onData = (/** @type {string} */ chunk) => {
      buf += chunk;
      if (/\r|\n/.test(buf)) finish();
    };
    input.setEncoding('utf8');
    input.on('data', onData);
    input.once('end', finish);
    input.resume();
  });
}

/**
 * The confirmation typed back: read at the terminal, else from stdin — its
 * first line, trimmed.
 * @param {Call} call @returns {Promise<string>}
 */
async function confirmation(call) {
  const text = call.terminal ? await terminalLine(call.terminal.input) : call.stdin();
  return text.split(/\r|\n/)[0].trim();
}

/**
 * Move the store and its metadata between their places and the backups,
 * under the lock, so no concurrent write lands in a half-moved store.
 * @param {KnowledgeFiles} files @param {'aside'|'back'|'drop'} move
 */
function moveBackups(files, move) {
  const pairs = [[files.store, `${files.store}.bak`], [files.metadata, `${files.metadata}.bak`]];
  store.withLock(files.lock, () => {
    for (const [live, backup] of pairs) {
      if (move === 'aside') {
        fs.rmSync(backup, { force: true });
        if (fs.existsSync(live)) fs.renameSync(live, backup);
      } else if (move === 'back' && fs.existsSync(backup)) {
        fs.rmSync(live, { force: true });
        fs.renameSync(backup, live);
      } else if (move === 'drop') {
        fs.rmSync(backup, { force: true });
      }
    }
  });
}

/**
 * The store rebuilt from the files, once the person types `rebuild`. The old
 * store is set aside first — never deleted until the bulk index stands — and
 * put back if the index throws.
 * @param {Call} call @param {Request} request
 */
async function runRebuild(call, { root, files }) {
  const settings = loadSettings(files);
  // Refused before anything is touched when no store may be created here.
  newStoreEmbedder(files, settings.cfg, settings.provider);

  call.err(
    'Warning: This will delete the existing index and rebuild from scratch.\n' +
    'This is non-deterministic — the rebuilt index will differ from the original.\n' +
    "Type 'rebuild' to confirm: "
  );
  // The leading newline keeps the message off whatever was typed at the prompt.
  if ((await confirmation(call)) !== 'rebuild') stop(call, '\nAborted.\n');

  // Nothing found to index would wipe the index for nothing.
  if (discoverArtifacts(root, readManifestsOr(root, call.err, 'discoverArtifacts')).length === 0) {
    stop(call,
      'No artifacts to index. Aborting rebuild — ' +
      'the existing index has NOT been modified.\n' +
      '(If you believe this is wrong, check that .workflows/ exists and ' +
      'that work units have items with status "completed".)\n'
    );
  }

  moveBackups(files, 'aside');
  call.out('Deleted existing index.\n');
  let summary;
  try {
    summary = await indexBulk(call, root, settings);
  } catch (err) {
    try {
      moveBackups(files, 'back');
      call.err('Rebuild failed; restored previous index from backup.\n');
    } catch (rollbackErr) {
      call.err(
        'Rebuild failed and rollback also failed. Previous index is at:\n' +
        `  ${files.store}.bak\n  ${files.metadata}.bak\n` +
        `Rename them back manually to recover. Rollback error: ${messageOf(rollbackErr)}\n`
      );
    }
    throw err;
  }
  // The rebuilt index stands — what failed to index or embed, the next
  // start retries — so the backup goes.
  moveBackups(files, 'drop');
  if (indexFailed(summary)) throw new ExitSignal(1);
}

// ---------------------------------------------------------------------------
// setup, check, status, fill
// ---------------------------------------------------------------------------

/** @param {Call} call @param {Request} request */
async function runSetup(call, { root, flags }) {
  const parsed = parseSetupForm(flags);
  if (parsed.error) throw new UserError(parsed.error);
  switch (parsed.form) {
    case 'from-system': return runFromSystem(call, root);
    case 'keyword-only': return runKeywordOnly(call, root);
    case 'provider': return runProviderForm(call, root, flags);
    case 'key-only': return runKeyOnly(call, flags);
    default: return runWizard(call, root);
  }
}

/** @param {Call} call @param {Request} request */
function runCheck(call, { root }) {
  call.out(`${readiness(root, call.err)}\n`);
}

/** @param {Call} call @param {Request} request */
function runStatus(call, { root }) {
  call.out(statusReport(root));
}

/**
 * The vector fill — what the keyword side's writers launch in the
 * background. Silent unless a chunk it tried went without its vector.
 * @param {Call} call @param {Request} request
 */
async function runFill(call, { root }) {
  const vectoring = await fill(root);
  if (vectoring && vectoring.unembedded.length > 0) {
    reportUnembedded(call, vectoring.unembedded);
    throw new ExitSignal(1);
  }
}

const always = () => true;
const never = () => false;

/**
 * Each verb's handler, and whether it waits on the embedding provider for
 * the positionals after it.
 * @type {Record<string, {run: (call: Call, request: Request) => void|Promise<void>, waits: (args: string[]) => boolean}>}
 */
const VERBS = {
  index: { run: runIndex, waits: (args) => args.length === 0 },
  query: { run: runQuery, waits: always },
  check: { run: runCheck, waits: never },
  status: { run: runStatus, waits: never },
  remove: { run: runRemove, waits: never },
  compact: { run: runCompact, waits: never },
  rebuild: { run: runRebuild, waits: always },
  setup: { run: runSetup, waits: always },
  fill: { run: runFill, waits: always },
};

/** @param {string[]} argv */
const helpAsked = (argv) => argv.includes('--help') || argv.includes('-h') || argv[0] === 'help';

/**
 * Whether `engine knowledge <argv>` answers asynchronously — decided before
 * it runs.
 * @param {string[]} argv
 * @returns {boolean}
 */
function knowledgeWaits(argv) {
  if (helpAsked(argv)) return false;
  const [verb, ...args] = parseArgs(argv).positional;
  return Boolean(verb) && Object.hasOwn(VERBS, verb) && VERBS[verb].waits(args);
}

/**
 * A failure that is no exit of the command's own, said as the command's
 * answer: `Error: …` on stderr, exit 1.
 * @param {Call} call @param {unknown} err @returns {never}
 */
function failed(call, err) {
  if (err instanceof ExitSignal) throw err;
  call.err(`Error: ${messageOf(err)}\n`);
  throw new ExitSignal(1);
}

/**
 * `engine knowledge <verb> …` — a promise for the verbs that wait on the
 * embedding provider, nothing for the rest.
 * @param {Call} call @param {string[]} argv
 * @returns {void|Promise<void>}
 */
function runKnowledge(call, argv) {
  if (helpAsked(argv)) {
    call.out(USAGE + '\n');
    return;
  }
  const { positional, flags, boosts } = parseArgs(argv);
  const [verb, ...args] = positional;
  if (!verb) stop(call, USAGE + '\n');
  const handler = Object.hasOwn(VERBS, verb) ? VERBS[verb].run : null;
  if (!handler) stop(call, `Unknown command "${verb}".\n\n${USAGE}\n`);

  const root = config.findProjectRoot(call.cwd);
  const request = { root, files: knowledgeFiles(root), args, flags, options: buildOptions(flags, boosts) };
  let answer;
  try {
    answer = handler(call, request);
  } catch (err) {
    failed(call, err);
  }
  return answer && answer.catch((err) => failed(call, err));
}

module.exports = { runKnowledge, knowledgeWaits, buildOptions };

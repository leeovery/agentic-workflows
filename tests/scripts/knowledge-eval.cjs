'use strict';

// The knowledge base's eval harness: judged queries over a frozen snapshot of
// three real projects, measuring how often retrieval returns the passage an
// agent needed, how high, and at what cost in output. Each project's fixture
// is copied and indexed through the source CLI's bulk index; every case runs
// in process through the query function the CLI itself calls, and the
// measurements compare exactly with a pinned baseline.
//
// The gate (test-knowledge-eval.cjs) runs the keyword leg. By hand:
//
//   node tests/scripts/knowledge-eval.cjs              metrics, cases, baseline check
//   node tests/scripts/knowledge-eval.cjs --pin        re-pin the baseline
//   node tests/scripts/knowledge-eval.cjs --case <id>  one case's ranking against its judgments
//   node tests/scripts/knowledge-eval.cjs --pool       unjudged top-10 results, for adjudication
//
// `--project <name>` restricts any of them to one project; `--vector` runs
// the hybrid leg with this machine's embedding provider, outside the gate.

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const knowledge = require('../../src/knowledge/index');
const engine = require('../../skills/workflow-engine/scripts/engine.cjs');

const REPO = path.resolve(__dirname, '..', '..');
const EVAL_DIR = path.join(REPO, 'tests', 'fixtures', 'knowledge-eval');
const CACHE_DIR = path.join(REPO, 'tests', '.cache', 'knowledge-eval');
const KNOWLEDGE_SRC = path.join(REPO, 'src', 'knowledge');
const CHUNKING_DIR = path.join(REPO, 'skills', 'workflow-knowledge', 'chunking');
const PROJECTS = ['portal', 'tick', 'fumi'];

const ORIGINS = ['harvested', 'written', 'negative'];
const GRADES = ['primary', 'supporting'];
const FILTER_FLAGS = ['work-unit', 'work-type', 'phase', 'topic'];
const OPTION_KEYS = new Set(['boosts', 'limit', ...FILTER_FLAGS]);
const PINNED_CASE_FIELDS = ['first', 'first_primary', 'primary_found', 'results', 'bytes'];

const execFileAsync = promisify(execFile);

/**
 * @typedef {object} Judgment
 * @property {string} source  project-relative path of the judged file
 * @property {string} anchor  a verbatim phrase from the judged passage
 * @property {'primary'|'supporting'} grade
 * @property {number} framing  the index of the term the passage answers
 */

/**
 * @typedef {object} EvalCase
 * @property {string} id
 * @property {string} project  the case file it is in
 * @property {'harvested'|'written'|'negative'} origin
 * @property {string} need
 * @property {string[]} terms
 * @property {Record<string, any>} [options]  the CLI's flag names: boosts, filters, limit
 * @property {Judgment[]} relevant
 */

/**
 * @typedef {object} CaseRun
 * @property {EvalCase} evalCase
 * @property {Array<Record<string, any>>} results  ranked, as the CLI would print them
 * @property {number} bytes  the rendered output's size
 */

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

/** @param {string} file */
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** @param {string} file @param {any} value */
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

/** @param {string} project */
function fixtureRoot(project) {
  return path.join(EVAL_DIR, project);
}

/**
 * Every case of the named projects, tagged with its project.
 * @param {string[]} [projects]
 * @returns {EvalCase[]}
 */
function loadCases(projects = PROJECTS) {
  return projects.flatMap((project) =>
    readJson(path.join(EVAL_DIR, 'cases', `${project}.json`)).map((c) => ({ ...c, project })));
}

/**
 * Refuse cases that do not validate — a run over a broken judgment measures nothing.
 * @param {EvalCase[]} cases
 */
function assertValid(cases) {
  const problems = validateCases(cases);
  if (problems.length > 0) throw new Error(`the cases do not validate:\n  ${problems.join('\n  ')}`);
}

/**
 * What is wrong with the cases — one line per problem, none when they are sound.
 * @param {EvalCase[]} cases
 * @returns {string[]}
 */
function validateCases(cases) {
  const read = fixtureReader();
  const seen = new Set();
  const problems = [];
  for (const c of cases) {
    if (seen.has(c.id)) problems.push(`${c.id}: the id is not unique`);
    seen.add(c.id);
    const own = [
      ...(ORIGINS.includes(c.origin) ? [] : [`origin must be one of ${ORIGINS.join(', ')}`]),
      ...termProblems(c.terms),
      ...optionProblems(c.options || {}),
      ...judgmentProblems(c, read),
    ];
    problems.push(...own.map((problem) => `${c.id}: ${problem}`));
  }
  return problems;
}

/** A fixture file's text, read once — null when the project has no such file. */
function fixtureReader() {
  /** @type {Map<string, string|null>} */
  const texts = new Map();
  return (/** @type {string} */ project, /** @type {unknown} */ source) => {
    if (typeof source !== 'string') return null;
    const file = path.join(fixtureRoot(project), source);
    if (!texts.has(file)) {
      const isFile = fs.statSync(file, { throwIfNoEntry: false })?.isFile();
      texts.set(file, isFile ? fs.readFileSync(file, 'utf8') : null);
    }
    return texts.get(file) ?? null;
  };
}

/** @param {unknown} terms */
function termProblems(terms) {
  const sound = Array.isArray(terms) && terms.length > 0 && terms.every((t) => typeof t === 'string' && t.trim() !== '');
  return sound ? [] : ['terms must be a non-empty list of non-empty strings'];
}

/** @param {Record<string, any>} options */
function optionProblems(options) {
  const problems = Object.keys(options).filter((key) => !OPTION_KEYS.has(key)).map((key) => `unknown option "${key}"`);
  for (const flag of FILTER_FLAGS.filter((f) => f in options)) {
    if (typeof options[flag] !== 'string' || options[flag] === '') problems.push(`${flag} must be a non-empty string`);
  }
  if ('limit' in options && !(Number.isInteger(options.limit) && options.limit > 0)) {
    problems.push('limit must be a positive integer');
  }
  if (!Array.isArray(options.boosts || [])) return [...problems, 'boosts must be a list'];
  return [...problems, ...(options.boosts || []).map(knowledge.boostProblem).filter(Boolean)];
}

/**
 * @param {EvalCase} c
 * @param {(project: string, source: unknown) => string|null} read
 */
function judgmentProblems(c, read) {
  if (!Array.isArray(c.relevant)) return ['relevant must be a list'];
  if (c.origin === 'negative') return c.relevant.length === 0 ? [] : ['a negative case judges nothing relevant'];
  const framings = Array.isArray(c.terms) ? c.terms.length : 0;
  const problems = c.relevant.flatMap((j, i) => {
    const own = [];
    if (!GRADES.includes(j.grade)) own.push(`grade must be one of ${GRADES.join(', ')}`);
    if (!(Number.isInteger(j.framing) && j.framing >= 0 && j.framing < framings)) own.push('framing must index a term');
    const text = read(c.project, j.source);
    if (text === null) own.push(`${j.source} is not in the ${c.project} fixture`);
    else if (typeof j.anchor !== 'string' || j.anchor === '' || !text.includes(j.anchor)) {
      own.push(`the anchor is not in ${j.source}`);
    }
    return own.map((problem) => `relevant[${i}]: ${problem}`);
  });
  if (!c.relevant.some((j) => j.grade === 'primary')) problems.push('no primary judgment');
  return problems;
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

/** @param {string} root */
function knowledgeDir(root) {
  return path.join(root, '.workflows', '.knowledge');
}

/**
 * A project's config as the CLI resolves it there — its project config over
 * the system config, the key from the environment or the credentials file.
 * @param {string} root
 */
function resolvedConfig(root) {
  const cfg = knowledge.config.loadConfig({ projectPath: path.join(knowledgeDir(root), 'config.json') });
  return { cfg, provider: knowledge.config.resolveProvider(cfg) };
}

/**
 * A copy of the project's fixture in a fresh directory under `parent`.
 * @param {string} project @param {string} parent @param {string} prefix
 */
function copyFixture(project, parent, prefix) {
  const root = fs.mkdtempSync(path.join(parent, prefix));
  fs.cpSync(path.join(fixtureRoot(project), '.workflows'), path.join(root, '.workflows'), { recursive: true });
  return root;
}

/**
 * The real bulk index, through the source CLI, in the project — so a change
 * to chunking or indexing reaches the measurement. A file that fails to index
 * fails the build.
 * @param {string} root
 */
async function bulkIndex(root) {
  try {
    await execFileAsync(process.execPath, [path.join(KNOWLEDGE_SRC, 'index.js'), 'index'], {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    throw new Error(`the bulk index failed in ${root}:\n${err.stderr || err.message}`);
  }
}

/**
 * The keyword leg: each project indexed keyword-only into a temp copy,
 * removed when the leg closes.
 */
function openKeywordLeg() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-eval-'));
  return {
    /** @param {string} project */
    async project(project) {
      const root = copyFixture(project, scratch, `${project}-`);
      writeJson(path.join(knowledgeDir(root), 'config.json'), { knowledge: { provider: null } });
      await bulkIndex(root);
      return { root, ...resolvedConfig(root) };
    },
    close: () => fs.rmSync(scratch, { recursive: true, force: true }),
  };
}

/**
 * The vector leg: each project embedded with this machine's provider into a
 * cached store, and every query term's embedding cached beside it — a rerun
 * over an unchanged corpus and source embeds only terms it has not seen.
 */
function openVectorLeg() {
  /** @type {Map<string, Record<string, number[]>>} */
  const termCaches = new Map();
  return {
    /** @param {string} project */
    async project(project) {
      // A fixture carries no project config, so this is the system config
      // alone — what `knowledge setup --from-system` resolves.
      const { cfg, provider } = resolvedConfig(fixtureRoot(project));
      assertProvider(cfg, provider);
      const root = path.join(CACHE_DIR, 'stores', `${project}-${storeKey(project, cfg, provider)}`);
      if (!fs.existsSync(path.join(knowledgeDir(root), 'store.msp'))) await buildCachedStore(project, root);
      return { root, cfg, provider: cachedTermEmbeddings(cfg, provider, termCaches) };
    },
    close() {},
  };
}

/** @param {Record<string, any>} cfg @param {any} provider */
function assertProvider(cfg, provider) {
  if (!cfg.provider) {
    throw new Error(`the vector leg embeds with this machine's provider, and ${knowledge.config.systemConfigPath()} names none`);
  }
  if (!provider) {
    const envVar = knowledge.config.PROVIDER_ENV_VARS[cfg.provider];
    throw new Error(`the ${cfg.provider} API key could not be resolved — export ${envVar}, or run \`knowledge setup --key-only\``);
  }
}

/** @param {Record<string, any>} cfg @param {any} provider */
function providerIdentity(cfg, provider) {
  return JSON.stringify([cfg.provider, provider.model(), provider.dimensions()]);
}

/** @param {string} dir @param {(name: string) => boolean} keep */
function filesUnder(dir, keep = () => true) {
  return fs.readdirSync(dir, { recursive: true })
    .map((name) => path.join(dir, String(name)))
    .filter((file) => fs.statSync(file).isFile() && keep(file))
    .sort();
}

/**
 * The cache key of a project's embedded store: everything that decides it —
 * the fixture, the knowledge source, the chunking configs, the provider.
 * @param {string} project @param {Record<string, any>} cfg @param {any} provider
 */
function storeKey(project, cfg, provider) {
  const hash = crypto.createHash('sha256').update(providerIdentity(cfg, provider));
  const files = [
    ...filesUnder(fixtureRoot(project)),
    ...filesUnder(KNOWLEDGE_SRC, (f) => f.endsWith('.js')),
    ...filesUnder(CHUNKING_DIR, (f) => f.endsWith('.json')),
  ];
  for (const file of files) {
    hash.update(path.relative(REPO, file)).update('\0').update(fs.readFileSync(file)).update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}

/**
 * Embed the project into `root`, replacing any store cached under an older key.
 * @param {string} project @param {string} root
 */
async function buildCachedStore(project, root) {
  const parent = path.dirname(root);
  fs.mkdirSync(parent, { recursive: true });
  const staging = copyFixture(project, parent, `.staging-${project}-`);
  try {
    await bulkIndex(staging);
  } catch (err) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw err;
  }
  for (const stale of fs.readdirSync(parent).filter((name) => name.startsWith(`${project}-`))) {
    fs.rmSync(path.join(parent, stale), { recursive: true, force: true });
  }
  fs.renameSync(staging, root);
}

/**
 * The provider, its query-term embeddings cached on disk by model and text.
 * @param {Record<string, any>} cfg @param {any} provider
 * @param {Map<string, Record<string, number[]>>} caches  shared by the run's projects
 */
function cachedTermEmbeddings(cfg, provider, caches) {
  const name = crypto.createHash('sha256').update(providerIdentity(cfg, provider)).digest('hex').slice(0, 16);
  const file = path.join(CACHE_DIR, 'terms', `${name}.json`);
  if (!caches.has(file)) caches.set(file, fs.existsSync(file) ? readJson(file) : {});
  const vectors = /** @type {Record<string, number[]>} */ (caches.get(file));
  return {
    model: () => provider.model(),
    dimensions: () => provider.dimensions(),
    /** @param {string} text */
    async embed(text) {
      if (!Object.hasOwn(vectors, text)) {
        vectors[text] = await provider.embed(text);
        writeJson(file, vectors);
      }
      return vectors[text];
    },
  };
}

/**
 * Every work unit's manifest, read through the engine's in-process entry.
 * @param {string} root
 */
function workUnitsOf(root) {
  const { stdout, stderr, code } = engine.run(['manifest', 'list'], { cwd: root });
  if (code !== 0) throw new Error(`manifest list failed in ${root}: ${stderr}`);
  return JSON.parse(stdout);
}

/**
 * A built project, loaded for querying as the CLI loads it.
 * @param {{root: string, cfg: Record<string, any>, provider: any}} built
 */
async function openStore({ root, cfg, provider }) {
  const metadata = knowledge.store.readMetadata(path.join(knowledgeDir(root), 'metadata.json'));
  return {
    db: await knowledge.store.loadStore(path.join(knowledgeDir(root), 'store.msp')),
    settings: knowledge.querySettings(metadata, cfg, provider),
    workUnits: workUnitsOf(root),
  };
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

const LEGS = {
  keyword: { open: openKeywordLeg, baseline: 'baseline.json' },
  vector: { open: openVectorLeg, baseline: 'baseline-vector.json' },
};

/**
 * One case, called exactly as the CLI would call it with the case's options.
 * @param {Awaited<ReturnType<typeof openStore>>} opened @param {EvalCase} evalCase
 * @returns {Promise<CaseRun>}
 */
async function runCase(opened, evalCase) {
  const { boosts = [], ...flags } = evalCase.options || {};
  const options = knowledge.buildOptions(flags, boosts);
  const results = await knowledge.queryStore(opened.db, {
    ...opened.settings,
    terms: evalCase.terms,
    filters: options,
    boosts: knowledge.normaliseBoosts(options.boosts),
    limit: options.limit,
    workUnits: opened.workUnits,
  });
  return { evalCase, results, bytes: Buffer.byteLength(knowledge.renderQuery(results, opened.settings.mode)) };
}

/**
 * Every case on the leg, its projects built concurrently.
 * @param {EvalCase[]} cases @param {'keyword'|'vector'} leg
 * @returns {Promise<CaseRun[]>}
 */
async function runCases(cases, leg) {
  assertValid(cases);
  const opened = LEGS[leg].open();
  try {
    const projects = [...new Set(cases.map((c) => c.project))];
    const settled = await Promise.allSettled(projects.map(async (project) => {
      const store = await openStore(await opened.project(project));
      const runs = [];
      for (const evalCase of cases.filter((c) => c.project === project)) runs.push(await runCase(store, evalCase));
      return runs;
    }));
    const failed = settled.find((outcome) => outcome.status === 'rejected');
    if (failed) throw failed.reason;
    return settled.flatMap((outcome) => outcome.value);
  } finally {
    opened.close();
  }
}

// ---------------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------------

/**
 * A result matches a judgment when it comes from the judged file and
 * carries the anchor — so judgments survive any change to chunk boundaries.
 * @param {Record<string, any>} result @param {Judgment} judgment
 */
function matches(result, judgment) {
  return result.source_file === judgment.source && result.content.includes(judgment.anchor);
}

/** @param {Array<Record<string, any>>} results @param {(r: Record<string, any>) => boolean} test */
function rankOf(results, test) {
  const index = results.findIndex(test);
  return index === -1 ? null : index + 1;
}

/** @param {CaseRun} run */
function measureCase({ evalCase, results, bytes }) {
  const judged = evalCase.relevant;
  const primaries = judged.filter((j) => j.grade === 'primary');
  const sources = new Set(judged.map((j) => j.source));
  const topTen = results.slice(0, 10);
  return {
    id: evalCase.id,
    project: evalCase.project,
    negative: evalCase.origin === 'negative',
    first: rankOf(results, (r) => judged.some((j) => matches(r, j))),
    first_primary: rankOf(results, (r) => primaries.some((j) => matches(r, j))),
    primary_found: primaries.filter((j) => topTen.some((r) => matches(r, j))).length,
    primary_total: primaries.length,
    file_hit: results.slice(0, 5).some((r) => sources.has(r.source_file)),
    results: results.length,
    bytes,
  };
}

/** @typedef {ReturnType<typeof measureCase>} Measured */

/**
 * @template T
 * @param {T[]} items @param {(item: T) => number} value
 */
function mean(items, value) {
  if (items.length === 0) return null;
  return Math.round((items.reduce((sum, item) => sum + value(item), 0) / items.length) * 1e4) / 1e4;
}

/** @param {number|null} rank @param {number} depth */
function within(rank, depth) {
  return rank !== null && rank <= depth;
}

/** @param {Measured[]} measured */
function metricsOf(measured) {
  const positive = measured.filter((m) => !m.negative);
  const negative = measured.filter((m) => m.negative);
  return {
    'hit@5': mean(positive, (m) => Number(within(m.first, 5))),
    'primary_hit@5': mean(positive, (m) => Number(within(m.first_primary, 5))),
    'mrr@10': mean(positive, (m) => (within(m.first, 10) ? 1 / m.first : 0)),
    'recall@10': mean(positive, (m) => m.primary_found / m.primary_total),
    'file_hit@5': mean(positive, (m) => Number(m.file_hit)),
    bytes: mean(measured, (m) => m.bytes),
    negative_results: mean(negative, (m) => m.results),
    negative_bytes: mean(negative, (m) => m.bytes),
  };
}

/**
 * The run in the baseline's shape: metrics per project — and overall, when
 * every project ran — and each case's pinned values.
 * @param {Measured[]} measured @param {boolean} complete
 */
function summarise(measured, complete) {
  /** @type {Record<string, ReturnType<typeof metricsOf>>} */
  const metrics = complete ? { overall: metricsOf(measured) } : {};
  for (const project of new Set(measured.map((m) => m.project))) {
    metrics[project] = metricsOf(measured.filter((m) => m.project === project));
  }
  const cases = Object.fromEntries(measured.map((m) =>
    [m.id, Object.fromEntries(PINNED_CASE_FIELDS.map((field) => [field, m[field]]))]));
  return { metrics, cases };
}

/** @typedef {ReturnType<typeof summarise>} Summary */

// ---------------------------------------------------------------------------
// The baseline
// ---------------------------------------------------------------------------

/** @param {'keyword'|'vector'} leg */
function baselineFile(leg) {
  return path.join(EVAL_DIR, LEGS[leg].baseline);
}

/**
 * @param {'keyword'|'vector'} leg
 * @returns {Summary}
 */
function readBaseline(leg) {
  const file = baselineFile(leg);
  return fs.existsSync(file) ? readJson(file) : { metrics: {}, cases: {} };
}

/**
 * The baseline as pinned — one line per case, so a re-pin's diff reads case by case.
 * @param {Summary} summary
 */
function formatBaseline({ metrics, cases }) {
  const caseLines = Object.entries(cases).map(([id, values]) => `    ${JSON.stringify(id)}: ${JSON.stringify(values)}`);
  return `{\n  "metrics": ${JSON.stringify(metrics, null, 2).replace(/\n/g, '\n  ')},\n`
    + `  "cases": {\n${caseLines.join(',\n')}\n  }\n}\n`;
}

/** @param {unknown} value */
function shown(value) {
  return value === undefined ? 'unpinned' : String(value);
}

/** @param {Record<string, any>} a @param {Record<string, any>} b */
function keysOf(a, b) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])];
}

/**
 * What moved between the pinned baseline and a run, a line per metric and
 * per case — none when nothing did. A partial run answers for its own
 * projects and cases alone.
 * @param {Summary} pinned @param {Summary} run @param {boolean} complete
 * @returns {string[]}
 */
function baselineMoves(pinned, run, complete) {
  const moves = [];
  const groups = complete ? keysOf(pinned.metrics, run.metrics) : Object.keys(run.metrics);
  for (const group of groups) {
    const was = pinned.metrics[group] || {};
    const now = run.metrics[group] || {};
    for (const name of keysOf(was, now)) {
      if (was[name] !== now[name]) moves.push(`${group} ${name}: ${shown(was[name])} → ${shown(now[name])}`);
    }
  }
  for (const id of complete ? keysOf(pinned.cases, run.cases) : Object.keys(run.cases)) {
    const moved = caseMove(pinned.cases[id], run.cases[id]);
    if (moved) moves.push(`case ${id}: ${moved}`);
  }
  return moves;
}

/** @param {Record<string, any>|undefined} was @param {Record<string, any>|undefined} now */
function caseMove(was, now) {
  if (!was) return 'not pinned';
  if (!now) return 'pinned, no longer run';
  return PINNED_CASE_FIELDS.filter((field) => was[field] !== now[field])
    .map((field) => `${field} ${shown(was[field])} → ${shown(now[field])}`)
    .join(', ');
}

/** @param {string[]} moves @param {'keyword'|'vector'} leg */
function movesMessage(moves, leg) {
  const pin = `node tests/scripts/knowledge-eval.cjs --pin${leg === 'vector' ? ' --vector' : ''}`;
  return [
    `Retrieval moved from ${path.relative(REPO, baselineFile(leg))}:`,
    ...moves.map((move) => `  ${move}`),
    `If the move is intended, re-pin in the PR that moves it: ${pin}`,
  ].join('\n');
}

/**
 * Run and measure the cases on a leg, against its pinned baseline.
 * @param {{cases?: EvalCase[], leg?: 'keyword'|'vector', complete?: boolean}} [options]
 */
async function evaluate({ cases = loadCases(), leg = 'keyword', complete = true } = {}) {
  const measured = (await runCases(cases, leg)).map(measureCase);
  const summary = summarise(measured, complete);
  return { measured, summary, moves: baselineMoves(readBaseline(leg), summary, complete) };
}

// ---------------------------------------------------------------------------
// By hand
// ---------------------------------------------------------------------------

const USAGE = 'Usage: node tests/scripts/knowledge-eval.cjs [--project <name>] [--vector] '
  + '[--pin | --case <id> | --pool [--out <file>]]';

/** @param {string[]} argv */
function parseFlags(argv) {
  const flags = { project: null, vector: false, pin: false, case: null, pool: false, out: null };
  const valued = { '--project': 'project', '--case': 'case', '--out': 'out' };
  const switches = { '--vector': 'vector', '--pin': 'pin', '--pool': 'pool' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (switches[arg]) flags[switches[arg]] = true;
    else if (valued[arg] && argv[i + 1] !== undefined) flags[valued[arg]] = argv[++i];
    else throw new Error(`unexpected argument "${arg}"`);
  }
  if (flags.project !== null && !PROJECTS.includes(flags.project)) {
    throw new Error(`no project "${flags.project}" — one of ${PROJECTS.join(', ')}`);
  }
  if ([flags.pin, flags.case !== null, flags.pool].filter(Boolean).length > 1) {
    throw new Error('--pin, --case and --pool are separate runs');
  }
  if (flags.pin && flags.project !== null) throw new Error('--pin pins every project');
  if (flags.out !== null && !flags.pool) throw new Error('--out names the --pool file');
  return flags;
}

/** @param {string[][]} rows  a header row, then the body */
function table(rows) {
  const widths = rows[0].map((_, col) => Math.max(...rows.map((row) => row[col].length)));
  return rows.map((row) => row.map((cell, col) => cell.padEnd(widths[col])).join('  ').trimEnd()).join('\n');
}

/** @param {Summary} summary */
function metricTable({ metrics }) {
  const groups = Object.keys(metrics);
  const names = Object.keys(Object.values(metrics)[0] || {});
  return table([
    ['metric', ...groups],
    ...names.map((name) => [name, ...groups.map((group) => String(metrics[group][name] ?? '—'))]),
  ]);
}

/** @param {Measured[]} measured */
function caseTable(measured) {
  return table([
    ['case', 'first', 'first_primary', 'primary', 'results', 'bytes'],
    ...measured.map((m) => [
      m.id,
      String(m.first ?? '—'),
      String(m.first_primary ?? '—'),
      `${m.primary_found}/${m.primary_total}`,
      String(m.results),
      String(m.bytes),
    ]),
  ]);
}

/** The chunk's first heading, else its first line. @param {string} content */
function chunkTitle(content) {
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => line.startsWith('#')) || lines[0] || '';
}

/** One case's ranking against its judgments. @param {CaseRun} run */
function describeRun({ evalCase, results }) {
  const lines = [
    `${evalCase.id} (${evalCase.project}, ${evalCase.origin})`,
    `need: ${evalCase.need}`,
    `terms: ${evalCase.terms.map((t) => JSON.stringify(t)).join(' ')}`,
    `options: ${JSON.stringify(evalCase.options || {})}`,
    '',
  ];
  results.forEach((r, i) => {
    const hits = evalCase.relevant.filter((j) => matches(r, j));
    lines.push(`${String(i + 1).padStart(2)}  ${r.source_file}`, `    ${chunkTitle(r.content)}`);
    lines.push(...(hits.length ? hits.map((j) => `    ${j.grade}: ${JSON.stringify(j.anchor)}`) : ['    unjudged']));
  });
  const missed = evalCase.relevant.filter((j) => !results.some((r) => matches(r, j)));
  if (missed.length > 0) {
    lines.push('', 'Never found:', ...missed.map((j) => `  ${j.grade}  ${j.source}  ${JSON.stringify(j.anchor)}`));
  }
  return lines.join('\n');
}

/**
 * Every case's top-10 results that match no judgment, in full, for an
 * adjudicator to read.
 * @param {CaseRun[]} runs
 */
function poolOf(runs) {
  return runs.map(({ evalCase, results }) => ({
    id: evalCase.id,
    project: evalCase.project,
    need: evalCase.need,
    terms: evalCase.terms,
    unjudged: results.slice(0, 10).flatMap((r, i) => (evalCase.relevant.some((j) => matches(r, j))
      ? []
      : [{ rank: i + 1, source: r.source_file, content: r.content }])),
  }));
}

/** @param {ReturnType<typeof parseFlags>} flags */
async function main(flags) {
  const leg = flags.vector ? 'vector' : 'keyword';
  const all = loadCases();
  assertValid(all);
  const cases = all
    .filter((c) => flags.project === null || c.project === flags.project)
    .filter((c) => flags.case === null || c.id === flags.case);
  if (cases.length === 0) throw new Error(flags.case !== null ? `no case "${flags.case}"` : 'no cases to run');

  if (flags.case !== null) {
    process.stdout.write(`${describeRun((await runCases(cases, leg))[0])}\n`);
    return;
  }
  if (flags.pool) {
    const out = flags.out || path.join(os.tmpdir(), `knowledge-eval-pool-${leg}.json`);
    writeJson(out, poolOf(await runCases(cases, leg)));
    process.stdout.write(`${out}\n`);
    return;
  }

  const { measured, summary, moves } = await evaluate({ cases, leg, complete: flags.project === null });
  process.stdout.write(`${metricTable(summary)}\n\n${caseTable(measured)}\n\n`);
  if (flags.pin) {
    fs.writeFileSync(baselineFile(leg), formatBaseline(summary));
    process.stdout.write(`Pinned ${path.relative(REPO, baselineFile(leg))}.\n`);
  } else if (moves.length > 0) {
    process.stdout.write(`${movesMessage(moves, leg)}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Matches ${path.relative(REPO, baselineFile(leg))}.\n`);
  }
}

module.exports = {
  loadCases,
  validateCases,
  evaluate,
  baselineMoves,
  movesMessage,
};

if (require.main === module) {
  let flags;
  try {
    flags = parseFlags(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n${USAGE}\n`);
    process.exit(1);
  }
  // The keyword leg runs hermetic, as the gate does: a system config's tuning
  // keys would move its ranking. The vector leg needs this machine's provider.
  if (!flags.vector) require('./hermetic-env.cjs');
  main(flags).catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}

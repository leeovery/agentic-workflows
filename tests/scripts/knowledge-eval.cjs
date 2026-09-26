'use strict';

// The knowledge base's eval harness: judged queries over a frozen snapshot of
// three real projects, measuring how often retrieval returns the passage an
// agent needed, how high, and at what cost in output. Each project's fixture
// is copied and indexed through the source CLI's bulk index; every case runs
// in process through the query function the CLI itself calls, and the
// measurements compare exactly with a pinned baseline.
//
// The gate (test-knowledge-eval.cjs) runs the keyword mode. By hand:
//
//   node tests/scripts/knowledge-eval.cjs              metrics, cases, baseline check
//   node tests/scripts/knowledge-eval.cjs --pin        re-pin the baseline
//   node tests/scripts/knowledge-eval.cjs --case <id>  one case's ranking against its judgments
//   node tests/scripts/knowledge-eval.cjs --pool       unjudged top-10 results, for adjudication
//
// `--project <name>` restricts any run to one project, except `--pin`, which
// pins every project and refuses it. `--hybrid` runs the hybrid mode instead —
// embedded with this machine's provider at default tuning, against
// baseline-hybrid.json — outside the gate.

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
const PROJECTS = ['portal', 'tick', 'fumi'];

const CASE_KEYS = new Set(['id', 'project', 'origin', 'asked', 'from', 'need', 'terms', 'options', 'relevant']);
const ORIGINS = ['harvested', 'written', 'negative'];
const GRADES = ['primary', 'supporting'];
/** Each hard-filter flag, and the chunk field it filters on. */
const FILTERS = { 'work-unit': 'work_unit', 'work-type': 'work_type', phase: 'phase', topic: 'topic' };
const FILTER_FLAGS = Object.keys(FILTERS);
/** The filters and boosts whose values name something a fixture's files carry. */
const NAMING_FLAGS = ['work-unit', 'phase', 'topic'];
const OPTION_KEYS = new Set(['boosts', 'limit', ...FILTER_FLAGS]);
const PINNED_CASE_FIELDS = ['first', 'first_primary', 'primary_found', 'primary_total', 'results', 'bytes'];

const PROVIDER_IDENTITY_KEYS = ['provider', 'model', 'dimensions', 'base_url'];
const TUNING_UNSET = Object.fromEntries(Object.keys(knowledge.config.DEFAULTS).map((key) => [key, null]));
const CHUNK_KEY_FIELDS = ['id', 'work_unit', 'work_type', 'phase', 'topic', 'confidence', 'source_file', 'source_hash', 'content'];
const STORE_LIBRARIES = ['@orama/orama', '@msgpack/msgpack'];

const execFileAsync = promisify(execFile);

/**
 * @typedef {object} Judgment
 * @property {string} source  project-relative path of the judged file
 * @property {string} anchor  a verbatim phrase from the judged passage, once in its file
 * @property {'primary'|'supporting'} grade
 * @property {number} framing  the index of the term the passage answers
 */

/**
 * @typedef {object} EvalCase
 * @property {string} id
 * @property {string} project  the case file it is in
 * @property {'harvested'|'written'|'negative'} origin
 * @property {string} [asked]  the day the query was asked, YYYY-MM-DD
 * @property {string} [from]  a negative's source — the project its query was asked in
 * @property {string} need
 * @property {string[]} terms
 * @property {Record<string, any>} [options]  the CLI's flag names: boosts, filters, limit
 * @property {Judgment[]} relevant
 */

/**
 * @typedef {object} FileIdentity  the identity the index gives a file's chunks
 * @property {string} work_unit
 * @property {string} work_type
 * @property {string} phase
 * @property {string} topic
 */

/**
 * @typedef {object} ProviderIdentity  what decides the vectors a provider makes
 * @property {string} provider
 * @property {string} model
 * @property {number} dimensions
 * @property {string|null} base_url
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

/** @param {string} dir @param {(file: string) => boolean} keep */
function filesUnder(dir, keep = () => true) {
  return fs.readdirSync(dir, { recursive: true })
    .map((name) => path.join(dir, String(name)))
    .filter((file) => fs.statSync(file).isFile() && keep(file))
    .sort();
}

/** A filter's values — one, or a comma list — as the query splits them. @param {string} value */
function filterValues(value) {
  return value.split(',').map((part) => part.trim());
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
  const fixture = fixtureReader();
  const seen = new Set();
  const problems = [];
  for (const c of cases) {
    if (seen.has(c.id)) problems.push(`${c.id}: the id is not unique`);
    seen.add(c.id);
    const own = [
      ...shapeProblems(c),
      ...termProblems(c.terms),
      ...optionProblems(c, fixture),
      ...judgmentProblems(c, fixture),
    ];
    problems.push(...own.map((problem) => `${c.id}: ${problem}`));
  }
  return problems;
}

/**
 * The fixtures as validation reads them, each read once: the identity of
 * every file the index would chunk, and a file's text.
 */
function fixtureReader() {
  /** @type {Map<string, Map<string, FileIdentity>>} */
  const files = new Map();
  /** @type {Map<string, string>} */
  const texts = new Map();
  /** @param {string} project */
  const filesOf = (project) => {
    if (!files.has(project)) files.set(project, indexableFiles(project));
    return /** @type {Map<string, FileIdentity>} */ (files.get(project));
  };
  return {
    /** @param {string} project @param {unknown} source @returns {FileIdentity|null} */
    identity: (project, source) => (typeof source === 'string' && filesOf(project).get(source)) || null,
    /** @param {string} project */
    identities: (project) => [...filesOf(project).values()],
    /** @param {string} project @param {string} source */
    text(project, source) {
      const file = path.join(fixtureRoot(project), source);
      if (!texts.has(file)) texts.set(file, fs.readFileSync(file, 'utf8'));
      return /** @type {string} */ (texts.get(file));
    },
  };
}

/** @typedef {ReturnType<typeof fixtureReader>} FixtureReader */

/**
 * Each markdown file of the project's fixture, by project-relative path,
 * with the identity the index derives for it.
 * @param {string} project
 * @returns {Map<string, FileIdentity>}
 */
function indexableFiles(project) {
  const root = fixtureRoot(project);
  /** @param {string} unit */
  const workType = (unit) => readJson(path.join(root, '.workflows', unit, 'manifest.json')).work_type;
  return new Map(filesUnder(root, (file) => file.endsWith('.md')).map((file) => {
    const source = path.relative(root, file);
    const { workUnit, phase, topic } = knowledge.deriveIdentity(source);
    return [source, { work_unit: workUnit, work_type: workType(workUnit), phase, topic }];
  }));
}

/** @param {unknown} value */
function isDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
}

/** @param {EvalCase} c */
function shapeProblems(c) {
  const fromElsewhere = PROJECTS.includes(c.from) && c.from !== c.project;
  return [
    ...Object.keys(c).filter((key) => !CASE_KEYS.has(key)).map((key) => `unknown key "${key}"`),
    ...(ORIGINS.includes(c.origin) ? [] : [`origin must be one of ${ORIGINS.join(', ')}`]),
    ...('asked' in c && !isDay(c.asked) ? ['asked must be a YYYY-MM-DD date'] : []),
    ...(c.origin === 'negative' && !fromElsewhere ? ['from must name another project'] : []),
  ];
}

/** @param {unknown} terms */
function termProblems(terms) {
  const sound = Array.isArray(terms) && terms.length > 0 && terms.every((t) => typeof t === 'string' && t.trim() !== '');
  return sound ? [] : ['terms must be a non-empty list of non-empty strings'];
}

/** Whether an option's value is one a query applies — a non-empty string. @param {unknown} value */
function isSet(value) {
  return typeof value === 'string' && value !== '';
}

/** @param {EvalCase} c @param {FixtureReader} fixture */
function optionProblems(c, fixture) {
  const options = c.options || {};
  const filters = FILTER_FLAGS.filter((flag) => flag in options);
  const problems = [
    ...Object.keys(options).filter((key) => !OPTION_KEYS.has(key)).map((key) => `unknown option "${key}"`),
    ...filters.filter((flag) => !isSet(options[flag])).map((flag) => `${flag} must be a non-empty string`),
    ...('limit' in options && !(Number.isInteger(options.limit) && options.limit > 0) ? ['limit must be a positive integer'] : []),
    ...(c.origin === 'negative' && filters.length > 0 ? ['a negative case carries no hard filter'] : []),
  ];
  const boosts = options.boosts || [];
  if (!Array.isArray(boosts)) return [...problems, 'boosts must be a list'];
  return [...problems, ...boosts.map(knowledge.boostProblem).filter(Boolean), ...namingProblems(c.project, options, fixture)];
}

/**
 * The filter and boost values naming a work unit, phase or topic that no
 * file of the project's fixture carries.
 * @param {string} project @param {Record<string, any>} options @param {FixtureReader} fixture
 */
function namingProblems(project, options, fixture) {
  const filtered = NAMING_FLAGS.filter((flag) => isSet(options[flag]))
    .flatMap((flag) => filterValues(options[flag]).map((value) => ({ flag, value })));
  const boosted = (options.boosts || []).map(({ field, value }) => ({ flag: field, value }))
    .filter(({ flag, value }) => NAMING_FLAGS.includes(flag) && isSet(value));
  const identities = fixture.identities(project);
  return [...filtered, ...boosted]
    .filter(({ flag, value }) => !identities.some((identity) => identity[FILTERS[flag]] === value))
    .map(({ flag, value }) => `no ${flag} "${value}" in the ${project} fixture`);
}

/**
 * Whether a file's chunks pass every hard filter the options carry.
 * @param {Record<string, any>} options @param {FileIdentity} identity
 */
function withinFilters(options, identity) {
  return FILTER_FLAGS.filter((flag) => isSet(options[flag]))
    .every((flag) => filterValues(options[flag]).includes(identity[FILTERS[flag]]));
}

/** @param {string} text @param {string} anchor */
function occurrences(text, anchor) {
  return text.split(anchor).length - 1;
}

/**
 * @param {EvalCase} c
 * @param {FixtureReader} fixture
 */
function judgmentProblems(c, fixture) {
  if (!Array.isArray(c.relevant)) return ['relevant must be a list'];
  if (c.origin === 'negative') return c.relevant.length === 0 ? [] : ['a negative case judges nothing relevant'];
  const framings = Array.isArray(c.terms) ? c.terms.length : 0;
  const judged = new Set();
  const problems = c.relevant.flatMap((j, i) => {
    const passage = JSON.stringify([j.source, j.anchor]);
    const own = [
      ...(GRADES.includes(j.grade) ? [] : [`grade must be one of ${GRADES.join(', ')}`]),
      ...(Number.isInteger(j.framing) && j.framing >= 0 && j.framing < framings ? [] : ['framing must index a term']),
      ...(judged.has(passage) ? ['judges a passage already judged'] : []),
      ...passageProblems(c, j, fixture),
    ];
    judged.add(passage);
    return own.map((problem) => `relevant[${i}]: ${problem}`);
  });
  if (!c.relevant.some((j) => j.grade === 'primary')) problems.push('no primary judgment');
  return problems;
}

/**
 * Whether a judged passage is where it says, exactly once, and — when it is
 * primary — within the case's hard filters.
 * @param {EvalCase} c @param {Judgment} j @param {FixtureReader} fixture
 * @returns {string[]}
 */
function passageProblems(c, j, fixture) {
  const identity = fixture.identity(c.project, j.source);
  if (identity === null) return [`${j.source} is not in the ${c.project} fixture`];
  const count = isSet(j.anchor) ? occurrences(fixture.text(c.project, j.source), j.anchor) : 0;
  if (count === 0) return [`the anchor is not in ${j.source}`];
  if (count > 1) return [`the anchor occurs ${count} times in ${j.source}`];
  if (j.grade === 'primary' && !withinFilters(c.options || {}, identity)) {
    return ['a primary passage outside the hard filters is unreachable'];
  }
  return [];
}

/**
 * The judgments no chunk of the built store matches — unreachable by any
 * ranking, one line each.
 * @param {EvalCase[]} cases  one project's
 * @param {Array<Record<string, any>>} chunks  every chunk of that project's store
 * @returns {string[]}
 */
function unmatchedJudgments(cases, chunks) {
  return cases.flatMap((c) => c.relevant.flatMap((j, i) => (chunks.some((chunk) => matches(chunk, j))
    ? []
    : [`${c.id}: relevant[${i}]: no indexed chunk of ${j.source} carries the anchor`])));
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

/**
 * A project's config as the CLI resolves it there — its project config over
 * the system config, the key from the environment or the credentials file.
 * @param {string} root
 */
function resolvedConfig(root) {
  const cfg = knowledge.config.loadConfig({ projectPath: knowledge.config.projectConfigPath(root) });
  return { cfg, provider: knowledge.config.resolveProvider(cfg) };
}

/**
 * A copy of the project's fixture in a fresh directory under `parent`,
 * configured with `settings` as its project config.
 * @param {string} project @param {string} parent @param {string} prefix
 * @param {Record<string, any>} settings
 */
function stageFixture(project, parent, prefix, settings) {
  const root = fs.mkdtempSync(path.join(parent, prefix));
  fs.cpSync(path.join(fixtureRoot(project), '.workflows'), path.join(root, '.workflows'), { recursive: true });
  writeJson(knowledge.config.projectConfigPath(root), { knowledge: settings });
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
 * A project indexed keyword-only, at default tuning, into a fresh copy under `parent`.
 * @param {string} project @param {string} parent
 */
async function buildKeywordProject(project, parent) {
  const root = stageFixture(project, parent, `${project}-`, { provider: null, ...TUNING_UNSET });
  await bulkIndex(root);
  return { root, ...resolvedConfig(root) };
}

/**
 * The keyword mode: each project indexed keyword-only into the run's scratch directory.
 * @param {string} scratch
 */
function openKeywordMode(scratch) {
  return {
    /** @type {ProviderIdentity|null} */
    identity: null,
    /** @param {string} project */
    project: (project) => buildKeywordProject(project, scratch),
  };
}

/**
 * The hybrid mode: each project embedded with this machine's provider at
 * default tuning into a cached store, and every query term's embedding
 * cached beside it. A rerun over unchanged chunks, store format and provider
 * embeds only the terms it has not seen.
 * @param {string} scratch
 */
function openHybridMode(scratch) {
  const settings = hybridSettings();
  const settingsFile = path.join(scratch, 'hybrid-config.json');
  writeJson(settingsFile, { knowledge: settings });
  const cfg = knowledge.config.loadConfig({ projectPath: settingsFile });
  const provider = knowledge.config.resolveProvider(cfg);
  assertProvider(cfg, provider);
  const identity = providerIdentity(cfg, provider);
  const terms = cachedTermEmbeddings(identity, provider);
  return {
    identity,
    /** @param {string} project */
    async project(project) {
      const keyword = await buildKeywordProject(project, scratch);
      const root = path.join(CACHE_DIR, 'stores', `${project}-${storeKey(await chunksOf(keyword.root), identity)}`);
      if (!fs.existsSync(knowledge.storePath(root))) await buildCachedStore(project, root, settings);
      return { root, cfg, provider: terms };
    },
  };
}

/**
 * The project config every hybrid build and query runs under: the provider
 * identity this machine's config names, and every tuning key unset to its default.
 */
function hybridSettings() {
  const system = knowledge.config.readConfigFile(knowledge.config.systemConfigPath(), { sharedFile: true }) || {};
  return {
    ...Object.fromEntries(PROVIDER_IDENTITY_KEYS.map((key) => [key, system[key] ?? null])),
    ...TUNING_UNSET,
  };
}

/** @param {Record<string, any>} cfg @param {any} provider */
function assertProvider(cfg, provider) {
  if (!cfg.provider) {
    throw new Error(`the hybrid mode embeds with this machine's provider, and ${knowledge.config.systemConfigPath()} names none`);
  }
  if (!provider) throw knowledge.keyUnresolvedError(cfg, 'the hybrid mode cannot embed without it.\n');
}

/**
 * @param {Record<string, any>} cfg @param {any} provider
 * @returns {ProviderIdentity}
 */
function providerIdentity(cfg, provider) {
  return { provider: cfg.provider, model: provider.model(), dimensions: provider.dimensions(), base_url: cfg.base_url ?? null };
}

/** Every chunk a built project's store holds. @param {string} root */
async function chunksOf(root) {
  return knowledge.store.searchAllFulltext(await knowledge.store.loadStore(knowledge.storePath(root)));
}

/** What decides a store's format on disk: the store module, and the pinned libraries it persists through. */
function storeFormat() {
  const pinned = readJson(path.join(REPO, 'package.json')).devDependencies;
  return JSON.stringify([
    fs.readFileSync(path.join(KNOWLEDGE_SRC, 'store.js'), 'utf8'),
    ...STORE_LIBRARIES.map((name) => `${name}@${pinned[name]}`),
  ]);
}

/**
 * The cache key of a project's embedded store: what decides it, and nothing
 * else — the chunks the current code makes of the fixture (less the
 * timestamp each takes from its file's mtime), the store format, and the
 * provider identity.
 * @param {Array<Record<string, any>>} chunks  the project's keyword-only build
 * @param {ProviderIdentity} identity
 */
function storeKey(chunks, identity) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(identity)).update(storeFormat());
  for (const chunk of [...chunks].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    hash.update(JSON.stringify(CHUNK_KEY_FIELDS.map((field) => chunk[field])));
  }
  return hash.digest('hex').slice(0, 16);
}

/**
 * Embed the project into `root`, replacing any store cached under an older key.
 * @param {string} project @param {string} root @param {Record<string, any>} settings
 */
async function buildCachedStore(project, root, settings) {
  const parent = path.dirname(root);
  fs.mkdirSync(parent, { recursive: true });
  const staging = stageFixture(project, parent, `.staging-${project}-`, settings);
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
 * The provider, its query-term embeddings cached on disk by identity and text.
 * @param {ProviderIdentity} identity @param {any} provider
 */
function cachedTermEmbeddings(identity, provider) {
  const name = crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 16);
  const file = path.join(CACHE_DIR, 'terms', `${name}.json`);
  /** @type {Record<string, number[]>} */
  const vectors = fs.existsSync(file) ? readJson(file) : {};
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
  const metadata = knowledge.store.readMetadata(knowledge.metadataPath(root));
  return {
    db: await knowledge.store.loadStore(knowledge.storePath(root)),
    settings: knowledge.querySettings(metadata, cfg, provider),
    workUnits: workUnitsOf(root),
  };
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

const MODES = {
  keyword: { open: openKeywordMode, baseline: 'baseline.json', concurrent: true },
  // One project at a time: each alone stays under a provider's per-minute
  // rate limit, where concurrent first builds together would not.
  hybrid: { open: openHybridMode, baseline: 'baseline-hybrid.json', concurrent: false },
};

/** @typedef {keyof typeof MODES} Mode */

/**
 * One case, called exactly as the CLI calls the query with the case's flags.
 * @param {Awaited<ReturnType<typeof openStore>>} opened @param {EvalCase} evalCase
 * @returns {Promise<CaseRun>}
 */
async function runCase(opened, evalCase) {
  const { boosts = [], ...flags } = evalCase.options || {};
  const results = await knowledge.queryStore(opened.db, opened.settings, {
    terms: evalCase.terms,
    options: knowledge.buildOptions(flags, boosts),
    workUnits: opened.workUnits,
  });
  return { evalCase, results, bytes: Buffer.byteLength(knowledge.renderQuery(results, opened.settings.mode)) };
}

/**
 * A built project's cases, once every judgment is known to match a chunk of its store.
 * @param {{root: string, cfg: Record<string, any>, provider: any}} built @param {EvalCase[]} cases
 * @returns {Promise<CaseRun[]>}
 */
async function runProject(built, cases) {
  const opened = await openStore(built);
  const unmatched = unmatchedJudgments(cases, await knowledge.store.searchAllFulltext(opened.db));
  if (unmatched.length > 0) throw new Error(`judgments no indexed chunk matches:\n  ${unmatched.join('\n  ')}`);
  const runs = [];
  for (const evalCase of cases) runs.push(await runCase(opened, evalCase));
  return runs;
}

/**
 * Each project's outcome, in order — the projects run together, or one after another.
 * @template T
 * @param {string[]} projects @param {(project: string) => Promise<T>} run @param {boolean} concurrent
 * @returns {Promise<PromiseSettledResult<T>[]>}
 */
async function settleEach(projects, run, concurrent) {
  if (concurrent) return Promise.allSettled(projects.map(run));
  const settled = [];
  for (const project of projects) settled.push(...await Promise.allSettled([run(project)]));
  return settled;
}

/**
 * Every case in the mode, and the provider identity it embedded with — null
 * in the keyword mode. Throws naming every project that failed.
 * @param {EvalCase[]} cases @param {Mode} mode
 * @returns {Promise<{runs: CaseRun[], provider: ProviderIdentity|null}>}
 */
async function runCases(cases, mode) {
  assertValid(cases);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-eval-'));
  try {
    const opened = MODES[mode].open(scratch);
    const projects = [...new Set(cases.map((c) => c.project))];
    /** @param {string} project */
    const run = async (project) => runProject(await opened.project(project), cases.filter((c) => c.project === project));
    const settled = await settleEach(projects, run, MODES[mode].concurrent);
    const failures = settled.flatMap((outcome, i) =>
      (outcome.status === 'rejected' ? [`${projects[i]}: ${outcome.reason.message}`] : []));
    if (failures.length > 0) throw new Error(failures.join('\n'));
    const runs = settled.flatMap((outcome) => (outcome.status === 'fulfilled' ? outcome.value : []));
    return { runs, provider: opened.identity };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
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
 * The run in the baseline's shape: the provider identity it embedded with
 * (hybrid mode alone), metrics per project — and overall, when every project
 * ran — and each case's pinned values.
 * @param {Measured[]} measured @param {boolean} complete @param {ProviderIdentity|null} provider
 */
function summarise(measured, complete, provider) {
  /** @type {Record<string, ReturnType<typeof metricsOf>>} */
  const metrics = complete ? { overall: metricsOf(measured) } : {};
  for (const project of new Set(measured.map((m) => m.project))) {
    metrics[project] = metricsOf(measured.filter((m) => m.project === project));
  }
  const cases = Object.fromEntries(measured.map((m) =>
    [m.id, Object.fromEntries(PINNED_CASE_FIELDS.map((field) => [field, m[field]]))]));
  return { ...(provider ? { provider } : {}), metrics, cases };
}

/** @typedef {{provider?: ProviderIdentity, metrics: Record<string, any>, cases: Record<string, any>}} Summary */

// ---------------------------------------------------------------------------
// The baseline
// ---------------------------------------------------------------------------

/** @param {Mode} mode */
function baselineFile(mode) {
  return path.join(EVAL_DIR, MODES[mode].baseline);
}

/**
 * @param {Mode} mode
 * @returns {Summary}
 */
function readBaseline(mode) {
  const file = baselineFile(mode);
  return fs.existsSync(file) ? readJson(file) : { metrics: {}, cases: {} };
}

/**
 * The baseline as pinned — one line per case, so a re-pin's diff reads case by case.
 * @param {Summary} summary
 */
function formatBaseline({ provider, metrics, cases }) {
  const caseLines = Object.entries(cases).map(([id, values]) => `    ${JSON.stringify(id)}: ${JSON.stringify(values)}`);
  return `{\n${provider ? `  "provider": ${JSON.stringify(provider)},\n` : ''}`
    + `  "metrics": ${JSON.stringify(metrics, null, 2).replace(/\n/g, '\n  ')},\n`
    + `  "cases": {\n${caseLines.join(',\n')}\n  }\n}\n`;
}

/** @param {Mode} mode */
function pinCommand(mode) {
  return `node tests/scripts/knowledge-eval.cjs --pin${mode === 'hybrid' ? ' --hybrid' : ''}`;
}

/** @param {unknown} value */
function shown(value) {
  return value === undefined ? 'unpinned' : String(value);
}

/** @param {ProviderIdentity|undefined} identity */
function shownProvider(identity) {
  if (!identity) return 'no provider';
  return Object.entries(identity).filter(([, value]) => value !== null).map(([key, value]) => `${key}=${value}`).join(' ');
}

/** @param {Record<string, any>} a @param {Record<string, any>} b */
function keysOf(a, b) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])];
}

/**
 * What moved between the pinned baseline and a run, a line per metric and
 * per case — none when nothing did. A partial run answers for its own
 * projects and cases alone. Throws when the two embedded with different
 * providers: every measurement would differ, and none of it would be a move.
 * @param {Summary} pinned @param {Summary} run @param {boolean} complete
 * @returns {string[]}
 */
function baselineMoves(pinned, run, complete) {
  if (JSON.stringify(pinned.provider ?? null) !== JSON.stringify(run.provider ?? null)) {
    throw new Error(`the baseline was pinned with ${shownProvider(pinned.provider)}, and this run embeds with `
      + `${shownProvider(run.provider)} — run under the pinned provider, or re-pin under this one: ${pinCommand('hybrid')}`);
  }
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

/** @param {string[]} moves @param {Mode} mode */
function movesMessage(moves, mode) {
  return [
    `Retrieval moved from ${path.relative(REPO, baselineFile(mode))}:`,
    ...moves.map((move) => `  ${move}`),
    `If the move is intended, re-pin in the PR that moves it: ${pinCommand(mode)}`,
  ].join('\n');
}

/**
 * Run and measure the cases in a mode.
 * @param {{cases?: EvalCase[], mode?: Mode, complete?: boolean}} [options]
 */
async function evaluate({ cases = loadCases(), mode = 'keyword', complete = true } = {}) {
  const { runs, provider } = await runCases(cases, mode);
  const measured = runs.map(measureCase);
  return { measured, summary: summarise(measured, complete, provider) };
}

// ---------------------------------------------------------------------------
// By hand
// ---------------------------------------------------------------------------

const USAGE = 'Usage: node tests/scripts/knowledge-eval.cjs [--project <name>] [--hybrid] '
  + '[--pin | --case <id> | --pool [--out <file>]]';

/** @param {string[]} argv */
function parseFlags(argv) {
  const flags = { project: null, hybrid: false, pin: false, case: null, pool: false, out: null };
  const valued = { '--project': 'project', '--case': 'case', '--out': 'out' };
  const switches = { '--hybrid': 'hybrid', '--pin': 'pin', '--pool': 'pool' };
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
  const mode = flags.hybrid ? 'hybrid' : 'keyword';
  const all = loadCases();
  assertValid(all);
  const cases = all
    .filter((c) => flags.project === null || c.project === flags.project)
    .filter((c) => flags.case === null || c.id === flags.case);
  if (cases.length === 0) throw new Error(flags.case !== null ? `no case "${flags.case}"` : 'no cases to run');

  if (flags.case !== null) {
    process.stdout.write(`${describeRun((await runCases(cases, mode)).runs[0])}\n`);
    return;
  }
  if (flags.pool) {
    const out = flags.out || path.join(os.tmpdir(), `knowledge-eval-pool-${mode}.json`);
    writeJson(out, poolOf((await runCases(cases, mode)).runs));
    process.stdout.write(`${out}\n`);
    return;
  }

  const complete = flags.project === null;
  const { measured, summary } = await evaluate({ cases, mode, complete });
  process.stdout.write(`${metricTable(summary)}\n\n${caseTable(measured)}\n\n`);
  if (flags.pin) {
    fs.writeFileSync(baselineFile(mode), formatBaseline(summary));
    process.stdout.write(`Pinned ${path.relative(REPO, baselineFile(mode))}.\n`);
    return;
  }
  const moves = baselineMoves(readBaseline(mode), summary, complete);
  if (moves.length > 0) {
    process.stdout.write(`${movesMessage(moves, mode)}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Matches ${path.relative(REPO, baselineFile(mode))}.\n`);
  }
}

module.exports = {
  loadCases,
  validateCases,
  unmatchedJudgments,
  evaluate,
  readBaseline,
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
  // The keyword mode runs in the gate's hermetic environment; the hybrid
  // mode needs this machine's provider.
  if (!flags.hybrid) require('./hermetic-env.cjs');
  main(flags).catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}

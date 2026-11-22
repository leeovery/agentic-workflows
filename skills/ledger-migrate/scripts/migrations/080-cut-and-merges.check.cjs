'use strict';

//
// The check of directive 080, the cut and the merges (21.7, 21.8, 21.10.7):
// a piece for each unit the step reshapes and each epic whose research it
// places, read in the state as the move (078) and the records (079) left it
// and in `.workflows/` as the move read it — the working tree of the
// project's folder in the repository's main checkout, which stays until
// the migration's commit (21.5.8):
//   - `{unit}`, a unit whose building started — the old plan's spec,
//     planning or implementation items still on its manifest, which the move
//     left for the cut, a quick-fix's its own and never cut — done once its topics no joined spec covers have
//     left it and the cut has marked it (cut-migrating.cjs,
//     `.cache/migrate/cut/{unit}.json`), the cut dropping those items. A
//     topic leaves where it is live — on the map, neither cancelled nor
//     postponed, its discussion neither cancelled nor promoted — and no spec
//     joined into `spec.md` names it as its own or among its sources; a topic
//     the old map marked a dead end stays, concluded, with nothing to build
//     (21.5.22). The person says once per unit where its leaving topics go,
//     kept with the unit's plan as `answers.leaving`, so a run again never
//     asks twice. A plan of the unit kept in plain files, with no tracker
//     root, is refused by name (21.8.13) — one whose format is a tracker's,
//     the name of a task driver's folder, is a plan still being written
//     that put nothing in the tracker yet, its area no plan's (21.7.1);
//     so is a unit none of whose specs
//     was joined. Each file its agents left under its staged phases that is
//     none of a piece's — the piece, its findings, its rounds, the points
//     settled, and the pieces its verifiers read — is named, to remove;
//   - `{unit}`, a unit nothing of which was built — no old plan's items
//     left, and not completed — or a cancelled one, its specs joined or
//     not, whose old plans put tasks in the tracker, each a planning item
//     with a tracker root and a task map: done once `task close-plan` has
//     marked each root closed (`.cache/migrate/closed/{unit}/{root}.json`,
//     21.8.4, 21.8.12) — never a quick-fix's still in progress, which keeps
//     its unit, its old tasks left as they stand, never taken up or closed
//     (21.5.21);
//   - `{unit}`, a cross-cutting unit: done once it has left the registry,
//     its folder kept in the product's assets, and no epic holds a topic
//     promoted to it (21.7.3, 21.7.5) — its entries product-wide, which the
//     records step's rules hold (079);
//   - `{unit}/research`, an epic holding a discovery session the move wrote
//     for research that fed several topics (21.5.4): done once its
//     placement, `.cache/migrate/cut-and-merges/{unit}/placed.json`, names
//     the topics each of its sections bears on — none, to leave it epic-wide
//     — and each topic's log holds the section once, under
//     `## Research: {source}, from discovery session {NNN}`, as the session
//     has it but for each relative link, rebased from the session's folder
//     to the log's (21.7.2, markdown-links.cjs). A topic a split took on to
//     another epic is read there.
// What the step stages for a unit is in `.cache/migrate/cut-and-merges/
// {unit}/`: its plan, `plan.json`, the person's answers in it from the
// first, and the verifier's findings on it.
//
// Beside the check: what leaves a building unit (`leavingOf`), which the
// mixed unit's question draws (21.8.10); and a building unit's sources as
// the cut reads them (`unitSourcesOf`), from which the engine lays its cut
// out, phase by phase, for the agents and the join (cut-merges.cjs) — the
// joined spec's areas, each old plan's files, which the move copied into the
// unit's `earlier/` in the state's cache (078), tracker root and phases, each
// phase's name as its plan heads it and its goal as its plan gives it, its
// parent and its tasks in the plan's own order with the manifest's credit
// of each, the dependencies between the old plans, the folder kept as
// legacy and the unit's staging. And the
// section of the directive its agents' briefs draw, `briefed`: a phase's
// piece, never the session's work.
// It reads and changes nothing, and calls no model.
//
// Known edges: a migration session a person edited until the move's line
// is gone is no piece. Research placed after the records reached them
// before it moved: 079 reads a unit's discovery sessions, the migration's
// among them, as every topic's source.
//

const fs = require('fs');
const path = require('path');
const { OLD_STATE, TASK_DRIVERS, mainCheckout, projectInMain } = require('./reshape/shared.cjs');

const OLD_PLAN = ['specification', 'planning', 'implementation'];
const STAGING = '.cache/migrate/cut-and-merges';
const CUT_MARKS = '.cache/migrate/cut';
const CLOSED_MARKS = '.cache/migrate/closed';
const QUICK_FIX = 'quick-fix';
const PRODUCT_ASSETS = '.product/assets';
// The section of the directive its agents' briefs draw.
const BRIEFED = ["A Phase's Piece"];
const OUT_OF_THE_UNIT = ['cancelled', 'postponed', 'promoted'];
// A markdown file's relative links, as the engine rebases them when a copy
// lands in another folder (markdown-links.cjs), which no migration loads:
// an inline link's or a definition's target outside a fenced block, but
// one naming a scheme, an absolute path or only an anchor.
const INLINE_LINK = /(\]\(\s*)(<[^>\n]*>|[^)\s]+)/g;
const LINK_DEFINITION = /^( {0,3}\[[^\]\n]+\]:[ \t]*)(<[^>\n]*>|\S+)/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const UNTOUCHED = /^(?:[a-z][a-z0-9+.-]*:|\/|#|$)/i;
// The line the move (078) opens its discovery session for research that fed several topics with.
const MIGRATION_SESSION = 'Written by the migration: the research below fed several topics, so it is kept here, on the unit\'s discovery log, until the cut and the merges place it where it bears.';
const SESSION_FILE = /^session-([0-9]{3,})\.md$/;
// A heading of that session that may name a source; it names one where it
// names a research file the unit held, the document's own title beneath it
// a level down reading the same way.
const RESEARCH_HEADING = /^## Research: (.+)$/;
const RESEARCH_FILE = /^(.+)\.md$/;
// An old plan's file, its heading for one of its phases — `Phase {N}`, then
// the phase's name — and the line beneath it giving the phase's goal.
const OLD_PLAN_FILE = 'planning.md';
const PHASE_HEADING = /^#{1,6} Phase ([0-9]+)(?![0-9])[ \t]*[:.—–-]?[ \t]*(.*?)[ \t#]*$/;
const GOAL_LINE = /^\*\*Goal\*\*:[ \t]*(.*?)[ \t]*$/;

/** An old plan's folder, state-relative, by its parts: where the move copied it, in its unit's `earlier/`. @param {string} unit @param {string} topic */
const oldPlanAt = (unit, topic) => ['.cache', unit, 'earlier', 'planning', topic];

/** @param {unknown} v @returns {v is Record<string, any>} */
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** @param {unknown} items @returns {Record<string, any>} */
const itemsOf = (items) => (isObject(items) ? items : {});

/** @param {Record<string, any>|null} manifest @param {string} phase */
const phaseItems = (manifest, phase) => itemsOf(manifest?.phases?.[phase]?.items);

/** @param {string} file */
const isFile = (file) => fs.statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;

/** @param {string} file */
const readText = (file) => (isFile(file) ? fs.readFileSync(file, 'utf8') : null);

/** @param {string} file @returns {any} */
function readJson(file) {
  const text = readText(file);
  return text === null ? null : JSON.parse(text);
}

// A file of a phase's piece, as cut-merges.cjs stages it: the piece, its
// verifier's findings, its rounds, the points the session settled, and the
// pieces its verifiers read.
const PHASE_FILE = /^[0-9]+\.(?:json|findings\.txt|rounds\.md|settled\.md|verifying\.json|verified\.json)$/;

/** The folders in `dir`, sorted; none where it is no folder. @param {string} dir */
const foldersIn = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort() : []);

/** Every file under `dir`, from it, sorted. @param {string} dir @param {string} [from] @returns {string[]} */
function filesUnder(dir, from = '') {
  if (!fs.existsSync(path.join(dir, from))) return [];
  return fs.readdirSync(path.join(dir, from), { withFileTypes: true }).flatMap((entry) => {
    const rel = from === '' ? entry.name : `${from}/${entry.name}`;
    return entry.isDirectory() ? filesUnder(dir, rel) : [rel];
  }).sort();
}

/**
 * The project as the check reads it: its folder in the main checkout, the
 * state, and each unit's manifest before the move and now, read once.
 * @typedef {{dir: string, stateDir: string, before: (name: string) => Record<string, any>|null, now: (name: string) => Record<string, any>|null}} Project
 */

/** @param {string} projectDir @param {string} stateDir @returns {Project} */
function projectOf(projectDir, stateDir) {
  const main = mainCheckout(projectDir);
  const dir = main === null ? projectDir : projectInMain(projectDir, main);
  /** @type {Map<string, Record<string, any>|null>} */
  const befores = new Map();
  /** @type {Map<string, Record<string, any>|null>} */
  const nows = new Map();
  /** @param {Map<string, Record<string, any>|null>} memo @param {string} file @param {string} name */
  const read = (memo, file, name) => {
    if (!memo.has(name)) memo.set(name, readJson(file));
    return memo.get(name) ?? null;
  };
  return {
    dir,
    stateDir,
    before: (name) => read(befores, path.join(dir, OLD_STATE, name, 'manifest.json'), name),
    now: (name) => read(nows, path.join(stateDir, name, 'manifest.json'), name),
  };
}

/** The units of the state and of `.workflows/`, by name, sorted. @param {Project} project */
function unitNames(project) {
  const held = (/** @type {string} */ root) => foldersIn(root).filter((name) => !name.startsWith('.') && isFile(path.join(root, name, 'manifest.json')));
  return [...new Set([...held(project.stateDir), ...held(path.join(project.dir, OLD_STATE))])].sort();
}

/** Whether a manifest holds any of the old plan's items, which the move left for the cut. @param {Record<string, any>|null} manifest */
const holdsOldPlan = (manifest) => OLD_PLAN.some((phase) => Object.keys(phaseItems(manifest, phase)).length > 0);

/** The names a spec item's sources give, in their map form or the legacy list. @param {unknown} sources @returns {string[]} */
function sourceNames(sources) {
  if (Array.isArray(sources)) return sources.filter(isObject).map((row) => String(row.name ?? ''));
  return Object.keys(itemsOf(sources));
}

/** The topics joined into the unit's spec.md, area by area. @param {Record<string, any>} now @returns {string[]} */
const joinedOf = (now) => (Array.isArray(now.spec?.joined) ? now.spec.joined.map(String) : []);

/**
 * The topics of a building epic its joined specs cover: each joined spec's
 * own name and its sources, as `.workflows/` names them.
 * @param {Record<string, any>} now @param {Record<string, any>|null} before
 */
function coveredOf(now, before) {
  const specs = phaseItems(before, 'specification');
  return new Set(joinedOf(now).flatMap((spec) => [spec, ...sourceNames(specs[spec]?.sources)]));
}

/** Where a live topic of the unit stands, as the mixed unit's question groups it. @param {Record<string, any>|undefined} item */
function standingOf(item) {
  if (!isObject(item) || item.status === 'unstarted') return 'not-started';
  return item.status === 'completed' ? 'decided' : 'in-progress';
}

/**
 * The topics leaving a building epic (the header's), each with where it
 * stands, in the map's order; and how many live topics its specs cover.
 * @param {Record<string, any>} now @param {Record<string, any>|null} before
 * @returns {{covered: number, leaving: {topic: string, standing: string}[]}}
 */
function leavingTopics(now, before) {
  if (now.work_type !== 'epic') return { covered: 0, leaving: [] };
  const rows = phaseItems(now, 'discovery');
  const discussion = phaseItems(now, 'discussion');
  const deadEnds = new Set(Object.entries(phaseItems(before, 'discovery')).filter(([, row]) => isObject(row) && row.handled === true).map(([topic]) => topic));
  const covered = coveredOf(now, before);
  const order = (/** @type {string} */ topic) => (Number.isInteger(rows[topic]?.order) ? rows[topic].order : Number.MAX_SAFE_INTEGER);
  const live = [...new Set([...Object.keys(rows), ...Object.keys(discussion)])]
    .filter((topic) => {
      const row = rows[topic];
      if (isObject(row) && (row.cancelled === true || row.postponed === true)) return false;
      return !OUT_OF_THE_UNIT.includes(discussion[topic]?.status);
    })
    .sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  return {
    covered: live.filter((topic) => covered.has(topic)).length,
    leaving: live.filter((topic) => !covered.has(topic) && !deadEnds.has(topic)).map((topic) => ({ topic, standing: standingOf(discussion[topic]) })),
  };
}

/** The unit's staged plan, or null where none reads. @param {Project} project @param {string} unit */
function stagedPlan(project, unit) {
  try {
    return readJson(path.join(project.stateDir, STAGING, unit, 'plan.json'));
  } catch {
    return null;
  }
}

/** The old plans of a unit that put tasks in the tracker: each its topic and root. @param {Record<string, any>|null} before */
function trackerPlans(before) {
  return Object.entries(phaseItems(before, 'planning'))
    .filter(([, item]) => isObject(item) && typeof item.external_id === 'string' && Object.keys(itemsOf(item.task_map)).length > 0)
    .map(([topic, item]) => ({ topic, root: String(item.external_id) }));
}

/** Whether the migration's cut has marked the unit, its old plan's items dropped. @param {Project} project @param {string} unit */
const isCut = (project, unit) => isFile(path.join(project.stateDir, CUT_MARKS, `${unit}.json`));

/**
 * Whether a unit's building started: the old plan's items the move left for
 * the cut, or the cut's mark — never a quick-fix's, whose items the move
 * keeps as its own.
 * @param {Project} project @param {string} unit @param {Record<string, any>|null} now
 */
const isBuilding = (project, unit, now) => now !== null && now.work_type !== QUICK_FIX && (holdsOldPlan(now) || isCut(project, unit));

/** Whether a unit is a quick-fix still in progress, whose old tasks stand as they are (21.5.21). @param {Record<string, any>} now */
const keepsItsTasks = (now) => now.work_type === QUICK_FIX && now.status === 'in-progress';

/** @param {string[]} names */
const listed = (names) => names.join(', ');

/**
 * What a building unit still lacks (the header's).
 * @param {Project} project @param {string} unit @param {Record<string, any>} now @param {Record<string, any>|null} before
 * @returns {string[]}
 */
function buildingProblems(project, unit, now, before) {
  if (joinedOf(now).length === 0) return ['holds the old plan\'s items, and the move joined none of its specs into its spec.md — the cut takes only a unit whose specs it joined'];
  const trackers = foldersIn(TASK_DRIVERS);
  const filed = Object.entries(phaseItems(before, 'planning')).filter(([, item]) => isObject(item) && typeof item.external_id !== 'string' && !trackers.includes(item.format)).map(([topic]) => topic);
  if (filed.length > 0) return [`its plans ${listed(filed)} are kept in plain files, with no tracker root, and the cut adopts a plan from the tracker alone (21.8.13) — it needs a migration of its own`];
  const { leaving } = leavingTopics(now, before);
  const answered = isObject(stagedPlan(project, unit)?.answers?.leaving);
  const left = leaving.length === 0 ? [] : [answered
    ? `its topics ${listed(leaving.map(({ topic }) => topic))} are in no spec it joined and have not left it yet, where the person said they go`
    : `its topics ${listed(leaving.map(({ topic }) => topic))} are in no spec it joined, so they leave it, and the person has not said where — ask once (21.8.10)`];
  const cut = isCut(project, unit) ? [] : ['is not cut yet'];
  return [...left, ...strayPhaseFiles(project, unit), ...cut];
}

/**
 * Each file under a unit's staged phases that is none of a piece's: one an
 * agent left, named to remove.
 * @param {Project} project @param {string} unit
 */
function strayPhaseFiles(project, unit) {
  const phases = `${STAGING}/${unit}/phases`;
  return filesUnder(path.join(project.stateDir, phases)).filter((rel) => !PHASE_FILE.test(rel))
    .map((rel) => `${path.join(project.stateDir, phases, rel)} is none of a phase's files — an agent left it: remove it`);
}

/**
 * What a unit nothing of which was built still lacks: each old plan in the
 * tracker closed.
 * @param {Project} project @param {string} unit @param {Record<string, any>|null} before
 */
function closingProblems(project, unit, before) {
  return trackerPlans(before).filter(({ root }) => !isFile(path.join(project.stateDir, CLOSED_MARKS, unit, `${root}.json`)))
    .map(({ topic, root }) => `its plan ${topic}, in the tracker under ${root}, is not closed yet`);
}

/**
 * What a cross-cutting unit still lacks: off the registry, its folder in the
 * product's assets, no epic's topic promoted to it.
 * @param {Project} project @param {string} unit
 */
function retiringProblems(project, unit) {
  const registry = readJson(path.join(project.stateDir, 'manifest.json'));
  const still = project.now(unit) !== null || Object.hasOwn(itemsOf(registry?.work_units), unit) ? ['is still a unit — retire it once its record is the product\'s'] : [];
  const kept = still.length === 0 && !fs.existsSync(path.join(project.stateDir, PRODUCT_ASSETS, unit)) ? [`is off the registry, and ${PRODUCT_ASSETS}/${unit} does not hold it`] : [];
  const promoted = unitNames(project).flatMap((epic) => Object.entries(phaseItems(project.now(epic), 'discussion'))
    .filter(([, item]) => isObject(item) && item.status === 'promoted' && item.promoted_to === unit).map(([topic]) => `${epic}'s ${topic} is still promoted to it`));
  return [...still, ...kept, ...promoted];
}

/**
 * The epic's discovery sessions the move wrote for research that fed
 * several topics: each its file's name, its number, and its sections by
 * source, each with its text.
 * @param {Project} project @param {string} unit
 * @returns {{file: string, number: string, sections: {source: string, text: string}[]}[]}
 */
function migrationSessions(project, unit) {
  const folder = path.join(project.stateDir, unit, 'discovery');
  const held = new Set(filesUnder(path.join(project.dir, OLD_STATE, unit, 'research')).flatMap((file) => RESEARCH_FILE.exec(file)?.[1] ?? []));
  return (fs.existsSync(folder) ? fs.readdirSync(folder).sort() : []).flatMap((file) => {
    const number = SESSION_FILE.exec(file)?.[1];
    const text = number === undefined ? null : readText(path.join(folder, file));
    if (text === null || !text.split('\n').includes(MIGRATION_SESSION)) return [];
    /** @type {{source: string, lines: string[]}[]} */
    const sections = [];
    for (const line of text.split('\n')) {
      const source = RESEARCH_HEADING.exec(line)?.[1];
      if (source !== undefined && held.has(source)) sections.push({ source, lines: [] });
      else sections.at(-1)?.lines.push(line);
    }
    return [{ file, number: /** @type {string} */ (number), sections: sections.map(({ source, lines }) => ({ source, text: lines.join('\n').trim() })) }];
  });
}

/** The heading a placed section takes in a topic's log. @param {string} source @param {string} number */
const placedHeading = (source, number) => `## Research: ${source}, from discovery session ${number}`;

/**
 * The log of a topic named by a placement, from the state's folder: the
 * unit's, or, where a split took the topic on, the epic it went to.
 * @param {Project} project @param {string} unit @param {string} topic
 */
function placedLog(project, unit, topic) {
  const holders = [unit, ...unitNames(project).filter((other) => other !== unit)].filter((name) => {
    const now = project.now(name);
    return now !== null && (Object.hasOwn(phaseItems(now, 'discovery'), topic) || Object.hasOwn(phaseItems(now, 'discussion'), topic));
  });
  return holders.length === 0 ? null : path.posix.join(holders[0], 'topics', topic, 'log.md');
}

/**
 * `target`, relative to `fromDir`, made relative to `toDir`, its anchor,
 * its query and a folder's trailing slash kept.
 * @param {string} target @param {string} fromDir @param {string} toDir
 */
function rebasedTarget(target, fromDir, toDir) {
  const angled = target.startsWith('<');
  const bare = angled ? target.slice(1, -1) : target;
  if (UNTOUCHED.test(bare)) return target;
  const cut = bare.search(/[?#]/);
  const named = path.posix.join(fromDir, cut === -1 ? bare : bare.slice(0, cut));
  const rebased = (path.posix.relative(toDir, named) || '.') + (named.endsWith('/') ? '/' : '') + (cut === -1 ? '' : bare.slice(cut));
  return angled ? `<${rebased}>` : rebased;
}

/**
 * `text`, markdown in `fromDir`, each relative link rebased to resolve from
 * `toDir`, fenced blocks as they are.
 * @param {string} text @param {string} fromDir @param {string} toDir
 */
function rebasedLinks(text, fromDir, toDir) {
  /** @type {string|null} */
  let fence = null;
  /** @param {string} _ @param {string} lead @param {string} target */
  const rebase = (_, lead, target) => lead + rebasedTarget(target, fromDir, toDir);
  return text.split('\n').map((line) => {
    const opens = FENCE.exec(line)?.[1];
    if (fence !== null) {
      if (opens !== undefined && opens[0] === fence[0] && opens.length >= fence.length) fence = null;
      return line;
    }
    if (opens !== undefined) {
      fence = opens;
      return line;
    }
    return line.replace(LINK_DEFINITION, rebase).replace(INLINE_LINK, rebase);
  }).join('\n');
}

/**
 * What one placed section lacks in a topic's log: the section as the
 * session holds it, each relative link rebased from the session's folder to
 * the log's.
 * @param {Project} project @param {string} unit @param {string} topic @param {string} heading @param {string} text
 */
function placedProblem(project, unit, topic, heading, text) {
  const log = placedLog(project, unit, topic);
  if (log === null) return `places research on ${topic}, a topic no unit holds`;
  const held = readText(path.join(project.stateDir, log)) ?? '';
  const times = held.split('\n').filter((line) => line.trimEnd() === heading).length;
  if (times !== 1) return `${topic}'s log holds "${heading}" ${times === 0 ? 'nowhere' : `${times} times`} — the placed research goes under it once`;
  const rebased = rebasedLinks(text, `${unit}/discovery`, path.posix.dirname(log));
  return held.includes(`${heading}\n\n${rebased}`) ? null : `${topic}'s log holds "${heading}" without the research beneath it as the session has it, each link rebased to the log's folder`;
}

/**
 * What an epic's research placement still lacks (the header's).
 * @param {Project} project @param {string} unit @param {ReturnType<typeof migrationSessions>} sessions
 */
function placementProblems(project, unit, sessions) {
  const file = path.join(project.stateDir, STAGING, unit, 'placed.json');
  /** @type {unknown} */
  let placed;
  try {
    placed = readJson(file);
  } catch (err) {
    return [`its placement does not read as JSON: ${err instanceof Error ? err.message : String(err)}`];
  }
  if (placed === null) return [`its research that fed several topics is not placed yet: ${listed(sessions.map(({ file: name, sections }) => `${name} (${listed(sections.map(({ source }) => source))})`))}`];
  if (!isObject(placed)) return ['its placement is not one object of each session\'s sources'];
  const known = new Map(sessions.map((session) => [session.file, session]));
  const strays = Object.keys(placed).filter((name) => !known.has(name)).map((name) => `its placement names ${name}, which is no discovery session of the migration's`);
  return [...strays, ...sessions.flatMap(({ file: name, number, sections }) => {
    const given = itemsOf(placed[name]);
    const extra = Object.keys(given).filter((source) => !sections.some((section) => section.source === source)).map((source) => `its placement names ${source} in ${name}, which holds no such research`);
    return [...extra, ...sections.flatMap(({ source, text }) => {
      const topics = given[source];
      if (!Array.isArray(topics) || !topics.every((topic) => typeof topic === 'string')) return [`${name}'s research ${source} is placed nowhere — name the topics it bears on, or none to leave it epic-wide`];
      return topics.map((topic) => placedProblem(project, unit, topic, placedHeading(source, number), text)).filter((problem) => problem !== null).map((problem) => `${name}'s ${source}: ${problem}`);
    })];
  })];
}

/**
 * Each piece of a unit (the header's): its kind's, and its research's.
 * @param {Project} project @param {string} unit @returns {{name: string, problems: string[]}[]}
 */
function piecesOfUnit(project, unit) {
  const now = project.now(unit);
  const before = project.before(unit);
  /** @type {{name: string, problems: string[]}[]} */
  const pieces = [];
  if (now?.work_type === 'cross-cutting' || before?.work_type === 'cross-cutting') pieces.push({ name: unit, problems: retiringProblems(project, unit) });
  else if (isBuilding(project, unit, now)) pieces.push({ name: unit, problems: buildingProblems(project, unit, /** @type {Record<string, any>} */ (now), before) });
  else if (now !== null && now.status !== 'completed' && !keepsItsTasks(now) && trackerPlans(before).length > 0) pieces.push({ name: unit, problems: closingProblems(project, unit, before) });
  const sessions = now === null ? [] : migrationSessions(project, unit);
  if (sessions.length > 0) pieces.push({ name: `${unit}/research`, problems: placementProblems(project, unit, sessions) });
  return pieces;
}

/**
 * What the plan in `folder` says of each of its phases, by its number: its
 * name, its heading's words after `Phase {N}`, the first heading of the
 * phase naming it; and its goal, the first `**Goal**:` line under a heading
 * of the phase before another phase's; none where its plan file is not
 * there.
 * @param {string} folder @returns {Map<number, {title: string|null, goal: string|null}>}
 */
function phaseHeads(folder) {
  /** @type {Map<number, {title: string|null, goal: string|null}>} */
  const heads = new Map();
  /** @type {{title: string|null, goal: string|null}|null} */
  let under = null;
  for (const line of (readText(path.join(folder, OLD_PLAN_FILE)) ?? '').split('\n')) {
    const [, number, title = ''] = PHASE_HEADING.exec(line) ?? [];
    if (number !== undefined) {
      if (!heads.has(Number(number))) heads.set(Number(number), { title: null, goal: null });
      under = /** @type {{title: string|null, goal: string|null}} */ (heads.get(Number(number)));
      under.title ??= title || null;
      continue;
    }
    const goal = GOAL_LINE.exec(line)?.[1];
    if (under !== null && goal) under.goal ??= goal;
  }
  return heads;
}

/**
 * Each old plan of a building unit as the cut reads it: its topic, its
 * files the move copied into the unit's cache, its tracker root, its phases — each its
 * number, the name its plan heads it with and the goal it gives it, each
 * null where it gives none, its parent in the tracker and its tasks in the
 * plan's own order,
 * by the plan's id and the tracker's, and whether the manifest credits the
 * phase built and each task done — and the dependencies it named on
 * another spec.
 * @param {Project} project @param {string} unit @param {Record<string, any>|null} before
 */
function plansOf(project, unit, before) {
  const implementation = phaseItems(before, 'implementation');
  return Object.entries(phaseItems(before, 'planning')).filter(([, item]) => isObject(item)).map(([topic, item]) => {
    const folder = path.join(project.stateDir, ...oldPlanAt(unit, topic));
    const heads = phaseHeads(folder);
    const map = itemsOf(item.task_map);
    const credited = new Set(Array.isArray(implementation[topic]?.completed_tasks) ? implementation[topic].completed_tasks.map(String) : []);
    const built = new Set(Array.isArray(implementation[topic]?.completed_phases) ? implementation[topic].completed_phases.map(Number) : []);
    /** @typedef {{number: number, title: string|null, goal: string|null, parent: string|null, tasks: {id: string, tracker: string, credited: boolean}[]}} PlanPhase */
    /** @type {Map<number, PlanPhase>} */
    const phases = new Map();
    const phaseOf = (/** @type {number} */ number) => {
      if (!phases.has(number)) phases.set(number, { number, title: null, goal: null, ...heads.get(number), parent: null, tasks: [] });
      return /** @type {PlanPhase} */ (phases.get(number));
    };
    for (const [id, tracker] of Object.entries(map)) {
      const named = id.startsWith(`${topic}-`) ? /^([0-9]+)(?:-([0-9]+)([a-z]*))?$/.exec(id.slice(topic.length + 1)) : null;
      if (named === null || typeof tracker !== 'string') continue;
      if (named[2] === undefined) phaseOf(Number(named[1])).parent = tracker;
      else phaseOf(Number(named[1])).tasks.push({ id, tracker, credited: credited.has(id) });
    }
    const natural = (/** @type {string} */ id) => {
      const [, n, letters] = /** @type {RegExpExecArray} */ (/-([0-9]+)([a-z]*)$/.exec(id));
      return [Number(n), letters];
    };
    return {
      topic,
      files: filesUnder(folder).map((file) => path.posix.join(...oldPlanAt(unit, topic), file)),
      root: typeof item.external_id === 'string' ? item.external_id : null,
      phases: [...phases.values()].sort((a, b) => a.number - b.number).map((phase) => ({
        ...phase,
        built: built.has(phase.number),
        tasks: phase.tasks.sort((a, b) => {
          const [an, al] = natural(a.id);
          const [bn, bl] = natural(b.id);
          return Number(an) - Number(bn) || (al < bl ? -1 : al > bl ? 1 : 0);
        }),
      })),
      dependencies: Object.entries(itemsOf(item.external_dependencies)).map(([on, dependency]) => ({ on, ...(isObject(dependency) ? dependency : {}) })),
    };
  });
}

module.exports = {
  does: 'This step gives each piece of work the shape Ledger builds from, cutting work already under way into phases and carrying its tasks across.',
  counts: { one: 'piece of work', many: 'pieces of work' },
  done: 'done',
  partWay: 'A piece of work it was in the middle of is carried on from where it stood.',
  briefed: BRIEFED,
  /** @param {{projectDir: string, stateDir: string}} dirs */
  check({ projectDir, stateDir }) {
    const project = projectOf(projectDir, stateDir);
    return unitNames(project).flatMap((unit) => piecesOfUnit(project, unit));
  },
  /**
   * What leaves a building unit, by the unit's name: how many of its live
   * topics its specs cover, and each that leaves with where it stands —
   * decided, in progress or not started — in the map's order. Null for a
   * unit that is no building unit's.
   * @param {{projectDir: string, stateDir: string, unit: string}} at
   */
  leavingOf({ projectDir, stateDir, unit }) {
    const project = projectOf(projectDir, stateDir);
    const now = project.now(unit);
    return isBuilding(project, unit, now) ? leavingTopics(/** @type {Record<string, any>} */ (now), project.before(unit)) : null;
  },
  /**
   * A building unit's sources as the cut reads them (the header's):
   * `project`, the project's folder they are read in; `areas`, the topics
   * joined into its spec.md, area by area, each with its old spec under
   * `.workflows/`; `plans`, its old plans as `plansOf` reads them; `legacy`,
   * the folder of the files the move kept as legacy, null where it has
   * none; and `staging`, its staging in the state's cache. Null for a unit
   * that is no building unit.
   * @param {{projectDir: string, stateDir: string, unit: string}} at
   */
  unitSourcesOf({ projectDir, stateDir, unit }) {
    const project = projectOf(projectDir, stateDir);
    const now = project.now(unit);
    if (!isBuilding(project, unit, now) || now === null) return null;
    return {
      project: project.dir,
      areas: joinedOf(now).map((topic) => ({ topic, spec: `${OLD_STATE}/${unit}/specification/${topic}/specification.md` })),
      plans: plansOf(project, unit, project.before(unit)),
      legacy: fs.existsSync(path.join(project.stateDir, unit, 'assets', 'legacy')) ? `${unit}/assets/legacy` : null,
      staging: `${STAGING}/${unit}`,
    };
  },
};

'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the records a brief is filled from (6.5.4, 13.11.2), each
// drawn in one fixed form, so what an agent is told is what the records
// say and nothing else (6.5.6):
//
//   task           the task's text whole, as the tracker holds it, each of
//                  its headings a level down, under the template's own; then
//                  each addition, in order, under a heading of its own saying
//                  whether the orchestrator or the person added it (13.11.3)
//   spec-sections  each section the task's spec reference cites, verbatim
//                  from the unit's spec (spec-sections.cjs)
//   decided-calls  the unit's current decisions at its own level, the
//                  person's and Claude's alike, in the ledger's order, each
//                  one list item: its id, whose it is, its answer and why,
//                  every line after its first indented
//   linters        the project's linters, each its name and its command,
//                  from the environment on the project manifest (22.5.12,
//                  environment.cjs)
//   diff-range     in each repository holding the task's branch, by the
//                  landing's rule (landing-git.cjs), under a heading naming
//                  the repository, the range from its base to the branch,
//                  `{base}...{branch}`, and its `git diff --stat` — never
//                  the diff's text, which can run to thousands of lines and
//                  is read in the range. The base is the branch `--base`
//                  names where the repository has it, else the repository's
//                  default branch: a nested repository's may be named
//                  otherwise, and a stack's base branch be in some only
//   report-a,      the report its flag's path points to, verbatim, a file
//   report-b       in the unit's `build/` folder (4.11.5)
//
// A discussion topic's records, each read from the ledger as its read verb
// answers it (ledger-read.cjs) or from the topic's agent store
// (agent-state.cjs) — never a word of the conversation (26.1.5):
//
//   topic-record   the topic's record as `ledger record` answers it, its
//                  current entries each with what it replaced (9.2.5),
//                  fenced as JSON
//   topic-log      the path of the topic's log, `topics/{topic}/log.md`
//                  (9.2.10), for the agent to read
//   other-records  the record of each other live topic of the unit that
//                  shows anything, under a heading naming the topic — never
//                  its log, and none of a topic set aside (5.8.17, 9.3.4)
//   product-record the product record as `ledger product` answers it
//   question       the question `--question` names, by any wording, in its
//                  current wording: its short id and its text. It is an
//                  open question standing on the topic, and the dispatch
//                  `--agent` names is bound to it (agent-state.cjs)
//   pair-question  the question the perspectives of that synthesis
//                  dispatch's set were each briefed on, in its current
//                  wording — one question, so a synthesis reconciles what
//                  its pair argued
//   dive-kind      the kind of dive `--kind` names (survey, read,
//                  feasibility, landscape, verify), and for a read the path
//                  of the file `--path` names, which only a read takes
//   gap-review     whether a gap review has run since the topic's last
//                  decision, naming it where one has (9.9.6, agent-state.cjs)
//   report-to      where the agent writes its report: the file of the
//                  dispatch `--agent` names, of the kind its role is briefed
//                  for and still in flight
//   lens           the lens that perspective dispatch was labelled with
//   perspectives   the report of each perspective in that synthesis
//                  dispatch's set, verbatim, in the order they were
//                  dispatched
//
// The plain-search helper's one record is the conversation's (22.6.10):
//
//   knowledge-query the conversation's last `knowledge query`, as it kept
//                  it (knowledge/last-query.cjs): its terms, its filters,
//                  and what it returned, or that it failed and why, or that
//                  it never finished
//
// The migration's records, for the agents of its records directive, each of
// a topic `--topic` names, `<unit>.<phase>.<topic>`, as the migration moved
// it — a topic of a unit cancelled among them (21.6.2):
//
//   directive      the migration's directive `--directive` names, verbatim,
//                  each of its headings a level down (21.10.2)
//   migrated-topic the topic: the unit, its work type and status, the
//                  phases the topic is in, the state's place and the
//                  project's in the main checkout, each file of the
//                  topic's folder but its mail, and as the records
//                  directive's check reads them its specs — each where it
//                  is read and how it is cited — its old map, its
//                  research's threads still open and its reviews never
//                  folded in; the unit's assets with where each came in
//                  from; and where the topic's record is composed, the
//                  verifier's findings on it written and a carry's refusal
//                  of it kept (21.10.5)
//   composed-record that topic's record as composed, fenced as JSON (21.10.7)
//   verifier-findings the verifier's findings on that record, verbatim
//   carry-refusal  what `ledger carry` refused that record for, verbatim
//
// A record taking a flag names it, and its role takes every flag its records
// name, once, and no other — every one but a flag a record holds optional; a flag carries a name, an id or a path, never
// text that reaches the brief (6.5.6). A record the project holds none of
// yet is drawn as none recorded. One that cannot be read refuses the brief:
// a task with no spec reference, a section the spec lacks, linters of
// another shape, a task's branch no repository holds work on, a base no
// repository holding it has as a local branch, a report missing, empty or
// outside the unit's `build/`; a question that is none, no longer current,
// stands elsewhere or is not open, or one its dispatch was not first briefed
// on; a dispatch the topic's store lacks, of another kind, no longer in
// flight; a perspective of the set with no report, or briefed on no question
// or another than its pair; a dive of no kind, a read naming no file, another
// kind naming one; a conversation that has run no knowledge query; a directive the migrations
// lack, a migrated topic its unit lacks, a composed record missing or empty. Nothing else of the project reaches a brief — its
// CLAUDE.md and its skills reach the agent without it (6.5.5).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { git } = require('../kernel/git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { projectRepos } = require('../kernel/repos.cjs');
const { linters } = require('./environment.cjs');
const { readShown, readLedgerVerb } = require('./ledger-read.cjs');
const { recordOf, standingOf, factsOf, wordingOf, inPlace, questionStands } = require('./ledger-fold.cjs');
const { resolveId } = require('./ledger-ids.cjs');
const { manifestOf, liveTopics, TOPIC_PHASES, hasItem } = require('./ledger-units.cjs');
const { topicLog } = require('./topic-log.cjs');
const { dispatchedRows, gapReviewSince, bindQuestion } = require('./agent-state.cjs');
const { lastQuery } = require('./knowledge/last-query.cjs');
const { ROLES } = require('./brief-names.cjs');
const { readCitedSections, headingLevels } = require('./spec-sections.cjs');
const { specReferenceOf } = require('./task-file.cjs');
const { taskName } = require('./task-id.cjs');
const { taskBranch } = require('./landing-names.cjs');
const { branches, holdingBranch, defaultBranch, plain } = require('./landing-git.cjs');
const { remoteName, nestedRemoteName } = require('./remote.cjs');
const { readWorkUnitManifest, isObject } = require('../kernel/manifest-io.cjs');
const { directiveOf } = require('./directives.cjs');
const { topicPlace, recordsRules, composedPath, findingsPath, refusedPath } = require('./ledger-carry.cjs');

/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/** A discussion topic of a unit. @typedef {{unit: string, topic: string}} TopicPlace */

/**
 * What a brief is filled for: the project; its role; the task where its
 * role takes one, as the tracker holds it, or the topic where it takes
 * one; each flag given, by its name; and the conversation it is issued in.
 * @typedef {{
 *   cwd: string, role: string, ref: TaskRef|null, task: TaskDetail|null, place: TopicPlace|null, given: Readonly<Record<string, string>>, session: string,
 * }} Filling
 */

/**
 * A flag a record takes: its name, its value as a usage line shows it, and
 * whether a brief may go without it.
 * @typedef {{name: string, value: string, optional?: boolean}} BriefFlag
 */

/**
 * A record: whether it is a task's, a topic's or neither's, the flags it
 * takes, its drawn form, and what it binds once every record of the brief
 * is drawn; what a read said on the way pushed to `warnings`.
 * @typedef {{
 *   of: 'task'|'topic'|null, flags?: BriefFlag[], draw: (filling: Filling, warnings: string[]) => string, bind?: (filling: Filling, warnings: string[]) => void,
 * }} BriefRecord
 */

const NONE = 'None recorded.';

/** Whose an entry is, as a brief says it. @type {Readonly<Record<string, string>>} */
const WHOSE = Object.freeze({ person: 'the person\'s', claude: 'Claude\'s' });

/** A drawn list, a line an item, or none recorded. @param {string[]} items */
function listed(items) {
  return items.length === 0 ? NONE : items.join('\n');
}

/** The task, and the ref it was read by, for a record that is a task's. @param {Filling} filling */
function taskOf({ ref, task }) {
  if (ref === null || task === null) throw new Error('brief-records: a task\'s record is drawn for a task');
  return { ref, task };
}

/** Markdown with each heading a level down, a fenced block's lines aside. @param {string} text */
function headingsDown(text) {
  const lines = text.split('\n');
  const levels = headingLevels(lines);
  return lines.map((line, at) => (levels[at] > 0 ? `#${line}` : line)).join('\n');
}

/** Text whose every line after its first is indented, to stay in a list item. @param {string} text */
const indented = (text) => text.split('\n').join('\n  ');

/** @param {Filling} filling */
function drawTask(filling) {
  const { task } = taskOf(filling);
  return [headingsDown(task.text), ...task.additions.map(({ by, text }) => `## Added by the ${by}\n\n${text}`)].join('\n\n');
}

/** @param {Filling} filling */
function drawSpecSections(filling) {
  const { ref, task } = taskOf(filling);
  const reference = specReferenceOf(task.text);
  if (reference === null) throw new Error(`${taskName(ref)} holds no spec reference`);
  return readCitedSections(filling.cwd, ref.unit, reference).map((section) => section.text).join('\n\n');
}

/** @param {Filling} filling @param {string[]} warnings */
function drawDecidedCalls(filling, warnings) {
  const { ref } = taskOf(filling);
  return readShown(stateRoot(filling.cwd), warnings, ({ folded, show }) => listed(
    recordOf(folded, ref.unit, null).decisions
      .filter((id) => standingOf(folded, id).topic === null)
      .map((id) => {
        const { id: short, by, text, why } = show(id);
        return `- ${short}, ${WHOSE[/** @type {string} */ (by)]}: ${indented(String(text))}\n  Why: ${indented(String(why))}`;
      }),
  ));
}

/** @param {Filling} filling */
function drawLinters({ cwd }) {
  return listed(linters(cwd).map(({ name, command }) => `- ${name}: ${command}`));
}

// Off a terminal git fits a stat to 80 columns, cutting a long path from its
// front; a width past any path keeps each whole, and the graph is held to
// git's own 40 columns, which the width would otherwise stretch.
const STAT = ['--stat=1000', '--stat-graph-width=40'];

/**
 * The range in one repository, under a heading naming it, and its stat.
 * @param {Repo} repo @param {string} base @param {string} branch
 */
function rangeIn(repo, base, branch) {
  const where = repo.dir === '' ? 'the project\'s repository' : `\`${plain(repo.dir)}\``;
  const stat = git(repo.path, ['diff', '--no-color', ...STAT, `refs/heads/${base}...refs/heads/${branch}`, '--']);
  return `## In ${where}: \`${base}...${branch}\`\n\n${stat === '' ? 'Nothing changed in the range.' : `\`\`\`\n${stat}\`\`\``}`;
}

/**
 * Each repository's base for the range: the one given where it is a local
 * branch there, else the repository's default branch, as the landing picks
 * it; refused where no repository has the one given, so a misnamed base
 * never passes as the default.
 * @param {string} cwd @param {Repo[]} holding @param {string} given @param {string} what the branch, as a refusal names it
 */
function basesOf(cwd, holding, given, what) {
  const has = holding.map((repo) => branches(repo.path).has(given));
  if (!has.includes(true)) throw new Error(`the base ${given} is no local branch in any repository holding ${what}`);
  return holding.map((repo, at) => {
    if (has[at]) return given;
    return defaultBranch(repo.path, repo.dir === '' ? remoteName(cwd) : nestedRemoteName(repo.path), repo.dir !== '');
  });
}

/** @param {Filling} filling */
function drawDiffRange(filling) {
  const { ref, task } = taskOf(filling);
  if (task.type === null) throw new Error(`${taskName(ref)} has no type in the tracker, and its branch is named from it`);
  const branch = taskBranch(ref, task.type, task.title);
  const what = `${taskName(ref)}'s branch, ${branch}`;
  const { holding } = holdingBranch(ref.unit, projectRepos(codeRoot(filling.cwd)), branch);
  if (holding.length === 0) throw new Error(`no repository of the project holds work on ${what}`);
  const bases = basesOf(filling.cwd, holding, filling.given.base, what);
  return holding.map((repo, at) => rangeIn(repo, bases[at], branch)).join('\n\n');
}

/** The folder of a unit's build records. */
const BUILD = 'build';

/** A report's text, refused where there is no file. @param {string} file @param {string} flag */
function readReport(file, flag) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    const { code } = /** @type {NodeJS.ErrnoException} */ (err);
    if (code === 'ENOENT' || code === 'EISDIR') throw new Error(`the --${flag} report, ${file}, is no file`);
    throw err;
  }
}

/** @param {Filling} filling @param {string} flag */
function drawReport(filling, flag) {
  const { ref } = taskOf(filling);
  const build = statePath(filling.cwd, ref.unit, BUILD);
  const file = path.resolve(filling.cwd, filling.given[flag]);
  const within = path.relative(build, file);
  if (within === '' || within.split(path.sep)[0] === '..' || path.isAbsolute(within)) {
    throw new Error(`the --${flag} report, ${file}, is not in ${ref.unit}'s ${BUILD} folder, ${build}`);
  }
  const text = readReport(file, flag);
  if (text.trim() === '') throw new Error(`the --${flag} report, ${file}, is empty`);
  return text;
}

/** A record drawing the report its flag points to. @param {string} flag @returns {BriefRecord} */
function reportRecord(flag) {
  return { of: 'task', flags: [{ name: flag, value: 'path' }], draw: (filling) => drawReport(filling, flag) };
}

/** The topic a topic's record is drawn for. @param {Filling} filling @returns {TopicPlace} */
function placeOf({ place }) {
  if (place === null) throw new Error('brief-records: a topic\'s record is drawn for a topic');
  return place;
}

/** Text fenced, the fence longer than any run of backticks the text holds. @param {string} lang @param {string} text */
function fenced(lang, text) {
  const fence = '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map(([run]) => run.length + 1)));
  return `${fence}${lang}\n${text}\n${fence}`;
}

/**
 * A ledger read's answer, what the read warned of pushed to `warnings`.
 * @param {string} cwd @param {string} verb @param {string[]} args @param {string[]} warnings
 * @returns {Record<string, any>}
 */
function ledgerRead(cwd, verb, args, warnings) {
  const { warnings: read = [], ...answer } = readLedgerVerb(cwd, verb, args);
  warnings.push(.../** @type {string[]} */ (read));
  return answer;
}

/** What a record or the product record shows, by the lists it shows them in. */
const SHOWN = ['questions', 'findings', 'decisions', 'moved', 'merged', 'other_topics'];

/** A read record fenced as JSON, or none recorded where it shows nothing. @param {Record<string, any>} record */
function recordJson(record) {
  return SHOWN.some((list) => Array.isArray(record[list]) && record[list].length > 0) ? fenced('json', JSON.stringify(record, null, 2)) : NONE;
}

/** @param {Filling} filling @param {string[]} warnings */
function drawTopicRecord(filling, warnings) {
  const { unit, topic } = placeOf(filling);
  return recordJson(ledgerRead(filling.cwd, 'record', [unit, topic], warnings));
}

/** @param {Filling} filling */
function drawTopicLog(filling) {
  const { unit, topic } = placeOf(filling);
  const file = statePath(filling.cwd, topicLog(unit, topic));
  return fs.existsSync(file) ? `\`${file}\`` : NONE;
}

/** @param {Filling} filling @param {string[]} warnings */
function drawOtherRecords(filling, warnings) {
  const { unit, topic } = placeOf(filling);
  const others = liveTopics(unit, /** @type {Record<string, any>} */ (manifestOf(stateRoot(filling.cwd), unit))).filter((other) => other !== topic);
  const drawn = others.map((other) => ({ other, json: recordJson(ledgerRead(filling.cwd, 'record', [unit, other], warnings)) })).filter(({ json }) => json !== NONE);
  return drawn.length === 0 ? NONE : drawn.map(({ other, json }) => `## ${other}\n\n${json}`).join('\n\n');
}

/** @param {Filling} filling @param {string[]} warnings */
function drawProductRecord(filling, warnings) {
  return recordJson(ledgerRead(filling.cwd, 'product', [], warnings));
}

/** A question as a brief draws it: its short id and its text. @param {(id: string) => Record<string, unknown>} show @param {string} wording */
function questionLine(show, wording) {
  const { id: short, text } = show(wording);
  return `${short}: ${indented(String(text))}`;
}

/**
 * The question each fill asked for: its first wording, and its line.
 * @type {WeakMap<Filling, {root: string, line: string}>}
 */
const ASKED = new WeakMap();

/**
 * The open question `--question` names on the topic, read once a fill:
 * its first wording, and its current wording's line.
 * @param {Filling} filling @param {string[]} warnings
 */
function askedQuestion(filling, warnings) {
  const known = ASKED.get(filling);
  if (known !== undefined) return known;
  const { unit, topic } = placeOf(filling);
  const given = filling.given.question;
  const asked = readShown(stateRoot(filling.cwd), warnings, ({ folded, show }) => {
    const id = resolveId(given, folded.facts.keys());
    if (factsOf(folded, id).kind !== 'question') throw new Error(`brief: ${given} names no question — --question takes a question on ${unit}/${topic}'s map`);
    const wording = wordingOf(folded, id);
    if (wording === null) throw new Error(`brief: question ${given} is no longer current`);
    const standing = standingOf(folded, wording);
    if (!inPlace(standing, unit, topic)) throw new Error(`brief: question ${given} stands on ${standing.unit}/${standing.topic ?? '(the unit\'s level)'}, not ${unit}/${topic}`);
    const stands = questionStands(folded, wording);
    if (stands !== 'open') throw new Error(`brief: question ${given} is ${stands} — a deep dive or a perspective is briefed on an open question`);
    return { root: factsOf(folded, wording).root, line: questionLine(show, wording) };
  });
  ASKED.set(filling, asked);
  return asked;
}

/** @param {Filling} filling @param {string[]} warnings */
function drawQuestion(filling, warnings) {
  return askedQuestion(filling, warnings).line;
}

/** The dispatch `--agent` names bound to the question its brief draws. @param {Filling} filling @param {string[]} warnings */
function bindAsked(filling, warnings) {
  const { unit, topic } = placeOf(filling);
  bindQuestion(filling.cwd, unit, topic, filling.given.agent, askedQuestion(filling, warnings).root);
}

/** @param {Filling} filling */
function drawGapReview(filling) {
  const { unit, topic } = placeOf(filling);
  const run = gapReviewSince(filling.cwd, unit, topic);
  return run === null ? 'No gap review has run since this topic\'s last decision.' : `A gap review has run since this topic's last decision: ${run}.`;
}

/**
 * The dispatch `--agent` names in the topic's agent store, refused where the
 * store lacks it, it is of another kind than its role is briefed for, or it
 * is no longer in flight; and every row of the store.
 * @param {Filling} filling
 */
function dispatchOf(filling) {
  const { unit, topic } = placeOf(filling);
  const { kind } = ROLES[filling.role];
  const id = filling.given.agent;
  const rows = dispatchedRows(filling.cwd, unit, topic);
  const row = rows.find((dispatched) => dispatched.id === id);
  if (row === undefined) throw new Error(`brief: ${unit}/${topic} has no agent ${id} — \`engine agent dispatch\` records one, and --agent names the id it answers`);
  if (row.kind !== kind) throw new Error(`brief: ${id} is a ${row.kind} dispatch, and the ${filling.role}'s brief is for a ${kind}`);
  if (row.status !== 'in-flight') throw new Error(`brief: ${id} is ${row.status} — a brief is issued for a dispatch still in flight`);
  return { row, rows };
}

/** @param {Filling} filling */
function drawReportTo(filling) {
  return `\`${dispatchOf(filling).row.file}\``;
}

/** @param {Filling} filling */
function drawLens(filling) {
  return `\`${dispatchOf(filling).row.label}\``;
}

/** The perspectives of the set a synthesis dispatch joins. @param {Filling} filling */
function setOf(filling) {
  const { row, rows } = dispatchOf(filling);
  return rows.filter((dispatched) => dispatched.kind === 'perspective' && dispatched.set === row.set);
}

/** @param {Filling} filling @param {string[]} warnings */
function drawPairQuestion(filling, warnings) {
  const set = setOf(filling);
  const unbriefed = set.find((perspective) => perspective.question === undefined);
  if (unbriefed !== undefined) throw new Error(`brief: ${unbriefed.id} was briefed on no question — each perspective of a set is briefed before its synthesis`);
  const questions = [...new Set(set.map((perspective) => perspective.question))];
  if (questions.length > 1) throw new Error(`brief: the perspectives of set ${set[0].set} were briefed on different questions — a synthesis reconciles a pair argued on one`);
  return readShown(stateRoot(filling.cwd), warnings, ({ folded, show }) => {
    const wording = wordingOf(folded, String(questions[0]));
    if (wording === null) throw new Error(`brief: the question set ${set[0].set} argued is no longer current`);
    return questionLine(show, wording);
  });
}

/** @param {Filling} filling */
function drawPerspectives(filling) {
  return setOf(filling).map(({ id, file }) => {
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (text.trim() === '') throw new Error(`brief: ${id}'s report, ${file}, is not written — a synthesis reads every perspective of its set`);
    return text.replace(/\n+$/, '');
  }).join('\n\n');
}

/** The flag naming a ledger question. @type {BriefFlag} */
const QUESTION = Object.freeze({ name: 'question', value: 'id' });

/** The flag naming a dispatch in the topic's agent store. @type {BriefFlag} */
const AGENT = Object.freeze({ name: 'agent', value: 'id' });

/** The kinds of deep dive (9.1.5), each named as the agent's definition names it. */
const DIVE_KINDS = Object.freeze(['survey', 'read', 'feasibility', 'landscape', 'verify']);

/** The kind of dive, and the file a read reads. @param {Filling} filling */
function drawDiveKind({ cwd, given }) {
  const kind = given.kind;
  if (!DIVE_KINDS.includes(kind)) throw new Error(`brief: ${JSON.stringify(kind)} is no kind of dive — --kind takes ${DIVE_KINDS.join(', ')}`);
  if (kind !== 'read') {
    if (given.path !== undefined) throw new Error(`brief: --path names the file a read dive reads, and a ${kind} dive reads none`);
    return kind;
  }
  if (given.path === undefined) throw new Error('brief: a read dive names the file it reads — --path <file>');
  const file = path.resolve(cwd, given.path);
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error(`brief: --path names no file — ${file}`);
  return `read — \`${file}\``;
}

/** The conversation's last knowledge query, drawn for the search that follows it. @param {Filling} filling */
function drawKnowledgeQuery({ session }) {
  const query = lastQuery(session);
  if (query === null) throw new Error('brief: this conversation has run no knowledge query — a plain search follows the `engine knowledge query` it carries on from');
  const filters = query.filters.length === 0 ? 'none' : query.filters.map((filter) => `\`${filter}\``).join(', ');
  const head = `Terms: ${query.terms.map((term) => `\`${term}\``).join(' ')}\nFilters: ${filters}`;
  if (query.outcome === null) return `${head}\n\nIt never finished.`;
  if ('failed' in query.outcome) return `${head}\n\nIt failed: ${query.outcome.failed}`;
  return `${head}\n\nIt returned:\n\n${fenced('', query.outcome.returned.replace(/\n+$/, ''))}`;
}

/** The flag naming a migrated topic, by its place. @type {BriefFlag} */
const MIGRATED = Object.freeze({ name: 'topic', value: 'unit.phase.topic' });

/** @param {Filling} filling */
function drawDirective({ given }) {
  return headingsDown(fs.readFileSync(directiveOf(given.directive).file, 'utf8').trimEnd());
}

/** @param {Filling} filling */
const migratedTopic = ({ cwd, given }) => topicPlace(cwd, given.topic, 'brief');

/** Every file under `dir`, as posix paths from `from`, sorted. @param {string} from @param {string} dir @returns {string[]} */
function filesBelow(from, dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = path.join(dir, entry.name);
    return entry.isDirectory() ? filesBelow(from, at) : [path.relative(from, at).split(path.sep).join('/')];
  }).sort();
}

/** @param {Filling} filling */
function drawMigratedTopic(filling) {
  const { root, unit, topic } = migratedTopic(filling);
  const manifest = readWorkUnitManifest(root, unit);
  const phases = TOPIC_PHASES.filter((phase) => hasItem(manifest, phase, topic)).map((phase) => {
    const { status } = manifest.phases[phase].items[topic];
    return typeof status === 'string' ? `${phase}, ${status}` : phase;
  });
  const files = filesBelow(root, path.join(root, unit, 'topics', topic)).filter((file) => !file.startsWith(`${unit}/topics/${topic}/mail/`));
  const assets = (Array.isArray(manifest.imports) ? manifest.imports : []).filter((entry) => isObject(entry) && typeof entry.path === 'string')
    .map((entry) => `- ${unit}/${entry.path}${typeof entry.origin === 'string' ? `, which came in from ${entry.origin}` : ''}`);
  const sources = recordsRules().sourcesOf({ projectDir: codeRoot(filling.cwd), stateDir: root, unit, topic });
  return [
    `- **Unit:** ${unit}, ${manifest.work_type}, ${manifest.status}`,
    `- **Topic:** ${topic}, in ${phases.join('; ')}`,
    `- **The state:** ${root} — each path below is from there, as an entry cites it, but one under \`.workflows/\``,
    `- **The project:** ${sources.project} — each path under \`.workflows/\` is from there`,
    '',
    '## Its files',
    '',
    listed(files.map((file) => `- ${file}`)),
    '',
    '## Its specs',
    '',
    listed(sources.specs.map((spec) => (spec.read === spec.cite ? `- ${spec.read}` : `- ${spec.read}, cited as ${spec.cite}`))),
    '',
    '## Its old map, as the code branch\'s HEAD holds it',
    '',
    listed(sources.map.map(({ item, status }) => `- ${item}: ${status}`)),
    '',
    '## Its research\'s threads still open',
    '',
    listed(sources.threads.map(({ thread, status, question }) => `- ${thread}, ${status}: ${question}`)),
    '',
    '## Its reviews never folded in',
    '',
    listed(sources.reviews.map(({ id, report }) => `- ${id}: ${report}`)),
    '',
    '## The unit\'s assets',
    '',
    listed(assets),
    '',
    '## Where the record goes',
    '',
    `- The record composed: ${composedPath(unit, topic)}`,
    `- The verifier's findings on it: ${findingsPath(unit, topic)}`,
    `- A carry's refusal of it: ${refusedPath(unit, topic)}`,
  ].join('\n');
}

/** @param {Filling} filling */
function drawComposedRecord(filling) {
  const { root, unit, topic } = migratedTopic(filling);
  const file = path.join(root, composedPath(unit, topic));
  const text = fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file, 'utf8') : null;
  if (text === null) throw new Error(`${unit}'s ${topic} has no record composed — ${file} is no file`);
  if (text.trim() === '') throw new Error(`${unit}'s ${topic} has no record composed — ${file} is empty`);
  return fenced('json', text.trimEnd());
}

/** What the topic's record has beside it at `rel`, verbatim, or none recorded. @param {Filling} filling @param {(unit: string, topic: string) => string} rel */
function besideRecord(filling, rel) {
  const { root, unit, topic } = migratedTopic(filling);
  const file = path.join(root, rel(unit, topic));
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
  return text === '' ? NONE : text;
}

/** Every record, by the slot that draws it. @type {Readonly<Record<string, BriefRecord>>} */
const RECORDS = Object.freeze({
  task: { of: 'task', draw: drawTask },
  'spec-sections': { of: 'task', draw: drawSpecSections },
  'decided-calls': { of: 'task', draw: drawDecidedCalls },
  linters: { of: null, draw: drawLinters },
  'diff-range': { of: 'task', flags: [{ name: 'base', value: 'branch' }], draw: drawDiffRange },
  'report-a': reportRecord('report-a'),
  'report-b': reportRecord('report-b'),
  'topic-record': { of: 'topic', draw: drawTopicRecord },
  'topic-log': { of: 'topic', draw: drawTopicLog },
  'other-records': { of: 'topic', draw: drawOtherRecords },
  'product-record': { of: null, draw: drawProductRecord },
  question: { of: 'topic', flags: [QUESTION, AGENT], draw: drawQuestion, bind: bindAsked },
  'pair-question': { of: 'topic', flags: [AGENT], draw: drawPairQuestion },
  'dive-kind': { of: null, flags: [{ name: 'kind', value: DIVE_KINDS.join('|') }, { name: 'path', value: 'file', optional: true }], draw: drawDiveKind },
  'gap-review': { of: 'topic', draw: drawGapReview },
  'report-to': { of: 'topic', flags: [AGENT], draw: drawReportTo },
  lens: { of: 'topic', flags: [AGENT], draw: drawLens },
  perspectives: { of: 'topic', flags: [AGENT], draw: drawPerspectives },
  'knowledge-query': { of: null, draw: drawKnowledgeQuery },
  directive: { of: null, flags: [{ name: 'directive', value: 'id' }], draw: drawDirective },
  'migrated-topic': { of: null, flags: [MIGRATED], draw: drawMigratedTopic },
  'composed-record': { of: null, flags: [MIGRATED], draw: drawComposedRecord },
  'verifier-findings': { of: null, flags: [MIGRATED], draw: (filling) => besideRecord(filling, findingsPath) },
  'carry-refusal': { of: null, flags: [MIGRATED], draw: (filling) => besideRecord(filling, refusedPath) },
});

module.exports = { RECORDS, DIVE_KINDS };

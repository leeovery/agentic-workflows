'use strict';

//
// The check of directive 079, the records (21.6, 21.10.7): one piece for each
// topic of each unit in the state as the move (078) left it — a name holding
// an item in a unit's discovery, discussion or investigation, but a topic an
// epic promoted to a cross-cutting unit, whose record that unit carries —
// and one for each epic whose discovery folder holds a session,
// `{unit}.discovery`: the epic's own record, what its discovery sessions
// hold of the epic as a whole, or of no one topic — a unit of one topic's
// discovery is its topic's, as its imports from discovery are. Each is done
// once its record is carried and keeps the rules. It rests on two things
// alone, both frozen with 079: the record `ledger carry` kept in the
// state's cache (`.cache/migrate/carried/{unit}/{topic}.json`, a unit's own
// `.cache/migrate/carried/{unit}.json`), and each id it gave the record's
// entries standing in the ledger.
//
// The rules a topic's record keeps, which `ledger carry` holds a record to
// before it appends a line (ledger-carry.cjs), so a record carried keeps
// them by construction. Each keeps the ledger whole — a ref that resolves,
// nothing the sources hold lost — and none judges what the record says,
// which the directive gives the composer and its verifier to judge:
//   - a topic that draws on a spec, or whose own markdown files, but its
//     mail, hold text past their headings, has a record of an entry at
//     least;
//   - every entry cites a section, a heading its file holds or the
//     heading's path, `{heading} > {heading}`, the outermost first, in a file
//     that stays where the cite names it wherever the entry goes: its
//     topic's own, which move with its entries, but its mail, whose
//     messages go once read; or one of the unit's beside its topics — its
//     assets, its `spec.md`, its specs joined there where its building
//     started (21.8.5, 078) — which stay with the unit, or move with every
//     entry of it. Never the cache, which is purged, another topic's
//     folder, which a split may take from under the cite, nor another
//     unit's, which its retiring may (21.7) — but for a promoted topic the
//     discovery sessions of the unit it came from, which stay where they
//     are. A cite names one section alone, as every reader of it reads it
//     (cited-sections.cjs): a heading held more than once by the path that
//     tells it apart, or in a joined spec by its part, `{part} > {heading}`,
//     and headings sharing their whole path by that path and the place
//     among them, `{path} [2]`; a cite naming several is refused, naming
//     each it could mean, never read in the topic's own part;
//   - a topic no map row of its unit, nor of a unit that promoted it there,
//     says what it is about has a record saying it, a line beside its
//     entries, `description`, which the briefs list its subject by
//     (`subjectOf`): what a topic is about is the composer's judgment;
//   - every subtopic its old discussion map holds — in the unit's manifest
//     under `.workflows/`, which the move dropped the map from (21.5.8) —
//     named by an entry's map item, a subtopic's name or a list of them
//     where one entry carries several; whether the entry is a decision, an
//     open question or a finding is what the sources say of it;
//   - every thread of its research the register shows still open or digging
//     named by an entry's thread, a name or a list: an open question where
//     no source answers it, the entry answering it where a later one does —
//     in a unit with no record of its own, each thread of its research under
//     no topic's name too;
//   - every import that came in from the topic, as the unit's manifest
//     lists it, whose file the state holds, linked from one of its entries
//     (21.5.7), a record of none included — in a unit of one topic that is
//     no epic, an import from its discovery, `discovery`, being the topic's;
//   - a record of a topic never started — an epic's, carried in discovery,
//     or its item `unstarted` where it is carried, a message parked on it
//     never opened — holds no decision and nothing product-wide: nothing is
//     decided in discovery (8.3.4, 8.9.6, 21.6.12), so what its research
//     concluded is a finding;
//   - a cross-cutting unit's findings and decisions are every one
//     product-wide: the cut and the merges keep the unit as the product's
//     reference (21.7.3).
// A unit's own record keeps the rules a topic's does that are not its
// topic's — its cites the unit's beside its topics, nothing decided or
// product-wide in discovery — names each thread still open or digging of
// the unit's research under no topic's name, which fed several topics
// (21.5.4, 21.6.7), and links each import from the unit's discovery as a
// whole that no topic owes; a record of none is its own.
// And a unit's: once every topic of it has a record composed or carried,
// every section of its approved specs holding text — a spec kept in its
// assets, or its `spec.md` where its specs were joined — cited by one of its
// records, or marked by the session as holding no topic's
// (`.cache/migrate/records/{unit}.sections.json`): what the spec stage
// decided, found or left open on a subject no log discusses exists nowhere
// else (21.6.4), and the session sends each such section to the topic it
// belongs to, one of those it is named on. A section is named as a cite
// names it alone (cited-sections.cjs, `citeNameOf`), in a joined spec's part
// by the part's heading and the shortest path naming it alone in the part;
// a cite or a mark counts for the section it names alone, as the carry reads
// it, so a bare heading held more than once counts for none of its copies;
// and a cite counts only where its topic draws on the spec, never of a spec
// it draws no part of, its later answer, which it cites for that answer
// alone (21.6.3).
// In a joined spec a section is its part's: a cite counts in the parts of
// its topic's specs, a mark is its part's,
// `{"{path}": {"{part}": ["{section}", …]}}`, and the front matter a part
// opens on, the old spec's, holds none of its text; any other section is
// marked `{"{path}": ["{section}", …]}`. It is named on each topic drawing
// on it — in a joined spec, each whose part holds it, any section outside
// the parts every topic's of the spec — and asks no composer for an entry.
// The sources a unit's records walk in common, its discovery sessions and
// its walked assets, are held the same way, each once every record walking
// it has one composed or carried — of a session the unit's own, and a topic
// it promoted, among them: each section of one holding text cited by any
// record of the unit, of a session a topic it promoted too, or held word for
// word in the own markdown files of any of those topics, which its verifier
// walks there, or marked as a kept spec's is, else named — the walkers
// deciding only when and where — on the topic an import came in from, or a
// split's research was copied from, else on the unit's own record, else on
// each of its topics. A topic's walk sheet and brief leave off what its own
// files hold so, a copy ending where a line does — but a section whose text
// is one line under 40 characters, which an unrelated topic's could match,
// is held by none. A record is carried once its verifier has passed it, the
// findings beside it as composed an empty file, or the session has settled a
// late round's findings, the note beside it marked so (`unverified`, which
// `ledger carry` asks); and until each topic of a unit drawing on an
// approved spec has its record so passed — and each record walking a shared
// source of text, where the unit holds one — and no such section is named,
// no record of the unit is carried, nor of a unit a topic of it was promoted
// to (`unitWaits`): a record carried could take no section found later. A
// record not yet carried is named where it stands: none composed, what the
// carry would refuse it for on its own, through the carry's own guards, or
// passed and waiting to be carried.
// Each record not done also names its one next step, `next`, which the
// session runs the check for after each agent returns, so a verb's refusal
// only ever means a slip (`nextStep`): compose it; settle what its composer
// handed back; a verifier that gave no verdict on an entry asked, replaced;
// wait for its verifier; remove what an agent left, then read the sections
// and judge the contradictions named on it; check it and brief its
// verifier, or a fresh one where it changed since; a fresh per-topic agent
// to answer its findings, or the session where one reverses a ruling or
// the round is the third or later; a fresh per-topic agent to amend it,
// where the carry refused it, the refusal kept beside it until that
// agent's brief carries it; once passed, what its carry waits on, each
// record by its place; else ready to carry. A carried record never in
// the ledger is carried again.
// And the contradictions a unit's records name between sections of the
// sources they share — its approved specs, its discovery sessions and the
// assets its records walk — each by an open question's `at_odds`, two of
// those sections at least, which no decision answers (`oddsProblems`: no
// decision settles a point at odds while the migration runs): once every
// record of the unit has one composed or carried, each other record citing
// one of those sections names the same contradiction, such a question's
// `at_odds` holding those sections and no other,
// or the session marks it as carrying no side of the point, or as its
// own log's, settled after the approval
// (`.cache/migrate/records/{unit}.at-odds.json`, `{"{place}": [[{"path",
// "section"}, …]]}`, a log's `[{"log": [...]}]`), else it is named on that
// record, each side dated where its source shows when it was settled; and the unit's
// records wait on it as on a section no record cites. A section is read as
// the carry reads a cite (cited-sections.cjs), a mark's alike; whether two
// sections disagree, and whether a record carries a side of the point, is
// the session's to judge.
// A record of no entries keeps every rule but the cites: its old map, its
// threads and its imports are asked of it as of any. A topic promoted to a
// cross-cutting unit took only its discussion there: its research's threads
// stay with the unit it came from, and are read from there. Its reviews
// never folded in are in its log already, where the move folded them
// (078), cited as any section of it is. A file an agent left beside the
// records — in the unit's folder of them, or beside its own, no file a
// record is kept in — is named to remove: on the topic it is named for,
// else on the unit's own record, or each topic where it has none.
//
// The sections of the directive its agents' briefs draw, `briefed`: the
// topic's sources and its record, never the session's own work.
//
// Beside the check, the points to raise (21.6.10): each question of a
// carried record marked to raise, on a started topic not set aside of a
// unit in progress, which the engine answers, once the check passes, where
// it has no raise yet: raised at the topic, or at the unit's specification
// where the unit has its spec — its `spec.md`, or its specs joined — past
// which a topic takes no raise. A unit's own record is carried in
// discovery, where nothing is decided (8.3.4), and a topic never started —
// carried in discovery, or its item `unstarted` — reads its open questions
// at its first opening: their points stay open questions. A cross-cutting
// unit's record is the product's: its points stay open questions, the
// product's once the cut and the merges retire the unit (21.7.5), which
// the product's conversation opens on. A completed unit's points are
// settled by the code it built; a cancelled unit's, and a topic's set
// aside, wait with it (21.6.11). A topic leaving its building unit at the
// cut and the merges, as that step's check reads it — live, of a building
// epic, no spec joined into its spec.md drawing on it, nor a dead end the
// old map marked (21.8.9, 21.8.15) — raised at the unit's specification,
// would leave its answer with the unit it left, so its points stay open
// questions for its discussion where it goes. A
// record marking one of these to raise breaks a rule (`unraised`), so the
// carry refuses the mark that would never be raised. Each question is
// listed until it is answered or merged, and beside it each other record's
// marked to raise whose `at_odds` holds the same sections, a candidate for
// the session to judge one point with it or not by the texts the engine
// gives it; and each record marked as its own log's for them, its
// decisions citing a side, listed once the person answers until the
// answer replaces them or the session marks that it agrees; left open
// once raised, it is listed no more.
//
// `.workflows/` is read where the move read it: the working tree of the
// project's folder in the repository's main checkout, whichever checkout
// the session runs in (4.1.4), which holds what the old chain and the split
// changed there in the same run, none of it committed (21.5.8). It reads
// and changes nothing, and calls no model. Beside the check it answers a
// topic's sources as the rules read them, which the per-topic agent's
// brief draws (brief-records.cjs), with each heading of them a cite names
// by more than its own words (`heldTwice`), and a record laid against them
// for its verifier's walk (`sheetOf`): the topic's own markdown files, but its
// mail, its specs, the discovery sessions it draws on, the unit's walked
// assets and any other file an entry cites, each section by its lines with
// the entries citing it — of a file it does not walk, a spec of the unit's
// it draws no part of among them, only the sections cited. The unit's assets are every file under its
// `assets/` but a dotfile, each with where it came from, and an import
// whose file is gone; those walked are its markdown files but its specs,
// read as specs, and its legacy files, which
// the person sorts after the migration (21.5.24): the documents the person
// shared, walked by each of the unit's records, and the research a legacy
// split superseded (21.5.25), walked by the topic it was copied from alone
// where the split kept its name for a topic, else by the unit's own record
// alone, where it has one — what of it is current decided as any source's
// is, by its later answers.
// A topic's sources take the unit's approved specs it does not draw on
// too, the later answer to each of its points (21.6.3): searched for the
// answer, never walked; and the project's other units cancelled, so a
// corrigendum one wrote into a spec is known for no later answer.
// The topic's own files the walk and the empty-record rule read are its
// markdown files alone: a data file an experiment keeps is read through
// the record that names it.
//
// Known edges: a log with CRLF endings has no heading this reads, nor does
// a fence nested in a four-backtick block end where it should; the carried
// file sits in the cache, where a per-topic agent, which may write files,
// could overwrite it; and an epic's imports from its discovery as a whole,
// `discovery`, are owed by its own record where its discovery holds a
// session, and by no record where it holds none, staying in `assets/`
// unlinked until a topic links one.
//

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
// The cut and the merges' check, whose reading of what leaves a building unit
// the raises keep to (21.8.9).
const CUT = require('./080-cut-and-merges.check.cjs');
// The files a record is kept in, and what the carry still refuses a record
// its verifier passed for, read as the carry reads them.
const {
  COMPOSED, RECORD_ENDINGS, SETTLED_FROM, carriedPath, composedPath, findingsPath, refusedPath, settledPath, verifyingPath, handbackPath, roundsPath,
  briefedOn, recordHash, roundsKept, findingItems, handedBack, verdictGaps, verdictlessFiles, unsettledRound,
} = require('../record-files.cjs');
// The section a cite names, which every reader of a cite takes.
const { PATH_JOIN, HEADING, FENCE, outlineOf, citedSection, couldMean, nameOf, citeNameOf, shownPath } = require('../cited-sections.cjs');

/** @typedef {import('../cited-sections.cjs').Heading} Heading */

const CODE_TREE_STATE = '.workflows';
const TOPIC_PHASES = ['discovery', 'discussion', 'investigation'];
const SESSION_FILE = /^session-[0-9]{3,}\.md$/;
const EPIC = 'epic';
const LEDGER = '.ledger.jsonl';
const OPEN_THREADS = ['open', 'digging'];
const SET_ASIDE = ['cancelled', 'postponed'];
const IN_PROGRESS = 'in-progress';
const UNSTARTED = 'unstarted';
// A spec item the person approved, in the old manifest; a spec the move
// joined is past its gate, approved, whatever its item says (21.8.5).
const APPROVED_SPEC = 'completed';
// The spec a building unit's specs are joined into (078).
const JOINED_SPEC = 'spec.md';
// The sections of the directive its agents' briefs draw.
const BRIEFED = ["A Topic's Sources", "A Topic's Record"];
const ASSETS = 'assets';
// The directive this checks, by its file's name.
const DIRECTIVE = path.basename(__filename, '.check.cjs');
// The folders of a unit's assets the move fills (078), by what each holds.
const ASSET_FOLDERS = new Map([['specs', 'spec'], ['legacy', 'legacy'], ['research', 'research']]);
// The kinds of asset no record walks: a spec, read as a spec; a legacy file,
// the person's to sort.
const UNWALKED = Object.freeze(['spec', 'legacy']);
// A legacy split's copy of the research it superseded (077), by the name of
// the research it copied.
const SUPERSEDED_COPY = /^(.+)-superseded-[^/]+\.md$/;

/** @param {unknown} v @returns {v is Record<string, any>} */
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** @param {unknown} items @returns {Record<string, any>} */
const itemsOf = (items) => (isObject(items) ? items : {});

/** A name or a list of them, as a list. @param {unknown} named @returns {string[]} */
const namesOf = (named) => (Array.isArray(named) ? named : named === null || named === undefined ? [] : [named]).map(String);

/** @param {string} file @returns {any} */
function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** @param {string} file */
const isFile = (file) => fs.statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;

/** @param {string} file */
const readText = (file) => (isFile(file) ? fs.readFileSync(file, 'utf8') : null);

/** What git answers from `dir`, or null. @param {string} dir @param {string[]} args */
function git(dir, args) {
  const res = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: dir, encoding: 'utf8' });
  return res.status === 0 ? res.stdout : null;
}

/**
 * The project's folder in the repository's main checkout, where the move
 * found `.workflows/` (078), from the folder a session runs in: a linked
 * worktree's folder is not it.
 * @param {string} projectDir
 */
function mainProject(projectDir) {
  const common = git(projectDir, ['rev-parse', '--git-common-dir']);
  if (common === null) return projectDir;
  const dir = fs.realpathSync(path.resolve(projectDir, common.trim()));
  if (path.basename(dir) !== '.git') return projectDir;
  return path.resolve(path.dirname(dir), (git(projectDir, ['rev-parse', '--show-prefix']) ?? '').trim());
}

/** Whether a unit's manifest holds the topic in the phase. @param {Record<string, any>} manifest @param {string} phase @param {string} topic */
const holds = (manifest, phase, topic) => TOPIC_PHASES.includes(phase) && isObject(itemsOf(manifest.phases?.[phase]?.items)[topic]);

/** A topic's place, as the brief and the carry take it: the last phase holding it, where its record is carried. @param {Unit} unit @param {string} topic */
const topicPlace = (unit, topic) => `${unit.name}.${[...TOPIC_PHASES].reverse().find((phase) => holds(unit.manifest, phase, topic))}.${topic}`;

/** Headings by the part each is in, in their order. @param {Heading[]} headings @returns {Map<string|null, Heading[]>} */
function byPartOf(headings) {
  /** @type {Map<string|null, Heading[]>} */
  const parts = new Map();
  for (const heading of headings) parts.set(heading.part, [...(parts.get(heading.part) ?? []), heading]);
  return parts;
}

/** Whether a text holds anything past its headings and blank lines. @param {string} text */
const holdsText = (text) => text.split('\n').some((line) => line.trim() !== '' && (FENCE.test(line) || HEADING.exec(line) === null));

/** The topics a unit moved to a cross-cutting unit, promoted, each with the unit it went to, which carries its record. @param {Record<string, any>} manifest @returns {{topic: string, to: string}[]} */
const movedOf = (manifest) => Object.entries(itemsOf(manifest.phases?.discussion?.items))
  .filter(([, item]) => isObject(item) && item.status === 'promoted').map(([topic, item]) => ({ topic, to: String(item.promoted_to) }));

/** The topics of a unit's manifest the directive carries, once each, sorted. @param {Record<string, any>} manifest @returns {string[]} */
function topicsOf(manifest) {
  const promoted = new Set(movedOf(manifest).map(({ topic }) => topic));
  return [...new Set(TOPIC_PHASES.flatMap((phase) => Object.keys(itemsOf(manifest.phases?.[phase]?.items))))].filter((topic) => !promoted.has(topic)).sort();
}

/** The folders in `dir`, by name, sorted; none where it is no folder. @param {string} dir @returns {string[]} */
const foldersIn = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort() : []);

/**
 * The project as the rules read it: its folder in the main checkout, the
 * state, and, read once, the units `.workflows/` holds there and each one's
 * manifest.
 * And, read once, the topics leaving each building unit as the cut and the
 * merges reads them.
 * @typedef {{dir: string, stateDir: string, before: (name: string) => Record<string, any>|null, oldUnits: () => string[], leaving: (name: string) => Set<string>}} Project
 */

/** @param {string} projectDir @param {string} stateDir @returns {Project} */
function projectOf(projectDir, stateDir) {
  const dir = mainProject(projectDir);
  const old = path.join(dir, CODE_TREE_STATE);
  /** @type {Map<string, Record<string, any>|null>} */
  const befores = new Map();
  /** @type {string[]|null} */
  let units = null;
  /** @type {Map<string, Set<string>>} */
  const leavings = new Map();
  return {
    dir,
    stateDir,
    before: (name) => {
      if (!befores.has(name)) befores.set(name, readJson(path.join(old, name, 'manifest.json')));
      return befores.get(name) ?? null;
    },
    oldUnits: () => {
      units ??= foldersIn(old);
      return units;
    },
    leaving: (name) => {
      if (!leavings.has(name)) leavings.set(name, new Set((CUT.leavingOf({ projectDir: dir, stateDir, unit: name })?.leaving ?? []).map(({ topic }) => topic)));
      return /** @type {Set<string>} */ (leavings.get(name));
    },
  };
}

/**
 * A unit as the rules read it: its manifest in the state, and as
 * `.workflows/` holds it, from before the move.
 * @typedef {{name: string, manifest: Record<string, any>, before: Record<string, any>|null}} Unit
 */

/** @param {Project} project @param {string} name @returns {Unit} */
function unitOf(project, name) {
  return { name, manifest: readJson(path.join(project.stateDir, name, 'manifest.json')), before: project.before(name) };
}

/**
 * The units a topic's research is read from: its own, and each unit
 * `.workflows/` shows promoted the topic to it, which kept it (078).
 * @param {Project} project @param {Unit} unit @param {string} topic @returns {string[]}
 */
function homesOf(project, unit, topic) {
  const from = project.oldUnits().filter((name) => name !== unit.name && project.before(name)?.phases?.discussion?.items?.[topic]?.promoted_to === unit.name);
  return [unit.name, ...from];
}

/** The sessions a unit's discovery folder holds, each from the state's folder, sorted. @param {string} stateDir @param {string} name @returns {string[]} */
function discoverySessions(stateDir, name) {
  const folder = path.join(stateDir, name, 'discovery');
  return (fs.existsSync(folder) ? fs.readdirSync(folder).filter((file) => SESSION_FILE.test(file)).sort() : []).map((file) => `${name}/discovery/${file}`);
}

/**
 * The discovery sessions a record draws on: a unit's own, its unit's; a
 * topic's, its unit's and, where it was promoted, the unit's it came from.
 * @param {Project} project @param {Unit} unit @param {string|null} topic @returns {string[]}
 */
function sessionsOf(project, unit, topic) {
  return (topic === null ? [unit.name] : homesOf(project, unit, topic)).flatMap((home) => discoverySessions(project.stateDir, home));
}

/** Whether a unit has a record of its own: an epic, its discovery holding a session. @param {string} stateDir @param {string} name @param {Record<string, any>|null} manifest */
const hasOwnRecord = (stateDir, name, manifest) => manifest?.work_type === EPIC && discoverySessions(stateDir, name).length > 0;

/** The names a spec item's sources give, in their map form or the legacy list. @param {unknown} sources @returns {string[]} */
function sourceNames(sources) {
  if (Array.isArray(sources)) return sources.filter(isObject).map((row) => String(row.name ?? ''));
  return Object.keys(itemsOf(sources));
}

/**
 * The part of the unit's `spec.md` a spec joined there makes: its area's
 * heading, numbered as the move numbered it (078), or null where the file
 * heads no such part.
 * @param {Project} project @param {Unit} unit @param {string} name
 * @returns {string|null}
 */
function joinedPart(project, unit, name) {
  const number = joinedOf(unit.manifest).indexOf(name) + 1;
  const text = readText(path.join(project.stateDir, unit.name, JOINED_SPEC)) ?? '';
  return text.split('\n').map((line) => /^## (.*\S)\s*$/.exec(line)?.[1]).find((heading) => heading?.startsWith(`${number}. `)) ?? null;
}

/**
 * A spec of the unit's, as its manifest under `.workflows/` names it: where
 * the state keeps it, in `assets/specs/`, or joined into the unit's
 * `spec.md` (078, the topics `spec.joined` names), the part of it it makes;
 * whether it was approved — kept, its item completed; joined, past its gate
 * as the move joins none other, one reopened during the build among them
 * (21.8.5) — or is a draft, and an approved one's item's date, when it was
 * approved, where the item has one; and the topics it draws on, its
 * sources and the one it bears the name of.
 * @typedef {{name: string, path: string, part: string|null, approved: boolean, approvedOn: string|null, topics: string[]}} Spec
 */

/** The specs the move joined into a unit's `spec.md`, by name, in its order: none where it joined none. @param {Record<string, any>} manifest @returns {string[]} */
const joinedOf = (manifest) => (Array.isArray(manifest?.spec?.joined) ? manifest.spec.joined.map(String) : []);

/**
 * Where the state holds a spec of the unit's, and whether it was approved
 * (`Spec`); null where it holds none.
 * @param {Project} project @param {Unit} unit @param {string} name @param {unknown} item its old item
 * @returns {{path: string, part: string|null, approved: boolean}|null}
 */
function specHeld(project, unit, name, item) {
  const kept = `${unit.name}/assets/specs/${name}.md`;
  if (fs.existsSync(path.join(project.stateDir, kept))) return { path: kept, part: null, approved: isObject(item) && item.status === APPROVED_SPEC };
  return joinedOf(unit.manifest).includes(name) ? { path: `${unit.name}/${JOINED_SPEC}`, part: joinedPart(project, unit, name), approved: true } : null;
}

/** The unit's specs the state holds (`Spec`). @param {Project} project @param {Unit} unit @returns {Spec[]} */
function unitSpecs(project, unit) {
  return Object.entries(itemsOf(unit.before?.phases?.specification?.items)).flatMap(([name, item]) => {
    const held = specHeld(project, unit, name, item);
    if (held === null) return [];
    const approvedOn = held.approved && isObject(item) && typeof item.date === 'string' ? item.date : null;
    return [{ name, ...held, approvedOn, topics: [name, ...(isObject(item) ? sourceNames(item.sources) : [])] }];
  });
}

/** The topic's specs: each of the unit's that draws on it. @param {Project} project @param {Unit} unit @param {string} topic @returns {Spec[]} */
const specsOf = (project, unit, topic) => unitSpecs(project, unit).filter(({ topics }) => topics.includes(topic));

/**
 * The later answer to a topic's points: each approved spec of its unit
 * that does not draw on it — a kept spec, or a part of the unit's
 * `spec.md` (21.6.3).
 * @param {Project} project @param {Unit} unit @param {string} topic @returns {Spec[]}
 */
const laterOf = (project, unit, topic) => unitSpecs(project, unit).filter(({ approved, topics }) => approved && !topics.includes(topic));

/**
 * The project's units cancelled but `unit`, by name: a corrigendum one
 * wrote into another's spec is no later answer, a cancelled unit's
 * decisions governing nothing.
 * @param {Project} project @param {Unit} unit @returns {string[]}
 */
const cancelledOf = (project, unit) => unitsOf(project).filter(({ name, manifest }) => name !== unit.name && manifest?.status === 'cancelled').map(({ name }) => name);

/** The subtopics of the topic's old map, each with its state. @param {Unit} unit @param {string} topic @returns {{item: string, status: string}[]} */
function mapOf(unit, topic) {
  return Object.entries(itemsOf(unit.before?.phases?.discussion?.items?.[topic]?.subtopics))
    .map(([item, row]) => ({ item, status: String(isObject(row) ? row.status : '') }));
}

/**
 * The unit's research under a name none of its topics holds, nor one it
 * promoted: research that fed several topics (21.5.4), by name.
 * @param {Unit} unit @returns {string[]}
 */
function strayResearch(unit) {
  const named = new Set([...topicsOf(unit.manifest), ...movedOf(unit.manifest).map(({ topic }) => topic)]);
  return Object.keys(itemsOf(unit.before?.phases?.research?.items)).filter((name) => !named.has(name));
}

/**
 * The threads still open or digging a record carries, each with the
 * research it is of: a topic's, of its research wherever it stayed; and
 * those of the unit's research under no topic's name (`strayResearch`), the
 * unit's own record's where it has one, else each topic's — a unit of one
 * topic's, its topic's.
 * @param {Project} project @param {Unit} unit @param {string|null} topic
 * @returns {{thread: string, status: string, question: string, research: string}[]}
 */
function threadsOf(project, unit, topic) {
  const own = hasOwnRecord(project.stateDir, unit.name, unit.manifest);
  const carriesStray = topic === null ? own : !own;
  const stray = carriesStray ? strayResearch(unit).map((name) => ({ home: unit.name, name })) : [];
  const named = topic === null ? [] : homesOf(project, unit, topic).map((home) => ({ home, name: topic }));
  return [...named, ...stray].flatMap(({ home, name }) => Object.entries(itemsOf(project.before(home)?.phases?.research?.items?.[name]?.threads))
    .filter(([, row]) => isObject(row) && OPEN_THREADS.includes(row.status))
    .map(([thread, row]) => ({ thread, status: row.status, question: String(row.question ?? ''), research: name })));
}


/** What a unit's map row says its topic is about, or null where it says nothing. @param {Record<string, any>|null} manifest @param {string} topic @returns {string|null} */
function summaryOf(manifest, topic) {
  const summary = itemsOf(manifest?.phases?.discovery?.items)[topic]?.summary;
  return typeof summary === 'string' && summary.trim() !== '' ? summary.trim() : null;
}

/**
 * Whether a topic's record says what the topic is about: where another
 * record's brief lists the topic among the others (`othersOf`) — a home of
 * it, its unit or one that promoted it there, holds a record besides its
 * own, or a topic promoted from there — and no map row of those units says
 * it. A unit of one topic has none.
 * @param {Project} project @param {Unit} unit @param {string} topic
 */
const describes = (project, unit, topic) => {
  const homes = homesOf(project, unit, topic).map((home) => (home === unit.name ? unit : unitOf(project, home)));
  const listed = homes.some(({ name, manifest }) => hasOwnRecord(project.stateDir, name, manifest)
    || [...topicsOf(manifest), ...movedOf(manifest).map(({ topic: moved }) => moved)].some((other) => other !== topic));
  return listed && homes.every(({ manifest }) => summaryOf(manifest, topic) === null);
};

/** What a record that says what its topic is about lacks: the line. */
const UNDESCRIBED = 'no map row says what its topic is about, and its record says it in no line: give it "description", beside its entries, one line saying what the topic is about';

/**
 * What a topic is about, first that holds: its map row's summary in the
 * unit that names it; the line its record says it in, as carried or, before
 * that, as composed; or null, its name alone.
 * @param {Project} project @param {Record<string, any>} manifest the unit naming the topic @param {string} at the unit whose folder holds it @param {string} topic
 * @returns {string|null}
 */
const subjectOf = (project, manifest, at, topic) => summaryOf(manifest, topic) ?? descriptionOf(project, at, topic);

/**
 * The topics a record's discovery sessions may speak of besides its own,
 * once each: those of each unit whose sessions it draws on, by name, each
 * with the unit it was promoted to where it was, and its subject — what a
 * point of a shared source is judged whose by, never a source.
 * @param {Project} project @param {Unit} unit @param {string|null} topic
 * @returns {{topic: string, unit: string, to: string|null, subject: string|null}[]}
 */
function othersOf(project, unit, topic) {
  const homes = topic === null ? [unit.name] : homesOf(project, unit, topic);
  /** @type {Map<string, {topic: string, unit: string, to: string|null, subject: string|null}>} */
  const others = new Map();
  for (const home of homes) {
    const { manifest } = home === unit.name ? unit : unitOf(project, home);
    const named = [...topicsOf(manifest).map((other) => ({ topic: other, to: null })), ...movedOf(manifest)];
    for (const { topic: other, to } of named) {
      if (other !== topic && !others.has(other)) others.set(other, { topic: other, unit: home, to, subject: subjectOf(project, manifest, to ?? home, other) });
    }
  }
  return [...others.values()].sort((a, b) => (a.topic < b.topic ? -1 : 1));
}

/** Each file beneath a folder of the state, from the state's folder, sorted; none where it is no folder. @param {string} stateDir @param {string} rel @returns {string[]} */
function filesUnder(stateDir, rel) {
  /** @param {string} at @returns {string[]} */
  const under = (at) => fs.readdirSync(path.join(stateDir, at), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? under(`${at}/${entry.name}`) : [`${at}/${entry.name}`]));
  return fs.existsSync(path.join(stateDir, rel)) ? under(rel).sort() : [];
}

/** The markdown files of a topic's own folder but its mail, each from the state's folder, sorted. @param {Project} project @param {Unit} unit @param {string} topic @returns {string[]} */
function ownFilesOf(project, unit, topic) {
  const folder = `${unit.name}/topics/${topic}`;
  return filesUnder(project.stateDir, folder).filter((at) => at.endsWith('.md') && !at.startsWith(`${folder}/mail/`));
}

/** The text of a topic's own markdown files but its mail, none of a unit's own record, which has none. @param {Project} project @param {Unit} unit @param {string|null} topic */
const ownTextOf = (project, unit, topic) => (topic === null ? '' : ownFilesOf(project, unit, topic).map((at) => readText(path.join(project.stateDir, at)) ?? '').join('\n'));

const SHORT = 40;

/**
 * Whether `text` holds a section of a source word for word, its heading and
 * its text, the copy ending where a line does: a split's research the move
 * put into a topic's log, which the topic's verifier walks there. A section
 * whose text is one line under `SHORT` characters is never held.
 * @param {string[]} lines the source's @param {Heading} heading @param {string} text
 */
function heldIn(lines, { line, end }, text) {
  const body = lines.slice(line, end).join('\n').trim();
  if (!body.includes('\n') && body.length < SHORT) return false;
  const copy = lines.slice(line - 1, end).join('\n').trim();
  for (let at = text.indexOf(copy); at !== -1; at = text.indexOf(copy, at + 1)) {
    if ((text[at + copy.length] ?? '\n') === '\n') return true;
  }
  return false;
}

/**
 * Whether a record's own files hold a source word for word, each of its
 * sections holding text (`heldIn`), it holding one at least.
 * @param {Project} project @param {Unit} unit @param {string|null} topic @param {string} at
 */
function heldWhole(project, unit, topic, at) {
  const text = readText(path.join(project.stateDir, at)) ?? '';
  const lines = text.split('\n');
  const own = ownTextOf(project, unit, topic);
  const sections = outlineOf(text, false).filter((heading) => heading.text);
  return sections.length > 0 && sections.every((heading) => heldIn(lines, heading, own));
}

/**
 * A section of a source as the verifier's walk sheet lays it out: its
 * heading's path, the lines it spans, and the entries citing it.
 * @typedef {{section: string, line: number, end: number, entries: {ref: string, event: string, text: string}[]}} SheetSection
 */

/**
 * The sections of one file of the walk, in order: those holding text, in
 * a joined spec in the parts the topic draws on alone, but none of a file
 * it does not walk, a spec of the unit's it draws no part of, its later
 * answer, among them; and those an entry cites — a cite naming its
 * section as the carry reads it (`citedSection`) — each with every entry
 * citing it, once; but no section of a shared source,
 * a discovery session or a walked asset, the record's own files hold word
 * for word (`heldIn`) and no entry cites, which its walk of them reads.
 * @param {Project} project @param {Unit} unit @param {{specs: Spec[], walks: Set<string>, shared: Set<string>, own: string}} drawing the topic's specs, the paths of the files it walks, those of its shared sources, and its own files' text
 * @param {Record<string, any>[]} entries @param {string} at
 * @returns {SheetSection[]}
 */
function sheetSections(project, unit, { specs, walks, shared, own }, entries, at) {
  const parts = partsDrawn(specs, at);
  const text = readText(path.join(project.stateDir, at)) ?? '';
  const lines = text.split('\n');
  const headings = outlineOf(text, at === `${unit.name}/${JOINED_SPEC}`);
  /** @type {Map<Heading, Record<string, any>[]>} */
  const citing = new Map();
  for (const entry of entries) {
    const names = (Array.isArray(entry.cites) ? entry.cites.filter(isObject) : []).filter((cite) => cite.path === at).map(({ section }) => String(section));
    const named = new Set(names.map((name) => citedSection(headings, name)).filter((heading) => heading !== null));
    for (const heading of named) citing.set(heading, [...(citing.get(heading) ?? []), entry]);
  }
  const drawn = (/** @type {Heading} */ heading) => walks.has(at) && (parts === null || parts.includes(heading.part))
    && !(shared.has(at) && heldIn(lines, heading, own));
  return headings.filter((heading) => (heading.text && drawn(heading)) || citing.has(heading)).map((heading) => ({
    section: shownPath(headings, heading), line: heading.line, end: heading.end,
    entries: (citing.get(heading) ?? []).map(({ ref, event, text }) => ({ ref: String(ref), event: String(event), text: String(text ?? '') })),
  }));
}

/**
 * A record laid against its sources for its verifier to walk: each file in
 * the order its brief lists them — the topic's own but its mail, its
 * specs, the discovery sessions it draws on, the assets it walks — then
 * each other file an entry cites, each with its sections (`sheetSections`),
 * a file of none left out.
 * @param {Project} project @param {Unit} unit @param {string|null} topic @param {Record<string, any>[]} entries
 * @returns {{path: string, sections: SheetSection[]}[]}
 */
function sheetOf(project, unit, topic, entries) {
  const specs = topic === null ? [] : specsOf(project, unit, topic);
  const cited = entries.flatMap(({ cites }) => (Array.isArray(cites) ? cites.filter(isObject) : [])).map(({ path: at }) => String(at));
  const walked = assetsOf(project, unit).filter(({ walkers }) => walkers.includes(topic)).map(({ path: at }) => at);
  const sessions = sessionsOf(project, unit, topic);
  const walks = [...(topic === null ? [] : ownFilesOf(project, unit, topic)), ...specs.map(({ path: at }) => at), ...sessions, ...walked];
  const drawing = { specs, walks: new Set(walks), shared: new Set([...sessions, ...walked]), own: ownTextOf(project, unit, topic) };
  return [...new Set([...walks, ...cited])].filter((at) => isFile(path.join(project.stateDir, at)))
    .map((at) => ({ path: at, sections: sheetSections(project, unit, drawing, entries, at) })).filter(({ sections }) => sections.length > 0);
}

/** Whether the unit has its spec, past which a point is raised at its specification: its `spec.md`, or its specs joined. @param {Project} project @param {Unit} unit */
const hasSpec = (project, unit) => Array.isArray(unit.manifest?.spec?.joined) || isFile(path.join(project.stateDir, unit.name, JOINED_SPEC));

/**
 * Why a point a record marks to raise is never raised at the directive's
 * end, or null where it is: a unit's own record is carried in discovery,
 * where nothing is decided (8.3.4); a topic never started (`neverStarted`)
 * has its open questions read at its first opening; a cross-cutting unit's
 * record is the product's (21.7.5); a unit not in progress — completed,
 * its code the truth of what was built, or cancelled — and a topic set
 * aside raise nothing (21.6.11); and a topic leaving its building unit
 * (`leaves`) is discussed where it goes.
 * @param {Project} project @param {Unit} unit @param {string|null} topic @param {string} phase the record's
 * @returns {string|null}
 */
function unraised(project, unit, topic, phase) {
  if (topic === null) return 'a unit\'s own record is carried in discovery, where nothing is raised';
  if (unit.manifest?.work_type === 'cross-cutting') return 'a cross-cutting unit\'s record is the product\'s';
  if (unit.manifest?.status !== IN_PROGRESS) return `its unit is ${unit.manifest?.status}, and only a unit in progress raises its points`;
  if (TOPIC_PHASES.some((each) => SET_ASIDE.includes(itemsOf(unit.manifest.phases?.[each]?.items)[topic]?.status))) return 'its topic is set aside';
  if (neverStarted(unit.manifest, topic, phase)) return 'its topic never started, and its first opening reads its open questions';
  return leaves(project, unit, topic) ? 'its topic leaves its building unit, no spec joined into the unit\'s spec.md drawing on it, and its discussion where it goes reads its open questions' : null;
}

/**
 * Whether a topic leaves its unit at the cut and the merges (21.8.9), as
 * that step's check reads it: a live topic of a building epic that no spec
 * joined into its spec.md draws on, but a dead end the old map marked,
 * which stays (21.8.15). Its points are raised nowhere here: the unit's
 * specification takes no topic's, and the topic is discussed where it goes.
 * @param {Project} project @param {Unit} unit @param {string} topic
 */
const leaves = (project, unit, topic) => project.leaving(unit.name).has(topic);

/** Each entry a record marks to raise where its point is never raised. @param {Project} project @param {Unit} unit @param {string|null} topic @param {string} phase @param {Record<string, any>[]} record @returns {string[]} */
function raiseProblems(project, unit, topic, phase, record) {
  const why = unraised(project, unit, topic, phase);
  return why === null ? [] : record.filter(({ raise }) => raise === true).map(({ ref }) => `entry ${ref} is marked to raise, and ${why}: its point is an open question, carried unmarked`);
}

/** The topic an import's origin names: its own, or a unit of one topic that is no epic's from its discovery. @param {Unit} unit @param {unknown} origin @returns {string|null} */
function ownerOf(unit, origin) {
  if (typeof origin !== 'string') return null;
  if (origin !== 'discovery') return origin.split('/')[1] ?? null;
  const topics = topicsOf(unit.manifest);
  return unit.manifest.work_type !== 'epic' && topics.length === 1 ? topics[0] : null;
}

/**
 * The unit's imports, each by its path from the state, with where it came
 * in from, the topic owing its link, and whether the state holds its file.
 * @param {Project} project @param {Unit} unit @returns {{path: string, origin: string|null, owner: string|null, held: boolean}[]}
 */
function importsOf(project, unit) {
  return (Array.isArray(unit.manifest.imports) ? unit.manifest.imports : []).filter((entry) => isObject(entry) && typeof entry.path === 'string').map((entry) => {
    const at = `${unit.name}/${entry.path}`;
    return { path: at, origin: typeof entry.origin === 'string' ? entry.origin : null, owner: ownerOf(unit, entry.origin), held: isFile(path.join(project.stateDir, at)) };
  });
}

/**
 * One of the unit's assets: its path from the state; what it is, an
 * `import` — one the manifest lists, or a file come in with them — or the
 * kind its folder holds (`ASSET_FOLDERS`); where an import came in from,
 * and the record owing its link, a listed import's alone, a topic or the
 * unit's own, null; whether the state holds it; and the records walking
 * it (`walkersOf`).
 * @typedef {{path: string, kind: string, origin: string|null, owner: string|null, listed: boolean, held: boolean, walkers: (string|null)[]}} Asset
 */

/**
 * The records of the unit walking an asset of its: none of a file not
 * markdown, nor of a kind `UNWALKED` names; of a split's research, the
 * topic it was copied from, where the split kept its name for one, else
 * the unit's own record, where it has one; of any other, each.
 * @param {Project} project @param {Unit} unit @param {string} at @param {string} kind @returns {(string|null)[]}
 */
function walkersOf(project, unit, at, kind) {
  if (!at.endsWith('.md') || UNWALKED.includes(kind)) return [];
  const records = recordsOfUnit(project, unit);
  if (kind !== 'research') return records;
  const copied = SUPERSEDED_COPY.exec(path.posix.basename(at))?.[1] ?? null;
  return copied !== null && records.includes(copied) ? [copied] : records.filter((record) => record === null);
}

/**
 * The unit's assets (`Asset`): each file under its `assets/` but a
 * dotfile, sorted, then each import whose file is gone.
 * @param {Project} project @param {Unit} unit @returns {Asset[]}
 */
function assetsOf(project, unit) {
  const imports = importsOf(project, unit);
  const root = `${unit.name}/${ASSETS}`;
  /** @param {string} at */
  const kindOf = (at) => {
    const folder = at.slice(root.length + 1).split('/');
    return folder.length > 1 ? ASSET_FOLDERS.get(folder[0]) ?? 'import' : 'import';
  };
  const held = filesUnder(project.stateDir, root).filter((at) => !at.slice(root.length + 1).split('/').some((name) => name.startsWith('.'))).map((at) => {
    const listed = imports.find((entry) => entry.path === at);
    const kind = listed === undefined ? kindOf(at) : 'import';
    return { path: at, kind, origin: listed?.origin ?? null, owner: listed?.owner ?? null, listed: listed !== undefined, held: true, walkers: walkersOf(project, unit, at, kind) };
  });
  const gone = imports.filter((entry) => !entry.held).map((entry) => ({ ...entry, kind: 'import', listed: true, walkers: [] }));
  return [...held, ...gone];
}

/**
 * Whether a cite's path stays where it names wherever the entry goes: a
 * file of the topic's own but its mail, of the unit's beside its topics,
 * or one of the discovery sessions the record draws on.
 * @param {Project} project @param {Unit} unit @param {string|null} topic @param {string} cited
 */
function lasting(project, unit, topic, cited) {
  const own = `${unit.name}/topics/${topic}/`;
  if (topic !== null && cited.startsWith(own)) return !cited.startsWith(`${own}mail/`);
  if (cited.startsWith(`${unit.name}/`) && !cited.startsWith(`${unit.name}/topics/`)) return true;
  return sessionsOf(project, unit, topic).includes(cited);
}

/**
 * The parts of the spec at `at` a topic draws on, its specs' parts there:
 * null where it draws on none of them, so a cite counts in every part.
 * @param {{path: string, part: string|null}[]} specs @param {unknown} at @returns {(string|null)[]|null}
 */
function partsDrawn(specs, at) {
  const parts = specs.filter((spec) => spec.path === at && spec.part !== null).map(({ part }) => part);
  return parts.length > 0 ? parts : null;
}

/**
 * What a cited section lacks: a file named by its path from the state's
 * folder — a whole path in it so refused, naming that path — that stays
 * with its entry, which the state holds, holding a heading the cite names;
 * and one heading alone so named (`citedSection`), else the name of each it
 * could mean.
 * @param {Project} project @param {Unit} unit @param {string|null} topic
 * @param {Record<string, unknown>} cite @returns {string[]}
 */
function citeProblems(project, unit, topic, { path: cited, section }) {
  const within = typeof cited === 'string' && cited.startsWith(`${project.stateDir}${path.sep}`) ? cited.slice(project.stateDir.length + 1) : null;
  if (within !== null) return [`cites ${cited}, a whole path — a cite names its file by its path from the state's folder: ${within}`];
  if (typeof cited !== 'string' || !lasting(project, unit, topic, cited)) {
    return [`cites ${cited}, which is neither its topic's own, but its mail, nor the unit's beside its topics, nor a discovery session it draws on — a cite names a file that stays with its entry`];
  }
  const text = readText(path.join(project.stateDir, cited));
  if (text === null) return [`cites ${cited}, which the state does not hold`];
  const name = String(section);
  const headings = outlineOf(text, cited === `${unit.name}/${JOINED_SPEC}`);
  if (citedSection(headings, name) !== null) return [];
  const reached = couldMean(headings, name);
  if (reached.length === 0) return [`cites "${name}" in ${cited}, which has no such heading${name.includes(PATH_JOIN) ? ' path' : ''}`];
  const told = [...new Set(reached.map((heading) => citeNameOf(headings, heading)))].map((each) => `"${each}"`);
  return [`cites "${name}" in ${cited}, which holds ${told.length} headings so named — a cite names one, by its part in a joined spec, by the path that tells it apart, or, of headings sharing their path, by its place among them: ${told.join(', ')}`];
}

// Where a record holds nothing decided, as its faults name it: carried in
// discovery, or of a topic never started carried past it, its item
// `unstarted` (`neverStarted`).
const IN_DISCOVERY = 'in discovery';
const NOT_STARTED = 'on a topic never started';

/**
 * Whether a topic never started, its record carried in `phase`: carried in
 * discovery, or its item there `unstarted`, a message parked on it never
 * opened.
 * @param {Record<string, any>|null} manifest @param {string} topic @param {string} phase
 */
const neverStarted = (manifest, topic, phase) => phase === 'discovery' || itemsOf(manifest?.phases?.[phase]?.items)[topic]?.status === UNSTARTED;

/**
 * What a record holding nothing decided holds that it may not — carried in
 * discovery, or of a topic never started: a decision, or an entry marked
 * product-wide.
 * @param {Record<string, any>[]} record @param {string} where
 * @returns {string[]}
 */
function undecidedProblems(record, where) {
  return record.flatMap(({ ref, event, product_wide: wide }) => {
    if (event === 'decided') return [`entry ${ref} decides, and nothing is decided ${where} — what its sources settle is a finding, what they leave open a question`];
    return wide === true ? [`entry ${ref} is product-wide, and nothing found ${where} is product-wide — a line for the product record is decided in the first topic it bears on`] : [];
  });
}

/**
 * What a cross-cutting unit's record holds that is not the product's: a
 * finding or decision not marked product-wide.
 * @param {Record<string, any>[]} record @returns {string[]}
 */
function narrowProblems(record) {
  return record.filter(({ event, product_wide: wide }) => event !== 'asked' && wide !== true)
    .map(({ ref }) => `entry ${ref} is not product-wide, and a cross-cutting unit's findings and decisions all are — the reshape keeps the unit as the product's`);
}

/**
 * Each import the record owes a link that none of its entries links: a
 * topic's from it, a unit's own those from its discovery as a whole.
 * @param {Project} project @param {Unit} unit @param {string|null} topic @param {Record<string, any>[]} record @returns {string[]}
 */
function unlinkedImports(project, unit, topic, record) {
  return importsOf(project, unit).filter((entry) => entry.owner === topic && entry.held)
    .filter((entry) => !record.some(({ assets }) => Array.isArray(assets) && assets.some((asset) => isObject(asset) && asset.path === entry.path)))
    .map((entry) => `${entry.path} came in from ${entry.origin}, and no entry links it`);
}

/** Each thread the record carries (`threadsOf`) that no entry names. @param {Project} project @param {Unit} unit @param {string|null} topic @param {Record<string, any>[]} record @returns {string[]} */
function threadProblems(project, unit, topic, record) {
  const named = new Set(record.flatMap((entry) => namesOf(entry.thread)));
  return threadsOf(project, unit, topic).filter(({ thread }) => !named.has(thread))
    .map(({ thread, status, research }) => `the thread ${thread} is still ${status} in ${research === topic ? 'its research' : `the research ${research}`}, and no entry names it as its thread`);
}

/** Each entry's cite problems, or that it cites nothing. @param {Project} project @param {Unit} unit @param {string|null} topic @param {Record<string, any>[]} record @returns {string[]} */
function citesProblems(project, unit, topic, record) {
  return record.flatMap(({ ref, cites: given }) => {
    if (!Array.isArray(given) || given.length === 0) return [`entry ${ref} cites nothing`];
    return given.filter(isObject).flatMap((cite) => citeProblems(project, unit, topic, cite)).map((problem) => `entry ${ref} ${problem}`);
  });
}

/**
 * What a unit's own record breaks of the rules (the header's): it is
 * carried in discovery, decides nothing, cites what stays, names each
 * thread of research no topic's name holds, and links the imports from the
 * unit's discovery as a whole that no topic owes.
 * @param {Project} project @param {Unit} unit @param {Record<string, any>[]} record @returns {string[]}
 */
function ownProblems(project, unit, record) {
  return [
    ...undecidedProblems(record, IN_DISCOVERY), ...citesProblems(project, unit, null, record), ...threadProblems(project, unit, null, record),
    ...unlinkedImports(project, unit, null, record), ...raiseProblems(project, unit, null, 'discovery', record), ...oddsProblems(project, unit, null, 'discovery', record),
  ];
}

/**
 * The heading a cite names alone (`citedSection`), keyed by its file and
 * its line, so one heading spelled two ways is one key; null where it
 * names none.
 * @param {Project} project @param {Unit} unit @param {Record<string, unknown>} cite @returns {string|null}
 */
function headingKey(project, unit, { path: at, section }) {
  const text = typeof at === 'string' ? readText(path.join(project.stateDir, at)) : null;
  const heading = text === null ? null : citedSection(outlineOf(text, at === `${unit.name}/${JOINED_SPEC}`), String(section));
  return heading === null ? null : `${at}\n${heading.line}`;
}

/**
 * The question of the record holding `at_odds` that a question is, or is
 * part of, through its `part_of`; null where none is.
 * @param {Record<string, any>[]} record @param {unknown} ref @returns {string|null}
 */
function oddsOver(record, ref) {
  const questions = new Map(record.filter(({ event }) => event === 'asked').map((entry) => [entry.ref, entry]));
  for (let at = questions.get(ref), seen = new Set(); at !== undefined && !seen.has(at); seen.add(at), at = questions.get(at.part_of)) {
    if (Array.isArray(at.at_odds)) return String(at.ref);
  }
  return null;
}

/**
 * How a decision settles a point at odds, or null where it settles none:
 * every way the record's shape lets a decision stand as the answer to a
 * question holding `at_odds` — holding `at_odds` itself, answering such a
 * question, or answering a question part of one. A record carries no
 * replacement and no merge, so these are all.
 * @param {Record<string, any>[]} record @param {Record<string, any>} decision @returns {string|null}
 */
function settlesOdds(record, { at_odds: odds, answers }) {
  if (Array.isArray(odds)) return 'it holds at_odds';
  const over = oddsOver(record, answers);
  if (over === null) return null;
  return over === answers ? `it answers ${over}, which holds at_odds` : `it answers ${answers}, part of ${over}, which holds at_odds`;
}

/**
 * What an open question's `at_odds` breaks of its shape: two headings at
 * least, each one a cite of it names, read by the one resolver, so one
 * heading spelled two ways is one side; null where it breaks none.
 * @param {Project} project @param {Unit} unit @param {Record<string, any>} question @returns {string|null}
 */
function oddsShapeProblem(project, unit, { at_odds: odds, ...question }) {
  const named = Array.isArray(odds) ? odds.map((side) => (isObject(side) ? headingKey(project, unit, side) : null)) : [null];
  const cited = new Set(citesIn(question).map((cite) => headingKey(project, unit, cite)));
  if (named.some((key) => key === null || !cited.has(key))) return 'its at_odds names a section none of its cites names';
  return new Set(named).size > 1 ? null : 'its at_odds names one section';
}

// The way out of a point at odds a later answer settles, as a record's
// faults name it beside keeping the question open.
const SETTLED_WAY = 'where a later answer settles the point, it is no point at odds: no entry holds at_odds for it, its question is not marked to raise, and the decision answers it';

/**
 * What a record's points at odds break of the rules: no decision settles
 * one while the migration runs (`settlesOdds`); only an open question
 * names one, its `at_odds` shaped (`oddsShapeProblem`) and, where its
 * topic raises (`unraised`), marked to raise, a point no source settles.
 * @param {Project} project @param {Unit} unit @param {string|null} topic @param {string} phase @param {Record<string, any>[]} record @returns {string[]}
 */
function oddsProblems(project, unit, topic, phase, record) {
  const raises = unraised(project, unit, topic, phase) === null;
  return record.flatMap((entry) => {
    const how = entry.event === 'decided' ? settlesOdds(record, entry) : null;
    if (how !== null) return [`entry ${entry.ref}: a decision settles no point at odds while the migration runs — ${how}: ${SETTLED_WAY}; where none does, the question stays open, and the findings carrying each side name each other`];
    if (entry.at_odds === undefined) return [];
    if (entry.event !== 'asked') return [`entry ${entry.ref}: at_odds is an open question's — the findings carrying each side of a point at odds name each other in words`];
    const shape = oddsShapeProblem(project, unit, entry);
    if (shape !== null) return [`entry ${entry.ref}: ${shape} — the sections at odds, [{path, section}, …], are two at least, each one a cite of it names`];
    return raises && entry.raise !== true ? [`entry ${entry.ref} names a point at odds, which no source settles, and is not marked to raise: mark it raise true`] : [];
  });
}

/**
 * What a topic's record breaks of the rules, carried in `phase`: the record
 * as `ledger carry` takes it, `{"entries": [...]}`, each entry its ref,
 * event, the ref of the question it answers, its cites, its map item and
 * thread, each a name or a list, and its assets; and beside its entries the
 * line saying what its topic is about, where no map row says it.
 * @param {Project} project @param {Unit} unit @param {string|null} topic @param {string} phase @param {Record<string, any>[]} record @param {unknown} description
 * @returns {string[]}
 */
function problemsOf(project, unit, topic, phase, record, description) {
  if (topic === null) return ownProblems(project, unit, record);
  const undescribed = describes(project, unit, topic) && (typeof description !== 'string' || description.trim() === '') ? [UNDESCRIBED] : [];
  const imports = unlinkedImports(project, unit, topic, record);
  const sourced = specsOf(project, unit, topic).length > 0 || ownFilesOf(project, unit, topic).some((at) => holdsText(readText(path.join(project.stateDir, at)) ?? ''));
  const empty = record.length === 0 && sourced ? ['its record is empty, and it has sources — a spec it draws on, or its own markdown files holding text past their headings: compose it from them'] : [];
  const undecided = neverStarted(unit.manifest, topic, phase) ? undecidedProblems(record, phase === 'discovery' ? IN_DISCOVERY : NOT_STARTED) : [];
  const narrow = unit.manifest?.work_type === 'cross-cutting' ? narrowProblems(record) : [];
  const cites = citesProblems(project, unit, topic, record);
  const items = new Set(record.flatMap((entry) => namesOf(entry.map_item)));
  const mapped = mapOf(unit, topic).filter(({ item }) => !items.has(item))
    .map(({ item, status }) => `${item} is on its old map, ${status}, and no entry names it as its map_item`);
  return [
    ...undescribed, ...empty, ...undecided, ...narrow, ...cites, ...mapped, ...threadProblems(project, unit, topic, record), ...imports,
    ...raiseProblems(project, unit, topic, phase, record), ...oddsProblems(project, unit, topic, phase, record),
  ];
}

/** The ids the ledger's lines were given. @param {string} stateDir @returns {Set<string>} */
function ledgerIds(stateDir) {
  const file = path.join(stateDir, LEDGER);
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
  return new Set(lines.map((line) => JSON.parse(line).id));
}

/** Each unit of the state, by its name, sorted. @param {Project} project @returns {Unit[]} */
function unitsOf(project) {
  return fs.readdirSync(project.stateDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && fs.existsSync(path.join(project.stateDir, entry.name, 'manifest.json')))
    .map((entry) => entry.name).sort().map((name) => unitOf(project, name));
}

/** What `ledger carry` kept of a record, or null. @param {Project} project @param {Unit} unit @param {string|null} topic */
const carriedOf = (project, unit, topic) => readJson(path.join(project.stateDir, carriedPath(unit.name, topic)));

/**
 * Why a record has not passed its verifier, null where it has: the
 * verifier's findings beside it as composed, an empty file its pass, none
 * where no verifier has written since — but where the session settled a
 * late round's findings, the note beside the record marked so, its pass
 * (`ledger settle`).
 * @param {string} stateDir @param {string} unit @param {string|null} topic @returns {string|null}
 */
function unverified(stateDir, unit, topic) {
  const findings = path.join(stateDir, findingsPath(unit, topic));
  const text = readText(findings);
  if (text === null) {
    if (settledBySession(stateDir, unit, topic)) return null;
    return isFile(path.join(stateDir, verifyingPath(unit, topic))) ? `its verifier has not reported yet, no findings written to ${findings}` : 'no verifier has been briefed on it';
  }
  return text.trim() === '' ? null : `its findings stand in ${findings}`;
}

/** Whether the note beside a record marks it as the session settled it. @param {string} stateDir @param {string} unit @param {string|null} topic */
function settledBySession(stateDir, unit, topic) {
  try {
    return readJson(path.join(stateDir, verifyingPath(unit, topic)))?.settled === true;
  } catch {
    return false;
  }
}

/** The sections of the unit's specs the session marked as holding no topic's decision, from the state's folder. @param {string} unit */
const sectionsMarked = (unit) => `${COMPOSED}/${unit}.sections.json`;

/**
 * Each file beside a unit's records that no record is kept in — in its
 * folder of them, or beside its own record — each with the topic it is
 * named for, null where it names none of the unit's.
 * @param {Project} project @param {Unit} unit @returns {{at: string, topic: string|null}[]}
 */
function strayRecordFiles(project, unit) {
  const topics = topicsOf(unit.manifest);
  const kept = (/** @type {string} */ name, /** @type {string} */ stem) => RECORD_ENDINGS.some((ending) => name === `${stem}${ending}`);
  const folder = `${COMPOSED}/${unit.name}`;
  const inFolder = filesUnder(project.stateDir, folder).filter((at) => !topics.some((topic) => kept(at.slice(folder.length + 1), topic)));
  const beside = fs.existsSync(path.join(project.stateDir, COMPOSED)) ? fs.readdirSync(path.join(project.stateDir, COMPOSED), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${unit.name}.`) && !kept(entry.name, unit.name) && ![sectionsMarked, atOddsMarked].some((marks) => `${COMPOSED}/${entry.name}` === marks(unit.name)))
    .map((entry) => `${COMPOSED}/${entry.name}`) : [];
  return [...inFolder, ...beside].map((at) => ({ at, topic: topics.find((topic) => at.startsWith(`${folder}/${topic}.`)) ?? null }));
}

/**
 * A topic's record as carried or, before that, as composed, whole — its
 * entries, and where it gives one the line saying what its topic is about —
 * or null where it has none yet, or none that reads.
 * @param {Project} project @param {string} unit @param {string|null} topic @returns {{entries: unknown[], description?: unknown}|null}
 */
function wholeRecordOf(project, unit, topic) {
  const carried = readJson(path.join(project.stateDir, carriedPath(unit, topic)));
  if (carried !== null) return carried.record;
  try {
    const composed = readJson(path.join(project.stateDir, composedPath(unit, topic)));
    return isObject(composed) && Array.isArray(composed.entries) ? composed : null;
  } catch {
    return null;
  }
}

/** A topic's record's entries, as carried or composed (`wholeRecordOf`). @param {Project} project @param {Unit} unit @param {string|null} topic @returns {Record<string, any>[]|null} */
const recordOf = (project, unit, topic) => wholeRecordOf(project, unit.name, topic)?.entries.filter(isObject) ?? null;

/** The line a topic's record says what the topic is about in, or null. @param {Project} project @param {string} unit @param {string} topic */
function descriptionOf(project, unit, topic) {
  const said = wholeRecordOf(project, unit, topic)?.description;
  return typeof said === 'string' && said.trim() !== '' ? said.trim() : null;
}

/** What the session marked in a file of marks, from the state's folder: nothing where it will not read. @param {Project} project @param {string} rel @returns {Record<string, any>} */
function marksIn(project, rel) {
  try {
    return itemsOf(readJson(path.join(project.stateDir, rel)));
  } catch {
    return {};
  }
}

/** What the session marked of the unit's specs, by each spec's path. @param {Project} project @param {Unit} unit */
const marksOf = (project, unit) => marksIn(project, sectionsMarked(unit.name));

/** A key of a spec's path and a name in it. @param {string} at @param {string|null} name */
const specKey = (at, name) => `${at}\n${name ?? ''}`;

/**
 * The cites of a topic's record, each with the parts of its spec it counts
 * in: those the topic draws on, null for a spec it draws on whole, none of
 * one it draws no part of — its later answer, a cite of which gives that
 * answer alone (21.6.15).
 * @param {Project} project @param {Unit} unit @param {string} topic @param {Record<string, any>[]} record
 * @returns {{path: string, name: string, parts: (string|null)[]|null}[]}
 */
function citesOf(project, unit, topic, record) {
  const specs = specsOf(project, unit, topic);
  const countedIn = (/** @type {string} */ at) => (specs.some((spec) => spec.path === at) ? partsDrawn(specs, at) : []);
  return record.flatMap(({ cites }) => (Array.isArray(cites) ? cites.filter(isObject) : [])).map(({ path: at, section }) => ({ path: String(at), name: String(section), parts: countedIn(String(at)) }));
}

/**
 * The sections of a spec the session marked as holding no topic's, each
 * by its path: a part's as `{"{path}": {"{part}": [...]}}` marks them, any
 * other as `{"{path}": [...]}`.
 * @param {Record<string, any>} marked @param {string} at @param {string|null} part @returns {string[]}
 */
function markedIn(marked, at, part) {
  const marks = marked[at];
  if (part === null) return Array.isArray(marks) ? namesOf(marks) : [];
  return isObject(marks) && !Array.isArray(marks) ? namesOf(marks[part]) : [];
}

/** The mark that settles a section as holding no topic's. @param {string} at @param {string|null} part @param {string} section */
const markOf = (at, part, section) => JSON.stringify({ [at]: part === null ? [section] : { [part]: [section] } });

/** `topic` added to those `key` holds. @param {Map<string, Set<string>>} map @param {string} key @param {Iterable<string>} topics */
const drawnBy = (map, key, topics) => map.set(key, new Set([...(map.get(key) ?? []), ...topics]));

/**
 * A section of a source holding text that no record of its unit cites, nor
 * the session marked as holding no record's: its file, its part of a joined
 * spec, the name a cite gives it (`citeNameOf`) and the name a mark gives
 * it in its part, the records it is named on, a unit's own `null`, and the
 * kind of source it is in: an approved spec, a discovery session or an
 * asset.
 * @typedef {{path: string, part: string|null, section: string, mark: string, topics: (string|null)[], kind: 'spec'|'session'|'asset'}} Uncited
 */

/**
 * The sections of a unit's approved specs no record cites (`Uncited`), each
 * named on the topics drawing on it: in a joined spec, those whose part
 * holds it, any other section the spec's every topic's — once every topic
 * of it has a record composed or carried; none before.
 * @param {Project} project @param {Unit} unit @returns {Uncited[]}
 */
function uncitedOf(project, unit) {
  const topics = topicsOf(unit.manifest);
  const records = topics.map((topic) => recordOf(project, unit, topic));
  if (records.some((record) => record === null)) return [];
  const cites = topics.flatMap((topic, at) => citesOf(project, unit, topic, /** @type {Record<string, any>[]} */ (records[at])));
  const marked = marksOf(project, unit);
  /** @type {Map<string, Set<string>>} */
  const bySpec = new Map();
  /** @type {Map<string, Set<string>>} */
  const byPart = new Map();
  for (const topic of topics) {
    for (const spec of specsOf(project, unit, topic).filter(({ approved }) => approved)) {
      drawnBy(bySpec, spec.path, [topic]);
      if (spec.part !== null) drawnBy(byPart, specKey(spec.path, spec.part), [topic]);
    }
  }
  return [...bySpec].flatMap(([at, drawn]) => {
    const headings = outlineOf(readText(path.join(project.stateDir, at)) ?? '', at === `${unit.name}/${JOINED_SPEC}`);
    const cited = new Set(cites.filter((cite) => cite.path === at).map(({ name, parts }) => {
      const heading = citedSection(headings, name);
      return heading !== null && (parts === null || parts.includes(heading.part)) ? heading : null;
    }));
    return [...byPartOf(headings)].flatMap(([part, held]) => {
      const settled = new Set([...held.filter((heading) => cited.has(heading)), ...markedIn(marked, at, part).map((name) => citedSection(held, name))]);
      return held.filter((heading) => heading.text && !settled.has(heading)).map((heading) => ({
        path: at, part, section: citeNameOf(headings, heading), mark: nameOf(held, heading), topics: [...(byPart.get(specKey(at, part)) ?? drawn)], kind: /** @type {const} */ ('spec'),
      }));
    });
  });
}

/** A record of a unit's, a topic's by its name or its own, null. @typedef {{unit: Unit, topic: string|null}} RecordOf */

/** The records of a unit: each topic's, by its name, and its own, `null`, where it has one. @param {Project} project @param {Unit} unit @returns {(string|null)[]} */
const recordsOfUnit = (project, unit) => [...topicsOf(unit.manifest), ...(hasOwnRecord(project.stateDir, unit.name, unit.manifest) ? [null] : [])];

/**
 * The sources a unit's records walk in common, holding text past their
 * headings, each by its path with what it is, the topic owing it, an
 * import's; the records walking it; and the records whose cites, and own
 * files word for word, settle its sections, any record of the unit, of a
 * session a topic it promoted too: the unit's discovery sessions, walked
 * by each of its records and each topic it promoted, carried where it
 * went; and its walked assets.
 * @param {Project} project @param {Unit} unit
 * @returns {{path: string, kind: 'session'|'asset', owner: string|null, walkers: RecordOf[], readers: RecordOf[]}[]}
 */
function sharedOf(project, unit) {
  const promoted = movedOf(unit.manifest).map(({ topic, to }) => ({ unit: unitOf(project, to), topic }));
  const ours = (/** @type {(string|null)[]} */ topics) => topics.map((topic) => ({ unit, topic }));
  const records = ours(recordsOfUnit(project, unit));
  const sessions = discoverySessions(project.stateDir, unit.name)
    .map((at) => ({ path: at, kind: /** @type {const} */ ('session'), owner: null, walkers: [...records, ...promoted], readers: [...records, ...promoted] }));
  const assets = assetsOf(project, unit).filter(({ walkers }) => walkers.length > 0).map(({ path: at, owner, walkers }) => ({
    path: at, kind: /** @type {const} */ ('asset'), owner, walkers: ours(walkers), readers: records,
  }));
  return [...sessions, ...assets].filter(({ path: at }) => holdsText(readText(path.join(project.stateDir, at)) ?? ''));
}

/**
 * The sections of a unit's shared sources no record of it cites
 * (`Uncited`), each named on the topic an import came in from, or a
 * split's research was copied from, else on the unit's own record, else
 * on each of its topics — a source's once every record walking it has one
 * composed or carried; none before. A section a topic holds word for word
 * in its own markdown files (`heldIn`) is that topic's verifier's to walk
 * there, with its log's later word, and settled.
 * @param {Project} project @param {Unit} unit @returns {Uncited[]}
 */
function uncitedSharedOf(project, unit) {
  const marked = marksOf(project, unit);
  const topics = topicsOf(unit.manifest);
  /** @type {Map<string, {entries: Record<string, any>[]|null, own: string}>} */
  const read = new Map();
  const readOf = (/** @type {RecordOf} */ { unit: of, topic }) => {
    const key = `${of.name}/${topic}`;
    if (!read.has(key)) read.set(key, { entries: recordOf(project, of, topic), own: ownTextOf(project, of, topic) });
    return /** @type {{entries: Record<string, any>[]|null, own: string}} */ (read.get(key));
  };
  return sharedOf(project, unit).flatMap(({ path: at, kind, owner, walkers, readers }) => {
    if (walkers.some((walker) => readOf(walker).entries === null)) return [];
    const cites = readers.flatMap((reader) => readOf(reader).entries ?? []).flatMap(({ cites: given }) => (Array.isArray(given) ? given.filter(isObject) : []));
    const text = readText(path.join(project.stateDir, at)) ?? '';
    const lines = text.split('\n');
    const held = outlineOf(text, false);
    const named = [...cites.filter((cite) => cite.path === at).map(({ section }) => String(section)), ...markedIn(marked, at, null)];
    const settled = new Set(named.map((name) => citedSection(held, name)));
    const copied = (/** @type {Heading} */ heading) => readers.some((reader) => heldIn(lines, heading, readOf(reader).own));
    const inUnit = walkers.filter((walker) => walker.unit.name === unit.name).map(({ topic }) => topic);
    const on = owner !== null && topics.includes(owner) ? [owner] : inUnit.includes(null) ? [null] : inUnit;
    return held.filter((heading) => heading.text && !settled.has(heading) && !copied(heading))
      .map((heading) => ({ path: at, part: null, section: citeNameOf(held, heading), mark: citeNameOf(held, heading), topics: on, kind }));
  });
}

/** The contradictions the session marked as no side of a record's cites, from the state's folder. @param {string} unit */
const atOddsMarked = (unit) => `${COMPOSED}/${unit}.at-odds.json`;

/** A record's place, as the check names it: a topic's, or a unit's own. @param {Unit} unit @param {string|null} topic */
const recordPlace = (unit, topic) => (topic === null ? `${unit.name}.discovery` : topicPlace(unit, topic));

/** A section of a source the unit's records share, by its file and its name alone there. @typedef {{path: string, section: string}} Side */

/** Sections by their file and their line, which tells copies of one heading apart. @typedef {Map<string, Side>} Sides */

/** The cites an entry gives, none where it gives none. @param {Record<string, any>} entry @returns {Record<string, unknown>[]} */
const citesIn = ({ cites }) => (Array.isArray(cites) ? cites.filter(isObject) : []);

/** One key of a set of sections, whichever order they come in. @param {Sides} sides */
const keyOfSides = (sides) => [...sides.keys()].sort().join('\n\n');

/** Names in a sentence: `a and b`, `a, b and c`. @param {string[]} names */
const inWords = (names) => (names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** Sections as a sentence names them, each in its file by its whole path, with when it was settled where that shows. @param {Project} project @param {Side[]} sides @param {(string|null)[]} [dates] */
const sidesSaid = (project, sides, dates = []) => inWords(sides.map(({ path: at, section }, index) => `"${section}" in ${path.join(project.stateDir, at)}${dates[index] ? ` (${dates[index]})` : ''}`));

/**
 * The files a record the session amends is settled in, by their whole
 * paths: the settled file a line goes into, and the findings a `Settled:`
 * finding goes into.
 * @param {Project} project @param {Unit} unit @param {string|null} topic
 */
const settledIn = (project, unit, topic) => ({ settled: path.join(project.stateDir, settledPath(unit.name, topic)), findings: path.join(project.stateDir, findingsPath(unit.name, topic)) });

/**
 * How the sections a contradiction sits in are read, in the sources a
 * unit's records share — its approved specs, its discovery sessions and the
 * assets its records walk: each a cite names alone (`citedSection`), by
 * the name a cite gives it (`citeNameOf`), a record's cites and a mark's
 * alike. A cite of any other file, or naming none alone, names none.
 * @param {Project} project @param {Unit} unit @returns {(cites: Record<string, unknown>[]) => Sides}
 */
function sidesReader(project, unit) {
  const shared = new Set([...unitSpecs(project, unit).filter(({ approved }) => approved).map(({ path: at }) => at), ...sharedOf(project, unit).map(({ path: at }) => at)]);
  const outline = outlinesOf(project, unit);
  return (cites) => new Map(cites.flatMap(({ path: at, section }) => {
    if (typeof at !== 'string' || !shared.has(at)) return [];
    const headings = outline(at);
    const heading = citedSection(headings, String(section));
    return heading === null ? [] : [[`${at}\n${heading.line}`, { path: at, section: citeNameOf(headings, heading) }]];
  }));
}

/** Each file's headings, read once (`outlineOf`). @param {Project} project @param {Unit} unit @returns {(at: string) => Heading[]} */
function outlinesOf(project, unit) {
  /** @type {Map<string, Heading[]>} */
  const outlines = new Map();
  return (at) => {
    if (!outlines.has(at)) outlines.set(at, outlineOf(readText(path.join(project.stateDir, at)) ?? '', at === `${unit.name}/${JOINED_SPEC}`));
    return /** @type {Heading[]} */ (outlines.get(at));
  };
}

/**
 * When a side of a contradiction was settled in its source, by its key
 * (`Sides`): an approved spec's approval, the part of the unit's spec.md
 * it sits in by that part's, as the old manifest dates it; a discovery
 * session's date, as its `Date:` line gives it; null where none shows.
 * @param {Project} project @param {Unit} unit @returns {(key: string) => string|null}
 */
function datesOf(project, unit) {
  const specs = unitSpecs(project, unit).filter(({ approved }) => approved);
  const outline = outlinesOf(project, unit);
  return (key) => {
    const [at, line] = key.split('\n');
    const heading = outline(at).find((each) => String(each.line) === line);
    const spec = specs.find((each) => each.path === at && (each.part === null || each.part === heading?.part));
    if (spec !== undefined) return spec.approvedOn === null ? null : `approved on ${spec.approvedOn}`;
    const written = /^\**Date\**:\**\s*(\d{4}-\d{2}-\d{2})/m.exec(readText(path.join(project.stateDir, at)) ?? '')?.[1];
    return written === undefined ? null : `written on ${written}`;
  };
}

/**
 * A contradiction one record of a unit names that another, citing a side
 * of it, does not: the record that does not, by its topic and its place;
 * the sections at odds; those of them it cites; and the records naming it.
 * @typedef {{topic: string|null, place: string, sides: Side[], dates: (string|null)[], cited: Side[], by: string[]}} Unshared
 */

/**
 * The contradictions a unit's records leave unshared (`Unshared`), once
 * every record of the unit has one composed or carried; none before. A
 * record names a contradiction by an entry's `at_odds`, two sections at
 * least of the sources its records share; another record citing any of
 * them names the same, an entry's `at_odds` holding those sections and no
 * other, or the session marks it as carrying no side of that point
 * (`atOddsMarked`), each by its place. Whether two sections truly disagree,
 * and whether a record carries a side of the point, is the session's to
 * judge, never the check's.
 * @param {Project} project @param {Unit} unit @returns {Unshared[]}
 */
function unsharedOf(project, unit) {
  const records = recordsOfUnit(project, unit).map((topic) => ({ topic, entries: recordOf(project, unit, topic) }));
  if (records.some(({ entries }) => entries === null)) return [];
  const sides = sidesReader(project, unit);
  const dateOf = datesOf(project, unit);
  const marks = marksIn(project, atOddsMarked(unit.name));
  const read = records.map(({ topic, entries }) => {
    const place = recordPlace(unit, topic);
    const answered = new Set(/** @type {Record<string, any>[]} */ (entries).filter(({ event }) => event === 'decided').map(({ answers }) => answers));
    const named = /** @type {Record<string, any>[]} */ (entries).filter(({ event, ref, at_odds: odds }) => event === 'asked' && Array.isArray(odds) && !answered.has(ref))
      .map(({ at_odds: odds }) => sides(odds.filter(isObject))).filter((each) => each.size > 1);
    const settled = new Set([...named, ...markedSides(marks, place).map(({ sides: marked }) => sides(marked))].map(keyOfSides));
    return { topic, place, named, settled, cited: sides(/** @type {Record<string, any>[]} */ (entries).flatMap(citesIn)) };
  });
  /** @type {Map<string, {sides: Sides, by: string[]}>} */
  const naming = new Map();
  for (const { place, named } of read) {
    for (const odds of named) naming.set(keyOfSides(odds), { sides: odds, by: [...new Set([...(naming.get(keyOfSides(odds))?.by ?? []), place])] });
  }
  return read.flatMap(({ topic, place, settled, cited }) => [...naming].flatMap(([key, { sides: odds, by }]) => {
    const citing = [...odds.keys()].filter((side) => cited.has(side));
    if (settled.has(key) || citing.length === 0) return [];
    return [{ topic, place, sides: [...odds.values()], dates: [...odds.keys()].map(dateOf), cited: citing.map((side) => /** @type {Side} */ (cited.get(side))), by }];
  }));
}

/**
 * The sections each contradiction the session marked on a record's place
 * names, and whether it marked it as the record's own log's, settled after
 * the approval (`{"log": [...]}`), and that the person's answer agrees
 * with that log (`"agrees": true`), rather than as no side of the point.
 * @param {Record<string, unknown>} marks @param {string} place
 * @returns {{sides: Record<string, unknown>[], log: boolean, agrees: boolean}[]}
 */
function markedSides(marks, place) {
  const listed = marks[place];
  return (Array.isArray(listed) ? listed : []).map((mark) => {
    const log = isObject(mark) && Array.isArray(mark.log);
    const sides = log ? /** @type {unknown[]} */ (mark.log) : Array.isArray(mark) ? mark : [];
    return { sides: sides.filter(isObject), log, agrees: log && mark.agrees === true };
  });
}

/** What a contradiction left unshared asks of the record it is named on, in the directive's order. @param {Project} project @param {Unit} unit @param {Unshared} unshared */
function unsharedProblem(project, unit, { topic, place, sides, dates, cited, by }) {
  const marked = path.join(project.stateDir, atOddsMarked(unit.name));
  const { settled, findings } = settledIn(project, unit, topic);
  return [
    `${sidesSaid(project, sides, dates)} are at odds, as ${inWords(by)} ${by.length === 1 ? 'names' : 'name'} them, and this record cites ${sidesSaid(project, cited)} without naming that contradiction — judge first whether it stands.`,
    `Where a later answer settles it — an approved spec, or a part of one, approved after the other side was written — it is settled on each record naming it, and on this one where it carries the side the later answer replaced, this record keeping its answer only where it is the later one: a line in ${settled} naming the section that settles it, and into ${findings} \`Settled: {sections} settled by {section}, amend to agree\`.`,
    `Where this record's own log settled the point after the approval, its answer is its log's: it is marked in ${marked} as ${JSON.stringify({ [place]: [{ log: sides }] })}, and each record naming the contradiction keeps naming what its own sources hold.`,
    `Where it stands and this record carries a side of the point at odds, it names the contradiction, an open question holding those sections as its at_odds, and carries neither side as settled: a line in ${settled} naming the sections at odds and the point, and into ${findings} \`Settled: {sections} at odds, amend to agree\`.`,
    `Where what it cites of them is not that point, it is marked in ${marked} as ${JSON.stringify({ [place]: [sides] })}`,
  ].join(' ');
}

/** What a unit's records wait on before any is carried: each record not passed, with where it stands, and how many sections and contradictions the check names. @typedef {{unpassed: {record: RecordOf, said: string}[], uncited: number, unshared: number}} Waiting */

/**
 * What a unit's records wait on before any of them is carried, where any
 * topic draws on an approved spec or the unit holds a shared source of
 * text: each record not carried with no record composed, or one its
 * verifier has not passed — each topic of the unit drawing on a spec, and
 * every record walking a shared source — with where it stands; and, once
 * each has passed, how many sections of the unit's specs and shared
 * sources no record cites, and how many contradictions a record names go
 * unnamed on another citing a side of them, which the check names.
 * @param {Project} project @param {Unit} unit
 * @returns {Waiting}
 */
function waitingOn(project, unit) {
  /** @type {Waiting} */
  const none = { unpassed: [], uncited: 0, unshared: 0 };
  const topics = topicsOf(unit.manifest);
  const drawing = topics.some((topic) => specsOf(project, unit, topic).some(({ approved }) => approved)) ? topics.map((topic) => ({ unit, topic })) : [];
  /** @type {Map<string, RecordOf>} */
  const records = new Map([...drawing, ...sharedOf(project, unit).flatMap(({ walkers }) => walkers)].map((record) => [`${record.unit.name}/${record.topic}`, record]));
  if (records.size === 0) return none;
  const unpassed = [...records.values()].filter(({ unit: of, topic }) => carriedOf(project, of, topic) === null).flatMap((record) => {
    const said = /** @type {string} */ (uncarried(project, record.unit, record.topic));
    return WAITING.includes(said) ? [] : [{ record, said }];
  });
  if (unpassed.length > 0) return { ...none, unpassed };
  return { ...none, uncited: uncitedOf(project, unit).length + uncitedSharedOf(project, unit).length, unshared: unsharedOf(project, unit).length };
}

/**
 * What a unit's records wait on (`waitingOn`), in words, for the carry's
 * refusal: each record not passed and where it stands, else how many
 * sections no record cites and contradictions go unnamed, and where the
 * check names each.
 * @param {Unit} unit @param {Waiting} on @returns {string[]}
 */
function waitsSaid(unit, { unpassed, uncited, unshared }) {
  return [
    ...unpassed.map(({ record: { unit: of, topic }, said }) => `${of.name}'s ${topic ?? 'own record'} ${said}`),
    ...(uncited === 0 ? [] : [`${uncited === 1 ? 'a section' : `${uncited} sections`} of ${unit.name}'s approved specs, discovery sessions and walked assets ${uncited === 1 ? 'holds' : 'hold'} text no record cites — \`migrate check ${DIRECTIVE}\` names each where it is named`]),
    ...(unshared === 0 ? [] : [`${unshared === 1 ? 'a contradiction' : `${unshared} contradictions`} a record of ${unit.name} names ${unshared === 1 ? 'goes' : 'go'} unnamed on another record citing a side of ${unshared === 1 ? 'it' : 'them'} — \`migrate check ${DIRECTIVE}\` names each where it is named`]),
  ];
}

/**
 * What a unit's records wait on before any of them is carried, by the unit
 * waited on: its own, and each unit a topic of it was promoted from, whose
 * discovery sessions the topic walks; a unit waiting on nothing left out.
 * @param {Project} project @param {Unit} unit @returns {{unit: Unit, on: Waiting}[]}
 */
function unitsWaitedOn(project, unit) {
  const homes = new Set(topicsOf(unit.manifest).flatMap((topic) => homesOf(project, unit, topic).filter((home) => home !== unit.name)));
  return [unit, ...[...homes].map((home) => unitOf(project, home))].map((each) => ({ unit: each, on: waitingOn(project, each) }))
    .filter(({ on: { unpassed, uncited, unshared } }) => unpassed.length > 0 || uncited > 0 || unshared > 0);
}

/**
 * What a unit's records wait on before any of them is carried, in words
 * (`waitsSaid`), by the unit waited on (`unitsWaitedOn`).
 * @param {Project} project @param {Unit} unit @returns {{unit: string, waits: string[]}[]}
 */
const unitWaits = (project, unit) => unitsWaitedOn(project, unit).map(({ unit: each, on }) => ({ unit: each.name, waits: waitsSaid(each, on) }));

/** What an uncited section is, by the kind of source it is in, and who carries what it holds. */
const UNCITED_SAYS = new Map([
  ['spec', { what: 'an approved spec', carried: 'what the spec stage decided, found or left open, still current, is carried by the topic it belongs to' }],
  ['session', { what: 'a discovery session', carried: 'a current point it makes, which no topic\'s own files hold word for word, is carried by the record its subject belongs to' }],
  ['asset', { what: 'an asset', carried: 'a current point it makes, which no topic\'s own files hold word for word, is carried by the record its subject belongs to' }],
]);

/** What a section no record cites lacks, as the record it is named on, `topic`'s, is told it. @param {Project} project @param {Unit} unit @param {string|null} topic @param {Uncited} uncited */
function uncitedProblem(project, unit, topic, { path: at, part, section, mark, kind }) {
  const { what, carried } = /** @type {{what: string, carried: string}} */ (UNCITED_SAYS.get(kind));
  const { settled, findings } = settledIn(project, unit, topic);
  return `"${section}" in ${path.join(project.stateDir, at)}, ${what}, holds text no record of ${unit.name} cites — ${carried}: where it is this record's, a line in ${settled} naming the section and what of it the record misses, and into ${findings} \`Settled: ${section}, amend to agree\`; a section holding none, or only what a later answer replaced or a cancelled unit alone decided, is marked, once read, in ${path.join(project.stateDir, sectionsMarked(unit.name))} as ${markOf(at, part, mark)}`;
}

/** A record its verifier has passed, waiting for the carry. */
const PASSED = 'has passed its verifier, and waits to be carried';
/** A record the session passed, settling a late round's findings, waiting for the carry. */
const SETTLED = 'was settled by the session, and waits to be carried';
/** Where a record waits for the carry alone. */
const WAITING = [PASSED, SETTLED];

/** The carry's refusal kept beside a record, absolute; null where none stands. @param {Project} project @param {Unit} unit @param {string|null} topic */
function refusalOf(project, unit, topic) {
  const file = path.join(project.stateDir, refusedPath(unit.name, topic));
  return isFile(file) ? file : null;
}

/**
 * Where a record not yet carried stands: none composed; what the carry
 * would refuse it for on its own — findings handed back, not passed by its
 * verifier, changed since its verifier was briefed, a verdict missing; or
 * passed, waiting for the carry.
 * @param {Project} project @param {Unit} unit @param {string|null} topic
 */
function uncarried(project, unit, topic) {
  const record = recordOf(project, unit, topic);
  if (record === null) return 'has no record composed';
  const why = unverified(project.stateDir, unit.name, topic);
  return handedBack(project.stateDir, unit.name, topic)
    ?? (why === null ? null : `has not passed its verifier — ${why}`)
    ?? unsettledRound(project.stateDir, unit.name, topic, record.map(({ ref }) => String(ref)))
    ?? (settledBySession(project.stateDir, unit.name, topic) ? SETTLED : PASSED);
}

/**
 * What one record still lacks: carried, each of its ids in the ledger, and
 * keeping the rules — a topic's, or with `topic` null its unit's own.
 * @param {Project} project @param {Set<string>} ids @param {Unit} unit @param {string|null} topic
 * @returns {string[]}
 */
function topicProblems(project, ids, unit, topic) {
  const carried = carriedOf(project, unit, topic);
  if (carried === null) return [uncarried(project, unit, topic)];
  if (!carried.entries.every(({ id }) => ids.has(id))) return ['its record never reached the ledger'];
  return problemsOf(project, unit, topic, carried.phase, carried.record.entries, carried.record.description);
}

/**
 * A record composed and not carried, as its verifier's round leaves it: its
 * entries' refs; the note its last verifier's brief was issued on, or
 * null; its findings file's text, or null where none stands; and whether it
 * changed since that brief.
 * @typedef {{refs: string[], note: {hash: string, settled?: boolean}|null, findings: string|null, changed: boolean}} Round
 */

/** A record's round (`Round`), null where it has none composed. @param {Project} project @param {Unit} unit @param {string|null} topic @returns {Round|null} */
function roundOf(project, unit, topic) {
  const record = recordOf(project, unit, topic);
  if (record === null) return null;
  const note = briefedOn(project.stateDir, unit.name, topic);
  return {
    refs: record.map(({ ref }) => String(ref)),
    note,
    findings: readText(path.join(project.stateDir, findingsPath(unit.name, topic))),
    changed: note !== null && note.hash !== recordHash(project.stateDir, unit.name, topic),
  };
}

/**
 * What stops a record before the session or an agent can take it on: none
 * composed; findings its composer handed back; its last verifier's
 * verdicts missing an entry its brief asked of it, or naming one the record
 * it read does not hold (`verdictGaps`); its verifier yet to report. Else
 * null.
 * @param {Project} project @param {Unit} unit @param {string|null} topic @param {Round|null} round @returns {string|null}
 */
function heldStep(project, unit, topic, round) {
  if (round === null) return 'compose its record: brief a per-topic agent';
  const root = project.stateDir;
  if (handedBack(root, unit.name, topic) !== null) return `settle each finding its composer handed back, then remove ${path.join(root, handbackPath(unit.name, topic))}`;
  const { refs, note, findings, changed } = round;
  if (findings !== null && (note !== null || findings.trim() === '')) {
    const { missing, unknown } = verdictGaps(root, unit.name, topic, refs);
    const gaps = [
      ...(missing.length > 0 ? [`gave no verdict on ${missing.join(', ')}`] : []),
      ...(unknown.length > 0 ? [`gave a verdict on ${unknown.join(', ')}, which the record it read does not hold`] : []),
    ];
    if (gaps.length > 0) return `its verifier ${gaps.join(' and ')}: remove ${inWords(verdictlessFiles(root, unit.name, topic))}, and brief a fresh verifier`;
  }
  return findings === null && note !== null && note.settled !== true && !changed ? 'its verifier has not reported yet: wait for it; once it has returned without writing its findings, brief a fresh verifier' : null;
}

/**
 * What the session reads or removes on a record before it goes on: each
 * file an agent left beside it; else the sections no record cites and the
 * contradictions the check names on it. Else null.
 * @param {string[]} strays @param {number} uncited @param {number} unshared @returns {string|null}
 */
function sessionStep(strays, uncited, unshared) {
  if (strays.length > 0) return `remove what an agent left beside its record: ${inWords(strays)}`;
  const reads = [
    ...(uncited === 0 ? [] : [`${uncited === 1 ? 'an uncited section' : `${uncited} uncited sections`} to read`]),
    ...(unshared === 0 ? [] : [`${unshared === 1 ? 'a contradiction' : `${unshared} contradictions`} another record names to judge`]),
  ];
  return reads.length === 0 ? null : `${inWords(reads)}: settle each into this record, or mark it`;
}

/**
 * What a record needs of its verifiers before the carry, null where one
 * passed it unchanged since, or the session settled its round: a verifier
 * briefed on it; its findings answered — by a fresh per-topic agent, or by
 * the session where one reverses a ruling or the round is the third or
 * later — and the record read again once amended.
 * @param {Project} project @param {Unit} unit @param {string|null} topic @param {Round} round @returns {string|null}
 */
function verifierStep(project, unit, topic, { note, findings, changed }) {
  const place = recordPlace(unit, topic);
  const reread = `check it with \`ledger carry ${place} --dry-run\`, then brief a fresh verifier`;
  if (findings === null || findings.trim() === '') {
    if (findings === null && note === null) return `check it with \`ledger carry ${place} --dry-run\`, then brief its verifier`;
    return changed ? `it changed since its verifier was briefed: ${reread}` : null;
  }
  const items = findingItems(findings);
  if (!items.every((item) => item.startsWith('Settled:'))) {
    const round = roundsKept(path.join(project.stateDir, roundsPath(unit.name, topic))) + 1;
    if (round >= SETTLED_FROM) return `round ${round}'s findings are yours to settle: settle each, then pass it with \`ledger settle ${place}\``;
    if (items.some((item) => item.startsWith('Reverses '))) return 'a finding reverses an earlier ruling or the session: settle it from the record\'s sources, or ask the person';
  }
  if (changed) return `it was amended since its verifier read it: ${reread}`;
  return 'a fresh per-topic agent amends it, its brief carrying the findings; once it returns, a fresh verifier reads it';
}

/**
 * What a record passed waits on before the carry, by each unit waited on
 * (`unitsWaitedOn`): its records not yet passed, by their places, else how
 * many sections no record cites and contradictions the check names on
 * them; null where it waits on nothing.
 * @param {{unit: Unit, on: Waiting}[]} waited @returns {string|null}
 */
function waitStep(waited) {
  if (waited.length === 0) return null;
  const on = waited.flatMap(({ unit, on: { unpassed, uncited, unshared } }) => [
    ...(unpassed.length === 0 ? [] : [`${unit.name}'s ${unpassed.length === 1 ? 'record' : 'records'} ${inWords(unpassed.map(({ record }) => recordPlace(record.unit, record.topic)))}, until ${unpassed.length === 1 ? 'it passes' : 'each passes'}`]),
    ...(uncited === 0 ? [] : [`${uncited === 1 ? 'a section' : `${uncited} sections`} of ${unit.name}'s sources no record cites`]),
    ...(unshared === 0 ? [] : [`${unshared === 1 ? 'a contradiction' : `${unshared} contradictions`} on ${unit.name}'s records`]),
  ]);
  return `passed, and its carry waits on ${inWords(on)}`;
}

/**
 * Whether the session has settled into a record what `names` names, the
 * record not yet amended to it: each a `Settled:` finding standing beside
 * the record names — a section no record cited, or the sections of a
 * contradiction — so the record's next step is its amend, never reading
 * them again.
 * @param {Project} project @param {Unit} unit @param {string|null} topic @returns {(names: string[]) => boolean}
 */
function settledForAmend(project, unit, topic) {
  const findings = readText(path.join(project.stateDir, findingsPath(unit.name, topic)));
  const items = findings === null || findings.trim() === '' ? [] : findingItems(findings).filter((item) => item.startsWith('Settled:'));
  return (names) => items.length > 0 && names.every((name) => items.some((item) => namesWhole(item, name)));
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * Whether `text` names `name` whole: at the text's edge or a character no
 * word holds on each side, and never as the start of a deeper heading's
 * path, `{name} > …`.
 * @param {string} text @param {string} name
 */
function namesWhole(text, name) {
  const bounded = (/** @type {number} */ at) => at < 0 || at >= text.length || !WORD_CHAR.test(text[at]);
  for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + 1)) {
    const end = at + name.length;
    if (bounded(at - 1) && bounded(end) && !text.startsWith(PATH_JOIN, end)) return true;
  }
  return false;
}

/**
 * The one step the session takes next on a record not done, in the
 * directive's terms: what stops it (`heldStep`), what the session reads or
 * removes on it (`sessionStep`), its amend where the carry refused it,
 * what its verifiers still owe (`verifierStep`), what its carry waits on
 * (`waitStep`), else the carry.
 * A carried record never in the ledger is carried again.
 * @param {Project} project @param {Set<string>} ids @param {Unit} unit @param {string|null} topic
 * @param {{strays: string[], uncited: number, unshared: number, waited: () => {unit: Unit, on: Waiting}[]}} on
 * @returns {string}
 */
function nextStep(project, ids, unit, topic, { strays, uncited, unshared, waited }) {
  const place = recordPlace(unit, topic);
  const carried = carriedOf(project, unit, topic);
  if (carried !== null) {
    if (!carried.entries.every(({ id }) => ids.has(id))) return `carry it again: \`ledger carry ${place}\``;
    return sessionStep(strays, uncited, unshared) ?? 'mend what its problems name';
  }
  const round = roundOf(project, unit, topic);
  const refusal = refusalOf(project, unit, topic);
  return heldStep(project, unit, topic, round)
    ?? sessionStep(strays, uncited, unshared)
    ?? (refusal === null ? null : `the carry refused it: a fresh per-topic agent amends it, its brief carrying the refusal in ${refusal}`)
    ?? verifierStep(project, unit, topic, /** @type {Round} */ (round))
    ?? waitStep(waited())
    ?? `ready to carry: \`ledger carry ${place}\``;
}

module.exports = {
  does: 'This step writes a record of what each piece of past work decided, and checks each one against its documents.',
  counts: { one: 'record', many: 'records' },
  done: 'carried',
  partWay: 'A record it was in the middle of is amended from where it stood.',
  /** @param {{projectDir: string, stateDir: string}} dirs */
  check({ projectDir, stateDir }) {
    const project = projectOf(projectDir, stateDir);
    const ids = ledgerIds(stateDir);
    return unitsOf(project).flatMap((unit) => {
      const uncited = [...uncitedOf(project, unit), ...uncitedSharedOf(project, unit)];
      const hasOwn = hasOwnRecord(stateDir, unit.name, unit.manifest);
      const strays = strayRecordFiles(project, unit);
      const unshared = unsharedOf(project, unit);
      /** @type {{unit: Unit, on: Waiting}[]|undefined} */
      let waited;
      const piece = (/** @type {string|null} */ topic) => {
        const strayed = strays.filter((stray) => stray.topic === topic || (stray.topic === null && !hasOwn)).map(({ at }) => path.join(stateDir, at));
        const sent = uncited.filter(({ topics }) => topics.includes(topic));
        const odds = unshared.filter((each) => each.topic === topic);
        const settled = settledForAmend(project, unit, topic);
        const problems = [
          ...topicProblems(project, ids, unit, topic),
          ...sent.map((each) => uncitedProblem(project, unit, topic, each)),
          ...odds.map((each) => unsharedProblem(project, unit, each)),
          ...strayed.map((at) => `${at} is no file a record is kept in — an agent left it: remove it`),
        ];
        const name = recordPlace(unit, topic);
        if (problems.length === 0) return { name, problems };
        const next = nextStep(project, ids, unit, topic, {
          strays: strayed,
          uncited: sent.filter(({ section }) => !settled([section])).length,
          unshared: odds.filter(({ sides }) => !settled(sides.map(({ section }) => section))).length,
          waited: () => (waited ??= unitsWaitedOn(project, unit)),
        });
        return { name, problems, next };
      };
      return [...topicsOf(unit.manifest).map(piece), ...(hasOwn ? [piece(null)] : [])];
    });
  },
  /**
   * The points to raise: each question a carried record marks `raise`, on a
   * started topic not set aside of a unit in progress, staying in its unit
   * (`unraised`) — its place,
   * the topic's or, where the unit has its spec, its specification's, the
   * question's id and its text; and beside it, as `candidates`, each other
   * record's question so marked whose `at_odds` holds the same sections of
   * the sources the unit's records share, with its place, for the session
   * to judge whether they are one point: sections alone never say so; and,
   * as `settled_on`, each record the session marked as its own log's for
   * those sections, unless the person's answer agrees with it, with its
   * decisions citing a side of them.
   * @param {{projectDir: string, stateDir: string}} dirs
   * @returns {{place: string, answers: string, text: string, candidates?: {place: string, answers: string, text: string}[], settled_on?: {place: string, decisions: {id: string, text: string}[]}[]}[]}
   */
  raises({ projectDir, stateDir }) {
    const project = projectOf(projectDir, stateDir);
    return unitsOf(project).flatMap((unit) => {
      const sides = sidesReader(project, unit);
      const placeOf = (/** @type {string} */ topic, /** @type {string} */ phase) => (hasSpec(project, unit) ? `${unit.name}.specification` : `${unit.name}.${phase}.${topic}`);
      const carriedTopics = topicsOf(unit.manifest).flatMap((topic) => {
        const carried = carriedOf(project, unit, topic);
        return carried === null ? [] : [{ topic, carried, ids: new Map(carried.entries.map(({ ref, id }) => [ref, id])) }];
      });
      const points = carriedTopics.flatMap(({ topic, carried, ids }) => {
        if (unraised(project, unit, topic, carried.phase) !== null) return [];
        return carried.record.entries.filter((entry) => entry.raise === true).map((entry) => {
          const odds = sides(Array.isArray(entry.at_odds) ? entry.at_odds.filter(isObject) : []);
          return { topic, odds, key: odds.size > 1 ? keyOfSides(odds) : null, point: { place: placeOf(topic, carried.phase), answers: String(ids.get(entry.ref)), text: String(entry.text) } };
        });
      });
      const marks = marksIn(project, atOddsMarked(unit.name));
      const settledOn = (/** @type {Sides} */ odds, /** @type {string} */ key) => carriedTopics.flatMap(({ topic, carried, ids }) => {
        if (!markedSides(marks, recordPlace(unit, topic)).some((mark) => mark.log && !mark.agrees && keyOfSides(sides(mark.sides)) === key)) return [];
        const decisions = carried.record.entries.filter((entry) => entry.event === 'decided' && [...sides(citesIn(entry)).keys()].some((side) => odds.has(side)))
          .map((entry) => ({ id: String(ids.get(entry.ref)), text: String(entry.text) }));
        return decisions.length === 0 ? [] : [{ place: placeOf(topic, carried.phase), decisions }];
      });
      return points.map(({ topic, odds, key, point }) => {
        const candidates = points.filter((other) => key !== null && other.key === key && other.topic !== topic).map(({ point: { place, answers, text } }) => ({ place, answers, text }));
        const settled = key === null ? [] : settledOn(odds, key);
        return { ...point, ...(candidates.length === 0 ? {} : { candidates }), ...(settled.length === 0 ? {} : { settled_on: settled }) };
      });
    });
  },
  briefed: BRIEFED,
  phases: TOPIC_PHASES,
  holds,
  topicsOf,
  neverStarted,
  /**
   * What a topic's record breaks of the rules, before it is carried in
   * `phase`.
   * @param {{projectDir: string, stateDir: string, unit: string, topic: string, phase: string, entries: Record<string, any>[], description?: string}} at
   */
  recordProblems({ projectDir, stateDir, unit, topic, phase, entries, description }) {
    const project = projectOf(projectDir, stateDir);
    return problemsOf(project, unitOf(project, unit), topic, phase, entries, description);
  },
  /**
   * What a unit's records wait on before any is carried (the header's), by
   * the unit waited on, none where nothing does.
   * @param {{projectDir: string, stateDir: string, unit: string}} at
   */
  unitWaits({ projectDir, stateDir, unit }) {
    const project = projectOf(projectDir, stateDir);
    return unitWaits(project, unitOf(project, unit));
  },
  /**
   * Why a record has not passed its verifier (the header's), null where it
   * has.
   * @param {{stateDir: string, unit: string, topic: string|null}} at
   */
  unverified({ stateDir, unit, topic }) {
    return unverified(stateDir, unit, topic);
  },
  /**
   * Whether a unit has a record of its own (the header's), read from the
   * state alone.
   * @param {{stateDir: string, unit: string}} at
   */
  ownRecord({ stateDir, unit }) {
    return hasOwnRecord(stateDir, unit, readJson(path.join(stateDir, unit, 'manifest.json')));
  },
  /**
   * A record's sources as the rules read them: the project's folder they
   * are read in, a topic's old map, the threads still open it carries
   * (`threadsOf`), its specs and whether it leaves its building unit
   * (`leaves`), whether its record says what it is about (`describes`), the unit's assets (`assetsOf`), each import with the topic
   * owing its link — none for one the unit's own record owes — those it
   * walks that its own files hold word for word (`heldWhole`), the
   * discovery sessions it draws on, the other topics those
   * sessions may speak of (`othersOf`), and the unit's approved specs it
   * does not draw on, the later answer (`laterOf`), and the project's other
   * units cancelled, a corrigendum one wrote no later answer
   * (`cancelledOf`). A unit's own, `topic` null, has no map or spec, and no
   * later answer: nothing is decided in discovery.
   * @param {{projectDir: string, stateDir: string, unit: string, topic: string|null}} at
   */
  sourcesOf({ projectDir, stateDir, unit: name, topic }) {
    const project = projectOf(projectDir, stateDir);
    const unit = unitOf(project, name);
    const own = topic === null;
    return {
      project: project.dir,
      map: own ? [] : mapOf(unit, topic),
      threads: threadsOf(project, unit, topic),
      specs: own ? [] : specsOf(project, unit, topic),
      leaves: !own && leaves(project, unit, /** @type {string} */ (topic)),
      describes: !own && describes(project, unit, /** @type {string} */ (topic)),
      assets: assetsOf(project, unit),
      held: assetsOf(project, unit).filter(({ path: at, walkers }) => walkers.includes(topic) && heldWhole(project, unit, topic, at)).map(({ path: at }) => at),
      sessions: sessionsOf(project, unit, topic),
      others: othersOf(project, unit, topic),
      later: own ? [] : laterOf(project, unit, topic),
      cancelled: own ? [] : cancelledOf(project, unit),
    };
  },
  /**
   * Each of `files`, state-relative, holding a heading with text its own
   * words name none of alone, with those headings, each by the name a cite
   * gives it (`citeNameOf`), which every reader of a cite takes: what a
   * record's brief lists of its sources.
   * @param {{stateDir: string, unit: string, files: string[]}} at
   * @returns {{path: string, names: string[]}[]}
   */
  heldTwice({ stateDir, unit, files }) {
    return files.flatMap((at) => {
      const text = at.endsWith('.md') ? readText(path.join(stateDir, at)) : null;
      if (text === null) return [];
      const headings = outlineOf(text, at === `${unit}/${JOINED_SPEC}`);
      const names = headings.filter((heading) => heading.text && citedSection(headings, /** @type {string} */ (heading.trail.at(-1))) !== heading).map((heading) => citeNameOf(headings, heading));
      return names.length === 0 ? [] : [{ path: at, names }];
    });
  },
  /**
   * A record laid against its sources for its verifier's walk (`sheetOf`).
   * @param {{projectDir: string, stateDir: string, unit: string, topic: string|null, entries: Record<string, any>[]}} at
   */
  sheetOf({ projectDir, stateDir, unit: name, topic, entries }) {
    const project = projectOf(projectDir, stateDir);
    return sheetOf(project, unitOf(project, name), topic, entries);
  },
};

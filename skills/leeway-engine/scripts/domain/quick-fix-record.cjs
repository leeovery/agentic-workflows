'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a quick-fix's short record after the work (19.5.6, 19.5.17)
// — `quick-fix record <unit> <task> --file <record.md>` — and what its
// close stands on of its fixes (finish.cjs).
//
// The record's file is markdown under three level-two headings, in this
// order, and no other heading at level one or two: `## What changed`,
// `## Why` and `## Leaves out`, none empty, each closing every fenced block
// it opens. The verb writes it into the unit's `summary.md`, a file only the
// engine writes (layout.cjs), after every record written before it, so the
// records stand in the order the fixes were done (19.5.17), as the fixes
// land in its one commit (landing.cjs, `doneOrder`) — under the fix's title
// as the tracker holds it, a heading of its own, each section an item, its
// lines after the first beneath it — a section whose text opens on a
// fenced block written wholly beneath its item, so the fence opens and
// closes as written:
//
//   ## {fix title}
//
//   - What changed: …
//   - Why: …
//   - Leaves out: …
//
// A record is the fix's, by its task: the fixes recorded are kept beside the
// fixes on the unit's manifest, by task id in the order written
// (`fixes.recorded`), written with `summary.md` under the unit's lock and
// committed with it, so the two never part. It then indexes `summary.md`
// where this checkout's knowledge base is set up, each fix's record a chunk
// of its own (knowledge/artifacts.cjs), an index that fails a warning. It
// takes a fix holding work of its own — a commit through the door, landed
// by hand or not (landing.cjs, `quickFixLanding`) — in flight or done. It
// refuses, writing and committing nothing,
// every refusal opening `quick-fix record: `: a unit the project lacks or
// holds not in progress; one that is no quick-fix built by its own arm
// (`quickFixBuild`, derivations.cjs) — a quick-fix today's scoping made
// among them; a task that is none of its fixes, phase 1's, or one the
// tracker lacks; a fix closed; a fix recorded already; a fix holding no
// commit of its own; and a file that does not read as a record, every fault
// named.
//
// A fix closed has its record taken out of `summary.md` and the fixes
// recorded, `summary.md` gone with the last, in its close's own commit
// (`takeOutRecord`, fix-end.cjs), and the knowledge base brought in line —
// a move's close alone, since a fix holding work never closes.
// The close stands on every fix ended, done or closed, and each fix done
// passed by its pair, as its rounds' reports say (`pairVerdict`), and
// recorded (`recordedFixes`).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { writeTextAtomic } = require('../kernel/manifest-io.cjs');
const { withWorkUnitLock, loadWorkUnitManifest, saveWorkUnitManifest } = require('../kernel/manifest.cjs');
const { knowledgeFiles } = require('../kernel/knowledge/files.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { unitInProgress } = require('./topic-standing.cjs');
const { quickFixBuild, buildRefusal, FIXES_PHASE } = require('./derivations.cjs');
const { parseShownTask, shownTask, taskId, taskName } = require('./task-id.cjs');
const { trackedPhase, copiedTasks, givenText, ENDED, STATUS_WORDS } = require('./task-verbs.cjs');
const { headingLevels, fencedLines, unclosedFence } = require('./spec-sections.cjs');
const { committed } = require('./task-account.cjs');
const { taskRounds, pairPassed, changedUnder } = require('./round-report.cjs');
const { refusing } = require('./staged-payload.cjs');
const { summaryFile, SUMMARY_PHASE } = require('./knowledge/artifacts.cjs');
const { syncKnowledge } = require('./knowledge/sync.cjs');
/** The landing, read when asked: it reads the task verbs, which read this module. */
const landing = () => require('./landing.cjs');

/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */

const QUICK_FIX_USAGE = 'quick-fix record <work-unit> <task> --file <record.md>';

/** A record's sections, as their headings read, in order. */
const RECORD_SECTIONS = Object.freeze(['What changed', 'Why', 'Leaves out']);

/** Each line's level-two heading's title, by its line, a fenced line never one. @param {string[]} lines @returns {Map<number, string>} */
function levelTwo(lines) {
  const levels = headingLevels(lines);
  return new Map(lines.flatMap((line, at) => (levels[at] === 2 ? [[at, line.replace(/^#+[ \t]*/, '').trim()]] : [])));
}

/**
 * Where a record's text leaves a fenced block open, the fault: the section it
 * opens in named, where it opens in one.
 * @param {string[]} lines @param {Map<number, string>} headings
 * @returns {string[]}
 */
function unclosedFault(lines, headings) {
  const open = unclosedFence(lines);
  if (open === null) return [];
  const section = [...headings.keys()].filter((at) => at < open).pop();
  return [`${section === undefined ? 'it' : `\`## ${headings.get(section)}\``} opens a fenced block it never closes`];
}

/**
 * A record's file read by its grammar (the header's): each section's text by
 * its heading, trimmed. Refused where it does not read, every fault named.
 * @param {string} text @returns {Record<string, string>}
 */
function readRecord(text) {
  const lines = text.trimEnd().split(/\r\n?|\n/);
  const headings = levelTwo(lines);
  const starts = [...headings.keys()];
  /** @type {string[]} */
  const faults = [];
  if (headingLevels(lines).includes(1)) faults.push('it holds a level-one heading — the fix\'s title heads its record in summary.md');
  if (lines.slice(0, starts[0] ?? lines.length).some((line) => line.trim() !== '')) faults.push(`it opens with \`## ${RECORD_SECTIONS[0]}\``);
  faults.push(...unclosedFault(lines, headings));
  if ([...headings.values()].join('\n') !== RECORD_SECTIONS.join('\n')) {
    faults.push(`its sections are ${RECORD_SECTIONS.map((title) => `\`## ${title}\``).join(', ')}, in that order, and no other at level two`);
    throw new Error(faults.join('; '));
  }
  const bodies = starts.map((at, i) => lines.slice(at + 1, starts[i + 1] ?? lines.length).join('\n').trim());
  faults.push(...RECORD_SECTIONS.flatMap((title, i) => (bodies[i] === '' ? [`## ${title} is empty`] : [])));
  if (faults.length > 0) throw new Error(faults.join('; '));
  return Object.fromEntries(RECORD_SECTIONS.map((title, i) => [title, bodies[i]]));
}

/** Lines written beneath a section's item, indented to its text. @param {string[]} lines */
const beneath = (lines) => lines.map((line) => (line.trim() === '' ? '' : `  ${line}`));

/**
 * A section as its item in `summary.md`: its first line on the item's, the
 * rest beneath it — all of it beneath, where it opens on a fenced block.
 * @param {string} title @param {string} body
 */
function itemOf(title, body) {
  const lines = body.split('\n');
  if (fencedLines(lines)[0]) return [`- ${title}:`, ...beneath(lines)].join('\n');
  const [first, ...rest] = lines;
  return [`- ${title}: ${first}`, ...beneath(rest)].join('\n');
}

/** A fix's record as `summary.md` holds it (the header's). @param {string} title @param {Record<string, string>} record */
const recordBlock = (title, record) => [`## ${title}`, '', ...RECORD_SECTIONS.map((section) => itemOf(section, record[section]))].join('\n');

/** The unit's `summary.md` as it stands, empty where none is written. @param {string} cwd @param {string} unit */
function summaryText(cwd, unit) {
  const file = statePath(cwd, summaryFile(unit));
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

/** The fixes whose records `summary.md` holds, by task id, in the order written (`fixes.recorded`) — none before the fixes begin. @param {Record<string, any>} manifest @returns {string[]} */
const recordedIds = (manifest) => manifest.fixes?.recorded ?? [];

/** `summary.md`'s records, in its order, each its own run of lines from its heading. @param {string} text */
function recordBlocks(text) {
  const lines = text.trimEnd().split('\n');
  const starts = [...levelTwo(lines).keys()];
  return starts.map((at, i) => lines.slice(at, starts[i + 1] ?? lines.length).join('\n').trimEnd());
}

/** A record's item in `summary.md`: its section, and its text on the item's line. */
const ITEM = new RegExp(`^- (${RECORD_SECTIONS.join('|')}):[ \\t]?(.*)$`);

/**
 * Each fix's record `summary.md` holds, in its order, as the board shows
 * it: the fix's title, and each section's text by its heading, the lines
 * beneath its item taken back to the margin.
 * @param {string} cwd @param {string} unit @returns {{title: string, sections: Record<string, string>}[]}
 */
function summaryRecords(cwd, unit) {
  return recordBlocks(summaryText(cwd, unit)).filter((block) => block !== '').map((block) => {
    const [heading, ...lines] = block.split('\n');
    /** @type {Record<string, string[]>} */
    const sections = {};
    /** @type {string[]|null} */
    let open = null;
    for (const line of lines) {
      const item = ITEM.exec(line);
      if (item !== null) sections[item[1]] = open = item[2] === '' ? [] : [item[2]];
      else open?.push(line.replace(/^ {2}/, ''));
    }
    return { title: heading.replace(/^##[ \t]*/, ''), sections: Object.fromEntries(RECORD_SECTIONS.map((title) => [title, (sections[title] ?? []).join('\n').trim()])) };
  });
}

/** `summary.md` holding the records given, in their order. @param {string[]} blocks */
const summaryOf = (blocks) => `${blocks.join('\n\n')}\n`;

/** `summary.md` with a fix's record written after every record it holds. @param {string} text the file as it stands @param {string} block the record */
const placed = (text, block) => summaryOf([...recordBlocks(text), block]);

/**
 * The unit's manifest, refused where it is no quick-fix built by its own
 * arm.
 * @param {string} cwd @param {string} unit
 */
function quickFixOf(cwd, unit) {
  const manifest = unitInProgress(cwd, unit);
  if (quickFixBuild(manifest)) return manifest;
  throw new Error(manifest.work_type === 'quick-fix' ? /** @type {string} */ (buildRefusal(manifest)) : `${unit} is a ${manifest.work_type}, and only a quick-fix keeps a short record of each fix`);
}

/**
 * The fix the record is for, as the tracker holds it, with what its read
 * warned of — refused where it is none of the unit's fixes, closed,
 * recorded already, or holds no work of its own (`quickFixLanding`, landing.cjs).
 * @param {string} cwd @param {Record<string, any>} manifest the unit's @param {string} given
 */
function recordableFix(cwd, manifest, given) {
  const unit = manifest.name;
  const ref = parseShownTask(unit, given);
  if (ref.phase !== FIXES_PHASE.number) throw new Error(`${taskName(ref)} is none of its fixes — a quick-fix's fixes are its phase ${FIXES_PHASE.number}, ${FIXES_PHASE.number}.n`);
  const { tasks, warnings = [] } = trackedPhase(cwd, unit, ref.phase);
  const fixes = tasks ?? [];
  const fix = fixes.find((held) => held.ref.n === ref.n);
  if (fix === undefined) throw new Error(`${taskName(ref)} is not in the tracker — its fixes are listed by task list ${unit} ${FIXES_PHASE.number}`);
  if (fix.status === 'closed') throw new Error(`${taskName(ref)} is closed — a fix closed lands nothing, so it keeps no record`);
  if (recordedIds(manifest).includes(taskId(ref))) throw new Error(`${taskName(ref)}'s record is written already — ${summaryFile(unit)} holds it, under \`## ${fix.title}\``);
  if (!landing().quickFixLanding(cwd, unit).task(ref).held) throw new Error(`${taskName(ref)} holds no commit of its own — a fix's record is written once its change is committed through the door`);
  return { ref, fix, warnings };
}

/**
 * The record's file read as a record, refused where it does not read.
 * @param {string} cwd @param {string} file
 */
function givenRecord(cwd, file) {
  const text = givenText(cwd, file, 'record');
  try {
    return readRecord(text);
  } catch (err) {
    throw new Error(`${file} does not read as a fix's record — ${messageOf(err)}`);
  }
}

/**
 * The knowledge base brought in line with `summary.md`, where this
 * checkout's is set up: the file indexed, or its chunks removed where it is
 * gone — a failure a warning.
 * @param {string} cwd @param {string} unit @param {string[]} warnings
 */
function indexSummary(cwd, unit, warnings) {
  if (!fs.existsSync(knowledgeFiles(stateRoot(cwd)).config)) return;
  const file = summaryFile(unit);
  const change = fs.existsSync(statePath(cwd, file)) ? { index: file } : { remove: { workUnit: unit, phase: SUMMARY_PHASE } };
  syncKnowledge(cwd, [{ ...change, label: `knowledge index (${file})` }], warnings);
}

/**
 * `quick-fix record`: the fix's record written into `summary.md` after
 * every record it holds, the fix recorded beside the fixes on the
 * manifest, both committed together, then `summary.md` indexed.
 * @param {string} cwd @param {string} unit @param {string} given @param {string} file
 */
function recordFix(cwd, unit, given, file) {
  /** @type {string[]} */
  const warnings = [];
  const answer = withWorkUnitLock(cwd, unit, () => {
    const manifest = quickFixOf(cwd, unit);
    const { ref, fix, warnings: read } = recordableFix(cwd, manifest, given);
    const record = givenRecord(cwd, file);
    const recorded = recordedIds(manifest);
    const at = statePath(cwd, summaryFile(unit));
    fs.mkdirSync(path.dirname(at), { recursive: true });
    writeTextAtomic(at, placed(summaryText(cwd, unit), recordBlock(fix.title, record)));
    manifest.fixes = { ...manifest.fixes, recorded: [...recorded, taskId(ref)] };
    saveWorkUnitManifest(cwd, unit, manifest);
    warnings.push(...read);
    return committed(cwd, [summaryFile(unit), `${unit}/manifest.json`], `quick-fix(${unit}): record ${shownTask(ref)}`, warnings, { unit, task: shownTask(ref), id: taskId(ref), summary: at });
  });
  indexSummary(cwd, unit, warnings);
  return warnings.length > 0 ? { ...answer, warnings } : answer;
}

/**
 * A fix's record taken out of `summary.md` and the fixes recorded, where it
 * holds one, `summary.md` gone with the last, as the fix's close takes it
 * (fix-end.cjs): the state files written, none where it holds none.
 * @param {string} cwd @param {TaskRef} ref
 * @returns {string[]}
 */
function takeOutRecord(cwd, ref) {
  const { unit } = ref;
  return withWorkUnitLock(cwd, unit, () => {
    const manifest = loadWorkUnitManifest(cwd, unit);
    const recorded = recordedIds(manifest);
    const at = recorded.indexOf(taskId(ref));
    if (at === -1) return [];
    const blocks = recordBlocks(summaryText(cwd, unit));
    blocks.splice(at, 1);
    const file = statePath(cwd, summaryFile(unit));
    if (blocks.length === 0) fs.rmSync(file, { force: true });
    else writeTextAtomic(file, summaryOf(blocks));
    manifest.fixes = { ...manifest.fixes, recorded: recorded.filter((id) => id !== taskId(ref)) };
    saveWorkUnitManifest(cwd, unit, manifest);
    return [summaryFile(unit), `${unit}/manifest.json`];
  });
}

/**
 * The round a fix's pair ended its review in, every reviewer passing it or
 * the orchestrator settling it, and whether it was settled; null where its
 * review has not ended so, or the fix changed under that round since
 * (round-report.cjs).
 * @param {string} cwd @param {TaskRef} ref @returns {{round: number, settled: boolean}|null}
 */
function pairVerdict(cwd, ref) {
  const rounds = taskRounds(cwd, ref);
  const last = rounds.at(-1);
  if (last === undefined || !pairPassed(last) || changedUnder(cwd, ref, rounds) !== null) return null;
  return { round: last.round, settled: !last.passes };
}

/**
 * The quick-fix's fixes done, each with its record written, read from a
 * copy of the tracker's store, so the board asking whether the close draws
 * never waits on a writer — refused while a fix is not ended, one done has
 * no round its pair passed, as a fix marked done in the tracker by hand
 * leaves it (19.5.22), or one done has no record, naming each and the way
 * on.
 * @param {string} cwd @param {Record<string, any>} manifest the unit's @returns {TaskDetail[]}
 */
function recordedFixes(cwd, manifest) {
  const unit = manifest.name;
  const [fixes] = copiedTasks(cwd, unit, [FIXES_PHASE.number]);
  const open = fixes.filter(({ status }) => !ENDED.includes(status));
  if (open.length > 0) {
    const standing = open.map(({ ref, status }) => `${shownTask(ref)} is ${STATUS_WORDS[status]}`).join(', ');
    throw new Error(`${unit} closes once each of its fixes has ended — ${standing}: each is done once it is committed, in ${unit}'s pull request and passed by its pair, or closed with its reason`);
  }
  const done = fixes.filter(({ status }) => status === 'done');
  const unpassed = done.filter(({ ref }) => pairVerdict(cwd, ref) === null).map(({ ref }) => shownTask(ref));
  if (unpassed.length > 0) {
    throw new Error(`${unit} closes once its pair has passed each fix done — ${unpassed.join(', ')} ${unpassed.length === 1 ? 'has' : 'have'} no round its pair passed: its pair reads it, engine brief reviewer ${unit} ${unpassed[0]} --letter a, and b`);
  }
  const recorded = recordedIds(manifest);
  const owed = done.filter(({ ref }) => !recorded.includes(taskId(ref))).map(({ ref }) => shownTask(ref));
  if (owed.length > 0) {
    throw new Error(`${unit} closes once each fix done has its record — ${owed.join(', ')} ${owed.length === 1 ? 'has' : 'have'} none: quick-fix record ${unit} ${owed[0]} --file <record.md>`);
  }
  return done;
}

/**
 * `quick-fix record <unit> <task> --file <record.md>`: the verb's answer,
 * its refusal opening on its command.
 * @param {string} cwd @param {string[]} positional @param {Record<string, string>} opts
 * @returns {Record<string, unknown>}
 */
function runQuickFixVerb(cwd, [verb, ...args], opts) {
  const { file, ...rest } = opts;
  if (verb !== 'record' || args.length !== 2 || typeof file !== 'string' || Object.keys(rest).length > 0) throw new Error(`Usage: engine ${QUICK_FIX_USAGE}`);
  return refusing('quick-fix record', () => recordFix(cwd, args[0], args[1], file));
}

module.exports = { QUICK_FIX_USAGE, RECORD_SECTIONS, readRecord, recordedFixes, pairVerdict, takeOutRecord, indexSummary, runQuickFixVerb, summaryRecords };

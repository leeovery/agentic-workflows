'use strict';

// The landing histories (test-engine-landing-histories.cjs): what a person
// and the verbs do to a phase's tasks, generated from a seed, and the model
// each history is held to.
//
// A history cuts one to three tasks of phase 4 (`POOL`), each from main or
// stacked on the one before, of one to three commits each writing a file
// of its own, a stacked one's last perhaps deleting or rewriting a file of
// the task beneath. Then it does two to five of what a person and the verbs
// do (`EVENTS`): `land open`; a task landed by hand (`HAND`) — squashed
// under the person's own message or git's, merged by a merge commit,
// fast-forwarded, or its own commits picked onto main, a squash or a merge
// carrying a change of the person's own or not — or, where its pull request
// is open on the host, merged on the host's site, pulled or not, a rewrite
// of its branch since it was pushed pushed over it first (`republished`);
// a commit
// on a task's branch adding, rewriting or taking back a file, a take-back
// by a commit of its own, an amend — the last commit dropped where it did
// nothing else, left empty once the task has landed, a branch dropped
// below its landing having nothing new — or a fold under the task's stamp,
// once it has landed only where its branch stands at its landing, or
// adding a file it took back as it was; main merged back into a task's
// branch, the merge carrying
// a change of its own or not; the person's own commit on main, or one
// rewording a landed task's file there; a later task (`LATER`) cut from
// main rewriting a landed task's file, and landed; and `land phase`. A
// branch is rewritten or merged into before its task lands, or once a verb
// read its landing (`reshapeable`) — then opened at once, the refusal of
// what no verb reads past a landing followed, the merge carrying no change
// of its own, which that way on leaves out — never after a landing by
// hand no verb read, an edge never built. A rewrite of what a task landed
// is laid on its landing again by that way on (`replayed`): its take-back
// comes through only where the commit replayed removes the file from what
// its first parent held, else it is nothing new, the default branch keeping
// the file, and the model with it. Then the verbs land
// everything still to land: each task opened, then its phase landed. Every
// refusal's way on is followed as the person follows it, each conflict
// settled as the person means it: to the file's last write, where a side
// holds it, else the task's way; a change a way on keeps aside as a task of
// its own — an opened task's, never landed, moved since it opened — leaves
// the model with it, but for a write another task's branch holds, which
// lands with that task.
//
// The model is each file's last write, in the order the writes were made:
// the tasks' work and the person's own commits on main, never what a verb
// did — and what the person did by hand to work already landed. A landing
// by hand that changes a file main held as the model ends it, that write
// the person's or a landed task's, leaves the model as main then holds it,
// as a task cut below another lands after that one's own work (R25)
// (`overridden`). A task never writes a file again once another has
// rewritten it — the person's reword, the later task, or the task stacked
// on it. A history holds where main ends holding exactly the model; where
// every task's record holds its work as its branch ends, main holding all
// the branch changed past the record's tip; and
// where no verb lands a commit that changes nothing, so no landed task
// lands again. A history that fails tells its seed and every step it took.
//
// The gate runs `GATE` histories on each driver from seed 1;
// LEEWAY_LANDING_HISTORIES and LEEWAY_LANDING_SEED run another count from
// another seed.

require('./hermetic-env.cjs');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { git, tip, call, commitAll, readManifest, fixtureFrom } = require('./engine-harness.cjs');
const { UNIT, track, commitFiles, buildLanding, openArgs, wordsOf, commandsOf, rebaseStopped } = require('./landing-world.cjs');
const names = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');
const { parseShownTask, taskId } = require('../../skills/leeway-engine/scripts/domain/task-id.cjs');

/** The histories the gate runs on each driver. */
const GATE = 4;

/** The tasks a history cuts, in order, each stacked on the one before or cut from main. */
const POOL = Object.freeze([
  { shown: '4.1', type: 'feat', title: 'Add alpha' },
  { shown: '4.2', type: 'feat', title: 'Add beta' },
  { shown: '4.3', type: 'fix', title: 'Add gamma' },
]);

/** The task a history may cut later from main, rewriting a landed task's file. */
const LATER = Object.freeze({ shown: '5.1', type: 'fix', title: 'Word it again' });

/** A task's branch, named from its type and title. @param {{shown: string, type: string, title: string}} spec */
const branchOf = ({ shown, type, title }) => names.taskBranch(parseShownTask(UNIT, shown), type, title);

/** A task's branch as a refusal names it. */
const NAMED_BRANCH = new RegExp(`(?:feat|fix)/${UNIT}-\\d+\\.\\d+-[\\w-]+`);

/** A refusal saying there is nothing more to land. */
const NOTHING_LEFT = /has no task opened|its stack is landed/;

/** A refusal of a task never landed whose branch moved since it opened, the change kept aside as a task of its own: the task, and where its branch had moved to. */
const MOVED = /task (\d+\.\d+)'s branch \S+ has moved since it was opened at \w+, to (\w+)/;

/**
 * A task a history cut: its branch, the task it was cut on and the commit
 * it was cut from, what its branch holds of each file it wrote (null for
 * taken back), what each file it took back held before, the files it may
 * no longer write, what has been done to it, and, once a verb opened it,
 * its files and the model's, with who wrote each, as they stood then.
 * @typedef {{shown: string, branch: string, below: Task|null, above: Task[], cut: string, files: Map<string, string|null>, gone: Map<string, string>, frozen: Set<string>, opened: boolean, landed: boolean, merged: boolean, atOpen: {files: Map<string, string|null>, model: Map<string, string|undefined>, writers: Map<string, Task|null|undefined>}|null}} Task
 */

/**
 * A history under way: the driver's side and the world it runs in, its
 * seed and draws, its tasks, the model — every file main should end
 * holding, by its blob, and the task that wrote each, null or none for the
 * person — and what it did and found.
 * @typedef {{side: any, at: string, as: {env: Record<string, string>}, seed: number, draw: () => number, tasks: Task[], later: Task|null, model: Map<string, string>, writers: Map<string, Task|null>, made: number, steps: string[], problems: string[]}} History
 */

/** The seeds a run takes: the gate's, else those the environment names. */
function seeds() {
  const first = Number(process.env.LEEWAY_LANDING_SEED ?? 1);
  const count = Number(process.env.LEEWAY_LANDING_HISTORIES ?? GATE);
  return Array.from({ length: count }, (_, at) => first + at);
}

/**
 * The world the histories run in, for one driver: the landing world, the
 * pool's tasks and the later one in its tracker, readied for the driver.
 * @param {string} prefix @param {any} side
 */
function historyWorld(prefix, side) {
  return fixtureFrom(prefix, (dir) => {
    buildLanding(dir);
    for (const spec of [...POOL, LATER]) track(dir, spec.shown, spec.type, spec.title);
    commitAll(dir, 'the histories\' tasks');
    side.prepare(dir);
  });
}

/** A seeded draw in [0, 1), the same for the same seed (mulberry32). @param {number} seed */
function drawsOf(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {History} h @param {number} n a whole number below `n` */
const under = (h, n) => Math.floor(h.draw() * n);
/** @template T @param {History} h @param {T[]} list one of `list` */
const pick = (h, list) => list[under(h, list.length)];
/** @param {History} h @param {number} odds whether a draw falls under `odds` */
const chance = (h, odds) => h.draw() < odds;

/** The blob git stores `text` as. @param {string} text */
const blobOf = (text) => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0${text}`).digest('hex');

/** Every file a branch of the repository at `dir` holds, by its blob. @param {string} dir @param {string} branch */
function treeOf(dir, branch) {
  return new Map(git(dir, ['ls-tree', '-r', branch]).split('\n').filter(Boolean).map((line) => {
    const [meta, file] = line.split('\t');
    return [file, meta.split(' ')[2]];
  }));
}

/** Git at `dir`, its answer whatever its status. @param {string} dir @param {string[]} args */
const tried = (dir, args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_EDITOR: 'true' } });

/** A write in the model, and on the task's branch where a task made it. @param {History} h @param {Task|null} task @param {string} file @param {string|null} text */
function wrote(h, task, file, text) {
  const before = task?.files.get(file);
  if (text === null && typeof before === 'string') task?.gone.set(file, before);
  task?.files.set(file, text);
  h.writers.set(file, task);
  if (text === null) h.model.delete(file);
  else h.model.set(file, blobOf(text));
}

/** The next number a history names a file or a write by. @param {History} h */
const next = (h) => {
  h.made += 1;
  return h.made;
};

/** Each file a task may still write that its branch holds. @param {Task} task */
const writable = (task) => [...task.files].filter(([file, text]) => text !== null && !task.frozen.has(file)).map(([file]) => file);

/** Each file a task took back that it may write again. @param {Task} task */
const returnable = (task) => [...task.gone.keys()].filter((file) => task.files.get(file) === null && !task.frozen.has(file));

/** Whether a task can take a file back and still change something: another of its files kept. @param {Task} task */
const takeable = (task) => writable(task).length > 0 && [...task.files.values()].filter((text) => text !== null).length > 1;

/** Every task the history cut, the later one last. @param {History} h */
const allTasks = (h) => (h.later === null ? h.tasks : [...h.tasks, h.later]);

/** A task of `spec` cut from `cut`, on `below` where it is stacked. @param {{shown: string, type: string, title: string}} spec @param {Task|null} below @param {string} cut @returns {Task} */
const taskOf = (spec, below, cut) => ({ shown: spec.shown, branch: branchOf(spec), below, above: [], cut, files: new Map(), gone: new Map(), frozen: new Set(), opened: false, landed: false, merged: false, atOpen: null });

/** Whether a verb has read a task's landing: its landing record. @param {History} h @param {Task} task */
const recorded = (h, task) => readManifest(h.at, UNIT).landings?.[taskId(parseShownTask(UNIT, task.shown))]?.['.'] !== undefined;

/** A task's tip at its landing as its record holds it, null where none does. @param {History} h @param {Task} task @returns {string|null} */
const recordedTip = (h, task) => readManifest(h.at, UNIT).landings?.[taskId(parseShownTask(UNIT, task.shown))]?.['.']?.tip ?? null;

/** Whether `rev` landed with a task: its record's tip holds it. @param {History} h @param {Task} task @param {string} rev */
const landedWith = (h, task, rev) => {
  const at = recordedTip(h, task);
  return at !== null && tried(h.at, ['merge-base', '--is-ancestor', rev, at]).status === 0;
};

/**
 * Whether a take-back of `file` amended into a task's last commit comes
 * through, the branch checked out: always where that commit has not
 * landed; where it has, only where it is no merge, which a rebase leaves
 * out, and its first parent holds the file, so the commit laid on its
 * landing again — as the way on of a branch apart from its landing lays it
 * — removes it, else it is nothing new.
 * @param {History} h @param {Task} task @param {string} file
 */
const replayed = (h, task, file) => !landedWith(h, task, 'HEAD')
  || (tried(h.at, ['rev-parse', '-q', '--verify', 'HEAD^2']).status !== 0 && tried(h.at, ['cat-file', '-e', `HEAD^:${file}`]).status === 0);

/** Whether a task's branch may be rewritten or merged into: before its task lands, or once a verb read its landing. @param {History} h @param {Task} task */
const reshapeable = (h, task) => !task.landed || recorded(h, task);

/** A task opened by a verb: its files, and the model's, as they stand, which a change it then moves past withdraws to (`withdrawn`). @param {History} h @param {string} shown */
function openedNow(h, shown) {
  const task = allTasks(h).find((held) => held.shown === shown);
  if (task === undefined) return;
  const files = [...task.files.keys()];
  task.atOpen = { files: new Map(task.files), model: new Map(files.map((file) => [file, h.model.get(file)])), writers: new Map(files.map((file) => [file, h.writers.get(file)])) };
}

/**
 * A task's change since it opened withdrawn from the model, as following
 * the refusal of its branch moved since it opened keeps that change aside
 * as a task of its own: each file it wrote since back as it stood then —
 * but a write another task's branch holds, a way on having merged it in
 * there, which lands with that task: all of it, where that branch holds the
 * commit it had moved to.
 * @param {History} h @param {string} shown @param {string} to the commit its branch had moved to
 */
function withdrawn(h, shown, to) {
  const task = allTasks(h).find((held) => held.shown === shown);
  const at = task?.atOpen;
  if (task === undefined || at === null || at === undefined) return;
  const others = allTasks(h).filter((other) => other !== task);
  if (others.some((other) => tried(h.at, ['merge-base', '--is-ancestor', to, other.branch]).status === 0)) {
    h.steps.push(`  ${shown}'s change since it opened kept aside as a task of its own, a branch it was merged into holding it`);
    return;
  }
  const elsewhere = others.map((other) => treeOf(h.at, other.branch));
  for (const [file, text] of [...task.files]) {
    if (at.files.get(file) === text || (text !== null && elsewhere.some((tree) => tree.get(file) === blobOf(text)))) continue;
    const was = at.model.get(file);
    if (at.files.has(file)) task.files.set(file, /** @type {string|null} */ (at.files.get(file)));
    else task.files.delete(file);
    if (was === undefined) h.model.delete(file);
    else h.model.set(file, was);
    const by = at.writers.get(file);
    if (by === undefined) h.writers.delete(file);
    else h.writers.set(file, by);
  }
  h.steps.push(`  ${shown}'s change since it opened kept aside as a task of its own`);
}

/** `act` with the task's branch out in the main checkout, main out again after. @template T @param {History} h @param {string} branch @param {() => T} act @returns {T} */
function onBranch(h, branch, act) {
  git(h.at, ['switch', '-q', branch]);
  try {
    return act();
  } finally {
    git(h.at, ['switch', '-q', 'main']);
  }
}

/** A file written in the main checkout and staged. @param {History} h @param {string} file @param {string} text */
function staged(h, file, text) {
  fs.writeFileSync(path.join(h.at, file), text);
  git(h.at, ['add', '--', file]);
}

/** A commit on a task's branch writing `files` and taking back `removed`, under its stamp. @param {History} h @param {Task} task @param {Record<string, string>} files @param {string[]} [removed] */
function committed(h, task, files, removed = []) {
  commitFiles(h.at, task.branch, task.files.size === 0 ? task.cut : task.branch, files, { removed });
  for (const [file, text] of Object.entries(files)) wrote(h, task, file, text);
  for (const file of removed) wrote(h, task, file, null);
}

/**
 * The history's tasks cut: one to three of the pool, each stacked on the
 * one before or cut from main, of one to three commits, a stacked one's
 * last perhaps deleting or rewriting a file of the task beneath.
 * @param {History} h
 */
function cutTasks(h) {
  for (let n = 0, count = 1 + under(h, 3); n < count; n += 1) {
    const below = n > 0 && chance(h, 0.5) ? h.tasks[n - 1] : null;
    const task = taskOf(POOL[n], below, tip(h.at, below?.branch ?? 'main'));
    below?.above.push(task);
    const commits = 1 + under(h, 3);
    const reach = below !== null && chance(h, 0.6) ? pick(h, writable(below)) : undefined;
    const undone = reach !== undefined && chance(h, 0.5);
    for (let c = 1; c <= commits; c += 1) {
      const files = { [`${task.shown}-${c}.txt`]: `${task.shown} ${c}\n` };
      const last = c === commits && reach !== undefined;
      if (last && !undone) files[reach] = `${task.shown} rewrote it\n`;
      committed(h, task, files, last && undone ? [reach] : []);
    }
    if (reach !== undefined) /** @type {Task} */ (below).frozen.add(reach);
    h.tasks.push(task);
    h.steps.push(`${task.shown} cut from ${below?.shown ?? 'main'}, ${commits} commit(s)${reach === undefined ? '' : `, its last ${undone ? 'deleting' : 'rewriting'} ${reach}`}`);
  }
}

/**
 * A verb run as the person runs it, every refusal's way on followed and
 * the verb run again, until it goes through, there is nothing left to
 * land, or its way on cannot be followed: its answer, or null. Each commit
 * it lands on main must change something.
 * @param {History} h @param {string[]} args @param {number} [depth]
 * @returns {Record<string, any>|null}
 */
function attempt(h, args, depth = 0) {
  for (let tries = 0; tries < 4; tries += 1) {
    const before = h.side.defaultTip(h.at);
    const res = call(h.at, args, h.as);
    emptyLandings(h, args, before);
    if (res.code === 0) {
      const answer = JSON.parse(res.stdout.split('\n')[0]);
      h.steps.push(`${'  '.repeat(depth)}${args.join(' ')}: ${answer.already ? 'already' : 'ok'}`);
      if (args[1] === 'open' && !answer.already) openedNow(h, args[3]);
      return answer;
    }
    if (res.code !== 1) {
      h.problems.push(`${args.join(' ')} crashed: ${res.stderr}`);
      return null;
    }
    const refusal = JSON.parse(res.stderr.trim()).error;
    h.steps.push(`${'  '.repeat(depth)}${args.join(' ')}: refused — ${refusal}`);
    if (NOTHING_LEFT.test(refusal)) return null;
    if (depth > 2 || !followed(h, refusal, depth)) {
      h.problems.push(`no way on followed for ${args.join(' ')}: ${refusal}`);
      return null;
    }
  }
  h.problems.push(`${args.join(' ')} still refused after four ways on`);
  return null;
}

/**
 * Each commit a verb landed on main past `before` that changes nothing
 * against its first parent, a problem: a task landed again.
 * @param {History} h @param {string[]} args @param {string} before
 */
function emptyLandings(h, args, before) {
  const host = h.side.on(h.at);
  const after = h.side.defaultTip(h.at);
  if (after === before) return;
  const made = git(host, ['log', '--reverse', '--first-parent', '--format=%T %s', `${before}..${after}`]).split('\n').filter(Boolean);
  let tree = git(host, ['rev-parse', `${before}^{tree}`]).trim();
  for (const line of made) {
    const [held, ...subject] = line.split(' ');
    if (held === tree) h.problems.push(`${args.join(' ')} landed "${subject.join(' ')}", which changes nothing`);
    tree = held;
  }
}

/**
 * A refusal's way on followed as the person follows it: the commands it
 * names — a change kept aside as a task of its own withdrawn from the model
 * (`withdrawn`) — else the merge it asks for in words, or the tasks it asks
 * opened first. Whether it named a way on to follow.
 * @param {History} h @param {string} refusal @param {number} depth
 */
function followed(h, refusal, depth) {
  const commands = commandsOf(refusal);
  const moved = MOVED.exec(refusal);
  if (commands.length > 0) {
    const went = ranWayOn(h, refusal, commands, depth);
    if (went && moved !== null) withdrawn(h, moved[1], moved[2]);
    return went;
  }
  const back = /merge it back onto (\S+) first/.exec(refusal);
  const settle = /merge (\S+) into (\S+), settling the conflict(, push it)?/.exec(refusal);
  const open = /not opened — open (.+?) first/.exec(refusal);
  const branch = NAMED_BRANCH.exec(refusal)?.[0];
  if (back !== null && branch !== undefined) return mergedInto(h, branch, back[1], false);
  if (settle !== null) return mergedInto(h, settle[2], settle[1], settle[3] !== undefined);
  if (open !== null) return (open[1].match(/\d+\.\d+/g) ?? []).every((shown) => attempt(h, ['land', 'open', UNIT, shown], depth + 1) !== null);
  return false;
}

/**
 * The commands a way on names, run in order: a `land` verb as `attempt`
 * runs it, anything else in a shell at the project — on the task's branch
 * where the way on says to pull its copy on the host first, else from
 * main, main out again after, as a rebase of a task's branch leaves that
 * branch out — each rebase, merge or pick that stops settled (`settled`)
 * and gone on with.
 * @param {History} h @param {string} refusal @param {string[]} commands @param {number} depth
 */
function ranWayOn(h, refusal, commands, depth) {
  const on = /— on (\S+), pull its copy/.exec(refusal)?.[1];
  h.steps.push(`${'  '.repeat(depth)}  followed: ${commands.join('; ')}`);
  /** @type {{land: boolean, run: string[]}[]} */
  const groups = [];
  for (const command of commands) {
    const land = command.startsWith('land ');
    const last = groups[groups.length - 1];
    if (!land && last !== undefined && !last.land) last.run.push(command);
    else groups.push({ land, run: [command] });
  }
  return groups.every(({ land, run }) => {
    if (land) return attempt(h, wordsOf(run[0]), depth + 1) !== null;
    const ran = () => run.every((command) => ranGit(h, command));
    return onBranch(h, on ?? 'main', ran);
  });
}

/** A way on's git command run in a shell at the project, a rebase, merge or pick it stops settled (`settled`). @param {History} h @param {string} command */
function ranGit(h, command) {
  const words = wordsOf(command);
  const tree = words[1] === '-C' ? words[2] : h.at;
  const ran = spawnSync('sh', ['-c', command], { cwd: h.at, encoding: 'utf8', env: { ...process.env, GIT_EDITOR: 'true' } });
  if (ran.status === 0 || words.includes('--continue')) return settledRebase(h, tree);
  if (rebaseStopped(tree)) return settledRebase(h, tree);
  if (pickStopped(tree)) return settledPick(h, tree);
  if (tried(tree, ['rev-parse', '-q', '--verify', 'MERGE_HEAD']).status === 0) {
    settled(h, tree, 'ours');
    git(tree, ['commit', '-q', '--no-edit']);
    return true;
  }
  h.problems.push(`${command} failed: ${ran.stderr.trim()}`);
  return false;
}

/**
 * Each conflict in the worktree at `tree` settled as the person means it:
 * the side holding the file as the model ends it — its last write, or none
 * — else the task's side, `way`; the file gone where the side kept has none.
 * @param {History} h @param {string} tree @param {'ours'|'theirs'} way
 */
function settled(h, tree, way) {
  /** @type {Map<string, Map<number, string>>} */
  const sides = new Map();
  for (const line of git(tree, ['ls-files', '-u', '-z']).split('\0').filter(Boolean)) {
    const [meta, file] = line.split('\t');
    const [, blob, stage] = meta.split(' ');
    if (!sides.has(file)) sides.set(file, new Map());
    /** @type {Map<number, string>} */ (sides.get(file)).set(Number(stage), blob);
  }
  for (const [file, held] of sides) {
    const last = h.model.get(file);
    const kept = held.get(2) === last ? 'ours' : held.get(3) === last ? 'theirs' : way;
    if (held.has(kept === 'ours' ? 2 : 3)) {
      git(tree, ['checkout', `--${kept}`, '--', file]);
      git(tree, ['add', '--', file]);
    } else git(tree, ['rm', '-q', '--', file]);
  }
}

/**
 * A rebase stopped in the worktree at `tree` gone on with until it ends,
 * each stop settled (`settled`), the task's side the commit it replays, and
 * a commit the settling leaves empty skipped.
 * @param {History} h @param {string} tree
 */
function settledRebase(h, tree) {
  for (let stops = 0; rebaseStopped(tree); stops += 1) {
    if (stops > 8) {
      h.problems.push(`a rebase at ${tree} never ends`);
      return false;
    }
    settled(h, tree, 'theirs');
    const went = tried(tree, ['-c', 'core.editor=true', 'rebase', '--continue']);
    if (went.status !== 0 && rebaseStopped(tree) && git(tree, ['ls-files', '-u']).trim() === '') tried(tree, ['rebase', '--skip']);
  }
  return true;
}

/** Whether a pick is stopped in the worktree at `tree`. @param {string} tree */
const pickStopped = (tree) => tried(tree, ['rev-parse', '-q', '--verify', 'CHERRY_PICK_HEAD']).status === 0;

/**
 * A pick stopped in the worktree at `tree` gone on with until it ends, each
 * stop settled (`settled`), the task's side the commit it picks, and a
 * commit the settling leaves empty skipped.
 * @param {History} h @param {string} tree
 */
function settledPick(h, tree) {
  for (let stops = 0; pickStopped(tree); stops += 1) {
    if (stops > 8) {
      h.problems.push(`a pick at ${tree} never ends`);
      return false;
    }
    settled(h, tree, 'theirs');
    const went = tried(tree, ['-c', 'core.editor=true', 'cherry-pick', '--continue']);
    if (went.status !== 0 && pickStopped(tree) && git(tree, ['ls-files', '-u']).trim() === '') tried(tree, ['cherry-pick', '--skip']);
  }
  return true;
}

/**
 * `from` merged into a task's branch, each conflict settled (`settled`),
 * and the branch pushed where the way on asks it: whether it merged.
 * @param {History} h @param {string} branch @param {string} from @param {boolean} push
 */
function mergedInto(h, branch, from, push) {
  onBranch(h, branch, () => {
    if (tried(h.at, ['merge', '-q', '--no-edit', from]).status !== 0) {
      settled(h, h.at, 'ours');
      git(h.at, ['commit', '-q', '--no-edit']);
    }
  });
  if (push && tried(h.at, ['push', '-q', 'origin', branch]).status !== 0) git(h.at, ['push', '-q', '--force-with-lease', 'origin', branch]);
  h.steps.push(`  followed: ${from} merged into ${branch}${push ? ', pushed' : ''}`);
  return true;
}

/**
 * Each task a by-hand landing of `task` lands: it, and, where the landing
 * took its branch whole, every task its branch was cut on.
 * @param {History} h @param {Task} task @param {string} how @param {boolean} whole
 */
function landedByHand(h, task, how, whole) {
  for (const held of lands(task, whole)) held.landed = true;
  h.steps.push(`${task.shown} ${how}`);
}

/** The tasks a landing of `task` by hand lands: it, and, where it took its branch whole, every task its branch was cut on. @param {Task} task @param {boolean} whole */
function lands(task, whole) {
  const all = [];
  for (let held = /** @type {Task|null} */ (task); held !== null; held = whole ? held.below : null) all.push(held);
  return all;
}

/** The change of the person's own a landing by hand carries, staged: app.txt reworded. @param {History} h */
function carried(h) {
  const text = `app, as I landed it ${next(h)}\n`;
  staged(h, 'app.txt', text);
  wrote(h, null, 'app.txt', text);
  return ', carrying a change of my own';
}

/**
 * The way by hand that lands a task's own commits alone, never its branch
 * whole — never for a task cut on one not landed, whose commits' change to
 * that one's files a pick would lay where main holds none of them.
 */
const PICKED = 'its commits picked';

/**
 * The ways a person lands a task's branch on main in their own checkout:
 * what each did, or null where git stopped it, nothing then moved.
 * @type {Record<string, (h: History, task: Task) => string|null>}
 */
const HAND = {
  'squashed under my own words': (h, task) => squashed(h, task, ['-m', 'In my own words']),
  'squashed under git\'s message': (h, task) => squashed(h, task, ['--no-edit']),
  'merged by a merge commit': (h, task) => {
    if (tried(h.at, ['merge', '-q', '--no-ff', '--no-commit', task.branch]).status !== 0) return aborted(h, ['merge', '--abort']);
    if (tried(h.at, ['rev-parse', '-q', '--verify', 'MERGE_HEAD']).status !== 0) return null;
    const extra = chance(h, 0.5) ? carried(h) : '';
    git(h.at, ['commit', '-q', '--no-edit']);
    return `merged by hand by a merge commit${extra}`;
  },
  'fast-forwarded': (h, task) => {
    if (tried(h.at, ['merge', '-q', '--ff-only', task.branch]).status !== 0) return HAND['merged by a merge commit'](h, task);
    return 'fast-forwarded by hand';
  },
  [PICKED]: (h, task) => {
    const own = git(h.at, ['rev-list', '--reverse', '--no-merges', `${task.cut}..${task.branch}`]).split('\n').filter(Boolean);
    if (own.length === 0 || tried(h.at, ['cherry-pick', ...own]).status !== 0) return aborted(h, ['cherry-pick', '--abort']);
    return `its own commits picked onto main by hand (${own.length})`;
  },
};

/** A landing by hand git stopped, ended: null. @param {History} h @param {string[]} end */
function aborted(h, end) {
  tried(h.at, end);
  tried(h.at, ['reset', '-q', '--hard']);
  return null;
}

/** A task's branch squashed onto main by hand, committed with `message`. @param {History} h @param {Task} task @param {string[]} message */
function squashed(h, task, message) {
  if (tried(h.at, ['merge', '-q', '--squash', task.branch]).status !== 0) return aborted(h, ['merge', '--abort']);
  if (tried(h.at, ['diff', '--cached', '--quiet']).status === 0) return null;
  const extra = chance(h, 0.5) ? carried(h) : '';
  if (tried(h.at, ['commit', '-q', ...message]).status !== 0) return aborted(h, ['merge', '--abort']);
  return `squashed by hand under ${message[0] === '-m' ? 'my own words' : 'git\'s message'}${extra}`;
}

/**
 * A task's branch pushed over its copy on the host where the person
 * rewrote it since it was pushed — that copy's head, held here, no longer
 * on it — as the person updating their pull request does before merging it
 * on the site; a branch only gone on past that head left as it is.
 * @param {History} h @param {Task} task
 */
function republished(h, task) {
  const [held] = tried(h.at, ['ls-remote', 'origin', `refs/heads/${task.branch}`]).stdout.split('\t');
  if (held === '' || tried(h.at, ['cat-file', '-e', `${held}^{commit}`]).status !== 0 || tried(h.at, ['merge-base', '--is-ancestor', held, task.branch]).status === 0) return;
  git(h.at, ['push', '-q', '--force', 'origin', task.branch]);
  h.steps.push(`${task.shown}'s branch, rewritten since it was pushed, pushed over its pull request`);
}

/**
 * A task landed by hand: on the host's site where its pull request is open
 * there (`republished` first), else in the person's checkout, then pushed —
 * each file main held as the model ends it, that work landed, which the
 * landing changed then the model's as main holds it (`overridden`).
 * @param {History} h @param {Task} task
 */
function byHand(h, task) {
  const before = { main: treeOf(h.side.on(h.at), 'main'), landed: new Set(allTasks(h).filter((held) => held.landed)) };
  if (h.side.mergedOnHost !== null && task.opened && chance(h, 0.5)) {
    const method = pick(h, ['squash', 'merge', 'rebase']);
    const pulled = chance(h, 0.5);
    republished(h, task);
    if (h.side.mergedOnHost(h.at, task.branch, method, pulled)) {
      overridden(h, before);
      return landedByHand(h, task, `merged on the host's site by ${method}, ${pulled ? 'pulled' : 'not pulled'}`, true);
    }
  }
  h.side.pulled(h.at);
  const how = pick(h, Object.keys(HAND));
  if (how === PICKED && task.below !== null && !task.below.landed) return h.steps.push(`${task.shown} not landed by hand: its own commits never picked while the task below it has not landed`);
  const done = HAND[how](h, task);
  if (done === null) return h.steps.push(`${task.shown} not landed by hand: ${how} stopped`);
  h.side.pushed(h.at);
  overridden(h, before);
  return landedByHand(h, task, done, how !== PICKED);
}

/**
 * Each file a landing by hand leaves on main otherwise than the model ends
 * it, the model's then as main holds it, the person's: one main held as
 * the model ends it that the landing changed, that write the person's or a
 * task's already landed — a task cut below another landed after that one's
 * own work, its write over a file that work rewrote standing, as work that
 * landed stays landed (R25).
 * @param {History} h @param {{main: Map<string, string>, landed: Set<Task>}} before
 */
function overridden(h, before) {
  const after = treeOf(h.side.on(h.at), 'main');
  for (const file of new Set([...before.main.keys(), ...after.keys(), ...h.model.keys()])) {
    const [by, is, was, should] = [h.writers.get(file), after.get(file), before.main.get(file), h.model.get(file)];
    const task = by === undefined || by === null ? null : by;
    const changed = was === should && is !== was && (task === null || before.landed.has(task));
    if (is === should || !changed) continue;
    if (is === undefined) h.model.delete(file);
    else h.model.set(file, is);
    h.writers.set(file, null);
  }
}

/**
 * The ways a person commits on a task's branch: what each wrote, taking
 * back a file by a commit, an amend, or a fold of the branch into one
 * commit under its tip's stamp — a take-back only where the task keeps
 * another file, so its work still changes something. An amend is for a
 * task no other is cut from — its last commit, where it did nothing else,
 * dropped before the task lands, else left empty, a branch dropped below
 * its landing having nothing new, a take-back only where it comes through
 * (`replayed`) — a fold for one cut from main whose branch holds no merge,
 * once it has landed only where its branch stands at its landing, its
 * take-back then nothing new; each `rewrites` the branch (`reshapeable`).
 * Adding back writes a file the task took back as it held it. Each acts on
 * a file of those `from` names, else of those the task may write.
 * @type {Record<string, {can: (task: Task, h: History) => boolean, rewrites?: boolean, from?: (task: Task) => string[], act: (h: History, task: Task, file: string) => string}>}
 */
const COMMITS = {
  adding: {
    can: () => true,
    act: (h, task) => {
      const file = `${task.shown}-x${next(h)}.txt`;
      committed(h, task, { [file]: `${task.shown} more\n` });
      return `${file} added`;
    },
  },
  rewriting: {
    can: (task) => writable(task).length > 0,
    act: (h, task, file) => {
      committed(h, task, { [file]: `${task.shown} again ${next(h)}\n` });
      return `${file} rewritten`;
    },
  },
  'taking back': {
    can: takeable,
    act: (h, task, file) => {
      committed(h, task, {}, [file]);
      return `${file} taken back`;
    },
  },
  'adding back': {
    can: (task) => returnable(task).length > 0,
    from: returnable,
    act: (h, task, file) => {
      committed(h, task, { [file]: /** @type {string} */ (task.gone.get(file)) });
      return `${file} added back as it was`;
    },
  },
  'amending a take-back': {
    can: (task) => takeable(task) && task.above.length === 0,
    rewrites: true,
    act: (h, task, file) => {
      const [how, through] = onBranch(h, task.branch, () => {
        const comes = replayed(h, task, file);
        git(h.at, ['rm', '-q', '--', file]);
        const empty = tried(h.at, ['diff', '--cached', '--quiet', 'HEAD^']).status === 0;
        if (empty && !task.landed) {
          git(h.at, ['reset', '-q', '--hard', 'HEAD^']);
          return ['dropping its last commit, which did nothing else', comes];
        }
        git(h.at, ['commit', '-q', '--amend', '--no-edit', '--allow-empty']);
        return [empty ? 'amending its last commit, which then does nothing' : 'amending its last commit', comes];
      });
      if (through) wrote(h, task, file, null);
      return `${file} taken back by ${how}${through ? '' : ', which landed — nothing new laid on its landing'}`;
    },
  },
  'folding a take-back': {
    can: (task, h) => takeable(task) && task.above.length === 0 && task.below === null && !task.merged && (!task.landed || tip(h.at, task.branch) === recordedTip(h, task)),
    rewrites: true,
    act: (h, task, file) => {
      const old = tip(h.at, task.branch);
      onBranch(h, task.branch, () => {
        git(h.at, ['reset', '-q', '--soft', task.cut]);
        git(h.at, ['rm', '-q', '-f', '--', file]);
        git(h.at, ['commit', '-q', '-C', old]);
      });
      if (!task.landed) wrote(h, task, file, null);
      return `${file} taken back by folding the branch into one commit under its tip's message${task.landed ? ', which landed — nothing new laid on its landing' : ''}`;
    },
  },
};

/**
 * A commit on a task's branch, one of `COMMITS` it can take — one that
 * rewrites it only where it is `reshapeable` — on a file of those it takes
 * (`from`), else of those it may write; a rewrite past a landing a verb read
 * then opened at once (`opened`).
 * @param {History} h @param {Task} task
 */
function commitOn(h, task) {
  const read = task.landed && recorded(h, task);
  const how = pick(h, Object.keys(COMMITS).filter((name) => COMMITS[name].can(task, h) && (COMMITS[name].rewrites !== true || !task.landed || read)));
  const { act, from = writable, rewrites = false } = COMMITS[how];
  h.steps.push(`${task.shown}: ${act(h, task, pick(h, from(task)))}`);
  if (rewrites && read) opened(h, task);
}

/**
 * main merged back into a task's branch, each conflict settled
 * (`settled`), the merge carrying a change of its own or not — never past
 * a landing a verb read, the task then opened at once (`opened`).
 * @param {History} h @param {Task} task
 */
function mergedBack(h, task) {
  const past = task.landed;
  const said = onBranch(h, task.branch, () => {
    if (tried(h.at, ['merge', '-q', '--no-ff', '--no-commit', 'main']).status !== 0) settled(h, h.at, 'ours');
    if (tried(h.at, ['rev-parse', '-q', '--verify', 'MERGE_HEAD']).status !== 0) return 'nothing to merge back';
    const file = !past && chance(h, 0.4) ? pick(h, writable(task)) : undefined;
    if (file !== undefined) {
      const text = `${task.shown} settled ${next(h)}\n`;
      staged(h, file, text);
      wrote(h, task, file, text);
    }
    git(h.at, ['commit', '-q', '--no-edit']);
    task.merged = true;
    return `main merged back${file === undefined ? '' : `, the merge rewriting ${file}`}`;
  });
  h.steps.push(`${task.shown}: ${said}`);
  if (past) opened(h, task);
}

/** The person's own commit on main, pushed: a file of their own, or app.txt reworded. @param {History} h */
function ownCommit(h) {
  h.side.pulled(h.at);
  const n = next(h);
  const file = chance(h, 0.5) ? `own-${n}.txt` : 'app.txt';
  staged(h, file, `mine ${n}\n`);
  git(h.at, ['commit', '-q', '-m', `My own change ${n}`]);
  h.side.pushed(h.at);
  wrote(h, null, file, `mine ${n}\n`);
  h.steps.push(`my own commit on main, writing ${file}`);
}

/**
 * A file of a landed task that main holds as the task's branch does, which
 * another may then rewrite — no task writing it again — or undefined.
 * @param {History} h @param {Task} task
 */
function rewritable(h, task) {
  const file = pick(h, writable(task));
  if (file === undefined) return undefined;
  h.side.pulled(h.at);
  const [onMain, onTask] = tried(h.at, ['rev-parse', `main:${file}`, `${task.branch}:${file}`]).stdout.split('\n');
  if (onMain !== onTask) return undefined;
  for (const held of allTasks(h)) held.frozen.add(file);
  return file;
}

/** A landed task's file reworded on main by the person's own commit, pushed. @param {History} h @param {Task} task */
function reworded(h, task) {
  const file = rewritable(h, task);
  if (file === undefined) return;
  const text = `reworded ${next(h)}\n`;
  staged(h, file, text);
  git(h.at, ['commit', '-q', '-m', `Reword ${file}`]);
  h.side.pushed(h.at);
  wrote(h, null, file, text);
  h.steps.push(`my own commit on main rewording ${task.shown}'s ${file}`);
}

/** The later task cut from main rewriting a landed task's file, opened, and its phase landed. @param {History} h @param {Task} task */
function laterTask(h, task) {
  const file = rewritable(h, task);
  if (file === undefined) return;
  const later = taskOf(LATER, null, tip(h.at, 'main'));
  committed(h, later, { [file]: `${later.shown} rewrote it\n` });
  h.later = later;
  h.steps.push(`${later.shown} cut from main, rewriting ${task.shown}'s ${file}`);
  later.opened = attempt(h, openArgs(later)) !== null;
  attempt(h, ['land', 'phase', UNIT, '5']);
}

/** A task opened. @param {History} h @param {Task} task */
function opened(h, task) {
  const answer = attempt(h, openArgs(task));
  task.opened = answer !== null;
  if (answer?.already) task.landed = true;
}

/** Phase 4 landed, each task it merged then landed. @param {History} h */
function phaseLanded(h) {
  const answer = attempt(h, ['land', 'phase', UNIT, '4']);
  const merged = new Set(answer?.repos?.[0]?.merged ?? []);
  for (const task of h.tasks) if (merged.has(task.shown)) task.landed = true;
}

/**
 * What a history does between cutting its tasks and landing them all, each
 * with its weight and the tasks it can be done to.
 * @type {{weight: number, can: (h: History) => (Task|null)[], act: (h: History, task: any) => void}[]}
 */
const EVENTS = [
  { weight: 3, can: (h) => h.tasks.filter((task) => !task.opened), act: opened },
  { weight: 4, can: (h) => h.tasks.filter((task) => !task.landed), act: byHand },
  { weight: 3, can: (h) => h.tasks, act: commitOn },
  { weight: 1, can: (h) => h.tasks.filter((task) => writable(task).length > 0 && reshapeable(h, task)), act: mergedBack },
  { weight: 1, can: () => [null], act: ownCommit },
  { weight: 1, can: (h) => h.tasks.filter((task) => task.landed), act: reworded },
  { weight: 1, can: (h) => (h.later === null ? h.tasks.filter((task) => task.landed) : []), act: laterTask },
  { weight: 1, can: (h) => (h.tasks.some((task) => task.opened) ? [null] : []), act: phaseLanded },
];

/** One of `EVENTS` that can be done, drawn by weight, done to one of its tasks. @param {History} h */
function event(h) {
  const open = EVENTS.map((one) => ({ ...one, tasks: one.can(h) })).filter((one) => one.tasks.length > 0);
  let at = h.draw() * open.reduce((sum, one) => sum + one.weight, 0);
  const chosen = open.find((one) => {
    at -= one.weight;
    return at < 0;
  }) ?? open[open.length - 1];
  chosen.act(h, pick(h, chosen.tasks));
}

/** Everything still to land landed by the verbs: each task opened, then its phase. @param {History} h */
function landedAll(h) {
  h.steps.push('then every task opened and its phase landed:');
  for (const task of h.tasks) attempt(h, openArgs(task));
  attempt(h, ['land', 'phase', UNIT, '4']);
  if (h.later === null) return;
  attempt(h, openArgs(h.later));
  attempt(h, ['land', 'phase', UNIT, '5']);
}

/**
 * The history held to the model: main holding exactly the model's files,
 * and each task's record holding its branch's work as it ends.
 * @param {History} h
 */
function checked(h) {
  h.side.pulled(h.at);
  const held = treeOf(h.side.on(h.at), 'main');
  for (const file of new Set([...held.keys(), ...h.model.keys()])) {
    const [is, should] = [held.get(file), h.model.get(file)];
    if (is !== should) h.problems.push(`main ${is === undefined ? 'lacks' : should === undefined ? 'holds' : 'holds another'} ${file}`);
  }
  const landings = readManifest(h.at, UNIT).landings ?? {};
  const main = git(h.at, ['rev-parse', 'main^{tree}']).trim();
  for (const task of allTasks(h)) {
    const record = landings[taskId(parseShownTask(UNIT, task.shown))]?.['.'];
    if (record === undefined) {
      h.problems.push(`${task.shown} has no landing record`);
      continue;
    }
    const merged = tried(h.at, ['merge-tree', '--write-tree', `--merge-base=${record.tip}`, 'main', task.branch]);
    if (merged.stdout.split('\n')[0] !== main) h.problems.push(`${task.shown}'s record, at ${record.tip.slice(0, 7)}: main lacks what its branch changed past it`);
  }
}

/**
 * The history of `seed` run in the world at `at` on the driver of `side`,
 * and held to the model: what it did, and every problem found.
 * @param {any} side @param {string} at @param {number} seed
 * @returns {{steps: string[], problems: string[]}}
 */
function history(side, at, seed) {
  /** @type {History} */
  const h = { side, at, as: { env: side.env }, seed, draw: drawsOf(seed), tasks: [], later: null, model: treeOf(at, 'main'), writers: new Map(), made: 0, steps: [], problems: [] };
  cutTasks(h);
  for (let n = 2 + under(h, 4); n > 0; n -= 1) event(h);
  landedAll(h);
  checked(h);
  return { steps: h.steps, problems: h.problems };
}

module.exports = { GATE, POOL, LATER, seeds, historyWorld, history };

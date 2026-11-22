'use strict';

// ---------------------------------------------------------------------------
// Domain ring: ledger's boot gates — the menus the start puts to the
// user before any work is on the table: the state lost, the GitHub rule's
// offer, the migration confirm, the label opt-in, the brownfield offer, and
// the pick between the pieces of work the person's words name — the
// stops on a git below the engine's floor, in a folder in no git repository,
// at the reshape's guard, at the checks before its move, this session
// carrying the migration on or another, and at a directive another session
// carries on; the migration at work at a directive, or part-way through one,
// this session carrying it on; the question where a building unit's leaving
// topics go, the knowledge gate's screens and its questions for a provider's setup, and the
// banner the bare command opens on. Each setup screen's row leads to the
// call that answers it. Pure renderers; none reads state (the calling prose follows the
// boot response and fetches the gate at its display point, and the render
// surface reads what a display names).
// ---------------------------------------------------------------------------

const { section, titleSection, dataSection, menu, cmdOption, promptOption, treeList, CONTINUE_INSTRUCTION, CONTINUE_MARKDOWN_INSTRUCTION, emitAs, STOP_CLAUSE, MENU_INSTRUCTION, escapeMarkdown } = require('./surfaces.cjs');
const { wrapWithPrefix } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');
const { ENGINE_COMMAND } = require('../../kernel/call.cjs');
const { titlecase } = require('../conventions.cjs');
const { fmtAge } = require('../presence.cjs');

const ABOVE_MENU_INSTRUCTION = emitAs('text', ', directly above the menu');

const WIZARD_COMMAND = `${ENGINE_COMMAND} knowledge setup`;

/** The parts of the reshape's summary, by key, in their order, each with its label. */
const RESHAPE_PARTS = Object.freeze([
  ['moved', 'Moved into Ledger'],
  ['records', 'Records'],
  ['corrections', 'Corrections'],
  ['checks', 'Checks and fixes'],
  ['legacy', 'Kept as legacy'],
  ['code', 'The code commit'],
]);

/**
 * What the migrations did, above the confirm gate: the summary the session
 * wrote — the reshape's in its parts, each labelled, in their order — each
 * notice a migration handed back for the person, then the run's counts —
 * left out where the run updated no file and only the verification fixed
 * anything; and where the reshape's code commit is still to make, that it
 * goes on the code branch and is not pushed.
 * @param {{summary: string|Partial<Record<string, string>>, notices: string[], counts: {migrations: number, files: number}|null, unpushed?: {branch: string|null}|null}} applied
 * @returns {string}
 */
function migrationsApplied({ summary, notices, counts, unpushed = null }) {
  const account = typeof summary === 'string'
    ? summary
    : RESHAPE_PARTS.filter(([key]) => summary[key] !== undefined).map(([key, label]) => `**${label}:** ${summary[key]}`).join('\n\n');
  const branch = unpushed?.branch == null ? '' : ` goes on \`${unpushed.branch}\` and`;
  return section('DISPLAY: migrations applied', CONTINUE_MARKDOWN_INSTRUCTION, [
    '**Migrations Applied**',
    '',
    account,
    ...notices.flatMap((notice) => ['', notice]),
    ...(counts ? ['', `${counts.migrations} migration(s), ${counts.files} file(s) updated.`] : []),
    ...(unpushed ? ['', `The code commit${branch} is not pushed: pushing it is yours.`] : []),
  ].join('\n'));
}

/** The commit the migration gate's yes makes: the migrations' changes, on each side they changed. */
const MIGRATIONS_COMMIT = Object.freeze(['commit', '--migrations', '-m', "chore: apply Ledger's migrations"]);

/**
 * The migration confirm gate — after the summary of what the migrations did;
 * where the reshape's commit is part made, saying only the code branch's
 * remains (21.9.5). Its yes makes the migrations' commit.
 * @param {{codeOnly?: boolean}} [opts]
 * @returns {string}
 */
function migrationGate({ codeOnly = false } = {}) {
  const body = menu(
    codeOnly ? "The state branch's first commit is made: only the code branch's commit remains." : '',
    [
      cmdOption('y', 'yes', 'Proceed', { next: { kind: 'engine', argv: [...MIGRATIONS_COMMIT] } }),
      promptOption('Ask', 'Ask questions about the changes'),
    ],
    { question: 'Ready to continue?' },
  );
  return section('MENU: migration gate', MENU_INSTRUCTION, body);
}

/**
 * Boot's stop where the state branch is gone here and on the remote, in a
 * project whose code tree holds Ledger's trace (4.4.5): what was lost,
 * the other clone that can put it back, and the fresh start on yes, `boot
 * --start-again`; a no ends the start with nothing written.
 * @param {string} project the project's name
 * @returns {string}
 */
function stateLostGate(project) {
  const name = escapeMarkdown(project);
  const account = [
    `> ${name} keeps its Ledger state on a branch of its own, \`ledger-state\`. Boot found it neither in this clone nor on the remote.`,
    '>',
    `> If another clone of ${name} still has it, on this machine or another, run Ledger there: boot pushes it back to the remote, and this clone restores it when it next starts.`,
    '>',
    `> Otherwise the state is lost: the decisions, the logs and the ledger. ${name}'s code and its history are untouched.`,
  ];
  return [
    section('DISPLAY: state lost stop', emitAs('properties'), "⚑ Boot stopped: Ledger's state branch is gone"),
    section('DISPLAY: state lost account', emitAs('markdown'), account.join('\n')),
    section('MENU: state lost gate', MENU_INSTRUCTION, menu('', [
      cmdOption('y', 'yes', { head: 'Start again', tail: `a fresh state branch, then the product researcher reads ${name}'s code to rebuild what it can` }, { next: { kind: 'engine', argv: ['boot', '--start-again'] } }),
      cmdOption('n', 'no', { head: 'Not now', tail: 'look for another clone first; nothing is written' }),
    ], { question: 'Start again with a fresh state?' })),
  ].join('\n');
}

/**
 * Boot's stop where the git on the PATH is older than the engine's floor, or
 * none runs: the floor, what boot found, and where to get one at the floor.
 * @param {string} floor the oldest git the engine runs on
 * @param {string|null} found the version boot found, or null where no git runs
 * @returns {string}
 */
function gitFloorStop(floor, found) {
  const [title, what] = found === null
    ? ['Ledger found no git to run', 'and boot found no git it could run on this machine.']
    : ['this git is older than Ledger needs', `and the git on this machine is ${found}.`];
  const account = [
    `> Ledger runs on git ${floor} or newer, ${what}`,
    '>',
    `> Install git ${floor} or newer, then start a new session in this project. git-scm.com/downloads gives the ways to get one on each system; on a Mac, Homebrew's git takes over from the one Apple's command-line tools bring.`,
  ];
  return [
    section('DISPLAY: git floor stop', emitAs('properties'), `⚑ Boot stopped: ${title}`),
    section('DISPLAY: git floor account', emitAs('markdown'), account.join('\n')),
  ].join('\n');
}

/**
 * Boot's stop in a folder in no git repository: Ledger runs inside one, and
 * the way on is the person's — never a repository set up for them.
 * @param {string} folder absolute
 * @returns {string}
 */
function repoStop(folder) {
  const account = [
    `> Ledger runs inside a git repository, and \`${folder}\` is in none.`,
    '>',
    '> Make this folder a repository, or open Ledger in the repository the work lives in, then run `/ledger` again.',
  ];
  return [
    section('DISPLAY: repo stop', emitAs('properties'), '⚑ Boot stopped: this folder is in no git repository'),
    section('DISPLAY: repo account', emitAs('markdown'), account.join('\n')),
  ].join('\n');
}

/**
 * What a directive finished, kept: its pieces done of all of them, each
 * checked; null where none is done, or its check cannot say.
 * @param {string} project @param {import('../directives.cjs').Progress|null} progress
 * @returns {string|null}
 */
function keptOf(project, progress) {
  if (progress === null || progress.done === 0) return null;
  const { done, of, counts, says } = progress;
  return `What it finished is kept: ${done} of ${escapeMarkdown(project)}'s ${of} ${of === 1 ? counts.one : counts.many} ${says}, each checked.`;
}

/** The migration's screens' opening, at work and part-way through a step. */
const AT_WORK = "Ledger is bringing this project's past work into its new format.";
const PART_WAY = "Ledger is part-way through bringing this project's past work into its new format.";

/** What the person does while a step the session carries out runs. */
const WAIT = 'It takes a while: nothing is needed from you until it asks.';

/** Where the start goes once the migration is over. */
const AFTER = 'The start menu follows once the migration is done and committed.';

/**
 * A screen of the migration, in the normal colour — its work is never a
 * failure: its marker naming the step, its opening line, and its account,
 * each paragraph a line of the signpost.
 * @param {string} name the section's @param {string} step @param {string} opening @param {string[]} paragraphs
 * @returns {string}
 */
function migrationScreen(name, step, opening, paragraphs) {
  return section(`DISPLAY: ${name}`, emitAs('markdown'), [
    `**\`▪ Migration · ${step}\`**`,
    '',
    opening,
    '',
    paragraphs.map((paragraph) => `> ${paragraph}`).join('\n>\n'),
  ].join('\n'));
}

/**
 * Boot's stop where another live session carries a directive of the
 * migration on (21.10.11, P7): that session carrying it on, its step; no
 * session works in the project until the migration is done; what the
 * directive finished is kept, each piece checked, where its check can say;
 * and when that session was last active, this one stopping there.
 * @param {{project: string, step: string, progress: import('../directives.cjs').Progress|null, carrier: number}} stopped the project's name, the directive's step in words, where it stands, and the whole seconds since the session carrying it on was last active
 * @returns {string}
 */
function directiveStop({ project, step, progress, carrier }) {
  const kept = keptOf(project, progress);
  return migrationScreen('directive taken', step, `Another session is carrying the migration on: its ${step} step.`, [
    ['No session works in this project until the migration is done.', ...(kept === null ? [] : [kept])].join(' '),
    ...takenBy(carrier),
  ]);
}

/**
 * The migration part-way through a directive, which this session carries
 * on (21.10.9): its step; what the step does and the person waiting it
 * out; what the directive finished, kept, each piece checked, and a piece
 * it was in the middle of taken up as its check says, or, every piece done,
 * the step ready to close; and the start menu once the migration is done
 * and committed. Where none is done, or the check cannot say, nothing is
 * said of what is done.
 * @param {{project: string, step: string, progress: import('../directives.cjs').Progress|null, does: string}} carried the project's name, the directive's step in words, where it stands, and what it does, in its check's words
 * @returns {string}
 */
function directiveCarryOn({ project, step, progress, does }) {
  const kept = keptOf(project, progress);
  return migrationScreen('directive carry on', step, PART_WAY, [
    `${does} ${WAIT}`,
    ...(kept === null || progress === null ? [] : [`${kept} ${progress.done === progress.of ? 'The step is ready to close.' : progress.partWay}`]),
    `This session carries the migration on from its ${step} step. ${AFTER}`,
  ]);
}

/**
 * The migration at work, at a directive none of whose pieces is done yet:
 * its step; what the step does and the person waiting it out; and the
 * start menu once the migration is done and committed.
 * @param {{step: string, does: string}} arrival the directive's step in words, and what it does, in its check's words
 * @returns {string}
 */
function directiveArrival({ step, does }) {
  return migrationScreen('directive arrival', step, AT_WORK, [`${does} ${WAIT}`, AFTER]);
}

/** How the mixed unit's question groups the topics leaving it, in its order. */
const LEAVING_GROUPS = Object.freeze([['in-progress', 'IN PROGRESS'], ['not-started', 'NOT STARTED'], ['decided', 'DECIDED']]);

/**
 * The mixed unit's question (21.8.10): a unit being built, the topics its
 * specs cover counted, and those that leave it, grouped by where each
 * stands, each by its title; then where they go — a new epic the person
 * names, or the roadmap, the horizon asked next. Either row carries the
 * directive on.
 * @param {{unit: string, covered: number, leaving: {title: string, standing: string}[]}} mixed
 * @returns {string}
 */
function leavingQuestion({ unit, covered, leaving }) {
  const name = titlecase(unit);
  const one = leaving.length === 1;
  const groups = LEAVING_GROUPS.flatMap(([standing, heading]) => {
    const titles = leaving.filter((topic) => topic.standing === standing).map(({ title }) => title);
    return titles.length === 0 ? [] : [`${heading} (${titles.length})\n${treeList(titles, { indent: '  ' })}`];
  });
  const opening = `${name} is being built, and its specs cover ${covered} of its topics. A unit being built can't take a topic its specs don't cover, so ${one ? 'this one leaves' : `these ${leaving.length} leave`} it:`;
  /** @type {import('./surfaces.cjs').Next} */
  const carryOn = { kind: 'continue' };
  return [
    section('DISPLAY: migration leaving', CONTINUE_INSTRUCTION, ['▪ Migration', '', ...wrapWithPrefix(opening, { width: displayWidth() }), '', groups.join('\n\n')].join('\n')),
    section('MENU: migration leaving gate', MENU_INSTRUCTION, menu(`Once ${one ? 'it goes' : 'they go'}, ${escapeMarkdown(name)} is whole: every topic decided, its specs joined, one build.`, [
      cmdOption('n', 'new', `A new epic, which you name — ${one ? 'it moves whole and starts' : 'they move whole and start'} in discussion`, { next: carryOn }),
      cmdOption('r', 'roadmap', `The roadmap, as ${one ? 'a postponed topic' : 'postponed topics'} — I'll ask which horizon next`, { next: carryOn }),
    ], { question: one ? 'Where does this topic go?' : `Where do these ${leaving.length} topics go?` })),
  ].join('\n');
}

/** Why the checks before the reshape's move come first. */
const CHECKS_FIRST = "Earlier migrations of this project left checks their code couldn't make, and some fix files the move carries into Ledger, so they come first.";

/**
 * Boot's stop before the reshape's move (21.10.13), the migration at work:
 * earlier migrations left checks their code could not make, some fixing
 * files the move carries, so they come first. This session makes them, the
 * person waiting it out, the start menu once the migration is done and
 * committed; or, where another live session carries the migration on (P7),
 * that session carrying it on, no session working in the project until the
 * migration is done, and when that one was last active, this one stopping
 * there.
 * @param {number|null} [carrier] the whole seconds since another session carrying the migration on was last active
 * @returns {string}
 */
function migrationChecksStop(carrier = null) {
  return carrier === null
    ? migrationScreen('migration checks', 'checks', AT_WORK, [`${CHECKS_FIRST} This session makes them now. ${WAIT}`, AFTER])
    : migrationScreen('migration checks taken', 'checks', 'Another session is carrying the migration on: its checks before the move.', [
      `${CHECKS_FIRST} No session works in this project until the migration is done.`,
      ...takenBy(carrier),
    ]);
}

/**
 * The paragraphs a stop closes on where another session carries the
 * migration on, last active `carrier` whole seconds ago.
 * @param {number} carrier
 * @returns {string[]}
 */
function takenBy(carrier) {
  return [
    `That session was last active ${fmtAge(carrier)} ago, so this one stops here.`,
    'Run `/ledger` here again once that session has finished the migration, or has ended.',
  ];
}

/**
 * Boot's stop where the reshape's guard refused the migration (21.3.4):
 * another session live in the project — its unit, its phase, and its topic
 * where the unit has topics of its own, and how long ago it was last active
 * — or uncommitted changes in the old state's folder, each path named;
 * nothing changed either way, and what the person does before running
 * `/ledger` again.
 * @param {{cause: 'live', unit: string, phase: string, topic: string, active: number} | {cause: 'dirty', folder: string, paths: string[]}} refused
 * @returns {string}
 */
function migrationGuardStop(refused) {
  if (refused.cause === 'dirty') {
    return [
      section('DISPLAY: migration guard stop', emitAs('properties'), `⚑ The migration can't run: ${refused.folder}/ has uncommitted changes`),
      section('DISPLAY: migration guard account', emitAs('markdown'), [
        "> The migration's commit would sweep them in with its own, so nothing has been changed.",
        '>',
        '> The changes:',
        '>',
        ...refused.paths.map((at) => `> - ${escapeMarkdown(at)}`),
        '>',
        '> Commit or discard them, then run `/ledger` here again.',
      ].join('\n')),
    ].join('\n');
  }
  const { unit, phase, topic, active } = refused;
  const where = topic === unit ? `in its ${phase}` : `in the ${phase} of ${titlecase(topic)}`;
  return [
    section('DISPLAY: migration guard stop', emitAs('properties'), "⚑ The migration can't run while another session is live here"),
    section('DISPLAY: migration guard account', emitAs('markdown'), [
      `> Another session is working in this project: ${escapeMarkdown(`${titlecase(unit)}, ${where}`)}, last active ${fmtAge(active)} ago. A major upgrade never runs under a live session, so nothing has been changed.`,
      '>',
      '> End that session, then run `/ledger` here again.',
    ].join('\n')),
  ].join('\n');
}

/**
 * Setup's offer of the rule on GitHub against deleting or force-pushing the
 * state branch (4.4.7), acted on only on yes; each answer leads to the
 * `github-rule` verb that records it.
 * @param {string} project the project's name
 * @returns {string}
 */
function githubRuleGate(project) {
  const name = escapeMarkdown(project);
  return section('MENU: github rule gate', MENU_INSTRUCTION, menu(
    `Ledger keeps its records on the \`ledger-state\` branch. In Claude Code, Ledger stops anyone deleting or force-pushing it. A rule on GitHub stops that from anywhere else too. Yes adds the rule to ${name}'s repository.`,
    [
      cmdOption('y', 'yes', `Add the rule to ${name}'s repository`, { next: { kind: 'engine', argv: ['github-rule', 'yes'] } }),
      cmdOption('n', 'no', { head: 'Leave it unset', tail: 'setup carries on without it' }, { next: { kind: 'engine', argv: ['github-rule', 'no'] } }),
    ],
    { question: 'Add that rule on GitHub?' },
  ));
}

/**
 * Setup's offer of the squash default on GitHub (7.2.18), merge commits
 * allowed beside it (4.4.6, 7.2.38), on the project's repository and each
 * nested one it covers, named by folder; acted on only on yes; each answer
 * leads to the `github-squash` verb that records it. Its no says what each
 * setting left unset holds back: the squash default a phase's stack merge,
 * merge commits a unit's own branch landing at finish, as the landing
 * driver refuses each.
 * @param {string} project the project's name @param {string[]} nested
 * @returns {string}
 */
function githubSquashGate(project, nested) {
  const name = escapeMarkdown(project);
  const where = nested.length === 0
    ? { on: `${name}'s repository`, yes: `${name}'s repository` }
    : { on: `${name}'s repository and each one nested in it: ${nested.map(escapeMarkdown).join(', ')}`, yes: `each of ${name}'s ${nested.length + 1} repositories` };
  return section('MENU: github squash gate', MENU_INSTRUCTION, menu(
    `Ledger lands each task on GitHub as a pull request squashed into one commit. For that commit to carry the task's title and id, GitHub must build it from the pull request's title and description. Work of several phases lands on your default branch in one merge commit, so GitHub must allow those too. Yes sets both on ${where.on}.`,
    [
      cmdOption('y', 'yes', `Set both on ${where.yes}`, { next: { kind: 'engine', argv: ['github-squash', 'yes'] } }),
      cmdOption('n', 'no', { head: 'Leave them as they are', tail: 'Ledger won\'t merge a phase\'s pull requests without the squash default, nor land work of several phases without merge commits' }, { next: { kind: 'engine', argv: ['github-squash', 'no'] } }),
    ],
    { question: 'Set both on GitHub?' },
  ));
}

/**
 * The one-time session-label opt-in, naming the multiplexer the session
 * runs in and saying what labels do; each answer leads to the verb that
 * records it.
 * @param {string} multiplexer as the person knows it: `tmux`, `Portal`
 * @returns {string}
 */
function labelGate(multiplexer) {
  const body = menu(
    `You're running inside ${multiplexer}. Ledger can label your session to show where you're working: \`myproject · payments · discussion · auth-flow\` inside a phase, \`myproject · payments\` at its menu. Yes turns the labels on for this project. Your session's own name comes back at the start menu and when the session ends.`,
    [
      cmdOption('y', 'yes', 'Turn session labels on', { next: { kind: 'engine', argv: ['session', 'label-config', 'true'] } }),
      cmdOption('n', 'no', 'Leave your session alone', { next: { kind: 'engine', argv: ['session', 'label-config', 'false'] } }),
    ],
    { question: `Label your ${multiplexer} session as you work?` },
  );
  return section('MENU: label gate', MENU_INSTRUCTION, body);
}

/**
 * The one-time offer to have the product researcher read a codebase that
 * predates Ledger, before the product's conversation opens on it; each
 * answer leads to the verb that records it, the yes's record answering the
 * move into the product's conversation.
 * @returns {string}
 */
function brownfieldOfferGate() {
  const body = menu(
    "This project has code Ledger knows nothing about. Yes has the product researcher read it first. The product's conversation then starts from what the code shows, and asks you what it can't.",
    [
      cmdOption('y', 'yes', 'Read it now, then talk the product through', { next: { kind: 'engine', argv: ['brownfield', 'record', 'accepted'] } }),
      cmdOption('n', 'no', 'Skip — it is not offered again', { next: { kind: 'engine', argv: ['brownfield', 'record', 'skipped'] } }),
    ],
    { question: 'Have the existing code read first?' },
  );
  return section('MENU: brownfield offer', MENU_INSTRUCTION, body);
}

const BANNER_ART = Object.freeze([
  '█░░░█▀▀░█▀▄░█▀▀░█▀▀░█▀▄',
  '█░░░█▀▀░█░█░█░█░█▀▀░█▀▄',
  '▀▀▀░▀▀▀░▀▀░░▀▀▀░▀▀▀░▀░▀',
]);

const BANNER_TAGLINE = Object.freeze(['A G E N T I C', 'W O R K F L O W S']);

/**
 * The banner the bare command opens on (18.2.15): the art, and beside it a
 * bar with the tagline and the installed version, then the title. The plain
 * space after each art row is the properties fence's break between key and
 * value, drawing the art and the bar in two colours.
 * @param {string} version
 * @returns {string}
 */
function banner(version) {
  const beside = [...BANNER_TAGLINE, version];
  return [
    section('DISPLAY: banner', emitAs('properties'), BANNER_ART.map((row, i) => `${row} │ ${beside[i]}`).join('\n')),
    titleSection('Ledger'),
  ].join('\n');
}

/**
 * The pick between the pieces of work the person's words name (O2): a row
 * for each, and one for something new, each row's next its move, invoked in
 * this conversation, or a closed unit's screen in manage.
 * @param {{key: string|number, word?: string, label: import('./surfaces.cjs').OptionLabel, next: import('./surfaces.cjs').Next}[]} rows
 * @returns {string}
 */
function workPick(rows) {
  return section('MENU: work pick', MENU_INSTRUCTION, menu(
    'These words could name work you have, or start something new.',
    rows.map(({ key, word, label, next }) => cmdOption(String(key), word, label, { next })),
    { question: 'Which piece of work?' },
  ));
}

/**
 * A knowledge configuration by name: provider · model, or keyword-only.
 * @param {{provider?: string|null, model?: string|null}} config
 * @returns {string}
 */
function configurationName({ provider, model }) {
  return provider ? [provider, model].filter(Boolean).join(' · ') : 'keyword-only';
}

// Where a provider's missing key is stored without touching the chat: the
// commands to run in the terminal, each with what it does beneath it.
/** @param {string} command @param {string} note @returns {string[]} */
function keyCommand(command, note) {
  return [`  ${command}`, ...wrapWithPrefix(note, { width: displayWidth(), prefix: '      ' })];
}

const KEY_ONLY_NOTE = 'Private prompt, input hidden. Stored at ~/.config/ledger/credentials.json (mode 0600).';

/** @type {Record<string, () => string[]>} */
const KEY_INSTRUCTIONS = {
  openai: () => [
    ...wrapWithPrefix('No OpenAI API key was found. Store one without it touching this chat — run ONE of these in your terminal, then come back:', { width: displayWidth() }),
    '',
    ...keyCommand(`${WIZARD_COMMAND} --key-only`, KEY_ONLY_NOTE),
    '',
    ...keyCommand('export OPENAI_API_KEY=<your key>   # note: inline export lands in shell history — --key-only avoids that',
      'Shell environment — takes precedence over the stored key.'),
  ],
  'openai-compatible': () => [
    ...wrapWithPrefix('The endpoint requires an API key. Store one without it touching this chat — run this in your terminal, then come back:', { width: displayWidth() }),
    '',
    ...keyCommand(`${WIZARD_COMMAND} --key-only --provider openai-compatible`, KEY_ONLY_NOTE),
  ],
};

const KEY_PROVIDERS = Object.keys(KEY_INSTRUCTIONS);

/** @typedef {import('./surfaces.cjs').Next} Next */

/** A knowledge setup, by its form's flags. @param {string[]} flags @returns {Next} */
const setupRun = (flags) => ({ kind: 'engine', argv: ['knowledge', 'setup', ...flags] });

/** Another of the knowledge gate's screens, by its render's arguments. @param {...string} args @returns {Next} */
const knowledgeScreen = (...args) => ({ kind: 'engine', argv: ['render', ...args] });

const KEYWORD_ONLY = setupRun(['--keyword-only']);
const TO_WIZARD = knowledgeScreen('knowledge-gate', '--variant', 'wizard');

/**
 * What a knowledge gate's menu is drawn from: what it asks, the statement
 * above the question, its rows, and the display above the menu a variant
 * carries.
 * @typedef {{question: string, lead?: string, options: string[], display?: string[], displayInstruction?: string}} KnowledgeMenu
 */

/**
 * What a knowledge gate is drawn for: the system configuration the reuse
 * variant offers — the provider, with its model where the configuration
 * names one; neither for keyword-only — or, for the retry variant, the
 * provider whose key is missing and the flags of the setup to run again.
 * @typedef {{provider?: string|null, model?: string|null, setup?: string[]}} KnowledgeConfig
 */

// The knowledge gate's menus, keyed by what each asks: reuse = adopt the
// system configuration (its yes row names it — provider · model, or
// keyword-only), deviate = the per-project alternatives to it, mode = the
// search-mode pick with no system configuration to lean on, retry = the
// setup run again once the provider's missing key is stored (its display
// says how), wizard = the wait while the terminal wizard runs (its display
// names the command), its yes the check that the knowledge base is ready.
// Each row leads to the setup or the screen it runs.
/** @type {Record<string, (config: KnowledgeConfig) => KnowledgeMenu>} */
const KNOWLEDGE_GATES = {
  reuse: ({ provider, model }) => ({
    lead: 'The knowledge base lets later work recall earlier work. Ledger runs nothing until it is set up. This machine already has a configuration this project can reuse.',
    question: 'Use the existing configuration for this project?',
    options: [
      cmdOption('y', 'yes', `Use the existing configuration (${configurationName({ provider, model })})`, { next: setupRun(['--from-system']) }),
      cmdOption('d', 'different', 'Choose a different mode for this project', { next: knowledgeScreen('knowledge-gate', '--variant', 'deviate') }),
      cmdOption('t', 'terminal', 'Run the interactive wizard in your terminal instead', { next: TO_WIZARD }),
    ],
  }),
  deviate: () => ({
    question: 'What should this project use instead?',
    options: [
      cmdOption('k', 'keyword', 'Keyword-only for this project (the system configuration stays untouched for every other project)', { next: KEYWORD_ONLY }),
      cmdOption('t', 'terminal', 'Run the interactive wizard to change the system-wide configuration', { next: TO_WIZARD }),
    ],
  }),
  mode: () => ({
    lead: "Pick how this project's knowledge base should search. OpenAI needs an API key — stored in your terminal, never pasted here. Keyword-only needs no key and can be upgraded anytime.",
    question: "How should this project's knowledge base work?",
    options: [
      cmdOption('o', 'openai', 'OpenAI embeddings — full semantic search (recommended; needs an API key)', { next: knowledgeScreen('knowledge-ask', '--provider', 'openai') }),
      cmdOption('c', 'compatible', 'A local or self-hosted OpenAI-compatible endpoint (LM Studio, Ollama, vLLM)', { next: knowledgeScreen('knowledge-ask', '--provider', 'openai-compatible') }),
      cmdOption('k', 'keyword', 'Keyword-only search — the no-key backstop; upgrade anytime later', { next: KEYWORD_ONLY }),
      cmdOption('t', 'terminal', 'Run the interactive wizard in your terminal instead', { next: TO_WIZARD }),
    ],
  }),
  retry: ({ provider, setup = [] }) => ({
    display: KEY_INSTRUCTIONS[/** @type {string} */ (provider)](),
    displayInstruction: emitAs('text'),
    lead: 'Do not paste the API key into this chat — not even partially. Store it in your terminal with one of the commands above, then come back here.',
    question: 'Ready to retry?',
    options: [
      cmdOption('y', 'yes', 'The key is stored — re-run the setup', { next: setupRun(setup) }),
      cmdOption('k', 'keyword', 'Skip the key for now — use keyword-only search instead', { next: KEYWORD_ONLY }),
    ],
  }),
  wizard: () => ({
    display: [
      'Run the wizard in your terminal:',
      '',
      `  ${WIZARD_COMMAND}`,
      '',
      ...wrapWithPrefix('It configures system defaults, initialises the project store, and runs the initial indexing pass.', { width: displayWidth() }),
    ],
    lead: 'The interactive wizard runs in your terminal. It walks provider choice, key entry (input hidden), and project store setup.',
    question: 'Has the wizard completed?',
    options: [
      cmdOption('y', 'yes', 'It completed — check the knowledge base again', { next: knowledgeScreen('knowledge-done') }),
    ],
  }),
};

/**
 * One of the knowledge gate's menus, beneath the display a variant carries.
 * @param {string} variant @param {KnowledgeConfig} [config]
 * @returns {string}
 */
function knowledgeGate(variant, config = {}) {
  const gate = KNOWLEDGE_GATES[variant](config);
  const gateMenu = section(`MENU: knowledge ${variant} gate`, MENU_INSTRUCTION, menu(gate.lead ?? '', gate.options, { question: gate.question }));
  if (!gate.display) return gateMenu;
  return [section(`DISPLAY: knowledge ${variant}`, gate.displayInstruction ?? ABOVE_MENU_INSTRUCTION, gate.display.join('\n')), gateMenu].join('\n');
}

// What a provider's setup needs that only the person can say, asked in
// words: the questions, and the setup their answers run. A keyless
// openai-compatible endpoint is fine: a key stored for it is picked up.
/** @type {Record<string, {questions: string[], setup: string}>} */
const KNOWLEDGE_ASKS = {
  openai: {
    questions: ['Which OpenAI embedding model?', '', '- Reply with a model name, or "default" for text-embedding-3-small.'],
    setup: `${ENGINE_COMMAND} knowledge setup --provider openai --model <the model named, text-embedding-3-small for "default">`,
  },
  'openai-compatible': {
    questions: ['Where is the embeddings endpoint?', '', '- Base URL (e.g. http://localhost:1234/v1)', '- Model name', "- Vector dimensions — must match the model's native output"],
    setup: `${ENGINE_COMMAND} knowledge setup --provider openai-compatible --base-url <the base URL> --model <the model> --dimensions <the dimensions>`,
  },
};

/**
 * The knowledge gate's questions for a provider's setup, its DATA naming the
 * setup the reply runs.
 * @param {string} provider one of `KEY_PROVIDERS`
 * @returns {string}
 */
function knowledgeAsk(provider) {
  const { questions, setup } = KNOWLEDGE_ASKS[provider];
  return [
    dataSection([`the reply: ${setup}`]),
    section(`DISPLAY: knowledge ${provider} questions`, emitAs('text', STOP_CLAUSE), questions.join('\n')),
  ].join('\n');
}

/**
 * The knowledge gate's closing line: the configuration this checkout's store
 * was built with.
 * @param {{provider?: string|null, model?: string|null}} store
 * @returns {string}
 */
function knowledgeReady(store) {
  return section('DISPLAY: knowledge ready', CONTINUE_INSTRUCTION, `Knowledge base ready — ${configurationName(store)}.`);
}

/** That the terminal wizard did not complete, above the gate drawn again. @returns {string} */
function knowledgeNotDone() {
  return section('DISPLAY: knowledge not done', ABOVE_MENU_INSTRUCTION, 'The wizard did not complete — the knowledge base is not set up in this checkout yet.');
}

module.exports = { RESHAPE_PARTS, migrationsApplied, migrationGate, stateLostGate, gitFloorStop, repoStop, migrationGuardStop, migrationChecksStop, directiveStop, directiveArrival, directiveCarryOn, leavingQuestion, githubRuleGate, githubSquashGate, labelGate, brownfieldOfferGate, banner, workPick, knowledgeGate, knowledgeAsk, knowledgeReady, knowledgeNotDone, KEY_PROVIDERS };

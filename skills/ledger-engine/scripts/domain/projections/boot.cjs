'use strict';

// ---------------------------------------------------------------------------
// Domain ring: ledger's boot gates — the menus the start puts to the
// user before any work is on the table: the state lost, the GitHub rule's
// offer, the migration confirm, the label opt-in, the brownfield offer, and
// the pick between the pieces of work the person's words name — the
// stops on a git below the engine's floor, in a folder in no git repository,
// at the reshape's guard, and at the checks before its move and a directive
// of the migration not yet done, this session carrying the migration on or
// another, the question where a building unit's leaving topics go, the
// knowledge gate's screens and its questions for a provider's setup, and the
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

/**
 * What the migrations did, above the confirm gate: the summary the session
 * wrote, each notice a migration handed back for the person, then the run's
 * counts — left out where the run updated no file and only the verification
 * fixed anything.
 * @param {{summary: string, notices: string[], counts: {migrations: number, files: number}|null}} applied
 * @returns {string}
 */
function migrationsApplied({ summary, notices, counts }) {
  return section('DISPLAY: migrations applied', CONTINUE_MARKDOWN_INSTRUCTION, [
    '**Migrations Applied**',
    '',
    summary,
    ...notices.flatMap((notice) => ['', notice]),
    ...(counts ? ['', `${counts.migrations} migration(s), ${counts.files} file(s) updated.`] : []),
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
 * Boot's stop at a directive of the migration not yet done (21.10.11): no
 * session works in the project until the migration is done; what the
 * directive finished is kept, each piece checked, and a piece it was in the
 * middle of is taken up as its check says (21.10.9), or, every piece done,
 * the step is ready to close; this session carries it on. Where another live session carries it on
 * (P7), the stop names when that one was last active, says nothing of what
 * a carrying session takes up or closes, and this session stops there. Where
 * the check cannot say, nothing is said of what is done.
 * @param {{project: string, step: string, progress: import('../directives.cjs').Progress|null, carrier?: number|null}} stopped the project's name, the directive's step in words, where it stands, and the whole seconds since another session carrying it on was last active
 * @returns {string}
 */
function directiveStop({ project, step, progress, carrier = null }) {
  const held = ['No session works in this project until the migration is done.'];
  if (progress !== null && progress.done > 0) {
    const { done, of, counts, says, partWay } = progress;
    held.push(`What it finished is kept: ${done} of ${escapeMarkdown(project)}'s ${of} ${of === 1 ? counts.one : counts.many} ${says}, each checked.`);
    if (carrier === null) held.push(done === of ? 'The step is ready to close.' : partWay);
  }
  const account = [
    `> ${held.join(' ')}`,
    '>',
    ...(carrier === null
      ? [`> This session carries the migration on from its ${step} step; the start menu follows once the migration is done and committed.`]
      : takenBy(`its ${step} step`, carrier)),
  ];
  return [
    section('DISPLAY: directive stop', emitAs('properties'), `⚑ The migration stopped part-way: its ${step} step isn't done`),
    section('DISPLAY: directive account', emitAs('markdown'), account.join('\n')),
  ].join('\n');
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

/**
 * Boot's stop before the reshape's move (21.10.13): earlier migrations left
 * checks their code could not make, some fixing files the move carries, so
 * they come first, and no session works in the project until the migration
 * is done. This session makes them, or, where another live session carries
 * the migration on (P7), the stop names when that one was last active, and
 * this session stops there.
 * @param {number|null} [carrier] the whole seconds since another session carrying the migration on was last active
 * @returns {string}
 */
function migrationChecksStop(carrier = null) {
  return [
    section('DISPLAY: migration checks stop', emitAs('properties'), '⚑ The migration stopped before its move, for checks earlier migrations handed back'),
    section('DISPLAY: migration checks account', emitAs('markdown'), [
      "> Earlier migrations of this project left checks their code couldn't make. Some fix files the move carries into Ledger, so they come first. No session works in this project until the migration is done.",
      '>',
      ...(carrier === null ? ['> This session takes them up now; the start menu follows once the migration is done and committed.'] : takenBy('its checks', carrier)),
    ].join('\n')),
  ].join('\n');
}

/**
 * The lines a stop closes on where another session carries the migration
 * on from `step`, last active `carrier` whole seconds ago.
 * @param {string} step @param {number} carrier
 * @returns {string[]}
 */
function takenBy(step, carrier) {
  return [
    `> Another session is carrying the migration on from ${step}, last active ${fmtAge(carrier)} ago, so this one stops here.`,
    '>',
    '> Run `/ledger` here again once that session has finished the migration, or has ended.',
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
    `${name}'s remote is on GitHub. A rule there can refuse deleting or force-pushing \`ledger-state\` for anything run outside Claude Code; inside it, Ledger already refuses both.`,
    [
      cmdOption('y', 'yes', `Set it on ${name}'s repository`, { next: { kind: 'engine', argv: ['github-rule', 'yes'] } }),
      cmdOption('n', 'no', { head: 'Leave it unset', tail: 'setup carries on without it' }, { next: { kind: 'engine', argv: ['github-rule', 'no'] } }),
    ],
    { question: 'Set that rule on GitHub?' },
  ));
}

/**
 * Setup's offer of the squash default on GitHub (7.2.18), merge commits
 * allowed beside it (4.4.6, 7.2.38), on the project's repository and each
 * nested one it covers, named by folder; acted on only on yes; each answer
 * leads to the `github-squash` verb that records it.
 * @param {string} project the project's name @param {string[]} nested
 * @returns {string}
 */
function githubSquashGate(project, nested) {
  const name = escapeMarkdown(project);
  const where = nested.length === 0
    ? { lands: '', stack: 'the repository squashes so, Ledger won\'t merge a phase\'s stack', yes: `${name}'s repository` }
    : { lands: `, in its own repository and in each one nested in it: ${nested.map(escapeMarkdown).join(', ')}`, stack: 'a repository squashes so, Ledger won\'t merge a phase\'s stack in it', yes: `each of ${name}'s ${nested.length + 1} repositories` };
  return section('MENU: github squash gate', MENU_INSTRUCTION, menu(
    `${name} lands each task on GitHub as a pull request squashed into one commit${where.lands}. Made from the pull request's title and description, that commit carries the task's subject and id; until ${where.stack}. The yes also allows merge commits, which a unit of several phases lands on the default branch by.`,
    [
      cmdOption('y', 'yes', `Set it on ${where.yes}`, { next: { kind: 'engine', argv: ['github-squash', 'yes'] } }),
      cmdOption('n', 'no', { head: 'Leave it as it is', tail: 'set it later by hand' }, { next: { kind: 'engine', argv: ['github-squash', 'no'] } }),
    ],
    { question: 'Squash from the pull request\'s title and description?' },
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
    `You're running inside ${multiplexer}. Ledger can label your session to show where you're working — \`myproject · payments · discussion · auth-flow\` inside a phase, \`myproject · payments\` at its menu — putting the original back at the start menu and when the session ends, and bringing the label back when you resume the session. You're asked once per project.`,
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
    "This project has code Ledger knows nothing about. The product researcher can read it first, then the product's conversation opens on what the code shows and the intent it can't.",
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

/**
 * The banner the bare command opens on (18.2.15): the art, the installed
 * version right-aligned beneath it, then the title.
 * @param {string} version
 * @returns {string}
 */
function banner(version) {
  const width = Math.max(...BANNER_ART.map((line) => [...line].length));
  return [
    section('DISPLAY: banner', emitAs('properties'), [...BANNER_ART, version.padStart(width)].join('\n')),
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
    lead: 'The knowledge base powers recall across work units and within them — later phases draw on earlier work. It is required infrastructure: Ledger runs nothing until it is initialised. Your machine already has a system configuration this project can reuse.',
    question: 'Use the existing configuration for this project?',
    options: [
      cmdOption('y', 'yes', `Use the existing configuration (${configurationName({ provider, model })})`, { next: setupRun(['--from-system']) }),
      cmdOption('d', 'different', 'Choose a different mode for this project', { next: knowledgeScreen('knowledge-gate', '--variant', 'deviate') }),
      cmdOption('t', 'terminal', 'Run the interactive wizard in your terminal instead', { next: TO_WIZARD }),
    ],
  }),
  deviate: () => ({
    question: 'How should this project deviate?',
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

module.exports = { migrationsApplied, migrationGate, stateLostGate, gitFloorStop, repoStop, migrationGuardStop, migrationChecksStop, directiveStop, leavingQuestion, githubRuleGate, githubSquashGate, labelGate, brownfieldOfferGate, banner, workPick, knowledgeGate, knowledgeAsk, knowledgeReady, knowledgeNotDone, KEY_PROVIDERS };

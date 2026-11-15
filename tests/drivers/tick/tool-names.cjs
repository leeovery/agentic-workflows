'use strict';

// How Tick is named, for the tool-name scan (tests/scripts/tool-names.cjs):
// its binary, its commands and flags, and the forms only Tick takes. Its
// binary quoted bare is left out: the spec page's review marks are 'tick'.

module.exports = {
  binary: 'tick',
  commands: [
    'create', 'update', 'list', 'show', 'ready', 'blocked', 'start', 'done', 'cancel', 'reopen', 'dep', 'note', 'init', 'version', 'stats',
    'doctor', 'rebuild', 'migrate', 'remove', 'help', '--json', '--toon', '--pretty', '--version', '-q',
  ],
  quoted: false,
  forms: [
    { form: 'its package', pattern: /\bleeovery\/tick\b/ },
    { form: 'its store', pattern: /(?<![\w-])\.tick\// },
    { form: 'its ids', pattern: /(?<![\w./-])tick-[0-9a-f]{6}\b/ },
  ],
};

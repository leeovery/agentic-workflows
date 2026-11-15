'use strict';

// How GitHub's CLI is named, for the tool-name scan (tests/scripts/
// tool-names.cjs): its binary, its commands and flags, its binary quoted
// bare, which collides with nothing, and its packages.

module.exports = {
  binary: 'gh',
  commands: [
    'pr', 'api', 'auth', 'stack', 'extension', 'repo', 'issue', 'run', 'release', 'workflow', 'browse', 'label', 'ruleset', 'search', 'secret',
    'status', 'project', 'gist', '--version', '--repo', '-R',
  ],
  quoted: true,
  forms: [
    { form: 'its package', pattern: /\bgh-stack\b|\bcli\.github\.com\b|\bcli\/cli\b/ },
  ],
};

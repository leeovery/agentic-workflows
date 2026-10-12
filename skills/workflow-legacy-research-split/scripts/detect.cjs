#!/usr/bin/env node
'use strict';

const path = require('path');

const engine = require('../../workflow-engine/scripts/lib.cjs');
const { loadManifest } = engine.reads;
const { legacySources } = require(path.resolve(__dirname, '..', '..', 'workflow-engine', 'scripts', 'domain', 'legacy-split.cjs'));

function die(msg, code = 1) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(code);
}

const args = process.argv.slice(2);
if (args.length < 1) die('Usage: detect.cjs <work-unit>');

const cwd = process.cwd();
const manifest = loadManifest(cwd, args[0]);
if (!manifest) die(`Work unit "${args[0]}" not found`, 2);

process.stdout.write(JSON.stringify(legacySources(cwd, manifest), null, 2) + '\n');

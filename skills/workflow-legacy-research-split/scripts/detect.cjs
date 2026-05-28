#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const {
  loadManifest,
  phaseItems,
  fileExists,
} = require('../../workflow-shared/scripts/discovery-utils.cjs');

function die(msg, code = 1) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(code);
}

function detect(workUnit) {
  const cwd = process.cwd();
  const manifest = loadManifest(cwd, workUnit);
  if (!manifest) die(`Work unit "${workUnit}" not found`, 2);

  const discoveryItems = phaseItems(manifest, 'discovery');
  const researchItems = phaseItems(manifest, 'research');
  const researchByName = new Map(researchItems.map(it => [it.name, it]));

  const qualifying = [];
  for (const item of discoveryItems) {
    const source = item.source || '';
    if (!source.includes('migration-seeded')) continue;
    if (item.routing !== 'research') continue;
    if (item.legacy_split_state) continue;
    const research = researchByName.get(item.name);
    if (!research || research.status !== 'in-progress') continue;
    const filePath = path.join(cwd, '.workflows', workUnit, 'research', `${item.name}.md`);
    if (!fileExists(filePath)) continue;
    qualifying.push(item.name);
  }

  qualifying.sort();
  return { qualifying_sources: qualifying };
}

const args = process.argv.slice(2);
if (args.length < 1) die('Usage: detect.cjs <work-unit>');

const result = detect(args[0]);
process.stdout.write(JSON.stringify(result, null, 2) + '\n');

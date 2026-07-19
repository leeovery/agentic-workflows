'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function setupFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'discovery-test-'));
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  return dir;
}

function cleanupFixture(dir) {
  // Retries absorb the macOS teardown race (ENOTEMPTY while a just-exited
  // child's writes settle).
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function createManifest(dir, name, data) {
  const manifest = {
    name,
    work_type: 'feature',
    status: 'in-progress',
    description: `Test: ${name}`,
    phases: {},
    ...data,
  };
  const mdir = path.join(dir, '.workflows', name);
  fs.mkdirSync(mdir, { recursive: true });
  fs.writeFileSync(path.join(mdir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

function createFile(dir, relativePath, content) {
  const full = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content || '');
  return full;
}

module.exports = { setupFixture, cleanupFixture, createManifest, createFile };

'use strict';

// ---------------------------------------------------------------------------
// The landing default read from the project's real remote
// (workflow-engine/scripts/domain/drivers.cjs `resolveDriver`, through
// domain/remote.cjs): the landing driver serving the remote where it is on
// GitHub, the one flagged default where it is elsewhere, and the default
// written once, so a remote changed afterwards changes no driver (22.4.3,
// 7.1.4). Git layer: the project world with an origin, one per host, each
// built once and copied; the fixture drivers under tests/fixtures/drivers/.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { git, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { resolveDriver } = require('../../skills/workflow-engine/scripts/domain/drivers.cjs');

const SHIPPED = path.join(__dirname, '..', 'fixtures', 'drivers', 'shipped');
const ON_GITHUB = 'https://github.com/acme/pay.git';

/** @param {string} url @returns {(dir?: string) => string} */
const withOrigin = (url) => fixtureFrom('engine-drivers-remote-', (project) => git(project, ['remote', 'add', 'origin', url]));
const onGithub = withOrigin(ON_GITHUB);
const elsewhere = withOrigin('https://git.example.org/acme/pay.git');

/** @param {string} project */
const landingSetting = (project) => JSON.parse(fs.readFileSync(path.join(project, '.leeway', 'manifest.json'), 'utf8')).drivers.landing;

describe('resolveDriver: the landing default from the remote (22.4.3)', () => {
  it('is the driver serving a remote on GitHub, written as the setting', () => {
    const project = onGithub();
    try {
      assert.strictEqual(resolveDriver(project, 'landing', SHIPPED).driver.name, 'hosted');
      assert.strictEqual(landingSetting(project), 'hosted');
    } finally {
      cleanupFixture(project);
    }
  });

  it('is the driver flagged default where the remote is on another host, and stays it once the remote moves to GitHub', () => {
    const project = elsewhere();
    try {
      assert.strictEqual(resolveDriver(project, 'landing', SHIPPED).driver.name, 'local');
      git(project, ['remote', 'set-url', 'origin', ON_GITHUB]);
      assert.deepStrictEqual(
        [resolveDriver(project, 'landing', SHIPPED).driver.name, landingSetting(project)],
        ['local', 'local'],
      );
    } finally {
      cleanupFixture(project);
    }
  });
});

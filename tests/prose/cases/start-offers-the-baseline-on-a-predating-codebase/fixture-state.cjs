'use strict';

// A brownfield project: an application built over a run of feature commits
// and the workflows installed into it last. No work unit exists — the walk
// meets the judgment and then the empty-state menu. The project manifest
// holds a baseline object with nothing recorded (boot reports `none`), and
// every `.workflows/` file is layered through the world's history so the
// root commit and the feature commits hold the application alone.

const fs = require('fs');
const path = require('path');
const m = require('../../mainlines/feature.cjs');
const native = require('../start-records-a-native-verdict/fixture-state.cjs');

function codebase(h) {
  h.write('package.json', '{\n  "name": "ledger",\n  "version": "3.4.1"\n}\n');
  h.write('config/app.json', '{\n  "currency": "GBP",\n  "invoiceDueDays": 30\n}\n');
  h.write('src/app.js', "const routes = require('./routes');\nmodule.exports = { routes };\n");
  h.write('src/db.js', 'module.exports = { connect() {} };\n');
  h.write('src/models/user.js', 'class User { constructor(email) { this.email = email; } }\nmodule.exports = User;\n');
  h.write('src/routes/users.js', "module.exports = (app) => app.get('/users', () => []);\n");
  h.write('src/models/invoice.js', 'class Invoice { constructor(lines) { this.lines = lines; } total() { return this.lines.reduce((s, l) => s + l.amount, 0); } }\nmodule.exports = Invoice;\n');
  h.write('src/routes/billing.js', "module.exports = (app) => app.post('/invoices', () => ({}));\n");
  h.write('src/services/pricing.js', 'module.exports = { prorate(amount, daysUsed, daysInCycle) { return (amount * daysUsed) / daysInCycle; } };\n');
  h.write('tests/pricing.test.js', "const { prorate } = require('../src/services/pricing');\ntest('prorates mid-cycle', () => expect(prorate(30, 15, 30)).toBe(15));\n");
  h.write('src/services/webhooks.js', 'module.exports = { deliver(url, payload, attempt = 1) { if (attempt > 5) throw new Error(\'gave up\'); } };\n');
  h.write('tests/webhooks.test.js', "const { deliver } = require('../src/services/webhooks');\ntest('gives up after five attempts', () => expect(() => deliver('u', {}, 6)).toThrow());\n");
}

function ensureNothingRecorded(h) {
  const file = path.join(h.dir, '.workflows', 'manifest.json');
  const manifest = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { work_units: {} };
  manifest.baseline = {};
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
}

module.exports = {
  build(h) {
    codebase(h);
    m.init(h);
    ensureNothingRecorded(h);
    h.write('.world-history.json', JSON.stringify([
      { message: 'feat: user accounts', files: ['src/models/user.js', 'src/routes/users.js'] },
      { message: 'feat: billing with invoices', files: ['src/models/invoice.js', 'src/routes/billing.js', 'src/services/pricing.js'] },
      { message: 'fix: prorate mid-cycle plan changes', files: ['tests/pricing.test.js'] },
      { message: 'feat: webhook delivery with retries', files: ['src/services/webhooks.js', 'tests/webhooks.test.js'] },
      { message: 'chore: install the workflows', files: native.workflowsFiles(h) },
    ], null, 2));
  },
};

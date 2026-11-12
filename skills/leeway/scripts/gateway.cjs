'use strict';

// ---------------------------------------------------------------------------
// Adapter (read gateway) for leeway. It serves no verb: every screen the
// start skill shows, the engine draws (`render start-menu` and the menus
// reached from it).
// ---------------------------------------------------------------------------

const engine = require('../../leeway-engine/scripts/lib.cjs');

if (require.main === module) {
  engine.gateway.runGateway({
    index: () => {
      process.stderr.write('Error: this gateway serves no verb — the start skill\'s screens are the engine\'s: engine render start-menu\n');
      return process.exit(1);
    },
  });
}

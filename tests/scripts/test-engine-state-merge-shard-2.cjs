'use strict';

require('./hermetic-env.cjs');
require('./shards.cjs').runShard(__filename);

module.exports = { deliver(url, payload, attempt = 1) { if (attempt > 5) throw new Error('gave up'); } };

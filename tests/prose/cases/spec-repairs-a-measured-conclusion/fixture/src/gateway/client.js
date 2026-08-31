'use strict';

// REST client for the payment gateway's events endpoint.
const PAGE_SIZE = 250;

async function listCaptureEvents(client, since) {
  const events = [];
  let cursor = null;
  do {
    const page = await client.get('/v1/events', {
      type: 'capture', since, limit: PAGE_SIZE, cursor,
    });
    events.push(...page.data);
    cursor = page.next_cursor;
  } while (cursor);
  return events;
}

module.exports = { PAGE_SIZE, listCaptureEvents };

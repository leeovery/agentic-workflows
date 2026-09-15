'use strict';

// A concluded investigation reopened by the gap its own specification
// routed back. The behaviour under test is the raise from an
// investigation: the provenance line names this topic's own name, so
// the origin must bind to the specification — never the topic to
// itself, never as something the specification settled — and the
// position must never reach for an experiment or a research pass,
// which a bugfix's pipeline does not carry. The entry is authored
// exhaustive on purpose, so what the raise holds back — the itemised
// costs, the tuning numbers, the rejected zero-rating — is checkable
// against what the queue holds, and it carries an unmeasured conversion
// cost as bait for the measurement the bugfix cannot run.

const m = require('../../mainlines/bugfix.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    m.investigateToRootCause(h);
    m.concludeInvestigation(h);

    // The specification started (initialize-specification.md: file
    // before item, then the single source row and the review state) and
    // construction extracted the ground the gap does not touch before it
    // stopped — the source row stays pending, never extracted whole.
    h.write(`.workflows/${WU}/specification/${WU}/specification.md`, [
      '# Specification: Crash Fix',
      '',
      '## Specification',
      '',
      '### 1. Scope',
      '',
      '- An order with no shippable line items completes checkout through the payment step.',
      '- Orders carrying at least one shippable item are unchanged.',
      '',
      '### 2. Tax Context',
      '',
      '- For an order with a shipping address, the tax context is built from it, as today.',
      '',
      '### 3. Test Coverage',
      '',
      '- A digital-only basket is covered end to end through the payment step.',
      '',
      '---',
      '',
      '## Working Notes',
      '',
    ].join('\n'));
    h.engine('topic', 'start', WU, 'specification', WU);
    h.engine('manifest', 'set', `${WU}.specification.${WU}`, `sources.${WU}.status`, 'pending');
    h.engine('manifest', 'set', `${WU}.specification.${WU}`,
      'review_cycle=0', 'finding_gate_mode=gated', 'construction_gate_mode=gated', 'date=2026-01-01');
    h.engine('commit', WU, '-m', `spec(${WU}): initialize specification`, '--topic', `specification/${WU}`);

    // The gap exit (resolve-source-incoherence.md, the non-epic branch):
    // the entry in the pinned shape to the specification's cache scratch,
    // delivered by the self-committing triage transaction — which reopens
    // the investigation item and installs the queue file — then the pause
    // commit, an honest no-op over what the delivery already committed.
    const scratch = `.workflows/.cache/${WU}/specification/${WU}/gap-concern.md`;
    h.write(scratch, [
      '### Tax location when the order carries no address',
      `*From: ${WU} · specification · 2026-01-08*`,
      '',
      'The agreed fix direction builds the tax context from the billing',
      'address when an order has no shippable items: "when an order has no',
      'shippable items, build the context from the billing address',
      'instead." Writing that down as a requirement, this session checked',
      'what the checkout actually guarantees about the billing address and',
      'found that it guarantees nothing — so the fall-through the direction',
      'relies on has nowhere to land for a whole class of the very orders',
      'the bug affects, and what the checkout does for them is a call',
      `${WU} still owes.`,
      '',
      'Background. The billing address is optional at every payment method',
      'the checkout accepts. A card entered at checkout carries the address',
      'the customer types, and the form lets them skip it. A saved card',
      'carries an address only when the customer entered one at the time it',
      'was saved. A wallet payment (Apple Pay, Google Pay) hands the checkout',
      'a payment token and no address at all — the wallet holds one, but the',
      'integration was never asked for it. Counting last quarter\'s',
      'digital-only orders, 31% paid by wallet and a further 6% by a saved',
      'card with no address on file. For those orders the fix as directed',
      'reaches for a billing address that is not there and fails in the',
      'same place the bug fails today, one address further along — or,',
      'written defensively, builds a tax context with no location in it,',
      'and nothing in the record says what rate such an order is taxed at.',
      'The blast-radius note already frames this ground — "any flow',
      'building a tax context from an address-less order" — but the',
      'direction beneath it assumes an address the checkout does not',
      'promise.',
      '',
      'Options this session worked through.',
      '',
      '1. Ask before taking payment. When an order has no shippable items',
      '   and no billing address, the payment step asks for the customer\'s',
      '   country — one field, nothing else — before the payment is taken,',
      '   and the tax context is built from that. Cost: it adds a step to a',
      '   flow that is one tap for a wallet payer, on orders the product has',
      '   never measured a conversion figure for; and the checkout has no',
      '   place in its layout for a mid-payment prompt, so one has to be',
      '   designed.',
      '',
      '2. Derive the location from what the checkout already holds. The tax',
      '   context is built from the first of: the payment method\'s issuing',
      '   country (the card\'s BIN, or the wallet token\'s issuer field), the',
      '   account\'s registered country, the store\'s home country as the',
      '   floor. Cost: a customer whose card was issued in a country they no',
      '   longer live in is taxed at the wrong rate — over- or under-charged,',
      '   and an under-charge is a compliance exposure nobody has sized; and',
      '   the issuer lookup is a second call inside the payment step, on a',
      '   250 ms budget against the step\'s 800 ms tax-lookup timeout, with',
      '   two attempts before it falls through to the next source.',
      '',
      '3. Rejected: tax address-less orders at nothing. When no address is',
      '   there to tax by, apply no tax and let the order through. Rejected',
      '   because it turns the crash into a discount — every wallet payer',
      '   pays less than a card payer for the same download — and because',
      '   the store\'s tax registrations do not allow a zero rate on digital',
      '   goods in the first place.',
      '',
      'This session leans to option 2: the direction already fills a',
      'missing address from what the order carries — the billing address in',
      'place of the shipping one — and taking the location from the payment',
      'method is the same move one step further, while option 1 spends the',
      'one-tap flow the wallet payers chose. The cost worth naming is the',
      'wrong-rate one — a card issued abroad taxes its holder as if they',
      'lived there — which the account\'s registered country narrows when',
      'the customer has one.',
      '',
      `What ${WU} needs to decide: where the tax location comes from for an`,
      'order with no shippable items and no billing address — a country the',
      'customer is asked for before payment, or one derived from the payment',
      'method and the account. Not in scope here: the shipping-address',
      'fall-through itself, already agreed.',
      '',
    ].join('\n'));
    h.engine('topic', 'triage', WU, 'investigation', WU,
      '--concern', scratch, '--slug', 'tax-location-without-an-address',
      '-m', `spec(${WU}): gap routed to ${WU}`);
    h.engine('commit', WU, '-m', `spec(${WU}): pause — gap routed to ${WU}`, '--topic', `specification/${WU}`);

    // The delivery commit as the engine lands it — the concern file and
    // the manifest, nothing else — so the world's history carries the
    // landing that reopened the investigation.
    h.write('.world-history.json', JSON.stringify([
      { message: `spec(${WU}): gap routed to ${WU}`,
        files: [
          `.workflows/${WU}/investigation/.triage/${WU}/001-tax-location-without-an-address.md`,
          `.workflows/${WU}/manifest.json`,
        ] },
    ], null, 2));
  },
};

# stub: finding-synthesised-blocking-and-remedy

The synthesis stage's action list: the blocking entry and its paired
finding collapse into one action carrying the blocking marker — its remedy
a literal at one site, contained, so it routes do-now; the capture finding
is re-aimed at the code the assessor named, its radius re-read with the
code open — one guard at one site, contained with the case that observes
it — so it routes do-now too. Nothing needs planning, so the derived
verdict is pass. Write the JSON below to the output path the dispatch
names. The counts are also what the agent returns to its caller.

---

{"verdict":"pass","actions":[{"id":"A1","route":"do-now","blocking":true,"ids":["1-1-b1","1-1-1"],"files":["src/checkout/payment-intent.js"],"summary":"card-only is not enforced at intent creation","intent":"fix the intent's methods to ['card'] so card-only holds whatever the order carries","instruction":"in src/checkout/payment-intent.js, replace `methods: order.methods` with `methods: ['card']`","fails":"a checkout carrying a wallet method opens a wallet intent the product forbids","rescued":false},{"id":"A2","route":"do-now","ids":["1-2-1"],"files":["src/webhooks/capture.js","tests/webhooks/capture.test.js"],"summary":"a capture for an unknown intent runs the paid write","intent":"guard the write so a capture naming an intent no order carries is ignored — the code change the failure needs, not the comment edit the finding prescribed","instruction":"in src/webhooks/capture.js, return before orders.markPaid when orders.find(event.intentId) is absent; the comment stands as written. In tests/webhooks/capture.test.js, add a case delivering a capture for an intent no order carries and assert orders.markPaid was not called — the case that observes the guard","fails":"a capture for an unknown intent runs the write, minting a paid record for an order that does not exist","rescued":true,"amended":"remedy re-aimed from comment text to the guard; radius re-read with the code open — one guard at one site, contained with its covering case"}],"discarded":[],"stats":{"findings":3,"do_now":2,"replan":0,"out_of_scope":0,"discarded":0,"rescued":1}}

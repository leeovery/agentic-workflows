The prose should have taken this path:

1. the code slot reads free, and the plan gate renders empty
2. dependency validation returns immediately — external dependencies are
   an epic concern
3. the implementation status reads empty, so this is a first start:
   tracking is initialised and the start of implementation committed —
   never the resuming note — and nothing about the environment is
   touched before it: no check, no question, no setup document
4. environment setup finds no setup document, consumes the scripted
   answer there, and records it as the document so the question is not
   asked again in a later session

Further claims:

- the setup document is written once, by the setup step and nowhere else

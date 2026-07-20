# Configuration

The system configures itself the way it does everything else: conversationally, once, with the answer recorded where the next session will find it. There is no configuration file to author by hand and no setup procedure to follow. This page describes where each kind of setting comes from and how it behaves, so nothing surprises you.

## Installing and updating

```bash
npx agntc add leeovery/agentic-workflows
```

This installs the workflow skills into the project. Commit the installed files to share the workflows with your team and to use them in Claude Code for the Web. `npx agntc update` pulls the latest version, and `npx agntc remove leeovery/agentic-workflows` uninstalls. Updates carry themselves forward: the first run after an update brings your existing work into line with the new version automatically, so there is nothing to migrate by hand.

The only requirement is Node 18 or newer. The first `/workflow-start` sets everything else up in conversation. Optionally, if you want search-by-meaning over your past work, you will be offered a one-time setup for it — including an option that needs no external service at all. See [the knowledge base](knowledge-base.md) for that choice.

## Settings that fill themselves in

A few settings exist, but you never set them in advance. Each is asked the first time it is needed and remembered thereafter. There is where your plan's tasks get stored (asked during [planning](planning.md)), the project-specific skills that guide the building and reviewing agents (asked during [implementation](implementation.md)), and the linters that run through the build (also discovered during implementation).

These stored values are suggestions, not standing decisions. When a setting is relevant again, the remembered value pre-fills the question, but you still confirm or override it, and the value you confirm is what actually gets used for that piece of work. Nothing reads a stored default at the moment of execution, so changing one never silently rewrites work already in flight. This is the same discipline the system applies everywhere: a value that was right last time is a suggestion for this time, never consent given in advance.

## Handing over the gates

Every approval loop offers an auto option, and choosing it is how you hand that particular gate over — from then on the system proceeds there without stopping to ask. This is scoped and reversible rather than a global switch. Some gates reset to asking at the start of each session, so auto is an opt-in for a sitting rather than a permanent setting; and certain escalations override auto entirely — when a fix loop or an analysis loop hits its limit, it stops and asks regardless, because those are the moments a human needs to look. Auto is always something you choose at a gate, never something the system infers from a past choice or a stored preference. The reasoning is covered in [the collaboration model](collaboration.md).

## Environment setup

The first time [implementation](implementation.md) runs, it asks whether there are any project-specific steps it should carry out before writing code — copying an environment file, running migrations, installing an extension. It saves your answer and never asks again; "no special setup required" is a perfectly good saved answer. The steps are run exactly as you wrote them, before the first task.

## Knowledge configuration

The [knowledge base](knowledge-base.md) has two layers of settings, both established through its one-time setup rather than by hand: system-wide defaults that apply across your projects, and per-project settings for this project's store. If a cloud embedding service is involved, its key is stored securely on your machine and never travels through the chat. A project can also choose to run in keyword-only mode regardless of any system default, if you would rather it not depend on an external service. None of this needs revisiting once set; it is described in full on the knowledge base page.

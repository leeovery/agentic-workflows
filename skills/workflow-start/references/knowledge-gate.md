# Knowledge Gate

*Reference for **[workflow-start](../SKILL.md)***

---

The knowledge base is required infrastructure — no workflow proceeds without it. Initialise it here, conversationally. The API key is the one thing that must NEVER pass through this chat: every path below keeps it in the user's terminal or shell environment, and you never ask for it, accept it, or echo it.

Read the boot response's `system_config` object: `status` (`valid`, `absent`, or `invalid`), `provider`, and `model`.

## A. Route

#### If `system_config.status` is `valid`

→ Proceed to **B. Use Existing Configuration**.

#### Otherwise

→ Proceed to **C. Choose a Mode**.

## B. Use Existing Configuration

> *Output the next fenced block as markdown (not a code block):*

```
> The knowledge base powers cross-work-unit recall and must be
> initialised before any workflow runs. Your machine already has
> a system configuration this project can reuse.

· · · · · · · · · · · ·
Set up the knowledge base for this project?

- **`y`/`yes`** — Use the existing configuration (@if(system_config.provider) {system_config.provider} · {system_config.model} @else keyword-only @endif)
- **`d`/`different`** — Choose a different mode for this project
- **`t`/`terminal`** — Run the interactive wizard in your terminal instead
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

Run:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs setup --from-system
```

**If the command succeeded:**

→ Proceed to **E. Confirm and Continue**.

**If the command failed with "no OpenAI API key found":**

→ Proceed to **D. Store the API Key**.

**If the command failed for any other reason:**

Surface the reported error verbatim. The knowledge base could not be initialised — the workflow cannot proceed.

**STOP.** Do not proceed — terminal condition.

#### If `different`

→ Proceed to **C. Choose a Mode**.

#### If `terminal`

→ Proceed to **F. Terminal Wizard**.

## C. Choose a Mode

> *Output the next fenced block as markdown (not a code block):*

```
> Pick how this project's knowledge base should search. OpenAI
> needs an API key — stored in your terminal, never pasted here.
> Keyword-only needs no key and can be upgraded anytime.

· · · · · · · · · · · ·
How should this project's knowledge base work?

- **`o`/`openai`** — OpenAI embeddings — full semantic search (recommended; needs an API key)
- **`c`/`compatible`** — A local or self-hosted OpenAI-compatible endpoint (LM Studio, Ollama, vLLM)
- **`k`/`keyword`** — Keyword-only search — the no-key backstop; upgrade anytime later
- **`t`/`terminal`** — Run the interactive wizard in your terminal instead
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `openai`

> *Output the next fenced block as a code block:*

```
Which OpenAI embedding model?

- Reply with a model name, or "default" for text-embedding-3-small.
```

**STOP.** Wait for user response.

Run with the chosen model (`text-embedding-3-small` for "default"):

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs setup --provider openai --model {model}
```

**If the command succeeded:**

→ Proceed to **E. Confirm and Continue**.

**If the command failed with "no OpenAI API key found":**

→ Proceed to **D. Store the API Key**.

**If the command failed for any other reason:**

Surface the reported error verbatim. The knowledge base could not be initialised — the workflow cannot proceed.

**STOP.** Do not proceed — terminal condition.

#### If `compatible`

> *Output the next fenced block as a code block:*

```
Where is the embeddings endpoint?

- Base URL (e.g. http://localhost:1234/v1)
- Model name
- Vector dimensions — must match the model's native output
```

**STOP.** Wait for user response.

Run with the collected values:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs setup --provider openai-compatible --base-url {base_url} --model {model} --dimensions {dimensions}
```

Keyless endpoints are fine — a key stored in the credentials file is picked up automatically.

**If the command succeeded:**

→ Proceed to **E. Confirm and Continue**.

**If the command failed:**

Surface the reported error verbatim. If the error is an authentication failure (HTTP 401/403), the endpoint wants a key: tell the user to run `node .claude/skills/workflow-knowledge/scripts/knowledge.cjs setup --key-only --provider openai-compatible` in their terminal — never paste the key into this chat — then, on their word, re-run the command above and handle the result as prescribed here. For any other failure the workflow cannot proceed.

**STOP.** Do not proceed — terminal condition.

#### If `keyword`

Run:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs setup --keyword-only
```

**If the command succeeded:**

→ Proceed to **E. Confirm and Continue**.

**If the command failed:**

Surface the reported error verbatim. The knowledge base could not be initialised — the workflow cannot proceed.

**STOP.** Do not proceed — terminal condition.

#### If `terminal`

→ Proceed to **F. Terminal Wizard**.

## D. Store the API Key

The setup command refused because no OpenAI API key could be resolved. The key goes straight from the user's terminal into a private store — it never touches this chat.

> *Output the next fenced block as a code block:*

```
No OpenAI API key was found. Store one without it touching this
chat — run ONE of these in your terminal, then come back:

  node .claude/skills/workflow-knowledge/scripts/knowledge.cjs setup --key-only
      Private prompt, input hidden. Stored at
      ~/.config/workflows/credentials.json (mode 0600).

  export OPENAI_API_KEY=<your key>
      Shell environment — takes precedence over the stored key.
```

> *Output the next fenced block as markdown (not a code block):*

```
> Do not paste the API key into this chat — not even partially.
> Store it in your terminal with one of the commands above, then
> come back here.

· · · · · · · · · · · ·
Ready to retry?

- **`d`/`done`** — The key is stored — re-run the setup
- **`k`/`keyword`** — Skip the key for now — use keyword-only search instead
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `done`

Re-run the setup command that routed here and handle its result exactly as that branch prescribes (including routing back here if the key is still unresolvable).

#### If `keyword`

Run:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs setup --keyword-only
```

**If the command succeeded:**

→ Proceed to **E. Confirm and Continue**.

**If the command failed:**

Surface the reported error verbatim. The knowledge base could not be initialised — the workflow cannot proceed.

**STOP.** Do not proceed — terminal condition.

## E. Confirm and Continue

The fresh store is uncommitted. Commit it — the same commit boot makes after a terminal-wizard restart:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --workflows -m "chore(knowledge): initialise store"
```

Then confirm, filling the placeholders from the mode just initialised:

> *Output the next fenced block as a code block:*

```
Knowledge base ready — @if(provider) {provider} · {model} @else keyword-only @endif.
```

→ Return to **[the skill](../SKILL.md)** for **Step 1**.

## F. Terminal Wizard

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Knowledge Base Setup
●───────────────────────────────────────────────●

```

> *Output the next fenced block as markdown (not a code block):*

```
> The interactive wizard runs in your terminal. It walks provider
> choice, key entry (input hidden), and project store setup.
```

> *Output the next fenced block as a code block:*

```
Run the wizard in your terminal:

  node .claude/skills/workflow-knowledge/scripts/knowledge.cjs setup

It configures system defaults, initialises the project store, and
runs the initial indexing pass. Start the workflow again once it
completes.
```

**STOP.** Do not proceed — terminal condition.

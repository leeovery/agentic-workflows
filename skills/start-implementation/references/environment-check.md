# Check Environment

*Reference for **[start-implementation](../SKILL.md)***

---

> **IMPORTANT**: This step is for **information gathering only**. Do NOT execute any setup commands at this stage. The processing skill contains instructions for handling environment setup.

Use the `environment` section from the discovery output:

#### If `setup_file_exists` is true and `requires_setup` is false

> *Output the next fenced block as a code block:*

```
Environment: No special setup required.
```

→ Return to **[the skill](../SKILL.md)**.

#### If `setup_file_exists` is true and `requires_setup` is true

> *Output the next fenced block as a code block:*

```
Environment setup file found: .workflows/.state/environment-setup.md
```

→ Return to **[the skill](../SKILL.md)**.

#### If `setup_file_exists` is false or `requires_setup` is null

> *Output the next fenced block as a code block:*

```
Are there any environment setup instructions I should follow before implementation?
(Or "none" if no special setup is needed)
```

**STOP.** Wait for user response.

- If the user provides instructions, save them to `.workflows/.state/environment-setup.md`, commit and push
- If the user says no/none, create `.workflows/.state/environment-setup.md` with "No special setup required." and commit

→ Return to **[the skill](../SKILL.md)**.

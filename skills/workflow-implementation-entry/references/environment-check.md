# Check Environment

*Reference for **[workflow-implementation-entry](../SKILL.md)***

---

> **IMPORTANT**: This step is for **information gathering only**. Do NOT execute any setup commands at this stage. The processing skill contains instructions for handling environment setup.

Check if the environment setup file exists at `.workflows/.state/environment-setup.md`:

```bash
cat .workflows/.state/environment-setup.md
```

#### If file exists and contains "No special setup required"

> *Output the next fenced block as a code block:*

```
Environment: No special setup required.
```

→ Return to caller.

#### If file exists and contains setup instructions

> *Output the next fenced block as a code block:*

```
Environment setup file found: .workflows/.state/environment-setup.md
```

→ Return to caller.

#### If file does not exist

> *Output the next fenced block as a code block:*

```
Are there any environment setup instructions I should follow before implementation?
(Or "none" if no special setup is needed)
```

**STOP.** Wait for user response.

- If the user provides instructions, save them to `.workflows/.state/environment-setup.md`, commit and push
- If the user says no/none, create `.workflows/.state/environment-setup.md` with "No special setup required." and commit

→ Return to caller.

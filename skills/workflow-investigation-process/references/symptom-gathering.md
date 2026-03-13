# Symptom Gathering

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

Questions to ask when gathering bug symptoms.

## Core Questions

### What's broken?

- What is the expected behavior?
- What is the actual behavior?
- How significant is the gap?

### How is it manifesting?

- What error messages appear?
- What UI/UX issues are visible?
- Are there performance symptoms?
- Is data affected (corrupted, lost, wrong)?

### When did it start?

- When was the bug first noticed?
- Was there a recent deployment or change?
- Did something trigger it (load spike, new feature)?

### Who is affected?

- All users or a subset?
- Specific user types/roles?
- Specific regions or environments?

## Reproduction Questions

### Can you reproduce it?

- Always, sometimes, or rarely?
- Are there specific conditions required?
- Does reproduction require specific data?

### What are the exact steps?

1. What is the starting state?
2. What action triggers the bug?
3. What happens immediately after?
4. How does the user know it's wrong?

### What are the preconditions?

- User state (logged in, permissions)
- Data state (specific records, configurations)
- Application state (cached data, session)
- Time-based (time of day, day of week)

## Environment Questions

### Where does it occur?

- Production, staging, development?
- Specific servers or regions?
- All instances or specific ones?

### What platform?

- Browser type and version
- Operating system
- Mobile vs desktop
- App version (if applicable)

### What are the external factors?

- Network conditions
- Third-party service status
- Database load
- Recent infrastructure changes

## Impact Questions

### How severe is this?

- **Critical**: System down, data loss, security breach
- **High**: Major feature broken, many users affected
- **Medium**: Feature degraded, workaround exists
- **Low**: Minor issue, few users affected

### What is the business impact?

- Revenue affected?
- Customer trust impacted?
- Compliance implications?
- Support ticket volume?

### What is the scope?

- How many users affected?
- How often does it occur?
- Is it getting worse?

## Reference Gathering

### Do you have error logs?

- Application logs
- Server logs
- Browser console
- Network requests

### Are there error tracking entries?

- Sentry or similar
- Stack traces
- Frequency data
- User sessions

### Any relevant support tickets?

- Customer reports
- Internal reports
- Related issues
- Historical context

### Screenshots or recordings?

- Visual of the bug
- Steps leading to it
- Error states
- Expected vs actual comparison

## Follow-up Questions

### What have you already tried?

- Debugging attempts
- Hypotheses tested
- Workarounds attempted

### What does your team suspect?

- Initial hypotheses
- Areas of concern
- Recent changes that might be related

### Any time sensitivity?

- Is there a deadline?
- Is there a workaround for now?
- How urgent is the fix?

## Question Order

Start broad, then narrow:

1. **Problem description** - What's wrong?
2. **Impact assessment** - How bad is it?
3. **Reproduction** - Can we trigger it?
4. **Environment** - Where does it happen?
5. **History** - When did it start?
6. **References** - What do we have to work with?
7. **Hypotheses** - What do you suspect?

Don't ask all questions upfront. Start with the most important, gather initial context, then drill down based on responses.

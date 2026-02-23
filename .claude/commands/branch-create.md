Create a new branch with conventional naming based on the current work or a referenced issue.

## Steps

1. If user provided an issue number, fetch it: `gh issue view <number> --json title,body,labels`
2. If no issue, ask user to describe the work in 2-5 words
3. Determine branch type prefix:
   - `feat/` - New feature
   - `fix/` - Bug fix
   - `docs/` - Documentation
   - `refactor/` - Code refactoring
   - `test/` - Adding/updating tests
   - `chore/` - Maintenance, dependencies, tooling
   - `hotfix/` - Urgent production fix
4. Generate branch name: `<type>/<short-description>`
   - All lowercase, hyphens between words, max 50 chars
5. Create: `git checkout -b <branch-name>`

## Examples

```
Issue: "Add debug logging for MIDI communication"
Branch: feat/midi-debug-logging

Issue: "Fix timeout when FL Studio disconnects"
Branch: fix/fl-disconnect-timeout

User: "updating the readme"
Branch: docs/readme-updates
```

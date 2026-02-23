Full workflow: branch → organize commits → push → create PR.

## Step 1: Branch

Run `git status` and `git branch --show-current`.

- If no changes and no unpushed commits, abort: "Nothing to ship"
- If already on a feature branch, skip to Step 2
- If on main:
  1. If user provided an issue number, fetch it: `gh issue view <num> --json title,body,labels`
  2. Otherwise ask user to describe the work in 2-5 words
  3. Pick prefix: feat/ fix/ docs/ refactor/ test/ chore/ hotfix/
  4. Generate branch: `<prefix><lowercase-hyphenated-description>` (max 50 chars)
  5. Create: `git checkout -b <branch>`

## Step 2: Organize and Commit

1. Run `git status` and `git diff --stat` to see all changes
2. Group files into logical atomic commits by purpose/function/layer
3. Present the plan:
   ```
   Commit plan:
   1. feat(bridge): add sysex response handler
      - src/bridge/midi-client.ts
      - src/bridge/sysex-codec.ts
   2. docs: update setup instructions
      - README.md
   ```
4. Wait for user confirmation
5. For each group: `git add <files>` then `git commit -m "<single-line message>"`

Commit message rules:
- Format: `<type>(<scope>): <description>` or `<type>: <description>`
- Types: feat, fix, docs, refactor, test, chore
- Single line only, max 72 chars, lowercase after colon, no period
- **NEVER add Co-Authored-By or any attribution**

## Step 3: Push and Create PR

1. Push: `git push -u origin HEAD`
2. Gather context:
   - Commits: `git log origin/main..HEAD --format="%s"`
   - Diff: `git diff origin/main...HEAD --stat`
   - Look for issue references in commits or branch name
   - If issue found, fetch AC: `gh issue view <num> --json body`
3. Determine issue linking:
   - ALL acceptance criteria met → `Closes #N` (must include proof below)
   - Partial work → `Related to #N`
4. Create PR with `gh pr create --title "<title>" --body "$(cat <<'EOF' ... EOF)"`:

```
## Summary
<1-3 factual bullet points>

## Test Plan
<Concrete steps to verify changes work>

## Issues
<Closes #N or Related to #N, if applicable>

## AC Verification (only if closing an issue)
- [x] <criterion> — <evidence>
```

PR title: conventional commit format, max 72 chars.

## Step 4: Output

```
Branch: feat/midi-debug-logging
Commits: 3
PR: https://github.com/...
```

## Rules

- **NEVER add Co-Authored-By or any attribution anywhere** (commits, PR title, PR body)
- **NO emoji**
- Single-line conventional commit messages only
- Atomic commits: each independently meaningful and revertable
- Always show commit plan and get confirmation before executing
- PR body is short and factual with a test plan
- Only use "Closes" when ALL AC is verifiably met with proof

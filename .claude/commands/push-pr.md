Push the current branch and create a pull request with a short, factual body.

## Steps

1. **Pre-flight**
   - Verify not on main: `git branch --show-current`
   - Verify commits exist: `git log origin/main..HEAD --oneline`
   - If on main, abort and suggest `/branch-create`

2. **Push**: `git push -u origin HEAD`

3. **Gather context**
   - Get commits: `git log origin/main..HEAD --format="%s"`
   - Get full diff: `git diff origin/main...HEAD --stat`
   - Check for related issues in commits or branch name
   - If issue found, fetch AC: `gh issue view <num> --json body`

4. **Determine issue linking**
   - ALL acceptance criteria met → `Closes #N` (must show proof)
   - Partial work → `Related to #N`

5. **Create PR** using `gh pr create` with HEREDOC body:

```
## Summary
<1-3 factual bullet points>

## Test Plan
<How to verify changes work>

## Issues
<Closes #N or Related to #N>

## AC Verification (only if closing)
- [x] <criterion> — <proof>
- [x] <criterion> — <proof>
```

6. Return the PR URL

## Rules

- **NO Co-Authored-By or attribution of any kind in the body**
- **NO emoji**
- PR title: conventional commit format, max 72 chars
- Body: short and factual, not verbose
- Test plan required
- Only use "Closes" if ALL AC is verifiably met with proof shown

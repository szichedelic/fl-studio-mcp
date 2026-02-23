Merge a pull request after verification checks.

## Steps

1. **Identify PR**
   - If user provides PR number, use it
   - Otherwise find PR for current branch: `gh pr view --json number,title,state`

2. **Pre-merge checks**
   - `gh pr view <num> --json state,mergeable,reviewDecision,statusCheckRollup`
   - Verify PR is open, checks passing, mergeable

3. **Show summary and confirm**
   ```
   PR #42: feat: add debug logging
   Checks: Passing | Mergeable: Yes
   ```

4. **Merge** (squash by default, delete branch):
   ```bash
   gh pr merge <num> --squash --delete-branch
   ```

5. **Cleanup**:
   ```bash
   git checkout main && git pull origin main && git fetch --prune
   ```

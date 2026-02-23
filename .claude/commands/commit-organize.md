Analyze all uncommitted changes and organize them into atomic commits with single-line conventional commit messages.

## Steps

1. Run `git status` and `git diff --stat` to see all changes
2. Group files by purpose/function into logical atomic commits
3. Show the commit plan:
   ```
   Commit plan:
   1. feat(logging): add debug logger module
      - src/bridge/debug-logger.ts
   2. feat(midi): integrate debug logging into client
      - src/bridge/midi-client.ts
   3. docs: add debug configuration to readme
      - README.md
   ```
4. After user confirms, execute each commit in order using `git add <files>` then `git commit`

## Commit Message Rules

- Single line only, no body or footer
- Format: `<type>(<scope>): <description>` or `<type>: <description>`
- Types: feat, fix, docs, refactor, test, chore
- Max 72 characters, lowercase after colon, no period
- **NEVER add Co-Authored-By or any co-authorship/attribution lines**

## Grouping Rules

- Group by feature/functionality, layer, or change type
- Each commit must be independently meaningful and revertable
- Config changes separate from code changes
- Docs separate from implementation

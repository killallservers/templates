# Pre-Commit Quality Checks

## Rule: All Commits Must Pass Code Quality Checks

Before any commit is created or updated, the following checks **must** pass:

1. ✅ **Type checking** — `bun run typecheck`
2. ✅ **Linting** — `bun run lint`
3. ✅ **Formatting** — `bun run format`
4. ✅ **Comprehensive check** — `bun run check`

This is enforced automatically by `.git/hooks/pre-commit`.

## How It Works

When you run `git commit`, the pre-commit hook will:

1. Run type checking (`tsc --noEmit` via tsgo)
   - Fails immediately if TypeScript errors found
2. Run linting (`biome lint --write src/`)
   - Auto-fixes linting issues where possible
   - Fails if unfixable issues remain
3. Run formatting (`biome format --write src/`)
   - Auto-formats all code
4. Run comprehensive check (`biome check src/`)
   - Final validation before commit

## Auto-Fix Behavior

If linting or formatting **auto-fix** files:
- Hook automatically re-stages the fixed files
- Commit proceeds with the fixed code
- You see: "Re-staged auto-fixed files"

If checks **fail** (type errors, unfixable issues):
- Commit is **blocked**
- Error message tells you how to fix
- You must fix and try commit again

## Manual Check

You can run all checks manually before committing:

```bash
bun run typecheck   # Type check only
bun run lint        # Lint and auto-fix
bun run format      # Format code
bun run check       # Comprehensive validation
```

Or run them all in sequence:

```bash
bun run typecheck && bun run lint && bun run format && bun run check
```

## Bypassing the Hook

**Not recommended**, but if absolutely necessary:

```bash
git commit --no-verify
```

This skips the pre-commit hook. Use only for emergency fixes; the hook exists to maintain code quality.

## Troubleshooting

### "Type check failed"
```
❌ Type check failed. Fix errors and try again.
```

Fix TypeScript errors in your code, then retry commit.

### "Linting failed"
```
❌ Linting failed. Run 'bun run lint' to auto-fix.
```

Run `bun run lint` manually, review auto-fixes, and retry commit.

### "Formatting failed"
```
❌ Formatting failed. Run 'bun run format' to auto-fix.
```

Run `bun run format` manually and retry commit.

### "Comprehensive check failed"
```
❌ Comprehensive check failed. Review errors above.
```

Review Biome's error output, fix issues, and retry commit.

## Hook Location

The pre-commit hook is located at:
```
.git/hooks/pre-commit
```

If you need to modify it, edit that file. Make sure to keep it executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Benefits

This rule ensures:
- ✅ No type errors reach the codebase
- ✅ Consistent code style (via Biome formatter)
- ✅ No linting violations
- ✅ High code quality baseline
- ✅ Reduced CI/CD failures
- ✅ Cleaner git history

## Related

- `.agentic/skills/biome/SKILL.md` — Biome configuration and usage
- `package.json` — Biome scripts definition
- `.biome.json` — Biome linting/formatting rules (if exists)

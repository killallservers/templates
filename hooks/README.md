# Symlink Hook: Syncing .agentic/ to .claude/

## What It Does

The `symlink-to-claude.sh` hook creates **relative symlinks** from your source directory (`.agentic/`) to your Claude Code interface (`.claude/`).

```
.agentic/skills/bun/SKILL.md
         ↓ symlink
.claude/skills/bun/SKILL.md
```

This keeps one source of truth while allowing Claude Code to read from `.claude/` without duplication.

## When to Use

### Automatically
The setup CLI runs this hook for you after installing scaffolding.

### Manually
Run the hook when you:
- Add a new skill to `.agentic/skills/my-skill/SKILL.md`
- Add a new agent to `.agentic/agents/my-agent.md`
- Add a new workflow to `.agentic/workflows/my-workflow.js`
- Reorganize files in `.agentic/`

## How to Invoke

**From the terminal:**
```bash
bash .agentic/hooks/symlink-to-claude.sh
```

**From Claude Code (if permissions granted):**
```
! bash .agentic/hooks/symlink-to-claude.sh
```

## Troubleshooting

### Symlinks are broken
Run the hook again to regenerate them:
```bash
bash .agentic/hooks/symlink-to-claude.sh
```

### Symlinks point to wrong location
If you moved `.agentic/` or `.claude/` directories, symlinks will break. The hook uses relative paths, which assume both directories stay at the same depth from the project root.

**Solution:** Re-run the hook after moving directories.

### Permission denied
Make the hook executable:
```bash
chmod +x .agentic/hooks/symlink-to-claude.sh
```

### Files aren't being symlinked
The hook only symlinks files inside `.agentic/` that are NOT in `hooks/`. Check:
- Is your file in `.agentic/agents/`, `.agentic/skills/`, `.agentic/workflows/`, `.agentic/rules/`, or `.agentic/memory/`?
- Did you run the hook after adding the file?

## Understanding Relative Symlinks

This hook uses relative symlinks for portability. A relative symlink is:
```
.claude/AGENTS.md → ../.agentic/AGENTS.md
```

instead of an absolute path:
```
.claude/AGENTS.md → /home/erik/Code/killallservers/agentic/.agentic/AGENTS.md
```

**Benefit:** You can clone the repo anywhere and symlinks still work.
**Constraint:** Both `.agentic/` and `.claude/` must stay at the same directory level (they're siblings in your project root).

## Preservation of User Files

The hook intentionally does NOT symlink:
- `.claude/settings.json` — Your project-wide settings
- `.claude/settings.local.json` — Your local overrides (gitignored)

These are created manually and should not be overwritten.

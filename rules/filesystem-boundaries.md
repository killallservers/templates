# Rule: Filesystem Boundaries — Stay in the Starting Directory

**The assistant must never use `cd` to change away from the directory the session started in. All operations must stay within that directory tree or use absolute paths to reference files without navigating away.**

## Rationale

- **Focus**: Keeps work confined to the current project, preventing accidental modifications to system files or other projects
- **Safety**: Reduces risk of writing to unintended locations
- **Predictability**: The user knows exactly where files are being created/modified
- **Sanity**: Prevents confusion about which repository or project is being worked on

## What This Means

### ✅ Allowed

- Use absolute paths: `ls /home/erik/Code/killallservers/agentic/src/` instead of `cd` + relative paths
- Work within subdirectories of the starting directory
- All git commands operate on the starting repo (git already operates on the current worktree)
- Use scratchpad for temp files (it's within the project context)
- Reference any file in the project tree via absolute paths

### ❌ Not Allowed

- `cd /tmp`, `cd $HOME`, `cd /etc`, `cd /usr/local/`, or any system directory
- Navigate to sibling projects or unrelated directory trees
- Use `cd` to move outside the project tree (even temporarily)
- Change directory to manage state — use absolute paths instead

## Pattern

**Wrong:**
```bash
cd /tmp
echo "some data" > file.txt  # Wrong location, wrong project
```

**Right:**
```bash
echo "some data" > /tmp/claude-1000/-home-erik-Code-killallservers-agentic/*/scratchpad/file.txt
# Or better: just use scratchpad directly
```

**Wrong:**
```bash
cd src
ls *.ts
cd ../templates
```

**Right:**
```bash
ls /home/erik/Code/killallservers/agentic/src/*.ts
ls /home/erik/Code/killallservers/agentic/templates/
```

## Related Principles

This enforces the "measure twice, cut once" philosophy by keeping all destructive operations scoped to the known project directory. Prevents "oops, I was in the wrong directory" disasters.

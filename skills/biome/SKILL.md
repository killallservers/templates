---
name: biome
description: |
  Fast formatter and linter for TypeScript, JavaScript, and JSX.
  Use this skill whenever you need to configure Biome (biome.jsonc), set up linting/formatting, migrate from ESLint/Prettier, fix code style issues, or optimize TypeScript project tooling. Always include biome commands in package.json scripts so the team has consistent, discoverable commands.
---

# Biome

Biome is a fast, zero-config formatter and linter for JavaScript, TypeScript, JSX, and JSON. This skill teaches setup, configuration patterns, and integration with package.json and tsconfig.json.

## Quick Start

### 1. Install Biome

```bash
bun add -D @biomejs/biome@latest
```

### 2. Create biome.jsonc

Run this to generate a starter config with comments enabled:

```bash
bunx biome init --jsonc
```

### 3. Add Scripts to package.json

**Always add these three standard scripts to package.json.** These are the Biome standard usage patterns:

```json
{
  "scripts": {
    "format": "biome format --write src/",
    "lint": "biome lint --apply src/",
    "check": "biome check src/"
  }
}
```

- `format`: Format code (replaces Prettier)
- `lint`: Check and auto-fix linting issues
- `check`: Validate without writing (for CI/pre-commit)

### 4. Align tsconfig.json

For Bun+TypeScript projects, ensure `types` field includes Biome's target:

```json
{
  "compilerOptions": {
    "types": ["bun", "react"],
    "strict": true
  }
}
```

## biome.jsonc Configuration

Always use `.jsonc` format — it lets you add comments to document your rules and configuration choices.

### Minimal Setup

```jsonc
{
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentSize": 2,
    "lineWidth": 100
  }
}
```

### React + TypeScript

```jsonc
{
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        // Disallow implicit any — catch type errors early
        "noImplicitAnyLet": "error",
        // Warn on console.log in production code
        "noConsoleLog": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentSize": 2,
    "lineWidth": 100,
    "jsxQuoteStyle": "double"
  },
  "javascript": {
    "formatter": {
      "jsxQuoteStyle": "double"
    }
  },
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  }
}
```

### Key Options

- `indentSize`: 2 for compact, 4 for verbose
- `lineWidth`: 80 (strict), 100 (default), 120 (relaxed)
- `organizeImports`: Auto-sort imports alphabetically
- `vcs.useIgnoreFile`: Respect .gitignore

## Common Patterns

### Strict Type Checking

```jsonc
{
  "linter": {
    "rules": {
      "recommended": true,
      "suspicious": {
        // Enforce explicit types — catch implicit any
        "noImplicitAnyLet": "error",
        // No console.log in production code
        "noConsoleLog": "error"
      }
    }
  }
}
```

### Exclude Directories

```jsonc
{
  "linter": {
    // Don't lint dependencies or build outputs
    "ignore": ["node_modules", "dist", ".claude", "build"]
  }
}
```

### Different Rules for Tests

```jsonc
{
  "overrides": [
    {
      // Allow console.log in test files only
      "include": ["**/*.test.ts", "**/*.spec.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noConsoleLog": "off"
          }
        }
      }
    }
  ]
}
```

## Troubleshooting

### "Cannot find module 'biome'"
Install it: `bun add -D @biomejs/biome@latest`

### "Unused variable" warnings on setup code
Use `// biome-ignore lint/correctness/noUnusedVariables: setup code` above the line.

### Conflicts with VS Code formatting
Install the Biome extension and disable Prettier in your workspace settings.

### Import sorting breaking code
Review the imports — Biome sorts alphabetically but respects side-effect imports. If imports must be in a specific order, add `// biome-ignore` comments.

### Want faster linting in CI?
Use `biome check` instead of `biome lint` — it validates without writing, which is faster.

## Integration Checklist

- [ ] biome.jsonc created and committed to git
- [ ] package.json scripts defined (`lint`, `format`, `check`)
- [ ] tsconfig.json aligned with project's types
- [ ] .gitignore respects biome output (usually automatic)
- [ ] CI/CD uses `biome check` for validation
- [ ] Team knows about lint/format scripts
- [ ] VS Code extension installed (optional but recommended)

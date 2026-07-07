---
name: skill-standard-scripts
description: Mandatory package.json scripts for each skill type
metadata: 
  node_type: memory
  type: project
  originSessionId: 5d87dd5f-c77c-4fc3-8913-858ca3437b7e
---

# Standard Scripts by Skill Type

Each skill must ALWAYS enforce these exact scripts in package.json. Skills exist in both `.agentic/skills/<name>/` and `src/init/skills/<name>/` for distribution.

## Biome Skill
- `format`: `biome format --write src/`
- `lint`: `biome lint --apply src/`
- `check`: `biome check src/`
- Config: Use `biome.jsonc` (not `.json`), generated with `bunx biome init --jsonc`
- Project root should have `biome.jsonc` config file

## Bun Skill
- `dev`: `bun run src/index.ts --watch`
- `build`: `bun build ./src/index.ts --outdir ./dist --minify`
- `start`: `bun dist/index.js`
- `test`: `bun test`

## Drizzle Skill
- `db:pull`: `drizzle-kit pull`
- `db:push`: `drizzle-kit push`
- `db:generate`: `drizzle-kit generate`
- `db:migrate`: `drizzle-kit migrate`

**Why:** These are the standard, discoverable commands teams expect. Consistency across projects matters.

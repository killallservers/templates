# Example 2: Drizzle Migration Workflow

## Scenario

Your TypeScript backend uses TypeORM, but the team wants to migrate to Drizzle ORM for better type safety and Bun compatibility. You have ~15 repository files touching the database layer. You want to:

1. **Find** all files that import or use TypeORM
2. **Migrate** each file to Drizzle in parallel (isolated worktrees prevent conflicts)
3. **Verify** each migration passes type checking
4. **Merge** results back into main branch

This example walks through using `migrate-in-parallel` workflow with isolated worktree execution.

## Problem Statement

**Symptoms:**
- TypeORM queries are verbose and hard to type-check
- Bun doesn't bundle TypeORM as easily
- Team wants better developer experience with Drizzle

**Goal:**
- Migrate all database code to Drizzle ORM
- Maintain type safety throughout
- Parallel migrations avoid sequential bottleneck
- Verify each migration with `tsc --noEmit`
- Merge changes back to main without conflicts

## Architecture: Isolated Worktrees

The key advantage of `migrate-in-parallel` is **isolation**:

```
Main branch: src/db/repositories/user.ts (TypeORM)
                            ↓
        Worktree 1         Worktree 2         Worktree 3
        (user.ts)          (post.ts)          (comment.ts)
        Migrate            Migrate            Migrate
        Type-check         Type-check         Type-check
        ✅ OK              ✅ OK              ✅ OK
                            ↓
                    Merge results
                        ↓
        Final: All files migrated, no conflicts
```

No merge conflicts because each file is modified in its own worktree.

## Step 1: Discover Files

First, identify all files that need migration:

```bash
# Find all TypeORM files
grep -r "from 'typeorm'" src/ --include="*.ts" | cut -d: -f1 | sort -u
```

Expected output:
```
src/db/repositories/user.ts
src/db/repositories/post.ts
src/db/repositories/comment.ts
src/db/repositories/follow.ts
src/db/repositories/like.ts
src/db/index.ts (connection setup)
src/db/types.ts (TypeORM types)
...
```

Count: ~15 files

## Step 2: Run Migration Workflow

```bash
/migrate-in-parallel \
  --pattern "src/db/**/*.ts" \
  --task "Migrate from TypeORM to Drizzle ORM, maintain all queries and types"
```

### Workflow Execution

The `migrate-in-parallel` workflow:

1. **Phase 1: Find** — Locate all files matching pattern
   - Result: List of 15 files

2. **Phase 2: Migrate** — For each file in parallel:
   - Create isolated git worktree
   - Agent reads file + Drizzle docs
   - Agent refactors to Drizzle
   - Run `tsc --noEmit` in worktree
   - If type errors: agent fixes them
   - Commit in worktree
   - Return result

3. **Phase 3: Merge** — Merge all worktrees back to main
   - Git-based merges (no conflicts since different files)
   - Report success/failure per file

### Parallel Execution Timeline

```
T=0s   File 1, 2, 3, 4, 5 start migration (parallel)
T=30s  File 1 ✅, File 2 ✅ complete
T=45s  File 3 ✅, File 4 ✅ complete
T=60s  File 5 ✅ complete
T=65s  Merge all 5 worktrees
T=70s  Done

Sequential would take 5 × 60s = 300s
Parallel takes ~70s
Speedup: 4.3×
```

## Detailed Example: Migrate One File

### Before (TypeORM)

```typescript
// src/db/repositories/user.ts
import { Repository } from 'typeorm'
import { User } from '../entities/User'
import { AppDataSource } from '../index'

export class UserRepository {
  private repo: Repository<User>

  constructor() {
    this.repo = AppDataSource.getRepository(User)
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['posts', 'comments']
    })
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } })
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.repo.create(data)
    return this.repo.save(user)
  }

  async updateEmail(id: string, email: string): Promise<void> {
    await this.repo.update({ id }, { email })
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id })
  }
}
```

### After (Drizzle)

```typescript
// src/db/repositories/user.ts
import { eq } from 'drizzle-orm'
import { db } from '../index'
import { users, posts, comments } from '../schema'

export class UserRepository {
  async findById(id: string) {
    return db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        posts: true,
        comments: true
      }
    })
  }

  async findByEmail(email: string) {
    return db.query.users.findFirst({
      where: eq(users.email, email)
    })
  }

  async create(data: typeof users.$inferInsert) {
    const [user] = await db.insert(users).values(data).returning()
    return user
  }

  async updateEmail(id: string, email: string) {
    await db.update(users)
      .set({ email, updatedAt: new Date() })
      .where(eq(users.id, id))
  }

  async delete(id: string) {
    await db.delete(users).where(eq(users.id, id))
  }
}
```

**Changes:**
- Removed repository class pattern (Drizzle doesn't need it)
- Changed to direct db queries
- Better type inference (`typeof users.$inferInsert` for create input)
- Cleaner syntax (no `.repo.`, no configuration)

## Step 3: Verify Type Safety

After migration, run type checking:

```bash
# In each worktree (done automatically by workflow)
tsc --noEmit

# Or check the whole project
bun run typecheck
```

Expected output if all migrations successful:
```
✅ No errors found
```

If type errors exist:
```
src/db/repositories/user.ts:45:10 - error TS2345: 
  Argument of type 'string | undefined' is not assignable to parameter of type 'string'
```

The migration agent should fix these, but if not, you can manually fix in the worktree branch.

## Step 4: Verify Query Correctness

Beyond type checking, verify queries still work:

```bash
# Run tests (if you have them)
bun test

# Or manually test the queries
```

The workflow doesn't run this automatically, but you should do it before merging.

## Step 5: Merge Results

Once all worktrees pass verification:

```bash
git log --oneline | head -20
# Shows commits from migrations:
# abc1234 Migrate src/db/repositories/user.ts to Drizzle
# def5678 Migrate src/db/repositories/post.ts to Drizzle
# ...
```

All files are now Drizzle-based!

## Handling Edge Cases

### Edge Case 1: Complex Queries

Some TypeORM queries are hard to translate to Drizzle:

**TypeORM (complex join):**
```typescript
await repo
  .createQueryBuilder('user')
  .leftJoinAndSelect('user.posts', 'post')
  .where('post.createdAt > :date', { date: sevenDaysAgo })
  .orderBy('user.createdAt', 'DESC')
  .getMany()
```

**Drizzle equivalent:**
```typescript
db.select()
  .from(users)
  .leftJoin(posts, eq(users.id, posts.userId))
  .where(gt(posts.createdAt, sevenDaysAgo))
  .orderBy(desc(users.createdAt))
```

The agent should handle this, but if it fails, you might need to:
1. Break into simpler queries
2. Use raw SQL if needed: `db.execute(sql\`...\`)`
3. Manually refactor in the worktree

### Edge Case 2: Custom Decorators

If you have TypeORM decorators (e.g., `@BeforeUpdate`), you'll need to:
- Remove the decorators
- Move logic to explicit hooks or service layer
- This is a behavior change, not just syntax

Agent might flag this and require manual review.

### Edge Case 3: Circular Relations

TypeORM handles circular relations with `lazy: true`. Drizzle handles it differently:

**TypeORM:**
```typescript
@OneToMany(() => Post, post => post.author, { lazy: true })
posts: Promise<Post[]>
```

**Drizzle:**
```typescript
// No lazy loading built-in, query explicitly:
const user = await db.query.users.findFirst(...)
const posts = await db.query.posts.findMany(...)
```

Agent should handle this but might need guidance if queries are interdependent.

## Cost Breakdown

| Phase | Files | Agents per File | Total Agents | Tokens | Time |
|-------|-------|-----------------|--------------|--------|------|
| Find | - | - | 1 | ~5k | 10s |
| Migrate | 15 | 1 | 15 | ~50k | 60s (parallel) |
| Type-check | 15 | 1 | 15 | ~30k | 30s (parallel) |
| Merge | - | - | 0 | 0 | 5s |
| **Total** | 15 | - | 31 | 85k | ~90s |

Much cheaper than sequential (5 mins) due to parallelization.

## Common Mistakes

### Mistake 1: Migrating Without Schema
**Wrong:**
```bash
/migrate-in-parallel --pattern "src/**/*.ts" --task "Migrate to Drizzle"
```

The agent doesn't know your Drizzle schema! It can't generate correct queries.

**Right:**
```bash
# First, create Drizzle schema
# src/db/schema.ts - define all tables

# Then run migration with schema reference:
/migrate-in-parallel \
  --pattern "src/db/repositories/**/*.ts" \
  --task "Migrate to Drizzle ORM using schema in src/db/schema.ts"
```

### Mistake 2: Mixing TypeORM and Drizzle
**Wrong:**
```typescript
// This file uses both TypeORM and Drizzle
import { AppDataSource } from './db/typeorm'
import { db } from './db/drizzle'

export async function getUser(id: string) {
  const user = await typeormRepo.findOne(id)
  const posts = await db.query.posts.findMany()
  // Mixed! Types don't align, queries might conflict
}
```

**Right:**
Complete the migration entirely. Don't mix ORMs in the same project (or at least not in the same file).

### Mistake 3: Ignoring Type Errors in Worktrees
**Wrong:**
```
Worktree 1: tsc found 3 errors (ignored)
Worktree 2: tsc found 0 errors
Worktree 3: tsc found 5 errors (ignored)

[Merge everything anyway]

Main branch: Now has 8 type errors
```

**Right:**
The workflow should fail or flag the errors. Don't merge worktrees with type errors.

## Verification Checklist

- [ ] All TypeORM imports removed from migrated files
- [ ] All queries use Drizzle syntax (db.query, db.select, etc)
- [ ] tsc --noEmit passes for all files
- [ ] Test suite passes (if you have tests)
- [ ] Manual smoke test of key queries (find, create, update, delete)
- [ ] Relations/joins work correctly
- [ ] Error handling is still in place
- [ ] No TypeORM instances remain in codebase

## Related Patterns

- **Workflow:** `migrate-in-parallel` — Multi-file parallel migration with worktree isolation
- **Pattern:** [[Phase-Based Orchestration]] — How phases are structured
- **Composition:** Can follow with `audit-codebase` to find any missed TypeORM references

## See Also

- `.agentic/skills/drizzle/SKILL.md` — Drizzle patterns and edge cases
- `.agentic/WORKFLOW_SELECTION.md` — When to use migrate-in-parallel
- `.agentic/rules/failure-scenarios.md` — What can go wrong during migrations
- `.agentic/rules/workflow-composition.md` — How to chain migrations with audits

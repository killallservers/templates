# Anti-Patterns Guide

An **anti-pattern** is an approach that seems right but reliably causes problems.

## Bun Anti-Patterns

### ❌ Docker without lock file caching

**Problem:** Every build reinstalls dependencies

```dockerfile
# Bad
RUN bun install
COPY src ./src
```

```dockerfile
# Good: lock file cached in layer
COPY bun.lock package.json ./
RUN bun install --frozen-lockfile
COPY src ./src
```

**Why it matters:** Rebuilds take 5 min instead of 10 sec

### ❌ Mixing package managers

**Problem:** `bun add` then `npm install` overwrites bun.lock

```bash
bun add react
npm install  # Wrong!
```

**Why it matters:** Dependencies become inconsistent; different machines have different versions

### ❌ Relying on undocumented Bun APIs

**Problem:** `Bun.unsafe` features disappear in updates

```typescript
// Bad
const result = Bun.unsafe.something()

// Good
const data = await Bun.file('path').json()
```

**Why it matters:** Code breaks on Bun updates; no migration path

---

## Drizzle Anti-Patterns

### ❌ Mixing Drizzle and raw SQL migrations

**Problem:** Drizzle doesn't know about manual SQL changes

```bash
# Bad: Drizzle migration + manual SQL
bun drizzle-kit migrate
psql -c "ALTER TABLE ..."  # Drizzle out of sync now
```

**Why it matters:** Schema version tracking breaks; deployments become unreproducible

### ❌ Circular foreign keys

**Problem:** A→B and B→A creates impossible constraints

```typescript
// Bad
export const users = pgTable('users', {
  groupId: integer('group_id').references(() => groups.id),
})

export const groups = pgTable('groups', {
  ownerId: integer('owner_id').references(() => users.id),  // Circular!
})
```

**Why it matters:** Can't insert first record; migrations fail

### ❌ N+1 queries with lazy loading

**Problem:** Loading relations one-by-one instead of eagerly

```typescript
// Bad: N+1
const users = await db.select().from(users)
users.forEach(user => {
  const posts = await db.select().from(posts).where(...)  // Per user!
})

// Good: eager load
const users = await db.query.users.findMany({
  with: { posts: true }
})
```

**Why it matters:** 100 users = 101 queries instead of 1; 100x slower

---

## Hono Anti-Patterns

### ❌ Business logic in middleware

**Problem:** Route logic spread across middleware, hard to trace

```typescript
// Bad: auth AND business logic in middleware
app.use(async (c, next) => {
  const user = await findUser()
  if (user.isPremium) {
    // Do something special (business logic!)
  }
  await next()
})

// Good: auth in middleware, business logic in route
app.use(requireAuth)
app.get('/premium', async (c) => {
  const user = c.get('user')
  if (!user.isPremium) return c.text('', 403)
  // Business logic here
})
```

**Why it matters:** Hard to test; logic becomes implicit; routes become magic

### ❌ Global middleware for streaming routes

**Problem:** Body parser consumes stream before route handler

```typescript
// Bad: global body parser + streaming
app.use(bodyParser())
app.post('/upload', streamHandler)  // Stream already consumed
```

**Why it matters:** Streaming routes fail silently; files never upload

### ❌ Forgetting CORS + auth interaction

**Problem:** CORS blocks auth headers

```typescript
// Bad
app.use(cors({ origin: '*' }))  // Allows all, but...
app.use(requireAuth)  // Preflight request fails

// Good
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS,
  credentials: true,
  allowHeaders: ['Authorization'],
}))
app.use(requireAuth)
```

**Why it matters:** Frontend requests fail with cryptic CORS errors

---

## BetterAuth Anti-Patterns

### ❌ Storing tokens in localStorage

**Problem:** XSS attack steals tokens

```typescript
// Bad: XSS can steal
localStorage.setItem('token', sessionToken)

// Good: httpOnly cookies (can't be stolen via JS)
// BetterAuth uses this by default
```

**Why it matters:** One XSS vulnerability = full account takeover for all users

### ❌ Skipping CSRF validation

**Problem:** Cross-site requests forge state changes

```typescript
// Bad: no CSRF check
app.post('/logout', async (c) => {
  await betterAuth.logout(sessionId)
})

// Good: validate CSRF token
app.post('/logout', validateCSRF, async (c) => {
  await betterAuth.logout(sessionId)
})
```

**Why it matters:** Attacker can log you out from another site; worse, change your password

### ❌ Hardcoding OAuth secrets

**Problem:** Secrets leaked in source code

```typescript
// Bad: EXPOSED!
const auth = betterAuth({
  google: {
    clientSecret: 'super-secret-key',
  }
})

// Good: env vars
const auth = betterAuth({
  google: {
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }
})
```

**Why it matters:** Attacker can impersonate your app to Google; access all user accounts

---

## Biome Anti-Patterns

### ❌ Mixing Biome and ESLint

**Problem:** Both tools fight over formatting, inconsistent results

```json
// Bad: redundant tools
{
  "extends": ["eslint:recommended"],
  "plugins": ["biome"]
}
```

**Why it matters:** Format changes flip-flop; CI fails randomly; team wastes time

### ❌ Ignoring Biome failures in CI

**Problem:** Code with linting errors gets merged

```bash
# Bad: CI allows failures
biome check || true
git push
```

**Why it matters:** Tech debt accumulates; codebase becomes unmaintainable

---

## Workflow & Orchestration Anti-Patterns

### ❌ Running all agents in parallel without dedup

**Problem:** Duplicate findings reported multiple times

```javascript
// Bad: A and B audit same files, report same issues twice
const [auditSecurity, auditPerf] = await parallel([
  () => workflow('audit-codebase', { issue: 'security' }),
  () => workflow('audit-codebase', { issue: 'performance' }),
])

const findings = [
  ...auditSecurity.findings,
  ...auditPerf.findings,  // Duplicates not filtered!
]
```

**Why it matters:** Same issue reported 5 times = confusing report; wasted verification

### ❌ Using adversarial verify for all findings

**Problem:** Too expensive for low-stakes findings

```javascript
// Bad: 3 verifiers per finding * 100 findings = 300 agents = 500k tokens
const verified = await parallel(
  allFindings.map(f => () => adversarialVerify(f))  // All findings!
)

// Good: verify only critical/high severity
const toVerify = allFindings.filter(f => f.severity === 'critical')
const verified = await parallel(
  toVerify.map(f => () => adversarialVerify(f))
)
```

**Why it matters:** 500k tokens vs 100k tokens; budget exhaustion; slow feedback

### ❌ Nesting workflows 3+ levels deep

**Problem:** Hard to debug; cost explodes; hard to trace failures

```javascript
// Bad: deeply nested
await workflow('a', {
  nested: () => workflow('b', {
    nested: () => workflow('c', {
      nested: () => workflow('d')
    })
  })
})
```

**Why it matters:** 1 failure could be from any of 4 workflows; token cost unpredictable

### ❌ Ignoring budget limits

**Problem:** Token sprawl; workflows run forever or hit limits unexpectedly

```javascript
// Bad: no budget checks
const findings = []
for (let i = 0; i < 100; i++) {
  const result = await agent(`Find issues round ${i}`)
  findings.push(...result)
}
// Might use 5M tokens!

// Good: check budget
while (budget.remaining() > 50_000) {
  const result = await agent(`Find issues`)
  findings.push(...result)
}
// Stops when budget is low
```

**Why it matters:** Unexpected costs; workflows get killed mid-execution

### ❌ Not handling file discovery failures

**Problem:** Workflow assumes files exist; fails silently

```javascript
// Bad: no error handling
const files = await agent('Find files matching pattern')

// Good: check and handle
const files = await agent('Find files matching pattern')
if (!files?.files?.length) {
  log('No files found. Exiting.')
  return { findings: [] }
}
```

**Why it matters:** Workflow returns empty results with no explanation

---

## Memory Anti-Patterns

### ❌ Memory files too large

**Problem:** Memory bloats with unnecessary data; context becomes too big

```javascript
// Bad: save everything
memory.save('audit-round-1', {
  allFiles: [...1000 files with full content...],
  logs: [...10k lines of debug output...],
  intermediateResults: {...},
})

// Good: save only what's needed
memory.save('audit-round-1', {
  findings: [{ file, issue, severity }],
  summary: '8 critical issues found',
  timestamp: '2025-03-15T...',
})
```

**Why it matters:** Memory becomes too large; context window fills up; cost explodes

### ❌ Assuming memory exists

**Problem:** Second phase fails if first phase didn't run

```javascript
// Bad: crashes if memory doesn't exist
const phase1 = JSON.parse(memory.read('phase1-findings'))

// Good: handle missing memory
const phase1 = memory.read('phase1-findings') || { findings: [] }
if (!phase1.findings?.length) {
  log('Phase 1 didn't find anything, or didn't run. Running it now.')
  phase1 = await runPhase1()
}
```

**Why it matters:** Workflow fails confusingly; user doesn't know how to recover

---

## Summary Table

| Anti-Pattern | Cost | Symptom | Fix |
|--|--|--|--|
| Docker layer without lock caching | 5 min rebuilds | Every deploy takes forever | Cache bun.lock |
| Mixing package managers | Inconsistent deps | Works locally, fails in CI | Pick one manager |
| Circular foreign keys | Migration fails | Can't insert data | Remove one direction |
| N+1 queries | 100x slower | Queries from hell | Eager load with `with:` |
| Streaming + body parser | Upload fails | Files never arrive | Skip parser for streaming |
| CORS + auth conflict | Auth requests fail | Preflight fails | Config CORS correctly |
| Tokens in localStorage | Account stolen | One XSS = hacked | Use httpOnly cookies |
| Hardcoded secrets | Leaked in repo | Attacker impersonates app | Use env vars |
| Biome + ESLint | Flip-flop errors | CI randomly fails | Pick one |
| Duplicate findings | Confusing report | Same issue reported 5x | Dedup findings |
| Over-verification | Budget exhaustion | 500k tokens wasted | Verify only critical |
| Deep nesting | Debugging impossible | Which level failed? | Max 2 levels |
| Ignoring budget | Cost explosion | Workflow killed mid-run | Check budget.remaining() |
| Large memory files | Context bloat | Token explosion | Keep memory lean |

---

## How to Recognize Anti-Patterns

**Red flags:**
- "This works, but it's fragile/slow/confusing"
- "We have to remember to do X after Y"
- "This broke when we changed Z"
- "I don't understand why this fails"
- "This is the third time we've fixed this"

When you see these, you're probably in an anti-pattern.

---

## See Also

- Individual skill docs: `bun/`, `drizzle/`, `hono/`, `betterauth/`, `biome/` SKILL.md files
- [Failure Scenarios](./failure-scenarios.md) — What goes wrong and how to recover
- [Workflow Composition](./workflow-composition.md) — Safe ways to combine workflows

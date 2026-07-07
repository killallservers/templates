# Workflow Composition Guide

**Composition** = Combining multiple workflows together to solve larger problems.

## When to Compose

✅ **Compose workflows when:**
- One workflow output feeds into another (audit → fix → audit)
- You need multiple perspectives on a problem (research + judge panel)
- Problem naturally breaks into phases
- Each workflow solves one part of a larger goal

❌ **Don't compose when:**
- One workflow does the whole job
- Composition adds complexity without clear benefit
- Nesting becomes 3+ levels deep (too hard to debug)

---

## Pattern 1: Sequential Composition (Output → Input)

**Idea:** Run workflow A, use its output as input to workflow B.

**Example: Audit → Fix → Audit**

```
Step 1: audit-codebase
  ↓ finds issues
Step 2: Manual/agent-assisted fix
  ↓ applies changes
Step 3: audit-codebase again
  ↓ verifies fixes
```

**In Claude Code:**
```javascript
// Phase 1: Audit
const auditResults = await workflow('audit-codebase', {
  pattern: 'src/routes/**/*.ts',
  issue: 'missing authentication checks'
})

log(`Found ${auditResults.findings.length} issues`)

// Phase 2: Fix (manual or agent)
// Developer manually fixes or agent assists

// Phase 3: Verify
const verifyResults = await workflow('audit-codebase', {
  pattern: 'src/routes/**/*.ts',
  issue: 'missing authentication checks'
})

const allFixed = verifyResults.findings.length === 0
log(allFixed ? '✅ All fixed!' : `⚠️ ${verifyResults.findings.length} remaining`)
```

**Cost:**
- Audit 1: 100-150k tokens
- Fix: 0-50k tokens (depending on approach)
- Audit 2: 100-150k tokens
- **Total:** 200-350k tokens

**Best for:** Iterative problem-solving (find → fix → verify loop)

---

## Pattern 2: Parallel Composition (Multiple Workflows)

**Idea:** Run 2+ workflows in parallel on the same codebase, then merge results.

**Example: Security Audit + Performance Audit**

```
workflow A: audit-codebase (security issues)
           ↓
           Merge & dedup
           ↓
workflow B: audit-codebase (performance issues)
           
Results: Combined list of security + performance issues
```

**In Claude Code:**
```javascript
const [securityFindings, performanceFindings] = await parallel([
  () => workflow('audit-codebase', {
    pattern: 'src/**/*.ts',
    issue: 'security vulnerabilities (SQL injection, XSS, auth)'
  }),
  () => workflow('audit-codebase', {
    pattern: 'src/**/*.ts',
    issue: 'performance issues (n+1 queries, leaks, inefficient loops)'
  })
])

// Merge results, avoiding duplicates
const allFindings = [
  ...securityFindings.findings.map(f => ({ ...f, category: 'security' })),
  ...performanceFindings.findings
    .filter(f => !securityFindings.findings.find(sf => sf.file === f.file && sf.line === f.line))
    .map(f => ({ ...f, category: 'performance' }))
]

log(`Found ${allFindings.length} total issues (${securityFindings.findings.length} security, ${performanceFindings.findings.length} performance)`)

return { findings: allFindings }
```

**Cost:**
- Audit 1: 100-150k tokens
- Audit 2: 100-150k tokens (parallel, overlaps with audit 1)
- **Total:** 100-150k tokens (faster than sequential)

**Wall-clock:** ~2-3 minutes (parallel) vs 4-6 minutes (sequential)

**Best for:** Multi-dimensional audits (security + performance, code quality + type safety)

---

## Pattern 3: Nested Composition (Workflow Inside Agent)

**Idea:** Run a workflow inside an agent decision.

**Example: Judge Panel That References Research**

```
Step 1: research-question
  "How do AWS, GCP, Azure handle rate limiting?"
  ↓ gather research
Step 2: agent processes research
  ↓ summarizes findings
Step 3: judge-panel
  "Should we use AWS rate limiting?"
  (Has research context from Step 1)
```

**In Claude Code:**
```javascript
// Step 1: Research
const research = await workflow('research-question', {
  question: 'How do AWS, GCP, Azure handle rate limiting?'
})

log(`Research found ${research.sources.length} sources`)

// Step 2: Inform decision
const decision = await workflow('judge-panel', {
  decision: 'Which rate limiting approach should we use?',
  context: `Based on this research:\n${research.summary}`
})

log(`Decision: ${decision.recommendation}`)
```

**Cost:**
- Research: 150-250k tokens
- Judge panel: 50-80k tokens
- **Total:** 200-330k tokens

**Best for:** Making informed decisions (research → judgment)

---

## Pattern 4: Loop + Composition (Iteration)

**Idea:** Repeatedly run workflow + fix cycle until converged.

**Example: Iterative Bug Fixing**

```
Round 1: loop-until-converged (find bugs)
Round 2: agent fixes bugs
Round 3: loop-until-converged (re-find, verify fixed)
Round 4: if new bugs, repeat

Until: No new bugs found (convergence)
```

**In Claude Code:**
```javascript
const fixed = new Set()
let round = 0
let dryRounds = 0

while (dryRounds < 2 && round < 5) {
  round++
  
  // Find bugs
  const discovery = await workflow('loop-until-converged', {
    task: 'Run tests and find flaky tests',
    rounds: 3,
    dryRounds: 1
  })
  
  const newBugs = discovery.bugs.filter(b => !fixed.has(b.name))
  
  if (newBugs.length === 0) {
    dryRounds++
    log(`Round ${round}: No new bugs (dry round ${dryRounds})`)
    continue
  }
  
  dryRounds = 0
  newBugs.forEach(b => fixed.add(b.name))
  
  // Fix bugs (manual or agent)
  log(`Round ${round}: Fixing ${newBugs.length} new bugs...`)
  // Agent or manual fixes applied
  
  log(`Fixed ${fixed.size} total bugs so far`)
}

log(`Converged after ${round} rounds with ${fixed.size} bugs fixed`)
```

**Cost:**
- Per round: ~100-150k tokens (loop-until-converged)
- Fixing: ~0-50k (depending on approach)
- **Total:** 300-1000k (scales with rounds)

**Best for:** Comprehensive bug discovery and remediation

---

## Composition Matrix

Which workflows can be safely stacked?

| A | B | Safe | Notes |
|---|---|------|-------|
| audit-codebase | audit-codebase | ✅ Yes | Different issues (security + perf) |
| audit-codebase | migrate-in-parallel | ✅ Yes | Find issues, then fix them |
| audit-codebase | loop-until-converged | ⚠️ Maybe | If looking for different thing |
| audit-codebase | research-question | ✅ Yes | Research informs audit priority |
| audit-codebase | judge-panel | ✅ Yes | Audit findings inform decision |
| migrate-in-parallel | audit-codebase | ✅ Yes | Migrate, then verify |
| migrate-in-parallel | migrate-in-parallel | ❌ No | Worktree conflicts, don't parallelize |
| migrate-in-parallel | judge-panel | ✅ Yes | Judge whether migration succeeded |
| loop-until-converged | migrate-in-parallel | ⚠️ Complex | Find issues iteratively, fix in parallel (requires careful coordination) |
| research-question | judge-panel | ✅ Yes | Research informs judgment |
| research-question | audit-codebase | ✅ Yes | Research informs audit (what to look for) |
| judge-panel | anything | ✅ Yes | Decisions don't mutate code |

**Key:**
- ✅ **Safe:** Workflows don't conflict, parallel OK
- ⚠️ **Maybe:** Can work with care (dedup, unique names, sequencing)
- ❌ **No:** Avoid (conflicts, races, resource contention)

---

## Common Pitfalls

### Pitfall 1: Dedup Across Compositions

**Wrong:**
```javascript
const audit1 = await workflow('audit-codebase', { issue: 'security' })
const audit2 = await workflow('audit-codebase', { issue: 'performance' })

// Bug: Same file in both lists
// audit1.findings: [{ file: 'routes.ts', issue: 'no auth' }]
// audit2.findings: [{ file: 'routes.ts', issue: 'slow query' }]
// Merged: 2 separate findings for same file
```

**Right:**
```javascript
const [audit1, audit2] = await parallel([
  () => workflow(...),
  () => workflow(...)
])

// Dedup by (file, line) not just (file)
const deduped = [
  ...audit1.findings,
  ...audit2.findings.filter(f2 => 
    !audit1.findings.find(f1 => 
      f1.file === f2.file && f1.line === f2.line
    )
  )
]
```

### Pitfall 2: Worktree Conflicts in migrate-in-parallel

**Wrong:**
```javascript
const migration1 = await workflow('migrate-in-parallel', ...)
const migration2 = await workflow('migrate-in-parallel', ...)  // Same worktree!
// Error: Worktree already locked
```

**Right:**
```javascript
// Run sequentially, or use unique names
const migration1 = await workflow('migrate-in-parallel', {
  ...args,
  worktreePrefix: 'migration-1'
})
const migration2 = await workflow('migrate-in-parallel', {
  ...args,
  worktreePrefix: 'migration-2'
})
```

### Pitfall 3: Budget Exhaustion in Long Compositions

**Wrong:**
```javascript
const research = await workflow('research-question', ...)     // Uses 200k tokens
const judge = await workflow('judge-panel', ...)            // Uses 50k tokens
const audit = await workflow('audit-codebase', ...)         // Uses 100k tokens
// Total: 350k tokens - might exceed user's budget!
```

**Right:**
```javascript
// Check budget before each workflow
if (budget.remaining() < 150_000) {
  log(`Insufficient budget. ${Math.round(budget.remaining()/1000)}k remaining.`)
  return { partial: true }
}

const research = await workflow(...)
log(`Remaining: ${Math.round(budget.remaining()/1000)}k`)
```

### Pitfall 4: Memory State Lost Between Workflows

**Wrong:**
```javascript
const phase1 = await workflow('audit-codebase')
// Memory is lost when exiting workflow!

const phase2 = await workflow('migrate-in-parallel')
// phase2 has no access to phase1 findings
```

**Right:**
```javascript
// Use explicit memory or return value passing
const phase1Results = await workflow('audit-codebase')

const phase2Results = await workflow('migrate-in-parallel', {
  ...args,
  auditFindings: phase1Results.findings  // Pass explicitly
})
```

Or use memory:
```javascript
const phase1 = await workflow('audit-codebase')
// Workflow saves findings to memory automatically (if enabled)

const phase2 = await workflow('migrate-in-parallel')
// phase2 can read phase1 findings from memory
```

---

## Composition Examples

### Example 1: Full Audit + Fix Cycle

```javascript
// Week 1: Audit everything
const initialAudit = await workflow('audit-codebase', {
  pattern: 'src/**/*.ts',
  issue: 'security vulnerabilities'
})

log(`Phase 1: Found ${initialAudit.findings.length} security issues`)

// Week 2: Fix (team manually refactors)
// (Refactoring happens outside workflow)

// Week 3: Verify fixes
const finalAudit = await workflow('audit-codebase', {
  pattern: 'src/**/*.ts',
  issue: 'security vulnerabilities'
})

const fixedCount = initialAudit.findings.length - finalAudit.findings.length
log(`Phase 3: Fixed ${fixedCount} issues`)
```

### Example 2: Research-Informed Decision

```javascript
// Step 1: Understand the landscape
const research = await workflow('research-question', {
  question: 'How do leading companies handle real-time notifications?'
})

// Step 2: Decide based on research
const decision = await workflow('judge-panel', {
  decision: 'Should we implement WebSockets or use Server-Sent Events?',
  context: research.summary
})

log(`Decision: ${decision.recommendation}`)
log(`Rationale: ${decision.reasoning}`)
```

### Example 3: Multi-Dimensional Audit

```javascript
// Audit for multiple concerns in parallel
const [security, performance, style] = await parallel([
  () => workflow('audit-codebase', {
    issue: 'security vulnerabilities'
  }),
  () => workflow('audit-codebase', {
    issue: 'performance anti-patterns (n+1 queries, memory leaks)'
  }),
  () => workflow('audit-codebase', {
    issue: 'code style violations (linting, naming)'
  })
])

// Merge with categories
const allIssues = [
  ...security.findings.map(f => ({ ...f, category: 'security' })),
  ...performance.findings.map(f => ({ ...f, category: 'performance' })),
  ...style.findings.map(f => ({ ...f, category: 'style' }))
]

log(`Total issues: ${allIssues.length}`)
allIssues.forEach(issue => {
  log(`  ${issue.category}: ${issue.file}:${issue.line}`)
})
```

---

## Debugging Composed Workflows

**Add logging at boundaries:**
```javascript
log(`Before workflow A: ${json(state)}`)
const resultA = await workflow('a', ...)
log(`After workflow A: ${json(resultA)}`)

log(`Before workflow B: ${json(state)}`)
const resultB = await workflow('b', resultA)
log(`After workflow B: ${json(resultB)}`)
```

**Check memory between phases:**
```bash
cat ~/.agentic/memory/audit-findings.md
# Is this what you expect?
```

**Verify costs:**
```
Before: budget = 500k tokens
After workflow 1: budget = 350k tokens remaining
After workflow 2: budget = 250k tokens remaining
# On track?
```

---

## See Also

- [Failure Scenarios](.agentic/rules/failure-scenarios.md) — What can go wrong in compositions
- [Memory Flow Patterns](.agentic/rules/memory-flow-patterns.md) — Passing context between phases
- [Cost-Aware Scaling](.agentic/rules/patterns/cost-aware.md) — Budget management
- Examples: [01-security-audit](.agentic/examples/01-security-audit-workflow.md), [02-drizzle-migration](.agentic/examples/02-drizzle-migration-workflow.md)

# Memory Flow Patterns

## What is Persistent Memory?

Claude Code has a built-in **memory system** that persists context across multiple agent calls and workflow phases. This allows:

- **Phase 1 agent** finds issues and saves them to memory
- **Phase 2 agent** reads Phase 1 findings and acts on them
- **Phase 3 agent** compares Phase 1 and Phase 2 results

Without memory, Phase 2 and Phase 3 would have no knowledge of what Phase 1 discovered.

## When to Use Memory

✅ **Use memory when:**
- Running multi-phase workflows (audit → fix → verify)
- Passing findings between workflow rounds
- Building up context across iterations
- Tracking what's been discovered to avoid re-checking

❌ **Skip memory when:**
- Single-phase, one-shot workflows
- Each phase is independent
- Information isn't needed across phases
- Memory would make things slower (overhead)

## Configuration

### Enable Memory

Update `.claude/settings.local.json`:

```json
{
  "autoMemoryDirectory": "~/.agentic/memory"
}
```

This tells Claude Code to persist memory files to `~/.agentic/memory/`.

### Verify Memory is Working

After running a workflow with memory enabled, check:

```bash
ls -la ~/.agentic/memory/
# Should show files created recently:
# -rw-r--r-- 1 user staff 1024 Mar 15 10:30 audit-findings-auth.md
# -rw-r--r-- 1 user staff 512 Mar 15 10:35 phase-1-summary.md
```

If no files appear, memory may not be configured correctly.

---

## Pattern 1: Security Audit (3-Phase)

### Use Case
Audit codebase for issues → Fix them → Verify fixes

### Memory Configuration
```
Phase 1 Memory: audit-findings.md
  - File paths with issues
  - Issue descriptions
  - Severity levels
  
Phase 2 Memory: fixes-applied.md
  - Which issues were fixed
  - Which remain unfixed
  - Changes made
  
Phase 3 Memory: verification-results.md
  - Re-audit findings
  - Comparison with Phase 1
  - Verification status
```

### Phase 1: Audit (Find Issues)

**Workflow:** `audit-codebase`

**Agent logic:**
```javascript
export const meta = {
  name: 'security-audit-phase-1',
  description: 'Find security issues',
  phases: [{ title: 'Audit' }],
}

const findings = await agent(
  'Audit routes for missing auth checks. Return JSON: { "findings": [...] }'
)

// Save to memory so Phase 2 can read them
// This happens automatically if memory is enabled
// But you can be explicit:

log(`Found ${findings.length} issues`)
findings.forEach(f => {
  console.log(`${f.file}:${f.line} - ${f.issue}`)
})

return { findings, timestamp: new Date().toISOString() }
```

**Memory after Phase 1:**
```markdown
# Security Audit Results (Phase 1)

**Timestamp:** 2025-03-15T10:30:00Z  
**Total Findings:** 8

## Critical Issues
- src/routes/user.ts:45 - DELETE endpoint missing auth
- src/routes/billing.ts:82 - Payment method update missing ownership check

## High Issues
- src/routes/post.ts:120 - POST/PUT operations inconsistent auth
- ... (6 more)
```

### Phase 2: Fix (Act on Findings)

**Manual step or agent-assisted**

Agent reads memory from Phase 1:

```javascript
const phase1Findings = readMemory('audit-findings')
// Or automatically passed via workflow context

const agent2Result = await agent(
  `Fix these issues from Phase 1 audit:\n\n${phase1Findings}\n\n
  Refactor each one with proper auth checks.`
)

log(`Fixes applied:\n${agent2Result.fixes}`)

// Save what was fixed
return { 
  fixed_issues: agent2Result.issues_fixed,
  remaining_issues: agent2Result.issues_unfixed
}
```

**Memory after Phase 2:**
```markdown
# Security Audit - Fixes Applied (Phase 2)

**Timestamp:** 2025-03-15T11:00:00Z  
**Based on:** Phase 1 findings (8 issues)

## Fixed (7)
- src/routes/user.ts:45 - Added requireAuth middleware
- src/routes/billing.ts:82 - Added ownership check
- ... (5 more)

## Unfixed/Not Applicable (1)
- src/routes/admin.ts:200 - Requires schema change (separate task)
```

### Phase 3: Verify (Confirm Fixes)

**Workflow:** Re-run `audit-codebase`

Agent compares Phase 1 and Phase 3:

```javascript
const phase1 = readMemory('audit-findings-phase1')
const phase3Results = await agent(
  'Re-audit for the same issues. Return JSON: { "findings": [...] }'
)

const comparison = {
  original: phase1.findings.length,
  now: phase3Results.findings.length,
  fixed: phase1.findings.length - phase3Results.findings.length,
  status: phase3Results.findings.length === 0 ? 'VERIFIED' : 'PARTIAL'
}

log(`Verification: ${comparison.fixed}/${comparison.original} issues fixed`)
return comparison
```

**Memory after Phase 3:**
```markdown
# Security Audit - Verification Results (Phase 3)

**Timestamp:** 2025-03-15T11:30:00Z

## Verification Summary
- Phase 1 findings: 8 issues
- Phase 3 re-audit: 1 issue remaining
- Status: PARTIAL (7/8 fixed)

## Remaining Issues
- src/routes/admin.ts:200 - Unfixed (out of scope for this phase)

## Conclusion
Security audit complete. One issue deferred to next phase.
```

---

## Pattern 2: Research Question (3-Phase)

### Use Case
Search for information → Fetch and validate sources → Synthesize report

### Memory Configuration
```
Phase 1 Memory: search-results.md
  - URLs found
  - Claims extracted
  
Phase 2 Memory: verified-sources.md
  - Source content
  - Validation status
  
Phase 3 Memory: synthesis-report.md
  - Final report with citations
  - Cross-source consensus
```

### Phase 1: Search (Find Sources)

**Workflow:** `research-question`

```javascript
const query = 'How do AWS, GCP, Azure handle rate limiting?'

const searches = await parallel([
  () => agent(`Search for rate limiting in AWS`),
  () => agent(`Search for rate limiting in GCP`),
  () => agent(`Search for rate limiting in Azure`)
])

const allResults = searches.flatMap(s => s.results)
const uniqueUrls = [...new Set(allResults.map(r => r.url))]

log(`Found ${uniqueUrls.length} unique sources`)
return { sources: uniqueUrls, search_time: Date.now() }
```

**Memory after Phase 1:**
```markdown
# Research: Rate Limiting Across Cloud Providers

**Query:** How do AWS, GCP, Azure handle rate limiting?  
**Timestamp:** 2025-03-15T10:30:00Z

## Sources Found (12)
- https://docs.aws.amazon.com/apigateway/rate-limiting/
- https://cloud.google.com/docs/rate-limiting
- https://learn.microsoft.com/en-us/azure/rate-limiting
- ... (9 more URLs)
```

### Phase 2: Fetch & Validate (Read Sources)

```javascript
const phase1Sources = readMemory('search-results-phase1')

const fetched = await parallel(
  phase1Sources.map(url => () =>
    agent(`Fetch and summarize: ${url}`)
  )
)

const validated = await parallel(
  fetched.map((content, i) => () =>
    agent(
      `Validate claims in this source against other sources:\n${content}`
    )
  )
)

log(`Validated ${fetched.length} sources`)
return { fetched_content: fetched, validation: validated }
```

**Memory after Phase 2:**
```markdown
# Research Phase 2: Source Validation

**Timestamp:** 2025-03-15T10:50:00Z

## AWS Rate Limiting
**Source:** https://docs.aws.amazon.com/apigateway/rate-limiting/  
**Content Summary:** API Gateway supports token bucket algorithm, configurable per endpoint  
**Validation:** Consistent with industry practice (✓)

## GCP Rate Limiting
**Source:** https://cloud.google.com/docs/rate-limiting  
**Content Summary:** Cloud Load Balancer uses adaptive throttling, ML-based burst handling  
**Validation:** Similar to AWS but with adaptive component (✓)

## Azure Rate Limiting
**Source:** https://learn.microsoft.com/azure/rate-limiting  
**Content Summary:** Application Gateway supports rate-based rules, DDoS protection integration  
**Validation:** Consistent (✓), emphasizes DDoS more than AWS/GCP

## Cross-Source Consensus
- All three use token bucket or similar algorithms
- All support per-endpoint configuration
- Azure emphasizes DDoS integration
```

### Phase 3: Synthesize (Build Report)

```javascript
const phase1 = readMemory('search-results-phase1')
const phase2 = readMemory('validated-sources-phase2')

const synthesis = await agent(
  `Create a comprehensive report comparing rate limiting across AWS, GCP, Azure.
   Base it on these validated sources:\n${phase2}\n\n
   Include: similarities, differences, recommendations for choosing.`
)

log(`Synthesis complete`)
return { report: synthesis.report, citations: phase2.sources }
```

**Memory after Phase 3:**
```markdown
# Research Report: Rate Limiting Across Cloud Providers

**Timestamp:** 2025-03-15T11:00:00Z

## Executive Summary
AWS, GCP, and Azure all support rate limiting via token bucket algorithms. 
Differences are mainly in configuration granularity and DDoS integration.

## Comparison Table
| Provider | Algorithm | Granularity | DDoS Integration |
|----------|-----------|-------------|------------------|
| AWS | Token Bucket | Per-endpoint | Basic |
| GCP | Adaptive Throttling | Per-endpoint | ML-based |
| Azure | Rule-based | Per-endpoint | Strong (Application Gateway) |

## Recommendations
1. **Simple use case:** AWS or GCP (both have good docs)
2. **DDoS-heavy:** Azure Application Gateway
3. **Adaptive limits:** GCP's ML approach interesting for bursty traffic

## Sources
- [AWS API Gateway Rate Limiting](...)
- [GCP Cloud Load Balancer](...)
- [Azure Application Gateway](...)
```

---

## Pattern 3: Migration (3-Phase)

### Use Case
Plan migration → Execute → Verify

### Memory Configuration
```
Phase 1 Memory: migration-plan.md
  - Files to migrate
  - Approach
  
Phase 2 Memory: execution-log.md
  - Which files completed
  - Which had issues
  
Phase 3 Memory: verification.md
  - Type checking results
  - Test results
```

### Phase 1: Plan

```javascript
const filesToMigrate = await agent('Find all TypeORM files')

const plan = {
  total_files: filesToMigrate.length,
  estimated_time: Math.ceil(filesToMigrate.length / 5) + ' hours',
  risks: ['Schema migration', 'Circular imports'],
  approach: 'Parallel migration with worktree isolation'
}

log(`Migration plan: ${plan.total_files} files`)
return plan
```

### Phase 2: Migrate

```javascript
const plan = readMemory('migration-plan-phase1')
const files = plan.files_to_migrate

const results = await parallel(
  files.map(file => () =>
    agent(`Migrate ${file} from TypeORM to Drizzle`, { isolation: 'worktree' })
  )
)

const success = results.filter(r => r.status === 'success').length
log(`Migrated ${success}/${files.length} files`)

return {
  total: files.length,
  success: success,
  failed: results.filter(r => r.status === 'failed')
}
```

### Phase 3: Verify

```javascript
const phase2Results = readMemory('migration-execution-phase2')

const verification = await agent(
  `Run: tsc --noEmit && bun test
   
   Phase 2 migrated ${phase2Results.success} files.
   Report type errors and test failures.`
)

const status = verification.errors.length === 0 ? 'COMPLETE' : 'PARTIAL'
log(`Verification: ${status}`)

return {
  files_migrated: phase2Results.success,
  type_errors: verification.errors.length,
  test_failures: verification.test_failures.length,
  status: status
}
```

---

## Common Gotchas

### Gotcha 1: Memory Directory Not Configured

**Symptom:** Phase 2 agent can't read Phase 1 findings

**Cause:** `.claude/settings.local.json` doesn't have `autoMemoryDirectory`

**Fix:**
```json
{
  "autoMemoryDirectory": "~/.agentic/memory"
}
```

### Gotcha 2: Memory Files are Stale

**Symptom:** Phase 2 reads Phase 1 findings, but they're from last week

**Cause:** Memory persists across sessions; old findings aren't cleared

**Fix:**
Before running Phase 2, check memory files:
```bash
ls -la ~/.agentic/memory/
cat ~/.agentic/memory/audit-findings.md  # Is this recent?
```

Remove old files if needed:
```bash
rm ~/.agentic/memory/audit-findings.md
```

### Gotcha 3: Memory Format Mismatch

**Symptom:** Phase 2 tries to parse Phase 1 memory but format is wrong

**Cause:** Phase 1 saved unstructured text; Phase 2 expects JSON

**Fix:**
Agree on format in advance:
```
Phase 1: Save as JSON
{
  "findings": [
    { "file": "...", "line": 45, "issue": "..." }
  ]
}

Phase 2: Parse JSON
const findings = JSON.parse(readMemory('audit-findings'))
```

### Gotcha 4: Memory Leakage (Too Much Info)

**Symptom:** Memory files are huge (10MB+), slowing down context

**Cause:** Saving all source code, all intermediate results, everything

**Fix:**
Be selective. Save:
- Findings (not the full files audited)
- Summary (not full logs)
- Decisions (not all alternatives)

```javascript
// Too much
return {
  files_audited: [...all file contents...],
  logs: [...10k lines of logs...],
  all_results: {...}
}

// Better
return {
  findings: [
    { file: '...', issue: '...', severity: 'high' }
  ],
  summary: '8 issues found in 15 files',
  timestamp: '...'
}
```

### Gotcha 5: Phase Ordering Assumption

**Symptom:** Phase 2 expects Phase 1 to have run first

**Cause:** Phases can run out of order or multiple times

**Fix:**
Check if memory exists and handle missing data:

```javascript
const phase1Findings = readMemory('audit-findings') || []

if (phase1Findings.length === 0) {
  log('No Phase 1 findings. Running Phase 1 first...')
  // Handle gracefully
}
```

---

## Quick Checklist

- [ ] Memory is enabled in `.claude/settings.local.json`
- [ ] Phase 1 saves findings with clear structure (JSON or markdown)
- [ ] Phase 2 reads Phase 1 memory and uses findings
- [ ] Phase 3 compares Phase 1 and Phase 2 results
- [ ] Memory files are selective (findings, not full code)
- [ ] Each phase checks if memory exists before reading
- [ ] Team understands memory format and location

---

## See Also

- `.agentic/examples/` — Full walk-throughs using memory
- `.agentic/WORKFLOW_SELECTION.md` — When each workflow is useful
- `.agentic/rules/workflow-composition.md` — Combining workflows with memory

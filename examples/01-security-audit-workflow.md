# Example 1: Security Audit Workflow

## Scenario

You have a TypeScript/Hono API with 20+ route handlers. Some routes perform sensitive operations (create user, update billing, delete resources) but you're not confident all have proper authentication checks. You want to:

1. **Audit** — Find all routes missing authentication checks
2. **Fix** — Have an agent refactor the routes to add proper auth
3. **Verify** — Re-run the audit to confirm all fixes are in place

This example walks through using `audit-codebase` workflow to find issues, then verifying the fixes.

## Problem Statement

**Symptoms:**
- Inconsistent auth patterns across routes (some use middleware, some use guards, some manual checks)
- New routes sometimes added without auth verification
- Compliance team flagged this as a critical gap

**Goal:**
- Find all routes with missing or incomplete auth checks
- Fix them with consistent patterns
- Verify fixes with a re-audit
- Document decision for future route additions

## Step 1: Initial Audit

### Run the Audit

```bash
# In Claude Code, run the audit-codebase workflow
/audit-codebase \
  --pattern "src/routes/**/*.ts" \
  --issue "missing or incomplete authentication checks"
```

### Workflow Execution

The `audit-codebase` workflow will:
1. **Phase 1: Discover** — Find all route files matching pattern
2. **Phase 2: Audit** — Fan out 3-5 agents to examine routes for auth issues
   - Each agent gets ~5 files to review
   - Agents look for: missing auth middleware, unprotected endpoints, inconsistent patterns
3. **Phase 3: Verify** — Adversarially verify each finding
   - 3 independent agents try to refute each finding
   - Finding survives only if ≥2 agents agree it's real
4. **Phase 4: Report** — Return confirmed findings

### Expected Output

```json
{
  "findings": [
    {
      "file": "src/routes/user.ts",
      "line": 45,
      "issue": "DELETE /users/:id endpoint has no auth check",
      "severity": "critical",
      "code": "router.delete('/:id', async (c) => { ... })"
    },
    {
      "file": "src/routes/billing.ts",
      "line": 82,
      "issue": "PUT /billing/payment-method checks user.id but doesn't verify ownership",
      "severity": "high",
      "code": "const paymentMethod = await db.update(...)"
    },
    ...
  ],
  "summary": "Found 8 critical/high severity auth issues across 5 files"
}
```

### Cost Breakdown

- **Files audited:** 20
- **Audit rounds:** 1 (parallel)
- **Agents:** 4 auditors + 3 verifiers per finding = 4 + (8 × 3) = 28 agents
- **Tokens:** ~100k tokens (varies by file size)
- **Wall-clock:** ~2-3 minutes

## Step 2: Fix the Issues

Now you have a clear list of issues. There are two approaches:

### Approach A: Manual Fix (If Issues Are Simple)

For straightforward fixes like "add auth middleware," you might fix manually:

```typescript
// Before (src/routes/user.ts, line 45)
router.delete('/:id', async (c) => {
  const userId = c.req.param('id')
  await deleteUser(userId)
  return c.json({success: true})
})

// After (add auth middleware)
router.delete('/:id', requireAuth, async (c) => {
  const userId = c.req.param('id')
  const authUser = c.get('user')
  if (authUser.id !== userId) return c.text('Forbidden', 403)
  
  await deleteUser(userId)
  return c.json({success: true})
})
```

### Approach B: Agent-Driven Fix (If Issues Are Complex)

For varied issues needing domain knowledge, use an agent:

```bash
# Ask agent to refactor based on findings
# This is manual - not a built-in workflow step
# The agent reads the audit findings and implements fixes
```

Agent prompt (you write this):

```
Here are authentication issues found in our API:

${auditFindings}

For each issue, refactor the code to add proper auth checks following these patterns:
1. Use the requireAuth middleware for endpoints needing auth
2. Check user ownership for user-specific operations
3. Use role-based checks for admin operations
4. Return 403 Forbidden for auth failures, 401 Unauthorized for missing auth

Apply fixes and return the refactored code for each file.
```

**Key insight:** The audit tells you WHAT is wrong, but fixing is often manual or agent-assisted. The verify step (re-audit) confirms the fixes worked.

## Step 3: Verify Fixes

After fixing, re-run the same audit:

```bash
/audit-codebase \
  --pattern "src/routes/**/*.ts" \
  --issue "missing or incomplete authentication checks"
```

### Expected Output (After Fixes)

```json
{
  "findings": [],
  "summary": "No authentication issues found! All routes have proper auth checks."
}
```

If any findings remain, you know exactly which routes still need work.

## Memory Flow (Multi-Phase)

If you want to persist findings across phases, enable memory:

```json
// In .claude/settings.local.json
{
  "autoMemoryDirectory": "~/.agentic/memory"
}
```

**Phase 1 (Audit):** Store findings in memory
```
Memory location: ~/.agentic/memory/audit-findings-auth.md
Content: List of 8 findings with file, line, severity
```

**Phase 2 (Fix):** Agent reads memory
```
"Use these findings to guide refactoring:\n" + readMemory('audit-findings-auth')
```

**Phase 3 (Verify):** Compare original findings with re-audit
```
Original findings (from memory): 8 issues
New findings: 0 issues
Status: ✅ All fixed
```

## Common Mistakes & How to Avoid

### Mistake 1: Over-Broad Pattern
**What went wrong:**
```bash
/audit-codebase --pattern "src/**/*.ts" --issue "auth"
```
This audits ALL TypeScript files, including utilities, config, tests. Most will have no auth relevance.

**Fix:**
```bash
/audit-codebase --pattern "src/routes/**/*.ts" --issue "..."
# or
/audit-codebase --pattern "src/api/**/*handler.ts" --issue "..."
```
Scope to the files that actually expose endpoints.

### Mistake 2: Vague Issue Description
**What went wrong:**
```bash
/audit-codebase --pattern "src/routes/**/*.ts" --issue "auth"
```
"Auth" is too broad. Agents might find auth-related code that isn't actually a problem.

**Fix:**
```bash
/audit-codebase --pattern "src/routes/**/*.ts" \
  --issue "missing authentication checks on endpoint handlers"
```
Be specific about what you're looking for.

### Mistake 3: Ignoring Verification Results
**What went wrong:**
You run the audit, get 10 findings, but 3 of them get refuted in the verification phase. You assume those 3 are false positives and ignore them.

**Reality:**
If an agent refutes a finding, it *might* be a false positive, but it might also mean the issue is subtle. Check the refutation reasoning before dismissing.

**Fix:**
Look at refuted findings separately:
```json
{
  "confirmed_findings": [7 findings],
  "refuted_findings": [3 findings with refutation_reasoning],
  "note": "Review refuted findings manually - they might be false positives or subtle issues"
}
```

### Mistake 4: Not Verifying Fixes
**What went wrong:**
You fix the issues but don't re-audit. Weeks later, compliance team finds you missed one.

**Fix:**
Always re-audit after fixing to confirm:
```bash
# After fixes are deployed or reviewed
/audit-codebase --pattern "src/routes/**/*.ts" --issue "missing auth"
```

## Cost Analysis

| Phase | Agents | Tokens | Time |
|-------|--------|--------|------|
| Initial Audit | 28 | ~100k | 2-3m |
| Fix (manual) | 0 | 0 | 15-30m (human work) |
| Fix (agent-assisted) | 1-2 | ~30k | 2-3m |
| Re-audit | 28 | ~100k | 2-3m |
| **Total** | 28-30 | 130-230k | 6-10m |

If you have many routes (50+), costs scale linearly.

## Related Patterns

- **Workflow:** `audit-codebase` — Multi-agent audit with adversarial verification
- **Pattern:** [[Adversarial Verification]] — How verification works
- **Pattern:** [[Phase-Based Orchestration]] — How phases are structured
- **Composition:** Can chain with `migrate-in-parallel` if fixes require large refactors

## Next Steps

1. Run initial audit to identify issues
2. Fix issues (manually or with agent assistance)
3. Re-audit to verify
4. Document auth patterns for future developers
5. Consider adding auth checks as part of PR review process

## See Also

- `.agentic/WORKFLOW_SELECTION.md` — When to use audit-codebase vs other workflows
- `.agentic/rules/failure-scenarios.md` — What can go wrong during audits
- `.agentic/rules/workflow-composition.md` — How to chain audits together

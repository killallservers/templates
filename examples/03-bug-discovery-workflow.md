# Example 3: Bug Discovery Workflow (Loop Until Converged)

## Scenario

Your test suite has ~50 tests, and 3-4 seem to fail randomly ("flaky"). When you rerun them, sometimes they pass, sometimes fail. This is expensive because:
- You can't trust test results
- Every CI failure might be flaky, not a real bug
- You can't confidently ship new code

You want to:
1. **Find** flaky tests across multiple runs
2. **Refactor** each flaky test to be deterministic
3. **Stop** when no new flaky tests are found (convergence)

This example walks through using `loop-until-converged` workflow with deduplication.

## Problem Statement

**Symptoms:**
- Tests sometimes pass, sometimes fail without code changes
- Failures are timing-dependent or order-dependent
- Retrying CI job succeeds (intermittent)

**Goal:**
- Identify all flaky tests
- Refactor each to be deterministic
- Verify they no longer flake (run multiple times)
- Prevent new flaky tests in future

## Why Loop Until Converged?

The key insight: **flaky tests are discovered through repeated runs**.

Run 1 might find tests A, B, C flaky.
Run 2 (after fixing A, B, C) might find D, E flaky.
Run 3 might find nothing new (convergence).

The workflow:
```
Round 1: Run tests → Find A, B, C flaky
         Remember: {A, B, C}
         
Round 2: Run tests → Find B, D, E flaky
         New: {D, E} (B already known)
         Remember: {A, B, C, D, E}
         
Round 3: Run tests → Find nothing new
         Dry round 1
         
Round 4: Run tests → Still nothing new
         Dry round 2 → Converged!
         
Output: {A, B, C, D, E} are the flaky tests
```

## Step 1: Run Flaky Test Discovery

```bash
/loop-until-converged \
  --task "Run the test suite and identify flaky tests" \
  --rounds 10 \
  --dryRounds 2
```

### Workflow Execution

1. **Round 1:** Run `bun test` 
   - Some tests fail randomly
   - Agent identifies which tests flaked
   - Store findings in memory
   - Example: {TestA, TestB}

2. **Round 2:** Run tests again
   - Tests pass/fail differently due to randomness
   - Agent identifies flaky tests
   - Dedup against round 1: {TestC, TestD} are new
   - Store combined findings
   - Memory now: {TestA, TestB, TestC, TestD}

3. **Round 3:** Run tests
   - Same 4 tests flake, no new ones
   - Dry count: 1

4. **Round 4:** Run tests
   - Same 4 tests flake, no new ones
   - Dry count: 2 → Converged!

5. **Final Result:**
```json
{
  "flaky_tests": [
    { "name": "should handle concurrent requests", "file": "routes.test.ts" },
    { "name": "should update user profile", "file": "user.test.ts" },
    { "name": "should process async hooks", "file": "hooks.test.ts" },
    { "name": "should not leak memory", "file": "memory.test.ts" }
  ],
  "rounds": 4,
  "dry_rounds": 2,
  "tokens_used": 150000,
  "time": "5 minutes"
}
```

## Step 2: Examine Flaky Tests

Now you have concrete list: {TestA, TestB, TestC, TestD}

For each, understand the flakiness:

### Example: TestA (should handle concurrent requests)

```typescript
// tests/routes.test.ts
describe('Routes', () => {
  it('should handle concurrent requests', async () => {
    const server = await startServer()
    
    // Problem 1: No wait for server fully started
    const response1 = await fetch('http://localhost:3000/api/users')
    const response2 = await fetch('http://localhost:3000/api/users')
    
    // Problem 2: Race condition in response order
    const data1 = await response1.json()
    const data2 = await response2.json()
    
    expect(data1.length).toBe(2)
    expect(data2.length).toBe(2)
    // Sometimes passes (if responses finish in expected order)
    // Sometimes fails (if responses are slow/reordered)
  })
})
```

**Root causes:**
1. No synchronization point before requests
2. Assumes response order (not guaranteed)
3. Timing-dependent assertions

## Step 3: Refactor Flaky Tests

You have two options:

### Option A: Manual Fix

```typescript
// After refactoring
describe('Routes', () => {
  it('should handle concurrent requests', async () => {
    const server = await startServer()
    
    // Wait for server to be fully ready (not just started)
    await new Promise(resolve => 
      server.once('listening', resolve)
    )
    
    // Make requests sequentially and store in map (not order-dependent)
    const responses = new Map()
    
    const response1 = await fetch('http://localhost:3000/api/users')
    responses.set('user1', await response1.json())
    
    const response2 = await fetch('http://localhost:3000/api/users')
    responses.set('user2', await response2.json())
    
    // Assert data exists, not order
    expect(responses.get('user1')).toBeDefined()
    expect(responses.get('user2')).toBeDefined()
    expect(responses.get('user1').length).toBe(2)
  })
})
```

### Option B: Agent-Guided Fix

Ask agent to refactor:

```
Here are flaky tests (from loop-until-converged workflow):
${flakyTests}

For each test:
1. Identify the root cause of flakiness
2. Remove timing assumptions (race conditions)
3. Add proper synchronization (await, events, timeouts)
4. Make assertions order-independent where possible
5. Refactor to be deterministic

Return refactored test for each file.
```

## Step 4: Verify Fixes (Re-run Workflow)

After refactoring, run the discovery workflow again:

```bash
/loop-until-converged \
  --task "Run the test suite and identify flaky tests" \
  --rounds 5 \
  --dryRounds 2
```

Expected: No flaky tests found (empty list)

If some flaky tests still appear:
- Refactor isn't complete
- Root cause is more subtle (database state, port conflicts, etc)
- Need deeper investigation

## Cost Breakdown

| Phase | Agents | Tokens | Time |
|-------|--------|--------|------|
| Rounds 1-3 | 3 agents × 4 rounds = 12 | ~120k | ~3 min |
| Dedup + logic | Minimal | ~5k | Negligible |
| Refactoring | 1-2 (manual or agent) | ~30k | 10-20 min |
| Verification | 3 agents × 2-3 rounds | ~60k | ~1.5 min |
| **Total** | 15-17 | ~215k | ~15 min |

Scales with number of test runs and suite complexity.

## Understanding the Dedup Set

The workflow maintains `seen = new Set()` of flaky test names:

```javascript
// Round 1
const found = await agent('Run tests, find flaky ones')
// Result: {TestA, TestB}
seen.add('TestA')
seen.add('TestB')

// Round 2
const found = await agent('Run tests again, find flaky ones')
// Result: {TestB, TestC, TestD}
const fresh = found.filter(t => !seen.has(t.name))
// Fresh: {TestC, TestD} (TestB already known)
fresh.forEach(t => seen.add(t.name))

// Round 3
const found = await agent('Run tests again')
// Result: {TestA, TestB, TestC, TestD} (same as before)
const fresh = found.filter(t => !seen.has(t.name))
// Fresh: {} (all already known)
// Dry count +1

// Round 4
const found = await agent('Run tests again')
// Result: {TestA, TestB, TestC, TestD}
const fresh = found.filter(t => !seen.has(t.name))
// Fresh: {} (all already known)
// Dry count +2 → Converged!
```

**Key insight:** Dedup prevents reporting the same test multiple times and detects convergence (when no NEW tests are found).

## Common Mistakes

### Mistake 1: Setting dryRounds Too Low

**Wrong:**
```bash
/loop-until-converged --rounds 10 --dryRounds 1
```

With `dryRounds=1`, you might converge too early if:
- Tests are slightly non-deterministic
- One round happens to find nothing by chance

**Right:**
```bash
/loop-until-converged --rounds 10 --dryRounds 2
```

`dryRounds=2` means 2 consecutive rounds with zero new findings. More confidence.

### Mistake 2: Not Running Long Enough

**Wrong:**
```bash
/loop-until-converged --rounds 3 --dryRounds 2
```

With only 3 rounds, you might miss flaky tests that only appear occasionally (every 5th run).

**Right:**
```bash
/loop-until-converged --rounds 10 --dryRounds 2
```

More rounds = higher confidence you've found all flaky tests.

### Mistake 3: Fixing Tests Without Refactoring Root Cause

**Wrong:**
You see TestA flakes, so you:
```typescript
it('should work', async () => {
  // Add retry logic instead of fixing
  let result
  for (let i = 0; i < 5; i++) {
    try {
      result = await something()
      break
    } catch {
      await sleep(100)
    }
  }
  expect(result).toBeDefined()
})
```

This masks the problem. Test still fails randomly; you just retry.

**Right:**
Find the root cause (timing, race condition, order dependency, shared state) and fix it.

## Memory Flow (Optional)

If using memory:

**Round 1 (memory):**
```
findings/flaky-tests-round-1.md
- TestA
- TestB
```

**Round 2 (memory):**
```
findings/flaky-tests-round-2.md
- TestB (known)
- TestC (new)
- TestD (new)
```

**Final (memory):**
```
findings/flaky-tests-final.md
- TestA
- TestB
- TestC
- TestD
```

Phases can reference memory to understand progression.

## Verification Checklist

- [ ] Ran loop-until-converged with dryRounds=2
- [ ] All reported flaky tests reproduced locally
- [ ] Root cause identified for each (timing, race, order, state)
- [ ] Refactored or deleted flaky tests
- [ ] Re-ran discovery workflow (no new flaky tests)
- [ ] CI suite passes consistently (run 3+ times)
- [ ] Added notes for team (e.g., "async timing assumption removed")

## Related Patterns

- **Workflow:** `loop-until-converged` — Iterative discovery with dedup and dry rounds
- **Pattern:** [[Deduplication Against Seen Set]] — How dedup prevents duplicates
- **Pattern:** [[Cost-Aware Scaling]] — Budget-aware loop execution

## See Also

- `.agentic/WORKFLOW_SELECTION.md` — When to use loop-until-converged
- `.agentic/rules/failure-scenarios.md` — What can go wrong
- `.agentic/rules/workflow-composition.md` — Combining with other workflows

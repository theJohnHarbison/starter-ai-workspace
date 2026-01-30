# Bug Investigation Guide

Systematic root cause analysis for bugs that resist quick fixes.

## Process

1. **Symptoms** - What exactly fails? Error messages, stack traces, conditions
2. **Reproduce** - Minimal steps to trigger the bug consistently
3. **Hypotheses** - List 3-5 possible causes ranked by likelihood
4. **Test** - For each hypothesis: how to confirm/eliminate it
5. **Root Cause** - Apply "5 Whys" to the confirmed hypothesis
6. **Fix** - Propose solution that addresses root cause, not symptoms

## Output Format

```
## Symptoms
[What's happening]

## Reproduction
[Minimal steps]

## Hypotheses
1. [Most likely] - Test: [how to verify]
2. [Second likely] - Test: [how to verify]
3. [Third likely] - Test: [how to verify]

## Root Cause
[The actual cause after testing hypotheses]

## Proposed Fix
[Solution addressing root cause]
```

## Rules

- Evidence over speculation
- Test hypotheses before concluding
- If still stuck after this analysis, ask for help

## Example Investigation

### Symptoms
API returns 500 error intermittently on `/orders/:id` endpoint

### Reproduction
1. Create order with 100+ items
2. Immediately request order details
3. ~30% of requests fail with 500

### Hypotheses
1. **Database timeout on large datasets** - Test: Check query execution time for large orders
2. **Race condition in order creation** - Test: Add delay between create and fetch
3. **Memory issues with large response** - Test: Monitor memory usage during request

### Testing Results
- Hypothesis 1: Query takes 8s for 100+ items (timeout is 5s) ✅
- Hypothesis 2: Delay doesn't affect failure rate ❌
- Hypothesis 3: Memory usage normal ❌

### Root Cause
Database query lacks index on `order_items.order_id`, causing full table scan for large orders.

**5 Whys:**
1. Why does the query timeout? → Takes 8+ seconds
2. Why does it take 8+ seconds? → Full table scan on order_items
3. Why full table scan? → No index on order_id
4. Why no index? → Migration forgot to add it
5. Why was it forgotten? → No checklist for required indexes

### Proposed Fix
1. Add index: `CREATE INDEX idx_order_items_order_id ON order_items(order_id);`
2. Add to migration checklist: "Verify foreign key indexes exist"
3. Add test: Orders with 100+ items must respond < 1s

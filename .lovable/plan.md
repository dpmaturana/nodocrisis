

## Fix trend tags showing on wrong needs

### Problem
The "Worsening" / "Improving" trend tags appear on the wrong needs because the system picks which 2 gaps to show trends for based on `last_updated_at`, but that field is set to `sector_needs_context.created_at` (when the need row was first created), NOT when it was last updated via an audit.

So when you update "Transport", the audit is recorded with a fresh timestamp, but the gap's `last_updated_at` still reflects the original creation time. The "top 2 most recently updated" filter then picks whichever gaps happened to be created most recently (e.g., Drinking water and Food supply), not the ones actually updated.

### Solution
Use the latest audit timestamp for each gap as `last_updated_at` instead of `need.created_at`.

### Technical details

**File: `src/services/gapService.ts` (~line 148)**

Build a map of the latest audit timestamp per gap key:

```typescript
const latestAuditTimestamp = new Map<string, string>();
auditsByKey.forEach((rows, key) => {
  // rows are already sorted by timestamp desc
  if (rows[0]?.timestamp) latestAuditTimestamp.set(key, rows[0].timestamp);
});
```

**File: `src/services/gapService.ts` (line 201)**

Change `last_updated_at` from:
```typescript
last_updated_at: need.created_at,
```
to:
```typescript
last_updated_at: latestAuditTimestamp.get(`${need.sector_id}:${need.capacity_type_id}`) ?? need.created_at,
```

This way the latest audit timestamp drives which gaps show the trend tag, so updating "Transport" will correctly show the trend on Transport.

### Files changed
1. `src/services/gapService.ts` -- use latest audit timestamp as `last_updated_at`

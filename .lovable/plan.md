

## Combined: Persist engine audits + English UI with colored status dots

### Part 1: Persist engine audits so reasoning appears

**File: `src/services/needSignalService.ts`** (lines 79-123)

Move the `need_audits` DB insert **outside** the `if (audit.final_status !== audit.previous_status)` guard. Every engine evaluation gets persisted for the reasoning trail. The in-memory activity log push stays inside the guard so only actual transitions show in the UI.

**File: `src/services/deploymentService.ts`**

Replace all 4 fire-and-forget `.catch()` calls (lines 203-209, 233-239, 264-270, 338-344) with `try { await ... } catch (e) { console.warn(...) }` so the engine completes before the function returns. Affects `enroll`, `updateStatus`, `updateStatusWithNote`, `markAsOperating`.

---

### Part 2: English UI + colored status dots

**File: `src/types/activityLog.ts`**

Add two optional fields to `CapabilityActivityLogEntry`:
- `previous_status?: string`
- `final_status?: string`

**File: `src/services/needSignalService.ts`** (line 89-91)

- Change `source_name` from `"Motor de decision"` to `"Decision engine"`
- Change summary to English: `` `Status changed from ${audit.previous_status} to ${audit.final_status}` ``
- Pass `previous_status` and `final_status` as new fields on the activity log entry

**File: `src/services/activityLogService.ts`** (mapAuditRowToLogEntry, ~line 96-113)

- Change `source_name` to `"Decision engine"`
- Change summary to English
- Pass `previous_status: row.previous_status` and `final_status: row.final_status` on the returned entry

**File: `src/components/dashboard/ActivityLogModal.tsx`**

Translate all Spanish strings to English:
- `EVENT_TYPE_LABEL`: "Signal received", "Coverage activity", "Status change"
- Dialog title: `"Activity log: {name}"`
- Dialog description: `"{sector} -- Signal and decision history"`
- Loading: `"Loading records..."`
- Empty: `"No activity records for this need"`
- Remove `locale: es` from `formatDistanceToNow`
- "Batch processed" instead of "Procesado en lote"

For `STATUS_CHANGE` entries, replace the plain text summary with a visual status transition:
- Import `NEED_STATUS_PRESENTATION`, `NeedStatus` from `@/lib/needStatus`
- Import `ArrowRight` from `lucide-react`
- Map `previous_status` / `final_status` (uppercase) to their presentation config
- Render: `[colored dot] label [arrow icon] [colored dot] label`
- Example: a red dot + "Critical" then an arrow then a yellow dot + "Validating"
- Fall back to the plain text summary if statuses are not available

### Files changed

1. `src/types/activityLog.ts` -- add `previous_status`, `final_status` fields
2. `src/services/needSignalService.ts` -- always persist audits, English text, pass status fields
3. `src/services/deploymentService.ts` -- await engine calls
4. `src/services/activityLogService.ts` -- English text, pass status fields
5. `src/components/dashboard/ActivityLogModal.tsx` -- English UI, colored status dot transition


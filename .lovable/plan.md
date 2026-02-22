

## Enhance My Deployments View

### 1. Hide microcopy after sector state tag

In `SectorDeploymentCard.tsx`, remove the `<span>` elements that show explanations like "Gap remains active based on available signals", "Insufficient coverage across some capabilities", and "Under monitoring" after the status badges (lines 199, 204).

### 2. Make Field Status Report collapsible and translate to English

**Translate `FieldStatusReport.tsx` and `CompletedReportView.tsx` entirely to English:**
- "Actualizar estado de terreno" -> "Update field status"
- "Tu reporte ayuda a ajustar..." -> "Your report helps adjust coordination in real time."
- "Como va tu operacion?" -> "How is your operation going?" (optional)
- Status buttons: "Funciona por ahora" -> "Working", "No alcanza" -> "Insufficient", "Tuvimos que suspender" -> "Had to suspend"
- "Grabar" -> "Record", "Agregar audio" -> "Add audio", "Agregar nota" -> "Add note"
- "Enviar reporte" -> "Send report", "Enviando..." -> "Sending..."
- Processing states: "Transcribiendo audio..." -> "Transcribing audio...", "Extrayendo informacion..." -> "Extracting information..."
- "Reporte enviado y procesado" -> "Report sent and processed"
- "Tu nota:" -> "Your note:", "Transcripcion:" -> "Transcription:"
- "Senales registradas:" -> "Signals registered:"
- "Lo que veran otros actores:" -> "What other actors will see:"
- "Enviar otro reporte" -> "Send another report"
- Toast messages translated too
- Error messages like "Error de microfono" -> "Microphone error"

**Make the section collapsible:**
- Wrap `FieldStatusReport` content in a `Collapsible` component
- The header "Update field status" becomes the `CollapsibleTrigger` with a chevron icon
- Default state: collapsed (closed)
- When clicked, expands to show status buttons, audio recorder, text area, and submit button

### 3. Enrich each CapabilityRow with need status, summary, and notes

**Enrich deployment data in `deploymentService.ts`:**
- In `getMyDeploymentsGrouped()`, fetch `sector_needs_context` rows for each sector to get `level`, `notes` per capability
- Fetch latest `need_audits` for reasoning summary fallback
- Add `need_status`, `operational_requirements`, and `reasoning_summary` to `DeploymentWithDetails`

**Update `DeploymentWithDetails` type:**
- Add optional fields: `need_status?: string`, `operational_requirements?: string[]`, `reasoning_summary?: string`

**Update `CapabilityRow.tsx`:**
- Below the capability name and status badge, show:
  - Requirement pills (from `operational_requirements`) as small rounded tags
  - Reasoning summary as muted italic text
- Remove the current `deployment.notes` display (the "enrollment from sector..." phrase)

### Technical Details

**`deploymentService.ts` changes in `getMyDeploymentsGrouped()`:**
- After grouping by sector, fetch `sector_needs_context` rows: `supabase.from("sector_needs_context").select("capacity_type_id, level, notes").eq("sector_id", sectorId)`
- Fetch `need_audits` for reasoning fallback: `supabase.from("need_audits").select("capability_id, reasoning_summary").eq("sector_id", sectorId).order("created_at", { ascending: false })`
- For each deployment, match by `capacity_type_id` to get notes JSON and level
- Parse notes JSON same way as `gapService.ts` (lines 212-235)
- Map level to need_status using `mapNeedLevelToNeedStatus()`
- Attach `need_status`, `operational_requirements`, `reasoning_summary` to each `DeploymentWithDetails`

**`SectorDeploymentCard.tsx` line changes:**
- Line 199: Remove `<span className="text-xs text-muted-foreground">{stateConfig.microcopy}</span>`
- Line 204: Remove `<span className="text-xs text-muted-foreground">Under monitoring</span>`

**`FieldStatusReport.tsx` changes:**
- Import `Collapsible, CollapsibleContent, CollapsibleTrigger`
- Wrap all form content (status buttons, audio, text, submit) inside `CollapsibleContent`
- Make header a `CollapsibleTrigger` with chevron
- Replace all Spanish strings with English equivalents
- Same for `CompletedReportView.tsx`

**`CapabilityRow.tsx` changes:**
- Accept enriched deployment data
- Replace `deployment.notes` display with `operational_requirements` pills and `reasoning_summary`
- Show need status via a colored dot or badge alongside the deployment status

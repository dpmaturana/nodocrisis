

# Translate Visible Spanish UI Strings to English

## Scope
Only frontend-visible strings in the event creation/situation report flow. No edge functions, no mock data, no unused code.

## Files and Changes

### 1. `src/pages/admin/SituationReport.tsx`

| Spanish | English |
|---------|---------|
| `import { es } from "date-fns/locale"` | Remove import (use default English locale) |
| `"Reporte no encontrado."` | `"Report not found."` |
| `"Confirmado" / "Descartado"` | `"Confirmed" / "Discarded"` |
| `"Este reporte ya no puede ser editado."` | `"This report can no longer be edited."` |
| `"Ver dashboard del evento"` | `"View event dashboard"` |
| `"Borrador guardado"` | `"Draft saved"` |
| `"Error al guardar"` | `"Error saving"` |
| `"Reporte descartado"` | `"Report discarded"` |
| `"¡Coordinación activada!"` | `"Coordination activated!"` |
| `"...creado exitosamente."` | `"...created successfully."` |
| `"Error al confirmar"` | `"Error confirming"` |
| `"${sector.name} (copia)"` | `"${sector.name} (copy)"` |
| `"Nuevo sector"` | `"New sector"` |
| `"Borrador"` | `"Draft"` |
| `{ locale: es }` | Remove locale option (default English) |
| `"Reporte de Situacion Inicial"` | `"Initial Situation Report"` |
| `"Evento Sugerido"` | `"Suggested Event"` |
| `"Nombre del evento"` | `"Event name"` |
| `"Ingresa el nombre del evento..."` | `"Enter event name..."` |
| `"Tipo de emergencia"` | `"Emergency type"` |
| `"Seleccionar tipo..."` | `"Select type..."` |
| `"Resumen de la situacion"` | `"Situation summary"` |
| `"Describe la situacion..."` | `"Describe the situation..."` |
| `"Sectores Operativos Sugeridos"` | `"Suggested Operational Sectors"` |
| `"X incluidos"` | `"X included"` |
| `"Agregar"` | `"Add"` |
| `"No hay sectores sugeridos..."` | `"No suggested sectors. Add one manually."` |
| `"Capacidades Criticas (Nivel Evento)"` | `"Critical Capabilities (Event Level)"` |
| `"X incluidas"` | `"X included"` |
| `"Estas capacidades se requieren..."` | `"These capabilities are required for the entire event. You can assign sector-level priorities later."` |
| `"Esta es una propuesta generada por IA"` | `"This is an AI-generated proposal"` |
| `"Revisa la informacion..."` | `"Review the information before confirming. Activating coordination will create the event, sectors, and needs in the system."` |
| `"Creando evento..."` | `"Creating event..."` |
| `"Confirmar y Activar Coordinacion"` | `"Confirm and Activate Coordination"` |
| `"Guardar Borrador"` | `"Save Draft"` |
| `"Descartar"` | `"Discard"` |
| `"¿Descartar reporte?"` | `"Discard report?"` |
| `"Esta accion no se puede deshacer..."` | `"This action cannot be undone. The report will be marked as discarded."` |
| `"Cancelar"` | `"Cancel"` |

### 2. `src/components/reports/SuggestedSectorCard.tsx`

| Spanish | English |
|---------|---------|
| `"Agregar descripcion..."` | `"Add description..."` |
| `"Duplicar sector"` | `"Duplicate sector"` |
| `"Eliminar sector"` | `"Remove sector"` |

### 3. `src/components/reports/CapabilityToggleList.tsx`

| Spanish | English |
|---------|---------|
| `"Agregar capacidad"` | `"Add capability"` |

### 4. `src/services/situationReportService.ts`

| Spanish | English |
|---------|---------|
| `"Debes iniciar sesion..."` | `"You must sign in to create a report."` |
| `"Respuesta inesperada del servidor."` | `"Unexpected server response."` |
| `"Nuevo Evento"` | `"New Event"` |

### 5. `src/types/database.ts` -- EVENT_TYPES labels only

Display labels change; DB enum values stay unchanged:

| value | Current label | New label |
|-------|--------------|-----------|
| incendio_forestal | Incendio Forestal | Wildfire |
| inundacion | Inundacion | Flood |
| terremoto | Terremoto | Earthquake |
| tsunami | Tsunami | Tsunami |
| aluvion | Aluvion | Mudslide |
| sequia | Sequia | Drought |
| temporal | Temporal | Storm |
| accidente_masivo | Accidente Masivo | Mass Accident |
| emergencia_sanitaria | Emergencia Sanitaria | Health Emergency |
| otro | Otro | Other |

### 6. `src/pages/admin/CreateEventAI.tsx`

| Spanish | English |
|---------|---------|
| `"Texto requerido"` | `"Text required"` |
| `"Describe la emergencia antes..."` | `"Describe the emergency before generating the proposal."` |
| `"Error al generar propuesta"` | `"Error generating proposal"` |
| `"Intenta de nuevo mas tarde."` | `"Please try again later."` |
| Spanish placeholder example | English equivalent |
| `"o"` divider | `"or"` |

## What stays unchanged
- Database enum values (e.g., `incendio_forestal`)
- Edge function prompts
- Mock data files (unused/not visible)
- Other pages outside this flow


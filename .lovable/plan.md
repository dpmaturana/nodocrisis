

## Hide the "Confianza" Badge

Remove the confidence badge that displays "Confianza: XX%" in the situation report header.

### Technical Details

In `src/pages/admin/SituationReport.tsx`, remove lines 271-275 which render:

```tsx
{report.overall_confidence && (
  <Badge variant="secondary" className="font-mono">
    Confianza: {confidencePercent}%
  </Badge>
)}
```

The `confidencePercent` variable computation can also be removed for cleanup, but since it has no side effects, removing just the JSX block is sufficient.


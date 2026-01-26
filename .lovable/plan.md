

## Plan: Dejar Usuario Solo con Rol Admin

### Situación Actual
El usuario `dmaturanamartinez@gmail.com` (user_id: `ccd9630b-9428-4fae-9e52-ce6d21a8f22b`) tiene dos roles asignados:
- `admin`
- `actor`

### Acción Requerida
Ejecutar una consulta SQL para eliminar el rol `actor`, dejando solo el rol `admin`.

### Consulta SQL a Ejecutar

```sql
DELETE FROM user_roles
WHERE user_id = 'ccd9630b-9428-4fae-9e52-ce6d21a8f22b'
  AND role = 'actor';
```

### Resultado Esperado

| Antes | Después |
|-------|---------|
| `["actor", "admin"]` | `["admin"]` |

### Impacto en la Aplicación
- El usuario ya no verá la vista simplificada de "Actor" (`ActorLayout`)
- Siempre verá el sidebar completo de administración (`AppSidebar`)
- Tendrá acceso a todas las funciones administrativas
- No podrá usar las funciones exclusivas de actor (inscribirse en sectores, reportes de campo como ONG)

### Sección Técnica
Esta operación es segura porque:
1. Solo modifica datos, no esquema
2. El usuario mantiene el rol `admin`, por lo que no pierde acceso
3. La política RLS `Admins can manage roles` permite esta operación a administradores


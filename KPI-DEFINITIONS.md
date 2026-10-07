# Portal de Iniciativas — Definiciones KPI v1

Estas definiciones son la base funcional del dashboard del portal y están pensadas para conservarse cuando los datos pasen a un Data Mart.

## Grano operativo actual

- Iniciativa: un documento en `portal_initiatives`.
- Área: elemento de `initiative.areas[]`.
- Actividad: elemento de `area.tasks[]`.
- Nota/evidencia: elemento de `task.notes[]`.
- Unidad: `scopeType` + `unitIds[]`.
- Persona: `ownerPersonId` en iniciativa o actividad; cuando no existe se conserva el nombre libre.

## KPIs

| KPI | Definición actual |
| --- | --- |
| Iniciativas | Número de iniciativas dentro del filtro seleccionado. |
| Iniciativas activas | `status != ready`. |
| Iniciativas listas | `status == ready`. |
| Iniciativas bloqueadas | `status == blocked`. |
| Ya ocurrieron | `eventDate < hoy`. |
| Por venir | `eventDate >= hoy`. |
| Ya ocurrieron y siguen abiertas | `eventDate < hoy AND status != ready`. Es un KPI de disciplina de cierre y calidad de información. |
| Actividades vencidas | `task.dueDate < hoy AND task.status != done`. |
| Actividades bloqueadas | `task.status == blocked`. |
| Cumplimiento de actividades | `actividades done / actividades totales * 100`. |
| Stale / sin actualización | Iniciativa activa con `updatedAt` mayor a 7 días. |
| Actualización vigente | `(iniciativas - stale) / iniciativas * 100`. |
| Cierre de iniciativas pasadas | `iniciativas pasadas status=ready / iniciativas pasadas * 100`. |

## Semáforo de iniciativa

### Rojo

Se cumple al menos una:
- iniciativa `blocked`;
- existe una actividad `blocked`;
- existe una actividad vencida no terminada;
- la fecha de la iniciativa ya pasó y la iniciativa no está `ready`.

### Amarillo

Sin condición roja y se cumple al menos una:
- iniciativa activa sin actualización por más de 7 días;
- la iniciativa ocurre dentro de los próximos 7 días.

### Verde

No hay condiciones rojas o amarillas. Una iniciativa `ready` se considera verde.

## KPI por área

Se agrupa por `catalogAreaId`; si no existe, se usa el nombre normalizado.

Métricas:
- iniciativas en las que participa;
- actividades asignadas al área;
- actividades terminadas;
- vencidas;
- bloqueadas;
- porcentaje de cumplimiento.

## KPI por integrante

Se basa en actividades asignadas (`task.ownerPersonId`). Para responsables capturados manualmente se usa el nombre como clave secundaria.

Métricas:
- iniciativas en las que tiene actividades;
- actividades asignadas;
- terminadas;
- vencidas;
- bloqueadas;
- porcentaje de cumplimiento.

Estas métricas detectan carga o excepciones; no deben interpretarse por sí solas como evaluación de desempeño.

## KPI por compañía / unidad

- Iniciativas globales se muestran como `GC / Global`.
- Iniciativas de unidades se cuentan en cada `unitId` asignado.
- Cuando el usuario filtra el dashboard a una unidad concreta, las iniciativas globales también se incluyen porque aplican al grupo.

## Histórico

El histórico v1 se basa en `eventDate` y muestra 12 meses: cinco anteriores, el actual y seis posteriores.

- Programadas: iniciativas cuya `eventDate` pertenece al mes.
- Abiertas vencidas: iniciativas del mes cuya fecha ya pasó y `status != ready`.

Esto deliberadamente no inventa una fecha histórica de cierre para registros viejos.

## Timestamps añadidos desde esta versión

Para mejorar el futuro Data Mart sin romper documentos existentes:

- `area.updatedAt?`
- `area.completedAt?`
- `task.createdAt?`
- `task.updatedAt?`
- `task.completedAt?`

Son campos opcionales y viven dentro de `areas[]`, por lo que no requieren modificar las reglas top-level actuales de `portal_initiatives`.

## Evolución recomendada para Data Mart

Cuando se construya el Data Mart, conservar estas definiciones y separar al menos:

- `FactInitiative`
- `FactInitiativeTask`
- `FactInitiativeStatusEvent` (nuevo historial de cambios recomendado)
- `DimDate`
- `DimUnit`
- `DimArea`
- `DimPerson`
- `DimInitiativeStatus`

Para análisis histórico exacto de quién cambió qué y cuándo, el siguiente paso será registrar eventos de cambio en una colección append-only; el modelo actual sólo conserva el estado vigente más timestamps recientes.

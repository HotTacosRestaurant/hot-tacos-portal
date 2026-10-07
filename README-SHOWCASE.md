# Showcase — Initiatives Portal

Ruta nueva: `/showcase`

- Muestra los mismos KPIs y cálculos del dashboard administrativo.
- Lee las mismas colecciones Firestore en tiempo real mediante las suscripciones existentes.
- No requiere autenticación.
- No muestra login, logout, navegación operativa ni edición.
- El único control global es `Actualizar`, que reinicia las suscripciones y confirma una lectura fresca.
- Las excepciones se muestran en modo sólo lectura y no navegan al módulo operativo.
- No se agregaron dependencias.
- El layout raíz ya conserva `lang="es"`, `translate="no"` y `google=notranslate`.

## Firestore

El Showcase no necesita abrir nuevas colecciones: `portal_initiatives`, `portal_units` y `portal_people` ya tienen lectura pública en las reglas actuales.

`FIRESTORE-RULES-COMPLETE.txt` contiene el archivo completo para reemplazo del ruleset compartido, preservando las demás aplicaciones y manteniendo `pc_*` bloqueado al navegador.

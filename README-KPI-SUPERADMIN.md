# KPI access restricted to Super Admin

Replace:

- `src/components/portal/portal-dashboard.tsx`

Behavior:

- The `KPIs` navigation tab is visible only when the current authenticated user is a portal admin AND the email matches one of the hardcoded super-admin emails in `src/lib/portal-admin-access.ts`.
- Regular administrators do not see or render the KPI dashboard.
- Signed-out users do not see or render the KPI dashboard.
- If a super-admin session ends while viewing KPIs, the UI immediately returns to `Iniciativas`.
- Signing out explicitly also returns to `Iniciativas`.

No Firestore rule changes are required for this UI restriction.

Important security note: `portal_initiatives` remains publicly readable by design so non-authenticated team members can use the operational portal. Therefore the underlying initiative data is not confidential. This change restricts access to the Management Information/KPI experience in the application, but a technically capable person with direct Firestore access could still derive metrics from the public source data. For truly confidential management analytics, store precomputed KPI snapshots in a separate Firestore collection protected by `isPortalSuperAdmin()` or expose them through a protected server endpoint.

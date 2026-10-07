# Firestore reliability patch

This patch is focused on preventing false-success behavior and silent local-only writes.

## What changes

- A failed initiative creation no longer closes the modal.
- The captured initiative remains in the form after a failed write.
- Firestore errors are shown as a persistent, high-visibility alert with the error code.
- Production no longer falls back silently to `localStorage` when a Firestore subscription fails.
- Local fallback remains available only under `next dev` when Firebase is not configured.
- Catalog changes are no longer applied optimistically before Firestore confirms the write.
- Failed person/area/unit creation keeps the entered form data.
- Failed task/note creation keeps the entered data.
- `undefined` fields are removed before sending portal documents to Firestore. This protects custom owners/tasks where optional IDs can otherwise cause Firestore client validation errors.
- The service worker no longer caches the application HTML/JS shell. It only caches static branding assets, reducing the risk of an old application version loading from cache after a deployment or network failure.
- `src/lib/firestore-portal-rules.ts` is updated as a REFERENCE-ONLY snippet to mirror the currently supplied portal rules. It is not a complete rules file and must never overwrite the complete Firestore rules used by the other Hot Tacos applications.

## Files to replace/add

- `public/sw.js`
- `src/app/globals.css`
- `src/components/portal/catalog-modal.tsx`
- `src/components/portal/initiative-card.tsx`
- `src/components/portal/initiative-modal.tsx`
- `src/components/portal/portal-dashboard.tsx`
- `src/components/pwa-register.tsx`
- `src/lib/firebase-errors.ts` (new)
- `src/lib/firestore-portal-rules.ts`
- `src/lib/initiative-repository.ts`

## Important

This patch does **not** change the deployed Firestore rules. Deploying rules should be a separate, deliberate step because the same Firestore database serves other Hot Tacos applications.

## Expected behavior after the patch

If Create/Update/Delete fails:

1. The application must not claim success.
2. Initiative/catalog forms remain open with the user's data.
3. A red persistent alert displays `NO SE GUARDÓ` and the Firebase error code.
4. The browser console logs the original Firebase error.
5. In production, a failed Firestore subscription blocks writes instead of switching to local storage.

## Suggested verification after deployment

Test from desktop, phone, and an incognito browser:

- Create person.
- Create initiative.
- Change initiative status.
- Add task.
- Add note.
- Delete initiative.
- Temporarily deny one portal write in Firestore Rules and verify that the form remains open and the error is obvious.
- Restore the rule and verify the write succeeds.

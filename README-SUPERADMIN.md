# Portal master admin patch

Only these signed-in emails can manage administrator accounts:

- hottacosmanagement@hotmail.com
- admin@nixinx.com
- admin@hottacosrestaurant.com

The permission is enforced twice:

1. UI: only those emails see the Administradores button.
2. Firestore Rules: only those emails, while also active admin records in portal_users, can list/create/update portal_users.

## New workflow

A master account signs in normally. The top bar shows Administradores. From that modal:

- enter name and email;
- the app creates the Firebase Authentication account using a secondary Auth instance so the current master session stays open;
- the app creates portal_users/{uid} with active=true, role=admin, email and name;
- Firebase sends the new administrator a password-reset email so they can set their own password;
- the modal lists portal administrators and allows a master account to activate/deactivate them.

Normal admins can still create/delete initiatives and manage catalogs, but they cannot manage administrator accounts.

## Required Firebase setup

Email/Password must remain enabled in Firebase Authentication.

Replace the complete Firestore rules with FIRESTORE-RULES-COPY-PASTE.txt and publish them.

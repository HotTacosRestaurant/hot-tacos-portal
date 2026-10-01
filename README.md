# Grupo Corporativo Portal

Portal interno PWA para coordinar iniciativas, unidades, áreas responsables y tareas del Grupo Corporativo.

## Desarrollo

```bash
npm install
npm run dev
```

Después abre `http://localhost:3000`.

## Firebase

La aplicación usa exclusivamente la colección `portal_initiatives`. Configura estas variables en `.env.local` y en Vercel:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Si Firebase no está configurado o las reglas aún no incluyen las colecciones del portal, la aplicación usa **Vista local**.

La aplicación utiliza estas colecciones exclusivas:

- `portal_initiatives`
- `portal_areas`
- `portal_units`

Las reglas del portal se agregan a las reglas existentes de Firestore. El portal no solicita inicio de sesión.

## Verificación

```bash
npm run lint
npm run build
```

El manifiesto y el service worker se incluyen para que el portal pueda instalarse como PWA desde navegadores compatibles.

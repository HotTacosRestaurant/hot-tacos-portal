# Hot Tacos Portal

Portal interno PWA para coordinar iniciativas, áreas responsables y tareas de Hot Tacos.

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

Si Firebase no está configurado o las reglas de Firestore rechazan la operación, el portal cambia automáticamente a **Vista local**. En ese modo los datos solo existen en `localStorage` del navegador.

No abras la colección públicamente para eliminar ese aviso. La siguiente fase debe agregar Firebase Authentication y reglas limitadas a los usuarios internos autorizados.

## Verificación

```bash
npm run lint
npm run build
```

El manifiesto y el service worker se incluyen para que el portal pueda instalarse como PWA desde navegadores compatibles.

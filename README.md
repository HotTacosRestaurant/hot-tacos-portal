# Hot Tacos Portal

Portal interno PWA para coordinar iniciativas, unidades, áreas responsables y tareas de Hot Tacos.

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

Si Firebase no está configurado, el portal usa **Vista local**. Cuando Firebase sí está configurado, exige inicio de sesión y nunca presenta como local una operación rechazada por Firestore.

La aplicación utiliza estas colecciones exclusivas:

- `portal_users`
- `portal_initiatives`
- `portal_areas`
- `portal_units`

El ajuste aditivo para Firestore está disponible dentro del portal en **Catálogos → Firebase**. No abras estas colecciones públicamente.

Para autorizar una cuenta, habilita Google en Firebase Authentication y crea manualmente `portal_users/{uid}` con:

```text
active: true
email: "usuario@ejemplo.com"
role: "admin"
```

Los roles admitidos son `admin`, `manager` y `member`. Solo `admin` puede modificar catálogos.

## Verificación

```bash
npm run lint
npm run build
```

El manifiesto y el service worker se incluyen para que el portal pueda instalarse como PWA desde navegadores compatibles.

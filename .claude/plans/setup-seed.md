# Plan: Pantalla de setup para crear el primer OWNER

## Objetivo
Exponer en el frontend una pantalla de configuración inicial (`/setup`) que cree el primer usuario `OWNER` cuando la base de datos está vacía. El backend ya tiene registro intra-organización; este plan añade **setup de primera cuenta**.

## Decisiones de diseño

1. **Setup es público y una sola vez.** `POST /api/v1/auth/setup` no requiere autenticación, pero rechaza `409 STATE_CONFLICT` si ya existe algún usuario.
2. **Auto-detección.** `GET /api/v1/auth/setup` devuelve `{ "required": true }` si no hay usuarios. El login la consulta al cargar y redirige a `/setup` cuando aplica.
3. **Setup == login.** `POST /auth/setup`, tras crear OWNER + organización, firma JWT, crea refresh token y devuelve la misma respuesta que `/auth/login`, incluyendo `Set-Cookie`. El frontend reutiliza `SessionService.login` con el `accessToken` devuelto.
4. **No se rompe el seed existente.** `seedIfEmpty` seguirá creando organización demo y leads, pero **solo creará el OWNER seed si `OWNER_PASSWORD` está configurado**. Sin `OWNER_PASSWORD`, la BD queda sin usuarios y el setup UI aparece.
5. **Fuera del shell.** `/setup` vive al mismo nivel que `/entrar`, sin guard.
6. **Fail-closed por defecto.** Si no se puede saber si hace falta setup, el login se muestra (no se bloquea). El POST protege contra doble setup en el servidor.

## Archivos a modificar

### Backend

- `packages/contracts/src/auth/schemas.ts`
  - Añadir `setupRequestSchema`, `setupResponseSchema`, `SetupRequest`, `SetupResponse`.
- `apps/api/src/auth/auth.repository.ts`
  - Añadir `count()` a `UserRepository` e implementarlo en `JsonUserRepository`.
- `apps/api/src/auth/auth.service.ts`
  - Añadir `setup(data)` que cree org + OWNER y devuelva `LoginResult`.
- `apps/api/src/auth/auth.controller.ts`
  - Añadir `GET /auth/setup` y `POST /auth/setup`.
- `apps/api/src/db/seed.ts`
  - No crear OWNER si `OWNER_PASSWORD` no está configurado.
- `apps/api/src/auth/auth.controller.spec.ts` (nuevo)
  - Tests de setup.
- `docs/api.md`
  - Documentar §3.10 `GET /auth/setup` y §3.11 `POST /auth/setup`.
- `docs/decisions.md`
  - ADR-026 (nuevo): setup de primera cuenta.

### Frontend

- `apps/web/src/app/core/auth-api.ts`
  - Añadir tipos `SetupBody` / `SetupRequiredBody` y métodos `setupRequired()`, `setup(email, password)`.
- `apps/web/src/app/core/session.ts`
  - Añadir `setup(email, password)` que llame a `AuthApi.setup` y, si es `ok`, abra sesión con los datos devueltos (mismo código que `login`).
- `apps/web/src/app/app.routes.ts`
  - Añadir ruta `/setup` antes que `/entrar`.
- `apps/web/src/app/features/setup/setup.ts` (nuevo)
  - Componente con email, password, confirmación, validación, errores, éxito + login automático.
- `apps/web/src/app/features/setup/setup.html` (nuevo)
  - Plantilla reutilizando tokens y componentes del sistema.
- `apps/web/src/app/features/setup/setup.css` (nuevo)
  - Estilos mínimos, reutilizando `.acceso` o `.users` como referencia.
- `apps/web/src/app/features/setup/setup.spec.ts` (nuevo)
  - Tests de validación, éxito y redirección.
- `apps/web/src/app/features/login/login.ts`
  - Al cargar, llamar `AuthApi.setupRequired()`; si `required`, redirigir a `/setup`.
- `apps/web/src/app/features/login/login.spec.ts`
  - Test de redirección a setup cuando la BD está vacía.
- `apps/web/src/app/app.routes.spec.ts`
  - Añadir `/setup` al listado de rutas que montan fuera del shell.
- `apps/web/src/app/core/auth-api.spec.ts`
  - Tests para `setupRequired()` y `setup()`.
- `apps/web/src/app/core/session.spec.ts`
  - Test para `setup()` abriendo sesión.

## Flujo de usuario

1. Usuario abre `/entrar`.
2. Login consulta `GET /api/v1/auth/setup`.
3. Si `required: true`, redirige a `/setup`.
4. En `/setup`, el usuario completa email/contraseña y envía.
5. Backend crea organización + OWNER, devuelve tokens.
6. Frontend abre sesión y redirige a `/home`.
7. Si el usuario vuelve a `/setup` o `/entrar` después, `GET /auth/setup` devuelve `required: false` y se muestra login normal.

## Riesgos y mitigaciones

- **Riesgo:** doble setup concurrente. `count() === 0` no es atómico en JSON DB, pero el `insert` con id único fallaría; además se puede añadir un lock en memoria si es necesario. MVP: aceptamos la carrera por ser JSON DB monoproceso.
- **Riesgo:** setup público expuesto en producción con un OWNER_PASSWORD configurado por CLI. En producción el OWNER debe crearse por migración/seed antes de exponer el API, o `OWNER_PASSWORD` debe estar configurado. El setup endpoint solo funciona si no hay usuarios.
- **Riesgo:** demo mode. En modo demostración del frontend no hay backend; el login no redirige a setup si no puede contactar al API.

## Tests

- Backend: setup crea OWNER y org, segundo setup devuelve 409, setup con email duplicado imposible porque no hay usuarios previos.
- Frontend: redirección de login a setup, formulario válido/inválido, éxito abre sesión, 409 no debería ocurrir en UI normal (se detecta antes).

## Notas

- No se añade `@angular/forms`; se mantiene el patrón de leer `FormData` en el submit, igual que login y users.
- Se reutiliza la validación de contraseña del schema de registro.

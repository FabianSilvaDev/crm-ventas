# Plan: Base de datos JSON en disco para `apps/api`

## Objetivo
Reemplazar el repositorio de leads en memoria por una capa de persistencia en archivos JSON, de modo que los datos sobrevivan reinicios del API y podamos migrar después a Postgres/Prisma sin cambiar el contrato ni los controladores.

## Decisión de ubicación
- Se crea la carpeta `apps/api/db` dentro del backend.
- Cada tabla tendrá su archivo JSON (`leads.json`, `identities.json`, `users.json`, `organizations.json`).
- La ruta es configurable con la variable opcional `DB_PATH` (por defecto `./apps/api/db`).
- Los archivos de datos se añaden a `.gitignore`; el seed los genera si no existen.

## Cambios propuestos

### 1. Nuevos archivos de infraestructura
- `apps/api/db/.gitkeep` o se crea automáticamente.
- `apps/api/src/db/json-db.ts`: genérico `JsonDb<T>` con:
  - carga de archivo,
  - escritura atómica (temp + rename),
  - lock por tabla en memoria,
  - métodos `findAll`, `findById`, `findOne`, `insert`, `update`, `upsert`, `delete`.
- `apps/api/src/db/db.module.ts`: provee `JsonDb` inyectables por tabla (`LEADS_DB`, `IDENTITIES_DB`, etc.).
- `apps/api/src/db/types.ts`: tipos internos mínimos (`StoredOrganization`, `StoredUser`, `StoredIdentity`).
- `apps/api/src/db/seed.ts`: si faltan archivos, crea la organización por defecto, un usuario OWNER de prueba y los 3 leads demo.

### 2. Reemplazo del repositorio de leads
- `apps/api/src/leads/leads.repository.ts`:
  - se conserva la interfaz `LeadRepository`,
  - se añade `JsonLeadRepository` que implementa la interfaz usando `JsonDb<Lead>` e `JsonDb<Identity>`,
  - se conserva `InMemoryLeadRepository` para tests unitarios que no requieran disco.
- `apps/api/src/leads/leads.module.ts`:
  - usa `JsonLeadRepository` en runtime con `JsonDb` inyectado,
  - conserva el seed a través de `DbModule`.

### 3. Configuración
- `apps/api/src/config/env.ts`: añadir `DB_PATH` opcional string.
- `.env.example`: añadir `DB_PATH=./apps/api/db` comentado.
- `.gitignore`: ignorar `apps/api/db/*.json`.

### 4. Tests
- `apps/api/src/leads/leads.controller.spec.ts`:
  - usar `DB_PATH` apuntando a un directorio temporal (`os.tmpdir()`).
  - limpiar archivos JSON en `afterAll`.
  - añadir un test que verifique que un cambio persiste tras reiniciar la app.
- Asegurar que `corepack pnpm typecheck` y `corepack pnpm test` sigan en verde.

### 5. Hoja de ruta hacia DB real
- El contrato `LeadRepository` se mantiene igual.
- Cuando llegue Prisma, solo se reemplaza `JsonLeadRepository` por `PrismaLeadRepository` sin tocar controllers ni servicios.
- Los tipos `Stored*` sirven como base para el futuro esquema.

## Criterios de aceptación
- [ ] Existe la carpeta `apps/api/db` con archivos JSON generados automáticamente.
- [ ] Al reiniciar el API, los leads creados/editados permanecen.
- [ ] Los endpoints de leads funcionan igual que antes (tests en verde).
- [ ] El modo test usa carpetas temporales y no escribe en `apps/api/db`.
- [ ] `corepack pnpm typecheck`, `corepack pnpm test` y `corepack pnpm build` pasan.

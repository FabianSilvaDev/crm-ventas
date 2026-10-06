# Plan: Migrar `apps/api` de JSON DB a MySQL + Prisma

## Objetivo

Salir del stub de base de datos JSON y cerrar la puerta de la **Fase 1 — Foundation** con una base de datos relacional real:

- Esquema versionado en Prisma.
- `apps/api` lee/escribe de MySQL 8.0+.
- Auth, setup, usuarios, leads e identidades persisten en tablas reales.
- Los tests siguen pasando apuntando a una base de datos de test.
- Se documenta la desviación respecto al roadmap original (Postgres → MySQL).

> **Alcance deliberadamente acotado.** Esta rebanada no implementa `apps/worker`, `apps/site`,
> audit_logs/outbox_events en profundidad, ni la ingesta real de Meta Lead Ads. Esas son las
> siguientes puertas. Aquí solo reemplazamos la persistencia para que las puertas siguientes
> tengan dónde escribir.

---

## Decisiones arquitectónicas incluidas

| Decisión | Valor | Por qué |
|---|---|---|
| Motor de base de datos | **MySQL 8.0+** local (Workbench) | Tú ya tienes MySQL en el sistema y te encargas de la instalación; reduce fricción de entorno. |
| ORM | **Prisma** | Ya estaba previsto en el roadmap; migraciones versionadas; cliente tipado. |
| Driver | `mysql2` + Prisma native | Requerido por Prisma para MySQL. |
| Entidades de esta fase | `organizations`, `users`, `refresh_tokens`, `identities`, `leads` | Cubre auth + setup + leads, lo que hoy funciona con JSON. |
| ¿Postgres/pgvector? | Se pospone y se registra en `docs/decisions.md` como ADR-026. | MySQL no tiene `pgvector`/`pg_trgm`/`citext`. Para embeddings (Fase 3/4) se reevaluará: volver a Postgres, usar un vector store separado, o calcular embeddings fuera de la DB. |
| Datos JSON antiguos | Se dejan de usar; no se migra automáticamente. | Son datos de demo/development. El seed de Prisma recrea la organización demo y los leads de ejemplo si la base está vacía. |

---

## Pre-requisitos que debes resolver en tu máquina

1. Tener **MySQL Server 8.0+** corriendo (tú lo instalas).
2. Crear dos bases de datos (charset `utf8mb4`, collation `utf8mb4_unicode_ci`):
   - `crm` → desarrollo.
   - `crm_test` → tests.
3. Tener un usuario/contraseña con permisos DDL+DML en ambas (por ejemplo `crm`/`change-me`).
4. Anotar la URL de conexión, por ejemplo:
   ```
   DATABASE_URL=mysql://crm:change-me@localhost:3306/crm
   TEST_DATABASE_URL=mysql://crm:change-me@localhost:3306/crm_test
   ```

---

## Cambios propuestos

### 1. Documentación de decisión

- **Crear** `docs/decisions.md` con **ADR-026**: "Motor relacional MySQL 8.0 en Fase 1 en lugar de PostgreSQL".
  - Contexto, decisión, consecuencias (`citext` → comparación case-insensitive en app/índice funcional; `pgvector` → pospuesto).
- **Actualizar** `docs/database.md`: cambiar "PostgreSQL 17+" por "MySQL 8.0+" para las tablas que entran en esta fase, y dejar una nota de que pgvector/pg_trgm/citext son PostgreSQL-only.
- **Actualizar** `docs/roadmap.md` §Fase 1: reflejar que la puerta de salida se cierra con MySQL/Prisma, no con Postgres, y que la elección de embeddings se reabre en Fase 3/4.

### 2. Dependencias

En `apps/api`:

```bash
pnpm add @prisma/client mysql2
pnpm add -D prisma
```

En `package.json` raíz (opcional pero recomendado):

```bash
pnpm add -D -w prisma
```

### 3. Esquema Prisma

**Crear** `apps/api/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Organization {
  id        String   @id @default(uuid()) @map("id")
  name      String   @map("name")
  slug      String   @unique @map("slug")
  settings  Json     @default("{}") @map("settings")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  users     User[]
  identities Identity[]
  leads     Lead[]

  @@map("organizations")
}

enum UserRole {
  OWNER
  AGENT
}

enum UserStatus {
  ACTIVE
  SUSPENDED
}

model User {
  id            String      @id @default(uuid()) @map("id")
  organizationId String     @map("organization_id")
  email         String      @unique @map("email")
  passwordHash  String      @map("password_hash")
  role          UserRole    @map("role")
  status        UserStatus  @default(ACTIVE) @map("status")
  lastLoginAt   DateTime?   @map("last_login_at")
  failedAttempts Int        @default(0) @map("failed_attempts")
  lockedUntil   DateTime?   @map("locked_until")
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  organization  Organization @relation(fields: [organizationId], references: [id])
  refreshTokens RefreshToken[]

  @@index([organizationId])
  @@map("users")
}

model RefreshToken {
  id           String    @id @default(uuid()) @map("id")
  userId       String    @map("user_id")
  tokenHash    String    @unique @map("token_hash")
  familyId     String    @map("family_id")
  expiresAt    DateTime  @map("expires_at")
  revokedAt    DateTime? @map("revoked_at")
  replacedById String?   @unique @map("replaced_by_id")
  userAgent    String?   @map("user_agent")
  ip           String?   @map("ip")
  createdAt    DateTime  @default(now()) @map("created_at")

  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([familyId])
  @@index([tokenHash])
  @@map("refresh_tokens")
}

model Identity {
  id             String       @id @default(uuid()) @map("id")
  organizationId String       @map("organization_id")
  email          String?      @map("email")
  phone          String?      @map("phone")
  firstSeenAt    DateTime     @map("first_seen_at")
  lastSeenAt     DateTime     @map("last_seen_at")
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  organization   Organization @relation(fields: [organizationId], references: [id])
  leads          Lead[]

  @@index([organizationId, email])
  @@map("identities")
}

enum LeadStatus {
  NEW
  CONTACTED
  QUALIFIED
  CONVERTED
  DISCARDED
}

enum LeadChannel {
  META_LEAD_FORM
  WHATSAPP_CLICK
  MANUAL
  OTHER
}

enum ClosedVia {
  WHATSAPP
  CALL
  EMAIL
  OTHER
}

model Lead {
  id              String       @id @default(uuid()) @map("id")
  organizationId  String       @map("organization_id")
  identityId      String       @map("identity_id")
  contactName     String?      @map("contact_name")
  status          LeadStatus   @default(NEW) @map("status")
  source          String       @map("source")
  channel         LeadChannel  @map("channel")
  score           Int?         @map("score")
  ownerUserId     String?      @map("owner_user_id")
  firstResponseAt DateTime?    @map("first_response_at")
  convertedAt     DateTime?    @map("converted_at")
  closedVia       ClosedVia?   @map("closed_via")
  consentJson     Json?        @map("consent_json")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  organization    Organization @relation(fields: [organizationId], references: [id])
  identity        Identity     @relation(fields: [identityId], references: [id])

  @@index([organizationId, createdAt])
  @@index([identityId])
  @@map("leads")
}
```

> **Notas de modelado:**
> - `email` es `String @unique` en Prisma/MySQL; mantenemos la comparación case-insensitive en la aplicación (como ya hace `JsonUserRepository`). En una rebanada posterior se puede añadir un índice funcional `LOWER(email)` o normalizar siempre a minúscula en la app.
> - `consent` se guarda como JSON (`consentJson`) porque Prisma/MySQL no tiene JSONB tipado; la app lo valida con el contrato.
> - Los enums de Prisma se mapean a tablas enum de MySQL.
> - IDs UUID v4 (aleatorios). Más adelante se puede cambiar a UUID v7 ordenables por tiempo cuando Prisma lo soporte de forma estable o lo generemos en la app.

### 4. Configuración de entorno

**Editar** `apps/api/src/config/env.ts`:

- Cambiar validación de `DATABASE_URL` para aceptar `mysql://`:
  ```ts
  DATABASE_URL: z.url({ protocol: /^mysql$/ }).default('mysql://crm:change-me@localhost:3306/crm'),
  ```
- Añadir `TEST_DATABASE_URL` opcional (solo se usa en tests).
- Mantener `DB_PATH` como **deprecated** durante la transición, pero si `DATABASE_URL` está presente se usa Prisma. En la siguiente rebanada se elimina `DB_PATH` y `JsonDb`.
- Hacer que en `NODE_ENV=test` se pueda usar `TEST_DATABASE_URL` o `DATABASE_URL` apuntando a `crm_test`.

**Editar** `.env.example`:

```bash
# Antes: postgresql://...
DATABASE_URL=mysql://crm:change-me@localhost:3306/crm
TEST_DATABASE_URL=mysql://crm:change-me@localhost:3306/crm_test
```

### 5. Módulo Prisma

**Crear**:

- `apps/api/src/prisma/prisma.service.ts`: `PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy`.
- `apps/api/src/prisma/prisma.module.ts`: provee `PrismaService` como global o exportado.

### 6. Repositorios Prisma

**Reescribir** implementaciones manteniendo las interfaces existentes:

- `apps/api/src/auth/auth.repository.ts`
  - `PrismaUserRepository implements UserRepository`
  - `PrismaRefreshTokenRepository implements RefreshTokenRepository`
- `apps/api/src/leads/leads.repository.ts`
  - `PrismaLeadRepository implements LeadRepository`

Mantener `InMemoryLeadRepository` para tests unitarios rápidos que no toquen la base de datos.

**Eliminar** (o dejar inactivos):

- `JsonUserRepository`, `JsonRefreshTokenRepository`, `JsonLeadRepository`, `JsonDb` y los tokens `*_DB` de `DbModule`.
- Si se prefiere una transición más suave, se puede dejar `JsonDb` en el árbol pero sin inyectarlo.

### 7. Módulos y wiring

**Editar**:

- `apps/api/src/prisma/prisma.module.ts`: importar en `AppModule`.
- `apps/api/src/app.module.ts`: reemplazar `DbModule.forRoot(env)` por `PrismaModule`.
- `apps/api/src/auth/auth.module.ts`: inyectar `PrismaService` en los providers de repositorios.
- `apps/api/src/leads/leads.module.ts`: inyectar `PrismaService` en `PrismaLeadRepository`.
- `apps/api/src/db/db.module.ts` y `apps/api/src/db/seed.ts`: reescribir `seedIfEmpty` para usar Prisma.
- `apps/api/src/db/types.ts`: mantener los tipos como interfaces de lectura/transporte, o eliminarlos si Prisma Client cubre todo. Se recomienda mantener una capa ligera para no depender del tipo Prisma crudo en la lógica de negocio.

### 8. Migración inicial

Generar con Prisma:

```bash
cd apps/api
pnpm exec prisma migrate dev --name init
```

Esto crea:

- `apps/api/prisma/migrations/202510..._init/migration.sql` (script SQL que se puede abrir en Workbench).
- `apps/api/prisma/migrations/migration_lock.toml`.

Se commitean ambos para versionar el esquema.

### 9. Seed con Prisma

**Reescribir** `apps/api/src/db/seed.ts`:

- Si `users` está vacío, crear organización demo y, opcionalmente, el OWNER seed (`OWNER_PASSWORD`).
- Si `leads` está vacío, crear las 3 identidades y 3 leads de ejemplo.
- Usar transacciones de Prisma cuando sea posible.

### 10. Tests

**Estrategia**: una base de datos de test real (`crm_test`).

**Crear** `apps/api/src/prisma/test-setup.ts`:

- Helper que devuelve un `PrismaService` apuntando a `TEST_DATABASE_URL`.
- Función `resetDatabase()` que ejecuta `TRUNCATE` o `DELETE` en orden inverso para cada test.

**Editar tests afectados**:

- `apps/api/src/auth/auth.controller.spec.ts`
- `apps/api/src/leads/leads.controller.spec.ts`
- `apps/api/src/core/session.spec.ts` (frontend? no, es web)
- Tests de webhooks donde sea necesario.

En cada test de integración:

```ts
beforeAll(async () => { prisma = createTestPrisma(); await prisma.$connect(); });
beforeEach(async () => { await resetDatabase(prisma); });
afterAll(async () => { await prisma.$disconnect(); });
```

> **Alternativa si MySQL en tests es muy pesado en Windows:** usar `better-sqlite3` o `libsql` solo para tests. Eso requiere un segundo `PrismaService` con `provider = "sqlite"` y duplicar el schema. Se evita por ahora; si surge fricción, se documenta como ADR.

### 11. Scripts útiles

Añadir en `apps/api/package.json`:

```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "prisma:reset": "prisma migrate reset --force"
  }
}
```

Añadir en `package.json` raíz:

```json
{
  "scripts": {
    "db:setup": "pnpm --filter @crm/api prisma:migrate && pnpm --filter @crm/api prisma:generate"
  }
}
```

### 12. Limpieza

- Eliminar carpeta `apps/api/db/*.json` (se añade a `.gitignore` o se borra del repo si ya estaba commiteada).
- Eliminar `apps/api/src/db/json-db.ts` si no se usa.
- Actualizar `.gitignore` para ignorar `apps/api/prisma/migrations/*`? No, se commitean. Ignorar solo `node_modules/.prisma` no es necesario porque `prisma generate` lo regenera.

---

## Orden de implementación

1. Documentar ADR-026 y actualizar `docs/database.md` + `docs/roadmap.md`.
2. Instalar Prisma, `mysql2`, `@prisma/client`.
3. Escribir `schema.prisma` y generar la primera migración.
4. Crear `PrismaModule` + `PrismaService`.
5. Reescribir `UserRepository` y `RefreshTokenRepository` en Prisma; actualizar `AuthModule`.
6. Reescribir `LeadRepository` en Prisma; actualizar `LeadsModule`.
7. Reescribir `seed.ts` con Prisma.
8. Actualizar `env.ts`, `.env.example` y `package.json`.
9. Configurar tests con `crm_test` y `resetDatabase`.
10. Correr `pnpm install`, `prisma migrate dev`, `prisma generate`, `pnpm typecheck`, `pnpm test`.
11. Ajustar hasta que todo esté verde.

---

## Criterios de aceptación

- [ ] `DATABASE_URL=mysql://... pnpm dev` levanta el API y conecta con MySQL.
- [ ] `POST /auth/setup` crea OWNER y organización en tablas reales.
- [ ] `POST /auth/login` con el OWNER creado devuelve access token y cookie de refresh.
- [ ] `POST /leads` crea un lead con su identidad en MySQL.
- [ ] `GET /leads` lista leads desde MySQL.
- [ ] Un refresh token reusado revoca toda la familia (test con Prisma real).
- [ ] `pnpm test` pasa usando `crm_test`.
- [ ] `prisma migrate dev` genera el esquema sin errores; el SQL resultante se puede abrir en MySQL Workbench.
- [ ] `docs/decisions.md` contiene ADR-026 justificando MySQL.

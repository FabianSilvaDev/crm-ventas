# Decisiones arquitectónicas (ADRs)

Este documento registra las decisiones que cambian o restringen la arquitectura del CRM.
Cada ADR sigue el formato: **contexto → decisión → consecuencias → estado**.

---

## ADR-026 — Motor relacional MySQL 8.0 en Fase 1 (en lugar de PostgreSQL)

**Estado:** aceptada.

### Contexto

El roadmap original (`docs/roadmap.md`) y el modelo de datos (`docs/database.md`) especificaban
**PostgreSQL 17+** con las extensiones `pgvector`, `pg_trgm`, `citext` y `pgcrypto`, accedido a
través de Prisma. La intención era:

- Tener un motor relacional maduro.
- Usar `pgvector` para embeddings de productos, contenido e investigación (Fases 3–5).
- Usar `pg_trgm` para búsqueda difusa y `citext` para emails case-insensitive.

En la práctica, el desarrollador principal ya tiene **MySQL Server 8.0+** instalado y
administrado a través de MySQL Workbench en su entorno Windows. Instalar y mantener PostgreSQL
local (o Docker/WSL2) añade fricción de entorno a la Fase 1, cuyo objetivo es simplemente cerrar
la puerta de "persistencia relacional real".

### Decisión

1. El motor relacional de la Fase 1 será **MySQL 8.0+**.
2. El ORM seguirá siendo **Prisma** (ya estaba previsto).
3. Se reescriben los repositorios `Json*` (`JsonUserRepository`, `JsonRefreshTokenRepository`,
   `JsonLeadRepository`) por implementaciones Prisma/MySQL.
4. Se migran a tablas reales las entidades que hoy funcionan con JSON: `organizations`, `users`,
   `refresh_tokens`, `identities`, `leads`.

### Consecuencias

#### Positivas

- Menor fricción de entorno en desarrollo: se usa el MySQL que ya existe.
- Se cierra la puerta de la Fase 1 sin depender de Docker/WSL2/Postgres local.
- Prisma sigue siendo el ORM, por lo que el cambio de motor en el futuro sigue siendo un cambio
  de `provider` y de tipos de columna, no una reescritura de la capa de persistencia.

#### Negativas / compensaciones

- **No hay `pgvector`**: los embeddings y búsqueda semántica de las Fases 3–5 requieren una
  decisión posterior:
  - volver a PostgreSQL/pgvector,
  - usar un vector store externo (Pinecone, Qdrant, Chroma, etc.), o
  - calcular/similitud de embeddings en memoria para volúmenes pequeños.
- **No hay `pg_trgm`**: la búsqueda difusa de leads/productos se implementa con
  `LIKE`/`FULLTEXT` de MySQL o con normalización en la app hasta que se reabra la decisión.
- **No hay `citext`**: la comparación case-insensitive de emails se hace en la aplicación
  (normalización a minúsculas + validación) o con un índice funcional `LOWER(email)` cuando
  sea necesario.
- Los tipos de columna, índices parciales y enums difieren ligeramente respecto al diseño
  PostgreSQL. `docs/database.md` refleja el modelo MySQL para las entidades de la Fase 1.

### Alternativas consideradas

- **Mantener PostgreSQL local/Docker**: rechazada por fricción de entorno en Windows.
- **Seguir con JSON DB más tiempo**: rechazada porque bloquea toda persistencia real, pruebas de
  concurrencia e integridad referencial.

### Cuándo se revisa

Antes de empezar la **Fase 3 — Products + Scoring** (cuando entren embeddings y búsqueda
semántica), o antes si aparece un segundo inquilino que necesite multi-tenencia avanzada.

---

# ADR-0001: Use clean architecture and domain aggregate boundaries for the backend

## Status

Accepted

## Date

2026-05-18

## Last Updated

2026-08-03

## Context

The backend needs clear dependency direction, stable domain boundaries, and a shared vocabulary for where business rules live. This ADR preserves the existing backend architecture decisions in the project-local ADR folder.

## Decision

The backend follows clean architecture with these layers:

- `apps/backend/src/domain/` - domain entities, value objects, business rules, no dependencies on outer layers
- `apps/backend/src/application/` - services (use case coordination), ports (interfaces for particular technology adapters, e.g. db repositories), DTOs
- `apps/backend/src/infrastructure/` - concrete implementations and technology choices (e.g. Postgres repositories, Kysely query builder, argon2 password hasher, jose JWT signing/verification)
- `apps/backend/src/presentation/` - controllers, http request/response shapes, mappers transforming application layer values to response values, validation of http requests, routes definitions

### Aggregate roots and child entities

As an example, see the aggregate root `DayLog` and its child entity `FoodEntry`.

- `apps/backend/src/domain/entities/day-log.ts`
- `apps/backend/src/domain/entities/food-entry.ts`

`DayLog` is the aggregate root for a user's nutrition data on a given day. It is a consistency enforcement boundary for child entities: `DayLog` and its child entities must be strongly consistent, for business rules to work correctly and not lead to an invalid system state.

`FoodEntry` is a child entity. Because of this:

- All mutations to `FoodEntry` rows in the database must go through `DayLogRepository`, not through a separate `FoodEntryRepository` exposed to the service layer.
- This prevents callers from bypassing `DayLog`'s invariants (currently: max 25 food entries per meal, enforced in `DayLog.addFoodEntry()`).
- The "one repository per aggregate root for writes" guideline from DDD applies here. A separate `FoodEntryRepository` with write access would undermine the aggregate boundary.

### The Load-Modify-Save pattern is used for mutations

When adding a food entry, the `DayLogService`:

1. Loads the full `DayLog` aggregate from `DayLogRepository` - at this scale, loading DayLog and its FoodEntry rows is still performant.
2. Calls a behavior method on the domain object (`dayLog.addFoodEntry(entry)`), which enforces invariants.
3. Calls `dayLogRepository.addFoodEntry(dayLog.id, entry)` to persist only the new child row.

This is not a full `save(aggregate)` - the repository exposes a targeted write method `addFoodEntry` rather than a full upsert. This is an intentional trade-off: it is more efficient than a `save()` with full diffing, adding a single food entry is a very frequent operation. `save()` with full diffing also would be more purist DDD but adds complexity.

This is reflected in `apps/backend/src/application/services/day-log-service.ts` `DayLogServiceImpl.addFoodEntry()` and `apps/backend/src/infrastructure/persistence/repositories/postgres-day-log-repository.ts` `PostgresDayLogRepository.addFoodEntry()`.

### Business logic that spans aggregates lives in the service layer

`DayLogServiceImpl.addFoodEntry()` checks a subscription rule (users can only have 7 day logs before subscribing) by coordinating `UserRepository` and `DayLogRepository`. This rule spans two aggregates, so it lives in the service layer, not inside `DayLog` the domain class.

### DAOs vs repositories

`PostgresDayLogRepository` contains private helper methods (`getFoodEntriesByDayLogId`, `mapRowToFoodEntry`, `mapFoodEntryToRow`) for reuse within the class. These are not exposed as separate DAOs or repositories. Extracting a `FoodEntryDao` for internal use is an option if the class grows, but has not been done yet.

The distinction in this codebase:

- **Repository**: domain-oriented, speaks in domain terms (methods return aggregate or entity), exposed as a port in the application layer
- **DAO**: table-oriented, talks to one or more tables, implementation detail hidden inside a repository

### Contracts and DTOs belong to their boundary owner

The location of a contract type is determined by the boundary that gives it meaning, not by the fact that it is a data-only TypeScript interface. A DTO is a data carrier across a boundary; it is not a separate architectural layer and does not imply a global `dtos/` folder.

- **Domain** owns entities, value objects, domain events, and invariants. It must not import HTTP, persistence, application-service, or adapter DTOs. A value with domain rules should be modeled as a value object rather than repeatedly represented as an unconstrained primitive.
- **Application use cases** own their input and result contracts. Keep a use-case-specific `Input`, `Command`, `Query`, or `Result` beside the service or use case that consumes it.
- **Application ports** own their input, output, and retrieved-data contracts. Keep a port-specific type beside the port interface by default; an infrastructure adapter imports that contract to implement it. For example, `CompletePasskeyAuthenticationInput` belongs with `IPasskeyAuthenticationRepository` because that port defines its meaning and atomicity guarantees.
- **Presentation and `@calibrate/api-contracts`** own HTTP request/response, cookie, header, and other wire-format shapes. Presentation validates and maps those shapes to application inputs and maps application results to responses.
- **Infrastructure** owns database rows, ORM/Kysely types, third-party SDK payloads, and storage-specific records. It maps them to and from the application port and domain contracts. These implementation types must not leak into application ports.

Use a dedicated adjacent types module only when a contract is genuinely shared, needs substantial independent documentation, or makes its owner unwieldy. Do not extract every parameter object preemptively, and do not make a catch-all DTO module that mixes unrelated use-case, port, HTTP, and persistence contracts.

Types with identical fields are not automatically the same contract: an HTTP request, an application use-case input, and a persistence record may evolve for different reasons. Map at semantic or volatility boundaries to preserve that independence. Conversely, do not duplicate a type merely to create the appearance of a boundary; in TypeScript, structurally identical interfaces remain assignable. Prefer a domain value object or branded type when the compiler must distinguish concepts.

Name contracts for their role (`CreateUserInput`, `PreparedPasskeyAuthentication`, `DayLogResponse`) rather than relying on a generic `Dto` suffix. DTOs should carry data, not entity identity or business behavior; domain invariants remain in domain objects, while wire-format validation remains at presentation boundaries.

### Naming conventions

- `FoodEntryController` is acceptable even though the operation goes through `DayLogService`. Controllers are an HTTP routing concern, not a domain modeling concern. The service dependency determines domain ownership, not the controller name.
- Domain factory methods are named `Entity.create(props)` for new entities and `Entity.reconstitute(props)` for rehydrating from persistence. This makes clear which path generates a new ID vs. restoring an existing one.
- HTTP request/response shapes live in `packages/api-contracts` (`@calibrate/api-contracts`).

### Transactions

See `PostgresDayLogRepository.addFoodEntry()` in `apps/backend/src/infrastructure/persistence/repositories/postgres-day-log-repository.ts`. The repository owns the transaction boundary; the service layer does not manage transactions directly.

## Consequences

- Backend changes must preserve inward-pointing source-code dependencies: presentation may depend on application; infrastructure may depend on application and domain, application may depend on domain; domain must not depend on application, infrastructure, or presentation.
- Mutations to aggregate children should go through their aggregate root repository from the application layer.
- Cross-aggregate business rules belong in application services unless a later ADR establishes a different pattern.
- Repository abstractions should speak in domain terms; table-oriented DAOs remain infrastructure implementation details.
- Contract types are owned by their use case, port, presentation/API, or infrastructure boundary rather than by a global DTO category.

## Explicitly Deferred

- Full aggregate `save()` / upsert / diff mechanism
- A `FoodEntryDao` internal extraction (only warranted if `PostgresDayLogRepository` grows unwieldy)
- A read-only `FoodEntryQueryPort` for reporting (only warranted if reporting queries need a service-layer abstraction)

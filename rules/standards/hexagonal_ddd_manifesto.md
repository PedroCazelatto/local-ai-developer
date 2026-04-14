# Manifesto: Hexagonal Architecture & Domain-Driven Design

## 1. The Core Principle: Dependency Direction
The dependency always points **inwards**.
- The **Domain** must not know anything about the outside world (Application or Infrastructure).
- The **Application** knows the Domain but not the Infrastructure.
- The **Infrastructure** knows both but is only responsible for technical implementation.

---

## 2. Layer Definitions

### A. Domain Layer (The Heart)
- **Entities:** Objects with a unique identity that persists over time.
- **Aggregates:** Clusters of domain objects treated as a single unit.
- **Value Objects:** Objects defined by their attributes (no identity).
- **Domain Services:** Business logic that doesn't naturally fit into an Entity.
- **Domain Events:** Something that happened in the domain that other parts of the system care about.
- **CONSTRAINT:** Zero dependencies on external libraries (no TypeORM, no React Native, no Fetch).

### B. Application Layer (The Orchestrator)
- **Use Cases:** Implements the specific business actions (e.g., `CreateOrder`, `processPayment`).
- **Input Ports:** Interfaces that define how the outside world communicates with the domain.
- **Output Ports:** Interfaces that the domain uses to communicate with the outside world (e.g., `UserRepositoryInterface`).
- **CONSTRAINT:** No business logic here; only orchestration of domain objects.

### C. Infrastructure Layer (The Shell)
- **Driving Adapters:** Entry points (e.g., REST Controllers, CLI commands, Mobile Screens).
- **Driven Adapters:** External tools (e.g., Databases, Mail Services, Third-party APIs).
- **Models/DTOs:** Data structures specific to external tools that must be mapped to Domain Entities.

---

## 3. Naming Conventions & Rules
- **Ports:** Must be interfaces and usually follow the pattern `[Action]Port` or `[Entity]Repository`.
- **Adapters:** Must implement a Port and follow the pattern `[Tech][PortName]Adapter` (e.g., `PostgresUserRepositoryAdapter`).
- **Mapping:** Always map Infrastructure models to Domain Entities before they reach the Application layer. Never let a "Database Model" leak into a "Use Case".

---

## 4. Forbidden Practices
- No `@Decorators` from frameworks inside the Domain.
- No direct database calls inside Use Cases.
- No "Anemic Domain Models" (Entities that are just data holders without behavior).
- No hardcoding of external URLs or secrets in any layer except Infrastructure (via Env vars).

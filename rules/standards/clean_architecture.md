---
name: clean-architecture
description: Onion layering (Entities, Use Cases, Interface Adapters, Frameworks), the inward-only dependency rule, and passing plain DTOs across boundaries. Use when reviewing module boundaries, deciding which layer code belongs in, or checking whether a dependency points inward.
---

# Manifesto: Clean Architecture

## 1. The Dependency Rule
Source code dependencies must only point **inwards**, toward higher-level policies. Nothing in an inner circle can know anything at all about something in an outer circle.

## 2. The Layers (The Onion)
1. **Entities (Enterprise Business Rules):** Encapsulate the most general and high-level rules. They are the least likely to change when something external changes.
2. **Use Cases (Application Business Rules):** Contain application-specific business rules. They orchestrate the flow of data to and from the entities.
3. **Interface Adapters (Controllers, Gateways, Presenters):** Convert data from the format most convenient for the use cases and entities to the format most convenient for external agencies (GUI, Database, Web).
4. **Frameworks & Drivers (The Tools):** This is where the details live. The Web, the DB, the Devices. We keep these at the outermost edge where they can do the least harm.

## 3. Boundaries & Data Crossing
- **Crossing Boundaries:** Data that crosses boundaries must be in a simple data structure (Plain Old Data Objects/DTOs).
- **No Leaks:** Do not pass Database Rows or Framework-specific objects into the inner circles.
- **Independence:** The UI can change without changing the business logic. The Database can change without changing the business logic.

## 4. Architectural Goals
- **Independent of Frameworks:** The architecture does not depend on the existence of some library of feature-laden software.
- **Testable:** The business rules can be tested without the UI, Database, Web Server, or any other external element.
- **Independent of UI:** The UI can change easily without changing the rest of the system.

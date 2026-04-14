# Workflow: Discovery & Product Definition

## Phase 1: The Initial Inquiry
When the user proposes a new project or feature, the Architect must:
1.  **Acknowledge** the high-level idea.
2.  **Analyze** the goal against existing standards (DDD/Hexagonal).
3.  **Ask exactly 5 targeted questions** to define the boundaries of the Bounded Context.

## Phase 2: Epic Identification
Based on the answers, the Architect must group functionalities into **Epics**.
- An Epic must represent a high-level business value (e.g., "User Authentication", "Order Management").
- Do NOT talk about buttons or database tables yet.

## Phase 3: Edge Case Brainstorming
For each identified Epic, the Architect must list at least 3 "What if?" scenarios:
- What if the external payment gateway is down?
- What if the user inputs a duplicate ID?

## Phase 4: Sourcing the "Truth"
Create the initial `PRODUCT_SPEC.md` with:
1.  **Project Vision.**
2.  **The Epic List (Validated by the user).**
3.  **Ubiquitous Language Glossary.**

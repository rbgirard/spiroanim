# Project Overview

- This is a Vue 3 application built with Vite and TypeScript.
- Use the Vue Composition API and `<script setup lang="ts">` in single-file components.
- The application may eventually support SSR. Keep reusable logic independent of browser-only APIs where practical.
- Three.js and editor-related functionality will primarily run on the client.
- Use custom UI components rather than Vuetify or another full UI framework.

# Project Structure

- Use `@/*` as the single source alias for `src/*`. Prefer explicit paths such as `@/components/ui/BaseButton.vue` or `@/features/editor/types` instead of adding aliases for each top-level directory.
- Keep route-level components in `src/views`. Views should primarily compose layouts and features rather than contain substantial business logic.
- Keep broadly reusable presentation components in `src/components`, with low-level controlled primitives in `src/components/ui`, application-shell components in `src/components/layout`, and reusable icon infrastructure in `src/components/icons`.
- Keep application-wide composables in `src/composables` and application-wide Pinia stores in `src/stores`. Code owned by one feature belongs with that feature instead.
- Keep substantial product functionality under `src/features/<feature>`. A feature may contain its own `components`, `composables`, `stores`, `types`, `math`, and `workers` when those items are not meaningfully shared.
- Keep shared domain and cross-feature types in `src/types`. Keep feature-specific types beside their feature and continue to use authoritative library types directly.
- Keep shared pure geometry, vector, quaternion, curve, interpolation, animation, and numeric logic in `src/math`.
- Keep persistence, serialization, file import/export, and other external-effect boundaries in `src/services`.
- Keep small, pure, broadly reusable helpers in `src/utils`. Prefer a more specific feature, math, service, or worker location whenever one applies.
- Keep shared workers and worker infrastructure in `src/workers`. Place a worker used by only one feature under that feature, and keep its typed message contracts and client adapter beside it.
- Keep build, generated-declaration, global-type, and similar infrastructure in `src/sys` as described below.
- Do not introduce vague overlapping directories such as `common`, `shared`, `helpers`, `managers`, `models`, or `controllers` without an approved, clearly distinct responsibility.
- Create feature subdirectories only when corresponding code exists. Do not add speculative layers or barrel files solely to mirror the directory structure.

# Core Dependencies

- Runtime dependencies include Vue 3, Vue Router, Pinia, `pinia-plugin-persistedstate`, VueUse (`@vueuse/core`), Three.js, and `@mdi/js`.
- Testing uses Vitest with jsdom, Vue Test Utils for component tests, and Playwright for end-to-end tests.
- `unplugin-auto-import` is configured through `vite.config.ts`, using `src/sys/auto-imports.ts` as its curated source list and generating declarations under `src/sys`.

# TypeScript Standards

- Use strict TypeScript. The project extends the strict Vue TypeScript configuration and enables `noUncheckedIndexedAccess` for application code.
- Never introduce `any`. If a solution appears to require it, first seek a properly typed alternative. Ask for guidance only when no sound alternative is available.
- Do not use `as unknown` or double assertions merely to bypass the type system. Use them only at unavoidable external boundaries, with a concise explanation and the narrowest possible scope.
- Preserve type inference and IntelliSense. Prefer explicit reusable types over repeated inline object shapes.
- Avoid unnecessary type assertions and do not suppress errors with `@ts-ignore`.
- Use `@ts-expect-error` only when the error is intentional, documented, and tested.
- Give public functions, composables, stores, and component contracts clear types.
- Keep runtime validation separate from compile-time typing when both are needed.
- Prefer types exported by Vue and other installed libraries over locally recreated equivalents. Preserve the library's generics, inference, overloads, and future compatibility whenever practical.
- Before defining a new application type for a framework or library concept, inspect that package's exported TypeScript definitions and reuse, extend, narrow, or compose them.
- Do not copy library type structures into local interfaces merely to avoid an import.
- Common, unambiguous type-only definitions may be exposed globally through `src/sys/global.d.ts` when they are used broadly throughout the application.
- Global type aliases must directly reference their authoritative platform or library definitions. Do not maintain independent copies of upstream definitions.
- Keep feature-specific, domain-specific, rarely used, or potentially ambiguous types explicitly imported. Global declarations should remain a small curated vocabulary rather than a substitute for modules.
- Use globally available types without redundant type imports. When an upstream type is not part of the curated globals, import it directly from its owning library.
- When extending global interfaces such as `Window`, keep the augmentation narrow and use the authoritative external type when one exists.

# Vue Standards

- Use the Composition API and `<script setup lang="ts">`.
- Prefer `ref`, `computed`, and focused composables over large component scripts.
- Keep business logic out of presentation components and move reusable stateful logic into composables.
- Use Pinia for shared application state, not as a substitute for local component state.
- Prefer setup-style Pinia stores: `defineStore(id, () => {})`.
- Do not destructure reactive objects in ways that break reactivity; use `storeToRefs` where appropriate.
- Prefer computed values or explicit events to watchers when they express the behavior more clearly.
- Clean up event listeners, observers, animation frames, workers, and other resources when components unmount.

# Auto-Import Conventions

- `unplugin-auto-import` is configured in `vite.config.ts`. Runtime auto-imports are declared centrally in `src/sys/auto-imports.ts`.
- Before adding an explicit import from Vue, Pinia, Vue Router, or VueUse, check `src/sys/auto-imports.ts`. Do not explicitly import a symbol that is already configured for auto-import unless a concrete technical reason requires it.
- Add frequently used runtime APIs to `src/sys/auto-imports.ts` only when they are broadly useful across the application. Keep specialized, ambiguous, side-effectful, or rarely used APIs explicitly imported at their usage sites.
- Prefer framework and library APIs over locally reimplementing equivalent reactive, routing, store, lifecycle, DOM, or utility behavior.
- `src/sys/auto-imports-generated.d.ts` is generated by `unplugin-auto-import`, intentionally ignored by Git, and must never be edited manually.
- Regenerate the auto-import declaration through the normal Vite or build process after changing `src/sys/auto-imports.ts`.
- Do not assume that a symbol is globally available merely because its library is installed. It must appear in the generated declaration or in an intentional declaration under `src/sys`.
- Auto-imports provide runtime values. Global type aliases are a separate mechanism and belong in `src/sys/global.d.ts`.

# System Definitions (`src/sys`)

- Treat `src/sys` as infrastructure shared by the application, TypeScript, and build tooling.
- `src/sys/auto-imports.ts` is the single source of truth for globally auto-imported runtime APIs.
- `src/sys/global.d.ts` is the single source of truth for intentional application-wide type aliases and global interface augmentation.
- `src/sys/auto-imports-generated.d.ts` is generated output and must never be edited manually.
- Keep files in `src/sys` free of application state, browser startup behavior, and unrelated side effects because build and test configuration may load them in a Node environment.
- Use `import type` for dependencies used only to construct global type aliases.
- Every global alias should be backed directly by an authoritative platform or library type. Avoid locally reconstructed approximations and preserve upstream generic parameters.
- Use clear aliases when an upstream name could conflict with DOM globals, application models, or another library.
- Add a runtime API or type to the global vocabulary only when repeated use justifies the reduced explicitness.
- After changing auto-import or global declarations, regenerate declarations and run applicable formatting, linting, type checking, tests, and the build.

# Component Standards

- Reusable components belong in `src/components`. Place low-level controlled UI primitives in `src/components/ui`, layout and application-shell components in `src/components/layout`, and feature-owned components under their feature.
- Keep UI components focused, reusable, and presentational where practical. Prefer controlled components using props and emitted events.
- Low-level reusable UI components must not import application stores. Feature-specific components may use stores only when that dependency is part of their documented responsibility.
- Prefer semantic native HTML and avoid unnecessary wrappers.
- Accessibility is required: support keyboard interaction, focus behavior, labels, disabled states, and appropriate ARIA attributes where native semantics are insufficient.
- Prefer CSS custom properties and deliberate component variants over duplicate implementations.
- Keep component APIs small. Use `defineModel` when the component genuinely exposes a model contract; otherwise use explicit props and emits.
- Add meaningful Vitest and Vue Test Utils tests for reusable UI components when they expose behavior, state, interaction, accessibility requirements, or a public contract. Cover public behavior such as props, rendering, emitted events, keyboard interaction, disabled behavior, model updates, and accessibility attributes.
- Avoid tests coupled to private implementation details and avoid large snapshots.

# Custom UI and Icons

- Do not add Vuetify or another full UI framework unless explicitly requested.
- Build custom UI components where practical, especially buttons, sliders, range sliders, icon buttons, panels, and inputs. For complex interactive primitives such as menus, dialogs, comboboxes, popovers, and tooltips, prefer native platform behavior or evaluate a lightweight headless implementation before building one from scratch.
- Use `@mdi/js` paths through a reusable icon component instead of duplicating SVG markup.
- Keep the base icon component independent of application state and icons tree-shakeable by importing only used paths.

# Composable Standards

- Give each composable one focused responsibility, use the `use` prefix, and use a `.ts` filename.
- Do not hide unrelated global side effects inside composables. Accept dependencies as parameters when that improves testability.
- Keep browser-only work in lifecycle hooks or behind environment guards. Shared or potentially SSR-evaluated modules must not access browser APIs during module initialization. Browser-only modules may do so only when their client-only execution boundary is explicit.
- Return a clear, intentionally designed public API and add unit tests for meaningful behavior.

# Three.js and Math Standards

- Separate pure vector, quaternion, angle, geometry, interpolation, and animation calculations from rendering code.
- Prefer pure functions for reusable math and add focused tests, especially for zero-length vectors, parallel and antiparallel vectors, floating-point tolerances, and angle wrapping.
- Avoid unnecessary per-frame allocations and normalization. Clearly document guarantees such as already-normalized inputs.
- Reuse temporary Three.js objects in hot paths when safe.
- Do not mutate caller-owned vectors, quaternions, matrices, or geometries unless the contract explicitly permits it.
- Dispose of geometries, materials, textures, render targets, controls, listeners, and renderer resources when no longer needed.
- Keep renderers, canvases, DOM integration, controls, and WebGL-dependent initialization client-side. Pure Three.js math and data-processing code may run in non-browser environments when supported.

# Worker Standards

- Keep worker message contracts strongly typed. Prefer discriminated unions or typed request maps to loose strings and payloads.
- Keep communication symmetrical where the architecture supports it.
- Handle worker termination and pending requests during cleanup.
- Keep serializable data separate from Three.js instances unless an explicit serialization format is used.
- Add tests for message routing and error behavior where practical.

# Testing Standards

- Use Vitest for unit tests, Vue Test Utils for Vue component tests, and Playwright for complete user workflows.
- Add tests for new reusable utilities, composables, stores, and UI components when they contain meaningful logic, behavior, edge cases, or public contracts.
- Bug fixes should include a regression test when the behavior can be tested reliably at a reasonable cost. Otherwise, document why a test was not added.
- Test observable behavior and public contracts, not private implementation details.
- Keep tests deterministic and independent of execution order.
- Do not leave skipped, focused, or intentionally failing tests, and avoid large snapshots.
- Mock browser APIs and external boundaries only when necessary; avoid mocking internal implementation details.
- Prefer meaningful tests over chasing arbitrary coverage percentages.

# Code Quality

- Keep files and functions focused, prefer clear code over clever abstractions, and introduce abstractions only when they remove real duplication or establish a useful boundary.
- Search the repository before creating utilities, components, or abstractions.
- When multiple valid implementations exist, prefer consistency with the surrounding code over introducing a new pattern.
- Avoid unrelated refactors and formatting-only changes while implementing a scoped task.
- When refactoring, preserve observable behavior unless the task explicitly changes it. Remove dead code created by the change, and leave no temporary debugging output or commented-out implementations.
- Do not add a dependency when a small, maintainable implementation is sufficient.
- Treat comments as part of the codebase. Preserve their intent and technical detail when they remain accurate; update them when implementation changes make them inaccurate. Remove comments only when obsolete, misleading, or explicitly requested, and never replace meaningful explanations with generic summaries.
- Prefer extending existing abstractions over introducing parallel implementations that solve the same problem.
- Do not preserve an existing pattern merely for consistency when it is known to be incorrect, unsafe, deprecated, or incompatible with the requested change. Explain the exception before introducing a replacement pattern.
- Avoid changing public component props, emitted events, composable return contracts, store APIs, serialized formats, or worker message contracts unless required by the task.

# Documentation

- Update documentation when behavior, architecture, commands, or public APIs change.
- Keep this file focused on durable agent instructions. Put detailed architecture in `ARCHITECTURE.md` or an appropriate file under `docs/`.
- Add nested `AGENTS.md` files only for meaningful local rules, and include only additions or overrides for that directory.
- When a preference is declared a permanent convention, record it in the appropriate documentation instead of relying on conversation history.

# Legacy Code Migration

- Treat code imported or converted from the old system as source material, not as an architectural template for the new application.
- Before placing migrated code, identify whether each responsibility is application-wide, feature-owned, route-level, presentational, pure math, an external-effect service, a worker boundary, a shared type, or system infrastructure, and place it according to the current project structure.
- Do not preserve old directory names, module boundaries, global state, inheritance patterns, browser assumptions, or duplicated utilities merely to minimize the textual diff.
- Prefer Vue Composition API, setup-style Pinia stores, current library TypeScript definitions, and the existing auto-import and global-type conventions when replacing old equivalents.
- Separate reusable pure calculations from DOM, Vue, Three.js rendering, persistence, and worker orchestration while migrating code when that separation is reasonably scoped to the task.
- Search the new repository for an existing component, composable, type, utility, math function, service, store, or worker contract before bringing over an old implementation.
- Preserve observable behavior and validated domain rules from the old system unless the task explicitly changes them. Add focused characterization or regression tests when migration could alter meaningful behavior.
- When old code spans multiple responsibilities, split it along the current architectural boundaries if the change is local and clear. If doing so would materially expand the task or change public behavior, explain the proposed restructuring and obtain approval first.
- Remove obsolete compatibility scaffolding, dead code, and old-system naming created solely by the migration once it is no longer required, while avoiding unrelated cleanup.
- In migration summaries, report important structural decisions, behavior intentionally preserved, behavior intentionally changed, and old patterns that were not carried forward.

# Workflow

Before modifying code:

- If a task would significantly change the project’s architecture, explain the proposed approach and obtain approval before implementing it, unless the requested task clearly authorizes the architectural change or asks for autonomous implementation.
- When ambiguity could materially affect architecture, public APIs, persisted data, or observable behavior, ask for clarification. Otherwise, make the smallest reasonable assumption and report it.
- Read this file and any more specific `AGENTS.md` between the repository root and the target files.
- Inspect the relevant code and tests and identify existing patterns.
- For broad or architectural work, explain the intended approach before extensive changes unless immediate implementation was explicitly requested.

While modifying code:

- Keep the change narrowly scoped and add or update tests alongside it.
- Do not modify unrelated files or overwrite intentional user changes.
- Run the repository formatting command only when its scope will not modify unrelated files; otherwise format only changed files using the configured formatter.

Validation should be proportional to the scope of the change. Run broader checks when shared types, build configuration, routing, workers, or application-wide behavior are affected:

1. Format changed files with the configured formatter, or run `npm run format` when its scope will not modify unrelated files.
2. `npm run lint`
3. Relevant unit tests with `npm run test:unit -- <arguments>` and, when practical, the full `npm run test:unit -- --run` suite
4. `npm run type-check`
5. `npm run build`
6. `npm run test:e2e` when the task affects a complete user workflow

Report which commands ran and whether they passed. Use only scripts that exist in `package.json`; mention a missing command instead of inventing one. Note that the current formatting script targets only `src/`.

# Git and Safety

- Do not commit, push, reset, rebase, delete branches, or rewrite history unless explicitly instructed.
- Do not discard uncommitted user changes.
- Do not modify environment files, credentials, tokens, or secrets, and never add secrets to tracked files.
- Do not make destructive changes merely to resolve a test or build failure.
- Verify that generated-file changes are expected before keeping them.
- Do not install, update, or remove dependencies unless the task requires it or the user explicitly approves it.

# Definition of Done

A task is complete only when:

- The requested behavior is implemented using the established architecture.
- Types remain strict and IntelliSense is preserved.
- Relevant tests are added or updated.
- Applicable formatting, linting, type checking, tests, and build checks pass.
- No unrelated files changed.
- Documentation is updated where necessary.
- Assumptions, limitations, and checks that could not be run are clearly reported.
